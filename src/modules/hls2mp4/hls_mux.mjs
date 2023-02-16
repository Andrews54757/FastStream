
var HlsMux;
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/crypt/aes-crypto.ts":
/*!*********************************!*\
  !*** ./src/crypt/aes-crypto.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AESCrypto)
                    /* harmony export */
                });
                class AESCrypto {
                    constructor(subtle, iv) {
                        this.subtle = subtle;
                        this.aesIV = iv;
                    }
                    decrypt(data, key) {
                        return this.subtle.decrypt({
                            name: 'AES-CBC',
                            iv: this.aesIV
                        }, key, data);
                    }
                }

                /***/
            }),

/***/ "./src/crypt/aes-decryptor.ts":
/*!************************************!*\
  !*** ./src/crypt/aes-decryptor.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ AESDecryptor),
/* harmony export */   "removePadding": () => (/* binding */ removePadding)
                    /* harmony export */
                });
/* harmony import */ var _utils_typed_array__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/typed-array */ "./src/utils/typed-array.ts");


                // PKCS7
                function removePadding(array) {
                    const outputBytes = array.byteLength;
                    const paddingBytes = outputBytes && new DataView(array.buffer).getUint8(outputBytes - 1);
                    if (paddingBytes) {
                        return (0, _utils_typed_array__WEBPACK_IMPORTED_MODULE_0__.sliceUint8)(array, 0, outputBytes - paddingBytes);
                    }
                    return array;
                }
                class AESDecryptor {
                    rcon = [0x0, 0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
                    subMix = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
                    invSubMix = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
                    sBox = new Uint32Array(256);
                    invSBox = new Uint32Array(256);
                    key = new Uint32Array(0);
                    ksRows = 0;
                    keySize = 0;
                    constructor() {
                        this.initTable();
                    }

                    // Using view.getUint32() also swaps the byte order.
                    uint8ArrayToUint32Array_(arrayBuffer) {
                        const view = new DataView(arrayBuffer);
                        const newArray = new Uint32Array(4);
                        for (let i = 0; i < 4; i++) {
                            newArray[i] = view.getUint32(i * 4);
                        }
                        return newArray;
                    }
                    initTable() {
                        const sBox = this.sBox;
                        const invSBox = this.invSBox;
                        const subMix = this.subMix;
                        const subMix0 = subMix[0];
                        const subMix1 = subMix[1];
                        const subMix2 = subMix[2];
                        const subMix3 = subMix[3];
                        const invSubMix = this.invSubMix;
                        const invSubMix0 = invSubMix[0];
                        const invSubMix1 = invSubMix[1];
                        const invSubMix2 = invSubMix[2];
                        const invSubMix3 = invSubMix[3];
                        const d = new Uint32Array(256);
                        let x = 0;
                        let xi = 0;
                        let i = 0;
                        for (i = 0; i < 256; i++) {
                            if (i < 128) {
                                d[i] = i << 1;
                            } else {
                                d[i] = i << 1 ^ 0x11b;
                            }
                        }
                        for (i = 0; i < 256; i++) {
                            let sx = xi ^ xi << 1 ^ xi << 2 ^ xi << 3 ^ xi << 4;
                            sx = sx >>> 8 ^ sx & 0xff ^ 0x63;
                            sBox[x] = sx;
                            invSBox[sx] = x;

                            // Compute multiplication
                            const x2 = d[x];
                            const x4 = d[x2];
                            const x8 = d[x4];

                            // Compute sub/invSub bytes, mix columns tables
                            let t = d[sx] * 0x101 ^ sx * 0x1010100;
                            subMix0[x] = t << 24 | t >>> 8;
                            subMix1[x] = t << 16 | t >>> 16;
                            subMix2[x] = t << 8 | t >>> 24;
                            subMix3[x] = t;

                            // Compute inv sub bytes, inv mix columns tables
                            t = x8 * 0x1010101 ^ x4 * 0x10001 ^ x2 * 0x101 ^ x * 0x1010100;
                            invSubMix0[sx] = t << 24 | t >>> 8;
                            invSubMix1[sx] = t << 16 | t >>> 16;
                            invSubMix2[sx] = t << 8 | t >>> 24;
                            invSubMix3[sx] = t;

                            // Compute next counter
                            if (!x) {
                                x = xi = 1;
                            } else {
                                x = x2 ^ d[d[d[x8 ^ x2]]];
                                xi ^= d[d[xi]];
                            }
                        }
                    }
                    expandKey(keyBuffer) {
                        // convert keyBuffer to Uint32Array
                        const key = this.uint8ArrayToUint32Array_(keyBuffer);
                        let sameKey = true;
                        let offset = 0;
                        while (offset < key.length && sameKey) {
                            sameKey = key[offset] === this.key[offset];
                            offset++;
                        }
                        if (sameKey) {
                            return;
                        }
                        this.key = key;
                        const keySize = this.keySize = key.length;
                        if (keySize !== 4 && keySize !== 6 && keySize !== 8) {
                            throw new Error('Invalid aes key size=' + keySize);
                        }
                        const ksRows = this.ksRows = (keySize + 6 + 1) * 4;
                        let ksRow;
                        let invKsRow;
                        const keySchedule = this.keySchedule = new Uint32Array(ksRows);
                        const invKeySchedule = this.invKeySchedule = new Uint32Array(ksRows);
                        const sbox = this.sBox;
                        const rcon = this.rcon;
                        const invSubMix = this.invSubMix;
                        const invSubMix0 = invSubMix[0];
                        const invSubMix1 = invSubMix[1];
                        const invSubMix2 = invSubMix[2];
                        const invSubMix3 = invSubMix[3];
                        let prev;
                        let t;
                        for (ksRow = 0; ksRow < ksRows; ksRow++) {
                            if (ksRow < keySize) {
                                prev = keySchedule[ksRow] = key[ksRow];
                                continue;
                            }
                            t = prev;
                            if (ksRow % keySize === 0) {
                                // Rot word
                                t = t << 8 | t >>> 24;

                                // Sub word
                                t = sbox[t >>> 24] << 24 | sbox[t >>> 16 & 0xff] << 16 | sbox[t >>> 8 & 0xff] << 8 | sbox[t & 0xff];

                                // Mix Rcon
                                t ^= rcon[ksRow / keySize | 0] << 24;
                            } else if (keySize > 6 && ksRow % keySize === 4) {
                                // Sub word
                                t = sbox[t >>> 24] << 24 | sbox[t >>> 16 & 0xff] << 16 | sbox[t >>> 8 & 0xff] << 8 | sbox[t & 0xff];
                            }
                            keySchedule[ksRow] = prev = (keySchedule[ksRow - keySize] ^ t) >>> 0;
                        }
                        for (invKsRow = 0; invKsRow < ksRows; invKsRow++) {
                            ksRow = ksRows - invKsRow;
                            if (invKsRow & 3) {
                                t = keySchedule[ksRow];
                            } else {
                                t = keySchedule[ksRow - 4];
                            }
                            if (invKsRow < 4 || ksRow <= 4) {
                                invKeySchedule[invKsRow] = t;
                            } else {
                                invKeySchedule[invKsRow] = invSubMix0[sbox[t >>> 24]] ^ invSubMix1[sbox[t >>> 16 & 0xff]] ^ invSubMix2[sbox[t >>> 8 & 0xff]] ^ invSubMix3[sbox[t & 0xff]];
                            }
                            invKeySchedule[invKsRow] = invKeySchedule[invKsRow] >>> 0;
                        }
                    }

                    // Adding this as a method greatly improves performance.
                    networkToHostOrderSwap(word) {
                        return word << 24 | (word & 0xff00) << 8 | (word & 0xff0000) >> 8 | word >>> 24;
                    }
                    decrypt(inputArrayBuffer, offset, aesIV) {
                        const nRounds = this.keySize + 6;
                        const invKeySchedule = this.invKeySchedule;
                        const invSBOX = this.invSBox;
                        const invSubMix = this.invSubMix;
                        const invSubMix0 = invSubMix[0];
                        const invSubMix1 = invSubMix[1];
                        const invSubMix2 = invSubMix[2];
                        const invSubMix3 = invSubMix[3];
                        const initVector = this.uint8ArrayToUint32Array_(aesIV);
                        let initVector0 = initVector[0];
                        let initVector1 = initVector[1];
                        let initVector2 = initVector[2];
                        let initVector3 = initVector[3];
                        const inputInt32 = new Int32Array(inputArrayBuffer);
                        const outputInt32 = new Int32Array(inputInt32.length);
                        let t0, t1, t2, t3;
                        let s0, s1, s2, s3;
                        let inputWords0, inputWords1, inputWords2, inputWords3;
                        let ksRow, i;
                        const swapWord = this.networkToHostOrderSwap;
                        while (offset < inputInt32.length) {
                            inputWords0 = swapWord(inputInt32[offset]);
                            inputWords1 = swapWord(inputInt32[offset + 1]);
                            inputWords2 = swapWord(inputInt32[offset + 2]);
                            inputWords3 = swapWord(inputInt32[offset + 3]);
                            s0 = inputWords0 ^ invKeySchedule[0];
                            s1 = inputWords3 ^ invKeySchedule[1];
                            s2 = inputWords2 ^ invKeySchedule[2];
                            s3 = inputWords1 ^ invKeySchedule[3];
                            ksRow = 4;

                            // Iterate through the rounds of decryption
                            for (i = 1; i < nRounds; i++) {
                                t0 = invSubMix0[s0 >>> 24] ^ invSubMix1[s1 >> 16 & 0xff] ^ invSubMix2[s2 >> 8 & 0xff] ^ invSubMix3[s3 & 0xff] ^ invKeySchedule[ksRow];
                                t1 = invSubMix0[s1 >>> 24] ^ invSubMix1[s2 >> 16 & 0xff] ^ invSubMix2[s3 >> 8 & 0xff] ^ invSubMix3[s0 & 0xff] ^ invKeySchedule[ksRow + 1];
                                t2 = invSubMix0[s2 >>> 24] ^ invSubMix1[s3 >> 16 & 0xff] ^ invSubMix2[s0 >> 8 & 0xff] ^ invSubMix3[s1 & 0xff] ^ invKeySchedule[ksRow + 2];
                                t3 = invSubMix0[s3 >>> 24] ^ invSubMix1[s0 >> 16 & 0xff] ^ invSubMix2[s1 >> 8 & 0xff] ^ invSubMix3[s2 & 0xff] ^ invKeySchedule[ksRow + 3];
                                // Update state
                                s0 = t0;
                                s1 = t1;
                                s2 = t2;
                                s3 = t3;
                                ksRow = ksRow + 4;
                            }

                            // Shift rows, sub bytes, add round key
                            t0 = invSBOX[s0 >>> 24] << 24 ^ invSBOX[s1 >> 16 & 0xff] << 16 ^ invSBOX[s2 >> 8 & 0xff] << 8 ^ invSBOX[s3 & 0xff] ^ invKeySchedule[ksRow];
                            t1 = invSBOX[s1 >>> 24] << 24 ^ invSBOX[s2 >> 16 & 0xff] << 16 ^ invSBOX[s3 >> 8 & 0xff] << 8 ^ invSBOX[s0 & 0xff] ^ invKeySchedule[ksRow + 1];
                            t2 = invSBOX[s2 >>> 24] << 24 ^ invSBOX[s3 >> 16 & 0xff] << 16 ^ invSBOX[s0 >> 8 & 0xff] << 8 ^ invSBOX[s1 & 0xff] ^ invKeySchedule[ksRow + 2];
                            t3 = invSBOX[s3 >>> 24] << 24 ^ invSBOX[s0 >> 16 & 0xff] << 16 ^ invSBOX[s1 >> 8 & 0xff] << 8 ^ invSBOX[s2 & 0xff] ^ invKeySchedule[ksRow + 3];

                            // Write
                            outputInt32[offset] = swapWord(t0 ^ initVector0);
                            outputInt32[offset + 1] = swapWord(t3 ^ initVector1);
                            outputInt32[offset + 2] = swapWord(t2 ^ initVector2);
                            outputInt32[offset + 3] = swapWord(t1 ^ initVector3);

                            // reset initVector to last 4 unsigned int
                            initVector0 = inputWords0;
                            initVector1 = inputWords1;
                            initVector2 = inputWords2;
                            initVector3 = inputWords3;
                            offset = offset + 4;
                        }
                        return outputInt32.buffer;
                    }
                }

                /***/
            }),

/***/ "./src/crypt/decrypter.ts":
/*!********************************!*\
  !*** ./src/crypt/decrypter.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ Decrypter)
                    /* harmony export */
                });
/* harmony import */ var _aes_crypto__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./aes-crypto */ "./src/crypt/aes-crypto.ts");
/* harmony import */ var _fast_aes_key__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./fast-aes-key */ "./src/crypt/fast-aes-key.ts");
/* harmony import */ var _aes_decryptor__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./aes-decryptor */ "./src/crypt/aes-decryptor.ts");
/* harmony import */ var _utils_logger__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.ts");
/* harmony import */ var _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/mp4-tools */ "./src/utils/mp4-tools.ts");
/* harmony import */ var _utils_typed_array__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils/typed-array */ "./src/utils/typed-array.ts");






                const CHUNK_SIZE = 16; // 16 bytes, 128 bits

                class Decrypter {
                    logEnabled = true;
                    subtle = null;
                    softwareDecrypter = null;
                    key = null;
                    fastAesKey = null;
                    remainderData = null;
                    currentIV = null;
                    currentResult = null;
                    constructor(config, {
                        removePKCS7Padding = true
                    } = {}) {
                        this.useSoftware = config.enableSoftwareAES;
                        this.removePKCS7Padding = removePKCS7Padding;
                        // built in decryptor expects PKCS7 padding
                        if (removePKCS7Padding) {
                            try {
                                const browserCrypto = self.crypto;
                                if (browserCrypto) {
                                    this.subtle = browserCrypto.subtle || browserCrypto.webkitSubtle;
                                }
                            } catch (e) {
                                /* no-op */
                            }
                        }
                        if (this.subtle === null) {
                            this.useSoftware = true;
                        }
                    }
                    destroy() {
                        this.subtle = null;
                        this.softwareDecrypter = null;
                        this.key = null;
                        this.fastAesKey = null;
                        this.remainderData = null;
                        this.currentIV = null;
                        this.currentResult = null;
                    }
                    isSync() {
                        return this.useSoftware;
                    }
                    flush() {
                        const {
                            currentResult,
                            remainderData
                        } = this;
                        if (!currentResult || remainderData) {
                            _utils_logger__WEBPACK_IMPORTED_MODULE_3__.logger.error(`[softwareDecrypt] ${remainderData ? 'overflow bytes: ' + remainderData.byteLength : 'no result'}`);
                            this.reset();
                            return null;
                        }
                        const data = new Uint8Array(currentResult);
                        this.reset();
                        if (this.removePKCS7Padding) {
                            return (0, _aes_decryptor__WEBPACK_IMPORTED_MODULE_2__.removePadding)(data);
                        }
                        return data;
                    }
                    reset() {
                        this.currentResult = null;
                        this.currentIV = null;
                        this.remainderData = null;
                        if (this.softwareDecrypter) {
                            this.softwareDecrypter = null;
                        }
                    }
                    decrypt(data, key, iv) {
                        if (this.useSoftware) {
                            return new Promise((resolve, reject) => {
                                this.softwareDecrypt(new Uint8Array(data), key, iv);
                                const decryptResult = this.flush();
                                if (decryptResult) {
                                    resolve(decryptResult.buffer);
                                } else {
                                    reject(new Error('[softwareDecrypt] Failed to decrypt data'));
                                }
                            });
                        }
                        return this.webCryptoDecrypt(new Uint8Array(data), key, iv);
                    }

                    // Software decryption is progressive. Progressive decryption may not return a result on each call. Any cached
                    // data is handled in the flush() call
                    softwareDecrypt(data, key, iv) {
                        const {
                            currentIV,
                            currentResult,
                            remainderData
                        } = this;
                        this.logOnce('JS AES decrypt');
                        // The output is staggered during progressive parsing - the current result is cached, and emitted on the next call
                        // This is done in order to strip PKCS7 padding, which is found at the end of each segment. We only know we've reached
                        // the end on flush(), but by that time we have already received all bytes for the segment.
                        // Progressive decryption does not work with WebCrypto

                        if (remainderData) {
                            data = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_4__.appendUint8Array)(remainderData, data);
                            this.remainderData = null;
                        }

                        // Byte length must be a multiple of 16 (AES-128 = 128 bit blocks = 16 bytes)
                        const currentChunk = this.getValidChunk(data);
                        if (!currentChunk.length) {
                            return null;
                        }
                        if (currentIV) {
                            iv = currentIV;
                        }
                        let softwareDecrypter = this.softwareDecrypter;
                        if (!softwareDecrypter) {
                            softwareDecrypter = this.softwareDecrypter = new _aes_decryptor__WEBPACK_IMPORTED_MODULE_2__["default"]();
                        }
                        softwareDecrypter.expandKey(key);
                        const result = currentResult;
                        this.currentResult = softwareDecrypter.decrypt(currentChunk.buffer, 0, iv);
                        this.currentIV = (0, _utils_typed_array__WEBPACK_IMPORTED_MODULE_5__.sliceUint8)(currentChunk, -16).buffer;
                        if (!result) {
                            return null;
                        }
                        return result;
                    }
                    webCryptoDecrypt(data, key, iv) {
                        const subtle = this.subtle;
                        if (this.key !== key || !this.fastAesKey) {
                            this.key = key;
                            this.fastAesKey = new _fast_aes_key__WEBPACK_IMPORTED_MODULE_1__["default"](subtle, key);
                        }
                        return this.fastAesKey.expandKey().then(aesKey => {
                            // decrypt using web crypto
                            if (!subtle) {
                                return Promise.reject(new Error('web crypto not initialized'));
                            }
                            this.logOnce('WebCrypto AES decrypt');
                            const crypto = new _aes_crypto__WEBPACK_IMPORTED_MODULE_0__["default"](subtle, new Uint8Array(iv));
                            return crypto.decrypt(data.buffer, aesKey);
                        }).catch(err => {
                            _utils_logger__WEBPACK_IMPORTED_MODULE_3__.logger.warn(`[decrypter]: WebCrypto Error, disable WebCrypto API, ${err.name}: ${err.message}`);
                            return this.onWebCryptoError(data, key, iv);
                        });
                    }
                    onWebCryptoError(data, key, iv) {
                        this.useSoftware = true;
                        this.logEnabled = true;
                        this.softwareDecrypt(data, key, iv);
                        const decryptResult = this.flush();
                        if (decryptResult) {
                            return decryptResult.buffer;
                        }
                        throw new Error('WebCrypto and softwareDecrypt: failed to decrypt data');
                    }
                    getValidChunk(data) {
                        let currentChunk = data;
                        const splitPoint = data.length - data.length % CHUNK_SIZE;
                        if (splitPoint !== data.length) {
                            currentChunk = (0, _utils_typed_array__WEBPACK_IMPORTED_MODULE_5__.sliceUint8)(data, 0, splitPoint);
                            this.remainderData = (0, _utils_typed_array__WEBPACK_IMPORTED_MODULE_5__.sliceUint8)(data, splitPoint);
                        }
                        return currentChunk;
                    }
                    logOnce(msg) {
                        if (!this.logEnabled) {
                            return;
                        }
                        _utils_logger__WEBPACK_IMPORTED_MODULE_3__.logger.log(`[decrypter]: ${msg}`);
                        this.logEnabled = false;
                    }
                }

                /***/
            }),

/***/ "./src/crypt/fast-aes-key.ts":
/*!***********************************!*\
  !*** ./src/crypt/fast-aes-key.ts ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ FastAESKey)
                    /* harmony export */
                });
                class FastAESKey {
                    constructor(subtle, key) {
                        this.subtle = subtle;
                        this.key = key;
                    }
                    expandKey() {
                        return this.subtle.importKey('raw', this.key, {
                            name: 'AES-CBC'
                        }, false, ['encrypt', 'decrypt']);
                    }
                }

                /***/
            }),

/***/ "./src/demux/aacdemuxer.ts":
/*!*********************************!*\
  !*** ./src/demux/aacdemuxer.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
                    /* harmony export */
                });
/* harmony import */ var _base_audio_demuxer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./base-audio-demuxer */ "./src/demux/base-audio-demuxer.ts");
/* harmony import */ var _adts__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./adts */ "./src/demux/adts.ts");
/* harmony import */ var _utils_logger__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.ts");
/* harmony import */ var _demux_id3__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../demux/id3 */ "./src/demux/id3.ts");
                /**
                 * AAC demuxer
                 */




                class AACDemuxer extends _base_audio_demuxer__WEBPACK_IMPORTED_MODULE_0__["default"] {
                    constructor(observer, config) {
                        super();
                        this.observer = observer;
                        this.config = config;
                    }
                    resetInitSegment(initSegment, audioCodec, videoCodec, trackDuration) {
                        super.resetInitSegment(initSegment, audioCodec, videoCodec, trackDuration);
                        this._audioTrack = {
                            container: 'audio/adts',
                            type: 'audio',
                            id: 2,
                            pid: -1,
                            sequenceNumber: 0,
                            segmentCodec: 'aac',
                            samples: [],
                            manifestCodec: audioCodec,
                            duration: trackDuration,
                            inputTimeScale: 90000,
                            dropped: 0
                        };
                    }

                    // Source for probe info - https://wiki.multimedia.cx/index.php?title=ADTS
                    static probe(data) {
                        if (!data) {
                            return false;
                        }

                        // Check for the ADTS sync word
                        // Look for ADTS header | 1111 1111 | 1111 X00X | where X can be either 0 or 1
                        // Layer bits (position 14 and 15) in header should be always 0 for ADTS
                        // More info https://wiki.multimedia.cx/index.php?title=ADTS
                        const id3Data = _demux_id3__WEBPACK_IMPORTED_MODULE_3__.getID3Data(data, 0) || [];
                        let offset = id3Data.length;
                        for (let length = data.length; offset < length; offset++) {
                            if (_adts__WEBPACK_IMPORTED_MODULE_1__.probe(data, offset)) {
                                _utils_logger__WEBPACK_IMPORTED_MODULE_2__.logger.log('ADTS sync word found !');
                                return true;
                            }
                        }
                        return false;
                    }
                    canParse(data, offset) {
                        return _adts__WEBPACK_IMPORTED_MODULE_1__.canParse(data, offset);
                    }
                    appendFrame(track, data, offset) {
                        _adts__WEBPACK_IMPORTED_MODULE_1__.initTrackConfig(track, this.observer, data, offset, track.manifestCodec);
                        const frame = _adts__WEBPACK_IMPORTED_MODULE_1__.appendFrame(track, data, offset, this.basePTS, this.frameIndex);
                        if (frame && frame.missing === 0) {
                            return frame;
                        }
                    }
                }
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AACDemuxer);

                /***/
            }),

/***/ "./src/demux/adts.ts":
/*!***************************!*\
  !*** ./src/demux/adts.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "appendFrame": () => (/* binding */ appendFrame),
/* harmony export */   "canGetFrameLength": () => (/* binding */ canGetFrameLength),
/* harmony export */   "canParse": () => (/* binding */ canParse),
/* harmony export */   "getAudioConfig": () => (/* binding */ getAudioConfig),
/* harmony export */   "getFrameDuration": () => (/* binding */ getFrameDuration),
/* harmony export */   "getFullFrameLength": () => (/* binding */ getFullFrameLength),
/* harmony export */   "getHeaderLength": () => (/* binding */ getHeaderLength),
/* harmony export */   "initTrackConfig": () => (/* binding */ initTrackConfig),
/* harmony export */   "isHeader": () => (/* binding */ isHeader),
/* harmony export */   "isHeaderPattern": () => (/* binding */ isHeaderPattern),
/* harmony export */   "parseFrameHeader": () => (/* binding */ parseFrameHeader),
/* harmony export */   "probe": () => (/* binding */ probe)
                    /* harmony export */
                });
/* harmony import */ var _utils_logger__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.ts");
/* harmony import */ var _errors__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../errors */ "./src/errors.ts");
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../events */ "./src/events.ts");
                /**
                 * ADTS parser helper
                 * @link https://wiki.multimedia.cx/index.php?title=ADTS
                 */



                function getAudioConfig(observer, data, offset, audioCodec) {
                    let adtsObjectType;
                    let adtsExtensionSamplingIndex;
                    let adtsChannelConfig;
                    let config;
                    const userAgent = navigator.userAgent.toLowerCase();
                    const manifestCodec = audioCodec;
                    const adtsSamplingRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
                    // byte 2
                    adtsObjectType = ((data[offset + 2] & 0xc0) >>> 6) + 1;
                    const adtsSamplingIndex = (data[offset + 2] & 0x3c) >>> 2;
                    if (adtsSamplingIndex > adtsSamplingRates.length - 1) {
                        observer.trigger(_events__WEBPACK_IMPORTED_MODULE_2__.Events.ERROR, {
                            type: _errors__WEBPACK_IMPORTED_MODULE_1__.ErrorTypes.MEDIA_ERROR,
                            details: _errors__WEBPACK_IMPORTED_MODULE_1__.ErrorDetails.FRAG_PARSING_ERROR,
                            fatal: true,
                            reason: `invalid ADTS sampling index:${adtsSamplingIndex}`
                        });
                        return;
                    }
                    adtsChannelConfig = (data[offset + 2] & 0x01) << 2;
                    // byte 3
                    adtsChannelConfig |= (data[offset + 3] & 0xc0) >>> 6;
                    _utils_logger__WEBPACK_IMPORTED_MODULE_0__.logger.log(`manifest codec:${audioCodec}, ADTS type:${adtsObjectType}, samplingIndex:${adtsSamplingIndex}`);

                    // firefox: freq less than 24kHz = AAC SBR (HE-AAC)
                    // if (/firefox/i.test(userAgent)) {
                    //     if (adtsSamplingIndex >= 6) {
                    //         adtsObjectType = 5;
                    //         config = new Array(4);
                    //         // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
                    //         // there is a factor 2 between frame sample rate and output sample rate
                    //         // multiply frequency by 2 (see table below, equivalent to substract 3)
                    //         adtsExtensionSamplingIndex = adtsSamplingIndex - 3;
                    //     } else {
                    //         adtsObjectType = 2;
                    //         config = new Array(2);
                    //         adtsExtensionSamplingIndex = adtsSamplingIndex;
                    //     }
                    //     // Android : always use AAC
                    // } else if (userAgent.indexOf('android') !== -1) {
                    adtsObjectType = 2;
                    config = new Array(2);
                    adtsExtensionSamplingIndex = adtsSamplingIndex;
                    // } else {
                    //     /*  for other browsers (Chrome/Vivaldi/Opera ...)
                    //         always force audio type to be HE-AAC SBR, as some browsers do not support audio codec switch properly (like Chrome ...)
                    //     */
                    //     adtsObjectType = 5;
                    //     config = new Array(4);
                    //     // if (manifest codec is HE-AAC or HE-AACv2) OR (manifest codec not specified AND frequency less than 24kHz)
                    //     if (audioCodec && (audioCodec.indexOf('mp4a.40.29') !== -1 || audioCodec.indexOf('mp4a.40.5') !== -1) || !audioCodec && adtsSamplingIndex >= 6) {
                    //         // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
                    //         // there is a factor 2 between frame sample rate and output sample rate
                    //         // multiply frequency by 2 (see table below, equivalent to substract 3)
                    //         adtsExtensionSamplingIndex = adtsSamplingIndex - 3;
                    //     } else {
                    //         // if (manifest codec is AAC) AND (frequency less than 24kHz AND nb channel is 1) OR (manifest codec not specified and mono audio)
                    //         // Chrome fails to play back with low frequency AAC LC mono when initialized with HE-AAC.  This is not a problem with stereo.
                    //         if (audioCodec && audioCodec.indexOf('mp4a.40.2') !== -1 && (adtsSamplingIndex >= 6 && adtsChannelConfig === 1 || /vivaldi/i.test(userAgent)) || !audioCodec && adtsChannelConfig === 1) {
                    //             adtsObjectType = 2;
                    //             config = new Array(2);
                    //         }
                    //         adtsExtensionSamplingIndex = adtsSamplingIndex;
                    //     }
                    // }
                    /* refer to http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config
                        ISO 14496-3 (AAC).pdf - Table 1.13 — Syntax of AudioSpecificConfig()
                      Audio Profile / Audio Object Type
                      0: Null
                      1: AAC Main
                      2: AAC LC (Low Complexity)
                      3: AAC SSR (Scalable Sample Rate)
                      4: AAC LTP (Long Term Prediction)
                      5: SBR (Spectral Band Replication)
                      6: AAC Scalable
                     sampling freq
                      0: 96000 Hz
                      1: 88200 Hz
                      2: 64000 Hz
                      3: 48000 Hz
                      4: 44100 Hz
                      5: 32000 Hz
                      6: 24000 Hz
                      7: 22050 Hz
                      8: 16000 Hz
                      9: 12000 Hz
                      10: 11025 Hz
                      11: 8000 Hz
                      12: 7350 Hz
                      13: Reserved
                      14: Reserved
                      15: frequency is written explictly
                      Channel Configurations
                      These are the channel configurations:
                      0: Defined in AOT Specifc Config
                      1: 1 channel: front-center
                      2: 2 channels: front-left, front-right
                    */
                    // audioObjectType = profile => profile, the MPEG-4 Audio Object Type minus 1
                    config[0] = adtsObjectType << 3;
                    // samplingFrequencyIndex
                    config[0] |= (adtsSamplingIndex & 0x0e) >> 1;
                    config[1] |= (adtsSamplingIndex & 0x01) << 7;
                    // channelConfiguration
                    config[1] |= adtsChannelConfig << 3;
                    if (adtsObjectType === 5) {
                        // adtsExtensionSamplingIndex
                        config[1] |= (adtsExtensionSamplingIndex & 0x0e) >> 1;
                        config[2] = (adtsExtensionSamplingIndex & 0x01) << 7;
                        // adtsObjectType (force to 2, chrome is checking that object type is less than 5 ???
                        //    https://chromium.googlesource.com/chromium/src.git/+/master/media/formats/mp4/aac.cc
                        config[2] |= 2 << 2;
                        config[3] = 0;
                    }
                    return {
                        config,
                        samplerate: adtsSamplingRates[adtsSamplingIndex],
                        channelCount: adtsChannelConfig,
                        codec: 'mp4a.40.' + adtsObjectType,
                        manifestCodec
                    };
                }
                function isHeaderPattern(data, offset) {
                    return data[offset] === 0xff && (data[offset + 1] & 0xf6) === 0xf0;
                }
                function getHeaderLength(data, offset) {
                    return data[offset + 1] & 0x01 ? 7 : 9;
                }
                function getFullFrameLength(data, offset) {
                    return (data[offset + 3] & 0x03) << 11 | data[offset + 4] << 3 | (data[offset + 5] & 0xe0) >>> 5;
                }
                function canGetFrameLength(data, offset) {
                    return offset + 5 < data.length;
                }
                function isHeader(data, offset) {
                    // Look for ADTS header | 1111 1111 | 1111 X00X | where X can be either 0 or 1
                    // Layer bits (position 14 and 15) in header should be always 0 for ADTS
                    // More info https://wiki.multimedia.cx/index.php?title=ADTS
                    return offset + 1 < data.length && isHeaderPattern(data, offset);
                }
                function canParse(data, offset) {
                    return canGetFrameLength(data, offset) && isHeaderPattern(data, offset) && getFullFrameLength(data, offset) <= data.length - offset;
                }
                function probe(data, offset) {
                    // same as isHeader but we also check that ADTS frame follows last ADTS frame
                    // or end of data is reached
                    if (isHeader(data, offset)) {
                        // ADTS header Length
                        const headerLength = getHeaderLength(data, offset);
                        if (offset + headerLength >= data.length) {
                            return false;
                        }
                        // ADTS frame Length
                        const frameLength = getFullFrameLength(data, offset);
                        if (frameLength <= headerLength) {
                            return false;
                        }
                        const newOffset = offset + frameLength;
                        return newOffset === data.length || isHeader(data, newOffset);
                    }
                    return false;
                }
                function initTrackConfig(track, observer, data, offset, audioCodec) {
                    if (!track.samplerate) {
                        const config = getAudioConfig(observer, data, offset, audioCodec);
                        if (!config) {
                            return;
                        }
                        track.config = config.config;
                        track.samplerate = config.samplerate;
                        track.channelCount = config.channelCount;
                        track.codec = config.codec;
                        track.manifestCodec = config.manifestCodec;
                        _utils_logger__WEBPACK_IMPORTED_MODULE_0__.logger.log(`parsed codec:${track.codec}, rate:${config.samplerate}, channels:${config.channelCount}`);
                    }
                }
                function getFrameDuration(samplerate) {
                    return 1024 * 90000 / samplerate;
                }
                function parseFrameHeader(data, offset) {
                    // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
                    const headerLength = getHeaderLength(data, offset);
                    if (offset + headerLength <= data.length) {
                        // retrieve frame size
                        const frameLength = getFullFrameLength(data, offset) - headerLength;
                        if (frameLength > 0) {
                            // logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}`);
                            return {
                                headerLength,
                                frameLength
                            };
                        }
                    }
                }
                function appendFrame(track, data, offset, pts, frameIndex) {
                    const frameDuration = getFrameDuration(track.samplerate);
                    const stamp = pts + frameIndex * frameDuration;
                    const header = parseFrameHeader(data, offset);
                    let unit;
                    if (header) {
                        const {
                            frameLength,
                            headerLength
                        } = header;
                        const length = headerLength + frameLength;
                        const missing = Math.max(0, offset + length - data.length);
                        // logger.log(`AAC frame ${frameIndex}, pts:${stamp} length@offset/total: ${frameLength}@${offset+headerLength}/${data.byteLength} missing: ${missing}`);
                        if (missing) {
                            unit = new Uint8Array(length - headerLength);
                            unit.set(data.subarray(offset + headerLength, data.length), 0);
                        } else {
                            unit = data.subarray(offset + headerLength, offset + length);
                        }
                        const sample = {
                            unit,
                            pts: stamp
                        };
                        if (!missing) {
                            track.samples.push(sample);
                        }
                        return {
                            sample,
                            length,
                            missing
                        };
                    }
                    // overflow incomplete header
                    const length = data.length - offset;
                    unit = new Uint8Array(length);
                    unit.set(data.subarray(offset, data.length), 0);
                    const sample = {
                        unit,
                        pts: stamp
                    };
                    return {
                        sample,
                        length,
                        missing: -1
                    };
                }

                /***/
            }),

