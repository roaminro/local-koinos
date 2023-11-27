import { LocalKoinos, Token, Signer, Contract } from "../lib";
import fs from "fs";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as abi from "./calculator-abi.json";
import { TransactionJson } from "koilib/lib/interface";

// @ts-ignore koilib_types is needed when using koilib
abi.koilib_types = abi.types;

jest.setTimeout(600000);

let localKoinos = new LocalKoinos();

if (process.env.DEVCONTAINER === "true") {
  localKoinos = new LocalKoinos({
    rpc: "http://host.docker.internal:8080",
    amqp: "amqp://host.docker.internal:5672",
  });
}

beforeAll(async () => {
  // start local-koinos node
  await localKoinos.startNode();
});

afterAll(async () => {
  // stop local-koinos node
  await localKoinos.stopNode();
});

test("test1", async () => {
  const [genesis, koin, acct1, acct2] = localKoinos.getAccounts();

  const contract = new Contract({
    id: acct1.address,
    provider: localKoinos.provider,
    // @ts-ignore abi provided here is compatible with Koilib
    abi,
    signer: acct1.signer,
    bytecode: fs.readFileSync("./tests/calculator-contract.wasm"),
  });

  const tx = await contract.deploy({
    sendTransaction: false,
  });

  const now = new Date().getTime().toString();

  await localKoinos.produceBlock({
    transactions: [tx.transaction as TransactionJson],
    blockHeader: {
      timestamp: now,
    },
  });

  let result = await contract.functions.add({ x: "4", y: "5" });
  expect(result.result!.value).toBe("9");

  const headInfo = await localKoinos.provider.getHeadInfo();
  expect(headInfo.head_block_time).toBe(now);

  // @ts-ignore abi provided here is compatible with Koilib
  const contract2 = await localKoinos.deployContract(
    acct2.wif,
    "./tests/calculator-contract.wasm",
    // @ts-ignore koilib_types is needed when using koilib
    abi,
    { mode: "manual" }
  );
  result = await contract2.functions.add({ x: "4", y: "5" });
  expect(result.result!.value).toBe("9");
});
