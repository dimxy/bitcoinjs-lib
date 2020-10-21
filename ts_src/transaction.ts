import { BufferReader, BufferWriter, reverseBuffer } from './bufferutils';
import * as bcrypto from './crypto';
//import * as blake2b from 'blake2b';

const blake2b = require('blake2b');

import * as bscript from './script';
import { OPS as opcodes } from './script';
import * as types from './types';

const typeforce = require('typeforce');
const varuint = require('varuint-bitcoin');

const KMD_TX_VERSION = {
  OVERWINTER: 3,
  SAPLING: 4
};

function varSliceSize(someScript: Buffer): number {
  const length = someScript.length;

  return varuint.encodingLength(length) + length;
}

function vectorSize(someVector: Buffer[]): number {
  const length = someVector.length;

  return (
    varuint.encodingLength(length) +
    someVector.reduce((sum, witness) => {
      return sum + varSliceSize(witness);
    }, 0)
  );
}

const EMPTY_SCRIPT: Buffer = Buffer.allocUnsafe(0);
const EMPTY_WITNESS: Buffer[] = [];
const ZERO: Buffer = Buffer.from(
  '0000000000000000000000000000000000000000000000000000000000000000',
  'hex',
);
const ONE: Buffer = Buffer.from(
  '0000000000000000000000000000000000000000000000000000000000000001',
  'hex',
);
const VALUE_UINT64_MAX: Buffer = Buffer.from('ffffffffffffffff', 'hex');
const BLANK_OUTPUT = {
  script: EMPTY_SCRIPT,
  valueBuffer: VALUE_UINT64_MAX,
};

const ZCASH_PREVOUTS_HASH_PERSONALIZATION = Buffer.from('ZcashPrevoutHash');
const ZCASH_SEQUENCE_HASH_PERSONALIZATION = Buffer.from('ZcashSequencHash');
const ZCASH_OUTPUTS_HASH_PERSONALIZATION = Buffer.from('ZcashOutputsHash');
//const ZCASH_JOINSPLITS_HASH_PERSONALIZATION = Buffer.from('ZcashJSplitsHash');
//const ZCASH_SHIELDED_SPENDS_HASH_PERSONALIZATION = Buffer.from(('ZcashSSpendsHash');
//const ZCASH_SHIELDED_OUTPUTS_HASH_PERSONALIZATION = Buffer.from('ZcashSOutputHash');
const ZCASH_SIG_HASH_SAPLING_PERSONALIZATION = Buffer.concat([Buffer.from('ZcashSigHash'), Buffer.from([ 0xBB, 0x09, 0xB8, 0x76 ])]);
//const ZCASH_SIG_HASH_OVERWINTER_PERSONALIZATION = Buffer.concat([Buffer.from('ZcashSigHash'), Buffer.from([ 0x19, 0x1B, 0xA8, 0x5B ])]);


function isOutput(out: Output): boolean {
  return out.value !== undefined;
}

export interface Output {
  script: Buffer;
  value: number;
}

export interface Input {
  hash: Buffer;
  index: number;
  script: Buffer;
  sequence: number;
  witness: Buffer[];
}

export class Transaction {
  static readonly DEFAULT_SEQUENCE = 0xffffffff;
  static readonly SIGHASH_ALL = 0x01;
  static readonly SIGHASH_NONE = 0x02;
  static readonly SIGHASH_SINGLE = 0x03;
  static readonly SIGHASH_ANYONECANPAY = 0x80;
  static readonly ADVANCED_TRANSACTION_MARKER = 0x00;
  static readonly ADVANCED_TRANSACTION_FLAG = 0x01;

