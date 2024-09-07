import fs from 'fs';
import path from 'path';
import * as url from 'url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const chromeSourceDir = path.resolve(__dirname, 'chrome');
const localesPath = path.join(chromeSourceDir, '_locales/');
const combinedLocalesFile = path.join(__dirname, 'combined-locales.json');
const defaultLanguage = 'en';

function getLocalesFromMultiPath() {
  const locales = new Map();
  const localesFolders = fs.readdirSync(localesPath);

  for (const localeFolder of localesFolders) {
    const messagesPath = path.join(localesPath, localeFolder, 'messages.json');
    // check if file exists
    if (!fs.existsSync(messagesPath)) {
      continue;
    }

    const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
    const translationMap = new Map();
    Object.keys(messages).forEach((key) => {
      translationMap.set(key, messages[key]);
    });
    locales.set(localeFolder, translationMap);
  }
  return locales;
}

function getLocalesFromCombinedFile() {
  if (!fs.existsSync(combinedLocalesFile)) {
    return;
  }

  const locales = new Map();
  const messages = JSON.parse(fs.readFileSync(combinedLocalesFile, 'utf8'));
  Object.entries(messages).forEach(([translationKey, values]) => {
    Object.entries(values).forEach(([locale, translation]) => {
      if (locale.endsWith('_description')) {
        return;
      }

      if (!locales.has(locale)) {
        locales.set(locale, new Map());
      }

      const obj = {
        message: translation,
      };

      if (Object.hasOwn(values, `${locale}_description`)) {
        obj.description = values[`${locale}_description`];
      } else if (locale === defaultLanguage && Object.hasOwn(values, 'description')) {
        obj.description = values.description;
      }

      locales.get(locale).set(translationKey, obj);
    });
  });

  return locales;
}

function saveLocalesToMultiPath(locales) {
  for (const [locale, translations] of locales.entries()) {
    const messagesPath = path.join(localesPath, locale, 'messages.json');
    const messages = {};
    for (const [key, value] of translations.entries()) {
      messages[key] = value;
    }
    fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 4));
  }
}

function saveLocalesToCombinedFile(locales) {
  const messages = {};
  for (const [locale, translations] of locales.entries()) {
    for (const [key, value] of translations.entries()) {
      if (!Object.hasOwn(messages, key)) {
        messages[key] = {};
      }
      messages[key][locale] = value.message;
      if (Object.hasOwn(value, 'description')) {
        if (locale === defaultLanguage) {
          messages[key].description = value.description;
        } else {
          messages[key][`${locale}_description`] = value.description;
        }
      }
    }
  }
  fs.writeFileSync(combinedLocalesFile, JSON.stringify(messages, null, 4));
}

function checkLocaleKeys(locales) {
  const defaultLocale = locales.get(defaultLanguage);
  const defaultLocaleKeys = new Set(defaultLocale.keys());
  for (const [locale, translations] of locales.entries()) {
    if (locale === defaultLanguage) {
      continue;
    }
    const localeKeys = new Set(translations.keys());
    const missingKeys = defaultLocaleKeys.difference(localeKeys);
    if (missingKeys.size > 0) {
      console.log(`Missing keys in ${locale}:`, Array.from(missingKeys));
    }

    const extraKeys = localeKeys.difference(defaultLocaleKeys);
    if (extraKeys.size > 0) {
      console.log(`Extra keys in ${locale}:`, Array.from(extraKeys));
    }
  }
}

// Get arguments
const args = process.argv.slice(2);
let convertToMultiPath = true;
if (args.length > 0) {
  if (args[0] === '--combined') {
    convertToMultiPath = false;
  } else {
    console.log('Invalid argument:', args[0]);
    process.exit(1);
  }
}

console.log('Converting to', convertToMultiPath ? 'multi-path' : 'combined file');

const locales = convertToMultiPath ? getLocalesFromCombinedFile() : getLocalesFromMultiPath();

console.log('Loaded locales: ', Array.from(locales.keys()));

checkLocaleKeys(locales);

if (convertToMultiPath) {
  saveLocalesToMultiPath(locales);
} else {
  saveLocalesToCombinedFile(locales);
}

console.log('Done');

