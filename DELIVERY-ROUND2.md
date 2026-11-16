# Version D — Round 2 corrections

Same fork, branch, Air service and VPS proxy. Host/projector/team URLs remain **PHLL**:

- https://jeopardy.192-241-145-6.sslip.io/host/PHLL
- https://jeopardy.192-241-145-6.sslip.io/display/PHLL
- https://jeopardy.192-241-145-6.sslip.io/join?code=PHLL

## Changes

1. Fullscreen moved into a reserved 36px controls row above game content. It cannot cover the sixth score card, question, figures or correct response. Normal and actual fullscreen board/clue/Final layouts are checked at 1280×720 and 1920×1080.
2. Each total score is exactly one count-up text node. The latest change has its own reserved line; it never overlays the total. Negative totals use lighter red for stronger projector contrast. Frame sampling covers positive/negative changes on board/clue at both sizes.
3. Only question PNGs are public. Answer PNGs moved into `private/cox-answer-media/` with generated 48-hex filenames. `/api/cox-media/[asset]` requires either the authenticated board owner/co-host or a matching game/clue whose correct response is currently revealed. All responses, including 404, are private/no-store. Undo/close revoke anonymous access. Public reveal views supply game/clue scope; host previews work before reveal. Legacy public answer PNG/SVG paths and raw figures are gone. Converter intermediates moved to `private/cox-build/`. The stable `answer-assets.json` source manifest supports regeneration; asset IDs alone never authorize access. 128 legacy URL references across 16 persisted rows were migrated while the app was stopped, without changing academic content.
4. Removed owned superseded directories `evidence-public`, `evidence-public-final`, `evidence-public-run2`; kept `evidence-public-verified`. Trimmed build caches. Hourly log rotation is installed via `~/Library/LaunchAgents/com.andrew.cox-jeopardy-d.logs.plist`: copy/truncate above 256 KiB, two archives per service/backup log. Active log sizes were under 2 KiB at the configuration check.
5. Verified the loaded startup chain without rebooting: existing `com.andrewfuller.asus-air-fallback` runs at login and every 120 seconds, starts OrbStack if Docker is unavailable, then `docker compose up -d` for the existing Postgres service. Container restart policy is `unless-stopped`. App LaunchAgent has RunAtLoad/KeepAlive. Production app startup now waits/retries for Postgres in one process indefinitely, instead of exhausting its startup window and restarting. A fake-clock test verifies recovery after two failed probes. Exact manual recovery is in [README-COX.md](README-COX.md#recovery-after-an-air-restart).

No Caddy configuration, shared database service configuration, account scope, secrets or academic text changed. The existing isolated role/database, private Doppler injection and backups remain in use.

## Validation

All installs/builds/tests ran on Air from `~/Projects/cox-trivia-d/app`. Existing isolated Playwright/Chromium and scoped Doppler route were reused; no Pro install or browser download.

| Command | Result/evidence under `~/Projects/cox-trivia-d/` |
|---|---|
| `npm test` | PASS: 31 files, 194 tests — `round2-unit.log` |
| `npm run lint` | PASS: 0 errors, 5 existing upstream warnings — `round2-lint.log` |
| `npm run typecheck` | PASS — `round2-types.log` |
| `bash scripts/cox-deploy/build.sh` | PASS — `round2-build-final.log` |
| `python3 scripts/cox-verify-source.py` | PASS: 25 clues, 50 exact text sides, 15 original figure hashes, private answer files, no public answer/intermediate artifacts |
| scoped `npx tsx scripts/cox-import.ts --owner-email andrew@cox-classroom.invalid` | PASS: `unchanged` after protected URL migration |
| scoped `node scripts/cox-check-cohost.mjs` | PASS: Kerik shared-board access plus all 8 pre-reveal protected host image previews/no-store |

Full public run uses `COX_EVIDENCE_DIR=../evidence-public-verified/round2 bash scripts/cox-deploy/rehearse.sh`. This includes six iPhone/Android-emulated phones, QR/code join, buzz race, typed all-play, Daily Double, Final wagers/reveal/awards, phone reload/drop/rejoin, real app restart with six-phone state recovery, offline rescue, undo/redo, both projector sizes, and answer redaction.

The new image checks request **every one of the 8 answer assets** anonymously before reveal: direct URL 404, guessed matching game/clue URL 404, legacy PNG/SVG 404. Authenticated host previews 200/no-store. Matching public reveal URL 200; wrong game/clue 404; undo 404; redo 200; close 404. These tests exercise the server's actual authorization, not only whether URLs are omitted from WebSocket state.

Focused regression uses the same Playwright/Chromium/Doppler environment as the full helper, changing its final command to `node scripts/cox-round2-regression.mjs`. It verifies 8 windowed/fullscreen geometry combinations and 8 score-change traces. Final result: **17/17 PASS**, 24 screenshots, 736 animation frames, minimum measured total-score contrast 8.105:1, zero browser errors. The initial negative-score diagnostic had 4.078:1 (valid large-text AA, below our stronger 4.5 projector target); the final lighter-red build exceeds that target. Only JSON diagnostic evidence is retained for that superseded attempt.

Reports/screenshots stay on Air under `/Users/andrewfuller/Projects/cox-trivia-d/evidence-public-verified/round2/`:

- `report.json`: final full classroom rehearsal.
- `display-regression-report.json`: geometry and each sampled score frame.
- `display-board-1280x720-windowed.png`, corresponding `fullscreen` and `1920x1080` files.
- `display-clue-1280x720-windowed.png`, corresponding `fullscreen` and `1920x1080` files.
- `score-positive-board-1280x720-transition.png`, `score-negative-board-1280x720-transition.png`, `score-negative-clue-1920x1080-transition.png`; positive/negative, board/clue, both sizes also have settled shots.
- `cox-1-0-clue-1280x720.png`, `cox-1-0-answer-1280x720.png`, both sizes and all other figure composites.
- `daily-double-pending.png`, `final-reveal-1280x720.png`, `final-reveal-fullscreen-1280x720.png`, `final-awards.png`, six phone lobby captures, and offline rescue capture.

Lead visually inspected the new reserved control row, all six unobscured scores, stable board, figure clue and in-flight score transitions. Fullscreen is clear of content; delta is visibly distinct from the one total.

## Remaining risks

A physical Air reboot and actual classroom Wi-Fi/projector/iOS Safari were not exercised. Configuration and crash/restart recovery are verified; the Air still needs power, login and tailnet/VPS reachability. Download the offline rescue before class. Canonical content remains 25 clues with no invented Final; Final engine testing uses a separate archived fixture. The scoped Doppler token expires 2026-11-30 UTC. Source content is in the authorized fork; this is participation reveal control, not confidential exam storage. Already revealed/downloaded content cannot be made unseen.

Final public rehearsal on the lighter-red build: **159/159 PASS**, 63 screenshots, 1,531 public state packets audited, zero unrevealed answer leaks and zero browser errors. Actual app restart recovered host/display/six phones and persisted scores. Reports: `evidence-public-verified/round2/report.json` and `display-regression-report.json`; logs: `e2e-round2-final.log`, `display-round2-final.log`. Superseded attempt 1 PNGs were removed; compact prior report/contrast trace JSON remains for the diagnostic record. **PHLL was not used for tests** and remains the fresh demo lobby.

Final cleanup: Air reports **4.0 GiB available** (`df -h /`). Retained evidence is 83 MiB, production `.next` is 42 MiB after removing `.next/cache`, private conversion/answer assets are 16 MiB. Post-migration backup `cox-trivia-d-20261116T012954Z.dump` was catalog-validated (84,414 bytes). Backup retention remains seven dumps.

## Released revision and final checks

Implementation commit: [`d0610f7`](https://github.com/andredubbs/trivia-pig/commit/d0610f7), pushed to [`cox-classroom`](https://github.com/andredubbs/trivia-pig/tree/cox-classroom). Air source checkout is clean at this commit. After the final service restart, public `/readyz` returned `ok:true, db:true, version:d0610f7, unsaved:0`; `/healthz` returned `ok`. The authenticated ready-lobby check confirmed PHLL still has six empty teams, lobby phase, mute enabled and two random Daily Doubles. Its fresh capture is `evidence-public-verified/ready-lobby-1280x720.png`.

Other VPS sites rechecked: `andyandcompany.com` 200, `stinkers.town` 200, bridge root `192-241-145-6.sslip.io` expected 404. Round 2 did not edit or reload Caddy. Existing proxy rollback and backup path remain in README-COX.md.

Exact additional Air commands, from the app directory (credential values stay inside the scoped route):

```sh
export PATH="$PWD/scripts/cox-deploy/bin:/opt/homebrew/bin:/usr/bin:/bin"
export COX_PLAYWRIGHT_MODULE=/Users/andrewfuller/Projects/cox-trivia-d/test-tools/node_modules/playwright-core/index.mjs
export COX_CHROMIUM_EXECUTABLE='/Users/andrewfuller/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
export COX_EVIDENCE_DIR=../evidence-public-verified/round2
doppler run --project cox-jeopardy-d --config prd --only-secrets COX_ANDREW_PASSWORD -- node scripts/cox-round2-regression.mjs
doppler run --project cox-jeopardy-d --config prd --only-secrets COX_KERIK_PASSWORD -- node scripts/cox-check-cohost.mjs
doppler run --project cox-jeopardy-d --config prd --only-secrets DATABASE_URL -- npx tsx scripts/cox-import.ts --owner-email andrew@cox-classroom.invalid
bash scripts/cox-deploy/backup.sh
```

No coordinator integration action is required to use this deployed preview. Before class, keep the Air powered and logged in, open PHLL on the host/projector, and download the offline rescue. Use the documented recovery sequence if it restarts.