  static fromBuffer(buffer: Buffer, _NO_STRICT?: boolean): Transaction {
    const bufferReader = new BufferReader(buffer);

    const tx = new Transaction();
    tx.version = bufferReader.readUInt32();
    const versionStripped = (tx.version >>> 0) & (~(1 << 31) >>> 0);
    if (versionStripped >= KMD_TX_VERSION.OVERWINTER && versionStripped <= KMD_TX_VERSION.SAPLING)
      tx.versionGroupId = bufferReader.readUInt32(); // versionGroupId

    // no witnesses in komodo:
    //const marker = bufferReader.readUInt8();
    //const flag = bufferReader.readUInt8();

    let hasWitnesses = false; // no witnesses in komodo
    /*if (
      marker === Transaction.ADVANCED_TRANSACTION_MARKER &&
      flag === Transaction.ADVANCED_TRANSACTION_FLAG
    ) {
      hasWitnesses = true;
    } else {
      bufferReader.offset -= 2;
    }*/

    const vinLen = bufferReader.readVarInt();
    for (let i = 0; i < vinLen; ++i) {
      tx.ins.push({
        hash: bufferReader.readSlice(32),
        index: bufferReader.readUInt32(),
        script: bufferReader.readVarSlice(),
        sequence: bufferReader.readUInt32(),
        witness: EMPTY_WITNESS,
      });
    }

    const voutLen = bufferReader.readVarInt();
    for (let i = 0; i < voutLen; ++i) {
      tx.outs.push({
        value: bufferReader.readUInt64(),
        script: bufferReader.readVarSlice(),
      });
    }

    if (hasWitnesses) {
      for (let i = 0; i < vinLen; ++i) {
        tx.ins[i].witness = bufferReader.readVector();
      }

      // was this pointless?
      if (!tx.hasWitnesses())
        throw new Error('Transaction has superfluous witness data');
    }

    function checkOffset(size: number) : boolean {
      if (bufferReader.offset == buffer.length)
        return false;
      else if (bufferReader.offset + size > buffer.length)
        throw new Error('Transaction has invalid data alignment');
      return true;
    }

    if (!checkOffset(4)) return tx; // no space for zcash data
    tx.locktime = bufferReader.readUInt32();
    if (!checkOffset(4)) return tx;
    tx.nExpiryHeight = bufferReader.readUInt32(); // expiry height
    if (!checkOffset(8)) return tx;
    const valueBalance = bufferReader.readUInt64(); // value balance
    if (valueBalance != 0)
      throw new Error('Zcash transactions not supported');
    if (!checkOffset(3)) return tx;  // space for next 3 varints   
    const vShieldedSpendSize = bufferReader.readVarInt(); // empty vShieldedSpend
    if (vShieldedSpendSize != 0)
      throw new Error('Zcash transactions not supported');
    const vShieldedOutputSize = bufferReader.readVarInt(); // empty vShieldedOutput
    if (vShieldedOutputSize != 0)
      throw new Error('Zcash transactions not supported');
    const vJoinSplitSize = bufferReader.readVarInt(); // empty vjoinsplit
    if (vJoinSplitSize != 0)
      throw new Error('Zcash transactions not supported');
    if (_NO_STRICT) return tx;
    if (bufferReader.offset !== buffer.length)
      throw new Error('Transaction has unexpected data');
    return tx;
  }

  static fromHex(hex: string): Transaction {
    return Transaction.fromBuffer(Buffer.from(hex, 'hex'), false);
  }

  static isCoinbaseHash(buffer: Buffer): boolean {
    typeforce(types.Hash256bit, buffer);
    for (let i = 0; i < 32; ++i) {
      if (buffer[i] !== 0) return false;
    }
    return true;
  }

  version: number = 1;
  versionGroupId: number = 0;
  locktime: number = 0;
  nExpiryHeight: number = 0;
  ins: Input[] = [];
  outs: Output[] = [];

  isCoinbase(): boolean {
    return (
      this.ins.length === 1 && Transaction.isCoinbaseHash(this.ins[0].hash)
    );
  }

  addInput(
    hash: Buffer,
    index: number,
    sequence?: number,
    scriptSig?: Buffer,
  ): number {
    typeforce(
      types.tuple(
        types.Hash256bit,
        types.UInt32,
        types.maybe(types.UInt32),
        types.maybe(types.Buffer),
      ),
      arguments,
    );

    if (types.Null(sequence)) {
      sequence = Transaction.DEFAULT_SEQUENCE;
    }

    // Add the input and return the input's index
    return (
      this.ins.push({
        hash,
        index,
        script: scriptSig || EMPTY_SCRIPT,
        sequence: sequence as number,
        witness: EMPTY_WITNESS,
      }) - 1
    );
  }

