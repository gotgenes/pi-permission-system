---
description: Execute a docs/plans/ plan that has no TDD cycle (docs-only, config-only, or prose changes)
---

# Execute a plan (non-TDD)

Argument: `$1` is either a plan path, an issue number, or empty (use the most recently modified plan).

Use this template for plans whose "TDD Order" section says there are no tests to write (docs-only, config-only, schema-only, or other non-code changes).
For plans with red→green test cycles, use `/tdd-plan` instead.

## Sync with remote (do this first)

Before locating or reading the plan, make sure the working tree is up to date with the remote:

1. Run `git pull --ff-only`.
2. If it fails for **any** reason — uncommitted changes, divergent history, merge conflict, network error, detached HEAD — stop immediately and report the failure to the user. Do not attempt to stash, rebase, force, or otherwise resolve.
3. Only proceed once the pull reports a clean fast-forward (or `Already up to date.`).

## Locate the plan

- If `$1` looks like a path, use it.
- If `$1` is a number, find `docs/plans/NNNN-*.md` matching that integer (issue number or plan number).
- Otherwise, use the newest file in `docs/plans/` (by mtime).

Read the plan in full before doing anything else. If the plan has a "TDD Order" section with red→green test cycles, stop and tell the user to run `/tdd-plan` instead.

## Read project rules

Read `AGENTS.md`. The relevant rules for this template:

- Conventional Commits; commit at meaningful checkpoints.
- Don't remove functionality without explicit user discussion.
- Keep `schemas/permissions.schema.json`, `config/config.example.json`, `README.md`, and the TypeScript types/loaders aligned when any one of them changes.
- Default to least privilege — never weaken a permission default without an explicit goal in the plan.
- Preserve the `/permission-system` slash command name and the `pi-permission-system:permission-request` event channel name.

## Execute the plan steps

For **each** numbered step in the plan's "TDD Order" (or equivalent execution section), in order:

1. **Implement** the change the step describes.
2. **Verify.** Run the linters to confirm the change is clean:
   - `npm run lint:all` (Biome + markdownlint).
   - If it fails, run `npm run lint:fix` and re-check.
3. **Commit.** Use the commit message the plan suggests, or a Conventional Commits message that matches:
   - `docs:` for documentation changes.
   - `feat:` for new behavior.
   - `feat!:` for breaking changes the plan calls out (include a `BREAKING CHANGE:` footer).
   - `fix:` for bug fixes.
   - `style:` for lint/format fixups.

One logical change per commit. Do not bundle unrelated steps into one commit.

If a step uncovers a problem the plan didn't anticipate, fix it as part of the same commit and note the deviation in the commit body. If the deviation is large, stop and ask.

## After the last step

1. If any `src/` or `tests/` files were touched (even tangentially), run the full suite: `npx vitest run`. Must be all green.
2. If any `.ts` files were touched, run the type check: `npm run build` (`tsc -p tsconfig.json`). Must succeed.
3. Run the linters one final time: `npm run lint:all`. Commit any fixup as `style:` if you haven't pushed yet.
4. **Do not edit `CHANGELOG.md`** — release-please owns it and will generate entries from your Conventional Commit messages on the next release.

## Summarize

Print:

- `git log --oneline <N>` for the commits you just made (N = number of steps).
- One-line summary of what changed.
- Any deviations from the plan.

Stop. The next step is `/ship-issue`.
