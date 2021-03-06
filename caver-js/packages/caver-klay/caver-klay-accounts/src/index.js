/*
    This file is part of web3.js.

    web3.js is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    web3.js is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with web3.js.  If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * Add '0x' hex string when private key does not contain '0x' in privateKeyToAccount  2018-11
 * Change preamble message, defaultKeyName 2018-11
 */

var _ = require("underscore");
var core = require('../../../caver-core');
var Method = require('../../../caver-core-method');
var Promise = require('any-promise');
// account, hash, rlp, nat, bytes library will be used from 'eth-lib' temporarily.
var Account = require("eth-lib/lib/account");
var Hash = require("eth-lib/lib/hash");
var RLP = require("eth-lib/lib/rlp");
var Nat = require("eth-lib/lib/nat");
var Bytes = require("eth-lib/lib/bytes");
var cryp = (typeof global === 'undefined') ? require('crypto-browserify') : require('crypto');
var scryptsy = require('scrypt.js');
var uuid = require('uuid');
var utils = require('../../../caver-utils');
var helpers = require('../../../caver-core-helpers');
const { encodeRLPByTxType, makeRawTransaction } = require('./makeRawTransaction')

var elliptic = require('elliptic')
var secp256k1 = new (elliptic.ec)('secp256k1')

const rpc = require('../../../caver-rtm').rpc

/**
 * underscore 메서드 이용해서 undefined거나 null인 경우 판단.
 * undefined나 null인 경우를 'Not' 이라고 해석한다.
 */
var isNot = function(value) {
    return (_.isUndefined(value) || _.isNull(value));
};

/**
 * 0x000000413f812f1a 이런식으로 들어오는거에서 앞에 0 떼주는 기능을 한다.
 * @todo 꼭 이렇게 떼야되나? startsWith으로 while을 돌리고 slice(3)을 하네
 * 말이 slice(3)이지 결국 '0x' 붙은거 치면 while문 당 하나씩만 떼는건데.
 * 상관없나
 */
var trimLeadingZero = function (hex) {
    while (hex && hex.startsWith('0x0')) {
        hex = '0x' + hex.slice(3);
    }
    return hex;
};

/**
 * hex string이 2로 나누어떨어지지 않으면 앞에 '0x'를 '0x0'으로 바꿔서
 * 2로 나누어떨어지게끔 해주는 함수이다.
 */
var makeEven = function (hex) {
    if(hex.length % 2 === 1) {
        hex = hex.replace('0x', '0x0');
    }
    return hex;
};

function coverInitialTxValue(tx) {
  if (typeof tx !== 'object') throw ('Invalid transaction')
  tx.to = tx.to || '0x'
  tx.data = tx.data || '0x'
  tx.value = tx.value || '0x'
  tx.chainId = utils.numberToHex(tx.chainId)
  return tx
}

var Accounts = function Accounts(...args) {
    var _this = this;

    // sets _requestmanager
    core.packageInit(this, args);

    // remove unecessary core functions
    delete this.BatchRequest;
    delete this.extend;

    /**
     * net_version, klay_gasPrice, klay_getTransactionCount json rpc 콜 날릴 수 있는
     * 메서드를 Account instance에 붙여준다.
     */
    var _klaytnCall = [rpc.getId, rpc.getGasPrice, rpc.getTransactionCount]
    // attach methods to this._klaytnCall
    this._klaytnCall = {};
    _.each(_klaytnCall, function (method) {
        method.attachToObject(_this._klaytnCall);
        method.setRequestManager(_this._requestManager);
    });


    this.wallet = new Wallet(this);
};

/**
 * Generates an account object with private key and public key.
 * 보통 {
 *   privateKey: ...,
 *   address: ...,
 * }
 * 만 존재하는 object에 signTransaction, sign, encrypt 메서드 달아주는 함수이다.
 */
Accounts.prototype._addAccountFunctions = function (account) {
    var _this = this;

    // add sign functions
    account.signTransaction = function signTransaction(tx, callback) {
        return _this.signTransaction(tx, account.privateKey, callback);
    };
    account.sign = function sign(data) {
        return _this.sign(data, account.privateKey);
    };

    account.encrypt = function encrypt(password, options) {
        return _this.encrypt(account.privateKey, password, options);
    };


    return account;
};

/**
 * cf) Accounts와 Account는 다른 모듈이다.
 * Account (외부모듈)의 create 함수를 이용해서 account를 만들어 준 뒤에,
 * _addAccountFunctions를 통해 signTransaction, sign, encrypt 메서드를 붙여준다.
 * _addAccountFunctions가 리턴하는 것은 저런 메서드가 붙은 account이기 때문에
 * return this._addAccountFunctions 해줘도 상관없는 것임.
 *
 * entropy라는 랜덤 스트링을 주면 외부모듈 Account가 account 만들 때 영향을 준다고 함.
 * Account.create의 결과값은 다음과 같은 형태이다.
 * {
 *   address: address,
 *   privateKey: privateKey
 * }
 *
 */
Accounts.prototype.create = function create(entropy) {
    return this._addAccountFunctions(Account.create(entropy || utils.randomHex(32)));
};

/**
 * 외부모듈 Account의 fromPrivate 메서드를 이용하면 privatekey를 parameter로 주어서
 * account를 만들 수 있다.
 * Account 모듈의 fromPrivate 메서드 자체가 account 만드는 메서드임.
 * cav.klay.accounts.privateKeyToAccount('0x348ce564d427a3311b6536bbcff9390d69395b06ed6c486954e971d960fe8709');
  > {
      address: '0xb8CE9ab6943e0eCED004cDe8e3bBed6568B2Fa01',
      privateKey: '0x348ce564d427a3311b6536bbcff9390d69395b06ed6c486954e971d960fe8709',
      signTransaction: function(tx){...},
      sign: function(data){...},
      encrypt: function(password){...}
  }
 */
