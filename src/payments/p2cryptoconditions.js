'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const networks_1 = require('../networks');
//import * as lazy from './lazy';
const typef = require('typeforce');
//const OPS = bscript.OPS;
//export var cryptoconditions: any;// = require('cryptoconditions-js/pkg/cryptoconditions.js'); //async, must be loaded in outercalls
//if (process.browser)
//export var cryptoconditions = import('cryptoconditions-js/pkg/cryptoconditions.js');   // in browser, use 'wasm-pack build' (no any --target). Don't forget run browerify!
//else
//export var cryptoconditions = require('cryptoconditions-js/pkg/cryptoconditions.js');  // in nodejs, use 'wasm-pack build -t nodejs'
const cryptoconditions = require('cryptoconditions-js/pkg/cryptoconditions.js');
//var ccimp = require('cryptoconditions-js/pkg/cryptoconditions.js');  // in nodejs, use 'wasm-pack build -t nodejs'
// input: {signature}
// output: {pubKey} OP_CHECKSIG
function p2cryptoconditions(a, opts) {
  if (!a.input && !a.output) throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});
  typef(
    {
      network: typef.maybe(typef.Object),
      output: typef.maybe(typef.Buffer),
      input: typef.maybe(typef.Buffer),
    },
    a,
  );
  if (cryptoconditions === undefined)
    throw new TypeError('cryptoconditions lib not available');
  /*const _outputChunks = lazy.value(() => {
      return bscript.decompile(a.output!);
    }) as StackFunction;*/
  const network = a.network || networks_1.bitcoin;
  const o = { name: 'cryptoconditions', network };
  if (a.output) {
    //if (_outputChunks().length != 2 || _outputChunks()[1] != 0xcc)
    //  throw new TypeError('not a cryptoconditions output');
    if (!isPayToCryptocondition(a.output))
      throw new TypeError('not a cryptoconditions output');
  }
  if (a.input) {
    throw new TypeError('check for cryptoconditions input not supported');
  }
  return Object.assign(o, a);
}
exports.p2cryptoconditions = p2cryptoconditions;
function isPayToCryptocondition(spk) {
  if (cryptoconditions === undefined) return false;
  console.log('IsPayToCryptocondition spk=', spk.toString('hex'));
  if (Buffer.isBuffer(spk) && spk.length >= 46 && spk[spk.length - 1] == 0xcc) {
    let condbin = spk.slice(1, spk.length - 1);
    console.log(
      'IsPayToCryptocondition checking buffer=',
      condbin.toString('hex'),
    );
    let cond = cryptoconditions.js_read_ccondition_binary(
      Uint8ClampedArray.from(condbin),
    );
    if (cond !== undefined) return true;
  }
  return false;
}
exports.isPayToCryptocondition = isPayToCryptocondition;
