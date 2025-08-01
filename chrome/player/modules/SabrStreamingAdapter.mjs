/* eslint-disable */
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// dist/src/utils/shared.js
var MAX_INT32_VALUE = 2147483647;
var EnabledTrackTypes = {
  VIDEO_AND_AUDIO: 0,
  0: "VIDEO_AND_AUDIO",
  AUDIO_ONLY: 1,
  1: "AUDIO_ONLY",
  VIDEO_ONLY: 2,
  2: "VIDEO_ONLY"
};
function parseRangeHeader(rangeHeaderValue) {
  var _a;
  if (!rangeHeaderValue)
    return void 0;
  const parts = (_a = rangeHeaderValue.split("=")[1]) == null ? void 0 : _a.split("-");
  if (parts == null ? void 0 : parts.length) {
    const start = Number(parts[0]);
    const end = Number(parts[1]);
    return { start, end };
  }
  return void 0;
}
__name(parseRangeHeader, "parseRangeHeader");
function base64ToU8(base64) {
  const standard_base64 = base64.replace(/-/g, "+").replace(/_/g, "/");
  const padded_base64 = standard_base64.padEnd(standard_base64.length + (4 - standard_base64.length % 4) % 4, "=");
  return new Uint8Array(atob(padded_base64).split("").map((char) => char.charCodeAt(0)));
}
__name(base64ToU8, "base64ToU8");
function concatenateChunks(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
__name(concatenateChunks, "concatenateChunks");

// dist/src/utils/formatKeyUtils.js
var formatKeyUtils_exports = {};
__export(formatKeyUtils_exports, {
  createKey: () => createKey,
  createSegmentCacheKey: () => createSegmentCacheKey,
  createSegmentCacheKeyFromMetadata: () => createSegmentCacheKeyFromMetadata,
  fromFormat: () => fromFormat,
  fromFormatInitializationMetadata: () => fromFormatInitializationMetadata,
  fromMediaHeader: () => fromMediaHeader,
  getUniqueFormatId: () => getUniqueFormatId
});
function createKey(itag, xtags) {
  return `${itag || ""}:${xtags || ""}`;
}
__name(createKey, "createKey");
function fromFormat(format) {
  if (!format)
    return void 0;
  return createKey(format.itag, format.xtags);
}
__name(fromFormat, "fromFormat");
function fromMediaHeader(mediaHeader) {
  return createKey(mediaHeader.itag, mediaHeader.xtags);
}
__name(fromMediaHeader, "fromMediaHeader");
function fromFormatInitializationMetadata(formatInitMetadata) {
  if (!formatInitMetadata.formatId)
    return "";
  return createKey(formatInitMetadata.formatId.itag, formatInitMetadata.formatId.xtags);
}
__name(fromFormatInitializationMetadata, "fromFormatInitializationMetadata");
function createSegmentCacheKey(mediaHeader, format) {
  if (mediaHeader.isInitSeg && format) {
    return `${mediaHeader.itag}:${mediaHeader.xtags || ""}:${format.contentLength || ""}:${format.mimeType || ""}`;
  }
  return `${mediaHeader.startRange || "0"}-${mediaHeader.itag}-${mediaHeader.xtags || ""}`;
}
__name(createSegmentCacheKey, "createSegmentCacheKey");
function createSegmentCacheKeyFromMetadata(requestMetadata) {
  if (!requestMetadata.byteRange || !requestMetadata.format)
    throw new Error("Invalid metadata: byteRange or format is missing");
  const pseudoMediaHeader = {
    itag: requestMetadata.format.itag,
    xtags: requestMetadata.format.xtags || "",
    startRange: requestMetadata.byteRange.start,
    isInitSeg: requestMetadata.isInit
  };
  return createSegmentCacheKey(pseudoMediaHeader, requestMetadata.isInit ? requestMetadata.format : void 0);
}
__name(createSegmentCacheKeyFromMetadata, "createSegmentCacheKeyFromMetadata");
function getUniqueFormatId(format) {
  if (format.width)
    return format.itag.toString();
  const uidParts = [format.itag.toString()];
  if (format.audioTrackId) {
    uidParts.push(format.audioTrackId);
  }
  if (format.isDrc) {
    uidParts.push("drc");
  }
  return uidParts.join("-");
}
__name(getUniqueFormatId, "getUniqueFormatId");

// dist/src/utils/Logger.js
var LogLevel = {
  NONE: 0,
  0: "NONE",
  ERROR: 1,
  1: "ERROR",
  WARN: 2,
  2: "WARN",
  INFO: 3,
  3: "INFO",
  DEBUG: 4,
  4: "DEBUG",
  ALL: 99,
  99: "ALL"
};
var _Logger = class _Logger {
  constructor() {
    this.currentLogLevels = /* @__PURE__ */ new Set([LogLevel.INFO, LogLevel.ALL]);
  }
  static getInstance() {
    if (!_Logger.instance) {
      _Logger.instance = new _Logger();
    }
    return _Logger.instance;
  }
  /**
   * Sets the active log levels.
   * Call with LogLevel.NONE or no arguments to turn off all logging.
   * Otherwise, specify one or more log levels to be active.
   * Use LogLevel.ALL to enable all log levels.
   */
  setLogLevels(...levels) {
    if (levels.length === 0 || levels.includes(LogLevel.NONE)) {
      this.currentLogLevels = /* @__PURE__ */ new Set();
    } else if (levels.includes(LogLevel.ALL)) {
      this.currentLogLevels = /* @__PURE__ */ new Set([
        LogLevel.ERROR,
        LogLevel.WARN,
        LogLevel.INFO,
        LogLevel.DEBUG
      ]);
    } else {
      this.currentLogLevels = new Set(levels.filter((level) => level !== LogLevel.NONE && level !== LogLevel.ALL));
    }
  }
  /**
   * Gets the current set of active log levels.
   * @returns A new Set containing the active LogLevel enums.
   */
  getLogLevels() {
    return new Set(this.currentLogLevels);
  }
  log(level, tag, ...messages) {
    if (level !== LogLevel.NONE && this.currentLogLevels.has(level)) {
      const prefix = `[${LogLevel[level]}] [${tag}]`;
      switch (level) {
        case LogLevel.ERROR:
          console.error(prefix, ...messages);
          break;
        case LogLevel.WARN:
          console.warn(prefix, ...messages);
          break;
        case LogLevel.INFO:
          console.info(prefix, ...messages);
          break;
        case LogLevel.DEBUG:
          console.debug(prefix, ...messages);
          break;
      }
    }
  }
  error(tag, ...messages) {
    this.log(LogLevel.ERROR, tag, ...messages);
  }
  warn(tag, ...messages) {
    this.log(LogLevel.WARN, tag, ...messages);
  }
  info(tag, ...messages) {
    this.log(LogLevel.INFO, tag, ...messages);
  }
  debug(tag, ...messages) {
    this.log(LogLevel.DEBUG, tag, ...messages);
  }
};
__name(_Logger, "Logger");
var Logger = _Logger;

// dist/src/utils/CacheManager.js
var TAG = "CacheManager";
var _CacheManager = class _CacheManager {
  constructor(maxSizeMB = 50, maxAgeSeconds = 600) {
    this.initSegmentCache = /* @__PURE__ */ new Map();
    this.segmentCache = /* @__PURE__ */ new Map();
    this.currentSize = 0;
    this.logger = Logger.getInstance();
    this.maxCacheSize = maxSizeMB * 1024 * 1024;
    this.maxAge = maxAgeSeconds * 1e3;
    this.startGarbageCollection();
  }
  getCacheEntries() {
    return {
      initSegmentCache: this.initSegmentCache,
      segmentCache: this.segmentCache
    };
  }
  setInitSegment(key, data) {
    const entry = {
      data,
      timestamp: Date.now(),
      size: data.byteLength
    };
    if (!this.initSegmentCache.has(key)) {
      this.currentSize += entry.size;
      this.enforceStorageLimit();
    }
    this.initSegmentCache.set(key, entry);
  }
  setSegment(key, data) {
    const entry = {
      data,
      timestamp: Date.now(),
      size: data.byteLength
    };
    this.currentSize += entry.size;
    this.enforceStorageLimit();
    this.segmentCache.set(key, entry);
  }
  getInitSegment(key) {
    const entry = this.initSegmentCache.get(key);
    if (entry && !this.isExpired(entry)) {
      this.logger.debug(TAG, `Cache hit for init segment: ${key}`);
      entry.timestamp = Date.now();
      return entry.data;
    }
    if (entry) {
      this.initSegmentCache.delete(key);
      this.currentSize -= entry.size;
    }
    return void 0;
  }
  getSegment(key) {
    const entry = this.segmentCache.get(key);
    if (entry && !this.isExpired(entry)) {
      this.logger.debug(TAG, `Cache hit for segment: ${key}`);
      const data = entry.data;
      this.segmentCache.delete(key);
      this.currentSize -= entry.size;
      return data;
    }
    if (entry) {
      this.segmentCache.delete(key);
      this.currentSize -= entry.size;
    }
    return void 0;
  }
  isExpired(entry) {
    return Date.now() - entry.timestamp > this.maxAge;
  }
  enforceStorageLimit() {
    if (this.currentSize <= this.maxCacheSize)
      return;
    this.clearExpiredEntries();
    if (this.currentSize > this.maxCacheSize) {
      this.removeOldestEntries();
    }
  }
  clearExpiredEntries() {
    const now = Date.now();
    for (const [key, entry] of this.segmentCache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.logger.debug(TAG, `Removing expired segment from cache: ${key}`);
        this.segmentCache.delete(key);
        this.currentSize -= entry.size;
      }
    }
    for (const [key, entry] of this.initSegmentCache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.logger.debug(TAG, `Removing expired init segment from cache: ${key}`);
        this.initSegmentCache.delete(key);
        this.currentSize -= entry.size;
      }
    }
  }
  removeOldestEntries() {
    const segments = Array.from(this.segmentCache.entries());
    const initSegments = Array.from(this.initSegmentCache.entries());
    const allEntries = [...segments, ...initSegments].sort((a, b) => a[1].timestamp - b[1].timestamp);
    while (this.currentSize > this.maxCacheSize && allEntries.length > 0) {
      const [key, entry] = allEntries.shift();
      this.segmentCache.delete(key);
      this.initSegmentCache.delete(key);
      this.currentSize -= entry.size;
    }
  }
  startGarbageCollection() {
    this.timerId = setInterval(() => {
      this.clearExpiredEntries();
    }, 6e4);
  }
  dispose() {
    this.initSegmentCache.clear();
    this.segmentCache.clear();
    this.currentSize = 0;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = void 0;
    }
    this.logger.debug(TAG, "Disposed");
  }
};
__name(_CacheManager, "CacheManager");
var CacheManager = _CacheManager;

// dist/src/utils/EventEmitterLike.js
var _CustomEvent_detail;
var _EventEmitterLike_legacyListeners;
_CustomEvent_detail = /* @__PURE__ */ new WeakMap();
var _SabrAdapterError = class _SabrAdapterError extends Error {
  constructor(message, code) {
    super(`[SabrStreamingAdapter] ${message}`);
    this.code = code;
    this.name = "SabrAdapterError";
  }
};
__name(_SabrAdapterError, "SabrAdapterError");
var SabrAdapterError = _SabrAdapterError;
_EventEmitterLike_legacyListeners = /* @__PURE__ */ new WeakMap();

// dist/src/utils/RequestMetadataManager.js
var _RequestMetadataManager = class _RequestMetadataManager {
  constructor() {
    this.CLEANUP_INTERVAL = 3e4;
    this.ENTRY_EXPIRATION_TIME = 1e3 * 60 * 3;
    this.metadataMap = /* @__PURE__ */ new Map();
    this.lastCleanup = Date.now();
  }
  getRequestMetadata(url, del = false) {
    const requestNumber = new URL(url).searchParams.get("rn") || "";
    const streamingContext = this.metadataMap.get(requestNumber);
    if (streamingContext && Date.now() - streamingContext.timestamp > this.ENTRY_EXPIRATION_TIME) {
      this.metadataMap.delete(requestNumber);
      return void 0;
    }
    if (del) {
      this.metadataMap.delete(requestNumber);
    }
    this.conditionalCleanUp();
    return streamingContext;
  }
  setRequestMetadata(url, context) {
    const requestNumber = new URL(url).searchParams.get("rn");
    if (requestNumber) {
      this.metadataMap.set(requestNumber, context);
      this.conditionalCleanUp();
    }
  }
  conditionalCleanUp() {
    const now = Date.now();
    if (now - this.lastCleanup > this.CLEANUP_INTERVAL) {
      this.cleanUp();
      this.lastCleanup = now;
    }
  }
  cleanUp() {
    for (const [key, context] of this.metadataMap.entries()) {
      if (Date.now() - context.timestamp > this.ENTRY_EXPIRATION_TIME) {
        this.metadataMap.delete(key);
      }
    }
  }
};
__name(_RequestMetadataManager, "RequestMetadataManager");
var RequestMetadataManager = _RequestMetadataManager;

// node_modules/@bufbuild/protobuf/dist/esm/wire/varint.js
function varint64read() {
  let lowBits = 0;
  let highBits = 0;
  for (let shift = 0; shift < 28; shift += 7) {
    let b = this.buf[this.pos++];
    lowBits |= (b & 127) << shift;
    if ((b & 128) == 0) {
      this.assertBounds();
      return [lowBits, highBits];
    }
  }
  let middleByte = this.buf[this.pos++];
  lowBits |= (middleByte & 15) << 28;
  highBits = (middleByte & 112) >> 4;
  if ((middleByte & 128) == 0) {
    this.assertBounds();
    return [lowBits, highBits];
  }
  for (let shift = 3; shift <= 31; shift += 7) {
    let b = this.buf[this.pos++];
    highBits |= (b & 127) << shift;
    if ((b & 128) == 0) {
      this.assertBounds();
      return [lowBits, highBits];
    }
  }
  throw new Error("invalid varint");
}
__name(varint64read, "varint64read");
function varint64write(lo, hi, bytes) {
  for (let i = 0; i < 28; i = i + 7) {
    const shift = lo >>> i;
    const hasNext = !(shift >>> 7 == 0 && hi == 0);
    const byte = (hasNext ? shift | 128 : shift) & 255;
    bytes.push(byte);
    if (!hasNext) {
      return;
    }
  }
  const splitBits = lo >>> 28 & 15 | (hi & 7) << 4;
  const hasMoreBits = !(hi >> 3 == 0);
  bytes.push((hasMoreBits ? splitBits | 128 : splitBits) & 255);
  if (!hasMoreBits) {
    return;
  }
  for (let i = 3; i < 31; i = i + 7) {
    const shift = hi >>> i;
    const hasNext = !(shift >>> 7 == 0);
    const byte = (hasNext ? shift | 128 : shift) & 255;
    bytes.push(byte);
    if (!hasNext) {
      return;
    }
  }
  bytes.push(hi >>> 31 & 1);
}
__name(varint64write, "varint64write");
var TWO_PWR_32_DBL = 4294967296;
function int64FromString(dec) {
  const minus = dec[0] === "-";
  if (minus) {
    dec = dec.slice(1);
  }
  const base = 1e6;
  let lowBits = 0;
  let highBits = 0;
  function add1e6digit(begin, end) {
    const digit1e6 = Number(dec.slice(begin, end));
    highBits *= base;
    lowBits = lowBits * base + digit1e6;
    if (lowBits >= TWO_PWR_32_DBL) {
      highBits = highBits + (lowBits / TWO_PWR_32_DBL | 0);
      lowBits = lowBits % TWO_PWR_32_DBL;
    }
  }
  __name(add1e6digit, "add1e6digit");
  add1e6digit(-24, -18);
  add1e6digit(-18, -12);
  add1e6digit(-12, -6);
  add1e6digit(-6);
  return minus ? negate(lowBits, highBits) : newBits(lowBits, highBits);
}
__name(int64FromString, "int64FromString");
function int64ToString(lo, hi) {
  let bits = newBits(lo, hi);
  const negative = bits.hi & 2147483648;
  if (negative) {
    bits = negate(bits.lo, bits.hi);
  }
  const result = uInt64ToString(bits.lo, bits.hi);
  return negative ? "-" + result : result;
}
__name(int64ToString, "int64ToString");
function uInt64ToString(lo, hi) {
  ({ lo, hi } = toUnsigned(lo, hi));
  if (hi <= 2097151) {
    return String(TWO_PWR_32_DBL * hi + lo);
  }
  const low = lo & 16777215;
  const mid = (lo >>> 24 | hi << 8) & 16777215;
  const high = hi >> 16 & 65535;
  let digitA = low + mid * 6777216 + high * 6710656;
  let digitB = mid + high * 8147497;
  let digitC = high * 2;
  const base = 1e7;
  if (digitA >= base) {
    digitB += Math.floor(digitA / base);
    digitA %= base;
  }
  if (digitB >= base) {
    digitC += Math.floor(digitB / base);
    digitB %= base;
  }
  return digitC.toString() + decimalFrom1e7WithLeadingZeros(digitB) + decimalFrom1e7WithLeadingZeros(digitA);
}
__name(uInt64ToString, "uInt64ToString");
function toUnsigned(lo, hi) {
  return { lo: lo >>> 0, hi: hi >>> 0 };
}
__name(toUnsigned, "toUnsigned");
function newBits(lo, hi) {
  return { lo: lo | 0, hi: hi | 0 };
}
__name(newBits, "newBits");
function negate(lowBits, highBits) {
  highBits = ~highBits;
  if (lowBits) {
    lowBits = ~lowBits + 1;
  } else {
    highBits += 1;
  }
  return newBits(lowBits, highBits);
}
__name(negate, "negate");
var decimalFrom1e7WithLeadingZeros = /* @__PURE__ */ __name((digit1e7) => {
  const partial = String(digit1e7);
  return "0000000".slice(partial.length) + partial;
}, "decimalFrom1e7WithLeadingZeros");
function varint32write(value, bytes) {
  if (value >= 0) {
    while (value > 127) {
      bytes.push(value & 127 | 128);
      value = value >>> 7;
    }
    bytes.push(value);
  } else {
    for (let i = 0; i < 9; i++) {
      bytes.push(value & 127 | 128);
      value = value >> 7;
    }
    bytes.push(1);
  }
}
__name(varint32write, "varint32write");
function varint32read() {
  let b = this.buf[this.pos++];
  let result = b & 127;
  if ((b & 128) == 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 127) << 7;
  if ((b & 128) == 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 127) << 14;
  if ((b & 128) == 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 127) << 21;
  if ((b & 128) == 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 15) << 28;
  for (let readBytes = 5; (b & 128) !== 0 && readBytes < 10; readBytes++)
    b = this.buf[this.pos++];
  if ((b & 128) != 0)
    throw new Error("invalid varint");
  this.assertBounds();
  return result >>> 0;
}
__name(varint32read, "varint32read");

