---
issue: 18
issue_title: "Drop unread special.tool_call_limit from permissions schema"
---

# Drop unread `special.tool_call_limit` from permissions schema

## Problem Statement

`schemas/permissions.schema.json` declares `special.tool_call_limit` with a `oneOf [permissionState, integer]` shape, but no runtime code reads it.
`SpecialPermissionName` in `src/types.ts` and `SPECIAL_PERMISSION_KEYS` in `src/permission-manager.ts` both omit `tool_call_limit`.
AGENTS.md is explicit: *"Treat any declared config field not read at runtime as a maintenance trap. Remove it or document its purpose."*

The field also appears in the `README.md` special-permissions table with the note *"schema only, not enforced yet"*.

## Goals

- Remove `special.tool_call_limit` from `schemas/permissions.schema.json`.
- Remove the `tool_call_limit` row from the `README.md` special-permissions table.
- Add a tolerant-loader deprecation warning: if a user's parsed policy contains `special.tool_call_limit`, emit a single non-fatal config issue per occurrence and discard the value.
- Add tests covering the deprecation warning path.

## Non-Goals

- Implementing a tool-call-limit feature.
  If we want one later, file a fresh issue with a real implementation, schema entry, example, and tests in lockstep.
- Changing any other permission surface or default policy state.

## Background

### Relevant modules

| File | Role |
| --- | --- |
| `schemas/permissions.schema.json` | Declares `special.tool_call_limit` — the field to remove. |
| `src/permission-manager.ts` | `normalizePermissionRecord()` already silently discards integer values (they fail the `isPermissionState` check). If the user writes `"tool_call_limit": "allow"`, it would survive normalization but is never read by `SPECIAL_PERMISSION_KEYS`. The deprecation warning needs to fire *before* the value is discarded. |
| `src/types.ts` | `SpecialPermissionName` does not include `tool_call_limit` — no change needed. |
| `config/config.example.json` | Does not reference `tool_call_limit` — no change needed. |
| `README.md` | Contains one row in the special-permissions table for `tool_call_limit` marked as *schema only, not enforced yet*. |

### Permission surface

`special` — but only the schema and docs are affected.
No runtime permission decisions change because the key was never read.

## Design Overview

### Schema change

Remove the `tool_call_limit` property from `special` in `schemas/permissions.schema.json`.
The `special` object retains `doom_loop` and `external_directory`.

### Deprecation warning

AGENTS.md's Configuration rules require:

> When removing a previously accepted config field, keep the loader tolerant: accept the legacy key, emit a single non-fatal config issue per occurrence describing the deprecation, and discard the value.

The right place to emit the warning is inside `normalizeRawPermission()` in `src/permission-manager.ts`, since that is the single normalization gateway for both global and per-agent configs.
Today it returns a plain `AgentPermissions` object with no side channel for warnings.

**Approach:** Add a `configIssues` array to the return type (or use a parallel mechanism) so callers can surface deprecation messages.
Concretely:

```typescript
interface NormalizeResult {
  permissions: AgentPermissions;
  configIssues: string[];
}
```

`normalizeRawPermission()` checks for `tool_call_limit` in the `special` sub-object of the raw input.
If found, it pushes a message like:

```text
special.tool_call_limit is deprecated and ignored — remove it from your policy file.
```

The value is discarded as today (integer values already fail `isPermissionState`; string values would be stripped from the normalized output explicitly).

The `configIssues` array is threaded up through `loadGlobalConfig()`, `loadProjectGlobalConfig()`, `loadAgentPermissions()`, and exposed via a new `getConfigIssues(agentName?)` method on `PermissionManager`.
The extension entry point (`src/index.ts`) already has a warning-notification path (`notifyWarning`) used for misplaced-key detection; the deprecation issues can be surfaced through the same channel.

### Merge precedence

No change — global → project → per-agent remains the same.
The deprecation warning fires independently at each layer that contains the key.

## Module-Level Changes

### `schemas/permissions.schema.json` — changed

Remove the `tool_call_limit` property (and its `oneOf` definition) from the `special` object.

### `src/permission-manager.ts` — changed

- Extend `normalizeRawPermission()` to return config issues alongside the normalized permissions (new `NormalizeResult` type or equivalent).
- Detect `tool_call_limit` in the raw `special` sub-object and push a deprecation message.
- Explicitly strip `tool_call_limit` from the normalized `special` record (currently happens implicitly for integer values but not for valid PermissionState strings).
- Thread config issues through the load methods and cache them.
- Add `getConfigIssues(agentName?): string[]` to `PermissionManager`.

### `src/index.ts` — changed

- After loading permissions, call `getConfigIssues()` and surface any messages through the existing `notifyWarning` path (same pattern as misplaced-key detection).

### `README.md` — changed

- Remove the `tool_call_limit` row from the `### special` permissions table.

### `tests/` — new or changed test file

- Test that `normalizeRawPermission` (or the new wrapper) emits a deprecation issue when `special.tool_call_limit` is present (both integer and string forms).
- Test that the normalized output does not contain `tool_call_limit` in `special`.
- Test that configs without `tool_call_limit` produce no deprecation issues.

## TDD Order

1. **Red: deprecation detection for `special.tool_call_limit`.**
   Write a test that calls the normalization function with `{ special: { tool_call_limit: 5 } }` and asserts a config-issue string is returned containing `"tool_call_limit"`.
   Write a second case with `{ special: { tool_call_limit: "allow" } }`.
   Write a third case with `{ special: { doom_loop: "deny" } }` asserting no issues.
   Commit: `test: cover tool_call_limit deprecation warning (#18)`

2. **Green: implement deprecation detection in normalizer.**
   Extend `normalizeRawPermission()` to return config issues.
   Detect and warn on `tool_call_limit`; explicitly strip it from the output.
   Commit: `feat: emit deprecation warning for special.tool_call_limit (#18)`

3. **Red → Green: `PermissionManager.getConfigIssues()` integration.**
   Write a test constructing a `PermissionManager` with a temp config containing `special.tool_call_limit` and assert `getConfigIssues()` returns the deprecation message.
   Implement `getConfigIssues()` on `PermissionManager` by threading issues through the load path.
   Commit: `feat: surface config issues from PermissionManager (#18)`

4. **Schema and docs cleanup.**
   Remove `tool_call_limit` from `schemas/permissions.schema.json`.
   Remove the `tool_call_limit` row from `README.md`.
   Commit: `docs: remove tool_call_limit from schema and README (#18)`

5. **Wire warning into extension entry point.**
   In `src/index.ts`, call `getConfigIssues()` during initialization and surface messages via `notifyWarning`.
   Commit: `feat: notify user of deprecated config fields at startup (#18)`

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| **Could this silently weaken a permission?** | No. `tool_call_limit` was never enforced — removing it changes zero runtime decisions. The deprecation warning makes the removal *more* visible, not less. |
| **Users with `tool_call_limit` in their config get a schema-validation error.** | The schema drops the field, but the loader remains tolerant: it parses with `stripJsonComments` + `JSON.parse`, not schema validation. The deprecation warning tells the user to remove it. |
| **On-disk identity change.** | None. Config directory, log filenames, `/permission-system` slash command, and event channel names are untouched. |
| **`normalizeRawPermission` return-type change ripples through callers.** | The change is internal to `permission-manager.ts`. All call sites are in the same file. The public API gains only an additive `getConfigIssues()` method. |

## Open Questions

None — the scope and approach are unambiguous.