Accounts.prototype.privateKeyToAccount = function privateKeyToAccount(privateKey) {
  if (!utils.isValidPrivateKey(privateKey)) throw new Error('Invalid private key')

  if (privateKey.slice(0, 2) !== '0x') {
    privateKey = `0x${privateKey}`
  }
  return this._addAccountFunctions(Account.fromPrivate(privateKey))
}

/**
 * transaction 을 sign하는 메서드이다.
 * 당연히 sign을 해야하기 때문에 privateKey를 paramater로 넘겨줘야 한다.
 *
 * 사용 예)
 * cav.klay.accounts.signTransaction({
      to: '0xF0109fC8DF283027b6285cc889F5aA624EaC1F55',
      value: '1000000000',
      gas: 2000000,
      gasPrice: '234567897654321',
      nonce: 0,
      chainId: 1
    }, '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318')
    .then(console.log);
    > return 값의 형태
    {
      messageHash: '0x6893a6ee8df79b0f5d64a180cd1ef35d030f3e296a5361cf04d02ce720d32ec5',
      r: '0x9ebb6ca057a0535d6186462bc0b465b561c94a295bdb0621fc19208ab149a9c',
      s: '0x440ffd775ce91a833ab410777204d5341a6f9fa91216a6f3ee2c051fea6a0428',
      v: '0x25',
      rawTransaction: '0xf86a8086d55698372431831e848094f0109fc8df283027b6285cc889f5aa624eac1f55843b9aca008025a009ebb6ca057a0535d6186462bc0b465b561c94a295bdb0621fc19208ab149a9ca0440ffd775ce91a833ab410777204d5341a6f9fa91216a6f3ee2c051fea6a0428'
    }

    messageHash - String: The hash of the given message.
    r - String: First 32 bytes of the signature
    s - String: Next 32 bytes of the signature
    v - String: Recovery value + 27
    rawTransaction - String: The RLP encoded transaction, ready to be send using
 */
Accounts.prototype.signTransaction = function signTransaction(tx, privateKey, callback) {
    var _this = this,
        error = false,
        result

    callback = callback || function () {}

    if (!utils.isValidPrivateKey(privateKey)) throw new Error('Invalid private key')
    privateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey

    /**
     * transaction을 sign하기 위해 사용되는 메서드인데, tx가 없으면,
     * 당연히 에러를 뱉는다.
     * callback을 이용해 error를 뱉고, Promise.reject로 error를 담아주어
     * 후에 .catch로 잡을 수 있게끔 한다.
     */
    if (!tx) {
      error = new Error('No transaction object given!')

      callback(error)
      return Promise.reject(error)
    }

    /**
     * 본격적으로 transaction sign 하는 함수이다.
     * 'gas'나 'gasLimit'으로 gas가 설정되어 있지 않다면, 에러를 뱉고,
     * nonce나 gas, gasPrice, chainId가 음수인 경우는 에러이기 때문에 이 때도 에러를 뱉는다.
     */
    function signed(tx) {

      if (!tx.senderRawTransaction) {
        // If `to` field of transaction is missing, it means a contract creation tx.
        // For contract creation, `data` field should be specified.
        // @TODO:
        // UPDATE:
        // Account Update Tx type doesn't have `to` field and `data` field simultaneously,
        // So `(!tx.to && !tx.data)` this logic should be ignored.
        // if (!tx.to && !tx.data) {
        //   error = new Error('contract creation without any data provided')
        // }

        if (!tx.gas && !tx.gasLimit) {
          error = new Error('"gas" is missing')
        }

        if (tx.nonce < 0 || tx.gas < 0 || tx.gasPrice < 0 || tx.chainId < 0) {
          error = new Error('Gas, gasPrice, nonce or chainId is lower than 0')
        }

        // TODO: restore this code after humanreadable account demo scenario
        // signed transationc 경우, klaytn devnet 지정된 가스비가 아닐 경우 오류 발생
        // if (tx.gasPrice != helpers.constants.VALID_GAS_PRICE) {
        //     error = new Error('GasPrice should be a 25Gpeb(25000000000)');
        // }
      }

      if (error) {
        callback(error);
        return Promise.reject(error);
      }

      try {
        // Guarantee all property in transaction is hex.
        tx = helpers.formatters.inputCallFormatter(tx)

        const transaction = coverInitialTxValue(tx)

        const rlpEncoded = encodeRLPByTxType(transaction)

        const messageHash = Hash.keccak256(rlpEncoded)

        const signature = Account.makeSigner(Nat.toNumber(transaction.chainId || "0x1") * 2 + 35)(messageHash, privateKey)
        const [v, r, s] = Account.decodeSignature(signature).map(sig => makeEven(trimLeadingZero(sig)))

        const rawTransaction = makeRawTransaction(rlpEncoded, [v, r, s], transaction)

        result = {
            messageHash: messageHash,
            v: v,
            r: r,
            s: s,
            rawTransaction: rawTransaction,
            txHash: Hash.keccak256(rawTransaction),
        }

      } catch(e) {
        callback(e)
        return Promise.reject(e)
      }

      callback(null, result)
      return result
    }

    // Resolve immediately if nonce, chainId and price are provided
    // nonce, chainId, price가 tx에 들어있다면, 바로 signed 함수를 Promise.resolve로 해서
    // 후에 .then으로 잡을 수 있게끔 해준다.
    if (tx.nonce !== undefined && tx.chainId !== undefined && tx.gasPrice !== undefined) {
        return Promise.resolve(signed(tx));
    }


    // Otherwise, get the missing info from the Klaytn Node
    /**
     * nonce, chainId, gasPrice중 하나라도 정보가 없는 경우에 이 쪽으로 들어오게 되는데,
     * 없는 항목에 대해서 _klaytnCall 을 통해 가져온다.
     * 아 이래서, Accounts 모듈에서 getId, getGasPrice, getTransactionCount를 메서드로 등록
     * 했던 것이었구나.
     */
    return Promise.all([
        isNot(tx.chainId) ? _this._klaytnCall.getId() : tx.chainId,
        isNot(tx.gasPrice) ? _this._klaytnCall.getGasPrice() : tx.gasPrice,
        isNot(tx.nonce) ? _this._klaytnCall.getTransactionCount(tx.from || _this.privateKeyToAccount(privateKey).address) : tx.nonce
    ]).then(function (args) {
        if (isNot(args[0]) || isNot(args[1]) || isNot(args[2])) {
            throw new Error('One of the values "chainId", "gasPrice", or "nonce" couldn\'t be fetched: '+ JSON.stringify(args));
        }
        // signed 함수에 tx에 chainId, gasPrice, nonce extend해서 콜한다.
        return signed(_.extend(tx, {chainId: args[0], gasPrice: args[1], nonce: args[2]}));
    });
};