  addOutput(scriptPubKey: Buffer, value: number): number {
    typeforce(types.tuple(types.Buffer, types.Satoshi), arguments);

    // Add the output and return the output's index
    return (
      this.outs.push({
        script: scriptPubKey,
        value,
      }) - 1
    );
  }

  hasWitnesses(): boolean {
    return this.ins.some(x => {
      return x.witness.length !== 0;
    });
  }

  weight(): number {
    const base = this.byteLength(false);
    const total = this.byteLength(true);
    return base * 3 + total;
  }

  virtualSize(): number {
    return Math.ceil(this.weight() / 4);
  }

  byteLength(_ALLOW_WITNESS: boolean = true): number {
    const hasWitnesses = _ALLOW_WITNESS && this.hasWitnesses();

    return (
      (hasWitnesses ? 10 : 8) +
      varuint.encodingLength(this.ins.length) +
      varuint.encodingLength(this.outs.length) +
      this.ins.reduce((sum, input) => {
        return sum + 40 + varSliceSize(input.script);
      }, 0) +
      this.outs.reduce((sum, output) => {
        return sum + 8 + varSliceSize(output.script);
      }, 0) +
      (hasWitnesses
        ? this.ins.reduce((sum, input) => {
            return sum + vectorSize(input.witness);
          }, 0)
        : 0)
        + 4 + 15);
  }

  clone(): Transaction {
    const newTx = new Transaction();
    newTx.version = this.version;
    newTx.versionGroupId = this.versionGroupId;

    newTx.locktime = this.locktime;
    newTx.nExpiryHeight = this.nExpiryHeight;

    newTx.ins = this.ins.map(txIn => {
      return {
        hash: txIn.hash,
        index: txIn.index,
        script: txIn.script,
        sequence: txIn.sequence,
        witness: txIn.witness,
      };
    });

    newTx.outs = this.outs.map(txOut => {
      return {
        script: txOut.script,
        value: txOut.value,
      };
    });

    return newTx;
  }

  /**
   * Hash transaction for signing a specific input.
   *
   * Bitcoin uses a different hash for each signed transaction input.
   * This method copies the transaction, makes the necessary changes based on the
   * hashType, and then hashes the result.
   * This hash can then be used to sign the provided transaction input.
   */
  hashForSignature(
    inIndex: number,
    prevOutScript: Buffer,
    hashType: number,
  ): Buffer {
    typeforce(
      types.tuple(types.UInt32, types.Buffer, /* types.UInt8 */ types.Number),
      arguments,
    );

    // https://github.com/bitcoin/bitcoin/blob/master/src/test/sighash_tests.cpp#L29
    if (inIndex >= this.ins.length) return ONE;

    // ignore OP_CODESEPARATOR
    const ourScript = bscript.compile(
      bscript.decompile(prevOutScript)!.filter(x => {
        return x !== opcodes.OP_CODESEPARATOR;
      }),
    );

    const txTmp = this.clone();

    // SIGHASH_NONE: ignore all outputs? (wildcard payee)
    if ((hashType & 0x1f) === Transaction.SIGHASH_NONE) {
      txTmp.outs = [];

      // ignore sequence numbers (except at inIndex)
      txTmp.ins.forEach((input, i) => {
        if (i === inIndex) return;

        input.sequence = 0;
      });

      // SIGHASH_SINGLE: ignore all outputs, except at the same index?
    } else if ((hashType & 0x1f) === Transaction.SIGHASH_SINGLE) {
      // https://github.com/bitcoin/bitcoin/blob/master/src/test/sighash_tests.cpp#L60
      if (inIndex >= this.outs.length) return ONE;

      // truncate outputs after
      txTmp.outs.length = inIndex + 1;

      // "blank" outputs before
      for (let i = 0; i < inIndex; i++) {
        (txTmp.outs as any)[i] = BLANK_OUTPUT;
      }

      // ignore sequence numbers (except at inIndex)
      txTmp.ins.forEach((input, y) => {
        if (y === inIndex) return;

        input.sequence = 0;
      });
    }

    // SIGHASH_ANYONECANPAY: ignore inputs entirely?
    if (hashType & Transaction.SIGHASH_ANYONECANPAY) {
      txTmp.ins = [txTmp.ins[inIndex]];
      txTmp.ins[0].script = ourScript;

      // SIGHASH_ALL: only ignore input scripts
    } else {
      // "blank" others input scripts
      txTmp.ins.forEach(input => {
        input.script = EMPTY_SCRIPT;
      });
      txTmp.ins[inIndex].script = ourScript;
    }

    // serialize and hash
    const buffer: Buffer = Buffer.allocUnsafe(txTmp.byteLength(false) + 4);
    buffer.writeInt32LE(hashType, buffer.length - 4);
    txTmp.__toBuffer(buffer, 0, false);

    return bcrypto.hash256(buffer);
  }

