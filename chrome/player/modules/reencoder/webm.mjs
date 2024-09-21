/* eslint-disable */
// https://www.matroska.org/technical/
/*
MIT License

Copyright (c) 2016 Flare Media Player

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

class Track {
  loadMeta(meta) {
    for (const key in meta) {
      this[key] = meta[key];
    }
  }
}

class MasteringData {
  constructor(masteringDataHeader, dataInterface) {
    this.dataInterface = dataInterface;
    this.offset = masteringDataHeader.offset;
    this.size = masteringDataHeader.size;
    this.end = masteringDataHeader.end;
  }
  load() {
    while (this.dataInterface.offset < this.end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) return null;
      }
      switch (this.currentElement.id) {
        case 0x55D1: { // PrimaryRChromaticityX, f
          const primaryRChromaticityX = this.dataInterface.readFloat(this.currentElement.size);
          if (primaryRChromaticityX !== null) {
            this.primaryRChromaticityX = primaryRChromaticityX;
          } else {
            return null;
          }
          break;
        }
        case 0x55D2: { // PrimaryRChromaticityY, f
          const primaryRChromaticityY = this.dataInterface.readFloat(this.currentElement.size);
          if (primaryRChromaticityY !== null) {
            this.primaryRChromaticityY = primaryRChromaticityY;
          } else {
            return null;
          }
          break;
        }
        case 0x55D3: { // PrimaryGChromaticityX, f
          const primaryGChromaticityX = this.dataInterface.readFloat(this.currentElement.size);
          if (primaryGChromaticityX !== null) {
            this.primaryGChromaticityX = primaryGChromaticityX;
          } else {
            return null;
          }
          break;
        }
        case 0x55D4: { // PrimaryGChromaticityY, f
          const primaryGChromaticityY = this.dataInterface.readFloat(this.currentElement.size);
          if (primaryGChromaticityY !== null) {
            this.primaryGChromaticityY = primaryGChromaticityY;
          } else {
            return null;
          }
          break;
        }
        case 0x55D5: { // PrimaryBChromaticityX, f
          const primaryBChromaticityX = this.dataInterface.readFloat(this.currentElement.size);
          if (primaryBChromaticityX !== null) {
            this.primaryBChromaticityX = primaryBChromaticityX;
          } else {
            return null;
          }
          break;
        }
        case 0x55D6: { // PrimaryBChromaticityY, f
          const primaryBChromaticityY = this.dataInterface.readFloat(this.currentElement.size);
          if (primaryBChromaticityY !== null) {
            this.primaryBChromaticityY = primaryBChromaticityY;
          } else {
            return null;
          }
          break;
        }
        case 0x55D7: { // WhitePointChromaticityX, f
          const whitePointChromaticityX = this.dataInterface.readFloat(this.currentElement.size);
          if (whitePointChromaticityX !== null) {
            this.whitePointChromaticityX = whitePointChromaticityX;
          } else {
            return null;
          }
          break;
        }
        case 0x55D8: { // WhitePointChromaticityY, f
          const whitePointChromaticityY = this.dataInterface.readFloat(this.currentElement.size);
          if (whitePointChromaticityY !== null) {
            this.whitePointChromaticityY = whitePointChromaticityY;
          } else {
            return null;
          }
          break;
        }
        case 0x55D9: { // LuminanceMax, f
          const luminanceMax = this.dataInterface.readFloat(this.currentElement.size);
          if (luminanceMax !== null) {
            this.luminanceMax = luminanceMax;
          } else {
            return null;
          }
          break;
        }
        case 0x55DA: { // LuminanceMin, f
          const luminanceMin = this.dataInterface.readFloat(this.currentElement.size);
          if (luminanceMin !== null) {
            this.luminanceMin = luminanceMin;
          } else {
            return null;
          }
          break;
        }
        default:
          console.warn(`MasteringData element not found, skipping: ${this.currentElement.id.toString(16)}`);
          break;
      }
    }
  }
}
class Colour {
  constructor(colourHeader, dataInterface) {
    this.dataInterface = dataInterface;
    this.offset = colourHeader.offset;
    this.size = colourHeader.size;
    this.end = colourHeader.end;
  }
  load() {
    while (this.dataInterface.offset < this.end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) return null;
      }
      switch (this.currentElement.id) {
        case 0x55B1: { // MatrixCoefficients, u
          const matrixCoefficients = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (matrixCoefficients !== null) {
            const map = [
              'Identity', // Web ready as identity
              'ITU-R BT.709', // Web ready as bt709
              'unspecified',
              'reserved',
              'US FCC 73.682',
              'ITU-R BT.470BG', // Web ready as bt470bg
              'SMPTE 170M', // Web ready as smpte170m
              'SMPTE 240M',
              'YCoCg',
              'BT2020 Non-constant Luminance', // Web ready as bt2020-ncl
              'BT2020 Constant Luminance',
              'SMPTE ST 2085',
              'Chroma-derived Non-constant Luminance',
              'Chroma-derived Constant Luminance',
              'ITU-R BT.2100-0'
            ];

            const webReady = {
              'Identity': 'identity',
              'ITU-R BT.709': 'bt709',
              'ITU-R BT.470BG': 'bt470bg',
              'SMPTE 170M': 'smpte170m',
              'BT2020 Non-constant Luminance': 'bt2020-ncl',
            }

            this.matrixCoefficientsNumber = matrixCoefficients;

            this.matrixCoefficients = map[matrixCoefficients];
            if (!this.matrixCoefficients) {
              console.warn('Matrix Coefficients not found', matrixCoefficients);
            } else {
              this.webReadyMatrixCoefficients = webReady[this.matrixCoefficients];
              if (!this.webReadyMatrixCoefficients) {
                console.warn('Web ready Matrix Coefficients not found', this.matrixCoefficients);
              }
            }
          } else {
            return null;
          }
          break;
        }
        case 0x55B2: { // BitsPerChannel, u
          const bitsPerChannel = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (bitsPerChannel !== null) {
            this.bitsPerChannel = bitsPerChannel;
          } else {
            return null;
          }
          break;
        }
        case 0x55B3: { // ChromaSubsamplingHorz, u
          const chromaSubsamplingHorz = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (chromaSubsamplingHorz !== null) {
            this.chromaSubsamplingHorz = chromaSubsamplingHorz;
          } else {
            return null;
          }
          break;
        }
        case 0x55B4: { // ChromaSubsamplingVert, u
          const chromaSubsamplingVert = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (chromaSubsamplingVert !== null) {
            this.chromaSubsamplingVert = chromaSubsamplingVert;
          } else {
            return null;
          }
          break;
        }
        case 0x55B5: { // CbSubsamplingHorz, u
          const cbSubsamplingHorz = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (cbSubsamplingHorz !== null) {
            this.cbSubsamplingHorz = cbSubsamplingHorz;
          } else {
            return null;
          }
          break;
        }
        case 0x55B6: { // CbSubsamplingVert, u
          const cbSubsamplingVert = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (cbSubsamplingVert !== null) {
            this.cbSubsamplingVert = cbSubsamplingVert;
          } else {
            return null;
          }
          break;
        }
        case 0x55B7: { // ChromaSitingHorz, u
          const chromaSitingHorz = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (chromaSitingHorz !== null) {
            this.chromaSitingHorz = chromaSitingHorz;
          } else {
            return null;
          }
          break;
        }
        case 0x55B8: { // ChromaSitingVert, u
          const chromaSitingVert = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (chromaSitingVert !== null) {
            this.chromaSitingVert = chromaSitingVert;
          } else {
            return null;
          }
          break;
        }
        case 0x55B9: { // Range, u
          const range = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (range !== null) {
            const map = [
              'unspecified', // 0
              'broadcast', // 1
              'full',
              'defined'
            ];
            this.range = map[range];
          } else {
            return null;
          }
          break;
        }
        case 0x55BA: { // TransferCharacteristics, u
          const transferCharacteristics = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (transferCharacteristics !== null) {
            this.transferCharacteristics = transferCharacteristics;
          } else {
            return null;
          }
          break;
        }
        case 0x55BB: { // Primaries, u
          const primaries = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (primaries !== null) {
              this.primaries = primaries
          } else {
            return null;
          }
          break;
        }
        case 0x55BC: { // MaxCLL, u
          const maxCLL = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (maxCLL !== null) {
            this.maxCLL = maxCLL;
          } else {
            return null;
          }
          break;
        }
        case 0x55BD: { // MaxFALL, u
          const maxFALL = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (maxFALL !== null) {
            this.maxFALL = maxFALL;
          } else {
            return null;
          }
          break;
        }
        case 0x55D0: { // MasteringMetadata
          const masteringMetadata = new MasteringData(this.currentElement, this.dataInterface);
          masteringMetadata.load();
          this.masteringMetadata = masteringMetadata;
          break;
        }
        default:
          console.warn(`Info element not found, skipping: ${this.currentElement.id.toString(16)}`);
          break;
      }
      this.currentElement = null;
    }
  }
}
class VideoTrack extends Track {
  constructor(trackHeader, dataInterface) {
    super();
    this.dataInterface = dataInterface;
    this.offset = trackHeader.offset;
    this.size = trackHeader.size;
    this.end = trackHeader.end;
    this.loaded = false;
    this.width = null;
    this.height = null;
    this.displayWidth = null;
    this.displayHeight = null;
    this.displayUnit = 0;
    this.stereoMode = null;
    this.frameRate = null;
    this.pixelCropBottom = 0;
    this.pixelCropTop = 0;
    this.pixelCropLeft = 0;
    this.pixelCropRight = 0;
  }

  load() {
    while (this.dataInterface.offset < this.end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) return null;
      }
      switch (this.currentElement.id) {
        // TODO add colour
        case 0xB0: { // Pixel width
          const width = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (width !== null) {
            this.width = width;
          } else {
            return null;
          }
          break;
        }
        case 0xBA: { // Pixel Height
          const height = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (height !== null) {
            this.height = height;
          } else {
            return null;
          }
          break;
        }
        case 0x54B0: { // Display width
          const displayWidth = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (displayWidth !== null) {
            this.displayWidth = displayWidth;
          } else {
            return null;
          }
          break;
        }
        case 0x54BA: { // Display height
          const displayHeight = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (displayHeight !== null) {
            this.displayHeight = displayHeight;
          } else {
            return null;
          }
          break;
        }
        case 0x54B2: { // Display unit
          const displayUnit = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (displayUnit !== null) {
            this.displayUnit = displayUnit;
          } else {
            return null;
          }
          break;
        }
        case 0x53B8: { // Stereo mode
          const stereoMode = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (stereoMode !== null) {
            this.stereoMode = stereoMode;
          } else {
            return null;
          }
          break;
        }
        case 0x2383E3: { // FRAME RATE - NEEDS TO BE FLOAT
          const frameRate = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (frameRate !== null) {
            this.frameRate = frameRate;
          } else {
            return null;
          }
          break;
        }
        case 0x9A: { // FlagInterlaced
          const flagInterlaced = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (flagInterlaced !== null) {
            this.flagInterlaced = flagInterlaced;
          } else {
            return null;
          }
          break;
        }
        case 0x55B0: { // colour
          const colour = new Colour(this.currentElement, this.dataInterface);
          colour.load();
          this.colour = colour;
          break;
        }
        default:
          console.warn(`Info element not found, skipping: ${this.currentElement.id.toString(16)}`);
          break;
      }
      this.currentElement = null;
    }

    if (!this.displayWidth) {
      this.displayWidth = this.width - this.pixelCropLeft;// - Math.PI;
    }

    if (!this.displayHeight) {
      this.displayHeight = this.height - this.pixelCropTop;// - Math.PI;
    }
    this.loaded = true;
  }
}

class AudioTrack extends Track {
  constructor(trackHeader, dataInterface) {
    super();
    this.dataInterface = dataInterface;
    this.offset = trackHeader.offset;
    this.size = trackHeader.size;
    this.end = trackHeader.end;
    this.loaded = false;
    this.rate = null;
    this.channel = null;
    this.bitDepth = null;
  }

  load() {
    while (this.dataInterface.offset < this.end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) return null;
      }

      switch (this.currentElement.id) {
        // TODO add duration and title
        case 0xB5: // Sample Frequency //TODO: MAKE FLOAT
          var rate = this.dataInterface.readFloat(this.currentElement.size);
          if (rate !== null) this.rate = rate;
          else {
            return null;
          }
          break;
        case 0x9F: // Channels
          var channels = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (channels !== null) this.channels = channels;
          else {
            return null;
          }
          break;
        case 0x6264: // bitDepth
          var bitDepth = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (bitDepth !== null) {
            this.bitDepth = bitDepth;
          } else {
            return null;
          }
          break;
        default:
          console.warn('Ifno element not found, skipping');
          break;
      }
      this.currentElement = null;
    }
    this.loaded = true;
  }
}

class BlockGroup {
  constructor(blockGroupHeader, dataInterface) {
    this.dataInterface = dataInterface;
    this.offset = blockGroupHeader.offset;
    this.size = blockGroupHeader.size;
    this.end = blockGroupHeader.end;
    this.loaded = false;
    this.tempElement = null;
    this.currentElement = null;
  }

  load() {
    const end = this.end;
    while (this.dataInterface.offset < end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) {
          return null;
        }
      }
      switch (this.currentElement.id) {
        case 0xA1: // Block
          var block = this.dataInterface.getBinary(this.currentElement.size);
          if (block !== null) {
            block;
          }
          // this.docTypeReadVersion = docTypeReadVersion;
          else {
            return null;
          }
          break;
        case 0x9b: // BlockDuration
          var blockDuration = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (blockDuration !== null) {
            this.blockDuration = blockDuration;
          } else {
            return null;
          }
          break;
        case 0xFB: // ReferenceBlock
          var referenceBlock = this.dataInterface.readSignedInt(this.currentElement.size);
          if (referenceBlock !== null) {
            this.referenceBlock = referenceBlock;
          } else {
            return null;
          }
          break;
        case 0x75A2: // DiscardPadding
          var discardPadding = this.dataInterface.readSignedInt(this.currentElement.size);
          if (discardPadding !== null) {
            this.discardPadding = discardPadding;
          } else {
            return null;
          }
          break;
        default:
          console.warn('block group element not found, skipping ' + this.currentElement.id.toString(16));
          break;
      }
      this.currentElement = null;
    }
    this.loaded = true;
  }
}

class Cluster {
  constructor(offset, size, end, dataOffset, dataInterface, demuxer) {
    this.demuxer = demuxer; // reference to parent demuxer for passing data
    this.dataInterface = dataInterface;
    this.offset = offset;
    this.size = size;
    // if (end !== -1){
    this.end = end;
    // }
    // else{
    //  this.end = Number.MAX_VALUE;
    // }
    this.dataOffset = dataOffset;
    this.loaded = false;
    this.tempEntry = null;
    this.currentElement = null;
    this.timeStamp = null;
    this.tempBlock = null;
    this.position = null;
    this.tempElementHeader = new ElementHeader(-1, -1, -1, -1);
    this.tempElementHeader.reset();
    this.tempBlock = new SimpleBlock();
    this.blockGroups = [];
    // this.demuxer.loadedMetadata = true; // Testing only
    return true;
  }

  init() {

  }

  reset() {

  }

  load() {
    const status = false;
    while (this.dataInterface.offset < this.end) {
      if (!this.tempElementHeader.status) {
        this.dataInterface.peekAndSetElement(this.tempElementHeader);
        if (!this.tempElementHeader.status) {
          return null;
        }
      }
      switch (this.tempElementHeader.id) {
        case 0xE7: // TimeCode
          var timeStamp = this.dataInterface.readUnsignedInt(this.tempElementHeader.size);
          if (timeStamp !== null) {
            this.timeStamp = timeStamp;
          } else {
            return null;
          }
          break;
        case 0xA3: // Simple Block
          if (!this.tempBlock.status) {
            this.tempBlock.init(
              this.tempElementHeader.offset,
              this.tempElementHeader.size,
              this.tempElementHeader.end,
              this.tempElementHeader.dataOffset,
              this.dataInterface,
              this,
            );
          }
          this.tempBlock.load();
          if (!this.tempBlock.loaded) {
            return 0;
          }
          // else
          // this.blocks.push(this.tempBlock); //Later save positions for seeking and debugging
          this.tempBlock.reset();
          this.tempEntry = null;
          this.tempElementHeader.reset();
          if (this.dataInterface.offset !== this.end) {
            if (!this.dataInterface.currentBuffer) {
              return false;
            }
            return true;
          }
          break;
        case 0xA7: // Position
          var timeStamp = this.dataInterface.readUnsignedInt(this.tempElementHeader.size);
          if (timeStamp !== null) {
            this.timeStamp = timeStamp;
          } else {
            return null;
          }
          break;
        case 0xA0: // Block Group
          if (!this.currentBlockGroup) {
            this.currentBlockGroup = new BlockGroup(this.tempElementHeader.getData(), this.dataInterface);
          }
          this.currentBlockGroup.load();
          if (!this.currentBlockGroup.loaded) {
            return false;
          }
          this.blockGroups.push(this.currentTag);
          this.currentBlockGroup = null;
          break;
        case 0xAB: // PrevSize
          var prevSize = this.dataInterface.readUnsignedInt(this.tempElementHeader.size);
          if (prevSize !== null) {
            this.prevSize = prevSize;
          } else {
            return null;
          }
          break;
        case 0xBF: // CRC-32
          var crc = this.dataInterface.getBinary(this.tempElementHeader.size);
          if (crc !== null) {
            crc;
          } else {
            return null;
          }
          break;
        // TODO, ADD VOID
        default:
          console.warn('cluster data element not found, skipping : ' + this.tempElementHeader.id.toString(16));
          // This means we probably are out of the cluster now, double check bounds when end not available
          break;
      }
      this.tempEntry = null;
      this.tempElementHeader.reset();
      // return 1;
    }
    this.loaded = true;
    return status;
  }
}

class CueTrackPositions {
  constructor(cuesPointHeader, dataInterface) {
    this.dataInterface = dataInterface;
    this.offset = cuesPointHeader.offset;
    this.size = cuesPointHeader.size;
    this.end = cuesPointHeader.end;
    this.loaded = false;
    this.tempElement = null;
    this.currentElement = null;
    this.cueTrack = null;
    this.cueClusterPosition = 0;
    this.cueRelativePosition = 0;
  }

  load() {
    while (this.dataInterface.offset < this.end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) {
          return null;
        }
      }
      switch (this.currentElement.id) {
        case 0xF7: // CueTrack
          var cueTrack = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (cueTrack !== null) {
            this.cueTrack = cueTrack;
          } else {
            return null;
          }
          break;
        case 0xF1: // Cue ClusterPosition
          var cueClusterPosition = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (cueClusterPosition !== null) {
            this.cueClusterPosition = cueClusterPosition;
          } else {
            return null;
          }
          break;
        case 0xF0: // CueRelativePosition
          var cueRelativePosition = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (cueRelativePosition !== null) {
            this.cueRelativePosition = cueRelativePosition;
          } else {
            return null;
          }
          break;
        default:
          console.warn('Cue track positions not found! ' + this.currentElement.id);
          break;
      }
      this.currentElement = null;
    }
    if (this.dataInterface.offset !== this.end) {
      throw new Error('Invalid Seek Formatting');
    }
    this.loaded = true;
  }
}

class Cues {
  constructor(cuesHeader, dataInterface, demuxer) {
    this.dataInterface = dataInterface;
    this.offset = cuesHeader.offset;
    this.size = cuesHeader.size;
    this.end = cuesHeader.end;
    this.entries = [];
    this.loaded = false;
    this.tempEntry = null;
    this.demuxer = demuxer;
    this.currentElement = null;
  }

  load() {
    const end = this.end;
    while (this.dataInterface.offset < end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) {
          return null;
        }
      }
      switch (this.currentElement.id) {
        case 0xBB: // CuePoint
          if (!this.tempEntry) {
            this.tempEntry = new CuePoint(this.currentElement, this.dataInterface);
          }
          this.tempEntry.load();
          if (!this.tempEntry.loaded) {
            return;
          } else {
            this.entries.push(this.tempEntry);
          }
          break;
        case 0xbf: // CRC-32
          var crc = this.dataInterface.getBinary(this.currentElement.size);
          if (crc !== null) {
            crc;
          }
          // this.docTypeReadVersion = docTypeReadVersion;
          else {
            return null;
          }
          break;
        // TODO, ADD VOID
        default:
          console.warn('Cue Head element not found ' + this.currentElement.id.toString(16)); // probably bad
          break;
      }

      this.tempEntry = null;
      this.currentElement = null;
      // this.cueTrackPositions = this.tempEntry;
      // this.tempEntry = null;
    }

    if (this.dataInterface.offset !== this.end) {
      throw new Error('INVALID CUE FORMATTING');
    }
    this.loaded = true;
  }

  getCount() {
    return this.cuePoints.length;
  }

  init() {

  }

  preloadCuePoint() {

  }

  find() {

  }

  getFirst() {

  }

  getLast() {

  }

  getNext() {

  }

  getBlock() {

  }

  findOrPreloadCluster() {

  }
}

class CuePoint {
  constructor(cuesPointHeader, dataInterface) {
    this.dataInterface = dataInterface;
    this.offset = cuesPointHeader.offset;
    this.size = cuesPointHeader.size;
    this.end = cuesPointHeader.end;
    this.loaded = false;
    this.tempElement = null;
    this.currentElement = null;
    this.cueTime = null;
    this.cueTrackPositions = null;
  }

  load() {
    const end = this.end;
    while (this.dataInterface.offset < end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) {
          return null;
        }
      }
      switch (this.currentElement.id) {
        case 0xB7: // Cue Track Positions
          if (!this.cueTrackPositions) {
            this.cueTrackPositions = new CueTrackPositions(this.currentElement, this.dataInterface);
          }
          this.cueTrackPositions.load();
          if (!this.cueTrackPositions.loaded) {
            return;
          }
          break;
        case 0xB3: // Cue Time
          var cueTime = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (cueTime !== null) {
            this.cueTime = cueTime;
          } else {
            return null;
          }
          break;
        default:
          console.warn('Cue Point not found, skipping');
          break;
      }
      this.currentElement = null;
    }
    this.loaded = true;
  }
}

const INITIAL_COUNTER = -1;

class DataInterface {
  constructor(demuxer) {
    this.demuxer = demuxer;
    this.overallPointer = 0;
    this.internalPointer = 0;
    this.currentBuffer = null;
    this.markerPointer = 0;
    this.tempFloat64 = new DataView(new ArrayBuffer(8));
    this.tempFloat32 = new DataView(new ArrayBuffer(4));
    this.tempBinaryBuffer = null;
    this.seekTarget;
    this.dateParser = new DateParser();

    Object.defineProperty(this, 'offset', {
      get: function () {
        return this.overallPointer;
      },

      set: function (offset) {
        this.overallPointer = offset;
      },
    });
    this.tempElementOffset = null;
    this.tempElementDataOffset = null;
    this.tempSize = null;
    this.tempOctetWidth = null;
    this.tempOctet = null;
    this.tempByteBuffer = 0;
    this.tempByteCounter = 0;
    this.tempElementId = null;
    this.tempElementSize = null;
    this.tempVintWidth = null;
    this.tempResult = null;
    this.tempCounter = INITIAL_COUNTER;
    this.usingBufferedRead = false;
    this.dataBuffers = [];

    /**
         * Returns the bytes left in the current buffer
         */
    Object.defineProperty(this, 'remainingBytes', {
      get: function () {
        if (!this.currentBuffer) {
          return 0;
        } else {
          return this.currentBuffer.byteLength - this.internalPointer;
        }
      },
    });
  }

  flush() {
    this.currentBuffer = null;
    this.tempElementOffset = null;
    this.tempElementDataOffset = null;
    this.tempSize = null;
    this.tempOctetWidth = null;
    this.tempOctet = null;
    this.tempByteBuffer = 0;
    this.tempByteCounter = 0;
    this.tempElementId = null;
    this.tempElementSize = null;
    this.tempVintWidth = null;
    this.tempBinaryBuffer = null;
    this.tempResult = null;
    this.tempCounter = INITIAL_COUNTER;
    this.usingBufferedRead = false;
    this.overallPointer = 0;
    this.internalPointer = 0;
    this.tempFloat64 = new DataView(new ArrayBuffer(8));
    this.tempFloat32 = new DataView(new ArrayBuffer(4));
  }

  recieveInput(data) {
    if (this.currentBuffer === null) {
      this.currentBuffer = new DataView(data);
      this.internalPointer = 0;
    } else {
      // queue it for later
      this.dataBuffers.push(new DataView(data));
    }
  }

  popBuffer() {
    if (this.remainingBytes === 0) {
      if (this.dataBuffers.length > 0) {
        this.currentBuffer = this.dataBuffers.shift();
      } else {
        this.currentBuffer = null;
      }
      this.internalPointer = 0;
    }
  }

  readDate(size) {
    return this.readSignedInt(size);
  }

  readId() {
    if (!this.currentBuffer) {
      return null;
    } // Nothing to parse
    if (!this.tempOctet) {
      if (!this.currentBuffer)// if we run out of data return null
      {
        return null;
      } // Nothing to parse
      this.tempElementOffset = this.overallPointer; // Save the element offset
      this.tempOctet = this.currentBuffer.getUint8(this.internalPointer);
      this.incrementPointers(1);
      this.tempOctetWidth = this.calculateOctetWidth();
      this.popBuffer();
    }

    // We will have at least one byte to read
    let tempByte;
    if (!this.tempByteCounter) {
      this.tempByteCounter = 0;
    }

    while (this.tempByteCounter < this.tempOctetWidth) {
      if (!this.currentBuffer)// if we run out of data return null
      {
        return null;
      } // Nothing to parse
      if (this.tempByteCounter === 0) {
        this.tempByteBuffer = this.tempOctet;
      } else {
        tempByte = this.readByte();
        this.tempByteBuffer = (this.tempByteBuffer << 8) | tempByte;
      }

      this.tempByteCounter++;
      this.popBuffer();
    }

    const result = this.tempByteBuffer;
    this.tempOctet = null;
    this.tempByteCounter = null;
    this.tempByteBuffer = null;
    this.tempOctetWidth = null;
    return result;
  }

  readLacingSize() {
    let vint = this.readVint();
    if (vint === null) {
      return null;
    } else {
      switch (this.lastOctetWidth) {
        case 1:
          vint -= 63;
          break;
        case 2:
          vint -= 8191;
          break;
        case 3:
          vint -= 1048575;
          break;
        case 4:
          vint -= 134217727;
          break;
      }
    }
    return vint;
  }

  readVint() {
    if (!this.currentBuffer) {
      return null;
    } // Nothing to parse
    if (!this.tempOctet) {
      if (!this.currentBuffer)// if we run out of data return null
      {
        return null;
      } // Nothing to parse
      this.tempOctet = this.currentBuffer.getUint8(this.internalPointer);
      this.incrementPointers(1);
      this.tempOctetWidth = this.calculateOctetWidth();
      this.popBuffer();
    }

    if (!this.tempByteCounter) {
      this.tempByteCounter = 0;
    }
    let tempByte;
    const tempOctetWidth = this.tempOctetWidth;
    while (this.tempByteCounter < tempOctetWidth) {
      if (!this.currentBuffer)// if we run out of data return null
      {
        return null;
      } // Nothing to parse
      if (this.tempByteCounter === 0) {
        const mask = ((0xFF << tempOctetWidth) & 0xFF) >> tempOctetWidth;
        this.tempByteBuffer = this.tempOctet & mask;
      } else {
        tempByte = this.readByte();
        this.tempByteBuffer = (this.tempByteBuffer << 8) | tempByte;
      }
      this.tempByteCounter++;
      this.popBuffer();
    }

    const result = this.tempByteBuffer;
    this.tempOctet = null;
    this.lastOctetWidth = this.tempOctetWidth;
    this.tempOctetWidth = null;
    this.tempByteCounter = null;
    this.tempByteBuffer = null;
    // console.warn("read vint");
    return result;
  }

  /**
       * Use this function to read a vint with more overhead by saving the state on each step
       * @return {number | null}
       */
  bufferedReadVint() {
    // We will have at least one byte to read
    let tempByte;
    if (!this.tempByteCounter) {
      this.tempByteCounter = 0;
    }
    while (this.tempByteCounter < this.tempOctetWidth) {
      if (!this.currentBuffer)// if we run out of data return null
      {
        return null;
      } // Nothing to parse
      if (this.tempByteCounter === 0) {
        const mask = ((0xFF << this.tempOctetWidth) & 0xFF) >> this.tempOctetWidth;
        this.tempByteBuffer = this.tempOctet & mask;
      } else {
        tempByte = this.readByte();
        this.tempByteBuffer = (this.tempByteBuffer << 8) | tempByte;
      }
      this.tempByteCounter++;
      this.popBuffer();
    }
    const result = this.tempByteBuffer;
    this.tempByteCounter = null;
    this.tempByteBuffer = null;
    return result;
  }

  clearTemps() {
    this.tempId = null;
    this.tempSize = null;
    this.tempOctetMask = null;
    this.tempOctetWidth = null;
    this.tempOctet = null;
    this.tempByteBuffer = 0;
    this.tempByteCounter = 0;
    this.usingBufferedRead = false;
  }

  /**
       * Use this function to implement a more efficient vint reading if there are enough bytes in the buffer
       * @return {Number|null}
       */
  forceReadVint() {
    let result;
    switch (this.tempOctetWidth) {
      case 1:
        result = this.tempOctet & 0x7F;
        break;
      case 2:
        result = this.tempOctet & 0x3F;
        result = (result << 8) | this.currentBuffer.getUint8(this.internalPointer);
        this.incrementPointers(1);
        break;
      case 3:
        result = this.tempOctet & 0x1F;
        result = (result << 16) | this.currentBuffer.getUint16(this.internalPointer);
        this.incrementPointers(2);
        break;
      case 4:
        result = this.tempOctet & 0x0F;
        result = (result << 16) | this.currentBuffer.getUint16(this.internalPointer);
        this.incrementPointers(2);
        result = (result << 8) | this.currentBuffer.getUint8(this.internalPointer);
        this.incrementPointers(1);
        break;
      case 5:
        console.warn('finish this');
        break;
      case 6:
        /* fix this */
        console.warn('finish this');
        break;
      case 7:
        /* fix this */
        console.warn('finish this');
        break;
      case 8:
        result = this.tempOctet & 0x00;
        // Largest allowable integer in javascript is 2^53-1 so gonna have to use one less bit for now
        result = (result << 8) | this.currentBuffer.getUint8(this.internalPointer);
        this.incrementPointers(1);
        result = (result << 16) | this.currentBuffer.getUint16(this.internalPointer);
        this.incrementPointers(2);
        result = (result << 32) | this.currentBuffer.getUint32(this.internalPointer);
        this.incrementPointers(4);
        break;
    }

    this.popBuffer();
    this.tempOctetWidth = null;
    this.tempOctet = null;
    return result;
  }


  readByte() {
    if (!this.currentBuffer) {
      console.error('READING OUT OF BOUNDS');
    }
    const byteToRead = this.currentBuffer.getUint8(this.internalPointer);
    this.incrementPointers(1);
    this.popBuffer();
    // console.warn("read byte");
    return byteToRead;
  }

  readSignedByte() {
    if (!this.currentBuffer) {
      console.error('READING OUT OF BOUNDS');
    }
    const byteToRead = this.currentBuffer.getInt8(this.internalPointer);
    this.incrementPointers(1);
    this.popBuffer();
    // console.warn("read signed byte");
    return byteToRead;
  }

  peekElement() {
    if (!this.currentBuffer) {
      return null;
    } // Nothing to parse
    // check if we return an id
    if (!this.tempElementId) {
      this.tempElementId = this.readId();
      if (this.tempElementId === null) {
        return null;
      }
    }

    if (!this.tempElementSize) {
      this.tempElementSize = this.readVint();
      if (this.tempElementSize === null) {
        return null;
      }
    }
    const element = new ElementHeader(this.tempElementId, this.tempElementSize, this.tempElementOffset, this.overallPointer);

    // clear the temp holders
    this.tempElementId = null;
    this.tempElementSize = null;
    this.tempElementOffset = null;
    return element;
  }

  /**
       * sets the information on an existing element without creating a new objec
       */
  peekAndSetElement(element) {
    if (!this.currentBuffer) {
      return null;
    } // Nothing to parse
    // check if we return an id
    if (!this.tempElementId) {
      this.tempElementId = this.readId();
      if (this.tempElementId === null) {
        return null;
      }
    }

    if (!this.tempElementSize) {
      this.tempElementSize = this.readVint();
      if (this.tempElementSize === null) {
        return null;
      }
    }
    element.init(this.tempElementId, this.tempElementSize, this.tempElementOffset, this.overallPointer);
    // clear the temp holders
    this.tempElementId = null;
    this.tempElementSize = null;
    this.tempElementOffset = null;
  }

  /*
       * Check if we have enough bytes available in the buffer to read
       * @param {number} n test if we have this many bytes available to read
       * @returns {boolean} has enough bytes to read
       */
  peekBytes(n) {
    if ((this.remainingBytes - n) >= 0) {
      return true;
    }
    return false;
  }

  /**
       * Skips set amount of bytes
       * TODO: Make this more efficient with skipping over different buffers, add stricter checking
       * @param {number} bytesToSkip
       */
  skipBytes(bytesToSkip) {
    let chunkToErase = 0;
    const counter = 0;
    if (this.tempCounter === INITIAL_COUNTER) {
      this.tempCounter = 0;
    }
    while (this.tempCounter < bytesToSkip) {
      if (!this.currentBuffer) {
        return false;
      }
      if ((bytesToSkip - this.tempCounter) > this.remainingBytes) {
        chunkToErase = this.remainingBytes;
      } else {
        chunkToErase = bytesToSkip - this.tempCounter;
      }
      this.incrementPointers(chunkToErase);
      this.popBuffer();
      this.tempCounter += chunkToErase;
    }
    this.tempCounter = INITIAL_COUNTER;
    return true;
  }

  getRemainingBytes() {
    if (!this.currentBuffer) {
      return 0;
    }
    return this.currentBuffer.byteLength - this.internalPointer;
  }

  calculateOctetWidth() {
    let leadingZeroes = 0;
    let zeroMask = 0x80;
    do {
      if (this.tempOctet & zeroMask) {
        break;
      }

      zeroMask = zeroMask >> 1;
      leadingZeroes++;
    } while (leadingZeroes < 8);
    // Set the width of the octet
    return leadingZeroes + 1;
  }

  incrementPointers(n) {
    const bytesToAdd = n || 1;
    this.internalPointer += bytesToAdd;
    this.overallPointer += bytesToAdd;
    // this.popBuffer();
  }

  readUnsignedInt(size) {
    if (!this.currentBuffer)// if we run out of data return null
    {
      return null;
    } // Nothing to parse
    // need to fix overflow for 64bit unsigned int
    if (size <= 0 || size > 8) {
      console.warn('invalid file size');
    }
    if (this.tempResult === null) {
      this.tempResult = 0;
    }
    if (this.tempCounter === INITIAL_COUNTER) {
      this.tempCounter = 0;
    }
    let b;
    while (this.tempCounter < size) {
      if (!this.currentBuffer)// if we run out of data return null
      {
        return null;
      } // Nothing to parse
      b = this.readByte();
      if (this.tempCounter === 0 && b < 0) {
        console.warn('invalid integer value');
      }
      this.tempResult <<= 8;
      this.tempResult |= b;
      this.popBuffer();
      this.tempCounter++;
    }

    // clear the temp resut
    const result = this.tempResult;
    this.tempResult = null;
    this.tempCounter = INITIAL_COUNTER;
    // console.warn("read u int");
    return result;
  }

  readSignedInt(size) {
    if (!this.currentBuffer)// if we run out of data return null
    {
      return null;
    } // Nothing to parse
    // need to fix overflow for 64bit unsigned int
    if (size <= 0 || size > 8) {
      console.warn('invalid file size');
    }
    if (this.tempResult === null) {
      this.tempResult = 0;
    }
    if (this.tempCounter === INITIAL_COUNTER) {
      this.tempCounter = 0;
    }
    let b;
    while (this.tempCounter < size) {
      if (!this.currentBuffer)// if we run out of data return null
      {
        return null;
      } // Nothing to parse
      if (this.tempCounter === 0) {
        b = this.readByte();
      } else {
        b = this.readSignedByte();
      }

      this.tempResult <<= 8;
      this.tempResult |= b;
      this.popBuffer();
      this.tempCounter++;
    }

    // clear the temp resut
    const result = this.tempResult;
    this.tempResult = null;
    this.tempCounter = INITIAL_COUNTER;
    // console.warn("read s int");
    return result;
  }

  readString(size) {
    // console.log("reading string");
    if (!this.tempString) {
      this.tempString = '';
    }

    if (this.tempCounter === INITIAL_COUNTER) {
      this.tempCounter = 0;
    }

    let tempString = '';
    while (this.tempCounter < size) {
      if (!this.currentBuffer) {// if we run out of data return null
        // save progress
        this.tempString += tempString;
        return null; // Nothing to parse
      }

      // this.tempString += String.fromCharCode(this.readByte());
      tempString += String.fromCharCode(this.readByte());

      this.popBuffer();

      this.tempCounter++;
    }

    // var tempString = this.tempString;

    this.tempString += tempString;
    const retString = this.tempString;
    this.tempString = null;
    this.tempCounter = INITIAL_COUNTER;
    return retString;
  }

  readFloat(size) {
    if (size === 8) {
      if (this.tempCounter === INITIAL_COUNTER) {
        this.tempCounter = 0;
      }

      if (this.tempResult === null) {
        this.tempResult = 0;
        this.tempFloat64.setFloat64(0, 0);
      }


      var b;

      while (this.tempCounter < size) {
        if (!this.currentBuffer)// if we run out of data return null
        {
          return null;
        } // Nothing to parse


        b = this.readByte();

        this.tempFloat64.setUint8(this.tempCounter, b);

        this.popBuffer();

        this.tempCounter++;
      }

      this.tempResult = this.tempFloat64.getFloat64(0);
    } else if (size === 4) {
      if (this.tempCounter === INITIAL_COUNTER) {
        this.tempCounter = 0;
      }

      if (this.tempResult === null) {
        this.tempResult = 0;
        this.tempFloat32.setFloat32(0, 0);
      }


      var b;

      while (this.tempCounter < size) {
        if (!this.currentBuffer)// if we run out of data return null
        {
          return null;
        } // Nothing to parse


        b = this.readByte();

        this.tempFloat32.setUint8(this.tempCounter, b);

        this.popBuffer();

        this.tempCounter++;
      }

      this.tempResult = this.tempFloat32.getFloat32(0);
    } else {
      throw 'INVALID FLOAT LENGTH';
    }

    // clear the temp resut
    const result = this.tempResult;
    this.tempResult = null;
    this.tempCounter = INITIAL_COUNTER;
    return result;
  }

  /**
       * Returns a new buffer with the length of data starting at the current byte buffer
       * @param {number} length Length of bytes to read
       * @return {ArrayBuffer} the read data
       */
  getBinary(length) {
    if (!this.currentBuffer)// if we run out of data return null
    {
      return null;
    } // Nothing to parse
    //
    // console.warn("start binary");
    if (this.usingBufferedRead && this.tempCounter === null) {
      throw 'COUNTER WAS ERASED';
    }

    // Entire element contained in 1 array
    if (this.remainingBytes >= length && !this.usingBufferedRead) {
      if (!this.currentBuffer)// if we run out of data return null
      {
        return null;
      } // Nothing to parse

      const newBuffer = this.currentBuffer.buffer.slice(this.internalPointer, this.internalPointer + length);

      this.incrementPointers(length);
      this.popBuffer();
      return newBuffer;
    }


    const test = this.offset;
    const tempRemainingBytes = this.remainingBytes;

    if (this.usingBufferedRead === false && this.tempCounter > 0) {
      throw 'INVALID BUFFERED READ';
    }// at this point should be true

    // data is broken up across different arrays
    // TODO: VERY SLOW, FIX THIS!!!!!!!!!!
    this.usingBufferedRead = true;

    // console.error("USING BUFFERED READ");

    if (!this.tempBinaryBuffer) {
      this.tempBinaryBuffer = new Uint8Array(length);
    }

    if (this.tempCounter === INITIAL_COUNTER) {
      this.tempCounter = 0;
    }

    let bytesToCopy = 0;
    let tempBuffer;
    while (this.tempCounter < length) {
      if (!this.currentBuffer) {// if we run out of data return null{
        if (this.usingBufferedRead === false) {
          throw 'HELLA WRONG';
        }
        return null; // Nothing to parse
      }


      if ((length - this.tempCounter) >= this.remainingBytes) {
        bytesToCopy = this.remainingBytes;
      } else {
        bytesToCopy = length - this.tempCounter;
      }

      tempBuffer = new Uint8Array(this.currentBuffer.buffer, this.internalPointer, bytesToCopy);
      this.tempBinaryBuffer.set(tempBuffer, this.tempCounter);
      this.incrementPointers(bytesToCopy);
      // b = this.readByte();

      // this.tempBinaryBuffer.setUint8(this.tempCounter, b);


      this.popBuffer();


      this.tempCounter += bytesToCopy;
    }


    if (this.tempCounter !== length) {
      console.warn('invalid read');
    }
    const tempBinaryBuffer = this.tempBinaryBuffer;
    this.tempBinaryBuffer = null;
    this.tempCounter = INITIAL_COUNTER;
    this.usingBufferedRead = false;

    // console.warn("reading binary");
    if (tempBinaryBuffer.buffer === null) {
      throw 'Missing buffer';
    }
    return tempBinaryBuffer.buffer;
  }
}

