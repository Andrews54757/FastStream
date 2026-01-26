async function prepare() {
  // First, clear persistent storages
  if (window.localStorage) window.localStorage.clear();
  if (window.sessionStorage) window.sessionStorage.clear();

  // Remove cookies
  document.cookie = '';

  // Delete all indexedDB databases
  if (window.indexedDB && indexedDB.databases) {
    const dbs = await window.indexedDB.databases();
    await Promise.all(dbs.map((db) => {
      const req = window.indexedDB.deleteDatabase(db.name);
      return new Promise((resolve, reject) => {
        req.onsuccess = resolve;
        req.onerror = resolve;
      });
    }));
  }
}

const preparePromise = prepare();

window.addEventListener('message', async (event) => {
  if (event.data.type === 'sandboxEvaluate') {
    await preparePromise;
    try {
      const fn = new Function(...event.data.argNames, event.data.body);
      const result = await fn(...event.data.argValues);
      event.source.postMessage({type: 'sandboxResult', result}, event.origin);
    } catch (error) {
      event.source.postMessage({type: 'sandboxError', error: error}, event.origin);
    }
  }
});
