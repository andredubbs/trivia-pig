#!/bin/bash
set -euo pipefail
cd /Users/andrewfuller/Projects/cox-trivia-d/app
export PATH="$PWD/scripts/cox-deploy/bin:/opt/homebrew/bin:/usr/bin:/bin"
exec doppler run --project cox-jeopardy-d --config prd --only-secrets DATABASE_URL -- /opt/homebrew/bin/python3 scripts/cox-deploy/backup.py