class DateParser {
  constructor() {

  }
}

class ElementHeader {
  constructor(id, size, offset, dataOffset) {
    this.id = id;
    this.size = size;
    // this.headerSize;
    this.offset = offset;
    this.dataOffset = dataOffset;
    this.end = dataOffset + size;
    this.status = true;
  }

  init(id, size, offset, dataOffset) {
    this.id = id;
    this.size = size;
    // this.headerSize;
    this.offset = offset;
    this.dataOffset = dataOffset;
    this.end = dataOffset + size;
    this.status = true;
  }

  reset() {
    this.status = false;
  }

  getData() {
    return {
      id: this.id,
      size: this.size,
      offset: this.offset,
      dataOffset: this.dataOffset,
      end: this.end,
    };
  }
}

// States
const STATE_INITIAL = 0;
const STATE_DECODING = 1;
const STATE_SEEKING = 2;
const META_LOADED = 3;
const STATE_FINISHED = 4;
const EXIT_OK = 666;

/**
     * @classdesc Wrapper class to handle webm demuxing
     */
export class JsWebm {
  constructor() {
    this.shown = false; // for testin
    this.clusters = [];
    this.segmentInfo = [];
    this.state = STATE_INITIAL;
    this.videoPackets = [];
    this.audioPackets = [];
    this.loadedMetadata = false;
    this.seekable = true; // keep false until seek is finished
    this.dataInterface = new DataInterface(this);
    this.segment = null;
    this.currentElement = null; // placeholder for last element
    this.segmentIsLoaded = false; // have we found the segment position
    this.segmentDataOffset;
    this.headerIsLoaded = false;
    this.tempElementHeader = new ElementHeader(-1, -1, -1, -1);
    this.tempElementHeader.reset();
    this.currentElement = null;
    this.segmentInfo = null; // assuming 1 for now
    this.tracks = null;
    this.currentCluster = null;
    this.cpuTime = 0;
    this.seekHead = null;
    this.cuesLoaded = false;
    this.isSeeking = false;
    this.tempSeekPosition = -1;
    this.loadingCues = false;
    this.seekCueTarget = null;
    this.eof = false;
    this.videoFormat = null;
    this.audioFormat = null;
    this.videoCodec = null;
    this.audioFormat = null;
    this.videoTrack = null;
    this.audioTrack = null;
    this.processing = false;

    Object.defineProperty(this, 'duration', {
      get: function () {
        if (this.segmentInfo.duration < 0) {
          return -1;
        }
        return this.segmentInfo.duration / 1000;// / 1000000000.0; ;
      },
    });
  }

