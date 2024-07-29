import fs from 'fs';

const inputFile = process.argv[2];
// output in /output/ by default
const outputDir = process.argv[3] || 'output';


// check if input file exists
if (!fs.existsSync(inputFile)) {
  console.error('Input file does not exist');
  process.exit(1);
}

// check if output directory exists
if (!fs.existsSync(outputDir)) {
  // create output directory
  fs.mkdirSync(outputDir);
}

console.log(`Unpacking ${inputFile} to ${outputDir}...`);

// read input file
const inputBuffer = fs.readFileSync(inputFile);

// read header
const headerSize = inputBuffer.readUInt32BE(0);
const header = JSON.parse(inputBuffer.subarray(4, headerSize + 4).toString());

// write header to file
fs.writeFileSync(`${outputDir}/header.json`, JSON.stringify(header, null, 2));

console.log(`Header: ${headerSize} bytes, ${header.number_of_entries} entries`);

let index = headerSize + 4;

// read entries
for (let i = 0; i < header.number_of_entries; i++) {
  const entryHeaderSize = inputBuffer.readUInt32BE(index);
  index += 4;
  const entryHeader = JSON.parse(inputBuffer.subarray(index, index + entryHeaderSize).toString());
  index += entryHeaderSize;
  const dataSize = entryHeader.dataSize;
  const data = inputBuffer.subarray(index, index + dataSize);
  index += dataSize;

  fs.writeFileSync(`${outputDir}/${i}.json`, JSON.stringify(entryHeader, null, 2));
  if (entryHeader.responseType !== 'arraybuffer') {
    // write data to file
    fs.writeFileSync(`${outputDir}/${i}.txt`, data.toString());
  } else {
    // write data to file
    fs.writeFileSync(`${outputDir}/${i}.bin`, data);
  }

  let urlTrun = entryHeader.url;
  if (urlTrun.length > 30) {
    urlTrun = urlTrun.substring(0, 30) + '...';
  }

  console.log(`Entry ${i}: Size: ${dataSize}, URL: ${urlTrun}`);
}

// read entries

/*

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
  */
