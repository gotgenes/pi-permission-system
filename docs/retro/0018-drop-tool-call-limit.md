---
issue: 18
issue_title: "Drop unread special.tool_call_limit from permissions schema"
---

# Retro: #18 — Drop unread `special.tool_call_limit` from permissions schema

## Final Retrospective (2026-05-03T01:50:00Z)

### Session summary

Removed the unread `special.tool_call_limit` field from the permissions schema and README.
Added a tolerant-loader deprecation path: `normalizeRawPermission()` now returns `{ permissions, configIssues }`, and `PermissionManager.getConfigIssues()` surfaces deprecation messages at session start via the existing `notifyWarning` channel.
Released as v1.1.0.

### Observations

#### What went well

- **Unambiguous issue, clean execution.** The issue body was precise (remove field, add deprecation warning, clean docs), AGENTS.md rules were clear (tolerant loader pattern), and the plan mapped directly to 5 TDD steps that executed without deviation.
- **Plan-to-code fidelity.** All 5 TDD steps landed exactly as planned with no rework, scope changes, or unexpected test failures.

#### What caused friction (agent side)

- `instruction-violation` (self-identified) — The plan commit failed markdownlint because a table cell in the plan contained unescaped pipe characters inside backtick-quoted JSON (`"tool_call_limit": "allow"` was fine, but a separate cell had `tool_call_limit | _(schema only)_` with a bare pipe) and used underscore emphasis instead of asterisks.
  Fixed in one iteration before the commit landed.
  Impact: one failed pre-commit hook, ~30 seconds of rework.

#### What caused friction (user side)

- No friction observed.
  The user ran `/plan-issue`, `/tdd-plan`, `/ship-issue` in sequence with no corrections or redirections needed.
