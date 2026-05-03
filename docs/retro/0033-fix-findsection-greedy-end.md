---
issue: 33
issue_title: "sanitizeAvailableToolsSection silently removes content after the last recognised section header"
---

# Retro: #33 — `sanitizeAvailableToolsSection` silently removes content after the last recognised section header

## Final Retrospective (2026-05-03T06:15:00Z)

### Session summary

Planned, implemented, and shipped a bug fix for `findSection` in `src/system-prompt-sanitizer.ts`.
The function defaulted `end` to `lines.length` when no subsequent section header followed, silently deleting all content after the last section.
The fix uses a two-pass strategy: use the next section header as the boundary when one exists, otherwise stop at the first non-body line via a new `isSectionBodyLine` helper.
Released as v3.0.3.

### Observations

#### What went well

- The plan correctly identified the bug, the affected module, and the general approach (body-line scanning).
- The `test.fails` → `test` flip pattern worked cleanly as a red-phase entry point.

#### What caused friction (agent side)

- `premature-convergence` — The plan proposed a single-pass `isSectionBodyLine`-only approach without checking `tests/permission-system.test.ts`, which exercises `sanitizeAvailableToolsSection` with a realistic multi-section prompt containing prose between `Available tools:` and `Guidelines:`.
  The naive implementation passed all 16 sanitizer-specific tests but broke the integration test at line 446.
  Impact: required pivoting to a two-pass strategy and a messy `git commit --amend` + `git rebase -i` cleanup that consumed ~5 minutes of rework.

- `wrong-abstraction` — Used `git commit --amend` intending to update commit `828c907` (the intermediate fix), but `--amend` always operates on HEAD, which at that point was the edge-case test commit `2c994d5`.
  This left a broken intermediate commit in the ancestry, requiring an interactive rebase to drop it.
  The rebase itself hit two obstacles: neovim launching as `$EDITOR` (needed `GIT_SEQUENCE_EDITOR`), and a merge conflict because `isSectionBodyLine` was defined in the dropped commit.
  Impact: ~3 minutes of git archaeology; no code-quality impact on the final result.

#### What caused friction (user side)

None observed.
The user's issue description was thorough (root cause, reproducer, proposed fix, impact analysis), which made planning and implementation straightforward.

### Changes made

1. Added rule to `AGENTS.md` § Testing: run the full test suite before committing when shared helpers change.
2. Created `docs/retro/0033-fix-findsection-greedy-end.md` (this file).
