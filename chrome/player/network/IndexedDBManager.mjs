export class IndexedDBManager {
  constructor() {
    setInterval(()=>{
      this.keepAlive();
    }, 1000);
  }

  async setup() {
    await this.close();
    this.prune();

    this.dbName = 'faststream-temp-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
    this.db = await this.requestDB(this.dbName);
    const transaction = this.db.transaction('metadata', 'readwrite');
    const metaDataStore = transaction.objectStore('metadata');
    metaDataStore.put(Date.now(), 'creation_time');
    metaDataStore.put(Date.now(), 'updated_time');
    transaction.commit();
  }

  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;

      await this.deleteDB(this.dbName);
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
          if (Date.now() - updatedTime > 5000) {
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
    request.onupgradeneeded = function(event) {
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
    await this.wrapRequest(window.indexedDB.deleteDatabase(dbName), 5000);
    if (!window.indexedDB.databases) {
      const databases = await this.getDatabases();
      localStorage.setItem('fs_temp_databases', JSON.stringify(databases.filter((name)=>name !== dbName)));
    }
  }

  async getValue(db, storeName, key) {
    return this.transact(storeName, 'readonly', (transaction)=>{
      const metaDataStore = transaction.objectStore(storeName);
      return this.wrapRequest(metaDataStore.get(key));
    });
  }

  async clearStorage() {
    return this.transact('files', 'readwrite', (transaction)=>{
      const metaDataStore = transaction.objectStore('files');
      return this.wrapRequest(metaDataStore.clear());
    });
  }

  async getFile(identifier) {
    return this.getValue(this.db, 'files', identifier);
  }

  async setFile(identifier, data) {
    return this.transact('files', 'readwrite', (transaction)=>{
      const metaDataStore = transaction.objectStore('files');
      return this.wrapRequest(metaDataStore.put(data, identifier));
    });
  }

  async deleteFile(identifier) {
    return this.transact('files', 'readwrite', (transaction)=>{
      const metaDataStore = transaction.objectStore('files');
      return this.wrapRequest(metaDataStore.delete(identifier));
    });
  }

  keepAlive() {
    if (this.db) {
      this.transact('metadata', 'readwrite', (transaction)=>{
        const metaDataStore = transaction.objectStore('metadata');
        metaDataStore.put(Date.now(), 'updated_time');
      });
    }
  }

  transact(storeName, mode, callback) {
    return new Promise(async (resolve, reject)=>{
      const transaction = this.db.transaction(storeName, mode);
      let result = Promise.resolve(null);
      transaction.onerror = (event) => {
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
