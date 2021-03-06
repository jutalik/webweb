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
 * @file index.js
 * @author Hoonil Kim <satoshi.kim@groundx.xyz>
 * @date 2018
 */
require('@babel/polyfill')
global.rootRequire = (name) => require(`${__dirname}/packages/${name}/src/index.js`)

const { packageInit, providers } = require('./packages/caver-core')
const Klay = require('./packages/caver-klay')
const Net = require('./packages/caver-net')
const Method = require('./packages/caver-core-method')
const middleware = require('./packages/caver-middleware')
const utils = require('./packages/caver-utils')
const formatters = require('./packages/caver-core-helpers').formatters

const { version } = require('./package.json')

function Caver(provider, net) {
  this.use = middleware.registerMiddleware.bind(middleware)
  // sets _requestmanager etc
  packageInit(this, [provider, net])

  this.version = version
  this.utils = utils
  this.formatters = formatters
  this.Method = Method

  // ex) call `onit.klay.property` || `onit.klay.method(...)`
  this.klay = new Klay(this)
  this.middleware = middleware

  // overwrite package setProvider
  const setProvider = this.setProvider
  this.setProvider = (provider, net) => {
    setProvider.apply(this, [provider, net])
    this.klay.setProvider(provider, net)
    return true
  }
}

Caver.providers = providers

module.exports = Caver
module.exports.formatters = formatters
