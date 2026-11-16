#!/bin/bash
# Run on Air; public Next variables must match the service at build time.
set -euo pipefail
cd /Users/andrewfuller/Projects/cox-trivia-d/app
export PATH="$PWD/scripts/cox-deploy/bin:/opt/homebrew/bin:/usr/bin:/bin"
export NEXT_PUBLIC_APP_NAME='Cox Plant Pathology'
exec doppler run --project cox-jeopardy-d --config prd --only-secrets AUTH_SECRET,DATABASE_URL -- npm run build
