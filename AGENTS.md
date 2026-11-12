# Spies

A two-player card game ("spades are spies") written in Go. The rules are in `README.md`; they are the spec for the game logic.

> The project is being re-targeted from Go to an Android and iOS app (Expo, React Native, TypeScript). The Layout, Toolchain and Rules below describe the Go code as it stands until `docs/roadmap/roadmap.md` phase 1 replaces it; the roadmap wins where they differ.

## Layout
- `src/main.go` is the entry point. `src/game/` holds the cards, deck and game rules. `src/util/` holds small generic helpers.
- `test/` holds a prototype WebSocket matchmaking server (`server.go`) and a browser console client (`client.js`).
- `scripts/` holds the run and check scripts and the CI versioning scripts. `.github/workflows/` validates PR titles and bumps `VERSION` and `CHANGELOG.md` on merge.
- `docs/process/` holds the process docs; `docs/roadmap/roadmap.md` holds the roadmap.

## Toolchain
- Node and npm run natively on Windows; Go and `gh` are installed in WSL Ubuntu only. Run ad-hoc Go commands through WSL from PowerShell, e.g. `wsl -d Ubuntu --cd /mnt/c/Users/Evan/Dev/spies-card-game -- go test ./src/...`.
- `scripts/check.sh` runs the Go checks (gofmt, `go build`, `go vet`, `go test` over `src` and `test`, reached through WSL) then `npm run check` (typecheck, lint, Jest). Every commit must pass it. Run it with Git Bash from the repo root: `& "C:\Program Files\Git\bin\bash.exe" scripts/check.sh` (plain `bash` in PowerShell is WSL's, which has no Node). Expo SDK 58 wants Node 22.13 or newer; Node 20.18 is installed here and works with a warning.

## Rules
- Follow `docs/process/code_style.md`.
- The `README.md` rules are the source of truth. If code and rules disagree, fix the code; if the rules are ambiguous, pick the simplest reading, note it in the roadmap's *Decisions*, and mention it in your report.
- Game logic stays pure and deterministic (seeded randomness, no I/O) so it can be tested and later driven by the server.
- Docs state current behaviour only, give each fact one home and stay small.
- Commit each finished task on its branch without asking, following `docs/process/git_guidelines.md`.
- At the end of each task, say whether the next task should continue in this session or start a new one. Recommend a new session when the context is already large or the next task needs mostly different files. Continue when it builds directly on what's already loaded.
- End your final report with one line the orchestrator can parse (see `docs/process/orchestration.md`): `NEXT: continue | new | done | blocked — <next task>`.
