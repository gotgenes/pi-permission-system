---
description: Read a GitHub issue, gather context, and write a numbered plan to docs/plans/
---

# Plan a GitHub issue

Issue number: `$1`

Your job is to produce a numbered implementation plan at `docs/plans/NNNN-<slug>.md` for issue #$1, then commit it. Stop after the commit. Do **not** start implementation — the next step is `/tdd-plan` (for plans with test cycles) or `/build-plan` (for docs-only or non-code changes).

## Sync with remote (do this first)

Before reading anything, make sure the working tree is up to date with the remote so the plan is written against current `main`:

1. Run `git pull --ff-only`.
2. If it fails for **any** reason — uncommitted changes, divergent history, merge conflict, network error, detached HEAD — stop immediately and report the failure to the user. Do not attempt to stash, rebase, force, or otherwise resolve.
3. Only proceed once the pull reports a clean fast-forward (or `Already up to date.`).

## Gather context (do this first, in parallel where possible)

1. Run `gh issue view $1` to read the issue body and labels.
2. Read `AGENTS.md` for project priorities, constraints, and code-style rules. Honor them in the plan.
3. List `docs/plans/` to see numbering and style conventions (create the directory if it does not exist yet). Pick the next free `NNNN` (prefer matching the issue number when reasonable).
4. Read every issue the body references as a prerequisite or related (`gh issue view <n>`). Note whether each is implemented yet — your plan must say what it depends on vs. defers.
5. Open the source files most relevant to the change and skim them before writing. Common entry points: `src/permission-manager.ts`, `src/bash-filter.ts`, `src/wildcard-matcher.ts`, `src/system-prompt-sanitizer.ts`, `src/skill-prompt-sanitizer.ts`, `src/extension-config.ts`, `schemas/permissions.schema.json`, `config/config.example.json`.

## Decide

Before writing the plan, identify any genuinely ambiguous design choices. If there are 1–2 such choices (breaking-vs-non-breaking, policy-precedence change, default-state change, on-disk-identity impact, etc.), use the `ask-user` skill once to surface them with a short context summary and concrete options. Skip this step if the issue's "Proposed change" section is unambiguous.

Specifically flag for confirmation any change that affects the upstream-shared on-disk identity (config directory name, log filenames, `/permission-system` slash command name, event channel names) — those are breaking for users of this fork.

## Write the plan

File: `docs/plans/NNNN-<short-slug>.md`.

Start with YAML frontmatter (see `AGENTS.md` § Documentation frontmatter):

```yaml
---
issue: $1
issue_title: "<exact title from `gh issue view`>"
---
```

Then the body, sections in this order:

- **Problem Statement** — quote the issue's framing in your own words.
- **Goals** — bullet list, scoped to this change.
- **Non-Goals** — explicitly defer anything tangential (sibling issues, follow-ups).
- **Background** — relevant existing modules/functions and how they relate. Call out which permission surface is involved (tools / bash / mcp / skills / special / external_directory).
- **Design Overview** — decision model, data shapes, separation of concerns, edge cases. Include code-fenced TS types when shape changes. Include the merge precedence (global → project → per-agent) when policy semantics change.
- **Module-Level Changes** — file-by-file list of what's added, changed, or removed across `src/`, `schemas/`, `config/`, and `tests/`.
- **TDD Order** — numbered red→green→commit cycles. Each item names the test surface, what's covered, and the suggested commit message (`test:`, `feat:`, `feat!:`, `docs:`).
- **Risks and Mitigations** — concrete risks and how the plan addresses each. Always include a "could this silently weaken a permission?" check.
- **Open Questions** — defer-until-needed items.

If the change is breaking (including any change to on-disk identity or default policy state), say so explicitly in Goals and use `feat!:` in the suggested commit messages.

## Commit

```bash
git add docs/plans/NNNN-*.md
git commit -m "docs: plan <short summary> (#$1)"
```

Then print a 5-line summary of the plan's key decisions and stop.
