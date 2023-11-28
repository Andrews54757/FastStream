/* eslint-disable */
/*!
* ONNX Runtime Web v1.16.0
* Copyright (c) Microsoft Corporation. All rights reserved.
* Licensed under the MIT License.
*/
let ort;
(function webpackUniversalModuleDefinition(root, factory) {
	ort = factory();
})(self, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({
/***/ "./lib/backend-wasm.ts":
/*!*****************************!*\
  !*** ./lib/backend-wasm.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.wasmBackend = exports.initializeFlags = void 0;
const onnxruntime_common_1 = __webpack_require__(/*! onnxruntime-common */ "../common/dist/cjs/index.js");
const os_1 = __webpack_require__(/*! os */ "?0757");
const proxy_wrapper_1 = __webpack_require__(/*! ./wasm/proxy-wrapper */ "./lib/wasm/proxy-wrapper.ts");
const session_handler_1 = __webpack_require__(/*! ./wasm/session-handler */ "./lib/wasm/session-handler.ts");
/**
 * This function initializes all flags for WebAssembly.
 *
 * Those flags are accessible from `ort.env.wasm`. Users are allow to set those flags before the first inference session
 * being created, to override default value.
 */
const initializeFlags = () => {
    if (typeof onnxruntime_common_1.env.wasm.initTimeout !== 'number' || onnxruntime_common_1.env.wasm.initTimeout < 0) {
        onnxruntime_common_1.env.wasm.initTimeout = 0;
    }
    if (typeof onnxruntime_common_1.env.wasm.simd !== 'boolean') {
        onnxruntime_common_1.env.wasm.simd = true;
    }
    if (typeof onnxruntime_common_1.env.wasm.proxy !== 'boolean') {
        onnxruntime_common_1.env.wasm.proxy = false;
    }
    if (typeof onnxruntime_common_1.env.wasm.numThreads !== 'number' || !Number.isInteger(onnxruntime_common_1.env.wasm.numThreads) || onnxruntime_common_1.env.wasm.numThreads <= 0) {
        const numCpuLogicalCores = typeof navigator === 'undefined' ? (0, os_1.cpus)().length : navigator.hardwareConcurrency;
        onnxruntime_common_1.env.wasm.numThreads = Math.min(4, Math.ceil((numCpuLogicalCores || 1) / 2));
    }
};
exports.initializeFlags = initializeFlags;
class OnnxruntimeWebAssemblyBackend {
    async init() {
        // populate wasm flags
        (0, exports.initializeFlags)();
        // init wasm
        await (0, proxy_wrapper_1.initializeWebAssemblyInstance)();
    }
    async createSessionHandler(pathOrBuffer, options) {
        const handler = new session_handler_1.OnnxruntimeWebAssemblySessionHandler();
        await handler.loadModel(pathOrBuffer, options);
        return Promise.resolve(handler);
    }
}
exports.wasmBackend = new OnnxruntimeWebAssemblyBackend();
/***/ }),
/***/ "./lib/index.ts":
/*!**********************!*\
  !*** ./lib/index.ts ***!
  \**********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
Object.defineProperty(exports, "__esModule", ({ value: true }));
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
// We use "require" instead of "import" here because import statement must be put in top level. Our current code does
// not allow terser to tree-shaking code as expected because some codes are treated as having side effects.
// So we import code inside the if-clause to allow terser remove the code safely.
__exportStar(__webpack_require__(/*! onnxruntime-common */ "../common/dist/cjs/index.js"), exports);
const onnxruntime_common_1 = __webpack_require__(/*! onnxruntime-common */ "../common/dist/cjs/index.js");
const version_1 = __webpack_require__(/*! ./version */ "./lib/version.ts");
if (false) {}
if (true) {
    const wasmBackend = (__webpack_require__(/*! ./backend-wasm */ "./lib/backend-wasm.ts").wasmBackend);
    if (false) {}
    (0, onnxruntime_common_1.registerBackend)('cpu', wasmBackend, 10);
    (0, onnxruntime_common_1.registerBackend)('wasm', wasmBackend, 10);
    (0, onnxruntime_common_1.registerBackend)('xnnpack', wasmBackend, 9);
    (0, onnxruntime_common_1.registerBackend)('webnn', wasmBackend, 9);
}
Object.defineProperty(onnxruntime_common_1.env.versions, 'web', { value: version_1.version, enumerable: true });
/***/ }),
/***/ "./lib/version.ts":
/*!************************!*\
  !*** ./lib/version.ts ***!
  \************************/
/***/ ((__unused_webpack_module, exports) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.version = void 0;
// This file is generated by /js/scripts/update-version.ts
// Do not modify file content manually.
exports.version = '1.16.0';
/***/ }),
/***/ "./lib/wasm/proxy-wrapper.ts":
/*!***********************************!*\
  !*** ./lib/wasm/proxy-wrapper.ts ***!
  \***********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.endProfiling = exports.run = exports.releaseSession = exports.createSession = exports.createSessionFinalize = exports.createSessionAllocate = exports.initializeRuntime = exports.initializeWebAssemblyInstance = void 0;
const onnxruntime_common_1 = __webpack_require__(/*! onnxruntime-common */ "../common/dist/cjs/index.js");
const core = __importStar(__webpack_require__(/*! ./wasm-core-impl */ "./lib/wasm/wasm-core-impl.ts"));
const wasm_factory_1 = __webpack_require__(/*! ./wasm-factory */ "./lib/wasm/wasm-factory.ts");
const isProxy = () => !!onnxruntime_common_1.env.wasm.proxy && typeof document !== 'undefined';
let proxyWorker;
let initializing = false;
let initialized = false;
let aborted = false;
let initWasmCallbacks;
let initOrtCallbacks;
const createSessionAllocateCallbacks = [];
const createSessionFinalizeCallbacks = [];
const createSessionCallbacks = [];
const releaseSessionCallbacks = [];
const runCallbacks = [];
const endProfilingCallbacks = [];
const ensureWorker = () => {
    if (initializing || !initialized || aborted || !proxyWorker) {
        throw new Error('worker not ready');
    }
};
const onProxyWorkerMessage = (ev) => {
    switch (ev.data.type) {
        case 'init-wasm':
            initializing = false;
            if (ev.data.err) {
                aborted = true;
                initWasmCallbacks[1](ev.data.err);
            }
            else {
                initialized = true;
                initWasmCallbacks[0]();
            }
            break;
        case 'init-ort':
            if (ev.data.err) {
                initOrtCallbacks[1](ev.data.err);
            }
            else {
                initOrtCallbacks[0]();
            }
            break;
        case 'create_allocate':
            if (ev.data.err) {
                createSessionAllocateCallbacks.shift()[1](ev.data.err);
            }
            else {
                createSessionAllocateCallbacks.shift()[0](ev.data.out);
            }
            break;
        case 'create_finalize':
            if (ev.data.err) {
                createSessionFinalizeCallbacks.shift()[1](ev.data.err);
            }
            else {
                createSessionFinalizeCallbacks.shift()[0](ev.data.out);
            }
            break;
        case 'create':
            if (ev.data.err) {
                createSessionCallbacks.shift()[1](ev.data.err);
            }
            else {
                createSessionCallbacks.shift()[0](ev.data.out);
            }
            break;
        case 'release':
            if (ev.data.err) {
                releaseSessionCallbacks.shift()[1](ev.data.err);
            }
            else {
                releaseSessionCallbacks.shift()[0]();
            }
            break;
        case 'run':
            if (ev.data.err) {
                runCallbacks.shift()[1](ev.data.err);
            }
            else {
                runCallbacks.shift()[0](ev.data.out);
            }
            break;
        case 'end-profiling':
            if (ev.data.err) {
                endProfilingCallbacks.shift()[1](ev.data.err);
            }
            else {
                endProfilingCallbacks.shift()[0]();
            }
            break;
        default:
    }
};
const scriptSrc = typeof document !== 'undefined' ? (_a = document === null || document === void 0 ? void 0 : document.currentScript) === null || _a === void 0 ? void 0 : _a.src : undefined;
const initializeWebAssemblyInstance = async () => {
    if (false) {}
    else {
        return (0, wasm_factory_1.initializeWebAssembly)(onnxruntime_common_1.env.wasm);
    }
};
exports.initializeWebAssemblyInstance = initializeWebAssemblyInstance;
const initializeRuntime = async (env) => {
    if (false) {}
    else {
        await core.initRuntime(env);
    }
};
exports.initializeRuntime = initializeRuntime;
const createSessionAllocate = async (model) => {
    if (false) {}
    else {
        return core.createSessionAllocate(model);
    }
};
exports.createSessionAllocate = createSessionAllocate;
const createSessionFinalize = async (modeldata, options) => {
    if (false) {}
    else {
        return core.createSessionFinalize(modeldata, options);
    }
};
exports.createSessionFinalize = createSessionFinalize;
const createSession = async (model, options) => {
    if (false) {}
    else {
        return core.createSession(model, options);
    }
};
exports.createSession = createSession;
const releaseSession = async (sessionId) => {
    if (false) {}
    else {
        core.releaseSession(sessionId);
    }
};
exports.releaseSession = releaseSession;
const run = async (sessionId, inputIndices, inputs, outputIndices, options) => {
    if (false) {}
    else {
        return core.run(sessionId, inputIndices, inputs, outputIndices, options);
    }
};
exports.run = run;
const endProfiling = async (sessionId) => {
    if (false) {}
    else {
        core.endProfiling(sessionId);
    }
};
exports.endProfiling = endProfiling;
/***/ }),
/***/ "./lib/wasm/run-options.ts":
/*!*********************************!*\
  !*** ./lib/wasm/run-options.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.setRunOptions = void 0;
const wasm_factory_1 = __webpack_require__(/*! ./wasm-factory */ "./lib/wasm/wasm-factory.ts");
const wasm_utils_1 = __webpack_require__(/*! ./wasm-utils */ "./lib/wasm/wasm-utils.ts");
const setRunOptions = (options) => {
    const wasm = (0, wasm_factory_1.getInstance)();
    let runOptionsHandle = 0;
    const allocs = [];
    const runOptions = options || {};
    try {
        if ((options === null || options === void 0 ? void 0 : options.logSeverityLevel) === undefined) {
            runOptions.logSeverityLevel = 2; // Default to warning
        }
        else if (typeof options.logSeverityLevel !== 'number' || !Number.isInteger(options.logSeverityLevel) ||
            options.logSeverityLevel < 0 || options.logSeverityLevel > 4) {
            throw new Error(`log serverity level is not valid: ${options.logSeverityLevel}`);
        }
        if ((options === null || options === void 0 ? void 0 : options.logVerbosityLevel) === undefined) {
            runOptions.logVerbosityLevel = 0; // Default to 0
        }
        else if (typeof options.logVerbosityLevel !== 'number' || !Number.isInteger(options.logVerbosityLevel)) {
            throw new Error(`log verbosity level is not valid: ${options.logVerbosityLevel}`);
        }
        if ((options === null || options === void 0 ? void 0 : options.terminate) === undefined) {
            runOptions.terminate = false;
        }
        let tagDataOffset = 0;
        if ((options === null || options === void 0 ? void 0 : options.tag) !== undefined) {
            tagDataOffset = (0, wasm_utils_1.allocWasmString)(options.tag, allocs);
        }
        runOptionsHandle = wasm._OrtCreateRunOptions(runOptions.logSeverityLevel, runOptions.logVerbosityLevel, !!runOptions.terminate, tagDataOffset);
        if (runOptionsHandle === 0) {
            (0, wasm_utils_1.checkLastError)('Can\'t create run options.');
        }
        if ((options === null || options === void 0 ? void 0 : options.extra) !== undefined) {
            (0, wasm_utils_1.iterateExtraOptions)(options.extra, '', new WeakSet(), (key, value) => {
                const keyDataOffset = (0, wasm_utils_1.allocWasmString)(key, allocs);
                const valueDataOffset = (0, wasm_utils_1.allocWasmString)(value, allocs);
                if (wasm._OrtAddRunConfigEntry(runOptionsHandle, keyDataOffset, valueDataOffset) !== 0) {
                    (0, wasm_utils_1.checkLastError)(`Can't set a run config entry: ${key} - ${value}.`);
                }
            });
        }
        return [runOptionsHandle, allocs];
    }
    catch (e) {
        if (runOptionsHandle !== 0) {
            wasm._OrtReleaseRunOptions(runOptionsHandle);
        }
        allocs.forEach(alloc => wasm._free(alloc));
        throw e;
    }
};
exports.setRunOptions = setRunOptions;
/***/ }),
/***/ "./lib/wasm/session-handler.ts":
/*!*************************************!*\
  !*** ./lib/wasm/session-handler.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.OnnxruntimeWebAssemblySessionHandler = void 0;
const fs_1 = __webpack_require__(/*! fs */ "?295d");
const onnxruntime_common_1 = __webpack_require__(/*! onnxruntime-common */ "../common/dist/cjs/index.js");
const util_1 = __webpack_require__(/*! util */ "?cf98");
const proxy_wrapper_1 = __webpack_require__(/*! ./proxy-wrapper */ "./lib/wasm/proxy-wrapper.ts");
let runtimeInitialized;
class OnnxruntimeWebAssemblySessionHandler {
    async createSessionAllocate(path) {
        // fetch model from url and move to wasm heap. The arraybufffer that held the http
        // response is freed once we return
        const response = await fetch(path);
        if (response.status !== 200) {
            throw new Error(`failed to load model: ${path}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return (0, proxy_wrapper_1.createSessionAllocate)(new Uint8Array(arrayBuffer));
    }
    async loadModel(pathOrBuffer, options) {
        if (!runtimeInitialized) {
            await (0, proxy_wrapper_1.initializeRuntime)(onnxruntime_common_1.env);
            runtimeInitialized = true;
        }
        if (typeof pathOrBuffer === 'string') {
            if (typeof process !== 'undefined' && process.versions && process.versions.node) {
                // node
                const model = await (0, util_1.promisify)(fs_1.readFile)(pathOrBuffer);
                [this.sessionId, this.inputNames, this.outputNames] = await (0, proxy_wrapper_1.createSession)(model, options);
            }
            else {
                // browser
                // fetch model and move to wasm heap.
                const modelData = await this.createSessionAllocate(pathOrBuffer);
                // create the session
                [this.sessionId, this.inputNames, this.outputNames] = await (0, proxy_wrapper_1.createSessionFinalize)(modelData, options);
            }
        }
        else {
            [this.sessionId, this.inputNames, this.outputNames] = await (0, proxy_wrapper_1.createSession)(pathOrBuffer, options);
        }
    }
    async dispose() {
        return (0, proxy_wrapper_1.releaseSession)(this.sessionId);
    }
    async run(feeds, fetches, options) {
        const inputArray = [];
        const inputIndices = [];
        Object.entries(feeds).forEach(kvp => {
            const name = kvp[0];
            const tensor = kvp[1];
            const index = this.inputNames.indexOf(name);
            if (index === -1) {
                throw new Error(`invalid input '${name}'`);
            }
            inputArray.push(tensor);
            inputIndices.push(index);
        });
        const outputIndices = [];
        Object.entries(fetches).forEach(kvp => {
            const name = kvp[0];
            // TODO: support pre-allocated output
            const index = this.outputNames.indexOf(name);
            if (index === -1) {
                throw new Error(`invalid output '${name}'`);
            }
            outputIndices.push(index);
        });
        const outputs = await (0, proxy_wrapper_1.run)(this.sessionId, inputIndices, inputArray.map(t => [t.type, t.dims, t.data]), outputIndices, options);
        const result = {};
        for (let i = 0; i < outputs.length; i++) {
            result[this.outputNames[outputIndices[i]]] = new onnxruntime_common_1.Tensor(outputs[i][0], outputs[i][2], outputs[i][1]);
        }
        return result;
    }
    startProfiling() {
        // TODO: implement profiling
    }
    endProfiling() {
        void (0, proxy_wrapper_1.endProfiling)(this.sessionId);
    }
}
exports.OnnxruntimeWebAssemblySessionHandler = OnnxruntimeWebAssemblySessionHandler;
/***/ }),
/***/ "./lib/wasm/session-options.ts":
/*!*************************************!*\
  !*** ./lib/wasm/session-options.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.setSessionOptions = void 0;
const wasm_factory_1 = __webpack_require__(/*! ./wasm-factory */ "./lib/wasm/wasm-factory.ts");
const wasm_utils_1 = __webpack_require__(/*! ./wasm-utils */ "./lib/wasm/wasm-utils.ts");
const getGraphOptimzationLevel = (graphOptimizationLevel) => {
    switch (graphOptimizationLevel) {
        case 'disabled':
            return 0;
        case 'basic':
            return 1;
        case 'extended':
            return 2;
        case 'all':
            return 99;
        default:
            throw new Error(`unsupported graph optimization level: ${graphOptimizationLevel}`);
    }
};
const getExecutionMode = (executionMode) => {
    switch (executionMode) {
        case 'sequential':
            return 0;
        case 'parallel':
            return 1;
        default:
            throw new Error(`unsupported execution mode: ${executionMode}`);
    }
};
const appendDefaultOptions = (options) => {
    if (!options.extra) {
        options.extra = {};
    }
    if (!options.extra.session) {
        options.extra.session = {};
    }
    const session = options.extra.session;
    if (!session.use_ort_model_bytes_directly) {
        // eslint-disable-next-line camelcase
        session.use_ort_model_bytes_directly = '1';
    }
    // if using JSEP with WebGPU, always disable memory pattern
    if (options.executionProviders &&
        options.executionProviders.some(ep => (typeof ep === 'string' ? ep : ep.name) === 'webgpu')) {
        options.enableMemPattern = false;
    }
};
const setExecutionProviders = (sessionOptionsHandle, executionProviders, allocs) => {
    for (const ep of executionProviders) {
        let epName = typeof ep === 'string' ? ep : ep.name;
        // check EP name
        switch (epName) {
            case 'xnnpack':
                epName = 'XNNPACK';
                break;
            case 'webnn':
                epName = 'WEBNN';
                if (typeof ep !== 'string') {
                    const webnnOptions = ep;
                    if (webnnOptions === null || webnnOptions === void 0 ? void 0 : webnnOptions.deviceType) {
                        const keyDataOffset = (0, wasm_utils_1.allocWasmString)('deviceType', allocs);
                        const valueDataOffset = (0, wasm_utils_1.allocWasmString)(webnnOptions.deviceType, allocs);
                        if ((0, wasm_factory_1.getInstance)()._OrtAddSessionConfigEntry(sessionOptionsHandle, keyDataOffset, valueDataOffset) !==
                            0) {
                            (0, wasm_utils_1.checkLastError)(`Can't set a session config entry: 'deviceType' - ${webnnOptions.deviceType}.`);
                        }
                    }
                    if (webnnOptions === null || webnnOptions === void 0 ? void 0 : webnnOptions.powerPreference) {
                        const keyDataOffset = (0, wasm_utils_1.allocWasmString)('powerPreference', allocs);
                        const valueDataOffset = (0, wasm_utils_1.allocWasmString)(webnnOptions.powerPreference, allocs);
                        if ((0, wasm_factory_1.getInstance)()._OrtAddSessionConfigEntry(sessionOptionsHandle, keyDataOffset, valueDataOffset) !==
                            0) {
                            (0, wasm_utils_1.checkLastError)(`Can't set a session config entry: 'powerPreference' - ${webnnOptions.powerPreference}.`);
                        }
                    }
                }
                break;
            case 'webgpu':
                epName = 'JS';
                break;
            case 'wasm':
            case 'cpu':
                continue;
            default:
                throw new Error(`not supported execution provider: ${epName}`);
        }
        const epNameDataOffset = (0, wasm_utils_1.allocWasmString)(epName, allocs);
        if ((0, wasm_factory_1.getInstance)()._OrtAppendExecutionProvider(sessionOptionsHandle, epNameDataOffset) !== 0) {
            (0, wasm_utils_1.checkLastError)(`Can't append execution provider: ${epName}.`);
        }
    }
};
const setSessionOptions = (options) => {
    var _a, _b, _c, _d;
    const wasm = (0, wasm_factory_1.getInstance)();
    let sessionOptionsHandle = 0;
    const allocs = [];
    const sessionOptions = options || {};
    appendDefaultOptions(sessionOptions);
    try {
        const graphOptimizationLevel = getGraphOptimzationLevel((_a = sessionOptions.graphOptimizationLevel) !== null && _a !== void 0 ? _a : 'all');
        const executionMode = getExecutionMode((_b = sessionOptions.executionMode) !== null && _b !== void 0 ? _b : 'sequential');
        const logIdDataOffset = typeof sessionOptions.logId === 'string' ? (0, wasm_utils_1.allocWasmString)(sessionOptions.logId, allocs) : 0;
        const logSeverityLevel = (_c = sessionOptions.logSeverityLevel) !== null && _c !== void 0 ? _c : 2; // Default to 2 - warning
        if (!Number.isInteger(logSeverityLevel) || logSeverityLevel < 0 || logSeverityLevel > 4) {
            throw new Error(`log serverity level is not valid: ${logSeverityLevel}`);
        }
        const logVerbosityLevel = (_d = sessionOptions.logVerbosityLevel) !== null && _d !== void 0 ? _d : 0; // Default to 0 - verbose
        if (!Number.isInteger(logVerbosityLevel) || logVerbosityLevel < 0 || logVerbosityLevel > 4) {
            throw new Error(`log verbosity level is not valid: ${logVerbosityLevel}`);
        }
        const optimizedModelFilePathOffset = typeof sessionOptions.optimizedModelFilePath === 'string' ?
            (0, wasm_utils_1.allocWasmString)(sessionOptions.optimizedModelFilePath, allocs) :
            0;
        sessionOptionsHandle = wasm._OrtCreateSessionOptions(graphOptimizationLevel, !!sessionOptions.enableCpuMemArena, !!sessionOptions.enableMemPattern, executionMode, !!sessionOptions.enableProfiling, 0, logIdDataOffset, logSeverityLevel, logVerbosityLevel, optimizedModelFilePathOffset);
        if (sessionOptionsHandle === 0) {
            (0, wasm_utils_1.checkLastError)('Can\'t create session options.');
        }
        if (sessionOptions.executionProviders) {
            setExecutionProviders(sessionOptionsHandle, sessionOptions.executionProviders, allocs);
        }
        if (sessionOptions.extra !== undefined) {
            (0, wasm_utils_1.iterateExtraOptions)(sessionOptions.extra, '', new WeakSet(), (key, value) => {
                const keyDataOffset = (0, wasm_utils_1.allocWasmString)(key, allocs);
                const valueDataOffset = (0, wasm_utils_1.allocWasmString)(value, allocs);
                if (wasm._OrtAddSessionConfigEntry(sessionOptionsHandle, keyDataOffset, valueDataOffset) !== 0) {
                    (0, wasm_utils_1.checkLastError)(`Can't set a session config entry: ${key} - ${value}.`);
                }
            });
        }
        return [sessionOptionsHandle, allocs];
    }
    catch (e) {
        if (sessionOptionsHandle !== 0) {
            wasm._OrtReleaseSessionOptions(sessionOptionsHandle);
        }
        allocs.forEach(alloc => wasm._free(alloc));
        throw e;
    }
};
exports.setSessionOptions = setSessionOptions;
/***/ }),
/***/ "./lib/wasm/wasm-common.ts":
/*!*********************************!*\
  !*** ./lib/wasm/wasm-common.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, exports) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.logLevelStringToEnum = exports.tensorTypeToTypedArrayConstructor = exports.getTensorElementSize = exports.tensorDataTypeEnumToString = exports.tensorDataTypeStringToEnum = void 0;
/**
 * Map string tensor data to enum value
 */
