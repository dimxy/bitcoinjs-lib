# BitcoinJS with Komodo (bitcoinjs-lib-kmd)

A javascript Bitcoin library for node.js and browsers. Written in TypeScript, but committing the JS files to verify.<br>
Added support for komodo messages including nSPV and lib cryptoconditions.

Released under the terms of the [MIT LICENSE](LICENSE).

## Prerequisites

You need installed:
  - nodejs v.12+<br>
  - rust<br>
  - wasm-pack to build wasm cryptoconditions module<br> 
  
If you are going to use this lib in browser you also need:
  - browserify package<br> 
  - a webserver app (for example, webpack dev server)<br>
  - a wsproxy app (for example, webcoin-bridge)

## What test app does

Included a ccfaucetpoc.js file that allows to create cc faucet create and get transactions.<br>
To test this you need a komodod chain with cc modules enabled (Note about the correct komodod repo with an nspv patch, see below)

## Installation

Clone this git repository go to the new dir and checkout dev-kmd branch.

Install the bitcoinjs-lib-kmd dependency packages, inside the repo dir run:

```
npm install
```

Setup network parameters for your komodo chain:<br>
Open ts_src/networks.ts and make a new entry for your chain.<br>
In fact you need to fix the yourchainname and magic params for your chain:
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

Rebuild nodejs packages:
```
npm run build
```

In ccfaucetpoc.js change mynetwork var to yourchainname:<br>
```
var mynetwork=networks.yourchainname
```

Set your funding faucet wif and address and a wif and address getting funds in ccfaucetpoc.js (set vars faucetcreatewif, faucetcreateaddress, faucetgetwif, faucetgetaddress).<br>

## Build test app to run in nodejs

Build the cryptoconditions wasm module:<br>
Setup the rust nightly build to build cryptoconditions. It looks like the current latest October 2020 nightly build is broken and omitted some runtime lib.
I use this 'nightly-2020-09-11' build that worked well for me:
```
rustup toolchain install nightly-2020-09-11
rustup default nightly-2020-09-11
```

Change to cryptoconditions-js directory and build the cryptoconditions wasm module for nodejs target:
```
cd ./node_modules/cryptoconditions-js
wasm-pack build -t nodejs
```

Run the testapp in nodejs:
```
node ./ccfaucetpoc.js
```

## How to use the test app in the browser:

To run the test app in the browser you will need a webserver to host an html sample page and the test app ccfaucetpocbr.js.
Also you need a websocket proxy to convert websockets into nspv p2p protocol.

### Setting up a web server

I use the webpack dev server running in nodejs.<br>
To setup a webpack sample config make a dir like 'webpack' and create inside it two files with the following content:

package.json:
```
{
  "scripts": {
    "serve": "webpack-dev-server"
  },
  "dependencies": {
    "cryptoconditions-js": "git+https://github.com/dimxy/cryptoconditions-js.git#master"
  },
  "devDependencies": {
    "webpack": "^4.44.2",
    "webpack-cli": "^3.3.12",
    "webpack-dev-server": "^3.11.0"
  }
}
```

webpack.config.js:
```
const path = require('path');
module.exports = {
  entry: "./ccfaucetpocbr.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "ccfaucetpocbr-bundle.js",
    library: 'myLibrary'
  },
  mode: "development",
  //to serve from any address:
  devServer: {
    port: 8080,
    host: '0.0.0.0'
  }
};
```
(Both those package.json and webpack.config.js files may be found in webpack-test subdir of bitcoinjs-lib-kmd dir)
Inside the webpack dir run: 
```
npm install
``` 
(ignore printed errors)

Set again the nightly rust version for this repo:
```
rustup default nightly-2020-09-11
```

Change to ./node_modules/cryptoconditions-js subdir and run the following command to build cryptconditions lib wasm for browserify.
```
cd ./node_modules/cryptoconditions-js
wasm-pack build
```

Now go to bitcoinjs-lib-kmd repo dir.<br>
Rebuild sources and build the test app for browser:
```
npm run build
browserify ../bitcoinjs-lib-kmd/ccfaucetpoc.js --standalone faucet -o ccfaucetpocbr.js
```
Copy created ccfaucetpocbr.js into your webpack dir.
Copy the example of an index.html page from the webpack-test dir to your webpack dir.
Inside your webpack dir run the web server with a command:
```
npm run serve
```
The web server should be available at http://localhost:8080 url (if you installed the webpack on the same PC).

### Setting up a websocket proxy

Clone https://github.com/mappum/webcoin-bridge.git repo.
Change to webcoin-bridge dir.
Run packages install:
```
npm install
```
Copy ./node_modules/webcoin-bitcoin dir into ./src as webcoin-yourchainname.<br>
Change to ./src/webcoin-yourchainname dir.<br>
Edit ./lib/net.js file.<br>
Add or change lines:
```
var magic = your-chain-magic;
var protocolVersion = 170009;
var defaultPort = your-chain-p2p-port;

var dnsSeeds = [
//  'seed.bitcoin.sipa.be', 'dnsseed.bluematt.me', 'dnsseed.bitcoin.dashjr.org', 'seed.bitcoinstats.com', 'seed.bitnodes.io', 'bitseed.xf2.org', 'seed.bitcoin.jonasschnelli.ch'
  'localhost'
];

var staticPeers = [ 'localhost:<your-chain-p2p-port>' ];

var webSeeds = [];

module.exports = {
  magic: magic,
  defaultPort: defaultPort,
  dnsSeeds: dnsSeeds,
  webSeeds: webSeeds,
  staticPeers: staticPeers,
  protocolVersion: protocolVersion
};
```

Now run the ws bridge from webcoin-bridge dir:
```
node ./bin/bridge.js --network ../src/webcoin-yourchainname
```
WS Proxy should be available on the default port 8192.<br>
The ccfaucetpos.js test app also has this port configured by default in its code (see webSeeds var in ccfaucetpoc.js file).


### Use the correct komodod version

The last thing is to make sure you run a komodod version with an extension to nSPV getutxos call (it should additionally return script for each utxo).<br>
Use this komodod branch for this:
https://github.com/dimxy/komodo/tree/nspv-utxo-ext

I recommed to run komodod with -debug=net to easily discover wrong magic errors and observe communication dynamic. Basically komodod should print ver/verack and ping/pong exchanges in the debug.log, if connection is okay


## What should happen in the test

When you run the chain, webpack and webcoin-bridge, you might go to the test page url in browser (http://localhost:8080).<br>
When you load it in a browser it should print the created cc faucet txhex content in the browser window. 


## Info about new and updated packages

Some dependent packages were modified to add support for komodo:
  * bitcoin-protocol
  * bitcoin-net

Links to these packages in package.json are updated to load them from forked github repositories (see package.json).  
  
Added a new package cryptoconditions-js that currently is loaded also from a github repo.


## Original readme
Read the original readme [here](https://github.com/bitcoinjs/bitcoinjs-lib).

## LICENSE [MIT](LICENSE)
