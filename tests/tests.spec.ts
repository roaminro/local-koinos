import { LocalKoinos, Token, Signer } from '../lib';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore 
import * as abi from './calculator-abi.json';

// @ts-ignore koilib_types is needed when using koilib
abi.koilib_types = abi.types

jest.setTimeout(600000);

let localKoinos = new LocalKoinos();

if (process.env.ENV === 'LOCAL') {
  localKoinos = new LocalKoinos({
    rpc: 'http://host.docker.internal:8080',
    amqp: 'amqp://host.docker.internal:5672'
  });
}

beforeAll(async () => {
  // start local-koinos node
  await localKoinos.startNode();
  await localKoinos.startBlockProduction();

  await localKoinos.deployKoinContract();
  await localKoinos.mintKoinDefaultAccounts();
  await localKoinos.deployNameServiceContract();  
});

afterAll(async () => {
  // stop local-koinos node
  await localKoinos.stopNode();
});

test("test1", async () => {
  const [genesis, koin, acct1, tokenAcct, acct2] = localKoinos.getAccounts();

  // @ts-ignore abi provided here is compatible with Koilib
  const contract = await localKoinos.deployContract(acct1.wif, './tests/calculator-contract.wasm', abi);

  let result = await contract.functions.add({ x: '4', y: '5' });
  expect(result.result!.value).toBe('9');

  const signer = Signer.fromWif('L59UtJcTdNBnrH2QSBA5beSUhRufRu3g6tScDTite6Msuj7U93tM');
  signer.provider = localKoinos.getProvider();
  let tkn = new Token(localKoinos.koin.address(), signer);

  try {
    await tkn.mint(signer.address, 40);
  } catch (error) {
    // @ts-ignore
    expect(error.message).toContain('can only mint token with contract authority');
  }

  try {
    const signer2 = Signer.fromWif('5KL5GNq42Syr52dUUi4UhQ5cANwNr9xgxKivF9YjtGdM7BBjuks');
    signer2.provider = localKoinos.getProvider();
    tkn = new Token(localKoinos.koin.address(), signer2);

    const { transaction, receipt } = await tkn.transfer(signer2.address, signer.address, 40000000000000000);
    await transaction!.wait();
  } catch (error) {
    // @ts-ignore
    expect(error.message).toContain("account 'from' has insufficient balance");
  }

  let token = await localKoinos.deployTokenContract(tokenAcct.wif);
  result = await token.mint(acct2.address, 10);
  await result.transaction!.wait();

  let balance = await token.balanceOf(acct2.address);
  expect(balance).toStrictEqual('10')

  let totalSupply = await token.totalSupply();
  expect(totalSupply).toStrictEqual('10')

  token = new Token(tokenAcct.address, acct2.signer)

  result = await token.burn(acct2.address, 10);
  await result.transaction!.wait();

  balance = await token.balanceOf(acct2.address);
  expect(balance).toStrictEqual('0')

  totalSupply = await token.totalSupply();
  expect(totalSupply).toStrictEqual(undefined)

  await localKoinos.setNameServiceRecord('koin', koin.address);

  const koinAddress = await localKoinos.getAddressfromNameService('koin');
  expect(koinAddress).toStrictEqual(koin.address)

  const koinContractName = await localKoinos.getNamefromNameService(koin.address);
  expect(koinContractName).toStrictEqual('koin')
});
