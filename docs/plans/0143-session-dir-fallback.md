---
issue: 143
issue_title: "Parent-session resolution still single-keyed after #96 — `ask` still silently denies in nicobailon/pi-subagents children"
---

# Session-directory fallback for parent-session resolution

## Problem Statement

After #96, detection of a subagent execution context is broadened — `SUBAGENT_ENV_HINT_KEYS` recognises env vars set by `pi-agent-router`, `nicobailon/pi-subagents`, and `HazAT/pi-interactive-subagents`.
The resolution side — which parent session the forwarded permission request should be written to — remains env-var-only.
`resolvePermissionForwardingTargetSessionId()` iterates `SUBAGENT_PARENT_SESSION_ENV_CANDIDATES` and returns the first hit; if none is set, forwarding fails and any `ask`-state permission in a headless child silently denies.

After commit `3829195` (issue #143 first round) the candidates list contains `PI_AGENT_ROUTER_PARENT_SESSION_ID` and `PI_SUBAGENT_PARENT_SESSION`.
The original CLI extensions covered by `SUBAGENT_ENV_HINT_KEYS` (`nicobailon/pi-subagents`, `HazAT/pi-interactive-subagents`) do not yet set `PI_SUBAGENT_PARENT_SESSION` in spawned children, so the resolution side still misses for the very extensions whose env vars detection now recognises.

Step 2 of the original #96 proposal already named this gap: fall back to the session directory layout when no env candidate resolves.
Pi's session-directory convention already encodes the parent-child relationship deterministically (verified in `node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.d.ts:189` and in `nicobailon/pi-subagents/src/extension/index.ts:66 getSubagentSessionRoot`):

```text
<sessionsDir>/                                ← e.g. ~/.pi/agent/sessions/<cwd-encoded>/
  <parent-baseName>.jsonl                     ← parent session log; header { type: "session", id: <parentSessionId> }
  <parent-baseName>/                          ← derived from parent file (basename minus .jsonl)
    <runId>/                                  ← e.g. "c6825838"
      run-N/                                  ← attempt index
        session.jsonl                         ← child's session log
```

Reading the first JSONL line of `<parent-baseName>.jsonl` yields a `SessionHeader` whose `id` field is the canonical parent session ID.
This is the same record that pi-coding-agent writes when creating a session.

## Goals

- When env-var resolution misses, walk up the current process's session directory to find an ancestor whose name matches a sibling `<name>.jsonl` session file, read that file's first line, and return its `id` as the parent session ID.
- Keep env-var resolution as the fast path with strict precedence — adding the fallback must not change behaviour for any setup where an env candidate is set.
- Make the new helper an isolated, pure module so unit tests can use tmp-dir fixtures.
- Update the "target session could not be resolved" diagnostic so a user reading the log knows both resolution paths were tried.

## Non-Goals

- Adopting env-var conventions in upstream subagent extensions — orthogonal and explicitly deferred per the #143 follow-up comment.
- Supporting in-process subagent extensions (`tintinweb/pi-subagents`) — tracked separately in #29; those have no session directory of their own.
- Walking sibling session directories or maintaining a parent-child registry — the directory layout is enough.
- Changing the `SessionHeader` parsing surface or relying on additional SDK methods beyond `ctx.sessionManager.getSessionDir()`.
- Schema, config, or per-agent override changes — none of those touch resolution.

## Background

### Existing flow

`forwarded-permissions/polling.ts::waitForForwardedPermissionApproval` calls `resolvePermissionForwardingTargetSessionId({ hasUI, isSubagent, currentSessionId, env })`.
When the function returns `null` the child immediately logs a `permission_forwarding.error` event and denies.

### Why filesystem is sufficient

The child's `sessionManager.getSessionDir()` is exposed by Pi's `ReadonlySessionManager` interface (`session-manager.d.ts:189`) and is already consumed in `subagent-context.ts::isSubagentExecutionContext` for the detection path.
The nesting `<parent-baseName>/<runId>/run-N` is enforced by `nicobailon/pi-subagents` because its `getSubagentSessionRoot()` derives the root from the parent session file's directory and basename — every CLI-spawned child that uses Pi's session manager lives under this layout.

### Why parse the JSONL header

A directory's basename has the form `<timestamp>_<sessionId>`, but the timestamp prefix is not part of the SDK contract.
The `SessionHeader.id` field is the canonical session identifier and is written by `SessionManager` on session creation.
Parsing the first line of `<name>.jsonl` is therefore the durable extraction — directory-name parsing would couple the extension to an internal pi convention.

### Bounded walk

`nicobailon/pi-subagents` caps subagent nesting depth in practice (its `PI_SUBAGENT_DEPTH` env var bounds recursion).
A bounded walk-up (max 8 levels) is enough to traverse from any nested run-N directory to the outermost parent session directory without scanning the entire filesystem.

## Implementation

### New module `src/parent-session-discovery.ts`

Exports a single function:

```typescript
export function resolveParentSessionIdFromSessionDir(
  sessionDir: string | null | undefined,
): string | null;
```

Algorithm:

1. Return `null` for empty, non-string, or filesystem-root input.
2. From `sessionDir`, climb at most 8 directory levels.
3. At each level, check whether `<current>.jsonl` exists as a sibling file.
4. If it exists, read its first line, parse as JSON, and return the `id` field when `type === "session"` and `id` is a non-empty string.
5. Any IO error, JSON error, missing `type`, or empty `id` causes the level to be skipped (no exception escapes); on no-match return `null`.

### Modify `src/permission-forwarding.ts::resolvePermissionForwardingTargetSessionId`

- Add an optional `sessionDir?: string | null` field to the options bag.
- After the env-candidate loop fails, call `resolveParentSessionIdFromSessionDir(options.sessionDir)` and return its result.
- Env candidates retain first-match precedence; the session-directory fallback runs only when every candidate is empty or `"unknown"`.

### Modify `src/forwarded-permissions/polling.ts::waitForForwardedPermissionApproval`

- Pass `sessionDir: ctx.sessionManager.getSessionDir()` into the options bag.
- Update the `permission_forwarding.error` log message to state that the session-directory fallback was also tried, so the diagnostic remains accurate when both paths miss.

### Documentation

Extend `docs/architecture/architecture.md` § "Parent-session resolution" with a sub-section describing the session-directory fallback and its bounded walk.

## Module-Level Changes

| File | Change |
| --- | --- |
| `src/parent-session-discovery.ts` | New module |
| `src/permission-forwarding.ts` | Add `sessionDir` option; chain to new helper after env loop |
| `src/forwarded-permissions/polling.ts` | Pass `sessionDir` from `ctx.sessionManager`; update error log text |
| `tests/parent-session-discovery.test.ts` | New file — tmp-dir fixtures for happy path, nested walk-up, malformed JSONL, root reached |
| `tests/permission-forwarding.test.ts` | New tests for `sessionDir` option (env-precedence, tmp-dir success, undefined no-op) |
| `docs/architecture/architecture.md` | Document the session-directory fallback |
| `docs/plans/0143-session-dir-fallback.md` | This plan |

## TDD Steps

1. Plan (this file).
2. Tests for `resolveParentSessionIdFromSessionDir` (red).
3. Implement `resolveParentSessionIdFromSessionDir` (green).
4. Tests for extended `resolvePermissionForwardingTargetSessionId` with `sessionDir` option (red).
5. Implement the option + `polling.ts` wiring + error-log update (green).
6. Update architecture doc.
7. `pnpm run check` (build + lint:all + test) — full suite, not just affected files, because `permission-forwarding.ts` is widely imported.

## Risk and Backout

The session-directory fallback runs only on the path where forwarding currently fails (no env candidate set), so the worst-case outcome compared to today is unchanged behaviour: forwarding still cannot resolve and the same denial path runs.
Backout is reverting the polling.ts and permission-forwarding.ts edits; the new module stands alone and has no other callers.
