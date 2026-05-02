---
issue: 13
issue_title: "Consolidate duplicate session_start handlers in index.ts"
---

# Consolidate duplicate session\_start handlers

## Problem Statement

`src/index.ts` registers two `session_start` event handlers (lines ~1566 and ~1584) that perform identical setup work.
The only difference is that the first handler also logs a `lifecycle.reload` debug entry when `event.reason === "reload"`.
Every startup side effect therefore runs **twice** per session start, and contributors must remember to update both handlers or behaviour silently diverges.
This is documented as a known caveat in `AGENTS.md` under "Runtime Caveats".

## Goals

- Merge the two `session_start` handlers into a single handler that preserves the `lifecycle.reload` debug log branch.
- Ensure startup side effects execute exactly once per session start.
- Remove the "Runtime Caveats" note from `AGENTS.md` since the workaround is no longer needed.

## Non-Goals

- Refactoring other event handlers (`resources_discover`, `agent_start`, etc.) — out of scope.
- Extracting the shared setup into a named helper function — nice-to-have but not required by the issue; defer unless the single handler is unwieldy.

## Background

- **Origin:** discovered during the #6 retro (`docs/retro/0006-log-resolved-config-paths.md`), where `logResolvedConfigPaths()` had to be added to both handlers.
- **Permission surface:** none — this is a pure lifecycle/startup concern with no policy semantics.
- **Affected file:** `src/index.ts` only (plus `AGENTS.md` docs).

The two handlers currently share these calls:

```typescript
runtimeContext = ctx;
refreshExtensionConfig(ctx);
permissionManager = createPermissionManagerForCwd(ctx.cwd);
invalidateAgentStartCache();
lastKnownActiveAgentName = getActiveAgentName(ctx);
startForwardedPermissionPolling(ctx);
logResolvedConfigPaths();
```

Handler 1 additionally includes:

```typescript
if (event.reason === "reload") {
  writeDebugLog("lifecycle.reload", {
    triggeredBy: "session_start",
    reason: event.reason,
    cwd: ctx.cwd,
  });
}
```

Handler 2 has no unique logic.

## Design Overview

Delete the second `pi.on("session_start", ...)` block entirely.
The first handler already contains every statement from the second plus the reload branch — no merging of logic is needed, only deletion of the duplicate.

No types, schemas, or config surfaces change.

## Module-Level Changes

| File | Change |
| --- | --- |
| `src/index.ts` | Remove the second `session_start` handler (currently lines ~1584–1592). |
| `AGENTS.md` | Remove the "Runtime Caveats" section that documents the dual-handler workaround. |

## TDD Order

1. **Red → Green:** add a test (or manual verification script) that asserts `session_start` side effects run exactly once per event.
   Surface: integration/event lifecycle.
   Commit: `test: verify session_start side effects run once`

2. **Green → Refactor:** delete the duplicate handler in `src/index.ts`.
   Commit: `fix: consolidate duplicate session_start handlers (#13)`

3. **Docs:** remove the "Runtime Caveats" section from `AGENTS.md`.
   Commit: `docs: remove dual-handler caveat from AGENTS.md (#13)`

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Could this silently weaken a permission? | No — no permission decisions are made in the `session_start` handler; it only initialises the `PermissionManager` and caches. Running setup once is strictly more correct than running it twice. |
| Removing the wrong handler loses the reload log | The plan explicitly keeps handler 1 (which contains the reload branch) and deletes handler 2 (which is a strict subset). Review the diff to confirm. |
| Future contributors re-introduce a second handler | The `AGENTS.md` caveat removal eliminates the "keep both in sync" instruction, so there is no longer guidance that implies two handlers are expected. |

## Open Questions

- **Extract a named helper?** If future issues add more `session_start` work, extracting `initializeSession(event, ctx)` would improve readability. Defer unless the single handler grows beyond ~15 lines.