  /**
       *
       * Sets up the meta data validation after
       */
  validateMetadata() {
    let codecID;
    let channels;
    let rate;
    let tempTrack;
    // Multiple video tracks are allowed, for now just return the first one
    for (var i in this.tracks.trackEntries) {
      var trackEntry = this.tracks.trackEntries[i];
      if (trackEntry.trackType === 2) {
        tempTrack = trackEntry;
        codecID = trackEntry.codecID;
        channels = trackEntry.channels;
        rate = trackEntry.rate;
        break;
      }
    }
    this.audioTrack = tempTrack;
    switch (codecID) {
      case 'A_VORBIS':
        this.audioCodec = 'vorbis';
        this.initVorbisHeaders(tempTrack);
        break;
      case 'A_OPUS':
        this.audioCodec = 'opus';
        this.initOpusHeaders(tempTrack);
        break;
      case 'A_AAC':
        this.audioCodec = 'aac';
        this.initAacHeaders(tempTrack);
        break;
      default:
        this.audioCodec = null;
        break;
    }

    for (var i in this.tracks.trackEntries) {
      var trackEntry = this.tracks.trackEntries[i];
      if (trackEntry.trackType === 1) { // video track
        tempTrack = trackEntry;
        codecID = trackEntry.codecID;
        break;
      }
    }

    switch (codecID) {
      case 'V_VP8':
        this.videoCodec = 'vp8';
        this.initVp8Headers(tempTrack);
        break;
      case 'V_VP9':
        this.initVp9Headers(tempTrack);
        break;
      default:
        this.videoCodec = null;
        break;
    }

    const fps = 0; // For now?
    this.videoFormat = {
      width: tempTrack.width,
      height: tempTrack.height,
      chromaWidth: tempTrack.width >> 1,
      chromaHeight: tempTrack.height >> 1,
      cropLeft: tempTrack.pixelCropLeft,
      cropTop: tempTrack.pixelCropTop,
      cropWidth: tempTrack.width - tempTrack.pixelCropLeft - tempTrack.pixelCropRight,
      cropHeight: tempTrack.height - tempTrack.pixelCropTop - tempTrack.pixelCropBottom,
      displayWidth: tempTrack.displayWidth,
      displayHeight: tempTrack.displayHeight,
      fps: fps,
    };
    this.loadedMetadata = true;
  }

