'use strict'

//const debug = require('debug')('bitcoin-net:peergroup')

let net
try { net = require('net') } catch (err) {}
const old = require('old')
const PeerGroup = require('bitcoin-net').PeerGroup

const { nspvResp } = require('./kmdtypes');

class NspvPeerGroup extends PeerGroup {
  constructor (params, opts) {
    super(params, opts)

    this.on('nSPV', (buf) => {
      let resp = nspvResp.decode(buf);
      this.emit(`nSPV:${resp.respCode}`, resp)
    })
  }
}

PeerGroup.prototype.nspvGetUtxos = function(address, isCC, opts, cb) {
  this._request('nspvGetUtxos', address, isCC, opts, cb)
}

PeerGroup.prototype.nspvRemoteRpc = function(rpcMethod, mypk, params, opts, cb) {
  this._request('nspvRemoteRpc', rpcMethod, mypk, params, opts, cb)
}

module.exports = old(NspvPeerGroup)