const tensorDataTypeStringToEnum = (type) => {
    switch (type) {
        case 'int8':
            return 3 /* DataType.int8 */;
        case 'uint8':
            return 2 /* DataType.uint8 */;
        case 'bool':
            return 9 /* DataType.bool */;
        case 'int16':
            return 5 /* DataType.int16 */;
        case 'uint16':
            return 4 /* DataType.uint16 */;
        case 'int32':
            return 6 /* DataType.int32 */;
        case 'uint32':
            return 12 /* DataType.uint32 */;
        case 'float16':
            return 10 /* DataType.float16 */;
        case 'float32':
            return 1 /* DataType.float */;
        case 'float64':
            return 11 /* DataType.double */;
        case 'string':
            return 8 /* DataType.string */;
        case 'int64':
            return 7 /* DataType.int64 */;
        case 'uint64':
            return 13 /* DataType.uint64 */;
        default:
            throw new Error(`unsupported data type: ${type}`);
    }
};
exports.tensorDataTypeStringToEnum = tensorDataTypeStringToEnum;
/**
 * Map enum value to string tensor data
 */
const tensorDataTypeEnumToString = (typeProto) => {
    switch (typeProto) {
        case 3 /* DataType.int8 */:
            return 'int8';
        case 2 /* DataType.uint8 */:
            return 'uint8';
        case 9 /* DataType.bool */:
            return 'bool';
        case 5 /* DataType.int16 */:
            return 'int16';
        case 4 /* DataType.uint16 */:
            return 'uint16';
        case 6 /* DataType.int32 */:
            return 'int32';
        case 12 /* DataType.uint32 */:
            return 'uint32';
        case 10 /* DataType.float16 */:
            return 'float16';
        case 1 /* DataType.float */:
            return 'float32';
        case 11 /* DataType.double */:
            return 'float64';
        case 8 /* DataType.string */:
            return 'string';
        case 7 /* DataType.int64 */:
            return 'int64';
        case 13 /* DataType.uint64 */:
            return 'uint64';
        default:
            throw new Error(`unsupported data type: ${typeProto}`);
    }
};
exports.tensorDataTypeEnumToString = tensorDataTypeEnumToString;
/**
 * get tensor element size in bytes by the given data type
 * @returns size in integer or undefined if the data type is not supported
 */
const getTensorElementSize = (dateType) => [undefined, 4, 1, 1, 2, 2, 4, 8, undefined, 1, 2, 8, 4, 8, undefined, undefined, undefined][dateType];
exports.getTensorElementSize = getTensorElementSize;
/**
 * get typed array constructor by the given tensor type
 */
const tensorTypeToTypedArrayConstructor = (type) => {
    switch (type) {
        case 'float16':
            return Uint16Array;
        case 'float32':
            return Float32Array;
        case 'uint8':
            return Uint8Array;
        case 'int8':
            return Int8Array;
        case 'uint16':
            return Uint16Array;
        case 'int16':
            return Int16Array;
        case 'int32':
            return Int32Array;
        case 'bool':
            return Uint8Array;
        case 'float64':
            return Float64Array;
        case 'uint32':
            return Uint32Array;
        case 'int64':
            return BigInt64Array;
        case 'uint64':
            return BigUint64Array;
        default:
            throw new Error(`unsupported type: ${type}`);
    }
};
exports.tensorTypeToTypedArrayConstructor = tensorTypeToTypedArrayConstructor;
/**
 * Map string log level to integer value
 */
const logLevelStringToEnum = (logLevel) => {
    switch (logLevel) {
        case 'verbose':
            return 0;
        case 'info':
            return 1;
        case 'warning':
            return 2;
        case 'error':
            return 3;
        case 'fatal':
            return 4;
        default:
            throw new Error(`unsupported logging level: ${logLevel}`);
    }
};
exports.logLevelStringToEnum = logLevelStringToEnum;
/***/ }),
/***/ "./lib/wasm/wasm-core-impl.ts":
/*!************************************!*\
  !*** ./lib/wasm/wasm-core-impl.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.extractTransferableBuffers = exports.endProfiling = exports.run = exports.releaseSession = exports.createSession = exports.createSessionFinalize = exports.createSessionAllocate = exports.initRuntime = void 0;
const run_options_1 = __webpack_require__(/*! ./run-options */ "./lib/wasm/run-options.ts");
const session_options_1 = __webpack_require__(/*! ./session-options */ "./lib/wasm/session-options.ts");
const wasm_common_1 = __webpack_require__(/*! ./wasm-common */ "./lib/wasm/wasm-common.ts");
const wasm_factory_1 = __webpack_require__(/*! ./wasm-factory */ "./lib/wasm/wasm-factory.ts");
const wasm_utils_1 = __webpack_require__(/*! ./wasm-utils */ "./lib/wasm/wasm-utils.ts");
/**
 * get the input/output count of the session.
 * @param sessionHandle the handle representing the session. should be non-zero.
 * @returns a tuple including 2 numbers, representing the input count and output count.
 */
const getSessionInputOutputCount = (sessionHandle) => {
    const wasm = (0, wasm_factory_1.getInstance)();
    const stack = wasm.stackSave();
    try {
        const dataOffset = wasm.stackAlloc(8);
        const errorCode = wasm._OrtGetInputOutputCount(sessionHandle, dataOffset, dataOffset + 4);
        if (errorCode !== 0) {
            (0, wasm_utils_1.checkLastError)('Can\'t get session input/output count.');
        }
        return [wasm.HEAP32[dataOffset / 4], wasm.HEAP32[dataOffset / 4 + 1]];
    }
    finally {
        wasm.stackRestore(stack);
    }
};
/**
 * initialize ORT environment.
 * @param numThreads SetGlobalIntraOpNumThreads(numThreads)
 * @param loggingLevel CreateEnv(static_cast<OrtLoggingLevel>(logging_level))
 */
const initOrt = (numThreads, loggingLevel) => {
    const errorCode = (0, wasm_factory_1.getInstance)()._OrtInit(numThreads, loggingLevel);
    if (errorCode !== 0) {
        (0, wasm_utils_1.checkLastError)('Can\'t initialize onnxruntime.');
    }
};
/**
 * intialize runtime environment.
 * @param env passed in the environment config object.
 */
const initRuntime = async (env) => {
    // init ORT
    initOrt(env.wasm.numThreads, (0, wasm_common_1.logLevelStringToEnum)(env.logLevel));
    if (false) {}
};
exports.initRuntime = initRuntime;
const activeSessions = new Map();
/**
 * allocate the memory and memcpy the model bytes, preparing for creating an instance of InferenceSession.
 * @returns a 2-elements tuple - the pointer and size of the allocated buffer
 */
const createSessionAllocate = (model) => {
    const wasm = (0, wasm_factory_1.getInstance)();
    const modelDataOffset = wasm._malloc(model.byteLength);
    if (modelDataOffset === 0) {
        throw new Error(`Can't create a session. failed to allocate a buffer of size ${model.byteLength}.`);
    }
    wasm.HEAPU8.set(model, modelDataOffset);
    return [modelDataOffset, model.byteLength];
};
exports.createSessionAllocate = createSessionAllocate;
/**
 * create an inference session using the prepared buffer containing the model data.
 * @param modelData a 2-elements tuple containing the pointer and size of the model data buffer.
 * @param options an optional session options object.
 * @returns a 3-elements tuple containing [session handle, input names, output names]
 */
