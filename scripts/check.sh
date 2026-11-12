#!/usr/bin/env bash
# Build, vet and test the Go code (not node_modules); every commit must pass this.
set -euo pipefail
cd "$(dirname "$0")/.."

test -z "$(gofmt -l src test)" || { echo "gofmt needed:"; gofmt -l src test; exit 1; }
go build ./src/... ./test/...
go vet ./src/... ./test/...
go test ./src/... ./test/...
echo "check: ok"
