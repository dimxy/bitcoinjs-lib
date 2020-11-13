
const { Transaction } = require('../src/transaction');
//const { Psbt } = require('./src/psbt');
const p2cryptoconditions = require('../src/payments/p2cryptoconditions');
//const ecpair = require('../src/ecpair');
const ecc = require('tiny-secp256k1');
const crypto = require('../src/crypto');
const address = require('../src/address');
const bufferutils = require("../src/bufferutils");

exports.finalizeCCtx = finalizeCCtx;
exports.createTxAndAddNormalInputs = createTxAndAddNormalInputs;
exports.getNormalUtxos = getNormalUtxos;
exports.getCCUtxos = getCCUtxos;
exports.hex2Base64 = hex2Base64;
exports.byte2Base64 = byte2Base64;
exports.addInputsFromPreviousTxns = addInputsFromPreviousTxns;
exports.pubkey2NormalAddressKmd = pubkey2NormalAddressKmd;
exports.getRawTransaction = getRawTransaction;
exports.isEmptyObject = isEmptyObject;
exports.ccTxidPubkey_tweak = ccTxidPubkey_tweak;

/**
 * sign c cc transaction, checks inputs and calls either standard signing function or cc signing function
 * @param {*} keyPairIn ecc key pair
 * @param {*} psbt psbt object
 * @param {*} ccProbes array of objects { cond, privateKey } specifying dedicated private keys for some cc conds
 */
function finalizeCCtx(keyPairIn, psbt, ccProbes)
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
    //let keyPairIn = ecpair.fromWIF(wif, mynetwork);
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
      // find a cond, it might also provide with a private key, if not use keyPairIn private key:
      let privateKey;
      let inputCond;
      if (ccProbes !== undefined && Array.isArray(ccProbes))
      {
        let probe = findCCProbeForSpk(ccProbes, prevOut.script);
        if (probe !== undefined) {
          inputCond = probe.cond;
          if (probe.privateKey !== undefined)
            privateKey = probe.privateKey;
        }
      }
      if (privateKey === undefined)
        privateKey = keyPairIn.privateKey;
      if (inputCond === undefined)
        throw new Error('finalizeCCtx no input cc found')

      let signatureHash = psbt.__CACHE.__TX.hashForKomodo(
        index,
        p2cryptoconditions.makeCCSpk(inputCond),  // pure spk should be here
        prevOut.value,   // unspent.value,
        Transaction.SIGHASH_ALL,
      );    

      let signedCond = p2cryptoconditions.cryptoconditions.js_sign_secp256k1(inputCond, privateKey, signatureHash);
      let ccScriptSig = p2cryptoconditions.makeCCScriptSig(signedCond);

      let ttt = p2cryptoconditions.makeCCSpk(signedCond);
      console.log("signed spk=", ttt.toString('hex'));
      
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

function findCCProbeForSpk(ccProbes, spk)
{
  let condbin = p2cryptoconditions.parseSpkCryptocondition(spk);
  return ccProbes.find(p => {
    let condbinp = p2cryptoconditions.ccConditionBinary(p.cond);
    console.log('prev condbin=', condbin.toString('hex'), 'probe condbin=', condbinp.toString('hex'));
    return condbin.equals(p2cryptoconditions.ccConditionBinary(p.cond));
  });
}

function getUtxos(peers, address, isCC)
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

/**
 * 
 * @param {*} peers NspvPeers object
 * @param {*} mypk pk to add normal inputs from
 * @param {*} amount that will be added (not less than)
 */
function createTxAndAddNormalInputs(peers, mypk, amount)
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

/**
 * 
 * @param {*} peers NspvPeers object
 * @param {*} address to add normal from
 */
function getNormalUtxos(peers, address)
{
  return getUtxos(peers, address, false);
}
/**
 * 
 * @param {*} peers NspvPeers object
 * @param {*} address to add cc inputs from
 */
function getCCUtxos(peers, address)
{
  return getUtxos(peers, address, true);
}
/**
 * 
 * @param {*} hexString to convert to base64
 * @returns base64 string
 */
function hex2Base64(hexString)
{
  return Buffer.from(hexString, 'hex').toString('base64');
}

function byte2Base64(uint8Eval)
{
  return Buffer.from([ uint8Eval ], 'hex').toString('base64');
}

/**
 * adds inputs into psbt from tx with inputs and array of previous txns in hex 
 * @param {*} psbt Psbt tx builder object
 * @param {*} tx tx where inputs reside
 * @param {*} prevTxnsHex array of input txns in hex
 */
function addInputsFromPreviousTxns(psbt, tx, prevTxnsHex)
{
  let added = 0;
  for(let i = 0; i < tx.ins.length; i ++) {
    let prevTxHex = prevTxnsHex.find((txHex) => {
        //let r = Transaction.fromHex(txHex).getHash().equals(tx.ins[i].hash);
        //console.log('prevtx getHash()=', Transaction.fromHex(txHex).getHash().toString('hex'), 'tx.ins[i].hash=', tx.ins[i].hash.toString('hex'), 'equals=', r);
        return Transaction.fromHex(txHex).getHash().equals(tx.ins[i].hash);
    });
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

/**
 * make komodo normal address from a pubkey
 * @param {*} pk pubkey to get komodod address from
 * @returns komodo normal address
 */
function pubkey2NormalAddressKmd(pk) {
  return address.toBase58Check(crypto.hash160(pk), 0x3c);
}

/**
 * Get transaction (in hex)
 * @param {*} peers 
 * @param {*} txid 
 */
function getRawTransaction(peers, mypk, txid)
{
  return new Promise((resolve, reject) => {
    let txidhex;
    if (Buffer.isBuffer(txid)) {
      let reversed = Buffer.allocUnsafe(txid.length);
      txid.copy(reversed);
      bufferutils.reverseBuffer(reversed);
      txidhex = reversed.toString('hex');
    }
    else
      txidhex = txid;
    peers.nspvRemoteRpc("getrawtransaction", mypk, [txidhex, 1], {}, (err, res, peer) => {
      //console.log('err=', err, 'res=', res);
      if (!err) 
        resolve(res);
      else
        reject(err);
    });
  });
}

/**
 * helper to test if object is empty
 * @param {*} obj 
 */
function isEmptyObject(obj) {
  for(var prop in obj) {
    if(obj.hasOwnProperty(prop)) {
      return false;
    }
  }
  return JSON.stringify(obj) === JSON.stringify({});
}

/**
 * Creates a pubkey from txid. The function tweaks last byte until the pubkey is valid. 
 * NOTE: Should be the same tweak algo as in the ccutils.cpp
 * @param {*} txid 
 */
function ccTxidPubkey_tweak(txid)
{
  if (Buffer.isBuffer(txid) && txid.length == 32)  {
    let pkbuf = Buffer.allocUnsafe(33);
    pkbuf[0] = 0x02;
    txid.copy(pkbuf, 1);
    i = 256;
    while(i-- > 0) {
      if (ecc.isPoint(pkbuf))
        break;
      pkbuf[32] ++;
    }
    if (ecc.isPoint(pkbuf))
      return pkbuf;
  }
  return Buffer.from([]);
}