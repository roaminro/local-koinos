import { Provider, Signer, Contract, utils } from "koilib";
import { koinos } from "@koinos/proto-js";
import amqp from "amqplib";
import chalk from "chalk";
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";

import { sleep } from "./util";
import { Account, Options } from "./interface";
import { Token } from "./token";
import {
  Abi,
  BlockHeaderJson,
  BlockJson,
  DeployOptions,
  TransactionJson,
} from "koilib/lib/interface";

// @ts-ignore
import * as collectionAbi from "../dummy-contracts/collection.json";

// @ts-ignore koilib_types is needed when using koilib
collectionAbi.koilib_types = collectionAbi.types;

const DEFAULT_RPC_URL = "http://127.0.0.1:8080";
const DEFAULT_AMQP_URL = "amqp://guest:guest@127.0.0.1:5672/";
const KOINOS_AMQP_EXCHANGE = "koinos.event";

const DEFAULT_MINING_INTERVAL = 3000;

const DEFAULT_DOCKER_COMPOSE_FILE = path.resolve(
  __dirname,
  "..",
  "docker-compose.yml"
);
const DEFAULT_DOCKER_COMPOSE_ENV_FILE = path.resolve(__dirname, "..", ".env");

const GENESIS_WIF = "5KYPA63Gx4MxQUqDM3PMckvX9nVYDUaLigTKAsLPesTyGmKmbR2";
const KOIN_WIF = "5JbxDqUqx581iL9Po1mLvHMLkxnmjvypDdnmdLQvK5TzSpCFSgH";
const NAME_SERVICE_WIF = "5JkJUcpmegiTTjEGwgcfHCNzZ1JQw3xci2U3sTtdzuruggXjEQN";

const SET_RECORD_ENTRY = 0xe248c73a;
const GET_NAME_ENTRY = 0xe5070a16;
const GET_ADDRESS_ENTRY = 0xa61ae5e8;

const IS_WINDOWS = process.platform === "win32";

export class LocalKoinos {
  rpcUrl: string;
  amqpurl: string;
  dockerComposeFile: string;
  envFile: string;
  nodeName: string;
  provider: Provider;
  genesisSigner: Signer;
  koin: Token;
  nameService: Contract;
  stopping: boolean = false;
  intervalBlockProducerTimeout: NodeJS.Timeout | null = null;
  accounts: Account[] = [];

  constructor(options?: Options) {
    this.rpcUrl = options?.rpc || DEFAULT_RPC_URL;
    this.amqpurl = options?.amqp || DEFAULT_AMQP_URL;
    this.dockerComposeFile =
      options?.dockerComposeFile || DEFAULT_DOCKER_COMPOSE_FILE;
    this.envFile = options?.envFile || DEFAULT_DOCKER_COMPOSE_ENV_FILE;
    this.nodeName = options?.nodeName || "localkoinos";

    this.provider = new Provider(this.rpcUrl);

    this.genesisSigner = Signer.fromWif(GENESIS_WIF);
    this.genesisSigner.provider = this.provider;

    // Koin contract
    const koinSigner = Signer.fromWif(KOIN_WIF);
    koinSigner.provider = this.provider;
    this.koin = new Token(koinSigner.address, koinSigner, true);

    // NameService contract
    const nameServiceSigner = Signer.fromWif(NAME_SERVICE_WIF);
    nameServiceSigner.provider = this.provider;

    this.nameService = new Contract({
      id: nameServiceSigner.address,
      provider: this.provider,
      signer: nameServiceSigner,
      bytecode: fs.readFileSync(
        path.resolve(__dirname, "../system-contracts/", "name_service.wasm")
      ),
    });

    this.initAccounts();
  }

