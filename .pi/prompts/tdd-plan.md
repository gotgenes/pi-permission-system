---
description: Execute the TDD steps from a docs/plans/ plan as red→green→commit cycles
---

# Execute a plan with TDD

Argument: `$1` is either a plan path, an issue number, or empty (use the most recently modified plan).

## Sync with remote (do this first)

Before locating or reading the plan, make sure the working tree is up to date with the remote:

1. Run `git pull --ff-only`.
2. If it fails for **any** reason — uncommitted changes, divergent history, merge conflict, network error, detached HEAD — stop immediately and report the failure to the user. Do not attempt to stash, rebase, force, or otherwise resolve.
3. Only proceed once the pull reports a clean fast-forward (or `Already up to date.`).

## Locate the plan

- If `$1` looks like a path, use it.
- If `$1` is a number, find `docs/plans/NNNN-*.md` matching that integer (issue number or plan number).
- Otherwise, use the newest file in `docs/plans/` (by mtime).

Read the plan in full before doing anything else. If "TDD Order" is missing or empty, stop and report — re-run `/plan-issue` first.

## Read project rules

Read `AGENTS.md`. The relevant rules for this template:

- TypeScript only; avoid `any`.
- Conventional Commits; commit at meaningful checkpoints.
- Don't remove functionality without explicit user discussion.
- Keep `schemas/permissions.schema.json`, `config/config.example.json`, `README.md`, and the TypeScript types/loaders aligned when any one of them changes.
- Default to least privilege — never weaken a permission default without an explicit goal in the plan.
- Preserve upstream-shared on-disk identity (config dir, log filenames, slash command, event channel names).

## Execute the TDD cycle

For **each** step in the plan's "TDD Order", in order:

1. **Red.** Write the failing tests the step describes. Run only the affected test file:
   `npx vitest run <test-path>` and confirm failures.
2. **Green.** Implement the minimum code to make those tests pass. Re-run the same file and confirm green.
3. **Commit.** Use the commit message the plan suggests, or a Conventional Commits message that matches:
   - `test:` for test-only commits (rare; usually folded into the feat).
   - `feat:` for new behavior.
   - `feat!:` for breaking changes the plan calls out (include a `BREAKING CHANGE:` footer). Any change to on-disk identity or default policy state is breaking.
   - `fix:` for bug fixes.

One logical change per commit. Do not bundle multiple TDD steps into one commit.

If a step uncovers a problem the plan didn't anticipate (e.g. a downstream test breaks, or a permission decision regresses), fix it as part of the same commit and note the deviation in the commit body. If the deviation is large, stop and ask.

## After the last TDD step

1. Run the full suite: `npx vitest run`. Must be all green.
2. Run the type check: `npm run build` (`tsc -p tsconfig.json`). Must succeed — Vitest does not typecheck.
3. Run the linters: `npm run lint:all` (Biome + markdownlint). If it fails, run `npm run lint:fix` and re-check. Commit any fixup as part of the most recent feat commit (amend) only if you haven't pushed; otherwise as a `style:` commit. The fixup must NOT land in a `docs:` commit.
4. Update docs the plan flags: `README.md`, `schemas/permissions.schema.json`, `config/config.example.json`, etc. Commit as `docs: <summary>`.
5. **Do not edit `CHANGELOG.md`** — release-please owns it and will generate entries from your Conventional Commit messages on the next release.

## Summarize

Print:

- `git log --oneline <N>` for the commits you just made (N = number of TDD steps + docs).
- One-line summary of behavioral change.
- Any test-count delta.
- Any deviations from the plan.

Stop. The next step is `/ship-issue`.
