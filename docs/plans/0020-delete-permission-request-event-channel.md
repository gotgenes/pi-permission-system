---
issue: 20
issue_title: "Document or delete pi-permission-system:permission-request event channel"
---

# Delete permission-request event channel

## Problem Statement

`src/index.ts` defines and emits a custom event on the `pi-permission-system:permission-request` channel every time a permission decision occurs.
The `PermissionRequestEvent` type has ~12 fields and three possible states (`waiting`, `approved`, `denied`).
Nothing subscribes to this channel, it is undocumented, untested, and the type is not exported — making it the worst of both worlds: a public-shaped surface with no contract and no consumer.

The user decision for this issue is **delete**.
A follow-up issue (#29) tracks re-adding the channel later with a proper public contract (exported types, docs, payload-shape tests, versioning policy).

## Goals

- Remove `PERMISSION_REQUEST_EVENT_CHANNEL`, `emitPermissionRequestEvent`, `PermissionRequestEvent`, `PermissionRequestSource`, and `PermissionRequestState` (the event-specific type — not the permission source/state concepts used elsewhere).
- Remove `createPermissionRequestId` and all `requestId` plumbing that exists solely for the event.
- Remove all `emitPermissionRequestEvent(...)` call sites (3 in `promptPermission`).
- Update `AGENTS.md` to remove the event channel from the preserved-identity list.
- Update `README.md` to remove the event channel reference from the fork notice.
- Confirm no remaining references in `src/` or `tests/`.

## Non-Goals

- Adding new event types or expanding the payload (deferred to #29).
- Changing the `/permission-system` slash command name (preserved).
- Modifying the permission review log (`reviewPermissionDecision`) — that is unrelated to the event channel.

## Background

### Affected surfaces

This change touches the **event emission layer** only — no permission surfaces (tools / bash / mcp / skills / special / external_directory) are affected.
The permission review log (`writeReviewLog`) continues to record all decisions; removing the event channel does not reduce auditability.

### Code locations

| Location | What | Lines |
| -------- | ---- | ----- |
| `src/index.ts:82–84` | `PermissionRequestSource`, `PermissionRequestState` types | 3 |
| `src/index.ts:85–99` | `PermissionRequestEvent` type | 15 |
| `src/index.ts:100–101` | `PERMISSION_REQUEST_EVENT_CHANNEL` constant | 2 |
| `src/index.ts:1347–1349` | `createPermissionRequestId` helper | 3 |
| `src/index.ts:1350–1362` | `emitPermissionRequestEvent` function | 13 |
| `src/index.ts:1416–1429` | emit in auto-approve path | 14 |
| `src/index.ts:1434–1446` | emit in waiting path | 13 |
| `src/index.ts:1460–1472` | emit in resolved path | 13 |
| `AGENTS.md` | § Project Purpose, § Implementation Priorities, § Notes for Agents | 3 mentions |
| `README.md` | Fork notice (line 9) | 1 mention |

### Dependencies

- **#22** (relax on-disk identity rule) — closed/implemented.
  That plan added the event channel to the preserved list pending #20's outcome.
  This plan removes it, which is the expected follow-up.
- **#29** (re-add event channel with proper contract) — new issue, deferred.

## Design Overview

Pure deletion + doc edits.
No new types, no new runtime behavior, no policy changes.

### Deletion strategy

1. Remove the three type aliases (`PermissionRequestSource`, `PermissionRequestState`, `PermissionRequestEvent`).
   Check whether `PermissionRequestSource` is used by `reviewPermissionDecision` or `promptPermission` parameter types — if so, inline the union type or keep the alias under a different name scoped to the review log.
2. Remove the constant and the `emitPermissionRequestEvent` function.
3. Remove `createPermissionRequestId` and all `requestId` fields passed through `promptPermission` / `reviewPermissionDecision` — but only if `requestId` is used exclusively for the event channel.
   If `requestId` is also written to the review log, keep the ID generation and the review-log fields; only remove the event-emission calls.
4. Remove debug-log references to `permission_request.event_emit_failed`.

### `requestId` analysis

`requestId` is passed to both `emitPermissionRequestEvent` and `reviewPermissionDecision`.
The review log writes `requestId` to disk — it is useful for correlating waiting/approved/denied log entries for the same prompt.
Therefore: **keep `requestId` and `createPermissionRequestId`**; only remove the event-emission calls and the event-specific types.

### `PermissionRequestSource` reuse

`PermissionRequestSource` (`"tool_call" | "skill_input" | "skill_read"`) is used in `reviewPermissionDecision`'s `source` parameter.
Keep the type alias but rename it to `PermissionReviewSource` (or inline the union) to avoid confusion with the deleted event type.

### Doc edits

#### `AGENTS.md`

- § Project Purpose: remove "and the `pi-permission-system:permission-request` event channel name are preserved".
- § Implementation Priorities: remove the event channel from the preserved-identity bullet.
- § Notes for Agents item 4: remove the event channel reference.

#### `README.md`

- Fork notice: remove "and `pi-permission-system:permission-request` event channel" from the preserved-names sentence.

## Module-Level Changes

| File | Action | Detail |
| ---- | ------ | ------ |
| `src/index.ts` | changed | Remove `PermissionRequestEvent`, `PERMISSION_REQUEST_EVENT_CHANNEL`, `emitPermissionRequestEvent`, all emit call sites. Rename `PermissionRequestSource` → `PermissionReviewSource`. Keep `requestId` for review log. |
| `AGENTS.md` | changed | Remove event channel from preserved-identity mentions (3 locations). |
| `README.md` | changed | Remove event channel from fork notice. |

No changes to `schemas/`, `config/`, or `tests/` (there are no existing event-channel tests).

## TDD Order

1. **Red:** Add a test that greps `src/index.ts` for `PERMISSION_REQUEST_EVENT_CHANNEL` and asserts it is absent (or: a build-only check that the deleted symbols no longer exist).
   This is lightweight — the real verification is that `npm run build` succeeds after deletion.
   Commit: `test: assert permission-request event channel is removed (#20)`
2. **Green:** Delete the event channel code from `src/index.ts`.
   Rename `PermissionRequestSource` → `PermissionReviewSource`.
   Remove `PermissionRequestState` and `PermissionRequestEvent`.
   Remove `emitPermissionRequestEvent` and all 3 call sites.
   Verify `npm run build` passes.
   Commit: `feat!: delete permission-request event channel (#20)`
3. **Docs:** Update `AGENTS.md` (3 locations) and `README.md` (1 location) to remove event channel references.
   Commit: `docs: remove event channel from preserved-identity list (#20)`

## Risks and Mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Could this silently weaken a permission? | No. The event channel is fire-and-forget with no subscribers. Removing it does not change any allow/deny/ask decision. The review log continues to record all decisions. |
| External consumer breaks | No known consumers exist. The type was never exported. If someone was subscribing by channel name string, #29 will re-add with a proper contract. |
| `requestId` removal breaks review log correlation | Plan explicitly keeps `requestId` and `createPermissionRequestId` — only the event emission is removed. |
| `PermissionRequestSource` removal breaks review log | Plan renames to `PermissionReviewSource` rather than deleting, preserving the type for `reviewPermissionDecision`. |
| #22's AGENTS.md wording becomes stale | This plan updates the same locations #22 touched, removing the now-deleted channel reference. |

## Open Questions

- None.
  The delete-vs-document decision has been made.
  Re-adding with a proper contract is tracked in #29.