/***/ "./src/demux/base-audio-demuxer.ts":
/*!*****************************************!*\
  !*** ./src/demux/base-audio-demuxer.ts ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "initPTSFn": () => (/* binding */ initPTSFn)
                    /* harmony export */
                });
/* harmony import */ var _demux_id3__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../demux/id3 */ "./src/demux/id3.ts");
/* harmony import */ var _types_demuxer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../types/demuxer */ "./src/types/demuxer.ts");
/* harmony import */ var _dummy_demuxed_track__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./dummy-demuxed-track */ "./src/demux/dummy-demuxed-track.ts");
/* harmony import */ var _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/mp4-tools */ "./src/utils/mp4-tools.ts");
/* harmony import */ var _utils_typed_array__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/typed-array */ "./src/utils/typed-array.ts");





                class BaseAudioDemuxer {
                    frameIndex = 0;
                    cachedData = null;
                    basePTS = null;
                    initPTS = null;
                    lastPTS = null;
                    resetInitSegment(initSegment, audioCodec, videoCodec, trackDuration) {
                        this._id3Track = {
                            type: 'id3',
                            id: 3,
                            pid: -1,
                            inputTimeScale: 90000,
                            sequenceNumber: 0,
                            samples: [],
                            dropped: 0
                        };
                    }
                    resetTimeStamp(deaultTimestamp) {
                        this.initPTS = deaultTimestamp;
                        this.resetContiguity();
                    }
                    resetContiguity() {
                        this.basePTS = null;
                        this.lastPTS = null;
                        this.frameIndex = 0;
                    }
                    canParse(data, offset) {
                        return false;
                    }
                    appendFrame(track, data, offset) { }

                    // feed incoming data to the front of the parsing pipeline
                    demux(data, timeOffset) {
                        if (this.cachedData) {
                            data = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_3__.appendUint8Array)(this.cachedData, data);
                            this.cachedData = null;
                        }
                        let id3Data = _demux_id3__WEBPACK_IMPORTED_MODULE_0__.getID3Data(data, 0);
                        let offset = id3Data ? id3Data.length : 0;
                        let lastDataIndex;
                        const track = this._audioTrack;
                        const id3Track = this._id3Track;
                        const timestamp = id3Data ? _demux_id3__WEBPACK_IMPORTED_MODULE_0__.getTimeStamp(id3Data) : undefined;
                        const length = data.length;
                        if (this.basePTS === null || this.frameIndex === 0 && Number.isFinite(timestamp)) {
                            this.basePTS = initPTSFn(timestamp, timeOffset, this.initPTS);
                            this.lastPTS = this.basePTS;
                        }
                        if (this.lastPTS === null) {
                            this.lastPTS = this.basePTS;
                        }

                        // more expressive than alternative: id3Data?.length
                        if (id3Data && id3Data.length > 0) {
                            id3Track.samples.push({
                                pts: this.lastPTS,
                                dts: this.lastPTS,
                                data: id3Data,
                                type: _types_demuxer__WEBPACK_IMPORTED_MODULE_1__.MetadataSchema.audioId3,
                                duration: Number.POSITIVE_INFINITY
                            });
                        }
                        while (offset < length) {
                            if (this.canParse(data, offset)) {
                                const frame = this.appendFrame(track, data, offset);
                                if (frame) {
                                    this.frameIndex++;
                                    this.lastPTS = frame.sample.pts;
                                    offset += frame.length;
                                    lastDataIndex = offset;
                                } else {
                                    offset = length;
                                }
                            } else if (_demux_id3__WEBPACK_IMPORTED_MODULE_0__.canParse(data, offset)) {
                                // after a ID3.canParse, a call to ID3.getID3Data *should* always returns some data
                                id3Data = _demux_id3__WEBPACK_IMPORTED_MODULE_0__.getID3Data(data, offset);
                                id3Track.samples.push({
                                    pts: this.lastPTS,
                                    dts: this.lastPTS,
                                    data: id3Data,
                                    type: _types_demuxer__WEBPACK_IMPORTED_MODULE_1__.MetadataSchema.audioId3,
                                    duration: Number.POSITIVE_INFINITY
                                });
                                offset += id3Data.length;
                                lastDataIndex = offset;
                            } else {
                                offset++;
                            }
                            if (offset === length && lastDataIndex !== length) {
                                const partialData = (0, _utils_typed_array__WEBPACK_IMPORTED_MODULE_4__.sliceUint8)(data, lastDataIndex);
                                if (this.cachedData) {
                                    this.cachedData = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_3__.appendUint8Array)(this.cachedData, partialData);
                                } else {
                                    this.cachedData = partialData;
                                }
                            }
                        }
                        return {
                            audioTrack: track,
                            videoTrack: (0, _dummy_demuxed_track__WEBPACK_IMPORTED_MODULE_2__.dummyTrack)(),
                            id3Track,
                            textTrack: (0, _dummy_demuxed_track__WEBPACK_IMPORTED_MODULE_2__.dummyTrack)()
                        };
                    }
                    demuxSampleAes(data, keyData, timeOffset) {
                        return Promise.reject(new Error(`[${this}] This demuxer does not support Sample-AES decryption`));
                    }
                    flush(timeOffset) {
                        // Parse cache in case of remaining frames.
                        const cachedData = this.cachedData;
                        if (cachedData) {
                            this.cachedData = null;
                            this.demux(cachedData, 0);
                        }
                        return {
                            audioTrack: this._audioTrack,
                            videoTrack: (0, _dummy_demuxed_track__WEBPACK_IMPORTED_MODULE_2__.dummyTrack)(),
                            id3Track: this._id3Track,
                            textTrack: (0, _dummy_demuxed_track__WEBPACK_IMPORTED_MODULE_2__.dummyTrack)()
                        };
                    }
                    destroy() { }
                }

                /**
                 * Initialize PTS
                 * <p>
                 *    use timestamp unless it is undefined, NaN or Infinity
                 * </p>
                 */
                const initPTSFn = (timestamp, timeOffset, initPTS) => {
                    if (Number.isFinite(timestamp)) {
                        return timestamp * 90;
                    }
                    return timeOffset * 90000 + (initPTS || 0);
                };
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (BaseAudioDemuxer);

                /***/
            }),

/***/ "./src/demux/dummy-demuxed-track.ts":
/*!******************************************!*\
  !*** ./src/demux/dummy-demuxed-track.ts ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "dummyTrack": () => (/* binding */ dummyTrack)
                    /* harmony export */
                });
                function dummyTrack(type = '', inputTimeScale = 90000) {
                    return {
                        type,
                        id: -1,
                        pid: -1,
                        inputTimeScale,
                        sequenceNumber: -1,
                        samples: [],
                        dropped: 0
                    };
                }

                /***/
            }),

/***/ "./src/demux/exp-golomb.ts":
/*!*********************************!*\
  !*** ./src/demux/exp-golomb.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
                    /* harmony export */
                });
/* harmony import */ var _utils_logger__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.ts");
                /**
                 * Parser for exponential Golomb codes, a variable-bitwidth number encoding scheme used by h264.
                 */


                class ExpGolomb {
                    constructor(data) {
                        this.data = data;
                        // the number of bytes left to examine in this.data
                        this.bytesAvailable = data.byteLength;
                        // the current word being examined
                        this.word = 0; // :uint
                        // the number of bits left to examine in the current word
                        this.bitsAvailable = 0; // :uint
                    }

                    // ():void
                    loadWord() {
                        const data = this.data;
                        const bytesAvailable = this.bytesAvailable;
                        const position = data.byteLength - bytesAvailable;
                        const workingBytes = new Uint8Array(4);
                        const availableBytes = Math.min(4, bytesAvailable);
                        if (availableBytes === 0) {
                            throw new Error('no bytes available');
                        }
                        workingBytes.set(data.subarray(position, position + availableBytes));
                        this.word = new DataView(workingBytes.buffer).getUint32(0);
                        // track the amount of this.data that has been processed
                        this.bitsAvailable = availableBytes * 8;
                        this.bytesAvailable -= availableBytes;
                    }

                    // (count:int):void
                    skipBits(count) {
                        let skipBytes; // :int
                        count = Math.min(count, this.bytesAvailable * 8 + this.bitsAvailable);
                        if (this.bitsAvailable > count) {
                            this.word <<= count;
                            this.bitsAvailable -= count;
                        } else {
                            count -= this.bitsAvailable;
                            skipBytes = count >> 3;
                            count -= skipBytes << 3;
                            this.bytesAvailable -= skipBytes;
                            this.loadWord();
                            this.word <<= count;
                            this.bitsAvailable -= count;
                        }
                    }

                    // (size:int):uint
                    readBits(size) {
                        let bits = Math.min(this.bitsAvailable, size); // :uint
                        const valu = this.word >>> 32 - bits; // :uint
                        if (size > 32) {
                            _utils_logger__WEBPACK_IMPORTED_MODULE_0__.logger.error('Cannot read more than 32 bits at a time');
                        }
                        this.bitsAvailable -= bits;
                        if (this.bitsAvailable > 0) {
                            this.word <<= bits;
                        } else if (this.bytesAvailable > 0) {
                            this.loadWord();
                        } else {
                            throw new Error('no bits available');
                        }
                        bits = size - bits;
                        if (bits > 0 && this.bitsAvailable) {
                            return valu << bits | this.readBits(bits);
                        } else {
                            return valu;
                        }
                    }

                    // ():uint
                    skipLZ() {
                        let leadingZeroCount; // :uint
                        for (leadingZeroCount = 0; leadingZeroCount < this.bitsAvailable; ++leadingZeroCount) {
                            if ((this.word & 0x80000000 >>> leadingZeroCount) !== 0) {
                                // the first bit of working word is 1
                                this.word <<= leadingZeroCount;
                                this.bitsAvailable -= leadingZeroCount;
                                return leadingZeroCount;
                            }
                        }
                        // we exhausted word and still have not found a 1
                        this.loadWord();
                        return leadingZeroCount + this.skipLZ();
                    }

                    // ():void
                    skipUEG() {
                        this.skipBits(1 + this.skipLZ());
                    }

                    // ():void
                    skipEG() {
                        this.skipBits(1 + this.skipLZ());
                    }

                    // ():uint
                    readUEG() {
                        const clz = this.skipLZ(); // :uint
                        return this.readBits(clz + 1) - 1;
                    }

                    // ():int
                    readEG() {
                        const valu = this.readUEG(); // :int
                        if (0x01 & valu) {
                            // the number is odd if the low order bit is set
                            return 1 + valu >>> 1; // add 1 to make it even, and divide by 2
                        } else {
                            return -1 * (valu >>> 1); // divide by two then make it negative
                        }
                    }

                    // Some convenience functions
                    // :Boolean
                    readBoolean() {
                        return this.readBits(1) === 1;
                    }

                    // ():int
                    readUByte() {
                        return this.readBits(8);
                    }

                    // ():int
                    readUShort() {
                        return this.readBits(16);
                    }

                    // ():int
                    readUInt() {
                        return this.readBits(32);
                    }

                    /**
                     * Advance the ExpGolomb decoder past a scaling list. The scaling
                     * list is optionally transmitted as part of a sequence parameter
                     * set and is not relevant to transmuxing.
                     * @param count the number of entries in this scaling list
                     * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
                     */
                    skipScalingList(count) {
                        let lastScale = 8;
                        let nextScale = 8;
                        let deltaScale;
                        for (let j = 0; j < count; j++) {
                            if (nextScale !== 0) {
                                deltaScale = this.readEG();
                                nextScale = (lastScale + deltaScale + 256) % 256;
                            }
                            lastScale = nextScale === 0 ? lastScale : nextScale;
                        }
                    }

                    /**
                     * Read a sequence parameter set and return some interesting video
                     * properties. A sequence parameter set is the H264 metadata that
                     * describes the properties of upcoming video frames.
                     * @param data {Uint8Array} the bytes of a sequence parameter set
                     * @return {object} an object with configuration parsed from the
                     * sequence parameter set, including the dimensions of the
                     * associated video frames.
                     */
                    readSPS() {
                        let frameCropLeftOffset = 0;
                        let frameCropRightOffset = 0;
                        let frameCropTopOffset = 0;
                        let frameCropBottomOffset = 0;
                        let numRefFramesInPicOrderCntCycle;
                        let scalingListCount;
                        let i;
                        const readUByte = this.readUByte.bind(this);
                        const readBits = this.readBits.bind(this);
                        const readUEG = this.readUEG.bind(this);
                        const readBoolean = this.readBoolean.bind(this);
                        const skipBits = this.skipBits.bind(this);
                        const skipEG = this.skipEG.bind(this);
                        const skipUEG = this.skipUEG.bind(this);
                        const skipScalingList = this.skipScalingList.bind(this);
                        readUByte();
                        const profileIdc = readUByte(); // profile_idc
                        readBits(5); // profileCompat constraint_set[0-4]_flag, u(5)
                        skipBits(3); // reserved_zero_3bits u(3),
                        readUByte(); // level_idc u(8)
                        skipUEG(); // seq_parameter_set_id
                        // some profiles have more optional data we don't need
                        if (profileIdc === 100 || profileIdc === 110 || profileIdc === 122 || profileIdc === 244 || profileIdc === 44 || profileIdc === 83 || profileIdc === 86 || profileIdc === 118 || profileIdc === 128) {
                            const chromaFormatIdc = readUEG();
                            if (chromaFormatIdc === 3) {
                                skipBits(1);
                            } // separate_colour_plane_flag

                            skipUEG(); // bit_depth_luma_minus8
                            skipUEG(); // bit_depth_chroma_minus8
                            skipBits(1); // qpprime_y_zero_transform_bypass_flag
                            if (readBoolean()) {
                                // seq_scaling_matrix_present_flag
                                scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;
                                for (i = 0; i < scalingListCount; i++) {
                                    if (readBoolean()) {
                                        // seq_scaling_list_present_flag[ i ]
                                        if (i < 6) {
                                            skipScalingList(16);
                                        } else {
                                            skipScalingList(64);
                                        }
                                    }
                                }
                            }
                        }
                        skipUEG(); // log2_max_frame_num_minus4
                        const picOrderCntType = readUEG();
                        if (picOrderCntType === 0) {
                            readUEG(); // log2_max_pic_order_cnt_lsb_minus4
                        } else if (picOrderCntType === 1) {
                            skipBits(1); // delta_pic_order_always_zero_flag
                            skipEG(); // offset_for_non_ref_pic
                            skipEG(); // offset_for_top_to_bottom_field
                            numRefFramesInPicOrderCntCycle = readUEG();
                            for (i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
                                skipEG();
                            } // offset_for_ref_frame[ i ]
                        }

                        skipUEG(); // max_num_ref_frames
                        skipBits(1); // gaps_in_frame_num_value_allowed_flag
                        const picWidthInMbsMinus1 = readUEG();
                        const picHeightInMapUnitsMinus1 = readUEG();
                        const frameMbsOnlyFlag = readBits(1);
                        if (frameMbsOnlyFlag === 0) {
                            skipBits(1);
                        } // mb_adaptive_frame_field_flag

                        skipBits(1); // direct_8x8_inference_flag
                        if (readBoolean()) {
                            // frame_cropping_flag
                            frameCropLeftOffset = readUEG();
                            frameCropRightOffset = readUEG();
                            frameCropTopOffset = readUEG();
                            frameCropBottomOffset = readUEG();
                        }
                        let pixelRatio = [1, 1];
                        if (readBoolean()) {
                            // vui_parameters_present_flag
                            if (readBoolean()) {
                                // aspect_ratio_info_present_flag
                                const aspectRatioIdc = readUByte();
                                switch (aspectRatioIdc) {
                                    case 1:
                                        pixelRatio = [1, 1];
                                        break;
                                    case 2:
                                        pixelRatio = [12, 11];
                                        break;
                                    case 3:
                                        pixelRatio = [10, 11];
                                        break;
                                    case 4:
                                        pixelRatio = [16, 11];
                                        break;
                                    case 5:
                                        pixelRatio = [40, 33];
                                        break;
                                    case 6:
                                        pixelRatio = [24, 11];
                                        break;
                                    case 7:
                                        pixelRatio = [20, 11];
                                        break;
                                    case 8:
                                        pixelRatio = [32, 11];
                                        break;
                                    case 9:
                                        pixelRatio = [80, 33];
                                        break;
                                    case 10:
                                        pixelRatio = [18, 11];
                                        break;
                                    case 11:
                                        pixelRatio = [15, 11];
                                        break;
                                    case 12:
                                        pixelRatio = [64, 33];
                                        break;
                                    case 13:
                                        pixelRatio = [160, 99];
                                        break;
                                    case 14:
                                        pixelRatio = [4, 3];
                                        break;
                                    case 15:
                                        pixelRatio = [3, 2];
                                        break;
                                    case 16:
                                        pixelRatio = [2, 1];
                                        break;
                                    case 255:
                                        {
                                            pixelRatio = [readUByte() << 8 | readUByte(), readUByte() << 8 | readUByte()];
                                            break;
                                        }
                                }
                            }
                        }
                        return {
                            width: Math.ceil((picWidthInMbsMinus1 + 1) * 16 - frameCropLeftOffset * 2 - frameCropRightOffset * 2),
                            height: (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16 - (frameMbsOnlyFlag ? 2 : 4) * (frameCropTopOffset + frameCropBottomOffset),
                            pixelRatio: pixelRatio
                        };
                    }
                    readSliceType() {
                        // skip NALu type
                        this.readUByte();
                        // discard first_mb_in_slice
                        this.readUEG();
                        // return slice_type
                        return this.readUEG();
                    }
                }
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ExpGolomb);

                /***/
            }),

/***/ "./src/demux/id3.ts":
/*!**************************!*\
  !*** ./src/demux/id3.ts ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "canParse": () => (/* binding */ canParse),
/* harmony export */   "decodeFrame": () => (/* binding */ decodeFrame),
/* harmony export */   "getID3Data": () => (/* binding */ getID3Data),
/* harmony export */   "getID3Frames": () => (/* binding */ getID3Frames),
/* harmony export */   "getTimeStamp": () => (/* binding */ getTimeStamp),
/* harmony export */   "isFooter": () => (/* binding */ isFooter),
/* harmony export */   "isHeader": () => (/* binding */ isHeader),
/* harmony export */   "isTimeStampFrame": () => (/* binding */ isTimeStampFrame),
/* harmony export */   "testables": () => (/* binding */ testables),
/* harmony export */   "utf8ArrayToStr": () => (/* binding */ utf8ArrayToStr)
                    /* harmony export */
                });
                // breaking up those two types in order to clarify what is happening in the decoding path.

                /**
                 * Returns true if an ID3 header can be found at offset in data
                 * @param {Uint8Array} data - The data to search in
                 * @param {number} offset - The offset at which to start searching
                 * @return {boolean} - True if an ID3 header is found
                 */
                const isHeader = (data, offset) => {
                    /*
                     * http://id3.org/id3v2.3.0
                     * [0]     = 'I'
                     * [1]     = 'D'
                     * [2]     = '3'
                     * [3,4]   = {Version}
                     * [5]     = {Flags}
                     * [6-9]   = {ID3 Size}
                     *
                     * An ID3v2 tag can be detected with the following pattern:
                     *  $49 44 33 yy yy xx zz zz zz zz
                     * Where yy is less than $FF, xx is the 'flags' byte and zz is less than $80
                     */
                    if (offset + 10 <= data.length) {
                        // look for 'ID3' identifier
                        if (data[offset] === 0x49 && data[offset + 1] === 0x44 && data[offset + 2] === 0x33) {
                            // check version is within range
                            if (data[offset + 3] < 0xff && data[offset + 4] < 0xff) {
                                // check size is within range
                                if (data[offset + 6] < 0x80 && data[offset + 7] < 0x80 && data[offset + 8] < 0x80 && data[offset + 9] < 0x80) {
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                };

                /**
                 * Returns true if an ID3 footer can be found at offset in data
                 * @param {Uint8Array} data - The data to search in
                 * @param {number} offset - The offset at which to start searching
                 * @return {boolean} - True if an ID3 footer is found
                 */
                const isFooter = (data, offset) => {
                    /*
                     * The footer is a copy of the header, but with a different identifier
                     */
                    if (offset + 10 <= data.length) {
                        // look for '3DI' identifier
                        if (data[offset] === 0x33 && data[offset + 1] === 0x44 && data[offset + 2] === 0x49) {
                            // check version is within range
                            if (data[offset + 3] < 0xff && data[offset + 4] < 0xff) {
                                // check size is within range
                                if (data[offset + 6] < 0x80 && data[offset + 7] < 0x80 && data[offset + 8] < 0x80 && data[offset + 9] < 0x80) {
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                };

                /**
                 * Returns any adjacent ID3 tags found in data starting at offset, as one block of data
                 * @param {Uint8Array} data - The data to search in
                 * @param {number} offset - The offset at which to start searching
                 * @return {Uint8Array | undefined} - The block of data containing any ID3 tags found
                 * or *undefined* if no header is found at the starting offset
                 */
                const getID3Data = (data, offset) => {
                    const front = offset;
                    let length = 0;
                    while (isHeader(data, offset)) {
                        // ID3 header is 10 bytes
                        length += 10;
                        const size = readSize(data, offset + 6);
                        length += size;
                        if (isFooter(data, offset + 10)) {
                            // ID3 footer is 10 bytes
                            length += 10;
                        }
                        offset += length;
                    }
                    if (length > 0) {
                        return data.subarray(front, front + length);
                    }
                    return undefined;
                };
                const readSize = (data, offset) => {
                    let size = 0;
                    size = (data[offset] & 0x7f) << 21;
                    size |= (data[offset + 1] & 0x7f) << 14;
                    size |= (data[offset + 2] & 0x7f) << 7;
                    size |= data[offset + 3] & 0x7f;
                    return size;
                };
                const canParse = (data, offset) => {
                    return isHeader(data, offset) && readSize(data, offset + 6) + 10 <= data.length - offset;
                };

                /**
                 * Searches for the Elementary Stream timestamp found in the ID3 data chunk
                 * @param {Uint8Array} data - Block of data containing one or more ID3 tags
                 * @return {number | undefined} - The timestamp
                 */
                const getTimeStamp = data => {
                    const frames = getID3Frames(data);
                    for (let i = 0; i < frames.length; i++) {
                        const frame = frames[i];
                        if (isTimeStampFrame(frame)) {
                            return readTimeStamp(frame);
                        }
                    }
                    return undefined;
                };

                /**
                 * Returns true if the ID3 frame is an Elementary Stream timestamp frame
                 * @param {ID3 frame} frame
                 */
                const isTimeStampFrame = frame => {
                    return frame && frame.key === 'PRIV' && frame.info === 'com.apple.streaming.transportStreamTimestamp';
                };
                const getFrameData = data => {
                    /*
                    Frame ID       $xx xx xx xx (four characters)
                    Size           $xx xx xx xx
                    Flags          $xx xx
                    */
                    const type = String.fromCharCode(data[0], data[1], data[2], data[3]);
                    const size = readSize(data, 4);

                    // skip frame id, size, and flags
                    const offset = 10;
                    return {
                        type,
                        size,
                        data: data.subarray(offset, offset + size)
                    };
                };

                /**
                 * Returns an array of ID3 frames found in all the ID3 tags in the id3Data
                 * @param {Uint8Array} id3Data - The ID3 data containing one or more ID3 tags
                 * @return {ID3.Frame[]} - Array of ID3 frame objects
                 */
                const getID3Frames = id3Data => {
                    let offset = 0;
                    const frames = [];
                    while (isHeader(id3Data, offset)) {
                        const size = readSize(id3Data, offset + 6);
                        // skip past ID3 header
                        offset += 10;
                        const end = offset + size;
                        // loop through frames in the ID3 tag
                        while (offset + 8 < end) {
                            const frameData = getFrameData(id3Data.subarray(offset));
                            const frame = decodeFrame(frameData);
                            if (frame) {
                                frames.push(frame);
                            }

                            // skip frame header and frame data
                            offset += frameData.size + 10;
                        }
                        if (isFooter(id3Data, offset)) {
                            offset += 10;
                        }
                    }
                    return frames;
                };
                const decodeFrame = frame => {
                    if (frame.type === 'PRIV') {
                        return decodePrivFrame(frame);
                    } else if (frame.type[0] === 'W') {
                        return decodeURLFrame(frame);
                    }
                    return decodeTextFrame(frame);
                };
                const decodePrivFrame = frame => {
                    /*
                    Format: <text string>\0<binary data>
                    */
                    if (frame.size < 2) {
                        return undefined;
                    }
                    const owner = utf8ArrayToStr(frame.data, true);
                    const privateData = new Uint8Array(frame.data.subarray(owner.length + 1));
                    return {
                        key: frame.type,
                        info: owner,
                        data: privateData.buffer
                    };
                };
                const decodeTextFrame = frame => {
                    if (frame.size < 2) {
                        return undefined;
                    }
                    if (frame.type === 'TXXX') {
                        /*
                        Format:
                        [0]   = {Text Encoding}
                        [1-?] = {Description}\0{Value}
                        */
                        let index = 1;
                        const description = utf8ArrayToStr(frame.data.subarray(index), true);
                        index += description.length + 1;
                        const value = utf8ArrayToStr(frame.data.subarray(index));
                        return {
                            key: frame.type,
                            info: description,
                            data: value
                        };
                    }
                    /*
                    Format:
                    [0]   = {Text Encoding}
                    [1-?] = {Value}
                    */
                    const text = utf8ArrayToStr(frame.data.subarray(1));
                    return {
                        key: frame.type,
                        data: text
                    };
                };
                const decodeURLFrame = frame => {
                    if (frame.type === 'WXXX') {
                        /*
                        Format:
                        [0]   = {Text Encoding}
                        [1-?] = {Description}\0{URL}
                        */
                        if (frame.size < 2) {
                            return undefined;
                        }
                        let index = 1;
                        const description = utf8ArrayToStr(frame.data.subarray(index), true);
                        index += description.length + 1;
                        const value = utf8ArrayToStr(frame.data.subarray(index));
                        return {
                            key: frame.type,
                            info: description,
                            data: value
                        };
                    }
                    /*
                    Format:
                    [0-?] = {URL}
                    */
                    const url = utf8ArrayToStr(frame.data);
                    return {
                        key: frame.type,
                        data: url
                    };
                };
                const readTimeStamp = timeStampFrame => {
                    if (timeStampFrame.data.byteLength === 8) {
                        const data = new Uint8Array(timeStampFrame.data);
                        // timestamp is 33 bit expressed as a big-endian eight-octet number,
                        // with the upper 31 bits set to zero.
                        const pts33Bit = data[3] & 0x1;
                        let timestamp = (data[4] << 23) + (data[5] << 15) + (data[6] << 7) + data[7];
                        timestamp /= 45;
                        if (pts33Bit) {
                            timestamp += 47721858.84;
                        } // 2^32 / 90

                        return Math.round(timestamp);
                    }
                    return undefined;
                };

                // http://stackoverflow.com/questions/8936984/uint8array-to-string-in-javascript/22373197
                // http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt
                /* utf.js - UTF-8 <=> UTF-16 convertion
                 *
                 * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
                 * Version: 1.0
                 * LastModified: Dec 25 1999
                 * This library is free.  You can redistribute it and/or modify it.
                 */
                const utf8ArrayToStr = (array, exitOnNull = false) => {
                    const decoder = getTextDecoder();
                    if (decoder) {
                        const decoded = decoder.decode(array);
                        if (exitOnNull) {
                            // grab up to the first null
                            const idx = decoded.indexOf('\0');
                            return idx !== -1 ? decoded.substring(0, idx) : decoded;
                        }

                        // remove any null characters
                        return decoded.replace(/\0/g, '');
                    }
                    const len = array.length;
                    let c;
                    let char2;
                    let char3;
                    let out = '';
                    let i = 0;
                    while (i < len) {
                        c = array[i++];
                        if (c === 0x00 && exitOnNull) {
                            return out;
                        } else if (c === 0x00 || c === 0x03) {
                            // If the character is 3 (END_OF_TEXT) or 0 (NULL) then skip it
                            continue;
                        }
                        switch (c >> 4) {
                            case 0:
                            case 1:
                            case 2:
                            case 3:
                            case 4:
                            case 5:
                            case 6:
                            case 7:
                                // 0xxxxxxx
                                out += String.fromCharCode(c);
                                break;
                            case 12:
                            case 13:
                                // 110x xxxx   10xx xxxx
                                char2 = array[i++];
                                out += String.fromCharCode((c & 0x1f) << 6 | char2 & 0x3f);
                                break;
                            case 14:
                                // 1110 xxxx  10xx xxxx  10xx xxxx
                                char2 = array[i++];
                                char3 = array[i++];
                                out += String.fromCharCode((c & 0x0f) << 12 | (char2 & 0x3f) << 6 | (char3 & 0x3f) << 0);
                                break;
                            default:
                        }
                    }
                    return out;
                };
                const testables = {
                    decodeTextFrame: decodeTextFrame
                };
                let decoder;
                function getTextDecoder() {
                    if (!decoder && typeof self.TextDecoder !== 'undefined') {
                        decoder = new self.TextDecoder('utf-8');
                    }
                    return decoder;
                }

                /***/
            }),

/***/ "./src/demux/mp3demuxer.ts":
/*!*********************************!*\
  !*** ./src/demux/mp3demuxer.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
                    /* harmony export */
                });
/* harmony import */ var _base_audio_demuxer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./base-audio-demuxer */ "./src/demux/base-audio-demuxer.ts");
/* harmony import */ var _demux_id3__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../demux/id3 */ "./src/demux/id3.ts");
/* harmony import */ var _utils_logger__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.ts");
/* harmony import */ var _mpegaudio__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./mpegaudio */ "./src/demux/mpegaudio.ts");
                /**
                 * MP3 demuxer
                 */




                class MP3Demuxer extends _base_audio_demuxer__WEBPACK_IMPORTED_MODULE_0__["default"] {
                    resetInitSegment(initSegment, audioCodec, videoCodec, trackDuration) {
                        super.resetInitSegment(initSegment, audioCodec, videoCodec, trackDuration);
                        this._audioTrack = {
                            container: 'audio/mpeg',
                            type: 'audio',
                            id: 2,
                            pid: -1,
                            sequenceNumber: 0,
                            segmentCodec: 'mp3',
                            samples: [],
                            manifestCodec: audioCodec,
                            duration: trackDuration,
                            inputTimeScale: 90000,
                            dropped: 0
                        };
                    }
                    static probe(data) {
                        if (!data) {
                            return false;
                        }

                        // check if data contains ID3 timestamp and MPEG sync word
                        // Look for MPEG header | 1111 1111 | 111X XYZX | where X can be either 0 or 1 and Y or Z should be 1
                        // Layer bits (position 14 and 15) in header should be always different from 0 (Layer I or Layer II or Layer III)
                        // More info http://www.mp3-tech.org/programmer/frame_header.html
                        const id3Data = _demux_id3__WEBPACK_IMPORTED_MODULE_1__.getID3Data(data, 0) || [];
                        let offset = id3Data.length;
                        for (let length = data.length; offset < length; offset++) {
                            if (_mpegaudio__WEBPACK_IMPORTED_MODULE_3__.probe(data, offset)) {
                                _utils_logger__WEBPACK_IMPORTED_MODULE_2__.logger.log('MPEG Audio sync word found !');
                                return true;
                            }
                        }
                        return false;
                    }
                    canParse(data, offset) {
                        return _mpegaudio__WEBPACK_IMPORTED_MODULE_3__.canParse(data, offset);
                    }
                    appendFrame(track, data, offset) {
                        if (this.basePTS === null) {
                            return;
                        }
                        return _mpegaudio__WEBPACK_IMPORTED_MODULE_3__.appendFrame(track, data, offset, this.basePTS, this.frameIndex);
                    }
                }
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MP3Demuxer);

                /***/
            }),

