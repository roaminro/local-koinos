[![ubuntu-ci](https://github.com/roaminro/local-koinos/actions/workflows/ubuntu-ci.yml/badge.svg)](https://github.com/roaminro/local-koinos/actions/workflows/ubuntu-ci.yml)
[![macos-ci](https://github.com/roaminro/local-koinos/actions/macos/ubuntu-ci.yml/badge.svg)](https://github.com/roaminro/local-koinos/actions/workflows/macos-ci.yml)

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
# - interval: creates a block every X seconds with all transactions available in the mempool (default is every 3 seconds)
# - manual: awaits for blocks to be manually submitted to the chain
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

// deploy a contract to the devnet (returns an instance of a Koilib Contract)
const contract = await localKoinos.deployContract(acct1.wif, './calculator-contract.wasm', abi);

// call your contract functions
const { result } = await contract.functions.add({ x: '4', y: '5' });
expect(result!.value).toBe('9');

// stop local-koinos node
await localKoinos.stopNode();
```

## Example of programmatic usage using Jest
https://github.com/roaminro/local-koinos/blob/0ddc2bf468418fa743c017a457ba9f7701e229eb/tests/tests.spec.ts#L1-L59
