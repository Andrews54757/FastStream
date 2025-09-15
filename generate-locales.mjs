import fs from 'fs';
import path from 'path';
import https from 'https';
import * as url from 'url';

// Simple CLI usage:
// node generate-locales.mjs --lang fr [--source en] [--model gpt-4o-mini] [--input combined-locales.json] [--output combined-locales.json] [--overwrite] [--dry-run] [--batch 25] [--threads 5]

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

function parseArgs(argv) {
  const opts = {
    lang: null,
    source: 'en',
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
    input: path.join(__dirname, 'combined-locales.json'),
    output: path.join(__dirname, 'combined-locales.json'),
    overwrite: false,
    dryRun: false,
    batch: 25,
    threads: 5,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lang') opts.lang = argv[++i];
    else if (a === '--source') opts.source = argv[++i];
    else if (a === '--model') opts.model = argv[++i];
    else if (a === '--input') opts.input = path.resolve(argv[++i]);
    else if (a === '--output') opts.output = path.resolve(argv[++i]);
    else if (a === '--overwrite') opts.overwrite = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--batch') opts.batch = parseInt(argv[++i], 10) || opts.batch;
    else if (a === '--threads') opts.threads = Math.max(1, parseInt(argv[++i], 10) || opts.threads);
    else if (a === '--help' || a === '-h') {
      printHelpAndExit();
    } else {
      console.error('Unknown argument:', a);
      printHelpAndExit(1);
    }
  }

  if (!opts.lang) {
    console.error('Missing required --lang <code>');
    printHelpAndExit(1);
  }
  return opts;
}

function printHelpAndExit(code = 0) {
  console.log(`Usage: node generate-locales.mjs --lang <code> [options]

Required:
  --lang <code>          Target language code (e.g., fr, zh-cn)

Options:
  --source <code>        Source language code to translate from (default: en)
  --model <name>         OpenAI model (default: OPENAI_MODEL or gpt-4o-mini). Pass your preferred model, e.g. chatgpt-5 if available in your org
  --input <file>         Input combined locales JSON (default: combined-locales.json)
  --output <file>        Output combined locales JSON (in-place by default)
  --overwrite            Also refresh existing translations for the target language
  --dry-run              Do not write files; print proposed changes
  --batch <n>            Number of keys per request (default: 25)
  --threads <n>          Number of concurrent batches (default: 5)

Environment:
  OPENAI_API_KEY         Your OpenAI API key
  OPENAI_BASE_URL        Optional; override API base URL
  OPENAI_MODEL           Optional; default model name
`);
  process.exit(code);
}

function readCombinedLocales(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Input file not found: ${file}`);
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return data;
}

function collectWork(items, sourceLang, targetLang, overwrite) {
  // items: { key: { [lang]: string, [lang+_description?]: string, description?: string } }
  const tasks = [];
  for (const [key, record] of Object.entries(items)) {
    const hasSource = Object.prototype.hasOwnProperty.call(record, sourceLang);
    if (!hasSource) continue; // Only translate from source language entries

    const already = Object.prototype.hasOwnProperty.call(record, targetLang);
    if (already && !overwrite) continue;

    tasks.push({
      key,
      source: record[sourceLang],
      description: record.description || record[`${sourceLang}_description`] || null,
    });
  }
  return tasks;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function callOpenAI({model, messages}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '');
  const payload = JSON.stringify({
    model,
    messages,
    response_format: {type: 'json_object'},
  });

  const urlObj = new URL('/v1/chat/completions', baseUrl);
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(urlObj, options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.message?.content || '{}';
            resolve(content);
          } catch (e) {
            reject(new Error(`Failed to parse OpenAI response JSON: ${e.message}`));
          }
        } else {
          reject(new Error(`OpenAI API error ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function buildPrompt({appName, sourceLang, targetLang, pairs}) {
  const instructions = `You are an expert product localizer for a browser video player UI named "${appName}".
Translate the following UI strings from ${sourceLang} to ${targetLang}.
Guidelines:
- Keep the product/brand name "${appName}" untranslated.
- Preserve placeholders, punctuation, emojis and capitalization as appropriate.
- Use natural, concise UI phrasing for the target locale.
- Return a strict JSON object with exactly and only the provided keys, unchanged: { "key": "translated text", ... }.
- Do not add, remove, rename, or reformat keys. Do not wrap in markdown code fences.
`;

  const list = pairs.map(({key, source, description}) => ({key, source, description})).slice(0);

  return [
    {role: 'system', content: instructions},
    {role: 'user', content: JSON.stringify({entries: list})},
  ];
}

async function translateBatch(opts, batch) {
  const messages = buildPrompt({
    appName: 'FastStream',
    sourceLang: opts.source,
    targetLang: opts.lang,
    pairs: batch,
  });
  const content = await callOpenAI({model: opts.model, messages});
  let obj;
  try {
    obj = JSON.parse(content);
  } catch (e) {
    // Attempt to extract JSON if wrapped within code fences
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Model did not return JSON');
    obj = JSON.parse(m[0]);
  }
  return obj; // { key: translation }
}

async function runWithConcurrency(items, concurrency, handler) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (true) {
      const i = index++;
      if (i >= items.length) break;
      results[i] = await handler(items[i], i);
    }
  }
  const workers = Array.from({length: Math.min(concurrency, items.length)}, () => worker());
  await Promise.all(workers);
  return results;
}