/***/ "./src/demux/mp4demuxer.ts":
/*!*********************************!*\
  !*** ./src/demux/mp4demuxer.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
                    /* harmony export */
                });
/* harmony import */ var _types_demuxer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../types/demuxer */ "./src/types/demuxer.ts");
/* harmony import */ var _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/mp4-tools */ "./src/utils/mp4-tools.ts");
/* harmony import */ var _dummy_demuxed_track__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./dummy-demuxed-track */ "./src/demux/dummy-demuxed-track.ts");
                /**
                 * MP4 demuxer
                 */



                const emsgSchemePattern = /\/emsg[-/]ID3/i;
                class MP4Demuxer {
                    remainderData = null;
                    timeOffset = 0;
                    constructor(observer, config) {
                        this.config = config;
                    }
                    resetTimeStamp() { }
                    resetInitSegment(initSegment, audioCodec, videoCodec, trackDuration) {
                        const videoTrack = this.videoTrack = (0, _dummy_demuxed_track__WEBPACK_IMPORTED_MODULE_2__.dummyTrack)('video', 1);
                        const audioTrack = this.audioTrack = (0, _dummy_demuxed_track__WEBPACK_IMPORTED_MODULE_2__.dummyTrack)('audio', 1);
                        const captionTrack = this.txtTrack = (0, _dummy_demuxed_track__WEBPACK_IMPORTED_MODULE_2__.dummyTrack)('text', 1);
                        this.id3Track = (0, _dummy_demuxed_track__WEBPACK_IMPORTED_MODULE_2__.dummyTrack)('id3', 1);
                        this.timeOffset = 0;
                        if (!initSegment || !initSegment.byteLength) {
                            return;
                        }
                        const initData = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.parseInitSegment)(initSegment);
                        if (initData.video) {
                            const {
                                id,
                                timescale,
                                codec
                            } = initData.video;
                            videoTrack.id = id;
                            videoTrack.timescale = captionTrack.timescale = timescale;
                            videoTrack.codec = codec;
                        }
                        if (initData.audio) {
                            const {
                                id,
                                timescale,
                                codec
                            } = initData.audio;
                            audioTrack.id = id;
                            audioTrack.timescale = timescale;
                            audioTrack.codec = codec;
                        }
                        captionTrack.id = _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.RemuxerTrackIdConfig.text;
                        videoTrack.sampleDuration = 0;
                        videoTrack.duration = audioTrack.duration = trackDuration;
                    }
                    resetContiguity() { }
                    static probe(data) {
                        // ensure we find a moof box in the first 16 kB
                        data = data.length > 16384 ? data.subarray(0, 16384) : data;
                        return (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.findBox)(data, ['moof']).length > 0;
                    }
                    demux(data, timeOffset) {
                        this.timeOffset = timeOffset;
                        // Load all data into the avc track. The CMAF remuxer will look for the data in the samples object; the rest of the fields do not matter
                        let videoSamples = data;
                        const videoTrack = this.videoTrack;
                        const textTrack = this.txtTrack;
                        if (this.config.progressive) {
                            // Split the bytestream into two ranges: one encompassing all data up until the start of the last moof, and everything else.
                            // This is done to guarantee that we're sending valid data to MSE - when demuxing progressively, we have no guarantee
                            // that the fetch loader gives us flush moof+mdat pairs. If we push jagged data to MSE, it will throw an exception.
                            if (this.remainderData) {
                                videoSamples = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.appendUint8Array)(this.remainderData, data);
                            }
                            const segmentedData = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.segmentValidRange)(videoSamples);
                            this.remainderData = segmentedData.remainder;
                            videoTrack.samples = segmentedData.valid || new Uint8Array();
                        } else {
                            videoTrack.samples = videoSamples;
                        }
                        const id3Track = this.extractID3Track(videoTrack, timeOffset);
                        textTrack.samples = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.parseSamples)(timeOffset, videoTrack);
                        return {
                            videoTrack,
                            audioTrack: this.audioTrack,
                            id3Track,
                            textTrack: this.txtTrack
                        };
                    }
                    flush() {
                        const timeOffset = this.timeOffset;
                        const videoTrack = this.videoTrack;
                        const textTrack = this.txtTrack;
                        videoTrack.samples = this.remainderData || new Uint8Array();
                        this.remainderData = null;
                        const id3Track = this.extractID3Track(videoTrack, this.timeOffset);
                        textTrack.samples = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.parseSamples)(timeOffset, videoTrack);
                        return {
                            videoTrack,
                            audioTrack: (0, _dummy_demuxed_track__WEBPACK_IMPORTED_MODULE_2__.dummyTrack)(),
                            id3Track,
                            textTrack: (0, _dummy_demuxed_track__WEBPACK_IMPORTED_MODULE_2__.dummyTrack)()
                        };
                    }
                    extractID3Track(videoTrack, timeOffset) {
                        const id3Track = this.id3Track;
                        if (videoTrack.samples.length) {
                            const emsgs = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.findBox)(videoTrack.samples, ['emsg']);
                            if (emsgs) {
                                emsgs.forEach(data => {
                                    const emsgInfo = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.parseEmsg)(data);
                                    if (emsgSchemePattern.test(emsgInfo.schemeIdUri)) {
                                        const pts = Number.isFinite(emsgInfo.presentationTime) ? emsgInfo.presentationTime / emsgInfo.timeScale : timeOffset + emsgInfo.presentationTimeDelta / emsgInfo.timeScale;
                                        let duration = emsgInfo.eventDuration === 0xffffffff ? Number.POSITIVE_INFINITY : emsgInfo.eventDuration / emsgInfo.timeScale;
                                        // Safari takes anything <= 0.001 seconds and maps it to Infinity
                                        if (duration <= 0.001) {
                                            duration = Number.POSITIVE_INFINITY;
                                        }
                                        const payload = emsgInfo.payload;
                                        id3Track.samples.push({
                                            data: payload,
                                            len: payload.byteLength,
                                            dts: pts,
                                            pts: pts,
                                            type: _types_demuxer__WEBPACK_IMPORTED_MODULE_0__.MetadataSchema.emsg,
                                            duration: duration
                                        });
                                    }
                                });
                            }
                        }
                        return id3Track;
                    }
                    demuxSampleAes(data, keyData, timeOffset) {
                        return Promise.reject(new Error('The MP4 demuxer does not support SAMPLE-AES decryption'));
                    }
                    destroy() { }
                }
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MP4Demuxer);

                /***/
            }),

/***/ "./src/demux/mpegaudio.ts":
/*!********************************!*\
  !*** ./src/demux/mpegaudio.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "appendFrame": () => (/* binding */ appendFrame),
/* harmony export */   "canParse": () => (/* binding */ canParse),
/* harmony export */   "isHeader": () => (/* binding */ isHeader),
/* harmony export */   "isHeaderPattern": () => (/* binding */ isHeaderPattern),
/* harmony export */   "parseHeader": () => (/* binding */ parseHeader),
/* harmony export */   "probe": () => (/* binding */ probe)
                    /* harmony export */
                });
                /**
                 *  MPEG parser helper
                 */

                let chromeVersion = null;
                const BitratesMap = [32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
                const SamplingRateMap = [44100, 48000, 32000, 22050, 24000, 16000, 11025, 12000, 8000];
                const SamplesCoefficients = [
                    // MPEG 2.5
                    [0,
                        // Reserved
                        72,
                        // Layer3
                        144,
                        // Layer2
                        12 // Layer1
                    ],
                    // Reserved
                    [0,
                        // Reserved
                        0,
                        // Layer3
                        0,
                        // Layer2
                        0 // Layer1
                    ],
                    // MPEG 2
                    [0,
                        // Reserved
                        72,
                        // Layer3
                        144,
                        // Layer2
                        12 // Layer1
                    ],
                    // MPEG 1
                    [0,
                        // Reserved
                        144,
                        // Layer3
                        144,
                        // Layer2
                        12 // Layer1
                    ]];

                const BytesInSlot = [0,
                    // Reserved
                    1,
                    // Layer3
                    1,
                    // Layer2
                    4 // Layer1
                ];

                function appendFrame(track, data, offset, pts, frameIndex) {
                    // Using http://www.datavoyage.com/mpgscript/mpeghdr.htm as a reference
                    if (offset + 24 > data.length) {
                        return;
                    }
                    const header = parseHeader(data, offset);
                    if (header && offset + header.frameLength <= data.length) {
                        const frameDuration = header.samplesPerFrame * 90000 / header.sampleRate;
                        const stamp = pts + frameIndex * frameDuration;
                        const sample = {
                            unit: data.subarray(offset, offset + header.frameLength),
                            pts: stamp,
                            dts: stamp
                        };
                        track.config = [];
                        track.channelCount = header.channelCount;
                        track.samplerate = header.sampleRate;
                        track.samples.push(sample);
                        return {
                            sample,
                            length: header.frameLength,
                            missing: 0
                        };
                    }
                }
                function parseHeader(data, offset) {
                    const mpegVersion = data[offset + 1] >> 3 & 3;
                    const mpegLayer = data[offset + 1] >> 1 & 3;
                    const bitRateIndex = data[offset + 2] >> 4 & 15;
                    const sampleRateIndex = data[offset + 2] >> 2 & 3;
                    if (mpegVersion !== 1 && bitRateIndex !== 0 && bitRateIndex !== 15 && sampleRateIndex !== 3) {
                        const paddingBit = data[offset + 2] >> 1 & 1;
                        const channelMode = data[offset + 3] >> 6;
                        const columnInBitrates = mpegVersion === 3 ? 3 - mpegLayer : mpegLayer === 3 ? 3 : 4;
                        const bitRate = BitratesMap[columnInBitrates * 14 + bitRateIndex - 1] * 1000;
                        const columnInSampleRates = mpegVersion === 3 ? 0 : mpegVersion === 2 ? 1 : 2;
                        const sampleRate = SamplingRateMap[columnInSampleRates * 3 + sampleRateIndex];
                        const channelCount = channelMode === 3 ? 1 : 2; // If bits of channel mode are `11` then it is a single channel (Mono)
                        const sampleCoefficient = SamplesCoefficients[mpegVersion][mpegLayer];
                        const bytesInSlot = BytesInSlot[mpegLayer];
                        const samplesPerFrame = sampleCoefficient * 8 * bytesInSlot;
                        const frameLength = Math.floor(sampleCoefficient * bitRate / sampleRate + paddingBit) * bytesInSlot;
                        if (chromeVersion === null) {
                            const userAgent = navigator.userAgent || '';
                            const result = userAgent.match(/Chrome\/(\d+)/i);
                            chromeVersion = result ? parseInt(result[1]) : 0;
                        }
                        const needChromeFix = !!chromeVersion && chromeVersion <= 87;
                        if (needChromeFix && mpegLayer === 2 && bitRate >= 224000 && channelMode === 0) {
                            // Work around bug in Chromium by setting channelMode to dual-channel (01) instead of stereo (00)
                            data[offset + 3] = data[offset + 3] | 0x80;
                        }
                        return {
                            sampleRate,
                            channelCount,
                            frameLength,
                            samplesPerFrame
                        };
                    }
                }
                function isHeaderPattern(data, offset) {
                    return data[offset] === 0xff && (data[offset + 1] & 0xe0) === 0xe0 && (data[offset + 1] & 0x06) !== 0x00;
                }
                function isHeader(data, offset) {
                    // Look for MPEG header | 1111 1111 | 111X XYZX | where X can be either 0 or 1 and Y or Z should be 1
                    // Layer bits (position 14 and 15) in header should be always different from 0 (Layer I or Layer II or Layer III)
                    // More info http://www.mp3-tech.org/programmer/frame_header.html
                    return offset + 1 < data.length && isHeaderPattern(data, offset);
                }
                function canParse(data, offset) {
                    const headerSize = 4;
                    return isHeaderPattern(data, offset) && headerSize <= data.length - offset;
                }
                function probe(data, offset) {
                    // same as isHeader but we also check that MPEG frame follows last MPEG frame
                    // or end of data is reached
                    if (offset + 1 < data.length && isHeaderPattern(data, offset)) {
                        // MPEG header Length
                        const headerLength = 4;
                        // MPEG frame Length
                        const header = parseHeader(data, offset);
                        let frameLength = headerLength;
                        if (header?.frameLength) {
                            frameLength = header.frameLength;
                        }
                        const newOffset = offset + frameLength;
                        return newOffset === data.length || isHeader(data, newOffset);
                    }
                    return false;
                }

                /***/
            }),

/***/ "./src/demux/sample-aes.ts":
/*!*********************************!*\
  !*** ./src/demux/sample-aes.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
                    /* harmony export */
                });
/* harmony import */ var _crypt_decrypter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../crypt/decrypter */ "./src/crypt/decrypter.ts");
/* harmony import */ var _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/mp4-tools */ "./src/utils/mp4-tools.ts");
                /**
                 * SAMPLE-AES decrypter
                 */



                class SampleAesDecrypter {
                    constructor(observer, config, keyData) {
                        this.keyData = keyData;
                        this.decrypter = new _crypt_decrypter__WEBPACK_IMPORTED_MODULE_0__["default"](config, {
                            removePKCS7Padding: false
                        });
                    }
                    decryptBuffer(encryptedData) {
                        return this.decrypter.decrypt(encryptedData, this.keyData.key.buffer, this.keyData.iv.buffer);
                    }

                    // AAC - encrypt all full 16 bytes blocks starting from offset 16
                    decryptAacSample(samples, sampleIndex, callback) {
                        const curUnit = samples[sampleIndex].unit;
                        if (curUnit.length <= 16) {
                            // No encrypted portion in this sample (first 16 bytes is not
                            // encrypted, see https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/HLS_Sample_Encryption/Encryption/Encryption.html),
                            return;
                        }
                        const encryptedData = curUnit.subarray(16, curUnit.length - curUnit.length % 16);
                        const encryptedBuffer = encryptedData.buffer.slice(encryptedData.byteOffset, encryptedData.byteOffset + encryptedData.length);
                        this.decryptBuffer(encryptedBuffer).then(decryptedBuffer => {
                            const decryptedData = new Uint8Array(decryptedBuffer);
                            curUnit.set(decryptedData, 16);
                            if (!this.decrypter.isSync()) {
                                this.decryptAacSamples(samples, sampleIndex + 1, callback);
                            }
                        });
                    }
                    decryptAacSamples(samples, sampleIndex, callback) {
                        for (; ; sampleIndex++) {
                            if (sampleIndex >= samples.length) {
                                callback();
                                return;
                            }
                            if (samples[sampleIndex].unit.length < 32) {
                                continue;
                            }
                            this.decryptAacSample(samples, sampleIndex, callback);
                            if (!this.decrypter.isSync()) {
                                return;
                            }
                        }
                    }

                    // AVC - encrypt one 16 bytes block out of ten, starting from offset 32
                    getAvcEncryptedData(decodedData) {
                        const encryptedDataLen = Math.floor((decodedData.length - 48) / 160) * 16 + 16;
                        const encryptedData = new Int8Array(encryptedDataLen);
                        let outputPos = 0;
                        for (let inputPos = 32; inputPos < decodedData.length - 16; inputPos += 160, outputPos += 16) {
                            encryptedData.set(decodedData.subarray(inputPos, inputPos + 16), outputPos);
                        }
                        return encryptedData;
                    }
                    getAvcDecryptedUnit(decodedData, decryptedData) {
                        const uint8DecryptedData = new Uint8Array(decryptedData);
                        let inputPos = 0;
                        for (let outputPos = 32; outputPos < decodedData.length - 16; outputPos += 160, inputPos += 16) {
                            decodedData.set(uint8DecryptedData.subarray(inputPos, inputPos + 16), outputPos);
                        }
                        return decodedData;
                    }
                    decryptAvcSample(samples, sampleIndex, unitIndex, callback, curUnit) {
                        const decodedData = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.discardEPB)(curUnit.data);
                        const encryptedData = this.getAvcEncryptedData(decodedData);
                        this.decryptBuffer(encryptedData.buffer).then(decryptedBuffer => {
                            curUnit.data = this.getAvcDecryptedUnit(decodedData, decryptedBuffer);
                            if (!this.decrypter.isSync()) {
                                this.decryptAvcSamples(samples, sampleIndex, unitIndex + 1, callback);
                            }
                        });
                    }
                    decryptAvcSamples(samples, sampleIndex, unitIndex, callback) {
                        if (samples instanceof Uint8Array) {
                            throw new Error('Cannot decrypt samples of type Uint8Array');
                        }
                        for (; ; sampleIndex++, unitIndex = 0) {
                            if (sampleIndex >= samples.length) {
                                callback();
                                return;
                            }
                            const curUnits = samples[sampleIndex].units;
                            for (; ; unitIndex++) {
                                if (unitIndex >= curUnits.length) {
                                    break;
                                }
                                const curUnit = curUnits[unitIndex];
                                if (curUnit.data.length <= 48 || curUnit.type !== 1 && curUnit.type !== 5) {
                                    continue;
                                }
                                this.decryptAvcSample(samples, sampleIndex, unitIndex, callback, curUnit);
                                if (!this.decrypter.isSync()) {
                                    return;
                                }
                            }
                        }
                    }
                }
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SampleAesDecrypter);

                /***/
            }),

/***/ "./src/demux/tsdemuxer.ts":
/*!********************************!*\
  !*** ./src/demux/tsdemuxer.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
                    /* harmony export */
                });