  initOpusHeaders(trackEntry) {
    this.audioTrack = trackEntry;
  }

  initVorbisHeaders(trackEntry) {
    const headerParser = new DataView(trackEntry.codecPrivate);
    const packetCount = headerParser.getUint8(0);
    const firstLength = headerParser.getUint8(1);
    const secondLength = headerParser.getUint8(2);
    const thirdLength = headerParser.byteLength - firstLength - secondLength - 1;
    if (packetCount !== 2) {
      throw 'INVALID VORBIS HEADER';
    }
    let start = 3;
    let end = start + firstLength;

    // this.audioPackets.push({
    //   data: headerParser.buffer.slice(start, end),
    //   timestamp: -1,
    // });
    start = end;
    end = start + secondLength;

    // this.audioPackets.push({
    //   data: headerParser.buffer.slice(start, end),
    //   timestamp: -1,
    // });
    start = end;
    end = start + thirdLength;
    // this.audioPackets.push({
    //   data: headerParser.buffer.slice(start, end),
    //   timestamp: -1,
    // });
    this.audioTrack = trackEntry;
  }

  initAacHeaders(trackEntry) {
    this.audioTrack = trackEntry;
  }

  initVp8Headers(trackEntry) {
    this.videoTrack = trackEntry;
  }

  initVp9Headers(trackEntry) {
    this.videoTrack = trackEntry;
    let profile = 0; // 0 for default
    let level = 10; // 10 for default level 1
    let bitDepth = 8; // 8 for default
    let chromaSubsampling = 1; // 1 for default
    let colourPrimaries = 1; // 1 for default
    let transferCharacteristics = 1; // 1 for default
    let matrixCoefficients = 1; // 1 for default
    let videoFullRangeFlag = 0; // 0 for default

    if (trackEntry.codecPrivate) {
      const headerParser = new DataView(trackEntry.codecPrivate);
      let currentByte = 0;
      while (currentByte < headerParser.byteLength) {
        const id = headerParser.getUint8(currentByte++);
        const length = headerParser.getUint8(currentByte++);
        if (length !== 1) {
          console.warn('Invalid vp9 header len', length);
          continue;
        }

        const value = headerParser.getUint8(currentByte++);
        switch (id) {
          case 0x01:
            profile = value;
            break;
          case 0x02:
            level = value;
            break;
          case 0x03:
            bitDepth = value;
            break;
          case 0x04:
            chromaSubsampling = value;
            break;
          default:
            console.warn('Unknown vp9 header id', id);
            break;
        }
      }
    }

    const colour = trackEntry.colour;
    if (colour) {
      if (colour.primaries !== undefined) {
        colourPrimaries = colour.primaries;
      }

      if (colour.transferCharacteristics !== undefined) {
        transferCharacteristics = colour.transferCharacteristics;
      }

      if (colour.matrixCoefficients !== undefined) {
        matrixCoefficients = colour.matrixCoefficients;
      }

      if (colour.range) {
        videoFullRangeFlag = colour.range === 'full' ? 1 : 0;
      }
    }

    profile = profile.toString().padStart(2, '0');
    level = level.toString().padStart(2, '0');
    bitDepth = bitDepth.toString().padStart(2, '0');
    chromaSubsampling = chromaSubsampling.toString().padStart(2, '0');
    colourPrimaries = colourPrimaries.toString().padStart(2, '0');
    transferCharacteristics = transferCharacteristics.toString().padStart(2, '0');
    matrixCoefficients = matrixCoefficients.toString().padStart(2, '0');
    videoFullRangeFlag = videoFullRangeFlag.toString().padStart(2, '0');

    this.videoCodec = `vp09.${profile}.${level}.${bitDepth}.${chromaSubsampling}.${colourPrimaries}.${transferCharacteristics}.${matrixCoefficients}.${videoFullRangeFlag}`;
  }

