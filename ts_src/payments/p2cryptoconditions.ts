import { bitcoin as BITCOIN_NETWORK } from '../networks';
import * as bscript from '../script';
//import * as bufferUtils from '../bufferutils';
//const varuint = require('varuint-bitcoin');

import { Payment, PaymentOpts/*, StackFunction*/ } from './index';
//import * as lazy from './lazy';
const typef = require('typeforce');
const OPS = bscript.OPS;
export const CCOPS = {
  OP_CRYPTOCONDITIONS: 0xCC
};

//export var cryptoconditions: any;// = require('cryptoconditions-js/pkg/cryptoconditions.js'); //async, must be loaded in outercalls
//if (process.browser)
//export var cryptoconditions = import('cryptoconditions-js/pkg/cryptoconditions.js');   // in browser, use 'wasm-pack build' (no any --target). Don't forget run browerify!
//else
//export var cryptoconditions = require('cryptoconditions-js/pkg/cryptoconditions.js');  // in nodejs, use 'wasm-pack build -t nodejs'
//import * as cryptoconditions from "cryptoconditions-js/pkg/cryptoconditions.js";
//var ccimp = require('cryptoconditions-js/pkg/cryptoconditions.js');  // in nodejs, use 'wasm-pack build -t nodejs'
//var cryptoconditions;
//if (process.browser)
export var cryptoconditions : any;
//import('cryptoconditions-js/pkg/cryptoconditions.js').then((cc)=> cryptoconditions = cc );   // in browser, use 'wasm-pack build' (no any --target). Don't forget run browerify!
//else
  //ccimp = require('cryptoconditions-js/pkg/cryptoconditions.js');  // in nodejs, use 'wasm-pack build -t nodejs'
//var ccimp = import('cryptoconditions-js/pkg/cryptoconditions.js'); 

// input: {signature}
// output: {pubKey} OP_CHECKSIG
export function p2cryptoconditions(a: Payment, opts?: PaymentOpts): Payment {
  if (!a.input && !a.output )
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});

  typef(
    {
      network: typef.maybe(typef.Object),
      output: typef.maybe(typef.Buffer),
      input: typef.maybe(typef.Buffer),
    },
    a,
  );

  //if (cryptoconditions === undefined)
  //  throw new TypeError('cryptoconditions lib not available');


  /*const _outputChunks = lazy.value(() => {
    return bscript.decompile(a.output!);
  }) as StackFunction;*/

  const network = a.network || BITCOIN_NETWORK;
  const o: Payment = { name: 'cryptoconditions', network };

  if (a.output)  {
    //if (_outputChunks().length != 2 || _outputChunks()[1] != 0xcc)
    //  throw new TypeError('not a cryptoconditions output');

    if (!isPayToCryptocondition(a.output))
      throw new TypeError('not a cryptoconditions output');
  }

  if (a.input)  {
    throw new TypeError('check for cryptoconditions input not supported');
  }

  return Object.assign(o, a);
}

export function parseSpkCryptocondition(spk: Buffer) : Buffer
{
  //console.log('IsPayToCryptocondition spk=', spk.toString('hex'));
  if (Buffer.isBuffer(spk) /*&& spk.length >= 46 && spk[spk.length-1] == 0xcc*/)  {
    let chunks = bscript.decompile(spk);
    if (chunks && chunks.length >= 2) {
      if (Buffer.isBuffer(chunks[0]) && chunks[1] as number == CCOPS.OP_CRYPTOCONDITIONS) {
        let condbin : Buffer = chunks[0] as Buffer;
        return condbin;
      }
    }
  }
  return Buffer.from([]);
}

export function getSpkCryptocondition(spk: Buffer) : any
{

  //let cryptoconditions = ccimp;
  if (cryptoconditions === undefined)
    throw new Error("cryptoconditions lib not available");

  let condbin = parseSpkCryptocondition(spk);
  if (Buffer.isBuffer(condbin) && condbin.length > 0)  {
    let cond = cryptoconditions.js_read_ccondition_binary(Uint8ClampedArray.from(condbin));
    if (cond !== undefined)
      return cond;
  }
  return undefined;
}

