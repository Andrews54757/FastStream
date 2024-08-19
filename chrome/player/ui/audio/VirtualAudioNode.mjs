export class VirtualAudioNode {
  constructor(name) {
    this.name = name;
    this.inputNodes = [];
    this.outputNodes = [];
  }

  static isVirtualAudioNode(node) {
    return node instanceof VirtualAudioNode;
  }

  static getRealInputNodes(node, outputIndex) {
    if (!VirtualAudioNode.isVirtualAudioNode(node)) {
      return [[node, outputIndex]];
    } else {
      const realInputNodes = [];
      node.inputNodes.forEach(([inputNode, nextOutputIndex, nextInputIndex]) => {
        if (outputIndex !== undefined && nextInputIndex !== undefined && outputIndex !== nextInputIndex) {
          return;
        }
        realInputNodes.push(...VirtualAudioNode.getRealInputNodes(inputNode, nextOutputIndex));
      });
      return realInputNodes;
    }
  }

  static getRealOutputNodes(node, inputIndex) {
    if (!VirtualAudioNode.isVirtualAudioNode(node)) {
      return [[node, inputIndex]];
    } else {
      const realOutputNodes = [];
      node.outputNodes.forEach(([outputNode, nextOutputIndex, nextInputIndex]) => {
        if (inputIndex !== undefined && nextOutputIndex !== undefined && inputIndex !== nextOutputIndex) {
          return;
        }
        realOutputNodes.push(...VirtualAudioNode.getRealOutputNodes(outputNode, nextInputIndex));
      });
      return realOutputNodes;
    }
  }

  static connectOverlap(inputNodes, outputNodes) {
    inputNodes.forEach(([inputNode, outputIndex]) => {
      outputNodes.forEach(([outputNode, inputIndex]) => {
        try {
          inputNode.connect(outputNode, outputIndex, inputIndex);
        } catch (e) {
          console.error(e);
        }
      });
    });
  }

  static disconnectOverlap(inputNodes, outputNodes) {
    inputNodes.forEach(([inputNode, outputIndex]) => {
      outputNodes.forEach(([outputNode, inputIndex]) => {
        try {
          inputNode.disconnect(outputNode, outputIndex, inputIndex);
        } catch (e) {
          console.error(e);
        }
      });
    });
  }

  indexConnectedFrom(otherNode, outputIndex, inputIndex) {
    return this.inputNodes.findIndex(([node, outputIndex2, inputIndex2]) => node === otherNode && outputIndex2 === outputIndex && inputIndex2 === inputIndex);
  }

  indexConnectedTo(otherNode, outputIndex, inputIndex) {
    return this.outputNodes.findIndex(([node, outputIndex2, inputIndex2]) => node === otherNode && outputIndex2 === outputIndex && inputIndex2 === inputIndex);
  }

  connect(otherNode, outputIndex, inputIndex) {
    if (this.indexConnectedTo(otherNode, outputIndex, inputIndex) !== -1) {
      return;
    }

    this.outputNodes.push([otherNode, outputIndex, inputIndex]);
    if (VirtualAudioNode.isVirtualAudioNode(otherNode)) {
      otherNode.inputNodes.push([this, outputIndex, inputIndex]);
    }

    const inputNodes = VirtualAudioNode.getRealInputNodes(this, outputIndex);
    const outputNodes = VirtualAudioNode.getRealOutputNodes(otherNode, inputIndex);
    VirtualAudioNode.connectOverlap(inputNodes, outputNodes);
  }

  connectFrom(otherNode, outputIndex, inputIndex) {
    if (this.indexConnectedFrom(otherNode, outputIndex, inputIndex) !== -1) {
      return;
    }

    this.inputNodes.push([otherNode, outputIndex, inputIndex]);
    if (VirtualAudioNode.isVirtualAudioNode(otherNode)) {
      otherNode.outputNodes.push([this, outputIndex, inputIndex]);
    }

    const inputNodes = VirtualAudioNode.getRealInputNodes(otherNode, outputIndex);
    const outputNodes = VirtualAudioNode.getRealOutputNodes(this, inputIndex);
    VirtualAudioNode.connectOverlap(inputNodes, outputNodes);
  }

  disconnect(otherNode, outputIndex, inputIndex) {
    const index = this.indexConnectedTo(otherNode, outputIndex, inputIndex);
    if (index === -1) {
      throw new Error('Node not connected');
    }

    this.outputNodes.splice(index, 1);
    if (VirtualAudioNode.isVirtualAudioNode(otherNode)) {
      const inputInd = otherNode.indexConnectedFrom(this, outputIndex, inputIndex);
      if (inputInd === -1) {
        throw new Error('Node not connected');
      }
      otherNode.inputNodes.splice(inputInd, 1);
    }

    const inputNodes = VirtualAudioNode.getRealInputNodes(this, outputIndex);
    const outputNodes = VirtualAudioNode.getRealOutputNodes(otherNode, inputIndex);
    VirtualAudioNode.disconnectOverlap(inputNodes, outputNodes);
  }

  disconnectFrom(otherNode, outputIndex, inputIndex) {
    const index = this.indexConnectedFrom(otherNode, outputIndex, inputIndex);
    if (index === -1) {
      throw new Error('Node not connected');
    }

    this.inputNodes.splice(index, 1);
    if (VirtualAudioNode.isVirtualAudioNode(otherNode)) {
      const outputInd = otherNode.indexConnectedTo(this, outputIndex, inputIndex);
      if (outputInd === -1) {
        throw new Error('Node not connected');
      }
      otherNode.outputNodes.splice(outputInd, 1);
    }

    const inputNodes = VirtualAudioNode.getRealInputNodes(otherNode, outputIndex);
    const outputNodes = VirtualAudioNode.getRealOutputNodes(this, inputIndex);
    VirtualAudioNode.disconnectOverlap(inputNodes, outputNodes);
  }
}