const createSessionFinalize = (modelData, options) => {
    const wasm = (0, wasm_factory_1.getInstance)();
    let sessionHandle = 0;
    let sessionOptionsHandle = 0;
    let allocs = [];
    const inputNamesUTF8Encoded = [];
    const outputNamesUTF8Encoded = [];
    try {
        [sessionOptionsHandle, allocs] = (0, session_options_1.setSessionOptions)(options);
        sessionHandle = wasm._OrtCreateSession(modelData[0], modelData[1], sessionOptionsHandle);
        if (sessionHandle === 0) {
            (0, wasm_utils_1.checkLastError)('Can\'t create a session.');
        }
        const [inputCount, outputCount] = getSessionInputOutputCount(sessionHandle);
        const inputNames = [];
        const outputNames = [];
        for (let i = 0; i < inputCount; i++) {
            const name = wasm._OrtGetInputName(sessionHandle, i);
            if (name === 0) {
                (0, wasm_utils_1.checkLastError)('Can\'t get an input name.');
            }
            inputNamesUTF8Encoded.push(name);
            inputNames.push(wasm.UTF8ToString(name));
        }
        for (let i = 0; i < outputCount; i++) {
            const name = wasm._OrtGetOutputName(sessionHandle, i);
            if (name === 0) {
                (0, wasm_utils_1.checkLastError)('Can\'t get an output name.');
            }
            outputNamesUTF8Encoded.push(name);
            outputNames.push(wasm.UTF8ToString(name));
        }
        activeSessions.set(sessionHandle, [sessionHandle, inputNamesUTF8Encoded, outputNamesUTF8Encoded]);
        return [sessionHandle, inputNames, outputNames];
    }
    catch (e) {
        inputNamesUTF8Encoded.forEach(buf => wasm._OrtFree(buf));
        outputNamesUTF8Encoded.forEach(buf => wasm._OrtFree(buf));
        if (sessionHandle !== 0) {
            wasm._OrtReleaseSession(sessionHandle);
        }
        throw e;
    }
    finally {
        wasm._free(modelData[0]);
        if (sessionOptionsHandle !== 0) {
            wasm._OrtReleaseSessionOptions(sessionOptionsHandle);
        }
        allocs.forEach(alloc => wasm._free(alloc));
    }
};
exports.createSessionFinalize = createSessionFinalize;
/**
 * create an instance of InferenceSession.
 * @returns the metadata of InferenceSession. 0-value handle for failure.
 */
const createSession = (model, options) => {
    const modelData = (0, exports.createSessionAllocate)(model);
    return (0, exports.createSessionFinalize)(modelData, options);
};
exports.createSession = createSession;
const releaseSession = (sessionId) => {
    const wasm = (0, wasm_factory_1.getInstance)();
    const session = activeSessions.get(sessionId);
    if (!session) {
        throw new Error(`cannot release session. invalid session id: ${sessionId}`);
    }
    const [sessionHandle, inputNamesUTF8Encoded, outputNamesUTF8Encoded] = session;
    inputNamesUTF8Encoded.forEach(buf => wasm._OrtFree(buf));
    outputNamesUTF8Encoded.forEach(buf => wasm._OrtFree(buf));
    wasm._OrtReleaseSession(sessionHandle);
    activeSessions.delete(sessionId);
};
exports.releaseSession = releaseSession;
/**
 * perform inference run
 */
const run = async (sessionId, inputIndices, inputs, outputIndices, options) => {
    var _a;
    const wasm = (0, wasm_factory_1.getInstance)();
    const session = activeSessions.get(sessionId);
    if (!session) {
        throw new Error(`cannot run inference. invalid session id: ${sessionId}`);
    }
    const [sessionHandle, inputNamesUTF8Encoded, outputNamesUTF8Encoded] = session;
    const inputCount = inputIndices.length;
    const outputCount = outputIndices.length;
    let runOptionsHandle = 0;
    let runOptionsAllocs = [];
    const inputValues = [];
    const inputAllocs = [];
    try {
        [runOptionsHandle, runOptionsAllocs] = (0, run_options_1.setRunOptions)(options);
        // create input tensors
        for (let i = 0; i < inputCount; i++) {
            const dataType = inputs[i][0];
            const dims = inputs[i][1];
            const data = inputs[i][2];
            let dataOffset;
            let dataByteLength;
            if (Array.isArray(data)) {
                // string tensor
                dataByteLength = 4 * data.length;
                dataOffset = wasm._malloc(dataByteLength);
                inputAllocs.push(dataOffset);
                let dataIndex = dataOffset / 4;
                for (let i = 0; i < data.length; i++) {
                    if (typeof data[i] !== 'string') {
                        throw new TypeError(`tensor data at index ${i} is not a string`);
                    }
                    wasm.HEAPU32[dataIndex++] = (0, wasm_utils_1.allocWasmString)(data[i], inputAllocs);
                }
            }
            else {
                dataByteLength = data.byteLength;
                dataOffset = wasm._malloc(dataByteLength);
                inputAllocs.push(dataOffset);
                wasm.HEAPU8.set(new Uint8Array(data.buffer, data.byteOffset, dataByteLength), dataOffset);
            }
            const stack = wasm.stackSave();
            const dimsOffset = wasm.stackAlloc(4 * dims.length);
            try {
                let dimIndex = dimsOffset / 4;
                dims.forEach(d => wasm.HEAP32[dimIndex++] = d);
                const tensor = wasm._OrtCreateTensor((0, wasm_common_1.tensorDataTypeStringToEnum)(dataType), dataOffset, dataByteLength, dimsOffset, dims.length);
                if (tensor === 0) {
                    (0, wasm_utils_1.checkLastError)(`Can't create tensor for input[${i}].`);
                }
                inputValues.push(tensor);
            }
            finally {
                wasm.stackRestore(stack);
            }
        }
        const beforeRunStack = wasm.stackSave();
        const inputValuesOffset = wasm.stackAlloc(inputCount * 4);
        const inputNamesOffset = wasm.stackAlloc(inputCount * 4);
        const outputValuesOffset = wasm.stackAlloc(outputCount * 4);
        const outputNamesOffset = wasm.stackAlloc(outputCount * 4);
        try {
            let inputValuesIndex = inputValuesOffset / 4;
            let inputNamesIndex = inputNamesOffset / 4;
            let outputValuesIndex = outputValuesOffset / 4;
            let outputNamesIndex = outputNamesOffset / 4;
            for (let i = 0; i < inputCount; i++) {
                wasm.HEAPU32[inputValuesIndex++] = inputValues[i];
                wasm.HEAPU32[inputNamesIndex++] = inputNamesUTF8Encoded[inputIndices[i]];
            }
            for (let i = 0; i < outputCount; i++) {
                wasm.HEAPU32[outputValuesIndex++] = 0;
                wasm.HEAPU32[outputNamesIndex++] = outputNamesUTF8Encoded[outputIndices[i]];
            }
            // jsepOnRunStart is only available when JSEP is enabled.
            (_a = wasm.jsepOnRunStart) === null || _a === void 0 ? void 0 : _a.call(wasm, sessionId);
            // support RunOptions
            let errorCode = wasm._OrtRun(sessionHandle, inputNamesOffset, inputValuesOffset, inputCount, outputNamesOffset, outputCount, outputValuesOffset, runOptionsHandle);
            const runPromise = wasm.jsepRunPromise;
            if (runPromise) {
                // jsepRunPromise is a Promise object. It is only available when JSEP is enabled.
                //
                // OrtRun() is a synchrnous call, but it internally calls async functions. Emscripten's ASYNCIFY allows it to
                // work in this way. However, OrtRun() does not return a promise, so when code reaches here, it is earlier than
                // the async functions are finished.
                //
                // To make it work, we created a Promise and resolve the promise when the C++ code actually reaches the end of
                // OrtRun(). If the promise exists, we need to await for the promise to be resolved.
                errorCode = await runPromise;
            }
            const jsepOnRunEnd = wasm.jsepOnRunEnd;
            if (jsepOnRunEnd) {
                // jsepOnRunEnd is only available when JSEP is enabled.
                //
                // it returns a promise, which is resolved or rejected when the following async functions are finished:
                // - collecting GPU validation errors.
                await jsepOnRunEnd(sessionId);
            }
            const output = [];
            if (errorCode !== 0) {
                (0, wasm_utils_1.checkLastError)('failed to call OrtRun().');
            }
            for (let i = 0; i < outputCount; i++) {
                const tensor = wasm.HEAPU32[outputValuesOffset / 4 + i];
                const beforeGetTensorDataStack = wasm.stackSave();
                // stack allocate 4 pointer value
                const tensorDataOffset = wasm.stackAlloc(4 * 4);
                let type, dataOffset = 0;
                try {
                    errorCode = wasm._OrtGetTensorData(tensor, tensorDataOffset, tensorDataOffset + 4, tensorDataOffset + 8, tensorDataOffset + 12);
                    if (errorCode !== 0) {
                        (0, wasm_utils_1.checkLastError)(`Can't access output tensor data on index ${i}.`);
                    }
                    let tensorDataIndex = tensorDataOffset / 4;
                    const dataType = wasm.HEAPU32[tensorDataIndex++];
                    dataOffset = wasm.HEAPU32[tensorDataIndex++];
                    const dimsOffset = wasm.HEAPU32[tensorDataIndex++];
                    const dimsLength = wasm.HEAPU32[tensorDataIndex++];
                    const dims = [];
                    for (let i = 0; i < dimsLength; i++) {
                        dims.push(wasm.HEAPU32[dimsOffset / 4 + i]);
                    }
                    wasm._OrtFree(dimsOffset);
                    const size = dims.length === 0 ? 1 : dims.reduce((a, b) => a * b);
                    type = (0, wasm_common_1.tensorDataTypeEnumToString)(dataType);
                    if (type === 'string') {
                        const stringData = [];
                        let dataIndex = dataOffset / 4;
                        for (let i = 0; i < size; i++) {
                            const offset = wasm.HEAPU32[dataIndex++];
                            const maxBytesToRead = i === size - 1 ? undefined : wasm.HEAPU32[dataIndex] - offset;
                            stringData.push(wasm.UTF8ToString(offset, maxBytesToRead));
                        }
                        output.push([type, dims, stringData]);
                    }
                    else {
                        const typedArrayConstructor = (0, wasm_common_1.tensorTypeToTypedArrayConstructor)(type);
                        const data = new typedArrayConstructor(size);
                        new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
                            .set(wasm.HEAPU8.subarray(dataOffset, dataOffset + data.byteLength));
                        output.push([type, dims, data]);
                    }
                }
                finally {
                    wasm.stackRestore(beforeGetTensorDataStack);
                    if (type === 'string' && dataOffset) {
                        wasm._free(dataOffset);
                    }
                    wasm._OrtReleaseTensor(tensor);
                }
            }
            return output;
        }
        finally {
            wasm.stackRestore(beforeRunStack);
        }
    }
    finally {
        inputValues.forEach(v => wasm._OrtReleaseTensor(v));
        inputAllocs.forEach(p => wasm._free(p));
        if (runOptionsHandle !== 0) {
            wasm._OrtReleaseRunOptions(runOptionsHandle);
        }
        runOptionsAllocs.forEach(p => wasm._free(p));
    }
};
exports.run = run;
/**
 * end profiling
 */
const endProfiling = (sessionId) => {
    const wasm = (0, wasm_factory_1.getInstance)();
    const session = activeSessions.get(sessionId);
    if (!session) {
        throw new Error('invalid session id');
    }
    const sessionHandle = session[0];
    // profile file name is not used yet, but it must be freed.
    const profileFileName = wasm._OrtEndProfiling(sessionHandle);
    if (profileFileName === 0) {
        (0, wasm_utils_1.checkLastError)('Can\'t get an profile file name.');
    }
    wasm._OrtFree(profileFileName);
};
exports.endProfiling = endProfiling;
const extractTransferableBuffers = (tensors) => {
    const buffers = [];
    for (const tensor of tensors) {
        const data = tensor[2];
        if (!Array.isArray(data) && data.buffer) {
            buffers.push(data.buffer);
        }
    }
    return buffers;
};
exports.extractTransferableBuffers = extractTransferableBuffers;
/***/ }),
/***/ "./lib/wasm/wasm-factory.ts":
/*!**********************************!*\
  !*** ./lib/wasm/wasm-factory.ts ***!
  \**********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.dispose = exports.getInstance = exports.initializeWebAssembly = void 0;
const path = __importStar(__webpack_require__(/*! path */ "?7aa5"));
/* eslint-disable @typescript-eslint/no-require-imports */
const ortWasmFactory =  true ? __webpack_require__(/*! ./binding/ort-wasm.js */ "./lib/wasm/binding/ort-wasm.js") : 0;
const ortWasmFactoryThreaded =  false ?
    (0) :
    ortWasmFactory;