/* harmony import */ var _adts__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./adts */ "./src/demux/adts.ts");
/* harmony import */ var _mpegaudio__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./mpegaudio */ "./src/demux/mpegaudio.ts");
/* harmony import */ var _exp_golomb__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./exp-golomb */ "./src/demux/exp-golomb.ts");
/* harmony import */ var _sample_aes__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./sample-aes */ "./src/demux/sample-aes.ts");
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../events */ "./src/events.ts");
/* harmony import */ var _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils/mp4-tools */ "./src/utils/mp4-tools.ts");
/* harmony import */ var _utils_logger__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.ts");
/* harmony import */ var _errors__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../errors */ "./src/errors.ts");
/* harmony import */ var _types_demuxer__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../types/demuxer */ "./src/types/demuxer.ts");
                /**
                 * highly optimized TS demuxer:
                 * parse PAT, PMT
                 * extract PES packet from audio and video PIDs
                 * extract AVC/H264 NAL units and AAC/ADTS samples from PES packet
                 * trigger the remuxer upon parsing completion
                 * it also tries to workaround as best as it can audio codec switch (HE-AAC to AAC and vice versa), without having to restart the MediaSource.
                 * it also controls the remuxing process :
                 * upon discontinuity or level switch detection, it will also notifies the remuxer so that it can reset its state.
                 */










                const PACKET_LENGTH = 188;
                class TSDemuxer {
                    sampleAes = null;
                    pmtParsed = false;
                    _duration = 0;
                    _pmtId = -1;
                    aacOverFlow = null;
                    avcSample = null;
                    remainderData = null;
                    constructor(observer, config, typeSupported) {
                        this.observer = observer;
                        this.config = config;
                        this.typeSupported = typeSupported;
                    }
                    static probe(data) {
                        const syncOffset = TSDemuxer.syncOffset(data);
                        if (syncOffset > 0) {
                            _utils_logger__WEBPACK_IMPORTED_MODULE_6__.logger.warn(`MPEG2-TS detected but first sync word found @ offset ${syncOffset}`);
                        }
                        return syncOffset !== -1;
                    }
                    static syncOffset(data) {
                        const scanwindow = Math.min(PACKET_LENGTH * 5, data.length - PACKET_LENGTH * 2) + 1;
                        let i = 0;
                        while (i < scanwindow) {
                            // a TS init segment should contain at least 2 TS packets: PAT and PMT, each starting with 0x47
                            if (data[i] === 0x47 && data[i + PACKET_LENGTH] === 0x47) {
                                return i;
                            }
                            i++;
                        }
                        return -1;
                    }

                    /**
                     * Creates a track model internal to demuxer used to drive remuxing input
                     *
                     * @param type 'audio' | 'video' | 'id3' | 'text'
                     * @param duration
                     * @return TSDemuxer's internal track model
                     */
                    static createTrack(type, duration) {
                        return {
                            container: type === 'video' || type === 'audio' ? 'video/mp2t' : undefined,
                            type,
                            id: _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_5__.RemuxerTrackIdConfig[type],
                            pid: -1,
                            inputTimeScale: 90000,
                            sequenceNumber: 0,
                            samples: [],
                            dropped: 0,
                            duration: type === 'audio' ? duration : undefined
                        };
                    }

                    /**
                     * Initializes a new init segment on the demuxer/remuxer interface. Needed for discontinuities/track-switches (or at stream start)
                     * Resets all internal track instances of the demuxer.
                     */
                    resetInitSegment(initSegment, audioCodec, videoCodec, trackDuration) {
                        this.pmtParsed = false;
                        this._pmtId = -1;
                        this._avcTrack = TSDemuxer.createTrack('video');
                        this._audioTrack = TSDemuxer.createTrack('audio', trackDuration);
                        this._id3Track = TSDemuxer.createTrack('id3');
                        this._txtTrack = TSDemuxer.createTrack('text');
                        this._audioTrack.segmentCodec = 'aac';

                        // flush any partial content
                        this.aacOverFlow = null;
                        this.avcSample = null;
                        this.remainderData = null;
                        this.audioCodec = audioCodec;
                        this.videoCodec = videoCodec;
                        this._duration = trackDuration;
                    }
                    resetTimeStamp() { }
                    resetContiguity() {
                        const {
                            _audioTrack,
                            _avcTrack,
                            _id3Track
                        } = this;
                        if (_audioTrack) {
                            _audioTrack.pesData = null;
                        }
                        if (_avcTrack) {
                            _avcTrack.pesData = null;
                        }
                        if (_id3Track) {
                            _id3Track.pesData = null;
                        }
                        this.aacOverFlow = null;
                        this.avcSample = null;
                        this.remainderData = null;
                    }
                    demux(data, timeOffset, isSampleAes = false, flush = false) {
                        if (!isSampleAes) {
                            this.sampleAes = null;
                        }
                        let pes;
                        const videoTrack = this._avcTrack;
                        const audioTrack = this._audioTrack;
                        const id3Track = this._id3Track;
                        const textTrack = this._txtTrack;
                        let avcId = videoTrack.pid;
                        let avcData = videoTrack.pesData;
                        let audioId = audioTrack.pid;
                        let id3Id = id3Track.pid;
                        let audioData = audioTrack.pesData;
                        let id3Data = id3Track.pesData;
                        let unknownPID = null;
                        let pmtParsed = this.pmtParsed;
                        let pmtId = this._pmtId;
                        let len = data.length;
                        if (this.remainderData) {
                            data = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_5__.appendUint8Array)(this.remainderData, data);
                            len = data.length;
                            this.remainderData = null;
                        }
                        if (len < PACKET_LENGTH && !flush) {
                            this.remainderData = data;
                            return {
                                audioTrack,
                                videoTrack,
                                id3Track,
                                textTrack
                            };
                        }
                        const syncOffset = Math.max(0, TSDemuxer.syncOffset(data));
                        len -= (len - syncOffset) % PACKET_LENGTH;
                        if (len < data.byteLength && !flush) {
                            this.remainderData = new Uint8Array(data.buffer, len, data.buffer.byteLength - len);
                        }

                        // loop through TS packets
                        let tsPacketErrors = 0;
                        for (let start = syncOffset; start < len; start += PACKET_LENGTH) {
                            if (data[start] === 0x47) {
                                const stt = !!(data[start + 1] & 0x40);
                                // pid is a 13-bit field starting at the last bit of TS[1]
                                const pid = ((data[start + 1] & 0x1f) << 8) + data[start + 2];
                                const atf = (data[start + 3] & 0x30) >> 4;

                                // if an adaption field is present, its length is specified by the fifth byte of the TS packet header.
                                let offset;
                                if (atf > 1) {
                                    offset = start + 5 + data[start + 4];
                                    // continue if there is only adaptation field
                                    if (offset === start + PACKET_LENGTH) {
                                        continue;
                                    }
                                } else {
                                    offset = start + 4;
                                }
                                switch (pid) {
                                    case avcId:
                                        if (stt) {
                                            if (avcData && (pes = parsePES(avcData))) {
                                                this.parseAVCPES(videoTrack, textTrack, pes, false);
                                            }
                                            avcData = {
                                                data: [],
                                                size: 0
                                            };
                                        }
                                        if (avcData) {
                                            avcData.data.push(data.subarray(offset, start + PACKET_LENGTH));
                                            avcData.size += start + PACKET_LENGTH - offset;
                                        }
                                        break;
                                    case audioId:
                                        if (stt) {
                                            if (audioData && (pes = parsePES(audioData))) {
                                                switch (audioTrack.segmentCodec) {
                                                    case 'aac':
                                                        this.parseAACPES(audioTrack, pes);
                                                        break;
                                                    case 'mp3':
                                                        this.parseMPEGPES(audioTrack, pes);
                                                        break;
                                                }
                                            }
                                            audioData = {
                                                data: [],
                                                size: 0
                                            };
                                        }
                                        if (audioData) {
                                            audioData.data.push(data.subarray(offset, start + PACKET_LENGTH));
                                            audioData.size += start + PACKET_LENGTH - offset;
                                        }
                                        break;
                                    case id3Id:
                                        if (stt) {
                                            if (id3Data && (pes = parsePES(id3Data))) {
                                                this.parseID3PES(id3Track, pes);
                                            }
                                            id3Data = {
                                                data: [],
                                                size: 0
                                            };
                                        }
                                        if (id3Data) {
                                            id3Data.data.push(data.subarray(offset, start + PACKET_LENGTH));
                                            id3Data.size += start + PACKET_LENGTH - offset;
                                        }
                                        break;
                                    case 0:
                                        if (stt) {
                                            offset += data[offset] + 1;
                                        }
                                        pmtId = this._pmtId = parsePAT(data, offset);
                                        break;
                                    case pmtId:
                                        {
                                            if (stt) {
                                                offset += data[offset] + 1;
                                            }
                                            const parsedPIDs = parsePMT(data, offset, this.typeSupported, isSampleAes);

                                            // only update track id if track PID found while parsing PMT
                                            // this is to avoid resetting the PID to -1 in case
                                            // track PID transiently disappears from the stream
                                            // this could happen in case of transient missing audio samples for example
                                            // NOTE this is only the PID of the track as found in TS,
                                            // but we are not using this for MP4 track IDs.
                                            avcId = parsedPIDs.avc;
                                            if (avcId > 0) {
                                                videoTrack.pid = avcId;
                                            }
                                            audioId = parsedPIDs.audio;
                                            if (audioId > 0) {
                                                audioTrack.pid = audioId;
                                                audioTrack.segmentCodec = parsedPIDs.segmentCodec;
                                            }
                                            id3Id = parsedPIDs.id3;
                                            if (id3Id > 0) {
                                                id3Track.pid = id3Id;
                                            }
                                            if (unknownPID !== null && !pmtParsed) {
                                                _utils_logger__WEBPACK_IMPORTED_MODULE_6__.logger.log(`unknown PID '${unknownPID}' in TS found`);
                                                unknownPID = null;
                                                // we set it to -188, the += 188 in the for loop will reset start to 0
                                                start = syncOffset - 188;
                                            }
                                            pmtParsed = this.pmtParsed = true;
                                            break;
                                        }
                                    case 17:
                                    case 0x1fff:
                                        break;
                                    default:
                                        unknownPID = pid;
                                        break;
                                }
                            } else {
                                tsPacketErrors++;
                            }
                        }
                        if (tsPacketErrors > 0) {
                            this.observer.emit(_events__WEBPACK_IMPORTED_MODULE_4__.Events.ERROR, _events__WEBPACK_IMPORTED_MODULE_4__.Events.ERROR, {
                                type: _errors__WEBPACK_IMPORTED_MODULE_7__.ErrorTypes.MEDIA_ERROR,
                                details: _errors__WEBPACK_IMPORTED_MODULE_7__.ErrorDetails.FRAG_PARSING_ERROR,
                                fatal: false,
                                reason: `Found ${tsPacketErrors} TS packet/s that do not start with 0x47`
                            });
                        }
                        videoTrack.pesData = avcData;
                        audioTrack.pesData = audioData;
                        id3Track.pesData = id3Data;
                        const demuxResult = {
                            audioTrack,
                            videoTrack,
                            id3Track,
                            textTrack
                        };
                        if (flush) {
                            this.extractRemainingSamples(demuxResult);
                        }
                        return demuxResult;
                    }
                    flush() {
                        const {
                            remainderData
                        } = this;
                        this.remainderData = null;
                        let result;
                        if (remainderData) {
                            result = this.demux(remainderData, -1, false, true);
                        } else {
                            result = {
                                videoTrack: this._avcTrack,
                                audioTrack: this._audioTrack,
                                id3Track: this._id3Track,
                                textTrack: this._txtTrack
                            };
                        }
                        this.extractRemainingSamples(result);
                        if (this.sampleAes) {
                            return this.decrypt(result, this.sampleAes);
                        }
                        return result;
                    }
                    extractRemainingSamples(demuxResult) {
                        const {
                            audioTrack,
                            videoTrack,
                            id3Track,
                            textTrack
                        } = demuxResult;
                        const avcData = videoTrack.pesData;
                        const audioData = audioTrack.pesData;
                        const id3Data = id3Track.pesData;
                        // try to parse last PES packets
                        let pes;
                        if (avcData && (pes = parsePES(avcData))) {
                            this.parseAVCPES(videoTrack, textTrack, pes, true);
                            videoTrack.pesData = null;
                        } else {
                            // either avcData null or PES truncated, keep it for next frag parsing
                            videoTrack.pesData = avcData;
                        }
                        if (audioData && (pes = parsePES(audioData))) {
                            switch (audioTrack.segmentCodec) {
                                case 'aac':
                                    this.parseAACPES(audioTrack, pes);
                                    break;
                                case 'mp3':
                                    this.parseMPEGPES(audioTrack, pes);
                                    break;
                            }
                            audioTrack.pesData = null;
                        } else {
                            if (audioData?.size) {
                                _utils_logger__WEBPACK_IMPORTED_MODULE_6__.logger.log('last AAC PES packet truncated,might overlap between fragments');
                            }

                            // either audioData null or PES truncated, keep it for next frag parsing
                            audioTrack.pesData = audioData;
                        }
                        if (id3Data && (pes = parsePES(id3Data))) {
                            this.parseID3PES(id3Track, pes);
                            id3Track.pesData = null;
                        } else {
                            // either id3Data null or PES truncated, keep it for next frag parsing
                            id3Track.pesData = id3Data;
                        }
                    }
                    demuxSampleAes(data, keyData, timeOffset) {
                        const demuxResult = this.demux(data, timeOffset, true, !this.config.progressive);
                        const sampleAes = this.sampleAes = new _sample_aes__WEBPACK_IMPORTED_MODULE_3__["default"](this.observer, this.config, keyData);
                        return this.decrypt(demuxResult, sampleAes);
                    }
                    decrypt(demuxResult, sampleAes) {
                        return new Promise(resolve => {
                            const {
                                audioTrack,
                                videoTrack
                            } = demuxResult;
                            if (audioTrack.samples && audioTrack.segmentCodec === 'aac') {
                                sampleAes.decryptAacSamples(audioTrack.samples, 0, () => {
                                    if (videoTrack.samples) {
                                        sampleAes.decryptAvcSamples(videoTrack.samples, 0, 0, () => {
                                            resolve(demuxResult);
                                        });
                                    } else {
                                        resolve(demuxResult);
                                    }
                                });
                            } else if (videoTrack.samples) {
                                sampleAes.decryptAvcSamples(videoTrack.samples, 0, 0, () => {
                                    resolve(demuxResult);
                                });
                            }
                        });
                    }
                    destroy() {
                        this._duration = 0;
                    }
                    parseAVCPES(track, textTrack, pes, last) {
                        const units = this.parseAVCNALu(track, pes.data);
                        const debug = false;
                        let avcSample = this.avcSample;
                        let push;
                        let spsfound = false;
                        // free pes.data to save up some memory
                        pes.data = null;

                        // if new NAL units found and last sample still there, let's push ...
                        // this helps parsing streams with missing AUD (only do this if AUD never found)
                        if (avcSample && units.length && !track.audFound) {
                            pushAccessUnit(avcSample, track);
                            avcSample = this.avcSample = createAVCSample(false, pes.pts, pes.dts, '');
                        }
                        units.forEach(unit => {
                            switch (unit.type) {
                                // NDR
                                case 1:
                                    {
                                        push = true;
                                        if (!avcSample) {
                                            avcSample = this.avcSample = createAVCSample(true, pes.pts, pes.dts, '');
                                        }
                                        if (debug) {
                                            avcSample.debug += 'NDR ';
                                        }
                                        avcSample.frame = true;
                                        const data = unit.data;
                                        // only check slice type to detect KF in case SPS found in same packet (any keyframe is preceded by SPS ...)
                                        if (spsfound && data.length > 4) {
                                            // retrieve slice type by parsing beginning of NAL unit (follow H264 spec, slice_header definition) to detect keyframe embedded in NDR
                                            const sliceType = new _exp_golomb__WEBPACK_IMPORTED_MODULE_2__["default"](data).readSliceType();
                                            // 2 : I slice, 4 : SI slice, 7 : I slice, 9: SI slice
                                            // SI slice : A slice that is coded using intra prediction only and using quantisation of the prediction samples.
                                            // An SI slice can be coded such that its decoded samples can be constructed identically to an SP slice.
                                            // I slice: A slice that is not an SI slice that is decoded using intra prediction only.
                                            // if (sliceType === 2 || sliceType === 7) {
                                            if (sliceType === 2 || sliceType === 4 || sliceType === 7 || sliceType === 9) {
                                                avcSample.key = true;
                                            }
                                        }
                                        break;
                                        // IDR
                                    }

                                case 5:
                                    push = true;
                                    // handle PES not starting with AUD
                                    if (!avcSample) {
                                        avcSample = this.avcSample = createAVCSample(true, pes.pts, pes.dts, '');
                                    }
                                    if (debug) {
                                        avcSample.debug += 'IDR ';
                                    }
                                    avcSample.key = true;
                                    avcSample.frame = true;
                                    break;
                                // SEI
                                case 6:
                                    {
                                        push = true;
                                        if (debug && avcSample) {
                                            avcSample.debug += 'SEI ';
                                        }
                                        (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_5__.parseSEIMessageFromNALu)(unit.data, 1, pes.pts, textTrack.samples);
                                        break;
                                        // SPS
                                    }

                                case 7:
                                    push = true;
                                    spsfound = true;
                                    if (debug && avcSample) {
                                        avcSample.debug += 'SPS ';
                                    }
                                    if (!track.sps) {
                                        const expGolombDecoder = new _exp_golomb__WEBPACK_IMPORTED_MODULE_2__["default"](unit.data);
                                        const config = expGolombDecoder.readSPS();
                                        track.width = config.width;
                                        track.height = config.height;
                                        track.pixelRatio = config.pixelRatio;
                                        // TODO: `track.sps` is defined as a `number[]`, but we're setting it to a `Uint8Array[]`.
                                        track.sps = [unit.data];
                                        track.duration = this._duration;
                                        const codecarray = unit.data.subarray(1, 4);
                                        let codecstring = 'avc1.';
                                        for (let i = 0; i < 3; i++) {
                                            let h = codecarray[i].toString(16);
                                            if (h.length < 2) {
                                                h = '0' + h;
                                            }
                                            codecstring += h;
                                        }
                                        track.codec = codecstring;
                                    }
                                    break;
                                // PPS
                                case 8:
                                    push = true;
                                    if (debug && avcSample) {
                                        avcSample.debug += 'PPS ';
                                    }
                                    if (!track.pps) {
                                        // TODO: `track.pss` is defined as a `number[]`, but we're setting it to a `Uint8Array[]`.
                                        track.pps = [unit.data];
                                    }
                                    break;
                                // AUD
                                case 9:
                                    push = false;
                                    track.audFound = true;
                                    if (avcSample) {
                                        pushAccessUnit(avcSample, track);
                                    }
                                    avcSample = this.avcSample = createAVCSample(false, pes.pts, pes.dts, debug ? 'AUD ' : '');
                                    break;
                                // Filler Data
                                case 12:
                                    push = true;
                                    break;
                                default:
                                    push = false;
                                    if (avcSample) {
                                        avcSample.debug += 'unknown NAL ' + unit.type + ' ';
                                    }
                                    break;
                            }
                            if (avcSample && push) {
                                const units = avcSample.units;
                                units.push(unit);
                            }
                        });
                        // if last PES packet, push samples
                        if (last && avcSample) {
                            pushAccessUnit(avcSample, track);
                            this.avcSample = null;
                        }
                    }
                    getLastNalUnit(samples) {
                        let avcSample = this.avcSample;
                        let lastUnit;
                        // try to fallback to previous sample if current one is empty
                        if (!avcSample || avcSample.units.length === 0) {
                            avcSample = samples[samples.length - 1];
                        }
                        if (avcSample?.units) {
                            const units = avcSample.units;
                            lastUnit = units[units.length - 1];
                        }
                        return lastUnit;
                    }
                    parseAVCNALu(track, array) {
                        const len = array.byteLength;
                        let state = track.naluState || 0;
                        const lastState = state;
                        const units = [];
                        let i = 0;
                        let value;
                        let overflow;
                        let unitType;
                        let lastUnitStart = -1;
                        let lastUnitType = 0;
                        // logger.log('PES:' + Hex.hexDump(array));

                        if (state === -1) {
                            // special use case where we found 3 or 4-byte start codes exactly at the end of previous PES packet
                            lastUnitStart = 0;
                            // NALu type is value read from offset 0
                            lastUnitType = array[0] & 0x1f;
                            state = 0;
                            i = 1;
                        }
                        while (i < len) {
                            value = array[i++];
                            // optimization. state 0 and 1 are the predominant case. let's handle them outside of the switch/case
                            if (!state) {
                                state = value ? 0 : 1;
                                continue;
                            }
                            if (state === 1) {
                                state = value ? 0 : 2;
                                continue;
                            }
                            // here we have state either equal to 2 or 3
                            if (!value) {
                                state = 3;
                            } else if (value === 1) {
                                if (lastUnitStart >= 0) {
                                    const unit = {
                                        data: array.subarray(lastUnitStart, i - state - 1),
                                        type: lastUnitType
                                    };
                                    // logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
                                    units.push(unit);
                                } else {
                                    // lastUnitStart is undefined => this is the first start code found in this PES packet
                                    // first check if start code delimiter is overlapping between 2 PES packets,
                                    // ie it started in last packet (lastState not zero)
                                    // and ended at the beginning of this PES packet (i <= 4 - lastState)
                                    const lastUnit = this.getLastNalUnit(track.samples);
                                    if (lastUnit) {
                                        if (lastState && i <= 4 - lastState) {
                                            // start delimiter overlapping between PES packets
                                            // strip start delimiter bytes from the end of last NAL unit
                                            // check if lastUnit had a state different from zero
                                            if (lastUnit.state) {
                                                // strip last bytes
                                                lastUnit.data = lastUnit.data.subarray(0, lastUnit.data.byteLength - lastState);
                                            }
                                        }
                                        // If NAL units are not starting right at the beginning of the PES packet, push preceding data into previous NAL unit.
                                        overflow = i - state - 1;
                                        if (overflow > 0) {
                                            // logger.log('first NALU found with overflow:' + overflow);
                                            const tmp = new Uint8Array(lastUnit.data.byteLength + overflow);
                                            tmp.set(lastUnit.data, 0);
                                            tmp.set(array.subarray(0, overflow), lastUnit.data.byteLength);
                                            lastUnit.data = tmp;
                                            lastUnit.state = 0;
                                        }
                                    }
                                }
                                // check if we can read unit type
                                if (i < len) {
                                    unitType = array[i] & 0x1f;
                                    // logger.log('find NALU @ offset:' + i + ',type:' + unitType);
                                    lastUnitStart = i;
                                    lastUnitType = unitType;
                                    state = 0;
                                } else {
                                    // not enough byte to read unit type. let's read it on next PES parsing
                                    state = -1;
                                }
                            } else {
                                state = 0;
                            }
                        }
                        if (lastUnitStart >= 0 && state >= 0) {
                            const unit = {
                                data: array.subarray(lastUnitStart, len),
                                type: lastUnitType,
                                state: state
                            };
                            units.push(unit);
                            // logger.log('pushing NALU, type/size/state:' + unit.type + '/' + unit.data.byteLength + '/' + state);
                        }
                        // no NALu found
                        if (units.length === 0) {
                            // append pes.data to previous NAL unit
                            const lastUnit = this.getLastNalUnit(track.samples);
                            if (lastUnit) {
                                const tmp = new Uint8Array(lastUnit.data.byteLength + array.byteLength);
                                tmp.set(lastUnit.data, 0);
                                tmp.set(array, lastUnit.data.byteLength);
                                lastUnit.data = tmp;
                            }
                        }
                        track.naluState = state;
                        return units;
                    }
                    parseAACPES(track, pes) {
                        let startOffset = 0;
                        const aacOverFlow = this.aacOverFlow;
                        let data = pes.data;
                        if (aacOverFlow) {
                            this.aacOverFlow = null;
                            const frameMissingBytes = aacOverFlow.missing;
                            const sampleLength = aacOverFlow.sample.unit.byteLength;
                            // logger.log(`AAC: append overflowing ${sampleLength} bytes to beginning of new PES`);
                            if (frameMissingBytes === -1) {
                                const tmp = new Uint8Array(sampleLength + data.byteLength);
                                tmp.set(aacOverFlow.sample.unit, 0);
                                tmp.set(data, sampleLength);
                                data = tmp;
                            } else {
                                const frameOverflowBytes = sampleLength - frameMissingBytes;
                                aacOverFlow.sample.unit.set(data.subarray(0, frameMissingBytes), frameOverflowBytes);
                                track.samples.push(aacOverFlow.sample);
                                startOffset = aacOverFlow.missing;
                            }
                        }
                        // look for ADTS header (0xFFFx)
                        let offset;
                        let len;
                        for (offset = startOffset, len = data.length; offset < len - 1; offset++) {
                            if (_adts__WEBPACK_IMPORTED_MODULE_0__.isHeader(data, offset)) {
                                break;
                            }
                        }
                        // if ADTS header does not start straight from the beginning of the PES payload, raise an error
                        if (offset !== startOffset) {
                            let reason;
                            let fatal;
                            if (offset < len - 1) {
                                reason = `AAC PES did not start with ADTS header,offset:${offset}`;
                                fatal = false;
                            } else {
                                reason = 'no ADTS header found in AAC PES';
                                fatal = true;
                            }
                            _utils_logger__WEBPACK_IMPORTED_MODULE_6__.logger.warn(`parsing error:${reason}`);
                            this.observer.emit(_events__WEBPACK_IMPORTED_MODULE_4__.Events.ERROR, _events__WEBPACK_IMPORTED_MODULE_4__.Events.ERROR, {
                                type: _errors__WEBPACK_IMPORTED_MODULE_7__.ErrorTypes.MEDIA_ERROR,
                                details: _errors__WEBPACK_IMPORTED_MODULE_7__.ErrorDetails.FRAG_PARSING_ERROR,
                                fatal,
                                reason
                            });
                            if (fatal) {
                                return;
                            }
                        }
                        _adts__WEBPACK_IMPORTED_MODULE_0__.initTrackConfig(track, this.observer, data, offset, this.audioCodec);
                        let pts;
                        if (pes.pts !== undefined) {
                            pts = pes.pts;
                        } else if (aacOverFlow) {
                            // if last AAC frame is overflowing, we should ensure timestamps are contiguous:
                            // first sample PTS should be equal to last sample PTS + frameDuration
                            const frameDuration = _adts__WEBPACK_IMPORTED_MODULE_0__.getFrameDuration(track.samplerate);
                            pts = aacOverFlow.sample.pts + frameDuration;
                        } else {
                            _utils_logger__WEBPACK_IMPORTED_MODULE_6__.logger.warn('[tsdemuxer]: AAC PES unknown PTS');
                            return;
                        }

                        // scan for aac samples
                        let frameIndex = 0;
                        let frame;
                        while (offset < len) {
                            frame = _adts__WEBPACK_IMPORTED_MODULE_0__.appendFrame(track, data, offset, pts, frameIndex);
                            offset += frame.length;
                            if (!frame.missing) {
                                frameIndex++;
                                for (; offset < len - 1; offset++) {
                                    if (_adts__WEBPACK_IMPORTED_MODULE_0__.isHeader(data, offset)) {
                                        break;
                                    }
                                }
                            } else {
                                this.aacOverFlow = frame;
                                break;
                            }
                        }
                    }
                    parseMPEGPES(track, pes) {
                        const data = pes.data;
                        const length = data.length;
                        let frameIndex = 0;
                        let offset = 0;
                        const pts = pes.pts;
                        if (pts === undefined) {
                            _utils_logger__WEBPACK_IMPORTED_MODULE_6__.logger.warn('[tsdemuxer]: MPEG PES unknown PTS');
                            return;
                        }
                        while (offset < length) {
                            if (_mpegaudio__WEBPACK_IMPORTED_MODULE_1__.isHeader(data, offset)) {
                                const frame = _mpegaudio__WEBPACK_IMPORTED_MODULE_1__.appendFrame(track, data, offset, pts, frameIndex);
                                if (frame) {
                                    offset += frame.length;
                                    frameIndex++;
                                } else {
                                    // logger.log('Unable to parse Mpeg audio frame');
                                    break;
                                }
                            } else {
                                // nothing found, keep looking
                                offset++;
                            }
                        }
                    }
                    parseID3PES(id3Track, pes) {
                        if (pes.pts === undefined) {
                            _utils_logger__WEBPACK_IMPORTED_MODULE_6__.logger.warn('[tsdemuxer]: ID3 PES unknown PTS');
                            return;
                        }
                        const id3Sample = Object.assign({}, pes, {
                            type: this._avcTrack ? _types_demuxer__WEBPACK_IMPORTED_MODULE_8__.MetadataSchema.emsg : _types_demuxer__WEBPACK_IMPORTED_MODULE_8__.MetadataSchema.audioId3,
                            duration: Number.POSITIVE_INFINITY
                        });
                        id3Track.samples.push(id3Sample);
                    }
                }
                function createAVCSample(key, pts, dts, debug) {
                    return {
                        key,
                        frame: false,
                        pts,
                        dts,
                        units: [],
                        debug,
                        length: 0
                    };
                }
                function parsePAT(data, offset) {
                    // skip the PSI header and parse the first PMT entry
                    return (data[offset + 10] & 0x1f) << 8 | data[offset + 11];
                    // logger.log('PMT PID:'  + this._pmtId);
                }

                function parsePMT(data, offset, typeSupported, isSampleAes) {
                    const result = {
                        audio: -1,
                        avc: -1,
                        id3: -1,
                        segmentCodec: 'aac'
                    };
                    const sectionLength = (data[offset + 1] & 0x0f) << 8 | data[offset + 2];
                    const tableEnd = offset + 3 + sectionLength - 4;
                    // to determine where the table is, we have to figure out how
                    // long the program info descriptors are
                    const programInfoLength = (data[offset + 10] & 0x0f) << 8 | data[offset + 11];
                    // advance the offset to the first entry in the mapping table
                    offset += 12 + programInfoLength;
                    while (offset < tableEnd) {
                        const pid = (data[offset + 1] & 0x1f) << 8 | data[offset + 2];
                        switch (data[offset]) {
                            case 0xcf:
                                // SAMPLE-AES AAC
                                if (!isSampleAes) {
                                    _utils_logger__WEBPACK_IMPORTED_MODULE_6__.logger.log('ADTS AAC with AES-128-CBC frame encryption found in unencrypted stream');
                                    break;
                                }
                            /* falls through */
                            case 0x0f:
                                // ISO/IEC 13818-7 ADTS AAC (MPEG-2 lower bit-rate audio)
                                // logger.log('AAC PID:'  + pid);
                                if (result.audio === -1) {
                                    result.audio = pid;
                                }
                                break;

                            // Packetized metadata (ID3)
                            case 0x15:
                                // logger.log('ID3 PID:'  + pid);
                                if (result.id3 === -1) {
                                    result.id3 = pid;
                                }
                                break;
                            case 0xdb:
                                // SAMPLE-AES AVC
                                if (!isSampleAes) {
                                    _utils_logger__WEBPACK_IMPORTED_MODULE_6__.logger.log('H.264 with AES-128-CBC slice encryption found in unencrypted stream');
                                    break;
                                }
                            /* falls through */
                            case 0x1b:
                                // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
                                // logger.log('AVC PID:'  + pid);
                                if (result.avc === -1) {
                                    result.avc = pid;
                                }
                                break;

                            // ISO/IEC 11172-3 (MPEG-1 audio)
                            // or ISO/IEC 13818-3 (MPEG-2 halved sample rate audio)
                            case 0x03:
                            case 0x04:
                                // logger.log('MPEG PID:'  + pid);
                                if (typeSupported.mpeg !== true && typeSupported.mp3 !== true) {
                                    _utils_logger__WEBPACK_IMPORTED_MODULE_6__.logger.log('MPEG audio found, not supported in this browser');
                                } else if (result.audio === -1) {
                                    result.audio = pid;
                                    result.segmentCodec = 'mp3';
                                }
                                break;
                            case 0x24:
                                _utils_logger__WEBPACK_IMPORTED_MODULE_6__.logger.warn('Unsupported HEVC stream type found');
                                break;
                            default:
                                // logger.log('unknown stream type:' + data[offset]);
                                break;
                        }
                        // move to the next table entry
                        // skip past the elementary stream descriptors, if present
                        offset += ((data[offset + 3] & 0x0f) << 8 | data[offset + 4]) + 5;
                    }
                    return result;
                }
                function parsePES(stream) {
                    let i = 0;
                    let frag;
                    let pesLen;
                    let pesHdrLen;
                    let pesPts;
                    let pesDts;
                    const data = stream.data;
                    // safety check
                    if (!stream || stream.size === 0) {
                        return null;
                    }

                    // we might need up to 19 bytes to read PES header
                    // if first chunk of data is less than 19 bytes, let's merge it with following ones until we get 19 bytes
                    // usually only one merge is needed (and this is rare ...)
                    while (data[0].length < 19 && data.length > 1) {
                        const newData = new Uint8Array(data[0].length + data[1].length);
                        newData.set(data[0]);
                        newData.set(data[1], data[0].length);
                        data[0] = newData;
                        data.splice(1, 1);
                    }
                    // retrieve PTS/DTS from first fragment
                    frag = data[0];
                    const pesPrefix = (frag[0] << 16) + (frag[1] << 8) + frag[2];
                    if (pesPrefix === 1) {
                        pesLen = (frag[4] << 8) + frag[5];
                        // if PES parsed length is not zero and greater than total received length, stop parsing. PES might be truncated
                        // minus 6 : PES header size
                        if (pesLen && pesLen > stream.size - 6) {
                            return null;
                        }
                        const pesFlags = frag[7];
                        if (pesFlags & 0xc0) {
                            /* PES header described here : http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
                                as PTS / DTS is 33 bit we cannot use bitwise operator in JS,
                                as Bitwise operators treat their operands as a sequence of 32 bits */
                            pesPts = (frag[9] & 0x0e) * 536870912 +
                                // 1 << 29
                                (frag[10] & 0xff) * 4194304 +
                                // 1 << 22
                                (frag[11] & 0xfe) * 16384 +
                                // 1 << 14
                                (frag[12] & 0xff) * 128 +
                                // 1 << 7
                                (frag[13] & 0xfe) / 2;
                            if (pesFlags & 0x40) {
                                pesDts = (frag[14] & 0x0e) * 536870912 +
                                    // 1 << 29
                                    (frag[15] & 0xff) * 4194304 +
                                    // 1 << 22
                                    (frag[16] & 0xfe) * 16384 +
                                    // 1 << 14
                                    (frag[17] & 0xff) * 128 +
                                    // 1 << 7
                                    (frag[18] & 0xfe) / 2;
                                if (pesPts - pesDts > 60 * 90000) {
                                    _utils_logger__WEBPACK_IMPORTED_MODULE_6__.logger.warn(`${Math.round((pesPts - pesDts) / 90000)}s delta between PTS and DTS, align them`);
                                    pesPts = pesDts;
                                }
                            } else {
                                pesDts = pesPts;
                            }
                        }
                        pesHdrLen = frag[8];
                        // 9 bytes : 6 bytes for PES header + 3 bytes for PES extension
                        let payloadStartOffset = pesHdrLen + 9;
                        if (stream.size <= payloadStartOffset) {
                            return null;
                        }
                        stream.size -= payloadStartOffset;
                        // reassemble PES packet
                        const pesData = new Uint8Array(stream.size);
                        for (let j = 0, dataLen = data.length; j < dataLen; j++) {
                            frag = data[j];
                            let len = frag.byteLength;
                            if (payloadStartOffset) {
                                if (payloadStartOffset > len) {
                                    // trim full frag if PES header bigger than frag
                                    payloadStartOffset -= len;
                                    continue;
                                } else {
                                    // trim partial frag if PES header smaller than frag
                                    frag = frag.subarray(payloadStartOffset);
                                    len -= payloadStartOffset;
                                    payloadStartOffset = 0;
                                }
                            }
                            pesData.set(frag, i);
                            i += len;
                        }
                        if (pesLen) {
                            // payload size : remove PES header + PES extension
                            pesLen -= pesHdrLen + 3;
                        }
                        return {
                            data: pesData,
                            pts: pesPts,
                            dts: pesDts,
                            len: pesLen
                        };
                    }
                    return null;
                }
                function pushAccessUnit(avcSample, avcTrack) {
                    if (avcSample.units.length && avcSample.frame) {
                        // if sample does not have PTS/DTS, patch with last sample PTS/DTS
                        if (avcSample.pts === undefined) {
                            const samples = avcTrack.samples;
                            const nbSamples = samples.length;
                            if (nbSamples) {
                                const lastSample = samples[nbSamples - 1];
                                avcSample.pts = lastSample.pts;
                                avcSample.dts = lastSample.dts;
                            } else {
                                // dropping samples, no timestamp found
                                avcTrack.dropped++;
                                return;
                            }
                        }
                        avcTrack.samples.push(avcSample);
                    }
                    if (avcSample.debug.length) {
                        _utils_logger__WEBPACK_IMPORTED_MODULE_6__.logger.log(avcSample.pts + '/' + avcSample.dts + ':' + avcSample.debug);
                    }
                }
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (TSDemuxer);

                /***/
            }),

/***/ "./src/errors.ts":
/*!***********************!*\
  !*** ./src/errors.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ErrorDetails": () => (/* binding */ ErrorDetails),
/* harmony export */   "ErrorTypes": () => (/* binding */ ErrorTypes)
                    /* harmony export */
                });
                let ErrorTypes;

                /**
                 * @enum {ErrorDetails}
                 * @typedef {string} ErrorDetail
                 */
                (function (ErrorTypes) {
                    ErrorTypes["NETWORK_ERROR"] = "networkError";
                    ErrorTypes["MEDIA_ERROR"] = "mediaError";
                    ErrorTypes["KEY_SYSTEM_ERROR"] = "keySystemError";
                    ErrorTypes["MUX_ERROR"] = "muxError";
                    ErrorTypes["OTHER_ERROR"] = "otherError";
                })(ErrorTypes || (ErrorTypes = {}));
                let ErrorDetails;
                (function (ErrorDetails) {
                    ErrorDetails["KEY_SYSTEM_NO_KEYS"] = "keySystemNoKeys";
                    ErrorDetails["KEY_SYSTEM_NO_ACCESS"] = "keySystemNoAccess";
                    ErrorDetails["KEY_SYSTEM_NO_SESSION"] = "keySystemNoSession";
                    ErrorDetails["KEY_SYSTEM_NO_CONFIGURED_LICENSE"] = "keySystemNoConfiguredLicense";
                    ErrorDetails["KEY_SYSTEM_LICENSE_REQUEST_FAILED"] = "keySystemLicenseRequestFailed";
                    ErrorDetails["KEY_SYSTEM_SERVER_CERTIFICATE_REQUEST_FAILED"] = "keySystemServerCertificateRequestFailed";
                    ErrorDetails["KEY_SYSTEM_SERVER_CERTIFICATE_UPDATE_FAILED"] = "keySystemServerCertificateUpdateFailed";
                    ErrorDetails["KEY_SYSTEM_SESSION_UPDATE_FAILED"] = "keySystemSessionUpdateFailed";
                    ErrorDetails["KEY_SYSTEM_STATUS_OUTPUT_RESTRICTED"] = "keySystemStatusOutputRestricted";
                    ErrorDetails["KEY_SYSTEM_STATUS_INTERNAL_ERROR"] = "keySystemStatusInternalError";
                    ErrorDetails["MANIFEST_LOAD_ERROR"] = "manifestLoadError";
                    ErrorDetails["MANIFEST_LOAD_TIMEOUT"] = "manifestLoadTimeOut";
                    ErrorDetails["MANIFEST_PARSING_ERROR"] = "manifestParsingError";
                    ErrorDetails["MANIFEST_INCOMPATIBLE_CODECS_ERROR"] = "manifestIncompatibleCodecsError";
                    ErrorDetails["LEVEL_EMPTY_ERROR"] = "levelEmptyError";
                    ErrorDetails["LEVEL_LOAD_ERROR"] = "levelLoadError";
                    ErrorDetails["LEVEL_LOAD_TIMEOUT"] = "levelLoadTimeOut";
                    ErrorDetails["LEVEL_SWITCH_ERROR"] = "levelSwitchError";
                    ErrorDetails["AUDIO_TRACK_LOAD_ERROR"] = "audioTrackLoadError";
                    ErrorDetails["AUDIO_TRACK_LOAD_TIMEOUT"] = "audioTrackLoadTimeOut";
                    ErrorDetails["SUBTITLE_LOAD_ERROR"] = "subtitleTrackLoadError";
                    ErrorDetails["SUBTITLE_TRACK_LOAD_TIMEOUT"] = "subtitleTrackLoadTimeOut";
                    ErrorDetails["FRAG_LOAD_ERROR"] = "fragLoadError";
                    ErrorDetails["FRAG_LOAD_TIMEOUT"] = "fragLoadTimeOut";
                    ErrorDetails["FRAG_DECRYPT_ERROR"] = "fragDecryptError";
                    ErrorDetails["FRAG_PARSING_ERROR"] = "fragParsingError";
                    ErrorDetails["REMUX_ALLOC_ERROR"] = "remuxAllocError";
                    ErrorDetails["KEY_LOAD_ERROR"] = "keyLoadError";
                    ErrorDetails["KEY_LOAD_TIMEOUT"] = "keyLoadTimeOut";
                    ErrorDetails["BUFFER_ADD_CODEC_ERROR"] = "bufferAddCodecError";
                    ErrorDetails["BUFFER_INCOMPATIBLE_CODECS_ERROR"] = "bufferIncompatibleCodecsError";
                    ErrorDetails["BUFFER_APPEND_ERROR"] = "bufferAppendError";
                    ErrorDetails["BUFFER_APPENDING_ERROR"] = "bufferAppendingError";
                    ErrorDetails["BUFFER_STALLED_ERROR"] = "bufferStalledError";
                    ErrorDetails["BUFFER_FULL_ERROR"] = "bufferFullError";
                    ErrorDetails["BUFFER_SEEK_OVER_HOLE"] = "bufferSeekOverHole";
                    ErrorDetails["BUFFER_NUDGE_ON_STALL"] = "bufferNudgeOnStall";
                    ErrorDetails["INTERNAL_EXCEPTION"] = "internalException";
                    ErrorDetails["INTERNAL_ABORTED"] = "aborted";
                    ErrorDetails["UNKNOWN"] = "unknown";
                })(ErrorDetails || (ErrorDetails = {}));

                /***/
            }),

/***/ "./src/events.ts":
/*!***********************!*\
  !*** ./src/events.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Events": () => (/* binding */ Events)
                    /* harmony export */
                });
                /**
                 * @readonly
                 * @enum {string}
                 */
                let Events;
                (function (Events) {
                    Events["MEDIA_ATTACHING"] = "hlsMediaAttaching";
                    Events["MEDIA_ATTACHED"] = "hlsMediaAttached";
                    Events["MEDIA_DETACHING"] = "hlsMediaDetaching";
                    Events["MEDIA_DETACHED"] = "hlsMediaDetached";
                    Events["BUFFER_RESET"] = "hlsBufferReset";
                    Events["BUFFER_CODECS"] = "hlsBufferCodecs";
                    Events["BUFFER_CREATED"] = "hlsBufferCreated";
                    Events["BUFFER_APPENDING"] = "hlsBufferAppending";
                    Events["BUFFER_APPENDED"] = "hlsBufferAppended";
                    Events["BUFFER_EOS"] = "hlsBufferEos";
                    Events["BUFFER_FLUSHING"] = "hlsBufferFlushing";
                    Events["BUFFER_FLUSHED"] = "hlsBufferFlushed";
                    Events["MANIFEST_LOADING"] = "hlsManifestLoading";
                    Events["MANIFEST_LOADED"] = "hlsManifestLoaded";
                    Events["MANIFEST_PARSED"] = "hlsManifestParsed";
                    Events["LEVEL_SWITCHING"] = "hlsLevelSwitching";
                    Events["LEVEL_SWITCHED"] = "hlsLevelSwitched";
                    Events["LEVEL_LOADING"] = "hlsLevelLoading";
                    Events["LEVEL_LOADED"] = "hlsLevelLoaded";
                    Events["LEVEL_UPDATED"] = "hlsLevelUpdated";
                    Events["LEVEL_PTS_UPDATED"] = "hlsLevelPtsUpdated";
                    Events["LEVELS_UPDATED"] = "hlsLevelsUpdated";
                    Events["AUDIO_TRACKS_UPDATED"] = "hlsAudioTracksUpdated";
                    Events["AUDIO_TRACK_SWITCHING"] = "hlsAudioTrackSwitching";
                    Events["AUDIO_TRACK_SWITCHED"] = "hlsAudioTrackSwitched";
                    Events["AUDIO_TRACK_LOADING"] = "hlsAudioTrackLoading";
                    Events["AUDIO_TRACK_LOADED"] = "hlsAudioTrackLoaded";
                    Events["SUBTITLE_TRACKS_UPDATED"] = "hlsSubtitleTracksUpdated";
                    Events["SUBTITLE_TRACKS_CLEARED"] = "hlsSubtitleTracksCleared";
                    Events["SUBTITLE_TRACK_SWITCH"] = "hlsSubtitleTrackSwitch";
                    Events["SUBTITLE_TRACK_LOADING"] = "hlsSubtitleTrackLoading";
                    Events["SUBTITLE_TRACK_LOADED"] = "hlsSubtitleTrackLoaded";
                    Events["SUBTITLE_FRAG_PROCESSED"] = "hlsSubtitleFragProcessed";
                    Events["CUES_PARSED"] = "hlsCuesParsed";
                    Events["NON_NATIVE_TEXT_TRACKS_FOUND"] = "hlsNonNativeTextTracksFound";
                    Events["INIT_PTS_FOUND"] = "hlsInitPtsFound";
                    Events["FRAG_LOADING"] = "hlsFragLoading";
                    Events["FRAG_LOAD_EMERGENCY_ABORTED"] = "hlsFragLoadEmergencyAborted";
                    Events["FRAG_LOADED"] = "hlsFragLoaded";
                    Events["FRAG_DECRYPTED"] = "hlsFragDecrypted";
                    Events["FRAG_PARSING_INIT_SEGMENT"] = "hlsFragParsingInitSegment";
                    Events["FRAG_PARSING_USERDATA"] = "hlsFragParsingUserdata";
                    Events["FRAG_PARSING_METADATA"] = "hlsFragParsingMetadata";
                    Events["FRAG_PARSED"] = "hlsFragParsed";
                    Events["FRAG_BUFFERED"] = "hlsFragBuffered";
                    Events["FRAG_CHANGED"] = "hlsFragChanged";
                    Events["FPS_DROP"] = "hlsFpsDrop";
                    Events["FPS_DROP_LEVEL_CAPPING"] = "hlsFpsDropLevelCapping";
                    Events["ERROR"] = "hlsError";
                    Events["DESTROYING"] = "hlsDestroying";
                    Events["KEY_LOADING"] = "hlsKeyLoading";
                    Events["KEY_LOADED"] = "hlsKeyLoaded";
                    Events["LIVE_BACK_BUFFER_REACHED"] = "hlsLiveBackBufferReached";
                    Events["BACK_BUFFER_REACHED"] = "hlsBackBufferReached";
                })(Events || (Events = {}));

                /***/
            }),

/***/ "./src/loader/fragment.ts":
/*!********************************!*\
  !*** ./src/loader/fragment.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BaseSegment": () => (/* binding */ BaseSegment),
/* harmony export */   "ElementaryStreamTypes": () => (/* binding */ ElementaryStreamTypes),
/* harmony export */   "Fragment": () => (/* binding */ Fragment),
/* harmony export */   "Part": () => (/* binding */ Part)
                    /* harmony export */
                });
