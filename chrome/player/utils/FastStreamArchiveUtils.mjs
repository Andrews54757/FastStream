import {DownloadStatus} from '../enums/DownloadStatus.mjs';
import {DownloadEntry} from '../network/DownloadEntry.mjs';

export class FastStreamArchiveUtils {
  static async writeFSABlob(player, entries, progressCallback) {
    const finalParts = [];
    const sourceObj = {};
    if (player) {
      const source = player.getSource();
      sourceObj.url = source.url;
      sourceObj.identifier = source.identifier;
      sourceObj.mode = source.mode;
      sourceObj.headers = source.headers;
    }
    const header = new TextEncoder().encode(JSON.stringify({
      version: 1,
      number_of_entries: entries.length,
      source: player ? sourceObj : null,
      currentLevel: player?.currentLevel,
      currentAudioLevel: player?.currentAudioLevel,
    }));

    const headerPart = new ArrayBuffer(4 + header.byteLength);
    const headerView = new DataView(headerPart);
    headerView.setUint32(0, header.byteLength);
    for (let i = 0; i < header.byteLength; i++) {
      headerView.setUint8(i + 4, header[i]);
    }
    finalParts.push(headerPart);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.status !== DownloadStatus.DOWNLOAD_COMPLETE) {
        throw new Error('Entry is not complete!');
      }

      const entryHeader = new TextEncoder().encode(JSON.stringify({
        url: entry.url,
        rangeStart: entry.rangeStart,
        rangeEnd: entry.rangeEnd,
        responseType: entry.responseType,
        storeRaw: entry.storeRaw,

        responseURL: entry.responseURL,
        responseHeaders: entry.responseHeaders,
      }));

      let data = entry.getData();
      if (entry.storeRaw && typeof data === 'string') {
        data = (new TextEncoder().encode(data)).buffer;
      }
      const dataSize = entry.storeRaw ? data.byteLength : data.size;

      const entryHeaderPart = new ArrayBuffer(8 + entryHeader.byteLength);
      const entryHeaderView = new DataView(entryHeaderPart);
      entryHeaderView.setUint32(0, entryHeader.byteLength);
      for (let i = 0; i < entryHeader.byteLength; i++) {
        entryHeaderView.setUint8(i + 4, entryHeader[i]);
      }
      entryHeaderView.setUint32(4 + entryHeader.byteLength, dataSize);

      finalParts.push(entryHeaderPart);
      finalParts.push(data);

      if (progressCallback) {
        progressCallback(i / entries.length);
      }
    }

    return new Blob(finalParts, {
      type: 'application/octet-stream',
    });
  }

  static parseFSA(largeBuffer, progressCallback) {
    const entries = [];

    const headerSize = largeBuffer.uint32();
    const header = JSON.parse(new TextDecoder().decode(largeBuffer.read(headerSize)));

    for (let i = 0; i < header.number_of_entries; i++) {
      const entryHeaderSize = largeBuffer.uint32();
      const entryHeader = JSON.parse(new TextDecoder().decode(largeBuffer.read(entryHeaderSize)));
      const dataSize = largeBuffer.uint32();

      const entry = new DownloadEntry({
        url: entryHeader.url,
        rangeStart: entryHeader.rangeStart,
        rangeEnd: entryHeader.rangeEnd,
        responseType: entryHeader.responseType,
        storeRaw: entryHeader.storeRaw,
      });

      entry.status = DownloadStatus.DOWNLOAD_COMPLETE;
      entry.responseURL = entryHeader.responseURL;
      entry.responseHeaders = entryHeader.responseHeaders;

      if (entry.storeRaw) {
        entry.data = largeBuffer.read(dataSize);
        if (entry.responseType !== 'arraybuffer') {
          entry.data = new TextDecoder().decode(entry.data);
        }
      } else {
        const mimeType = entry.responseType === 'arraybuffer' ? 'application/octet-stream' : 'text/plain';
        entry.data = new Blob(largeBuffer.getViews(dataSize), {
          type: mimeType,
        });
      }

      entries.push(entry);
      if (progressCallback) {
        progressCallback(i / header.number_of_entries);
      }
    }

    return {
      source: header.source,
      currentLevel: header.currentLevel,
      currentAudioLevel: header.currentAudioLevel,
      entries,
    };
  }
}