  hashForWitnessV0(
    inIndex: number,
    prevOutScript: Buffer,
    value: number,
    hashType: number,
  ): Buffer {
    typeforce(
      types.tuple(types.UInt32, types.Buffer, types.Satoshi, types.UInt32),
      arguments,
    );

    let tbuffer: Buffer = Buffer.from([]);
    let bufferWriter: BufferWriter;

    let hashOutputs = ZERO;
    let hashPrevouts = ZERO;
    let hashSequence = ZERO;

    if (!(hashType & Transaction.SIGHASH_ANYONECANPAY)) {
      tbuffer = Buffer.allocUnsafe(36 * this.ins.length);
      bufferWriter = new BufferWriter(tbuffer, 0);

      this.ins.forEach(txIn => {
        bufferWriter.writeSlice(txIn.hash);
        bufferWriter.writeUInt32(txIn.index);
      });

      hashPrevouts = bcrypto.hash256(tbuffer);
    }

    if (
      !(hashType & Transaction.SIGHASH_ANYONECANPAY) &&
      (hashType & 0x1f) !== Transaction.SIGHASH_SINGLE &&
      (hashType & 0x1f) !== Transaction.SIGHASH_NONE
    ) {
      tbuffer = Buffer.allocUnsafe(4 * this.ins.length);
      bufferWriter = new BufferWriter(tbuffer, 0);

      this.ins.forEach(txIn => {
        bufferWriter.writeUInt32(txIn.sequence);
      });

      hashSequence = bcrypto.hash256(tbuffer);
    }

    if (
      (hashType & 0x1f) !== Transaction.SIGHASH_SINGLE &&
      (hashType & 0x1f) !== Transaction.SIGHASH_NONE
    ) {
      const txOutsSize = this.outs.reduce((sum, output) => {
        return sum + 8 + varSliceSize(output.script);
      }, 0);

      tbuffer = Buffer.allocUnsafe(txOutsSize);
      bufferWriter = new BufferWriter(tbuffer, 0);

      this.outs.forEach(out => {
        bufferWriter.writeUInt64(out.value);
        bufferWriter.writeVarSlice(out.script);
      });

      hashOutputs = bcrypto.hash256(tbuffer);
    } else if (
      (hashType & 0x1f) === Transaction.SIGHASH_SINGLE &&
      inIndex < this.outs.length
    ) {
      const output = this.outs[inIndex];

      tbuffer = Buffer.allocUnsafe(8 + varSliceSize(output.script));
      bufferWriter = new BufferWriter(tbuffer, 0);
      bufferWriter.writeUInt64(output.value);
      bufferWriter.writeVarSlice(output.script);

      hashOutputs = bcrypto.hash256(tbuffer);
    }

    tbuffer = Buffer.allocUnsafe(156 + varSliceSize(prevOutScript));
    bufferWriter = new BufferWriter(tbuffer, 0);

    const input = this.ins[inIndex];
    bufferWriter.writeUInt32(this.version);
    bufferWriter.writeSlice(hashPrevouts);
    bufferWriter.writeSlice(hashSequence);
    bufferWriter.writeSlice(input.hash);
    bufferWriter.writeUInt32(input.index);
    bufferWriter.writeVarSlice(prevOutScript);
    bufferWriter.writeUInt64(value);
    bufferWriter.writeUInt32(input.sequence);
    bufferWriter.writeSlice(hashOutputs);
    bufferWriter.writeUInt32(this.locktime);
    bufferWriter.writeUInt32(hashType);
    return bcrypto.hash256(tbuffer);
  }

