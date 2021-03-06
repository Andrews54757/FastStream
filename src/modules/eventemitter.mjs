

class EventEmitterContext {
    constructor(parent) {
        this.parent = parent;
        this.events = new Map();
    }

    destroy() {
        this.parent.removeContext(this);
    }

    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
        return this;
    }

    off(event, callback) {
        if (!this.events.has(event)) {
            return this;
        }
        let callbacks = this.events.get(event);
        let index = callbacks.indexOf(callback);
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
        this.events.get(event).forEach(callback => callback(...args));
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
        let context = new EventEmitterContext(this);
        this.contexts.push(context);
        return context;
    }

    logAllEvents() {
        this.debug = true;

    }

    removeContext(context) {
        let index = this.contexts.indexOf(context);
        if (index === 0) {
            throw new Error("Cannot remove main context");
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
        this.contexts.forEach(context => context.emit(event, ...args));
        return this;
    }
}

export const EmitterCancel = Symbol("EmitterCancel");
export class EmitterRelay {
    constructor(outs) {
        this.outs = [];

        if (Array.isArray(outs)) {
            outs.forEach(out => this.appendOutput(out));
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
        let index = this.outs.indexOf(out);
        if (index !== -1) {
            this.outs.splice(index, 1);
        }
        return this;
    }

    emit(event, ...args) {
        for (let i = 0; i < this.outs.length; i++) {
            let val = this.outs[i].emit(event, ...args);
            if (val === EmitterCancel) {
                break;
            }
        }
    }

}

