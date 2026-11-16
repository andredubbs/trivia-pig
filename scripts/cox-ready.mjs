#!/usr/bin/env node
/** Create a clean six-team lobby only after the public rehearsal report passes. Air only. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const moduleName = process.env.COX_PLAYWRIGHT_MODULE ?? process.env.PLAYWRIGHT_MODULE ?? 'playwright-core';
const { chromium } = await import(moduleName.startsWith('/') ? pathToFileURL(moduleName).href : moduleName);
const base = (process.env.COX_BASE_URL ?? 'https://jeopardy.192-241-145-6.sslip.io').replace(/\/$/, '');
const evidence = resolve(process.env.COX_EVIDENCE_DIR ?? '../evidence-public-final');
const report = JSON.parse(await readFile(resolve(evidence, 'report.json'), 'utf8'));
if (report.failure || report.checks.some(c => !c.ok) || report.errors.length || report.packetAudit.failures.length) throw new Error('A clean final public rehearsal report is required before creating the ready lobby.');
if (!process.env.COX_ANDREW_PASSWORD) throw new Error('Scoped COX_ANDREW_PASSWORD secret injection is required.');
const browser = await chromium.launch({ headless: true, executablePath: process.env.COX_CHROMIUM_EXECUTABLE || undefined, args: ['--mute-audio'] });
try {
  const host = await browser.newContext();
  const login = await host.request.post(base + '/api/auth/login', { data: { email: process.env.COX_HOST_EMAIL ?? 'andrew@cox-classroom.invalid', password: process.env.COX_ANDREW_PASSWORD } });
  if (!login.ok()) throw new Error(`Host authentication failed: ${login.status()}`);
  let ready;
  try { ready = JSON.parse(await readFile(resolve(evidence, 'ready-room.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!ready) {
    const made = await host.request.post(base + '/api/games', { data: { boardId: 'cox-plant-pathology-2026' } });
    if (!made.ok()) throw new Error(`Ready game creation failed: ${made.status()}`);
    const game = await made.json();
    ready = { id: game.id, code: game.code, host: `${base}/host/${game.code}`, display: `${base}/display/${game.code}`, join: `${base}/join?code=${game.code}` };
    // Record confirmed creation before screenshots; retries reuse this exact room.
    await writeFile(resolve(evidence, 'ready-room.json'), JSON.stringify(ready, null, 2) + '\n');
  }
  const screen = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await screen.newPage();
  await page.goto(ready.display);
  await page.addScriptTag({ url: base + '/socket.io/socket.io.js' });
  const summary = await page.evaluate(code => new Promise((resolve, reject) => {
    const socket = window.io({ path: '/socket.io', transports: ['websocket'], auth: { role: 'display', code, watch: true } });
    const timeout = setTimeout(() => reject(new Error('No ready lobby state')), 15000);
    socket.on('state', v => { clearTimeout(timeout); socket.close(); resolve({ code: v.code, phase: v.phase, teams: v.teams.length, players: v.players.length, settings: v.settings }); });
  }), ready.code);
  if (summary.phase !== 'lobby' || summary.teams !== 6 || summary.players !== 0 || !summary.settings.classroomTeams ||
      !summary.settings.sound.muted || summary.settings.dailyDoublePlacement !== 'random' || summary.settings.dailyDoublesSingle !== 2) {
    throw new Error('Ready room defaults do not match the authorized six-empty-team muted random-two-DD lobby. Existing ready-room.json identifies it for repair.');
  }
  await page.locator('svg path').first().waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(evidence, 'ready-lobby-1280x720.png'), fullPage: false });
  console.log(`Ready six-team lobby ${ready.code}; host ${ready.host}; display ${ready.display}; join ${ready.join}`);
} finally { await browser.close(); }
