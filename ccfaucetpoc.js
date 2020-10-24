
'use strict';

//const { getHashes } = require('crypto');
//var netutils = require('regtest-client');
//const TxBuilder=require('./src/transaction_builder');
const { Transaction } = require('./src/transaction');
//const { Psbt, PsbtTransaction } = require('./src/psbt');
const { Psbt } = require('./src/psbt');
const p2cryptoconditions = require('./src/payments/p2cryptoconditions');

//require('./src/cctransaction')

const kmdmessages = require('./net/kmdmessages');

//import * as cryptoconditions from "cryptoconditions/cryptoconditions.js"; // not used
var ccimp;
if (process.browser)
  ccimp = import('cryptoconditions-js/pkg/cryptoconditions.js');   // in browser, use 'wasm-pack build' (no any --target). Don't forget run browerify!
else
  ccimp = require('cryptoconditions-js/pkg/cryptoconditions.js');  // in nodejs, use 'wasm-pack build -t nodejs'

const networks = require('./src/networks');
const mynetwork = networks.dimxy15;
const bufferutils = require("./src/bufferutils");
const script = require("./src/script");
const FAUCETSIZE = 10000000;


//const fs = require('fs');
const classify = require('./src/classify');
const ecpair = require('./src/ecpair');
const { SSL_OP_EPHEMERAL_RSA } = require('constants');
//const { dimxy14 } = require('./src/networks');

const faucetGlobalPk = "03682b255c40d0cde8faee381a1a50bbb89980ff24539cb8518e294d3a63cefe12";
const faucetGlobalPrivkey = Buffer.from([ 0xd4, 0x4f, 0xf2, 0x31, 0x71, 0x7d, 0x28, 0x02, 0x4b, 0xc7, 0xdd, 0x71, 0xa0, 0x39, 0xc4, 0xbe, 0x1a, 0xfe, 0xeb, 0xc2, 0x46, 0xda, 0x76, 0xf8, 0x07, 0x53, 0x3d, 0x96, 0xb4, 0xca, 0xa0, 0xe9 ]);
const faucetGlobalAddress = "R9zHrofhRbub7ER77B7NrVch3A63R39GuC";
const faucetcreatewif = 'UpUdyyTPFsXv8s8Wn83Wuc4iRsh5GDUcz8jVFiE3SxzFSfgNEyed';
const faucetcreateaddress = 'RJXkCF7mn2DRpUZ77XBNTKCe55M2rJbTcu';
const faucetgetwif = 'UwoxbMPYh4nnWbzT4d4Q1xNjx3n9rzd6BLuato7v3G2FfvpKNKEq';
const faucetgetaddress = 'RCrTxfdaGL4sc3mpECfamD3wh4YH5K8HAP';

//var cryptoconditions = require('./src/payments/p2cryptoconditions').cryptoconditions; // should be inited in top async func

//const APIURL = "http://localhost:8080/1";
//const APIPASS = "satoshi";
// const regtestUtils = new netutils.RegtestUtils({ APIPASS, APIURL });

// for dimxy14
//var magic = 0x4ea629ab
//var magic = 0xab29a64e
//var magic = 0xDC2E96D8 //0xD8962EDC  // DIMXY15 0xDC2E96D8

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
]

var params = {
  magic: mynetwork.bip32.public,
  defaultPort: defaultPort,
  dnsSeeds: dnsSeeds,
  webSeeds: webSeeds,
  staticPeers: staticPeers,  // dnsSeed works also
  //connectWeb: true,
  protocolVersion: 170009,
  messages: kmdmessages.kmdMessages
}

var opts = {
  numPeers: 1
  //hardLimit: 2
}

// create peer group
//var PeerGroup = require('bitcoin-net').PeerGroup
var NspvPeerGroup = require('./net/nspvPeerGroup')
require('./net/nspvPeer')

var peers;

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
 
/*
peers.on('getBlocks', (peer) => {
  console.log('got blocks', peer.socket.remoteAddress)
})*/

/*peers.on('nSPV', (peer) => {
  console.log('got nspv result', peer.socket.remoteAddress)
})*/

function getUtxos(address, isCC)
{
  return new Promise((resolve, reject) => {
    peers.nspvGetUtxos(address, isCC, {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err)
        resolve(res);
      else
        reject(err);
    });
  });
}

