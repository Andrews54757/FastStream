export class VirtualAudioNode {
  constructor(name) {
    this.name = name;
    this.inputNodes = [];
    this.outputNodes = [];
  }

  static isVirtualAudioNode(node) {
    return node instanceof VirtualAudioNode;
  }

  static getRealInputNodes(node) {
    const queue = [node];
    const realInputNodes = [];
    while (queue.length > 0) {
      const currentNode = queue.pop();
      if (VirtualAudioNode.isVirtualAudioNode(currentNode)) {
        queue.push(...currentNode.inputNodes);
      } else {
        realInputNodes.push(currentNode);
      }
    }
    return realInputNodes;
  }

  static getRealOutputNodes(node) {
    if (VirtualAudioNode.isVirtualAudioNode(node)) {
      return node.outputNodes.flatMap((outputNode) => {
        return VirtualAudioNode.getRealOutputNodes(outputNode);
      });
    } else {
      return [node];
    }
  }

  connect(otherNode) {
    if (this.outputNodes.includes(otherNode)) {
      return;
    }

    this.outputNodes.push(otherNode);
    if (VirtualAudioNode.isVirtualAudioNode(otherNode)) {
      otherNode.inputNodes.push(this);
    }

    const inputNodes = VirtualAudioNode.getRealInputNodes(this);
    const outputNodes = VirtualAudioNode.getRealOutputNodes(otherNode);

    for (const inputNode of inputNodes) {
      for (const outputNode of outputNodes) {
        try {
          inputNode.connect(outputNode);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  connectFrom(otherNode) {
    if (this.inputNodes.includes(otherNode)) {
      return;
    }

    this.inputNodes.push(otherNode);
    if (VirtualAudioNode.isVirtualAudioNode(otherNode)) {
      otherNode.outputNodes.push(this);
    }

    const inputNodes = VirtualAudioNode.getRealInputNodes(otherNode);
    const outputNodes = VirtualAudioNode.getRealOutputNodes(this);

    for (const inputNode of inputNodes) {
      for (const outputNode of outputNodes) {
        try {
          inputNode.connect(outputNode);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  disconnect(otherNode) {
    const index = this.outputNodes.indexOf(otherNode);
    if (index === -1) {
      throw new Error('Node not connected');
    }

    this.outputNodes.splice(index, 1);
    if (VirtualAudioNode.isVirtualAudioNode(otherNode)) {
      const inputIndex = otherNode.inputNodes.indexOf(this);
      if (inputIndex === -1) {
        throw new Error('Node not connected');
      }
      otherNode.inputNodes.splice(inputIndex, 1);
    }

    const inputNodes = VirtualAudioNode.getRealInputNodes(this);
    const outputNodes = VirtualAudioNode.getRealOutputNodes(otherNode);

    for (const inputNode of inputNodes) {
      for (const outputNode of outputNodes) {
        try {
          inputNode.disconnect(outputNode);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  disconnectFrom(otherNode) {
    const index = this.inputNodes.indexOf(otherNode);
    if (index === -1) {
      throw new Error('Node not connected');
    }

    this.inputNodes.splice(index, 1);
    if (VirtualAudioNode.isVirtualAudioNode(otherNode)) {
      const outputIndex = otherNode.outputNodes.indexOf(this);
      if (outputIndex === -1) {
        throw new Error('Node not connected');
      }
      otherNode.outputNodes.splice(outputIndex, 1);
    }

    const inputNodes = VirtualAudioNode.getRealInputNodes(otherNode);
    const outputNodes = VirtualAudioNode.getRealOutputNodes(this);
    for (const inputNode of inputNodes) {
      for (const outputNode of outputNodes) {
        try {
          inputNode.disconnect(outputNode);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
}