/* eslint-enable @typescript-eslint/no-require-imports */
let wasm;
let initialized = false;
let initializing = false;
let aborted = false;
const isMultiThreadSupported = () => {
    try {
        // If 'SharedArrayBuffer' is not available, WebAssembly threads will not work.
        if (typeof SharedArrayBuffer === 'undefined') {
            return false;
        }
        // Test for transferability of SABs (for browsers. needed for Firefox)
        // https://groups.google.com/forum/#!msg/mozilla.dev.platform/IHkBZlHETpA/dwsMNchWEQAJ
        if (typeof MessageChannel !== 'undefined') {
            new MessageChannel().port1.postMessage(new SharedArrayBuffer(1));
        }
        // Test for WebAssembly threads capability (for both browsers and Node.js)
        // This typed array is a WebAssembly program containing threaded instructions.
        return WebAssembly.validate(new Uint8Array([
            0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 5,
            4, 1, 3, 1, 1, 10, 11, 1, 9, 0, 65, 0, 254, 16, 2, 0, 26, 11
        ]));
    }
    catch (e) {
        return false;
    }
};
const isSimdSupported = () => {
    try {
        // Test for WebAssembly SIMD capability (for both browsers and Node.js)
        // This typed array is a WebAssembly program containing SIMD instructions.
        // The binary data is generated from the following code by wat2wasm:
        //
        // (module
        //   (type $t0 (func))
        //   (func $f0 (type $t0)
        //     (drop
        //       (i32x4.dot_i16x8_s
        //         (i8x16.splat
        //           (i32.const 0))
        //         (v128.const i32x4 0x00000000 0x00000000 0x00000000 0x00000000)))))
        return WebAssembly.validate(new Uint8Array([
            0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 30, 1, 28, 0, 65, 0,
            253, 15, 253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 253, 186, 1, 26, 11
        ]));
    }
    catch (e) {
        return false;
    }
};
const getWasmFileName = (useSimd, useThreads) => {
    if (useThreads) {
        return useSimd ? 'ort-wasm-simd-threaded.wasm' : 'ort-wasm-threaded.wasm';
    }
    else {
        return useSimd ? 'ort-wasm-simd.wasm' : 'ort-wasm.wasm';
    }
};
const initializeWebAssembly = async (flags) => {
    if (initialized) {
        return Promise.resolve();
    }
    if (initializing) {
        throw new Error('multiple calls to \'initializeWebAssembly()\' detected.');
    }
    if (aborted) {
        throw new Error('previous call to \'initializeWebAssembly()\' failed.');
    }
    initializing = true;
    // wasm flags are already initialized
    const timeout = flags.initTimeout;
    const numThreads = flags.numThreads;
    const simd = flags.simd;
    const useThreads = numThreads > 1 && isMultiThreadSupported();
    const useSimd = simd && isSimdSupported();
    const wasmPaths = flags.wasmPaths;
    const wasmPrefixOverride = typeof wasmPaths === 'string' ? wasmPaths : undefined;
    const wasmFileName = getWasmFileName(useSimd, useThreads);
    const wasmPathOverride = typeof wasmPaths === 'object' ? wasmPaths[wasmFileName] : undefined;
    let isTimeout = false;
    const tasks = [];
    // promise for timeout
    if (timeout > 0) {
        tasks.push(new Promise((resolve) => {
            setTimeout(() => {
                isTimeout = true;
                resolve();
            }, timeout);
        }));
    }
    // promise for module initialization
    tasks.push(new Promise((resolve, reject) => {
        const factory = useThreads ? ortWasmFactoryThreaded : ortWasmFactory;
        const config = {
            locateFile: (fileName, scriptDirectory) => {
                if (false) {}
                if (fileName.endsWith('.wasm')) {
                    if (wasmPathOverride) {
                        return wasmPathOverride;
                    }
                    const prefix = wasmPrefixOverride !== null && wasmPrefixOverride !== void 0 ? wasmPrefixOverride : scriptDirectory;
                    if (false) {}
                    return prefix + wasmFileName;
                }
                return scriptDirectory + fileName;
            }
        };
        if (false) {}
        factory(config).then(
        // wasm module initialized successfully
        module => {
            initializing = false;
            initialized = true;
            wasm = module;
            resolve();
        }, 
        // wasm module failed to initialize
        (what) => {
            initializing = false;
            aborted = true;
            reject(what);
        });
    }));
    await Promise.race(tasks);
    if (isTimeout) {
        throw new Error(`WebAssembly backend initializing failed due to timeout: ${timeout}ms`);
    }
};
exports.initializeWebAssembly = initializeWebAssembly;
const getInstance = () => {
    if (initialized && wasm) {
        return wasm;
    }
    throw new Error('WebAssembly is not initialized yet.');
};
exports.getInstance = getInstance;
const dispose = () => {
    var _a;
    if (initialized && !initializing && !aborted) {
        initializing = true;
        (_a = wasm.PThread) === null || _a === void 0 ? void 0 : _a.terminateAllThreads();
        wasm = undefined;
        initializing = false;
        initialized = false;
        aborted = true;
    }
};
exports.dispose = dispose;
/***/ }),
/***/ "./lib/wasm/wasm-utils.ts":
/*!********************************!*\
  !*** ./lib/wasm/wasm-utils.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.checkLastError = exports.iterateExtraOptions = exports.allocWasmString = void 0;
const wasm_factory_1 = __webpack_require__(/*! ./wasm-factory */ "./lib/wasm/wasm-factory.ts");
const allocWasmString = (data, allocs) => {
    const wasm = (0, wasm_factory_1.getInstance)();
    const dataLength = wasm.lengthBytesUTF8(data) + 1;
    const dataOffset = wasm._malloc(dataLength);
    wasm.stringToUTF8(data, dataOffset, dataLength);
    allocs.push(dataOffset);
    return dataOffset;
};
exports.allocWasmString = allocWasmString;
const iterateExtraOptions = (options, prefix, seen, handler) => {
    if (typeof options == 'object' && options !== null) {
        if (seen.has(options)) {
            throw new Error('Circular reference in options');
        }
        else {
            seen.add(options);
        }
    }
    Object.entries(options).forEach(([key, value]) => {
        const name = (prefix) ? prefix + key : key;
        if (typeof value === 'object') {
            (0, exports.iterateExtraOptions)(value, name + '.', seen, handler);
        }
        else if (typeof value === 'string' || typeof value === 'number') {
            handler(name, value.toString());
        }
        else if (typeof value === 'boolean') {
            handler(name, (value) ? '1' : '0');
        }
        else {
            throw new Error(`Can't handle extra config type: ${typeof value}`);
        }
    });
};
exports.iterateExtraOptions = iterateExtraOptions;
/**
 * check web assembly API's last error and throw error if any error occurred.
 * @param message a message used when an error occurred.
 */
