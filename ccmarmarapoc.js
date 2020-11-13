
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
const marmaraGlobalPkHex = "03afc5be570d0ff419425cfcc580cc762ab82baad88c148f5b028d7db7bfeee61d";
const marmaraGlobalPrivkey = Buffer.from([ 0x7c, 0x0b, 0x54, 0x9b, 0x65, 0xd4, 0x89, 0x57, 0xdf, 0x05, 0xfe, 0xa2, 0x62, 0x41, 0xa9, 0x09, 0x0f, 0x2a, 0x6b, 0x11, 0x2c, 0xbe, 0xbd, 0x06, 0x31, 0x8d, 0xc0, 0xb9, 0x96, 0x76, 0x3f, 0x24 ]);
const marmaraGlobalAddress = "RGLSRDnUqTB43bYtRtNVgmwSSd1sun2te8";

const issuerwif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';
const issuesCCaddress = 'RJXkCF7mn2DRpUZ77XBNTKCe55M2rJbTcu';
const endorserwif = 'UwoxbMPYh4nnWbzT4d4Q1xNjx3n9rzd6BLuato7v3G2FfvpKNKEq';
const endorserCCaddress = 'RCrTxfdaGL4sc3mpECfamD3wh4YH5K8HAP';
const holderwif = "";


var defaultPort = 14722

var dnsSeeds = [
//  'seed.bitcoin.sipa.be', 'dnsseed.bluematt.me', 'dnsseed.bitcoin.dashjr.org', 'seed.bitcoinstats.com', 'seed.bitnodes.io', 'bitseed.xf2.org', 'seed.bitcoin.jonasschnelli.ch'
//  "localhost"
]
var webSeeds = [
  'ws://localhost:8192'
  // TODO: add more
]

var staticPeers = [
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

let mypair = ecpair.fromWIF('UwZJc6ffWPc7XzxjvYEaqWsXoCcGiwyqNdnGZSbcCwRNEdzcAzNH', mynetwork);
      console.log('mypair.priv', mypair.privateKey.toString('hex'));

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
    
      //let receiveret = await marmaraReceive(endorserwif);
      //console.log('receiveret.txhex=', receiveret.txhex, 'receiveret.txid=', receiveret.txid);

      let issueret = await marmaraIssue(issuerwif, bufferutils.reverseBuffer(Buffer.from('8285a8b39fb3d86cd7d8190a6cd91abb310b84f3256c582b2fa487e6ef391bc8', 'hex')));
      console.log('issueret.txhex=', issueret.txhex, 'issueret.txid=', issueret.txid);

      //let { transfertxhex, transfertxid } = await marmaraTransfer(issuetxid, faucetgetaddress);
      //console.log('transfertxhex=', transfertxhex, 'transfertxid=', transfertxid);

    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }
  });
}

exports.marmaraLock = marmaraLock;
async function marmaraLock(_wif, _amount) {
  let wif = _wif || issuerwif;
  let amount  = _amount || 22200000;
  return await makeMarmaraLockTx(wif, amount);
}

exports.marmaraReceive = marmaraReceive;
async function marmaraReceive(_wif, _senderpk, _amount, _matures) {
  let wif = _wif || issuerwif;
  let senderpk = _senderpk || ecpair.fromWIF(issuerwif, mynetwork).publicKey;
  let amount  = _amount || 22200000;
  let currency = 'MARMARA';
  let matures = _matures || 50;
  return await makeMarmaraReceiveTx(wif, senderpk, amount, currency, matures, undefined);
}

exports.marmaraIssue = marmaraIssue;
async function marmaraIssue(_wif, receivetxid, _destpk) {
  let wif = _wif || issuerwif;
  let destpk = _destpk || ecpair.fromWIF(endorserwif, mynetwork).publicKey;
  return await makeMarmaraIssueTx(wif, receivetxid, destpk);
}

exports.marmaraTransfer = marmaraTransfer;
async function marmaraTransfer(_wif, _destpk, issuetxid) {
  let wif = _wif || endorserwif;
  let destpk = _destpk || ecpair.fromWIF(eholderwif, mynetwork).publicKey;
  return await makeMarmaraTransferTx(wif, issuetxid, destpk);
  //return this.broadcast(tx.toHex());
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

function marmaraDecodeLoopCreateOpret(opret)
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
}

