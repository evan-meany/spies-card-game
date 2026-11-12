# Git Guidelines

## Branches
- **One branch per roadmap phase**, named `phase-<n>-<slug>` (e.g. `phase-1-rules-engine`), from an up-to-date `main`. Every task in the phase is committed on it.
- Work outside a phase gets its own short-lived branch named `<bump>/<slug>` (e.g. `patch/fix-scoring`).
- Never commit directly to `main`; the version bot is the only thing that commits there.

## Commits
- One commit per roadmap task (or smaller), with its code, tests and doc updates together.
- Subject: imperative, sentence case, no trailing period, about 72 chars max (`Add spy placement and point subtraction`). Add a short body when the why isn't obvious.
- Every commit must pass `scripts/check.sh` (see `AGENTS.md`).
- On Windows, write multi-line messages to a file and use `git commit -F <file>`.
- End every message with a `Co-Authored-By:` trailer naming the model that wrote it.
- Never bypass hooks with `--no-verify`.

## Pull requests
- Each phase lands through one PR into `main`, opened by the orchestrator after you approve the phase.
- Title: `<bump>: <phase name>`, where `<bump>` is `major`, `minor` or `patch` (the roadmap gives each phase's bump). CI rejects any other prefix.
- Body: follow `.github/pull_request_template.md`, with bullet points under `### Added`, `### Changed` and `### Removed` (leave a heading empty when it doesn't apply). The version workflow copies these into `CHANGELOG.md` and fails if all are empty.
- Merge with a merge commit (`gh pr merge <n> --merge`), only on your say-so. Afterwards pull `main` to get the `BUMP VERSION TO v<x.y.z>` commit, and start the next phase's branch from it.
- Never force-push.