const checkLastError = (message) => {
    const wasm = (0, wasm_factory_1.getInstance)();
    const stack = wasm.stackSave();
    try {
        const paramsOffset = wasm.stackAlloc(8);
        wasm._OrtGetLastError(paramsOffset, paramsOffset + 4);
        const errorCode = wasm.HEAP32[paramsOffset / 4];
        const errorMessagePointer = wasm.HEAPU32[paramsOffset / 4 + 1];
        const errorMessage = errorMessagePointer ? wasm.UTF8ToString(errorMessagePointer) : '';
        throw new Error(`${message} ERROR_CODE: ${errorCode}, ERROR_MESSAGE: ${errorMessage}`);
    }
    finally {
        wasm.stackRestore(stack);
    }
};
exports.checkLastError = checkLastError;
/***/ }),
/***/ "./lib/wasm/binding/ort-wasm.js":
/*!**************************************!*\
  !*** ./lib/wasm/binding/ort-wasm.js ***!
  \**************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {
var ortWasm = (() => {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  if (typeof __filename !== 'undefined') _scriptDir = _scriptDir || __filename;
  return (
function(moduleArg = {}) {
var e=moduleArg,h,m;e.ready=new Promise((a,b)=>{h=a;m=b});var q=Object.assign({},e),v="./this.program",aa="object"==typeof window,x="function"==typeof importScripts,ba="object"==typeof process&&"object"==typeof process.versions&&"string"==typeof process.versions.node,y="",A,B,C;
if(ba){var fs=__webpack_require__(/*! fs */ "?63c8"),D=__webpack_require__(/*! path */ "?75c6");y=x?D.dirname(y)+"/":__dirname+"/";A=(a,b)=>{a=a.startsWith("file://")?new URL(a):D.normalize(a);return fs.readFileSync(a,b?void 0:"utf8")};C=a=>{a=A(a,!0);a.buffer||(a=new Uint8Array(a));return a};B=(a,b,c,f=!0)=>{a=a.startsWith("file://")?new URL(a):D.normalize(a);fs.readFile(a,f?void 0:"utf8",(g,k)=>{g?c(g):b(f?k.buffer:k)})};!e.thisProgram&&1<process.argv.length&&(v=process.argv[1].replace(/\\/g,"/"));process.argv.slice(2);e.inspect=()=>"[Emscripten Module object]"}else if(aa||
x)x?y=self.location.href:"undefined"!=typeof document&&document.currentScript&&(y=document.currentScript.src),_scriptDir&&(y=_scriptDir),0!==y.indexOf("blob:")?y=y.substr(0,y.replace(/[?#].*/,"").lastIndexOf("/")+1):y="",A=a=>{var b=new XMLHttpRequest;b.open("GET",a,!1);b.send(null);return b.responseText},x&&(C=a=>{var b=new XMLHttpRequest;b.open("GET",a,!1);b.responseType="arraybuffer";b.send(null);return new Uint8Array(b.response)}),B=(a,b,c)=>{var f=new XMLHttpRequest;f.open("GET",a,!0);f.responseType=
"arraybuffer";f.onload=()=>{200==f.status||0==f.status&&f.response?b(f.response):c()};f.onerror=c;f.send(null)};var ca=e.print||console.log.bind(console),E=e.printErr||console.error.bind(console);Object.assign(e,q);q=null;e.thisProgram&&(v=e.thisProgram);var F;e.wasmBinary&&(F=e.wasmBinary);var noExitRuntime=e.noExitRuntime||!0;"object"!=typeof WebAssembly&&G("no native wasm support detected");var H,I,da=!1,J,K,L,M;
function ea(){var a=H.buffer;e.HEAP8=J=new Int8Array(a);e.HEAP16=new Int16Array(a);e.HEAP32=L=new Int32Array(a);e.HEAPU8=K=new Uint8Array(a);e.HEAPU16=new Uint16Array(a);e.HEAPU32=M=new Uint32Array(a);e.HEAPF32=new Float32Array(a);e.HEAPF64=new Float64Array(a)}var fa=[],ha=[],ia=[];function ja(){var a=e.preRun.shift();fa.unshift(a)}var N=0,O=null,P=null;
function G(a){if(e.onAbort)e.onAbort(a);a="Aborted("+a+")";E(a);da=!0;a=new WebAssembly.RuntimeError(a+". Build with -sASSERTIONS for more info.");m(a);throw a;}function ka(a){return a.startsWith("data:application/octet-stream;base64,")}var Q;Q="ort-wasm.wasm";if(!ka(Q)){var la=Q;Q=e.locateFile?e.locateFile(la,y):y+la}function ma(a){if(a==Q&&F)return new Uint8Array(F);if(C)return C(a);throw"both async and sync fetching of the wasm failed";}
function na(a){if(!F&&(aa||x)){if("function"==typeof fetch&&!a.startsWith("file://"))return fetch(a,{credentials:"same-origin"}).then(b=>{if(!b.ok)throw"failed to load wasm binary file at '"+a+"'";return b.arrayBuffer()}).catch(()=>ma(a));if(B)return new Promise((b,c)=>{B(a,f=>b(new Uint8Array(f)),c)})}return Promise.resolve().then(()=>ma(a))}function oa(a,b,c){return na(a).then(f=>WebAssembly.instantiate(f,b)).then(f=>f).then(c,f=>{E("failed to asynchronously prepare wasm: "+f);G(f)})}
function pa(a,b){var c=Q;return F||"function"!=typeof WebAssembly.instantiateStreaming||ka(c)||c.startsWith("file://")||ba||"function"!=typeof fetch?oa(c,a,b):fetch(c,{credentials:"same-origin"}).then(f=>WebAssembly.instantiateStreaming(f,a).then(b,function(g){E("wasm streaming compile failed: "+g);E("falling back to ArrayBuffer instantiation");return oa(c,a,b)}))}var R,S=a=>{for(;0<a.length;)a.shift()(e)};
function qa(a){this.oa=a-24;this.ta=function(b){M[this.oa+4>>2>>>0]=b};this.sa=function(b){M[this.oa+8>>2>>>0]=b};this.qa=function(b,c){this.ra();this.ta(b);this.sa(c)};this.ra=function(){M[this.oa+16>>2>>>0]=0}}
var ra=0,sa=0,ta="undefined"!=typeof TextDecoder?new TextDecoder("utf8"):void 0,ua=(a,b,c)=>{b>>>=0;var f=b+c;for(c=b;a[c]&&!(c>=f);)++c;if(16<c-b&&a.buffer&&ta)return ta.decode(a.subarray(b,c));for(f="";b<c;){var g=a[b++];if(g&128){var k=a[b++]&63;if(192==(g&224))f+=String.fromCharCode((g&31)<<6|k);else{var l=a[b++]&63;g=224==(g&240)?(g&15)<<12|k<<6|l:(g&7)<<18|k<<12|l<<6|a[b++]&63;65536>g?f+=String.fromCharCode(g):(g-=65536,f+=String.fromCharCode(55296|g>>10,56320|g&1023))}}else f+=String.fromCharCode(g)}return f},
T=(a,b)=>(a>>>=0)?ua(K,a,b):"",U=a=>{for(var b=0,c=0;c<a.length;++c){var f=a.charCodeAt(c);127>=f?b++:2047>=f?b+=2:55296<=f&&57343>=f?(b+=4,++c):b+=3}return b},V=(a,b,c,f)=>{c>>>=0;if(!(0<f))return 0;var g=c;f=c+f-1;for(var k=0;k<a.length;++k){var l=a.charCodeAt(k);if(55296<=l&&57343>=l){var r=a.charCodeAt(++k);l=65536+((l&1023)<<10)|r&1023}if(127>=l){if(c>=f)break;b[c++>>>0]=l}else{if(2047>=l){if(c+1>=f)break;b[c++>>>0]=192|l>>6}else{if(65535>=l){if(c+2>=f)break;b[c++>>>0]=224|l>>12}else{if(c+3>=
f)break;b[c++>>>0]=240|l>>18;b[c++>>>0]=128|l>>12&63}b[c++>>>0]=128|l>>6&63}b[c++>>>0]=128|l&63}}b[c>>>0]=0;return c-g},W=a=>0===a%4&&(0!==a%100||0===a%400),va=[0,31,60,91,121,152,182,213,244,274,305,335],wa=[0,31,59,90,120,151,181,212,243,273,304,334],Ba=a=>{var b=U(a)+1,c=Aa(b);c&&V(a,K,c,b);return c},X={},Ca=()=>{if(!Y){var a={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:("object"==typeof navigator&&navigator.languages&&navigator.languages[0]||"C").replace("-",
"_")+".UTF-8",_:v||"./this.program"},b;for(b in X)void 0===X[b]?delete a[b]:a[b]=X[b];var c=[];for(b in a)c.push(`${b}=${a[b]}`);Y=c}return Y},Y,Da=[null,[],[]],Ea=[31,29,31,30,31,30,31,31,30,31,30,31],Fa=[31,28,31,30,31,30,31,31,30,31,30,31];function Ga(a){var b=Array(U(a)+1);V(a,b,0,b.length);return b}
function Ha(a,b,c,f){function g(d,n,p){for(d="number"==typeof d?d.toString():d||"";d.length<n;)d=p[0]+d;return d}function k(d,n){return g(d,n,"0")}function l(d,n){function p(xa){return 0>xa?-1:0<xa?1:0}var z;0===(z=p(d.getFullYear()-n.getFullYear()))&&0===(z=p(d.getMonth()-n.getMonth()))&&(z=p(d.getDate()-n.getDate()));return z}function r(d){switch(d.getDay()){case 0:return new Date(d.getFullYear()-1,11,29);case 1:return d;case 2:return new Date(d.getFullYear(),0,3);case 3:return new Date(d.getFullYear(),
0,2);case 4:return new Date(d.getFullYear(),0,1);case 5:return new Date(d.getFullYear()-1,11,31);case 6:return new Date(d.getFullYear()-1,11,30)}}function w(d){var n=d.ka;for(d=new Date((new Date(d.la+1900,0,1)).getTime());0<n;){var p=d.getMonth(),z=(W(d.getFullYear())?Ea:Fa)[p];if(n>z-d.getDate())n-=z-d.getDate()+1,d.setDate(1),11>p?d.setMonth(p+1):(d.setMonth(0),d.setFullYear(d.getFullYear()+1));else{d.setDate(d.getDate()+n);break}}p=new Date(d.getFullYear()+1,0,4);n=r(new Date(d.getFullYear(),
0,4));p=r(p);return 0>=l(n,d)?0>=l(p,d)?d.getFullYear()+1:d.getFullYear():d.getFullYear()-1}a>>>=0;b>>>=0;c>>>=0;f>>>=0;var t=L[f+40>>2>>>0];f={wa:L[f>>2>>>0],va:L[f+4>>2>>>0],ma:L[f+8>>2>>>0],pa:L[f+12>>2>>>0],na:L[f+16>>2>>>0],la:L[f+20>>2>>>0],fa:L[f+24>>2>>>0],ka:L[f+28>>2>>>0],ya:L[f+32>>2>>>0],ua:L[f+36>>2>>>0],xa:t?T(t):""};c=T(c);t={"%c":"%a %b %d %H:%M:%S %Y","%D":"%m/%d/%y","%F":"%Y-%m-%d","%h":"%b","%r":"%I:%M:%S %p","%R":"%H:%M","%T":"%H:%M:%S","%x":"%m/%d/%y","%X":"%H:%M:%S","%Ec":"%c",
"%EC":"%C","%Ex":"%m/%d/%y","%EX":"%H:%M:%S","%Ey":"%y","%EY":"%Y","%Od":"%d","%Oe":"%e","%OH":"%H","%OI":"%I","%Om":"%m","%OM":"%M","%OS":"%S","%Ou":"%u","%OU":"%U","%OV":"%V","%Ow":"%w","%OW":"%W","%Oy":"%y"};for(var u in t)c=c.replace(new RegExp(u,"g"),t[u]);var ya="Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(" "),za="January February March April May June July August September October November December".split(" ");t={"%a":d=>ya[d.fa].substring(0,3),"%A":d=>ya[d.fa],"%b":d=>
za[d.na].substring(0,3),"%B":d=>za[d.na],"%C":d=>k((d.la+1900)/100|0,2),"%d":d=>k(d.pa,2),"%e":d=>g(d.pa,2," "),"%g":d=>w(d).toString().substring(2),"%G":d=>w(d),"%H":d=>k(d.ma,2),"%I":d=>{d=d.ma;0==d?d=12:12<d&&(d-=12);return k(d,2)},"%j":d=>{for(var n=0,p=0;p<=d.na-1;n+=(W(d.la+1900)?Ea:Fa)[p++]);return k(d.pa+n,3)},"%m":d=>k(d.na+1,2),"%M":d=>k(d.va,2),"%n":()=>"\n","%p":d=>0<=d.ma&&12>d.ma?"AM":"PM","%S":d=>k(d.wa,2),"%t":()=>"\t","%u":d=>d.fa||7,"%U":d=>k(Math.floor((d.ka+7-d.fa)/7),2),"%V":d=>
{var n=Math.floor((d.ka+7-(d.fa+6)%7)/7);2>=(d.fa+371-d.ka-2)%7&&n++;if(n)53==n&&(p=(d.fa+371-d.ka)%7,4==p||3==p&&W(d.la)||(n=1));else{n=52;var p=(d.fa+7-d.ka-1)%7;(4==p||5==p&&W(d.la%400-1))&&n++}return k(n,2)},"%w":d=>d.fa,"%W":d=>k(Math.floor((d.ka+7-(d.fa+6)%7)/7),2),"%y":d=>(d.la+1900).toString().substring(2),"%Y":d=>d.la+1900,"%z":d=>{d=d.ua;var n=0<=d;d=Math.abs(d)/60;return(n?"+":"-")+String("0000"+(d/60*100+d%60)).slice(-4)},"%Z":d=>d.xa,"%%":()=>"%"};c=c.replace(/%%/g,"\x00\x00");for(u in t)c.includes(u)&&
(c=c.replace(new RegExp(u,"g"),t[u](f)));c=c.replace(/\0\0/g,"%");u=Ga(c);if(u.length>b)return 0;J.set(u,a>>>0);return u.length-1}
var Ja={a:function(a,b,c){a>>>=0;(new qa(a)).qa(b>>>0,c>>>0);ra=a;sa++;throw ra;},e:function(){return 0},k:function(){},z:function(){},C:function(){},s:function(){return 0},I:function(){},D:function(){},H:function(){},i:function(){},B:function(){},x:function(){},j:function(){},y:function(){},l:()=>!0,o:function(a,b,c){a=b+2097152>>>0<4194305-!!a?(a>>>0)+4294967296*b:NaN;c>>>=0;a=new Date(1E3*a);L[c>>2>>>0]=a.getUTCSeconds();L[c+4>>2>>>0]=a.getUTCMinutes();L[c+8>>2>>>0]=a.getUTCHours();L[c+12>>2>>>
0]=a.getUTCDate();L[c+16>>2>>>0]=a.getUTCMonth();L[c+20>>2>>>0]=a.getUTCFullYear()-1900;L[c+24>>2>>>0]=a.getUTCDay();L[c+28>>2>>>0]=(a.getTime()-Date.UTC(a.getUTCFullYear(),0,1,0,0,0,0))/864E5|0},p:function(a,b,c){a=b+2097152>>>0<4194305-!!a?(a>>>0)+4294967296*b:NaN;c>>>=0;a=new Date(1E3*a);L[c>>2>>>0]=a.getSeconds();L[c+4>>2>>>0]=a.getMinutes();L[c+8>>2>>>0]=a.getHours();L[c+12>>2>>>0]=a.getDate();L[c+16>>2>>>0]=a.getMonth();L[c+20>>2>>>0]=a.getFullYear()-1900;L[c+24>>2>>>0]=a.getDay();L[c+28>>2>>>
0]=(W(a.getFullYear())?va:wa)[a.getMonth()]+a.getDate()-1|0;L[c+36>>2>>>0]=-(60*a.getTimezoneOffset());b=(new Date(a.getFullYear(),6,1)).getTimezoneOffset();var f=(new Date(a.getFullYear(),0,1)).getTimezoneOffset();L[c+32>>2>>>0]=(b!=f&&a.getTimezoneOffset()==Math.min(f,b))|0},q:function(a){a>>>=0;var b=new Date(L[a+20>>2>>>0]+1900,L[a+16>>2>>>0],L[a+12>>2>>>0],L[a+8>>2>>>0],L[a+4>>2>>>0],L[a>>2>>>0],0),c=L[a+32>>2>>>0],f=b.getTimezoneOffset(),g=(new Date(b.getFullYear(),6,1)).getTimezoneOffset(),
k=(new Date(b.getFullYear(),0,1)).getTimezoneOffset(),l=Math.min(k,g);0>c?L[a+32>>2>>>0]=Number(g!=k&&l==f):0<c!=(l==f)&&(g=Math.max(k,g),b.setTime(b.getTime()+6E4*((0<c?l:g)-f)));L[a+24>>2>>>0]=b.getDay();L[a+28>>2>>>0]=(W(b.getFullYear())?va:wa)[b.getMonth()]+b.getDate()-1|0;L[a>>2>>>0]=b.getSeconds();L[a+4>>2>>>0]=b.getMinutes();L[a+8>>2>>>0]=b.getHours();L[a+12>>2>>>0]=b.getDate();L[a+16>>2>>>0]=b.getMonth();L[a+20>>2>>>0]=b.getYear();a=b.getTime()/1E3;return Ia((R=a,1<=+Math.abs(R)?0<R?+Math.floor(R/
4294967296)>>>0:~~+Math.ceil((R-+(~~R>>>0))/4294967296)>>>0:0)),a>>>0},m:function(){return-52},n:function(){},u:function(a,b,c){function f(w){return(w=w.toTimeString().match(/\(([A-Za-z ]+)\)$/))?w[1]:"GMT"}c>>>=0;var g=(new Date).getFullYear(),k=new Date(g,0,1),l=new Date(g,6,1);g=k.getTimezoneOffset();var r=l.getTimezoneOffset();M[a>>>0>>2>>>0]=60*Math.max(g,r);L[b>>>0>>2>>>0]=Number(g!=r);a=f(k);b=f(l);a=Ba(a);b=Ba(b);r<g?(M[c>>2>>>0]=a,M[c+4>>2>>>0]=b):(M[c>>2>>>0]=b,M[c+4>>2>>>0]=a)},d:()=>{G("")},
g:function(){return Date.now()},v:function(){return 4294901760},b:()=>performance.now(),G:function(a,b,c){b>>>=0;return K.copyWithin(a>>>0>>>0,b>>>0,b+(c>>>0)>>>0)},t:function(a){a>>>=0;var b=K.length;if(4294901760<a)return!1;for(var c=1;4>=c;c*=2){var f=b*(1+.2/c);f=Math.min(f,a+100663296);var g=Math;f=Math.max(a,f);a:{g=g.min.call(g,4294901760,f+(65536-f%65536)%65536)-H.buffer.byteLength+65535>>>16;try{H.grow(g);ea();var k=1;break a}catch(l){}k=void 0}if(k)return!0}return!1},E:function(a,b){a>>>=
0;b>>>=0;var c=0;Ca().forEach(function(f,g){var k=b+c;g=M[a+4*g>>2>>>0]=k;for(k=0;k<f.length;++k)J[g++>>0>>>0]=f.charCodeAt(k);J[g>>0>>>0]=0;c+=f.length+1});return 0},F:function(a,b){a>>>=0;b>>>=0;var c=Ca();M[a>>2>>>0]=c.length;var f=0;c.forEach(function(g){f+=g.length+1});M[b>>2>>>0]=f;return 0},f:()=>52,h:function(){return 52},r:function(){return 70},w:function(a,b,c,f){b>>>=0;c>>>=0;f>>>=0;for(var g=0,k=0;k<c;k++){var l=M[b>>2>>>0],r=M[b+4>>2>>>0];b+=8;for(var w=0;w<r;w++){var t=K[l+w>>>0],u=
Da[a];0===t||10===t?((1===a?ca:E)(ua(u,0)),u.length=0):u.push(t)}g+=r}M[f>>2>>>0]=g;return 0},A:Ha,c:function(a,b,c,f){return Ha(a>>>0,b>>>0,c>>>0,f>>>0)}};
(function(){function a(c){c=c.exports;I=c=Ka(c);H=I.J;ea();ha.unshift(I.K);N--;e.monitorRunDependencies&&e.monitorRunDependencies(N);if(0==N&&(null!==O&&(clearInterval(O),O=null),P)){var f=P;P=null;f()}return c}var b={a:Ja};N++;e.monitorRunDependencies&&e.monitorRunDependencies(N);if(e.instantiateWasm)try{return e.instantiateWasm(b,a)}catch(c){E("Module.instantiateWasm callback failed with error: "+c),m(c)}pa(b,function(c){a(c.instance)}).catch(m);return{}})();
e._OrtInit=(a,b)=>(e._OrtInit=I.L)(a,b);e._OrtGetLastError=(a,b)=>(e._OrtGetLastError=I.M)(a,b);e._OrtCreateSessionOptions=(a,b,c,f,g,k,l,r,w,t)=>(e._OrtCreateSessionOptions=I.N)(a,b,c,f,g,k,l,r,w,t);e._OrtAppendExecutionProvider=(a,b)=>(e._OrtAppendExecutionProvider=I.O)(a,b);e._OrtAddSessionConfigEntry=(a,b,c)=>(e._OrtAddSessionConfigEntry=I.P)(a,b,c);e._OrtReleaseSessionOptions=a=>(e._OrtReleaseSessionOptions=I.Q)(a);e._OrtCreateSession=(a,b,c)=>(e._OrtCreateSession=I.R)(a,b,c);
e._OrtReleaseSession=a=>(e._OrtReleaseSession=I.S)(a);e._OrtGetInputOutputCount=(a,b,c)=>(e._OrtGetInputOutputCount=I.T)(a,b,c);e._OrtGetInputName=(a,b)=>(e._OrtGetInputName=I.U)(a,b);e._OrtGetOutputName=(a,b)=>(e._OrtGetOutputName=I.V)(a,b);e._OrtFree=a=>(e._OrtFree=I.W)(a);e._OrtCreateTensor=(a,b,c,f,g)=>(e._OrtCreateTensor=I.X)(a,b,c,f,g);e._OrtGetTensorData=(a,b,c,f,g)=>(e._OrtGetTensorData=I.Y)(a,b,c,f,g);e._OrtReleaseTensor=a=>(e._OrtReleaseTensor=I.Z)(a);
e._OrtCreateRunOptions=(a,b,c,f)=>(e._OrtCreateRunOptions=I._)(a,b,c,f);e._OrtAddRunConfigEntry=(a,b,c)=>(e._OrtAddRunConfigEntry=I.$)(a,b,c);e._OrtReleaseRunOptions=a=>(e._OrtReleaseRunOptions=I.aa)(a);e._OrtRun=(a,b,c,f,g,k,l,r)=>(e._OrtRun=I.ba)(a,b,c,f,g,k,l,r);e._OrtEndProfiling=a=>(e._OrtEndProfiling=I.ca)(a);var Aa=e._malloc=a=>(Aa=e._malloc=I.da)(a);e._free=a=>(e._free=I.ea)(a);var Ia=a=>(Ia=I.ga)(a),La=()=>(La=I.ha)(),Ma=a=>(Ma=I.ia)(a),Na=a=>(Na=I.ja)(a);
function Ka(a){a=Object.assign({},a);var b=f=>()=>f()>>>0,c=f=>g=>f(g)>>>0;a.__errno_location=b(a.__errno_location);a.malloc=c(a.malloc);a.stackSave=b(a.stackSave);a.stackAlloc=c(a.stackAlloc);return a}e.stackAlloc=Na;e.stackSave=La;e.stackRestore=Ma;e.UTF8ToString=T;e.stringToUTF8=(a,b,c)=>V(a,K,b,c);e.lengthBytesUTF8=U;var Z;P=function Oa(){Z||Pa();Z||(P=Oa)};
function Pa(){function a(){if(!Z&&(Z=!0,e.calledRun=!0,!da)){S(ha);h(e);if(e.onRuntimeInitialized)e.onRuntimeInitialized();if(e.postRun)for("function"==typeof e.postRun&&(e.postRun=[e.postRun]);e.postRun.length;){var b=e.postRun.shift();ia.unshift(b)}S(ia)}}if(!(0<N)){if(e.preRun)for("function"==typeof e.preRun&&(e.preRun=[e.preRun]);e.preRun.length;)ja();S(fa);0<N||(e.setStatus?(e.setStatus("Running..."),setTimeout(function(){setTimeout(function(){e.setStatus("")},1);a()},1)):a())}}
if(e.preInit)for("function"==typeof e.preInit&&(e.preInit=[e.preInit]);0<e.preInit.length;)e.preInit.pop()();Pa();
  return moduleArg.ready
}
);
})();
if (true)
  module.exports = ortWasm;
else {}
/***/ }),
/***/ "?63c8":
/*!********************!*\
  !*** fs (ignored) ***!
  \********************/
/***/ (() => {
/* (ignored) */
/***/ }),
/***/ "?75c6":
/*!**********************!*\
  !*** path (ignored) ***!
  \**********************/
/***/ (() => {
/* (ignored) */
/***/ }),
/***/ "?295d":
/*!********************!*\
  !*** fs (ignored) ***!
  \********************/
/***/ (() => {
/* (ignored) */
/***/ }),
/***/ "?7aa5":
/*!**********************!*\
  !*** path (ignored) ***!
  \**********************/
/***/ (() => {
/* (ignored) */
/***/ }),
/***/ "?cf98":
/*!**********************!*\
  !*** util (ignored) ***!
  \**********************/
/***/ (() => {
/* (ignored) */
/***/ }),
/***/ "?0757":
/*!********************!*\
  !*** os (ignored) ***!
  \********************/
/***/ (() => {
/* (ignored) */
/***/ }),
/***/ "../common/dist/cjs/backend-impl.js":
/*!******************************************!*\
  !*** ../common/dist/cjs/backend-impl.js ***!
  \******************************************/