function marmaraEncodeLoopRequestOpret(version, _createtxid, senderpk)
{
  let buffer = Buffer.allocUnsafe(1+1+1 + 32 + 1+senderpk.length);
  let bufferWriter = new bufferutils.BufferWriter(buffer);

  let createtxid;
  if (!Buffer.isBuffer(_createtxid) || _createtxid.length != 0 && _createtxid.length != 32) {
    console.log('marmaraEncodeLoopRequestOpReturn: invalid createtxid');
    return Buffer.from([]);
  }
  if (_createtxid.length == 0)
    createtxid = Buffer.alloc(32);
  else
    createtxid = _createtxid;

  bufferWriter.writeUInt8(EVAL_MARMARA);
  bufferWriter.writeUInt8('R'.charCodeAt(0));
  bufferWriter.writeUInt8(version);
  bufferWriter.writeSlice(createtxid);
  bufferWriter.writeVarSlice(senderpk);
  return script.compile([OPS.OP_RETURN, buffer]);
}

function marmaraEncodeLoopIssuerOpret(version, createtxid, receiverpk)
{
  let buffer = Buffer.allocUnsafe(1+1+1 + 32 + 1+receiverpk.length + 1+1+4+4+1+8);
  let bufferWriter = new bufferutils.BufferWriter(buffer);

  if (!Buffer.isBuffer(createtxid) || createtxid.length != 32) {
    console.log('marmaraEncodeLoopIssuerOpret: invalid createtxid');
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
  bufferWriter.writeUInt32(avalCount);
  bufferWriter.writeUInt32(disputeExpiresHeight);
  bufferWriter.writeUInt8(escrowOn);
  bufferWriter.writeUInt64(blockageAmount);
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
  psbt.addOutput({ script: ccSpk, value: requestfee});

  psbt.addOutput({ address: ccutils.pubkey2NormalAddressKmd(mypair.publicKey), value: added - amount - txfee});  // change

  let opret;
  if (batontxid !== undefined)
    opret = marmaraEncodeLoopRequestOpret(2, batontxid, senderpk);
  else
    opret = marmaraEncodeLoopCreateOpret(2, senderpk, loopAmount, matures, currency);
  psbt.addOutput({ script: opret, value: 0});


  //txbuilder.setVersion(4);
  //txbuilder.setExpiryHeight(currentHeight+200);

  //console.log('tx..:', txbuilder.buildIncomplete().toHex());

  ccutils.finalizeCCtx(mypair, psbt);
  let txOut = psbt.extractTransaction();
  return { txhex: txOut.toHex(), txid: txOut.getId() };
}

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

  let rawcreatetx = await ccutils.getRawTransaction(peers, mypair.publicKey, createtxid);
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
    throw new Error('not a marmara create tx')

  
  wait1sec(); // after prev nspv remoterpc 
  let txwccutxos = await marmaraAddActivatedInputs(peers, mypair.publicKey, mypair.publicKey, loopData.amount);
  let txccs = Transaction.fromBuffer(Buffer.from(txwccutxos.txhex, 'hex'));

  let psbt = new Psbt({network: mynetwork});
  psbt.setVersion(txccs.version);
  psbt.__CACHE.__TX.versionGroupId = txccs.versionGroupId;

  let ccadded = ccutils.addInputsFromPreviousTxns(psbt, txccs, txwccutxos.previousTxns);
  if (ccadded < loopData.amount)
    throw new Error("insufficient marmara cc inputs (" + ccadded + ")");

  // spend receive tx:
  let inputData = { hash: createtxid, index: 0 };
  inputData.nonWitnessUtxo = Buffer.from(rawcreatetx.hex, 'hex');
  psbt.addInput(inputData);

  // add normals
  wait1sec();
  let txwutxos = await ccutils.createTxAndAddNormalInputs(peers, mypair.publicKey, loopMarkerAmount /*+ openMarkerAmount*/ + txfee); // openMarkerAmount is funded from createtx
  let txnormals = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'));
  let added = ccutils.addInputsFromPreviousTxns(psbt, txnormals, txwutxos.previousTxns);
  if (added < loopData.amount)
    throw new Error("insufficient normal inputs (" + added + ")")


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

  psbt.addOutput({ script: ccSpkIssuer, value: loopData.amount/2});  // issuer's half
  psbt.addOutput({ script: ccSpkMarker, value: openMarkerAmount});   // open/closed loop marker
  psbt.addOutput({ script: ccSpkHolder, value: loopData.amount/2});  // holder's half

  let ccChange = ccadded - loopData.amount;
  if (ccChange > 0)
    psbt.addOutput({ script: ccSpkActivated, value: ccChange});  // cc change

  let change = added + createtx.outs[0].value - openMarkerAmount - loopMarkerAmount - txfee;
  if (change > 0)
    psbt.addOutput({ address: ccutils.pubkey2NormalAddressKmd(mypair.publicKey), value: change });  // change

  let opret = marmaraEncodeLoopIssuerOpret(2, createtxid, receiverpk);
  psbt.addOutput({ script: opret, value: 0});

  ccutils.finalizeCCtx(mypair, psbt, [{cond: condActivated}, {cond: condPrevBaton}]); // to spend activated utxo and createtx's baton
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






