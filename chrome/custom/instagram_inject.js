(()=>{
  function findPropertyRecursive(obj, key, list = [], stack = []) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((v, i)=>{
        stack.push(i);
        findPropertyRecursive(v, key, list, stack);
        stack.pop();
      });
    } else {
      if (Object.hasOwn(obj, key)) {
        list.push({value: obj[key], stack: stack.slice(), obj});
      }
      Object.keys(obj).forEach((k)=>{
        stack.push(k);
        findPropertyRecursive(obj[k], key, list, stack);
        stack.pop();
      });
    }

    return list;
  }


  const rawOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function() {
    if (!this._hooked) {
      this._hooked = true;
      setupHook(this);
    }
    // eslint-disable-next-line prefer-rest-params
    rawOpen.apply(this, arguments);
  };

  function setupHook(xhr) {
    xhr.addEventListener('readystatechange', (e) =>{
      // Check response code
      if (xhr.readyState !== 4) {
        return;
      }

      // Make sure it is not an arraybuffer
      if (xhr.responseType === 'arraybuffer') {
        return;
      }

      // Parse json
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (e) {
        return;
      }

      // video_dash_manifest
      const objs = findPropertyRecursive(data, 'video_dash_manifest');

      if (objs.length === 0) {
        console.error('No video_dash_manifest found');
        return;
      }

      // Find non empty value
      const value = objs.find((o)=>!!o.value).value;

      if (!value) {
        console.error('No value found');
        return;
      }

      window.postMessage({
        type: 'fs_source_detected',
        value: value.toString(),
        ext: 'mpd',
      }, '*');
    });
  }
})();