/* harmony import */ var url_toolkit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! url-toolkit */ "./node_modules/url-toolkit/src/url-toolkit.js");
/* harmony import */ var url_toolkit__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(url_toolkit__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _load_stats__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./load-stats */ "./src/loader/load-stats.ts");


                let ElementaryStreamTypes;
                (function (ElementaryStreamTypes) {
                    ElementaryStreamTypes["AUDIO"] = "audio";
                    ElementaryStreamTypes["VIDEO"] = "video";
                    ElementaryStreamTypes["AUDIOVIDEO"] = "audiovideo";
                })(ElementaryStreamTypes || (ElementaryStreamTypes = {}));
                class BaseSegment {
                    _byteRange = null;
                    _url = null;

                    // baseurl is the URL to the playlist

                    // Holds the types of data this fragment supports
                    elementaryStreams = {
                        [ElementaryStreamTypes.AUDIO]: null,
                        [ElementaryStreamTypes.VIDEO]: null,
                        [ElementaryStreamTypes.AUDIOVIDEO]: null
                    };
                    constructor(baseurl) {
                        this.baseurl = baseurl;
                    }

                    // setByteRange converts a EXT-X-BYTERANGE attribute into a two element array
                    setByteRange(value, previous) {
                        const params = value.split('@', 2);
                        const byteRange = [];
                        if (params.length === 1) {
                            byteRange[0] = previous ? previous.byteRangeEndOffset : 0;
                        } else {
                            byteRange[0] = parseInt(params[1]);
                        }
                        byteRange[1] = parseInt(params[0]) + byteRange[0];
                        this._byteRange = byteRange;
                    }
                    get byteRange() {
                        if (!this._byteRange) {
                            return [];
                        }
                        return this._byteRange;
                    }
                    get byteRangeStartOffset() {
                        return this.byteRange[0];
                    }
                    get byteRangeEndOffset() {
                        return this.byteRange[1];
                    }
                    get url() {
                        if (!this._url && this.baseurl && this.relurl) {
                            this._url = (0, url_toolkit__WEBPACK_IMPORTED_MODULE_0__.buildAbsoluteURL)(this.baseurl, this.relurl, {
                                alwaysNormalize: true
                            });
                        }
                        return this._url || '';
                    }
                    set url(value) {
                        this._url = value;
                    }
                }
                class Fragment extends BaseSegment {
                    _decryptdata = null;
                    rawProgramDateTime = null;
                    programDateTime = null;
                    tagList = [];

                    // EXTINF has to be present for a m3u8 to be considered valid
                    duration = 0;
                    // sn notates the sequence number for a segment, and if set to a string can be 'initSegment'
                    sn = 0;
                    // levelkeys are the EXT-X-KEY tags that apply to this segment for decryption
                    // core difference from the private field _decryptdata is the lack of the initialized IV
                    // _decryptdata will set the IV for this segment based on the segment number in the fragment

                    // A reference to the loader. Set while the fragment is loading, and removed afterwards. Used to abort fragment loading
                    loader = null;
                    // A reference to the key loader. Set while the key is loading, and removed afterwards. Used to abort key loading
                    keyLoader = null;
                    // The level/track index to which the fragment belongs
                    level = -1;
                    // The continuity counter of the fragment
                    cc = 0;
                    // The starting Presentation Time Stamp (PTS) of the fragment. Set after transmux complete.

                    // The start time of the fragment, as listed in the manifest. Updated after transmux complete.
                    start = 0;
                    // Set by `updateFragPTSDTS` in level-helper

                    // Load/parse timing information
                    stats = new _load_stats__WEBPACK_IMPORTED_MODULE_1__.LoadStats();
                    urlId = 0;
                    // A flag indicating whether the segment was downloaded in order to test bitrate, and was not buffered
                    bitrateTest = false;
                    // #EXTINF  segment title
                    title = null;
                    // The Media Initialization Section for this segment
                    initSegment = null;
                    // Fragment is the last fragment in the media playlist

                    constructor(type, baseurl) {
                        super(baseurl);
                        this.type = type;
                    }
                    get decryptdata() {
                        const {
                            levelkeys
                        } = this;
                        if (!levelkeys && !this._decryptdata) {
                            return null;
                        }
                        if (!this._decryptdata && this.levelkeys && !this.levelkeys.NONE) {
                            const key = this.levelkeys.identity;
                            if (key) {
                                this._decryptdata = key.getDecryptData(this.sn);
                            } else {
                                const keyFormats = Object.keys(this.levelkeys);
                                if (keyFormats.length === 1) {
                                    return this._decryptdata = this.levelkeys[keyFormats[0]].getDecryptData(this.sn);
                                } else {
                                    // Multiple keys. key-loader to call Fragment.setKeyFormat based on selected key-system.
                                }
                            }
                        }
                        return this._decryptdata;
                    }
                    get end() {
                        return this.start + this.duration;
                    }
                    get endProgramDateTime() {
                        if (this.programDateTime === null) {
                            return null;
                        }
                        if (!Number.isFinite(this.programDateTime)) {
                            return null;
                        }
                        const duration = !Number.isFinite(this.duration) ? 0 : this.duration;
                        return this.programDateTime + duration * 1000;
                    }
                    get encrypted() {
                        // At the m3u8-parser level we need to add support for manifest signalled keyformats
                        // when we want the fragment to start reporting that it is encrypted.
                        // Currently, keyFormat will only be set for identity keys
                        if (this._decryptdata?.encrypted) {
                            return true;
                        } else if (this.levelkeys) {
                            const keyFormats = Object.keys(this.levelkeys);
                            const len = keyFormats.length;
                            if (len > 1 || len === 1 && this.levelkeys[keyFormats[0]].encrypted) {
                                return true;
                            }
                        }
                        return false;
                    }
                    setKeyFormat(keyFormat) {
                        if (this.levelkeys) {
                            const key = this.levelkeys[keyFormat];
                            if (key && !this._decryptdata) {
                                this._decryptdata = key.getDecryptData(this.sn);
                            }
                        }
                    }
                    abortRequests() {
                        this.loader?.abort();
                        this.keyLoader?.abort();
                    }
                    setElementaryStreamInfo(type, startPTS, endPTS, startDTS, endDTS, partial = false) {
                        const {
                            elementaryStreams
                        } = this;
                        const info = elementaryStreams[type];
                        if (!info) {
                            elementaryStreams[type] = {
                                startPTS,
                                endPTS,
                                startDTS,
                                endDTS,
                                partial
                            };
                            return;
                        }
                        info.startPTS = Math.min(info.startPTS, startPTS);
                        info.endPTS = Math.max(info.endPTS, endPTS);
                        info.startDTS = Math.min(info.startDTS, startDTS);
                        info.endDTS = Math.max(info.endDTS, endDTS);
                    }
                    clearElementaryStreamInfo() {
                        const {
                            elementaryStreams
                        } = this;
                        elementaryStreams[ElementaryStreamTypes.AUDIO] = null;
                        elementaryStreams[ElementaryStreamTypes.VIDEO] = null;
                        elementaryStreams[ElementaryStreamTypes.AUDIOVIDEO] = null;
                    }
                }
                class Part extends BaseSegment {
                    fragOffset = 0;
                    duration = 0;
                    gap = false;
                    independent = false;
                    stats = new _load_stats__WEBPACK_IMPORTED_MODULE_1__.LoadStats();
                    constructor(partAttrs, frag, baseurl, index, previous) {
                        super(baseurl);
                        this.duration = partAttrs.decimalFloatingPoint('DURATION');
                        this.gap = partAttrs.bool('GAP');
                        this.independent = partAttrs.bool('INDEPENDENT');
                        this.relurl = partAttrs.enumeratedString('URI');
                        this.fragment = frag;
                        this.index = index;
                        const byteRange = partAttrs.enumeratedString('BYTERANGE');
                        if (byteRange) {
                            this.setByteRange(byteRange, previous);
                        }
                        if (previous) {
                            this.fragOffset = previous.fragOffset + previous.duration;
                        }
                    }
                    get start() {
                        return this.fragment.start + this.fragOffset;
                    }
                    get end() {
                        return this.start + this.duration;
                    }
                    get loaded() {
                        const {
                            elementaryStreams
                        } = this;
                        return !!(elementaryStreams.audio || elementaryStreams.video || elementaryStreams.audiovideo);
                    }
                }

                /***/
            }),

/***/ "./src/loader/load-stats.ts":
/*!**********************************!*\
  !*** ./src/loader/load-stats.ts ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "LoadStats": () => (/* binding */ LoadStats)
                    /* harmony export */
                });
                class LoadStats {
                    aborted = false;
                    loaded = 0;
                    retry = 0;
                    total = 0;
                    chunkCount = 0;
                    bwEstimate = 0;
                    loading = {
                        start: 0,
                        first: 0,
                        end: 0
                    };
                    parsing = {
                        start: 0,
                        end: 0
                    };
                    buffering = {
                        start: 0,
                        first: 0,
                        end: 0
                    };
                }

                /***/
            }),

/***/ "./src/remux/aac-helper.ts":
/*!*********************************!*\
  !*** ./src/remux/aac-helper.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
                    /* harmony export */
                });
                /**
                 *  AAC helper
                 */

                class AAC {
                    static getSilentFrame(codec, channelCount) {
                        switch (codec) {
                            case 'mp4a.40.2':
                                if (channelCount === 1) {
                                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x23, 0x80]);
                                } else if (channelCount === 2) {
                                    return new Uint8Array([0x21, 0x00, 0x49, 0x90, 0x02, 0x19, 0x00, 0x23, 0x80]);
                                } else if (channelCount === 3) {
                                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x8e]);
                                } else if (channelCount === 4) {
                                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x80, 0x2c, 0x80, 0x08, 0x02, 0x38]);
                                } else if (channelCount === 5) {
                                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x38]);
                                } else if (channelCount === 6) {
                                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x00, 0xb2, 0x00, 0x20, 0x08, 0xe0]);
                                }
                                break;
                            // handle HE-AAC below (mp4a.40.5 / mp4a.40.29)
                            default:
                                if (channelCount === 1) {
                                    // ffmpeg -y -f lavfi -i "aevalsrc=0:d=0.05" -c:a libfdk_aac -profile:a aac_he -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
                                    return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x4e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x1c, 0x6, 0xf1, 0xc1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
                                } else if (channelCount === 2) {
                                    // ffmpeg -y -f lavfi -i "aevalsrc=0|0:d=0.05" -c:a libfdk_aac -profile:a aac_he_v2 -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
                                    return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x5e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x0, 0x95, 0x0, 0x6, 0xf1, 0xa1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
                                } else if (channelCount === 3) {
                                    // ffmpeg -y -f lavfi -i "aevalsrc=0|0|0:d=0.05" -c:a libfdk_aac -profile:a aac_he_v2 -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
                                    return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x5e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x0, 0x95, 0x0, 0x6, 0xf1, 0xa1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
                                }
                                break;
                        }
                        return undefined;
                    }
                }
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (AAC);

                /***/
            }),

/***/ "./src/remux/mp4-generator.ts":
/*!************************************!*\
  !*** ./src/remux/mp4-generator.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
                    /* harmony export */
                });
                /**
                 * Generate MP4 Box
                 */

                const UINT32_MAX = Math.pow(2, 32) - 1;
                class MP4 {
                    static init() {
                        MP4.types = {
                            avc1: [],
                            // codingname
                            avcC: [],
                            btrt: [],
                            dinf: [],
                            dref: [],
                            esds: [],
                            ftyp: [],
                            hdlr: [],
                            mdat: [],
                            mdhd: [],
                            mdia: [],
                            mfhd: [],
                            minf: [],
                            moof: [],
                            moov: [],
                            mp4a: [],
                            '.mp3': [],
                            mvex: [],
                            mvhd: [],
                            pasp: [],
                            sdtp: [],
                            stbl: [],
                            stco: [],
                            stsc: [],
                            stsd: [],
                            stsz: [],
                            stts: [],
                            tfdt: [],
                            tfhd: [],
                            traf: [],
                            trak: [],
                            trun: [],
                            trex: [],
                            tkhd: [],
                            vmhd: [],
                            smhd: []
                        };
                        let i;
                        for (i in MP4.types) {
                            if (MP4.types.hasOwnProperty(i)) {
                                MP4.types[i] = [i.charCodeAt(0), i.charCodeAt(1), i.charCodeAt(2), i.charCodeAt(3)];
                            }
                        }
                        const videoHdlr = new Uint8Array([0x00,
                            // version 0
                            0x00, 0x00, 0x00,
                            // flags
                            0x00, 0x00, 0x00, 0x00,
                            // pre_defined
                            0x76, 0x69, 0x64, 0x65,
                            // handler_type: 'vide'
                            0x00, 0x00, 0x00, 0x00,
                            // reserved
                            0x00, 0x00, 0x00, 0x00,
                            // reserved
                            0x00, 0x00, 0x00, 0x00,
                            // reserved
                            0x56, 0x69, 0x64, 0x65, 0x6f, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'VideoHandler'
                        ]);

                        const audioHdlr = new Uint8Array([0x00,
                            // version 0
                            0x00, 0x00, 0x00,
                            // flags
                            0x00, 0x00, 0x00, 0x00,
                            // pre_defined
                            0x73, 0x6f, 0x75, 0x6e,
                            // handler_type: 'soun'
                            0x00, 0x00, 0x00, 0x00,
                            // reserved
                            0x00, 0x00, 0x00, 0x00,
                            // reserved
                            0x00, 0x00, 0x00, 0x00,
                            // reserved
                            0x53, 0x6f, 0x75, 0x6e, 0x64, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'SoundHandler'
                        ]);

                        MP4.HDLR_TYPES = {
                            video: videoHdlr,
                            audio: audioHdlr
                        };
                        const dref = new Uint8Array([0x00,
                            // version 0
                            0x00, 0x00, 0x00,
                            // flags
                            0x00, 0x00, 0x00, 0x01,
                            // entry_count
                            0x00, 0x00, 0x00, 0x0c,
                            // entry_size
                            0x75, 0x72, 0x6c, 0x20,
                            // 'url' type
                            0x00,
                            // version 0
                            0x00, 0x00, 0x01 // entry_flags
                        ]);

                        const stco = new Uint8Array([0x00,
                            // version
                            0x00, 0x00, 0x00,
                            // flags
                            0x00, 0x00, 0x00, 0x00 // entry_count
                        ]);

                        MP4.STTS = MP4.STSC = MP4.STCO = stco;
                        MP4.STSZ = new Uint8Array([0x00,
                            // version
                            0x00, 0x00, 0x00,
                            // flags
                            0x00, 0x00, 0x00, 0x00,
                            // sample_size
                            0x00, 0x00, 0x00, 0x00 // sample_count
                        ]);

                        MP4.VMHD = new Uint8Array([0x00,
                            // version
                            0x00, 0x00, 0x01,
                            // flags
                            0x00, 0x00,
                            // graphicsmode
                            0x00, 0x00, 0x00, 0x00, 0x00, 0x00 // opcolor
                        ]);

                        MP4.SMHD = new Uint8Array([0x00,
                            // version
                            0x00, 0x00, 0x00,
                            // flags
                            0x00, 0x00,
                            // balance
                            0x00, 0x00 // reserved
                        ]);

                        MP4.STSD = new Uint8Array([0x00,
                            // version 0
                            0x00, 0x00, 0x00,
                            // flags
                            0x00, 0x00, 0x00, 0x01]); // entry_count

                        const majorBrand = new Uint8Array([105, 115, 111, 109]); // isom
                        const avc1Brand = new Uint8Array([97, 118, 99, 49]); // avc1
                        const minorVersion = new Uint8Array([0, 0, 0, 1]);
                        MP4.FTYP = MP4.box(MP4.types.ftyp, majorBrand, minorVersion, majorBrand, avc1Brand);
                        MP4.DINF = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, dref));
                    }
                    static box(type, ...payload) {
                        let size = 8;
                        let i = payload.length;
                        const len = i;
                        // calculate the total size we need to allocate
                        while (i--) {
                            size += payload[i].byteLength;
                        }
                        const result = new Uint8Array(size);
                        result[0] = size >> 24 & 0xff;
                        result[1] = size >> 16 & 0xff;
                        result[2] = size >> 8 & 0xff;
                        result[3] = size & 0xff;
                        result.set(type, 4);
                        // copy the payload into the result
                        for (i = 0, size = 8; i < len; i++) {
                            // copy payload[i] array @ offset size
                            result.set(payload[i], size);
                            size += payload[i].byteLength;
                        }
                        return result;
                    }
                    static hdlr(type) {
                        return MP4.box(MP4.types.hdlr, MP4.HDLR_TYPES[type]);
                    }
                    static mdat(data) {
                        return MP4.box(MP4.types.mdat, data);
                    }
                    static mdhd(timescale, duration) {
                        duration *= timescale;
                        const upperWordDuration = Math.floor(duration / (UINT32_MAX + 1));
                        const lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
                        return MP4.box(MP4.types.mdhd, new Uint8Array([0x01,
                            // version 1
                            0x00, 0x00, 0x00,
                            // flags
                            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02,
                            // creation_time
                            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03,
                            // modification_time
                            timescale >> 24 & 0xff, timescale >> 16 & 0xff, timescale >> 8 & 0xff, timescale & 0xff,
                            // timescale
                            upperWordDuration >> 24, upperWordDuration >> 16 & 0xff, upperWordDuration >> 8 & 0xff, upperWordDuration & 0xff, lowerWordDuration >> 24, lowerWordDuration >> 16 & 0xff, lowerWordDuration >> 8 & 0xff, lowerWordDuration & 0xff, 0x55, 0xc4,
                            // 'und' language (undetermined)
                            0x00, 0x00]));
                    }
                    static mdia(track) {
                        return MP4.box(MP4.types.mdia, MP4.mdhd(track.timescale, track.duration), MP4.hdlr(track.type), MP4.minf(track));
                    }
                    static mfhd(sequenceNumber) {
                        return MP4.box(MP4.types.mfhd, new Uint8Array([0x00, 0x00, 0x00, 0x00,
                            // flags
                            sequenceNumber >> 24, sequenceNumber >> 16 & 0xff, sequenceNumber >> 8 & 0xff, sequenceNumber & 0xff // sequence_number
                        ]));
                    }

                    static minf(track) {
                        if (track.type === 'audio') {
                            return MP4.box(MP4.types.minf, MP4.box(MP4.types.smhd, MP4.SMHD), MP4.DINF, MP4.stbl(track));
                        } else {
                            return MP4.box(MP4.types.minf, MP4.box(MP4.types.vmhd, MP4.VMHD), MP4.DINF, MP4.stbl(track));
                        }
                    }
                    static moof(sn, baseMediaDecodeTime, track) {
                        return MP4.box(MP4.types.moof, MP4.mfhd(sn), MP4.traf(track, baseMediaDecodeTime));
                    }

                    /**
                     * @param tracks... (optional) {array} the tracks associated with this movie
                     */
                    static moov(tracks) {
                        let i = tracks.length;
                        const boxes = [];
                        while (i--) {
                            boxes[i] = MP4.trak(tracks[i]);
                        }
                        return MP4.box.apply(null, [MP4.types.moov, MP4.mvhd(tracks[0].timescale, tracks[0].duration)].concat(boxes).concat(MP4.mvex(tracks)));
                    }
                    static mvex(tracks) {
                        let i = tracks.length;
                        const boxes = [];
                        while (i--) {
                            boxes[i] = MP4.trex(tracks[i]);
                        }
                        return MP4.box.apply(null, [MP4.types.mvex, ...boxes]);
                    }
                    static mvhd(timescale, duration) {
                        duration *= timescale;
                        const upperWordDuration = Math.floor(duration / (UINT32_MAX + 1));
                        const lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
                        const bytes = new Uint8Array([0x01,
                            // version 1
                            0x00, 0x00, 0x00,
                            // flags
                            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02,
                            // creation_time
                            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03,
                            // modification_time
                            timescale >> 24 & 0xff, timescale >> 16 & 0xff, timescale >> 8 & 0xff, timescale & 0xff,
                            // timescale
                            upperWordDuration >> 24, upperWordDuration >> 16 & 0xff, upperWordDuration >> 8 & 0xff, upperWordDuration & 0xff, lowerWordDuration >> 24, lowerWordDuration >> 16 & 0xff, lowerWordDuration >> 8 & 0xff, lowerWordDuration & 0xff, 0x00, 0x01, 0x00, 0x00,
                            // 1.0 rate
                            0x01, 0x00,
                            // 1.0 volume
                            0x00, 0x00,
                            // reserved
                            0x00, 0x00, 0x00, 0x00,
                            // reserved
                            0x00, 0x00, 0x00, 0x00,
                            // reserved
                            0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00,
                            // transformation: unity matrix
                            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                            // pre_defined
                            0xff, 0xff, 0xff, 0xff // next_track_ID
                        ]);

                        return MP4.box(MP4.types.mvhd, bytes);
                    }
                    static sdtp(track) {
                        const samples = track.samples || [];
                        const bytes = new Uint8Array(4 + samples.length);
                        let i;
                        let flags;
                        // leave the full box header (4 bytes) all zero
                        // write the sample table
                        for (i = 0; i < samples.length; i++) {
                            flags = samples[i].flags;
                            bytes[i + 4] = flags.dependsOn << 4 | flags.isDependedOn << 2 | flags.hasRedundancy;
                        }
                        return MP4.box(MP4.types.sdtp, bytes);
                    }
                    static stbl(track) {
                        return MP4.box(MP4.types.stbl, MP4.stsd(track), MP4.box(MP4.types.stts, MP4.STTS), MP4.box(MP4.types.stsc, MP4.STSC), MP4.box(MP4.types.stsz, MP4.STSZ), MP4.box(MP4.types.stco, MP4.STCO));
                    }
                    static avc1(track) {
                        let sps = [];
                        let pps = [];
                        let i;
                        let data;
                        let len;
                        // assemble the SPSs

                        for (i = 0; i < track.sps.length; i++) {
                            data = track.sps[i];
                            len = data.byteLength;
                            sps.push(len >>> 8 & 0xff);
                            sps.push(len & 0xff);

                            // SPS
                            sps = sps.concat(Array.prototype.slice.call(data));
                        }

                        // assemble the PPSs
                        for (i = 0; i < track.pps.length; i++) {
                            data = track.pps[i];
                            len = data.byteLength;
                            pps.push(len >>> 8 & 0xff);
                            pps.push(len & 0xff);
                            pps = pps.concat(Array.prototype.slice.call(data));
                        }
                        const avcc = MP4.box(MP4.types.avcC, new Uint8Array([0x01,
                            // version
                            sps[3],
                            // profile
                            sps[4],
                            // profile compat
                            sps[5],
                            // level
                            0xfc | 3,
                            // lengthSizeMinusOne, hard-coded to 4 bytes
                            0xe0 | track.sps.length // 3bit reserved (111) + numOfSequenceParameterSets
                        ].concat(sps).concat([track.pps.length // numOfPictureParameterSets
                        ]).concat(pps))); // "PPS"
                        const width = track.width;
                        const height = track.height;
                        const hSpacing = track.pixelRatio[0];
                        const vSpacing = track.pixelRatio[1];
                        return MP4.box(MP4.types.avc1, new Uint8Array([0x00, 0x00, 0x00,
                            // reserved
                            0x00, 0x00, 0x00,
                            // reserved
                            0x00, 0x01,
                            // data_reference_index
                            0x00, 0x00,
                            // pre_defined
                            0x00, 0x00,
                            // reserved
                            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                            // pre_defined
                            width >> 8 & 0xff, width & 0xff,
                            // width
                            height >> 8 & 0xff, height & 0xff,
                            // height
                            0x00, 0x48, 0x00, 0x00,
                            // horizresolution
                            0x00, 0x48, 0x00, 0x00,
                            // vertresolution
                            0x00, 0x00, 0x00, 0x00,
                            // reserved
                            0x00, 0x01,
                            // frame_count
                            0x12, 0x64, 0x61, 0x69, 0x6c,
                            // dailymotion/hls.js
                            0x79, 0x6d, 0x6f, 0x74, 0x69, 0x6f, 0x6e, 0x2f, 0x68, 0x6c, 0x73, 0x2e, 0x6a, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                            // compressorname
                            0x00, 0x18,
                            // depth = 24
                            0x11, 0x11]),
                            // pre_defined = -1
                            avcc, MP4.box(MP4.types.btrt, new Uint8Array([0x00, 0x1c, 0x9c, 0x80,
                                // bufferSizeDB
                                0x00, 0x2d, 0xc6, 0xc0,
                                // maxBitrate
                                0x00, 0x2d, 0xc6, 0xc0])),
                            // avgBitrate
                            MP4.box(MP4.types.pasp, new Uint8Array([hSpacing >> 24,
                            // hSpacing
                            hSpacing >> 16 & 0xff, hSpacing >> 8 & 0xff, hSpacing & 0xff, vSpacing >> 24,
                            // vSpacing
                            vSpacing >> 16 & 0xff, vSpacing >> 8 & 0xff, vSpacing & 0xff])));
                    }
                    static esds(track) {
                        const configlen = track.config.length;
                        return new Uint8Array([0x00,
                            // version 0
                            0x00, 0x00, 0x00,
                            // flags

                            0x03,
                            // descriptor_type
                            0x17 + configlen,
                            // length
                            0x00, 0x01,
                            // es_id
                            0x00,
                            // stream_priority

                            0x04,
                            // descriptor_type
                            0x0f + configlen,
                            // length
                            0x40,
                            // codec : mpeg4_audio
                            0x15,
                            // stream_type
                            0x00, 0x00, 0x00,
                            // buffer_size
                            0x00, 0x00, 0x00, 0x00,
                            // maxBitrate
                            0x00, 0x00, 0x00, 0x00,
                            // avgBitrate

                            0x05 // descriptor_type
                        ].concat([configlen]).concat(track.config).concat([0x06, 0x01, 0x02])); // GASpecificConfig)); // length + audio config descriptor
                    }

                    static mp4a(track) {
                        const samplerate = track.samplerate;
                        return MP4.box(MP4.types.mp4a, new Uint8Array([0x00, 0x00, 0x00,
                            // reserved
                            0x00, 0x00, 0x00,
                            // reserved
                            0x00, 0x01,
                            // data_reference_index
                            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                            // reserved
                            0x00, track.channelCount,
                            // channelcount
                            0x00, 0x10,
                            // sampleSize:16bits
                            0x00, 0x00, 0x00, 0x00,
                            // reserved2
                            samplerate >> 8 & 0xff, samplerate & 0xff,
                            //
                            0x00, 0x00]), MP4.box(MP4.types.esds, MP4.esds(track)));
                    }
                    static mp3(track) {
                        const samplerate = track.samplerate;
                        return MP4.box(MP4.types['.mp3'], new Uint8Array([0x00, 0x00, 0x00,
                            // reserved
                            0x00, 0x00, 0x00,
                            // reserved
                            0x00, 0x01,
                            // data_reference_index
                            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                            // reserved
                            0x00, track.channelCount,
                            // channelcount
                            0x00, 0x10,
                            // sampleSize:16bits
                            0x00, 0x00, 0x00, 0x00,
                            // reserved2
                            samplerate >> 8 & 0xff, samplerate & 0xff,
                            //
                            0x00, 0x00]));
                    }
                    static stsd(track) {
                        if (track.type === 'audio') {
                            if (track.segmentCodec === 'mp3' && track.codec === 'mp3') {
                                return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp3(track));
                            }
                            return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp4a(track));
                        } else {
                            return MP4.box(MP4.types.stsd, MP4.STSD, MP4.avc1(track));
                        }
                    }
                    static tkhd(track) {
                        const id = track.id;
                        const duration = track.duration * track.timescale;
                        const width = track.width;
                        const height = track.height;
                        const upperWordDuration = Math.floor(duration / (UINT32_MAX + 1));
                        const lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
                        return MP4.box(MP4.types.tkhd, new Uint8Array([0x01,
                            // version 1
                            0x00, 0x00, 0x07,
                            // flags
                            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02,
                            // creation_time
                            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03,
                            // modification_time
                            id >> 24 & 0xff, id >> 16 & 0xff, id >> 8 & 0xff, id & 0xff,
                            // track_ID
                            0x00, 0x00, 0x00, 0x00,
                            // reserved
                            upperWordDuration >> 24, upperWordDuration >> 16 & 0xff, upperWordDuration >> 8 & 0xff, upperWordDuration & 0xff, lowerWordDuration >> 24, lowerWordDuration >> 16 & 0xff, lowerWordDuration >> 8 & 0xff, lowerWordDuration & 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                            // reserved
                            0x00, 0x00,
                            // layer
                            0x00, 0x00,
                            // alternate_group
                            0x00, 0x00,
                            // non-audio track volume
                            0x00, 0x00,
                            // reserved
                            0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00,
                            // transformation: unity matrix
                            width >> 8 & 0xff, width & 0xff, 0x00, 0x00,
                            // width
                            height >> 8 & 0xff, height & 0xff, 0x00, 0x00 // height
                        ]));
                    }

                    static traf(track, baseMediaDecodeTime) {
                        const sampleDependencyTable = MP4.sdtp(track);
                        const id = track.id;
                        const upperWordBaseMediaDecodeTime = Math.floor(baseMediaDecodeTime / (UINT32_MAX + 1));
                        const lowerWordBaseMediaDecodeTime = Math.floor(baseMediaDecodeTime % (UINT32_MAX + 1));
                        return MP4.box(MP4.types.traf, MP4.box(MP4.types.tfhd, new Uint8Array([0x00,
                            // version 0
                            0x00, 0x00, 0x00,
                            // flags
                            id >> 24, id >> 16 & 0xff, id >> 8 & 0xff, id & 0xff // track_ID
                        ])), MP4.box(MP4.types.tfdt, new Uint8Array([0x01,
                            // version 1
                            0x00, 0x00, 0x00,
                            // flags
                            upperWordBaseMediaDecodeTime >> 24, upperWordBaseMediaDecodeTime >> 16 & 0xff, upperWordBaseMediaDecodeTime >> 8 & 0xff, upperWordBaseMediaDecodeTime & 0xff, lowerWordBaseMediaDecodeTime >> 24, lowerWordBaseMediaDecodeTime >> 16 & 0xff, lowerWordBaseMediaDecodeTime >> 8 & 0xff, lowerWordBaseMediaDecodeTime & 0xff])), MP4.trun(track, sampleDependencyTable.length + 16 +
                                // tfhd
                                20 +
                                // tfdt
                                8 +
                                // traf header
                                16 +
                                // mfhd
                                8 +
                                // moof header
                                8),
                            // mdat header
                            sampleDependencyTable);
                    }

                    /**
                     * Generate a track box.
                     * @param track {object} a track definition
                     * @return {Uint8Array} the track box
                     */
                    static trak(track) {
                        track.duration = track.duration || 0xffffffff;
                        return MP4.box(MP4.types.trak, MP4.tkhd(track), MP4.mdia(track));
                    }
                    static trex(track) {
                        const id = track.id;
                        return MP4.box(MP4.types.trex, new Uint8Array([0x00,
                            // version 0
                            0x00, 0x00, 0x00,
                            // flags
                            id >> 24, id >> 16 & 0xff, id >> 8 & 0xff, id & 0xff,
                            // track_ID
                            0x00, 0x00, 0x00, 0x01,
                            // default_sample_description_index
                            0x00, 0x00, 0x00, 0x00,
                            // default_sample_duration
                            0x00, 0x00, 0x00, 0x00,
                            // default_sample_size
                            0x00, 0x01, 0x00, 0x01 // default_sample_flags
                        ]));
                    }

                    static trun(track, offset) {
                        const samples = track.samples || [];
                        const len = samples.length;
                        const arraylen = 12 + 16 * len;
                        const array = new Uint8Array(arraylen);
                        let i;
                        let sample;
                        let duration;
                        let size;
                        let flags;
                        let cts;
                        offset += 8 + arraylen;
                        array.set([track.type === 'video' ? 0x01 : 0x00,
                            // version 1 for video with signed-int sample_composition_time_offset
                            0x00, 0x0f, 0x01,
                        // flags
                        len >>> 24 & 0xff, len >>> 16 & 0xff, len >>> 8 & 0xff, len & 0xff,
                        // sample_count
                        offset >>> 24 & 0xff, offset >>> 16 & 0xff, offset >>> 8 & 0xff, offset & 0xff // data_offset
                        ], 0);
                        for (i = 0; i < len; i++) {
                            sample = samples[i];
                            duration = sample.duration;
                            size = sample.size;
                            flags = sample.flags;
                            cts = sample.cts;
                            array.set([duration >>> 24 & 0xff, duration >>> 16 & 0xff, duration >>> 8 & 0xff, duration & 0xff,
                            // sample_duration
                            size >>> 24 & 0xff, size >>> 16 & 0xff, size >>> 8 & 0xff, size & 0xff,
                            // sample_size
                            flags.isLeading << 2 | flags.dependsOn, flags.isDependedOn << 6 | flags.hasRedundancy << 4 | flags.paddingValue << 1 | flags.isNonSync, flags.degradPrio & 0xf0 << 8, flags.degradPrio & 0x0f,
                            // sample_flags
                            cts >>> 24 & 0xff, cts >>> 16 & 0xff, cts >>> 8 & 0xff, cts & 0xff // sample_composition_time_offset
                            ], 12 + 16 * i);
                        }
                        return MP4.box(MP4.types.trun, array);
                    }
                    static initSegment(tracks) {
                        if (!MP4.types) {
                            MP4.init();
                        }
                        const movie = MP4.moov(tracks);
                        const result = new Uint8Array(MP4.FTYP.byteLength + movie.byteLength);
                        result.set(MP4.FTYP);
                        result.set(movie, MP4.FTYP.byteLength);
                        return result;
                    }
                }
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (MP4);

                /***/
            }),

/***/ "./src/remux/mp4-remuxer.ts":
/*!**********************************!*\
  !*** ./src/remux/mp4-remuxer.ts ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ MP4Remuxer),
/* harmony export */   "flushTextTrackMetadataCueSamples": () => (/* binding */ flushTextTrackMetadataCueSamples),
/* harmony export */   "flushTextTrackUserdataCueSamples": () => (/* binding */ flushTextTrackUserdataCueSamples),
/* harmony export */   "normalizePts": () => (/* binding */ normalizePts)
                    /* harmony export */
                });
