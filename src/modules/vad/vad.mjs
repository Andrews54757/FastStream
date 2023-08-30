import { OrtJS } from "./ort.mjs";

const currentScript = import.meta;
let basePath = "";
if (currentScript) {
    basePath = currentScript.url
        .replace(/#.*$/, "")
        .replace(/\?.*$/, "")
        .replace(/\/[^\/]+$/, "/");
}

const assetPath = (file) => {
    return basePath + file;
};

const modelFetcher = async () => {
    const modelURL = assetPath("silero_vad.onnx");
    return await fetch(modelURL).then((r) => r.arrayBuffer());
};

const defaultFrameProcessorOptions = {
    positiveSpeechThreshold: 0.5,
    negativeSpeechThreshold: 0.5 - 0.15,
    preSpeechPadFrames: 1,
    redemptionFrames: 8,
    frameSamples: 1536,
    minSpeechFrames: 3,
}
const defaultRealTimeVADOptions = {
    ...defaultFrameProcessorOptions,
    onFrameProcessed: (probabilities) => { },
    onVADMisfire: () => {

    },
    onSpeechStart: () => {

    },
    onSpeechEnd: () => {

    },
    stream: undefined,
};
const Message = {
    AudioFrame: 1,
    SpeechStart: 2,
    VADMisfire: 3,
    SpeechEnd: 4
}

class Silero {
    static async new(ort, modelFetcher) {
        const model = new Silero(ort, modelFetcher);
        await model.init();
        return model;
    }
    constructor(ort, modelFetcher) {
        this.ort = ort;
        this.modelFetcher = modelFetcher;
        this.init = async () => {
            console.debug("initializing vad");
            const modelArrayBuffer = await this.modelFetcher();
            this._session = await this.ort.InferenceSession.create(modelArrayBuffer);
            this._sr = new this.ort.Tensor("int64", [16000n]);
            this.reset_state();
            console.debug("vad is initialized");
        };
        this.reset_state = () => {
            const zeroes = Array(2 * 64).fill(0);
            this._h = new this.ort.Tensor("float32", zeroes, [2, 1, 64]);
            this._c = new this.ort.Tensor("float32", zeroes, [2, 1, 64]);
        };
        this.process = async (audioFrame) => {
            const t = new this.ort.Tensor("float32", audioFrame, [1, audioFrame.length]);
            const inputs = {
                input: t,
                h: this._h,
                c: this._c,
                sr: this._sr,
            };
            const out = await this._session.run(inputs);
            this._h = out.hn;
            this._c = out.cn;
            const [isSpeech] = out.output.data;
            const notSpeech = 1 - isSpeech;
            return { notSpeech, isSpeech };
        };
    }
}

const concatArrays = (arrays) => {
    const sizes = arrays.reduce((out, next) => {
        out.push(out.at(-1) + next.length);
        return out;
    }, [0]);
    const outArray = new Float32Array(sizes.at(-1));
    arrays.forEach((arr, index) => {
        const place = sizes[index];
        outArray.set(arr, place);
    });
    return outArray;
};

class FrameProcessor {
    constructor(modelProcessFunc, modelResetFunc, options) {
        this.modelProcessFunc = modelProcessFunc;
        this.modelResetFunc = modelResetFunc;
        this.options = options;
        this.speaking = false;
        this.redemptionCounter = 0;
        this.active = false;
        this.reset = () => {
            this.speaking = false;
            this.audioBuffer = [];
            this.modelResetFunc();
            this.redemptionCounter = 0;
        };
        this.pause = () => {
            this.active = false;
            this.reset();
        };
        this.resume = () => {
            this.active = true;
        };
        this.endSegment = () => {
            const audioBuffer = this.audioBuffer;
            this.audioBuffer = [];
            const speaking = this.speaking;
            this.reset();
            const speechFrameCount = audioBuffer.reduce((acc, item) => {
                return acc + +item.isSpeech;
            }, 0);
            if (speaking) {
                if (speechFrameCount >= this.options.minSpeechFrames) {
                    const audio = concatArrays(audioBuffer.map((item) => item.frame));
                    return { msg: Message.SpeechEnd, audio };
                }
                else {
                    return { msg: Message.VADMisfire };
                }
            }
            return {};
        };
        this.process = async (frame) => {
            if (!this.active) {
                return {};
            }
            const probs = await this.modelProcessFunc(frame);
            this.audioBuffer.push({
                frame,
                isSpeech: probs.isSpeech >= this.options.positiveSpeechThreshold,
            });
            if (probs.isSpeech >= this.options.positiveSpeechThreshold &&
                this.redemptionCounter) {
                this.redemptionCounter = 0;
            }
            if (probs.isSpeech >= this.options.positiveSpeechThreshold &&
                !this.speaking) {
                this.speaking = true;
                return { probs, msg: Message.SpeechStart };
            }
            if (probs.isSpeech < this.options.negativeSpeechThreshold &&
                this.speaking &&
                ++this.redemptionCounter >= this.options.redemptionFrames) {
                this.redemptionCounter = 0;
                this.speaking = false;
                const audioBuffer = this.audioBuffer;
                this.audioBuffer = [];
                const speechFrameCount = audioBuffer.reduce((acc, item) => {
                    return acc + +item.isSpeech;
                }, 0);
                if (speechFrameCount >= this.options.minSpeechFrames) {
                    const audio = concatArrays(audioBuffer.map((item) => item.frame));
                    return { probs, msg: Message.SpeechEnd, audio };
                }
                else {
                    return { probs, msg: Message.VADMisfire };
                }
            }
            if (!this.speaking) {
                while (this.audioBuffer.length > this.options.preSpeechPadFrames) {
                    this.audioBuffer.shift();
                }
            }
            return { probs };
        };
        this.audioBuffer = [];
        this.reset();
    }
}
class AudioNodeVAD {
    static async new(ctx, options = {}) {
        const vad = new AudioNodeVAD(ctx, {
            ...defaultRealTimeVADOptions,
            ...options,
        });
        await vad.init();
        return vad;
    }
    constructor(ctx, options) {
        this.ctx = ctx;
        this.options = options;
    }


    async init() {
        await this.ctx.audioWorklet.addModule(assetPath("vad.worklet.mjs"));
        const vadNode = new AudioWorkletNode(this.ctx, "vad-helper-worklet", {
            processorOptions: {
                frameSamples: this.options.frameSamples,
            },
        });
        this.entryNode = vadNode;
        const model = await Silero.new(OrtJS, modelFetcher);
        this.frameProcessor = new FrameProcessor(model.process, model.reset_state, {
            frameSamples: this.options.frameSamples,
            positiveSpeechThreshold: this.options.positiveSpeechThreshold,
            negativeSpeechThreshold: this.options.negativeSpeechThreshold,
            redemptionFrames: this.options.redemptionFrames,
            preSpeechPadFrames: this.options.preSpeechPadFrames,
            minSpeechFrames: this.options.minSpeechFrames,
        });
        vadNode.port.onmessage = async (ev) => {
            switch (ev.data?.message) {
                case Message.AudioFrame:
                    const buffer = ev.data.data;
                    const frame = new Float32Array(buffer);
                    await this.processFrame(frame);
                    break;
                default:
                    break;
            }
        };
    }

    getNode() {
        return this.entryNode;
    }

    pause() {
        this.frameProcessor.pause();
    };

    start() {
        this.frameProcessor.resume();
    };

    stop() {
        this.entryNode.disconnect();
        this.entryNode = undefined;
    }

    receive(node) {
        node.connect(this.entryNode);
    }
   
    async processFrame(frame) {
        const { probs, msg, audio } = await this.frameProcessor.process(frame);
        if (probs !== undefined) {
            this.options.onFrameProcessed(probs);
        }
        switch (msg) {
            case Message.SpeechStart:
                this.options.onSpeechStart();
                break;
            case Message.VADMisfire:
                this.options.onVADMisfire();
                break;
            case Message.SpeechEnd:
                // @ts-ignore
                this.options.onSpeechEnd(audio);
                break;
            default:
                break;
        }
    }
}


export const VadJS = {
    AudioNodeVAD
}