/***/ ((__unused_webpack_module, exports) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.resolveBackend = exports.registerBackend = void 0;
const backends = {};
const backendsSortedByPriority = [];
/**
 * Register a backend.
 *
 * @param name - the name as a key to lookup as an execution provider.
 * @param backend - the backend object.
 * @param priority - an integer indicating the priority of the backend. Higher number means higher priority. if priority
 * < 0, it will be considered as a 'beta' version and will not be used as a fallback backend by default.
 *
 * @internal
 */
const registerBackend = (name, backend, priority) => {
    if (backend && typeof backend.init === 'function' && typeof backend.createSessionHandler === 'function') {
        const currentBackend = backends[name];
        if (currentBackend === undefined) {
            backends[name] = { backend, priority };
        }
        else if (currentBackend.priority > priority) {
            // same name is already registered with a higher priority. skip registeration.
            return;
        }
        else if (currentBackend.priority === priority) {
            if (currentBackend.backend !== backend) {
                throw new Error(`cannot register backend "${name}" using priority ${priority}`);
            }
        }
        if (priority >= 0) {
            const i = backendsSortedByPriority.indexOf(name);
            if (i !== -1) {
                backendsSortedByPriority.splice(i, 1);
            }
            for (let i = 0; i < backendsSortedByPriority.length; i++) {
                if (backends[backendsSortedByPriority[i]].priority <= priority) {
                    backendsSortedByPriority.splice(i, 0, name);
                    return;
                }
            }
            backendsSortedByPriority.push(name);
        }
        return;
    }
    throw new TypeError('not a valid backend');
};
exports.registerBackend = registerBackend;
/**
 * Resolve backend by specified hints.
 *
 * @param backendHints - a list of execution provider names to lookup. If omitted use registered backends as list.
 * @returns a promise that resolves to the backend.
 *
 * @internal
 */
const resolveBackend = async (backendHints) => {
    const backendNames = backendHints.length === 0 ? backendsSortedByPriority : backendHints;
    const errors = [];
    for (const backendName of backendNames) {
        const backendInfo = backends[backendName];
        if (backendInfo) {
            if (backendInfo.initialized) {
                return backendInfo.backend;
            }
            else if (backendInfo.aborted) {
                continue; // current backend is unavailable; try next
            }
            const isInitializing = !!backendInfo.initPromise;
            try {
                if (!isInitializing) {
                    backendInfo.initPromise = backendInfo.backend.init();
                }
                await backendInfo.initPromise;
                backendInfo.initialized = true;
                return backendInfo.backend;
            }
            catch (e) {
                if (!isInitializing) {
                    errors.push({ name: backendName, err: e });
                }
                backendInfo.aborted = true;
            }
            finally {
                delete backendInfo.initPromise;
            }
        }
    }
    throw new Error(`no available backend found. ERR: ${errors.map(e => `[${e.name}] ${e.err}`).join(', ')}`);
};
exports.resolveBackend = resolveBackend;
//# sourceMappingURL=backend-impl.js.map
/***/ }),
/***/ "../common/dist/cjs/backend.js":
/*!*************************************!*\
  !*** ../common/dist/cjs/backend.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.registerBackend = void 0;
var backend_impl_js_1 = __webpack_require__(/*! ./backend-impl.js */ "../common/dist/cjs/backend-impl.js");
Object.defineProperty(exports, "registerBackend", ({ enumerable: true, get: function () { return backend_impl_js_1.registerBackend; } }));
//# sourceMappingURL=backend.js.map
/***/ }),
/***/ "../common/dist/cjs/env-impl.js":
/*!**************************************!*\
  !*** ../common/dist/cjs/env-impl.js ***!
  \**************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.env = void 0;
const version_js_1 = __webpack_require__(/*! ./version.js */ "../common/dist/cjs/version.js");
let logLevelValue = 'warning';
exports.env = {
    wasm: {},
    webgl: {},
    webgpu: {},
    versions: { common: version_js_1.version },
    set logLevel(value) {
        if (value === undefined) {
            return;
        }
        if (typeof value !== 'string' || ['verbose', 'info', 'warning', 'error', 'fatal'].indexOf(value) === -1) {
            throw new Error(`Unsupported logging level: ${value}`);
        }
        logLevelValue = value;
    },
    get logLevel() {
        return logLevelValue;
    },
};
// set property 'logLevel' so that they can be correctly transferred to worker by `postMessage()`.
Object.defineProperty(exports.env, 'logLevel', { enumerable: true });
//# sourceMappingURL=env-impl.js.map
/***/ }),
/***/ "../common/dist/cjs/env.js":
/*!*********************************!*\
  !*** ../common/dist/cjs/env.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.env = void 0;
const env_impl_js_1 = __webpack_require__(/*! ./env-impl.js */ "../common/dist/cjs/env-impl.js");
/**
 * Represent a set of flags as a global singleton.
 */
exports.env = env_impl_js_1.env;
//# sourceMappingURL=env.js.map
/***/ }),
/***/ "../common/dist/cjs/index.js":
/*!***********************************!*\
  !*** ../common/dist/cjs/index.js ***!
  \***********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
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
Object.defineProperty(exports, "__esModule", ({ value: true }));
/**
 * # ONNX Runtime JavaScript API
 *
 * ONNX Runtime JavaScript API is a unified API for all JavaScript usages, including the following NPM packages:
 *
 * - [onnxruntime-node](https://www.npmjs.com/package/onnxruntime-node)
 * - [onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web)
 * - [onnxruntime-react-native](https://www.npmjs.com/package/onnxruntime-react-native)
 *
 * See also:
 * - [Get Started](https://onnxruntime.ai/docs/get-started/with-javascript.html)
 * - [Inference examples](https://github.com/microsoft/onnxruntime-inference-examples/tree/main/js)
 *
 * @packageDocumentation
 */
__exportStar(__webpack_require__(/*! ./backend.js */ "../common/dist/cjs/backend.js"), exports);
__exportStar(__webpack_require__(/*! ./env.js */ "../common/dist/cjs/env.js"), exports);
__exportStar(__webpack_require__(/*! ./inference-session.js */ "../common/dist/cjs/inference-session.js"), exports);
__exportStar(__webpack_require__(/*! ./tensor.js */ "../common/dist/cjs/tensor.js"), exports);
__exportStar(__webpack_require__(/*! ./onnx-value.js */ "../common/dist/cjs/onnx-value.js"), exports);
//# sourceMappingURL=index.js.map
/***/ }),
/***/ "../common/dist/cjs/inference-session-impl.js":
/*!****************************************************!*\
  !*** ../common/dist/cjs/inference-session-impl.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.InferenceSession = void 0;
const backend_impl_js_1 = __webpack_require__(/*! ./backend-impl.js */ "../common/dist/cjs/backend-impl.js");
const tensor_js_1 = __webpack_require__(/*! ./tensor.js */ "../common/dist/cjs/tensor.js");
class InferenceSession {
    constructor(handler) {
        this.handler = handler;
    }
    async run(feeds, arg1, arg2) {
        const fetches = {};
        let options = {};
        // check inputs
        if (typeof feeds !== 'object' || feeds === null || feeds instanceof tensor_js_1.Tensor || Array.isArray(feeds)) {
            throw new TypeError('\'feeds\' must be an object that use input names as keys and OnnxValue as corresponding values.');
        }
        let isFetchesEmpty = true;
        // determine which override is being used
        if (typeof arg1 === 'object') {
            if (arg1 === null) {
                throw new TypeError('Unexpected argument[1]: cannot be null.');
            }
            if (arg1 instanceof tensor_js_1.Tensor) {
                throw new TypeError('\'fetches\' cannot be a Tensor');
            }
            if (Array.isArray(arg1)) {
                if (arg1.length === 0) {
                    throw new TypeError('\'fetches\' cannot be an empty array.');
                }
                isFetchesEmpty = false;
                // output names
                for (const name of arg1) {
                    if (typeof name !== 'string') {
                        throw new TypeError('\'fetches\' must be a string array or an object.');
                    }
                    if (this.outputNames.indexOf(name) === -1) {
                        throw new RangeError(`'fetches' contains invalid output name: ${name}.`);
                    }
                    fetches[name] = null;
                }
                if (typeof arg2 === 'object' && arg2 !== null) {
                    options = arg2;
                }
                else if (typeof arg2 !== 'undefined') {
                    throw new TypeError('\'options\' must be an object.');
                }
            }
            else {
                // decide whether arg1 is fetches or options
                // if any output name is present and its value is valid OnnxValue, we consider it fetches
                let isFetches = false;
                const arg1Keys = Object.getOwnPropertyNames(arg1);
                for (const name of this.outputNames) {
                    if (arg1Keys.indexOf(name) !== -1) {
                        const v = arg1[name];
                        if (v === null || v instanceof tensor_js_1.Tensor) {
                            isFetches = true;
                            isFetchesEmpty = false;
                            fetches[name] = v;
                        }
                    }
                }
                if (isFetches) {
                    if (typeof arg2 === 'object' && arg2 !== null) {
                        options = arg2;
                    }
                    else if (typeof arg2 !== 'undefined') {
                        throw new TypeError('\'options\' must be an object.');
                    }
                }
                else {
                    options = arg1;
                }
            }
        }
        else if (typeof arg1 !== 'undefined') {
            throw new TypeError('Unexpected argument[1]: must be \'fetches\' or \'options\'.');
        }
        // check if all inputs are in feed
        for (const name of this.inputNames) {
            if (typeof feeds[name] === 'undefined') {
                throw new Error(`input '${name}' is missing in 'feeds'.`);
            }
        }
        // if no fetches is specified, we use the full output names list
        if (isFetchesEmpty) {
            for (const name of this.outputNames) {
                fetches[name] = null;
            }
        }
        // feeds, fetches and options are prepared
        const results = await this.handler.run(feeds, fetches, options);
        const returnValue = {};
        for (const key in results) {
            if (Object.hasOwnProperty.call(results, key)) {
                returnValue[key] = new tensor_js_1.Tensor(results[key].type, results[key].data, results[key].dims);
            }
        }
        return returnValue;
    }
    async release() {
        return this.handler.dispose();
    }
    static async create(arg0, arg1, arg2, arg3) {
        // either load from a file or buffer
        let filePathOrUint8Array;
        let options = {};
        if (typeof arg0 === 'string') {
            filePathOrUint8Array = arg0;
            if (typeof arg1 === 'object' && arg1 !== null) {
                options = arg1;
            }
            else if (typeof arg1 !== 'undefined') {
                throw new TypeError('\'options\' must be an object.');
            }
        }
        else if (arg0 instanceof Uint8Array) {
            filePathOrUint8Array = arg0;
            if (typeof arg1 === 'object' && arg1 !== null) {
                options = arg1;
            }
            else if (typeof arg1 !== 'undefined') {
                throw new TypeError('\'options\' must be an object.');
            }
        }
        else if (arg0 instanceof ArrayBuffer ||
            (typeof SharedArrayBuffer !== 'undefined' && arg0 instanceof SharedArrayBuffer)) {
            const buffer = arg0;
            let byteOffset = 0;
            let byteLength = arg0.byteLength;
            if (typeof arg1 === 'object' && arg1 !== null) {
                options = arg1;
            }
            else if (typeof arg1 === 'number') {
                byteOffset = arg1;
                if (!Number.isSafeInteger(byteOffset)) {
                    throw new RangeError('\'byteOffset\' must be an integer.');
                }
                if (byteOffset < 0 || byteOffset >= buffer.byteLength) {
                    throw new RangeError(`'byteOffset' is out of range [0, ${buffer.byteLength}).`);
                }
                byteLength = arg0.byteLength - byteOffset;
                if (typeof arg2 === 'number') {
                    byteLength = arg2;
                    if (!Number.isSafeInteger(byteLength)) {
                        throw new RangeError('\'byteLength\' must be an integer.');
                    }
                    if (byteLength <= 0 || byteOffset + byteLength > buffer.byteLength) {
                        throw new RangeError(`'byteLength' is out of range (0, ${buffer.byteLength - byteOffset}].`);
                    }
                    if (typeof arg3 === 'object' && arg3 !== null) {
                        options = arg3;
                    }
                    else if (typeof arg3 !== 'undefined') {
                        throw new TypeError('\'options\' must be an object.');
                    }
                }
                else if (typeof arg2 !== 'undefined') {
                    throw new TypeError('\'byteLength\' must be a number.');
                }
            }
            else if (typeof arg1 !== 'undefined') {
                throw new TypeError('\'options\' must be an object.');
            }
            filePathOrUint8Array = new Uint8Array(buffer, byteOffset, byteLength);
        }
        else {
            throw new TypeError('Unexpected argument[0]: must be \'path\' or \'buffer\'.');
        }
        // get backend hints
        const eps = options.executionProviders || [];
        const backendHints = eps.map(i => typeof i === 'string' ? i : i.name);
        const backend = await (0, backend_impl_js_1.resolveBackend)(backendHints);
        const handler = await backend.createSessionHandler(filePathOrUint8Array, options);
        return new InferenceSession(handler);
    }
    startProfiling() {
        this.handler.startProfiling();
    }
    endProfiling() {
        this.handler.endProfiling();
    }
    get inputNames() {
        return this.handler.inputNames;
    }
    get outputNames() {
        return this.handler.outputNames;
    }
}
exports.InferenceSession = InferenceSession;
//# sourceMappingURL=inference-session-impl.js.map
/***/ }),
/***/ "../common/dist/cjs/inference-session.js":
/*!***********************************************!*\
  !*** ../common/dist/cjs/inference-session.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.InferenceSession = void 0;
const inference_session_impl_js_1 = __webpack_require__(/*! ./inference-session-impl.js */ "../common/dist/cjs/inference-session-impl.js");
// eslint-disable-next-line @typescript-eslint/naming-convention
exports.InferenceSession = inference_session_impl_js_1.InferenceSession;
//# sourceMappingURL=inference-session.js.map
/***/ }),
/***/ "../common/dist/cjs/onnx-value.js":
/*!****************************************!*\
  !*** ../common/dist/cjs/onnx-value.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, exports) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
//# sourceMappingURL=onnx-value.js.map
/***/ }),
/***/ "../common/dist/cjs/tensor-conversion-impl.js":
/*!****************************************************!*\
  !*** ../common/dist/cjs/tensor-conversion-impl.js ***!
  \****************************************************/
