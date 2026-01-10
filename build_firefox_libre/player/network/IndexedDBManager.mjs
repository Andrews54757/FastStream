const closeQueue = [];
export class IndexedDBManager {
  constructor(persistentName) {
    this.persistentName = persistentName || null;
  }
  static isSupported() {
    return window.indexedDB !== undefined;
  }
  static async isSupportedAndAvailable() {
    if (!IndexedDBManager.isSupported()) return false;
    try {
      const db = await IndexedDBManager.requestDB('faststream-temp-test', true);
      db.close();
      await IndexedDBManager.deleteDB('faststream-temp-test');
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
  isPersistent() {
    return this.persistentName !== null;
  }
  async setup() {
    await this.close();
    if (!this.isPersistent()) {
      this.prune();
      this.aliveInterval = setInterval(()=>{
        this.keepAlive();
      }, 1000);
      this.dbName = 'faststream-temp-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
    } else {
      this.dbName = this.persistentName;
    }
    this.db = await IndexedDBManager.requestDB(this.dbName, true);
    closeQueue.push(this);
    return IndexedDBManager.transact(this.db, 'metadata', 'readwrite', (transaction)=>{
      const metaDataStore = transaction.objectStore('metadata');
      metaDataStore.put(Date.now(), 'creation_time');
      if (!this.isPersistent()) {
        metaDataStore.put(Date.now(), 'updated_time');
      }
    });
  }
  async close() {
    clearInterval(this.aliveInterval);
    if (this.db) {
      this.db.close();
      this.db = null;
      if (!this.isPersistent()) {
        await IndexedDBManager.deleteDB(this.dbName);
      }
      const index = closeQueue.indexOf(this);
      if (index !== -1) {
        closeQueue.splice(index, 1);
      }
    }
  }
  static async getDatabases() {
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
    const databases = await IndexedDBManager.getDatabases();
    // Double check because of Firefox bug
    if (!window.indexedDB.databases) {
      const previouslyDeleted = JSON.parse(localStorage.getItem('fs_temp_databases_deleted') || '[]');
      await Promise.all(previouslyDeleted.map(async (database)=>{
        try {
          await IndexedDBManager.deleteDB(database);
        } catch (e) {
          console.error(e);
        }
      }));
      localStorage.setItem('fs_temp_databases_deleted', '[]');
    }
    return Promise.all(databases.map(async (database)=>{
      if (database.name.startsWith('faststream-temp-')) {
        try {
          const db = await IndexedDBManager.requestDB(database.name, false);
          // check if stale
          try {
            const updatedTime = await IndexedDBManager.getValue(db, 'metadata', 'updated_time');
            if (!updatedTime || Date.now() - updatedTime > 10000) {
              throw new Error('Stale');
            }
          } catch (e) {
            db.close();
            await IndexedDBManager.deleteDB(database.name);
            console.log('Pruned', database.name);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }));
  }
  static async requestDB(dbName, open = false) {
    const request = window.indexedDB.open(dbName, 3);
    if (open) {
      request.onupgradeneeded = async (event) => {
        const db = event.target.result;
        db.createObjectStore('metadata');
        db.createObjectStore('files');
        if (!window.indexedDB.databases) {
          const databases = JSON.parse(localStorage.getItem('fs_temp_databases') || '[]');
          if (!databases.includes(dbName)) databases.push(dbName);
          localStorage.setItem('fs_temp_databases', JSON.stringify(databases));
        }
      };
    }
    return IndexedDBManager.wrapRequest(request, 5000);
  }
  static async deleteDB(dbName) {
    try {
      await IndexedDBManager.wrapRequest(window.indexedDB.deleteDatabase(dbName), 5000);
      if (!window.indexedDB.databases) {
        const deleted = JSON.parse(localStorage.getItem('fs_temp_databases_deleted') || '[]');
        if (!deleted.includes(dbName)) deleted.push(dbName);
        localStorage.setItem('fs_temp_databases_deleted', JSON.stringify(deleted));
        const databases = JSON.parse(localStorage.getItem('fs_temp_databases') || '[]');
        localStorage.setItem('fs_temp_databases', JSON.stringify(databases.filter((name)=>name !== dbName)));
      }
    } catch (e) {
      console.error(e);
    }
  }
  static async getValue(db, storeName, key) {
    return IndexedDBManager.transact(db, storeName, 'readonly', (transaction)=>{
      const metaDataStore = transaction.objectStore(storeName);
      return IndexedDBManager.wrapRequest(metaDataStore.get(key));
    });
  }
  static async setValue(db, storeName, key, value) {
    return IndexedDBManager.transact(db, storeName, 'readwrite', (transaction)=>{
      const metaDataStore = transaction.objectStore(storeName);
      return IndexedDBManager.wrapRequest(metaDataStore.put(value, key));
    });
  }
  async clearStorage() {
    if (!this.db) return;
    return IndexedDBManager.transact(this.db, 'files', 'readwrite', (transaction)=>{
      const metaDataStore = transaction.objectStore('files');
      return IndexedDBManager.wrapRequest(metaDataStore.clear());
    });
  }
  async getFile(identifier) {
    return IndexedDBManager.getValue(this.db, 'files', identifier);
  }
  async setFile(identifier, data) {
    return IndexedDBManager.transact(this.db, 'files', 'readwrite', (transaction)=>{
      const fileStore = transaction.objectStore('files');
      return IndexedDBManager.wrapRequest(fileStore.put(data, identifier));
    });
  }
  async deleteFile(identifier) {
    return IndexedDBManager.transact(this.db, 'files', 'readwrite', (transaction)=>{
      const fileStore = transaction.objectStore('files');
      return IndexedDBManager.wrapRequest(fileStore.delete(identifier));
    });
  }
  getDatabase() {
    return this.db;
  }
  keepAlive() {
    if (this.db && !this.isPersistent()) {
      IndexedDBManager.setValue(this.db, 'metadata', 'updated_time', Date.now());
    }
  }
  static transact(db, storeName, mode, callback) {
    return new Promise(async (resolve, reject)=>{
      let transaction;
      try {
        transaction = db.transaction(storeName, mode);
      } catch (e) {
        reject(e);
        return;
      }
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
  static wrapRequest(request, timeout) {
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
