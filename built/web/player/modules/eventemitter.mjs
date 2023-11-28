export const EmitterCancel = Symbol('EmitterCancel');
class EventEmitterContext {
  constructor(parent) {
    this.parent = parent;
    this.events = new Map();
  }
  destroy() {
    this.parent.removeContext(this);
  }
  on(event, callback, prepend = false) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    if (prepend) {
      this.events.get(event).unshift(callback);
    } else {
      this.events.get(event).push(callback);
    }
    return this;
  }
  off(event, callback) {
    if (!this.events.has(event)) {
      return this;
    }
    const callbacks = this.events.get(event);
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
    return this;
  }
  clear(event) {
    this.events.delete(event);
    return this;
  }
  emit(event, ...args) {
    if (!this.events.has(event)) {
      return this;
    }
    this.events.get(event).every((callback) => {
      try {
        const result = callback(...args);
        if (result === EmitterCancel) {
          return false;
        }
      } catch (e) {
        console.log(`Error in event ${event}`);
        console.error(e);
      }
      return true;
    });
    return this;
  }
}
export class EventEmitter {
  constructor() {
    this.mainContext = new EventEmitterContext(this);
    this.contexts = [this.mainContext];
    this.debug = false;
  }
  createContext() {
    const context = new EventEmitterContext(this);
    this.contexts.push(context);
    return context;
  }
  logAllEvents() {
    this.debug = true;
  }
  removeContext(context) {
    const index = this.contexts.indexOf(context);
    if (index === 0) {
      throw new Error('Cannot remove main context');
    }
    if (index !== -1) {
      this.contexts.splice(index, 1);
    }
    return this;
  }
  on(event, callback) {
    this.mainContext.on(event, callback);
    return this;
  }
  off(event, callback) {
    this.mainContext.off(event, callback);
    return this;
  }
  emit(event, ...args) {
    if (this.debug) {
      console.log(event, ...args);
    }
    this.contexts.forEach((context) => context.emit(event, ...args));
    return this;
  }
}
export class EmitterRelay {
  constructor(outs) {
    this.outs = [];
    if (Array.isArray(outs)) {
      outs.forEach((out) => this.appendOutput(out));
    } else if (outs) {
      this.appendOutput(outs);
    }
  }
  appendOutput(out) {
    this.outs.push(out);
    return this;
  }
  prependOutput(out) {
    this.outs.unshift(out);
    return this;
  }
  removeOutput(out) {
    const index = this.outs.indexOf(out);
    if (index !== -1) {
      this.outs.splice(index, 1);
    }
    return this;
  }
  emit(event, ...args) {
    for (let i = 0; i < this.outs.length; i++) {
      const val = this.outs[i].emit(event, ...args);
      if (val === EmitterCancel) {
        break;
      }
    }
  }
}
