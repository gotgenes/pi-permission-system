---
issue: 22
issue_title: "Relax 'preserve upstream on-disk identity' rule in AGENTS.md and README (lands with #10)"
---

# Retro: #22 — Relax "preserve upstream on-disk identity" rule in `AGENTS.md` and `README`

## Final Retrospective (2026-05-03T02:30:00Z)

### Session summary

Narrowed the "preserve upstream on-disk identity" rule in `AGENTS.md` (3 locations) and `README.md` (1 location) so only the `/permission-system` slash command and event channel name are treated as stable.
Also updated `README.md` badges to match the `pi-autoformat` style (live npm version, CI status, TypeScript, Pi Package).
Released as v1.2.1.

### Observations

#### What went well

- **Implementation committed on first try.** The 4 prose edits across 2 files passed markdownlint and pre-commit hooks immediately.
  All friction was confined to the plan file, not the implementation itself.
- **Badge update was clean.** User requested an unplanned badge refresh mid-session; the change was scoped, committed separately, and passed CI.

#### What caused friction (agent side)

- `instruction-violation` (self-identified) — Markdownlint MD060 table-column alignment failed the plan commit **three times**.
  The first two failures were caused by em-dash characters (`—`) inflating column widths beyond what `markdownlint-cli2` expected.
  The fix was to simplify to minimal `| --- |` separators with shorter cell content.
  Impact: ~3 minutes of rework across 3 failed pre-commit attempts, all on the plan file.
  This is the third consecutive session with MD060 friction (also seen in #18 and #19 retros).
  The specific trap this time was multi-byte UTF-8 characters (`—`) causing `markdownlint-cli2` to miscount column widths.

#### What caused friction (user side)

- The user noted the absence of a `/build-plan` command (analogous to `/tdd-plan`) for docs-only or non-TDD issues.
  This would have streamlined the plan-to-implementation handoff for this session.
  **Follow-up:** consider creating a `/build-plan` prompt template (file as a GitHub issue, not a retro-scoped change).

### Changes made

1. Created `docs/retro/0022-relax-on-disk-identity-rule.md` (this file).
