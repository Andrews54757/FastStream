window.addEventListener('message', async (event) => {
  if (event.data.type === 'sandboxEvaluate') {
    try {
      const fn = new Function(...event.data.argNames, event.data.body);
      const result = await fn(...event.data.argValues);
      event.source.postMessage({type: 'sandboxResult', result}, event.origin);
    } catch (error) {
      event.source.postMessage({type: 'sandboxError', error: error}, event.origin);
    }
  }
});
