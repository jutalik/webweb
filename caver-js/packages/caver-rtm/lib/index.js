/**
 * Copyright 2018 The caver-js Authors
 * This file is part of the caver-js library.
 *
 * The caver-js library is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * The caver-js library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with the go-klayton library. If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * @file caver-rtm.js
 * @author Hoonil Kim <satoshi.kim@groundx.xyz>
 * @date 2018
 * @description rpc to method.
 */
const _ = require('underscore');

const Method = rootRequire('caver-core-method');
const formatters = rootRequire('caver-core-helpers').formatters;
const payloadTransformer = rootRequire('caver-core-helpers').payloadTransformer; // For indexing

let rpcCallToMethodAsObject = {}; // Wrap rpc json through 'Method'

const rpcCallToMethod = require('../../../rpc.json').map(rpcCall => {
  rpcCall.inputFormatter = rpcCall.inputFormatter && _.map(rpcCall.inputFormatter, formatterStr => formatters[formatterStr]);
  rpcCall.outputFormatter = formatters[rpcCall.outputFormatter];
  rpcCall.transformPayload = payloadTransformer[rpcCall.transformPayload];
  const [callLabel, callName] = rpcCall.call.split('_');

  if (callName) {
    if (!rpcCallToMethodAsObject[callLabel]) {
      rpcCallToMethodAsObject[callLabel] = {};
    }

    rpcCallToMethodAsObject[callLabel][rpcCall.name] = new Method(rpcCall);
  }

  if (!rpcCallToMethodAsObject[rpcCall.name]) {
    return rpcCallToMethodAsObject[rpcCall.name] = new Method(rpcCall);
  }
}).filter(a => !!a);

module.exports = rpcCallToMethod;
module.exports.rpc = rpcCallToMethodAsObject;