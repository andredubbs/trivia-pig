#!/usr/bin/env node
/** Rasterize generated SVG composites on Air, using Next's installed sharp.
 * node scripts/cox-render.mjs
 * No packages are installed. Converts board.json media URLs to the PNG files only
 * after every image was rendered and its dimensions checked successfully.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
let sharp;
try { sharp = require('sharp'); }
catch { throw new Error('Rasterize on Air after npm ci: Next includes sharp. No local install is needed.'); }
const directory = resolve(root, 'public/cox/composites');
const files = (await readdir(directory)).filter(f => f.endsWith('.svg')).sort();
if (files.length !== 16) throw new Error(`Expected 16 clue/answer composites; found ${files.length}`);
const dimensions = [];
for (const name of files) {
  const source = resolve(directory, name);
  const target = source.replace(/\.svg$/, '.png');
  // Generated SVGs contain embedded original figures; no network or browser needed.
  const info = await sharp(await readFile(source), { density: 72 }).png({ compressionLevel: 9 }).toFile(target);
  if (info.width < 1000 || info.height < 100) throw new Error(`Unexpected dimensions for ${name}`);
  dimensions.push({ file: name.replace(/\.svg$/, '.png'), width: info.width, height: info.height });
}
const boardPath = resolve(root, 'scripts/cox-data/board.json');
const board = JSON.parse(await readFile(boardPath, 'utf8'));
for (const round of board.content.rounds) for (const category of round.categories) for (const clue of category.clues) {
  for (const field of ['media', 'answerMedia']) {
    if (clue[field]) clue[field].url = clue[field].url.replace(/\.(svg|png)$/, '.png');
  }
}
await writeFile(boardPath, JSON.stringify(board, null, 2) + '\n');
await writeFile(resolve(root, 'scripts/cox-data/render-manifest.json'), JSON.stringify(dimensions, null, 2) + '\n');
console.log(`Rendered ${dimensions.length} PNG composites; private board.json now references PNG media.`);
