/* global console, fetch, process, setTimeout, URL */

import fs from "node:fs";
import path from "node:path";

const language = process.argv[2];
const supported = new Set(["fr", "rw", "sw"]);

if (!supported.has(language)) {
  throw new Error("Usage: node scripts/translate-ui-phrases.mjs <fr|rw|sw>");
}

const projectRoot = process.cwd();
const localeRoot = path.join(projectRoot, "src", "i18n", "locales");
const sourcePath = path.join(localeRoot, "legacy-ui.en.json");
const outputPath = path.join(localeRoot, `legacy-ui.${language}.json`);
const separator = "\n[[[SC_SPLIT]]]\n";
const phrases = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const existing = fs.existsSync(outputPath)
  ? JSON.parse(fs.readFileSync(outputPath, "utf8"))
  : {};

const currentPhrases = new Set(phrases);
for (const phrase of Object.keys(existing)) {
  if (!currentPhrases.has(phrase)) delete existing[phrase];
}

const queue = phrases.filter((phrase) => !existing[phrase]);
const batches = [];
let current = [];
let currentLength = 0;

for (const phrase of queue) {
  const nextLength = currentLength + phrase.length + separator.length;
  if (current.length >= 24 || (current.length > 0 && nextLength > 3500)) {
    batches.push(current);
    current = [];
    currentLength = 0;
  }
  current.push(phrase);
  currentLength += phrase.length + separator.length;
}
if (current.length) batches.push(current);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestTranslation(text, attempt = 0) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", language);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url);
  if (!response.ok) {
    if (attempt < 5) {
      await sleep(750 * 2 ** attempt);
      return requestTranslation(text, attempt + 1);
    }
    throw new Error(`Translation request failed: ${response.status}`);
  }

  const payload = await response.json();
  return payload[0].map((part) => part[0]).join("");
}

async function translateBatch(batch) {
  const translated = await requestTranslation(batch.join(separator));
  const parts = translated
    .split(/\s*\[\[\[SC_SPLIT\]\]\]\s*/g)
    .map((part) => part.trim());

  if (parts.length === batch.length) return parts;

  const fallback = [];
  for (const phrase of batch) {
    fallback.push((await requestTranslation(phrase)).trim());
  }
  return fallback;
}

let nextBatch = 0;
let completed = 0;

async function worker() {
  while (true) {
    const index = nextBatch;
    nextBatch += 1;
    if (index >= batches.length) return;

    const batch = batches[index];
    const translations = await translateBatch(batch);
    batch.forEach((phrase, itemIndex) => {
      existing[phrase] = translations[itemIndex] || phrase;
    });

    completed += 1;
    if (completed % 10 === 0 || completed === batches.length) {
      fs.writeFileSync(
        outputPath,
        `${JSON.stringify(existing, null, 2)}\n`,
        "utf8",
      );
      console.log(`${language}: ${completed}/${batches.length} batches`);
    }
  }
}

await Promise.all(
  Array.from(
    { length: Math.min(8, Math.max(1, batches.length)) },
    () => worker(),
  ),
);

fs.writeFileSync(outputPath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
console.log(`${language}: translated ${Object.keys(existing).length} phrases`);
