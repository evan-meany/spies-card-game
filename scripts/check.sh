#!/usr/bin/env bash
# Run every check; every commit must pass this. It wraps `npm run check`.
# Run it from Git Bash on Windows or any shell that has Node.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run check
echo "check: ok"
