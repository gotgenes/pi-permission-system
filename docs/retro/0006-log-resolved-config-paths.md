---
issue: 6
issue_title: "Log resolved config paths at startup so misconfiguration is debuggable"
---

# Retro: #6 — Log resolved config paths at startup so misconfiguration is debuggable

## Final Retrospective (2026-05-02T17:15:00Z)

### Session summary

Planned, implemented, and shipped issue #6 across three prompt templates (`/plan-issue`, `/tdd-plan`, `/ship-issue`).
The feature adds a `config.resolved` review-log entry at every `session_start` listing all policy and extension config paths with existence flags.
Released as v0.6.0 with no breaking changes.

### Observations

#### What went well

- The first `/ship-issue` invocation correctly detected that only a plan commit existed and refused to close the issue — conservative behavior matching the project's least-privilege philosophy.
- TDD execution was clean: 5 commits in logical order, all tests green on first pass after implementation.
- Extracting `src/config-reporter.ts` as a standalone module (plan left this as an open question) kept the change small and testable.

#### What caused friction (agent side)

- `missing-context` — `.gitignore` included `docs/` (upstream excluded generated docs), so `git add docs/plans/` failed during the plan phase, requiring `git add -f`.
  Self-identified.
  Impact: one extra tool call and retry; root-caused during retro — upstream's ignore was speculative (no doc generation tooling exists), so `docs/` was removed from `.gitignore` entirely.

- `wrong-abstraction` — Used `as unknown as Record<string, unknown>` double-cast in `logResolvedConfigPaths()` to pass a typed `ResolvedConfigLogEntry` to `writeReviewLog()` which accepts `Record<string, unknown>`.
  This works but bypasses type safety.
  Impact: no rework, but leaves a type smell in `src/index.ts` (lines 1558, 1562).

- `missing-context` — Did not notice until post-implementation that `src/index.ts` has two duplicate `session_start` handlers (lines 1566, 1584) performing identical setup.
  Added `logResolvedConfigPaths()` to both, which means the `config.resolved` entry is emitted twice per session start.
  Impact: duplicate log entries; latent bug amplified but not introduced by this change.

#### What caused friction (user side)

- No user-side friction observed.
  The three-template workflow (`/plan-issue` → `/tdd-plan` → `/ship-issue`) ran without manual corrections.

### Changes made

1. `.gitignore` — Removed the `docs/` entry entirely (upstream added it speculatively for "generated documentation" but no doc generation tooling exists).
2. `AGENTS.md` — Added "Runtime Caveats" section noting the duplicate `session_start` handlers that must be kept in sync.
3. `docs/retro/0006-log-resolved-config-paths.md` — This file.
