---
issue: 21
issue_title: "Split src/index.ts (1,983 lines) into focused modules"
---

# Retro: #21 — Split src/index.ts (1,983 lines) into focused modules

## Final Retrospective (2026-05-03)

### Session summary

Phase 1 (module extraction) had been completed in a prior session.
This session executed Phase 2: adding 12 unit test files covering every extracted and pre-existing focused module using `vi.mock()` + `vi.fn()` dependency injection.
The suite grew from 119 → 406 tests across 7 → 19 files, and testing uncovered one pre-existing bug (`sanitizeAvailableToolsSection`) that was documented with `test.fails` and filed as #33.

### Observations

#### What went well

- **`test.fails` + issue pattern on first use.** When `sanitizeAvailableToolsSection` silently destroyed prompt content after the last recognised section header, the test was left asserting expected behavior and marked `test.fails`, with a detailed reproducer filed as #33. The suite stayed green, the bug is documented, and the fix has a clear home. Clean execution of a pattern not previously in `AGENTS.md`.

- **`tsc` catching what esbuild missed.** `npm run build` surfaced a `Record<string, string>` vs `Record<string, PermissionState>` mismatch in the `bash-filter` mock parameter type that all 406 Vitest tests passed through silently. The existing "run `npm run build`" rule proved its value in practice.

#### What caused friction (agent side)

- `missing-context` — **`vi.clearAllMocks()` gap.** The plan's own example `afterEach` showed only `vi.restoreAllMocks()`, which is insufficient for `vi.mock()` factories: call counts bleed across tests. The `bash-filter` test wrote a "pre-compiled list should not call `compileWildcardPatterns`" assertion that failed because of accumulated call counts from earlier tests. Fix required: add `vi.clearAllMocks()` before `vi.restoreAllMocks()`. Impact: one failing test, one diagnosis round, one edit. Self-identified from the failure output.

- `premature-convergence` — **`truncateInlineText` boundary direction.** Wrote the boundary test as `length === maxLength` → truncates, when the implementation uses `>` (strict). The implementation was correct; the assumption was wrong. Impact: one failing test, one edit, no rework. Self-identified from the failure output.

- `scope-drift` — **ESM import side-question.** The user asked mid-session about switching to ESM imports. The response engaged the technical analysis (correct) and filed issue #32 (correct), but took several turns. The right shape was: 30-second answer + issue filed. No rework, minor turn cost.

#### What caused friction (user side)

- **Failure triage coaching.** Without the user's explicit instruction ("it may be showing false assumptions — don't assume the test is wrong"), the `sanitizeAvailableToolsSection` failure would likely have been diagnosed as a test error and silently adjusted. The rule needed to be stated; it is now in `AGENTS.md`. Earlier placement would have prevented the coaching moment.

- **Mock isolation example in the plan.** The plan's own testing example showed `afterEach(() => { vi.restoreAllMocks(); })` without `vi.clearAllMocks()`. Providing that example as the template seeded the bug into the first mock-heavy test file written. Earlier detection in plan review would have saved a turn.

### Changes made

1. Added mock-cleanup guidance to `AGENTS.md` § Testing: extract `vi.fn()` stubs to module-scope variables and call `.mockReset()` in `beforeEach`; documents `vi.fn()` vs `vi.spyOn()` distinction. (Refined after reviewing `~/tinyigsoftware/repone/.agents/skills/testing/SKILL.md`.)
2. Added `node:*` built-in mock `default` export rule to `AGENTS.md` § Testing. (Sourced from same skill.)
3. Added `test.fails` + issue pattern bullet to `AGENTS.md` § Testing.