/* harmony import */ var _aac_helper__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./aac-helper */ "./src/remux/aac-helper.ts");
/* harmony import */ var _mp4_generator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./mp4-generator */ "./src/remux/mp4-generator.ts");
/* harmony import */ var _events__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../events */ "./src/events.ts");
/* harmony import */ var _errors__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../errors */ "./src/errors.ts");
/* harmony import */ var _utils_logger__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.ts");
/* harmony import */ var _types_loader__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../types/loader */ "./src/types/loader.ts");
/* harmony import */ var _utils_timescale_conversion__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../utils/timescale-conversion */ "./src/utils/timescale-conversion.ts");







                const MAX_SILENT_FRAME_DURATION = 10 * 1000; // 10 seconds
                const AAC_SAMPLES_PER_FRAME = 1024;
                const MPEG_AUDIO_SAMPLE_PER_FRAME = 1152;
                let chromeVersion = null;
                let safariWebkitVersion = null;
                class MP4Remuxer {
                    ISGenerated = false;
                    nextAvcDts = null;
                    nextAudioPts = null;
                    videoSampleDuration = null;
                    isAudioContiguous = false;
                    isVideoContiguous = false;
                    constructor(observer, config, typeSupported, vendor = '') {
                        this.observer = observer;
                        this.config = config;
                        this.typeSupported = typeSupported;
                        this.ISGenerated = false;
                        if (chromeVersion === null) {
                            const userAgent = navigator.userAgent || '';
                            const result = userAgent.match(/Chrome\/(\d+)/i);
                            chromeVersion = result ? parseInt(result[1]) : 0;
                        }
                        if (safariWebkitVersion === null) {
                            const result = navigator.userAgent.match(/Safari\/(\d+)/i);
                            safariWebkitVersion = result ? parseInt(result[1]) : 0;
                        }
                    }
                    destroy() { }
                    resetTimeStamp(defaultTimeStamp) {
                        _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.log('[mp4-remuxer]: initPTS & initDTS reset');
                        this._initPTS = this._initDTS = defaultTimeStamp;
                    }
                    resetNextTimestamp() {
                        _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.log('[mp4-remuxer]: reset next timestamp');
                        this.isVideoContiguous = false;
                        this.isAudioContiguous = false;
                    }
                    resetInitSegment() {
                        _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.log('[mp4-remuxer]: ISGenerated flag reset');
                        this.ISGenerated = false;
                    }
                    getVideoStartPts(videoSamples) {
                        let rolloverDetected = false;
                        const startPTS = videoSamples.reduce((minPTS, sample) => {
                            const delta = sample.pts - minPTS;
                            if (delta < -4294967296) {
                                // 2^32, see PTSNormalize for reasoning, but we're hitting a rollover here, and we don't want that to impact the timeOffset calculation
                                rolloverDetected = true;
                                return normalizePts(minPTS, sample.pts);
                            } else if (delta > 0) {
                                return minPTS;
                            } else {
                                return sample.pts;
                            }
                        }, videoSamples[0].pts);
                        if (rolloverDetected) {
                            _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.debug('PTS rollover detected');
                        }
                        return startPTS;
                    }
                    remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, accurateTimeOffset, flush, playlistType) {
                        let video;
                        let audio;
                        let initSegment;
                        let text;
                        let id3;
                        let independent;
                        let audioTimeOffset = timeOffset;
                        let videoTimeOffset = timeOffset;

                        // If we're remuxing audio and video progressively, wait until we've received enough samples for each track before proceeding.
                        // This is done to synchronize the audio and video streams. We know if the current segment will have samples if the "pid"
                        // parameter is greater than -1. The pid is set when the PMT is parsed, which contains the tracks list.
                        // However, if the initSegment has already been generated, or we've reached the end of a segment (flush),
                        // then we can remux one track without waiting for the other.
                        const hasAudio = audioTrack.pid > -1;
                        const hasVideo = videoTrack.pid > -1;
                        const length = videoTrack.samples.length;
                        const enoughAudioSamples = audioTrack.samples.length > 0;
                        const enoughVideoSamples = flush && length > 0 || length > 1;
                        const canRemuxAvc = (!hasAudio || enoughAudioSamples) && (!hasVideo || enoughVideoSamples) || this.ISGenerated || flush;
                        if (canRemuxAvc) {
                            if (!this.ISGenerated) {
                                initSegment = this.generateIS(audioTrack, videoTrack, timeOffset);
                            }
                            const isVideoContiguous = this.isVideoContiguous;
                            let firstKeyFrameIndex = -1;
                            let firstKeyFramePTS;
                            if (enoughVideoSamples) {
                                firstKeyFrameIndex = findKeyframeIndex(videoTrack.samples);
                                if (!isVideoContiguous && this.config.forceKeyFrameOnDiscontinuity) {
                                    independent = true;
                                    if (firstKeyFrameIndex > 0) {
                                        _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.warn(`[mp4-remuxer]: Dropped ${firstKeyFrameIndex} out of ${length} video samples due to a missing keyframe`);
                                        const startPTS = this.getVideoStartPts(videoTrack.samples);
                                        videoTrack.samples = videoTrack.samples.slice(firstKeyFrameIndex);
                                        videoTrack.dropped += firstKeyFrameIndex;
                                        videoTimeOffset += (videoTrack.samples[0].pts - startPTS) / videoTrack.inputTimeScale;
                                        firstKeyFramePTS = videoTimeOffset;
                                    } else if (firstKeyFrameIndex === -1) {
                                        _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.warn(`[mp4-remuxer]: No keyframe found out of ${length} video samples`);
                                        independent = false;
                                    }
                                }
                            }
                            if (this.ISGenerated) {
                                if (enoughAudioSamples && enoughVideoSamples) {
                                    // timeOffset is expected to be the offset of the first timestamp of this fragment (first DTS)
                                    // if first audio DTS is not aligned with first video DTS then we need to take that into account
                                    // when providing timeOffset to remuxAudio / remuxVideo. if we don't do that, there might be a permanent / small
                                    // drift between audio and video streams
                                    const startPTS = this.getVideoStartPts(videoTrack.samples);
                                    const tsDelta = normalizePts(audioTrack.samples[0].pts, startPTS) - startPTS;
                                    const audiovideoTimestampDelta = tsDelta / videoTrack.inputTimeScale;
                                    audioTimeOffset += Math.max(0, audiovideoTimestampDelta);
                                    videoTimeOffset += Math.max(0, -audiovideoTimestampDelta);
                                }

                                // Purposefully remuxing audio before video, so that remuxVideo can use nextAudioPts, which is calculated in remuxAudio.
                                if (enoughAudioSamples) {
                                    // if initSegment was generated without audio samples, regenerate it again
                                    if (!audioTrack.samplerate) {
                                        _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.warn('[mp4-remuxer]: regenerate InitSegment as audio detected');
                                        initSegment = this.generateIS(audioTrack, videoTrack, timeOffset);
                                    }
                                    audio = this.remuxAudio(audioTrack, audioTimeOffset, this.isAudioContiguous, accurateTimeOffset, hasVideo || enoughVideoSamples || playlistType === _types_loader__WEBPACK_IMPORTED_MODULE_5__.PlaylistLevelType.AUDIO ? videoTimeOffset : undefined);
                                    if (enoughVideoSamples) {
                                        const audioTrackLength = audio ? audio.endPTS - audio.startPTS : 0;
                                        // if initSegment was generated without video samples, regenerate it again
                                        if (!videoTrack.inputTimeScale) {
                                            _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.warn('[mp4-remuxer]: regenerate InitSegment as video detected');
                                            initSegment = this.generateIS(audioTrack, videoTrack, timeOffset);
                                        }
                                        video = this.remuxVideo(videoTrack, videoTimeOffset, isVideoContiguous, audioTrackLength);
                                    }
                                } else if (enoughVideoSamples) {
                                    video = this.remuxVideo(videoTrack, videoTimeOffset, isVideoContiguous, 0);
                                }
                                if (video) {
                                    video.firstKeyFrame = firstKeyFrameIndex;
                                    video.independent = firstKeyFrameIndex !== -1;
                                    video.firstKeyFramePTS = firstKeyFramePTS;
                                }
                            }
                        }

                        // Allow ID3 and text to remux, even if more audio/video samples are required
                        if (this.ISGenerated) {
                            if (id3Track.samples.length) {
                                id3 = flushTextTrackMetadataCueSamples(id3Track, timeOffset, this._initPTS, this._initDTS);
                            }
                            if (textTrack.samples.length) {
                                text = flushTextTrackUserdataCueSamples(textTrack, timeOffset, this._initPTS);
                            }
                        }
                        return {
                            audio,
                            video,
                            initSegment,
                            independent,
                            text,
                            id3
                        };
                    }
                    generateIS(audioTrack, videoTrack, timeOffset) {
                        const audioSamples = audioTrack.samples;
                        const videoSamples = videoTrack.samples;
                        const typeSupported = this.typeSupported;
                        const tracks = {};
                        const computePTSDTS = !Number.isFinite(this._initPTS);
                        let container = 'audio/mp4';
                        let initPTS;
                        let initDTS;
                        let timescale;
                        if (computePTSDTS) {
                            initPTS = initDTS = Infinity;
                        }
                        if (audioTrack.config && audioSamples.length) {
                            // let's use audio sampling rate as MP4 time scale.
                            // rationale is that there is a integer nb of audio frames per audio sample (1024 for AAC)
                            // using audio sampling rate here helps having an integer MP4 frame duration
                            // this avoids potential rounding issue and AV sync issue
                            audioTrack.timescale = audioTrack.samplerate;
                            switch (audioTrack.segmentCodec) {
                                case 'mp3':
                                    if (typeSupported.mpeg) {
                                        // Chrome and Safari
                                        container = 'audio/mpeg';
                                        audioTrack.codec = '';
                                    } else if (typeSupported.mp3) {
                                        // Firefox
                                        audioTrack.codec = 'mp3';
                                    }
                                    break;
                            }
                            tracks.audio = {
                                id: 'audio',
                                container: container,
                                codec: audioTrack.codec,
                                initSegment: audioTrack.segmentCodec === 'mp3' && typeSupported.mpeg ? new Uint8Array(0) : _mp4_generator__WEBPACK_IMPORTED_MODULE_1__["default"].initSegment([audioTrack]),
                                metadata: {
                                    channelCount: audioTrack.channelCount
                                }
                            };
                            if (computePTSDTS) {
                                timescale = audioTrack.inputTimeScale;
                                // remember first PTS of this demuxing context. for audio, PTS = DTS
                                initPTS = initDTS = audioSamples[0].pts - Math.round(timescale * timeOffset);
                            }
                        }
                        if (videoTrack.sps && videoTrack.pps && videoSamples.length) {
                            // let's use input time scale as MP4 video timescale
                            // we use input time scale straight away to avoid rounding issues on frame duration / cts computation
                            videoTrack.timescale = videoTrack.inputTimeScale;
                            tracks.video = {
                                id: 'main',
                                container: 'video/mp4',
                                codec: videoTrack.codec,
                                initSegment: _mp4_generator__WEBPACK_IMPORTED_MODULE_1__["default"].initSegment([videoTrack]),
                                metadata: {
                                    width: videoTrack.width,
                                    height: videoTrack.height
                                }
                            };
                            if (computePTSDTS) {
                                timescale = videoTrack.inputTimeScale;
                                const startPTS = this.getVideoStartPts(videoSamples);
                                const startOffset = Math.round(timescale * timeOffset);
                                initDTS = Math.min(initDTS, normalizePts(videoSamples[0].dts, startPTS) - startOffset);
                                initPTS = Math.min(initPTS, startPTS - startOffset);
                            }
                        }
                        if (Object.keys(tracks).length) {
                            this.ISGenerated = true;
                            if (computePTSDTS) {
                                this._initPTS = initPTS;
                                this._initDTS = initDTS;
                            }
                            return {
                                tracks,
                                initPTS,
                                timescale
                            };
                        }
                    }
                    remuxVideo(track, timeOffset, contiguous, audioTrackLength) {
                        const timeScale = track.inputTimeScale;
                        const inputSamples = track.samples;
                        const outputSamples = [];
                        const nbSamples = inputSamples.length;
                        const initPTS = this._initPTS;
                        let nextAvcDts = this.nextAvcDts;
                        let offset = 8;
                        let mp4SampleDuration = this.videoSampleDuration;
                        let firstDTS;
                        let lastDTS;
                        let minPTS = Number.POSITIVE_INFINITY;
                        let maxPTS = Number.NEGATIVE_INFINITY;
                        let sortSamples = false;

                        // if parsed fragment is contiguous with last one, let's use last DTS value as reference
                        if (!contiguous || nextAvcDts === null) {
                            const pts = timeOffset * timeScale;
                            const cts = inputSamples[0].pts - normalizePts(inputSamples[0].dts, inputSamples[0].pts);
                            // if not contiguous, let's use target timeOffset
                            nextAvcDts = pts - cts;
                        }

                        // PTS is coded on 33bits, and can loop from -2^32 to 2^32
                        // PTSNormalize will make PTS/DTS value monotonic, we use last known DTS value as reference value
                        for (let i = 0; i < nbSamples; i++) {
                            const sample = inputSamples[i];
                            sample.pts = normalizePts(sample.pts - initPTS, nextAvcDts);
                            sample.dts = normalizePts(sample.dts - initPTS, nextAvcDts);
                            if (sample.dts < inputSamples[i > 0 ? i - 1 : i].dts) {
                                sortSamples = true;
                            }
                        }

                        // sort video samples by DTS then PTS then demux id order
                        if (sortSamples) {
                            inputSamples.sort(function (a, b) {
                                const deltadts = a.dts - b.dts;
                                const deltapts = a.pts - b.pts;
                                return deltadts || deltapts;
                            });
                        }

                        // Get first/last DTS
                        firstDTS = inputSamples[0].dts;
                        lastDTS = inputSamples[inputSamples.length - 1].dts;

                        // Sample duration (as expected by trun MP4 boxes), should be the delta between sample DTS
                        // set this constant duration as being the avg delta between consecutive DTS.
                        const inputDuration = lastDTS - firstDTS;
                        const averageSampleDuration = inputDuration ? Math.round(inputDuration / (nbSamples - 1)) : mp4SampleDuration || track.inputTimeScale / 30;

                        // if fragment are contiguous, detect hole/overlapping between fragments
                        if (contiguous) {
                            // check timestamp continuity across consecutive fragments (this is to remove inter-fragment gap/hole)
                            const delta = firstDTS - nextAvcDts;
                            const foundHole = delta > averageSampleDuration;
                            const foundOverlap = delta < -1;
                            if (foundHole || foundOverlap) {
                                if (foundHole) {
                                    _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.warn(`AVC: ${(0, _utils_timescale_conversion__WEBPACK_IMPORTED_MODULE_6__.toMsFromMpegTsClock)(delta, true)} ms (${delta}dts) hole between fragments detected, filling it`);
                                } else {
                                    _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.warn(`AVC: ${(0, _utils_timescale_conversion__WEBPACK_IMPORTED_MODULE_6__.toMsFromMpegTsClock)(-delta, true)} ms (${delta}dts) overlapping between fragments detected`);
                                }
                                if (!foundOverlap || nextAvcDts > inputSamples[0].pts) {
                                    firstDTS = nextAvcDts;
                                    const firstPTS = inputSamples[0].pts - delta;
                                    inputSamples[0].dts = firstDTS;
                                    inputSamples[0].pts = firstPTS;
                                    _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.log(`Video: First PTS/DTS adjusted: ${(0, _utils_timescale_conversion__WEBPACK_IMPORTED_MODULE_6__.toMsFromMpegTsClock)(firstPTS, true)}/${(0, _utils_timescale_conversion__WEBPACK_IMPORTED_MODULE_6__.toMsFromMpegTsClock)(firstDTS, true)}, delta: ${(0, _utils_timescale_conversion__WEBPACK_IMPORTED_MODULE_6__.toMsFromMpegTsClock)(delta, true)} ms`);
                                }
                            }
                        }
                        firstDTS = Math.max(0, firstDTS);
                        let nbNalu = 0;
                        let naluLen = 0;
                        for (let i = 0; i < nbSamples; i++) {
                            // compute total/avc sample length and nb of NAL units
                            const sample = inputSamples[i];
                            const units = sample.units;
                            const nbUnits = units.length;
                            let sampleLen = 0;
                            for (let j = 0; j < nbUnits; j++) {
                                sampleLen += units[j].data.length;
                            }
                            naluLen += sampleLen;
                            nbNalu += nbUnits;
                            sample.length = sampleLen;

                            // ensure sample monotonic DTS
                            sample.dts = Math.max(sample.dts, firstDTS);
                            minPTS = Math.min(sample.pts, minPTS);
                            maxPTS = Math.max(sample.pts, maxPTS);
                        }
                        lastDTS = inputSamples[nbSamples - 1].dts;

                        /* concatenate the video data and construct the mdat in place
                          (need 8 more bytes to fill length and mpdat type) */
                        const mdatSize = naluLen + 4 * nbNalu + 8;
                        let mdat;
                        try {
                            mdat = new Uint8Array(mdatSize);
                        } catch (err) {
                            this.observer.emit(_events__WEBPACK_IMPORTED_MODULE_2__.Events.ERROR, _events__WEBPACK_IMPORTED_MODULE_2__.Events.ERROR, {
                                type: _errors__WEBPACK_IMPORTED_MODULE_3__.ErrorTypes.MUX_ERROR,
                                details: _errors__WEBPACK_IMPORTED_MODULE_3__.ErrorDetails.REMUX_ALLOC_ERROR,
                                fatal: false,
                                bytes: mdatSize,
                                reason: `fail allocating video mdat ${mdatSize}`
                            });
                            return;
                        }
                        const view = new DataView(mdat.buffer);
                        view.setUint32(0, mdatSize);
                        mdat.set(_mp4_generator__WEBPACK_IMPORTED_MODULE_1__["default"].types.mdat, 4);
                        let stretchedLastFrame = false;
                        let minDtsDelta = Number.POSITIVE_INFINITY;
                        let minPtsDelta = Number.POSITIVE_INFINITY;
                        let maxDtsDelta = Number.NEGATIVE_INFINITY;
                        let maxPtsDelta = Number.NEGATIVE_INFINITY;
                        for (let i = 0; i < nbSamples; i++) {
                            const avcSample = inputSamples[i];
                            const avcSampleUnits = avcSample.units;
                            let mp4SampleLength = 0;
                            // convert NALU bitstream to MP4 format (prepend NALU with size field)
                            for (let j = 0, nbUnits = avcSampleUnits.length; j < nbUnits; j++) {
                                const unit = avcSampleUnits[j];
                                const unitData = unit.data;
                                const unitDataLen = unit.data.byteLength;
                                view.setUint32(offset, unitDataLen);
                                offset += 4;
                                mdat.set(unitData, offset);
                                offset += unitDataLen;
                                mp4SampleLength += 4 + unitDataLen;
                            }

                            // expected sample duration is the Decoding Timestamp diff of consecutive samples
                            let ptsDelta;
                            if (i < nbSamples - 1) {
                                mp4SampleDuration = inputSamples[i + 1].dts - avcSample.dts;
                                ptsDelta = inputSamples[i + 1].pts - avcSample.pts;
                            } else {
                                const config = this.config;
                                const lastFrameDuration = i > 0 ? avcSample.dts - inputSamples[i - 1].dts : averageSampleDuration;
                                ptsDelta = i > 0 ? avcSample.pts - inputSamples[i - 1].pts : averageSampleDuration;
                                if (config.stretchShortVideoTrack && this.nextAudioPts !== null) {
                                    // In some cases, a segment's audio track duration may exceed the video track duration.
                                    // Since we've already remuxed audio, and we know how long the audio track is, we look to
                                    // see if the delta to the next segment is longer than maxBufferHole.
                                    // If so, playback would potentially get stuck, so we artificially inflate
                                    // the duration of the last frame to minimize any potential gap between segments.
                                    const gapTolerance = Math.floor(config.maxBufferHole * timeScale);
                                    const deltaToFrameEnd = (audioTrackLength ? minPTS + audioTrackLength * timeScale : this.nextAudioPts) - avcSample.pts;
                                    if (deltaToFrameEnd > gapTolerance) {
                                        // We subtract lastFrameDuration from deltaToFrameEnd to try to prevent any video
                                        // frame overlap. maxBufferHole should be >> lastFrameDuration anyway.
                                        mp4SampleDuration = deltaToFrameEnd - lastFrameDuration;
                                        if (mp4SampleDuration < 0) {
                                            mp4SampleDuration = lastFrameDuration;
                                        } else {
                                            stretchedLastFrame = true;
                                        }
                                        _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.log(`[mp4-remuxer]: It is approximately ${deltaToFrameEnd / 90} ms to the next segment; using duration ${mp4SampleDuration / 90} ms for the last video frame.`);
                                    } else {
                                        mp4SampleDuration = lastFrameDuration;
                                    }
                                } else {
                                    mp4SampleDuration = lastFrameDuration;
                                }
                            }
                            const compositionTimeOffset = Math.round(avcSample.pts - avcSample.dts);
                            minDtsDelta = Math.min(minDtsDelta, mp4SampleDuration);
                            maxDtsDelta = Math.max(maxDtsDelta, mp4SampleDuration);
                            minPtsDelta = Math.min(minPtsDelta, ptsDelta);
                            maxPtsDelta = Math.max(maxPtsDelta, ptsDelta);
                            outputSamples.push(new Mp4Sample(avcSample.key, mp4SampleDuration, mp4SampleLength, compositionTimeOffset));
                        }
                        if (outputSamples.length) {
                            if (chromeVersion) {
                                if (chromeVersion < 70) {
                                    // Chrome workaround, mark first sample as being a Random Access Point (keyframe) to avoid sourcebuffer append issue
                                    // https://code.google.com/p/chromium/issues/detail?id=229412
                                    const flags = outputSamples[0].flags;
                                    flags.dependsOn = 2;
                                    flags.isNonSync = 0;
                                }
                            } else if (safariWebkitVersion) {
                                // Fix for "CNN special report, with CC" in test-streams (Safari browser only)
                                // Ignore DTS when frame durations are irregular. Safari MSE does not handle this leading to gaps.
                                if (maxPtsDelta - minPtsDelta < maxDtsDelta - minDtsDelta && averageSampleDuration / maxDtsDelta < 0.025 && outputSamples[0].cts === 0) {
                                    _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.warn('Found irregular gaps in sample duration. Using PTS instead of DTS to determine MP4 sample duration.');
                                    let dts = firstDTS;
                                    for (let i = 0, len = outputSamples.length; i < len; i++) {
                                        const nextDts = dts + outputSamples[i].duration;
                                        const pts = dts + outputSamples[i].cts;
                                        if (i < len - 1) {
                                            const nextPts = nextDts + outputSamples[i + 1].cts;
                                            outputSamples[i].duration = nextPts - pts;
                                        } else {
                                            outputSamples[i].duration = i ? outputSamples[i - 1].duration : averageSampleDuration;
                                        }
                                        outputSamples[i].cts = 0;
                                        dts = nextDts;
                                    }
                                }
                            }
                        }
                        console.assert(mp4SampleDuration !== null, 'mp4SampleDuration must be computed');
                        // next AVC sample DTS should be equal to last sample DTS + last sample duration (in PES timescale)
                        mp4SampleDuration = stretchedLastFrame || !mp4SampleDuration ? averageSampleDuration : mp4SampleDuration;
                        this.nextAvcDts = nextAvcDts = lastDTS + mp4SampleDuration;
                        this.videoSampleDuration = mp4SampleDuration;
                        this.isVideoContiguous = true;

                        const type = 'video';
                        const data = {
                            track,
                            outputSamples,
                            mdat,
                            startPTS: minPTS,
                            endPTS: (maxPTS + mp4SampleDuration),
                            startDTS: firstDTS,
                            endDTS: nextAvcDts,
                            type,
                            hasAudio: false,
                            hasVideo: true,
                            nb: outputSamples.length,
                            dropped: track.dropped
                        };
                        track.samples = [];
                        track.dropped = 0;
                        console.assert(mdat.length, 'MDAT length must not be zero');
                        return data;
                    }
                    remuxAudio(track, timeOffset, contiguous, accurateTimeOffset, videoTimeOffset) {
                        const inputTimeScale = track.inputTimeScale;
                        const mp4timeScale = track.samplerate ? track.samplerate : inputTimeScale;
                        const scaleFactor = inputTimeScale / mp4timeScale;
                        const mp4SampleDuration = track.segmentCodec === 'aac' ? AAC_SAMPLES_PER_FRAME : MPEG_AUDIO_SAMPLE_PER_FRAME;
                        const inputSampleDuration = mp4SampleDuration * scaleFactor;
                        const initPTS = this._initPTS;
                        const rawMPEG = track.segmentCodec === 'mp3' && this.typeSupported.mpeg;
                        const outputSamples = [];
                        const alignedWithVideo = videoTimeOffset !== undefined;
                        let inputSamples = track.samples;
                        let offset = rawMPEG ? 0 : 8;
                        let nextAudioPts = this.nextAudioPts || -1;

                        // window.audioSamples ? window.audioSamples.push(inputSamples.map(s => s.pts)) : (window.audioSamples = [inputSamples.map(s => s.pts)]);

                        // for audio samples, also consider consecutive fragments as being contiguous (even if a level switch occurs),
                        // for sake of clarity:
                        // consecutive fragments are frags with
                        //  - less than 100ms gaps between new time offset (if accurate) and next expected PTS OR
                        //  - less than 20 audio frames distance
                        // contiguous fragments are consecutive fragments from same quality level (same level, new SN = old SN + 1)
                        // this helps ensuring audio continuity
                        // and this also avoids audio glitches/cut when switching quality, or reporting wrong duration on first audio frame
                        const timeOffsetMpegTS = timeOffset * inputTimeScale;
                        this.isAudioContiguous = contiguous = contiguous || inputSamples.length && nextAudioPts > 0 && (accurateTimeOffset && Math.abs(timeOffsetMpegTS - nextAudioPts) < 9000 || Math.abs(normalizePts(inputSamples[0].pts - initPTS, timeOffsetMpegTS) - nextAudioPts) < 20 * inputSampleDuration);

                        // compute normalized PTS
                        inputSamples.forEach(function (sample) {
                            sample.pts = normalizePts(sample.pts - initPTS, timeOffsetMpegTS);
                        });
                        if (!contiguous || nextAudioPts < 0) {
                            // filter out sample with negative PTS that are not playable anyway
                            // if we don't remove these negative samples, they will shift all audio samples forward.
                            // leading to audio overlap between current / next fragment
                            inputSamples = inputSamples.filter(sample => sample.pts >= 0);

                            // in case all samples have negative PTS, and have been filtered out, return now
                            if (!inputSamples.length) {
                                return;
                            }
                            if (videoTimeOffset === 0) {
                                // Set the start to 0 to match video so that start gaps larger than inputSampleDuration are filled with silence
                                nextAudioPts = 0;
                            } else if (accurateTimeOffset && !alignedWithVideo) {
                                // When not seeking, not live, and LevelDetails.PTSKnown, use fragment start as predicted next audio PTS
                                nextAudioPts = Math.max(0, timeOffsetMpegTS);
                            } else {
                                // if frags are not contiguous and if we cant trust time offset, let's use first sample PTS as next audio PTS
                                nextAudioPts = inputSamples[0].pts;
                            }
                        }

                        // If the audio track is missing samples, the frames seem to get "left-shifted" within the
                        // resulting mp4 segment, causing sync issues and leaving gaps at the end of the audio segment.
                        // In an effort to prevent this from happening, we inject frames here where there are gaps.
                        // When possible, we inject a silent frame; when that's not possible, we duplicate the last
                        // frame.

                        if (track.segmentCodec === 'aac') {
                            const maxAudioFramesDrift = this.config.maxAudioFramesDrift;
                            for (let i = 0, nextPts = nextAudioPts; i < inputSamples.length; i++) {
                                // First, let's see how far off this frame is from where we expect it to be
                                const sample = inputSamples[i];
                                const pts = sample.pts;
                                const delta = pts - nextPts;
                                const duration = Math.abs(1000 * delta / inputTimeScale);

                                // When remuxing with video, if we're overlapping by more than a duration, drop this sample to stay in sync
                                if (delta <= -maxAudioFramesDrift * inputSampleDuration && alignedWithVideo) {
                                    if (i === 0) {
                                        _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.warn(`Audio frame @ ${(pts / inputTimeScale).toFixed(3)}s overlaps nextAudioPts by ${Math.round(1000 * delta / inputTimeScale)} ms.`);
                                        this.nextAudioPts = nextAudioPts = nextPts = pts;
                                    }
                                } // eslint-disable-line brace-style

                                // Insert missing frames if:
                                // 1: We're more than maxAudioFramesDrift frame away
                                // 2: Not more than MAX_SILENT_FRAME_DURATION away
                                // 3: currentTime (aka nextPtsNorm) is not 0
                                // 4: remuxing with video (videoTimeOffset !== undefined)
                                else if (delta >= maxAudioFramesDrift * inputSampleDuration && duration < MAX_SILENT_FRAME_DURATION && alignedWithVideo) {
                                    let missing = Math.round(delta / inputSampleDuration);
                                    // Adjust nextPts so that silent samples are aligned with media pts. This will prevent media samples from
                                    // later being shifted if nextPts is based on timeOffset and delta is not a multiple of inputSampleDuration.
                                    nextPts = pts - missing * inputSampleDuration;
                                    if (nextPts < 0) {
                                        missing--;
                                        nextPts += inputSampleDuration;
                                    }
                                    if (i === 0) {
                                        this.nextAudioPts = nextAudioPts = nextPts;
                                    }
                                    _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.warn(`[mp4-remuxer]: Injecting ${missing} audio frame @ ${(nextPts / inputTimeScale).toFixed(3)}s due to ${Math.round(1000 * delta / inputTimeScale)} ms gap.`);
                                    for (let j = 0; j < missing; j++) {
                                        const newStamp = Math.max(nextPts, 0);
                                        let fillFrame = _aac_helper__WEBPACK_IMPORTED_MODULE_0__["default"].getSilentFrame(track.manifestCodec || track.codec, track.channelCount);
                                        if (!fillFrame) {
                                            _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.log('[mp4-remuxer]: Unable to get silent frame for given audio codec; duplicating last frame instead.');
                                            fillFrame = sample.unit.subarray();
                                        }
                                        inputSamples.splice(i, 0, {
                                            unit: fillFrame,
                                            pts: newStamp
                                        });
                                        nextPts += inputSampleDuration;
                                        i++;
                                    }
                                }
                                sample.pts = nextPts;
                                nextPts += inputSampleDuration;
                            }
                        }
                        let firstPTS = null;
                        let lastPTS = null;
                        let mdat;
                        let mdatSize = 0;
                        let sampleLength = inputSamples.length;
                        while (sampleLength--) {
                            mdatSize += inputSamples[sampleLength].unit.byteLength;
                        }
                        for (let j = 0, nbSamples = inputSamples.length; j < nbSamples; j++) {
                            const audioSample = inputSamples[j];
                            const unit = audioSample.unit;
                            let pts = audioSample.pts;
                            if (lastPTS !== null) {
                                // If we have more than one sample, set the duration of the sample to the "real" duration; the PTS diff with
                                // the previous sample
                                const prevSample = outputSamples[j - 1];
                                prevSample.duration = Math.round((pts - lastPTS) / scaleFactor);
                            } else {
                                //  let delta = pts - nextAudioPts;
                                //console.log('delta', delta, pts);
                                if (contiguous && track.segmentCodec === 'aac') {
                                    // set PTS/DTS to expected PTS/DTS
                                    pts = nextAudioPts;
                                }
                                // remember first PTS of our audioSamples
                                firstPTS = pts;
                                if (mdatSize > 0) {
                                    /* concatenate the audio data and construct the mdat in place
                                      (need 8 more bytes to fill length and mdat type) */
                                    mdatSize += offset;
                                    try {
                                        mdat = new Uint8Array(mdatSize);
                                    } catch (err) {
                                        this.observer.emit(_events__WEBPACK_IMPORTED_MODULE_2__.Events.ERROR, _events__WEBPACK_IMPORTED_MODULE_2__.Events.ERROR, {
                                            type: _errors__WEBPACK_IMPORTED_MODULE_3__.ErrorTypes.MUX_ERROR,
                                            details: _errors__WEBPACK_IMPORTED_MODULE_3__.ErrorDetails.REMUX_ALLOC_ERROR,
                                            fatal: false,
                                            bytes: mdatSize,
                                            reason: `fail allocating audio mdat ${mdatSize}`
                                        });
                                        return;
                                    }
                                    if (!rawMPEG) {
                                        const view = new DataView(mdat.buffer);
                                        view.setUint32(0, mdatSize);
                                        mdat.set(_mp4_generator__WEBPACK_IMPORTED_MODULE_1__["default"].types.mdat, 4);
                                    }
                                } else {
                                    // no audio samples
                                    return;
                                }
                            }
                            mdat.set(unit, offset);
                            const unitLen = unit.byteLength;
                            offset += unitLen;
                            // Default the sample's duration to the computed mp4SampleDuration, which will either be 1024 for AAC or 1152 for MPEG
                            // In the case that we have 1 sample, this will be the duration. If we have more than one sample, the duration
                            // becomes the PTS diff with the previous sample
                            outputSamples.push(new Mp4Sample(true, mp4SampleDuration, unitLen, 0));
                            lastPTS = pts;
                        }

                        // We could end up with no audio samples if all input samples were overlapping with the previously remuxed ones
                        const nbSamples = outputSamples.length;
                        if (!nbSamples) {
                            return;
                        }

                        // The next audio sample PTS should be equal to last sample PTS + duration
                        const lastSample = outputSamples[outputSamples.length - 1];
                        this.nextAudioPts = nextAudioPts = lastPTS + scaleFactor * lastSample.duration;

                        // Set the track samples from inputSamples to outputSamples before remuxing
                        // const moof = rawMPEG ? new Uint8Array(0) : _mp4_generator__WEBPACK_IMPORTED_MODULE_1__["default"].moof(track.sequenceNumber++, firstPTS / scaleFactor, Object.assign({}, track, {
                        //     samples: outputSamples
                        // }));


                        // Clear the track samples. This also clears the samples array in the demuxer, since the reference is shared
                        track.samples = [];
                        const start = firstPTS;
                        const end = nextAudioPts;
                        const type = 'audio';
                        const audioData = {
                            track,
                            outputSamples,
                            mdat,
                            startPTS: start,
                            endPTS: end,
                            startDTS: start,
                            endDTS: end,
                            type,
                            hasAudio: true,
                            hasVideo: false,
                            nb: nbSamples
                        };
                        this.isAudioContiguous = true;
                        console.assert(mdat.length, 'MDAT length must not be zero');
                        return audioData;
                    }
                    remuxEmptyAudio(track, timeOffset, contiguous, videoData) {
                        const inputTimeScale = track.inputTimeScale;
                        const mp4timeScale = track.samplerate ? track.samplerate : inputTimeScale;
                        const scaleFactor = inputTimeScale / mp4timeScale;
                        const nextAudioPts = this.nextAudioPts;
                        // sync with video's timestamp
                        const startDTS = (nextAudioPts !== null ? nextAudioPts : videoData.startDTS * inputTimeScale) + this._initDTS;
                        const endDTS = videoData.endDTS * inputTimeScale + this._initDTS;
                        // one sample's duration value
                        const frameDuration = scaleFactor * AAC_SAMPLES_PER_FRAME;
                        // samples count of this segment's duration
                        const nbSamples = Math.ceil((endDTS - startDTS) / frameDuration);
                        // silent frame
                        const silentFrame = _aac_helper__WEBPACK_IMPORTED_MODULE_0__["default"].getSilentFrame(track.manifestCodec || track.codec, track.channelCount);
                        _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.warn('[mp4-remuxer]: remux empty Audio');
                        // Can't remux if we can't generate a silent frame...
                        if (!silentFrame) {
                            _utils_logger__WEBPACK_IMPORTED_MODULE_4__.logger.trace('[mp4-remuxer]: Unable to remuxEmptyAudio since we were unable to get a silent frame for given audio codec');
                            return;
                        }
                        const samples = [];
                        for (let i = 0; i < nbSamples; i++) {
                            const stamp = startDTS + i * frameDuration;
                            samples.push({
                                unit: silentFrame,
                                pts: stamp,
                                dts: stamp
                            });
                        }
                        track.samples = samples;
                        return this.remuxAudio(track, timeOffset, contiguous, false);
                    }
                }
                function normalizePts(value, reference) {
                    let offset;
                    if (reference === null) {
                        return value;
                    }
                    if (reference < value) {
                        // - 2^33
                        offset = -8589934592;
                    } else {
                        // + 2^33
                        offset = 8589934592;
                    }
                    /* PTS is 33bit (from 0 to 2^33 -1)
                      if diff between value and reference is bigger than half of the amplitude (2^32) then it means that
                      PTS looping occured. fill the gap */
                    while (Math.abs(value - reference) > 4294967296) {
                        value += offset;
                    }
                    return value;
                }
                function findKeyframeIndex(samples) {
                    for (let i = 0; i < samples.length; i++) {
                        if (samples[i].key) {
                            return i;
                        }
                    }
                    return -1;
                }
                function flushTextTrackMetadataCueSamples(track, timeOffset, initPTS, initDTS) {
                    const length = track.samples.length;
                    if (!length) {
                        return;
                    }
                    const inputTimeScale = track.inputTimeScale;
                    for (let index = 0; index < length; index++) {
                        const sample = track.samples[index];
                        // setting id3 pts, dts to relative time
                        // using this._initPTS and this._initDTS to calculate relative time
                        sample.pts = normalizePts(sample.pts - initPTS, timeOffset * inputTimeScale) / inputTimeScale;
                        sample.dts = normalizePts(sample.dts - initDTS, timeOffset * inputTimeScale) / inputTimeScale;
                    }
                    const samples = track.samples;
                    track.samples = [];
                    return {
                        samples
                    };
                }
                function flushTextTrackUserdataCueSamples(track, timeOffset, initPTS) {
                    const length = track.samples.length;
                    if (!length) {
                        return;
                    }
                    const inputTimeScale = track.inputTimeScale;
                    for (let index = 0; index < length; index++) {
                        const sample = track.samples[index];
                        // setting text pts, dts to relative time
                        // using this._initPTS and this._initDTS to calculate relative time
                        sample.pts = normalizePts(sample.pts - initPTS, timeOffset * inputTimeScale) / inputTimeScale;
                    }
                    track.samples.sort((a, b) => a.pts - b.pts);
                    const samples = track.samples;
                    track.samples = [];
                    return {
                        samples
                    };
                }
                class Mp4Sample {
                    constructor(isKeyframe, duration, size, cts) {
                        this.duration = duration;
                        this.size = size;
                        this.cts = cts;
                        this.flags = new Mp4SampleFlags(isKeyframe);
                    }
                }
                class Mp4SampleFlags {
                    isLeading = 0;
                    isDependedOn = 0;
                    hasRedundancy = 0;
                    degradPrio = 0;
                    dependsOn = 1;
                    isNonSync = 1;
                    constructor(isKeyframe) {
                        this.dependsOn = isKeyframe ? 2 : 1;
                        this.isNonSync = isKeyframe ? 0 : 1;
                    }
                }

                /***/
            }),

