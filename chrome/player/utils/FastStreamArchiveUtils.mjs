import {DownloadStatus} from '../enums/DownloadStatus.mjs';
import {DownloadEntry} from '../network/DownloadEntry.mjs';
import {Utils} from './Utils.mjs';

export class FastStreamArchiveUtils {
  static async writeFSAToStream(filestream, player, entries, progressCallback) {
    const writer = filestream.getWriter();
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
      source: player ? sourceObj : null, // TODO: FIX
      currentLevel: player?.currentLevel,
      currentAudioLevel: player?.currentAudioLevel,
    }));

    const headerPart = new ArrayBuffer(4 + header.byteLength);
    const headerView = new DataView(headerPart);
    headerView.setUint32(0, header.byteLength);
    for (let i = 0; i < header.byteLength; i++) {
      headerView.setUint8(i + 4, header[i]);
    }

    await writer.write(new Uint8Array(headerPart));

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.status !== DownloadStatus.DOWNLOAD_COMPLETE) {
        throw new Error('Entry is not complete!');
      }

      let data = null;
      if (entry.storeRaw) {
        data = await entry.getData();
        if (typeof data === 'string') {
          data = (new TextEncoder().encode(data)).buffer;
        }
      } else {
        data = await entry.getDataFromBlob('arraybuffer');
      }

      const dataSize = data.byteLength;
      const newHeaders = {};
      const headersWhitelist = ['content-range'];
      for (const header in entry.responseHeaders) {
        if (!Object.hasOwn(entry.responseHeaders, header)) continue;
        if (headersWhitelist.includes(header.toLowerCase())) {
          newHeaders[header] = entry.responseHeaders[header];
        }
      }

      const entryHeader = new TextEncoder().encode(JSON.stringify({
        url: entry.url,
        rangeStart: entry.rangeStart,
        rangeEnd: entry.rangeEnd,
        responseType: entry.responseType,
        storeRaw: entry.storeRaw,
        stats: entry.stats,
        responseURL: entry.responseURL,
        responseHeaders: newHeaders,
        dataSize,
      }));

      const entryHeaderPart = new ArrayBuffer(4 + entryHeader.byteLength);
      const entryHeaderView = new DataView(entryHeaderPart);
      entryHeaderView.setUint32(0, entryHeader.byteLength);
      for (let i = 0; i < entryHeader.byteLength; i++) {
        entryHeaderView.setUint8(i + 4, entryHeader[i]);
      }

      await writer.write(new Uint8Array(entryHeaderPart));
      await writer.write(new Uint8Array(data));


      if (progressCallback) {
        progressCallback(i / entries.length);
      }
    }

    writer.close();
  }

  static async parseFSA(largeBuffer, progressCallback, downloadManager) {
    const entries = [];

    const headerSize = await largeBuffer.uint32();
    const header = JSON.parse(new TextDecoder().decode(await largeBuffer.read(headerSize)));

    for (let i = 0; i < header.number_of_entries; i++) {
      const entryHeaderSize = await largeBuffer.uint32();
      const entryHeader = JSON.parse(new TextDecoder().decode(await largeBuffer.read(entryHeaderSize)));
      const dataSize = entryHeader.dataSize;

      const entry = new DownloadEntry({
        url: entryHeader.url,
        rangeStart: entryHeader.rangeStart,
        rangeEnd: entryHeader.rangeEnd,
        responseType: entryHeader.responseType,
        storeRaw: entryHeader.storeRaw,
      });

      entry.stats = entryHeader.stats;
      entry.status = DownloadStatus.DOWNLOAD_COMPLETE;
      entry.responseURL = entryHeader.responseURL;
      entry.responseHeaders = entryHeader.responseHeaders;

      if (entry.storeRaw) {
        entry.data = await largeBuffer.read(dataSize);
        if (entry.responseType !== 'arraybuffer') {
          entry.data = new TextDecoder().decode(entry.data);
        }
      } else {
        const mimeType = entry.responseType === 'arraybuffer' ? 'application/octet-stream' : 'text/plain';
        entry.data = new Blob(await largeBuffer.getParts(dataSize), {
          type: mimeType,
        });
      }

      entry.dataSize = Utils.getDataByteSize(entry.data);

      if (downloadManager) {
        downloadManager.archiveEntryData(entry);
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
