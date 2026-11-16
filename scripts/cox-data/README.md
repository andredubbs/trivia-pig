# Cox source import

Run conversion with Python 3 (standard library only). When the sibling `base` checkout is absent, omitting `--source` uses the bundled private `scripts/cox-data/offline.html` gameData instead:

```sh
python3 scripts/cox-convert.py --source ../base/index.codex.html
```

Run rasterization and Node checks **on Air**, after the project's normal `npm ci`:

```sh
node scripts/cox-render.mjs
npx tsx scripts/cox-import.ts --check
npx tsx scripts/cox-import.ts --owner-email "$COX_HOST_EMAIL"
```

The importer requires an existing host account. It never creates credentials. The fixed default board ID is `cox-plant-pathology-2026`; a different owner requires an explicit different `--board-id`. A repeated import with identical content is a no-op. Changed content is versioned before replacement, and share/status settings remain in place.

`board.json`, `source-manifest.json`, and `render-manifest.json` are private build/import inputs. Do not copy them into `public/`. Intermediates and originals live in ignored `private/cox-build/`. Only question PNGs are public. Answer PNGs live in `private/cox-answer-media/` and are served through the reveal/auth-gated `/api/cox-media/[asset]` route. `answer-assets.json` preserves the generated 48-hex filenames for reproducible regeneration, but filenames alone never authorize a request. The renderer removes legacy public answer PNG/SVG files and raw figures.

The converter preserves `gameData` text arrays in the source manifest, and joins paragraphs with two newlines for BoardContent. All 50 clue/answer sides retain the exact wording, punctuation, internal whitespace and source-slide references. There are 25 clues, 15 unique original figures and 16 image-bearing sides. There is no Final clue. Daily Doubles default off, matching the source game's default.

The original figure positions, image crop fractions and label text come from `gameData`. Every label retains its original unadjusted slide position. No A/B/C labels are repositioned. The composite bounding box removes only whitespace surrounding the figures and labels. The `image11.emf` source key already contains the canonical PNG conversion; the converter writes it as `figures/image11.png` without reinterpreting EMF. Composites embed the original raster images and crop them through SVG clip paths before Air renders PNGs via Next's installed `sharp`.

The supplied PPT board calls the fifth category **MANAGEMENT**. The canonical game calls it **Defense** to match its questions. Defense is retained and the discrepancy remains explicitly recorded; no academic text is corrected.

Source conversion is deterministic. Running it regenerates private SVGs and restores temporary board URLs to `.svg`; run rasterization before import/deployment to restore question PNG URLs and protected answer API URLs. Preserve `answer-assets.json` to keep asset IDs stable. Existing persisted legacy games/versions were migrated with `cox-protect-existing.ts` while the app was stopped; no academic text changed.

## Public classroom rehearsal (Air)

`scripts/cox-e2e.mjs` uses Playwright Core from an external isolated module path and the existing Air Chromium binary. Run through the project Doppler wrapper so the existing host password enters only as `COX_ANDREW_PASSWORD`. Its environment controls are:

- `PLAYWRIGHT_MODULE` (or `COX_PLAYWRIGHT_MODULE`): absolute Playwright Core `index.mjs` path.
- `COX_CHROMIUM_EXECUTABLE`: existing Chromium executable.
- `COX_BASE_URL`: defaults to the established public SSL URL.
- `COX_EVIDENCE_DIR`: private screenshot/report destination.
- `COX_RESTART_SERVICE`: optional `gui/UID/launchctl-label`; enables a real local Air service restart and verifies live room recovery. Omitting it records restart coverage as unexecuted.

The harness signs in through UI, creates games through the authenticated API, joins six iPhone/Android Chromium-emulated contexts through the actual team UI, and uses a host Socket.IO harness for deterministic rulings. It checks actual phone pointer events, typed all-play and Final submissions, private socket state, original image loading and clipping at 720p/1080p, undo/redo, connection recovery, awards, and separate exact-source DD/Final rehearsal. It archives its temporary board on success. Completed rehearsal games remain available as evidence. Screenshots need visual inspection in addition to the geometric checks; device emulation does not certify physical iOS Safari or Android hardware.

After a clean final report, `scripts/cox-ready.mjs` uses the same Air browser/secret environment and `COX_EVIDENCE_DIR` to create a fresh canonical lobby with six empty teams, muted sound and the host's default two random Daily Doubles. It records only game ID, code and host/display/join links in `ready-room.json`, and captures `ready-lobby-1280x720.png`. Repeating it reuses the recorded room; it does not attach any test phones. The helper refuses to create a lobby from a failing rehearsal report.
