# Orchestration

An orchestrator agent hands roadmap tasks to worker subagents one at a time, so you don't start each session by hand.

## How it works
- **Orchestrator**: the main session. Reads `docs/roadmap/roadmap.md`, briefs a worker and reads the reply. It delegates all implementation.
- **Worker**: a subagent that does one task end to end (code, tests, docs, commit) and reports.
- A worker ends its report with `NEXT: continue | new | done | blocked — <next task>`, which is `AGENTS.md`'s "continue or new session" advice in a parseable form.
  - `continue`: the orchestrator resumes the same worker with the next task, keeping its context. If the worker is unreachable, it starts a new worker.
  - `new`: the orchestrator starts a fresh worker.
  - `done` / `blocked`: the orchestrator stops and tells you.
- A harness or thread transport failure without an actual worker report is not a task failure. The orchestrator abandons that thread and briefs a fresh worker to recover preserved commits before continuing the same task, at most twice per task.
- If a worker report has a missing or malformed `NEXT:` line, the orchestrator asks once for a corrected report and stops if it doesn't get one. It also stops after two actual failures of the same task and at the end of a phase.
- When a fresh session of its own would do better (large context, stale detail, a phase end), it finishes the current hand-off and stops with a short note (phase and branch, last commit, next task, open decisions). Start the orchestrator again and paste the note, since the repo holds the rest.

## Phase lifecycle
1. The orchestrator creates the phase branch from an up-to-date `main` (see `git_guidelines.md`) if it doesn't exist, or the first worker does.
2. Workers do the phase's tasks in order, each committing and checking off its item in `roadmap.md`.
3. The last task of each phase is its exit checks. Then the orchestrator stops and reports.
4. You review and approve. The orchestrator pushes the branch and opens a PR, then posts the link.
5. You say merge (or merge on GitHub). The merge triggers the version workflow, which bumps `VERSION`, prepends `CHANGELOG.md` from the PR body, and tags. The orchestrator then pulls `main`.

## Running it
- Interactive: `claude --agent orchestrator` in the repo, then tell it which phase to run.
- Headless: `claude --agent orchestrator -p "Run phase 1"`. Headless runs can't answer permission prompts, so allow what the worker needs in `.claude/settings.json` first.
- Models are the `model:` line in each agent file: `.claude/agents/orchestrator.md` (Opus, no edit tools) and `.claude/agents/worker.md` (Sonnet; only its instructions stop it pushing, merging, using `gh` or bypassing hooks).

## Decisions
- Workers never start subagents; the orchestrator is the main session and the worker a subagent.
- Workers never push, merge, open PRs or skip hooks. The orchestrator pushes phase branches and opens PRs only after you approve the phase, and merges only when you say so. `.claude/settings.json` denies nothing, so only the agents' instructions stop force-pushes.
- Workers share state only through the repo, so anything the next task needs goes in a doc or commit. Worker reports pile up in the orchestrator's context, so keep them short.
