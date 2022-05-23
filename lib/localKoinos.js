"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalKoinos = void 0;
const koilib_1 = require("koilib");
const koinos_proto_js_1 = require("koinos-proto-js");
const amqplib_1 = __importDefault(require("amqplib"));
const chalk_1 = __importDefault(require("chalk"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const util_1 = require("./util");
const token_1 = require("./token");
// @ts-ignore
const package_json_1 = __importDefault(require("../package.json"));
const DEFAULT_RPC_URL = 'http://127.0.0.1:8080';
const DEFAULT_AMQP_URL = 'amqp://guest:guest@localhost:5672/';
const KOINOS_AMQP_EXCHANGE = 'koinos.event';
const DEFAULT_MINING_INTERVAL = 3000;
const DEFAULT_DOCKER_COMPOSE_FILE = path_1.default.resolve(__dirname, '../docker-compose.yml');
const DEFAULT_DOCKER_COMPOSE_ENV_FILE = path_1.default.resolve(__dirname, '../.env');
const GENESIS_WIF = '5KYPA63Gx4MxQUqDM3PMckvX9nVYDUaLigTKAsLPesTyGmKmbR2';
const KOIN_WIF = '5JbxDqUqx581iL9Po1mLvHMLkxnmjvypDdnmdLQvK5TzSpCFSgH';
class LocalKoinos {
    constructor(options) {
        this.stopping = false;
        this.intervalBlockProducerTimeout = null;
        this.accounts = [];
        this.rpcUrl = options?.rpc || DEFAULT_RPC_URL;
        this.amqpurl = options?.amqp || DEFAULT_AMQP_URL;
        this.dockerComposeFile = options?.dockerComposeFile || DEFAULT_DOCKER_COMPOSE_FILE;
        this.envFile = options?.envFile || DEFAULT_DOCKER_COMPOSE_ENV_FILE;
        this.nodeName = options?.nodeName || package_json_1.default.name;
        this.provider = new koilib_1.Provider(this.rpcUrl);
        this.genesisSigner = koilib_1.Signer.fromWif(GENESIS_WIF);
        this.genesisSigner.provider = this.provider;
        // Koin contract
        const koinSigner = koilib_1.Signer.fromWif(KOIN_WIF);
        koinSigner.provider = this.provider;
        this.koin = new token_1.Token(koinSigner.address, koinSigner);
        this.initAccounts();
    }
    initAccounts() {
        let name = 'Genesis account';
        let signer = koilib_1.Signer.fromWif(GENESIS_WIF);
        this.accounts.push({
            name,
            address: signer.address,
            wif: GENESIS_WIF,
            signer
        });
        name = 'Koin account';
        signer = koilib_1.Signer.fromWif(KOIN_WIF);
        this.accounts.push({
            name,
            address: signer.address,
            wif: KOIN_WIF,
            signer
        });
        for (let index = 1; index <= 10; index++) {
            name = `Account #${index}`;
            signer = koilib_1.Signer.fromSeed(name);
            this.accounts.push({
                name,
                address: signer.address,
                wif: signer.getPrivateKey('wif', false),
                signer
            });
        }
    }
    getAccounts() {
        return this.accounts;
    }
    getProvider() {
        return this.provider;
    }
    async startNode() {
        console.log(chalk_1.default.blue(`Starting node ${this.nodeName}...\n`));
        const cmd = `docker-compose -p ${this.nodeName} -f ${this.dockerComposeFile} --env-file ${this.envFile} up -d`;
        console.log(chalk_1.default.blue(cmd));
        (0, child_process_1.execSync)(cmd, { stdio: 'inherit' });
        console.log(chalk_1.default.blue('Waiting for chain service to start...\n'));
        await this.awaitChain();
        console.log(chalk_1.default.green(`Node started, JSON-RPC server available at ${this.rpcUrl}\n`));
    }
    stopNode() {
        this.stopping = true;
        console.log(chalk_1.default.blue(`Stopping node ${this.nodeName}...`));
        if (this.intervalBlockProducerTimeout) {
            clearTimeout(this.intervalBlockProducerTimeout);
        }
        const cmd = `docker-compose -p ${this.nodeName} -f ${this.dockerComposeFile} down -v`;
        console.log(chalk_1.default.blue(cmd));
        (0, child_process_1.execSync)(cmd, { stdio: 'inherit' });
        console.log(chalk_1.default.green('Node successfuly stopped'));
    }
    async awaitChain() {
        if (this.stopping === true)
            return;
        try {
            await this.provider.getHeadInfo();
        }
        catch (error) {
            await (0, util_1.sleep)(1000);
            await this.awaitChain();
        }
    }
    async produceBlock(transactions, logs = true) {
        if (this.stopping === true)
            return;
        const headInfo = await this.provider.getHeadInfo();
        const block = {
            header: {
                height: headInfo.head_topology.height ? `${Number(headInfo.head_topology.height) + 1}` : '1'
            },
            transactions: []
        };
        if (transactions) {
            block.transactions?.push(transactions);
        }
        else {
            // eslint-disable-next-line camelcase
            const { pending_transactions } = await this.provider.call('mempool.get_pending_transactions', { limit: '500' });
            // eslint-disable-next-line camelcase
            block.transactions = pending_transactions ? pending_transactions.map((pendingTx) => pendingTx.transaction) : [];
        }
        const preparedBlock = await this.genesisSigner.prepareBlock(block);
        const signedBlock = await this.genesisSigner.signBlock(preparedBlock);
        const { receipt } = await this.provider.submitBlock(signedBlock);
        if (logs) {
            console.log(chalk_1.default.blue(`Produced block (${block.header?.height}) with ${block.transactions?.length} transaction(s) (disk_storage_used: ${receipt.disk_storage_used | 0} / network_bandwidth_used: ${receipt.network_bandwidth_used | 0} / compute_bandwidth_used: ${receipt.compute_bandwidth_used | 0})`));
        }
        return receipt;
    }
    async deployKoinContract(options) {
        const { transaction } = await this.koin.deploy();
        if (options?.mode === 'manual') {
            await this.produceBlock(null, false);
        }
        else {
            await transaction.wait();
        }
        console.log(chalk_1.default.green(`Deployed Koin contract at address ${this.koin.address()}\n`));
    }
    async deployTokenContract(wif) {
        const signer = koilib_1.Signer.fromWif(wif);
        signer.provider = this.provider;
        const token = new token_1.Token(signer.address, signer);
        const { transaction } = await token.deploy();
        await transaction.wait();
        console.log(chalk_1.default.green(`\nDeployed Token contract at address ${token.address()}\n`));
    }
    async mintKoinDefaultAccounts(options) {
        const decimals = await this.koin.decimals();
        const value = 50000 * 10 ** Number(decimals);
        const operations = [];
        for (let index = 0; index < this.accounts.length; index++) {
            const acct = this.accounts[index];
            const { operation } = await this.koin.mint(acct.address, value.toString(), { sendTransaction: false, signTransaction: false });
            operations.push(operation);
        }
        const preparedTx = await this.koin.signer.prepareTransaction({
            operations
        });
        const { transaction } = await this.koin.signer.sendTransaction(preparedTx);
        if (options?.mode === 'manual') {
            await this.produceBlock(null, false);
        }
        else {
            await transaction.wait();
        }
        console.log(chalk_1.default.green('\nAccounts:'));
        console.log(chalk_1.default.green('=========\n'));
        for (let index = 0; index < this.accounts.length; index++) {
            const acct = this.accounts[index];
            const balance = await this.koin.balanceOf(acct.address);
            console.log(chalk_1.default.green(`${acct.name}:   ${acct.address} (${Number(balance) / 10 ** Number(decimals)} tKOIN)`));
            console.log(chalk_1.default.green(`Private Key:  ${acct.wif}\n`));
        }
        console.log();
    }
    async mintToken(wif, to, value) {
        const signer = koilib_1.Signer.fromWif(wif);
        signer.provider = this.provider;
        const token = new token_1.Token(signer.address, signer);
        const decimals = await token.decimals();
        const { transaction } = await token.mint(to, (Number(value) * 10 ** Number(decimals)).toString());
        await transaction?.wait();
        console.log(chalk_1.default.green(`Minted ${value} tokens (${token.address()}) to ${to}\n`));
    }
    async deployContract(wif, wasm, abi, options) {
        const signer = koilib_1.Signer.fromWif(wif);
        signer.provider = this.provider;
        const bytecode = typeof wasm === 'string' ? fs_1.default.readFileSync(wasm) : wasm;
        const contract = new koilib_1.Contract({
            id: signer.address,
            abi,
            provider: this.provider,
            signer,
            bytecode
        });
        const { transaction } = await contract.deploy(options);
        await transaction.wait();
        console.log(chalk_1.default.green(`Deployed contract at address ${signer.address}\n`));
        return contract;
    }
    async intervalBlockProducer(interval, logs) {
        await this.produceBlock(null, logs);
        this.intervalBlockProducerTimeout = setTimeout(() => this.intervalBlockProducer(interval, logs), interval);
    }
    async autoBlockProducer(logs) {
        console.log(chalk_1.default.green('Starting auto block production...\n'));
        const connection = await amqplib_1.default.connect(this.amqpurl);
        const channel = await connection.createChannel();
        channel.assertExchange(KOINOS_AMQP_EXCHANGE, 'topic', { durable: true });
        const q1 = await channel.assertQueue('', { exclusive: true });
        channel.bindQueue(q1.queue, KOINOS_AMQP_EXCHANGE, 'koinos.mempool.accept');
        channel.consume(q1.queue, async () => {
            await this.produceBlock(null, logs);
        }, {
            noAck: true
        });
    }
    async awaitNewBlocks() {
        const connection = await amqplib_1.default.connect(this.amqpurl);
        const channel = await connection.createChannel();
        channel.assertExchange(KOINOS_AMQP_EXCHANGE, 'topic', { durable: true });
        const q1 = await channel.assertQueue('', { exclusive: true });
        channel.bindQueue(q1.queue, KOINOS_AMQP_EXCHANGE, 'koinos.block.accept');
        channel.consume(q1.queue, async (msg) => {
            if (msg) {
                const acceptedBlock = koinos_proto_js_1.koinos.broadcast.block_accepted.decode(msg.content);
                console.log(chalk_1.default.blue(`Produced block (${acceptedBlock.block?.header?.height}) with ${acceptedBlock.receipt?.transaction_receipts?.length} transaction(s) (disk_storage_used: ${acceptedBlock.receipt?.disk_storage_used | 0} / network_bandwidth_used: ${acceptedBlock.receipt?.network_bandwidth_used | 0} / compute_bandwidth_used: ${acceptedBlock.receipt?.compute_bandwidth_used | 0})`));
            }
        }, {
            noAck: true
        });
        console.log(chalk_1.default.green('Waiting for new blocks to be produced...\n'));
    }
    async startBlockProduction(options) {
        const logs = options?.logs === true;
        const mode = options?.mode || 'auto';
        if (mode === 'auto') {
            await this.autoBlockProducer(logs);
        }
        else if (mode === 'interval') {
            const interval = Number(options.miningInterval || DEFAULT_MINING_INTERVAL);
            console.log(chalk_1.default.green(`Starting interval block production (new block every ${interval}ms)...\n`));
            await this.intervalBlockProducer(interval, logs);
        }
        else {
            await this.awaitNewBlocks();
        }
    }
    async restartChain() {
        const cmd = `docker restart ${this.nodeName}_chain_1`;
        console.log(chalk_1.default.blue(cmd));
        (0, child_process_1.execSync)(cmd, { stdio: 'inherit' });
        console.log(chalk_1.default.green('Chain was successfully restarted\n'));
    }
}
exports.LocalKoinos = LocalKoinos;
//# sourceMappingURL=localKoinos.js.map