  initAccounts() {
    let name = "Genesis account";
    let signer = Signer.fromWif(GENESIS_WIF);
    signer.provider = this.provider;

    this.accounts.push({
      name,
      address: signer.address,
      wif: GENESIS_WIF,
      signer,
    });

    name = "Koin account";
    signer = Signer.fromWif(KOIN_WIF);
    signer.provider = this.provider;

    this.accounts.push({
      name,
      address: signer.address,
      wif: KOIN_WIF,
      signer,
    });

    for (let index = 1; index <= 10; index++) {
      name = `Account #${index}`;
      signer = Signer.fromSeed(name);
      signer.provider = this.provider;

      this.accounts.push({
        name,
        address: signer.address,
        wif: signer.getPrivateKey("wif", false),
        signer,
      });
    }
  }

  getAccounts() {
    return this.accounts;
  }

  getProvider() {
    return this.provider;
  }

  private executeCmd(cmd: string) {
    if (IS_WINDOWS) {
      spawnSync("cmd.exe", ["/c", cmd], { stdio: "inherit" });
    } else {
      spawnSync("bash", ["-c", cmd], { stdio: "inherit" });
    }
  }

  async startNode() {
    console.log(chalk.blue(`Starting node ${this.nodeName}...\n`));
    console.log(
      chalk.blue(`Node options:
    - Node name: ${this.nodeName}
    - RPC url: ${this.rpcUrl}
    - AMQP url: ${this.amqpurl}
    - Docker-Compose file: ${this.dockerComposeFile}
    - Env file: ${this.envFile}
    `)
    );

    const cmd = `docker-compose -p ${this.nodeName} -f ${this.dockerComposeFile} --env-file ${this.envFile} up -d`;
    console.log(chalk.blue(cmd));
    this.executeCmd(cmd);

    console.log(chalk.blue("Waiting for chain service to start...\n"));
    await this.awaitChain();

    console.log(
      chalk.green(`Node started, JSON-RPC server available at ${this.rpcUrl}\n`)
    );
  }

  stopNode() {
    this.stopping = true;
    console.log(chalk.blue(`Stopping node ${this.nodeName}...`));

    if (this.intervalBlockProducerTimeout) {
      clearTimeout(this.intervalBlockProducerTimeout);
    }

    const cmd = `docker-compose -p ${this.nodeName} -f ${this.dockerComposeFile} down -v`;
    console.log(chalk.blue(cmd));
    this.executeCmd(cmd);

    console.log(chalk.green("Node successfuly stopped"));
  }

  async awaitChain() {
    if (this.stopping === true) return;
    try {
      await this.provider.getHeadInfo();
    } catch (error) {
      await sleep(1000);
      await this.awaitChain();
    }
  }

  async produceBlock(args?: {
    transactions?: TransactionJson[];
    blockHeader?: BlockHeaderJson;
    logs?: boolean;
  }) {
    const transactions = args?.transactions;
    const blockHeader = args?.blockHeader;
    const logs = args?.logs === undefined || args?.logs === true;

    if (this.stopping === true) return;
    const headInfo = await this.provider.getHeadInfo();

    const finalBlock = {
      header: {
        height: headInfo.head_topology.height
          ? `${Number(headInfo.head_topology.height) + 1}`
          : "1",
        ...blockHeader,
      },
      transactions: [],
    } as BlockJson;

    if (transactions) {
      finalBlock.transactions?.push(...transactions);
    } else {
      // eslint-disable-next-line camelcase
      const { pending_transactions } = await this.provider.call<{
        pending_transactions: any;
      }>("mempool.get_pending_transactions", { limit: "500" });
      // eslint-disable-next-line camelcase
      finalBlock.transactions = pending_transactions
        ? pending_transactions.map((pendingTx: any) => pendingTx.transaction)
        : [];
    }

    const preparedBlock = await this.genesisSigner.prepareBlock(finalBlock);
    const signedBlock = await this.genesisSigner.signBlock(preparedBlock);
    const { receipt } = await this.provider.submitBlock(signedBlock);

    if (logs) {
      console.log(
        chalk.blue(
          `Produced block (${finalBlock.header?.height}) with ${
            finalBlock.transactions?.length
          } transaction(s) (disk_storage_used: ${
            (receipt as any).disk_storage_used | 0
          } / network_bandwidth_used: ${
            (receipt as any).network_bandwidth_used | 0
          } / compute_bandwidth_used: ${
            (receipt as any).compute_bandwidth_used | 0
          })`
        )
      );
    }

    return receipt;
  }

