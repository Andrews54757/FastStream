import fs from 'fs';
import path from 'path';
import * as url from 'url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const chromeSourceDir = path.resolve(__dirname, 'chrome');
const localesPath = path.join(chromeSourceDir, '_locales/');
const combinedLocalesFile = path.join(__dirname, 'combined-locales.json');
const defaultLanguage = 'en';

function sortLocales(locales) {
  const sortedLocales = new Map();
  // Set english as the first locale
  if (locales.has(defaultLanguage)) {
    sortedLocales.set(defaultLanguage, locales.get(defaultLanguage));
  }

  Array.from(locales.keys()).sort().forEach((key) => {
    if (key === defaultLanguage) {
      return;
    }
    sortedLocales.set(key, locales.get(key));
  });
  return sortedLocales;
}

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
  return sortLocales(locales);
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

  return sortLocales(locales);
}

function saveLocalesToMultiPath(locales, whiteList) {
  for (const [locale, translations] of locales.entries()) {
    if (whiteList && !whiteList.includes(locale)) {
      continue;
    }
    const messagesPath = path.join(localesPath, locale, 'messages.json');
    const messages = {};
    for (const [key, value] of translations.entries()) {
      messages[key] = value;
    }
    fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 4));
  }
}

function saveLocalesToCombinedFile(locales, whiteList) {
  const messages = {};
  for (const [locale, translations] of locales.entries()) {
    if (whiteList && !whiteList.includes(locale)) {
      continue;
    }
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
let combine = false;
let split = false;
let whiteList = null;
if (args.length > 0) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--whitelist') {
      whiteList = args[i + 1].split(',');
      i++;
    } else if (args[i] === '--split') {
      split = true;
    } else if (args[i] === '--combine') {
      combine = true;
    } else {
      console.log('Invalid argument:', args[i]);
      process.exit(1);
    }
  }
}

if (combine && split) {
  console.log('Cannot combine and split at the same time');
  process.exit(1);
}


const localesCombined = getLocalesFromCombinedFile();
const localesMulti = getLocalesFromMultiPath();

console.log('Checking locale keys');
checkLocaleKeys(localesMulti);
checkLocaleKeys(localesCombined);

if (combine) {
  console.log('Combining locales');
  localesMulti.forEach((translations, locale) => {
    localesCombined.set(locale, translations);
  });
  saveLocalesToCombinedFile(localesCombined, whiteList);
}

if (split) {
  console.log('Splitting locales');
  localesCombined.forEach((translations, locale) => {
    localesMulti.set(locale, translations);
  });
  saveLocalesToMultiPath(localesMulti, whiteList);
}
