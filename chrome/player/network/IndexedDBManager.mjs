const closeQueue = [];

export class IndexedDBManager {
  constructor() {
  }

  static isSupported() {
    return window.indexedDB !== undefined;
  }

  async setup() {
    await this.close();
    this.prune();

    this.aliveInterval = setInterval(()=>{
      this.keepAlive();
    }, 1000);

    this.dbName = 'faststream-temp-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
    this.db = await this.requestDB(this.dbName);
    closeQueue.push(this);

    return this.transact(this.db, 'metadata', 'readwrite', (transaction)=>{
      const metaDataStore = transaction.objectStore('metadata');
      metaDataStore.put(Date.now(), 'creation_time');
      metaDataStore.put(Date.now(), 'updated_time');
    });
  }

  async close() {
    clearInterval(this.aliveInterval);
    if (this.db) {
      this.db.close();
      this.db = null;

      await this.deleteDB(this.dbName);

      const index = closeQueue.indexOf(this);
      if (index !== -1) {
        closeQueue.splice(index, 1);
      }
    }
  }

  async getDatabases() {
    if (window.indexedDB.databases) {
      return window.indexedDB.databases();
    } else {
      return JSON.parse(localStorage.getItem('fs_temp_databases') || '[]').map((name)=>{
        return {
          name: name,
        };
      });
    }
  }

  async prune() {
    const databases = await this.getDatabases();

    return Promise.all(databases.map(async (database)=>{
      if (database.name.startsWith('faststream-temp-')) {
        try {
          const db = await this.requestDB(database.name);
          // check if stale
          const updatedTime = await this.getValue(db, 'metadata', 'updated_time');
          if (!updatedTime || Date.now() - updatedTime > 5000) {
            db.close();
            await this.deleteDB(database.name);
            console.log('Pruned', database.name);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }));
  }

  async requestDB(dbName) {
    const request = window.indexedDB.open(dbName, 3);
    request.onupgradeneeded = async (event) => {
      const db = event.target.result;
      db.createObjectStore('metadata');
      db.createObjectStore('files');
      if (!window.indexedDB.databases) {
        const databases = JSON.parse(localStorage.getItem('fs_temp_databases') || '[]');
        databases.push(dbName);
        localStorage.setItem('fs_temp_databases', JSON.stringify(databases));
      }
    };

    return this.wrapRequest(request, 5000);
  }

  async deleteDB(dbName) {
    try {
      await this.wrapRequest(window.indexedDB.deleteDatabase(dbName), 5000);
    } catch (e) {
      console.error(e);
    }
    if (!window.indexedDB.databases) {
      const databases = JSON.parse(localStorage.getItem('fs_temp_databases') || '[]');
      localStorage.setItem('fs_temp_databases', JSON.stringify(databases.filter((name)=>name !== dbName)));
    }
  }

  async getValue(db, storeName, key) {
    return this.transact(db, storeName, 'readonly', (transaction)=>{
      const metaDataStore = transaction.objectStore(storeName);
      return this.wrapRequest(metaDataStore.get(key));
    });
  }

  async clearStorage() {
    if (!this.db) return;
    return this.transact(this.db, 'files', 'readwrite', (transaction)=>{
      const metaDataStore = transaction.objectStore('files');
      return this.wrapRequest(metaDataStore.clear());
    });
  }

  async getFile(identifier) {
    return this.getValue(this.db, 'files', identifier);
  }

  async setFile(identifier, data) {
    return this.transact(this.db, 'files', 'readwrite', (transaction)=>{
      const metaDataStore = transaction.objectStore('files');
      return this.wrapRequest(metaDataStore.put(data, identifier));
    });
  }

  async deleteFile(identifier) {
    return this.transact(this.db, 'files', 'readwrite', (transaction)=>{
      const metaDataStore = transaction.objectStore('files');
      return this.wrapRequest(metaDataStore.delete(identifier));
    });
  }

  keepAlive() {
    if (this.db) {
      this.transact(this.db, 'metadata', 'readwrite', (transaction)=>{
        const metaDataStore = transaction.objectStore('metadata');
        metaDataStore.put(Date.now(), 'updated_time');
      });
    }
  }

  transact(db, storeName, mode, callback) {
    return new Promise(async (resolve, reject)=>{
      const transaction = db.transaction(storeName, mode);
      let result = Promise.resolve(null);
      transaction.onerror = (event) => {
        console.error(event);
        reject(event);
      };

      transaction.oncomplete = async (event) => {
        resolve(await result);
      };

      result = callback(transaction);
      transaction.commit();
    });
  }

  wrapRequest(request, timeout) {
    return new Promise((resolve, reject)=>{
      request.onerror = (event) => {
        console.error(event);
        reject(event);
      };
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      if (timeout) {
        setTimeout(()=>{
          reject(new Error('Timeout'));
        }, timeout);
      }
    });
  }
}

window.addEventListener('beforeunload', async ()=>{
  await Promise.all(closeQueue.map((manager)=>{
    return manager.close();
  }));
});