  /**
       * This function ques up more data to the internal buffer
       * @param {arraybuffer} data
       * @return {void}
       */
  queueData(data) {
    this.dataInterface.recieveInput(data);
  }

  demux() {
    let lastPointer = this.dataInterface.overallPointer;;
    switch (this.state) {
      case STATE_INITIAL:
        this.initDemuxer();
        if (this.state !== STATE_DECODING) {
          break;
        }
      case STATE_DECODING:
        this.load();
        // if (this.state !== STATE_FINISHED)
        break;
      case STATE_SEEKING:
        this.processSeeking();
        // if (this.state !== META_LOADED)
        break;
      default:
        console.warn('INVALID STATE');
      // fill this out
    }

    return lastPointer < this.dataInterface.overallPointer;
  }

  /**
       * General process loop,
       * TODO, refactor this!!!!!
       */
  load() {
    let status = false;
    while (this.dataInterface.offset < this.segment.end) {
      if (!this.tempElementHeader.status) {
        this.dataInterface.peekAndSetElement(this.tempElementHeader);
        if (!this.tempElementHeader.status) {
          return null;
        }
      }
      switch (this.tempElementHeader.id) {
        case 0x114D9B74: // Seek Head
          if (!this.seekHead) {
            this.seekHead = new SeekHead(this.tempElementHeader.getData(), this.dataInterface);
          }
          this.seekHead.load();
          if (!this.seekHead.loaded) {
            return false;
          }
          break;
        case 0xEC: // VOid
          var skipped = this.dataInterface.skipBytes(this.tempElementHeader.size);
          if (skipped === false) {
            return;
          }
          break;
        case 0x1549A966: // Info
          if (!this.segmentInfo) {
            this.segmentInfo = new SegmentInfo(this.tempElementHeader.getData(), this.dataInterface);
          }
          this.segmentInfo.load();
          if (!this.segmentInfo.loaded) {
            return false;
          }
          break;

        case 0x1654AE6B: // Tracks
          if (!this.tracks) {
            this.tracks = new Tracks(this.tempElementHeader.getData(), this.dataInterface, this);
          }
          this.tracks.load();
          if (!this.tracks.loaded) {
            return false;
          }
          break;

        case 0x1C53BB6B: // Cues
          if (!this.cues) {
            this.cues = new Cues(this.tempElementHeader.getData(), this.dataInterface, this);
          }
          this.cues.load();
          if (!this.cues.loaded) {
            return false;
          }
          this.cuesLoaded = true;
          break;

        case 0x1254c367: // Tags
          if (!this.tags) {
            this.tags = new Tags(this.tempElementHeader.getData(), this.dataInterface, this);
          }
          this.tags.load();
          if (!this.tags.loaded) {
            return false;
          }
          break;

        case 0x1F43B675: // Cluster
          if (!this.loadedMetadata) {
            this.validateMetadata();
            return true;
          }
          if (!this.currentCluster) {
            this.currentCluster = new Cluster(
              this.tempElementHeader.offset,
              this.tempElementHeader.size,
              this.tempElementHeader.end,
              this.tempElementHeader.dataOffset,
              this.dataInterface,
              this,
            );
          }
          status = this.currentCluster.load();
          if (!this.currentCluster.loaded) {
            return status;
          }
          this.currentCluster = null;
          break;
        default:
          this.state = META_LOADED;
          var skipped = this.dataInterface.skipBytes(this.tempElementHeader.size);
          if (skipped === false) {
            return;
          }
          console.log('UNSUPORTED ELEMENT FOUND, SKIPPING : ' + this.tempElementHeader.id.toString(16));
          break;
      }
      this.tempElementHeader.reset();
    }

    this.eof = true;
    this.state = STATE_FINISHED;
    return status;
  }

  initDemuxer() {
    // Header is small so we can read the whole thing in one pass or just wait for more data if necessary
    const dataInterface = this.dataInterface; // cache dataInterface reference
    if (!this.headerIsLoaded) {
      // only load it if we didnt already load it
      if (!this.elementEBML) {
        this.elementEBML = dataInterface.peekElement();
        if (!this.elementEBML) {
          return null;
        }

        if (this.elementEBML.id !== 0x1A45DFA3) { // EBML
          // If the header has not loaded and the first element is not the header, do not continue
          console.warn('INVALID PARSE, HEADER NOT LOCATED');
        }
      }

      const end = this.elementEBML.end;
      while (dataInterface.offset < end) {
        if (!this.tempElementHeader.status) {
          dataInterface.peekAndSetElement(this.tempElementHeader);
          if (!this.tempElementHeader.status) {
            return null;
          }
        }
        switch (this.tempElementHeader.id) {
          case 0x4286: // EBMLVersion
            var version = dataInterface.readUnsignedInt(this.tempElementHeader.size);
            if (version !== null) {
              this.version = version;
            } else {
              return null;
            }
            break;
          case 0x42F7: // EBMLReadVersion
            var readVersion = dataInterface.readUnsignedInt(this.tempElementHeader.size);
            if (readVersion !== null) {
              this.readVersion = readVersion;
            } else {
              return null;
            }
            break;

          case 0x42F2: // EBMLMaxIDLength
            var maxIdLength = dataInterface.readUnsignedInt(this.tempElementHeader.size);
            if (maxIdLength !== null) {
              this.maxIdLength = maxIdLength;
            } else {
              return null;
            }
            break;

          case 0x42F3: // EBMLMaxSizeLength
            var maxSizeLength = dataInterface.readUnsignedInt(this.tempElementHeader.size);
            if (maxSizeLength !== null) {
              this.maxSizeLength = maxSizeLength;
            } else {
              return null;
            }
            break;

          case 0x4282: // DocType
            var docType = dataInterface.readString(this.tempElementHeader.size);
            if (docType !== null) {
              this.docType = docType;
            } else {
              return null;
            }
            break;

          case 0x4287: // DocTypeVersion //worked
            var docTypeVersion = dataInterface.readUnsignedInt(this.tempElementHeader.size);
            if (docTypeVersion !== null) {
              this.docTypeVersion = docTypeVersion;
            } else {
              return null;
            }
            break;

          case 0x4285: // DocTypeReadVersion //worked
            var docTypeReadVersion = dataInterface.readUnsignedInt(this.tempElementHeader.size);
            if (docTypeReadVersion !== null) {
              this.docTypeReadVersion = docTypeReadVersion;
            } else {
              return null;
            }
            break;

          case 0xbf: // CRC-32
            var crc = dataInterface.getBinary(this.tempElementHeader.size);
            if (crc !== null) {
              crc;
            }
            // this.docTypeReadVersion = docTypeReadVersion;
            else {
              return null;
            }
            break;

          default:
            console.warn('UNSUPORTED HEADER ELEMENT FOUND, SKIPPING : ' + this.tempElementHeader.id.toString(16));
            break;
        }
        this.tempElementHeader.reset();
      }
      this.headerIsLoaded = true;
    }

    // Now find segment offsets
    if (!this.currentElement) {
      this.currentElement = this.dataInterface.peekElement();
    }

    if (!this.currentElement) {
      return null;
    }

    switch (this.currentElement.id) {
      case 0x18538067: // Segment
        this.segment = this.currentElement;
        break;
      case 0xEC: // void
        var skipped = this.dataInterface.skipBytes(this.tempElementHeader.size);
        if (skipped === false) {
          return null;
        }
        break;
      default:
        console.warn('Global element not found, id: ' + this.currentElement.id);
    }

    this.currentElement = null;
    this.segmentIsLoaded = true;
    this.state = STATE_DECODING;
  }

