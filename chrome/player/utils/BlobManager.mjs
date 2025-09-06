/**
 * Manages blobs and blob URLs for different schemas.
 */
export class BlobManager {
  /**
   * Constructs a BlobManager instance.
   * @param {Object} schema - Schema definition for blob storage.
   */
  constructor(schema) {
    this.blobUrlStore = {};

    for (const name in schema) {
      if (Object.hasOwn(schema, name)) {
        this.blobUrlStore[name] = {
          limit: schema[name].limit || -1,
          urls: [],
        };
      }
    }
  }
  /**
   * Creates a blob from data and MIME type.
   * @param {Array} data - The data to store in the blob.
   * @param {string} mimeType - The MIME type of the blob.
   * @return {Blob} The created blob.
   */
  static createBlob(data, mimeType) {
    return new Blob(data, {type: mimeType});
  }

  /**
   * Reads data from a blob as text or arraybuffer.
   * @param {Blob} blob - The blob to read from.
   * @param {string} type - The type of data to read ('arraybuffer' or 'text').
   * @return {Promise<ArrayBuffer|string>} The data from the blob.
   */
  static async getDataFromBlob(blob, type) {
    const reader = new FileReader();

    if (type === 'arraybuffer') {
      reader.readAsArrayBuffer(blob);
    } else {
      reader.readAsText(blob);
    }

    return new Promise((resolve, reject) => {
      reader.onload = () => {
        resolve(reader.result);
      };

      reader.onerror = () => {
        reject(reader.error);
      };
    });
  }

  /**
   * Creates a blob URL for a given blob and stores it under a name.
   * @param {string} name - The name for the blob URL.
   * @param {Blob} blob - The blob to create a URL for.
   * @return {string} The created blob URL.
   */
  createBlobURL(name, blob) {
    if (!this.blobUrlStore[name]) {
      throw new Error('BlobManager: ' + name + ' is not defined in schema');
    }
    const url = URL.createObjectURL(blob);
    if (this.blobUrlStore[name].limit > 0) {
      if (this.blobUrlStore[name].urls.length + 1 > this.blobUrlStore[name].limit) {
        this.revokeOneBlobURL(name);
      }
    }

    this.blobUrlStore[name].urls.push(url);

    return url;
  }

  /**
   * Revokes a previously created blob URL.
   * @param {string} blobURL - The blob URL to revoke.
   */
  revokeBlobURL(blobURL) {
    URL.revokeObjectURL(blobURL);
  }

  /**
   * Revokes all blob URLs stored in the manager.
   */
  revokeAllBlobURLs() {
    for (const name in this.blobUrlStore) {
      if (Object.hasOwn(this.blobUrlStore, name)) {
        this.revokeBlobURLS(name);
      }
    }
  }

  /**
   * Revokes all blob URLs stored under a given name.
   * @param {string} name - The name to revoke URLs for.
   */
  revokeBlobURLS(name) {
    for (const url of this.blobUrlStore[name].urls) {
      URL.revokeObjectURL(url);
    }
    this.blobUrlStore[name].urls.length = 0;
  }
  revokeOneBlobURL(name) {
    const url = this.blobUrlStore[name].urls.shift();
    URL.revokeObjectURL(url);
    return url;
  }

  getBlobURLs(name) {
    return this.blobUrlStore[name].urls;
  }
}
