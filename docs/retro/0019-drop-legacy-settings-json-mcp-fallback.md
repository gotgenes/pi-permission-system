---
issue: 19
issue_title: "Drop legacy ~/.pi/agent/settings.json fallback for MCP server names"
---

# Retro: #19 — Drop legacy `~/.pi/agent/settings.json` fallback for MCP server names

## Final Retrospective (2026-05-03T02:05:00Z)

### Session summary

Removed the `legacyGlobalSettingsPath` fallback from `PermissionManager`, making `mcp.json` the sole file-based source for MCP server name derivation.
Three slash-command steps (`/plan-issue`, `/tdd-plan`, `/ship-issue`) executed with zero user corrections and zero rework.
Released as v1.2.0.

### Observations

#### What went well

- **End-to-end pipeline without intervention.** Plan → TDD → ship executed in sequence with no user corrections, redirections, or rework. The issue body was precise, the plan was unambiguous, and the implementation was a pure removal.
- **Correct red→green test design despite misleading plan language.** The plan's TDD step 1 suggested the test "should pass even before the removal," but a proper red→green cycle needs a failing test. The agent correctly wrote a test that fails before the fix (by passing `legacyGlobalSettingsPath` to the constructor, proving the legacy path is active) and passes after (when the option is removed). The test was updated in the green commit — a minor plan deviation but the right call.

#### What caused friction (agent side)

- `instruction-violation` (self-identified) — Markdownlint table separator style (`|---|---|` vs `| --- | --- |`) failed the pre-commit hook on the plan commit, requiring a fix before the commit could land. This is the same friction seen in the #18 retro. Impact: one failed pre-commit hook, ~30 seconds of rework.

#### What caused friction (user side)

- No friction observed.

### Changes made

1. Created `docs/retro/0019-drop-legacy-settings-json-mcp-fallback.md` (this file).
2. Added markdownlint table-separator spacing rule to `AGENTS.md` § Markdown.
