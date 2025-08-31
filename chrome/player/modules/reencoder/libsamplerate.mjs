/** ****/ const __webpack_modules__ = ({

  /***/ './src/glue.wasm':
  /* !***********************!*\
  !*** ./src/glue.wasm ***!
  \***********************/
  /***/ ((module, __unused_webpack_exports, __webpack_require__) => {
    module.exports = __webpack_require__.p + 'libsamplerate.wasm';
    /***/}),

/** ****/});
/** **********************************************************************/
/** ****/ // The module cache
/** ****/ const __webpack_module_cache__ = {};
/** ****/
/** ****/ // The require function
/** ****/ function __webpack_require__(moduleId) {
/** ****/ 	// Check if module is in cache
/** ****/ 	const cachedModule = __webpack_module_cache__[moduleId];
  /** ****/ 	if (cachedModule !== undefined) {
    /** ****/ 		return cachedModule.exports;
    /** ****/}
  /** ****/ 	// Create a new module (and put it into the cache)
  /** ****/ 	const module = __webpack_module_cache__[moduleId] = {
    /** ****/ 		// no module.id needed
    /** ****/ 		// no module.loaded needed
    /** ****/ 		exports: {},
    /** ****/};
  /** ****/
  /** ****/ 	// Execute the module function
  /** ****/ 	__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
  /** ****/
  /** ****/ 	// Return the exports of the module
  /** ****/ 	return module.exports;
/** ****/}
/** ****/
/** ****/ // expose the modules object (__webpack_modules__)
/** ****/ __webpack_require__.m = __webpack_modules__;
/** ****/
/** **********************************************************************/
/** ****/ /* webpack/runtime/define property getters */
/** ****/ (() => {
/** ****/ 	// define getter functions for harmony exports
/** ****/ 	__webpack_require__.d = (exports, definition) => {
    /** ****/ 		for (const key in definition) {
      /** ****/ 			if (__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
        /** ****/ 				Object.defineProperty(exports, key, {enumerable: true, get: definition[key]});
        /** ****/}
      /** ****/}
    /** ****/};
/** ****/})();
/** ****/
/** ****/ /* webpack/runtime/hasOwnProperty shorthand */
/** ****/ (() => {
/** ****/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop));
/** ****/})();
/** ****/
/** ****/ /* webpack/runtime/make namespace object */
/** ****/ (() => {
/** ****/ 	// define __esModule on exports
/** ****/ 	__webpack_require__.r = (exports) => {
    /** ****/ 		if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
      /** ****/ 			Object.defineProperty(exports, Symbol.toStringTag, {value: 'Module'});
      /** ****/}
    /** ****/ 		Object.defineProperty(exports, '__esModule', {value: true});
    /** ****/};
/** ****/})();
/** ****/
/** ****/ /* webpack/runtime/publicPath */
/** ****/ (() => {
/** ****/ 	let scriptUrl;
  /** ****/ 	if (typeof import.meta.url === 'string') scriptUrl = import.meta.url;
  /** ****/ 	// When supporting browsers where an automatic publicPath is not supported you must specify an output.publicPath manually via configuration
  /** ****/ 	// or pass an empty string ("") and set the __webpack_public_path__ variable from your code to use your own logic.
  /** ****/ 	if (!scriptUrl) throw new Error('Automatic publicPath is not supported in this browser');
  /** ****/ 	scriptUrl = scriptUrl.replace(/^blob:/, '').replace(/#.*$/, '').replace(/\?.*$/, '').replace(/\/[^\/]+$/, '/');
  /** ****/ 	__webpack_require__.p = scriptUrl;
/** ****/})();
/** ****/
/** ****/ /* webpack/runtime/import chunk loading */
/** ****/ (() => {
/** ****/ 	__webpack_require__.b = new URL('./', import.meta.url);
  /** ****/
  /** ****/ 	// object to store loaded and loading chunks
  /** ****/ 	// undefined = chunk not loaded, null = chunk preloaded/prefetched
  /** ****/ 	// [resolve, Promise] = chunk loading, 0 = chunk loaded
  /** ****/ 	const installedChunks = {
    /** ****/ 		'main': 0,
    /** ****/};
/** ****/
/** ****/ 	// no install chunk
/** ****/
/** ****/ 	// no chunk on demand loading
/** ****/
/** ****/ 	// no prefetching
/** ****/
/** ****/ 	// no preloaded
/** ****/
/** ****/ 	// no external install chunk
/** ****/
/** ****/ 	// no on chunks loaded
/** ****/ 	// no HMR
/** ****/
/** ****/ 	// no HMR manifest
/** ****/})();
/** ****/
/** **********************************************************************/
const __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/* !******************************************!*\
  !*** ./src/libsamplerate.ts + 4 modules ***!
  \******************************************/

  // EXPORTS
  __webpack_require__.d(__webpack_exports__, {
    ConverterType: () => (/* reexport */ ConverterType),
    create: () => (/* binding */ create),
  });
  // ESM COMPAT FLAG
  __webpack_require__.r(__webpack_exports__);

  ;// ./src/util.ts
  /**
 * Splits a TypedArray into several chunks of size <= maxChunkSize
 *
 * @param { TypedArray }            array        The array to split into smaller TypedArrays
 * @param { number }                maxChunkSize Maximum length of the chunks. The last chunk is probably < maxChunkSize
 * @param { TypedArrayConstructor } contructor   A TypedArray constructor. Probably Float32Array
 * @return { TypedArray[] }                      An array of TypedArrays with length <= maxChunkSize
 */
  function toChunks(array, maxChunkSize, Constructor) {
    let lastPos = 0;
    const chunks = [];
    for (let i = 0; i < array.length; i += maxChunkSize) {
      const bound = Math.min(maxChunkSize, array.length - lastPos);
      const chunk = new Constructor(array.buffer, lastPos * array.BYTES_PER_ELEMENT, bound);
      lastPos += maxChunkSize;
      chunks.push(chunk);
    }
    return chunks;
  }
  /**
 * Writes dataIn to dataOut, or a new Float32Array
 *
 * @param length  Amount of data to copy
 * @param dataIn  Array to copy values from
 * @param dataOut If not null, copy data from dataIn into this array, then return it
 * @return A new Float32Array or dataOut if dataOut != null
 */
  function copyOrWriteArray(length, dataIn, dataOut) {
    if (dataOut === void 0) {
      dataOut = null;
    }
    const _dataOut = dataOut === null ? new Float32Array(length) : dataOut;
    for (let i = 0; i < length; i++) {
      _dataOut[i] = dataIn[i];
    }
    return _dataOut;
  }
  /**
 * converts and *scales* TypedArray to Float32 where samples are scaled from
 * TypedArray.minValue < n < TypedArray.maxValue to -1 < n < 1
 *
 * @param data A TypedArray containing audio samples
 * @return The float32 representations scaled to -1 < n < 1
 */
  function toFloat32(data) {
    const divisor = maxValueForTypedArray(data);
    const float32 = new Float32Array(data.length);
    switch (data.constructor) {
      case Float32Array:
        return data;
      case Int8Array:
      case Int16Array:
      case Int32Array:
        for (var i = 0; i < data.length; i++) {
          float32[i] = data[i] / divisor;
        }
        break;
      case Uint8Array:
      case Uint16Array:
      case Uint32Array:
        for (var i = 0; i < data.length; i++) {
          float32[i] = (data[i] - divisor) / divisor;
        }
    }
    return float32;
  }
  /**
 * Get the maximum value which can be stored in the given TypedArray
 *
 * @param data A TypedArray containing audio samples
 * @return The max value which can be stored in array
 */
  function maxValueForTypedArray(array) {
    switch (array.constructor) {
      case Float32Array:
        return 1;
      case Int8Array:
      case Uint8Array:
        return 127;
      case Int16Array:
      case Uint16Array:
        return 32767;
      case Int32Array:
      case Uint32Array:
        return 2147483647;
      default:
        throw 'Unsupport data type '.concat(array.constructor);
    }
  }

  ;// ./src/src.ts

  /**
 * The length (in `float`s) of the input and output buffers used to transmit data between
 * JS and WASM. Each buffer is currently set to ~4MB.
 */
  const BUFFER_LENGTH = 1008000;
  /**
 * Manages communication between WASM code and JS
 */
  const SRC = /** @class */ (function() {
    /**
     * Run WASM module initialization and retrieves WASM data transmission arrays. Data transmission to WASM
     * code is owned by the WASM module to avoid extra copies
     * @param mod the loaded WASM module
     * @param converterType     ConverterType object. See benchmarks to get a sense of which is best for you.
     * @param nChannels         the number of output channels. 1-8 supported
     * @param inputSampleRate   The sample rate of whatever source audio you want to resample
     * @param outputSampleRate  If playing audio in-browser, this should be equal to AudioContext.sampleRate
     */
    function SRC(mod, converterType, nChannels, inputSampleRate, outputSampleRate) {
      this.module = mod;
      this._converterType = converterType;
      this._nChannels = nChannels;
      this._inputSampleRate = inputSampleRate;
      this._outputSampleRate = outputSampleRate;
      this.ratio = outputSampleRate / inputSampleRate;
      this.isDestroyed = false;
      // init can cause heap memory to be increased, so call it before we get references to arrays below
      mod.init(nChannels, converterType, inputSampleRate, outputSampleRate);
      this.sourceArray = mod.sourceArray(BUFFER_LENGTH);
      this.targetArray = mod.targetArray(BUFFER_LENGTH);
    }
    /**
     * Calls the libsamplerate `simple` API. This should be used when resampling one individual chunk of audio,
     * and no more calls to are required. If more calls are required, use the `full` API. If the array submitted
     * is > 4MB, audio will be broken up into chunks and the `full` API will be used
     *
     * More (and better) info available at: http://www.mega-nerd.com/SRC/api_simple.html
     *
     * @param dataIn Float32Array containing mono|interleaved audio data where -1 < dataIn[i] < 1
     * @return The resampled data
     */
    SRC.prototype.simple = function(dataIn) {
      return this._resample(this.module.simple, dataIn);
    };
    /**
     * Calls the libsamplerate `full` API. This should be used when resampling several chunks of the
     * sample audio, e.g. receiving a live stream from WebRTC/websocket API.
     *
     * More (and better) info available at: http://www.mega-nerd.com/SRC/api_full.html
     *
     * @param dataIn Float32Array containing mono|interleaved audio data where -1 < dataIn[i] < 1
     * @param dataOut Optionally, pass a Float32Array to avoid allocating an extra array for every resampling operation
     * @param outLength if resampleFunc === this.module.full, pass an optional object get get the number of frames written to dataOut
     * @return The resampled data. If dataOut != null, dataOut is returned
     */
    SRC.prototype.full = function(dataIn, dataOut, outLength) {
      if (dataOut === void 0) {
        dataOut = null;
      }
      if (outLength === void 0) {
        outLength = null;
      }
      return this._resample(this.module.full, dataIn, dataOut, outLength);
    };
    /**
     * Cleans up WASM SRC resources. Once this is called on an instance, that instance must be
     * reinitialized with src.init() before it can be used again.
     *
     * TODO: destroy is a gross name
     */
    SRC.prototype.destroy = function() {
      if (this.isDestroyed === true) {
        console.warn('destroy() has already been called on this instance');
      } else {
        this.module.destroy();
        this.isDestroyed = true;
      }
    };
    Object.defineProperty(SRC.prototype, 'inputSampleRate', {
      get: function() {
        return this._inputSampleRate;
      },
      set: function(inputSampleRate) {
        this._inputSampleRate = inputSampleRate;
        this.module.destroy();
        this.module.init(this.nChannels, this.converterType, this.inputSampleRate, this.outputSampleRate);
      },
      enumerable: false,
      configurable: true,
    });
    Object.defineProperty(SRC.prototype, 'outputSampleRate', {
      get: function() {
        return this._outputSampleRate;
      },
      set: function(outputSampleRate) {
        this._outputSampleRate = outputSampleRate;
        this.module.destroy();
        this.module.init(this.nChannels, this.converterType, this.inputSampleRate, this.outputSampleRate);
      },
      enumerable: false,
      configurable: true,
    });
    Object.defineProperty(SRC.prototype, 'nChannels', {
      get: function() {
        return this._nChannels;
      },
      set: function(nChannels) {
        this._nChannels = nChannels;
        this.module.destroy();
        this.module.init(this.nChannels, this.converterType, this.inputSampleRate, this.outputSampleRate);
      },
      enumerable: false,
      configurable: true,
    });
    Object.defineProperty(SRC.prototype, 'converterType', {
      get: function() {
        return this._converterType;
      },
      set: function(converterType) {
        this._converterType = converterType;
        this.module.destroy();
        this.module.init(this.nChannels, this.converterType, this.inputSampleRate, this.outputSampleRate);
      },
      enumerable: false,
      configurable: true,
    });
    /**
     * Splits a large (> 4MB) chunk of audio into many smaller pieces, to be consumed by the SRC `full` api.
     *
     * @param dataIn Float32Array containing mono|interleaved audio data where -1 < dataIn[i] < 1
     * @return The resampled data
     */
    SRC.prototype._chunkAndResample = function(dataIn) {
      let accumulatedSize = 0;
      const resampledChunks = [];
      const chunkSize = (this.inputSampleRate / 10) * this.nChannels;
      const chunks = toChunks(dataIn, chunkSize, Float32Array);
      for (var i = 0; i < chunks.length; i++) {
        const resampled = this._resample(this.module.full, chunks[i]);
        accumulatedSize += resampled.length;
        resampledChunks.push(resampled);
      }
      const accumulated = new Float32Array(accumulatedSize);
      let accumulatedIndex = 0;
      for (var i = 0; i < resampledChunks.length; i++) {
        for (let j = 0; j < resampledChunks[i].length; j++) {
          accumulated[accumulatedIndex++] = resampledChunks[i][j];
        }
      }
      return accumulated;
    };
    /**
     * Calls libsamplerate `full` or `simple` API after validating data. If dataIn > 4MB,
     * uses _chunkAndResample instead.
     *
     * @param resampleFunc this.module.simple || this.module.full
     * @param dataIn Float32Array containing mono|interleaved audio data where -1 < dataIn[i] < 1
     * @param dataOut if resampleFunc === this.module.full, pass an optional resuable buffer to avoid extra allocations
     * @param outLength if resampleFunc === this.module.full, pass an optional object get get the number of frames written to dataOut
     * @return The resampled audio, if any
     */
    SRC.prototype._resample = function(resampleFunc, dataIn, dataOut, outLength) {
      if (dataOut === void 0) {
        dataOut = null;
      }
      if (outLength === void 0) {
        outLength = null;
      }
      // if we don't actually need to resample, just copy values
      if (this.inputSampleRate === this.outputSampleRate) {
        return dataIn;
      }
      if (dataOut !== null && dataOut.length < this.ratio * dataIn.length) {
        throw 'dataOut must be at least ceil(srcRatio * dataIn.length) samples long';
      }
      // if client is trying to resample a big piece of audio, process in chunks
      const projectedSize = Math.ceil(dataIn.length * this.ratio);
      if (Math.max(projectedSize, dataIn.length) > BUFFER_LENGTH) {
        return this._chunkAndResample(dataIn);
      }
      this.sourceArray.set(dataIn);
      // outputFrames are *per channel*
      const outputFrames = resampleFunc(dataIn.length, this.nChannels, // ignored by module.full()
          this.converterType, // ignored by module.full()
          this.inputSampleRate, // ignored by module.full()
          this.outputSampleRate, // ignored by module.full()
      );
      if (typeof outLength === 'object' && outLength !== null) {
        outLength.frames = outputFrames;
      }
      return copyOrWriteArray(outputFrames * this.nChannels, this.targetArray, dataOut);
    };
    return SRC;
  }());


  ;// ./src/converter-type.ts
  /** Used by libsamplerate to determine what algorithm to use to resample */
  var ConverterType = {
    SRC_SINC_BEST_QUALITY: 0,
    SRC_SINC_MEDIUM_QUALITY: 1,
    SRC_SINC_FASTEST: 2,
    SRC_ZERO_ORDER_HOLD: 3,
    SRC_LINEAR: 4,
  };

  ;// ./src/glue.js
  async function LoadSRC(moduleArg={}) {
    let moduleRtn; const Module=moduleArg; const ENVIRONMENT_IS_WEB=typeof window=='object'; const ENVIRONMENT_IS_WORKER=typeof WorkerGlobalScope!='undefined'; const ENVIRONMENT_IS_NODE=typeof process=='object'&&process.versions?.node&&process.type!='renderer'; const ENVIRONMENT_IS_SHELL=!ENVIRONMENT_IS_WEB&&!ENVIRONMENT_IS_NODE&&!ENVIRONMENT_IS_WORKER; let arguments_=[]; let thisProgram='./this.program'; let quit_=(status, toThrow)=>{
      throw toThrow;
    }; const _scriptName= import.meta.url; let scriptDirectory=''; function locateFile(path) {
      if (Module['locateFile']) {
        return Module['locateFile'](path, scriptDirectory);
      } return scriptDirectory+path;
    } let readAsync; let readBinary; if (ENVIRONMENT_IS_SHELL) {
      readBinary=(f)=>{
        if (typeof readbuffer=='function') {
          return new Uint8Array(readbuffer(f));
        } const data=read(f, 'binary'); assert(typeof data=='object'); return data;
      }; readAsync=async (f)=>readBinary(f); globalThis.clearTimeout??=(id)=>{}; globalThis.setTimeout??=(f)=>f(); arguments_=globalThis.arguments||globalThis.scriptArgs; if (typeof quit=='function') {
        quit_=(status, toThrow)=>{
          setTimeout(()=>{
            if (!(toThrow instanceof ExitStatus)) {
              let toLog=toThrow; if (toThrow&&typeof toThrow=='object'&&toThrow.stack) {
                toLog=[toThrow, toThrow.stack];
              }err(`exiting due to exception: ${toLog}`);
            }quit(status);
          }); throw toThrow;
        };
      } if (typeof print!='undefined') {
        globalThis.console??={}; console.log=print; console.warn=console.error=globalThis.printErr??print;
      }
    } else if (ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER) {
      try {
        scriptDirectory=new URL('.', _scriptName).href;
      } catch {} {if (ENVIRONMENT_IS_WORKER) {
        readBinary=(url)=>{
          const xhr=new XMLHttpRequest; xhr.open('GET', url, false); xhr.responseType='arraybuffer'; xhr.send(null); return new Uint8Array(xhr.response);
        };
      }readAsync=async (url)=>{
        const response=await fetch(url, {credentials: 'same-origin'}); if (response.ok) {
          return response.arrayBuffer();
        } throw new Error(response.status+' : '+response.url);
      };}
    } else {} let out=console.log.bind(console); var err=console.error.bind(console); let wasmBinary; let ABORT=false; let EXITSTATUS; function assert(condition, text) {
      if (!condition) {
        abort(text);
      }
    } let readyPromiseResolve; let readyPromiseReject; let wasmMemory; let HEAP8; let HEAPU8; let HEAP16; let HEAPU16; let HEAP32; let HEAPU32; let HEAPF32; let HEAPF64; let HEAP64; let HEAPU64; let runtimeInitialized=false; function updateMemoryViews() {
      const b=wasmMemory.buffer; HEAP8=new Int8Array(b); HEAP16=new Int16Array(b); HEAPU8=new Uint8Array(b); HEAPU16=new Uint16Array(b); HEAP32=new Int32Array(b); HEAPU32=new Uint32Array(b); HEAPF32=new Float32Array(b); HEAPF64=new Float64Array(b); HEAP64=new BigInt64Array(b); HEAPU64=new BigUint64Array(b);
    } function preRun() {
      if (Module['preRun']) {
        if (typeof Module['preRun']=='function')Module['preRun']=[Module['preRun']]; while (Module['preRun'].length) {
          addOnPreRun(Module['preRun'].shift());
        }
      }callRuntimeCallbacks(onPreRuns);
    } function initRuntime() {
      runtimeInitialized=true; wasmExports['r']();
    } function preMain() {} function postRun() {
      if (Module['postRun']) {
        if (typeof Module['postRun']=='function')Module['postRun']=[Module['postRun']]; while (Module['postRun'].length) {
          addOnPostRun(Module['postRun'].shift());
        }
      }callRuntimeCallbacks(onPostRuns);
    } let runDependencies=0; let dependenciesFulfilled=null; function addRunDependency(id) {
      runDependencies++; Module['monitorRunDependencies']?.(runDependencies);
    } function removeRunDependency(id) {
      runDependencies--; Module['monitorRunDependencies']?.(runDependencies); if (runDependencies==0) {
        if (dependenciesFulfilled) {
          const callback=dependenciesFulfilled; dependenciesFulfilled=null; callback();
        }
      }
    } function abort(what) {
      Module['onAbort']?.(what); what='Aborted('+what+')'; err(what); ABORT=true; what+='. Build with -sASSERTIONS for more info.'; const e=new WebAssembly.RuntimeError(what); readyPromiseReject?.(e); throw e;
    } let wasmBinaryFile; function findWasmBinary() {
      if (Module['locateFile']) {
        return locateFile('glue.wasm');
      } if (ENVIRONMENT_IS_SHELL) {
        return 'glue.wasm';
      } return new URL(/* asset import */ __webpack_require__(/* ! glue.wasm */ './src/glue.wasm'), __webpack_require__.b).href;
    } function getBinarySync(file) {
      if (file==wasmBinaryFile&&wasmBinary) {
        return new Uint8Array(wasmBinary);
      } if (readBinary) {
        return readBinary(file);
      } throw 'sync fetching of the wasm failed: you can preload it to Module["wasmBinary"] manually, or emcc.py will do that for you when generating HTML (but not JS)';
    } function instantiateSync(file, info) {
      let module; const binary=getBinarySync(file); module=new WebAssembly.Module(binary); const instance=new WebAssembly.Instance(module, info); return [instance, module];
    } function getWasmImports() {
      return {a: wasmImports};
    } function createWasm() {
      function receiveInstance(instance, module) {
        wasmExports=instance.exports; wasmMemory=wasmExports['q']; updateMemoryViews(); wasmTable=wasmExports['t']; assignWasmExports(wasmExports); removeRunDependency('wasm-instantiate'); return wasmExports;
      }addRunDependency('wasm-instantiate'); const info=getWasmImports(); if (Module['instantiateWasm']) {
        return new Promise((resolve, reject)=>{
          Module['instantiateWasm'](info, (mod, inst)=>{
            resolve(receiveInstance(mod, inst));
          });
        });
      }wasmBinaryFile??=findWasmBinary(); const result=instantiateSync(wasmBinaryFile, info); return receiveInstance(result[0]);
    } class ExitStatus {
      name='ExitStatus'; constructor(status) {
        this.message=`Program terminated with exit(${status})`; this.status=status;
      }
    } var callRuntimeCallbacks=(callbacks)=>{
      while (callbacks.length>0) {
        callbacks.shift()(Module);
      }
    }; var onPostRuns=[]; var addOnPostRun=(cb)=>onPostRuns.push(cb); var onPreRuns=[]; var addOnPreRun=(cb)=>onPreRuns.push(cb); let noExitRuntime=true; class ExceptionInfo {
      constructor(excPtr) {
        this.excPtr=excPtr; this.ptr=excPtr-24;
      }set_type(type) {
        HEAPU32[this.ptr+4>>2]=type;
      }get_type() {
        return HEAPU32[this.ptr+4>>2];
      }set_destructor(destructor) {
        HEAPU32[this.ptr+8>>2]=destructor;
      }get_destructor() {
        return HEAPU32[this.ptr+8>>2];
      }set_caught(caught) {
        caught=caught?1:0; HEAP8[this.ptr+12]=caught;
      }get_caught() {
        return HEAP8[this.ptr+12]!=0;
      }set_rethrown(rethrown) {
        rethrown=rethrown?1:0; HEAP8[this.ptr+13]=rethrown;
      }get_rethrown() {
        return HEAP8[this.ptr+13]!=0;
      }init(type, destructor) {
        this.set_adjusted_ptr(0); this.set_type(type); this.set_destructor(destructor);
      }set_adjusted_ptr(adjustedPtr) {
        HEAPU32[this.ptr+16>>2]=adjustedPtr;
      }get_adjusted_ptr() {
        return HEAPU32[this.ptr+16>>2];
      }
    } let exceptionLast=0; let uncaughtExceptionCount=0; const ___cxa_throw=(ptr, type, destructor)=>{
      const info=new ExceptionInfo(ptr); info.init(type, destructor); exceptionLast=ptr; uncaughtExceptionCount++; throw exceptionLast;
    }; const __abort_js=()=>abort(''); const AsciiToString=(ptr)=>{
      let str=''; while (1) {
        const ch=HEAPU8[ptr++]; if (!ch) return str; str+=String.fromCharCode(ch);
      }
    }; const awaitingDependencies={}; const registeredTypes={}; const typeDependencies={}; const BindingError=class BindingError extends Error {
      constructor(message) {
        super(message); this.name='BindingError';
      }
    }; const throwBindingError=(message)=>{
      throw new BindingError(message);
    }; function sharedRegisterType(rawType, registeredInstance, options={}) {
      const name=registeredInstance.name; if (!rawType) {
        throwBindingError(`type "${name}" must have a positive integer typeid pointer`);
      } if (registeredTypes.hasOwnProperty(rawType)) {
        if (options.ignoreDuplicateRegistrations) {
          return;
        } else {
          throwBindingError(`Cannot register type '${name}' twice`);
        }
      }registeredTypes[rawType]=registeredInstance; delete typeDependencies[rawType]; if (awaitingDependencies.hasOwnProperty(rawType)) {
        const callbacks=awaitingDependencies[rawType]; delete awaitingDependencies[rawType]; callbacks.forEach((cb)=>cb());
      }
    } function registerType(rawType, registeredInstance, options={}) {
      return sharedRegisterType(rawType, registeredInstance, options);
    } const integerReadValueFromPointer=(name, width, signed)=>{
      switch (width) {
        case 1: return signed?(pointer)=>HEAP8[pointer]:(pointer)=>HEAPU8[pointer]; case 2: return signed?(pointer)=>HEAP16[pointer>>1]:(pointer)=>HEAPU16[pointer>>1]; case 4: return signed?(pointer)=>HEAP32[pointer>>2]:(pointer)=>HEAPU32[pointer>>2]; case 8: return signed?(pointer)=>HEAP64[pointer>>3]:(pointer)=>HEAPU64[pointer>>3]; default: throw new TypeError(`invalid integer width (${width}): ${name}`);
      }
    }; const __embind_register_bigint=(primitiveType, name, size, minRange, maxRange)=>{
      name=AsciiToString(name); const isUnsignedType=minRange===0n; let fromWireType=(value)=>value; if (isUnsignedType) {
        const bitSize=size*8; fromWireType=(value)=>BigInt.asUintN(bitSize, value); maxRange=fromWireType(maxRange);
      }registerType(primitiveType, {name, fromWireType, toWireType: (destructors, value)=>{
        if (typeof value=='number') {
          value=BigInt(value);
        } return value;
      }, readValueFromPointer: integerReadValueFromPointer(name, size, !isUnsignedType), destructorFunction: null});
    }; const __embind_register_bool=(rawType, name, trueValue, falseValue)=>{
      name=AsciiToString(name); registerType(rawType, {name, fromWireType: function(wt) {
        return !!wt;
      }, toWireType: function(destructors, o) {
        return o?trueValue:falseValue;
      }, readValueFromPointer: function(pointer) {
        return this.fromWireType(HEAPU8[pointer]);
      }, destructorFunction: null});
    }; const emval_freelist=[]; const emval_handles=[0, 1,, 1, null, 1, true, 1, false, 1]; const __emval_decref=(handle)=>{
      if (handle>9&&0===--emval_handles[handle+1]) {
        emval_handles[handle]=undefined; emval_freelist.push(handle);
      }
    }; const Emval={toValue: (handle)=>{
      if (!handle) {
        throwBindingError(`Cannot use deleted val. handle = ${handle}`);
      } return emval_handles[handle];
    }, toHandle: (value)=>{
      switch (value) {
        case undefined: return 2; case null: return 4; case true: return 6; case false: return 8; default: {const handle=emval_freelist.pop()||emval_handles.length; emval_handles[handle]=value; emval_handles[handle+1]=1; return handle;}
      }
    }}; function readPointer(pointer) {
      return this.fromWireType(HEAPU32[pointer>>2]);
    } const EmValType={name: 'emscripten::val', fromWireType: (handle)=>{
      const rv=Emval.toValue(handle); __emval_decref(handle); return rv;
    }, toWireType: (destructors, value)=>Emval.toHandle(value), readValueFromPointer: readPointer, destructorFunction: null}; const __embind_register_emval=(rawType)=>registerType(rawType, EmValType); const floatReadValueFromPointer=(name, width)=>{
      switch (width) {
        case 4: return function(pointer) {
          return this.fromWireType(HEAPF32[pointer>>2]);
        }; case 8: return function(pointer) {
          return this.fromWireType(HEAPF64[pointer>>3]);
        }; default: throw new TypeError(`invalid float width (${width}): ${name}`);
      }
    }; const __embind_register_float=(rawType, name, size)=>{
      name=AsciiToString(name); registerType(rawType, {name, fromWireType: (value)=>value, toWireType: (destructors, value)=>value, readValueFromPointer: floatReadValueFromPointer(name, size), destructorFunction: null});
    }; const createNamedFunction=(name, func)=>Object.defineProperty(func, 'name', {value: name}); const runDestructors=(destructors)=>{
      while (destructors.length) {
        const ptr=destructors.pop(); const del=destructors.pop(); del(ptr);
      }
    }; function usesDestructorStack(argTypes) {
      for (let i=1; i<argTypes.length; ++i) {
        if (argTypes[i]!==null&&argTypes[i].destructorFunction===undefined) {
          return true;
        }
      } return false;
    } function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc, isAsync) {
      const argCount=argTypes.length; if (argCount<2) {
        throwBindingError('argTypes array size mismatch! Must at least get return value and \'this\' types!');
      } const isClassMethodFunc=argTypes[1]!==null&&classType!==null; const needsDestructorStack=usesDestructorStack(argTypes); const returns=!argTypes[0].isVoid; const expectedArgCount=argCount-2; const argsWired=new Array(expectedArgCount); const invokerFuncArgs=[]; const destructors=[]; const invokerFn=function(...args) {
        destructors.length=0; let thisWired; invokerFuncArgs.length=isClassMethodFunc?2:1; invokerFuncArgs[0]=cppTargetFunc; if (isClassMethodFunc) {
          thisWired=argTypes[1].toWireType(destructors, this); invokerFuncArgs[1]=thisWired;
        } for (let i=0; i<expectedArgCount; ++i) {
          argsWired[i]=argTypes[i+2].toWireType(destructors, args[i]); invokerFuncArgs.push(argsWired[i]);
        } const rv=cppInvokerFunc(...invokerFuncArgs); function onDone(rv) {
          if (needsDestructorStack) {
            runDestructors(destructors);
          } else {
            for (let i=isClassMethodFunc?1:2; i<argTypes.length; i++) {
              const param=i===1?thisWired:argsWired[i-2]; if (argTypes[i].destructorFunction!==null) {
                argTypes[i].destructorFunction(param);
              }
            }
          } if (returns) {
            return argTypes[0].fromWireType(rv);
          }
        } return onDone(rv);
      }; return createNamedFunction(humanName, invokerFn);
    } const ensureOverloadTable=(proto, methodName, humanName)=>{
      if (undefined===proto[methodName].overloadTable) {
        const prevFunc=proto[methodName]; proto[methodName]=function(...args) {
          if (!proto[methodName].overloadTable.hasOwnProperty(args.length)) {
            throwBindingError(`Function '${humanName}' called with an invalid number of arguments (${args.length}) - expects one of (${proto[methodName].overloadTable})!`);
          } return proto[methodName].overloadTable[args.length].apply(this, args);
        }; proto[methodName].overloadTable=[]; proto[methodName].overloadTable[prevFunc.argCount]=prevFunc;
      }
    }; const exposePublicSymbol=(name, value, numArguments)=>{
      if (Module.hasOwnProperty(name)) {
        if (undefined===numArguments||undefined!==Module[name].overloadTable&&undefined!==Module[name].overloadTable[numArguments]) {
          throwBindingError(`Cannot register public name '${name}' twice`);
        }ensureOverloadTable(Module, name, name); if (Module[name].overloadTable.hasOwnProperty(numArguments)) {
          throwBindingError(`Cannot register multiple overloads of a function with the same number of arguments (${numArguments})!`);
        }Module[name].overloadTable[numArguments]=value;
      } else {
        Module[name]=value; Module[name].argCount=numArguments;
      }
    }; const heap32VectorToArray=(count, firstElement)=>{
      const array=[]; for (let i=0; i<count; i++) {
        array.push(HEAPU32[firstElement+i*4>>2]);
      } return array;
    }; const InternalError=class InternalError extends Error {
      constructor(message) {
        super(message); this.name='InternalError';
      }
    }; const throwInternalError=(message)=>{
      throw new InternalError(message);
    }; const replacePublicSymbol=(name, value, numArguments)=>{
      if (!Module.hasOwnProperty(name)) {
        throwInternalError('Replacing nonexistent public symbol');
      } if (undefined!==Module[name].overloadTable&&undefined!==numArguments) {
        Module[name].overloadTable[numArguments]=value;
      } else {
        Module[name]=value; Module[name].argCount=numArguments;
      }
    }; const wasmTableMirror=[]; let wasmTable; const getWasmTableEntry=(funcPtr)=>{
      let func=wasmTableMirror[funcPtr]; if (!func) {
        wasmTableMirror[funcPtr]=func=wasmTable.get(funcPtr);
      } return func;
    }; const embind__requireFunction=(signature, rawFunction, isAsync=false)=>{
      signature=AsciiToString(signature); function makeDynCaller() {
        const rtn=getWasmTableEntry(rawFunction); return rtn;
      } const fp=makeDynCaller(); if (typeof fp!='function') {
        throwBindingError(`unknown function pointer with signature ${signature}: ${rawFunction}`);
      } return fp;
    }; class UnboundTypeError extends Error {} const getTypeName=(type)=>{
      const ptr=___getTypeName(type); const rv=AsciiToString(ptr); _free(ptr); return rv;
    }; const throwUnboundTypeError=(message, types)=>{
      const unboundTypes=[]; const seen={}; function visit(type) {
        if (seen[type]) {
          return;
        } if (registeredTypes[type]) {
          return;
        } if (typeDependencies[type]) {
          typeDependencies[type].forEach(visit); return;
        }unboundTypes.push(type); seen[type]=true;
      }types.forEach(visit); throw new UnboundTypeError(`${message}: `+unboundTypes.map(getTypeName).join([', ']));
    }; const whenDependentTypesAreResolved=(myTypes, dependentTypes, getTypeConverters)=>{
      myTypes.forEach((type)=>typeDependencies[type]=dependentTypes); function onComplete(typeConverters) {
        const myTypeConverters=getTypeConverters(typeConverters); if (myTypeConverters.length!==myTypes.length) {
          throwInternalError('Mismatched type converter count');
        } for (let i=0; i<myTypes.length; ++i) {
          registerType(myTypes[i], myTypeConverters[i]);
        }
      } const typeConverters=new Array(dependentTypes.length); const unregisteredTypes=[]; let registered=0; dependentTypes.forEach((dt, i)=>{
        if (registeredTypes.hasOwnProperty(dt)) {
          typeConverters[i]=registeredTypes[dt];
        } else {
          unregisteredTypes.push(dt); if (!awaitingDependencies.hasOwnProperty(dt)) {
            awaitingDependencies[dt]=[];
          }awaitingDependencies[dt].push(()=>{
            typeConverters[i]=registeredTypes[dt]; ++registered; if (registered===unregisteredTypes.length) {
              onComplete(typeConverters);
            }
          });
        }
      }); if (0===unregisteredTypes.length) {
        onComplete(typeConverters);
      }
    }; const getFunctionName=(signature)=>{
      signature=signature.trim(); const argsIndex=signature.indexOf('('); if (argsIndex===-1) return signature; return signature.slice(0, argsIndex);
    }; const __embind_register_function=(name, argCount, rawArgTypesAddr, signature, rawInvoker, fn, isAsync, isNonnullReturn)=>{
      const argTypes=heap32VectorToArray(argCount, rawArgTypesAddr); name=AsciiToString(name); name=getFunctionName(name); rawInvoker=embind__requireFunction(signature, rawInvoker, isAsync); exposePublicSymbol(name, function() {
        throwUnboundTypeError(`Cannot call ${name} due to unbound types`, argTypes);
      }, argCount-1); whenDependentTypesAreResolved([], argTypes, (argTypes)=>{
        const invokerArgsArray=[argTypes[0], null].concat(argTypes.slice(1)); replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null, rawInvoker, fn, isAsync), argCount-1); return [];
      });
    }; const __embind_register_integer=(primitiveType, name, size, minRange, maxRange)=>{
      name=AsciiToString(name); const isUnsignedType=minRange===0; let fromWireType=(value)=>value; if (isUnsignedType) {
        const bitshift=32-8*size; fromWireType=(value)=>value<<bitshift>>>bitshift; maxRange=fromWireType(maxRange);
      }registerType(primitiveType, {name, fromWireType, toWireType: (destructors, value)=>value, readValueFromPointer: integerReadValueFromPointer(name, size, minRange!==0), destructorFunction: null});
    }; const __embind_register_memory_view=(rawType, dataTypeIndex, name)=>{
      const typeMapping=[Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array]; const TA=typeMapping[dataTypeIndex]; function decodeMemoryView(handle) {
        const size=HEAPU32[handle>>2]; const data=HEAPU32[handle+4>>2]; return new TA(HEAP8.buffer, data, size);
      }name=AsciiToString(name); registerType(rawType, {name, fromWireType: decodeMemoryView, readValueFromPointer: decodeMemoryView}, {ignoreDuplicateRegistrations: true});
    }; const stringToUTF8Array=(str, heap, outIdx, maxBytesToWrite)=>{
      if (!(maxBytesToWrite>0)) return 0; const startIdx=outIdx; const endIdx=outIdx+maxBytesToWrite-1; for (let i=0; i<str.length; ++i) {
        const u=str.codePointAt(i); if (u<=127) {
          if (outIdx>=endIdx) break; heap[outIdx++]=u;
        } else if (u<=2047) {
          if (outIdx+1>=endIdx) break; heap[outIdx++]=192|u>>6; heap[outIdx++]=128|u&63;
        } else if (u<=65535) {
          if (outIdx+2>=endIdx) break; heap[outIdx++]=224|u>>12; heap[outIdx++]=128|u>>6&63; heap[outIdx++]=128|u&63;
        } else {
          if (outIdx+3>=endIdx) break; heap[outIdx++]=240|u>>18; heap[outIdx++]=128|u>>12&63; heap[outIdx++]=128|u>>6&63; heap[outIdx++]=128|u&63; i++;
        }
      }heap[outIdx]=0; return outIdx-startIdx;
    }; const stringToUTF8=(str, outPtr, maxBytesToWrite)=>stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite); const lengthBytesUTF8=(str)=>{
      let len=0; for (let i=0; i<str.length; ++i) {
        const c=str.charCodeAt(i); if (c<=127) {
          len++;
        } else if (c<=2047) {
          len+=2;
        } else if (c>=55296&&c<=57343) {
          len+=4; ++i;
        } else {
          len+=3;
        }
      } return len;
    }; const UTF8Decoder=typeof TextDecoder!='undefined'?new TextDecoder:undefined; const findStringEnd=(heapOrArray, idx, maxBytesToRead, ignoreNul)=>{
      const maxIdx=idx+maxBytesToRead; if (ignoreNul) return maxIdx; while (heapOrArray[idx]&&!(idx>=maxIdx))++idx; return idx;
    }; const UTF8ArrayToString=(heapOrArray, idx=0, maxBytesToRead, ignoreNul)=>{
      const endPtr=findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul); if (endPtr-idx>16&&heapOrArray.buffer&&UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
      } let str=''; while (idx<endPtr) {
        let u0=heapOrArray[idx++]; if (!(u0&128)) {
          str+=String.fromCharCode(u0); continue;
        } const u1=heapOrArray[idx++]&63; if ((u0&224)==192) {
          str+=String.fromCharCode((u0&31)<<6|u1); continue;
        } const u2=heapOrArray[idx++]&63; if ((u0&240)==224) {
          u0=(u0&15)<<12|u1<<6|u2;
        } else {
          u0=(u0&7)<<18|u1<<12|u2<<6|heapOrArray[idx++]&63;
        } if (u0<65536) {
          str+=String.fromCharCode(u0);
        } else {
          const ch=u0-65536; str+=String.fromCharCode(55296|ch>>10, 56320|ch&1023);
        }
      } return str;
    }; const UTF8ToString=(ptr, maxBytesToRead, ignoreNul)=>ptr?UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul):''; const __embind_register_std_string=(rawType, name)=>{
      name=AsciiToString(name); const stdStringIsUTF8=true; registerType(rawType, {name, fromWireType(value) {
        const length=HEAPU32[value>>2]; const payload=value+4; let str; if (stdStringIsUTF8) {
          str=UTF8ToString(payload, length, true);
        } else {
          str=''; for (let i=0; i<length; ++i) {
            str+=String.fromCharCode(HEAPU8[payload+i]);
          }
        }_free(value); return str;
      }, toWireType(destructors, value) {
        if (value instanceof ArrayBuffer) {
          value=new Uint8Array(value);
        } let length; const valueIsOfTypeString=typeof value=='string'; if (!(valueIsOfTypeString||ArrayBuffer.isView(value)&&value.BYTES_PER_ELEMENT==1)) {
          throwBindingError('Cannot pass non-string to std::string');
        } if (stdStringIsUTF8&&valueIsOfTypeString) {
          length=lengthBytesUTF8(value);
        } else {
          length=value.length;
        } const base=_malloc(4+length+1); const ptr=base+4; HEAPU32[base>>2]=length; if (valueIsOfTypeString) {
          if (stdStringIsUTF8) {
            stringToUTF8(value, ptr, length+1);
          } else {
            for (let i=0; i<length; ++i) {
              const charCode=value.charCodeAt(i); if (charCode>255) {
                _free(base); throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
              }HEAPU8[ptr+i]=charCode;
            }
          }
        } else {
          HEAPU8.set(value, ptr);
        } if (destructors!==null) {
          destructors.push(_free, base);
        } return base;
      }, readValueFromPointer: readPointer, destructorFunction(ptr) {
        _free(ptr);
      }});
    }; const UTF16Decoder=typeof TextDecoder!='undefined'?new TextDecoder('utf-16le'):undefined; const UTF16ToString=(ptr, maxBytesToRead, ignoreNul)=>{
      const idx=ptr>>1; const endIdx=findStringEnd(HEAPU16, idx, maxBytesToRead/2, ignoreNul); if (endIdx-idx>16&&UTF16Decoder) return UTF16Decoder.decode(HEAPU16.subarray(idx, endIdx)); let str=''; for (let i=idx; i<endIdx; ++i) {
        const codeUnit=HEAPU16[i]; str+=String.fromCharCode(codeUnit);
      } return str;
    }; const stringToUTF16=(str, outPtr, maxBytesToWrite)=>{
      maxBytesToWrite??=2147483647; if (maxBytesToWrite<2) return 0; maxBytesToWrite-=2; const startPtr=outPtr; const numCharsToWrite=maxBytesToWrite<str.length*2?maxBytesToWrite/2:str.length; for (let i=0; i<numCharsToWrite; ++i) {
        const codeUnit=str.charCodeAt(i); HEAP16[outPtr>>1]=codeUnit; outPtr+=2;
      }HEAP16[outPtr>>1]=0; return outPtr-startPtr;
    }; const lengthBytesUTF16=(str)=>str.length*2; const UTF32ToString=(ptr, maxBytesToRead, ignoreNul)=>{
      let str=''; const startIdx=ptr>>2; for (let i=0; !(i>=maxBytesToRead/4); i++) {
        const utf32=HEAPU32[startIdx+i]; if (!utf32&&!ignoreNul) break; str+=String.fromCodePoint(utf32);
      } return str;
    }; const stringToUTF32=(str, outPtr, maxBytesToWrite)=>{
      maxBytesToWrite??=2147483647; if (maxBytesToWrite<4) return 0; const startPtr=outPtr; const endPtr=startPtr+maxBytesToWrite-4; for (let i=0; i<str.length; ++i) {
        const codePoint=str.codePointAt(i); if (codePoint>65535) {
          i++;
        }HEAP32[outPtr>>2]=codePoint; outPtr+=4; if (outPtr+4>endPtr) break;
      }HEAP32[outPtr>>2]=0; return outPtr-startPtr;
    }; const lengthBytesUTF32=(str)=>{
      let len=0; for (let i=0; i<str.length; ++i) {
        const codePoint=str.codePointAt(i); if (codePoint>65535) {
          i++;
        }len+=4;
      } return len;
    }; const __embind_register_std_wstring=(rawType, charSize, name)=>{
      name=AsciiToString(name); let decodeString; let encodeString; let lengthBytesUTF; if (charSize===2) {
        decodeString=UTF16ToString; encodeString=stringToUTF16; lengthBytesUTF=lengthBytesUTF16;
      } else {
        decodeString=UTF32ToString; encodeString=stringToUTF32; lengthBytesUTF=lengthBytesUTF32;
      }registerType(rawType, {name, fromWireType: (value)=>{
        const length=HEAPU32[value>>2]; const str=decodeString(value+4, length*charSize, true); _free(value); return str;
      }, toWireType: (destructors, value)=>{
        if (!(typeof value=='string')) {
          throwBindingError(`Cannot pass non-string to C++ string type ${name}`);
        } const length=lengthBytesUTF(value); const ptr=_malloc(4+length+charSize); HEAPU32[ptr>>2]=length/charSize; encodeString(value, ptr+4, length+charSize); if (destructors!==null) {
          destructors.push(_free, ptr);
        } return ptr;
      }, readValueFromPointer: readPointer, destructorFunction(ptr) {
        _free(ptr);
      }});
    }; const __embind_register_void=(rawType, name)=>{
      name=AsciiToString(name); registerType(rawType, {isVoid: true, name, fromWireType: ()=>undefined, toWireType: (destructors, o)=>undefined});
    }; const emval_methodCallers=[]; const emval_addMethodCaller=(caller)=>{
      const id=emval_methodCallers.length; emval_methodCallers.push(caller); return id;
    }; const requireRegisteredType=(rawType, humanName)=>{
      const impl=registeredTypes[rawType]; if (undefined===impl) {
        throwBindingError(`${humanName} has unknown type ${getTypeName(rawType)}`);
      } return impl;
    }; const emval_lookupTypes=(argCount, argTypes)=>{
      const a=new Array(argCount); for (let i=0; i<argCount; ++i) {
        a[i]=requireRegisteredType(HEAPU32[argTypes+i*4>>2], `parameter ${i}`);
      } return a;
    }; const emval_returnValue=(toReturnWire, destructorsRef, handle)=>{
      const destructors=[]; const result=toReturnWire(destructors, handle); if (destructors.length) {
        HEAPU32[destructorsRef>>2]=Emval.toHandle(destructors);
      } return result;
    }; const emval_symbols={}; const getStringOrSymbol=(address)=>{
      const symbol=emval_symbols[address]; if (symbol===undefined) {
        return AsciiToString(address);
      } return symbol;
    }; const __emval_create_invoker=(argCount, argTypesPtr, kind)=>{
      const GenericWireTypeSize=8; const [retType, ...argTypes]=emval_lookupTypes(argCount, argTypesPtr); const toReturnWire=retType.toWireType.bind(retType); const argFromPtr=argTypes.map((type)=>type.readValueFromPointer.bind(type)); argCount--; const argN=new Array(argCount); const invokerFunction=(handle, methodName, destructorsRef, args)=>{
        let offset=0; for (let i=0; i<argCount; ++i) {
          argN[i]=argFromPtr[i](args+offset); offset+=GenericWireTypeSize;
        } let rv; switch (kind) {
          case 0: rv=Emval.toValue(handle).apply(null, argN); break; case 2: rv=Reflect.construct(Emval.toValue(handle), argN); break; case 3: rv=argN[0]; break; case 1: rv=Emval.toValue(handle)[getStringOrSymbol(methodName)](...argN); break;
        } return emval_returnValue(toReturnWire, destructorsRef, rv);
      }; const functionName=`methodCaller<(${argTypes.map((t)=>t.name)}) => ${retType.name}>`; return emval_addMethodCaller(createNamedFunction(functionName, invokerFunction));
    }; const __emval_invoke=(caller, handle, methodName, destructorsRef, args)=>emval_methodCallers[caller](handle, methodName, destructorsRef, args); const __emval_run_destructors=(handle)=>{
      const destructors=Emval.toValue(handle); runDestructors(destructors); __emval_decref(handle);
    }; const getHeapMax=()=>2147483648; const alignMemory=(size, alignment)=>Math.ceil(size/alignment)*alignment; const growMemory=(size)=>{
      const oldHeapSize=wasmMemory.buffer.byteLength; const pages=(size-oldHeapSize+65535)/65536|0; try {
        wasmMemory.grow(pages); updateMemoryViews(); return 1;
      } catch (e) {}
    }; const _emscripten_resize_heap=(requestedSize)=>{
      const oldSize=HEAPU8.length; requestedSize>>>=0; const maxHeapSize=getHeapMax(); if (requestedSize>maxHeapSize) {
        return false;
      } for (let cutDown=1; cutDown<=4; cutDown*=2) {
        let overGrownHeapSize=oldSize*(1+.2/cutDown); overGrownHeapSize=Math.min(overGrownHeapSize, requestedSize+100663296); const newSize=Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536)); const replacement=growMemory(newSize); if (replacement) {
          return true;
        }
      } return false;
    }; const runtimeKeepaliveCounter=0; const keepRuntimeAlive=()=>noExitRuntime||runtimeKeepaliveCounter>0; const _proc_exit=(code)=>{
      EXITSTATUS=code; if (!keepRuntimeAlive()) {
        Module['onExit']?.(code); ABORT=true;
      }quit_(code, new ExitStatus(code));
    }; const exitJS=(status, implicit)=>{
      EXITSTATUS=status; _proc_exit(status);
    }; const handleException=(e)=>{
      if (e instanceof ExitStatus||e=='unwind') {
        return EXITSTATUS;
      }quit_(1, e);
    }; {if (Module['noExitRuntime'])noExitRuntime=Module['noExitRuntime']; if (Module['print'])out=Module['print']; if (Module['printErr'])err=Module['printErr']; if (Module['wasmBinary'])wasmBinary=Module['wasmBinary']; if (Module['arguments'])arguments_=Module['arguments']; if (Module['thisProgram'])thisProgram=Module['thisProgram'];} let ___getTypeName; let _main; let _free; let _malloc; function assignWasmExports(wasmExports) {
      ___getTypeName=wasmExports['s']; Module['_main']=_main=wasmExports['u']; _free=wasmExports['v']; _malloc=wasmExports['w'];
    } var wasmImports={l: ___cxa_throw, m: __abort_js, f: __embind_register_bigint, j: __embind_register_bool, o: __embind_register_emval, e: __embind_register_float, c: __embind_register_function, b: __embind_register_integer, a: __embind_register_memory_view, p: __embind_register_std_string, d: __embind_register_std_wstring, k: __embind_register_void, i: __emval_create_invoker, h: __emval_invoke, g: __emval_run_destructors, n: _emscripten_resize_heap}; var wasmExports=createWasm(); function callMain() {
      const entryFunction=_main; const argc=0; const argv=0; try {
        const ret=entryFunction(argc, argv); exitJS(ret, true); return ret;
      } catch (e) {
        return handleException(e);
      }
    } function run() {
      if (runDependencies>0) {
        dependenciesFulfilled=run; return;
      }preRun(); if (runDependencies>0) {
        dependenciesFulfilled=run; return;
      } function doRun() {
        Module['calledRun']=true; if (ABORT) return; initRuntime(); preMain(); readyPromiseResolve?.(Module); Module['onRuntimeInitialized']?.(); const noInitialRun=Module['noInitialRun']||false; if (!noInitialRun)callMain(); postRun();
      } if (Module['setStatus']) {
        Module['setStatus']('Running...'); setTimeout(()=>{
          setTimeout(()=>Module['setStatus'](''), 1); doRun();
        }, 1);
      } else {
        doRun();
      }
    } function preInit() {
      if (Module['preInit']) {
        if (typeof Module['preInit']=='function')Module['preInit']=[Module['preInit']]; while (Module['preInit'].length>0) {
          Module['preInit'].shift()();
        }
      }
    }preInit(); run(); if (runtimeInitialized) {
      moduleRtn=Module;
    } else {
      moduleRtn=new Promise((resolve, reject)=>{
        readyPromiseResolve=resolve; readyPromiseReject=reject;
      });
    }
    ;return moduleRtn;
  }/* harmony default export */ const glue = (LoadSRC);

  ;// ./src/libsamplerate.ts
  const __awaiter = (undefined && undefined.__awaiter) || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P ? value : new P(function(resolve) {
        resolve(value);
      });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
 result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
  const __generator = (undefined && undefined.__generator) || function(thisArg, body) {
    let _ = {label: 0, sent: function() {
      if (t[0] & 1) throw t[1]; return t[1];
    }, trys: [], ops: []}; let f; let y; let t; let g;
    return g = {'next': verb(0), 'throw': verb(1), 'return': verb(2)}, typeof Symbol === 'function' && (g[Symbol.iterator] = function() {
      return this;
    }), g;
    function verb(n) {
      return function(v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.');
      while (g && (g = 0, op[0] && (_ = 0)), _) {
        try {
          if (f = 1, y && (t = op[0] & 2 ? y['return'] : op[0] ? y['throw'] || ((t = y['return']) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
          if (y = 0, t) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0: case 1: t = op; break;
            case 4: _.label++; return {value: op[1], done: false};
            case 5: _.label++; y = op[1]; op = [0]; continue;
            case 7: op = _.ops.pop(); _.trys.pop(); continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0; continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1]; break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1]; t = op; break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2]; _.ops.push(op); break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop(); continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e]; y = 0;
        } finally {
          f = t = 0;
        }
      }
      if (op[0] & 5) throw op[1]; return {value: op[0] ? op[1] : void 0, done: true};
    }
  };
  /**
 * The entry point into this library. All of the actual resampling work is handled in src.ts
 */


  /**
 * Load the libsamplerate wasm module and wrap it in a SRC object.
 *
 * options = {
 *   converterType: {ConverterType} default SRC_SINC_FASTEST
 * }
 *
 * @param nChannels the number of output channels. 1-128 supported
 * @param inputSampleRate The sample rate of whatever source audio you want to resample
 * @param outputSampleRate If playing audio in-browser, this should be equal to AudioContext.sampleRate
 * @param options Additional configuration information. see above
 * @return a promise containing the SRC object on resolve, or error message on error
 */
  function create(nChannels, inputSampleRate, outputSampleRate, options) {
    return __awaiter(this, void 0, void 0, function() {
      let cType; let loadedModule; let src;
      return __generator(this, function(_a) {
        switch (_a.label) {
          case 0:
            cType = (options === null || options === void 0 ? void 0 : options.converterType) === undefined ?
                        ConverterType.SRC_SINC_FASTEST :
                        options === null || options === void 0 ? void 0 : options.converterType;
            validate(nChannels, inputSampleRate, outputSampleRate, cType);
            return [4 /* yield*/, glue()];
          case 1:
            loadedModule = _a.sent();
            src = new SRC(loadedModule, cType, nChannels, inputSampleRate, outputSampleRate);
            return [2 /* return*/, src];
        }
      });
    });
  }

  /**
 * Validates the input data. Throws if data is invalid
 *
 * @param nChannels the number of output channels. 1-128 supported
 * @param inputSampleRate The sample rate of whatever source audio you want to resample
 * @param outputSampleRate If playing audio in-browser, this should be equal to AudioContext.sampleRate
 * @param cType ConverterType. See above
 */
  function validate(nChannels, inputSampleRate, outputSampleRate, cType) {
    if (nChannels === undefined) {
      throw 'nChannels is undefined';
    }
    if (inputSampleRate === undefined) {
      throw 'inputSampleRate is undefined';
    }
    if (outputSampleRate === undefined) {
      throw 'outputSampleRate is undefined';
    }
    if (nChannels < 1 || nChannels > 128) {
      throw 'invalid nChannels submitted';
    }
    if (inputSampleRate < 1 || inputSampleRate > 192000) {
      throw 'invalid inputSampleRate';
    }
    if (outputSampleRate < 1 || outputSampleRate > 192000) {
      throw 'invalid outputSampleRate';
    }
    if (cType < ConverterType.SRC_SINC_BEST_QUALITY ||
        cType > ConverterType.SRC_LINEAR) {
      throw 'invalid converterType';
    }
  }
  // // Enables us to access this library in the `AudioWorkletGlobalScope` object via
  // // globalThis.LibSampleRate. This library should be loaded into the `AudioWorkletGlobalScope`
  // // with audioCtx.audioWorklet.addModule('@alexanderolsen/libsamplerate-js').
  // if (globalThis.constructor.name === 'AudioWorkletGlobalScope') {
  // 	// eslint-disable-next-line @typescript-eslint/no-explicit-any
  // 	(globalThis as any).LibSampleRate = {
  // 		create,
  // 		ConverterType,
  // 	};
  // }
})();

const __webpack_exports__ConverterType = __webpack_exports__.ConverterType;
const __webpack_exports__create = __webpack_exports__.create;
export {__webpack_exports__ConverterType as ConverterType, __webpack_exports__create as create};

// # sourceMappingURL=libsamplerate.js.map