function createTxAndAddNormalInputs(mypk, amount)
{
  return new Promise((resolve, reject) => {
    /*let request = `{
      "method": "createtxwithnormalinputs",
      "mypk": "${mypk}",
      "params": [
        "${amount}" 
      ]
    }`;*/

    peers.nspvRemoteRpc("createtxwithnormalinputs", mypk, amount, {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}

function createTxAndAddFaucetInputs(mypk, amount)
{
  return new Promise((resolve, reject) => {

    peers.nspvRemoteRpc("faucetaddccinputs", mypk, amount, {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}

function getNormalUtxos(address)
{
  return getUtxos(address, false);
}
function getCCUtxos(address)
{
  return getUtxos(address, true);
}

// gets txns only from mempool
/*function getTransactions(txids)
{
  return new Promise((resolve, reject) => {
    peers.getTransactions(txids, {}, (err, res, peer) => {
      if (!err)
        resolve(res);
      else
        reject(err);
    });
  });
}*/


function Connect()
{
  peers = new NspvPeerGroup(params, opts);
  /*peers.on('peer', (peer) => {
    console.log('in event: connected to peer', peer.socket.remoteAddress)
  
    // send/receive messages
    peer.once('pong', () => console.log('received ping response'))
    peer.send('ping', {
      nonce: require('crypto').pseudoRandomBytes(8)
    })
    console.log('sent ping')
  });*/

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
      
      // test get blocks from peer (TODO: update for kmd block and transactions support) : 
      // var hashes = [  bufferutils.reverseBuffer(Buffer.from("099751509c426f89a47361fcd26a4ef14827353c40f42a1389a237faab6a4c5d", 'hex')) ];
      // let blocks = peers.getBlocks(hashes, {});
      // console.log('blocks:', blocks);

      // get normal utxos from an address:
      let utxos = await getNormalUtxos(faucetcreateaddress);
      console.log('utxos=', utxos);

      // it should be at least 1 sec between the same nspv requests (here NSPV_UTXOS)
      var t0 = new Date().getSeconds();
      do {
        var t1 = new Date().getSeconds();
      } while(t1 == t0);

      // get cc utxos:
      let ccutxos = await getCCUtxos(faucetGlobalAddress);
      console.log('cc utxos=', ccutxos); 

      // make cc faucet create tx
      // let txhex = await ccfaucet_create(faucetcreatewif, faucetcreateaddress, FAUCETSIZE*20);
      // console.log('txhex=', txhex);

      // make cc faucet get tx
      // let txhex = await ccfaucet_get(faucetgetwif, faucetgetaddress);
      // console.log('txhex=', txhex);

      // make tx with normal inputs for the specified amount
      // let txwnormals = await createTxAddNormalInputs('035d3b0f2e98cf0fba19f80880ec7c08d770c6cf04aa5639bc57130d5ac54874db', 10000);
      // console.log('txwnormals=', txwnormals);
    }
    catch(err) {
      console.log('caught err=', err, 'code=', err.code, 'message=', err.message);
    }
  });
}


/*var getHt = async function () {
    //regtestUtils.height().then( h => console.log('h='+h) );
    var h = await regtestUtils.height();
    console.log('h='+h);
};*/
//getHt();


// --------------- test calls, not used
/*regtestUtils.mine(1)
  .then(json => console.log('tx='+json))
  .catch(err => console.log('err='+err)); */

//regtestUtils.fetch('11a270d203ab0f77a86b9222b7e23eda893ce4b8285b0a31bc0dde1c3e4df9ff')
//  .then(json => console.log('tx='+json))
//  .catch(err => console.log('err='+err));

/*
regtestUtils.unspents('RCrTxfdaGL4sc3mpECfamD3wh4YH5K8HAP')
  .then(
    utxos => console.log('utxos=', utxos)
  )
  .catch(err =>
      console.log('err=', err)
  );*/

/*  
regtestUtils.ccunspents('R9zHrofhRbub7ER77B7NrVch3A63R39GuC')
  .then(
    utxos => console.log('utxos=', utxos)
  )
  .catch(err =>
      console.log('err=', err)
  );*/

/*
ccfaucet_create(faucetcreatewif, 'RJXkCF7mn2DRpUZ77XBNTKCe55M2rJbTcu', FAUCETSIZE*20)
  .then(
    txhex => { 
      console.log('txhex=', txhex);
      document.write('cc faucet create txhex='+txhex);
    }
  )
  .catch(
    err => console.log('ccfaucet_create err=', err, 'stack=', err.stack)
  );*/

/* 
ccfaucet_get(faucetgetwif, 'RCrTxfdaGL4sc3mpECfamD3wh4YH5K8HAP')
  .then(
    txhex => {
      console.log('txhex=', txhex);
      document.write('cc faucet get txhex='+txhex);
    }
  )
  .catch(
    err => console.log('ccfaucet_get err=', err, 'stack=', err.stack)
  );*/
// -----------------------

exports.ccfaucet_create = ccfaucet_create;
async function ccfaucet_create(_wif, _myaddress, _amount) {
  let wif = _wif || faucetcreatewif;
  let myaddress = _myaddress || faucetcreateaddress;
  let amount  = _amount || FAUCETSIZE*20;
  //amount = amount >>> 0; // to int
  let tx = await makeFaucetCreateTx(wif, myaddress, amount);
  //return this.broadcast(tx.toHex());
  return tx.toHex();
};

exports.ccfaucet_get = ccfaucet_get;
async function ccfaucet_get(_wif, _myaddress) {
  let wif = _wif || faucetgetwif;
  let myaddress = _myaddress || faucetgetaddress;
  let tx = await makeFaucetGetTx(wif, myaddress);
  //return this.broadcast(tx.toHex());
  return tx.toHex();
};


function addInputsFromPreviousTxns(psbt, tx, prevTxnsHex)
{
  let added = 0;
  for(let i = 0; i < tx.ins.length; i ++) {
    let prevTxHex = prevTxnsHex.find((txHex) => Transaction.fromHex(txHex).getHash().equals(tx.ins[i].hash));
    if (prevTxHex !== undefined) {
      let inputData = Object.assign({}, tx.ins[i]);
      inputData.nonWitnessUtxo = Buffer.from(prevTxHex, 'hex');

      let prevTx = Transaction.fromBuffer(inputData.nonWitnessUtxo);
      added += prevTx.outs[tx.ins[i].index].value;
      psbt.addInput(inputData);
    }
  }
  return added;
}

async function makeFaucetCreateTx(wif, myaddress, amount) 
{
  // init lib cryptoconditions
  //cryptoconditions = await ccimp;  // always ensure cc is loaded
  p2cryptoconditions.cryptoconditions = await ccimp;

  //const txbuilder = new TxBuilder.TransactionBuilder(mynetwork);
  let addedUnspents = [];
  const txfee = 10000;
  
  //let currentHeight = await regtestUtils.height();
  /*let added = await addNormalInputs(txbuilder, myaddress, amount+txfee, addedUnspents);
  if (added < amount)
    throw new Error('could not find normal inputs');*/
    
  let mypk = ecpair.fromWIF(faucetcreatewif, mynetwork).publicKey;
  let txwutxos = await createTxAndAddNormalInputs(mypk, amount + txfee);

  let tx = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'));
  let psbt = new Psbt({network: mynetwork});

  //let tx = Transaction.fromHex(txwutxos.txhex);
  psbt.setVersion(tx.version);
  psbt.__CACHE.__TX.versionGroupId = tx.versionGroupId;

  let added = addInputsFromPreviousTxns(psbt, tx, txwutxos.previousTxns);
  if (added < amount + txfee)
    throw new Error("insufficient normal inputs (" + added + ")")

  let cond = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
          type:	"eval-sha-256",   
          code:	 hex2Base64('e4')     
      }, {            
          type:	"threshold-sha-256",
          threshold:	1,
          subfulfillments:	[{  
                  type:	"secp256k1-sha-256",
                  publicKey:	faucetGlobalPk
          }]  
      }]   
    };
  let ccSpk = p2cryptoconditions.makeCCSpk(cond);
  if (ccSpk == null)  {
    throw new Error('could not create faucet cc spk');
  }

  psbt.addOutput({ script: ccSpk, value: amount});
  psbt.addOutput({ address: myaddress, value: added - amount - txfee});  // change

  //txbuilder.setVersion(4);
  //txbuilder.setExpiryHeight(currentHeight+200);

  //console.log('tx..:', txbuilder.buildIncomplete().toHex());

  finalizeCCtx(wif, psbt, addedUnspents);
  return psbt.extractTransaction();
}

async function makeFaucetGetTx(wif, myaddress) 
{
  // init lib cryptoconditions
  //cryptoconditions = await ccimp;  // always ensure cc is loaded
  p2cryptoconditions.cryptoconditions = await ccimp;

  //const txbuilder = new TxBuilder.TransactionBuilder(mynetwork);

  //let addedUnspents = [];
  const txfee = 10000;
  const amount = FAUCETSIZE;

  //let added = await addCCInputs(txbuilder, faucetGlobalAddress, amount+txfee, addedUnspents);
  let mypk = ecpair.fromWIF(faucetcreatewif, mynetwork).publicKey;
  let txwutxos = await createTxAndAddFaucetInputs(mypk, amount);

  let basetx = Transaction.fromBuffer(Buffer.from(txwutxos.txhex, 'hex'));

  //let tx = Transaction.fromHex(txwutxos.txhex);
 
  
  //let currentHeight = await regtestUtils.height();

  let cond = {
    type:	"threshold-sha-256",
    threshold:	2,
    subfulfillments:	[{
        type:	"eval-sha-256",   
        code:	 hex2Base64('e4')     
    }, {            
        type:	"threshold-sha-256",
        threshold:	1,
        subfulfillments:	[{  
                type:	"secp256k1-sha-256",
                publicKey:	faucetGlobalPk
        }]  
    }]   
  };

  //let ccScriptSig = makeCCScriptSig(cond);
  //if (ccScriptSig == null)  {
  //  throw new Error('could not create cc scriptSig');
  //}
  let ccSpk = p2cryptoconditions.makeCCSpk(cond);
  if (ccSpk == null)  {
    throw new Error('could not create cc spk');
  }
  
  /*
  let cctxid = '85224abc96abcb3772bf2883fca9d393348166bbcd816654f8726376c06b7f20';
  let txraw = await regtestUtils.fetch(cctxid);
  if (txraw === undefined) 
    throw new Error('could not load vin tx');
  let tx = Transaction.Transaction.fromHex(txraw.txHex);
  addedUnspents.push({ "txId": tx.getId(0), "vout": 0, "value": tx.outs[0].value, "script": tx.outs[0].script });
  txbuilder.addInput(tx, 0 /*, ccScriptSig**);*/

  //txbuilder.addOutput(spk, amount);
  

  //txbuilder.setVersion(4);
  //txbuilder.setExpiryHeight(currentHeight+200);

  // mine faucet get txpow
  let i = 0;
  let stop = false;
  let psbt;
  for(var adj1 = 0; adj1 <= 0xFFFFFFFF && !stop; adj1++)  {
    for(var adj2 = 0; adj2 <= 0xFFFFFFFF && !stop; adj2++)  {
      psbt = new Psbt({network: mynetwork});

      psbt.setVersion(basetx.version);
      psbt.__CACHE.__TX.versionGroupId = basetx.versionGroupId;
    
      let added = addInputsFromPreviousTxns(psbt, basetx, txwutxos.previousTxns);
      if (added < amount)
        throw new Error('could not find cc faucet inputs');

      psbt.addOutput({ script: ccSpk, value: added - amount - txfee });  // change to faucet cc
      psbt.addOutput({ address: myaddress, value: amount });  // get to normal

      const num2Uint32 = num => { /*[
        (num >> 24) & 255,
        (num >> 16) & 255,
        (num >> 8) & 255,
        num & 255,
      ]*/
        let buf = Buffer.alloc(4);
        let bufwr = new bufferutils.BufferWriter(buf);
        bufwr.writeUInt32(num >>> 0);
        return buf;
      };

      //if (i > 0)
      //  psbt.__TX.outs.pop(); // remove the last output to replace it
      //let adj1LE = Buffer.alloc(4);
      //let adj2LE = Buffer.alloc(4);

      // adjust nonces:
      let opreturn = script.compile([ script.OPS.OP_RETURN, Buffer.concat([ Buffer.from(num2Uint32(adj1 >>> 0)), Buffer.from(num2Uint32(adj2 >>> 0)) ]) ]);
      psbt.addOutput({ script: opreturn, value: 0 });
     
      finalizeCCtx(wif, psbt, [], cond);
      let tx = psbt.extractTransaction();
      //console.log('tx===', tx.toHex())
      let txid = tx.getId();
      console.log('slice=', txid.slice(0,2), txid.slice(62,64));
      if (txid.slice(0,2) == '00' && txid.slice(62,64) == '00') {  // check vald faucet txpow
        console.log("mined faucet txid");
        stop=true;
      }
      if (++i > 1000000)
        return;
    }
  }

  //console.log('tx..:', txbuilder.buildIncomplete().toHex());
  return psbt.extractTransaction();
}

/*async function addNormalInputs(txbuilder, address, amount, addedUnspents) 
{
  // const unspents = await regtestUtils.unspents(address);  // call via JSON RPC
  const unspents = await getNormalUtxos(address);     // call via NSPV
  if (!unspents)
    return 0;
  //const txns = await regtestUtils.getaddresstxns(address);
  let added = 0;
  for(let i = 0; i < unspents.utxos.length && added < amount; i ++)
  {
    if (unspents.utxos[i].satoshis <= 10000)
      continue;
    //let txid = bufferutils.reverseBuffer(Buffer.from(_unspents[i].txId, 'hex'));
    //let txraw = await regtestUtils.fetch(unspents[i].txId);
    /*let txarr = await getTransactions([unspents[i].txId]);
    if (!txarr || txarr.length == 0)
      throw new Error('could not load vin tx');
    let txraw = txarr[0];*/
  
    //console.log('vintx=', txraw.txHex);
    /*if (txraw === undefined) 
      throw new Error('could not load vin tx');
    let tx = Transaction.Transaction.fromHex(txraw.txHex);
    console.log('adding txId=', tx.getId(), ' vout=', unspents[i].vout);*//*
    // note: reverse txid string:
    txbuilder.addInput(unspents.utxos[i].txid, unspents.utxos[i].vout, null, unspents.utxos[i].script);
    added += unspents.utxos[i].satoshis;
    //addedUnspents.push(unspents.utxos[i]);
    addedUnspents.push({ address: address, txId: unspents.utxos[i].txid, vout: unspents.utxos[i].vout, value: unspents.utxos[i].satoshis, script: unspents.utxos[i].script });  // convert to normal inputs-like structure
  }
  return added;
}*/

/*async function addCCInputs(txbuilder, address, amount, addedUnspents) 
{
  //const unspents = await regtestUtils.ccunspents(address);
  const unspents = await getCCUtxos(address);
  if (!unspents)
    return 0;

  let added = 0;
  let i = 0;
  while(i < unspents.utxos.length && added < amount)
  {
    //let txid = bufferutils.reverseBuffer(Buffer.from(unspents.utxos[i].txid, 'hex'));
    //let txraw = await regtestUtils.fetch(unspents[i].txid);
    /*let txarr = await getTransactions([unspents.utxos[i].txid]);
    if (!txarr || txarr.length == 0)
      throw new Error('could not load vin tx');
    let txraw = txarr[0];

    //console.log('vintx=', txraw.txHex);
    if (txraw === undefined) 
      throw new Error('could not load vin tx');
    let tx = Transaction.Transaction.fromHex(txraw.txHex);
    console.log('adding cc txId=', tx.getId(), ' vout=', unspents[i].outputIndex);*//*
    // note: reverse txid string:
    txbuilder.addInput(unspents.utxos[i].txid, unspents.utxos[i].vout, null, unspents.utxos[i].script);
    //txbuilder.addInput(tx, unspents.utxos[i].outputIndex, null, Buffer.from(tx.outs[unspents.utxos[i].outputIndex].script, 'hex'));

    added += unspents.utxos[i].satoshis;
    addedUnspents.push({ address: address, txId: unspents.utxos[i].txid, vout: unspents.utxos[i].vout, value: unspents.utxos[i].satoshis, script: unspents.utxos[i].script });  // convert to normal inputs-like structure
    i ++;
  }
  return added;
}*/



function hex2Base64(hexString)
{
  return Buffer.from(hexString, 'hex').toString('base64');
}

function finalizeCCtx(wif, psbt, addedUnspents, cccond)
{
  //let tx = txb.buildIncomplete();
  //for (let index = 0; index < tx.ins.length; index ++)
  for (let index = 0; index < psbt.data.inputs.length; index ++)
  {
    /*let unspent = addedUnspents.find((u) => {
      //let txid = bufferutils.reverseBuffer(Buffer.from(u.txId, 'hex'));
      let txid = u.txId;
      //console.log('hash=', tx.ins[index].hash.toString('hex'), ' txId=', txid.toString('hex'));
      return txb.__TX.ins[index].hash.toString('hex') === txid.toString('hex');
    });
    if (unspent === undefined) 
      throw new Error('internal err: could not find tx unspent in addedUnspents');
    
    console.log('unspent.script=', Buffer.from(unspent.script).toString('hex'));*/
    let keyPairIn = ecpair.fromWIF(wif, mynetwork);
    let prevOut = getPsbtPrevOut(psbt, index);

    if (!p2cryptoconditions.isPayToCryptocondition(prevOut.script))  {
      psbt.signInput(
        index, keyPairIn
      /*{
        //prevOutScriptType: classify.output(Buffer.from(unspent.script)),
        prevOutScriptType: getOutScriptTypeFromOutType(txb.__INPUTS[index].prevOutType),  // TODO: replace accessing seemingly an internal var
        vin: index,
        keyPair: keyPairIn,
        value: unspent.value
      }*/);
      psbt.finalizeInput(index);
    }
    else {
      let signatureHash = psbt.__CACHE.__TX.hashForKomodo(
        index,
        prevOut.script,  // makeCCSpk(cccond),
        prevOut.value,   // unspent.value,
        Transaction.SIGHASH_ALL,
      );    

      let signedCond = p2cryptoconditions.cryptoconditions.js_sign_secp256k1(cccond, /*keyPairIn.privateKey*/faucetGlobalPrivkey, signatureHash);
      let ccScriptSig = p2cryptoconditions.makeCCScriptSig(signedCond);
      //txb.__INPUTS[index].ccScriptSig = ccScriptSig;
      
      psbt.finalizeInput(index, (index, psbtInput) => {
        //if (psbtInput.finalScriptSig)
        //  psbtInput.finalScriptSig = undefined;  // 'un-finalize' psbt output. No need of this as we now recreating all inputs/outputs for each faucet get txpow try
        return { finalScriptSig: ccScriptSig };  // looks like a hack but to avoid extra psbt after-signing checks 
      });
      //console.log('signed cccond=', signedCond);
    }
  }
}

/*
function getOutScriptTypeFromOutType(outType)
{
  switch(outType) {
    case classify.types.P2PK:
      return 'p2pk';
    case classify.types.P2PKH:
      return 'p2pkh';
    default:
      return undefined;
  }
}*/

/*function isPayToCryptocondition(spk)
{
  //let ccimp = await cryptoconditions;
  if (cryptoconditions === undefined)
    return false;

  console.log('IsPayToCryptocondition spk=', spk.toString('hex'));
  if (Buffer.isBuffer(spk) && spk.length >= 46 && spk[spk.length-1] == 0xcc)  {
    let condbin = spk.slice(1, spk.length-1);
    console.log('IsPayToCryptocondition checking buffer=', condbin.toString('hex'))
    let cond = cryptoconditions.js_read_ccondition_binary(condbin);
    if (cond !== undefined)
      return true;
  }
  return false;
}*/

function getPsbtPrevOut(psbt, index)
{
  let input = psbt.data.inputs[index];
  if (input.nonWitnessUtxo) { 
    const unsignedTx = psbt.__CACHE.__TX;
    const c = psbt.__CACHE.__NON_WITNESS_UTXO_TX_CACHE;
    const nonWitnessUtxoTx = c[index];

    const prevoutHash = unsignedTx.ins[index].hash;
    const utxoHash = nonWitnessUtxoTx.getHash();

    // If a non-witness UTXO is provided, its hash must match the hash specified in the prevout
    if (!prevoutHash.equals(utxoHash)) {
      throw new Error(
        `Non-witness UTXO hash for input #${index} doesn't match the hash specified in the prevout`,
      );
    }

    const prevoutIndex = unsignedTx.ins[index].index;
    const prevout = nonWitnessUtxoTx.outs[prevoutIndex];
    return prevout;
  }
  return { script: Buffer.from([]), value: 0 };
}

