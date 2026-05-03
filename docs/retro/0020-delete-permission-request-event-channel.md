---
issue: 20
issue_title: "Document or delete pi-permission-system:permission-request event channel"
---

# Retro: #20 — Document or delete `pi-permission-system:permission-request` event channel

## Final Retrospective (2026-05-03T02:50:00Z)

### Session summary

Deleted the `pi-permission-system:permission-request` event channel from `src/index.ts` (types, constant, emit function, 3 call sites — 78 lines removed).
Renamed `PermissionRequestSource` → `PermissionReviewSource` for the surviving review-log usage.
Updated `AGENTS.md` (3 locations) and `README.md` (1 location) to remove the event channel from the preserved-identity list.
Released as v2.0.0 (major bump due to `feat!:` breaking change).
Created follow-up issue #29 to re-add the channel later with a proper public contract.

### Observations

#### What went well

- **`ask-user` decision gate handled a genuinely ambiguous issue well.**
  The issue presented two valid paths (document vs. delete).
  The user asked clarifying questions about the type contract, which led to a 3-turn conversation and a clear decision plus the creation of follow-up issue #29.
- **Proactive follow-up issue creation.**
  Creating #29 during the planning phase (before implementation) cleanly captured the "re-add with proper contract" path without scope-creeping the current issue.
- **Implementation was clean.**
  The code deletion in `src/index.ts` compiled and passed all 83 tests on the first attempt.
  The doc edits passed markdownlint on the first attempt.

#### What caused friction (agent side)

- `instruction-violation` (self-identified) — MD060 table alignment failed the plan commit once.
  The plan file used padded table cells (`| Risk···  | Mitigation··· |`) which `markdownlint-cli2` rejected.
  Fixed by switching to compact style.
  Impact: one failed pre-commit hook, ~1 minute of rework on the plan file.
  This is the fourth consecutive session with MD060 friction (#18, #19, #22, #20).
- `wrong-abstraction` — Two failed `edit` tool calls on `src/index.ts`.
  The first failed because `requestId: string;` appeared in both the `PermissionRequestEvent` type (being deleted) and the surviving parameter blocks, making `oldText` non-unique.
  The second failed because removing `emitPermissionRequestEvent` produced a replacement ending with `const reviewPermissionDecision = (` which overlapped with the next edit targeting that same function signature.
  Fixed on the third attempt by merging the overlapping edits.
  Impact: two wasted tool calls, no rework to committed code.

#### What caused friction (user side)

- No friction observed.
  The user's clarifying questions during the `ask-user` gate were productive and led to a better decision (delete now, re-add with contract later).

### Changes made

1. Created `docs/retro/0020-delete-permission-request-event-channel.md` (this file).
2. Tightened MD060 table rule in `AGENTS.md` § Markdown to prefer compact (no-padding) style.
