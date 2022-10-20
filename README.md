[![Test](https://github.com/roaminro/local-koinos/actions/workflows/test.yml/badge.svg)](https://github.com/roaminro/local-koinos/actions/workflows/test.yml)

# Local-Koinos

Local-Koinos is a set of scripts and tools that will help you spin up a devnet on your local machine in minutes.

## Install Docker (and Docker-Compose)

You will need to install Docker on MacOS, Linux or Windows first. You can follow their instructions for installation [here](https://www.docker.com/products/docker-desktop). Docker desktop comes with a recent version of docker-compose.

## Installation
```sh
# with npm
npm install -g @roamin/local-koinos

# with yarn
yarn global add @roamin/local-koinos
```

## Usage as CLI
```sh
# start a local Koinos devnet (default mode is "auto")
# there are 3 modes available:
# - auto: produces a block every time you submit a transaction to the mempool
# - interval: creates a block every X seconds with all transactions available in the mempool
# - manual: awaits for blocks to be submitted manually
# a local JSON RPC service will be available by default at http://127.0.0.1:8080
local-koinos start

# stop the node
local-koinos stop
```

## Example of programmatic usage using JavaScript/TypeScript

```js
import { LocalKoinos, Token, Signer } from '@roamin/local-koinos';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore 
import * as abi from './calculator-abi.json';

// @ts-ignore koilib_types is needed when using koilib
abi.koilib_types = abi.types

const localKoinos = new LocalKoinos();

// start local-koinos node
await localKoinos.startNode();
// start block production in auto mode (a block gets produced every time you submit a transaction)
await localKoinos.startBlockProduction();

// deploy the Koin contract
await localKoinos.deployKoinContract();

// mint 50,000 Koin tokens to 10 accounts
await localKoinos.mintKoinDefaultAccounts();

// get the accounts initialized with `mintKoinDefaultAccounts`
const [genesis, koin, acct1] = localKoinos.getAccounts();

// deploy a contract to the devnet
const contract = await localKoinos.deployContract(acct1.wif, './calculator-contract.wasm', abi);

// call your contract functions
const { result } = await contract.functions.add({ x: '4', y: '5' });
expect(result!.value).toBe('9');

// stop local-koinos node
await localKoinos.stopNode();
```
