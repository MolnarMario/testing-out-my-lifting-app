/**
 * Vendors the OCR engine and its language data into public/, so a build can scan
 * labels without ever reaching the network.
 *
 * Optional. By default src/lib/ocr.ts loads both from jsDelivr and only the
 * first scan pays for them. Run this, then set LOCAL_ASSETS to true in ocr.ts.
 *
 *   node scripts/fetch-ocr-assets.mjs
 */

import { mkdir, copyFile, writeFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const engineDir = join(root, "public", "tesseract");
const langDir = join(root, "public", "tessdata");

/**
 * Which core tesseract.js loads is decided in the browser, from the SIMD support
 * it finds there — so an offline build has to carry every variant it might pick.
 * Only the LSTM builds are needed; the legacy engine is never requested unless
 * legacyCore is turned on.
 */
const CORES = [
  "tesseract-core-relaxedsimd-lstm",
  "tesseract-core-simd-lstm",
  "tesseract-core-lstm",
];

/** The same files, and the same revision, that the CDN default would serve. */
const LANGUAGES = ["ron", "eng"];
const LANG_BASE = "https://cdn.jsdelivr.net/npm/@tesseract.js-data";
const LANG_REVISION = "4.0.0_best_int";

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function copyInto(from, to) {
  await copyFile(from, to);
  const { size } = await stat(to);
  console.log(`  ${to.slice(root.length + 1)}  ${mb(size)}`);
  return size;
}

async function download(url, to) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(to, bytes);
  console.log(`  ${to.slice(root.length + 1)}  ${mb(bytes.length)}`);
  return bytes.length;
}

async function main() {
  await mkdir(engineDir, { recursive: true });
  await mkdir(langDir, { recursive: true });

  let total = 0;

  console.log("worker");
  total += await copyInto(
    join(root, "node_modules", "tesseract.js", "dist", "worker.min.js"),
    join(engineDir, "worker.min.js"),
  );

  console.log("core");
  for (const core of CORES) {
    for (const extension of [".wasm", ".wasm.js"]) {
      total += await copyInto(
        join(root, "node_modules", "tesseract.js-core", `${core}${extension}`),
        join(engineDir, `${core}${extension}`),
      );
    }
  }

  console.log("language data");
  for (const language of LANGUAGES) {
    total += await download(
      `${LANG_BASE}/${language}/${LANG_REVISION}/${language}.traineddata.gz`,
      join(langDir, `${language}.traineddata.gz`),
    );
  }

  console.log(`\n${mb(total)} vendored into public/.`);
  console.log("Set LOCAL_ASSETS to true in src/lib/ocr.ts to use it.");
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`);
  process.exitCode = 1;
});