/***/ ((__unused_webpack_module, exports) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.tensorToImageData = exports.tensorToDataURL = void 0;
/**
 * implementation of Tensor.toDataURL()
 */
const tensorToDataURL = (tensor, options) => {
    const canvas = document.createElement('canvas');
    canvas.width = tensor.dims[3];
    canvas.height = tensor.dims[2];
    const pixels2DContext = canvas.getContext('2d');
    if (pixels2DContext != null) {
        // Default values for height and width & format
        let width;
        let height;
        if (options?.tensorLayout !== undefined && options.tensorLayout === 'NHWC') {
            width = tensor.dims[2];
            height = tensor.dims[3];
        }
        else { // Default layout is NCWH
            width = tensor.dims[3];
            height = tensor.dims[2];
        }
        const inputformat = options?.format !== undefined ? options.format : 'RGB';
        const norm = options?.norm;
        let normMean;
        let normBias;
        if (norm === undefined || norm.mean === undefined) {
            normMean = [255, 255, 255, 255];
        }
        else {
            if (typeof (norm.mean) === 'number') {
                normMean = [norm.mean, norm.mean, norm.mean, norm.mean];
            }
            else {
                normMean = [norm.mean[0], norm.mean[1], norm.mean[2], 0];
                if (norm.mean[3] !== undefined) {
                    normMean[3] = norm.mean[3];
                }
            }
        }
        if (norm === undefined || norm.bias === undefined) {
            normBias = [0, 0, 0, 0];
        }
        else {
            if (typeof (norm.bias) === 'number') {
                normBias = [norm.bias, norm.bias, norm.bias, norm.bias];
            }
            else {
                normBias = [norm.bias[0], norm.bias[1], norm.bias[2], 0];
                if (norm.bias[3] !== undefined) {
                    normBias[3] = norm.bias[3];
                }
            }
        }
        const stride = height * width;
        // Default pointer assignments
        let rTensorPointer = 0, gTensorPointer = stride, bTensorPointer = stride * 2, aTensorPointer = -1;
        // Updating the pointer assignments based on the input image format
        if (inputformat === 'RGBA') {
            rTensorPointer = 0;
            gTensorPointer = stride;
            bTensorPointer = stride * 2;
            aTensorPointer = stride * 3;
        }
        else if (inputformat === 'RGB') {
            rTensorPointer = 0;
            gTensorPointer = stride;
            bTensorPointer = stride * 2;
        }
        else if (inputformat === 'RBG') {
            rTensorPointer = 0;
            bTensorPointer = stride;
            gTensorPointer = stride * 2;
        }
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const R = (tensor.data[rTensorPointer++] - normBias[0]) * normMean[0]; // R value
                const G = (tensor.data[gTensorPointer++] - normBias[1]) * normMean[1]; // G value
                const B = (tensor.data[bTensorPointer++] - normBias[2]) * normMean[2]; // B value
                const A = aTensorPointer === -1 ?
                    255 :
                    (tensor.data[aTensorPointer++] - normBias[3]) * normMean[3]; // A value
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                pixels2DContext.fillStyle = 'rgba(' + R + ',' + G + ',' + B + ',' + A + ')';
                pixels2DContext.fillRect(j, i, 1, 1);
            }
        }
        return canvas.toDataURL();
    }
    else {
        throw new Error('Can not access image data');
    }
};
exports.tensorToDataURL = tensorToDataURL;
/**
 * implementation of Tensor.toImageData()
 */
const tensorToImageData = (tensor, options) => {
    const pixels2DContext = document.createElement('canvas').getContext('2d');
    let image;
    if (pixels2DContext != null) {
        // Default values for height and width & format
        let width;
        let height;
        let channels;
        if (options?.tensorLayout !== undefined && options.tensorLayout === 'NHWC') {
            width = tensor.dims[2];
            height = tensor.dims[1];
            channels = tensor.dims[3];
        }
        else { // Default layout is NCWH
            width = tensor.dims[3];
            height = tensor.dims[2];
            channels = tensor.dims[1];
        }
        const inputformat = options !== undefined ? (options.format !== undefined ? options.format : 'RGB') : 'RGB';
        const norm = options?.norm;
        let normMean;
        let normBias;
        if (norm === undefined || norm.mean === undefined) {
            normMean = [255, 255, 255, 255];
        }
        else {
            if (typeof (norm.mean) === 'number') {
                normMean = [norm.mean, norm.mean, norm.mean, norm.mean];
            }
            else {
                normMean = [norm.mean[0], norm.mean[1], norm.mean[2], 255];
                if (norm.mean[3] !== undefined) {
                    normMean[3] = norm.mean[3];
                }
            }
        }
        if (norm === undefined || norm.bias === undefined) {
            normBias = [0, 0, 0, 0];
        }
        else {
            if (typeof (norm.bias) === 'number') {
                normBias = [norm.bias, norm.bias, norm.bias, norm.bias];
            }
            else {
                normBias = [norm.bias[0], norm.bias[1], norm.bias[2], 0];
                if (norm.bias[3] !== undefined) {
                    normBias[3] = norm.bias[3];
                }
            }
        }
        const stride = height * width;
        if (options !== undefined) {
            if (options.format !== undefined && (channels === 4 && options.format !== 'RGBA') ||
                (channels === 3 && (options.format !== 'RGB' && options.format !== 'BGR'))) {
                throw new Error('Tensor format doesn\'t match input tensor dims');
            }
        }
        // Default pointer assignments
        const step = 4;
        let rImagePointer = 0, gImagePointer = 1, bImagePointer = 2, aImagePointer = 3;
        let rTensorPointer = 0, gTensorPointer = stride, bTensorPointer = stride * 2, aTensorPointer = -1;
        // Updating the pointer assignments based on the input image format
        if (inputformat === 'RGBA') {
            rTensorPointer = 0;
            gTensorPointer = stride;
            bTensorPointer = stride * 2;
            aTensorPointer = stride * 3;
        }
        else if (inputformat === 'RGB') {
            rTensorPointer = 0;
            gTensorPointer = stride;
            bTensorPointer = stride * 2;
        }
        else if (inputformat === 'RBG') {
            rTensorPointer = 0;
            bTensorPointer = stride;
            gTensorPointer = stride * 2;
        }
        image = pixels2DContext.createImageData(width, height);
        for (let i = 0; i < height * width; rImagePointer += step, gImagePointer += step, bImagePointer += step, aImagePointer += step, i++) {
            image.data[rImagePointer] = (tensor.data[rTensorPointer++] - normBias[0]) * normMean[0]; // R value
            image.data[gImagePointer] = (tensor.data[gTensorPointer++] - normBias[1]) * normMean[1]; // G value
            image.data[bImagePointer] = (tensor.data[bTensorPointer++] - normBias[2]) * normMean[2]; // B value
            image.data[aImagePointer] = aTensorPointer === -1 ?
                255 :
                (tensor.data[aTensorPointer++] - normBias[3]) * normMean[3]; // A value
        }
    }
    else {
        throw new Error('Can not access image data');
    }
    return image;
};
exports.tensorToImageData = tensorToImageData;
//# sourceMappingURL=tensor-conversion-impl.js.map
/***/ }),
/***/ "../common/dist/cjs/tensor-factory-impl.js":
/*!*************************************************!*\
  !*** ../common/dist/cjs/tensor-factory-impl.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.tensorFromPinnedBuffer = exports.tensorFromGpuBuffer = exports.tensorFromTexture = exports.tensorFromImage = exports.bufferToTensor = void 0;
const tensor_impl_js_1 = __webpack_require__(/*! ./tensor-impl.js */ "../common/dist/cjs/tensor-impl.js");
/**
 * Create a new tensor object from image object
 *
 * @param buffer - Extracted image buffer data - assuming RGBA format
 * @param imageFormat - input image configuration - required configurations height, width, format
 * @param tensorFormat - output tensor configuration - Default is RGB format
 */
const bufferToTensor = (buffer, options) => {
    if (buffer === undefined) {
        throw new Error('Image buffer must be defined');
    }
    if (options.height === undefined || options.width === undefined) {
        throw new Error('Image height and width must be defined');
    }
    if (options.tensorLayout === 'NHWC') {
        throw new Error('NHWC Tensor layout is not supported yet');
    }
    const { height, width } = options;
    const norm = options.norm ?? { mean: 255, bias: 0 };
    let normMean;
    let normBias;
    if (typeof (norm.mean) === 'number') {
        normMean = [norm.mean, norm.mean, norm.mean, norm.mean];
    }
    else {
        normMean = [norm.mean[0], norm.mean[1], norm.mean[2], norm.mean[3] ?? 255];
    }
    if (typeof (norm.bias) === 'number') {
        normBias = [norm.bias, norm.bias, norm.bias, norm.bias];
    }
    else {
        normBias = [norm.bias[0], norm.bias[1], norm.bias[2], norm.bias[3] ?? 0];
    }
    const inputformat = options.format !== undefined ? options.format : 'RGBA';
    // default value is RGBA since imagedata and HTMLImageElement uses it
    const outputformat = options.tensorFormat !== undefined ? (options.tensorFormat !== undefined ? options.tensorFormat : 'RGB') : 'RGB';
    const stride = height * width;
    const float32Data = outputformat === 'RGBA' ? new Float32Array(stride * 4) : new Float32Array(stride * 3);
    // Default pointer assignments
    let step = 4, rImagePointer = 0, gImagePointer = 1, bImagePointer = 2, aImagePointer = 3;
    let rTensorPointer = 0, gTensorPointer = stride, bTensorPointer = stride * 2, aTensorPointer = -1;
    // Updating the pointer assignments based on the input image format
    if (inputformat === 'RGB') {
        step = 3;
        rImagePointer = 0;
        gImagePointer = 1;
        bImagePointer = 2;
        aImagePointer = -1;
    }
    // Updating the pointer assignments based on the output tensor format
    if (outputformat === 'RGBA') {
        aTensorPointer = stride * 3;
    }
    else if (outputformat === 'RBG') {
        rTensorPointer = 0;
        bTensorPointer = stride;
        gTensorPointer = stride * 2;
    }
    else if (outputformat === 'BGR') {
        bTensorPointer = 0;
        gTensorPointer = stride;
        rTensorPointer = stride * 2;
    }
    for (let i = 0; i < stride; i++, rImagePointer += step, bImagePointer += step, gImagePointer += step, aImagePointer += step) {
        float32Data[rTensorPointer++] = (buffer[rImagePointer] + normBias[0]) / normMean[0];
        float32Data[gTensorPointer++] = (buffer[gImagePointer] + normBias[1]) / normMean[1];
        float32Data[bTensorPointer++] = (buffer[bImagePointer] + normBias[2]) / normMean[2];
        if (aTensorPointer !== -1 && aImagePointer !== -1) {
            float32Data[aTensorPointer++] = (buffer[aImagePointer] + normBias[3]) / normMean[3];
        }
    }
    // Float32Array -> ort.Tensor
    const outputTensor = outputformat === 'RGBA' ? new tensor_impl_js_1.Tensor('float32', float32Data, [1, 4, height, width]) :
        new tensor_impl_js_1.Tensor('float32', float32Data, [1, 3, height, width]);
    return outputTensor;
};
exports.bufferToTensor = bufferToTensor;
/**
 * implementation of Tensor.fromImage().
 */
const tensorFromImage = async (image, options) => {
    // checking the type of image object
    const isHTMLImageEle = typeof (HTMLImageElement) !== 'undefined' && image instanceof HTMLImageElement;
    const isImageDataEle = typeof (ImageData) !== 'undefined' && image instanceof ImageData;
    const isImageBitmap = typeof (ImageBitmap) !== 'undefined' && image instanceof ImageBitmap;
    const isString = typeof image === 'string';
    let data;
    let bufferToTensorOptions = options ?? {};
    // filling and checking image configuration options
    if (isHTMLImageEle) {
        // HTMLImageElement - image object - format is RGBA by default
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const pixels2DContext = canvas.getContext('2d');
        if (pixels2DContext != null) {
            let height = image.height;
            let width = image.width;
            if (options !== undefined && options.resizedHeight !== undefined && options.resizedWidth !== undefined) {
                height = options.resizedHeight;
                width = options.resizedWidth;
            }
            if (options !== undefined) {
                bufferToTensorOptions = options;
                if (options.tensorFormat !== undefined) {
                    throw new Error('Image input config format must be RGBA for HTMLImageElement');
                }
                else {
                    bufferToTensorOptions.tensorFormat = 'RGBA';
                }
                bufferToTensorOptions.height = height;
                bufferToTensorOptions.width = width;
            }
            else {
                bufferToTensorOptions.tensorFormat = 'RGBA';
                bufferToTensorOptions.height = height;
                bufferToTensorOptions.width = width;
            }
            pixels2DContext.drawImage(image, 0, 0);
            data = pixels2DContext.getImageData(0, 0, width, height).data;
        }
        else {
            throw new Error('Can not access image data');
        }
    }
    else if (isImageDataEle) {
        let height;
        let width;
        if (options !== undefined && options.resizedWidth !== undefined && options.resizedHeight !== undefined) {
            height = options.resizedHeight;
            width = options.resizedWidth;
        }
        else {
            height = image.height;
            width = image.width;
        }
        if (options !== undefined) {
            bufferToTensorOptions = options;
        }
        bufferToTensorOptions.format = 'RGBA';
        bufferToTensorOptions.height = height;
        bufferToTensorOptions.width = width;
        if (options !== undefined) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const pixels2DContext = tempCanvas.getContext('2d');
            if (pixels2DContext != null) {
                pixels2DContext.putImageData(image, 0, 0);
                data = pixels2DContext.getImageData(0, 0, width, height).data;
            }
            else {
                throw new Error('Can not access image data');
            }
        }
        else {
            data = image.data;
        }
    }
    else if (isImageBitmap) {
        // ImageBitmap - image object - format must be provided by user
        if (options === undefined) {
            throw new Error('Please provide image config with format for Imagebitmap');
        }
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const pixels2DContext = canvas.getContext('2d');
        if (pixels2DContext != null) {
            const height = image.height;
            const width = image.width;
            pixels2DContext.drawImage(image, 0, 0, width, height);
            data = pixels2DContext.getImageData(0, 0, width, height).data;
            bufferToTensorOptions.height = height;
            bufferToTensorOptions.width = width;
            return (0, exports.bufferToTensor)(data, bufferToTensorOptions);
        }
        else {
            throw new Error('Can not access image data');
        }
    }
    else if (isString) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!image || !context) {
                return reject();
            }
            const newImage = new Image();
            newImage.crossOrigin = 'Anonymous';
            newImage.src = image;
            newImage.onload = () => {
                canvas.width = newImage.width;
                canvas.height = newImage.height;
                context.drawImage(newImage, 0, 0, canvas.width, canvas.height);
                const img = context.getImageData(0, 0, canvas.width, canvas.height);
                bufferToTensorOptions.height = canvas.height;
                bufferToTensorOptions.width = canvas.width;
                resolve((0, exports.bufferToTensor)(img.data, bufferToTensorOptions));
            };
        });
    }
    else {
        throw new Error('Input data provided is not supported - aborted tensor creation');
    }
    if (data !== undefined) {
        return (0, exports.bufferToTensor)(data, bufferToTensorOptions);
    }
    else {
        throw new Error('Input data provided is not supported - aborted tensor creation');
    }
};
exports.tensorFromImage = tensorFromImage;
/**
 * implementation of Tensor.fromTexture().
 */
const tensorFromTexture = (texture, options) => {
    const { width, height, download, dispose } = options;
    // Always assume RGBAF32. TODO: support different texture format
    const dims = [1, height, width, 4];
    return new tensor_impl_js_1.Tensor({ location: 'texture', type: 'float32', texture, dims, download, dispose });
};
exports.tensorFromTexture = tensorFromTexture;
/**
 * implementation of Tensor.fromGpuBuffer().
 */
const tensorFromGpuBuffer = (gpuBuffer, options) => {
    const { dataType, dims, download, dispose } = options;
    return new tensor_impl_js_1.Tensor({ location: 'gpu-buffer', type: dataType ?? 'float32', gpuBuffer, dims, download, dispose });
};
exports.tensorFromGpuBuffer = tensorFromGpuBuffer;
/**
 * implementation of Tensor.fromPinnedBuffer().
 */
const tensorFromPinnedBuffer = (type, buffer, dims) => new tensor_impl_js_1.Tensor({ location: 'cpu-pinned', type, data: buffer, dims: dims ?? [buffer.length] });
exports.tensorFromPinnedBuffer = tensorFromPinnedBuffer;
//# sourceMappingURL=tensor-factory-impl.js.map
/***/ }),
/***/ "../common/dist/cjs/tensor-impl-type-mapping.js":
/*!******************************************************!*\
  !*** ../common/dist/cjs/tensor-impl-type-mapping.js ***!
  \******************************************************/
