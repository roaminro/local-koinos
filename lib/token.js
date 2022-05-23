"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Token = void 0;
const koilib_1 = require("koilib");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class Token {
    constructor(id, signer) {
        this.contract = new koilib_1.Contract({
            id,
            abi: koilib_1.utils.tokenAbi,
            provider: signer.provider,
            signer,
            bytecode: fs_1.default.readFileSync(path_1.default.resolve(__dirname, '../system-contracts/koin.wasm'))
        });
        this.signer = signer;
    }
    address() {
        return this.contract.getId();
    }
    deploy(options = undefined) {
        return this.contract.deploy(options);
    }
    mint(to, value, options = undefined) {
        return this.contract.functions.mint({
            to,
            value
        }, options);
    }
    transfer(from, to, value, options) {
        return this.contract.functions.transfer({
            from,
            to,
            value
        }, options);
    }
    async balanceOf(owner) {
        const { result } = await this.contract.functions.balanceOf({ owner });
        return result?.value;
    }
    async decimals() {
        const { result } = await this.contract.functions.decimals();
        return result?.value;
    }
}
exports.Token = Token;
//# sourceMappingURL=token.js.map