import {EventEmitter} from '../eventemitter.mjs';
const currentScript = import.meta;
let basePath = '';
if (currentScript) {
  basePath = currentScript.url
      .replace(/#.*$/, '')
      .replace(/\?.*$/, '')
      .replace(/\/[^\/]+$/, '/');
}
const assetPath = (file) => {
  return basePath + file;
};
export class ChannelCounterNode extends EventEmitter {
  constructor(ctx) {
    super();
    this.ctx = ctx;
  }
  async init() {
    await this.ctx.audioWorklet.addModule(assetPath('channelcounter.worklet.mjs'));
    const counterNode = new AudioWorkletNode(this.ctx, 'channelcounter-worklet');
    this.counterNode = counterNode;
    counterNode.port.onmessage = (ev) => {
      this.emit('channelcount', ev.data);
    };
    return this;
  }
  getNode() {
    return this.counterNode;
  }
  destroy() {
    if (!this.counterNode) {
      return;
    }
    this.getNode().port.postMessage({type: 'close'});
    this.counterNode.disconnect();
    this.counterNode = undefined;
  }
}
