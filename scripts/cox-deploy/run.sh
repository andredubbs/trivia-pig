#!/bin/bash
set -euo pipefail
cd /Users/andrewfuller/Projects/cox-trivia-d/app
export PATH="$PWD/scripts/cox-deploy/bin:/opt/homebrew/bin:$HOME/.local/bin:/usr/bin:/bin"
export APP_URL=https://jeopardy.192-241-145-6.sslip.io
export PORT=18340 HOST=100.78.245.11 ALLOW_SIGNUP=false STORAGE_DRIVER=local
export NODE_ENV=production NEXT_PUBLIC_APP_NAME='Cox Plant Pathology' TRUST_PROXY=true
export APP_VERSION="$(cat deploy/cox-revision 2>/dev/null || echo classroom-dev)"
# The scoped CLI keeps an encrypted fallback for restarts during Doppler outages.
exec doppler run --project cox-jeopardy-d --config prd --only-secrets AUTH_SECRET,DATABASE_URL -- node dist/server.js