/**
 * rlpEncode된 rawTransaction을 parameter로 넘겨주고,
 * 이 transaction을 sign한 ethereum address를 리턴해주는 메서드이다.
 *
 * rawTx - String: The RLP encoded transaction.
 *
 * 사용 예 )
 * cav.klay.accounts.recoverTransaction('0xf86180808401ef364594f0109fc8df283027b6285cc889f5aa624eac1f5580801ca031573280d608f75137e33fc14655f097867d691d5c4c44ebe5ae186070ac3d5ea0524410802cdc025034daefcdfa08e7d2ee3f0b9d9ae184b2001fe0aff07603d9');
 * > "0xF0109fC8DF283027b6285cc889F5aA624EaC1F55"
 */
Accounts.prototype.recoverTransaction = function recoverTransaction(rawTx) {
    // encode된 rawTx를 rlp decode해서 풀어준다.
    var values = RLP.decode(rawTx);
    // decode해서 풀었으면, [6], [7], [8] 인덱스에 각각 v, r, s가 있는데 얘네를 이용해서
    // Account 모듈의 encodeSignaute를 이용해서 signature를 만들어준다.
    // 즉 encode된 rawTx를 decode해서 signature를 빼는게 이 메서드의 핵심과정임.
    var signature = Account.encodeSignature(values.slice(6,9));
    // hex값으로 존재하는 v를 Bytes 모듈의 toNumber 메서드를 이용해서 integer로 바꿔준다.
    // 앞으로 걔를 recovery 라고 부른다. (즉, recovery란 hex 값의 v를 integer로 바꾼 값.)
    var recovery = Bytes.toNumber(values[6]);
    // 그렇게 나온 recovery 가 35 보다 작으면 빈 배열(extraData가 없다는 의미),
    // 35 이상이면 거기서 - 35 하고 >> 1 시프트 연산한 값과,
    // '0x', '0x' 를 추가적으로 넣어서 총 3개의 아이템이 담긴 배열을 extraData라는 값으로 한다.
    var extraData = recovery < 35 ? [] : [Bytes.fromNumber((recovery - 35) >> 1), "0x", "0x"];
    // signingData는 eztraData values에서 [6], [7], [8]을 붙여준다.
    // 물론 recovery가 35 이상인 경우만 붙이게 될 것이다. 35 미만이면 extraData가 빈배열이기때문.
    var signingData = values.slice(0,6).concat(extraData);
    // 위에서 만든 signingData를 RLP encode한다.
    var signingDataHex = RLP.encode(signingData);
    // Hash.keccak256(signingDataHex) 는 즉, rlp encode된 애를 keccak256을 돌린애다, 즉 위에서 본 hash임
    // 걔를 signature와 같이 Account 모듈의 recover 메서드로 넘기면 이 transaction을 sign한
    // address를 추출해낼수 있다.
    return Account.recover(Hash.keccak256(signingDataHex), signature);
};

/**
 * Hashes the given message to be passed cav.klay.accounts.recover() function.
 * The data will be UTF-8 HEX decoded and enveloped as follows:
 * "\x19Klaytn Signed Message:\n" + message.length + message and hashed using keccak256.
 *
 * cav.klay.accounts.hashMessage("Hello World")
 * > "0xa1de988600a42c4b4ab089b619297c17d53cffae5d5120d82d8a92d0bb3b78f2"
 * // the below results in the same hash
 * cav.klay.accounts.hashMessage(caver.utils.utf8ToHex("Hello World"))
 * > "0xa1de988600a42c4b4ab089b619297c17d53cffae5d5120d82d8a92d0bb3b78f2"
 */
Accounts.prototype.hashMessage = function hashMessage(data) {
  const message = utils.isHexStrict(data) ? utils.hexToBytes(data) : data
  const messageBuffer = Buffer.from(message)
  const preamble = "\x19Klaytn Signed Message:\n" + message.length
  const preambleBuffer = Buffer.from(preamble)
  // klayMessage is concatenated buffer (preambleBuffer + messageBuffer)
  const klayMessage = Buffer.concat([preambleBuffer, messageBuffer])
  // Finally, run keccak256 on klayMessage.
  return Hash.keccak256(klayMessage)
};