// node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js
var protoInt64 = /* @__PURE__ */ makeInt64Support();
function makeInt64Support() {
  const dv = new DataView(new ArrayBuffer(8));
  const ok = typeof BigInt === "function" && typeof dv.getBigInt64 === "function" && typeof dv.getBigUint64 === "function" && typeof dv.setBigInt64 === "function" && typeof dv.setBigUint64 === "function" && (typeof process != "object" || typeof process.env != "object" || process.env.BUF_BIGINT_DISABLE !== "1");
  if (ok) {
    const MIN = BigInt("-9223372036854775808");
    const MAX = BigInt("9223372036854775807");
    const UMIN = BigInt("0");
    const UMAX = BigInt("18446744073709551615");
    return {
      zero: BigInt(0),
      supported: true,
      parse(value) {
        const bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > MAX || bi < MIN) {
          throw new Error(`invalid int64: ${value}`);
        }
        return bi;
      },
      uParse(value) {
        const bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > UMAX || bi < UMIN) {
          throw new Error(`invalid uint64: ${value}`);
        }
        return bi;
      },
      enc(value) {
        dv.setBigInt64(0, this.parse(value), true);
        return {
          lo: dv.getInt32(0, true),
          hi: dv.getInt32(4, true)
        };
      },
      uEnc(value) {
        dv.setBigInt64(0, this.uParse(value), true);
        return {
          lo: dv.getInt32(0, true),
          hi: dv.getInt32(4, true)
        };
      },
      dec(lo, hi) {
        dv.setInt32(0, lo, true);
        dv.setInt32(4, hi, true);
        return dv.getBigInt64(0, true);
      },
      uDec(lo, hi) {
        dv.setInt32(0, lo, true);
        dv.setInt32(4, hi, true);
        return dv.getBigUint64(0, true);
      }
    };
  }
  return {
    zero: "0",
    supported: false,
    parse(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertInt64String(value);
      return value;
    },
    uParse(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertUInt64String(value);
      return value;
    },
    enc(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertInt64String(value);
      return int64FromString(value);
    },
    uEnc(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertUInt64String(value);
      return int64FromString(value);
    },
    dec(lo, hi) {
      return int64ToString(lo, hi);
    },
    uDec(lo, hi) {
      return uInt64ToString(lo, hi);
    }
  };
}
__name(makeInt64Support, "makeInt64Support");
function assertInt64String(value) {
  if (!/^-?[0-9]+$/.test(value)) {
    throw new Error("invalid int64: " + value);
  }
}
__name(assertInt64String, "assertInt64String");
function assertUInt64String(value) {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error("invalid uint64: " + value);
  }
}
__name(assertUInt64String, "assertUInt64String");

// node_modules/@bufbuild/protobuf/dist/esm/wire/text-encoding.js
var symbol = Symbol.for("@bufbuild/protobuf/text-encoding");
function getTextEncoding() {
  if (globalThis[symbol] == void 0) {
    const te = new globalThis.TextEncoder();
    const td = new globalThis.TextDecoder();
    globalThis[symbol] = {
      encodeUtf8(text) {
        return te.encode(text);
      },
      decodeUtf8(bytes) {
        return td.decode(bytes);
      },
      checkUtf8(text) {
        try {
          encodeURIComponent(text);
          return true;
        } catch (_) {
          return false;
        }
      }
    };
  }
  return globalThis[symbol];
}
__name(getTextEncoding, "getTextEncoding");

