
export class HLSDecrypter {
    constructor() {
        this.setupEncryptionWorker();
        this.lastId = 0;
    }
    async decryptAES(data, iv, key) {

        let id = this.lastId++;
        return new Promise((resolve, reject) => {
            this.encryptionWorkerCallbacks.set(id, (data, idn) => {
                resolve(data);
            });
            this.encryptionWorker.postMessage({
                encrypted: data,
                iv: iv,
                key: key,
                id: id
            }, [data]);

        })

    }

    destroy() {
        this.encryptionWorker.terminate();
    }

    setupEncryptionWorker() {

        if (this.encryptionWorker) this.encryptionWorker.terminate();
        this.encryptionWorker = new Worker("modules/decrypter-worker.js");
        this.encryptionWorker.addEventListener('message', (event) => {
            let data = event.data;
            this.encryptionWorkerCallbacks.get(data.id)(data.decrypted);
            this.encryptionWorkerCallbacks.delete(data.id);

        });

        this.encryptionWorkerCallbacks = new Map();

    }
}