---
issue: 10
issue_title: "Consolidate config into .pi/extensions/pi-permission-system/config.json (match pi-autoformat convention)"
---

# Retro: #10 — Consolidate config layout

## Final Retrospective (2026-05-03T03:30:00Z)

### Session summary

Implemented the full config consolidation: new `config-paths.ts` and `config-loader.ts` modules, rewired `permission-manager.ts`, `index.ts`, `config-reporter.ts`, and all test harnesses to the new `extensions/<id>/config.json` layout.
Legacy-path detection and merge landed with migration warnings.
Schema, example, README, and AGENTS.md updated in lockstep.
Released as v3.0.0 (breaking change).
Post-release, enriched the JSON schema with examples, defaults, `markdownDescription`, deprecated hints, and per-enum descriptions.

### Observations

#### What went well

- The plan's TDD order was close enough to execute linearly.
  Steps 7 (logging) and 10 (config-modal) were naturally absorbed into step 9 because the existing code was already parameterized — recognizing this and collapsing them avoided empty commits.
- Legacy-path detection worked correctly on first implementation.
  The `normalize()` comparison to avoid false positives when the extension root happens to equal the new global path was tested and caught a real edge case.
- The schema enrichment after shipping was a clean, user-driven iteration.
  The `ask_user` interaction surfaced five concrete improvements; the user selected all five and the result is a significantly better editor experience.

#### What caused friction (agent side)

1. `missing-context` — In step 9, I cached `getAgentDir()` as the module-level constant `PI_AGENT_DIR` and passed it into `createPermissionManagerForCwd`.
   Tests set `PI_CODING_AGENT_DIR` after the module was imported, so `PI_AGENT_DIR` was stale.
   This caused 4 test failures in the external-directory tests.
   Diagnosing the root cause required tracing through `piPermissionSystemExtension` init → `PermissionManager` constructor → `defaultGlobalConfigPath()` → `getAgentDir()` call timing.
   Impact: ~3 edit-run-debug cycles and several minutes of investigation.
   Self-identified — I traced the failure to the stale constant without user intervention.

2. `premature-convergence` — In step 6, I initially changed `defaultGlobalConfigPath()` in `permission-manager.ts` to use the new layout path, which immediately broke 5 integration tests.
   I had to revert that change and defer it to step 9.
   A closer reading of the test harness flow before changing the default path would have shown the dependency.
   Impact: one revert edit, minor rework.
   Self-identified.

3. `missing-context` (formatting) — Three commits were rejected by the Biome pre-commit hook.
   Each required `npm run lint:fix` and re-staging.
   `pi-autoformat` is configured for this project and should have formatted files automatically on `agent_end`, but the `/tdd-plan` workflow commits immediately after tests go green — likely before `agent_end` fires the formatter flush.
   The friction is not inherent to `Write`/`Edit` tools; it is a sequencing gap between the TDD commit cadence and the autoformatter's `agent_end` trigger.
   Impact: added friction but no rework.

#### What caused friction (user side)

- None observed.
  The user's issue body was exceptionally detailed (proposed file shape, layout question resolved, migration plan, acceptance criteria).
  This eliminated ambiguity that would normally require `ask_user` during planning.

### Changes made

1. Added rule to `AGENTS.md` § Code Style: do not cache `getAgentDir()` at module scope.
