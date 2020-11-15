'use strict'

//const crypto = require('crypto')
const Debug = require('debug')
const debug = Debug('bitcoin-net:peer')
debug.rx = Debug('bitcoin-net:messages:rx')
debug.tx = Debug('bitcoin-net:messages:tx')

const bufferutils = require("../src/bufferutils");
const Peer = require('bitcoin-net').Peer
const { NSPVREQ, NSPVRESP, nspvReq, nspvResp } = require('./kmdtypes');

Peer.prototype._registerListenersPrev = Peer.prototype._registerListeners;
Peer.prototype._registerListeners = function() {
  this._registerListenersPrev();
  this.on('nSPV', (buf) => {
    let resp = nspvResp.decode(buf);
    this.emit(`nSPV:${resp.respCode}`, resp);
  })
}

// nspv get utxos
Peer.prototype.nspvGetUtxos = function(address, isCC, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (opts.timeout == null) opts.timeout = this._getTimeout()

  var timeout
  var onNspvResp = (resp) => {
    if (timeout) clearTimeout(timeout)
    cb(null, resp)
    //this._nextHeadersRequest()  // TODO: do we also need call to next?
  }
  this.once(`nSPV:${NSPVRESP.NSPV_UTXOSRESP}`, onNspvResp)

  let nspvReqUtxos = {
    reqCode: NSPVREQ.NSPV_UTXOS,
    coinaddr: address,
    CCflag: isCC ? 1 : 0,
    skipcount: 0,
    filter: 0
  }
  let buf = nspvReq.encode(nspvReqUtxos)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    debug(`getnSPV NSPV_UTXOSRESP timed out: ${opts.timeout} ms`)
    var error = new Error('Request timed out')
    error.timeout = true
    cb(error)
  }, opts.timeout)
}

// call nspv remote rpc
Peer.prototype.nspvRemoteRpc = function(rpcMethod, _mypk, _params, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (opts.timeout == null) opts.timeout = this._getTimeout()

  let mypk;
  if (Buffer.isBuffer(_mypk))
    mypk = _mypk.toString('hex');
  else
    mypk = _mypk;

  let params;
  if (Array.isArray(_params))  
    params = JSON.stringify(_params);
  else
    params = '["' + _params.toString() + '"]';
  let jsonRequest = `{
    "method": "${rpcMethod}",
    "mypk": "${mypk}",
    "params": ${params}
  }`;

  var timeout
  var onNspvResp = (resp) => {
    if (timeout) clearTimeout(timeout)
    if (!resp || !resp.jsonSer) {
      cb(new Error("could not parse nspv remote rpc response"));
      return;
    }

    //let resStr = resp.jsonSer.toString();
    let result = JSON.parse(resp.jsonSer.toString());
    if (result.error) {
      cb(result.error);
      return;
    }
    if (!resp.method) {
      cb(new Error('null nspv response method'));
      return;
    }
    let respMethod = resp.method.toString('ascii', 0, resp.method.indexOf(0x00) >= 0 ? resp.method.indexOf(0x00) : resp.method.length); // cut off ending nulls
    if (rpcMethod !== respMethod)  {
      cb(new Error('invalid nspv response method'));
      return;
    }
    cb(null, result.result); //yes result inside result
    //this._nextHeadersRequest()  // TODO: do we also need call to next?
  }
  this.once(`nSPV:${NSPVRESP.NSPV_REMOTERPCRESP}`, onNspvResp)

  let jsonSer = Buffer.from(jsonRequest);
  let nspvRemoteRpcReq = {
    reqCode: NSPVREQ.NSPV_REMOTERPC,
    length: jsonSer.length,
    jsonSer: jsonSer
  }
  let buf = nspvReq.encode(nspvRemoteRpcReq)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    debug(`getnSPV NSPV_REMOTERPC timed out: ${opts.timeout} ms`)
    var error = new Error('Request timed out')
    error.timeout = true
    cb(error)
  }, opts.timeout)
}

// nspv broadcast
Peer.prototype.nspvBroadcast = function(txidhex, txhex, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (opts.timeout == null) opts.timeout = this._getTimeout()

  if (typeof txidhex !== 'string' || txidhex.length != 64) {
    cb(new Error('txid hex should be a string of 64'));
    return;
  }

  if (typeof txhex !== 'string') {
    cb(new Error('txhex not a string'));
    return;
  }

  var timeout
  var onNspvResp = (resp) => {
    if (timeout) clearTimeout(timeout)
    if (!resp || !resp.txid || !resp.retcode) {
      cb(new Error("could not parse nspv broadcast response"));
      return;
    }
    let reversed = Buffer.allocUnsafe(resp.txid.length);
    resp.txid.copy(reversed);
    bufferutils.reverseBuffer(reversed);
    cb(null, { retcode: resp.retcode, txid: reversed.toString('hex') }); 
  }
  this.once(`nSPV:${NSPVRESP.NSPV_BROADCASTRESP}`, onNspvResp)

  let nspvBroadcastReq = {
    reqCode: NSPVREQ.NSPV_BROADCAST,
    txid: Buffer.from(txidhex, 'hex'),
    txdata: Buffer.from(txhex, 'hex')  
  }
  let buf = nspvReq.encode(nspvBroadcastReq)
  this.send('getnSPV', buf)

  if (!opts.timeout) return
  timeout = setTimeout(() => {
    debug(`getnSPV NSPV_BROADCAST timed out: ${opts.timeout} ms`)
    var error = new Error('Request timed out')
    error.timeout = true
    cb(error)
  }, opts.timeout)
}


