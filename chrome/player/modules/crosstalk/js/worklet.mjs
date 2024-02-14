import * as bindgen from '../pkg/fs_crosstalk.js';

async function load(wasm) {
  const imports = bindgen.__wbg_get_imports();
  bindgen.__wbg_init_memory(imports);
  const { instance, module } = await bindgen.__wbg_load(wasm, imports);
  bindgen.__wbg_finalize_init(instance, module);
  return { instance, module };
}

registerProcessor('WasmProcessor', class WasmProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this.port.onmessage = this.onMessage.bind(this);
  }

  onMessage(data) {
    if (data.type === 'init') {
      load(data.wasm).then(() => {
        this.processor = bindgen.Test.new();
      });
    }
  }
  process(inputs, outputs) {
    return this.processor.process(inputs[0][0], inputs[0][1], outputs[0][0], outputs[0][1]);
  }
});