  async deployKoinContract(options?: Options) {
    const { transaction } = await this.koin.deploy();

    if (options?.mode === "manual") {
      await this.produceBlock({ logs: false });
    } else {
      await transaction!.wait();
    }

    console.log(
      chalk.green(`Deployed Koin contract at address ${this.koin.address()}\n`)
    );

    await this.setSystemContract(this.koin.address(), true, options);
  }

  async deployNameServiceContract(options?: Options) {
    const { transaction } = await this.nameService.deploy();

    if (options?.mode === "manual") {
      await this.produceBlock({ logs: false });
    } else {
      await transaction!.wait();
    }

    console.log(
      chalk.green(
        `Deployed name_service contract at address ${this.koin.address()}\n`
      )
    );

    await this.setSystemContract(this.nameService.getId(), true, options);

    await this.setSystemCall(
      koinos.chain.system_call_id.get_contract_name,
      this.nameService.getId(),
      GET_NAME_ENTRY,
      options
    );

    await this.setSystemCall(
      koinos.chain.system_call_id.get_contract_address,
      this.nameService.getId(),
      GET_ADDRESS_ENTRY,
      options
    );
  }

  async setNameServiceRecord(
    name: string,
    contractId: string,
    options?: Options
  ) {
    const operations = [
      {
        call_contract: {
          contract_id: this.nameService.getId(),
          entry_point: SET_RECORD_ENTRY,
          args: utils.encodeBase64url(
            koinos.contracts.name_service.set_record_arguments
              .encode({
                name,
                address: utils.decodeBase58(contractId),
              })
              .finish()
          ),
        },
      },
    ];

    const preparedTx = await this.genesisSigner.prepareTransaction({
      operations,
    });

    const { transaction } = await this.genesisSigner.sendTransaction(
      preparedTx
    );

    if (options?.mode === "manual") {
      await this.produceBlock({ logs: false });
    } else {
      await transaction.wait();
    }

    console.log(chalk.green(`Set name ${name} for contract ${contractId}\n`));
  }

  async getNamefromNameService(contractId: string) {
    const operation = {
      contract_id: this.nameService.getId(),
      entry_point: GET_NAME_ENTRY,
      args: utils.encodeBase64url(
        koinos.contracts.name_service.get_name_arguments
          .encode({
            address: utils.decodeBase58(contractId),
          })
          .finish()
      ),
    };

    const result = await this.provider.readContract(operation);
    const decodedResult = koinos.contracts.name_service.get_name_result.decode(
      utils.decodeBase64url(result.result)
    );

    return decodedResult.value?.name;
  }

  async getAddressfromNameService(name: string) {
    const operation = {
      contract_id: this.nameService.getId(),
      entry_point: GET_ADDRESS_ENTRY,
      args: utils.encodeBase64url(
        koinos.contracts.name_service.get_address_arguments
          .encode({
            name,
          })
          .finish()
      ),
    };

    const result = await this.provider.readContract(operation);
    const decodedResult =
      koinos.contracts.name_service.get_address_result.decode(
        utils.decodeBase64url(result.result)
      );

    return decodedResult.value?.address
      ? utils.encodeBase58(decodedResult.value.address)
      : "";
  }

