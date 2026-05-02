# AGENTS.md

## Project Purpose

This repository is a Pi extension that enforces deterministic permission gates over tool, bash, MCP, skill, and special operations so the agent cannot silently exceed the policy a user has configured.

This package is a friendly fork of [`MasuRii/pi-permission-system`](https://github.com/MasuRii/pi-permission-system).
The on-disk identity (config directory, log filenames, `/permission-system` slash command, event channel names) is intentionally preserved so the fork and upstream share runtime state and stay drop-in interchangeable.

Read `docs/plans/` before making architectural changes (created by `/plan-issue` on first use).

## Workflow

- Keep scope tight.
- Prefer small, reversible changes.
- Preserve intentional behavior unless there is a clear reason to change it.
- Ask before removing functionality, changing defaults, or diverging from upstream's on-disk identity.

## Implementation Priorities

- Default to least privilege — when in doubt, prompt (`ask`), do not silently allow.
- Enforce permissions deterministically; the same policy + same input must always produce the same decision.
- Keep policy files (`~/.pi/agent/pi-permissions.jsonc`, per-agent overrides) the source of truth; do not bake policy into code.
- Hide denied tools from the agent before it starts (tool filtering + system-prompt sanitization) so the agent does not waste turns probing for blocked tools.
- Keep block/ask/allow decisions reviewable: write to the permission review log by default and surface readable approval summaries in the dialog.
- Preserve the upstream extension's on-disk identity (config dir, log filenames, slash command, event channel names). Renaming any of these is a breaking change for users of the fork.
- Wildcard matching (bash patterns, skill globs) must be explicit and tested — silent over-matching is a permission bypass.
- When a config pattern or documented recommendation can solve a problem, prefer that over a new runtime mechanism. Mechanism is forever; docs are reversible.
- Treat any declared config field not read at runtime as a maintenance trap. Remove it or document its purpose.

## Code Style

- Use TypeScript.
- Avoid `any` unless absolutely necessary.
- Use standard top-level imports only.
- Keep modules focused and composable (one concern per file in `src/`: `bash-filter.ts`, `wildcard-matcher.ts`, `permission-manager.ts`, etc.).
- Prefer explicit configuration over hidden behavior.
- Permission decisions should be pure functions of (policy, request) wherever possible — keep IO at the edges.

## Markdown

- Use one sentence per line (unbroken) for better diffs.
- Always specify a language on fenced code blocks (e.g., ` ```typescript `, ` ```bash `, ` ```jsonc `, ` ```text `); use `text` for plain output that has no specific syntax.
- Use sequential numbering (`1.` `2.` `3.`) in ordered lists, restarting at `1.` under each new heading — markdownlint's MD029 rejects continued numbering across section boundaries.
- Do not use bold text (`**...**`) as a substitute for headings — use proper Markdown heading syntax (`##`, `###`, `####`); markdownlint's MD036 rejects emphasis used as headings.
- When embedding markdown content that itself contains fenced code blocks, use a 4-backtick outer fence (` ````markdown `) so inner 3-backtick fences render correctly.

## Configuration

Two distinct config surfaces — do not conflate them:

- **Policy file** (the user's permission rules):
  - global: `~/.pi/agent/pi-permissions.jsonc` (respects `PI_CODING_AGENT_DIR`)
  - per-agent overrides: YAML frontmatter in agent definition files
  - Schema: `schemas/permissions.schema.json`
  - Example: `config/config.example.json`
- **Extension runtime config** (knobs for this extension itself, not policy):
  - extension root: `config.json` (e.g. `debugLog`, `permissionReviewLog`, `yoloMode`)
  - loaded by `src/extension-config.ts`

Rules:

- Project policy must always override global policy; per-agent frontmatter must override both.
- Do not move package configuration into Pi `settings.json` without explicit discussion.
- Keep `schemas/permissions.schema.json`, `config/config.example.json`, `README.md`, and the TypeScript types/loaders aligned.
  Changing one without the others is a bug, not a refactor.
- When removing a previously accepted config field, keep the loader tolerant: accept the legacy key, emit a single non-fatal config issue per occurrence describing the deprecation, and discard the value.
  Drop the field from the TypeScript types, the JSON schema, and the docs in the same change.
  This avoids breaking on-disk configs while still surfacing the trap.

## Documentation frontmatter

Docs under `docs/plans/` and `docs/retro/` use YAML frontmatter for structured metadata.
GitHub renders it as a table at the top of the file.

Schema (both fields are strings/numbers — quote any title containing backticks or colons):

```yaml
---
issue: 14 # optional: omit for plans that predate issue tracking
issue_title: "Per-agent permission frontmatter overrides" # required
---
```

- `issue` stores the number only, never a URL.
- Do not duplicate frontmatter fields as inline metadata in the body (e.g. `Issue #N` in the H1 is fine; a separate `**Issue:** #N` line is not).
- Other doc types (`README.md`) do not use frontmatter.

## Testing

- Add focused tests for permission resolution (allow/deny/ask decisions across tools, bash, MCP, skills, special).
- Test wildcard matching (bash patterns, skill globs) including over-match and under-match cases.
- Test policy merge precedence: global → project → per-agent frontmatter.
- Test system-prompt sanitization (denied tools removed, allowed tools preserved, multi-block skill prompts).
- Test the external-directory guard for path-bearing file tools.
- Test config loading, validation issues, and tolerance of deprecated keys.
- Vitest uses esbuild and does not typecheck. Run `npm run build` (`tsc -p tsconfig.json`) for type-only changes.
- Do not insert no-op statements (`void 0;`, unused locals) in tests just to make an `Edit` tool's `oldText` unique — widen `oldText` with surrounding context instead.

## Commits

- Use Conventional Commits.
- Commit at meaningful checkpoints without waiting for an explicit reminder.
- Prefer small, reviewable commits that leave the repository in a valid state.
- Examples:
  - `feat: add per-agent frontmatter override merge`
  - `fix: tighten bash wildcard matcher for ' --' boundary`
  - `test: cover MCP tool-level deny precedence`
  - `docs: refine permission-system policy schema`

## Runtime Caveats

- `src/index.ts` registers two `session_start` handlers that perform identical setup.
  Both must be kept in sync until they are consolidated.
  Any new startup side effect must be added to both handlers or extracted to a shared helper.

## Notes for Agents

Before implementing, understand:

1. the problem being solved
2. which permission surface is involved (tools / bash / mcp / skills / special / external_directory)
3. the merge precedence between global, project, and per-agent policies
4. whether the change affects the upstream-shared on-disk identity (config dir, log filenames, slash command, event channel names) — if yes, it is breaking
5. the need to keep schema, example config, loader, and docs aligned

Do not assume "allow" is a safe default. Do not add a permission surface without also adding a policy field, schema entry, and example.
