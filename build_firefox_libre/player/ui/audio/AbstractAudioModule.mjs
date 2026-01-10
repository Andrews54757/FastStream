import {EventEmitter} from '../../modules/eventemitter.mjs';
import {VirtualAudioNode} from './VirtualAudioNode.mjs';
export class AbstractAudioModule extends EventEmitter {
  constructor(name) {
    super();
    this.audioContext = null;
    this.inputNode = null;
    this.outputNode = null;
    this.name = name || 'AbstractAudioModule';
  }
  setupNodes(audioContext) {
    this.audioContext = audioContext;
    this.inputNode = new VirtualAudioNode(this.name + ' input');
    this.outputNode = new VirtualAudioNode(this.name + ' output');
  }
  getInputNode() {
    return this.inputNode;
  }
  getOutputNode() {
    return this.outputNode;
  }
}