export function isPayToCryptocondition(spk: Buffer) : boolean
{
  if (getSpkCryptocondition(spk) !== undefined)
    return true;
  else
    return false;
}

export function ccConditionBinary(cond: Buffer) : Buffer
{

  //let cryptoconditions = ccimp;
  if (cryptoconditions === undefined)
    throw new Error("cryptoconditions lib not available");

  let ccbin = cryptoconditions.js_cc_condition_binary(cond);
  if (ccbin != null)
    return Buffer.from(ccbin);

  return Buffer.from([]);
}

export function makeCCSpk(cond: Buffer, opDropData: Buffer) : Buffer
{
  if (cryptoconditions === undefined)
    throw new Error("cryptoconditions lib not available");

  let ccbin = cryptoconditions.js_cc_condition_binary(cond);
  console.log("ccbin=", ccbin);
  if (ccbin == null)
    return Buffer.from([]);

  let len = ccbin.length;
  //console.log('ccbin=', Buffer.from(ccbin.buffer).toString('hex'));
  if (len > 0)
  {
    //let spk = Buffer.alloc(len+2);
    //spk[0] = len;  // TODO: should be VARINT here
    //Buffer.from(ccbin.buffer).copy(spk, 1);
    //spk[1+len] = CCOPS.OP_CRYPTOCONDITIONS;
    let spk; 
    if (opDropData === undefined)
      spk = bscript.compile([Buffer.from(ccbin), CCOPS.OP_CRYPTOCONDITIONS]);
    else 
      spk = bscript.compile([Buffer.from(ccbin), CCOPS.OP_CRYPTOCONDITIONS, opDropData, OPS.OP_DROP]);
    return spk;
  }
  return Buffer.from([]);
}

export function makeOpDropData(evalCode: number, m: number, n: number, vData: Buffer) : Buffer
{
  let version = 1;

  let vParams = bscript.compile([version, evalCode, m , n]);
  let opDropData = bscript.compile([vParams, vData]);
  /*let params = Buffer.allocUnsafe(4);
  let bufferWriter1 = new bufferUtils.BufferWriter(params);

  bufferWriter1.writeUInt8(version);
  bufferWriter1.writeUInt8(evalCode);
  bufferWriter1.writeUInt8(m);
  bufferWriter1.writeUInt8(n);

  let opdrop = Buffer.allocUnsafe(1+4 + varuint.encodingLength(vData.length) + vData.length )
  let bufferWriter2 = new bufferUtils.BufferWriter(opdrop);
  bufferWriter2.writeSlice(params);
  bufferWriter2.writeSlice(vData);*/
  return opDropData;
}

export function makeCCScriptSig(cond: Buffer): Buffer
{
  if (cryptoconditions === undefined)
    throw new Error("cryptoconditions lib not available");

  let ffilbin = cryptoconditions.js_cc_fulfillment_binary(cond);
  //console.log("ffilbin=", ffilbin);
  if (ffilbin == null)
    return Buffer.from([]);

  let len = ffilbin.length;
  console.log('ffilbin=', Buffer.from(ffilbin).toString('hex'));
  if (len > 0)
  {
    let ffilbinWith01 = Buffer.concat([Buffer.from(ffilbin), Buffer.from([ 0x01 ])]);
    /*let scriptSig = Buffer.alloc(len+2);
    scriptSig[0] = len;  // TODO: should be VARINT here
    Buffer.from(ffilbin).copy(scriptSig, 1);
    scriptSig[1+len] = 0x01;*/
    let scriptSig = bscript.compile([ffilbinWith01]);
    console.log('ccScriptSig=', Buffer.from(scriptSig).toString('hex'));
    return scriptSig;
  }
  return Buffer.from([]);
}