# Project prompt templates

Slash commands for this repository's issue-driven workflow. Loaded automatically by [`pi-prompt-template-model`](https://github.com/nicobailon/pi-prompt-template-model) when run from a project that contains `.pi/prompts/`.

## The workflow

```text
gh issue → /plan-issue N    →   /tdd-plan [N]   →   /ship-issue N   →   /retro [N]
            (writes plan,        (red→green→         (push, close,         (synthesize friction/
             asks design Qs,      commit per TDD     merge release-        wins, propose small
             commits plan)        step; lint+test;   please PR)            edits, persist to
                                  doc commit)                              docs/retro/)
```

Each step ends at a natural review breakpoint. You can rerun any step independently.

## Templates

### `/plan-issue <issue-number>`

Reads issue #N, gathers context (`AGENTS.md`, related plans, prerequisite issues, relevant source under `src/`), surfaces 1–2 focused design questions via `ask-user` if anything is genuinely ambiguous, and writes a numbered plan to `docs/plans/NNNN-<slug>.md`. Commits the plan as `docs: plan ... (#N)`. Stops there.

### `/tdd-plan [issue-number-or-path]`

Loads the plan (by issue number, by path, or the most recently modified plan if no arg). For each step in the plan's "TDD Order":

1. Write failing tests, confirm red.
2. Implement, confirm green.
3. Commit with the suggested Conventional Commits message (`feat:`, `feat!:`, etc.).

Then runs the full suite + linters, updates docs (`README.md`, `schemas/permissions.schema.json`, `config/config.example.json`) the plan flags, and commits as `docs:`. Never edits `CHANGELOG.md` — release-please owns it.

### `/ship-issue <issue-number>`

Pushes, waits for CI, closes the issue with a summary built from the commit log, then merges any open release-please PR with `--rebase` and pulls the release commit. Refuses to force-push or merge a non-`CLEAN` PR.

### `/retro [issue-number]`

Reviews the session for friction/wins, writes `docs/retro/NNNN-<slug>.md`, surfaces per-proposal context, then uses `ask-user` to confirm small (~1–3 file) edits to `AGENTS.md` or prompts. Records what changed in a `### Changes made` subsection and commits as `docs(retro): ...`. Larger reworks are recorded as follow-ups, not landed inline.

## Why three templates and not one?

Each command corresponds to a different review surface:

- **Plan review** — design choices, scope, TDD ordering. Easy to revise before any code is written.
- **Code review** — the actual diff in commits, one per TDD cycle. Easy to bisect and revert.
- **Ship review** — push, close, release. The "is this really done?" gate.

Combining them would skip those gates. Splitting also lets you rerun any phase: regenerate a plan, redo TDD on the same plan, ship after a manual fixup.

## Conventions assumed by these templates

- `AGENTS.md` at the repo root with project priorities.
- `docs/plans/NNNN-<slug>.md` plan layout with a "TDD Order" section.
- Conventional Commits.
- release-please PRs auto-opened by a GitHub Actions workflow (`.github/workflows/release-please.yml`).
- `npm` test/lint scripts: `npx vitest run`, `npm run lint:all`, `npm run lint:fix`, `npm run build`.

These match this repo's setup (see `AGENTS.md`, `package.json`, `.github/workflows/release-please.yml`).
