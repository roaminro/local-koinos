import { Contract, Signer, utils } from 'koilib'
import fs from 'fs'
import path from 'path'
import { Options } from './interface'
import { DeployOptions, TransactionOptions } from 'koilib/lib/interface'

export class Token {
  contract: Contract
  signer: Signer

  constructor (id: string, signer: Signer) {
    this.contract = new Contract({
      id,
      abi: utils.tokenAbi,
      provider: signer.provider,
      signer,
      bytecode: fs.readFileSync(path.resolve(__dirname, '../system-contracts/koin.wasm'))
    })

    this.signer = signer
  }

  address () {
    return this.contract.getId()
  }

  deploy (options: DeployOptions | undefined = undefined) {
    return this.contract.deploy(options)
  }

  mint (to: string, value: string, options: TransactionOptions | undefined = undefined) {
    return this.contract.functions.mint({
      to,
      value
    }, options)
  }

  transfer (from: string, to: string, value: string, options: DeployOptions) {
    return this.contract.functions.transfer({
      from,
      to,
      value
    }, options)
  }

  async balanceOf (owner: string) {
    const { result } = await this.contract.functions.balanceOf({ owner })

    return result?.value as string
  }

  async decimals () {
    const { result } = await this.contract.functions.decimals()

    return result?.value as string
  }
}
