var RLP = require("eth-lib/lib/rlp")
var utils = require('../../../caver-utils')

const { 
  rlpEncodeForLegacyTransaction,
  rlpEncodeForValueTransfer, 
  rlpEncodeForValueTransferMemo,
  rlpEncodeForFeeDelegatedValueTransferMemoWithRatio,
  rlpEncodeForFeeDelegatedValueTransfer,
  rlpEncodeForFeeDelegatedValueTransferWithRatio,
  rlpEncodeForFeeDelegatedValueTransferMemo,
  rlpEncodeForAccountCreation,
  rlpEncodeForAccountUpdate,
  rlpEncodeForContractDeploy,
  rlpEncodeForContractExecution,
  rlpEncodeForFeeDelegatedAccountUpdate,
  rlpEncodeForFeeDelegatedAccountUpdateWithRatio,
  rlpEncodeForFeeDelegatedSmartContractDeploy,
  rlpEncodeForFeeDelegatedSmartContractDeployWithRatio,
  rlpEncodeForFeeDelegatedSmartContractExecution,
  rlpEncodeForFeeDelegatedSmartContractExecutionWithRatio,
  
  rlpEncodeForCancel,
  rlpEncodeForFeeDelegatedCancel,
  rlpEncodeForFeeDelegatedCancelWithRatio,
  rlpEncodeForChainDataAnchoring,
} = require('./transactionType')

function encodeRLPByTxType(transaction) {
  switch (transaction.type) {
    case 'ACCOUNT_CREATION':
      return rlpEncodeForAccountCreation(transaction)
    case 'ACCOUNT_UPDATE':
      return rlpEncodeForAccountUpdate(transaction)
    case 'FEE_DELEGATED_ACCOUNT_UPDATE':
      return rlpEncodeForFeeDelegatedAccountUpdate(transaction)
    case 'FEE_DELEGATED_ACCOUNT_UPDATE_WITH_RATIO':
      return rlpEncodeForFeeDelegatedAccountUpdateWithRatio(transaction)
    case 'VALUE_TRANSFER':
      return rlpEncodeForValueTransfer(transaction)
    case 'VALUE_TRANSFER_MEMO':
      return rlpEncodeForValueTransferMemo(transaction)
    case 'FEE_DELEGATED_VALUE_TRANSFER':
      return rlpEncodeForFeeDelegatedValueTransfer(transaction)
    case 'FEE_DELEGATED_VALUE_TRANSFER_WITH_RATIO':
      return rlpEncodeForFeeDelegatedValueTransferWithRatio(transaction)
    case 'FEE_DELEGATED_VALUE_TRANSFER_MEMO':
      return rlpEncodeForFeeDelegatedValueTransferMemo(transaction)
    case 'FEE_DELEGATED_VALUE_TRANSFER_MEMO_WITH_RATIO':
      return rlpEncodeForFeeDelegatedValueTransferMemoWithRatio(transaction)
    case 'FEE_DELEGATED_SMART_CONTRACT_DEPLOY':
      return rlpEncodeForFeeDelegatedSmartContractDeploy(transaction)
    case 'SMART_CONTRACT_DEPLOY':
      return rlpEncodeForContractDeploy(transaction)
    case 'FEE_DELEGATED_SMART_CONTRACT_DEPLOY_WITH_RATIO':
      return rlpEncodeForFeeDelegatedSmartContractDeployWithRatio(transaction)
    case 'SMART_CONTRACT_EXECUTION':
      return rlpEncodeForContractExecution(transaction)
    case 'FEE_DELEGATED_SMART_CONTRACT_EXECUTION':
      return rlpEncodeForFeeDelegatedSmartContractExecution(transaction)
    case 'FEE_DELEGATED_SMART_CONTRACT_EXECUTION_WITH_RATIO':
      return rlpEncodeForFeeDelegatedSmartContractExecutionWithRatio(transaction)
    case 'CANCEL':
      return rlpEncodeForCancel(transaction)
    case 'FEE_DELEGATED_CANCEL':
      return rlpEncodeForFeeDelegatedCancel(transaction)
    case 'FEE_DELEGATED_CANCEL_WITH_RATIO':
      return rlpEncodeForFeeDelegatedCancelWithRatio(transaction)
    case 'CHAIN_DATA_ANCHROING':
      return rlpEncodeForChainDataAnchoring(transaction)
    case 'LEGACY':
    default:
      return rlpEncodeForLegacyTransaction(transaction)
  }
}

