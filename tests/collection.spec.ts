import { LocalKoinos } from "../lib/";
jest.setTimeout(600000);

let localKoinos = new LocalKoinos();

if (process.env.DEVCONTAINER === "true" && !process.env.CI) {
  localKoinos = new LocalKoinos({
    rpc: "http://host.docker.internal:8080",
    amqp: "amqp://host.docker.internal:5672",
  });
}

const [genesis, coll, acct1] = localKoinos.getAccounts();

beforeAll(async () => {
  // start local-koinos node
  await localKoinos.startNode();

  await localKoinos.startBlockProduction();
});

afterAll(() => {
  // stop local-koinos node
  localKoinos.stopNode();
});

test("collection", async () => {
  const collection = await localKoinos.deployCollectionContract(coll.wif);

  let res = await collection.functions.mint({
    to: acct1.address,
    number_tokens_to_mint: "1",
  });

  await res.transaction?.wait();

  const eventData = await collection.decodeEvent(res.receipt!.events[0]);

  expect(eventData.args.token_id).toStrictEqual("0x31");
  expect(eventData.args.to).toStrictEqual(acct1.address);

  res = await collection.functions.owner_of({
    token_id: "0x31",
  });

  expect(res.result?.value).toStrictEqual(acct1.address);
});