  hashForKomodo(
    inIndex: number,
    prevOutScript: Buffer,
    value: number,
    hashType: number,
  ): Buffer {
    typeforce(
      types.tuple(types.UInt32, types.Buffer, types.Satoshi, types.UInt32),
      arguments,
    );

    let tbuffer: Buffer = Buffer.from([]);
    let bufferWriter: BufferWriter;

    let hashOutputs = Buffer.allocUnsafe(32);
    let hashPrevouts = Buffer.allocUnsafe(32);
    let hashSequence = Buffer.allocUnsafe(32);
    let sigHash = Buffer.allocUnsafe(32);

    let emptyHash = Buffer.alloc(32); // init with 0


    tbuffer = Buffer.alloc/*Unsafe*/(36 * this.ins.length);
    bufferWriter = new BufferWriter(tbuffer, 0);

    this.ins.forEach(txIn => {
      bufferWriter.writeSlice(txIn.hash);
      bufferWriter.writeUInt32(txIn.index);
    });

    //console.log('prevouts tbuffer', tbuffer.toString('hex'));
    let b = new blake2b(32, null, null, ZCASH_PREVOUTS_HASH_PERSONALIZATION);
    b.update(tbuffer);
    b.digest(hashPrevouts);
    //console.log('hashPrevouts=', hashPrevouts.toString('hex'));
    
    tbuffer = Buffer.allocUnsafe(4 * this.ins.length);
    bufferWriter = new BufferWriter(tbuffer, 0);

    this.ins.forEach(txIn => {
      bufferWriter.writeUInt32(txIn.sequence);
    });

    b = new blake2b(32, null, null, ZCASH_SEQUENCE_HASH_PERSONALIZATION);
    b.update(tbuffer);
    b.digest(hashSequence);
    
    const txOutsSize = this.outs.reduce((sum, output) => {
      return sum + 8 + varSliceSize(output.script);
    }, 0);
    tbuffer = Buffer.allocUnsafe(txOutsSize);
    bufferWriter = new BufferWriter(tbuffer, 0);

    this.outs.forEach(out => {
      bufferWriter.writeUInt64(out.value);
      bufferWriter.writeVarSlice(out.script);
    });

    b = new blake2b(32, null, null, ZCASH_OUTPUTS_HASH_PERSONALIZATION);
    b.update(tbuffer);
    b.digest(hashOutputs);

    tbuffer = Buffer.alloc /*allocUnsafe*/(156 + 8 + 4 + 4 + 3 * 32 + varSliceSize(prevOutScript));  // + VersionGroupId (4) + ExpiryHeight (4) + 3 empty hashes + ValueBalance64
    bufferWriter = new BufferWriter(tbuffer, 0);

    const input = this.ins[inIndex];
    bufferWriter.writeUInt32(this.version);
    bufferWriter.writeUInt32(this.versionGroupId);
    bufferWriter.writeSlice(hashPrevouts);
    bufferWriter.writeSlice(hashSequence);
    //bufferWriter.writeSlice(input.hash);
    //bufferWriter.writeUInt32(input.index);
    //bufferWriter.writeVarSlice(prevOutScript);
    //bufferWriter.writeUInt64(value);
    //bufferWriter.writeUInt32(input.sequence);
    bufferWriter.writeSlice(hashOutputs);
    //console.log('hashOutputs', tbuffer.toString('hex'))


    bufferWriter.writeSlice(emptyHash);   // JoinSplits
    bufferWriter.writeSlice(emptyHash);   // Spend descriptions
    bufferWriter.writeSlice(emptyHash);   // Output descriptions
    //console.log('3 empty hash', tbuffer.toString('hex'))
    bufferWriter.writeUInt32(this.locktime);
    bufferWriter.writeUInt32(this.nExpiryHeight);  // ExpiryHeight
    bufferWriter.writeUInt64(0); // value balance
    bufferWriter.writeUInt32(hashType);
    //console.log('locktime', tbuffer.toString('hex'))

    if (inIndex >= 0) { // TODO: check if 'not and input'
      //console.log('input.hash')

      bufferWriter.writeSlice(input.hash);
      bufferWriter.writeUInt32(input.index);
      bufferWriter.writeVarSlice(prevOutScript);
      bufferWriter.writeUInt64(value);
      bufferWriter.writeUInt32(input.sequence);
      //console.log('input.hash', tbuffer.toString('hex'))
    }

    //console.log('tbuffer=', tbuffer.toString('hex'));
    b = new blake2b(32, null, null, ZCASH_SIG_HASH_SAPLING_PERSONALIZATION);
    b.update(tbuffer);
    b.digest(sigHash);
    return sigHash;
  }

