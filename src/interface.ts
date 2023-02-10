import { Signer } from "koilib";

export interface Options {
  rpc?: string;
  amqp?: string;
  dockerComposeFile?: string;
  envFile?: string;
  nodeName?: string;
  mode?: 'manual' | 'interval' | 'auto';
  logs?: boolean;
  miningInterval?: boolean;
}

export interface Account {
  name: string;
  address: string;
  wif: string;
  signer: Signer;
}