  _flush() {
    this.audioPackets = [];
    this.videoPackets = [];
    this.dataInterface.flush();
    // this.tempElementHeader.reset();
    this.tempElementHeader = new ElementHeader(-1, -1, -1, -1);
    this.tempElementHeader.reset();
    this.currentElement = null;
    this.currentCluster = null;
    this.eof = false;
  }

  processSeeking() {
    // Have to load cues if not available
    if (!this.cuesLoaded) {
      // throw "cues not loaded";
      if (!this.cuesOffset) {
        this.initCues();
        this._flush();
        this.dataInterface.offset = this.cuesOffset;
        this.onseek(this.cuesOffset);
        return 0;
      }
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) {
          return 0;
        }
      }
      if (!this.cues) {
        this.cues = new Cues(this.currentElement, this.dataInterface, this);
      }
      // processing cues
      this.cues.load();
      if (!this.cues.loaded) {
        return 0;
      }
      this.cuesLoaded = true;
      // console.warn(this.cues);
      return 0;
    }
    // now we can caluclate the pointer offset
    this.calculateKeypointOffset();
    // we should now have the cue point
    const clusterOffset = this.seekCueTarget.cueTrackPositions.cueClusterPosition + this.segment.dataOffset;
    this._flush();
    this.dataInterface.offset = clusterOffset;
    this.onseek(clusterOffset);
    this.state = STATE_DECODING;
    return 0;
  }

  /**
       * Possibly use this to initialize cues if not loaded, can be called from onScrub or seekTo
       * Send seek request to cues, then make it keep reading bytes and waiting until cues are loaded
       * @return {undefined}
       */
  initCues() {
    if (!this.cuesOffset) {
      const length = this.seekHead.entries.length;
      const entries = this.seekHead.entries;
      // console.warn(this.seekHead);
      let seekOffset;
      // Todo : make this less messy
      for (let i = 0; i < length; i += 1) {
        if (entries[i].seekId === 0x1C53BB6B) // cues
        {
          this.cuesOffset = entries[i].seekPosition + this.segment.dataOffset;
        } // its the offset from data offset
      }
    }
  }

  /**
       * Get the offset based off the seconds, probably use binary search and have to parse the keypoints to numbers
       */
  calculateKeypointOffset() {
    const timestampScale = this.segmentInfo.timestampScale;
    this.seekTime;
    const cuesPoints = this.cues.entries; // cache for faster lookups;
    const length = this.cues.entries.length; // total number of cues;
    let scanPoint = cuesPoints[0];
    let tempPoint;

    // do linear search now
    // Todo, make binary search
    let i = 1;
    for (i; i < length; i++) {
      tempPoint = cuesPoints[i];
      if (tempPoint.cueTime * timestampScale > this.seekTime) {
        break;
      }
      scanPoint = tempPoint;
    }
    this.seekCueTarget = scanPoint;
  }
}

class Seek {
  constructor(seekHeader, dataInterface) {
    this.size = seekHeader.size;
    this.offset = seekHeader.offset;
    this.end = seekHeader.end;
    this.dataInterface = dataInterface;
    this.loaded = false;
    this.currentElement = null;
    this.seekId = -1;
    this.seekPosition = -1;
  }

  load() {
    while (this.dataInterface.offset < this.end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) {
          return null;
        }
      }

      switch (this.currentElement.id) {
        case 0x53AB: { // SeekId
          const seekId = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (seekId !== null) {
            this.seekId = seekId;
          } else {
            return null;
          }
          break;
        }
        case 0x53AC: { // SeekPosition
          const seekPosition = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (seekPosition !== null) {
            this.seekPosition = seekPosition;
          } else {
            return null;
          }
          break;
        }
        case 0xbf: // CRC-32
          var crc = this.dataInterface.getBinary(this.currentElement.size);
          if (crc !== null) {
            crc;
          }
          // this.docTypeReadVersion = docTypeReadVersion;
          else {
            return null;
          }
          break;
        default:
          console.warn('Seek element not found, skipping : ' + this.currentElement.id.toString(16));
          break;
      }
      this.currentElement = null;
    }
    if (this.dataInterface.offset !== this.end) {
      console.error('Invalid Seek Formatting');
    }
    this.loaded = true;
  }
}

class SeekHead {
  constructor(seekHeadHeader, dataInterface) {
    this.dataInterface = dataInterface;
    this.offset = seekHeadHeader.offset;
    this.size = seekHeadHeader.size;
    this.end = seekHeadHeader.end;
    this.entries = [];
    this.entryCount = 0;
    this.voidElements = [];
    this.voidElementCount = 0;
    this.loaded = false;
    this.tempEntry = null;
    this.currentElement = null;
  }

  load() {
    const end = this.end;
    while (this.dataInterface.offset < end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) {
          return null;
        }
      }
      switch (this.currentElement.id) {
        case 0x4DBB: // Seek
          if (!this.tempEntry) {
            this.tempEntry = new Seek(this.currentElement, this.dataInterface);
          }
          this.tempEntry.load();
          if (!this.tempEntry.loaded) {
            return;
          } else {
            this.entries.push(this.tempEntry);
          }
          break;
        case 0xbf: // CRC-32
          var crc = this.dataInterface.getBinary(this.currentElement.size);
          if (crc !== null) {
            crc;
          }
          // this.docTypeReadVersion = docTypeReadVersion;
          else {
            return null;
          }
          break;
        // TODO, ADD VOID
        default:
          console.warn('Seek head element not found, skipping : ' + this.currentElement.id.toString(16));
          break;
      }
      this.tempEntry = null;
      this.currentElement = null;
    }

    if (this.dataInterface.offset !== this.end) {
      console.log(this);
      throw 'INVALID SEEKHEAD FORMATTING';
    }

    this.loaded = true;
  }
}

class SegmentInfo {
  constructor(infoHeader, dataInterface) {
    this.dataInterface = dataInterface;
    this.offset = infoHeader.offset;
    this.size = infoHeader.size;
    this.end = infoHeader.end;
    this.muxingApp = null;
    this.writingApp = null;
    this.title = null;
    this.dataOffset = null;
    this.timestampScale = 1000000;
    this.duration = -1;
    this.loaded = false;
    this.segmentUID = null;
    this.duration = null;
    this.dateUTC;
  }

  load() {
    const end = this.end;
    while (this.dataInterface.offset < end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) {
          return null;
        }
      }

      switch (this.currentElement.id) {
        // TODO add duration and title
        case 0x2AD7B1: { // TimeStampScale
          const timestampScale = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (timestampScale !== null) {
            this.timestampScale = timestampScale;
          } else {
            return null;
          }
          break;
        }
        case 0x4D80: // Muxing App
          var muxingApp = this.dataInterface.readString(this.currentElement.size);
          if (muxingApp !== null) {
            this.muxingApp = muxingApp;
          } else {
            return null;
          }
          break;
        case 0x5741: // writing App
          var writingApp = this.dataInterface.readString(this.currentElement.size);
          if (writingApp !== null) {
            this.writingApp = writingApp;
          } else {
            return null;
          }
          break;

        case 0x7BA9: // title
          var title = this.dataInterface.readString(this.currentElement.size);
          if (title !== null) {
            this.title = title;
          } else {
            return null;
          }
          break;
        case 0x73A4: // segmentUID
          // TODO, LOAD THIS AS A BINARY ARRAY, SHOULD BE 128 BIT UNIQUE ID
          var segmentUID = this.dataInterface.readString(this.currentElement.size);
          if (segmentUID !== null) {
            this.segmentUID = segmentUID;
          } else {
            return null;
          }
          break;

        case 0x4489: // duration
          var duration = this.dataInterface.readFloat(this.currentElement.size);
          if (duration !== null) {
            this.duration = duration;
          } else {
            return null;
          }
          break;

        case 0x4461: // DateUTC
          var dateUTC = this.dataInterface.readDate(this.currentElement.size);
          if (dateUTC !== null) {
            this.dateUTC = dateUTC;
          } else {
            return null;
          }
          break;

        case 0xbf: // CRC-32
          var crc = this.dataInterface.getBinary(this.currentElement.size);
          if (crc !== null) {
            crc;
          }
          // this.docTypeReadVersion = docTypeReadVersion;
          else {
            return null;
          }
          break;
        default:
          console.error('Ifno element not found, skipping : ' + this.currentElement.id.toString(16));
          break;
      }
      this.currentElement = null;
    }

    if (this.dataInterface.offset !== this.end) {
      throw new Error('Invalid SegmentInfo Formatting');
    }
    this.loaded = true;
  }
}

const NO_LACING = 0;
const XIPH_LACING = 1;
const FIXED_LACING = 2;
const EBML_LACING = 3;

class SimpleBlock {
  constructor() {
    this.cluster;
    this.dataInterface;// = dataInterface;
    this.offset;// = blockHeader.offset;
    this.dataOffset;// = blockHeader.dataOffset;
    this.size;// = blockHeader.size;
    this.end;// = blockHeader.end;
    this.loaded = false;
    this.trackNumber = null;
    this.timeStamp = -1;
    this.flags = null;
    this.keyFrame = false;
    this.invisible = false;
    this.lacing = NO_LACING;
    this.discardable = false;
    this.lacedFrameCount = null;
    this.headerSize = null;
    this.frameSizes = [];
    this.tempCounter = null;
    this.tempFrame = null;
    this.track = null;
    this.frameLength = null;
    this.isLaced = false;
    this.stop = null; // = this.offset + this.size;
    this.status = false;
    this.ebmlLacedSizes = [];
    this.ebmlParsedSizes = [];
    this.ebmlLacedSizesParsed = false;
  }

  init(offset, size, end, dataOffset, dataInterface, cluster) {
    this.cluster = cluster;
    this.dataInterface = dataInterface;
    this.offset = offset;
    this.dataOffset = dataOffset;
    this.size = size;
    this.end = end;
    this.loaded = false;
    this.trackNumber = null;
    this.timeStamp = null;
    this.flags = null;
    this.keyFrame = false;
    this.invisible = false;
    this.lacing = NO_LACING;
    this.discardable = false;
    this.lacedFrameCount = null;
    this.headerSize = null;
    this.frameSizes = [];
    this.tempCounter = null;
    this.tempFrame = null;
    this.track = null;
    this.frameLength = null;
    this.isLaced = false;
    this.stop = this.offset + this.size;
    this.status = true;
    this.trackEntries = this.cluster.demuxer.tracks.trackEntries;
    this.videoPackets = this.cluster.demuxer.videoPackets;
    this.audioPackets = this.cluster.demuxer.audioPackets;
    this.laceFrameHelper = null;
    this.lacedFrameHeaderSize = null;
    this.ebmlLacedSizes = [];
    this.lacedFrameDataSize = null;
    this.fixedFrameLength = null;
    this.firstLacedFrameSize = null;
    this.ebmlParsedSizes = [];
    this.ebmlLacedSizesParsed = false;
  }

