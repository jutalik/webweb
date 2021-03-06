require('it-each')({ testPerIteration: true })
const { expect } = require('../extendedChai')

const testRPCURL = require('../testrpc')
const Caver = require('../../index.js')

const helpers = rootRequire('caver-core-helpers')

let caver

beforeEach(() => {
  caver = new Caver(testRPCURL)
})

describe('Demo scenario', () => {
  it('1. Should create humanreadable account', (done) => {
    const privateKey = '0x172ca506e52390acddaade22362ff57ef05c9f2a73e361db0453db03dfc24740'

    caver.klay.accounts.wallet.add(privateKey)


    const publicKey = '0x1041f44556f40a5e1cb41047e3d4bf9c2e1d61f8508bb37c05ac1c4854194c30372a9c94402ed806f7923810272f7e2ecbebe49f62b9bfc783158c1a8b5cd3c8'
    const transaction = {
      type: 'ACCOUNT_CREATION',
      from: '0x06cc6a0aD22DE169D8dF669Ad3507bEeb66149Ad',
      to: 'toshi',
      gas: '300000',
      value: caver.utils.toPeb(5, 'KLAY'),
      chainId: '2018',
      humanReadable: true,
      publicKey: publicKey,
    }

    caver.klay.sendTransaction(transaction)
      .on('receipt', async (receipt) => {
        console.log(receipt)
        const newAccountBalance = await caver.klay.getBalance('toshi')
        console.log(
          'caver.klay.getBalance("toshi"): ' +
          caver.utils.fromPeb(newAccountBalance, 'KLAY') +
          ' KLAY'
        )
        done()
      })
      .on('error', console.log)
  }).timeout(200000)

  it('2. Should send value transfer transaction with the account created from step 1.', (done) => {
    const toshiPrivateKey = '0xa4c64a7c4d3cb1c4d263aea5e19f7d98a5ee1822fb596f92542ee6a078464083'
    caver.klay.accounts.wallet.add(toshiPrivateKey, 'toshi')

    const transaction = {
      type: 'VALUE_TRANSFER',
      from: 'toshi',
      to: '0x2b130C23536e4586d70f3263E3d728c910Ad87f0',
      gasPrice: '0x0',
      gas: '300000',
      value: caver.utils.toPeb(2, 'KLAY'),
      chainId: '2018',
    }

    caver.klay.sendTransaction(transaction)
      .on('transactionHash', console.log)
      .on('receipt', async (receipt) => {
        console.log(receipt)
        const toshiAccountBalance = await caver.klay.getBalance('toshi')
        console.log(
          'caver.klay.getBalance("toshi"): ' +
          caver.utils.fromPeb(toshiAccountBalance, 'KLAY') +
          ' KLAY'
        )
        done()
      })
      .on('error', console.log)
  }).timeout(200000)

  it('3. Should send value transfer transaction with both human readable accounts', (done) => {
    // 3. Send value transfer transaction with both human readable accounts
    // value transfer (human readable account 'satoshi' -> human readable account 'clark')
    const toshiPrivateKey = '0xa4c64a7c4d3cb1c4d263aea5e19f7d98a5ee1822fb596f92542ee6a078464083'
    caver.klay.accounts.wallet.add(toshiPrivateKey, 'toshi')

    const transaction = {
      type: 'VALUE_TRANSFER',
      from: 'toshi',
      to: 'colin',
      gasPrice: '0x0',
      gas: '300000',
      value: caver.utils.toPeb(1, 'KLAY'),
      chainId: '2018',
    }

    caver.klay.sendTransaction(transaction)
      .on('transactionHash', console.log)
      .on('receipt', async (receipt) => {
        console.log(receipt)
        const toshiAccountBalance = await caver.klay.getBalance('toshi')
        console.log(
          'caver.klay.getBalance("toshi"): ' +
          caver.utils.fromPeb(toshiAccountBalance, 'KLAY') +
          ' KLAY'
        )
        done()
      })
      .on('error', (error) => {
        console.log(error)
        done()
      })
  }).timeout(200000)
})
