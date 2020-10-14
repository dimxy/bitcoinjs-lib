# BitcoinJS with Komodo (bitcoinjs-lib-kmd)

A javascript Bitcoin library for node.js and browsers. Written in TypeScript, but committing the JS files to verify.
Added support for komodo messages including nSPV and lib cryptoconditions.

Released under the terms of the [MIT LICENSE](LICENSE).

## Prerequisites

You need installed:
  nodejs
  rust
  wasm-pack to build wasm cryptoconditions module 
  
If you are going to use this lib in browser you also need:
  browserify package 
  a webserver app (for example, webpack dev server)
  a wsproxy app (for example, webcoin-bridge)

## What test code does

Include a mytestnode.js file that allows to create cc faucet create and get transactions

## Installation

Clone this git repository go to the new dir and checkout dev-kmd branch.
Install and build the packages:

```
npm install
```

Setup network parameters for your komodo chain:
Open ts_src/networks.ts and make a new entry for your chain.
In fact you need to fix yourchainname and the magic param:
```
export const yourchainname: Network = {
  messagePrefix: '\x18Your-chain-name asset chain:\n',
  bech32: 'R',
  bip32: {
    public: 0x4ea629ab,   // magic
    private: 0x00000000,
  },
  // komodo network params:
  pubKeyHash: 0x3c,   
  scriptHash: 0x55,
  wif: 0xbc,
};
```

Build nodejs packages

```
npm run build
```

In mynodetest.js change mynetwork var to yourchainname
```
var mynetwork=networks.yourchainname
```


Build cryptoconditions wasm module:
Setup the rust nightly build to build cryptoconditions. It looks like the latest nightly build is btoken and cannot use some runtime lib.
I use this nightly-2020-09-11 build that works well for me:
```
rustup toolchain install nightly-2020-09-11
rustup default nightly-2020-09-11
```

Change to cryptoconditions-js directory and build the cryptoconditions wasm module
```
cd ./node_modules/cryptoconditions-js
```

### Build cryptoconditions for nodejs

Use this command to build for nodejs:
```
wasm-pack build -t nodejs
```


In testapp mynodetest.js use (uncomment) this statement to load cryptoconditions:
```
const ccimp = require('cryptoconditions-js/pkg/cryptoconditions.js');
```

Run the testapp in nodejs:
```
nodejs ./mynodetest.js
```


### Build cryptoconditions for use in the browser

Alternatively, to build for browseify use this command:
```
wasm-pack build
```

In testapp mynodetest.js use (uncomment) this statement to load cryptoconditions:
```
const ccimp = import('cryptoconditions-js/pkg/cryptoconditions.js');
```

build the test code for browser:
```
browserify mynodetest.js -o index.js
```

To run the test code in the browser you will need a webserver to host an html page and index.js test code.
Also you will need a websocket proxy.

## Setting up a webserver


## Setting up a websocket proxy



## Info about new and updated packages

Some dependent packages were modified to add support for komodo:
  * bitcoin-protocol
  * bitcoin-net

Links to these packages in package.json are updated to load them from forked github repositories (see package.json)  
  
Added a new package cryptoconditions-js that currently is loaded also from a github repo.


## Original readme
Read original readme [here](https://github.com/bitcoinjs/bitcoinjs-lib).

## LICENSE [MIT](LICENSE)
