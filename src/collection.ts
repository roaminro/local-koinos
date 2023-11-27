import { Contract, Signer } from "koilib";
import fs from "fs";
import path from "path";
import {
  DeployOptions,
  ContractTransactionOptions,
  OperationJson,
  TransactionJsonWait,
  TransactionReceipt,
} from "koilib/lib/interface";
// @ts-ignore
import * as abi from "../dummy-contracts/collection.json";

// @ts-ignore koilib_types is needed when using koilib
abi.koilib_types = abi.types;

export class Collection {
  contract: Contract;
  signer: Signer;

  public get functions(): {
    [x: string]: <T = Record<string, any>>(
      args?: any,
      opts?: ContractTransactionOptions | undefined
    ) => Promise<{
      operation: OperationJson;
      transaction?: TransactionJsonWait | undefined;
      result?: T | undefined;
      receipt?: TransactionReceipt | undefined;
    }>;
  } {
    return this.contract.functions;
  }

  constructor(id: string, signer: Signer) {
    const bytecode = fs.readFileSync(
      path.resolve(__dirname, "../dummy-contracts/collection.wasm")
    );

    this.contract = new Contract({
      id,
      abi,
      provider: signer.provider,
      signer,
      bytecode,
    });

    this.signer = signer;
  }

  address() {
    return this.contract.getId();
  }

  deploy(options?: DeployOptions) {
    return this.contract.deploy(options);
  }
}