// node_modules/@bufbuild/protobuf/dist/esm/wire/binary-encoding.js
var WireType;
(function(WireType2) {
  WireType2[WireType2["Varint"] = 0] = "Varint";
  WireType2[WireType2["Bit64"] = 1] = "Bit64";
  WireType2[WireType2["LengthDelimited"] = 2] = "LengthDelimited";
  WireType2[WireType2["StartGroup"] = 3] = "StartGroup";
  WireType2[WireType2["EndGroup"] = 4] = "EndGroup";
  WireType2[WireType2["Bit32"] = 5] = "Bit32";
})(WireType || (WireType = {}));
var FLOAT32_MAX = 34028234663852886e22;
var FLOAT32_MIN = -34028234663852886e22;
var UINT32_MAX = 4294967295;
var INT32_MAX = 2147483647;
var INT32_MIN = -2147483648;
var _BinaryWriter = class _BinaryWriter {
  constructor(encodeUtf8 = getTextEncoding().encodeUtf8) {
    this.encodeUtf8 = encodeUtf8;
    this.stack = [];
    this.chunks = [];
    this.buf = [];
  }
  /**
   * Return all bytes written and reset this writer.
   */
  finish() {
    if (this.buf.length) {
      this.chunks.push(new Uint8Array(this.buf));
      this.buf = [];
    }
    let len = 0;
    for (let i = 0; i < this.chunks.length; i++)
      len += this.chunks[i].length;
    let bytes = new Uint8Array(len);
    let offset = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      bytes.set(this.chunks[i], offset);
      offset += this.chunks[i].length;
    }
    this.chunks = [];
    return bytes;
  }
  /**
   * Start a new fork for length-delimited data like a message
   * or a packed repeated field.
   *
   * Must be joined later with `join()`.
   */
  fork() {
    this.stack.push({ chunks: this.chunks, buf: this.buf });
    this.chunks = [];
    this.buf = [];
    return this;
  }
  /**
   * Join the last fork. Write its length and bytes, then
   * return to the previous state.
   */
  join() {
    let chunk = this.finish();
    let prev = this.stack.pop();
    if (!prev)
      throw new Error("invalid state, fork stack empty");
    this.chunks = prev.chunks;
    this.buf = prev.buf;
    this.uint32(chunk.byteLength);
    return this.raw(chunk);
  }
  /**
   * Writes a tag (field number and wire type).
   *
   * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
   *
   * Generated code should compute the tag ahead of time and call `uint32()`.
   */
  tag(fieldNo, type) {
    return this.uint32((fieldNo << 3 | type) >>> 0);
  }
  /**
   * Write a chunk of raw bytes.
   */
  raw(chunk) {
    if (this.buf.length) {
      this.chunks.push(new Uint8Array(this.buf));
      this.buf = [];
    }
    this.chunks.push(chunk);
    return this;
  }
  /**
   * Write a `uint32` value, an unsigned 32 bit varint.
   */
  uint32(value) {
    assertUInt32(value);
    while (value > 127) {
      this.buf.push(value & 127 | 128);
      value = value >>> 7;
    }
    this.buf.push(value);
    return this;
  }
  /**
   * Write a `int32` value, a signed 32 bit varint.
   */
  int32(value) {
    assertInt32(value);
    varint32write(value, this.buf);
    return this;
  }
  /**
   * Write a `bool` value, a variant.
   */
  bool(value) {
    this.buf.push(value ? 1 : 0);
    return this;
  }
  /**
   * Write a `bytes` value, length-delimited arbitrary data.
   */
  bytes(value) {
    this.uint32(value.byteLength);
    return this.raw(value);
  }
  /**
   * Write a `string` value, length-delimited data converted to UTF-8 text.
   */
  string(value) {
    let chunk = this.encodeUtf8(value);
    this.uint32(chunk.byteLength);
    return this.raw(chunk);
  }
  /**
   * Write a `float` value, 32-bit floating point number.
   */
  float(value) {
    assertFloat32(value);
    let chunk = new Uint8Array(4);
    new DataView(chunk.buffer).setFloat32(0, value, true);
    return this.raw(chunk);
  }
  /**
   * Write a `double` value, a 64-bit floating point number.
   */
  double(value) {
    let chunk = new Uint8Array(8);
    new DataView(chunk.buffer).setFloat64(0, value, true);
    return this.raw(chunk);
  }
  /**
   * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
   */
  fixed32(value) {
    assertUInt32(value);
    let chunk = new Uint8Array(4);
    new DataView(chunk.buffer).setUint32(0, value, true);
    return this.raw(chunk);
  }
  /**
   * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
   */
  sfixed32(value) {
    assertInt32(value);
    let chunk = new Uint8Array(4);
    new DataView(chunk.buffer).setInt32(0, value, true);
    return this.raw(chunk);
  }
  /**
   * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
   */
  sint32(value) {
    assertInt32(value);
    value = (value << 1 ^ value >> 31) >>> 0;
    varint32write(value, this.buf);
    return this;
  }
  /**
   * Write a `fixed64` value, a signed, fixed-length 64-bit integer.
   */
  sfixed64(value) {
    let chunk = new Uint8Array(8), view = new DataView(chunk.buffer), tc = protoInt64.enc(value);
    view.setInt32(0, tc.lo, true);
    view.setInt32(4, tc.hi, true);
    return this.raw(chunk);
  }
  /**
   * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
   */
  fixed64(value) {
    let chunk = new Uint8Array(8), view = new DataView(chunk.buffer), tc = protoInt64.uEnc(value);
    view.setInt32(0, tc.lo, true);
    view.setInt32(4, tc.hi, true);
    return this.raw(chunk);
  }
  /**
   * Write a `int64` value, a signed 64-bit varint.
   */
  int64(value) {
    let tc = protoInt64.enc(value);
    varint64write(tc.lo, tc.hi, this.buf);
    return this;
  }
  /**
   * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64(value) {
    const tc = protoInt64.enc(value), sign = tc.hi >> 31, lo = tc.lo << 1 ^ sign, hi = (tc.hi << 1 | tc.lo >>> 31) ^ sign;
    varint64write(lo, hi, this.buf);
    return this;
  }
  /**
   * Write a `uint64` value, an unsigned 64-bit varint.
   */
  uint64(value) {
    const tc = protoInt64.uEnc(value);
    varint64write(tc.lo, tc.hi, this.buf);
    return this;
  }
};
__name(_BinaryWriter, "BinaryWriter");
var BinaryWriter = _BinaryWriter;
var _BinaryReader = class _BinaryReader {
  constructor(buf, decodeUtf8 = getTextEncoding().decodeUtf8) {
    this.decodeUtf8 = decodeUtf8;
    this.varint64 = varint64read;
    this.uint32 = varint32read;
    this.buf = buf;
    this.len = buf.length;
    this.pos = 0;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  /**
   * Reads a tag - field number and wire type.
   */
  tag() {
    let tag = this.uint32(), fieldNo = tag >>> 3, wireType = tag & 7;
    if (fieldNo <= 0 || wireType < 0 || wireType > 5)
      throw new Error("illegal tag: field no " + fieldNo + " wire type " + wireType);
    return [fieldNo, wireType];
  }
  /**
   * Skip one element and return the skipped data.
   *
   * When skipping StartGroup, provide the tags field number to check for
   * matching field number in the EndGroup tag.
   */
  skip(wireType, fieldNo) {
    let start = this.pos;
    switch (wireType) {
      case WireType.Varint:
        while (this.buf[this.pos++] & 128) {
        }
        break;
      // @ts-expect-error TS7029: Fallthrough case in switch
      case WireType.Bit64:
        this.pos += 4;
      case WireType.Bit32:
        this.pos += 4;
        break;
      case WireType.LengthDelimited:
        let len = this.uint32();
        this.pos += len;
        break;
      case WireType.StartGroup:
        for (; ; ) {
          const [fn, wt] = this.tag();
          if (wt === WireType.EndGroup) {
            if (fieldNo !== void 0 && fn !== fieldNo) {
              throw new Error("invalid end group tag");
            }
            break;
          }
          this.skip(wt, fn);
        }
        break;
      default:
        throw new Error("cant skip wire type " + wireType);
    }
    this.assertBounds();
    return this.buf.subarray(start, this.pos);
  }
  /**
   * Throws error if position in byte array is out of range.
   */
  assertBounds() {
    if (this.pos > this.len)
      throw new RangeError("premature EOF");
  }
  /**
   * Read a `int32` field, a signed 32 bit varint.
   */
  int32() {
    return this.uint32() | 0;
  }
  /**
   * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
   */
  sint32() {
    let zze = this.uint32();
    return zze >>> 1 ^ -(zze & 1);
  }
  /**
   * Read a `int64` field, a signed 64-bit varint.
   */
  int64() {
    return protoInt64.dec(...this.varint64());
  }
  /**
   * Read a `uint64` field, an unsigned 64-bit varint.
   */
  uint64() {
    return protoInt64.uDec(...this.varint64());
  }
  /**
   * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64() {
    let [lo, hi] = this.varint64();
    let s = -(lo & 1);
    lo = (lo >>> 1 | (hi & 1) << 31) ^ s;
    hi = hi >>> 1 ^ s;
    return protoInt64.dec(lo, hi);
  }
  /**
   * Read a `bool` field, a variant.
   */
  bool() {
    let [lo, hi] = this.varint64();
    return lo !== 0 || hi !== 0;
  }
  /**
   * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
   */
  fixed32() {
    return this.view.getUint32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
   */
  sfixed32() {
    return this.view.getInt32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
   */
  fixed64() {
    return protoInt64.uDec(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
   */
  sfixed64() {
    return protoInt64.dec(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `float` field, 32-bit floating point number.
   */
  float() {
    return this.view.getFloat32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `double` field, a 64-bit floating point number.
   */
  double() {
    return this.view.getFloat64((this.pos += 8) - 8, true);
  }
  /**
   * Read a `bytes` field, length-delimited arbitrary data.
   */
  bytes() {
    let len = this.uint32(), start = this.pos;
    this.pos += len;
    this.assertBounds();
    return this.buf.subarray(start, start + len);
  }
  /**
   * Read a `string` field, length-delimited data converted to UTF-8 text.
   */
  string() {
    return this.decodeUtf8(this.bytes());
  }
};
__name(_BinaryReader, "BinaryReader");
var BinaryReader = _BinaryReader;
function assertInt32(arg) {
  if (typeof arg == "string") {
    arg = Number(arg);
  } else if (typeof arg != "number") {
    throw new Error("invalid int32: " + typeof arg);
  }
  if (!Number.isInteger(arg) || arg > INT32_MAX || arg < INT32_MIN)
    throw new Error("invalid int32: " + arg);
}
__name(assertInt32, "assertInt32");
function assertUInt32(arg) {
  if (typeof arg == "string") {
    arg = Number(arg);
  } else if (typeof arg != "number") {
    throw new Error("invalid uint32: " + typeof arg);
  }
  if (!Number.isInteger(arg) || arg > UINT32_MAX || arg < 0)
    throw new Error("invalid uint32: " + arg);
}
__name(assertUInt32, "assertUInt32");
function assertFloat32(arg) {
  if (typeof arg == "string") {
    const o = arg;
    arg = Number(arg);
    if (Number.isNaN(arg) && o !== "NaN") {
      throw new Error("invalid float32: " + o);
    }
  } else if (typeof arg != "number") {
    throw new Error("invalid float32: " + typeof arg);
  }
  if (Number.isFinite(arg) && (arg > FLOAT32_MAX || arg < FLOAT32_MIN))
    throw new Error("invalid float32: " + arg);
}
__name(assertFloat32, "assertFloat32");

// dist/protos/generated/misc/common.js
function createBaseFormatId() {
  return { itag: 0, lastModified: 0, xtags: "" };
}
__name(createBaseFormatId, "createBaseFormatId");
var FormatId = {
  encode(message, writer = new BinaryWriter()) {
    if (message.itag !== void 0 && message.itag !== 0) {
      writer.uint32(8).int32(message.itag);
    }
    if (message.lastModified !== void 0 && message.lastModified !== 0) {
      writer.uint32(16).uint64(message.lastModified);
    }
    if (message.xtags !== void 0 && message.xtags !== "") {
      writer.uint32(26).string(message.xtags);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseFormatId();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.itag = reader.int32();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.lastModified = longToNumber(reader.uint64());
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.xtags = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseRange() {
  return { legacyStart: 0, legacyEnd: 0, start: 0, end: 0 };
}
__name(createBaseRange, "createBaseRange");
var Range = {
  encode(message, writer = new BinaryWriter()) {
    if (message.legacyStart !== void 0 && message.legacyStart !== 0) {
      writer.uint32(8).int32(message.legacyStart);
    }
    if (message.legacyEnd !== void 0 && message.legacyEnd !== 0) {
      writer.uint32(16).int32(message.legacyEnd);
    }
    if (message.start !== void 0 && message.start !== 0) {
      writer.uint32(24).int32(message.start);
    }
    if (message.end !== void 0 && message.end !== 0) {
      writer.uint32(32).int32(message.end);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseRange();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.legacyStart = reader.int32();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.legacyEnd = reader.int32();
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.start = reader.int32();
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.end = reader.int32();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseAuthorizedFormat() {
  return { trackType: 0, isHdr: false };
}
__name(createBaseAuthorizedFormat, "createBaseAuthorizedFormat");
var AuthorizedFormat = {
  encode(message, writer = new BinaryWriter()) {
    if (message.trackType !== void 0 && message.trackType !== 0) {
      writer.uint32(8).int32(message.trackType);
    }
    if (message.isHdr !== void 0 && message.isHdr !== false) {
      writer.uint32(16).bool(message.isHdr);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseAuthorizedFormat();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.trackType = reader.int32();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.isHdr = reader.bool();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBasePlaybackAuthorization() {
  return { authorizedFormats: [], sabrLicenseConstraint: new Uint8Array(0) };
}
__name(createBasePlaybackAuthorization, "createBasePlaybackAuthorization");
var PlaybackAuthorization = {
  encode(message, writer = new BinaryWriter()) {
    for (const v of message.authorizedFormats) {
      AuthorizedFormat.encode(v, writer.uint32(10).fork()).join();
    }
    if (message.sabrLicenseConstraint !== void 0 && message.sabrLicenseConstraint.length !== 0) {
      writer.uint32(18).bytes(message.sabrLicenseConstraint);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBasePlaybackAuthorization();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.authorizedFormats.push(AuthorizedFormat.decode(reader, reader.uint32()));
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.sabrLicenseConstraint = reader.bytes();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function longToNumber(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
__name(longToNumber, "longToNumber");

// dist/protos/generated/video_streaming/format_initialization_metadata.js
function createBaseFormatInitializationMetadata() {
  return {
    videoId: "",
    formatId: void 0,
    endTimeMs: 0,
    endSegmentNumber: 0,
    mimeType: "",
    initRange: void 0,
    indexRange: void 0,
    field8: 0,
    durationUnits: 0,
    durationTimescale: 0
  };
}
__name(createBaseFormatInitializationMetadata, "createBaseFormatInitializationMetadata");
var FormatInitializationMetadata = {
  encode(message, writer = new BinaryWriter()) {
    if (message.videoId !== void 0 && message.videoId !== "") {
      writer.uint32(10).string(message.videoId);
    }
    if (message.formatId !== void 0) {
      FormatId.encode(message.formatId, writer.uint32(18).fork()).join();
    }
    if (message.endTimeMs !== void 0 && message.endTimeMs !== 0) {
      writer.uint32(24).int64(message.endTimeMs);
    }
    if (message.endSegmentNumber !== void 0 && message.endSegmentNumber !== 0) {
      writer.uint32(32).int64(message.endSegmentNumber);
    }
    if (message.mimeType !== void 0 && message.mimeType !== "") {
      writer.uint32(42).string(message.mimeType);
    }
    if (message.initRange !== void 0) {
      Range.encode(message.initRange, writer.uint32(50).fork()).join();
    }
    if (message.indexRange !== void 0) {
      Range.encode(message.indexRange, writer.uint32(58).fork()).join();
    }
    if (message.field8 !== void 0 && message.field8 !== 0) {
      writer.uint32(64).int64(message.field8);
    }
    if (message.durationUnits !== void 0 && message.durationUnits !== 0) {
      writer.uint32(72).int64(message.durationUnits);
    }
    if (message.durationTimescale !== void 0 && message.durationTimescale !== 0) {
      writer.uint32(80).int64(message.durationTimescale);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseFormatInitializationMetadata();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.videoId = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.formatId = FormatId.decode(reader, reader.uint32());
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.endTimeMs = longToNumber2(reader.int64());
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.endSegmentNumber = longToNumber2(reader.int64());
          continue;
        }
        case 5: {
          if (tag !== 42) {
            break;
          }
          message.mimeType = reader.string();
          continue;
        }
        case 6: {
          if (tag !== 50) {
            break;
          }
          message.initRange = Range.decode(reader, reader.uint32());
          continue;
        }
        case 7: {
          if (tag !== 58) {
            break;
          }
          message.indexRange = Range.decode(reader, reader.uint32());
          continue;
        }
        case 8: {
          if (tag !== 64) {
            break;
          }
          message.field8 = longToNumber2(reader.int64());
          continue;
        }
        case 9: {
          if (tag !== 72) {
            break;
          }
          message.durationUnits = longToNumber2(reader.int64());
          continue;
        }
        case 10: {
          if (tag !== 80) {
            break;
          }
          message.durationTimescale = longToNumber2(reader.int64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function longToNumber2(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
__name(longToNumber2, "longToNumber");

// dist/protos/generated/video_streaming/time_range.js
function createBaseTimeRange() {
  return { startTicks: 0, durationTicks: 0, timescale: 0 };
}
__name(createBaseTimeRange, "createBaseTimeRange");
var TimeRange = {
  encode(message, writer = new BinaryWriter()) {
    if (message.startTicks !== void 0 && message.startTicks !== 0) {
      writer.uint32(8).int64(message.startTicks);
    }
    if (message.durationTicks !== void 0 && message.durationTicks !== 0) {
      writer.uint32(16).int64(message.durationTicks);
    }
    if (message.timescale !== void 0 && message.timescale !== 0) {
      writer.uint32(24).int32(message.timescale);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseTimeRange();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.startTicks = longToNumber3(reader.int64());
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.durationTicks = longToNumber3(reader.int64());
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.timescale = reader.int32();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function longToNumber3(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
__name(longToNumber3, "longToNumber");

// dist/protos/generated/video_streaming/media_header.js
function createBaseMediaHeader() {
  return {
    headerId: 0,
    videoId: "",
    itag: 0,
    lmt: 0,
    xtags: "",
    startRange: 0,
    compressionAlgorithm: 0,
    isInitSeg: false,
    sequenceNumber: 0,
    bitrateBps: 0,
    startMs: 0,
    durationMs: 0,
    formatId: void 0,
    contentLength: 0,
    timeRange: void 0,
    sequenceLmt: 0
  };
}
__name(createBaseMediaHeader, "createBaseMediaHeader");
var MediaHeader = {
  encode(message, writer = new BinaryWriter()) {
    if (message.headerId !== void 0 && message.headerId !== 0) {
      writer.uint32(8).uint32(message.headerId);
    }
    if (message.videoId !== void 0 && message.videoId !== "") {
      writer.uint32(18).string(message.videoId);
    }
    if (message.itag !== void 0 && message.itag !== 0) {
      writer.uint32(24).int32(message.itag);
    }
    if (message.lmt !== void 0 && message.lmt !== 0) {
      writer.uint32(32).uint64(message.lmt);
    }
    if (message.xtags !== void 0 && message.xtags !== "") {
      writer.uint32(42).string(message.xtags);
    }
    if (message.startRange !== void 0 && message.startRange !== 0) {
      writer.uint32(48).int64(message.startRange);
    }
    if (message.compressionAlgorithm !== void 0 && message.compressionAlgorithm !== 0) {
      writer.uint32(56).int32(message.compressionAlgorithm);
    }
    if (message.isInitSeg !== void 0 && message.isInitSeg !== false) {
      writer.uint32(64).bool(message.isInitSeg);
    }
    if (message.sequenceNumber !== void 0 && message.sequenceNumber !== 0) {
      writer.uint32(72).int64(message.sequenceNumber);
    }
    if (message.bitrateBps !== void 0 && message.bitrateBps !== 0) {
      writer.uint32(80).int64(message.bitrateBps);
    }
    if (message.startMs !== void 0 && message.startMs !== 0) {
      writer.uint32(88).int64(message.startMs);
    }
    if (message.durationMs !== void 0 && message.durationMs !== 0) {
      writer.uint32(96).int64(message.durationMs);
    }
    if (message.formatId !== void 0) {
      FormatId.encode(message.formatId, writer.uint32(106).fork()).join();
    }
    if (message.contentLength !== void 0 && message.contentLength !== 0) {
      writer.uint32(112).int64(message.contentLength);
    }
    if (message.timeRange !== void 0) {
      TimeRange.encode(message.timeRange, writer.uint32(122).fork()).join();
    }
    if (message.sequenceLmt !== void 0 && message.sequenceLmt !== 0) {
      writer.uint32(128).uint64(message.sequenceLmt);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMediaHeader();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.headerId = reader.uint32();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.videoId = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.itag = reader.int32();
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.lmt = longToNumber4(reader.uint64());
          continue;
        }
        case 5: {
          if (tag !== 42) {
            break;
          }
          message.xtags = reader.string();
          continue;
        }
        case 6: {
          if (tag !== 48) {
            break;
          }
          message.startRange = longToNumber4(reader.int64());
          continue;
        }
        case 7: {
          if (tag !== 56) {
            break;
          }
          message.compressionAlgorithm = reader.int32();
          continue;
        }
        case 8: {
          if (tag !== 64) {
            break;
          }
          message.isInitSeg = reader.bool();
          continue;
        }
        case 9: {
          if (tag !== 72) {
            break;
          }
          message.sequenceNumber = longToNumber4(reader.int64());
          continue;
        }
        case 10: {
          if (tag !== 80) {
            break;
          }
          message.bitrateBps = longToNumber4(reader.int64());
          continue;
        }
        case 11: {
          if (tag !== 88) {
            break;
          }
          message.startMs = longToNumber4(reader.int64());
          continue;
        }
        case 12: {
          if (tag !== 96) {
            break;
          }
          message.durationMs = longToNumber4(reader.int64());
          continue;
        }
        case 13: {
          if (tag !== 106) {
            break;
          }
          message.formatId = FormatId.decode(reader, reader.uint32());
          continue;
        }
        case 14: {
          if (tag !== 112) {
            break;
          }
          message.contentLength = longToNumber4(reader.int64());
          continue;
        }
        case 15: {
          if (tag !== 122) {
            break;
          }
          message.timeRange = TimeRange.decode(reader, reader.uint32());
          continue;
        }
        case 16: {
          if (tag !== 128) {
            break;
          }
          message.sequenceLmt = longToNumber4(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function longToNumber4(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
__name(longToNumber4, "longToNumber");

// dist/protos/generated/video_streaming/buffered_range.js
function createBaseBufferedRange() {
  return {
    formatId: void 0,
    startTimeMs: 0,
    durationMs: 0,
    startSegmentIndex: 0,
    endSegmentIndex: 0,
    timeRange: void 0,
    field9: void 0,
    field11: void 0,
    field12: void 0
  };
}
__name(createBaseBufferedRange, "createBaseBufferedRange");
var BufferedRange = {
  encode(message, writer = new BinaryWriter()) {
    if (message.formatId !== void 0) {
      FormatId.encode(message.formatId, writer.uint32(10).fork()).join();
    }
    if (message.startTimeMs !== 0) {
      writer.uint32(16).int64(message.startTimeMs);
    }
    if (message.durationMs !== 0) {
      writer.uint32(24).int64(message.durationMs);
    }
    if (message.startSegmentIndex !== 0) {
      writer.uint32(32).int32(message.startSegmentIndex);
    }
    if (message.endSegmentIndex !== 0) {
      writer.uint32(40).int32(message.endSegmentIndex);
    }
    if (message.timeRange !== void 0) {
      TimeRange.encode(message.timeRange, writer.uint32(50).fork()).join();
    }
    if (message.field9 !== void 0) {
      BufferedRange_UnknownMessage1.encode(message.field9, writer.uint32(74).fork()).join();
    }
    if (message.field11 !== void 0) {
      BufferedRange_UnknownMessage2.encode(message.field11, writer.uint32(90).fork()).join();
    }
    if (message.field12 !== void 0) {
      BufferedRange_UnknownMessage2.encode(message.field12, writer.uint32(98).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseBufferedRange();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.formatId = FormatId.decode(reader, reader.uint32());
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.startTimeMs = longToNumber5(reader.int64());
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.durationMs = longToNumber5(reader.int64());
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.startSegmentIndex = reader.int32();
          continue;
        }
        case 5: {
          if (tag !== 40) {
            break;
          }
          message.endSegmentIndex = reader.int32();
          continue;
        }
        case 6: {
          if (tag !== 50) {
            break;
          }
          message.timeRange = TimeRange.decode(reader, reader.uint32());
          continue;
        }
        case 9: {
          if (tag !== 74) {
            break;
          }
          message.field9 = BufferedRange_UnknownMessage1.decode(reader, reader.uint32());
          continue;
        }
        case 11: {
          if (tag !== 90) {
            break;
          }
          message.field11 = BufferedRange_UnknownMessage2.decode(reader, reader.uint32());
          continue;
        }
        case 12: {
          if (tag !== 98) {
            break;
          }
          message.field12 = BufferedRange_UnknownMessage2.decode(reader, reader.uint32());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseBufferedRange_UnknownMessage1() {
  return { field1: [] };
}
__name(createBaseBufferedRange_UnknownMessage1, "createBaseBufferedRange_UnknownMessage1");
var BufferedRange_UnknownMessage1 = {
  encode(message, writer = new BinaryWriter()) {
    for (const v of message.field1) {
      BufferedRange_UnknownMessage1_UnknownInnerMessage.encode(v, writer.uint32(10).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseBufferedRange_UnknownMessage1();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.field1.push(BufferedRange_UnknownMessage1_UnknownInnerMessage.decode(reader, reader.uint32()));
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseBufferedRange_UnknownMessage1_UnknownInnerMessage() {
  return { videoId: "", lmt: 0 };
}
__name(createBaseBufferedRange_UnknownMessage1_UnknownInnerMessage, "createBaseBufferedRange_UnknownMessage1_UnknownInnerMessage");
var BufferedRange_UnknownMessage1_UnknownInnerMessage = {
  encode(message, writer = new BinaryWriter()) {
    if (message.videoId !== void 0 && message.videoId !== "") {
      writer.uint32(10).string(message.videoId);
    }
    if (message.lmt !== void 0 && message.lmt !== 0) {
      writer.uint32(16).uint64(message.lmt);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseBufferedRange_UnknownMessage1_UnknownInnerMessage();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.videoId = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.lmt = longToNumber5(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseBufferedRange_UnknownMessage2() {
  return { field1: 0, field2: 0, field3: 0 };
}
__name(createBaseBufferedRange_UnknownMessage2, "createBaseBufferedRange_UnknownMessage2");
var BufferedRange_UnknownMessage2 = {
  encode(message, writer = new BinaryWriter()) {
    if (message.field1 !== void 0 && message.field1 !== 0) {
      writer.uint32(8).int32(message.field1);
    }
    if (message.field2 !== void 0 && message.field2 !== 0) {
      writer.uint32(16).int32(message.field2);
    }
    if (message.field3 !== void 0 && message.field3 !== 0) {
      writer.uint32(24).int32(message.field3);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseBufferedRange_UnknownMessage2();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.field1 = reader.int32();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.field2 = reader.int32();
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.field3 = reader.int32();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function longToNumber5(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
__name(longToNumber5, "longToNumber");

// dist/protos/generated/video_streaming/media_capabilities.js
function createBaseMediaCapabilities() {
  return { videoFormatCapabilities: [], audioFormatCapabilities: [], hdrModeBitmask: 0 };
}
__name(createBaseMediaCapabilities, "createBaseMediaCapabilities");
var MediaCapabilities = {
  encode(message, writer = new BinaryWriter()) {
    for (const v of message.videoFormatCapabilities) {
      MediaCapabilities_VideoFormatCapability.encode(v, writer.uint32(10).fork()).join();
    }
    for (const v of message.audioFormatCapabilities) {
      MediaCapabilities_AudioFormatCapability.encode(v, writer.uint32(18).fork()).join();
    }
    if (message.hdrModeBitmask !== void 0 && message.hdrModeBitmask !== 0) {
      writer.uint32(40).int32(message.hdrModeBitmask);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMediaCapabilities();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.videoFormatCapabilities.push(MediaCapabilities_VideoFormatCapability.decode(reader, reader.uint32()));
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.audioFormatCapabilities.push(MediaCapabilities_AudioFormatCapability.decode(reader, reader.uint32()));
          continue;
        }
        case 5: {
          if (tag !== 40) {
            break;
          }
          message.hdrModeBitmask = reader.int32();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseMediaCapabilities_VideoFormatCapability() {
  return { videoCodec: 0, maxHeight: 0, maxWidth: 0, maxFramerate: 0, maxBitrateBps: 0, is10BitSupported: false };
}
__name(createBaseMediaCapabilities_VideoFormatCapability, "createBaseMediaCapabilities_VideoFormatCapability");
var MediaCapabilities_VideoFormatCapability = {
  encode(message, writer = new BinaryWriter()) {
    if (message.videoCodec !== void 0 && message.videoCodec !== 0) {
      writer.uint32(8).int32(message.videoCodec);
    }
    if (message.maxHeight !== void 0 && message.maxHeight !== 0) {
      writer.uint32(24).int32(message.maxHeight);
    }
    if (message.maxWidth !== void 0 && message.maxWidth !== 0) {
      writer.uint32(32).int32(message.maxWidth);
    }
    if (message.maxFramerate !== void 0 && message.maxFramerate !== 0) {
      writer.uint32(88).int32(message.maxFramerate);
    }
    if (message.maxBitrateBps !== void 0 && message.maxBitrateBps !== 0) {
      writer.uint32(96).int32(message.maxBitrateBps);
    }
    if (message.is10BitSupported !== void 0 && message.is10BitSupported !== false) {
      writer.uint32(120).bool(message.is10BitSupported);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMediaCapabilities_VideoFormatCapability();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.videoCodec = reader.int32();
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.maxHeight = reader.int32();
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.maxWidth = reader.int32();
          continue;
        }
        case 11: {
          if (tag !== 88) {
            break;
          }
          message.maxFramerate = reader.int32();
          continue;
        }
        case 12: {
          if (tag !== 96) {
            break;
          }
          message.maxBitrateBps = reader.int32();
          continue;
        }
        case 15: {
          if (tag !== 120) {
            break;
          }
          message.is10BitSupported = reader.bool();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseMediaCapabilities_AudioFormatCapability() {
  return { audioCodec: 0, numChannels: 0, maxBitrateBps: 0, spatialCapabilityBitmask: 0 };
}
__name(createBaseMediaCapabilities_AudioFormatCapability, "createBaseMediaCapabilities_AudioFormatCapability");
var MediaCapabilities_AudioFormatCapability = {
  encode(message, writer = new BinaryWriter()) {
    if (message.audioCodec !== void 0 && message.audioCodec !== 0) {
      writer.uint32(8).int32(message.audioCodec);
    }
    if (message.numChannels !== void 0 && message.numChannels !== 0) {
      writer.uint32(16).int32(message.numChannels);
    }
    if (message.maxBitrateBps !== void 0 && message.maxBitrateBps !== 0) {
      writer.uint32(24).int32(message.maxBitrateBps);
    }
    if (message.spatialCapabilityBitmask !== void 0 && message.spatialCapabilityBitmask !== 0) {
      writer.uint32(48).int32(message.spatialCapabilityBitmask);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMediaCapabilities_AudioFormatCapability();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.audioCodec = reader.int32();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.numChannels = reader.int32();
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.maxBitrateBps = reader.int32();
          continue;
        }
        case 6: {
          if (tag !== 48) {
            break;
          }
          message.spatialCapabilityBitmask = reader.int32();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};

// dist/protos/generated/video_streaming/playback_cookie.js
function createBasePlaybackCookie() {
  return { resolution: 0, field2: 0, videoFmt: void 0, audioFmt: void 0 };
}
__name(createBasePlaybackCookie, "createBasePlaybackCookie");
var PlaybackCookie = {
  encode(message, writer = new BinaryWriter()) {
    if (message.resolution !== void 0 && message.resolution !== 0) {
      writer.uint32(8).int32(message.resolution);
    }
    if (message.field2 !== void 0 && message.field2 !== 0) {
      writer.uint32(16).int32(message.field2);
    }
    if (message.videoFmt !== void 0) {
      FormatId.encode(message.videoFmt, writer.uint32(58).fork()).join();
    }
    if (message.audioFmt !== void 0) {
      FormatId.encode(message.audioFmt, writer.uint32(66).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBasePlaybackCookie();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.resolution = reader.int32();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.field2 = reader.int32();
          continue;
        }
        case 7: {
          if (tag !== 58) {
            break;
          }
          message.videoFmt = FormatId.decode(reader, reader.uint32());
          continue;
        }
        case 8: {
          if (tag !== 66) {
            break;
          }
          message.audioFmt = FormatId.decode(reader, reader.uint32());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};

// dist/protos/generated/video_streaming/client_abr_state.js
function createBaseClientAbrState() {
  return {
    timeSinceLastManualFormatSelectionMs: 0,
    lastManualDirection: 0,
    lastManualSelectedResolution: 0,
    detailedNetworkType: 0,
    clientViewportWidth: 0,
    clientViewportHeight: 0,
    clientBitrateCapBytesPerSec: 0,
    stickyResolution: 0,
    clientViewportIsFlexible: false,
    bandwidthEstimate: 0,
    minAudioQuality: 0,
    maxAudioQuality: 0,
    videoQualitySetting: 0,
    audioRoute: 0,
    playerTimeMs: 0,
    timeSinceLastSeek: 0,
    dataSaverMode: false,
    networkMeteredState: 0,
    visibility: 0,
    playbackRate: 0,
    elapsedWallTimeMs: 0,
    mediaCapabilities: void 0,
    timeSinceLastActionMs: 0,
    enabledTrackTypesBitfield: 0,
    maxPacingRate: 0,
    playerState: 0,
    drcEnabled: false,
    field48: 0,
    field50: 0,
    field51: 0,
    sabrReportRequestCancellationInfo: 0,
    disableStreamingXhr: false,
    field57: 0,
    preferVp9: false,
    av1QualityThreshold: 0,
    field60: 0,
    isPrefetch: false,
    sabrSupportQualityConstraints: false,
    sabrLicenseConstraint: new Uint8Array(0),
    allowProximaLiveLatency: 0,
    sabrForceProxima: 0,
    field67: 0,
    sabrForceMaxNetworkInterruptionDurationMs: 0,
    audioTrackId: "",
    enableVoiceBoost: false,
    playbackAuthorization: void 0
  };
}
__name(createBaseClientAbrState, "createBaseClientAbrState");
var ClientAbrState = {
  encode(message, writer = new BinaryWriter()) {
    if (message.timeSinceLastManualFormatSelectionMs !== void 0 && message.timeSinceLastManualFormatSelectionMs !== 0) {
      writer.uint32(104).int64(message.timeSinceLastManualFormatSelectionMs);
    }
    if (message.lastManualDirection !== void 0 && message.lastManualDirection !== 0) {
      writer.uint32(112).sint32(message.lastManualDirection);
    }
    if (message.lastManualSelectedResolution !== void 0 && message.lastManualSelectedResolution !== 0) {
      writer.uint32(128).int32(message.lastManualSelectedResolution);
    }
    if (message.detailedNetworkType !== void 0 && message.detailedNetworkType !== 0) {
      writer.uint32(136).int32(message.detailedNetworkType);
    }
    if (message.clientViewportWidth !== void 0 && message.clientViewportWidth !== 0) {
      writer.uint32(144).int32(message.clientViewportWidth);
    }
    if (message.clientViewportHeight !== void 0 && message.clientViewportHeight !== 0) {
      writer.uint32(152).int32(message.clientViewportHeight);
    }
    if (message.clientBitrateCapBytesPerSec !== void 0 && message.clientBitrateCapBytesPerSec !== 0) {
      writer.uint32(160).int64(message.clientBitrateCapBytesPerSec);
    }
    if (message.stickyResolution !== void 0 && message.stickyResolution !== 0) {
      writer.uint32(168).int32(message.stickyResolution);
    }
    if (message.clientViewportIsFlexible !== void 0 && message.clientViewportIsFlexible !== false) {
      writer.uint32(176).bool(message.clientViewportIsFlexible);
    }
    if (message.bandwidthEstimate !== void 0 && message.bandwidthEstimate !== 0) {
      writer.uint32(184).int64(message.bandwidthEstimate);
    }
    if (message.minAudioQuality !== void 0 && message.minAudioQuality !== 0) {
      writer.uint32(192).int32(message.minAudioQuality);
    }
    if (message.maxAudioQuality !== void 0 && message.maxAudioQuality !== 0) {
      writer.uint32(200).int32(message.maxAudioQuality);
    }
    if (message.videoQualitySetting !== void 0 && message.videoQualitySetting !== 0) {
      writer.uint32(208).int32(message.videoQualitySetting);
    }
    if (message.audioRoute !== void 0 && message.audioRoute !== 0) {
      writer.uint32(216).int32(message.audioRoute);
    }
    if (message.playerTimeMs !== void 0 && message.playerTimeMs !== 0) {
      writer.uint32(224).int64(message.playerTimeMs);
    }
    if (message.timeSinceLastSeek !== void 0 && message.timeSinceLastSeek !== 0) {
      writer.uint32(232).int64(message.timeSinceLastSeek);
    }
    if (message.dataSaverMode !== void 0 && message.dataSaverMode !== false) {
      writer.uint32(240).bool(message.dataSaverMode);
    }
    if (message.networkMeteredState !== void 0 && message.networkMeteredState !== 0) {
      writer.uint32(256).int32(message.networkMeteredState);
    }
    if (message.visibility !== void 0 && message.visibility !== 0) {
      writer.uint32(272).int32(message.visibility);
    }
    if (message.playbackRate !== void 0 && message.playbackRate !== 0) {
      writer.uint32(285).float(message.playbackRate);
    }
    if (message.elapsedWallTimeMs !== void 0 && message.elapsedWallTimeMs !== 0) {
      writer.uint32(288).int64(message.elapsedWallTimeMs);
    }
    if (message.mediaCapabilities !== void 0) {
      MediaCapabilities.encode(message.mediaCapabilities, writer.uint32(306).fork()).join();
    }
    if (message.timeSinceLastActionMs !== void 0 && message.timeSinceLastActionMs !== 0) {
      writer.uint32(312).int64(message.timeSinceLastActionMs);
    }
    if (message.enabledTrackTypesBitfield !== void 0 && message.enabledTrackTypesBitfield !== 0) {
      writer.uint32(320).int32(message.enabledTrackTypesBitfield);
    }
    if (message.maxPacingRate !== void 0 && message.maxPacingRate !== 0) {
      writer.uint32(344).int32(message.maxPacingRate);
    }
    if (message.playerState !== void 0 && message.playerState !== 0) {
      writer.uint32(352).int64(message.playerState);
    }
    if (message.drcEnabled !== void 0 && message.drcEnabled !== false) {
      writer.uint32(368).bool(message.drcEnabled);
    }
    if (message.field48 !== void 0 && message.field48 !== 0) {
      writer.uint32(384).int32(message.field48);
    }
    if (message.field50 !== void 0 && message.field50 !== 0) {
      writer.uint32(400).int32(message.field50);
    }
    if (message.field51 !== void 0 && message.field51 !== 0) {
      writer.uint32(408).int32(message.field51);
    }
    if (message.sabrReportRequestCancellationInfo !== void 0 && message.sabrReportRequestCancellationInfo !== 0) {
      writer.uint32(432).int32(message.sabrReportRequestCancellationInfo);
    }
    if (message.disableStreamingXhr !== void 0 && message.disableStreamingXhr !== false) {
      writer.uint32(448).bool(message.disableStreamingXhr);
    }
    if (message.field57 !== void 0 && message.field57 !== 0) {
      writer.uint32(456).int64(message.field57);
    }
    if (message.preferVp9 !== void 0 && message.preferVp9 !== false) {
      writer.uint32(464).bool(message.preferVp9);
    }
    if (message.av1QualityThreshold !== void 0 && message.av1QualityThreshold !== 0) {
      writer.uint32(472).int32(message.av1QualityThreshold);
    }
    if (message.field60 !== void 0 && message.field60 !== 0) {
      writer.uint32(480).int32(message.field60);
    }
    if (message.isPrefetch !== void 0 && message.isPrefetch !== false) {
      writer.uint32(488).bool(message.isPrefetch);
    }
    if (message.sabrSupportQualityConstraints !== void 0 && message.sabrSupportQualityConstraints !== false) {
      writer.uint32(496).bool(message.sabrSupportQualityConstraints);
    }
    if (message.sabrLicenseConstraint !== void 0 && message.sabrLicenseConstraint.length !== 0) {
      writer.uint32(506).bytes(message.sabrLicenseConstraint);
    }
    if (message.allowProximaLiveLatency !== void 0 && message.allowProximaLiveLatency !== 0) {
      writer.uint32(512).int32(message.allowProximaLiveLatency);
    }
    if (message.sabrForceProxima !== void 0 && message.sabrForceProxima !== 0) {
      writer.uint32(528).int32(message.sabrForceProxima);
    }
    if (message.field67 !== void 0 && message.field67 !== 0) {
      writer.uint32(536).int32(message.field67);
    }
    if (message.sabrForceMaxNetworkInterruptionDurationMs !== void 0 && message.sabrForceMaxNetworkInterruptionDurationMs !== 0) {
      writer.uint32(544).int64(message.sabrForceMaxNetworkInterruptionDurationMs);
    }
    if (message.audioTrackId !== void 0 && message.audioTrackId !== "") {
      writer.uint32(554).string(message.audioTrackId);
    }
    if (message.enableVoiceBoost !== void 0 && message.enableVoiceBoost !== false) {
      writer.uint32(608).bool(message.enableVoiceBoost);
    }
    if (message.playbackAuthorization !== void 0) {
      PlaybackAuthorization.encode(message.playbackAuthorization, writer.uint32(634).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseClientAbrState();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 13: {
          if (tag !== 104) {
            break;
          }
          message.timeSinceLastManualFormatSelectionMs = longToNumber6(reader.int64());
          continue;
        }
        case 14: {
          if (tag !== 112) {
            break;
          }
          message.lastManualDirection = reader.sint32();
          continue;
        }
        case 16: {
          if (tag !== 128) {
            break;
          }
          message.lastManualSelectedResolution = reader.int32();
          continue;
        }
        case 17: {
          if (tag !== 136) {
            break;
          }
          message.detailedNetworkType = reader.int32();
          continue;
        }
        case 18: {
          if (tag !== 144) {
            break;
          }
          message.clientViewportWidth = reader.int32();
          continue;
        }
        case 19: {
          if (tag !== 152) {
            break;
          }
          message.clientViewportHeight = reader.int32();
          continue;
        }
        case 20: {
          if (tag !== 160) {
            break;
          }
          message.clientBitrateCapBytesPerSec = longToNumber6(reader.int64());
          continue;
        }
        case 21: {
          if (tag !== 168) {
            break;
          }
          message.stickyResolution = reader.int32();
          continue;
        }
        case 22: {
          if (tag !== 176) {
            break;
          }
          message.clientViewportIsFlexible = reader.bool();
          continue;
        }
        case 23: {
          if (tag !== 184) {
            break;
          }
          message.bandwidthEstimate = longToNumber6(reader.int64());
          continue;
        }
        case 24: {
          if (tag !== 192) {
            break;
          }
          message.minAudioQuality = reader.int32();
          continue;
        }
        case 25: {
          if (tag !== 200) {
            break;
          }
          message.maxAudioQuality = reader.int32();
          continue;
        }
        case 26: {
          if (tag !== 208) {
            break;
          }
          message.videoQualitySetting = reader.int32();
          continue;
        }
        case 27: {
          if (tag !== 216) {
            break;
          }
          message.audioRoute = reader.int32();
          continue;
        }
        case 28: {
          if (tag !== 224) {
            break;
          }
          message.playerTimeMs = longToNumber6(reader.int64());
          continue;
        }
        case 29: {
          if (tag !== 232) {
            break;
          }
          message.timeSinceLastSeek = longToNumber6(reader.int64());
          continue;
        }
        case 30: {
          if (tag !== 240) {
            break;
          }
          message.dataSaverMode = reader.bool();
          continue;
        }
        case 32: {
          if (tag !== 256) {
            break;
          }
          message.networkMeteredState = reader.int32();
          continue;
        }
        case 34: {
          if (tag !== 272) {
            break;
          }
          message.visibility = reader.int32();
          continue;
        }
        case 35: {
          if (tag !== 285) {
            break;
          }
          message.playbackRate = reader.float();
          continue;
        }
        case 36: {
          if (tag !== 288) {
            break;
          }
          message.elapsedWallTimeMs = longToNumber6(reader.int64());
          continue;
        }
        case 38: {
          if (tag !== 306) {
            break;
          }
          message.mediaCapabilities = MediaCapabilities.decode(reader, reader.uint32());
          continue;
        }
        case 39: {
          if (tag !== 312) {
            break;
          }
          message.timeSinceLastActionMs = longToNumber6(reader.int64());
          continue;
        }
        case 40: {
          if (tag !== 320) {
            break;
          }
          message.enabledTrackTypesBitfield = reader.int32();
          continue;
        }
        case 43: {
          if (tag !== 344) {
            break;
          }
          message.maxPacingRate = reader.int32();
          continue;
        }
        case 44: {
          if (tag !== 352) {
            break;
          }
          message.playerState = longToNumber6(reader.int64());
          continue;
        }
        case 46: {
          if (tag !== 368) {
            break;
          }
          message.drcEnabled = reader.bool();
          continue;
        }
        case 48: {
          if (tag !== 384) {
            break;
          }
          message.field48 = reader.int32();
          continue;
        }
        case 50: {
          if (tag !== 400) {
            break;
          }
          message.field50 = reader.int32();
          continue;
        }
        case 51: {
          if (tag !== 408) {
            break;
          }
          message.field51 = reader.int32();
          continue;
        }
        case 54: {
          if (tag !== 432) {
            break;
          }
          message.sabrReportRequestCancellationInfo = reader.int32();
          continue;
        }
        case 56: {
          if (tag !== 448) {
            break;
          }
          message.disableStreamingXhr = reader.bool();
          continue;
        }
        case 57: {
          if (tag !== 456) {
            break;
          }
          message.field57 = longToNumber6(reader.int64());
          continue;
        }
        case 58: {
          if (tag !== 464) {
            break;
          }
          message.preferVp9 = reader.bool();
          continue;
        }
        case 59: {
          if (tag !== 472) {
            break;
          }
          message.av1QualityThreshold = reader.int32();
          continue;
        }
        case 60: {
          if (tag !== 480) {
            break;
          }
          message.field60 = reader.int32();
          continue;
        }
        case 61: {
          if (tag !== 488) {
            break;
          }
          message.isPrefetch = reader.bool();
          continue;
        }
        case 62: {
          if (tag !== 496) {
            break;
          }
          message.sabrSupportQualityConstraints = reader.bool();
          continue;
        }
        case 63: {
          if (tag !== 506) {
            break;
          }
          message.sabrLicenseConstraint = reader.bytes();
          continue;
        }
        case 64: {
          if (tag !== 512) {
            break;
          }
          message.allowProximaLiveLatency = reader.int32();
          continue;
        }
        case 66: {
          if (tag !== 528) {
            break;
          }
          message.sabrForceProxima = reader.int32();
          continue;
        }
        case 67: {
          if (tag !== 536) {
            break;
          }
          message.field67 = reader.int32();
          continue;
        }
        case 68: {
          if (tag !== 544) {
            break;
          }
          message.sabrForceMaxNetworkInterruptionDurationMs = longToNumber6(reader.int64());
          continue;
        }
        case 69: {
          if (tag !== 554) {
            break;
          }
          message.audioTrackId = reader.string();
          continue;
        }
        case 76: {
          if (tag !== 608) {
            break;
          }
          message.enableVoiceBoost = reader.bool();
          continue;
        }
        case 79: {
          if (tag !== 634) {
            break;
          }
          message.playbackAuthorization = PlaybackAuthorization.decode(reader, reader.uint32());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function longToNumber6(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
__name(longToNumber6, "longToNumber");

// dist/protos/generated/video_streaming/streamer_context.js
function createBaseStreamerContext() {
  return {
    clientInfo: void 0,
    poToken: new Uint8Array(0),
    playbackCookie: new Uint8Array(0),
    field4: new Uint8Array(0),
    sabrContexts: [],
    unsentSabrContexts: [],
    field7: "",
    field8: void 0
  };
}
__name(createBaseStreamerContext, "createBaseStreamerContext");
var StreamerContext = {
  encode(message, writer = new BinaryWriter()) {
    if (message.clientInfo !== void 0) {
      StreamerContext_ClientInfo.encode(message.clientInfo, writer.uint32(10).fork()).join();
    }
    if (message.poToken !== void 0 && message.poToken.length !== 0) {
      writer.uint32(18).bytes(message.poToken);
    }
    if (message.playbackCookie !== void 0 && message.playbackCookie.length !== 0) {
      writer.uint32(26).bytes(message.playbackCookie);
    }
    if (message.field4 !== void 0 && message.field4.length !== 0) {
      writer.uint32(34).bytes(message.field4);
    }
    for (const v of message.sabrContexts) {
      StreamerContext_SabrContext.encode(v, writer.uint32(42).fork()).join();
    }
    writer.uint32(50).fork();
    for (const v of message.unsentSabrContexts) {
      writer.int32(v);
    }
    writer.join();
    if (message.field7 !== void 0 && message.field7 !== "") {
      writer.uint32(58).string(message.field7);
    }
    if (message.field8 !== void 0) {
      StreamerContext_UnknownMessage1.encode(message.field8, writer.uint32(66).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseStreamerContext();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.clientInfo = StreamerContext_ClientInfo.decode(reader, reader.uint32());
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.poToken = reader.bytes();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.playbackCookie = reader.bytes();
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }
          message.field4 = reader.bytes();
          continue;
        }
        case 5: {
          if (tag !== 42) {
            break;
          }
          message.sabrContexts.push(StreamerContext_SabrContext.decode(reader, reader.uint32()));
          continue;
        }
        case 6: {
          if (tag === 48) {
            message.unsentSabrContexts.push(reader.int32());
            continue;
          }
          if (tag === 50) {
            const end2 = reader.uint32() + reader.pos;
            while (reader.pos < end2) {
              message.unsentSabrContexts.push(reader.int32());
            }
            continue;
          }
          break;
        }
        case 7: {
          if (tag !== 58) {
            break;
          }
          message.field7 = reader.string();
          continue;
        }
        case 8: {
          if (tag !== 66) {
            break;
          }
          message.field8 = StreamerContext_UnknownMessage1.decode(reader, reader.uint32());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseStreamerContext_ClientInfo() {
  return {
    deviceMake: "",
    deviceModel: "",
    clientName: 0,
    clientVersion: "",
    osName: "",
    osVersion: "",
    acceptLanguage: "",
    acceptRegion: "",
    screenWidthPoints: 0,
    screenHeightPoints: 0,
    screenWidthInches: 0,
    screenHeightInches: 0,
    screenPixelDensity: 0,
    clientFormFactor: 0,
    gmscoreVersionCode: 0,
    windowWidthPoints: 0,
    windowHeightPoints: 0,
    androidSdkVersion: 0,
    screenDensityFloat: 0,
    utcOffsetMinutes: 0,
    timeZone: "",
    chipset: "",
    glDeviceInfo: void 0
  };
}
__name(createBaseStreamerContext_ClientInfo, "createBaseStreamerContext_ClientInfo");
var StreamerContext_ClientInfo = {
  encode(message, writer = new BinaryWriter()) {
    if (message.deviceMake !== void 0 && message.deviceMake !== "") {
      writer.uint32(98).string(message.deviceMake);
    }
    if (message.deviceModel !== void 0 && message.deviceModel !== "") {
      writer.uint32(106).string(message.deviceModel);
    }
    if (message.clientName !== void 0 && message.clientName !== 0) {
      writer.uint32(128).int32(message.clientName);
    }
    if (message.clientVersion !== void 0 && message.clientVersion !== "") {
      writer.uint32(138).string(message.clientVersion);
    }
    if (message.osName !== void 0 && message.osName !== "") {
      writer.uint32(146).string(message.osName);
    }
    if (message.osVersion !== void 0 && message.osVersion !== "") {
      writer.uint32(154).string(message.osVersion);
    }
    if (message.acceptLanguage !== void 0 && message.acceptLanguage !== "") {
      writer.uint32(170).string(message.acceptLanguage);
    }
    if (message.acceptRegion !== void 0 && message.acceptRegion !== "") {
      writer.uint32(178).string(message.acceptRegion);
    }
    if (message.screenWidthPoints !== void 0 && message.screenWidthPoints !== 0) {
      writer.uint32(296).int32(message.screenWidthPoints);
    }
    if (message.screenHeightPoints !== void 0 && message.screenHeightPoints !== 0) {
      writer.uint32(304).int32(message.screenHeightPoints);
    }
    if (message.screenWidthInches !== void 0 && message.screenWidthInches !== 0) {
      writer.uint32(317).float(message.screenWidthInches);
    }
    if (message.screenHeightInches !== void 0 && message.screenHeightInches !== 0) {
      writer.uint32(325).float(message.screenHeightInches);
    }
    if (message.screenPixelDensity !== void 0 && message.screenPixelDensity !== 0) {
      writer.uint32(328).int32(message.screenPixelDensity);
    }
    if (message.clientFormFactor !== void 0 && message.clientFormFactor !== 0) {
      writer.uint32(368).int32(message.clientFormFactor);
    }
    if (message.gmscoreVersionCode !== void 0 && message.gmscoreVersionCode !== 0) {
      writer.uint32(400).int32(message.gmscoreVersionCode);
    }
    if (message.windowWidthPoints !== void 0 && message.windowWidthPoints !== 0) {
      writer.uint32(440).int32(message.windowWidthPoints);
    }
    if (message.windowHeightPoints !== void 0 && message.windowHeightPoints !== 0) {
      writer.uint32(448).int32(message.windowHeightPoints);
    }
    if (message.androidSdkVersion !== void 0 && message.androidSdkVersion !== 0) {
      writer.uint32(512).int32(message.androidSdkVersion);
    }
    if (message.screenDensityFloat !== void 0 && message.screenDensityFloat !== 0) {
      writer.uint32(525).float(message.screenDensityFloat);
    }
    if (message.utcOffsetMinutes !== void 0 && message.utcOffsetMinutes !== 0) {
      writer.uint32(536).int64(message.utcOffsetMinutes);
    }
    if (message.timeZone !== void 0 && message.timeZone !== "") {
      writer.uint32(642).string(message.timeZone);
    }
    if (message.chipset !== void 0 && message.chipset !== "") {
      writer.uint32(738).string(message.chipset);
    }
    if (message.glDeviceInfo !== void 0) {
      StreamerContext_GLDeviceInfo.encode(message.glDeviceInfo, writer.uint32(818).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseStreamerContext_ClientInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 12: {
          if (tag !== 98) {
            break;
          }
          message.deviceMake = reader.string();
          continue;
        }
        case 13: {
          if (tag !== 106) {
            break;
          }
          message.deviceModel = reader.string();
          continue;
        }
        case 16: {
          if (tag !== 128) {
            break;
          }
          message.clientName = reader.int32();
          continue;
        }
        case 17: {
          if (tag !== 138) {
            break;
          }
          message.clientVersion = reader.string();
          continue;
        }
        case 18: {
          if (tag !== 146) {
            break;
          }
          message.osName = reader.string();
          continue;
        }
        case 19: {
          if (tag !== 154) {
            break;
          }
          message.osVersion = reader.string();
          continue;
        }
        case 21: {
          if (tag !== 170) {
            break;
          }
          message.acceptLanguage = reader.string();
          continue;
        }
        case 22: {
          if (tag !== 178) {
            break;
          }
          message.acceptRegion = reader.string();
          continue;
        }
        case 37: {
          if (tag !== 296) {
            break;
          }
          message.screenWidthPoints = reader.int32();
          continue;
        }
        case 38: {
          if (tag !== 304) {
            break;
          }
          message.screenHeightPoints = reader.int32();
          continue;
        }
        case 39: {
          if (tag !== 317) {
            break;
          }
          message.screenWidthInches = reader.float();
          continue;
        }
        case 40: {
          if (tag !== 325) {
            break;
          }
          message.screenHeightInches = reader.float();
          continue;
        }
        case 41: {
          if (tag !== 328) {
            break;
          }
          message.screenPixelDensity = reader.int32();
          continue;
        }
        case 46: {
          if (tag !== 368) {
            break;
          }
          message.clientFormFactor = reader.int32();
          continue;
        }
        case 50: {
          if (tag !== 400) {
            break;
          }
          message.gmscoreVersionCode = reader.int32();
          continue;
        }
        case 55: {
          if (tag !== 440) {
            break;
          }
          message.windowWidthPoints = reader.int32();
          continue;
        }
        case 56: {
          if (tag !== 448) {
            break;
          }
          message.windowHeightPoints = reader.int32();
          continue;
        }
        case 64: {
          if (tag !== 512) {
            break;
          }
          message.androidSdkVersion = reader.int32();
          continue;
        }
        case 65: {
          if (tag !== 525) {
            break;
          }
          message.screenDensityFloat = reader.float();
          continue;
        }
        case 67: {
          if (tag !== 536) {
            break;
          }
          message.utcOffsetMinutes = longToNumber7(reader.int64());
          continue;
        }
        case 80: {
          if (tag !== 642) {
            break;
          }
          message.timeZone = reader.string();
          continue;
        }
        case 92: {
          if (tag !== 738) {
            break;
          }
          message.chipset = reader.string();
          continue;
        }
        case 102: {
          if (tag !== 818) {
            break;
          }
          message.glDeviceInfo = StreamerContext_GLDeviceInfo.decode(reader, reader.uint32());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseStreamerContext_GLDeviceInfo() {
  return { glRenderer: "", glEsVersionMajor: 0, glEsVersionMinor: 0 };
}
__name(createBaseStreamerContext_GLDeviceInfo, "createBaseStreamerContext_GLDeviceInfo");
var StreamerContext_GLDeviceInfo = {
  encode(message, writer = new BinaryWriter()) {
    if (message.glRenderer !== void 0 && message.glRenderer !== "") {
      writer.uint32(10).string(message.glRenderer);
    }
    if (message.glEsVersionMajor !== void 0 && message.glEsVersionMajor !== 0) {
      writer.uint32(16).int32(message.glEsVersionMajor);
    }
    if (message.glEsVersionMinor !== void 0 && message.glEsVersionMinor !== 0) {
      writer.uint32(24).int32(message.glEsVersionMinor);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseStreamerContext_GLDeviceInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.glRenderer = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.glEsVersionMajor = reader.int32();
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.glEsVersionMinor = reader.int32();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseStreamerContext_SabrContext() {
  return { type: 0, value: new Uint8Array(0) };
}
__name(createBaseStreamerContext_SabrContext, "createBaseStreamerContext_SabrContext");
var StreamerContext_SabrContext = {
  encode(message, writer = new BinaryWriter()) {
    if (message.type !== void 0 && message.type !== 0) {
      writer.uint32(8).int32(message.type);
    }
    if (message.value !== void 0 && message.value.length !== 0) {
      writer.uint32(18).bytes(message.value);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseStreamerContext_SabrContext();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.type = reader.int32();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.value = reader.bytes();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseStreamerContext_UnknownMessage1() {
  return { field1: new Uint8Array(0), field2: void 0 };
}
__name(createBaseStreamerContext_UnknownMessage1, "createBaseStreamerContext_UnknownMessage1");
var StreamerContext_UnknownMessage1 = {
  encode(message, writer = new BinaryWriter()) {
    if (message.field1 !== void 0 && message.field1.length !== 0) {
      writer.uint32(10).bytes(message.field1);
    }
    if (message.field2 !== void 0) {
      StreamerContext_UnknownMessage1_UnknownInnerMessage1.encode(message.field2, writer.uint32(18).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseStreamerContext_UnknownMessage1();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.field1 = reader.bytes();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.field2 = StreamerContext_UnknownMessage1_UnknownInnerMessage1.decode(reader, reader.uint32());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseStreamerContext_UnknownMessage1_UnknownInnerMessage1() {
  return { code: 0, message: "" };
}
__name(createBaseStreamerContext_UnknownMessage1_UnknownInnerMessage1, "createBaseStreamerContext_UnknownMessage1_UnknownInnerMessage1");
var StreamerContext_UnknownMessage1_UnknownInnerMessage1 = {
  encode(message, writer = new BinaryWriter()) {
    if (message.code !== void 0 && message.code !== 0) {
      writer.uint32(8).int32(message.code);
    }
    if (message.message !== void 0 && message.message !== "") {
      writer.uint32(18).string(message.message);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseStreamerContext_UnknownMessage1_UnknownInnerMessage1();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.code = reader.int32();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.message = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function longToNumber7(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
__name(longToNumber7, "longToNumber");

// dist/protos/generated/video_streaming/video_playback_abr_request.js
function createBaseVideoPlaybackAbrRequest() {
  return {
    clientAbrState: void 0,
    selectedFormatIds: [],
    bufferedRanges: [],
    playerTimeMs: 0,
    videoPlaybackUstreamerConfig: new Uint8Array(0),
    field6: void 0,
    preferredAudioFormatIds: [],
    preferredVideoFormatIds: [],
    preferredSubtitleFormatIds: [],
    streamerContext: void 0,
    field21: void 0,
    field22: 0,
    field23: 0,
    field1000: []
  };
}
__name(createBaseVideoPlaybackAbrRequest, "createBaseVideoPlaybackAbrRequest");
var VideoPlaybackAbrRequest = {
  encode(message, writer = new BinaryWriter()) {
    if (message.clientAbrState !== void 0) {
      ClientAbrState.encode(message.clientAbrState, writer.uint32(10).fork()).join();
    }
    for (const v of message.selectedFormatIds) {
      FormatId.encode(v, writer.uint32(18).fork()).join();
    }
    for (const v of message.bufferedRanges) {
      BufferedRange.encode(v, writer.uint32(26).fork()).join();
    }
    if (message.playerTimeMs !== void 0 && message.playerTimeMs !== 0) {
      writer.uint32(32).int64(message.playerTimeMs);
    }
    if (message.videoPlaybackUstreamerConfig !== void 0 && message.videoPlaybackUstreamerConfig.length !== 0) {
      writer.uint32(42).bytes(message.videoPlaybackUstreamerConfig);
    }
    if (message.field6 !== void 0) {
      UnknownMessage1.encode(message.field6, writer.uint32(50).fork()).join();
    }
    for (const v of message.preferredAudioFormatIds) {
      FormatId.encode(v, writer.uint32(130).fork()).join();
    }
    for (const v of message.preferredVideoFormatIds) {
      FormatId.encode(v, writer.uint32(138).fork()).join();
    }
    for (const v of message.preferredSubtitleFormatIds) {
      FormatId.encode(v, writer.uint32(146).fork()).join();
    }
    if (message.streamerContext !== void 0) {
      StreamerContext.encode(message.streamerContext, writer.uint32(154).fork()).join();
    }
    if (message.field21 !== void 0) {
      UnknownMessage2.encode(message.field21, writer.uint32(170).fork()).join();
    }
    if (message.field22 !== void 0 && message.field22 !== 0) {
      writer.uint32(176).int32(message.field22);
    }
    if (message.field23 !== void 0 && message.field23 !== 0) {
      writer.uint32(184).int32(message.field23);
    }
    for (const v of message.field1000) {
      UnknownMessage3.encode(v, writer.uint32(8002).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseVideoPlaybackAbrRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.clientAbrState = ClientAbrState.decode(reader, reader.uint32());
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.selectedFormatIds.push(FormatId.decode(reader, reader.uint32()));
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.bufferedRanges.push(BufferedRange.decode(reader, reader.uint32()));
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.playerTimeMs = longToNumber8(reader.int64());
          continue;
        }
        case 5: {
          if (tag !== 42) {
            break;
          }
          message.videoPlaybackUstreamerConfig = reader.bytes();
          continue;
        }
        case 6: {
          if (tag !== 50) {
            break;
          }
          message.field6 = UnknownMessage1.decode(reader, reader.uint32());
          continue;
        }
        case 16: {
          if (tag !== 130) {
            break;
          }
          message.preferredAudioFormatIds.push(FormatId.decode(reader, reader.uint32()));
          continue;
        }
        case 17: {
          if (tag !== 138) {
            break;
          }
          message.preferredVideoFormatIds.push(FormatId.decode(reader, reader.uint32()));
          continue;
        }
        case 18: {
          if (tag !== 146) {
            break;
          }
          message.preferredSubtitleFormatIds.push(FormatId.decode(reader, reader.uint32()));
          continue;
        }
        case 19: {
          if (tag !== 154) {
            break;
          }
          message.streamerContext = StreamerContext.decode(reader, reader.uint32());
          continue;
        }
        case 21: {
          if (tag !== 170) {
            break;
          }
          message.field21 = UnknownMessage2.decode(reader, reader.uint32());
          continue;
        }
        case 22: {
          if (tag !== 176) {
            break;
          }
          message.field22 = reader.int32();
          continue;
        }
        case 23: {
          if (tag !== 184) {
            break;
          }
          message.field23 = reader.int32();
          continue;
        }
        case 1e3: {
          if (tag !== 8002) {
            break;
          }
          message.field1000.push(UnknownMessage3.decode(reader, reader.uint32()));
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseUnknownMessage1() {
  return { formatId: void 0, lmt: 0, sequenceNumber: 0, timeRange: void 0, field5: 0 };
}
__name(createBaseUnknownMessage1, "createBaseUnknownMessage1");
var UnknownMessage1 = {
  encode(message, writer = new BinaryWriter()) {
    if (message.formatId !== void 0) {
      FormatId.encode(message.formatId, writer.uint32(10).fork()).join();
    }
    if (message.lmt !== void 0 && message.lmt !== 0) {
      writer.uint32(16).sint64(message.lmt);
    }
    if (message.sequenceNumber !== void 0 && message.sequenceNumber !== 0) {
      writer.uint32(24).int32(message.sequenceNumber);
    }
    if (message.timeRange !== void 0) {
      TimeRange.encode(message.timeRange, writer.uint32(34).fork()).join();
    }
    if (message.field5 !== void 0 && message.field5 !== 0) {
      writer.uint32(40).int32(message.field5);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseUnknownMessage1();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.formatId = FormatId.decode(reader, reader.uint32());
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.lmt = longToNumber8(reader.sint64());
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.sequenceNumber = reader.int32();
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }
          message.timeRange = TimeRange.decode(reader, reader.uint32());
          continue;
        }
        case 5: {
          if (tag !== 40) {
            break;
          }
          message.field5 = reader.int32();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseUnknownMessage2() {
  return { field1: [], field2: new Uint8Array(0), field3: "", field4: 0, field5: 0, field6: "" };
}
__name(createBaseUnknownMessage2, "createBaseUnknownMessage2");
var UnknownMessage2 = {
  encode(message, writer = new BinaryWriter()) {
    for (const v of message.field1) {
      writer.uint32(10).string(v);
    }
    if (message.field2 !== void 0 && message.field2.length !== 0) {
      writer.uint32(18).bytes(message.field2);
    }
    if (message.field3 !== void 0 && message.field3 !== "") {
      writer.uint32(26).string(message.field3);
    }
    if (message.field4 !== void 0 && message.field4 !== 0) {
      writer.uint32(32).int32(message.field4);
    }
    if (message.field5 !== void 0 && message.field5 !== 0) {
      writer.uint32(40).int32(message.field5);
    }
    if (message.field6 !== void 0 && message.field6 !== "") {
      writer.uint32(50).string(message.field6);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseUnknownMessage2();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.field1.push(reader.string());
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.field2 = reader.bytes();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.field3 = reader.string();
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.field4 = reader.int32();
          continue;
        }
        case 5: {
          if (tag !== 40) {
            break;
          }
          message.field5 = reader.int32();
          continue;
        }
        case 6: {
          if (tag !== 50) {
            break;
          }
          message.field6 = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseUnknownMessage3() {
  return { formatIds: [], ud: [], clipId: "" };
}
__name(createBaseUnknownMessage3, "createBaseUnknownMessage3");
var UnknownMessage3 = {
  encode(message, writer = new BinaryWriter()) {
    for (const v of message.formatIds) {
      FormatId.encode(v, writer.uint32(10).fork()).join();
    }
    for (const v of message.ud) {
      BufferedRange.encode(v, writer.uint32(18).fork()).join();
    }
    if (message.clipId !== void 0 && message.clipId !== "") {
      writer.uint32(26).string(message.clipId);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseUnknownMessage3();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.formatIds.push(FormatId.decode(reader, reader.uint32()));
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.ud.push(BufferedRange.decode(reader, reader.uint32()));
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.clipId = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function longToNumber8(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
__name(longToNumber8, "longToNumber");

// dist/protos/generated/video_streaming/next_request_policy.js
function createBaseNextRequestPolicy() {
  return {
    targetAudioReadaheadMs: 0,
    targetVideoReadaheadMs: 0,
    maxTimeSinceLastRequestMs: 0,
    backoffTimeMs: 0,
    minAudioReadaheadMs: 0,
    minVideoReadaheadMs: 0,
    playbackCookie: void 0,
    videoId: ""
  };
}
__name(createBaseNextRequestPolicy, "createBaseNextRequestPolicy");
var NextRequestPolicy = {
  encode(message, writer = new BinaryWriter()) {
    if (message.targetAudioReadaheadMs !== void 0 && message.targetAudioReadaheadMs !== 0) {
      writer.uint32(8).int32(message.targetAudioReadaheadMs);
    }
    if (message.targetVideoReadaheadMs !== void 0 && message.targetVideoReadaheadMs !== 0) {
      writer.uint32(16).int32(message.targetVideoReadaheadMs);
    }
    if (message.maxTimeSinceLastRequestMs !== void 0 && message.maxTimeSinceLastRequestMs !== 0) {
      writer.uint32(24).int32(message.maxTimeSinceLastRequestMs);
    }
    if (message.backoffTimeMs !== void 0 && message.backoffTimeMs !== 0) {
      writer.uint32(32).int32(message.backoffTimeMs);
    }
    if (message.minAudioReadaheadMs !== void 0 && message.minAudioReadaheadMs !== 0) {
      writer.uint32(40).int32(message.minAudioReadaheadMs);
    }
    if (message.minVideoReadaheadMs !== void 0 && message.minVideoReadaheadMs !== 0) {
      writer.uint32(48).int32(message.minVideoReadaheadMs);
    }
    if (message.playbackCookie !== void 0) {
      PlaybackCookie.encode(message.playbackCookie, writer.uint32(58).fork()).join();
    }
    if (message.videoId !== void 0 && message.videoId !== "") {
      writer.uint32(66).string(message.videoId);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseNextRequestPolicy();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.targetAudioReadaheadMs = reader.int32();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.targetVideoReadaheadMs = reader.int32();
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.maxTimeSinceLastRequestMs = reader.int32();
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.backoffTimeMs = reader.int32();
          continue;
        }
        case 5: {
          if (tag !== 40) {
            break;
          }
          message.minAudioReadaheadMs = reader.int32();
          continue;
        }
        case 6: {
          if (tag !== 48) {
            break;
          }
          message.minVideoReadaheadMs = reader.int32();
          continue;
        }
        case 7: {
          if (tag !== 58) {
            break;
          }
          message.playbackCookie = PlaybackCookie.decode(reader, reader.uint32());
          continue;
        }
        case 8: {
          if (tag !== 66) {
            break;
          }
          message.videoId = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};

// dist/protos/generated/video_streaming/sabr_error.js
function createBaseSabrError() {
  return { type: "", code: 0 };
}
__name(createBaseSabrError, "createBaseSabrError");
var SabrError = {
  encode(message, writer = new BinaryWriter()) {
    if (message.type !== void 0 && message.type !== "") {
      writer.uint32(10).string(message.type);
    }
    if (message.code !== void 0 && message.code !== 0) {
      writer.uint32(16).int32(message.code);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseSabrError();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.type = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.code = reader.int32();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};

// dist/protos/generated/video_streaming/sabr_redirect.js
function createBaseSabrRedirect() {
  return { url: "" };
}
__name(createBaseSabrRedirect, "createBaseSabrRedirect");
var SabrRedirect = {
  encode(message, writer = new BinaryWriter()) {
    if (message.url !== void 0 && message.url !== "") {
      writer.uint32(10).string(message.url);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseSabrRedirect();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.url = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};

// dist/protos/generated/video_streaming/reload_player_response.js
function createBaseReloadPlaybackParams() {
  return { token: "" };
}
__name(createBaseReloadPlaybackParams, "createBaseReloadPlaybackParams");
var ReloadPlaybackParams = {
  encode(message, writer = new BinaryWriter()) {
    if (message.token !== void 0 && message.token !== "") {
      writer.uint32(10).string(message.token);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseReloadPlaybackParams();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.token = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};
function createBaseReloadPlaybackContext() {
  return { reloadPlaybackParams: void 0 };
}
__name(createBaseReloadPlaybackContext, "createBaseReloadPlaybackContext");
var ReloadPlaybackContext = {
  encode(message, writer = new BinaryWriter()) {
    if (message.reloadPlaybackParams !== void 0) {
      ReloadPlaybackParams.encode(message.reloadPlaybackParams, writer.uint32(10).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseReloadPlaybackContext();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.reloadPlaybackParams = ReloadPlaybackParams.decode(reader, reader.uint32());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};

// dist/protos/generated/video_streaming/sabr_context_update.js
var SabrContextUpdate_SabrContextWritePolicy = {
  UNSPECIFIED: 0,
  0: "UNSPECIFIED",
  OVERWRITE: 1,
  1: "OVERWRITE",
  KEEP_EXISTING: 2,
  2: "KEEP_EXISTING",
  UNRECOGNIZED: -1,
  "-1": "UNRECOGNIZED"
};
function createBaseSabrContextUpdate() {
  return { type: 0, scope: 0, value: new Uint8Array(0), sendByDefault: false, writePolicy: 0 };
}
__name(createBaseSabrContextUpdate, "createBaseSabrContextUpdate");
var SabrContextUpdate = {
  encode(message, writer = new BinaryWriter()) {
    if (message.type !== void 0 && message.type !== 0) {
      writer.uint32(8).int32(message.type);
    }
    if (message.scope !== void 0 && message.scope !== 0) {
      writer.uint32(16).int32(message.scope);
    }
    if (message.value !== void 0 && message.value.length !== 0) {
      writer.uint32(26).bytes(message.value);
    }
    if (message.sendByDefault !== void 0 && message.sendByDefault !== false) {
      writer.uint32(32).bool(message.sendByDefault);
    }
    if (message.writePolicy !== void 0 && message.writePolicy !== 0) {
      writer.uint32(40).int32(message.writePolicy);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseSabrContextUpdate();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.type = reader.int32();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.scope = reader.int32();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.value = reader.bytes();
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.sendByDefault = reader.bool();
          continue;
        }
        case 5: {
          if (tag !== 40) {
            break;
          }
          message.writePolicy = reader.int32();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};

// dist/protos/generated/video_streaming/sabr_context_sending_policy.js
function createBaseSabrContextSendingPolicy() {
  return { startPolicy: [], stopPolicy: [], discardPolicy: [] };
}
__name(createBaseSabrContextSendingPolicy, "createBaseSabrContextSendingPolicy");
var SabrContextSendingPolicy = {
  encode(message, writer = new BinaryWriter()) {
    writer.uint32(10).fork();
    for (const v of message.startPolicy) {
      writer.int32(v);
    }
    writer.join();
    writer.uint32(18).fork();
    for (const v of message.stopPolicy) {
      writer.int32(v);
    }
    writer.join();
    writer.uint32(26).fork();
    for (const v of message.discardPolicy) {
      writer.int32(v);
    }
    writer.join();
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseSabrContextSendingPolicy();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag === 8) {
            message.startPolicy.push(reader.int32());
            continue;
          }
          if (tag === 10) {
            const end2 = reader.uint32() + reader.pos;
            while (reader.pos < end2) {
              message.startPolicy.push(reader.int32());
            }
            continue;
          }
          break;
        }
        case 2: {
          if (tag === 16) {
            message.stopPolicy.push(reader.int32());
            continue;
          }
          if (tag === 18) {
            const end2 = reader.uint32() + reader.pos;
            while (reader.pos < end2) {
              message.stopPolicy.push(reader.int32());
            }
            continue;
          }
          break;
        }
        case 3: {
          if (tag === 24) {
            message.discardPolicy.push(reader.int32());
            continue;
          }
          if (tag === 26) {
            const end2 = reader.uint32() + reader.pos;
            while (reader.pos < end2) {
              message.discardPolicy.push(reader.int32());
            }
            continue;
          }
          break;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};

// dist/protos/generated/video_streaming/stream_protection_status.js
function createBaseStreamProtectionStatus() {
  return { status: 0, maxRetries: 0 };
}
__name(createBaseStreamProtectionStatus, "createBaseStreamProtectionStatus");
var StreamProtectionStatus = {
  encode(message, writer = new BinaryWriter()) {
    if (message.status !== void 0 && message.status !== 0) {
      writer.uint32(8).int32(message.status);
    }
    if (message.maxRetries !== void 0 && message.maxRetries !== 0) {
      writer.uint32(16).int32(message.maxRetries);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseStreamProtectionStatus();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.status = reader.int32();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.maxRetries = reader.int32();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};

// dist/protos/generated/video_streaming/snackbar_message.js
function createBaseSnackbarMessage() {
  return { id: 0 };
}
__name(createBaseSnackbarMessage, "createBaseSnackbarMessage");
var SnackbarMessage = {
  encode(message, writer = new BinaryWriter()) {
    if (message.id !== void 0 && message.id !== 0) {
      writer.uint32(8).int32(message.id);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    const end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseSnackbarMessage();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.id = reader.int32();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  }
};

// dist/protos/generated/video_streaming/ump_part_id.js
var UMPPartId = {
  UNKNOWN: 0,
  0: "UNKNOWN",
  ONESIE_HEADER: 10,
  10: "ONESIE_HEADER",
  ONESIE_DATA: 11,
  11: "ONESIE_DATA",
  ONESIE_ENCRYPTED_MEDIA: 12,
  12: "ONESIE_ENCRYPTED_MEDIA",
  /** MEDIA_HEADER - Header for a media segment; includes sequence and timing information. */
  MEDIA_HEADER: 20,
  /** MEDIA_HEADER - Header for a media segment; includes sequence and timing information. */
  20: "MEDIA_HEADER",
  /** MEDIA - Chunk of media segment data. */
  MEDIA: 21,
  /** MEDIA - Chunk of media segment data. */
  21: "MEDIA",
  /** MEDIA_END - Indicates end of media segment; finalizes segment processing. */
  MEDIA_END: 22,
  /** MEDIA_END - Indicates end of media segment; finalizes segment processing. */
  22: "MEDIA_END",
  CONFIG: 30,
  30: "CONFIG",
  LIVE_METADATA: 31,
  31: "LIVE_METADATA",
  HOSTNAME_CHANGE_HINT_DEPRECATED: 32,
  32: "HOSTNAME_CHANGE_HINT_DEPRECATED",
  LIVE_METADATA_PROMISE: 33,
  33: "LIVE_METADATA_PROMISE",
  LIVE_METADATA_PROMISE_CANCELLATION: 34,
  34: "LIVE_METADATA_PROMISE_CANCELLATION",
  /** NEXT_REQUEST_POLICY - Server's policy for the next request; includes backoff time and playback cookie. */
  NEXT_REQUEST_POLICY: 35,
  /** NEXT_REQUEST_POLICY - Server's policy for the next request; includes backoff time and playback cookie. */
  35: "NEXT_REQUEST_POLICY",
  USTREAMER_VIDEO_AND_FORMAT_METADATA: 36,
  36: "USTREAMER_VIDEO_AND_FORMAT_METADATA",
  FORMAT_SELECTION_CONFIG: 37,
  37: "FORMAT_SELECTION_CONFIG",
  USTREAMER_SELECTED_MEDIA_STREAM: 38,
  38: "USTREAMER_SELECTED_MEDIA_STREAM",
  /** FORMAT_INITIALIZATION_METADATA - Metadata for format initialization; contains total number of segments, duration, etc. */
  FORMAT_INITIALIZATION_METADATA: 42,
  /** FORMAT_INITIALIZATION_METADATA - Metadata for format initialization; contains total number of segments, duration, etc. */
  42: "FORMAT_INITIALIZATION_METADATA",
  /** SABR_REDIRECT - Indicates a redirect to a different streaming URL. */
  SABR_REDIRECT: 43,
  /** SABR_REDIRECT - Indicates a redirect to a different streaming URL. */
  43: "SABR_REDIRECT",
  /** SABR_ERROR - Indicates a SABR error; happens when the payload is invalid or the server cannot process the request. */
  SABR_ERROR: 44,
  /** SABR_ERROR - Indicates a SABR error; happens when the payload is invalid or the server cannot process the request. */
  44: "SABR_ERROR",
  SABR_SEEK: 45,
  45: "SABR_SEEK",
  /** RELOAD_PLAYER_RESPONSE - Directive to reload the player with new parameters. */
  RELOAD_PLAYER_RESPONSE: 46,
  /** RELOAD_PLAYER_RESPONSE - Directive to reload the player with new parameters. */
  46: "RELOAD_PLAYER_RESPONSE",
  PLAYBACK_START_POLICY: 47,
  47: "PLAYBACK_START_POLICY",
  ALLOWED_CACHED_FORMATS: 48,
  48: "ALLOWED_CACHED_FORMATS",
  START_BW_SAMPLING_HINT: 49,
  49: "START_BW_SAMPLING_HINT",
  PAUSE_BW_SAMPLING_HINT: 50,
  50: "PAUSE_BW_SAMPLING_HINT",
  SELECTABLE_FORMATS: 51,
  51: "SELECTABLE_FORMATS",
  REQUEST_IDENTIFIER: 52,
  52: "REQUEST_IDENTIFIER",
  REQUEST_CANCELLATION_POLICY: 53,
  53: "REQUEST_CANCELLATION_POLICY",
  ONESIE_PREFETCH_REJECTION: 54,
  54: "ONESIE_PREFETCH_REJECTION",
  TIMELINE_CONTEXT: 55,
  55: "TIMELINE_CONTEXT",
  REQUEST_PIPELINING: 56,
  56: "REQUEST_PIPELINING",
  /** SABR_CONTEXT_UPDATE - Updates SABR context data; usually used for ads. */
  SABR_CONTEXT_UPDATE: 57,
  /** SABR_CONTEXT_UPDATE - Updates SABR context data; usually used for ads. */
  57: "SABR_CONTEXT_UPDATE",
  /** STREAM_PROTECTION_STATUS - Status of stream protection; indicates whether attestation is required. */
  STREAM_PROTECTION_STATUS: 58,
  /** STREAM_PROTECTION_STATUS - Status of stream protection; indicates whether attestation is required. */
  58: "STREAM_PROTECTION_STATUS",
  /** SABR_CONTEXT_SENDING_POLICY - Policy indicating which SABR contexts to send or discard in future requests. */
  SABR_CONTEXT_SENDING_POLICY: 59,
  /** SABR_CONTEXT_SENDING_POLICY - Policy indicating which SABR contexts to send or discard in future requests. */
  59: "SABR_CONTEXT_SENDING_POLICY",
  LAWNMOWER_POLICY: 60,
  60: "LAWNMOWER_POLICY",
  SABR_ACK: 61,
  61: "SABR_ACK",
  END_OF_TRACK: 62,
  62: "END_OF_TRACK",
  CACHE_LOAD_POLICY: 63,
  63: "CACHE_LOAD_POLICY",
  LAWNMOWER_MESSAGING_POLICY: 64,
  64: "LAWNMOWER_MESSAGING_POLICY",
  PREWARM_CONNECTION: 65,
  65: "PREWARM_CONNECTION",
  PLAYBACK_DEBUG_INFO: 66,
  66: "PLAYBACK_DEBUG_INFO",
  /** SNACKBAR_MESSAGE - Directive to show the user a notification message. */
  SNACKBAR_MESSAGE: 67,
  /** SNACKBAR_MESSAGE - Directive to show the user a notification message. */
  67: "SNACKBAR_MESSAGE",
  UNRECOGNIZED: -1,
  "-1": "UNRECOGNIZED"
};

// dist/src/core/SabrStreamingAdapter.js
var TAG2 = "SabrStreamingAdapter";
var SABR_CONSTANTS = {
  PROTOCOL: "sabr:",
  KEY_PARAM: "key",
  DEFAULT_OPTIONS: {
    enableCaching: true,
    enableVerboseRequestLogging: false,
    maxCacheSizeMB: 3,
    maxCacheAgeSeconds: 300
  }
};
var UMP_REQUEST_BODY = new Uint8Array([120, 0]);
var _SabrStreamingAdapter = class _SabrStreamingAdapter {
  /**
   * Registers a callback function to handle snackbar messages.
   */
  onSnackbarMessage(cb) {
    this.onSnackbarMessageCallback = cb;
  }
  /**
   * Handles server requests to reload the player with new parameters.
   * @param cb
   */
  onReloadPlayerResponse(cb) {
    this.onReloadPlayerResponseCallback = cb;
  }
  /**
   * Registers a callback function to mint a new PoToken.
   * @param cb
   */
  onMintPoToken(cb) {
    this.onMintPoTokenCallback = cb;
  }
  /**
   * @param options - Configuration options for the adapter.
   * @throws SabrAdapterError if a player adapter is not provided.
   */
  constructor(options) {
    this.initializedFormats = /* @__PURE__ */ new Map();
    this.logger = Logger.getInstance();
    this.sabrFormats = [];
    this.sabrContexts = /* @__PURE__ */ new Map();
    this.activeSabrContextTypes = /* @__PURE__ */ new Set();
    this.cacheManager = null;
    this.requestNumber = 0;
    this.activeDelayPromise = null;
    this.isDisposed = false;
    this.options = {
      ...SABR_CONSTANTS.DEFAULT_OPTIONS,
      ...options
    };
    if (options.playerAdapter) {
      this.playerAdapter = options.playerAdapter;
    } else
      throw new SabrAdapterError("A player adapter is required.");
    if (this.options.enableCaching) {
      this.cacheManager = new CacheManager(this.options.maxCacheSizeMB, this.options.maxCacheAgeSeconds);
    }
    this.requestMetadataManager = new RequestMetadataManager();
  }
  /**
   * Initializes the player adapter and sets up request/response interceptors.
   * @throws SabrAdapterError if the adapter has been disposed.
   */
  attach(player) {
    this.checkDisposed();
    this.playerAdapter.initialize(player, this.requestMetadataManager, this.cacheManager);
    this.setupInterceptors();
  }
  /**
   * Sets the initial server abr streaming URL.
   * @throws SabrAdapterError if the adapter has been disposed.
   */
  setStreamingURL(url) {
    this.checkDisposed();
    this.serverAbrStreamingUrl = url;
  }
  /**
   * Sets the ustreamer configuration for SABR requests.
   * @throws SabrAdapterError if the adapter has been disposed.
   */
  setUstreamerConfig(ustreamerConfig) {
    this.checkDisposed();
    this.ustreamerConfig = ustreamerConfig;
  }
  /**
   * Sets the available SABR formats for streaming.
   * @throws SabrAdapterError if the adapter has been disposed.
   */
  setServerAbrFormats(sabrFormats) {
    this.checkDisposed();
    this.sabrFormats = sabrFormats;
  }
  /**
   * Returns the cache manager instance, if caching is enabled.
   */
  getCacheManager() {
    return this.cacheManager;
  }
  setupInterceptors() {
    this.playerAdapter.registerRequestInterceptor(this.handleRequest.bind(this));
    this.playerAdapter.registerResponseInterceptor(this.handleResponse.bind(this));
  }
  /**
   * Processes incoming requests and modifies them to conform to SABR protocol requirements.
   * For SABR protocol URIs, prepares a VideoPlaybackAbrRequest with current state information.
   * For regular URIs with UMP requirements, adds necessary query parameters.
   * @returns Modified request with SABR-specific changes.
   */
  async handleRequest(request) {
    var _a, _b;
    const originalUri = new URL(request.url);
    if (originalUri.protocol === SABR_CONSTANTS.PROTOCOL) {
      if (this.activeDelayPromise)
        await this.activeDelayPromise;
      if (!this.serverAbrStreamingUrl) {
        throw new SabrAdapterError("Server ABR URL not set.");
      }
      if (!this.sabrFormats.length) {
        throw new SabrAdapterError("No SABR formats available.");
      }
      const requestNumber = String(this.requestNumber++);
      const sabrUrl = new URL(this.serverAbrStreamingUrl || "");
      sabrUrl.searchParams.set("rn", requestNumber);
      request.url = sabrUrl.toString();
      const currentFormat = this.sabrFormats.find((format) => fromFormat(format) === (originalUri.searchParams.get(SABR_CONSTANTS.KEY_PARAM) || ""));
      if (!currentFormat)
        throw new SabrAdapterError(`Could not determine current format from URL: ${request.url}`);
      const activeFormats = this.playerAdapter.getActiveTrackFormats(currentFormat, this.sabrFormats);
      const videoPlaybackAbrRequest = await this.createVideoPlaybackAbrRequest(request, currentFormat, activeFormats);
      if (currentFormat.height) {
        videoPlaybackAbrRequest.clientAbrState.stickyResolution = currentFormat.height;
        videoPlaybackAbrRequest.clientAbrState.lastManualSelectedResolution = currentFormat.height;
      }
      const formatToDiscard = this.addBufferingInfoToAbrRequest(videoPlaybackAbrRequest, currentFormat, activeFormats);
      if (formatToDiscard) {
        videoPlaybackAbrRequest.selectedFormatIds.push(formatToDiscard);
      }
      if (!request.segment.isInit()) {
        videoPlaybackAbrRequest.selectedFormatIds.push(currentFormat);
      }
      if (this.options.enableVerboseRequestLogging)
        this.logger.debug(TAG2, `Created VideoPlaybackAbrRequest (${requestNumber}):`, videoPlaybackAbrRequest);
      request.body = VideoPlaybackAbrRequest.encode(videoPlaybackAbrRequest).finish();
      this.requestMetadataManager.metadataMap.set(requestNumber, {
        format: currentFormat,
        isUMP: true,
        isSABR: true,
        isInit: request.segment.isInit(),
        byteRange: parseRangeHeader(request.headers.Range),
        timestamp: Date.now()
      });
    } else {
      const webPoToken = this.onMintPoTokenCallback ? await this.onMintPoTokenCallback() : void 0;
      if (originalUri.pathname.includes("videoplayback/expire") || originalUri.pathname.includes("source/yt_live_broadcast")) {
        originalUri.pathname += "/ump/1";
        originalUri.pathname += "/srfvp/1";
        originalUri.pathname += "/alr/yes";
        if (webPoToken)
          originalUri.pathname += `/pot/${webPoToken}`;
        if (request.headers.Range)
          originalUri.pathname += `/range/${(_a = request.headers.Range) == null ? void 0 : _a.split("=")[1]}`;
      } else {
        originalUri.searchParams.set("ump", "1");
        originalUri.searchParams.set("srfvp", "1");
        originalUri.searchParams.set("alr", "yes");
        if (webPoToken)
          originalUri.searchParams.set("pot", webPoToken);
        if (request.headers.Range)
          originalUri.searchParams.set("range", (_b = request.headers.Range) == null ? void 0 : _b.split("=")[1]);
      }
      const requestNumber = String(this.requestNumber++);
      originalUri.searchParams.set("rn", requestNumber);
      request.url = originalUri.toString();
      request.body = UMP_REQUEST_BODY;
      this.requestMetadataManager.metadataMap.set(requestNumber, {
        isUMP: true,
        isSABR: false,
        timestamp: Date.now()
      });
    }
    request.method = "POST";
    delete request.headers.Range;
    return request;
  }
  /**
   * Creates a VideoPlaybackAbrRequest object with current playback state information.
   * @param request - The original player HTTP request.
   * @param currentFormat - The format currently being fetched.
   * @param activeFormats - Object containing references to active audio and video formats.
   * @returns A populated VideoPlaybackAbrRequest object.
   * @throws SabrAdapterError if ustreamer config is not set.
   */
  async createVideoPlaybackAbrRequest(request, currentFormat, activeFormats) {
    var _a, _b;
    if (!this.ustreamerConfig) {
      throw new SabrAdapterError("Ustreamer config not set");
    }
    const streamerContext = {
      poToken: this.onMintPoTokenCallback ? base64ToU8(await this.onMintPoTokenCallback()) : void 0,
      playbackCookie: this.lastPlaybackCookie ? PlaybackCookie.encode(this.lastPlaybackCookie).finish() : void 0,
      clientInfo: this.options.clientInfo,
      sabrContexts: [],
      unsentSabrContexts: []
    };
    for (const ctxUpdate of this.sabrContexts.values()) {
      if (this.activeSabrContextTypes.has(ctxUpdate.type)) {
        streamerContext.sabrContexts.push(ctxUpdate);
      } else {
        streamerContext.unsentSabrContexts.push(ctxUpdate.type);
      }
    }
    return {
      clientAbrState: {
        playbackRate: this.playerAdapter.getPlaybackRate(),
        playerTimeMs: Math.round(((_a = request.segment.getStartTime()) != null ? _a : this.playerAdapter.getPlayerTime()) * 1e3),
        timeSinceLastManualFormatSelectionMs: 0,
        clientViewportIsFlexible: false,
        bandwidthEstimate: Math.round(this.playerAdapter.getBandwidthEstimate() || 0),
        drcEnabled: (_b = currentFormat == null ? void 0 : currentFormat.isDrc) != null ? _b : false,
        enabledTrackTypesBitfield: currentFormat.width ? EnabledTrackTypes.VIDEO_ONLY : EnabledTrackTypes.AUDIO_ONLY,
        audioTrackId: currentFormat.audioTrackId
      },
      bufferedRanges: [],
      selectedFormatIds: [],
      preferredAudioFormatIds: [activeFormats.audioFormat || {}],
      preferredVideoFormatIds: [activeFormats.videoFormat || {}],
      preferredSubtitleFormatIds: [],
      videoPlaybackUstreamerConfig: base64ToU8(this.ustreamerConfig),
      streamerContext,
      field1000: []
    };
  }
  /**
   * Adds buffering information to the ABR request for all active formats.
   *
   * NOTE:
   * On the web, mobile, and TV clients, buffered ranges in combination to player time is what dictates the segments you get.
   * In our case, we are cheating a bit by abusing the player time field (in clientAbrState), setting it to the exact start
   * time value of the segment we want, while YouTube simply uses the actual player time.
   *
   * We don't have to fully replicate this behavior for two reasons:
   * 1. The SABR server will only send so much segments for a given player time. That means players like Shaka would
   * not be able to buffer more than what the server thinks is enough. It would behave like YouTube's.
   * 2. We don't have to know what segment a buffered range starts/ends at. It is easy to do in Shaka, but not in other players.
   *
   * @param videoPlaybackAbrRequest - The ABR request to modify with buffering information.
   * @param currentFormat - The format currently being requested.
   * @param activeFormats - References to the currently active audio and video formats.
   * @returns The format to discard (if any) - typically formats that are active but not currently requested.
   */
  addBufferingInfoToAbrRequest(videoPlaybackAbrRequest, currentFormat, activeFormats) {
    let formatToDiscard;
    const currentFormatKey = fromFormat(currentFormat);
    for (const activeFormat of Object.values(activeFormats)) {
      if (!activeFormat)
        continue;
      const activeFormatKey = fromFormat(activeFormat);
      const shouldDiscard = currentFormatKey !== activeFormatKey;
      const initializedFormat = this.initializedFormats.get(activeFormatKey || "");
      const bufferedRange = shouldDiscard ? this.createFullBufferRange(activeFormat) : this.createPartialBufferRange(initializedFormat);
      if (bufferedRange) {
        videoPlaybackAbrRequest.bufferedRanges.push(bufferedRange);
        if (shouldDiscard) {
          formatToDiscard = activeFormat;
        }
      }
    }
    return formatToDiscard;
  }
  /**
   * Creates a bogus buffered range for a format. Used when we want to signal to the server to not send any
   * segments for this format.
   * @param format - The format to create a full buffer range for.
   * @returns A BufferedRange object indicating the entire format is buffered.
   */
  createFullBufferRange(format) {
    return {
      formatId: format,
      durationMs: MAX_INT32_VALUE,
      startTimeMs: 0,
      startSegmentIndex: MAX_INT32_VALUE,
      endSegmentIndex: MAX_INT32_VALUE,
      timeRange: {
        durationTicks: MAX_INT32_VALUE,
        startTicks: 0,
        timescale: 1e3
      }
    };
  }
  /**
   * Creates a buffered range representing a partially buffered format.
   * @param initializedFormat - The format with initialization data.
   * @returns A BufferedRange object with segment information, or null if no metadata is available.
   */
  createPartialBufferRange(initializedFormat) {
    if (!(initializedFormat == null ? void 0 : initializedFormat.lastSegmentMetadata))
      return null;
    const { formatId, startSequenceNumber, timescale, durationMs, endSequenceNumber } = initializedFormat.lastSegmentMetadata;
    return {
      formatId,
      startSegmentIndex: startSequenceNumber,
      durationMs,
      startTimeMs: 0,
      endSegmentIndex: endSequenceNumber,
      timeRange: {
        timescale,
        startTicks: 0,
        durationTicks: durationMs
      }
    };
  }
  /**
   * Processes HTTP responses to extract SABR-specific information.
   * @returns The response object.
   */
  async handleResponse(response) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const requestMetadata = this.requestMetadataManager.getRequestMetadata(response.url, true);
    if (!requestMetadata) {
      console.warn(TAG2, "No request metadata found for response:", response);
      return response;
    }
    const { streamInfo, format, byteRange, isSABR } = requestMetadata;
    if (!streamInfo) {
      console.warn(TAG2, "No stream info available in request metadata for response:", response, requestMetadata);
      return response;
    }
    const retry = /* @__PURE__ */ __name(async () => {
      const formatType = (format == null ? void 0 : format.width) ? "video" : "audio";
      const formatKey = fromFormat(format) || "";
      const url = new URL(`${SABR_CONSTANTS.PROTOCOL}//${formatType}?${SABR_CONSTANTS.KEY_PARAM}=${formatKey}`);
      return await this.makeFollowupRequest(response, url.toString(), isSABR, byteRange);
    }, "retry");
    if (streamInfo.snackbarMessage) {
      this.logger.debug(TAG2, "Received snackbar message:", streamInfo.snackbarMessage);
      if (this.onSnackbarMessageCallback) {
        this.onSnackbarMessageCallback(streamInfo.snackbarMessage);
      }
    }
    if ((_a = streamInfo.redirect) == null ? void 0 : _a.url) {
      let redirectUrl = new URL((_b = streamInfo.redirect) == null ? void 0 : _b.url);
      this.logger.info(TAG2, `Redirecting to ${redirectUrl}`);
      if (isSABR) {
        this.serverAbrStreamingUrl = (_c = streamInfo.redirect) == null ? void 0 : _c.url;
        const formatType = (format == null ? void 0 : format.width) ? "video" : "audio";
        const formatKey = fromFormat(format) || "";
        redirectUrl = new URL(`${SABR_CONSTANTS.PROTOCOL}//${formatType}?${SABR_CONSTANTS.KEY_PARAM}=${formatKey}`);
      }
      if (!((_d = response.data) == null ? void 0 : _d.byteLength)) {
        return await this.makeFollowupRequest(response, redirectUrl.toString(), isSABR, byteRange);
      }
    }
    if (streamInfo.nextRequestPolicy) {
      this.lastPlaybackCookie = (_e = streamInfo.nextRequestPolicy) == null ? void 0 : _e.playbackCookie;
      const delayMs = streamInfo.nextRequestPolicy.backoffTimeMs || 0;
      if (delayMs > 0 && !this.activeDelayPromise) {
        this.logger.info(TAG2, `Delaying next requests by ${delayMs / 1e3} seconds.`);
        this.activeDelayPromise = new Promise((resolve) => {
          setTimeout(() => {
            this.logger.info(TAG2, "Delay completed, resuming requests.");
            this.activeDelayPromise = null;
            resolve();
          }, delayMs);
        });
      }
    }
    if (streamInfo.sabrContextSendingPolicy) {
      for (const startPolicy of streamInfo.sabrContextSendingPolicy.startPolicy) {
        if (!this.activeSabrContextTypes.has(startPolicy)) {
          this.activeSabrContextTypes.add(startPolicy);
          this.logger.debug(TAG2, `Activated SABR context for type ${startPolicy}`);
        }
      }
      for (const stopPolicy of streamInfo.sabrContextSendingPolicy.stopPolicy) {
        if (this.activeSabrContextTypes.has(stopPolicy)) {
          this.activeSabrContextTypes.delete(stopPolicy);
          this.logger.debug(TAG2, `Deactivated SABR context for type ${stopPolicy}`);
        }
      }
      for (const discardPolicy of streamInfo.sabrContextSendingPolicy.discardPolicy) {
        if (this.sabrContexts.has(discardPolicy)) {
          this.sabrContexts.delete(discardPolicy);
          this.logger.debug(TAG2, `Discarded SABR context for type ${discardPolicy}`);
        }
      }
    }
    if (streamInfo.sabrContextUpdate && (streamInfo.sabrContextUpdate.type !== void 0 && ((_f = streamInfo.sabrContextUpdate.value) == null ? void 0 : _f.length))) {
      if (!this.sabrContexts.has(streamInfo.sabrContextUpdate.type) || streamInfo.sabrContextUpdate.writePolicy === SabrContextUpdate_SabrContextWritePolicy.OVERWRITE) {
        this.logger.debug(TAG2, `Received SABR context update (type: ${streamInfo.sabrContextUpdate.type}, writePolicy: ${SabrContextUpdate_SabrContextWritePolicy[streamInfo.sabrContextUpdate.writePolicy]} sendByDefault: ${streamInfo.sabrContextUpdate.sendByDefault})`);
        this.sabrContexts.set(streamInfo.sabrContextUpdate.type, streamInfo.sabrContextUpdate);
      }
      if (streamInfo.sabrContextUpdate.sendByDefault) {
        this.activeSabrContextTypes.add(streamInfo.sabrContextUpdate.type);
      }
      if (!((_g = response.data) == null ? void 0 : _g.byteLength)) {
        return retry();
      }
    }
    if (streamInfo.reloadPlaybackContext && this.onReloadPlayerResponseCallback) {
      this.logger.info(TAG2, "Server requested player reload with new parameters:", streamInfo.reloadPlaybackContext);
      await this.onReloadPlayerResponseCallback(streamInfo.reloadPlaybackContext);
      return retry();
    }
    if (streamInfo.mediaHeader) {
      const formatKey = fromMediaHeader(streamInfo.mediaHeader);
      if (streamInfo.mediaHeader.isInitSeg)
        return;
      const initializedFormat = this.initializedFormats.get(formatKey) || {};
      initializedFormat.lastSegmentMetadata = {
        formatId: streamInfo.mediaHeader.formatId,
        startSequenceNumber: streamInfo.mediaHeader.sequenceNumber || 1,
        endSequenceNumber: streamInfo.mediaHeader.sequenceNumber || 1,
        startTimeMs: streamInfo.mediaHeader.startMs || 0,
        durationMs: streamInfo.mediaHeader.durationMs || 0,
        timescale: ((_h = streamInfo.mediaHeader.timeRange) == null ? void 0 : _h.timescale) || 1e3
      };
      this.initializedFormats.set(formatKey, initializedFormat);
    }
    return response;
  }
  /**
   * Makes a followup request and updates the original response object with the new data.
   * @param originalResponse - The original HTTP response.
   * @param url - The URL to request.
   * @param isSABR - Whether this is a SABR request.
   * @param byteRange - Optional byte range for the request.
   * @returns The updated response.
   */
  async makeFollowupRequest(originalResponse, url, isSABR, byteRange) {
    if (this.activeDelayPromise)
      await this.activeDelayPromise;
    const headers = {};
    if (isSABR && byteRange) {
      headers["Range"] = `bytes=${byteRange.start}-${byteRange.end}`;
    }
    const redirectResponse = await originalResponse.makeRequest(url, headers);
    Object.assign(originalResponse, redirectResponse);
    return originalResponse;
  }
  checkDisposed() {
    if (this.isDisposed) {
      throw new SabrAdapterError("Adapter has been disposed.");
    }
  }
  /**
   * Releases resources and cleans up the adapter instance.
   * After calling dispose, the adapter can no longer be used.
   */
  dispose() {
    var _a;
    if (this.isDisposed)
      return;
    (_a = this.cacheManager) == null ? void 0 : _a.dispose();
    this.cacheManager = null;
    this.initializedFormats.clear();
    this.requestMetadataManager.metadataMap.clear();
    this.sabrContexts.clear();
    this.activeSabrContextTypes.clear();
    this.lastPlaybackCookie = void 0;
    this.sabrFormats = [];
    this.serverAbrStreamingUrl = void 0;
    this.ustreamerConfig = void 0;
    this.activeDelayPromise = null;
    this.playerAdapter.dispose();
    this.requestNumber = 0;
    this.onReloadPlayerResponseCallback = void 0;
    this.onSnackbarMessageCallback = void 0;
    this.onMintPoTokenCallback = void 0;
    this.options = void 0;
    this.isDisposed = true;
    this.logger.debug(TAG2, "Disposed");
  }
};
__name(_SabrStreamingAdapter, "SabrStreamingAdapter");
var SabrStreamingAdapter = _SabrStreamingAdapter;

// dist/src/core/CompositeBuffer.js
var _CompositeBuffer = class _CompositeBuffer {
  constructor(chunks = []) {
    this.chunks = [];
    this.currentChunkOffset = this.currentChunkIndex = 0;
    this.currentDataView = void 0;
    this.totalLength = 0;
    chunks.forEach((chunk) => this.append(chunk));
  }
  append(chunk) {
    if (chunk instanceof Uint8Array) {
      if (this.canMergeWithLastChunk(chunk)) {
        const lastChunk = this.chunks[this.chunks.length - 1];
        this.chunks[this.chunks.length - 1] = new Uint8Array(lastChunk.buffer, lastChunk.byteOffset, lastChunk.length + chunk.length);
        this.resetFocus();
      } else {
        this.chunks.push(chunk);
      }
      this.totalLength += chunk.length;
    } else {
      chunk.chunks.forEach((c) => this.append(c));
    }
  }
  split(position) {
    const extractedBuffer = new _CompositeBuffer();
    const remainingBuffer = new _CompositeBuffer();
    const iterator = this.chunks[Symbol.iterator]();
    let item = iterator.next();
    while (!item.done) {
      const chunk = item.value;
      if (position >= chunk.length) {
        extractedBuffer.append(chunk);
        position -= chunk.length;
      } else if (position > 0) {
        extractedBuffer.append(new Uint8Array(chunk.buffer, chunk.byteOffset, position));
        remainingBuffer.append(new Uint8Array(chunk.buffer, chunk.byteOffset + position, chunk.length - position));
        position = 0;
      } else {
        remainingBuffer.append(chunk);
      }
      item = iterator.next();
    }
    return { extractedBuffer, remainingBuffer };
  }
  getLength() {
    return this.totalLength;
  }
  canReadBytes(position, length) {
    return position + length <= this.totalLength;
  }
  getUint8(position) {
    this.focus(position);
    return this.chunks[this.currentChunkIndex][position - this.currentChunkOffset];
  }
  focus(position) {
    if (!this.isFocused(position)) {
      if (position < this.currentChunkOffset)
        this.resetFocus();
      while (this.currentChunkOffset + this.chunks[this.currentChunkIndex].length <= position && this.currentChunkIndex < this.chunks.length - 1) {
        this.currentChunkOffset += this.chunks[this.currentChunkIndex].length;
        this.currentChunkIndex += 1;
      }
      this.currentDataView = void 0;
    }
  }
  isFocused(position) {
    return position >= this.currentChunkOffset && position < this.currentChunkOffset + this.chunks[this.currentChunkIndex].length;
  }
  resetFocus() {
    this.currentDataView = void 0;
    this.currentChunkIndex = 0;
    this.currentChunkOffset = 0;
  }
  canMergeWithLastChunk(chunk) {
    if (this.chunks.length === 0)
      return false;
    const lastChunk = this.chunks[this.chunks.length - 1];
    return lastChunk.buffer === chunk.buffer && lastChunk.byteOffset + lastChunk.length === chunk.byteOffset;
  }
};
__name(_CompositeBuffer, "CompositeBuffer");
var CompositeBuffer = _CompositeBuffer;

// dist/src/core/UmpReader.js
var _UmpReader = class _UmpReader {
  constructor(compositeBuffer) {
    this.compositeBuffer = compositeBuffer;
  }
  /**
   * Parses parts from the buffer and calls the handler for each complete part.
   * @param handlePart - Function called with each complete part.
   * @returns Partial part if parsing is incomplete, undefined otherwise.
   */
  read(handlePart) {
    while (true) {
      let offset = 0;
      const [partType, newOffset] = this.readVarInt(offset);
      offset = newOffset;
      const [partSize, finalOffset] = this.readVarInt(offset);
      offset = finalOffset;
      if (partType < 0 || partSize < 0)
        break;
      if (!this.compositeBuffer.canReadBytes(offset, partSize)) {
        if (!this.compositeBuffer.canReadBytes(offset, 1))
          break;
        return {
          type: partType,
          size: partSize,
          data: this.compositeBuffer
        };
      }
      const splitResult = this.compositeBuffer.split(offset).remainingBuffer.split(partSize);
      offset = 0;
      handlePart({
        type: partType,
        size: partSize,
        data: splitResult.extractedBuffer
      });
      this.compositeBuffer = splitResult.remainingBuffer;
    }
  }
  /**
   * Reads a variable-length integer from the buffer.
   * @param offset - Position to start reading from.
   * @returns Tuple of [value, new offset] or [-1, offset] if incomplete.
   */
  readVarInt(offset) {
    let byteLength;
    if (this.compositeBuffer.canReadBytes(offset, 1)) {
      const firstByte = this.compositeBuffer.getUint8(offset);
      byteLength = firstByte < 128 ? 1 : firstByte < 192 ? 2 : firstByte < 224 ? 3 : firstByte < 240 ? 4 : 5;
    } else {
      byteLength = 0;
    }
    if (byteLength < 1 || !this.compositeBuffer.canReadBytes(offset, byteLength)) {
      return [-1, offset];
    }
    let value;
    switch (byteLength) {
      case 1:
        value = this.compositeBuffer.getUint8(offset++);
        break;
      case 2: {
        const byte1 = this.compositeBuffer.getUint8(offset++);
        const byte2 = this.compositeBuffer.getUint8(offset++);
        value = (byte1 & 63) + 64 * byte2;
        break;
      }
      case 3: {
        const byte1 = this.compositeBuffer.getUint8(offset++);
        const byte2 = this.compositeBuffer.getUint8(offset++);
        const byte3 = this.compositeBuffer.getUint8(offset++);
        value = (byte1 & 31) + 32 * (byte2 + 256 * byte3);
        break;
      }
      case 4: {
        const byte1 = this.compositeBuffer.getUint8(offset++);
        const byte2 = this.compositeBuffer.getUint8(offset++);
        const byte3 = this.compositeBuffer.getUint8(offset++);
        const byte4 = this.compositeBuffer.getUint8(offset++);
        value = (byte1 & 15) + 16 * (byte2 + 256 * (byte3 + 256 * byte4));
        break;
      }
      default: {
        const tempOffset = offset + 1;
        this.compositeBuffer.focus(tempOffset);
        if (this.canReadFromCurrentChunk(tempOffset, 4)) {
          value = this.getCurrentDataView().getUint32(tempOffset - this.compositeBuffer.currentChunkOffset, true);
        } else {
          const byte3 = this.compositeBuffer.getUint8(tempOffset + 2) + 256 * this.compositeBuffer.getUint8(tempOffset + 3);
          value = this.compositeBuffer.getUint8(tempOffset) + 256 * (this.compositeBuffer.getUint8(tempOffset + 1) + 256 * byte3);
        }
        offset += 5;
        break;
      }
    }
    return [value, offset];
  }
  /**
   * Checks if the specified bytes can be read from the current chunk.
   * @param offset - Position to start reading from.
   * @param length - Number of bytes to read.
   * @returns True if bytes can be read from current chunk, false otherwise.
   */
  canReadFromCurrentChunk(offset, length) {
    return offset - this.compositeBuffer.currentChunkOffset + length <= this.compositeBuffer.chunks[this.compositeBuffer.currentChunkIndex].length;
  }
  /**
   * Gets a DataView of the current chunk, creating it if necessary.
   * @returns DataView for the current chunk.
   */
  getCurrentDataView() {
    if (!this.compositeBuffer.currentDataView) {
      const currentChunk = this.compositeBuffer.chunks[this.compositeBuffer.currentChunkIndex];
      this.compositeBuffer.currentDataView = new DataView(currentChunk.buffer, currentChunk.byteOffset, currentChunk.length);
    }
    return this.compositeBuffer.currentDataView;
  }
};
__name(_UmpReader, "UmpReader");
var UmpReader = _UmpReader;

// dist/src/core/SabrUmpProcessor.js
var _SabrUmpProcessor = class _SabrUmpProcessor {
  constructor(requestMetadata, cacheManager) {
    this.requestMetadata = requestMetadata;
    this.cacheManager = cacheManager;
    this.formatInitMetadata = [];
    this.partialSegments = /* @__PURE__ */ new Map();
    this.umpPartHandlers = /* @__PURE__ */ new Map([
      [UMPPartId.FORMAT_INITIALIZATION_METADATA, this.handleFormatInitMetadata.bind(this)],
      [UMPPartId.NEXT_REQUEST_POLICY, this.handleNextRequestPolicy.bind(this)],
      [UMPPartId.SABR_ERROR, this.handleSabrError.bind(this)],
      [UMPPartId.SABR_REDIRECT, this.handleSabrRedirect.bind(this)],
      [UMPPartId.SABR_CONTEXT_UPDATE, this.handleSabrContextUpdate.bind(this)],
      [UMPPartId.SABR_CONTEXT_SENDING_POLICY, this.handleSabrContextSendingPolicy.bind(this)],
      [UMPPartId.SNACKBAR_MESSAGE, this.handleSnackbarMessage.bind(this)],
      [UMPPartId.STREAM_PROTECTION_STATUS, this.handleStreamProtectionStatus.bind(this)],
      [UMPPartId.RELOAD_PLAYER_RESPONSE, this.handleReloadPlayerResponse.bind(this)],
      [UMPPartId.MEDIA_HEADER, this.handleMediaHeader.bind(this)],
      [UMPPartId.MEDIA, this.handleMedia.bind(this)],
      [UMPPartId.MEDIA_END, this.handleMediaEnd.bind(this)]
    ]);
  }
  /**
   * Processes a chunk of data from a UMP stream and updates the request context.
   * @returns A promise that resolves with a processing result if a terminal part is found (e.g., MediaEnd), or undefined otherwise.
   * @param value
   */
  processChunk(value) {
    return new Promise((resolve) => {
      let chunk;
      if (this.partialPart) {
        chunk = this.partialPart.data;
        chunk.append(value);
      } else {
        chunk = new CompositeBuffer([value]);
      }
      const ump = new UmpReader(chunk);
      this.partialPart = ump.read((part) => {
        const handler = this.umpPartHandlers.get(part.type);
        const result = handler == null ? void 0 : handler(part);
        if (result) {
          this.partialPart = void 0;
          this.desiredHeaderId = void 0;
          this.partialSegments.clear();
          resolve(result);
        }
      });
      resolve(void 0);
    });
  }
  getSegmentInfo() {
    return this.partialSegments.get(this.desiredHeaderId || 0);
  }
  decodePart(part, decoder) {
    if (!part.data.chunks.length)
      return void 0;
    try {
      return decoder.decode(concatenateChunks(part.data.chunks));
    } catch {
      return void 0;
    }
  }
  handleFormatInitMetadata(part) {
    const formatInitMetadata = this.decodePart(part, FormatInitializationMetadata);
    if (formatInitMetadata) {
      this.formatInitMetadata.push(formatInitMetadata);
    }
    return void 0;
  }
  handleNextRequestPolicy(part) {
    const nextRequestPolicy = this.decodePart(part, NextRequestPolicy);
    if (nextRequestPolicy) {
      this.requestMetadata.streamInfo = {
        ...this.requestMetadata.streamInfo,
        nextRequestPolicy
      };
    }
    return void 0;
  }
  handleMediaHeader(part) {
    const mediaHeader = this.decodePart(part, MediaHeader);
    if (!mediaHeader) {
      return void 0;
    }
    const targetFormatKey = fromFormat(this.requestMetadata.format);
    const segmentFormatKey = fromMediaHeader(mediaHeader);
    if (!this.requestMetadata.isSABR || segmentFormatKey === targetFormatKey) {
      const segmentObj = {
        headerId: mediaHeader.headerId,
        mediaHeader,
        bufferedChunks: [],
        lastChunkSize: 0
      };
      if (this.desiredHeaderId === void 0) {
        this.desiredHeaderId = mediaHeader.headerId;
      }
      this.partialSegments.set(mediaHeader.headerId, segmentObj);
    }
    return void 0;
  }
  handleMedia(part) {
    const headerId = part.data.getUint8(0);
    const buffer = part.data.split(1).remainingBuffer;
    const segment = this.partialSegments.get(headerId);
    if (segment) {
      segment.lastChunkSize = buffer.getLength();
      for (const chunk of buffer.chunks) {
        segment.bufferedChunks.push(chunk);
      }
    }
    return void 0;
  }
  handleMediaEnd(part) {
    const headerId = part.data.getUint8(0);
    const segment = this.partialSegments.get(headerId);
    if (segment && segment.headerId === this.desiredHeaderId) {
      const segmentData = concatenateChunks(segment.bufferedChunks);
      this.requestMetadata.streamInfo = {
        ...this.requestMetadata.streamInfo,
        formatInitMetadata: this.formatInitMetadata,
        mediaHeader: segment.mediaHeader
      };
      if (this.cacheManager && this.requestMetadata.isInit && this.requestMetadata.byteRange && this.requestMetadata.format) {
        this.cacheManager.setInitSegment(createSegmentCacheKey(segment.mediaHeader, this.requestMetadata.format), segmentData);
        return {
          data: segmentData.slice(this.requestMetadata.byteRange.start, this.requestMetadata.byteRange.end + 1),
          done: true
        };
      }
      return {
        data: segmentData,
        done: true
      };
    }
  }
  handleSnackbarMessage(part) {
    const snackbarMessage = this.decodePart(part, SnackbarMessage);
    if (snackbarMessage) {
      this.requestMetadata.streamInfo = {
        ...this.requestMetadata.streamInfo,
        snackbarMessage
      };
    }
    return void 0;
  }
  handleSabrError(part) {
    const sabrError = this.decodePart(part, SabrError);
    this.requestMetadata.error = { sabrError };
    return { done: true };
  }
  handleStreamProtectionStatus(part) {
    const streamProtectionStatus = this.decodePart(part, StreamProtectionStatus);
    if (!streamProtectionStatus) {
      return void 0;
    }
    this.requestMetadata.streamInfo = {
      ...this.requestMetadata.streamInfo,
      streamProtectionStatus
    };
    if (streamProtectionStatus.status === 3) {
      return {
        done: true
      };
    }
    return void 0;
  }
  handleReloadPlayerResponse(part) {
    const reloadPlaybackContext = this.decodePart(part, ReloadPlaybackContext);
    if (!reloadPlaybackContext) {
      return void 0;
    }
    this.requestMetadata.streamInfo = {
      ...this.requestMetadata.streamInfo,
      reloadPlaybackContext
    };
    return {
      done: true
    };
  }
  handleSabrRedirect(part) {
    const redirect = this.decodePart(part, SabrRedirect);
    if (!redirect) {
      return void 0;
    }
    this.requestMetadata.streamInfo = {
      ...this.requestMetadata.streamInfo,
      redirect
    };
    if (this.requestMetadata.isUMP && !this.requestMetadata.isSABR) {
      return { done: true };
    }
    return void 0;
  }
  handleSabrContextUpdate(part) {
    const sabrContextUpdate = this.decodePart(part, SabrContextUpdate);
    if (sabrContextUpdate) {
      this.requestMetadata.streamInfo = {
        ...this.requestMetadata.streamInfo,
        sabrContextUpdate
      };
    }
    return void 0;
  }
  handleSabrContextSendingPolicy(part) {
    const sabrContextSendingPolicy = this.decodePart(part, SabrContextSendingPolicy);
    if (sabrContextSendingPolicy) {
      this.requestMetadata.streamInfo = {
        ...this.requestMetadata.streamInfo,
        sabrContextSendingPolicy
      };
    }
    return void 0;
  }
};
__name(_SabrUmpProcessor, "SabrUmpProcessor");
var SabrUmpProcessor = _SabrUmpProcessor;
export {
  SABR_CONSTANTS,
  SabrStreamingAdapter,
  SabrUmpProcessor
};
