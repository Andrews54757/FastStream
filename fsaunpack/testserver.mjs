// express
import express from 'express';
import fs from 'fs';

const fileDir = './output';
const port = 3000;

const app = express();

const header = JSON.parse(fs.readFileSync(`${fileDir}/header.json`));
const numberOfEntries = header.number_of_entries;

console.log(`Serving ${numberOfEntries} entries`);
for (let i = 0; i < numberOfEntries; i++) {
  const entryHeader = JSON.parse(fs.readFileSync(`${fileDir}/${i}.json`));
  const dataLocation = entryHeader.responseType !== 'arraybuffer' ? `${i}.txt` : `${i}.bin`;

  const entryURL = entryHeader.url;
  const entryURLPath = new URL(entryURL).pathname;
  console.log(entryURLPath);

  // GET
  app.get(entryURLPath, (req, res) => {
    // access control
    res.header('Access-Control-Allow-Origin', '*');
    res.sendFile(dataLocation, {
      root: fileDir,
    });
  });
}


app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
