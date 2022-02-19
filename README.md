# Local-Koinos

Local-Koinos is a set of scripts and tools that will help you spin up a devnet in minutes on your local machine.

## Install Docker Compose

You will need to install Docker on MacOS or Windows first . You can follow their instructions for installation [here](https://www.docker.com/products/docker-desktop). Docker desktop comes with a recent version of docker-compose.

You may need to upgrade your version of docker-compose on Linux. Ubuntu 20.04 does not come with a recent enough version. Your mileage may vary depending on your distribution. You can follow the official [installation instructions](https://docs.docker.com/compose/install/) to upgrade your version of docker-compose if needed. At the time of writing, the current docker-compose version was `1.29.2`.

## Run Local-Koinos

Once docker-compose is installed, run `docker-compose --profile all up -d` to start a Local-Koinos node.

By default, each container will use `~/.local-koinos` on the host as their base directory. This can be changed by setting `BASEDIR` in `.env`, or exporting `BASEDIR`, to a different location on the host machine.

You will find `config.yml` in the base directory, which can be modified to change config on the microservices. At present, you need to restart docker compose for the new config to be applied. (That is a future TODO)

Different images can be run by setting environment variables or setting them in `.env`. For each microservice, append `_TAG` (e.g. `export P2P_TAG=64-auto-gossip`).

By default the node will run all the microservices available:
 - `chain`
 - `block_store`
 - `mempool`
 - `p2p`
 - `block_producer` (with the federated algorithm, which basically produces a block every few seconds)
 - `jsonrpc`
 - `transaction_store`
 - `contract_meta_store`

## Bootstrap the blockchain
Once the node is fully started, run the following script to bootstrap the blockchain:
```sh
./bootstrap.sh
```

## Available wallets
In the wallets folder you'll find all the accounts that were used during the bootstrap procedure:

| Name     |    Info     |  Public Key |  Private Key |
|----------|-------------|-------------|--------------|
| genesis | genesis account of the blockchain | 1GXe3r3VmkKAEhj6C156jPxQC8p1xbQD2i | 5JY6DFyroXn3wthivhwXgpspAWbBoRrD49paoP6zWhDRAPcSSi4 |
| koin | koin contract account | 1NvZvWNqDX7t93inmLBvbv6kxhpEZYRFWK | 5J4DGHz6qd9kvVBbRDkjCC3ByzuY3Hb2g6iPxpp2XHSZouH7oeV |
| mana | mana contract account | 122H3z8pc9z9xWpdirvsx1YsbTRwQHEEXu | 5JWoFuy6FVenZXrqhRx4kdCTL5qSUVTXqSeyHDDAwVpRQLZk6d7 |
| alice | alice account intialized with 50,000 tKoin | 1BrPkP7JhBwT4MuRDMWiiysGEu4XkyXuCH | 5Ht7axc5a2txMZyvpocix11bSnnhz7Wp8ggFCCNzT3QrdxPVmHc |
| bob | bob account intialized with 50,000 tKoin | 161DDwJNQyHqYJbP4C7Y8BTULrkjgC4U6g | 5KYr9D4RJuWHS4rYqfWit5MEQzQHCKxibrJ7UUtFDMnoocrhMoy |


## CLI
Local-Koinos comes with its own version of the Koinos CLI, it has been modified so that the basic token commands use the koin contract shipped with Local-Koinos.

```sh
# on Mac
./cli/osx/cli

# on Windows
./cli/win/cli.exe

# on Linux
./cli/linux.x64/cli
```

CLI examples:

```sh
# on Mac
./cli/osx/cli

🚫 🔐 > connect http://localhost:8080
Connected to endpoint http://localhost:8080

🔓 > open wallets/alice.wallet alice
Opened wallet: wallets/alice.wallet

🔐 > balance 161DDwJNQyHqYJbP4C7Y8BTULrkjgC4U6g
50000 tKOIN
50000 mana

🔓 > transfer 100 161DDwJNQyHqYJbP4C7Y8BTULrkjgC4U6g
Transferring 100 tKOIN to 161DDwJNQyHqYJbP4C7Y8BTULrkjgC4U6g
Transaction with ID 0x1220b5981a777745d31b7170eb33d0989469e5ae3e492ea2e1aef856c82c144d3c39 containing 1 operations submitted.
Mana cost: 0.61440525 (Disk: 0, Network: 315, Compute: 371166)

🔓 > balance 161DDwJNQyHqYJbP4C7Y8BTULrkjgC4U6g
50100 tKOIN
50100 mana
```
