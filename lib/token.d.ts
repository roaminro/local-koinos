import { Contract, Signer } from 'koilib';
import { DeployOptions, TransactionOptions } from 'koilib/lib/interface';
export declare class Token {
    contract: Contract;
    signer: Signer;
    constructor(id: string, signer: Signer);
    address(): string;
    deploy(options?: DeployOptions | undefined): Promise<{
        operation: import("koilib/lib/interface").UploadContractOperationNested;
        transaction: import("koilib/lib/interface").TransactionJsonWait;
        receipt?: import("koilib/lib/interface").TransactionReceipt | undefined;
    }>;
    mint(to: string, value: string, options?: TransactionOptions | undefined): Promise<{
        operation: import("koilib/lib/interface").OperationJson;
        transaction?: import("koilib/lib/interface").TransactionJsonWait | undefined;
        result?: Record<string, unknown> | undefined;
        receipt?: import("koilib/lib/interface").TransactionReceipt | undefined;
    }>;
    transfer(from: string, to: string, value: string, options: DeployOptions): Promise<{
        operation: import("koilib/lib/interface").OperationJson;
        transaction?: import("koilib/lib/interface").TransactionJsonWait | undefined;
        result?: Record<string, unknown> | undefined;
        receipt?: import("koilib/lib/interface").TransactionReceipt | undefined;
    }>;
    balanceOf(owner: string): Promise<string>;
    decimals(): Promise<string>;
}
