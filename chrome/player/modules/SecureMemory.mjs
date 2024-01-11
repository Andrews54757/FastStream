import {IndexedDBManager} from '../network/IndexedDBManager.mjs';

export class SecureMemory {
  constructor(dbName) {
    this.indexedDbManager = new IndexedDBManager(dbName);
  }

  static isSupported() {
    if (!IndexedDBManager.isSupported()) {
      return false;
    }

    if (!window.crypto || !window.crypto.subtle) {
      return false;
    }

    return true;
  }

  static async hash(message, salt) {
    // use pbkdf2 to hash the message
    const encoder = new TextEncoder('utf-8');
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(message),
        {name: 'PBKDF2'},
        false,
        ['deriveBits', 'deriveKey'],
    );

    const params = {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(salt),
      iterations: 600000,
    };

    const derivedKey = await crypto.subtle.deriveKey(
        params,
        key,
        {name: 'AES-GCM', length: 256},
        true,
        ['encrypt'],
    );

    return await crypto.subtle.exportKey('raw', derivedKey);
  }

  static async encrypt(key, value) {
    const keyBuffer = await crypto.subtle.importKey(
        'raw',
        key,
        {name: 'AES-GCM'},
        false,
        ['encrypt'],
    );

    const iv = await SecureMemory.randomBuffer(12);
    const encoder = new TextEncoder('utf-8');
    const encrypted = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv},
        keyBuffer,
        encoder.encode(value),
    );

    const encryptedArray = new Uint8Array(encrypted);
    const ivArray = new Uint8Array(iv);
    const result = new Uint8Array(ivArray.length + encryptedArray.length);
    result.set(ivArray);
    result.set(encryptedArray, ivArray.length);
    return result;
  }

  static async decrypt(key, value) {
    const keyBuffer = await crypto.subtle.importKey(
        'raw',
        key,
        {name: 'AES-GCM'},
        false,
        ['decrypt'],
    );

    const decoder = new TextDecoder('utf-8');
    const iv = value.slice(0, 12);
    const encrypted = value.slice(12);
    const decrypted = await crypto.subtle.decrypt(
        {name: 'AES-GCM', iv},
        keyBuffer,
        encrypted,
    );
    return decoder.decode(decrypted);
  }

  static async randomBuffer(length) {
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    return randomValues;
  }

  async getSalt(name) {
    const db = this.indexedDbManager.getDatabase();
    const salt = await IndexedDBManager.getValue(db, 'metadata', name);
    if (salt) {
      return salt;
    } else {
      const newSalt = await SecureMemory.randomBuffer(128);
      await IndexedDBManager.setValue(db, 'metadata', name, newSalt);
      return newSalt;
    }
  }

  async setup() {
    await this.indexedDbManager.setup();
    this.identifierSalt = await this.getSalt('identifier_salt');
    this.keySalt = await this.getSalt('key_salt');
  }

  async getHashes(identifier) {
    const identifierHash = await SecureMemory.hash(identifier, this.identifierSalt);
    const keyHash= await SecureMemory.hash(identifier, this.keySalt);
    return {identifierHash, keyHash};
  }

  async setFile(hashes, data) {
    const {identifierHash, keyHash} = hashes;
    const encryptedData = await SecureMemory.encrypt(keyHash, JSON.stringify(data));
    return this.indexedDbManager.setFile(identifierHash, {
      encryptedData,
      time: Date.now(),
    });
  }

  async getFile(hashes) {
    const {identifierHash, keyHash} = hashes;
    const data = await this.indexedDbManager.getFile(identifierHash);
    if (!data) {
      return null;
    }

    const {encryptedData} = data;
    if (encryptedData) {
      const data = await SecureMemory.decrypt(keyHash, encryptedData);
      return JSON.parse(data);
    }
  }

  async pruneOld(cutoff) {
    const db = this.indexedDbManager.getDatabase();

    const transaction = db.transaction(['files'], 'readwrite');
    const store = transaction.objectStore('files');
    const request = store.openCursor();
    return new Promise((resolve, reject)=>{
      request.onsuccess = async (event)=>{
        const cursor = event.target.result;
        if (cursor) {
          const {time} = cursor.value;
          if (time < cutoff) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          transaction.commit();
          resolve();
        }
      };

      request.onerror = (event)=>{
        transaction.abort();
        reject(event);
      };
    });
  }

  destroy() {
    this.indexedDbManager.close();
    this.indexedDbManager = null;
  }
}
