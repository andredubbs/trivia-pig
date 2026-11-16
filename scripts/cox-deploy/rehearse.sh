#!/bin/bash
# Run only on Air. Contains no credentials; browser audio remains muted.
set -euo pipefail
cd /Users/andrewfuller/Projects/cox-trivia-d/app
export PATH="$PWD/scripts/cox-deploy/bin:/opt/homebrew/bin:/usr/bin:/bin"
export COX_PLAYWRIGHT_MODULE=/Users/andrewfuller/Projects/cox-trivia-d/test-tools/node_modules/playwright-core/index.mjs
export COX_CHROMIUM_EXECUTABLE='/Users/andrewfuller/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
export COX_RESTART_SERVICE="gui/$(id -u)/com.andrew.cox-jeopardy-d"
export COX_EVIDENCE_DIR="${COX_EVIDENCE_DIR:-../evidence-public}"
exec doppler run --project cox-jeopardy-d --config prd --only-secrets COX_ANDREW_PASSWORD -- node scripts/cox-e2e.mjs
