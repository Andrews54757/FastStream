import {glob} from './miniglob.mjs';
import fs from 'fs';
import path from 'path';
import * as url from 'url';
import webExt from 'web-ext';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));


function deleteDirectoryRecursively(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file, index) => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteDirectoryRecursively(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}


const sourceDir = path.resolve(__dirname, 'chrome');
const buildDir = path.resolve(__dirname, 'build');
deleteDirectoryRecursively(buildDir);

const ignoreList = ['.DS_Store'];
glob(sourceDir + '/**')
    .forEach((file) => {
      if (ignoreList.includes(path.basename(file))) {
        return;
      }
      const fileExtension = path.extname(file);
      const relativePath = path.relative(sourceDir, file);
      const targetPath = path.resolve(buildDir, relativePath);
      const fileText = fs.readFileSync(file, 'utf8');

      if (fileExtension === '.mjs' || fileExtension === '.js') {
        if (fileText.includes('// SPLICER:REMOVE_FILE')) {
          console.log('[Splicer] Removing file', relativePath);
          return;
        }

        fs.mkdirSync(path.dirname(targetPath), {recursive: true});

        const lines = fileText.split('\n');
        let newLines = [];
        let inSplicerRemove = false;
        let removedLines = 0;

        for (const line of lines) {
          if (line.includes('// SPLICER:REMOVE_START')) {
            inSplicerRemove = true;
            removedLines = 0;
          } else if (line.includes('// SPLICER:REMOVE_END')) {
            inSplicerRemove = false;
            console.log(`[Splicer] Removing ${removedLines} lines`, relativePath);
          } else if (!inSplicerRemove) {
            newLines.push(line);
          } else {
            removedLines++;
          }
        }

        if (inSplicerRemove) {
          console.error('[Splicer] Unmatched SPLICER:REMOVE_START', relativePath);
        }

        newLines = newLines.filter((line) => {
          if (line.trim().length === 0) {
            return false;
          }

          if (line.includes('// SPLICER:REMOVE_LINE')) {
            console.log('[Splicer] Removing line', line);
            return false;
          }

          return true;
        });

        newLines.push('');

        fs.writeFileSync(targetPath, newLines.join('\n'));
      } else {
        fs.mkdirSync(path.dirname(targetPath), {recursive: true});
        fs.copyFileSync(file, targetPath);
      }
    });

// run web-ext build
webExt.cmd.build({
  sourceDir: buildDir,
  artifactsDir: path.resolve(__dirname, 'dist'),
  overwriteDest: true,
}).then((result) => {
  console.log('Build successful', result.extensionPath);
  deleteDirectoryRecursively(buildDir);
});
