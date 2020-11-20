
'use strict';

const { Transaction } = require('./src/transaction');
const { Psbt } = require('./src/psbt');
const p2cryptoconditions = require('./src/payments/p2cryptoconditions');
const bufferutils = require("./src/bufferutils");
const script = require("./src/script");
const OPS = script.OPS;

//const wrtc=require('wrtc')

const kmdmessages = require('./net/kmdmessages');
const ccutils = require('./cc/ccutils');

var ccimp;
if (process.browser)
  ccimp = import('cryptoconditions-js/pkg/cryptoconditions.js');   // in browser, use 'wasm-pack build' (no any --target). Don't forget run browerify!
else
  ccimp = require('cryptoconditions-js/pkg/cryptoconditions.js');  // in nodejs, use 'wasm-pack build -t nodejs'

const networks = require('./src/networks');
//const mynetwork = networks.rick; 
//const mynetwork = networks.dimxy15;
const mynetwork = networks.marmaraxy31;

//const fs = require('fs');
const classify = require('./src/classify');
const ecpair = require('./src/ecpair');
const { SSL_OP_EPHEMERAL_RSA } = require('constants');
//const { dimxy14 } = require('./src/networks');

const EVAL_MARMARA = 0xef;
const MARMARA_OPRET_VERSION2 = 2;

const marmaraGlobalPkHex = "03afc5be570d0ff419425cfcc580cc762ab82baad88c148f5b028d7db7bfeee61d";
const marmaraGlobalPrivkey = Buffer.from([ 0x7c, 0x0b, 0x54, 0x9b, 0x65, 0xd4, 0x89, 0x57, 0xdf, 0x05, 0xfe, 0xa2, 0x62, 0x41, 0xa9, 0x09, 0x0f, 0x2a, 0x6b, 0x11, 0x2c, 0xbe, 0xbd, 0x06, 0x31, 0x8d, 0xc0, 0xb9, 0x96, 0x76, 0x3f, 0x24 ]);
const marmaraGlobalAddress = "RGLSRDnUqTB43bYtRtNVgmwSSd1sun2te8";

const issuerwif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';  // 035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db
// const issuerCCaddress = 'RJXkCF7mn2DRpUZ77XBNTKCe55M2rJbTcu';
const endorserwif = 'UuKUSQHnRGk4CDbRnbLRrJHq5Dwx58qR9Q9K2VpJjn3APXLurNcu'; // 034777b18effce6f7a849b72de8e6810bf7a7e050274b3782e1b5a13d0263a44dc
// 'UwoxbMPYh4nnWbzT4d4Q1xNjx3n9rzd6BLuato7v3G2FfvpKNKEq';
// const endorserCCaddress = 'RR2nTYFBPTJafxQ6en2dhUgaJcMDk4RWef'; 
//'RCrTxfdaGL4sc3mpECfamD3wh4YH5K8HAP';
const holderwif = "UuiZgPmUeo3Qe6BPH8GiSxqzFLN7MgJmw8SRijF9AFJoEsDFpMys"; // 0306ecb5e98f517cb2e58922404049ec3d2ca1b72c66a784a7a8dfdd03eb33312b


var defaultPort = 14722

var dnsSeeds = [
//  'seed.bitcoin.sipa.be', 'dnsseed.bluematt.me', 'dnsseed.bitcoin.dashjr.org', 'seed.bitcoinstats.com', 'seed.bitnodes.io', 'bitseed.xf2.org', 'seed.bitcoin.jonasschnelli.ch'
//  "localhost"
]
var webSeeds = [
  //'ws://3.136.47.223:8192'
  'ws://localhost:8192'

  // TODO: add more
]

var staticPeers = [
  //'3.136.47.223:14722'
  'localhost:14722'
  //'rick.kmd.dev:25434'
]

var params = {
  magic: mynetwork.bip32.public,
  defaultPort: defaultPort,
  dnsSeeds: dnsSeeds,
  webSeeds: webSeeds,
  staticPeers: staticPeers,  // dnsSeed works also
  protocolVersion: 170009,
  messages: kmdmessages.kmdMessages
}

var opts = {
  //connectWeb: true,
  //wrtc: wrtc,
  numPeers: 1
  //hardLimit: 2
}

// create peer group
var NspvPeerGroup = require('./net/nspvPeerGroup')
require('./net/nspvPeer')

var peers;

//let mypair = ecpair.fromWIF('UwZJc6ffWPc7XzxjvYEaqWsXoCcGiwyqNdnGZSbcCwRNEdzcAzNH', mynetwork);
//      console.log('mypair.priv', mypair.privateKey.toString('hex'));

if (!process.browser) 
{
  peers = new NspvPeerGroup(params, opts);
  // start pinging
  peers.on('peer', (peer) => {
    console.log('connected to peer', peer.socket.remoteAddress)
  
    // send/receive messages
    peer.once('pong', () => console.log('received ping response'))
    peer.send('ping', {
      nonce: require('crypto').pseudoRandomBytes(8)
    })
    console.log('sent ping')
  })
}
 

