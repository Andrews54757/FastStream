export class BlobManager {
  constructor(schema) {
    this.blobUrlStore = {};

    for (const name in schema) {
      this.blobUrlStore[name] = {
        limit: schema[name].limit || -1,
        urls: [],
      };
    }
  }
  /**
     * Creates a blob.
     * @param {array} data
     * @param {string} mimeType
     * @return {Blob}
     */
  static createBlob(data, mimeType) {
    return new Blob(data, {type: mimeType});
  }

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

  revokeBlobURL(blobURL) {
    URL.revokeObjectURL(blobURL);
  }

  revokeAllBlobURLs() {
    for (const name in this.blobUrlStore) {
      this.revokeBlobURLS(name);
    }
  }

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
