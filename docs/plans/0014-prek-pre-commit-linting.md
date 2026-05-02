---
issue: 14
issue_title: "Set up prek for pre-commit linting (Biome + markdownlint)"
---

# Set up prek for pre-commit linting

## Problem Statement

During the #13 retro, a Biome version-skew issue surfaced: running `npm run lint:fix` locally with a different Biome version than the one pinned in `package-lock.json` produced formatting changes that CI rejected.
A pre-commit hook running the project-local linters would catch these mismatches before they reach CI, saving round-trip time on failed builds.

## Goals

- Install and configure [prek](https://prek.j178.dev/) as the git hook manager.
- Run `npx biome check` on staged files in the pre-commit hook so the project-pinned Biome version is always used.
- Run `npx markdownlint-cli2` on staged Markdown files in the pre-commit hook.
- Document the setup so contributors know how to install hooks and what they enforce.

## Non-Goals

- Adding new lint rules or changing existing Biome/markdownlint configuration — out of scope.
- Running the full test suite or type-check in the pre-commit hook — too slow for a pre-commit gate; CI handles these.
- Migrating CI to use prek — CI continues to run `npm run lint` and `npm run lint:md` directly.

## Background

- **Origin:** #13 retro (`docs/retro/0013-consolidate-session-start-handlers.md`) — a `style:` commit with wrong Biome formatting caused a CI failure and 2 extra fixup commits.
- **Existing lint scripts:** `npm run lint` (`biome check .`), `npm run lint:md` (`markdownlint-cli2 '*.md' 'docs/**/*.md' '.pi/prompts/**/*.md'`).
- **CI:** `.github/workflows/ci.yml` runs `npm run lint` and `npm run lint:md` as separate steps.
- **Permission surface:** none — this is a developer-tooling concern with no policy semantics.
- **On-disk identity:** no impact — prek config lives in `.prek.yaml` at the repo root, not in the Pi config directory.

## Design Overview

[prek](https://prek.j178.dev/) is a Rust-based git hook manager (drop-in replacement for `pre-commit`).
It reads `.prek.yaml` at the repo root and installs git hooks that run configured checks on staged files.

### Hook configuration

The `.prek.yaml` file defines two hooks under `pre-commit`:

1. **Biome** — runs `npx biome check` on staged JS/TS/JSON files.
   Using `npx biome` ensures the project-local version from `node_modules` is used, preventing version skew.
2. **markdownlint** — runs `npx markdownlint-cli2` on staged `.md` files.

Both hooks should operate only on staged files (prek handles this via `types`/`files` filters and passes matching filenames to the command).

### Developer setup

After cloning, a developer runs `prek install` once to set up the git hooks.
This is a one-time step documented in `README.md` and optionally wired as a `prepare` npm script so `npm install` auto-installs hooks.

## Module-Level Changes

### Added

- **`.prek.yaml`** — prek hook configuration with Biome and markdownlint hooks scoped to relevant file types.

### Changed

- **`package.json`** — add a `prepare` script (`prek install`) so hooks are installed automatically after `npm install`.
  This is the standard convention for git hook managers.
- **`README.md`** — document the pre-commit setup: what it runs, how to install hooks manually if needed, how to skip hooks (`git commit --no-verify`) in emergencies.
- **`.gitignore`** — no changes needed; prek does not generate files that need ignoring.

### Not changed

- **`biome.json`** — no changes; the hook invokes the existing config.
- **`.markdownlint-cli2.yaml`** — no changes; the hook invokes the existing config.
- **`.github/workflows/ci.yml`** — no changes; CI continues to run the full lint suite independently.

## TDD Order

This issue is primarily a configuration/tooling change with no application logic, so the "test" cycles are validation-oriented rather than unit-test-oriented.

1. **Verify prek is installable and `.prek.yaml` is valid.**
   Create `.prek.yaml` with both hooks.
   Run `prek install` and confirm hooks are registered (`.git/hooks/pre-commit` exists and delegates to prek).
   Commit: `feat: add prek pre-commit config for Biome and markdownlint (#14)`

2. **Verify Biome hook catches lint violations on staged files.**
   Stage a file with a deliberate Biome violation, run `git commit` (or `prek run pre-commit`), confirm it fails.
   Stage a clean file, confirm it passes.
   Commit: `test: verify Biome pre-commit hook catches violations (#14)` (manual verification, no committed test file)

3. **Verify markdownlint hook catches Markdown violations on staged files.**
   Stage a `.md` file with a deliberate violation (e.g., trailing spaces), run the hook, confirm failure.
   Stage a clean `.md` file, confirm it passes.
   Commit: `test: verify markdownlint pre-commit hook catches violations (#14)` (manual verification)

4. **Add `prepare` script and update README.**
   Wire `prek install` into `package.json`'s `prepare` script.
   Add a "Pre-commit hooks" section to `README.md`.
   Commit: `docs: document prek pre-commit setup (#14)`

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| prek not installed on contributor's machine → `prepare` script fails | Document prek installation in README. The `prepare` script can use `prek install` with a guard (`command -v prek` or similar) so it warns but does not block `npm install`. |
| Hook runs full-repo lint instead of staged-only → slow commits | Configure prek to pass only staged filenames to each command. Verify with a manual test. |
| Could this silently weaken a permission? | No — this change is purely developer tooling. It adds a pre-commit gate; it does not touch any permission surface, policy file, or runtime code. |
| markdownlint glob mismatch between hook and `npm run lint:md` | Use the same glob patterns in `.prek.yaml` as in `package.json`'s `lint:md` script. |
| `npx biome` falls back to a global install if local is missing | `npx` resolves from `node_modules/.bin` first when run inside a project with a lockfile. Document that `npm install` must be run before committing. |

## Open Questions

1. **Should `prepare` silently skip if prek is not installed?** A guard like `command -v prek >/dev/null 2>&1 && prek install || true` avoids blocking `npm install` for contributors who haven't installed prek yet, but it also means hooks silently won't exist. Decide during implementation.
2. **Should we pin a prek version?** prek is installed globally (via `cargo install` or a binary download), not as an npm dependency. Pinning is not straightforward — defer unless version-specific breakage appears.