function extractPlaceholders(str) {
  if (typeof str !== 'string') return new Set();
  const tokens = new Set();
  const patterns = [
    /\{\d+\}/g, // {0}, {1}
    /%[sdif]/g, // %s, %d, %i, %f
    /\{[a-zA-Z_][^}]*\}/g, // {name}, {count}
  ];
  for (const re of patterns) {
    const m = str.match(re);
    if (m) m.forEach((t) => tokens.add(t));
  }
  return tokens;
}

function validateBatchResult(batch, obj, appName) {
  const expectedKeys = new Set(batch.map((b) => b.key));
  const issues = {
    missingKeys: [],
    unexpectedKeys: [],
    badValues: [],
    placeholderMismatches: [],
    brandMissing: [],
  };

  for (const key of Object.keys(obj)) {
    if (!expectedKeys.has(key)) issues.unexpectedKeys.push(key);
  }

  const valid = {};
  for (const item of batch) {
    const {key, source} = item;
    if (!Object.prototype.hasOwnProperty.call(obj, key)) {
      issues.missingKeys.push(key);
      continue;
    }
    const val = obj[key];
    if (typeof val !== 'string' || val.trim() === '') {
      issues.badValues.push(key);
      continue;
    }

    const srcTokens = extractPlaceholders(source);
    if (srcTokens.size > 0) {
      const missing = [];
      for (const t of srcTokens) {
        if (!val.includes(t)) missing.push(t);
      }
      if (missing.length > 0) {
        issues.placeholderMismatches.push({key, missing});
        continue;
      }
    }

    if (source.includes(appName) && !val.includes(appName)) {
      issues.brandMissing.push(key);
      continue;
    }

    valid[key] = val;
  }

  const ok =
    issues.missingKeys.length === 0 &&
    issues.unexpectedKeys.length === 0 &&
    issues.badValues.length === 0 &&
    issues.placeholderMismatches.length === 0 &&
    issues.brandMissing.length === 0;

  return {ok, issues, valid};
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const items = readCombinedLocales(opts.input);

  const work = collectWork(items, opts.source, opts.lang, opts.overwrite);
  if (work.length === 0) {
    console.log(`No items to translate for ${opts.lang} (overwrite=${opts.overwrite}).`);
    return;
  }

  console.log(`Translating ${work.length} keys to ${opts.lang} using model ${opts.model}...`);
  const batches = chunk(work, Math.max(1, opts.batch));
  const results = {};

  const partials = await runWithConcurrency(batches, opts.threads, async (batch, i) => {
    let attempt = 0;
    let lastValid = {};
    let lastIssues = null;
    while (attempt < 3) {
      attempt++;
      process.stdout.write(`  Batch ${i + 1}/${batches.length} (items=${batch.length}) attempt ${attempt}... `);
      try {
        const r = await translateBatch(opts, batch);
        const {ok, issues, valid} = validateBatchResult(batch, r, 'FastStream');
        lastValid = valid;
        lastIssues = issues;
        if (ok) {
          console.log('ok');
          return valid;
        }
        console.log('invalid');
      } catch (e) {
        console.log('failed');
        if (attempt >= 3) throw e;
      }
    }
    if (lastIssues) {
      console.warn(`\nValidation failed after 3 attempts for batch ${i + 1}. Issues:`);
      console.warn(JSON.stringify(lastIssues, null, 2));
    }
    return lastValid; // salvage whatever was valid
  });

  // Merge partials
  for (const part of partials) {
    if (part && typeof part === 'object') Object.assign(results, part);
  }

  // Apply results
  let changed = 0;
  for (const [key, translation] of Object.entries(results)) {
    if (!items[key]) continue; // safety
    if (typeof translation !== 'string') continue;
    if (!opts.overwrite && items[key][opts.lang]) continue;
    items[key][opts.lang] = translation;
    changed++;
  }

  if (opts.dryRun) {
    console.log(`\nDry run: would update ${changed} entries for '${opts.lang}'.`);
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  fs.writeFileSync(opts.output, JSON.stringify(items, null, 4));
  console.log(`\nUpdated ${opts.output} with ${changed} '${opts.lang}' translations.`);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
