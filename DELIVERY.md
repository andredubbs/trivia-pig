# Version D delivery

Built from the real MIT Trivia Pig application in `andredubbs/trivia-pig`, branch `cox-classroom`. No change was made to `cornell-mps`, its branches or PRs. GitHub Actions on the fork are disabled. Install, build, browser tests and production serving ran on Air; the Pro contains source only.

Public root: https://jeopardy.192-241-145-6.sslip.io — host login `/login`, games `/dashboard`, projector `/display/CODE`, team join `/join?code=CODE`. Final demo room and revision are recorded below after validation.

## Features delivered

Exact 5×5 board, original answer key, PNG figure composites with original crops/labels; four-letter rooms and QR join; six default slots adjustable 2–6; phone self-naming and host renaming; one active controller per team; latency-compensated buzzers; all-play typed answers hidden until reveal; live phone/projector scoring; Daily Double wager lock; Final engine and awards; muted original synthesized audio and level controls; green/gold classroom theme; reduced motion; event persistence; phone reload/network reconnect; authenticated standalone offline game plus score/played-clue export bridge. Laptop and projector use separate host/display windows.

See [README-COX.md](README-COX.md) for class steps, source regeneration, secret names, exact infrastructure files and rollback.

## Checks on Air

Commands run from `/Users/andrewfuller/Projects/cox-trivia-d/app`, with `/opt/homebrew/bin` on PATH. Credentials below are injected with the app's scoped Doppler wrapper; no secret values are embedded in command text.

| Command | Result | Evidence under `~/Projects/cox-trivia-d/` |
|---|---|---|
| `npm test` | PASS: 29 files, 190 tests | `vitest-final.log` |
| `npm run lint` | PASS: 0 errors, 5 existing upstream warnings | `lint-final.log` |
| `npm run typecheck` | PASS | `typecheck-release.log` |
| `bash scripts/cox-deploy/build.sh` | PASS: Prisma, Next production, custom Socket.IO server | `build-release-complete.log` |
| `python3 scripts/cox-verify-source.py` | PASS: 25 clues, 50 exact texts, 15 original figure hashes, PNG references, offline gameData hash | command output |
| `doppler run --project cox-jeopardy-d --config prd --only-secrets DATABASE_URL -- npx tsx scripts/cox-import.ts --owner-email andrew@cox-classroom.invalid` | PASS:repeat import `unchanged`; changed import retains previous version | command output |
| `doppler run --project cox-jeopardy-d --config prd --only-secrets COX_KERIK_PASSWORD -- node scripts/cox-check-cohost.mjs` | PASS:Kerik login, shared canonical board, logout | command output |
| `bash scripts/cox-deploy/backup.sh` | PASS:private compressed app-only dump, archive catalog validated | `backup.log`; `backups/cox-trivia-d-20261116T003731Z.dump` |
| `gh api repos/andredubbs/trivia-pig/actions/permissions --jq '{enabled}'` | PASS:`enabled:false` | Pro command output |

The public Playwright rehearsal uses six independent iPhone13/Pixel7 Chromium-emulated team contexts, real UI authentication/join/submission, a separate display, and a host Socket.IO harness for deterministic judgments. It verifies public HTTPS WebSockets, signup 403, exact 25board, all 16 images, no unrevealed answers/media in public socket state, buzz race/duplicate guards, typed all-play, undo/redo, live standings, a dropped/reloaded phone, a real launchctl restart mid-game, score persistence, offline rescue with networking disabled, authored Daily Double wagering, Final wagers/reveals and awards. The Final/DD fixture copies an existing original clue and is archived; the canonical 25board is never given an invented extra question.

Reproduce the full public run **on Air**:

```sh
COX_EVIDENCE_DIR=../evidence-public-verified bash scripts/cox-deploy/rehearse.sh
```

This includes the actual service restart through `COX_RESTART_SERVICE=gui/501/com.andrew.cox-jeopardy-d`, inherited from the helper. Playwright and Chromium paths are explicit in the helper; it does not download browsers. Do not run against an actual class in progress.

Earlier runs exposed and repaired a download-only rescue null reference, Next build/runtime name hydration mismatch, and Final reveal layout overflow. Failed reports remain private under earlier `evidence-public-*` directories rather than being presented as passes. Final verified results and screenshot paths follow below.

## Material limits and Friday preparation

- Final wagering exists and is rehearsed, but the exact 25sourceboard has no Final. Keep it that way unless intentionally selecting an existing clue in a copied board. Defense is preserved despite the title-slide label MANAGEMENT.
- Device coverage is Chromium emulation, not physical iPhone Safari/Android hardware. Scan the actual projector QR with a classroom phone during Wednesday's demo.
- Air must stay powered, awake and logged in. Crash recovery and persisted game restart are tested; physical reboot/login and classroom Wi-Fi/projector hardware are untested. The service depends on the existing OrbStack PostgreSQL startup and tailnet/VPS availability. The downloaded offline rescue is the classroom fallback.
- Score export uses the last received state and transfers scores/names/played clues, not transient wagers or a half-finished clue. It requires the rescue HTML downloaded in advance. It does not merge later back into the live server.
- Air has limited disk headroom. No additional Docker stack or DB service was installed; only the existing Postgres is reused with an isolated database and role. Generated image and build caches are bounded.
- App-scoped Doppler token expires 2026-11-30 UTC, after Friday; renew before continuing beyond that date. Four secret names and retrieval scope are in README-COX; never send passwords through chat or screenshots.
- Static figure objects are publicly addressable if their URLs are known. Unrevealed answer text and answer-media URLs are withheld from game clients; this participation activity is not treated as a confidential exam.