/**
 * Signs arbitrary data.
 * This data is before UTF-8 HEX decoded and enveloped as follows:
 * "\x19Klaytn Signed Message:\n" + message.length + message.
 *
 * 사용 예)
 * cav.klay.accounts.sign('Some data', '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318');
 * > {
 *     message: 'Some data',
 *     messageHash: '0x1da44b586eb0729ff70a73c326926f6ed5a25f5b056e7f47fbc6e58d86871655',
 *     v: '0x1c',
 *     r: '0xb91467e570a6466aa9e9876cbcd013baba02900b8979d43fe208a4a4f339f5fd',
 *     s: '0x6007e74cd82e037b800186422fc2da167c747ef045e5d18a5f5d4300f8e1a029',
 *     signature: '0xb91467e570a6466aa9e9876cbcd013baba02900b8979d43fe208a4a4f339f5fd6007e74cd82e037b800186422fc2da167c747ef045e5d18a5f5d4300f8e1a0291c'
 *   }
 */
Accounts.prototype.sign = function sign(data, privateKey) {
  if (!utils.isValidPrivateKey(privateKey)) throw new Error('Invalid private key')

  const messageHash = this.hashMessage(data)
  /**
   * 외부모듈 Account의 makeSigner(27)을 해준 게 Account.sign이다
   * makeSigner => addToV => (messageHash, privateKey) => { ... }
   * addToV라는 parameter는 말그대로 'V에 더해줄 값' 이라 생각하면 될 듯.
   * const sign = makeSigner(27); // v=27|28 instead of 0|1...
   */
  const signature = Account.sign(messageHash, privateKey)
  /**
   * 바로 윗 라인에서 한 Account.sign이 return encodeSignature(...)으로 끝나는 함수이기 때문에
   * 결국 여기서 v, r, s를 빼내려면 decode를 해야한다.
   * decodeSignature 형태
   * const decodeSignature = hex => [Bytes.slice(64, Bytes.length(hex), hex), Bytes.slice(0, 32, hex), Bytes.slice(32, 64, hex)];
   * Bytes.slice로 64 ~ 끝까지 끊은걸 v
   * Bytes.slice로 0 ~ 32까지 끊은걸 r
   * Bytes.slice로 32 ~ 64까지 끊은걸 s
   */
  const [v, r, s] = Account.decodeSignature(signature)
  return {
    message: data,
    messageHash,
    v,
    r,
    s,
    signature,
  }
}

/**
 * preFixed - Boolean (optional, default: false):
 * If the last parameter is true,
 * the given message will NOT automatically be prefixed with "\x19Klaytn Signed Message:\n" + message.length + message,
 * and assumed to be already prefixed.
 */
Accounts.prototype.recover = function recover(message, signature, preFixed) {
    var args = [].slice.apply(arguments);

    /**
     * paramater를 object 형태로 받을 수 있다.
     * object 형태로 들어오면 this(Accounts) 모듈에 있는 recover를 사용한다. (재귀)
     * Assume message already prefixed, when `message` parameter type is object.
     */
    if (_.isObject(message)) {
      return this.recover(
        message.messageHash,
        Account.encodeSignature([message.v, message.r, message.s]),
        true,
      )
    }

    // prefixed는 기본적으로 false가 기본이다. prefixed가 따로 설정되어 있지 않으면
    // "\x19Klaytn Signed Message:\n" + message.length + message 를 붙여주고
    // keccak256 돌리는 this.hashMessage로 들어가게 된다.
    if (!preFixed) {
      message = this.hashMessage(message)
    }

    /**
     * signature를 하나로 던지는게 아니라, v, r, s로 나누어서 던질 때
     * message, v, r, s
     * cav.klay.accounts.recover('Some data', '0x1c', '0xb91467e570a6466aa9e9876cbcd013baba02900b8979d43fe208a4a4f339f5fd', '0x6007e74cd82e037b800186422fc2da167c747ef045e5d18a5f5d4300f8e1a029');
     * > "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23"
     */
    if (args.length >= 4) {
        // 마지막 인자 뽑는 방법. args.slice(-1)[0]
        preFixed = args.slice(-1)[0];
        // preFixed가 따로 parameter로 넘어왔다면 boolean 값일 것이기 때문에, !!preFixed로 넘기고,
        // 그게 boolean이 아니라면 parameter로 넘어오지않았다는 말이기 때문에 default 값인 false로.
        preFixed = _.isBoolean(preFixed) ? !!preFixed : false;

        // parameter가 message, v, r, s 형태로 들어오면 this(Accounts)에 있는 recover를 사용한다.(결국 재귀)
        return this.recover(message, Account.encodeSignature(args.slice(1, 4)), preFixed); // v, r, s
    }
    // message, signature로 들어왔을 때 Account 모듈의 recover 사용.
    /**
     * Account 모듈의 recover
     * const recover = (hash, signature) => {
     *   const vals = decodeSignature(signature);
     *   const vrs = { v: Bytes.toNumber(vals[0]), r: vals[1].slice(2), s: vals[2].slice(2) };
     *   const ecPublicKey = secp256k1.recoverPubKey(new Buffer(hash.slice(2), "hex"), vrs, vrs.v < 2 ? vrs.v : 1 - vrs.v % 2); // because odd vals mean v=0... sadly that means v=0 means v=1... I hate that
     *   const publicKey = "0x" + ecPublicKey.encode("hex", false).slice(2);
     *   const publicHash = keccak256(publicKey);
     *   const address = toChecksum("0x" + publicHash.slice(-40));
     *   return address;
     * };
     */
    return Account.recover(message, signature);
};