  reset() {
    this.status = false;
  }

  loadTrack() {
    this.track = this.trackEntries.find((track) => track.trackNumber === this.trackNumber);
    if (!this.track) {
      throw 'INVALID TRACK NUMBER';
    }
  }

  load() {
    const dataInterface = this.dataInterface;
    if (this.loaded) {
      throw new Error('ALREADY LOADED');
    }

    if (this.trackNumber === null) {
      this.trackNumber = dataInterface.readVint();
      if (this.trackNumber === null) {
        return null;
      }
      this.loadTrack();
    }

    if (this.timeStamp === null) {
      this.timeStamp = dataInterface.readUnsignedInt(2);// Be signed for some reason?
      if (this.timeStamp === null) {
        return null;
      }
    }

    if (this.flags === null) {// / FIX THIS
      this.flags = dataInterface.readUnsignedInt(1);
      if (this.flags === null) {
        return null;
      }

      this.keyFrame = (((this.flags >> 7) & 0x01) === 0) ? false : true;
      this.invisible = (((this.flags >> 2) & 0x01) === 0) ? true : false;
      this.lacing = ((this.flags & 0x06) >> 1);
      if (this.lacing > 3 || this.lacing < 0) {
        throw 'INVALID LACING';
      }
    }

    if (!this.headerSize) {
      this.headerSize = dataInterface.offset - this.dataOffset;
    }

    switch (this.lacing) {
      case FIXED_LACING:
        if (!this.frameLength) {
          this.frameLength = this.size - this.headerSize;
          if (this.frameLength <= 0) {
            throw 'INVALID FRAME LENGTH ' + this.frameLength;
          }
        }
        if (!this.lacedFrameCount) {
          this.lacedFrameCount = dataInterface.readUnsignedInt(1);
          if (this.lacedFrameCount === null) {
            return null;
          }
          this.lacedFrameCount++;
        }

        var tempFrame = dataInterface.getBinary(this.frameLength - 1);
        if (tempFrame === null) {
          // if (dataInterface.usingBufferedRead === false)
          //    throw "SHOULD BE BUFFERED READ";
          // console.warn("frame has been split");
          return null;
        }

        this.fixedFrameLength = (this.frameLength - 1) / this.lacedFrameCount;
        var fullTimeStamp = this.timeStamp + this.cluster.timeStamp;
        // var fullTimeCode = this.cluster.timeStamp;
        var timeStamp = fullTimeStamp;
        if (timeStamp < 0) {
          throw 'INVALID TIMESTAMP';
        }

        for (var i = 0; i < this.lacedFrameCount; i++) {
          if (this.track.trackType === 1) {
            this.videoPackets.push({// This could be improved
              data: tempFrame.slice(i * this.fixedFrameLength, i * this.fixedFrameLength + this.fixedFrameLength),
              timestamp: i === 0 ? timeStamp : null,
              isKeyframe: this.keyFrame,
            });
          } else if (this.track.trackType === 2) {
            this.audioPackets.push({// This could be improved
              data: tempFrame.slice(i * this.fixedFrameLength, i * this.fixedFrameLength + this.fixedFrameLength),
              timestamp: i === 0 ? timeStamp : null,
              isKeyframe: this.keyFrame,
            });
          }
        }
        tempFrame = null;
        break;
      case EBML_LACING:
        if (!this.frameLength) {
          this.frameLength = this.size - this.headerSize;
          if (this.frameLength <= 0) {
            throw 'INVALID FRAME LENGTH ' + this.frameLength;
          }
        }
        if (!this.lacedFrameCount) {
          this.lacedFrameCount = dataInterface.readUnsignedInt(1);
          if (this.lacedFrameCount === null) {
            return null;
          }
          this.lacedFrameCount++;
        }
        if (!this.firstLacedFrameSize) {
          const firstLacedFrameSize = this.dataInterface.readVint();
          if (firstLacedFrameSize !== null) {
            this.firstLacedFrameSize = firstLacedFrameSize;
            this.ebmlLacedSizes.push(this.firstLacedFrameSize);
          } else {
            return null;
          }
        }
        if (!this.tempCounter) {
          this.tempCounter = 0;
        }

        while (this.tempCounter < this.lacedFrameCount - 1) {
          const frameSize = dataInterface.readLacingSize();
          if (frameSize === null) {
            return null;
          }
          this.ebmlLacedSizes.push(frameSize);
          this.tempCounter++;
        }

        // Now parse the frame sizes
        if (!this.ebmlLacedSizesParsed) {
          this.ebmlParsedSizes[0] = this.ebmlLacedSizes[0];
          let total = this.ebmlParsedSizes[0];
          for (var i = 1; i < this.lacedFrameCount - 1; i++) {
            this.ebmlParsedSizes[i] = this.ebmlLacedSizes[i] + this.ebmlParsedSizes[i - 1];
            total += this.ebmlParsedSizes[i];
          }
          if (!this.lacedFrameDataSize) {
            this.lacedFrameDataSize = this.end - dataInterface.offset;
          }

          const lastSize = this.lacedFrameDataSize - total;
          this.ebmlParsedSizes.push(lastSize);
          this.ebmlLacedSizesParsed = true;
          this.ebmlTotalSize = total + lastSize;
        }
        var tempFrame = dataInterface.getBinary(this.lacedFrameDataSize);
        if (tempFrame === null) {
          return null;
        }

        var fullTimeStamp = this.timeStamp + this.cluster.timeStamp;
        // var fullTimeCode = this.cluster.timeStamp;
        var timeStamp = fullTimeStamp;
        if (timeStamp < 0) {
          throw 'INVALID TIMESTAMP';
        }

        var start = 0;
        var end = this.ebmlParsedSizes[0];
        for (var i = 0; i < this.lacedFrameCount; i++) {
          if (this.track.trackType === 1) {
            this.videoPackets.push({// This could be improved
              data: tempFrame.slice(start, end),
              timestamp: i === 0 ? timeStamp : null,
              isKeyframe: this.keyFrame,
            });
          } else if (this.track.trackType === 2) {
            this.audioPackets.push({// This could be improved
              data: tempFrame.slice(start, end),
              timestamp: i === 0 ? timeStamp : null,
              isKeyframe: this.keyFrame,
            });
          }

          start += this.ebmlParsedSizes[i];
          end += this.ebmlParsedSizes[i];
          if (i === this.lacedFrameCount - 1) {
            end = null;
          }
        }
        this.tempCounter = null;
        tempFrame = null;
        break;
      case XIPH_LACING:
      case NO_LACING:
        if (this.lacing === EBML_LACING) {
          console.warn('EBML_LACING');
        }
        if (this.lacing === XIPH_LACING) {
          console.warn('XIPH_LACING');
        }
        if (!this.frameLength) {
          this.frameLength = this.size - this.headerSize;
          if (this.frameLength <= 0) {
            throw 'INVALID FRAME LENGTH ' + this.frameLength;
          }
        }

        var tempFrame = dataInterface.getBinary(this.frameLength);
        if (tempFrame === null) {
          // if (dataInterface.usingBufferedRead === false)
          //    throw "SHOULD BE BUFFERED READ " + dataInterface.offset;
          // console.warn("frame has been split");
          return null;
        } else {
          if (dataInterface.usingBufferedRead === true) {
            throw 'SHOULD NOT BE BUFFERED READ';
          }

          if (tempFrame.byteLength !== this.frameLength) {
            throw 'INVALID FRAME';
          }
        }


        var fullTimeStamp = this.timeStamp + this.cluster.timeStamp;
        // var fullTimeCode = this.cluster.timeStamp;
        var timeStamp = fullTimeStamp;
        if (timeStamp < 0) {
          throw 'INVALID TIMESTAMP';
        }

        if (this.track.trackType === 1) {
          this.videoPackets.push({// This could be improved
            data: tempFrame,
            timestamp: timeStamp,
            isKeyframe: this.keyFrame,
          });
        } else if (this.track.trackType === 2) {
          this.audioPackets.push({// This could be improved
            data: tempFrame,
            timestamp: timeStamp,
            isKeyframe: this.keyFrame,
          });
        }

        tempFrame = null;
        break;
      default:
        console.log(this);
        console.warn('LACED ELEMENT FOUND');
        throw 'STOP HERE';
    }

    if (this.end !== dataInterface.offset) {
      throw new Error('INVALID BLOCK SIZE');
    }

    this.loaded = true;
    this.headerSize = null;
    this.tempFrame = null;
    this.tempCounter = null;
    this.frameLength = null;
  }
}

class SimpleTag {
  constructor(simpleTagHeader, dataInterface) {
    this.dataInterface = dataInterface;
    this.offset = simpleTagHeader.offset;
    this.size = simpleTagHeader.size;
    this.end = simpleTagHeader.end;
    this.loaded = false;
    this.tempElement = null;
    this.currentElement = null;
    this.cueTrack = null;
    this.cueClusterPosition = 0;
    this.cueRelativePosition = 0;
    this.tagName = null;
    this.tagString = null;
  }

  load() {
    while (this.dataInterface.offset < this.end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) {
          return null;
        }
      }
      switch (this.currentElement.id) {
        case 0x45A3: // TagName
          var tagName = this.dataInterface.readString(this.currentElement.size);
          if (tagName !== null) {
            this.tagName = tagName;
          } else {
            return null;
          }
          break;
        case 0x4487: // TagString
          var tagString = this.dataInterface.readString(this.currentElement.size);
          if (tagString !== null) {
            this.tagString = tagString;
          } else {
            return null;
          }
          break;
        case 0x4484: // Tag Default
          var tagDefault = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (tagDefault !== null) this.tagDefault = tagDefault;
          else {
            return null;
          }
          break;
        case 0x447A: // Tag Language
          var tagLanguage = this.dataInterface.readSignedInt(this.currentElement.size);
          if (tagLanguage !== null) this.tagLanguage = tagLanguage;
          else {
            return null;
          }
          break;
        default:
          if (!this.dataInterface.peekBytes(this.currentElement.size)) {
            return false;
          } else {
            this.dataInterface.skipBytes(this.currentElement.size);
          }
          console.warn('simple tag element not found ! : ' + this.currentElement.id.toString(16));
          break;
      }
      this.currentElement = null;
    }

    if (this.dataInterface.offset !== this.end) {
      console.error('Invalid Targets Formatting');
    }
    this.loaded = true;
  }
}

class Tag {
  constructor(tagHeader, dataInterface, demuxer) {
    this.dataInterface = dataInterface;
    this.offset = tagHeader.offset;
    this.size = tagHeader.size;
    this.end = tagHeader.end;
    this.entries = [];
    this.loaded = false;
    this.tempEntry = null;
    this.demuxer = demuxer;
    this.currentElement = null;
    this.targets = [];
    this.simpleTags = [];
  }

