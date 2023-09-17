import {glob} from './miniglob.mjs';
import fs from 'fs';
import path from 'path';
import * as url from 'url';
import webExt from 'web-ext';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const builtDir = path.resolve(__dirname, 'built');
const chromeSourceDir = path.resolve(__dirname, 'chrome');
const chromeBuildDir = path.resolve(__dirname, 'build_chrome_dist');
const firefoxBuildDir = path.resolve(__dirname, 'build_firefox_libre');
const licenseText = fs.readFileSync(path.resolve(__dirname, 'LICENSE.md'), 'utf8');

fs.mkdirSync(builtDir, {recursive: true});
glob(builtDir + '/*.zip').forEach((file) => {
  fs.unlinkSync(file);
});

removeBuildDirs();

function removeBuildDirs() {
  deleteDirectoryRecursively(chromeBuildDir);
  deleteDirectoryRecursively(firefoxBuildDir);
}

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

function extractImports(fileText) {
  const lines = fileText.split('\n');
  const newLines = [];
  const imports = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('import')) {
      const match = line.match(/import\s+\{{0,1}(.*?)\}{0,1}\s+(?:as\s+(.*)\s+){0,1}from\s+'(.*)'/);

      if (!match) {
        throw new Error('Invalid import: ' + line);
      }

      const importName = match[1];
      const importAs = match[3] ? match[2] : null;
      const importFrom = match[3] || match[2];

      imports.push({
        name: importName,
        as: importAs,
        from: importFrom,
      });
    } else {
      newLines.push(line);
    }
  }

  return {
    imports: imports,
    fileText: newLines.join('\n'),
  };
}

function extractExports(fileText) {
  const lines = fileText.split('\n');
  const newLines = [];
  const exports = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('export')) {
      const match = line.match(/export\s+(?:default\s+){0,1}(const|let|var|class|function)\s+([^= ]*)/);
      if (!match) {
        throw new Error('Invalid export: ' + line);
      }

      const exportType = match[1];
      const exportName = match[2];

      exports.push({
        type: exportType,
        name: exportName,
      });

      newLines.push(line.replace('export', '').trim());
      continue;
    }

    newLines.push(line);
  }
  return {
    exports: exports,
    fileText: newLines.join('\n'),
  };
}

function generateScriptWithAllImports(sourceDir, filePath, resolvedPaths = []) {
  const text = extractExports(fs.readFileSync(filePath, 'utf8')).fileText;
  const {imports, fileText} = extractImports(text);

  const importScripts = [];
  imports.forEach((importData) => {
    const importPath = path.resolve(path.dirname(filePath), importData.from);
    if (resolvedPaths.includes(importPath)) {
      return;
    }

    resolvedPaths.push(importPath);
    const importScript = generateScriptWithAllImports(sourceDir, importPath, resolvedPaths);
    importScripts.push(importScript.trim());
  });

  return importScripts.join('\n') + '\n' + fileText;
}

function splice(fileText, target, relativePath) {
  const lines = fileText.split('\n');
  let newLines = [];
  let inSplicerRemove = false;
  let removedLines = 0;

  const initiatorStr = `SPLICER:${target}:`;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const index = line.indexOf(initiatorStr);
    if (index >= 0) {
      const command = line.substring(index + initiatorStr.length).trim();
      if (command === 'REMOVE_FILE') {
        console.log(`[Splicer-${target}] Removing file`, relativePath);
        return '';
      } else if (command === 'REMOVE_LINE') {
        console.log(`[Splicer-${target}] Removing line ${i + 1}`, relativePath);
        continue;
      } else if (command === 'REMOVE_START') {
        inSplicerRemove = true;
        removedLines = 0;
        continue;
      } else if (command === 'REMOVE_END') {
        if (!inSplicerRemove) {
          console.error(`[Splicer-${target}] Unmatched SPLICER:${target}:REMOVE_END`, relativePath);
          throw new Error('Unmatched SPLICER');
        }
        inSplicerRemove = false;
        console.log(`[Splicer-${target}] Removing lines ${i - removedLines}-${i + 1}`, relativePath);
        continue;
      }
    }

    if (inSplicerRemove) {
      removedLines++;
      continue;
    }

    newLines.push(line);
  }

  if (inSplicerRemove) {
    console.error(`[Splicer-${target}] Unmatched SPLICER:${target}:REMOVE_START`, relativePath);
    throw new Error('Unmatched SPLICER');
  }

  newLines = newLines.filter((line) => {
    return line.trim().length;
  });

  return newLines.join('\n');
}