// Taken from https://github.com/ethereumjs/ethereumjs-wallet
Accounts.prototype.decrypt = function (v3Keystore, password, nonStrict) {
    if(!_.isString(password)) {
        throw new Error('No password given.');
    }

    /**
     * v3KeyStore parameter가 object로 바로 들어오면 그대로 가져다 쓰되,
     * JSON 으로 싸져있으면 parse해서 꺼내서 쓴다.
     */
    var json = (_.isObject(v3Keystore)) ? v3Keystore : JSON.parse(nonStrict ? v3Keystore.toLowerCase() : v3Keystore);

    // keyStore version이 3인 경우에만 지원한다.
    if (json.version !== 3) {
        console.warn('This is not a V3 wallet.')
        // throw new Error('Not a valid V3 wallet');
    }

    var derivedKey;
    var kdfparams;
    /**
     * 지원하는 kdf은 단 두 개
     * 1) pbkdf2
     * 2) scrypt
     */
    if (json.crypto.kdf === 'scrypt') {
        kdfparams = json.crypto.kdfparams;

        // FIXME: support progress reporting callback
        derivedKey = scryptsy(new Buffer(password), new Buffer(kdfparams.salt, 'hex'), kdfparams.n, kdfparams.r, kdfparams.p, kdfparams.dklen);
    } else if (json.crypto.kdf === 'pbkdf2') {
        kdfparams = json.crypto.kdfparams;

        if (kdfparams.prf !== 'hmac-sha256') {
            throw new Error('Unsupported parameters to PBKDF2');
        }

        derivedKey = cryp.pbkdf2Sync(new Buffer(password), new Buffer(kdfparams.salt, 'hex'), kdfparams.c, kdfparams.dklen, 'sha256');
    } else {
        throw new Error('Unsupported key derivation scheme');
    }

    /**
     * ciphertext를 byte화
     */
    var ciphertext = new Buffer(json.crypto.ciphertext, 'hex');

    /**
     * mac은
     * 1) derivedKey를 index 16부터 16자리 짜르고,
     * 2) ciphertext concat하고
     * 3) '0x' 스트링 제거
     * 4) keccak256 돌린
     * 값이다. (결국 위에서 만든 derivedKey와 json으로 가져온 ciphertext만으로 만들 수 있는 값임.)
     * json.crypto.mac에 붙어있었던 값과 derivedKey, ciphertext을 통해서 새로 만든 mac값과 비교했을 때
     * 같은 값이면, password가 올바르다고 생각할 수 있음.
     */
    var mac = utils.sha3(Buffer.concat([ derivedKey.slice(16, 32), ciphertext ])).replace('0x','');
    if (mac !== json.crypto.mac) {
        throw new Error('Key derivation failed - possibly wrong password');
    }

    var decipher = cryp.createDecipheriv(json.crypto.cipher, derivedKey.slice(0, 16), new Buffer(json.crypto.cipherparams.iv, 'hex'));
    var seed = '0x'+ Buffer.concat([ decipher.update(ciphertext), decipher.final() ]).toString('hex');

    return this.privateKeyToAccount(seed);
};

/**
 * Encrypts a private key to the web3 keystore v3 standard.
 * private key를 password를 이용해 encrypt하는 메서드이다.
 * cav.klay.accounts.encrypt(privateKey, password);
 * cav.klay.accounts.encrypt('0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318', 'test!')
    > {
        version: 3,
        id: '04e9bcbb-96fa-497b-94d1-14df4cd20af6',
        address: '2c7536e3605d9c16a7a3d7b1898e529396a65c23',
        crypto: {
            ciphertext: 'a1c25da3ecde4e6a24f3697251dd15d6208520efc84ad97397e906e6df24d251',
            cipherparams: { iv: '2885df2b63f7ef247d753c82fa20038a' },
            cipher: 'aes-128-ctr',
            kdf: 'scrypt',
            kdfparams: {
                dklen: 32,
                salt: '4531b3c174cc3ff32a6a7a85d6761b410db674807b2d216d022318ceee50be10',
                n: 262144,
                r: 8,
                p: 1
            },
            mac: 'b8b010fff37f9ae5559a352a185e86f9b9c1d7f7a9f1bd4e82a5dd35468fc7f6'
        }
    }

    `dklen` is the desired length of the derived key
    `salt` - A string of characters that modifies the hash to protect against Rainbow table attacks
    `n` - CPU/memory cost parameter
    `r` - The blocksize parameter, which fine-tunes sequential memory read size and performance. 8 is commonly used.
    `p` - Parallelization parameter
    `c` - the number of iterations desired

    geth 상위 디렉터리에 있는 keystore 파일이 생긴 형태와 동일하다.
    {
      "address":"9e1023dbce2d6304f5011a4db56a8ed7ba271650",
      "crypto":{"cipher":"aes-128-ctr",
      "ciphertext":"0f1158156a26e5135e107522639bb2b549acf159a12097c02fc2d73b97841000",
      "version":3,
      "cipherparams":{"iv":"e15c86e8797c37bffd2ebfa68a532595"},
      "kdf":"scrypt",
      "kdfparams":{
        "dklen":32,
        "n":262144,
        "p":1,
        "r":8,
        "salt":"e7c4605ad8200e0d93cd67f9d82fb9971e1a2763b22362017c2927231c2a733a"
      },
      "mac":"d2ad144ef6060ac01d711d691ff56e11d4deffc85a08de0dde27c28c23959251"},
      "id":"dfde6a32-4b0e-404f-8b9f-2b18f279fe21",
    }
 */
