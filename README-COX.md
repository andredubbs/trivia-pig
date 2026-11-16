# Cox classroom edition — Trivia Pig

Self-hosted fork of [davin-young/trivia-pig](https://github.com/davin-young/trivia-pig), based on upstream `8eadd5b`. The upstream MIT license, attribution, event-sourced engine, Socket.IO protocol, original synthesized music, awards and display/player architecture are retained. This is the actual Next.js application, not a second relay implementation. GitHub Actions are disabled on the fork.

Public instance: https://jeopardy.192-241-145-6.sslip.io

- Hosts: `/login`, then `/dashboard` → Cox board → Host.
- Projector: `/display/FOURLETTERCODE` (use an extended desktop; project this window).
- Teams: `/join?code=FOURLETTERCODE`, or scan the display QR. No student accounts or installation.
- Source: `https://github.com/andredubbs/trivia-pig/tree/cox-classroom`.

## Running class

1. Sign in as `andrew@cox-classroom.invalid` or `kerik@cox-classroom.invalid`. Passwords are in Doppler project `cox-jeopardy-d`, config `prd`: `COX_ANDREW_PASSWORD` and `COX_KERIK_PASSWORD`. Kerik is Andrew's co-host and can use the shared board. Public signup is disabled, including OIDC account creation. No email delivery is configured.
2. Create a game from **Plant Pathology**. It starts with six team slots; select **Teams** 2–6 in the lobby before joining. Teams select an empty slot and name it from one phone. Rename in Players if needed. Occupied seats cannot be silently removed or assigned a second active controller.
3. Open the display link, move it to the projector, and show its QR/code. Lock the lobby when everyone has joined. A returning phone keeps its identity after reload. Keep host controls on the laptop, away from the projector.
4. Download **offline rescue** before class and open the saved HTML once. Use **Save score backup** periodically. If the network fails, that button still exports the last received state; restore it in the saved rescue file and continue with laptop-only scoring, timer, undo and all exact clues/figures. Current wagers and an unfinished clue's transient state are not transferred; finish/adjudicate that clue manually. The rescue is a separate offline game, not automatic synchronization back to the server.
5. Start the board. Select a clue, then use normal buzzers or all-play written answers. Space opens/closes buzzers; C/X judge a current speaker; R reveals; B returns to board; P pauses; U undoes. Written answers remain private until reveal. Host judgments determine scoring; no AI grades scientific answers.
6. Daily Doubles default to **Random**, two in this single round. Change Placement/count in Settings before starting; zero disables them. Wager is locked before the clue opens. The canonical board has exactly 25 original clues and **no additional Final**. Final wagering/reveal exists and is tested on a separate rehearsal fixture. To use Final in class, deliberately choose an existing source question in a copied board; the supplied canonical board remains unchanged.
7. Sound starts muted at 25% master level, with phone buzz sounds off. The host toolbar has an always-visible mute; use Sound for levels; click the display once to unlock browser audio. All music/effects are upstream original Web Audio synthesis. Finish the game for standings and awards.

## Source and figures

`python3 scripts/cox-convert.py` extracts the canonical JSON from the sibling base game, or the bundled authenticated-only `scripts/cox-data/offline.html` when base is absent. It preserves all 25 clues, all 50 text sides and the source image crop/label geometry. `node scripts/cox-render.mjs` renders 16 clue/answer composites from 15 original figures to 1200-pixel PNGs using Next's installed sharp. No media is fetched from a CDN. Generated `public/cox/` assets are ignored by Git and must be regenerated on a fresh checkout before building.

The fifth category stays **Defense**, matching canonical gameData. The deck's opening slide calls it **MANAGEMENT**; this discrepancy is flagged rather than edited. No suspected academic error has been silently corrected.

Board input and the standalone answer key live under `scripts/cox-data/`, outside public assets. The offline download requires host authentication. Socket public views withhold answer text and answer-media URLs until reveal; tested across host/display/six phones. Static figure URLs themselves are not authenticated object storage. Source code and the canonical content are in this fork; this is classroom reveal control, not a confidential exam system.

## Air build and operation

Do not install/build on the Pro. Air source: `/Users/andrewfuller/Projects/cox-trivia-d/app`. Invoke through `~/.local/bin/fleet-connect run air -- '<command>'`. On Air:

```sh
cd ~/Projects/cox-trivia-d/app
export PATH="$PWD/scripts/cox-deploy/bin:/opt/homebrew/bin:$PATH"
# npm ci only on a new installation; existing installation is ready.
python3 scripts/cox-convert.py
node scripts/cox-render.mjs
python3 scripts/cox-verify-source.py
doppler run --project cox-jeopardy-d --config prd --only-secrets DATABASE_URL -- npx tsx scripts/cox-import.ts --owner-email andrew@cox-classroom.invalid
bash scripts/cox-deploy/build.sh
launchctl kickstart -k gui/501/com.andrew.cox-jeopardy-d
```

`build.sh` and `run.sh` both set `NEXT_PUBLIC_APP_NAME='Cox Plant Pathology'`; changing only runtime public variables causes Next hydration mismatches. The import is idempotent, retains a board version before changed imports, and never creates users. Database migration, if subsequently needed, uses scoped `DATABASE_URL` and `npx prisma migrate deploy` before building.

Installed services:

- `~/Library/LaunchAgents/com.andrew.cox-jeopardy-d.plist`: KeepAlive + RunAtLoad; executes `app/scripts/cox-deploy/run.sh`, binds tailnet `100.78.245.11:18340`. Logs: `~/Projects/cox-trivia-d/service.log` and `service-error.log`. Restart uses `launchctl kickstart -k`, not an unrelated process killer.
- `~/Library/LaunchAgents/com.andrew.cox-jeopardy-d.backup.plist`: daily 04:15 and on load; compressed app-only pg_dump under `~/Projects/cox-trivia-d/backups/`, retains seven, validates archive catalog. Logs: `backup.log` / `backup-error.log`.
- Existing PostgreSQL 17 container `asus-postgres-fallback`, loopback port 15432, existing persisted volume `asus-postgres-fallback_data`, existing compose at `~/Services/asus-postgres-fallback/compose.yml`. Only isolated database and role `cox_trivia_d` added. Global read-only policy remains on; the new role alone has its read-only default off. No other database changed.
- `~/.config/cox-jeopardy-d/.doppler.yaml`: app-scoped read-only service token, directory 0700 / file 0600. Wrapper `scripts/cox-deploy/bin/doppler` selects it. The grant expires **2026-11-30 UTC**; renew through Doppler before then. Runtime injects only `AUTH_SECRET,DATABASE_URL`; encrypted CLI fallback supports a Doppler outage. Secrets are never committed.
- Doppler project/config: `cox-jeopardy-d/prd`; secret names `AUTH_SECRET`, `DATABASE_URL`, `COX_ANDREW_PASSWORD`, `COX_KERIK_PASSWORD`.

Keep the Air awake, plugged in and logged in. Crash restart and persisted in-progress game recovery were exercised. A physical reboot was not performed; these are user LaunchAgents and begin at login, with PostgreSQL depending on the existing OrbStack startup.

## VPS HTTPS and rollback

Caddy on `stinkers-vps` proxies `jeopardy.192-241-145-6.sslip.io` to Air tailnet port18340, including WebSockets. The added block is recorded in `scripts/cox-deploy/caddy-site.txt`. Only `/etc/caddy/Caddyfile` was changed. Pre-change backup: `/etc/caddy/Caddyfile.bak.20261116T003125Z-cox-d`; validated candidate: `/etc/caddy/Caddyfile.cox-d-candidate`. Caddy was validated and **reloaded**, not restarted. Existing `andyandcompany.com`, `stinkers.town`, and the sslip bridge root were checked before/after.

To remove this preview, remove only its site block, run `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`, then `systemctl reload caddy`. Restore the full backup only if no later unrelated edits occurred. To stop Air app: `launchctl bootout gui/501 ~/Library/LaunchAgents/com.andrew.cox-jeopardy-d.plist`; load again with `launchctl bootstrap gui/501 ...`. Leave the shared PostgreSQL container and volume running. To roll application code back, choose the prior fork commit, regenerate assets, build with the same build script and restart. Database restores should first target an isolated database and be inspected; never overwrite a live game database merely to roll code back.

## Reusable work

The converter/composites, reveal-redaction repair, single-controller classroom slots, and offline score-backup bridge can transplant independently. Upstream audio, awards and event persistence are MIT. Version B's six-answer wall and category-completion standings break would complement this host UI; version C's per-clue buzz/all-play suggestions and specimen language would help classroom pacing. Port those components into this Next/Socket.IO architecture rather than introducing a competing relay.

See `DELIVERY.md` for the final room, revision, exact test commands/results and screenshot evidence.