function marmaraAddActivatedInputs(peers, _mypk, _pk, _amount)
{
  return new Promise((resolve, reject) => {

    let mypk = Buffer.isBuffer(_mypk) ? _mypk.toString('hex') : _mypk;
    let pk = Buffer.isBuffer(_pk) ? _mypk.toString('hex') : _pk;
    let amount = typeof _amount === 'number' ? _amount.toString() : _amount;

    peers.nspvRemoteRpc("marmaraaddactivatedinputs", mypk, [pk, amount], {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}

function marmaraAddLockedInLoopInputs(peers, mypk, batontxid)
{
  return new Promise((resolve, reject) => {

    //let mypk = Buffer.isBuffer(_mypk) ? _mypk.toString('hex') : _mypk;
    if (!ccutils.IsValidPubKey(mypk))  {
      reject(new Error('invalid mypk'));
      return;
    }
      
    //let batontxid = Buffer.isBuffer(_batontxid) ? ccutils.txidToHex(_batontxid) : _batontxid;
    if (!ccutils.IsValidTxid(batontxid)) {
      reject(new Error('invalid baton txid'));
      return;
    }

    peers.nspvRemoteRpc("marmaraaddlockedinloopinputs", mypk.toString('hex'), ccutils.txidToHex(batontxid), {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}

function marmaraGetCreditLoop(peers, mypk, batontxid)
{
  return new Promise((resolve, reject) => {

    //let mypk = Buffer.isBuffer(_mypk) ? _mypk.toString('hex') : _mypk;
    if (!ccutils.IsValidPubKey(mypk))  {
      reject(new Error('invalid mypk'));
      return;
    }
      
    //let batontxid = Buffer.isBuffer(_batontxid) ? ccutils.txidToHex(_batontxid) : _batontxid;
    if (!ccutils.IsValidTxid(batontxid)) {
      reject(new Error('invalid baton txid'));
      return;
    }

    peers.nspvRemoteRpc("marmaracreditloop", mypk, ccutils.txidToHex(batontxid), {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}

function marmaraReceiveList(peers, _mypk)
{
  return new Promise((resolve, reject) => {

    //let mypk = Buffer.isBuffer(_mypk) ? _mypk.toString('hex') : _mypk;
    if (!ccutils.IsValidPubKey(_mypk))  {
      reject(new Error('invalid mypk'));
      return;
    }

    let mypkhex = _mypk.toString('hex');
    peers.nspvRemoteRpc("marmarareceivelist", mypkhex, mypkhex, {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}

function marmaraInfo(peers, _mypk)
{
  return new Promise((resolve, reject) => {

    if (!ccutils.IsValidPubKey(_mypk))  {
      reject(new Error('invalid mypk'));
      return;
    }
    let mypkhex = _mypk.toString('hex');

    peers.nspvRemoteRpc("marmarainfo", mypkhex, ['0', '0', '0', '0', mypkhex], {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}


function broadcast(peers, txidhex, txhex)
{
  return new Promise((resolve, reject) => {

    peers.nspvBroadcast(txidhex, txhex, {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}


async function broadcastTxhex(txhex)
{
  let ret = await broadcast(peers, "0000000000000000000000000000000000000000000000000000000000000000", txhex);
  return ret;
}

exports.broadcastTxhex = broadcastTxhex;

function Connect()
{
  peers = new NspvPeerGroup(params, opts);
  return new Promise((resolve, reject) => {

    peers.on('connectError', (err, peer)=>reject(err, peer));
    peers.on('peerError', (err)=>reject(err));
    peers.on('error', (err)=>reject(err));

    peers.connect(() => {
      console.log('in promise: connected to peer!!!');
      resolve();
    });
  });
}

exports.Connect = Connect;

// Example calls running under nodejs
if (!process.browser) 
{
  // create connections to peers
  peers.connect(async () => {
  
    try {
       
      //let lockret = await marmaraLock(issuerwif, 11100000);
      //console.log('lockret.txhex=', lockret.txhex, 'lockret.txid=', lockret.txid);
    
      //let receiveret = await marmaraReceive(endorserwif, '035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db', 0.1, 100);
      //console.log('receiveret.txhex=', receiveret.txhex, 'receiveret.txid=', receiveret.txid);

      //let issueret = await marmaraIssue(issuerwif, '550d06bd9ab19e28d0bfc38415b38a994fc46fea2da2426bf7b9d798def14521', ecpair.fromWIF(endorserwif, mynetwork).publicKey.toString('hex'));
      //let issueret = await marmaraIssue(issuerwif, '316f7331d23e30d88a983d5a5b6b090c946a91a820203d663876e5ce3e13c78f', '035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db');
      //console.log('issueret.txhex=', issueret.txhex, 'issueret.txid=', issueret.txid);

      //let broadcastret = await broadcast(peers, "0000000000000000000000000000000000000000000000000000000000000000", "0400008085202f8901b9d272e8ff0fed25735c1a7023acfbe7d788dec168b03de95bdb8155406c644a00ca9a3b0201e2ffffffff0280c3c901000000001976a914acc878cb6f4f9f57d1741c8258589ffbb5765c5488ac0000000000000000f16a4ceee21195f2ae1bcdeb74c36a31b7f07943c1731cc25504032a8f79d6b1eca0e5f84d20ce8ce618000400008085202f890105dd0b7151e02a21213ab30c1cdffc4fee57cb6074b1dadfeb3520ae1914da990100000048473044022036ff535d9420f01d56cd9276a718932509e0f9948bd231ac717cc55899d495770220521af8d7f8e96e3a286ae0ac7fb213fe995d509b26c5b87e0c6f5e1e3ade03c901ffffffff0180c3c90100000000306a2ee28efefefe7f065055424b4559cadcea46b009b3522a043cc64e1e0fb7583926f8f773a81143af5513d272dfc100000000003f010000000000000000000000000000000000000000000000000000000000000000");
      //console.log("broadcastret=", broadcastret)

      //let marmarainfores = await marmaraInfo0000('035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db')
      //console.log('marmarainfores=', JSON.stringify(marmarainfores,null,'\t'));

      //let marmaracreditloopres = await marmaraGetCreditLoop(peers, ecpair.fromWIF(endorserwif, mynetwork).publicKey, ccutils.txidFromHex('ybef0a01cb7e5b876863b8943df7958bca9450e1a09fde8bbf803c4923004da4e'))
      //console.log('marmaracreditloopres=', JSON.stringify(marmaracreditloopres, null, '\t'));

      //let receive2ret = await marmaraReceiveNext(holderwif, '034777b18effce6f7a849b72de8e6810bf7a7e050274b3782e1b5a13d0263a44dc', 'bef0a01cb7e5b876863b8943df7958bca9450e1a09fde8bbf803c4923004da4e');
      //console.log('receive2ret.txhex=', receive2ret.txhex, 'receive2ret.txid=', receive2ret.txid);

      let transferret = await marmaraTransfer(endorserwif, 'a277500951163ed1fe50da8e32d994535e61934a95405ff60646915b46660ce6', '0306ecb5e98f517cb2e58922404049ec3d2ca1b72c66a784a7a8dfdd03eb33312b');
      console.log('transferret.txhex=', transferret.txhex, 'transferret.txid=', transferret.txid);

    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }
  });
}

exports.marmaraLock = marmaraLock;
async function marmaraLock(_wif, _amount) {
  let wif = _wif;
  if (typeof _amount !== 'number')
    throw new Error('invalid amount');
  let amount = ccutils.toSatoshi(_amount);
  return await makeMarmaraLockTx(wif, amount);
}

exports.marmaraReceive = marmaraReceive;
async function marmaraReceive(_wif, _senderpk, _amount, _matures) {
  let wif = _wif || issuerwif;

  if (typeof _senderpk !== 'string' || _senderpk.length != 66)
    throw new Error('invalid public key');
  let senderpk = Buffer.from(_senderpk, 'hex');//  ecpair.fromWIF(endorserwif, mynetwork).publicKey;

  if (typeof _amount !== 'number')
    throw new Error('invalid amount');
  let amount = ccutils.toSatoshi(_amount);

  let currency = 'MARMARA';

  if (typeof _matures !== 'number' || _matures <= 0)
    throw new Error('invalid matures');
  let matures = _matures;

  return await makeMarmaraReceiveTx(wif, senderpk, amount, currency, matures, undefined);
}

exports.marmaraReceiveNext = marmaraReceiveNext;
async function marmaraReceiveNext(_wif, _senderpk, _batontxid) {
  let wif = _wif;

  if (typeof _senderpk !== 'string' || _senderpk.length != 66)
    throw new Error('invalid public key');
  let senderpk = Buffer.from(_senderpk, 'hex');//  ecpair.fromWIF(endorserwif, mynetwork).publicKey;

  let batontxid;
  if (_batontxid !== undefined)   
    batontxid = ccutils.txidFromHex(_batontxid);
  if (!batontxid)
    throw new Error('invalid baton txid');

  return await makeMarmaraReceiveTx(wif, senderpk, undefined, undefined, undefined, batontxid);
}

exports.marmaraIssue = marmaraIssue;
async function marmaraIssue(_wif, _receivetxid, _destpk) {
  let wif = _wif || issuerwif;
  let receivetxid = ccutils.txidFromHex(_receivetxid);
  if (!ccutils.IsValidTxid(receivetxid))
    throw new Error('invalid receive txid');

  let destpk;
  if (typeof _destpk === 'string')
    destpk = Buffer.from(_destpk, 'hex'); // ecpair.fromWIF(endorserwif, mynetwork).publicKey;
  if (!Buffer.isBuffer(destpk) || destpk.length != 33)
    throw new Error('invalid public key');
  return await makeMarmaraIssueTx(wif, receivetxid, destpk);
}

exports.marmaraTransfer = marmaraTransfer;
async function marmaraTransfer(_wif, _receivetxid, _destpk) {
  let wif = _wif; // || endorserwif;

  let receivetxid = ccutils.txidFromHex(_receivetxid);
  if (!ccutils.IsValidTxid(receivetxid))
    throw new Error('invalid receive txid');

  let destpk = Buffer.from(_destpk, 'hex') // || ecpair.fromWIF(eholderwif, mynetwork).publicKey;
  if (!ccutils.IsValidPubKey(destpk))
    throw new Error('invalid public key');
  return await makeMarmaraTransferTx(wif, receivetxid, destpk);
}

exports.marmaraReceiveListWrapper = marmaraReceiveListWrapper;
async function marmaraReceiveListWrapper(pk) {
  //if (typeof pk !== 'string' || pk.length != 66)
  //  throw new Error('invalid public key');
  return await marmaraReceiveList(peers, Buffer.from(pk, 'hex'));
}

exports.marmaraInfoWrapper = marmaraInfoWrapper;
async function marmaraInfoWrapper(pk) {
  //if (typeof pk !== 'string' || pk.length != 66)
  //  throw new Error('invalid public key');
  return await marmaraInfo(peers, Buffer.from(pk, 'hex'));
}

exports.marmaraGetCreditLoopWrapper = marmaraGetCreditLoopWrapper;
async function marmaraGetCreditLoopWrapper(mypk, txid) {
  //if (typeof pk !== 'string' || pk.length != 66)
  //  throw new Error('invalid public key');
  return await marmaraGetCreditLoop(peers, Buffer.from(mypk, 'hex'), ccutils.txidFromHex(txid));
}

async function marmaraGetAndDecodeLoopTx(peers, mypk, txid)
{
  let result = await ccutils.getRawTransaction(peers, mypk, txid);
  //console.log('getRawTransaction result:', result);
  if (result === undefined)
    throw new Error('could not get create or request tx');
  let tx = Transaction.fromBuffer(Buffer.from(result.hex, 'hex'));
  if (tx === undefined || tx.outs.length < 1)
    throw new Error('could not decode tx or no opreturn');

  let loopData = marmaraDecodeLoopOpret(tx.outs[tx.outs.length-1].script);
  
  if (ccutils.isEmptyObject(loopData))
    throw new Error('could not decode opreturn');
  if (!loopData.evalCode || loopData.evalCode != EVAL_MARMARA)
    throw new Error('not a marmara tx');
  if (!loopData.funcId)
    throw new Error('not a marmara loop tx');

  return { loopData: loopData, tx: tx };
}


function marmaraEncodeCoinbaseVData(funcId, destpk, ht)
{
  let buffer = Buffer.allocUnsafe(1+1+1 + 1+destpk.length + 4 + 4);
  let bufferWriter = new bufferutils.BufferWriter(buffer);
  let version = 1;

  bufferWriter.writeUInt8(EVAL_MARMARA);
  bufferWriter.writeUInt8(funcId.charCodeAt(0));
  bufferWriter.writeUInt8(version);
  bufferWriter.writeVarSlice(destpk);
  bufferWriter.writeUInt32(ht);
  bufferWriter.writeUInt32(0xFFFFFFF-1);
  return buffer;
}

function marmaraEncodeLoopCreateOpret(version, senderpk, amount, matures, _currency)
{
  if (typeof _currency !== 'string' || _currency.length > 64)
    throw new Error('marmaraEncodeLoopRequestOpReturn: invalid currency name');
  let bufcurrency = Buffer.from(_currency);

  let buffer = Buffer.allocUnsafe(1+1+1 + 1+senderpk.length + 8 + 4 + 1+_currency.length);
  let bufferWriter = new bufferutils.BufferWriter(buffer);

  bufferWriter.writeUInt8(EVAL_MARMARA);
  console.log("'B'.charCodeAt(0)=", 'B'.charCodeAt(0));

  bufferWriter.writeUInt8('B'.charCodeAt(0));
  bufferWriter.writeUInt8(version);
  bufferWriter.writeVarSlice(senderpk);
  bufferWriter.writeUInt64(amount);
  bufferWriter.writeInt32(matures);
  bufferWriter.writeVarSlice(bufcurrency);

  return script.compile([OPS.OP_RETURN, buffer]);
}

function marmaraEncodeLoopVData(createtxid, pk)
{
  if (!Buffer.isBuffer(createtxid) || createtxid.length != 32) {
    console.log('marmaraEncodeLoopVData invalid createtxid');
    return Buffer.from([]);
  }
  if (!Buffer.isBuffer(pk) || pk.length != 33)  {
    console.log('marmaraEncodeLoopVData invalid pk');
    return Buffer.from([]);
  }

  let buffer = Buffer.allocUnsafe(1+1+1 + 32 + 1+pk.length);
  let bufferWriter = new bufferutils.BufferWriter(buffer);
  let version = 1;

  bufferWriter.writeUInt8(EVAL_MARMARA);
  bufferWriter.writeUInt8('K'.charCodeAt(0));
  bufferWriter.writeUInt8(version);
  bufferWriter.writeSlice(createtxid);
  bufferWriter.writeVarSlice(pk);
  return buffer;
}

/*function marmaraDecodeLoopCreateOpret(opret)
{
  let chunks = script.decompile(opret);
  if (chunks.length < 2)
    return {};

  if (typeof chunks[0] !== 'number' || chunks[0] != OPS.OP_RETURN) {
    console.log('marmaraDecodeLoopCreateOpret invalid opreturn opcode')
    return {};
  }

  if (!Buffer.isBuffer(chunks[1]))  {
    console.log('marmaraDecodeLoopCreateOpret invalid opreturn data')
    return {};
  }

  let bufferReader = new bufferutils.BufferReader(chunks[1]);

  let evalCode = bufferReader.readUInt8();
  let chFuncId = bufferReader.readUInt8();
  let version = bufferReader.readUInt8();
  let senderpk = bufferReader.readVarSlice();
  let amount = bufferReader.readUInt64();
  let matures = bufferReader.readInt32();
  let scurrency = bufferReader.readVarSlice().toString();

  return { 
    evalCode: evalCode, funcId: Buffer.from([chFuncId]).toString(), version: version, senderpk: senderpk, amount: amount, matures: matures, currency: scurrency 
  };
}*/

function marmaraDecodeLoopOpret(opret)
{
  let chunks = script.decompile(opret);
  if (chunks.length < 2)
    return {};

  if (typeof chunks[0] !== 'number' || chunks[0] != OPS.OP_RETURN) {
    console.log('marmaraDecodeLoopRequestOpret invalid opreturn opcode')
    return {};
  }

  if (!Buffer.isBuffer(chunks[1]))  {
    console.log('marmaraDecodeLoopRequestOpret invalid opreturn data')
    return {};
  }

  let bufferReader = new bufferutils.BufferReader(chunks[1]);

  let evalCode = bufferReader.readUInt8();
  let chFuncId = bufferReader.readUInt8();
  let sFuncId = Buffer.from([chFuncId]).toString();
  let version = bufferReader.readUInt8();

  let createtxid;
  let senderpk;
  let amount;
  let matures;
  let scurrency;
  let autoSettlement;
  let autoInsurance;
  let avalCount;
  let disputeExpiresHeight;
  let escrowOn;
  let blockageAmount;

  switch(sFuncId) {
    case 'B':
      senderpk = bufferReader.readVarSlice();
      amount = bufferReader.readUInt64();
      matures = bufferReader.readInt32();
      scurrency = bufferReader.readVarSlice().toString();
      return { 
        evalCode: evalCode, funcId: sFuncId, version: version, senderpk: senderpk, amount: amount, matures: matures, currency: scurrency 
      };
    case 'R':
      createtxid = bufferReader.readSlice(32);
      senderpk = bufferReader.readVarSlice();
      return { 
        evalCode: evalCode, funcId: sFuncId, version: version, createtxid: createtxid, senderpk: senderpk
      };  
    case 'I':
      createtxid = bufferReader.readSlice(32);
      senderpk = bufferReader.readVarSlice();
      autoSettlement = bufferReader.readUInt8();
      autoInsurance = bufferReader.readUInt8();
      avalCount = bufferReader.readInt32();
      disputeExpiresHeight = bufferReader.readInt32()
      escrowOn = bufferReader.readUInt8();
      blockageAmount = bufferReader.readUInt64(blockageAmount)
      return { 
        evalCode: evalCode, funcId: sFuncId, version: version, createtxid: createtxid, senderpk: senderpk, autoSettlement: autoSettlement, autoInsurance: autoInsurance, avalCount: avalCount, disputeExpiresHeight: disputeExpiresHeight, escrowOn: escrowOn, blockageAmount: blockageAmount
      };  
    case 'T':
      createtxid = bufferReader.readSlice(32);
      senderpk = bufferReader.readVarSlice();
      avalCount = bufferReader.readInt32();
      return { 
        evalCode: evalCode, funcId: sFuncId, version: version, createtxid: createtxid, senderpk: senderpk, avalCount: avalCount
      };  
    }

  return {};
}

function marmaraEncodeLoopRequestOpret(version, createtxid, senderpk)
{
  let buffer = Buffer.allocUnsafe(1+1+1 + 32 + 1+senderpk.length);
  let bufferWriter = new bufferutils.BufferWriter(buffer);

  if (!ccutils.IsValidTxid(createtxid)) {
    console.log('marmaraEncodeLoopRequestOpReturn: invalid createtxid');
    return Buffer.from([]);
  }

  bufferWriter.writeUInt8(EVAL_MARMARA);
  bufferWriter.writeUInt8('R'.charCodeAt(0));
  bufferWriter.writeUInt8(version);
  bufferWriter.writeSlice(createtxid);
  bufferWriter.writeVarSlice(senderpk);
  return script.compile([OPS.OP_RETURN, buffer]);
}

function marmaraEncodeLoopIssueOpret(version, createtxid, receiverpk)
{
  let buffer = Buffer.allocUnsafe(1+1+1 + 32 + 1+receiverpk.length + 1+1+4+4+1+8);
  let bufferWriter = new bufferutils.BufferWriter(buffer);

  if (!ccutils.IsValidTxid(createtxid)) {
    console.log('marmaraEncodeLoopIssueOpret: invalid createtxid');
    return Buffer.from([]);
  }
  let autoSettlement = 1;
  let autoInsurance = 0;
  let avalCount = 0;
  let disputeExpiresHeight = 0;
  let escrowOn = 0;
  let blockageAmount = 0;

  bufferWriter.writeUInt8(EVAL_MARMARA);
  bufferWriter.writeUInt8('I'.charCodeAt(0));
  bufferWriter.writeUInt8(version);
  bufferWriter.writeSlice(createtxid);
  bufferWriter.writeVarSlice(receiverpk);
  bufferWriter.writeUInt8(autoSettlement);
  bufferWriter.writeUInt8(autoInsurance);
  bufferWriter.writeInt32(avalCount);
  bufferWriter.writeInt32(disputeExpiresHeight);
  bufferWriter.writeUInt8(escrowOn);
  bufferWriter.writeUInt64(blockageAmount);
  return script.compile([OPS.OP_RETURN, buffer]);
}

function marmaraEncodeLoopTransferOpret(version, createtxid, receiverpk)
{
  let buffer = Buffer.allocUnsafe(1+1+1 + 32 + 1+receiverpk.length + 4);
  let bufferWriter = new bufferutils.BufferWriter(buffer);

  let avalCount = 0;

  if (!ccutils.IsValidTxid(createtxid)) {
    console.log('marmaraEncodeLoopTransferOpret: invalid createtxid');
    return Buffer.from([]);
  }
  if (!ccutils.IsValidPubKey(receiverpk)) {
    console.log('marmaraEncodeLoopTransferOpret: invalid pubkey');
    return Buffer.from([]);
  }

  bufferWriter.writeUInt8(EVAL_MARMARA);
  bufferWriter.writeUInt8('T'.charCodeAt(0));
  bufferWriter.writeUInt8(version);
  bufferWriter.writeSlice(createtxid);
  bufferWriter.writeVarSlice(receiverpk);
  bufferWriter.writeInt32(avalCount);
  return script.compile([OPS.OP_RETURN, buffer]);
}

// -------

async function makeMarmaraLockTx(wif, amount) 
{
  // init lib cryptoconditions
  //cryptoconditions = await ccimp;  // always ensure cc is loaded
  p2cryptoconditions.cryptoconditions = await ccimp;

  //const txbuilder = new TxBuilder.TransactionBuilder(mynetwork);
  const txfee = 10000;
  const markerAmount = 10000;

  let mypair = ecpair.fromWIF(wif, mynetwork);

  wait1sec(); // after prev nspv remoterpc, to get over nspv rate limiter
  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypair.publicKey, amount + markerAmount + txfee);

  let tx = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'));
  let psbt = new Psbt({network: mynetwork});

  //let tx = Transaction.fromHex(txwutxos.txhex);
  psbt.setVersion(tx.version);
  psbt.__CACHE.__TX.versionGroupId = tx.versionGroupId;
  psbt.__CACHE.__TX.expiryHeight = tx.expiryHeight;

  let added = ccutils.addInputsFromPreviousTxns(psbt, tx, txwutxos.previousTxns);
  if (added < (amount + markerAmount + txfee))
    throw new Error("insufficient normal inputs (" + added + ")")

  let cond1of2 = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.byte2Base64(EVAL_MARMARA)     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[{  
            type:	"secp256k1-sha-256",
            publicKey:	marmaraGlobalPkHex
          }, {  
            type:	"secp256k1-sha-256",
            publicKey:	mypair.publicKey.toString('hex')
          }]  
      }]   
    };    

  let condMarker = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.byte2Base64(EVAL_MARMARA)     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[{  
            type:	"secp256k1-sha-256",
            publicKey:	marmaraGlobalPkHex
          }]  
      }]   
    };

  let ccSpk1of2 = p2cryptoconditions.makeCCSpk(cond1of2, p2cryptoconditions.makeOpDropData(EVAL_MARMARA, 1,2, marmaraEncodeCoinbaseVData('A', mypair.publicKey, 0x7FFFFFFE)));  // height not used, must be even
  if (ccSpk1of2 == null)  {
    throw new Error('could not create marmara 1of2 spk');
  }
  let ccSpk1 = p2cryptoconditions.makeCCSpk(condMarker);
  if (ccSpk1 == null)  {
    throw new Error('could not create marmara marker spk');
  }
  psbt.addOutput({ script: ccSpk1of2, value: amount});
  psbt.addOutput({ script: ccSpk1, value: markerAmount});

  /*let a = address.toOutputScript(
    address.toBase58Check(crypto.hash160(mypair.publicKey), mynetwork.pubKeyHash),
    mynetwork
  )*/

  psbt.addOutput({ address: ccutils.pubkey2NormalAddressKmd(mypair.publicKey), value: added - amount - markerAmount - txfee});  // change

  ccutils.finalizeCCtx(mypair, psbt);
  let txOut = psbt.extractTransaction();
  return { txhex: txOut.toHex(), txid: txOut.getId() };
}


async function makeMarmaraReceiveTx(wif, senderpk, loopAmount, currency, matures, batontxid) 
{
  // init lib cryptoconditions
  //cryptoconditions = await ccimp;  // always ensure cc is loaded
  p2cryptoconditions.cryptoconditions = await ccimp;

  //const txbuilder = new TxBuilder.TransactionBuilder(mynetwork);
  const txfee = 10000;
  const requestfee = batontxid === undefined ? 20000 : 10000;
  const amount = requestfee;

  let mypair = ecpair.fromWIF(wif, mynetwork);
  wait1sec(); // after prev nspv remoterpc, to get over nspv rate limiter
  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypair.publicKey, amount + txfee);

  let tx = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'));
  let psbt = new Psbt({network: mynetwork});

  //let tx = Transaction.fromHex(txwutxos.txhex);
  psbt.setVersion(tx.version);
  psbt.__CACHE.__TX.versionGroupId = tx.versionGroupId;

  let added = ccutils.addInputsFromPreviousTxns(psbt, tx, txwutxos.previousTxns);
  if (added < (amount + txfee))
    throw new Error("insufficient normal inputs (" + added + ")")

  let cond = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.byte2Base64(EVAL_MARMARA)     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[{  
                  type:	"secp256k1-sha-256",
                  publicKey:	senderpk.toString('hex')
          }]  
      }]   
    };
  let ccSpk = p2cryptoconditions.makeCCSpk(cond);
  if (ccSpk == null)  {
    throw new Error('could not create marmara cc spk');
  }
  psbt.addOutput({ script: ccSpk, value: requestfee}); // request utxo

  psbt.addOutput({ address: ccutils.pubkey2NormalAddressKmd(mypair.publicKey), value: added - amount - txfee});  // normal change

  let opret;
  if (batontxid !== undefined)   {
    wait1sec(); // after prev nspv remoterpc to get over nspv rate limiter
    let loopinfo = await marmaraGetCreditLoop(peers, mypair.publicKey, batontxid);  // get loop to get createtxid
    if (loopinfo.createtxid === undefined)
      throw new Error('invalid credit loop returned');
    opret = marmaraEncodeLoopRequestOpret(MARMARA_OPRET_VERSION2, ccutils.txidFromHex(loopinfo.createtxid), senderpk);
  }
  else
    opret = marmaraEncodeLoopCreateOpret(MARMARA_OPRET_VERSION2, senderpk, loopAmount, matures, currency);
  psbt.addOutput({ script: opret, value: 0});


  //txbuilder.setVersion(4);
  //txbuilder.setExpiryHeight(currentHeight+200);

  //console.log('tx..:', txbuilder.buildIncomplete().toHex());

  ccutils.finalizeCCtx(mypair, psbt);
  let txOut = psbt.extractTransaction();
  return { txhex: txOut.toHex(), txid: txOut.getId() };
}

// marmaraissue tx creation
async function makeMarmaraIssueTx(wif, createtxid, receiverpk) 
{
  // init lib cryptoconditions
  //cryptoconditions = await ccimp;  // always ensure cc is loaded
  p2cryptoconditions.cryptoconditions = await ccimp;

  //const txbuilder = new TxBuilder.TransactionBuilder(mynetwork);
  const txfee = 10000;
  const batonAmount = 10000;
  const loopMarkerAmount = 10000;
  const openMarkerAmount = 10000;

  let mypair = ecpair.fromWIF(wif, mynetwork);

  /*let rawcreatetx = await ccutils.getRawTransaction(peers, mypair.publicKey, createtxid);
  if (rawcreatetx === undefined)
    throw new Error('could not get tx for createtxid')
  let createtx = Transaction.fromBuffer(Buffer.from(rawcreatetx.hex, 'hex'));
  if (createtx === undefined || createtx.outs.length < 1)
    throw new Error('could not decode createtx or no opreturn')

  let loopData = marmaraDecodeLoopCreateOpret(createtx.outs[createtx.outs.length-1].script);
  if (ccutils.isEmptyObject(loopData))
    throw new Error('could not decode createtx opreturn')

  if (loopData.evalCode != EVAL_MARMARA)
    throw new Error('not a marmara tx')
  if (loopData.funcId != 'B')
    throw new Error('not a marmara create tx')*/
  wait1sec(); // after prev nspv remoterpc, to get over nspv rate limiter
  let createTxData = await marmaraGetAndDecodeLoopTx(peers, mypair.publicKey, createtxid);
  if (createTxData.loopData.funcId != 'B')
    throw new Error('not a marmara create tx');

  wait1sec(); // after prev nspv remoterpc to get over nspv rate limiter
  let txwccutxos = await marmaraAddActivatedInputs(peers, mypair.publicKey, mypair.publicKey, createTxData.loopData.amount);
  let txccs = Transaction.fromBuffer(Buffer.from(txwccutxos.txhex, 'hex'));

  let psbt = new Psbt({network: mynetwork});
  psbt.setVersion(txccs.version);
  psbt.__CACHE.__TX.versionGroupId = txccs.versionGroupId;

  let ccAdded = ccutils.addInputsFromPreviousTxns(psbt, txccs, txwccutxos.previousTxns);
  if (ccAdded < createTxData.loopData.amount)
    throw new Error("insufficient marmara cc inputs (" + ccAdded + ")");

  // spend create tx:
  let inputData = { hash: createtxid, index: 0 };
  inputData.nonWitnessUtxo = createTxData.tx.toBuffer();
  psbt.addInput(inputData);

  // add normals
  let normalAmount = createTxData.tx.outs[0].value - (loopMarkerAmount + openMarkerAmount + txfee);
  if (normalAmount <= 0)
    normalAmount = txfee;
  wait1sec();
  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypair.publicKey, normalAmount); // openMarkerAmount is funded from requesttx
  let txnormals = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'));
  let normalAdded = 0;
  if (normalAmount > 0) {
    normalAdded = ccutils.addInputsFromPreviousTxns(psbt, txnormals, txwutxos.previousTxns);
    if (normalAdded < normalAmount)
      throw new Error("insufficient normal inputs (" + normalAdded + ")")
  }

  let condBaton = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.byte2Base64(EVAL_MARMARA)     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[{  
            type:	"secp256k1-sha-256",
            publicKey:	receiverpk.toString('hex')
          }]  
      }]   
    };

  let createtxidpk = ccutils.ccTxidPubkey_tweak(createtxid);
  console.log('createtxidpk=', createtxidpk.toString('hex'));
  let condLoop = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.byte2Base64(EVAL_MARMARA)     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[
          {  
            type:	"secp256k1-sha-256",
            publicKey:	marmaraGlobalPkHex
          },  
          {  
            type:	"secp256k1-sha-256",
            publicKey:	createtxidpk.toString('hex')
          }]  
      }]   
    };

  let condMarker = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.byte2Base64(EVAL_MARMARA)     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[{  
            type:	"secp256k1-sha-256",
            publicKey:	marmaraGlobalPkHex
          }]  
      }]   
    };

  let condActivated = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.byte2Base64(EVAL_MARMARA)     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[{  
            type:	"secp256k1-sha-256",
            publicKey:	marmaraGlobalPkHex
          }, {  
            type:	"secp256k1-sha-256",
            publicKey:	mypair.publicKey.toString('hex')
          }]  
      }]   
    };    
  let condPrevBaton = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.byte2Base64(EVAL_MARMARA)     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[{  
                  type:	"secp256k1-sha-256",
                  publicKey:	mypair.publicKey.toString('hex')
          }]  
      }]   
    };

  let ccSpkBaton = p2cryptoconditions.makeCCSpk(condBaton);
  if (ccSpkBaton == null)  
    throw new Error('could not create marmara baton cc spk');    

  let ccSpkMarker = p2cryptoconditions.makeCCSpk(condMarker);
  if (ccSpkMarker == null)  
    throw new Error('could not create marmara cc spk');    

  let ccSpkIssuer = p2cryptoconditions.makeCCSpk(condLoop, p2cryptoconditions.makeOpDropData(EVAL_MARMARA, 1,2, marmaraEncodeLoopVData(createtxid, mypair.publicKey)));
  if (ccSpkIssuer == null)  
    throw new Error('could not create marmara cc spk');
  
  let ccSpkHolder = p2cryptoconditions.makeCCSpk(condLoop, p2cryptoconditions.makeOpDropData(EVAL_MARMARA, 1,2, marmaraEncodeLoopVData(createtxid, receiverpk)));
  if (ccSpkHolder == null)  
    throw new Error('could not create marmara cc spk');

  let ccSpkActivated = p2cryptoconditions.makeCCSpk(condActivated, p2cryptoconditions.makeOpDropData(EVAL_MARMARA, 1,2, marmaraEncodeCoinbaseVData('A', mypair.publicKey, 0x7FFFFFFE)));
  if (ccSpkActivated == null)  
    throw new Error('could not create marmara cc activated spk'); 
  
  psbt.addOutput({ script: ccSpkBaton, value: batonAmount});  // baton to holder
  psbt.addOutput({ script: ccSpkMarker, value: loopMarkerAmount});  // loop search marker

  psbt.addOutput({ script: ccSpkIssuer, value: Math.round(createTxData.loopData.amount/2)});  // issuer's half
  psbt.addOutput({ script: ccSpkMarker, value: openMarkerAmount});   // open/closed loop marker
  psbt.addOutput({ script: ccSpkHolder, value: Math.round(createTxData.loopData.amount/2)});  // holder's half

  let ccChange = ccAdded - createTxData.loopData.amount;
  if (ccChange > 0)
    psbt.addOutput({ script: ccSpkActivated, value: ccChange});  // cc change

  let change = normalAdded + ccAdded + createTxData.tx.outs[0].value - (batonAmount + openMarkerAmount + createTxData.loopData.amount + loopMarkerAmount + ccChange + txfee);
  if (change > 0)
    psbt.addOutput({ address: ccutils.pubkey2NormalAddressKmd(mypair.publicKey), value: change });  // change

  let opret = marmaraEncodeLoopIssueOpret(MARMARA_OPRET_VERSION2, createtxid, receiverpk);
  psbt.addOutput({ script: opret, value: 0});

  ccutils.finalizeCCtx(mypair, psbt, [{cond: condActivated}, {cond: condPrevBaton}]); // to spend activated utxo and requesttx's baton
  let txOut = psbt.extractTransaction();
  return { txhex: txOut.toHex(), txid: txOut.getId() };
}

