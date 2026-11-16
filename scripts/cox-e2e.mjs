#!/usr/bin/env node
/** Public Cox classroom rehearsal. Run on Air only, with Doppler-injected secrets.
 * COX_ANDREW_PASSWORD required; COX_PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs
 * Optional COX_CHROMIUM_EXECUTABLE, COX_BASE_URL, COX_EVIDENCE_DIR,
 * COX_RESTART_SERVICE=gui/501/service-label (executes launchctl kickstart -k locally).
 * No credentials, cookies, tokens or raw socket packets are written to evidence.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { finalLayout } from './cox-final-layout.mjs';
import { displayLayout } from './cox-display-regression.mjs';

const BASE = (process.env.COX_BASE_URL ?? 'https://jeopardy.192-241-145-6.sslip.io').replace(/\/$/, '');
const EMAIL = process.env.COX_HOST_EMAIL ?? 'andrew@cox-classroom.invalid';
const PASSWORD = process.env.COX_ANDREW_PASSWORD;
if (!PASSWORD) throw new Error('COX_ANDREW_PASSWORD must be supplied by the established secret injection.');
const moduleName = process.env.COX_PLAYWRIGHT_MODULE ?? process.env.PLAYWRIGHT_MODULE ?? 'playwright-core';
const { chromium, devices } = await import(moduleName.startsWith('/') ? pathToFileURL(moduleName).href : moduleName);
const OUT = resolve(process.env.COX_EVIDENCE_DIR ?? `artifacts/cox-rehearsal-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(OUT, { recursive: true });
const report = { base: BASE, startedAt: new Date().toISOString(), checks: [], errors: [], screenshots: [], rooms: [], packetAudit: { states: 0, failures: [] }, notes: [] };
const check = (ok, label) => {
  report.checks.push({ ok: !!ok, label });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) throw new Error(label);
};
const pause = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, executablePath: process.env.COX_CHROMIUM_EXECUTABLE || undefined,
  args: ['--autoplay-policy=user-gesture-required', '--mute-audio'] });
const contexts = [];
const monitor = (page, role, name) => {
  const entry = { page, role, name, latest: null, packets: 0, errors: [] };
  page.on('pageerror', error => { entry.errors.push(error.message); report.errors.push({ page: name, url: page.url(), at: new Date().toISOString(), message: error.message, stack: error.stack }); });
  page.on('websocket', socket => socket.on('framereceived', frame => {
    const payload = typeof frame.payload === 'string' ? frame.payload : frame.payload.toString();
    // Socket.IO may prepend packet IDs, but state packets are ordinary event arrays.
    const start = payload.indexOf('["state",');
    if (start < 0) return;
    let v;
    try { const parsed = JSON.parse(payload.slice(start)); if (parsed[0] !== 'state') return; v = parsed[1]; } catch { return; }
    entry.latest = v; entry.packets++; report.packetAudit.states++;
    if (role === 'host') return;
    const problems = [];
    if (v.host) problems.push('host board exposed');
    if (v.clue && v.clue.stage !== 'revealed' && (v.clue.answer !== null || v.clue.answerMedia !== null)) problems.push('clue answer exposed');
    if (v.clue?.dailyDouble?.wager === null && (v.clue.text !== null || v.clue.media !== null)) problems.push('Daily Double clue exposed before wager');
    if (v.clue?.allPlay && v.clue.stage !== 'revealed' &&
        (Object.keys(v.clue.allPlay.typed ?? {}).length || Object.keys(v.clue.allPlay.answers ?? {}).length)) problems.push('all-play submissions exposed before reveal');
    if (v.final) {
      for (const id of new Set([...Object.keys(v.final.typed ?? {}), ...Object.keys(v.final.answers ?? {})])) {
        if (!v.final.revealed?.[id]?.answer) problems.push('Final submission exposed before its reveal');
      }
      for (const id of Object.keys(v.final.wagers ?? {})) if (!v.final.revealed?.[id]?.wager) problems.push('Final wager exposed before its reveal');
      if (v.final.stage === 'category' && (v.final.text !== null || v.final.media !== null)) problems.push('Final clue exposed before category wager stage ends');
    }
    for (const problem of problems) report.packetAudit.failures.push({ page: name, problem, phase: v.phase, clueId: v.clue?.id });
  }));
  return entry;
};
async function context(options = {}) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: false, ...options });
  contexts.push(ctx); return ctx;
}
async function wait(entry, pred, label, timeout = 20000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (entry.latest && pred(entry.latest)) return entry.latest;
    await pause(75);
  }
  throw new Error(`Timed out: ${label} (${entry.name})`);
}
async function shot(entry, name) {
  await pause(name.startsWith('board-') || name.includes('awards') || name.startsWith('final-') ? 3000 : 150);
  const file = `${name}.png`;
  await entry.page.screenshot({ path: resolve(OUT, file), fullPage: false });
  report.screenshots.push(file);
}
async function api(ctx, method, path, data) {
  const response = await ctx.request.fetch(BASE + path, { method, data });
  if (!response.ok()) throw new Error(`API ${method} ${path}: ${response.status()}`);
  return response.json();
}
async function socketHarness(entry, role, code) {
  await entry.page.addScriptTag({ url: BASE + '/socket.io/socket.io.js' });
  await entry.page.evaluate(({ role, code }) => {
    window.__cox = { socket: window.io({ path: '/socket.io', transports: ['websocket'], withCredentials: true,
      auth: { role, code } }) };
  }, { role, code });
}
async function action(host, value, event = 'host:action') {
  const response = await host.page.evaluate(({ value, event }) => new Promise(resolve =>
    window.__cox.socket.timeout(10000).emit(event, event === 'host:action' ? { action: value } : value,
      (error, ack) => resolve(error ? { ok: false, error: 'timeout' } : ack))), { value, event });
  if (!response?.ok) throw new Error(`Action ${value.type ?? event} rejected: ${response?.error ?? 'unknown'}`);
  return response;
}
async function layout(entry, label) {
  const clue = entry.latest.clue;
  const expectedMedia = [clue?.media?.url, clue?.stage === 'revealed' ? clue.answerMedia?.url : null].filter(Boolean);
  await entry.page.waitForFunction(({ urls, text, answer }) => {
    const images = [...document.querySelectorAll('img')];
    return urls.every(url => images.some(image => image.getAttribute('src') === url && image.complete && image.naturalWidth > 0)) &&
      (!text || document.body.textContent.includes(text)) && (!answer || document.body.textContent.includes(answer));
  }, { urls: expectedMedia, text: clue?.text, answer: clue?.stage === 'revealed' ? clue.answer : null });
  await pause(250);
  await entry.page.locator('img').evaluateAll(images => Promise.all(images.map(i => i.decode().catch(() => {}))));
  const result = await entry.page.evaluate(urls => {
    const W = innerWidth, H = innerHeight;
    const images = [...document.querySelectorAll('img')].filter(img => urls.includes(img.getAttribute('src'))).map(img => {
      const r = img.getBoundingClientRect();
      let clipped = r.left < -1 || r.top < -1 || r.right > W+1 || r.bottom > H+1;
      for (let p = img.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p), pr = p.getBoundingClientRect();
        if (/(hidden|clip|auto|scroll)/.test(s.overflow+s.overflowX+s.overflowY) &&
            (r.left < pr.left-2 || r.right > pr.right+2 || r.top < pr.top-2 || r.bottom > pr.bottom+2)) clipped = true;
      }
      return { loaded: img.complete && img.naturalWidth > 0, clipped, width: r.width, height: r.height };
    });
    const text = [...document.querySelectorAll('.clue-text')].filter(e => e.textContent.trim()).map(e => {
      const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
      return { clipped: r.left < -1 || r.top < -1 || r.right > W+1 || r.bottom > H+1 || e.scrollHeight > e.clientHeight+2 || e.scrollWidth > e.clientWidth+2,
        fontSize: parseFloat(s.fontSize), height: r.height };
    });
    return { images, text, horizontalOverflow: document.documentElement.scrollWidth > W+2 };
  }, expectedMedia);
  const ok = !result.horizontalOverflow && result.images.every(i => i.loaded && !i.clipped && i.width > 20 && i.height > 20) && result.text.every(t => !t.clipped);
  report.checks.push({ ok, label, layout: result });
  if (!ok) console.log(`FAIL ${label}`);
  return ok;
}
const teamNames = ['Moss', 'Maple', 'Clover', 'Fern', 'Willow', 'Cedar'];
let rehearsalBoardId;
try {
  const anonymous = await context();
  check((await anonymous.request.get(BASE + '/offline.html')).status() === 401, 'unauthenticated offline rescue download returns401');
  check((await anonymous.request.get(BASE + '/api/boards')).status() === 401, 'unauthenticated board API returns401');
  check((await anonymous.request.post(BASE + '/api/auth/signup', { data: { email: 'rehearsal-signup-rejected@cox-classroom.invalid', name: 'Rejected rehearsal account', password: 'Synthetic-Rehearsal-Only-2026' } })).status() === 403, 'public signup is disabled with403');
  const hostContext = await context({ viewport: { width: 1180, height: 900 } });
  const host = monitor(await hostContext.newPage(), 'host', 'host');
  await host.page.goto(BASE + '/login');
  await host.page.getByPlaceholder('Email', { exact: true }).fill(EMAIL);
  await host.page.getByPlaceholder('Password', { exact: true }).fill(PASSWORD);
  await host.page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await host.page.waitForURL(url => !url.pathname.includes('/login'));
  check(true, 'Andrew host signs in through the public UI');
  const classroom = await api(hostContext, 'GET', '/api/boards/cox-plant-pathology-2026');
  const content = classroom.content;
  const sourceClues = content.rounds.flatMap(r => r.categories.flatMap(c => c.clues));
  check(sourceClues.length === 25 && !content.final, 'classroom board contains exactly 25 clues and no invented Final');
  check(sourceClues.filter(c => c.media).length === 8 && sourceClues.filter(c => c.answerMedia).length === 8, 'all sixteen original figure composites are present');
  const game = await api(hostContext, 'POST', '/api/games', { boardId: classroom.id,
    settings: { teamCount: 6, classroomTeams: true, mode: 'team', dailyDoublePlacement: 'author', startCountdownSec: 0, answerTimerSec: 0,
      fairBuzz: false, autoUnlock: false, allPlayTimerSec: 60, lobbyGame: false, avatars: false } });
  report.rooms.push({ kind: 'classroom', code: game.code, id: game.id });
  const answerClues = sourceClues.filter(c => c.answerMedia);
  for (const clue of answerClues) {
    const template = new URL(clue.answerMedia.url, BASE);
    check(template.pathname.startsWith('/api/cox-media/'), `${clue.id} answer is served through the protected media route`);
    const hosted = await hostContext.request.get(template.href);
    check(hosted.status() === 200 && hosted.headers()['cache-control']?.includes('no-store') && (await hosted.body()).subarray(0,8).toString('hex') === '89504e470d0a1a0a', `${clue.id} authenticated host can load the original answer PNG without public caching`);
    const scoped = new URL(template);
    scoped.searchParams.set('game', game.id); scoped.searchParams.set('clue', clue.id);
    const stem = clue.id.replace(/^cox-/, '');
    const paths = [template.href, scoped.href, `${BASE}/cox/composites/${stem}-a.png`, `${BASE}/cox/composites/${stem}-a.svg`];
    const statuses = await Promise.all(paths.map(async url => (await anonymous.request.get(url)).status()));
    check(statuses.every(status => status === 404), `${clue.id} anonymous direct, guessed room, legacy PNG and SVG answer URLs all return404 before reveal`);
  }
  check(/^[A-Z]{4}$/.test(game.code), 'new classroom room has a four-letter join code');
  await host.page.goto(`${BASE}/host/${game.code}`);
  await socketHarness(host, 'host', game.code);
  await wait(host, v => v.phase === 'lobby', 'host lobby');
  const displayContext = await context({ viewport: { width: 1280, height: 720 } });
  const display = monitor(await displayContext.newPage(), 'display', 'display');
  await display.page.goto(`${BASE}/display/${game.code}`);
  await wait(display, v => v.phase === 'lobby', 'display lobby');
  await display.page.locator('svg').first().waitFor();
  check(await display.page.locator('svg path').count() > 0, 'join QR graphic renders on the public display');
  await shot(display, 'lobby-1280x720');
  const phones = [];
  async function joinPhones(code) {
    for (let i = 0; i < 6; i++) {
      let entry = phones[i];
      if (!entry) {
        const preset = i % 2 ? devices['Pixel 7'] : devices['iPhone 13'];
        const { defaultBrowserType: _browserType, ...deviceOptions } = preset;
        const ctx = await context(deviceOptions);
        entry = monitor(await ctx.newPage(), 'player', `phone-${i+1}-${i%2 ? 'android' : 'iphone'}`);
        entry.context = ctx; phones.push(entry);
      }
      entry.latest = null;
      if (i % 2) {
        await entry.page.goto(BASE + '/join');
        await entry.page.getByRole('textbox', { name: 'Game code', exact: true }).fill(code);
        await entry.page.getByRole('button', { name: 'Join', exact: true }).click();
      } else {
        // Exact QR destination emitted by the display's canonical joinUrl.
        await entry.page.goto(`${BASE}/join?code=${code}`);
      }
      await entry.page.waitForURL(`**/play/${code}`);
      await entry.page.getByRole('button', { name: new RegExp(`Team ${i+1}.*Available`, 'i') }).click();
      await entry.page.getByRole('textbox', { name: /^Team name/ }).fill(teamNames[i]);
      await entry.page.getByRole('button', { name: 'Join as this team', exact: true }).click();
      await wait(entry, v => !!v.me?.playerId && v.me.contestantId === `classroom_${i+1}`, 'team phone joined');
      await shot(entry, `${code}-phone-${i+1}-joined`);
    }
    return phones;
  }
  await joinPhones(game.code);
  await wait(display, v => v.players.length === 6, 'six phones visible');
  check(new Set(phones.map(p => p.latest.me.contestantId)).size === 6, 'six iPhone/Android contexts occupy distinct classroom teams through QR/code UI');
  check(phones.every(p => !p.latest.settings.sound.playerBuzzSound), 'phone buzz sound defaults off');
  await action(host, { type: 'game/start' });
  await wait(display, v => v.phase === 'board', 'classroom board');
  await shot(host, 'host-board');
  await shot(display, 'board-1280x720');
  await display.page.setViewportSize({ width: 1920, height: 1080 });
  await shot(display, 'board-1920x1080');
  await action(host, { type: 'clue/open', clueId: sourceClues[0].id });
  await action(host, { type: 'buzzers/unlock' });
  await Promise.all(phones.map(p => p.page.getByRole('button', { name: 'BUZZ!', exact: true }).waitFor()));
  await Promise.all(phones.map(p => p.page.getByRole('button', { name: 'BUZZ!', exact: true }).dispatchEvent('pointerdown', { pointerType: 'touch', button: 0, isPrimary: true })));
  const raced = await wait(host, v => !!v.clue?.answering, 'race winner');
  const winnerId = raced.clue.answering;
  check(raced.clue.stage === 'answering' && raced.players.some(p => p.id === winnerId), 'six-phone simultaneous buzzer race selects one valid answering player');
  await action(host, { type: 'clue/judge', correct: false });
  await wait(display, v => v.clue?.stage === 'open', 'incorrect answer reopens race');
  const winner = raced.players.find(p => p.id === winnerId);
  check(display.latest.scores[winner.teamId] === -100, 'incorrect ruling deducts clue value from the answering team');
  await action(host, { type: 'clue/judge', correct: true, playerId: phones.find(p => p.latest.me.playerId !== winnerId).latest.me.playerId });
  await wait(display, v => v.clue?.stage === 'revealed', 'answer reveal');
  check(display.latest.clue.answer === sourceClues[0].answer, 'judge reveals the exact original answer');
  const scored = structuredClone(display.latest.scores);
  await wait(host, v => v.host?.history.some(h => h.label.startsWith('Marked correct')), 'correct ruling history');
  const ruling = host.latest.host.history.findLast(h => h.label.startsWith('Marked correct'));
  check(!!ruling, 'host history records the ruling');
  await action(host, { seq: ruling.seq, undone: true }, 'host:undo');
  await wait(display, v => !isDeepStrictEqual(v.scores, scored), 'undo changes score');
  await action(host, { seq: ruling.seq, undone: false }, 'host:undo');
  await wait(display, v => isDeepStrictEqual(v.scores, scored), 'redo restores score');
  check(true, 'specific ruling undo/redo restores team scores');
  await action(host, { type: 'clue/close' });
  await action(host, { type: 'clue/open', clueId: sourceClues[1].id, allPlay: true });
  await Promise.all(phones.map(p => p.page.getByPlaceholder('Or type it (optional)', { exact: true }).waitFor()));
  await Promise.all(phones.map(async (p, i) => {
    await p.page.getByPlaceholder('Or type it (optional)', { exact: true }).fill(`Team ${i+1} rehearsal submission`);
    await p.page.getByRole('button', { name: 'Lock in answer', exact: true }).click();
  }));
  await wait(host, v => Object.keys(v.clue?.allPlay?.hasAnswer ?? {}).length === 6, 'all six typed answers');
  await action(host, { type: 'allPlay/close' });
  await action(host, { type: 'allPlay/judge', contestantId: 'classroom_1', correct: true });
  await wait(display, v => v.clue?.allPlay?.judged?.classroom_1 === true, 'all-play judgment');
  check(Object.keys(display.latest.clue.allPlay.typed).length === 0, 'all-play typed submissions remain private after judging until explicit reveal');
  await action(host, { type: 'clue/reveal' });
  await wait(display, v => v.clue?.stage === 'revealed' && Object.keys(v.clue.allPlay.typed).length === 6, 'all-play revealed');
  await shot(display, 'all-play-revealed');
  check(true, 'all six typed all-play submissions save, judge and reveal');
  await action(host, { type: 'clue/close' });
  const figureClues = sourceClues.filter(c => c.media);
  const sizeCases = [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }];
  for (const size of sizeCases) {
    await display.page.setViewportSize(size);
    for (const clue of figureClues) {
      await action(host, { type: 'clue/open', clueId: clue.id });
      await wait(display, v => v.clue?.id === clue.id && v.clue.stage === 'reading', 'figure clue');
      await layout(display, `${clue.id} clue figures fit ${size.width}x${size.height}`);
      await shot(display, `${clue.id}-clue-${size.width}x${size.height}`);
      await action(host, { type: 'clue/reveal' });
      await wait(display, v => v.clue?.stage === 'revealed', 'figure answer');
      let revealedUrl;
      if (size.width === 1280) {
        revealedUrl = new URL(display.latest.clue.answerMedia.url, BASE);
        const originalUrl = new URL(clue.answerMedia.url, BASE);
        check(revealedUrl.pathname === originalUrl.pathname && revealedUrl.searchParams.get('game') === game.id && revealedUrl.searchParams.get('clue') === clue.id,
          `${clue.id} reveal publishes only its matching room-scoped answer URL`);
        const response = await anonymous.request.get(revealedUrl.href);
        check(response.status() === 200 && response.headers()['cache-control']?.includes('no-store') && (await response.body()).subarray(0,8).toString('hex') === '89504e470d0a1a0a',
          `${clue.id} revealed answer PNG reaches the anonymous display without caching`);
        const wrongClue = new URL(revealedUrl); wrongClue.searchParams.set('clue', sourceClues[0].id);
        const wrongGame = new URL(revealedUrl); wrongGame.searchParams.set('game', 'nonexistent-rehearsal-game');
        check((await anonymous.request.get(originalUrl.href)).status() === 404 && (await anonymous.request.get(wrongClue.href)).status() === 404 && (await anonymous.request.get(wrongGame.href)).status() === 404,
          `${clue.id} revealed media still rejects unscoped, wrong-clue and wrong-room requests`);
      }
      await layout(display, `${clue.id} answer figures and text fit ${size.width}x${size.height}`);
      await shot(display, `${clue.id}-answer-${size.width}x${size.height}`);
      if (revealedUrl) {
        await wait(host, v => v.clue?.id === clue.id && v.clue.stage === 'revealed', 'host figure reveal history');
        const reveal = host.latest.host.history.findLast(h => h.label === 'Revealed answer');
        check(!!reveal, `${clue.id} explicit reveal is available for undo`);
        await action(host, { seq: reveal.seq, undone: true }, 'host:undo');
        await wait(display, v => v.clue?.stage !== 'revealed', 'undo hides figure answer');
        check((await anonymous.request.get(revealedUrl.href)).status() === 404, `${clue.id} undoing reveal revokes anonymous answer delivery`);
        await action(host, { seq: reveal.seq, undone: false }, 'host:undo');
        await wait(display, v => v.clue?.stage === 'revealed', 'redo reveals figure answer');
        check((await anonymous.request.get(revealedUrl.href)).status() === 200, `${clue.id} redoing reveal restores its scoped answer delivery`);
      }
      await action(host, { type: 'clue/close' });
      if (revealedUrl) check((await anonymous.request.get(revealedUrl.href)).status() === 404, `${clue.id} closing its reveal revokes anonymous answer delivery`);
    }
    // Exercise long narrative questions and long original answer keys as well.
    for (const clue of [sourceClues[4], sourceClues[6], sourceClues[18]]) {
      await action(host, { type: 'clue/open', clueId: clue.id });
      await wait(display, v => v.clue?.id === clue.id, 'long clue');
      await layout(display, `${clue.id} long clue fits ${size.width}x${size.height}`);
      await action(host, { type: 'clue/reveal' });
      await wait(display, v => v.clue?.stage === 'revealed', 'long answer');
      await layout(display, `${clue.id} long answer fits ${size.width}x${size.height}`);
      await shot(display, `${clue.id}-long-answer-${size.width}x${size.height}`);
      await action(host, { type: 'clue/close' });
    }
  }
  const reconnectBefore = { contestant: phones[0].latest.me.contestantId, scores: display.latest.scores };
  await phones[0].context.setOffline(true);
  await pause(1200);
  await phones[0].context.setOffline(false);
  phones[0].latest = null;
  await phones[0].page.reload();
  const recovered = await wait(phones[0], v => !!v.me?.playerId, 'phone reconnect');
  check(recovered.me.contestantId === reconnectBefore.contestant && isDeepStrictEqual(recovered.scores, reconnectBefore.scores), 'offline/reload rejoins the same team and retains scores');
  const backupEvent = host.page.waitForEvent('download');
  await host.page.getByRole('button', { name: 'Save score backup', exact: true }).click();
  const backupDownload = await backupEvent;
  const backupPath = resolve(OUT, 'classroom-score-backup.json');
  await backupDownload.saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  check(backup.format === 'cox-jeopardy-state' && backup.state.count === 6 && backup.state.teams.length === 6, 'host UI downloads a valid six-team score backup');
  const offlineEvent = host.page.waitForEvent('download');
  await host.page.getByRole('link', { name: 'Download offline rescue', exact: true }).click();
  const offlineDownload = await offlineEvent;
  const offlinePath = resolve(OUT, 'plant-pathology-offline.html');
  await offlineDownload.saveAs(offlinePath);
  const offlineContext = await context({ viewport: { width: 1280, height: 720 } });
  const offline = monitor(await offlineContext.newPage(), 'offline', 'offline-rescue');
  await offline.page.goto(pathToFileURL(offlinePath).href);
  await offlineContext.setOffline(true);
  offline.page.on('dialog', dialog => dialog.accept());
  await offline.page.locator('#restoreFile').setInputFiles(backupPath);
  await offline.page.waitForFunction(() => document.body.textContent.includes('Scores, wagers and history restored'));
  const restored = await offline.page.evaluate(() => ({ teams: state.teams, count: state.count, used: state.used }));
  check(isDeepStrictEqual(restored.teams, backup.state.teams) && restored.count === 6 && isDeepStrictEqual(restored.used, backup.state.used), 'downloaded offline rescue imports exact six-team names/scores/played clues with network disabled');
  await shot(offline, 'offline-rescue-restored');
  if (process.env.COX_RESTART_SERVICE) {
    const target = process.env.COX_RESTART_SERVICE;
    if (!/^gui\/\d+\/[A-Za-z0-9._-]+$/.test(target)) throw new Error('Invalid launchctl service target');
    await action(host, { type: 'game/pause', paused: true });
    await wait(display, v => v.paused, 'pause persisted');
    const before = structuredClone(display.latest.scores);
    execFileSync('/bin/launchctl', ['kickstart', '-k', target], { stdio: 'pipe' });
    for (const entry of [host, display, ...phones]) entry.latest = null;
    await Promise.all([host, display, ...phones].map(p => wait(p, v => v.paused && isDeepStrictEqual(v.scores, before), 'server restart restores persisted room', 90000)));
    check(true, 'host, display and six phones recover pause and scores after application restart');
    await action(host, { type: 'game/pause', paused: false });
  } else report.notes.push('Application restart not executed: set COX_RESTART_SERVICE to the authorized Air launchctl service for restart coverage.');
  await action(host, { type: 'game/end' });
  await wait(display, v => v.phase === 'finished', 'classroom awards');
  check(Array.isArray(display.latest.awards), 'finished game produces award data');
  await shot(display, 'classroom-awards');
  // A separate copy uses exactly source wording for DD and Final; never edits the classroom board.
  const practice = structuredClone(content);
  practice.rounds[0].categories[0].clues[0].dailyDouble = true;
  const originalFinal = sourceClues[20];
  practice.final = { category: content.rounds[0].categories[4].name, text: originalFinal.text,
    answer: originalFinal.answer, media: originalFinal.media, answerMedia: originalFinal.answerMedia };
  const practiceBoard = await api(hostContext, 'POST', '/api/boards', { title: 'Cox rehearsal only · original source DD and Final', tags: ['cox-rehearsal'], content: practice });
  rehearsalBoardId = practiceBoard.id;
  const savedPractice = await api(hostContext, 'GET', `/api/boards/${rehearsalBoardId}`);
  check(savedPractice.content.rounds[0].categories[0].clues[0].id === sourceClues[0].id && savedPractice.content.rounds[0].categories[0].clues[0].dailyDouble, 'separate fixture preserves original clue IDs and the authored Daily Double');
  const finalGame = await api(hostContext, 'POST', '/api/games', { boardId: practiceBoard.id,
    settings: { teamCount: 6, classroomTeams: true, mode: 'team', dailyDoublePlacement: 'author', startCountdownSec: 0, finalTimerSec: 60, lobbyGame: false } });
  report.rooms.push({ kind: 'separate-dd-final-rehearsal', code: finalGame.code, id: finalGame.id, boardId: rehearsalBoardId });
  host.latest = null; display.latest = null;
  await host.page.goto(`${BASE}/host/${finalGame.code}`);
  await socketHarness(host, 'host', finalGame.code);
  await display.page.goto(`${BASE}/display/${finalGame.code}`);
  await joinPhones(finalGame.code);
  await action(host, { type: 'game/start' });
  await wait(display, v => v.phase === 'board', 'rehearsal board');
  await action(host, { type: 'control/set', contestantId: 'classroom_1' });
  await action(host, { type: 'clue/open', clueId: sourceClues[0].id });
  await wait(display, v => !!v.clue?.dailyDouble, 'DD pending');
  check(display.latest.clue.text === null && display.latest.clue.answer === null, 'Daily Double hides source clue before the team wager');
  await shot(display, 'daily-double-pending');
  await action(host, { type: 'dd/wager', amount: 300, contestantId: 'classroom_1' });
  await wait(display, v => v.clue?.text === sourceClues[0].text, 'DD wager opens exact source clue');
  await action(host, { type: 'clue/judge', correct: true });
  await wait(display, v => v.scores.classroom_1 === 300, 'DD score');
  check(true, 'Daily Double exact-source clue opens after wager and awards the wager');
  await action(host, { type: 'clue/close' });
  for (let i = 1; i <= 6; i++) await action(host, { type: 'score/set', contestantId: `classroom_${i}`, score: 500 });
  await action(host, { type: 'final/start' });
  await Promise.all(phones.map(async p => {
    await p.page.getByPlaceholder('0', { exact: true }).fill('100');
    await p.page.getByRole('button', { name: 'Lock in wager', exact: true }).click();
  }));
  await wait(host, v => Object.values(v.final?.hasWager ?? {}).filter(Boolean).length === 6, 'six Final wagers');
  await action(host, { type: 'final/showClue' });
  await action(host, { type: 'final/startTimer' });
  await Promise.all(phones.map(async (p, i) => {
    await p.page.getByPlaceholder('Or type it (optional)', { exact: true }).fill(`Final rehearsal submission ${i+1}`);
    await p.page.getByRole('button', { name: 'Lock in answer', exact: true }).click();
  }));
  await wait(host, v => Object.values(v.final?.hasAnswer ?? {}).filter(Boolean).length === 6, 'six Final answers');
  check(Object.keys(display.latest.final.typed).length === 0, 'Final typed answers remain private before reveal');
  await action(host, { type: 'final/close' });
  for (let i = 1; i <= 6; i++) {
    const contestantId = `classroom_${i}`;
    await action(host, { type: 'final/reveal', contestantId });
    await action(host, { type: 'final/judge', contestantId, correct: i % 2 === 1 });
    await action(host, { type: 'final/showWager', contestantId });
  }
  await wait(display, v => v.scores.classroom_1 === 600 && v.scores.classroom_2 === 400, 'Final scoring');
  check(true, 'six-phone Final wager, typed submission, reveal and positive/negative scoring work');
  for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await display.page.setViewportSize(size);
    const measured = await finalLayout(display.page);
    report.checks.push({ ok: measured.ok, label: `Final reveal content and prompt fit above score strip ${size.width}x${size.height}`, layout: measured });
    await shot(display, `final-reveal-${size.width}x${size.height}`);
    await display.page.getByTestId('display-fullscreen').click();
    await display.page.waitForFunction(() => !!document.fullscreenElement);
    const fullscreenLayout = await displayLayout(display.page);
    const fullscreenFinal = await finalLayout(display.page);
    check(fullscreenLayout.ok && fullscreenLayout.fullscreen && fullscreenFinal.ok, `Final fullscreen control, content and scores remain disjoint ${size.width}x${size.height}`);
    await shot(display, `final-reveal-fullscreen-${size.width}x${size.height}`);
    await display.page.getByTestId('display-fullscreen').click();
    await display.page.waitForFunction(() => !document.fullscreenElement);
  }
  await action(host, { type: 'game/end' });
  await wait(display, v => v.phase === 'finished', 'final awards');
  await shot(display, 'final-awards');
  const unchanged = await api(hostContext, 'GET', '/api/boards/cox-plant-pathology-2026');
  check(isDeepStrictEqual(unchanged.content, content), 'classroom board remains exactly unchanged after separate DD/Final rehearsal');
  await api(hostContext, 'PATCH', `/api/boards/${rehearsalBoardId}`, { action: 'archive' });
  report.notes.push('Separate exact-source DD/Final rehearsal board archived; completed games retained for evidence.');
  check(report.packetAudit.failures.length === 0, 'all captured public display/player state packets preserve answer redaction');
  check(report.checks.every(c => c.ok), 'all recorded image/text layout checks pass');
  check(report.errors.length === 0, 'host, display and six phones report no browser page errors');
} catch (error) {
  report.failure = error.message;
  for (const [i, ctx] of contexts.entries()) for (const [j, page] of ctx.pages().entries()) {
    await page.screenshot({ path: resolve(OUT, `failure-context-${i}-page-${j}.png`), fullPage: false }).catch(() => {});
  }
  console.error(`REHEARSAL FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  console.log(`Evidence: ${OUT}`);
}