Accounts.prototype.encrypt = function (privateKey, password, options) {
    if (!utils.isValidPrivateKey(privateKey)) throw new Error('Invalid private key')

    var account = this.privateKeyToAccount(privateKey);

    /**
     * options에
     * {
     *   salt: ...,
     *   iv: ...,
     *   kdf: ...,
     *   dklen: ...,
     *   c: ...,
     *   n: ...,
     *   r: ...,
     *   p: ...,
     *   cipher: ...,
     *   uuid: ...,
     *   cipher: ...,
     * }
     * 이런 것들을 넣을 수 있는데, keystore에 들어가는 것을 특정한 값으로 강제해줄 수 있다.
     */
    options = options || {};
    var salt = options.salt || cryp.randomBytes(32);
    var iv = options.iv || cryp.randomBytes(16);

    var derivedKey;
    var kdf = options.kdf || 'scrypt';
    var kdfparams = {
        dklen: options.dklen || 32,
        salt: salt.toString('hex')
    };

    /**
     * kdf 종류는 딱 두개만 지원한다. (derivedkey를 얻는 방식)
     * 1) pbkdf2
     * 2) scrypt - scrypt가 기본값이다.
     */
    if (kdf === 'pbkdf2') {
        kdfparams.c = options.c || 262144;
        kdfparams.prf = 'hmac-sha256';
        derivedKey = cryp.pbkdf2Sync(new Buffer(password), salt, kdfparams.c, kdfparams.dklen, 'sha256');
    } else if (kdf === 'scrypt') {
        // FIXME: support progress reporting callback
        kdfparams.n = options.n || 4096; // 2048 4096 8192 16384
        kdfparams.r = options.r || 8;
        kdfparams.p = options.p || 1;
        derivedKey = scryptsy(new Buffer(password), salt, kdfparams.n, kdfparams.r, kdfparams.p, kdfparams.dklen);
    } else {
        throw new Error('Unsupported kdf');
    }

    var cipher = cryp.createCipheriv(options.cipher || 'aes-128-ctr', derivedKey.slice(0, 16), iv);
    if (!cipher) {
        throw new Error('Unsupported cipher');
    }

    var ciphertext = Buffer.concat([ cipher.update(new Buffer(account.privateKey.replace('0x',''), 'hex')), cipher.final() ]);

    var mac = utils.sha3(Buffer.concat([ derivedKey.slice(16, 32), new Buffer(ciphertext, 'hex') ])).replace('0x','');

    return {
        version: 3,
        id: uuid.v4({ random: options.uuid || cryp.randomBytes(16) }),
        address: account.address.toLowerCase().replace('0x',''),
        crypto: {
            ciphertext: ciphertext.toString('hex'),
            cipherparams: {
                iv: iv.toString('hex')
            },
            cipher: options.cipher || 'aes-128-ctr',
            kdf: kdf,
            kdfparams: kdfparams,
            mac: mac.toString('hex')
        }
    };
};

Accounts.prototype.privateKeyToPublicKey = function (privateKey) {
  const buffer = new Buffer(privateKey.slice(2), "hex");
  const ecKey = secp256k1.keyFromPrivate(buffer)
  const publicKey = "0x" + ecKey.getPublic(false, 'hex').slice(2)
  return publicKey
}

Accounts.prototype.encodeRLPByTxType = encodeRLPByTxType

Accounts.prototype.setAccounts = function(accounts) {
  this.wallet.clear()
  
  for (let i = 0; i < accounts.wallet.length; i++) {
    this.wallet.add(accounts.wallet[i])
  }
  
  return this
}


/* eslint-enable complexity */

// Note: this is trying to follow closely the specs on

/**
 * Account 모듈의 this.wallet으로 들어가는 Wallet 모듈.
 * 특이하게 Account 모듈은 Wallet 모듈의 this._accounts로 들어간다.
 *
 * cav.klay.accounts.wallet 이런식으로 가져올 수 있는데,
    > Wallet {
        0: {...}, // account by index
        "0xF0109fC8DF283027b6285cc889F5aA624EaC1F55": {...},  // same account by address
        "0xf0109fc8df283027b6285cc889f5aa624eac1f55": {...},  // same account by address lowercase
        1: {...},
        "0xD0122fC8DF283027b6285cc889F5aA624EaC1d23": {...},
        "0xd0122fc8df283027b6285cc889f5aa624eac1d23": {...},

        add: function(){},
        remove: function(){},
        save: function(){},
        load: function(){},
        clear: function(){},

        length: 2,
    }
 *
 * Contains an in memory wallet with multiple accounts.
 * These accounts can be used when using cav.klay.sendTransaction().
 * @todo length는 내가 memory에 가지고 있는 account들의 갯수인가?
 * @todo defaultKeyName은 뭐지?
 */
function Wallet(accounts) {
    this._accounts = accounts
    this.length = 0
    this.defaultKeyName = "caverjs_wallet"
}

/**
 * 결국 wallet instance에 account붙일 index찾는 메서드인데,
 * recursion을 이용해 pointer 0부터 찾는다.
 */
Wallet.prototype._findSafeIndex = function (pointer) {
    pointer = pointer || 0;
    if (_.has(this, pointer)) {
        return this._findSafeIndex(pointer + 1);
    } else {
        return pointer;
    }
};

/**
 * Wallet instance에 붙어있는 object의 key들을 다 가져온다음에,
 * map으로 parseInt 멕여주고,
 * filter로 9e20 미만인 애들만 뽑아준다.
 * @todo int로 9e20이 900000000000000000000 인데 이게 뭘까
 */
Wallet.prototype._currentIndexes = function () {
    var keys = Object.keys(this);
    var indexes = keys
        .map(function(key) { return parseInt(key); })
        .filter(function(n) { return (n < 9e20); });

    return indexes;
};

/**
 * Generates one or more accounts in the wallet.
 * If wallets already exist they will not be overridden.
 * Account 모듈의 create 메서드를 이용해서 privateKey를 쏙 빼주고,
 * 그것을 Wallet 모듈의 add 메서드로 넘긴다.
 * 즉, Wallet 모듈의 add 메서드는 privateKey를 직접적으로 받는 메서드인 것이다.
 */