Cleanly reusable: source converter/composites, public-view redaction fix, six-slot single-controller teams, legacy offline score bridge, upstream audio/awards/event engine. From B, consider the six-response answer wall and category standings break. From C, consider per-clue buzz/all-play suggestions and specimen terminology. No relay transplant is needed.

## Final usable room and evidence

Fresh lobby **PHLL** has six empty slots, sound muted and two random Daily Doubles. No test phones remain connected to this room.

- Host: https://jeopardy.192-241-145-6.sslip.io/host/PHLL (host sign-in required)
- Projector: https://jeopardy.192-241-145-6.sslip.io/display/PHLL
- Team join: https://jeopardy.192-241-145-6.sslip.io/join?code=PHLL

Full public rehearsal: **75/75 PASS**, zero browser errors, **1,387** public-state packets audited without an unrevealed answer leak, 44 clue/answer geometry checks across 720p/1080p. Evidence: Air `/Users/andrewfuller/Projects/cox-trivia-d/evidence-public-verified/report.json`; log `e2e-verified.log`. The last two UI refinements (Final layout and persistent mute button) then passed **7/7 focused checks**, including Final bounds and host controls at both sizes, with zero browser errors. Latest lint and explicit TypeScript checks also passed (`lint-release-complete.log`, `typecheck-release-complete.log`); lint retains the same five upstream warnings.

Focused reproduction uses the exact same Playwright/browser/Doppler environment as `rehearse.sh`, replacing its final `node scripts/cox-e2e.mjs` with `node scripts/cox-phone-captures.mjs`:

```sh
cd ~/Projects/cox-trivia-d/app
export PATH="$PWD/scripts/cox-deploy/bin:/opt/homebrew/bin:/usr/bin:/bin"
export COX_PLAYWRIGHT_MODULE="$HOME/Projects/cox-trivia-d/test-tools/node_modules/playwright-core/index.mjs"
export COX_CHROMIUM_EXECUTABLE="$HOME/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
export COX_EVIDENCE_DIR=../evidence-public-verified
doppler run --project cox-jeopardy-d --config prd --only-secrets COX_ANDREW_PASSWORD -- node scripts/cox-phone-captures.mjs
```

Focused report: `evidence-public-verified/final-layout-report.json`; log: `e2e-final-layout.log`. Future full runs include the Final geometry helper too, so their check count increases beyond this recorded 75.

All screenshot paths below share Air directory `/Users/andrewfuller/Projects/cox-trivia-d/evidence-public-verified/`:

| Surface | Screenshot files |
|---|---|
| Fresh projector lobby/QR | `ready-lobby-1280x720.png` |
| Full board, both sizes | `final-board-1280x720.png`, `final-board-1920x1080.png` |
| Figure clue/answer, both sizes | `cox-1-0-clue-1280x720.png`, `cox-1-0-answer-1280x720.png`, corresponding `1920x1080` files; all eight image-bearing clues have both sides captured |
| Long text | `cox-0-4-long-answer-1280x720.png` and `1920x1080` |
| Buzz phone | `phone-buzz-ready.png`, `phone-buzz-winner.png` |
| Everyone types | `phone-typed-all-play.png`, `all-play-revealed.png` |
| Daily Double | `daily-double-pending.png` |
| Final phone | `phone-final-wager.png`, `phone-typed-final.png` |
| Repaired Final projector | `final-layout-verified-1280x720.png`, `final-layout-verified-1920x1080.png` |
| Awards/winner | `final-awards-verified-1280x720.png`, `final-awards-verified-1920x1080.png` |
| Host controls and visible mute | `host-controls-verified-1280x720.png`, `host-controls-verified-1920x1080.png` |
| Network-disabled rescue | `offline-rescue-restored.png` |

Lead visually inspected the settled board, original-figure reveal, long answer, repaired Final, winner/awards, and phone buzz view. Final content fits above the six-team score strip. Earlier animation-frame screenshots remain historical; use the verified files above.

No coordinator integration is required to run this independent preview. For Friday, keep Air powered/logged in and download the rescue copy. The Wednesday demo should check a real phone on the actual classroom Wi-Fi and projector; no separate approval gate is introduced.

Implementation commit: [`ea29d151a03db0fab46f7db0078e6bcf94f9e87b`](https://github.com/andredubbs/trivia-pig/commit/ea29d151a03db0fab46f7db0078e6bcf94f9e87b), branch [`cox-classroom`](https://github.com/andredubbs/trivia-pig/tree/cox-classroom). Air's ignored `deploy/cox-revision` records this tested code revision for `/readyz`. Later delivery-document-only commits do not change its built application.

Local source root: `/Users/andrewfuller/Projects/cox-jeopardy-lab/version-d-trivia-pig`; app entry is `server.ts` plus `src/app/`, rather than `index.html`. Socket.IO in `src/server/` replaces the shared brief's Cloudflare relay for this explicitly requested Trivia Pig deployment. Air has the normal fork checkout; Pro's sandboxed source export uses temporary Git metadata at `/tmp/cox-trivia-d.git` without changing the surrounding lab repository.