function spliceAndCopy(sourceDir, buildDir, spliceTargets = []) {
  glob(sourceDir + '/**')
      .forEach((file) => {
        const fileExtension = path.extname(file);
        const relativePath = path.relative(sourceDir, file);
        const targetPath = path.resolve(buildDir, relativePath);
        const fileText = fs.readFileSync(file, 'utf8');

        if (fileExtension === '.mjs' || fileExtension === '.js') {
          let spliced = fileText;

          spliceTargets.forEach((target) => {
            spliced = splice(spliced, target, relativePath);
          });

          if (spliced.length) {
            fs.mkdirSync(path.dirname(targetPath), {recursive: true});
            fs.writeFileSync(targetPath, spliced + '\n');
          }
        } else {
          fs.mkdirSync(path.dirname(targetPath), {recursive: true});
          fs.copyFileSync(file, targetPath);
        }
      });
}

async function runWebExtBuild(sourceDir, artifactsDir) {
  return new Promise((resolve, reject) => {
    // run web-ext build
    webExt.cmd.build({
      sourceDir: sourceDir,
      artifactsDir: artifactsDir,
      overwriteDest: true,
    }).then((result) => {
      resolve(result.extensionPath);
    });
  });
}

function insertLicense(buildDir) {
  const newLicensePath = path.join(buildDir, 'LICENSE.md');
  fs.writeFileSync(newLicensePath, licenseText);
}

async function buildChromeDist() {
  spliceAndCopy(chromeSourceDir, chromeBuildDir, ['CENSORYT']);
  insertLicense(chromeBuildDir);
  const builtPath = await runWebExtBuild(chromeBuildDir, path.join(chromeBuildDir, 'dist'));
  const name = path.basename(builtPath);
  const finalPath = path.join(builtDir, 'chrome-dist-' + name);
  fs.renameSync(builtPath, finalPath);
  return finalPath;
}

async function buildChromeLibre() {
  insertLicense(chromeSourceDir);
  const builtPath = await runWebExtBuild(chromeSourceDir, path.join(chromeBuildDir, 'libre'));

  fs.unlinkSync(path.join(chromeSourceDir, 'LICENSE.md'));

  const name = path.basename(builtPath);
  const finalPath = path.join(builtDir, 'chrome-libre-' + name);
  fs.renameSync(builtPath, finalPath);
  return finalPath;
}


async function buildFirefoxLibre() {
  spliceAndCopy(chromeSourceDir, firefoxBuildDir, ['FIREFOX']);
  insertLicense(firefoxBuildDir);
  const backgroundScriptPath = path.join(firefoxBuildDir, 'background.mjs');
  const newBacgroundScriptPath = path.join(firefoxBuildDir, 'background.js');
  const builtBackground = generateScriptWithAllImports(firefoxBuildDir, backgroundScriptPath);
  fs.writeFileSync(newBacgroundScriptPath, builtBackground);
  fs.unlinkSync(backgroundScriptPath);

  const manifestPath = path.join(firefoxBuildDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  manifest.browser_specific_settings = {
    gecko: {
      id: 'faststream@andrews',
      strict_min_version: '109.0',
    },
  };

  manifest.background = {
    scripts: ['background.js'],
  };

  delete manifest.incognito;

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const builtPath = await runWebExtBuild(firefoxBuildDir, path.join(firefoxBuildDir, 'libre'));
  const name = path.basename(builtPath);
  const finalPath = path.join(builtDir, 'firefox-libre-' + name);
  fs.renameSync(builtPath, finalPath);
  return finalPath;
}

async function runAll() {
  await Promise.all([buildChromeLibre(), buildChromeDist(), buildFirefoxLibre()]);
  removeBuildDirs();
}

runAll();
