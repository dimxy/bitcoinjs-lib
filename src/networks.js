'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.bitcoin = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'bc',
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x00,
  scriptHash: 0x05,
  wif: 0x80,
};
exports.regtest = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'bcrt',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};
exports.testnet = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};
exports.dimxy14 = {
  messagePrefix: '\x18DIMXY14 asset chain:\n',
  bech32: 'R',
  bip32: {
    public: 0x4ea629ab,
    private: 0x00000000,
  },
  pubKeyHash: 0x3c,
  scriptHash: 0x55,
  wif: 0xbc,
};
exports.dimxy15 = {
  messagePrefix: '\x18DIMXY15 asset chain:\n',
  bech32: 'R',
  bip32: {
    public: 0xdc2e96d8,
    private: 0x00000000,
  },
  pubKeyHash: 0x3c,
  scriptHash: 0x55,
  wif: 0xbc,
};
// add your chain here:
