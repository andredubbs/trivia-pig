#!/usr/bin/env node
/** Render on Air. Only question PNGs are public; answer PNGs require reveal/auth. */
import { mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
let sharp;
try { sharp = require('sharp'); }
catch { throw new Error('Render on Air after npm ci; no Pro install.'); }
const build = resolve(root, 'private/cox-build');
const directory = resolve(build, 'composites');
const files = (await readdir(directory)).filter(f => f.endsWith('.svg')).sort();
if (files.length !== 16) throw new Error(`Expected16composites; found${files.length}`);
const publicDir = resolve(root, 'public/cox/composites');
const answerDir = resolve(root, 'private/cox-answer-media');
await mkdir(publicDir, { recursive: true });
await mkdir(answerDir, { recursive: true, mode: 0o700 });
const mappingPath = resolve(root, 'scripts/cox-data/answer-assets.json');
let mapping = {};
try { mapping = JSON.parse(await readFile(mappingPath, 'utf8')); }
catch (e) {
  if (e.code !== 'ENOENT') throw e;
  // Preserve the first private render when adopting the reproducible source manifest.
  try { mapping = JSON.parse(await readFile(resolve(build, 'answer-assets.json'), 'utf8')); }
  catch (fallback) { if (fallback.code !== 'ENOENT') throw fallback; }
}
const dimensions = [];
for (const name of files) {
  const stem = name.slice(0, -4);
  const answer = stem.endsWith('-a');
  if (answer && !/^[a-f0-9]{48}\.png$/.test(mapping[stem] ?? '')) mapping[stem] = randomBytes(24).toString('hex') + '.png';
  const filename = answer ? mapping[stem] : stem + '.png';
  const target = resolve(answer ? answerDir : publicDir, filename);
  const info = await sharp(await readFile(resolve(directory, name)), { density: 72 }).png({ compressionLevel: 9 }).toFile(target);
  if (info.width < 1000 || info.height < 100) throw new Error(`Unexpected dimensions for${name}`);
  dimensions.push({ file: stem + '.png', width: info.width, height: info.height, protected: answer });
}
await writeFile(mappingPath, JSON.stringify(mapping, null, 2) + '\n', { mode: 0o600 });
const boardPath = resolve(root, 'scripts/cox-data/board.json');
const board = JSON.parse(await readFile(boardPath, 'utf8'));
for (const round of board.content.rounds) for (const category of round.categories) for (const clue of category.clues) {
  const stem = clue.id.replace(/^cox-/, '');
  if (clue.media) clue.media.url = `/cox/composites/${stem}-q.png`;
  if (clue.answerMedia) clue.answerMedia.url = `/api/cox-media/${mapping[stem + '-a']}`;
}
await writeFile(boardPath, JSON.stringify(board, null, 2) + '\n');
await writeFile(resolve(root, 'scripts/cox-data/render-manifest.json'), JSON.stringify(dimensions, null, 2) + '\n');
// Revoke every legacy public answer/intermediate, including label-bearing SVGs.
for (const name of await readdir(publicDir)) if (!/^[0-4]-[0-4]-q\.png$/.test(name)) await rm(resolve(publicDir, name), { recursive: true });
await rm(resolve(root, 'public/cox/figures'), { recursive: true, force: true });
console.log('Rendered16composites:8publicquestionPNGs,8privateanswerPNGs; revoked legacy public answers/SVGs/originals.');