/***/ "./src/remux/passthrough-remuxer.ts":
/*!******************************************!*\
  !*** ./src/remux/passthrough-remuxer.ts ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
                    /* harmony export */
                });
/* harmony import */ var _mp4_remuxer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./mp4-remuxer */ "./src/remux/mp4-remuxer.ts");
/* harmony import */ var _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/mp4-tools */ "./src/utils/mp4-tools.ts");
/* harmony import */ var _loader_fragment__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../loader/fragment */ "./src/loader/fragment.ts");
/* harmony import */ var _utils_logger__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.ts");





                class PassThroughRemuxer {
                    emitInitSegment = false;
                    lastEndTime = null;
                    destroy() { }
                    resetTimeStamp(defaultInitPTS) {
                        this.initPTS = defaultInitPTS;
                        this.lastEndTime = null;
                    }
                    resetNextTimestamp() {
                        this.lastEndTime = null;
                    }
                    resetInitSegment(initSegment, audioCodec, videoCodec, decryptdata) {
                        this.audioCodec = audioCodec;
                        this.videoCodec = videoCodec;
                        this.generateInitSegment((0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.patchEncyptionData)(initSegment, decryptdata));
                        this.emitInitSegment = true;
                    }
                    generateInitSegment(initSegment) {
                        let {
                            audioCodec,
                            videoCodec
                        } = this;
                        if (!initSegment || !initSegment.byteLength) {
                            this.initTracks = undefined;
                            this.initData = undefined;
                            return;
                        }
                        const initData = this.initData = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.parseInitSegment)(initSegment);

                        // Get codec from initSegment or fallback to default
                        if (!audioCodec) {
                            audioCodec = getParsedTrackCodec(initData.audio, _loader_fragment__WEBPACK_IMPORTED_MODULE_2__.ElementaryStreamTypes.AUDIO);
                        }
                        if (!videoCodec) {
                            videoCodec = getParsedTrackCodec(initData.video, _loader_fragment__WEBPACK_IMPORTED_MODULE_2__.ElementaryStreamTypes.VIDEO);
                        }
                        const tracks = {};
                        if (initData.audio && initData.video) {
                            tracks.audiovideo = {
                                container: 'video/mp4',
                                codec: audioCodec + ',' + videoCodec,
                                initSegment,
                                id: 'main'
                            };
                        } else if (initData.audio) {
                            tracks.audio = {
                                container: 'audio/mp4',
                                codec: audioCodec,
                                initSegment,
                                id: 'audio'
                            };
                        } else if (initData.video) {
                            tracks.video = {
                                container: 'video/mp4',
                                codec: videoCodec,
                                initSegment,
                                id: 'main'
                            };
                        } else {
                            _utils_logger__WEBPACK_IMPORTED_MODULE_3__.logger.warn('[passthrough-remuxer.ts]: initSegment does not contain moov or trak boxes.');
                        }
                        this.initTracks = tracks;
                    }
                    remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset) {
                        let {
                            initPTS,
                            lastEndTime
                        } = this;
                        const result = {
                            audio: undefined,
                            video: undefined,
                            text: textTrack,
                            id3: id3Track,
                            initSegment: undefined
                        };

                        // If we haven't yet set a lastEndDTS, or it was reset, set it to the provided timeOffset. We want to use the
                        // lastEndDTS over timeOffset whenever possible; during progressive playback, the media source will not update
                        // the media duration (which is what timeOffset is provided as) before we need to process the next chunk.
                        if (!Number.isFinite(lastEndTime)) {
                            lastEndTime = this.lastEndTime = timeOffset || 0;
                        }

                        // The binary segment data is added to the videoTrack in the mp4demuxer. We don't check to see if the data is only
                        // audio or video (or both); adding it to video was an arbitrary choice.
                        const data = videoTrack.samples;
                        if (!data || !data.length) {
                            return result;
                        }
                        const initSegment = {
                            initPTS: undefined,
                            timescale: 1
                        };
                        let initData = this.initData;
                        if (!initData || !initData.length) {
                            this.generateInitSegment(data);
                            initData = this.initData;
                        }
                        if (!initData || !initData.length) {
                            // We can't remux if the initSegment could not be generated
                            _utils_logger__WEBPACK_IMPORTED_MODULE_3__.logger.warn('[passthrough-remuxer.ts]: Failed to generate initSegment.');
                            return result;
                        }
                        if (this.emitInitSegment) {
                            initSegment.tracks = this.initTracks;
                            this.emitInitSegment = false;
                        }
                        const startDTS = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.getStartDTS)(initData, data);
                        if (!Number.isFinite(initPTS)) {
                            this.initPTS = initSegment.initPTS = initPTS = startDTS - timeOffset;
                        }
                        const duration = (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.getDuration)(data, initData);
                        const startTime = audioTrack ? startDTS - initPTS : lastEndTime;
                        const endTime = startTime + duration;
                        (0, _utils_mp4_tools__WEBPACK_IMPORTED_MODULE_1__.offsetStartDTS)(initData, data, initPTS);
                        if (duration > 0) {
                            this.lastEndTime = endTime;
                        } else {
                            _utils_logger__WEBPACK_IMPORTED_MODULE_3__.logger.warn('Duration parsed from mp4 should be greater than zero');
                            this.resetNextTimestamp();
                        }
                        const hasAudio = !!initData.audio;
                        const hasVideo = !!initData.video;
                        let type = '';
                        if (hasAudio) {
                            type += 'audio';
                        }
                        if (hasVideo) {
                            type += 'video';
                        }
                        const track = {
                            data1: data,
                            startPTS: startTime,
                            startDTS: startTime,
                            endPTS: endTime,
                            endDTS: endTime,
                            type,
                            hasAudio,
                            hasVideo,
                            nb: 1,
                            dropped: 0
                        };
                        result.audio = track.type === 'audio' ? track : undefined;
                        result.video = track.type !== 'audio' ? track : undefined;
                        result.initSegment = initSegment;
                        const initPtsNum = this.initPTS ?? 0;
                        result.id3 = (0, _mp4_remuxer__WEBPACK_IMPORTED_MODULE_0__.flushTextTrackMetadataCueSamples)(id3Track, timeOffset, initPtsNum, initPtsNum);
                        if (textTrack.samples.length) {
                            result.text = (0, _mp4_remuxer__WEBPACK_IMPORTED_MODULE_0__.flushTextTrackUserdataCueSamples)(textTrack, timeOffset, initPtsNum);
                        }
                        return result;
                    }
                }
                function getParsedTrackCodec(track, type) {
                    const parsedCodec = track?.codec;
                    if (parsedCodec && parsedCodec.length > 4) {
                        return parsedCodec;
                    }
                    // Since mp4-tools cannot parse full codec string (see 'TODO: Parse codec details'... in mp4-tools)
                    // Provide defaults based on codec type
                    // This allows for some playback of some fmp4 playlists without CODECS defined in manifest
                    if (parsedCodec === 'hvc1' || parsedCodec === 'hev1') {
                        return 'hvc1.1.c.L120.90';
                    }
                    if (parsedCodec === 'av01') {
                        return 'av01.0.04M.08';
                    }
                    if (parsedCodec === 'avc1' || type === _loader_fragment__WEBPACK_IMPORTED_MODULE_2__.ElementaryStreamTypes.VIDEO) {
                        return 'avc1.42e01e';
                    }
                    return 'mp4a.40.5';
                }
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (PassThroughRemuxer);

                /***/
            }),

/***/ "./src/types/demuxer.ts":
/*!******************************!*\
  !*** ./src/types/demuxer.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "MetadataSchema": () => (/* binding */ MetadataSchema)
                    /* harmony export */
                });
                let MetadataSchema;
                (function (MetadataSchema) {
                    MetadataSchema["audioId3"] = "org.id3";
                    MetadataSchema["dateRange"] = "com.apple.quicktime.HLS";
                    MetadataSchema["emsg"] = "https://aomedia.org/emsg/ID3";
                })(MetadataSchema || (MetadataSchema = {}));

                /***/
            }),

/***/ "./src/types/loader.ts":
/*!*****************************!*\
  !*** ./src/types/loader.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "PlaylistContextType": () => (/* binding */ PlaylistContextType),
/* harmony export */   "PlaylistLevelType": () => (/* binding */ PlaylistLevelType)
                    /* harmony export */
                });
                let PlaylistContextType;
                (function (PlaylistContextType) {
                    PlaylistContextType["MANIFEST"] = "manifest";
                    PlaylistContextType["LEVEL"] = "level";
                    PlaylistContextType["AUDIO_TRACK"] = "audioTrack";
                    PlaylistContextType["SUBTITLE_TRACK"] = "subtitleTrack";
                })(PlaylistContextType || (PlaylistContextType = {}));
                let PlaylistLevelType;
                (function (PlaylistLevelType) {
                    PlaylistLevelType["MAIN"] = "main";
                    PlaylistLevelType["AUDIO"] = "audio";
                    PlaylistLevelType["SUBTITLE"] = "subtitle";
                })(PlaylistLevelType || (PlaylistLevelType = {}));

                /***/
            }),

/***/ "./src/utils/hex.ts":
/*!**************************!*\
  !*** ./src/utils/hex.ts ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
                    /* harmony export */
                });
                /**
                 *  hex dump helper class
                 */

                const Hex = {
                    hexDump: function (array) {
                        let str = '';
                        for (let i = 0; i < array.length; i++) {
                            let h = array[i].toString(16);
                            if (h.length < 2) {
                                h = '0' + h;
                            }
                            str += h;
                        }
                        return str;
                    }
                };
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Hex);

                /***/
            }),

/***/ "./src/utils/logger.ts":
/*!*****************************!*\
  !*** ./src/utils/logger.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "enableLogs": () => (/* binding */ enableLogs),
/* harmony export */   "logger": () => (/* binding */ logger)
                    /* harmony export */
                });
                const noop = function () { };
                const fakeLogger = {
                    trace: noop,
                    debug: noop,
                    log: noop,
                    warn: noop,
                    info: noop,
                    error: noop
                };
                let exportedLogger = fakeLogger;

                // let lastCallTime;
                // function formatMsgWithTimeInfo(type, msg) {
                //   const now = Date.now();
                //   const diff = lastCallTime ? '+' + (now - lastCallTime) : '0';
                //   lastCallTime = now;
                //   msg = (new Date(now)).toISOString() + ' | [' +  type + '] > ' + msg + ' ( ' + diff + ' ms )';
                //   return msg;
                // }

                function consolePrintFn(type) {
                    const func = self.console[type];
                    if (func) {
                        return func.bind(self.console, `[${type}] >`);
                    }
                    return noop;
                }
                function exportLoggerFunctions(debugConfig, ...functions) {
                    functions.forEach(function (type) {
                        exportedLogger[type] = debugConfig[type] ? debugConfig[type].bind(debugConfig) : consolePrintFn(type);
                    });
                }
                function enableLogs(debugConfig, id) {
                    // check that console is available
                    if (self.console && debugConfig === true || typeof debugConfig === 'object') {
                        exportLoggerFunctions(debugConfig,
                            // Remove out from list here to hard-disable a log-level
                            // 'trace',
                            'debug', 'log', 'info', 'warn', 'error');
                        // Some browsers don't allow to use bind on console object anyway
                        // fallback to default if needed
                        try {
                            exportedLogger.log(`Debug logs enabled for "${id}"`);
                        } catch (e) {
                            exportedLogger = fakeLogger;
                        }
                    } else {
                        exportedLogger = fakeLogger;
                    }
                }
                const logger = exportedLogger;

                enableLogs(true, 'hls_mux.js');

                /***/
            }),

/***/ "./src/utils/mp4-tools.ts":
/*!********************************!*\
  !*** ./src/utils/mp4-tools.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "RemuxerTrackIdConfig": () => (/* binding */ RemuxerTrackIdConfig),
/* harmony export */   "appendUint8Array": () => (/* binding */ appendUint8Array),
/* harmony export */   "bin2str": () => (/* binding */ bin2str),
/* harmony export */   "computeRawDurationFromSamples": () => (/* binding */ computeRawDurationFromSamples),
/* harmony export */   "discardEPB": () => (/* binding */ discardEPB),
/* harmony export */   "findBox": () => (/* binding */ findBox),
/* harmony export */   "getDuration": () => (/* binding */ getDuration),
/* harmony export */   "getStartDTS": () => (/* binding */ getStartDTS),
/* harmony export */   "mp4Box": () => (/* binding */ mp4Box),
/* harmony export */   "mp4pssh": () => (/* binding */ mp4pssh),
/* harmony export */   "offsetStartDTS": () => (/* binding */ offsetStartDTS),
/* harmony export */   "parseEmsg": () => (/* binding */ parseEmsg),
/* harmony export */   "parseInitSegment": () => (/* binding */ parseInitSegment),
/* harmony export */   "parsePssh": () => (/* binding */ parsePssh),
/* harmony export */   "parseSEIMessageFromNALu": () => (/* binding */ parseSEIMessageFromNALu),
/* harmony export */   "parseSamples": () => (/* binding */ parseSamples),
/* harmony export */   "parseSegmentIndex": () => (/* binding */ parseSegmentIndex),
/* harmony export */   "parseSinf": () => (/* binding */ parseSinf),
/* harmony export */   "patchEncyptionData": () => (/* binding */ patchEncyptionData),
/* harmony export */   "readSint32": () => (/* binding */ readSint32),
/* harmony export */   "readUint16": () => (/* binding */ readUint16),
/* harmony export */   "readUint32": () => (/* binding */ readUint32),
/* harmony export */   "segmentValidRange": () => (/* binding */ segmentValidRange),
/* harmony export */   "writeUint32": () => (/* binding */ writeUint32)
                    /* harmony export */
                });
