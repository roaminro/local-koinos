"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = void 0;
const sleep = (milliseconds) => new Promise((resolve, reject) => setTimeout(() => resolve(), milliseconds));
exports.sleep = sleep;
//# sourceMappingURL=util.js.map