/// <reference types="node" />
import { Provider, Signer, Contract } from "koilib";
import { Account, Options } from "./interface";
import { Token } from "./token";
import { Abi, DeployOptions, TransactionJson } from "koilib/lib/interface";
export declare class LocalKoinos {
    rpcUrl: string;
    amqpurl: string;
    dockerComposeFile: string;
    envFile: string;
    nodeName: string;
    provider: Provider;
    genesisSigner: Signer;
    koin: Token;
    stopping: boolean;
    intervalBlockProducerTimeout: NodeJS.Timeout | null;
    accounts: Account[];
    constructor(options: Options);
    initAccounts(): void;
    getAccounts(): Account[];
    getProvider(): Provider;
    startNode(): Promise<void>;
    stopNode(): void;
    awaitChain(): Promise<void>;
    produceBlock(transactions: TransactionJson | null, logs?: boolean): Promise<undefined>;
    deployKoinContract(options: Options): Promise<void>;
    deployTokenContract(wif: string): Promise<void>;
    mintKoinDefaultAccounts(options: Options): Promise<void>;
    mintToken(wif: string, to: string, value: string): Promise<void>;
    deployContract(wif: string, wasm: string | Buffer, abi: Abi, options: DeployOptions): Promise<Contract>;
    intervalBlockProducer(interval: number, logs: boolean): Promise<void>;
    autoBlockProducer(logs: boolean): Promise<void>;
    awaitNewBlocks(): Promise<void>;
    startBlockProduction(options: Options): Promise<void>;
    restartChain(): Promise<void>;
}