/***/ ((__unused_webpack_module, exports) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.checkBigInt = exports.NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP = exports.NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP = void 0;
// a runtime map that maps type string to TypedArray constructor. Should match Tensor.DataTypeMap.
exports.NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP = new Map([
    ['float32', Float32Array],
    ['uint8', Uint8Array],
    ['int8', Int8Array],
    ['uint16', Uint16Array],
    ['float16', Uint16Array],
    ['int16', Int16Array],
    ['int32', Int32Array],
    ['bool', Uint8Array],
    ['float64', Float64Array],
    ['uint32', Uint32Array],
]);
// a runtime map that maps type string to TypedArray constructor. Should match Tensor.DataTypeMap.
exports.NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP = new Map([
    [Float32Array, 'float32'],
    [Uint8Array, 'uint8'],
    [Int8Array, 'int8'],
    [Uint16Array, 'uint16'],
    [Int16Array, 'int16'],
    [Int32Array, 'int32'],
    [Float64Array, 'float64'],
    [Uint32Array, 'uint32'],
]);
// the following code allows delaying execution of BigInt checking. This allows lazy initialization for
// NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP and NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP, which allows BigInt polyfill
// if available.
let isBigIntChecked = false;
const checkBigInt = () => {
    if (!isBigIntChecked) {
        isBigIntChecked = true;
        const isBigInt64ArrayAvailable = typeof BigInt64Array !== 'undefined' && typeof BigInt64Array.from === 'function';
        const isBigUint64ArrayAvailable = typeof BigUint64Array !== 'undefined' && typeof BigUint64Array.from === 'function';
        if (isBigInt64ArrayAvailable) {
            exports.NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.set('int64', BigInt64Array);
            exports.NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP.set(BigInt64Array, 'int64');
        }
        if (isBigUint64ArrayAvailable) {
            exports.NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.set('uint64', BigUint64Array);
            exports.NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP.set(BigUint64Array, 'uint64');
        }
    }
};
exports.checkBigInt = checkBigInt;
//# sourceMappingURL=tensor-impl-type-mapping.js.map
/***/ }),
/***/ "../common/dist/cjs/tensor-impl.js":
/*!*****************************************!*\
  !*** ../common/dist/cjs/tensor-impl.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Tensor = void 0;
const tensor_conversion_impl_js_1 = __webpack_require__(/*! ./tensor-conversion-impl.js */ "../common/dist/cjs/tensor-conversion-impl.js");
const tensor_factory_impl_js_1 = __webpack_require__(/*! ./tensor-factory-impl.js */ "../common/dist/cjs/tensor-factory-impl.js");
const tensor_impl_type_mapping_js_1 = __webpack_require__(/*! ./tensor-impl-type-mapping.js */ "../common/dist/cjs/tensor-impl-type-mapping.js");
const tensor_utils_impl_js_1 = __webpack_require__(/*! ./tensor-utils-impl.js */ "../common/dist/cjs/tensor-utils-impl.js");
/**
 * the implementation of Tensor interface.
 *
 * @internal
 */
class Tensor {
    /**
     * implementation.
     */
    constructor(arg0, arg1, arg2) {
        // perform one-time check for BigInt support
        (0, tensor_impl_type_mapping_js_1.checkBigInt)();
        let type;
        let dims;
        if (typeof arg0 === 'object' && 'location' in arg0) {
            //
            // constructing tensor from specific location
            //
            this.dataLocation = arg0.location;
            type = arg0.type;
            dims = arg0.dims;
            switch (arg0.location) {
                case 'cpu-pinned': {
                    const expectedTypedArrayConstructor = tensor_impl_type_mapping_js_1.NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.get(type);
                    if (!expectedTypedArrayConstructor) {
                        throw new TypeError(`unsupported type "${type}" to create tensor from pinned buffer`);
                    }
                    if (!(arg0.data instanceof expectedTypedArrayConstructor)) {
                        throw new TypeError(`buffer should be of type ${expectedTypedArrayConstructor.name}`);
                    }
                    this.cpuData = arg0.data;
                    break;
                }
                case 'texture': {
                    if (type !== 'float32') {
                        throw new TypeError(`unsupported type "${type}" to create tensor from texture`);
                    }
                    this.gpuTextureData = arg0.texture;
                    this.downloader = arg0.download;
                    this.disposer = arg0.dispose;
                    break;
                }
                case 'gpu-buffer': {
                    if (type !== 'float32' && type !== 'int32') {
                        throw new TypeError(`unsupported type "${type}" to create tensor from gpu buffer`);
                    }
                    this.gpuBufferData = arg0.gpuBuffer;
                    this.downloader = arg0.download;
                    this.disposer = arg0.dispose;
                    break;
                }
                default:
                    throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`);
            }
        }
        else {
            //
            // constructing tensor of location 'cpu'
            //
            let data;
            let maybeDims;
            // check whether arg0 is type or data
            if (typeof arg0 === 'string') {
                //
                // Override: constructor(type, data, ...)
                //
                type = arg0;
                maybeDims = arg2;
                if (arg0 === 'string') {
                    // string tensor
                    if (!Array.isArray(arg1)) {
                        throw new TypeError('A string tensor\'s data must be a string array.');
                    }
                    // we don't check whether every element in the array is string; this is too slow. we assume it's correct and
                    // error will be populated at inference
                    data = arg1;
                }
                else {
                    // numeric tensor
                    const typedArrayConstructor = tensor_impl_type_mapping_js_1.NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.get(arg0);
                    if (typedArrayConstructor === undefined) {
                        throw new TypeError(`Unsupported tensor type: ${arg0}.`);
                    }
                    if (Array.isArray(arg1)) {
                        if (arg0 === 'float16') {
                            // Throw error here because when user try to use number array as data,
                            // e.g. new Tensor('float16', [1, 2, 3, 4], dims)), it will actually call
                            // Uint16Array.from(arg1) which generates wrong data.
                            throw new TypeError('Creating a float16 tensor from number array is not supported. Please use Uint16Array as data.');
                        }
                        else if (arg0 === 'uint64' || arg0 === 'int64') {
                            // use 'as any' here because:
                            // 1. TypeScript's check on type of 'Array.isArray()' does not work with readonly arrays.
                            // see https://github.com/microsoft/TypeScript/issues/17002
                            // 2. TypeScript's check on union type of '(BigInt64ArrayConstructor|BigUint64ArrayConstructor).from()'
                            // does not accept parameter mapFn.
                            // 3. parameters of 'SupportedTypedArrayConstructors.from()' does not match the requirement of the union
                            // type.
                            // assume 'arg1' is of type "readonly number[]|readonly bigint[]" here.
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            data = typedArrayConstructor.from(arg1, BigInt);
                        }
                        else {
                            // assume 'arg1' is of type "readonly number[]" here.
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            data = typedArrayConstructor.from(arg1);
                        }
                    }
                    else if (arg1 instanceof typedArrayConstructor) {
                        data = arg1;
                    }
                    else {
                        throw new TypeError(`A ${type} tensor's data must be type of ${typedArrayConstructor}`);
                    }
                }
            }
            else {
                //
                // Override: constructor(data, ...)
                //
                maybeDims = arg1;
                if (Array.isArray(arg0)) {
                    // only boolean[] and string[] is supported
                    if (arg0.length === 0) {
                        throw new TypeError('Tensor type cannot be inferred from an empty array.');
                    }
                    const firstElementType = typeof arg0[0];
                    if (firstElementType === 'string') {
                        type = 'string';
                        data = arg0;
                    }
                    else if (firstElementType === 'boolean') {
                        type = 'bool';
                        // 'arg0' is of type 'boolean[]'. Uint8Array.from(boolean[]) actually works, but typescript thinks this is
                        // wrong type. We use 'as any' to make it happy.
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        data = Uint8Array.from(arg0);
                    }
                    else {
                        throw new TypeError(`Invalid element type of data array: ${firstElementType}.`);
                    }
                }
                else {
                    // get tensor type from TypedArray
                    const mappedType = tensor_impl_type_mapping_js_1.NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP.get(arg0.constructor);
                    if (mappedType === undefined) {
                        throw new TypeError(`Unsupported type for tensor data: ${arg0.constructor}.`);
                    }
                    type = mappedType;
                    data = arg0;
                }
            }
            // type and data is processed, now processing dims
            if (maybeDims === undefined) {
                // assume 1-D tensor if dims omitted
                maybeDims = [data.length];
            }
            else if (!Array.isArray(maybeDims)) {
                throw new TypeError('A tensor\'s dims must be a number array');
            }
            dims = maybeDims;
            this.cpuData = data;
            this.dataLocation = 'cpu';
        }
        // perform check on dims
        const size = (0, tensor_utils_impl_js_1.calculateSize)(dims);
        // if data is on CPU, check whether data length matches tensor size
        if (this.cpuData && size !== this.cpuData.length) {
            throw new Error(`Tensor's size(${size}) does not match data length(${this.cpuData.length}).`);
        }
        this.type = type;
        this.dims = dims;
        this.size = size;
    }
    // #endregion
    // #region factory
    static async fromImage(image, options) {
        return (0, tensor_factory_impl_js_1.tensorFromImage)(image, options);
    }
    static fromTexture(texture, options) {
        return (0, tensor_factory_impl_js_1.tensorFromTexture)(texture, options);
    }
    static fromGpuBuffer(gpuBuffer, options) {
        return (0, tensor_factory_impl_js_1.tensorFromGpuBuffer)(gpuBuffer, options);
    }
    static fromPinnedBuffer(type, buffer, dims) {
        return (0, tensor_factory_impl_js_1.tensorFromPinnedBuffer)(type, buffer, dims);
    }
    // #endregion
    // #region conversions
    toDataURL(options) {
        return (0, tensor_conversion_impl_js_1.tensorToDataURL)(this, options);
    }
    toImageData(options) {
        return (0, tensor_conversion_impl_js_1.tensorToImageData)(this, options);
    }
    // #endregion
    // #region properties
    get data() {
        this.ensureValid();
        if (!this.cpuData) {
            throw new Error('The data is not on CPU. Use `getData()` to download GPU data to CPU, ' +
                'or use `texture` property to access the GPU data directly.');
        }
        return this.cpuData;
    }
    get location() {
        return this.dataLocation;
    }
    get texture() {
        this.ensureValid();
        if (!this.gpuTextureData) {
            throw new Error('The data is not stored as a WebGL texture.');
        }
        return this.gpuTextureData;
    }
    get gpuBuffer() {
        this.ensureValid();
        if (!this.gpuBufferData) {
            throw new Error('The data is not stored as a WebGPU buffer.');
        }
        return this.gpuBufferData;
    }
    // #endregion
    // #region methods
    async getData(releaseData) {
        this.ensureValid();
        switch (this.dataLocation) {
            case 'cpu':
            case 'cpu-pinned':
                return this.data;
            case 'texture':
            case 'gpu-buffer': {
                if (!this.downloader) {
                    throw new Error('The current tensor is not created with a specified data downloader.');
                }
                if (this.isDownloading) {
                    throw new Error('The current tensor is being downloaded.');
                }
                try {
                    this.isDownloading = true;
                    const data = await this.downloader();
                    this.downloader = undefined;
                    this.dataLocation = 'cpu';
                    this.cpuData = data;
                    if (releaseData && this.disposer) {
                        this.disposer();
                        this.disposer = undefined;
                    }
                    return data;
                }
                finally {
                    this.isDownloading = false;
                }
            }
            default:
                throw new Error(`cannot get data from location: ${this.dataLocation}`);
        }
    }
    dispose() {
        if (this.isDownloading) {
            throw new Error('The current tensor is being downloaded.');
        }
        if (this.disposer) {
            this.disposer();
            this.disposer = undefined;
        }
        this.cpuData = undefined;
        this.gpuTextureData = undefined;
        this.gpuBufferData = undefined;
        this.downloader = undefined;
        this.isDownloading = undefined;
        this.dataLocation = 'none';
    }
    // #endregion
    // #region tensor utilities
    ensureValid() {
        if (this.dataLocation === 'none') {
            throw new Error('The tensor is disposed.');
        }
    }
    reshape(dims) {
        this.ensureValid();
        if (this.downloader || this.disposer) {
            throw new Error('Cannot reshape a tensor that owns GPU resource.');
        }
        return (0, tensor_utils_impl_js_1.tensorReshape)(this, dims);
    }
}
exports.Tensor = Tensor;
//# sourceMappingURL=tensor-impl.js.map
/***/ }),
/***/ "../common/dist/cjs/tensor-utils-impl.js":
/*!***********************************************!*\
  !*** ../common/dist/cjs/tensor-utils-impl.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.tensorReshape = exports.calculateSize = void 0;
const tensor_impl_js_1 = __webpack_require__(/*! ./tensor-impl.js */ "../common/dist/cjs/tensor-impl.js");
/**
 * calculate size from dims.
 *
 * @param dims the dims array. May be an illegal input.
 */
const calculateSize = (dims) => {
    let size = 1;
    for (let i = 0; i < dims.length; i++) {
        const dim = dims[i];
        if (typeof dim !== 'number' || !Number.isSafeInteger(dim)) {
            throw new TypeError(`dims[${i}] must be an integer, got: ${dim}`);
        }
        if (dim < 0) {
            throw new RangeError(`dims[${i}] must be a non-negative integer, got: ${dim}`);
        }
        size *= dim;
    }
    return size;
};
exports.calculateSize = calculateSize;
/**
 * implementation of Tensor.reshape()
 */
const tensorReshape = (tensor, dims) => {
    switch (tensor.location) {
        case 'cpu':
            return new tensor_impl_js_1.Tensor(tensor.type, tensor.data, dims);
        case 'cpu-pinned':
            return new tensor_impl_js_1.Tensor({
                location: 'cpu-pinned',
                data: tensor.data,
                type: tensor.type,
                dims,
            });
        case 'texture':
            return new tensor_impl_js_1.Tensor({
                location: 'texture',
                texture: tensor.texture,
                type: tensor.type,
                dims,
            });
        case 'gpu-buffer':
            return new tensor_impl_js_1.Tensor({
                location: 'gpu-buffer',
                gpuBuffer: tensor.gpuBuffer,
                type: tensor.type,
                dims,
            });
        default:
            throw new Error(`tensorReshape: tensor location ${tensor.location} is not supported`);
    }
};
exports.tensorReshape = tensorReshape;
//# sourceMappingURL=tensor-utils-impl.js.map
/***/ }),
/***/ "../common/dist/cjs/tensor.js":
/*!************************************!*\
  !*** ../common/dist/cjs/tensor.js ***!
  \************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Tensor = void 0;
const tensor_impl_js_1 = __webpack_require__(/*! ./tensor-impl.js */ "../common/dist/cjs/tensor-impl.js");
// eslint-disable-next-line @typescript-eslint/naming-convention
exports.Tensor = tensor_impl_js_1.Tensor;
//# sourceMappingURL=tensor.js.map
/***/ }),
/***/ "../common/dist/cjs/version.js":
/*!*************************************!*\
  !*** ../common/dist/cjs/version.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, exports) => {
"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.version = void 0;
// This file is generated by /js/scripts/update-version.ts
// Do not modify file content manually.
exports.version = '1.16.0';
//# sourceMappingURL=version.js.map
/***/ })
/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./lib/index.ts");
/******/ 	
/******/ 	return __webpack_exports__;
/******/ })()
;
});
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = false;
ort.env.wasm.wasmPaths = "/" + import.meta.url.split('/').slice(3, -1).join('/') + "/";
export const OrtJS = ort;