Wallet.prototype.create = function (numberOfAccounts, entropy) {
    for (var i = 0; i < numberOfAccounts; ++i) {
        this.add(this._accounts.create(entropy).privateKey);
    }
    return this;
};

/**
 * Adds an account using a private key or account object to the wallet.
 *
 * 사용 예 )
 * cav.klay.accounts.wallet.add({
    privateKey: '0x348ce564d427a3311b6536bbcff9390d69395b06ed6c486954e971d960fe8709',
    address: '0xb8CE9ab6943e0eCED004cDe8e3bBed6568B2Fa01'
    });
    > {
        index: 0,
        address: '0xb8CE9ab6943e0eCED004cDe8e3bBed6568B2Fa01',
        privateKey: '0x348ce564d427a3311b6536bbcff9390d69395b06ed6c486954e971d960fe8709',
        signTransaction: function(tx){...},
        sign: function(data){...},
        encrypt: function(password){...}
    }
 * 결국 wallet.add라는 작업은, privateKey만 혹은 address까지 같이 있을 때,
 * 그 object에 index, sign, signTransaction, encrypt 붙여준뒤에
 * wallet instance에서 찾을 수 있게 indexing해주는 것이다.
 */
Wallet.prototype.add = function (account, humanReadableString) {

    /**
     * account parameter가 올 수 있는 형태 1) privateKey string 단독으로 오는 경우.
     * 예) cav.klay.accounts.wallet.add('0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318');
     */
    if (_.isString(account)) {
        account = this._accounts.privateKeyToAccount(account);
    }
    /**
     * account parameter 가 올 수 있는 형태 2) privateKey, address 같이 달린 object로 오는 경우.
     * cav.klay.accounts.wallet.add({
     *   privateKey: '0x348ce564d427a3311b6536bbcff9390d69395b06ed6c486954e971d960fe8709',
     *   address: '0xb8CE9ab6943e0eCED004cDe8e3bBed6568B2Fa01'
     * });
     *
     * 만약 Wallet instance에 account.address가 안붙어 있으면
     * _findSafeIndex 통해서
     * this[account.index]에도 붙이고,
     * this[account.address]에도 붙이고,
     * this[account.address.toLowerCase()]에도 붙여준다.
     * 총 account를 조회할 수 있는 방법이 세 가지 인 것.
     */

    if (humanReadableString) {
      // utils.humanReadableStringToHexAddress('toshi') === '0x746f736869000000000000000000000000000000'
      const humanReadableAddress = utils.humanReadableStringToHexAddress(humanReadableString)
      account.address = humanReadableAddress

      const accountAlreadyExists = !!this[humanReadableAddress]

      if (accountAlreadyExists) return this[humanReadableAddress]

      account.index = this._findSafeIndex()
      this[account.index] = account

      this[humanReadableString] = account // this['toshi']
      this[humanReadableAddress] = account // this['0x746f736869000000000000000000000000000000']
      this[humanReadableAddress.toLowerCase()] = account
      this.length++
    } else {
      const accountAlreadyExists = !!this[account.address]

      if (accountAlreadyExists) return this[account.address]

      account = this._accounts.privateKeyToAccount(account.privateKey)

      account.index = this._findSafeIndex()
      this[account.index] = account

      this[account.address] = account
      this[account.address.toLowerCase()] = account
      this.length++

      return account
    }
}

/**
 * Wallet instance에 있는 account는 add될 때,
 * address를 key로도 달리고,
 * index를 key로도 달리기 때문에, 그거 참조해서 delete를 통해 안에 property들 삭제해주고
 * length도 하나 깎아준다.
 * privateKey를 다 null처리.
 */
 Wallet.prototype.remove = function (addressOrIndex) {
   var account = this[addressOrIndex]

   if (account && account.address) {

     try {
       // humanreadable string
       const humanReadableString = utils.hexToUtf8(account.address)
       if (this[humanReadableString]) {
         this[humanReadableString].privateKey = null
         delete this[humanReadableString]
       }
     } catch (e) {
       
     }

     // address
     this[account.address].privateKey = null
     delete this[account.address]

     if (this[account.address.toLowerCase()]) {
       // address lowercase
       this[account.address.toLowerCase()].privateKey = null
       delete this[account.address.toLowerCase()]
     }

     // index
     this[account.index].privateKey = null
     delete this[account.index]

     this.length--

     return true
   } else {
     return false
   }
 }

/**
 * 특정 address나 index에 있는 account만 지우는게 아니라 모조리 날리고 싶을 때
 * indexes를 돌면서 _this.remove 콜.
 */
Wallet.prototype.clear = function () {
    var _this = this;
    var indexes = this._currentIndexes();

    indexes.forEach(function(index) {
        _this.remove(index);
    });

    return this;
};

/**
 * Wallet instance에 달려있는 모든 account들 password로 encrypt
 * 여기 _this[index].encrypt는 Wallet instance의 encrypt가 아니라,
 * _addAccountFunctions 돌리면서 붙은 그 encrypt 이다. (kdf 나오는 진짜 코어의 그것.)
 * account.encrypt = function encrypt(password, options) {
 *   return _this.encrypt(account.privateKey, password, options);
 * };
 *
 * 사용 예)
 * cav.klay.accounts.wallet.encrypt('test');
    > [ { version: 3,
        id: 'dcf8ab05-a314-4e37-b972-bf9b86f91372',
        address: '06f702337909c06c82b09b7a22f0a2f0855d1f68',
        crypto:
         { ciphertext: '0de804dc63940820f6b3334e5a4bfc8214e27fb30bb7e9b7b74b25cd7eb5c604',
           cipherparams: [Object],
           cipher: 'aes-128-ctr',
           kdf: 'scrypt',
           kdfparams: [Object],
           mac: 'b2aac1485bd6ee1928665642bf8eae9ddfbc039c3a673658933d320bac6952e3' } },
      { version: 3,
        id: '9e1c7d24-b919-4428-b10e-0f3ef79f7cf0',
        address: 'b5d89661b59a9af0b34f58d19138baa2de48baaf',
        crypto:
         { ciphertext: 'd705ebed2a136d9e4db7e5ae70ed1f69d6a57370d5fbe06281eb07615f404410',
           cipherparams: [Object],
           cipher: 'aes-128-ctr',
           kdf: 'scrypt',
           kdfparams: [Object],
           mac: 'af9eca5eb01b0f70e909f824f0e7cdb90c350a802f04a9f6afe056602b92272b' } }
    ]
 */