/* harmony import */ var _loader_fragment__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../loader/fragment */ "./src/loader/fragment.ts");
/* harmony import */ var _typed_array__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./typed-array */ "./src/utils/typed-array.ts");
/* harmony import */ var _demux_id3__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../demux/id3 */ "./src/demux/id3.ts");
/* harmony import */ var _utils_logger__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.ts");
/* harmony import */ var _hex__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./hex */ "./src/utils/hex.ts");





                const UINT32_MAX = Math.pow(2, 32) - 1;
                const push = [].push;

                // We are using fixed track IDs for driving the MP4 remuxer
                // instead of following the TS PIDs.
                // There is no reason not to do this and some browsers/SourceBuffer-demuxers
                // may not like if there are TrackID "switches"
                // See https://github.com/video-dev/hls.js/issues/1331
                // Here we are mapping our internal track types to constant MP4 track IDs
                // With MSE currently one can only have one track of each, and we are muxing
                // whatever video/audio rendition in them.
                const RemuxerTrackIdConfig = {
                    video: 1,
                    audio: 2,
                    id3: 3,
                    text: 4
                };
                function bin2str(data) {
                    return String.fromCharCode.apply(null, data);
                }
                function readUint16(buffer, offset) {
                    const val = buffer[offset] << 8 | buffer[offset + 1];
                    return val < 0 ? 65536 + val : val;
                }
                function readUint32(buffer, offset) {
                    const val = readSint32(buffer, offset);
                    return val < 0 ? 4294967296 + val : val;
                }
                function readSint32(buffer, offset) {
                    return buffer[offset] << 24 | buffer[offset + 1] << 16 | buffer[offset + 2] << 8 | buffer[offset + 3];
                }
                function writeUint32(buffer, offset, value) {
                    buffer[offset] = value >> 24;
                    buffer[offset + 1] = value >> 16 & 0xff;
                    buffer[offset + 2] = value >> 8 & 0xff;
                    buffer[offset + 3] = value & 0xff;
                }

                // Find the data for a box specified by its path
                function findBox(data, path) {
                    const results = [];
                    if (!path.length) {
                        // short-circuit the search for empty paths
                        return results;
                    }
                    const end = data.byteLength;
                    for (let i = 0; i < end;) {
                        const size = readUint32(data, i);
                        const type = bin2str(data.subarray(i + 4, i + 8));
                        const endbox = size > 1 ? i + size : end;
                        if (type === path[0]) {
                            if (path.length === 1) {
                                // this is the end of the path and we've found the box we were
                                // looking for
                                results.push(data.subarray(i + 8, endbox));
                            } else {
                                // recursively search for the next box along the path
                                const subresults = findBox(data.subarray(i + 8, endbox), path.slice(1));
                                if (subresults.length) {
                                    push.apply(results, subresults);
                                }
                            }
                        }
                        i = endbox;
                    }

                    // we've finished searching all of data
                    return results;
                }
                function parseSegmentIndex(sidx) {
                    const references = [];
                    const version = sidx[0];

                    // set initial offset, we skip the reference ID (not needed)
                    let index = 8;
                    const timescale = readUint32(sidx, index);
                    index += 4;

                    // TODO: parse earliestPresentationTime and firstOffset
                    // usually zero in our case
                    const earliestPresentationTime = 0;
                    const firstOffset = 0;
                    if (version === 0) {
                        index += 8;
                    } else {
                        index += 16;
                    }

                    // skip reserved
                    index += 2;
                    let startByte = sidx.length + firstOffset;
                    const referencesCount = readUint16(sidx, index);
                    index += 2;
                    for (let i = 0; i < referencesCount; i++) {
                        let referenceIndex = index;
                        const referenceInfo = readUint32(sidx, referenceIndex);
                        referenceIndex += 4;
                        const referenceSize = referenceInfo & 0x7fffffff;
                        const referenceType = (referenceInfo & 0x80000000) >>> 31;
                        if (referenceType === 1) {
                            // eslint-disable-next-line no-console
                            console.warn('SIDX has hierarchical references (not supported)');
                            return null;
                        }
                        const subsegmentDuration = readUint32(sidx, referenceIndex);
                        referenceIndex += 4;
                        references.push({
                            referenceSize,
                            subsegmentDuration,
                            // unscaled
                            info: {
                                duration: subsegmentDuration / timescale,
                                start: startByte,
                                end: startByte + referenceSize - 1
                            }
                        });
                        startByte += referenceSize;

                        // Skipping 1 bit for |startsWithSap|, 3 bits for |sapType|, and 28 bits
                        // for |sapDelta|.
                        referenceIndex += 4;

                        // skip to next ref
                        index = referenceIndex;
                    }
                    return {
                        earliestPresentationTime,
                        timescale,
                        version,
                        referencesCount,
                        references
                    };
                }

                /**
                 * Parses an MP4 initialization segment and extracts stream type and
                 * timescale values for any declared tracks. Timescale values indicate the
                 * number of clock ticks per second to assume for time-based values
                 * elsewhere in the MP4.
                 *
                 * To determine the start time of an MP4, you need two pieces of
                 * information: the timescale unit and the earliest base media decode
                 * time. Multiple timescales can be specified within an MP4 but the
                 * base media decode time is always expressed in the timescale from
                 * the media header box for the track:
                 * ```
                 * moov > trak > mdia > mdhd.timescale
                 * moov > trak > mdia > hdlr
                 * ```
                 * @param initSegment {Uint8Array} the bytes of the init segment
                 * @return {InitData} a hash of track type to timescale values or null if
                 * the init segment is malformed.
                 */

                function parseInitSegment(initSegment) {
                    const result = [];
                    const traks = findBox(initSegment, ['moov', 'trak']);
                    for (let i = 0; i < traks.length; i++) {
                        const trak = traks[i];
                        const tkhd = findBox(trak, ['tkhd'])[0];
                        if (tkhd) {
                            let version = tkhd[0];
                            let index = version === 0 ? 12 : 20;
                            const trackId = readUint32(tkhd, index);
                            const mdhd = findBox(trak, ['mdia', 'mdhd'])[0];
                            if (mdhd) {
                                version = mdhd[0];
                                index = version === 0 ? 12 : 20;
                                const timescale = readUint32(mdhd, index);
                                const hdlr = findBox(trak, ['mdia', 'hdlr'])[0];
                                if (hdlr) {
                                    const hdlrType = bin2str(hdlr.subarray(8, 12));
                                    const type = {
                                        soun: _loader_fragment__WEBPACK_IMPORTED_MODULE_0__.ElementaryStreamTypes.AUDIO,
                                        vide: _loader_fragment__WEBPACK_IMPORTED_MODULE_0__.ElementaryStreamTypes.VIDEO
                                    }[hdlrType];
                                    if (type) {
                                        // Parse codec details
                                        const stsd = findBox(trak, ['mdia', 'minf', 'stbl', 'stsd'])[0];
                                        let codec;
                                        if (stsd) {
                                            codec = bin2str(stsd.subarray(12, 16));
                                            // TODO: Parse codec details to be able to build MIME type.
                                            // stsd.start += 8;
                                            // const codecBox = findBox(stsd, [codec])[0];
                                            // if (codecBox) {
                                            //   TODO: Codec parsing support for avc1, mp4a, hevc, av01...
                                            // }
                                        }

                                        result[trackId] = {
                                            timescale,
                                            type
                                        };
                                        result[type] = {
                                            timescale,
                                            id: trackId,
                                            codec
                                        };
                                    }
                                }
                            }
                        }
                    }
                    const trex = findBox(initSegment, ['moov', 'mvex', 'trex']);
                    trex.forEach(trex => {
                        const trackId = readUint32(trex, 4);
                        const track = result[trackId];
                        if (track) {
                            track.default = {
                                duration: readUint32(trex, 12),
                                flags: readUint32(trex, 20)
                            };
                        }
                    });
                    return result;
                }
                function patchEncyptionData(initSegment, decryptdata) {
                    if (!initSegment || !decryptdata) {
                        return initSegment;
                    }
                    const keyId = decryptdata.keyId;
                    if (keyId && decryptdata.isCommonEncryption) {
                        const traks = findBox(initSegment, ['moov', 'trak']);
                        traks.forEach(trak => {
                            const stsd = findBox(trak, ['mdia', 'minf', 'stbl', 'stsd'])[0];

                            // skip the sample entry count
                            const sampleEntries = stsd.subarray(8);
                            let encBoxes = findBox(sampleEntries, ['enca']);
                            const isAudio = encBoxes.length > 0;
                            if (!isAudio) {
                                encBoxes = findBox(sampleEntries, ['encv']);
                            }
                            encBoxes.forEach(enc => {
                                const encBoxChildren = isAudio ? enc.subarray(28) : enc.subarray(78);
                                const sinfBoxes = findBox(encBoxChildren, ['sinf']);
                                sinfBoxes.forEach(sinf => {
                                    const tenc = parseSinf(sinf);
                                    if (tenc) {
                                        // Look for default key id (keyID offset is always 8 within the tenc box):
                                        const tencKeyId = tenc.subarray(8, 24);
                                        if (!tencKeyId.some(b => b !== 0)) {
                                            _utils_logger__WEBPACK_IMPORTED_MODULE_3__.logger.log(`[eme] Patching keyId in 'enc${isAudio ? 'a' : 'v'}>sinf>>tenc' box: ${_hex__WEBPACK_IMPORTED_MODULE_4__["default"].hexDump(tencKeyId)} -> ${_hex__WEBPACK_IMPORTED_MODULE_4__["default"].hexDump(keyId)}`);
                                            tenc.set(keyId, 8);
                                        }
                                    }
                                });
                            });
                        });
                    }
                    return initSegment;
                }
                function parseSinf(sinf) {
                    const schm = findBox(sinf, ['schm'])[0];
                    if (schm) {
                        const scheme = bin2str(schm.subarray(4, 8));
                        if (scheme === 'cbcs' || scheme === 'cenc') {
                            return findBox(sinf, ['schi', 'tenc'])[0];
                        }
                    }
                    _utils_logger__WEBPACK_IMPORTED_MODULE_3__.logger.error(`[eme] missing 'schm' box`);
                    return null;
                }

                /**
                 * Determine the base media decode start time, in seconds, for an MP4
                 * fragment. If multiple fragments are specified, the earliest time is
                 * returned.
                 *
                 * The base media decode time can be parsed from track fragment
                 * metadata:
                 * ```
                 * moof > traf > tfdt.baseMediaDecodeTime
                 * ```
                 * It requires the timescale value from the mdhd to interpret.
                 *
                 * @param initData {InitData} a hash of track type to timescale values
                 * @param fmp4 {Uint8Array} the bytes of the mp4 fragment
                 * @return {number} the earliest base media decode start time for the
                 * fragment, in seconds
                 */
                function getStartDTS(initData, fmp4) {
                    // we need info from two children of each track fragment box
                    return findBox(fmp4, ['moof', 'traf']).reduce((result, traf) => {
                        const tfdt = findBox(traf, ['tfdt'])[0];
                        const version = tfdt[0];
                        const start = findBox(traf, ['tfhd']).reduce((result, tfhd) => {
                            // get the track id from the tfhd
                            const id = readUint32(tfhd, 4);
                            const track = initData[id];
                            if (track) {
                                let baseTime = readUint32(tfdt, 4);
                                if (version === 1) {
                                    baseTime *= Math.pow(2, 32);
                                    baseTime += readUint32(tfdt, 8);
                                }
                                // assume a 90kHz clock if no timescale was specified
                                const scale = track.timescale || 90e3;
                                // convert base time to seconds
                                const startTime = baseTime / scale;
                                if (isFinite(startTime) && (result === null || startTime < result)) {
                                    return startTime;
                                }
                            }
                            return result;
                        }, null);
                        if (start !== null && isFinite(start) && (result === null || start < result)) {
                            return start;
                        }
                        return result;
                    }, null) || 0;
                }

                /*
                  For Reference:
                  aligned(8) class TrackFragmentHeaderBox
                           extends FullBox(‘tfhd’, 0, tf_flags){
                     unsigned int(32)  track_ID;
                     // all the following are optional fields
                     unsigned int(64)  base_data_offset;
                     unsigned int(32)  sample_description_index;
                     unsigned int(32)  default_sample_duration;
                     unsigned int(32)  default_sample_size;
                     unsigned int(32)  default_sample_flags
                  }
                 */
                function getDuration(data, initData) {
                    let rawDuration = 0;
                    let videoDuration = 0;
                    let audioDuration = 0;
                    const trafs = findBox(data, ['moof', 'traf']);
                    for (let i = 0; i < trafs.length; i++) {
                        const traf = trafs[i];
                        // There is only one tfhd & trun per traf
                        // This is true for CMAF style content, and we should perhaps check the ftyp
                        // and only look for a single trun then, but for ISOBMFF we should check
                        // for multiple track runs.
                        const tfhd = findBox(traf, ['tfhd'])[0];
                        // get the track id from the tfhd
                        const id = readUint32(tfhd, 4);
                        const track = initData[id];
                        if (!track) {
                            continue;
                        }
                        const trackDefault = track.default;
                        const tfhdFlags = readUint32(tfhd, 0) | trackDefault?.flags;
                        let sampleDuration = trackDefault?.duration;
                        if (tfhdFlags & 0x000008) {
                            // 0x000008 indicates the presence of the default_sample_duration field
                            if (tfhdFlags & 0x000002) {
                                // 0x000002 indicates the presence of the sample_description_index field, which precedes default_sample_duration
                                // If present, the default_sample_duration exists at byte offset 12
                                sampleDuration = readUint32(tfhd, 12);
                            } else {
                                // Otherwise, the duration is at byte offset 8
                                sampleDuration = readUint32(tfhd, 8);
                            }
                        }
                        // assume a 90kHz clock if no timescale was specified
                        const timescale = track.timescale || 90e3;
                        const truns = findBox(traf, ['trun']);
                        for (let j = 0; j < truns.length; j++) {
                            rawDuration = computeRawDurationFromSamples(truns[j]);
                            if (!rawDuration && sampleDuration) {
                                const sampleCount = readUint32(truns[j], 4);
                                rawDuration = sampleDuration * sampleCount;
                            }
                            if (track.type === _loader_fragment__WEBPACK_IMPORTED_MODULE_0__.ElementaryStreamTypes.VIDEO) {
                                videoDuration += rawDuration / timescale;
                            } else if (track.type === _loader_fragment__WEBPACK_IMPORTED_MODULE_0__.ElementaryStreamTypes.AUDIO) {
                                audioDuration += rawDuration / timescale;
                            }
                        }
                    }
                    if (videoDuration === 0 && audioDuration === 0) {
                        // If duration samples are not available in the traf use sidx subsegment_duration
                        let sidxDuration = 0;
                        const sidxs = findBox(data, ['sidx']);
                        for (let i = 0; i < sidxs.length; i++) {
                            const sidx = parseSegmentIndex(sidxs[i]);
                            if (sidx?.references) {
                                sidxDuration += sidx.references.reduce((dur, ref) => dur + ref.info.duration || 0, 0);
                            }
                        }
                        return sidxDuration;
                    }
                    if (videoDuration) {
                        return videoDuration;
                    }
                    return audioDuration;
                }

                /*
                  For Reference:
                  aligned(8) class TrackRunBox
                           extends FullBox(‘trun’, version, tr_flags) {
                     unsigned int(32)  sample_count;
                     // the following are optional fields
                     signed int(32) data_offset;
                     unsigned int(32)  first_sample_flags;
                     // all fields in the following array are optional
                     {
                        unsigned int(32)  sample_duration;
                        unsigned int(32)  sample_size;
                        unsigned int(32)  sample_flags
                        if (version == 0)
                           { unsigned int(32)
                        else
                           { signed int(32)
                     }[ sample_count ]
                  }
                 */
                function computeRawDurationFromSamples(trun) {
                    const flags = readUint32(trun, 0);
                    // Flags are at offset 0, non-optional sample_count is at offset 4. Therefore we start 8 bytes in.
                    // Each field is an int32, which is 4 bytes
                    let offset = 8;
                    // data-offset-present flag
                    if (flags & 0x000001) {
                        offset += 4;
                    }
                    // first-sample-flags-present flag
                    if (flags & 0x000004) {
                        offset += 4;
                    }
                    let duration = 0;
                    const sampleCount = readUint32(trun, 4);
                    for (let i = 0; i < sampleCount; i++) {
                        // sample-duration-present flag
                        if (flags & 0x000100) {
                            const sampleDuration = readUint32(trun, offset);
                            duration += sampleDuration;
                            offset += 4;
                        }
                        // sample-size-present flag
                        if (flags & 0x000200) {
                            offset += 4;
                        }
                        // sample-flags-present flag
                        if (flags & 0x000400) {
                            offset += 4;
                        }
                        // sample-composition-time-offsets-present flag
                        if (flags & 0x000800) {
                            offset += 4;
                        }
                    }
                    return duration;
                }
                function offsetStartDTS(initData, fmp4, timeOffset) {
                    findBox(fmp4, ['moof', 'traf']).forEach(traf => {
                        findBox(traf, ['tfhd']).forEach(tfhd => {
                            // get the track id from the tfhd
                            const id = readUint32(tfhd, 4);
                            const track = initData[id];
                            if (!track) {
                                return;
                            }
                            // assume a 90kHz clock if no timescale was specified
                            const timescale = track.timescale || 90e3;
                            // get the base media decode time from the tfdt
                            findBox(traf, ['tfdt']).forEach(tfdt => {
                                const version = tfdt[0];
                                let baseMediaDecodeTime = readUint32(tfdt, 4);
                                if (version === 0) {
                                    baseMediaDecodeTime -= timeOffset * timescale;
                                    baseMediaDecodeTime = Math.max(baseMediaDecodeTime, 0);
                                    writeUint32(tfdt, 4, baseMediaDecodeTime);
                                } else {
                                    baseMediaDecodeTime *= Math.pow(2, 32);
                                    baseMediaDecodeTime += readUint32(tfdt, 8);
                                    baseMediaDecodeTime -= timeOffset * timescale;
                                    baseMediaDecodeTime = Math.max(baseMediaDecodeTime, 0);
                                    const upper = Math.floor(baseMediaDecodeTime / (UINT32_MAX + 1));
                                    const lower = Math.floor(baseMediaDecodeTime % (UINT32_MAX + 1));
                                    writeUint32(tfdt, 4, upper);
                                    writeUint32(tfdt, 8, lower);
                                }
                            });
                        });
                    });
                }

                // TODO: Check if the last moof+mdat pair is part of the valid range
                function segmentValidRange(data) {
                    const segmentedRange = {
                        valid: null,
                        remainder: null
                    };
                    const moofs = findBox(data, ['moof']);
                    if (!moofs) {
                        return segmentedRange;
                    } else if (moofs.length < 2) {
                        segmentedRange.remainder = data;
                        return segmentedRange;
                    }
                    const last = moofs[moofs.length - 1];
                    // Offset by 8 bytes; findBox offsets the start by as much
                    segmentedRange.valid = (0, _typed_array__WEBPACK_IMPORTED_MODULE_1__.sliceUint8)(data, 0, last.byteOffset - 8);
                    segmentedRange.remainder = (0, _typed_array__WEBPACK_IMPORTED_MODULE_1__.sliceUint8)(data, last.byteOffset - 8);
                    return segmentedRange;
                }
                function appendUint8Array(data1, data2) {
                    const temp = new Uint8Array(data1.length + data2.length);
                    temp.set(data1);
                    temp.set(data2, data1.length);
                    return temp;
                }
                function parseSamples(timeOffset, track) {
                    const seiSamples = [];
                    const videoData = track.samples;
                    const timescale = track.timescale;
                    const trackId = track.id;
                    let isHEVCFlavor = false;
                    const moofs = findBox(videoData, ['moof']);
                    moofs.map(moof => {
                        const moofOffset = moof.byteOffset - 8;
                        const trafs = findBox(moof, ['traf']);
                        trafs.map(traf => {
                            // get the base media decode time from the tfdt
                            const baseTime = findBox(traf, ['tfdt']).map(tfdt => {
                                const version = tfdt[0];
                                let result = readUint32(tfdt, 4);
                                if (version === 1) {
                                    result *= Math.pow(2, 32);
                                    result += readUint32(tfdt, 8);
                                }
                                return result / timescale;
                            })[0];
                            if (baseTime !== undefined) {
                                timeOffset = baseTime;
                            }
                            return findBox(traf, ['tfhd']).map(tfhd => {
                                const id = readUint32(tfhd, 4);
                                const tfhdFlags = readUint32(tfhd, 0) & 0xffffff;
                                const baseDataOffsetPresent = (tfhdFlags & 0x000001) !== 0;
                                const sampleDescriptionIndexPresent = (tfhdFlags & 0x000002) !== 0;
                                const defaultSampleDurationPresent = (tfhdFlags & 0x000008) !== 0;
                                let defaultSampleDuration = 0;
                                const defaultSampleSizePresent = (tfhdFlags & 0x000010) !== 0;
                                let defaultSampleSize = 0;
                                const defaultSampleFlagsPresent = (tfhdFlags & 0x000020) !== 0;
                                let tfhdOffset = 8;
                                if (id === trackId) {
                                    if (baseDataOffsetPresent) {
                                        tfhdOffset += 8;
                                    }
                                    if (sampleDescriptionIndexPresent) {
                                        tfhdOffset += 4;
                                    }
                                    if (defaultSampleDurationPresent) {
                                        defaultSampleDuration = readUint32(tfhd, tfhdOffset);
                                        tfhdOffset += 4;
                                    }
                                    if (defaultSampleSizePresent) {
                                        defaultSampleSize = readUint32(tfhd, tfhdOffset);
                                        tfhdOffset += 4;
                                    }
                                    if (defaultSampleFlagsPresent) {
                                        tfhdOffset += 4;
                                    }
                                    if (track.type === 'video') {
                                        isHEVCFlavor = isHEVC(track.codec);
                                    }
                                    findBox(traf, ['trun']).map(trun => {
                                        const version = trun[0];
                                        const flags = readUint32(trun, 0) & 0xffffff;
                                        const dataOffsetPresent = (flags & 0x000001) !== 0;
                                        let dataOffset = 0;
                                        const firstSampleFlagsPresent = (flags & 0x000004) !== 0;
                                        const sampleDurationPresent = (flags & 0x000100) !== 0;
                                        let sampleDuration = 0;
                                        const sampleSizePresent = (flags & 0x000200) !== 0;
                                        let sampleSize = 0;
                                        const sampleFlagsPresent = (flags & 0x000400) !== 0;
                                        const sampleCompositionOffsetsPresent = (flags & 0x000800) !== 0;
                                        let compositionOffset = 0;
                                        const sampleCount = readUint32(trun, 4);
                                        let trunOffset = 8; // past version, flags, and sample count

                                        if (dataOffsetPresent) {
                                            dataOffset = readUint32(trun, trunOffset);
                                            trunOffset += 4;
                                        }
                                        if (firstSampleFlagsPresent) {
                                            trunOffset += 4;
                                        }
                                        let sampleOffset = dataOffset + moofOffset;
                                        for (let ix = 0; ix < sampleCount; ix++) {
                                            if (sampleDurationPresent) {
                                                sampleDuration = readUint32(trun, trunOffset);
                                                trunOffset += 4;
                                            } else {
                                                sampleDuration = defaultSampleDuration;
                                            }
                                            if (sampleSizePresent) {
                                                sampleSize = readUint32(trun, trunOffset);
                                                trunOffset += 4;
                                            } else {
                                                sampleSize = defaultSampleSize;
                                            }
                                            if (sampleFlagsPresent) {
                                                trunOffset += 4;
                                            }
                                            if (sampleCompositionOffsetsPresent) {
                                                if (version === 0) {
                                                    compositionOffset = readUint32(trun, trunOffset);
                                                } else {
                                                    compositionOffset = readSint32(trun, trunOffset);
                                                }
                                                trunOffset += 4;
                                            }
                                            if (track.type === _loader_fragment__WEBPACK_IMPORTED_MODULE_0__.ElementaryStreamTypes.VIDEO) {
                                                let naluTotalSize = 0;
                                                while (naluTotalSize < sampleSize) {
                                                    const naluSize = readUint32(videoData, sampleOffset);
                                                    sampleOffset += 4;
                                                    if (isSEIMessage(isHEVCFlavor, videoData[sampleOffset])) {
                                                        const data = videoData.subarray(sampleOffset, sampleOffset + naluSize);
                                                        parseSEIMessageFromNALu(data, isHEVCFlavor ? 2 : 1, timeOffset + compositionOffset / timescale, seiSamples);
                                                    }
                                                    sampleOffset += naluSize;
                                                    naluTotalSize += naluSize + 4;
                                                }
                                            }
                                            timeOffset += sampleDuration / timescale;
                                        }
                                    });
                                }
                            });
                        });
                    });
                    return seiSamples;
                }
                function isHEVC(codec) {
                    if (!codec) {
                        return false;
                    }
                    const delimit = codec.indexOf('.');
                    const baseCodec = delimit < 0 ? codec : codec.substring(0, delimit);
                    return baseCodec === 'hvc1' || baseCodec === 'hev1' ||
                        // Dolby Vision
                        baseCodec === 'dvh1' || baseCodec === 'dvhe';
                }
                function isSEIMessage(isHEVCFlavor, naluHeader) {
                    if (isHEVCFlavor) {
                        const naluType = naluHeader >> 1 & 0x3f;
                        return naluType === 39 || naluType === 40;
                    } else {
                        const naluType = naluHeader & 0x1f;
                        return naluType === 6;
                    }
                }
                function parseSEIMessageFromNALu(unescapedData, headerSize, pts, samples) {
                    const data = discardEPB(unescapedData);
                    let seiPtr = 0;
                    // skip nal header
                    seiPtr += headerSize;
                    let payloadType = 0;
                    let payloadSize = 0;
                    let endOfCaptions = false;
                    let b = 0;
                    while (seiPtr < data.length) {
                        payloadType = 0;
                        do {
                            if (seiPtr >= data.length) {
                                break;
                            }
                            b = data[seiPtr++];
                            payloadType += b;
                        } while (b === 0xff);

                        // Parse payload size.
                        payloadSize = 0;
                        do {
                            if (seiPtr >= data.length) {
                                break;
                            }
                            b = data[seiPtr++];
                            payloadSize += b;
                        } while (b === 0xff);
                        const leftOver = data.length - seiPtr;
                        if (!endOfCaptions && payloadType === 4 && seiPtr < data.length) {
                            endOfCaptions = true;
                            const countryCode = data[seiPtr++];
                            if (countryCode === 181) {
                                const providerCode = readUint16(data, seiPtr);
                                seiPtr += 2;
                                if (providerCode === 49) {
                                    const userStructure = readUint32(data, seiPtr);
                                    seiPtr += 4;
                                    if (userStructure === 0x47413934) {
                                        const userDataType = data[seiPtr++];

                                        // Raw CEA-608 bytes wrapped in CEA-708 packet
                                        if (userDataType === 3) {
                                            const firstByte = data[seiPtr++];
                                            const totalCCs = 0x1f & firstByte;
                                            const enabled = 0x40 & firstByte;
                                            const totalBytes = enabled ? 2 + totalCCs * 3 : 0;
                                            const byteArray = new Uint8Array(totalBytes);
                                            if (enabled) {
                                                byteArray[0] = firstByte;
                                                for (let i = 1; i < totalBytes; i++) {
                                                    byteArray[i] = data[seiPtr++];
                                                }
                                            }
                                            samples.push({
                                                type: userDataType,
                                                payloadType,
                                                pts,
                                                bytes: byteArray
                                            });
                                        }
                                    }
                                }
                            }
                        } else if (payloadType === 5 && payloadSize < leftOver) {
                            endOfCaptions = true;
                            if (payloadSize > 16) {
                                const uuidStrArray = [];
                                for (let i = 0; i < 16; i++) {
                                    const b = data[seiPtr++].toString(16);
                                    uuidStrArray.push(b.length == 1 ? '0' + b : b);
                                    if (i === 3 || i === 5 || i === 7 || i === 9) {
                                        uuidStrArray.push('-');
                                    }
                                }
                                const length = payloadSize - 16;
                                const userDataBytes = new Uint8Array(length);
                                for (let i = 0; i < length; i++) {
                                    userDataBytes[i] = data[seiPtr++];
                                }
                                samples.push({
                                    payloadType,
                                    pts,
                                    uuid: uuidStrArray.join(''),
                                    userData: (0, _demux_id3__WEBPACK_IMPORTED_MODULE_2__.utf8ArrayToStr)(userDataBytes),
                                    userDataBytes
                                });
                            }
                        } else if (payloadSize < leftOver) {
                            seiPtr += payloadSize;
                        } else if (payloadSize > leftOver) {
                            break;
                        }
                    }
                }

                /**
                 * remove Emulation Prevention bytes from a RBSP
                 */
                function discardEPB(data) {
                    const length = data.byteLength;
                    const EPBPositions = [];
                    let i = 1;

                    // Find all `Emulation Prevention Bytes`
                    while (i < length - 2) {
                        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0x03) {
                            EPBPositions.push(i + 2);
                            i += 2;
                        } else {
                            i++;
                        }
                    }

                    // If no Emulation Prevention Bytes were found just return the original
                    // array
                    if (EPBPositions.length === 0) {
                        return data;
                    }

                    // Create a new array to hold the NAL unit data
                    const newLength = length - EPBPositions.length;
                    const newData = new Uint8Array(newLength);
                    let sourceIndex = 0;
                    for (i = 0; i < newLength; sourceIndex++, i++) {
                        if (sourceIndex === EPBPositions[0]) {
                            // Skip this byte
                            sourceIndex++;
                            // Remove this position index
                            EPBPositions.shift();
                        }
                        newData[i] = data[sourceIndex];
                    }
                    return newData;
                }
                function parseEmsg(data) {
                    const version = data[0];
                    let schemeIdUri = '';
                    let value = '';
                    let timeScale = 0;
                    let presentationTimeDelta = 0;
                    let presentationTime = 0;
                    let eventDuration = 0;
                    let id = 0;
                    let offset = 0;
                    if (version === 0) {
                        while (bin2str(data.subarray(offset, offset + 1)) !== '\0') {
                            schemeIdUri += bin2str(data.subarray(offset, offset + 1));
                            offset += 1;
                        }
                        schemeIdUri += bin2str(data.subarray(offset, offset + 1));
                        offset += 1;
                        while (bin2str(data.subarray(offset, offset + 1)) !== '\0') {
                            value += bin2str(data.subarray(offset, offset + 1));
                            offset += 1;
                        }
                        value += bin2str(data.subarray(offset, offset + 1));
                        offset += 1;
                        timeScale = readUint32(data, 12);
                        presentationTimeDelta = readUint32(data, 16);
                        eventDuration = readUint32(data, 20);
                        id = readUint32(data, 24);
                        offset = 28;
                    } else if (version === 1) {
                        offset += 4;
                        timeScale = readUint32(data, offset);
                        offset += 4;
                        const leftPresentationTime = readUint32(data, offset);
                        offset += 4;
                        const rightPresentationTime = readUint32(data, offset);
                        offset += 4;
                        presentationTime = 2 ** 32 * leftPresentationTime + rightPresentationTime;
                        if (!Number.isSafeInteger(presentationTime)) {
                            presentationTime = Number.MAX_SAFE_INTEGER;
                            // eslint-disable-next-line no-console
                            console.warn('Presentation time exceeds safe integer limit and wrapped to max safe integer in parsing emsg box');
                        }
                        eventDuration = readUint32(data, offset);
                        offset += 4;
                        id = readUint32(data, offset);
                        offset += 4;
                        while (bin2str(data.subarray(offset, offset + 1)) !== '\0') {
                            schemeIdUri += bin2str(data.subarray(offset, offset + 1));
                            offset += 1;
                        }
                        schemeIdUri += bin2str(data.subarray(offset, offset + 1));
                        offset += 1;
                        while (bin2str(data.subarray(offset, offset + 1)) !== '\0') {
                            value += bin2str(data.subarray(offset, offset + 1));
                            offset += 1;
                        }
                        value += bin2str(data.subarray(offset, offset + 1));
                        offset += 1;
                    }
                    const payload = data.subarray(offset, data.byteLength);
                    return {
                        schemeIdUri,
                        value,
                        timeScale,
                        presentationTime,
                        presentationTimeDelta,
                        eventDuration,
                        id,
                        payload
                    };
                }
                function mp4Box(type, ...payload) {
                    const len = payload.length;
                    let size = 8;
                    let i = len;
                    while (i--) {
                        size += payload[i].byteLength;
                    }
                    const result = new Uint8Array(size);
                    result[0] = size >> 24 & 0xff;
                    result[1] = size >> 16 & 0xff;
                    result[2] = size >> 8 & 0xff;
                    result[3] = size & 0xff;
                    result.set(type, 4);
                    for (i = 0, size = 8; i < len; i++) {
                        result.set(payload[i], size);
                        size += payload[i].byteLength;
                    }
                    return result;
                }
                function mp4pssh(systemId, keyids, data) {
                    if (systemId.byteLength !== 16) {
                        throw new RangeError('Invalid system id');
                    }
                    let version;
                    let kids;
                    if (keyids) {
                        version = 1;
                        kids = new Uint8Array(keyids.length * 16);
                        for (let ix = 0; ix < keyids.length; ix++) {
                            const k = keyids[ix]; // uint8array
                            if (k.byteLength !== 16) {
                                throw new RangeError('Invalid key');
                            }
                            kids.set(k, ix * 16);
                        }
                    } else {
                        version = 0;
                        kids = new Uint8Array();
                    }
                    let kidCount;
                    if (version > 0) {
                        kidCount = new Uint8Array(4);
                        if (keyids.length > 0) {
                            new DataView(kidCount.buffer).setUint32(0, keyids.length, false);
                        }
                    } else {
                        kidCount = new Uint8Array();
                    }
                    const dataSize = new Uint8Array(4);
                    if (data && data.byteLength > 0) {
                        new DataView(dataSize.buffer).setUint32(0, data.byteLength, false);
                    }
                    return mp4Box([112, 115, 115, 104], new Uint8Array([version, 0x00, 0x00, 0x00 // Flags
                    ]), systemId,
                        // 16 bytes
                        kidCount, kids, dataSize, data || new Uint8Array());
                }
                function parsePssh(initData) {
                    if (!(initData instanceof ArrayBuffer) || initData.byteLength < 32) {
                        return null;
                    }
                    const result = {
                        version: 0,
                        systemId: '',
                        kids: null,
                        data: null
                    };
                    const view = new DataView(initData);
                    const boxSize = view.getUint32(0);
                    if (initData.byteLength !== boxSize && boxSize > 44) {
                        return null;
                    }
                    const type = view.getUint32(4);
                    if (type !== 0x70737368) {
                        return null;
                    }
                    result.version = view.getUint32(8) >>> 24;
                    if (result.version > 1) {
                        return null;
                    }
                    result.systemId = _hex__WEBPACK_IMPORTED_MODULE_4__["default"].hexDump(new Uint8Array(initData, 12, 16));
                    const dataSizeOrKidCount = view.getUint32(28);
                    if (result.version === 0) {
                        if (boxSize - 32 < dataSizeOrKidCount) {
                            return null;
                        }
                        result.data = new Uint8Array(initData, 32, dataSizeOrKidCount);
                    } else if (result.version === 1) {
                        result.kids = [];
                        for (let i = 0; i < dataSizeOrKidCount; i++) {
                            result.kids.push(new Uint8Array(initData, 32 + i * 16, 16));
                        }
                    }
                    return result;
                }

                /***/
            }),

/***/ "./src/utils/timescale-conversion.ts":
/*!*******************************************!*\
  !*** ./src/utils/timescale-conversion.ts ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "toMpegTsClockFromTimescale": () => (/* binding */ toMpegTsClockFromTimescale),
/* harmony export */   "toMsFromMpegTsClock": () => (/* binding */ toMsFromMpegTsClock),
/* harmony export */   "toTimescaleFromBase": () => (/* binding */ toTimescaleFromBase),
/* harmony export */   "toTimescaleFromScale": () => (/* binding */ toTimescaleFromScale)
                    /* harmony export */
                });
                const MPEG_TS_CLOCK_FREQ_HZ = 90000;
                function toTimescaleFromBase(value, destScale, srcBase = 1, round = false) {
                    const result = value * destScale * srcBase; // equivalent to `(value * scale) / (1 / base)`
                    return round ? Math.round(result) : result;
                }
                function toTimescaleFromScale(value, destScale, srcScale = 1, round = false) {
                    return toTimescaleFromBase(value, destScale, 1 / srcScale, round);
                }
                function toMsFromMpegTsClock(value, round = false) {
                    return toTimescaleFromBase(value, 1000, 1 / MPEG_TS_CLOCK_FREQ_HZ, round);
                }
                function toMpegTsClockFromTimescale(value, srcScale = 1) {
                    return toTimescaleFromBase(value, MPEG_TS_CLOCK_FREQ_HZ, 1 / srcScale);
                }

                /***/
            }),

/***/ "./src/utils/typed-array.ts":
/*!**********************************!*\
  !*** ./src/utils/typed-array.ts ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

                "use strict";
                __webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "sliceUint8": () => (/* binding */ sliceUint8)
                    /* harmony export */
                });
                function sliceUint8(array, start, end) {
                    // @ts-expect-error This polyfills IE11 usage of Uint8Array slice.
                    // It always exists in the TypeScript definition so fails, but it fails at runtime on IE11.
                    return Uint8Array.prototype.slice ? array.slice(start, end) : new Uint8Array(Array.prototype.slice.call(array, start, end));
                }

                /***/
            }),

/***/ "./node_modules/url-toolkit/src/url-toolkit.js":
/*!*****************************************************!*\
  !*** ./node_modules/url-toolkit/src/url-toolkit.js ***!
  \*****************************************************/
/***/ (function (module) {

                // see https://tools.ietf.org/html/rfc1808

                (function (root) {
                    var URL_REGEX =
                        /^(?=((?:[a-zA-Z0-9+\-.]+:)?))\1(?=((?:\/\/[^\/?#]*)?))\2(?=((?:(?:[^?#\/]*\/)*[^;?#\/]*)?))\3((?:;[^?#]*)?)(\?[^#]*)?(#[^]*)?$/;
                    var FIRST_SEGMENT_REGEX = /^(?=([^\/?#]*))\1([^]*)$/;
                    var SLASH_DOT_REGEX = /(?:\/|^)\.(?=\/)/g;
                    var SLASH_DOT_DOT_REGEX = /(?:\/|^)\.\.\/(?!\.\.\/)[^\/]*(?=\/)/g;

                    var URLToolkit = {
                        // If opts.alwaysNormalize is true then the path will always be normalized even when it starts with / or //
                        // E.g
                        // With opts.alwaysNormalize = false (default, spec compliant)
                        // http://a.com/b/cd + /e/f/../g => http://a.com/e/f/../g
                        // With opts.alwaysNormalize = true (not spec compliant)
                        // http://a.com/b/cd + /e/f/../g => http://a.com/e/g
                        buildAbsoluteURL: function (baseURL, relativeURL, opts) {
                            opts = opts || {};
                            // remove any remaining space and CRLF
                            baseURL = baseURL.trim();
                            relativeURL = relativeURL.trim();
                            if (!relativeURL) {
                                // 2a) If the embedded URL is entirely empty, it inherits the
                                // entire base URL (i.e., is set equal to the base URL)
                                // and we are done.
                                if (!opts.alwaysNormalize) {
                                    return baseURL;
                                }
                                var basePartsForNormalise = URLToolkit.parseURL(baseURL);
                                if (!basePartsForNormalise) {
                                    throw new Error('Error trying to parse base URL.');
                                }
                                basePartsForNormalise.path = URLToolkit.normalizePath(
                                    basePartsForNormalise.path
                                );
                                return URLToolkit.buildURLFromParts(basePartsForNormalise);
                            }
                            var relativeParts = URLToolkit.parseURL(relativeURL);
                            if (!relativeParts) {
                                throw new Error('Error trying to parse relative URL.');
                            }
                            if (relativeParts.scheme) {
                                // 2b) If the embedded URL starts with a scheme name, it is
                                // interpreted as an absolute URL and we are done.
                                if (!opts.alwaysNormalize) {
                                    return relativeURL;
                                }
                                relativeParts.path = URLToolkit.normalizePath(relativeParts.path);
                                return URLToolkit.buildURLFromParts(relativeParts);
                            }
                            var baseParts = URLToolkit.parseURL(baseURL);
                            if (!baseParts) {
                                throw new Error('Error trying to parse base URL.');
                            }
                            if (!baseParts.netLoc && baseParts.path && baseParts.path[0] !== '/') {
                                // If netLoc missing and path doesn't start with '/', assume everthing before the first '/' is the netLoc
                                // This causes 'example.com/a' to be handled as '//example.com/a' instead of '/example.com/a'
                                var pathParts = FIRST_SEGMENT_REGEX.exec(baseParts.path);
                                baseParts.netLoc = pathParts[1];
                                baseParts.path = pathParts[2];
                            }
                            if (baseParts.netLoc && !baseParts.path) {
                                baseParts.path = '/';
                            }
                            var builtParts = {
                                // 2c) Otherwise, the embedded URL inherits the scheme of
                                // the base URL.
                                scheme: baseParts.scheme,
                                netLoc: relativeParts.netLoc,
                                path: null,
                                params: relativeParts.params,
                                query: relativeParts.query,
                                fragment: relativeParts.fragment,
                            };
                            if (!relativeParts.netLoc) {
                                // 3) If the embedded URL's <net_loc> is non-empty, we skip to
                                // Step 7.  Otherwise, the embedded URL inherits the <net_loc>
                                // (if any) of the base URL.
                                builtParts.netLoc = baseParts.netLoc;
                                // 4) If the embedded URL path is preceded by a slash "/", the
                                // path is not relative and we skip to Step 7.
                                if (relativeParts.path[0] !== '/') {
                                    if (!relativeParts.path) {
                                        // 5) If the embedded URL path is empty (and not preceded by a
                                        // slash), then the embedded URL inherits the base URL path
                                        builtParts.path = baseParts.path;
                                        // 5a) if the embedded URL's <params> is non-empty, we skip to
                                        // step 7; otherwise, it inherits the <params> of the base
                                        // URL (if any) and
                                        if (!relativeParts.params) {
                                            builtParts.params = baseParts.params;
                                            // 5b) if the embedded URL's <query> is non-empty, we skip to
                                            // step 7; otherwise, it inherits the <query> of the base
                                            // URL (if any) and we skip to step 7.
                                            if (!relativeParts.query) {
                                                builtParts.query = baseParts.query;
                                            }
                                        }
                                    } else {
                                        // 6) The last segment of the base URL's path (anything
                                        // following the rightmost slash "/", or the entire path if no
                                        // slash is present) is removed and the embedded URL's path is
                                        // appended in its place.
                                        var baseURLPath = baseParts.path;
                                        var newPath =
                                            baseURLPath.substring(0, baseURLPath.lastIndexOf('/') + 1) +
                                            relativeParts.path;
                                        builtParts.path = URLToolkit.normalizePath(newPath);
                                    }
                                }
                            }
                            if (builtParts.path === null) {
                                builtParts.path = opts.alwaysNormalize
                                    ? URLToolkit.normalizePath(relativeParts.path)
                                    : relativeParts.path;
                            }
                            return URLToolkit.buildURLFromParts(builtParts);
                        },
                        parseURL: function (url) {
                            var parts = URL_REGEX.exec(url);
                            if (!parts) {
                                return null;
                            }
                            return {
                                scheme: parts[1] || '',
                                netLoc: parts[2] || '',
                                path: parts[3] || '',
                                params: parts[4] || '',
                                query: parts[5] || '',
                                fragment: parts[6] || '',
                            };
                        },
                        normalizePath: function (path) {
                            // The following operations are
                            // then applied, in order, to the new path:
                            // 6a) All occurrences of "./", where "." is a complete path
                            // segment, are removed.
                            // 6b) If the path ends with "." as a complete path segment,
                            // that "." is removed.
                            path = path.split('').reverse().join('').replace(SLASH_DOT_REGEX, '');
                            // 6c) All occurrences of "<segment>/../", where <segment> is a
                            // complete path segment not equal to "..", are removed.
                            // Removal of these path segments is performed iteratively,
                            // removing the leftmost matching pattern on each iteration,
                            // until no matching pattern remains.
                            // 6d) If the path ends with "<segment>/..", where <segment> is a
                            // complete path segment not equal to "..", that
                            // "<segment>/.." is removed.
                            while (
                                path.length !== (path = path.replace(SLASH_DOT_DOT_REGEX, '')).length
                            ) { }
                            return path.split('').reverse().join('');
                        },
                        buildURLFromParts: function (parts) {
                            return (
                                parts.scheme +
                                parts.netLoc +
                                parts.path +
                                parts.params +
                                parts.query +
                                parts.fragment
                            );
                        },
                    };

                    if (true)
                        module.exports = URLToolkit;
                    else { }
                })(this);


                /***/
            })

        /******/
    });
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
            /******/
        }
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
            /******/
        };
/******/
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
        /******/
    }
/******/
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
            /******/
        };
        /******/
    })();
/******/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for (var key in definition) {
/******/ 				if (__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
                    /******/
                }
                /******/
            }
            /******/
        };
        /******/
    })();
/******/
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
        /******/
    })();
/******/
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
                /******/
            }
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
            /******/
        };
        /******/
    })();
    /******/
    /************************************************************************/
    /******/
    HlsMux = {
        TSDemuxer: __webpack_require__("./src/demux/tsdemuxer.ts").default,
        AACDemuxer: __webpack_require__("./src/demux/aacdemuxer.ts").default,
        MP3Demuxer: __webpack_require__("./src/demux/mp3demuxer.ts").default,
        MP4Demuxer: __webpack_require__("./src/demux/mp4demuxer.ts").default,
        MP4Remuxer: __webpack_require__("./src/remux/mp4-remuxer.ts").default,
        PassThroughRemuxer: __webpack_require__("./src/remux/passthrough-remuxer.ts").default,
        HLSEvents: __webpack_require__("./src/events.ts").default
    }
    /******/
    /******/
})()
    ;
//# sourceMappingURL=hls.js.map

window.HlsMux = HlsMux;

export const TSDemuxer = HlsMux.TSDemuxer;
export const AACDemuxer = HlsMux.AACDemuxer;
export const MP3Demuxer = HlsMux.MP3Demuxer;
export const MP4Demuxer = HlsMux.MP4Demuxer;
export const MP4Remuxer = HlsMux.MP4Remuxer;
export const PassThroughRemuxer = HlsMux.PassThroughRemuxer;
export const HLSEvents = HlsMux.HLSEvents;