  async setSystemContract(
    contractId: string,
    systemContract: boolean,
    options?: Options
  ) {
    const operations = [
      {
        set_system_contract: {
          contract_id: contractId,
          system_contract: systemContract,
        },
      },
    ];

    const preparedTx = await this.genesisSigner.prepareTransaction({
      operations,
    });

    const { transaction } = await this.genesisSigner.sendTransaction(
      preparedTx
    );

    if (options?.mode === "manual") {
      await this.produceBlock({ logs: false });
    } else {
      await transaction.wait();
    }

    console.log(
      chalk.green(
        `Set system contract for ${this.koin.address()} to ${systemContract}\n`
      )
    );
  }

  async setSystemCall(
    callId: number,
    contractId: string,
    entryPoint: number,
    options?: Options
  ) {
    const operations = [
      {
        set_system_call: {
          call_id: callId,
          target: {
            system_call_bundle: {
              contract_id: contractId,
              entry_point: entryPoint,
            },
          },
        },
      },
    ];

    const preparedTx = await this.genesisSigner.prepareTransaction({
      operations,
    });

    const { transaction } = await this.genesisSigner.sendTransaction(
      preparedTx
    );

    if (options?.mode === "manual") {
      await this.produceBlock({ logs: false });
    } else {
      await transaction.wait();
    }

    console.log(
      chalk.green(
        `Set system call for ${callId} to contract ${contractId} / entrypoint ${entryPoint}\n`
      )
    );
  }

  async deployTokenContract(wif: string) {
    const signer = Signer.fromWif(wif);
    signer.provider = this.provider;

    const token = new Token(signer.address, signer);

    const { transaction } = await token.deploy();

    await transaction!.wait();

    console.log(
      chalk.green(`\nDeployed Token contract at address ${token.address()}\n`)
    );

    return token;
  }

  async deployCollectionContract(wif: string) {
    const signer = Signer.fromWif(wif);
    signer.provider = this.provider;

    const bytecode = fs.readFileSync(
      path.resolve(__dirname, "../dummy-contracts/collection.wasm")
    );

    const contract = new Contract({
      id: signer.address,
      // @ts-ignore koilib_types is needed when using koilib
      abi: collectionAbi,
      provider: signer.provider,
      signer,
      bytecode,
    });

    const { transaction } = await contract.deploy();

    await transaction!.wait();

    console.log(
      chalk.green(
        `\nDeployed Collection contract at address ${contract.getId()}\n`
      )
    );

    return contract;
  }

  async mintKoinDefaultAccounts(options?: Options) {
    const decimals = await this.koin.decimals();
    const value = 50000 * 10 ** decimals;

    const operations = [];

    for (let index = 0; index < this.accounts.length; index++) {
      const acct = this.accounts[index];

      const { operation } = await this.koin.mint(
        acct.address,
        value.toString(),
        { sendTransaction: false, signTransaction: false }
      );
      operations.push(operation);
    }

    const preparedTx = await this.koin.signer.prepareTransaction({
      operations,
    });

    const { transaction } = await this.koin.signer.sendTransaction(preparedTx);

    if (options?.mode === "manual") {
      await this.produceBlock({ logs: false });
    } else {
      await transaction.wait();
    }

    console.log(chalk.green("\nAccounts:"));
    console.log(chalk.green("=========\n"));
    for (let index = 0; index < this.accounts.length; index++) {
      const acct = this.accounts[index];
      const balance = await this.koin.balanceOf(acct.address);

      console.log(
        chalk.green(
          `${acct.name}:   ${acct.address} (${
            Number(balance) / 10 ** decimals
          } tKOIN)`
        )
      );
      console.log(chalk.green(`Private Key:  ${acct.wif}\n`));
    }
    console.log("");
  }

  async mintToken(wif: string, to: string, value: string) {
    const signer = Signer.fromWif(wif);
    signer.provider = this.provider;

    const token = new Token(signer.address, signer);
    const decimals = await token.decimals();

    const { transaction } = await token.mint(
      to,
      (Number(value) * 10 ** decimals).toString()
    );

    await transaction?.wait();

    console.log(
      chalk.green(`Minted ${value} tokens (${token.address()}) to ${to}\n`)
    );
  }

