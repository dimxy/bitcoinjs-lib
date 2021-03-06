// https://en.bitcoin.it/wiki/List_of_address_prefixes
// Dogecoin BIP32 is a proposed standard: https://bitcointalk.org/index.php?topic=409731
export interface Network {
  messagePrefix: string;
  bech32: string;
  bip32: Bip32;
  pubKeyHash: number;
  scriptHash: number;
  wif: number;
}

interface Bip32 {
  public: number;
  private: number;
}

export const bitcoin: Network = {
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
export const regtest: Network = {
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
export const testnet: Network = {
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
export const dimxy14: Network = {
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
export const dimxy15: Network = {
  messagePrefix: '\x18DIMXY15 asset chain:\n',
  bech32: 'R',
  bip32: {
    public: 0xDC2E96D8,
    private: 0x00000000,
  },
  pubKeyHash: 0x3c,
  scriptHash: 0x55,
  wif: 0xbc,
};
export const rick: Network = {
  messagePrefix: '\x18rick asset chain:\n',
  bech32: 'R',
  bip32: {
    public: 0xfd750df6,
    private: 0x00000000,
  },
  pubKeyHash: 0x3c,
  scriptHash: 0x55,
  wif: 0xbc,
};
export const marmaraxy31: Network = {
  messagePrefix: '\x18MARMARAXY31 asset chain:\n',
  bech32: 'R',
  bip32: {
    public: 0x3869ccd3,
    private: 0x00000000,
  },
  pubKeyHash: 0x3c,
  scriptHash: 0x55,
  wif: 0xbc,
};

export const marmaraxy32: Network = {
  messagePrefix: '\x18MARMARAXY32 asset chain:\n',
  bech32: 'R',
  bip32: {
    public: 0x9A98CAB2,
    private: 0x00000000,
  },
  pubKeyHash: 0x3c,
  scriptHash: 0x55,
  wif: 0xbc,
};
// add your chain here: