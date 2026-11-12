#!/usr/bin/env bash
# Run every check; every commit must pass this. Go checks first, then `npm run check`.
# Runs from Git Bash on Windows (Node is native, Go is reached through WSL) or from a
# shell that has both go and node.
set -euo pipefail
cd "$(dirname "$0")/.."

go_checks='test -z "$(gofmt -l src test)" || { echo "gofmt needed:"; gofmt -l src test; exit 1; }
go build ./src/... ./test/...
go vet ./src/... ./test/...
go test ./src/... ./test/...'

if command -v go >/dev/null 2>&1; then
  bash -c "$go_checks"
else
  # Go is installed in WSL Ubuntu only; map C:/x/y to /mnt/c/x/y.
  wsl_dir="/mnt/$(pwd -W | sed -E 's#^([A-Za-z]):#\L\1#')"
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu --cd "$wsl_dir" -- bash -c "$go_checks"
fi

npm run check
echo "check: ok"