  load() {
    const end = this.end;
    while (this.dataInterface.offset < end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) {
          return null;
        }
      }
      switch (this.currentElement.id) {
        case 0x63C0: // Targets
          if (!this.tempEntry) {
            this.tempEntry = new Targets(this.currentElement, this.dataInterface);
          }
          this.tempEntry.load();
          if (!this.tempEntry.loaded) {
            return null;
          }
          this.targets.push(this.tempEntry);
          this.tempEntry = null;
          break;
        case 0x67C8: // SimpleTag
          if (!this.tempEntry) {
            this.tempEntry = new SimpleTag(this.currentElement, this.dataInterface);
          }
          this.tempEntry.load();
          if (!this.tempEntry.loaded) {
            return null;
          }

          this.simpleTags.push(this.tempEntry);
          this.tempEntry = null;
          break;
        default:
          if (!this.dataInterface.peekBytes(this.currentElement.size)) {
            return false;
          } else {
            this.dataInterface.skipBytes(this.currentElement.size);
          }
          console.warn('tag element not found: ' + this.currentElement.id.toString(16)); // probably bad
          break;
      }

      this.tempEntry = null;
      this.currentElement = null;
      // this.cueTrackPositions = this.tempEntry;
      // this.tempEntry = null;
    }

    if (this.dataInterface.offset !== this.end) {
      console.log(this);
      throw 'INVALID CUE FORMATTING';
    }

    this.loaded = true;
  }
}

class Tags {
  constructor(tagsHeader, dataInterface) {
    this.dataInterface = dataInterface;
    this.offset = tagsHeader.offset;
    this.size = tagsHeader.size;
    this.end = tagsHeader.end;
    this.entries = [];
    this.loaded = false;
    this.tempEntry = null;
    this.currentElement = null;
    this.currentTag = null;
    this.tags = [];
  }

  load() {
    const end = this.end;
    while (this.dataInterface.offset < end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) {
          return null;
        }
      }

      switch (this.currentElement.id) {
        case 0x7373: // Tag
          if (!this.currentTag) {
            this.currentTag = new Tag(this.currentElement.getData(), this.dataInterface);
          }
          this.currentTag.load();
          if (!this.currentTag.loaded) {
            return false;
          }

          this.tags.push(this.currentTag);
          this.currentTag = null;
          break;

        case 0xbf: // CRC-32
          var crc = this.dataInterface.getBinary(this.currentElement.size);
          if (crc !== null) {
            crc;
          }
          // this.docTypeReadVersion = docTypeReadVersion;
          else {
            return null;
          }
          break;
        default:
          if (!this.dataInterface.peekBytes(this.currentElement.size)) {
            return false;
          } else {
            this.dataInterface.skipBytes(this.currentElement.size);
          }
          console.warn('tags element not found, skipping' + this.currentElement.id.toString(16));
          break;
      }
      this.currentElement = null;
    }
    this.loaded = true;
  }
}

class Targets {
  constructor(targetsHeader, dataInterface) {
    this.dataInterface = dataInterface;
    this.offset = targetsHeader.offset;
    this.size = targetsHeader.size;
    this.end = targetsHeader.end;
    this.loaded = false;
    this.tempElement = null;
    this.currentElement = null;
    this.cueTrack = null;
    this.cueClusterPosition = 0;
    this.cueRelativePosition = 0;
  }

  load() {
    while (this.dataInterface.offset < this.end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) return null;
      }
      switch (this.currentElement.id) {
        case 0x63C5: // tagTrackUID
          var tagTrackUID = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (tagTrackUID !== null) this.tagTrackUID = tagTrackUID;
          else {
            return null;
          }
          break;
        case 0x68CA: // TargetTypeValue
          var targetTypeValue = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (targetTypeValue !== null) this.targetTypeValue = targetTypeValue;
          else {
            return null;
          }
          break;
        default:
          if (!this.dataInterface.peekBytes(this.currentElement.size)) {
            return false;
          } else {
            this.dataInterface.skipBytes(this.currentElement.size);
          }
          console.warn('targets element not found ! : ' + this.currentElement.id.toString(16));
          break;
      }
      this.currentElement = null;
    }

    if (this.dataInterface.offset !== this.end) {
      console.error('Invalid Targets Formatting');
    }
    this.loaded = true;
  }
}


/**
     * @classdesc The TrackLoader class is a helper class to load the Track subelement types. Since the layout
     * of the Track entries is a little odd, it needs to parse the current
     * level data plus the track container which can be either audio video, content encodings, and maybe subtitles.
     */
class TrackLoader {
  constructor(trackheader, dataInterface) {
    this.dataInterface = dataInterface;
    this.offset = trackheader.offset;
    this.size = trackheader.size;
    this.end = trackheader.end;
    this.loaded = false;
    this.loading = true;
    this.trackData = {};
    this.trackData.trackNumber = null;
    this.trackData.trackType = null;
    this.trackData.name = null;
    this.trackData.codecName = null;
    this.trackData.defaultDuration = null;
    this.trackData.codecID = null;
    this.trackData.lacing = null;
    this.trackData.codecPrivate = null;
    this.trackData.codecDelay = null;
    this.trackData.seekPreRoll = null;
    this.trackData.trackUID = null;
    this.tempTrack = null;
    this.minCache = null;
  }

  load() {
    const end = this.end;
    while (this.dataInterface.offset < end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) return null;
      }
      switch (this.currentElement.id) {
        // TODO support content encodings
        case 0xE0: // Video Track
          if (!this.tempTrack) {
            this.tempTrack = new VideoTrack(this.currentElement, this.dataInterface);
          }
          this.tempTrack.load();
          if (!this.tempTrack.loaded) return;
          break;
        case 0xE1: // Audio Number
          if (!this.tempTrack) {
            this.tempTrack = new AudioTrack(this.currentElement, this.dataInterface);
          }
          this.tempTrack.load();
          if (!this.tempTrack.loaded) return;
          break;
        case 0xD7: { // Track Number
          const trackNumber = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (trackNumber !== null) {
            this.trackData.trackNumber = trackNumber;
          } else {
            return null;
          }
          break;
        }
        case 0x83: { // TrackType
          const trackType = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (trackType !== null) {
            this.trackData.trackType = trackType;
          } else {
            return null;
          }
          break;
        }
        case 0x536E: { // Name
          const name = this.dataInterface.readString(this.currentElement.size);
          if (name !== null) {
            this.trackData.name = name;
          } else {
            return null;
          }
          break;
        }
        case 0x258688: { // CodecName
          const codecName = this.dataInterface.readString(this.currentElement.size);
          if (codecName !== null) {
            this.trackData.codecName = codecName;
          } else {
            return null;
          }
          break;
        }
        case 0x22B59C: // Language
          var language = this.dataInterface.readString(this.currentElement.size);
          if (language !== null) {
            this.trackData.language = language;
          } else {
            return null;
          }
          break;
        case 0x23E383: // DefaultDuration
          var defaultDuration = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (defaultDuration !== null) {
            this.trackData.defaultDuration = defaultDuration;
          } else {
            return null;
          }
          break;
        case 0x86: // CodecId
          var codecID = this.dataInterface.readString(this.currentElement.size);
          if (codecID !== null) {
            this.trackData.codecID = codecID;
          } else {
            return null;
          }
          break;
        case 0x9C: // FlagLacing
          var lacing = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (lacing !== null) {
            this.trackData.lacing = lacing;
          } else {
            return null;
          }
          break;
        case 0xB9: // FlagEnabled
          var flagEnabled = this.dataInterface.getBinary(this.currentElement.size);
          if (flagEnabled !== null) {
            this.trackData.flagEnabled = flagEnabled;
          } else {
            return null;
          }
          break;
        case 0x55AA: // FlagForced
          var flagForced = this.dataInterface.getBinary(this.currentElement.size);
          if (flagForced !== null) {
            this.trackData.flagForced = flagForced;
          } else {
            return null;
          }
          break;
        case 0x63A2: // Codec Private
          var codecPrivate = this.dataInterface.getBinary(this.currentElement.size);
          if (codecPrivate !== null) {
            this.trackData.codecPrivate = codecPrivate;
          } else {
            return null;
          }
          break;
        case 0x56AA: // Codec Delay
          var codecDelay = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (codecDelay !== null) {
            this.trackData.codecDelay = codecDelay;
          } else {
            return null;
          }
          break;
        case 0x56BB: // Pre Seek Roll
          var seekPreRoll = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (seekPreRoll !== null) {
            this.trackData.seekPreRoll = seekPreRoll;
          } else {
            return null;
          }
          break;
        case 0x73C5: // Track UID
          var trackUID = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (trackUID !== null) {
            this.trackData.trackUID = trackUID;
          } else {
            return null;
          }
          break;
        case 0x6DE7: // MinCache
          var minCache = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (minCache !== null) {
            this.trackData.minCache = minCache;
          } else {
            return null;
          }
          break;
        case 0xbf: // CRC-32
          var crc = this.dataInterface.getBinary(this.currentElement.size);
          if (crc !== null) {
            crc;
          }
          // this.docTypeReadVersion = docTypeReadVersion;
          else {
            return null;
          }
          break;
        case 0x88: // CRC-32
          var flagDefault = this.dataInterface.readUnsignedInt(this.currentElement.size);
          if (flagDefault !== null) {
            this.flagDefault = flagDefault;
          }
          // this.docTypeReadVersion = docTypeReadVersion;
          else {
            return null;
          }
          break;
        default:
          if (!this.dataInterface.peekBytes(this.currentElement.size)) {
            return false;
          } else {
            this.dataInterface.skipBytes(this.currentElement.size);
          }
          console.warn('track data element not found, skipping : ' + this.currentElement.id.toString(16));
          break;
      }
      this.currentElement = null;
    }
    this.loaded = true;
  }

  getTrackEntry() {
    this.tempTrack = this.tempTrack || new Track();
    this.tempTrack.loadMeta(this.trackData);
    const tempTrack = this.tempTrack;
    this.tempTrack = null;
    this.loading = false;
    return tempTrack;
  }
}

class Tracks {
  constructor(seekHeadHeader, dataInterface, demuxer) {
    this.demuxer = demuxer;
    this.dataInterface = dataInterface;
    this.offset = seekHeadHeader.offset;
    this.size = seekHeadHeader.size;
    this.end = seekHeadHeader.end;
    this.trackEntries = [];
    this.loaded = false;
    this.tempEntry = null;
    this.currentElement = null;
    this.trackLoader = null;
  }

  load() {
    while (this.dataInterface.offset < this.end) {
      if (!this.currentElement) {
        this.currentElement = this.dataInterface.peekElement();
        if (this.currentElement === null) {
          return null;
        }
      }
      switch (this.currentElement.id) {
        case 0xAE: // Track Entry
          if (!this.trackLoader) {
            this.trackLoader = new TrackLoader(this.currentElement, this.dataInterface);
          }
          this.trackLoader.load();
          if (!this.trackLoader.loaded) {
            return;
          } else {
            var trackEntry = this.trackLoader.getTrackEntry();
            this.trackLoader = null;
          }
          this.trackEntries.push(trackEntry);
          break;
        case 0xbf: // CRC-32
          var crc = this.dataInterface.getBinary(this.currentElement.size);
          if (crc !== null) {
            crc;
          }
          // this.docTypeReadVersion = docTypeReadVersion;
          else {
            return null;
          }
          break;
        default:
          console.warn('track element not found, skipping : ' + this.currentElement.id.toString(16));
          break;
      }
      this.currentElement = null;
    }
    this.loaded = true;
  }

  loadTrackEntry() {
    if (!this.tempEntry) {
      this.tempEntry = new Seek(this.currentElement, this.dataInterface);
    }
  }
}

window.JsWebm = JsWebm;