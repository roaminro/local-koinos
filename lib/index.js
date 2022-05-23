"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Token = exports.LocalKoinos = void 0;
var localKoinos_1 = require("./localKoinos");
Object.defineProperty(exports, "LocalKoinos", { enumerable: true, get: function () { return localKoinos_1.LocalKoinos; } });
var token_1 = require("./token");
Object.defineProperty(exports, "Token", { enumerable: true, get: function () { return token_1.Token; } });
__exportStar(require("koilib"), exports);
//# sourceMappingURL=index.js.map