function makeRawTransaction(rlpEncoded, [v, r, s], transaction) {
  const decodedValues = RLP.decode(rlpEncoded)
  let rawTx
  switch (transaction.type) {
    case 'VALUE_TRANSFER': {
      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)
      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'VALUE_TRANSFER_MEMO': {
      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)
      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'FEE_DELEGATED_VALUE_TRANSFER': {
      if (transaction.senderRawTransaction) {
        const typeDetacehdRawTransaction = '0x' + transaction.senderRawTransaction.slice(4)
        const [ nonce, gasPrice, gas, to, value, from, [ [ senderV, senderR, senderS ] ] ] = utils.rlpDecode(typeDetacehdRawTransaction)

        let [data] = decodedValues
        //
        let [txType, ...rawTx] = RLP.decode(data)
        rawTx = [...rawTx, [[senderV, senderR, senderS]], transaction.feePayer.toLowerCase(), [[ v, r, s ]]]

        return txType + RLP.encode(rawTx).slice(2)
      }

      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'FEE_DELEGATED_VALUE_TRANSFER_WITH_RATIO': {
      if (transaction.senderRawTransaction) {
        const typeDetacehdRawTransaction = '0x' + transaction.senderRawTransaction.slice(4)
        const [ nonce, gasPrice, gas, to, value, from, feeRatio, [ [ senderV, senderR, senderS ] ] ] = utils.rlpDecode(typeDetacehdRawTransaction)

        let [data] = decodedValues
        //
        let [txType, ...rawTx] = RLP.decode(data)
        rawTx = [...rawTx, [[senderV, senderR, senderS]], transaction.feePayer.toLowerCase(), [[ v, r, s ]]]

        return txType + RLP.encode(rawTx).slice(2)
      }

      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'FEE_DELEGATED_VALUE_TRANSFER_MEMO': {
      if (transaction.senderRawTransaction) {
        const typeDetacehdRawTransaction = '0x' + transaction.senderRawTransaction.slice(4)
        const [ nonce, gasPrice, gas, to, value, from, data, [ [ senderV, senderR, senderS ] ] ] = utils.rlpDecode(typeDetacehdRawTransaction)

        let [_data] = decodedValues
        //
        let [txType, ...rawTx] = RLP.decode(_data)
        rawTx = [...rawTx, [[senderV, senderR, senderS]], transaction.feePayer.toLowerCase(), [[ v, r, s ]]]

        return txType + RLP.encode(rawTx).slice(2)
      }

      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'FEE_DELEGATED_VALUE_TRANSFER_MEMO_WITH_RATIO': {
      if (transaction.senderRawTransaction) {
        const typeDetacehdRawTransaction = '0x' + transaction.senderRawTransaction.slice(4)
        const [ nonce, gasPrice, gas, to, value, from, data, feeRatio, [ [ senderV, senderR, senderS ] ] ] = utils.rlpDecode(typeDetacehdRawTransaction)

        let [_data] = decodedValues
        //
        let [txType, ...rawTx] = RLP.decode(_data)
        rawTx = [...rawTx, [[senderV, senderR, senderS]], transaction.feePayer.toLowerCase(), [[ v, r, s ]]]

        return txType + RLP.encode(rawTx).slice(2)
      }

      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'FEE_DELEGATED_SMART_CONTRACT_DEPLOY': {
      if (transaction.senderRawTransaction) {
        const typeDetacehdRawTransaction = '0x' + transaction.senderRawTransaction.slice(4)
        
        const [ nonce, gasPrice, gas, to, value, from, data, humanReadable, [ [ senderV, senderR, senderS ] ] ] = utils.rlpDecode(typeDetacehdRawTransaction)

        let [_data] = decodedValues
        //
        let [txType, ...rawTx] = RLP.decode(_data)
        rawTx = [...rawTx, [[senderV, senderR, senderS]], transaction.feePayer.toLowerCase(), [[ v, r, s ]]]

        return txType + RLP.encode(rawTx).slice(2)
      }

      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'FEE_DELEGATED_SMART_CONTRACT_DEPLOY_WITH_RATIO': {
      if (transaction.senderRawTransaction) {
        const typeDetacehdRawTransaction = '0x' + transaction.senderRawTransaction.slice(4)
        
        const [ nonce, gasPrice, gas, to, value, from, data, humanReadable, feeRatio, [ [ senderV, senderR, senderS ] ] ] = utils.rlpDecode(typeDetacehdRawTransaction)

        let [_data] = decodedValues
        //
        let [txType, ...rawTx] = RLP.decode(_data)
        rawTx = [...rawTx, [[senderV, senderR, senderS]], transaction.feePayer.toLowerCase(), [[ v, r, s ]]]

        return txType + RLP.encode(rawTx).slice(2)
      }

      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'FEE_DELEGATED_CANCEL': {
      if (transaction.senderRawTransaction) {
        const typeDetacehdRawTransaction = '0x' + transaction.senderRawTransaction.slice(4)
        
        const [ nonce, gasPrice, gas, from, [ [ senderV, senderR, senderS ] ] ] = utils.rlpDecode(typeDetacehdRawTransaction)

        let [_data] = decodedValues
        //
        let [txType, ...rawTx] = RLP.decode(_data)
        rawTx = [...rawTx, [[senderV, senderR, senderS]], transaction.feePayer.toLowerCase(), [[ v, r, s ]]]

        return txType + RLP.encode(rawTx).slice(2)
      }

      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'FEE_DELEGATED_CANCEL_WITH_RATIO': {
      if (transaction.senderRawTransaction) {
        const typeDetacehdRawTransaction = '0x' + transaction.senderRawTransaction.slice(4)
        
        const [ nonce, gasPrice, gas, from, feeRatio, [ [ senderV, senderR, senderS ] ] ] = utils.rlpDecode(typeDetacehdRawTransaction)

        let [_data] = decodedValues
        //
        let [txType, ...rawTx] = RLP.decode(_data)
        rawTx = [...rawTx, [[senderV, senderR, senderS]], transaction.feePayer.toLowerCase(), [[ v, r, s ]]]

        return txType + RLP.encode(rawTx).slice(2)
      }

      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'FEE_DELEGATED_ACCOUNT_UPDATE': {
      if (transaction.senderRawTransaction) {
        const typeDetacehdRawTransaction = '0x' + transaction.senderRawTransaction.slice(4)
        
        const [ nonce, gasPrice, gas, from, accountKey, [ [ senderV, senderR, senderS ] ] ] = utils.rlpDecode(typeDetacehdRawTransaction)

        let [_data] = decodedValues
        //
        let [txType, ...rawTx] = RLP.decode(_data)
        rawTx = [...rawTx, [[senderV, senderR, senderS]], transaction.feePayer.toLowerCase(), [[ v, r, s ]]]

        return txType + RLP.encode(rawTx).slice(2)
      }

      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'FEE_DELEGATED_ACCOUNT_UPDATE_WITH_RATIO': {
      if (transaction.senderRawTransaction) {
        const typeDetacehdRawTransaction = '0x' + transaction.senderRawTransaction.slice(4)
        
        const [ nonce, gasPrice, gas, from, accountKey, feeRatio, [ [ senderV, senderR, senderS ] ] ] = utils.rlpDecode(typeDetacehdRawTransaction)

        let [data] = decodedValues
        //
        let [txType, ...rawTx] = RLP.decode(data)
        rawTx = [...rawTx, [[senderV, senderR, senderS]], transaction.feePayer.toLowerCase(), [[ v, r, s ]]]
        
        return txType + RLP.encode(rawTx).slice(2)
      }

      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'FEE_DELEGATED_SMART_CONTRACT_EXECUTION': {
      if (transaction.senderRawTransaction) {
        const typeDetacehdRawTransaction = '0x' + transaction.senderRawTransaction.slice(4)
        
        const [ nonce, gasPrice, gas, to, value, from, data, [ [ senderV, senderR, senderS ] ] ] = utils.rlpDecode(typeDetacehdRawTransaction)

        let [_data] = decodedValues
        //
        let [txType, ...rawTx] = RLP.decode(_data)
        rawTx = [...rawTx, [[senderV, senderR, senderS]], transaction.feePayer.toLowerCase(), [[ v, r, s ]]]

        return txType + RLP.encode(rawTx).slice(2)
      }

      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'FEE_DELEGATED_SMART_CONTRACT_EXECUTION_WITH_RATIO': {
      if (transaction.senderRawTransaction) {
        const typeDetacehdRawTransaction = '0x' + transaction.senderRawTransaction.slice(4)
        
        const [ nonce, gasPrice, gas, to, value, from, data, feeRatio, [ [ senderV, senderR, senderS ] ] ] = utils.rlpDecode(typeDetacehdRawTransaction)

        let [_data] = decodedValues
        //
        let [txType, ...rawTx] = RLP.decode(_data)
        rawTx = [...rawTx, [[senderV, senderR, senderS]], transaction.feePayer.toLowerCase(), [[ v, r, s ]]]

        return txType + RLP.encode(rawTx).slice(2)
      }

      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'FEE_DELEGATED_VALUE_TRANSFER_MEMO_WITH_RATIO': {
      if (transaction.senderRawTransaction) {
        const typeDetacehdRawTransaction = '0x' + transaction.senderRawTransaction.slice(4)
        
        const [ nonce, gasPrice, gas, to, value, from, data, feeRatio, [ [ senderV, senderR, senderS ] ] ] = utils.rlpDecode(typeDetacehdRawTransaction)

        let [_data] = decodedValues
        //
        let [txType, ...rawTx] = RLP.decode(_data)
        rawTx = [...rawTx, [[senderV, senderR, senderS]], transaction.feePayer.toLowerCase(), [[ v, r, s ]]]

        return txType + RLP.encode(rawTx).slice(2)
      }

      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'ACCOUNT_CREATION': {
      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'ACCOUNT_UPDATE': {
      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'SMART_CONTRACT_DEPLOY': {
      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'SMART_CONTRACT_EXECUTION': {
      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'CANCEL': {
      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'CHAIN_DATA_ANCHROING': {
      let [data] = decodedValues
      let [txType, ...rawTx] = RLP.decode(data)

      rawTx = [...rawTx, [[v, r, s]]]
      
      return txType + RLP.encode(rawTx).slice(2)
    }
    case 'LEGACY':
    default:
      rawTx = decodedValues.slice(0, 6).concat([v, r, s])
      return RLP.encode(rawTx)
  }
}

module.exports = {
  encodeRLPByTxType,
  makeRawTransaction,
}