Wallet.prototype.encrypt = function (password, options) {
    var _this = this;
    var indexes = this._currentIndexes();

    var accounts = indexes.map(function(index) {
        return _this[index].encrypt(password, options);
    });

    return accounts;
};

/**
 * Decrypts keystore v3 objects.
 * keystore array를 돌면서 decrypt한다.
 * 사용 예)
 * cav.klay.accounts.wallet.decrypt([
    { version: 3,
    id: '83191a81-aaca-451f-b63d-0c5f3b849289',
    address: '06f702337909c06c82b09b7a22f0a2f0855d1f68',
    crypto:
     { ciphertext: '7d34deae112841fba86e3e6cf08f5398dda323a8e4d29332621534e2c4069e8d',
       cipherparams: { iv: '497f4d26997a84d570778eae874b2333' },
       cipher: 'aes-128-ctr',
       kdf: 'scrypt',
       kdfparams:
        { dklen: 32,
          salt: '208dd732a27aa4803bb760228dff18515d5313fd085bbce60594a3919ae2d88d',
          n: 262144,
          r: 8,
          p: 1 },
       mac: '0062a853de302513c57bfe3108ab493733034bf3cb313326f42cf26ea2619cf9' } },
     { version: 3,
    id: '7d6b91fa-3611-407b-b16b-396efb28f97e',
    address: 'b5d89661b59a9af0b34f58d19138baa2de48baaf',
    crypto:
     { ciphertext: 'cb9712d1982ff89f571fa5dbef447f14b7e5f142232bd2a913aac833730eeb43',
       cipherparams: { iv: '8cccb91cb84e435437f7282ec2ffd2db' },
       cipher: 'aes-128-ctr',
       kdf: 'scrypt',
       kdfparams:
        { dklen: 32,
          salt: '08ba6736363c5586434cd5b895e6fe41ea7db4785bd9b901dedce77a1514e8b8',
          n: 262144,
          r: 8,
          p: 1 },
       mac: 'd2eb068b37e2df55f56fa97a2bf4f55e072bef0dd703bfd917717d9dc54510f0' } }
  ], 'test');
  > Wallet {
      0: {...},
      1: {...},
      "0xF0109fC8DF283027b6285cc889F5aA624EaC1F55": {...},
      "0xD0122fC8DF283027b6285cc889F5aA624EaC1d23": {...}
      ...
  }
 */
Wallet.prototype.decrypt = function (encryptedWallet, password) {
    var _this = this;

    // forEach로 keystore object 하나씩 돌면서 _this.add로 wallet instance에 추가해줌.
    encryptedWallet.forEach(function (keystore) {
        var account = _this._accounts.decrypt(keystore, password);

        if (account) {
            _this.add(account);
        } else {
            throw new Error('Couldn\'t decrypt accounts. Password wrong?');
        }
    });

    return this;
};

/**
 * 아직 encrypt되지 않은 password와 keyName을 parameter로 받는데,
 * localStorage에 keyName과 password를 encrypt해서 저장한다.
 * 당연히 localStorage를 쓰기 때문에 Browser Only이다.
 *
 * 여기서 keyName은 위에서 봤던 "web3js_wallet"가 default로 지정되어있던 그것이다.
 * "web3js_wallet"가 default기 때문에, keyName은 optional한 parameter이다.
 * 즉, cav.klay.accounts.wallet.save('test#!$') 이렇게 호출해도 상관 없다.
 * this.encrypt는 Account들 encrypt한 정보, 즉 keystore에 들어가는 정보들을 encrypt한다.
 */
Wallet.prototype.save = function (password, keyName) {
    localStorage.setItem(keyName || this.defaultKeyName, JSON.stringify(this.encrypt(password)));

    return true;
};

/**
 * localStorage에서 keyName 기준으로 가져오는 메서드이다.
 * @todo 근데 뭘 decrypt하는거지? parameter로 password가 오는데?
 * => keystore에 있던 Account를 decrypt하는 것이었다.
 *
 * 사용 예)
 * cav.klay.accounts.wallet.load('test#!$', 'myWalletKey' || 'web3js_wallet');
    > Wallet {
        0: {...},
        1: {...},
        "0xF0109fC8DF283027b6285cc889F5aA624EaC1F55": {...},
        "0xD0122fC8DF283027b6285cc889F5aA624EaC1d23": {...}
        ...
    }
 */
Wallet.prototype.load = function (password, keyName) {
    var keystore = localStorage.getItem(keyName || this.defaultKeyName);

    if (keystore) {
        try {
            keystore = JSON.parse(keystore);
        } catch(e) {

        }
    }

    return this.decrypt(keystore || [], password);
};

/**
 * localStorage가 없다는 것은 browser 환경에서 불러지지 않았다는 뜻이기 때문에,
 * save, load가 실질적으로 기능을 못한다. 따라서 삭제해준다.
 */
if (typeof localStorage === 'undefined') {
    delete Wallet.prototype.save;
    delete Wallet.prototype.load;
}


module.exports = Accounts;