  getHash(forWitness?: boolean): Buffer {
    // wtxid for coinbase is always 32 bytes of 0x00
    if (forWitness && this.isCoinbase()) return Buffer.alloc(32, 0);
    return bcrypto.hash256(this.__toBuffer(undefined, undefined, forWitness));
  }

  getId(): string {
    // transaction hash's are displayed in reverse order
    return reverseBuffer(this.getHash(false)).toString('hex');
  }

  toBuffer(buffer?: Buffer, initialOffset?: number): Buffer {
    return this.__toBuffer(buffer, initialOffset, true);
  }

  toHex(): string {
    return this.toBuffer(undefined, undefined).toString('hex');
  }

  setInputScript(index: number, scriptSig: Buffer): void {
    typeforce(types.tuple(types.Number, types.Buffer), arguments);

    this.ins[index].script = scriptSig;
  }

  setWitness(index: number, witness: Buffer[]): void {
    typeforce(types.tuple(types.Number, [types.Buffer]), arguments);

    this.ins[index].witness = witness;
  }

  private __toBuffer(
    buffer?: Buffer,
    initialOffset?: number,
    _ALLOW_WITNESS: boolean = false,
  ): Buffer {
    if (!buffer)
      buffer = Buffer.allocUnsafe(this.byteLength(_ALLOW_WITNESS)) as Buffer;

    const bufferWriter = new BufferWriter(buffer, initialOffset || 0);

    bufferWriter.writeUInt32(this.version);  // komodo header incl overwinter flag
    bufferWriter.writeUInt32(this.versionGroupId);  // komodo version group id

    const hasWitnesses = _ALLOW_WITNESS && this.hasWitnesses();

    if (hasWitnesses) {
      bufferWriter.writeUInt8(Transaction.ADVANCED_TRANSACTION_MARKER);
      bufferWriter.writeUInt8(Transaction.ADVANCED_TRANSACTION_FLAG);
    }

    bufferWriter.writeVarInt(this.ins.length);

    this.ins.forEach(txIn => {
      bufferWriter.writeSlice(txIn.hash);
      bufferWriter.writeUInt32(txIn.index);
      bufferWriter.writeVarSlice(txIn.script);
      bufferWriter.writeUInt32(txIn.sequence);
    });

    bufferWriter.writeVarInt(this.outs.length);
    this.outs.forEach(txOut => {
      if (isOutput(txOut)) {
        bufferWriter.writeUInt64(txOut.value);
      } else {
        bufferWriter.writeSlice((txOut as any).valueBuffer);
      }

      bufferWriter.writeVarSlice(txOut.script);
    });

    if (hasWitnesses) {
      this.ins.forEach(input => {
        bufferWriter.writeVector(input.witness);
      });
    }

    bufferWriter.writeUInt32(this.locktime);

    bufferWriter.writeUInt32(this.nExpiryHeight);   // expiry height
    bufferWriter.writeUInt64(0);   // value balance

    bufferWriter.writeVarInt(0);   // empty vShieldedSpend
    bufferWriter.writeVarInt(0);   // empty vShieldedOutput
    bufferWriter.writeVarInt(0);   // empty vjoinsplit

    // avoid slicing unless necessary
    if (initialOffset !== undefined)
      return buffer.slice(initialOffset, bufferWriter.offset);
    return buffer;
  }
}