// marmaratransfer tx creation
async function makeMarmaraTransferTx(wif, receivetxid, receiverpk) 
{
  // init lib cryptoconditions
  //cryptoconditions = await ccimp;  // always ensure cc is loaded
  p2cryptoconditions.cryptoconditions = await ccimp;

  //const txbuilder = new TxBuilder.TransactionBuilder(mynetwork);
  const txfee = 10000;
  const batonAmount = 10000;

  let mypair = ecpair.fromWIF(wif, mynetwork);
  wait1sec(); // after prev nspv remoterpc, to get over nspv rate limiter
  let requestTxData = await marmaraGetAndDecodeLoopTx(peers, mypair.publicKey, receivetxid);
  if (!requestTxData || !requestTxData.loopData || !requestTxData.loopData.createtxid || !requestTxData.loopData.funcId || requestTxData.loopData.funcId != 'R')
    throw new Error('not a marmara request tx');

  //let loopData = requestTxData.loopData;
  let createtxid = requestTxData.loopData.createtxid;
  wait1sec(); // after prev nspv remoterpc, to get over nspv rate limiter
  let loopinfo = await marmaraGetCreditLoop(peers, mypair.publicKey, createtxid);
  if (!loopinfo.batontxid || !Array.isArray(loopinfo.creditloop) || loopinfo.creditloop.length < 1 || typeof loopinfo.creditloop[0].issuerpk !== 'string')
    throw new Error('invalid credit loop returned');
  let batontxid = ccutils.txidFromHex(loopinfo.batontxid);
  let issuerpk = Buffer.from(loopinfo.creditloop[0].issuerpk, 'hex');
  let loopAmount = ccutils.toSatoshi(loopinfo.amount);

  wait1sec(); // after prev nspv remoterpc, to get over nspv rate limiter
  let batonTxData = await marmaraGetAndDecodeLoopTx(peers, mypair.publicKey, batontxid);
 
  wait1sec(); // after prev nspv remoterpc, to get over nspv rate limiter
  let txwccutxos = await marmaraAddLockedInLoopInputs(peers, mypair.publicKey, batontxid);
  let txccs = Transaction.fromBuffer(Buffer.from(txwccutxos.txhex, 'hex'));

  let psbt = new Psbt({network: mynetwork});
  psbt.setVersion(txccs.version);
  psbt.__CACHE.__TX.versionGroupId = txccs.versionGroupId;

  // spend receive tx utxo:
  let recvInputData = { hash: receivetxid, index: 0 };
  console.log('receivetxid=', ccutils.txidToHex(receivetxid), requestTxData.tx.getId());
  recvInputData.nonWitnessUtxo = requestTxData.tx.toBuffer();
  psbt.addInput(recvInputData);

  // spend baton utxo:
  let batonInputData = { hash: batontxid, index: 0 };
  batonInputData.nonWitnessUtxo = batonTxData.tx.toBuffer();
  psbt.addInput(batonInputData);

  let ccadded = ccutils.addInputsFromPreviousTxns(psbt, txccs, txwccutxos.previousTxns);
  if (ccadded <= 0)
    throw new Error("could not add marmara locked in loop inputs");

  // add normals
  let normalAmount = (requestTxData.tx.outs[0].value + batonTxData.tx.outs[0].value) - (batonAmount + txfee);
  if (normalAmount <= 0)
    normalAmount = txfee;
  wait1sec();  // to pass rate limter
  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypair.publicKey, normalAmount); // openMarkerAmount is funded from requesttx
  let txnormals = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'));
  let normalAdded = 0;
  if (normalAmount > 0) {
    normalAdded = ccutils.addInputsFromPreviousTxns(psbt, txnormals, txwutxos.previousTxns);
    if (normalAdded < normalAmount)
      throw new Error("insufficient normal inputs (" + normalAdded + ")")
  }

  let condBaton = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.byte2Base64(EVAL_MARMARA)     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[{  
            type:	"secp256k1-sha-256",
            publicKey:	receiverpk.toString('hex')
          }]  
      }]   
    };

  let createtxidpk = ccutils.ccTxidPubkey_tweak(createtxid);
  console.log('createtxidpk=', createtxidpk.toString('hex'));
  let condLoop = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.byte2Base64(EVAL_MARMARA)     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[
          {  
            type:	"secp256k1-sha-256",
            publicKey:	marmaraGlobalPkHex
          },  
          {  
            type:	"secp256k1-sha-256",
            publicKey:	createtxidpk.toString('hex')
          }]  
      }]   
    };
   
  let condPrevBaton = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	ccutils.byte2Base64(EVAL_MARMARA)     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[{  
                  type:	"secp256k1-sha-256",
                  publicKey:	mypair.publicKey.toString('hex')
          }]  
      }]   
    };

  let ccSpkBaton = p2cryptoconditions.makeCCSpk(condBaton);
  if (ccSpkBaton == null)  
    throw new Error('could not create marmara baton cc spk');       

  let ccSpkIssuer = p2cryptoconditions.makeCCSpk(condLoop, p2cryptoconditions.makeOpDropData(EVAL_MARMARA, 1,2, marmaraEncodeLoopVData(createtxid, issuerpk)));
  if (ccSpkIssuer == null)  
    throw new Error('could not create marmara cc spk');
  
  let ccSpkHolder = p2cryptoconditions.makeCCSpk(condLoop, p2cryptoconditions.makeOpDropData(EVAL_MARMARA, 1,2, marmaraEncodeLoopVData(createtxid, receiverpk)));
  if (ccSpkHolder == null)  
    throw new Error('could not create marmara cc spk'); 
  
  psbt.addOutput({ script: ccSpkBaton, value: batonAmount});  // baton to holder

  psbt.addOutput({ script: ccSpkIssuer, value: Math.round(loopAmount/2)});  // issuer's half
  psbt.addOutput({ script: ccSpkHolder, value: Math.round(loopAmount/2)});  // holder's half

  let change = (normalAdded + requestTxData.tx.outs[0].value + batonTxData.tx.outs[0].value) - batonAmount - txfee;
  if (change > 0)
    psbt.addOutput({ address: ccutils.pubkey2NormalAddressKmd(mypair.publicKey), value: change });  // normal change

  let opret = marmaraEncodeLoopTransferOpret(MARMARA_OPRET_VERSION2, createtxid, receiverpk);
  psbt.addOutput({ script: opret, value: 0});  // loop opreturn

  ccutils.finalizeCCtx(mypair, psbt, [{cond: condLoop, privateKey: marmaraGlobalPrivkey }, {cond: condPrevBaton}]); // to spend prev loop utxos and requesttx's and batontx
  let txOut = psbt.extractTransaction();
  return { txhex: txOut.toHex(), txid: txOut.getId() };
}


// helpers:

function wait1sec() {
  var t0 = new Date().getSeconds();
  do {
    var t1 = new Date().getSeconds();
  } while(t1 == t0);
}