  async deployContract(
    wif: string,
    wasm: string | Buffer,
    abi: Abi,
    options?: Options,
    deployOptions?: DeployOptions
  ) {
    const signer = Signer.fromWif(wif);
    signer.provider = this.provider;

    const bytecode = typeof wasm === "string" ? fs.readFileSync(wasm) : wasm;

    const contract = new Contract({
      id: signer.address,
      abi,
      provider: this.provider,
      signer,
      bytecode,
    });

    const { transaction } = await contract.deploy(deployOptions);

    if (options?.mode === "manual") {
      await this.produceBlock({ logs: false });
    } else {
      await transaction!.wait();
    }

    console.log(
      chalk.green(`Deployed contract at address ${signer.address}\n`)
    );

    return contract;
  }

  async intervalBlockProducer(interval: number, logs = true) {
    await this.produceBlock({ logs: false });
    this.intervalBlockProducerTimeout = setTimeout(
      () => this.intervalBlockProducer(interval, logs),
      interval
    );
  }

  async autoBlockProducer(logs = true) {
    console.log(chalk.green("Starting auto block production...\n"));

    const connection = await amqp.connect(this.amqpurl);
    const channel = await connection.createChannel();

    channel.assertExchange(KOINOS_AMQP_EXCHANGE, "topic", { durable: true });

    const q1 = await channel.assertQueue("", { exclusive: true });
    channel.bindQueue(q1.queue, KOINOS_AMQP_EXCHANGE, "koinos.mempool.accept");
    channel.consume(
      q1.queue,
      async () => {
        await this.produceBlock({ logs: false });
      },
      {
        noAck: true,
      }
    );
  }

  async awaitNewBlocks() {
    const connection = await amqp.connect(this.amqpurl);
    const channel = await connection.createChannel();

    channel.assertExchange(KOINOS_AMQP_EXCHANGE, "topic", { durable: true });

    const q1 = await channel.assertQueue("", { exclusive: true });
    channel.bindQueue(q1.queue, KOINOS_AMQP_EXCHANGE, "koinos.block.accept");
    channel.consume(
      q1.queue,
      async (msg) => {
        if (msg) {
          const acceptedBlock = koinos.broadcast.block_accepted.decode(
            msg.content
          );
          console.log(
            chalk.blue(
              `Produced block (${acceptedBlock.block?.header?.height}) with ${
                acceptedBlock.receipt?.transaction_receipts?.length
              } transaction(s) (disk_storage_used: ${
                acceptedBlock.receipt?.disk_storage_used | 0
              } / network_bandwidth_used: ${
                acceptedBlock.receipt?.network_bandwidth_used | 0
              } / compute_bandwidth_used: ${
                acceptedBlock.receipt?.compute_bandwidth_used | 0
              })`
            )
          );
        }
      },
      {
        noAck: true,
      }
    );

    console.log(chalk.green("Waiting for new blocks to be produced...\n"));
  }

  async startBlockProduction(options?: Options) {
    const logs = options?.logs === true;
    const mode = options?.mode || "auto";

    if (mode === "auto") {
      await this.autoBlockProducer(logs);
    } else if (mode === "interval") {
      const interval = Number(
        options?.miningInterval || DEFAULT_MINING_INTERVAL
      );
      console.log(
        chalk.green(
          `Starting interval block production (new block every ${interval}ms)...\n`
        )
      );
      await this.intervalBlockProducer(interval, logs);
    } else {
      await this.awaitNewBlocks();
    }
  }

  async restartChain() {
    const cmd = `docker restart ${this.nodeName}_chain_1`;
    console.log(chalk.blue(cmd));
    this.executeCmd(cmd);

    console.log(chalk.green("Chain was successfully restarted\n"));
  }
}
