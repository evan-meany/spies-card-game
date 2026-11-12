#!/usr/bin/env bash
# Build, vet and test the whole module; every commit must pass this.
set -euo pipefail
cd "$(dirname "$0")/.."

test -z "$(gofmt -l src test)" || { echo "gofmt needed:"; gofmt -l src test; exit 1; }
go build ./...
go vet ./...
go test ./...
echo "check: ok"
