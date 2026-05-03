---
issue: 21
issue_title: "Split src/index.ts (1,983 lines) into focused modules"
---

# Split src/index.ts into focused modules

## Problem Statement

`src/index.ts` is ~1,973 lines and houses at least seven distinct concerns beyond the extension factory that is its actual responsibility.
AGENTS.md requires "one concern per file in `src/`" — `index.ts` is the last major outlier.

## Goals

- Mechanically extract cohesive groups of functions into new focused modules.
- Reduce `src/index.ts` to ~300 lines containing only the extension factory, event handlers, and lifecycle wiring.
- Preserve all existing behavior — no observable change from the test suite.

## Non-Goals

- Splitting `tests/permission-system.test.ts` (follow-up if needed).
- Adding new tests for the extracted modules (existing test coverage via `index.ts` integration tests is sufficient; new unit tests are optional follow-ups).
- Behavior changes of any kind.

## Background

### Dependency status

|Issue|Title|Status|Relevance|
|-|-|-|-|
|#10|Consolidate config layout|Closed/implemented|Was a prerequisite — no longer blocks.|
|#20|Delete permission-request event channel|Closed/implemented|Removed `emitPermissionRequestEvent` and related types, reducing `index.ts` slightly.|

### Current content of src/index.ts (~1,973 lines)

The file currently contains these function/constant groups beyond the extension factory:

1. **Active-agent detection** (~50 lines): `ACTIVE_AGENT_TAG_REGEX`, `normalizeAgentName`, `getActiveAgentName`, `getActiveAgentNameFromSystemPrompt`.
2. **External-directory / path utilities** (~70 lines): `PATH_BEARING_TOOLS`, `normalizePathForComparison`, `isPathWithinDirectory`, `getPathBearingToolPath`, `isPathOutsideWorkingDirectory`.
3. **Permission prompt formatting** (~250 lines): `formatMissingToolNameReason`, `formatUnknownToolReason`, `formatPermissionHardStopHint`, `formatDenyReason`, `formatUserDeniedReason`, `formatAskPrompt`, `formatSkillAskPrompt`, `formatSkillPathAskPrompt`, `formatSkillPathDenyReason`, `formatExternalDirectoryHardStopHint`, `formatExternalDirectoryAskPrompt`, `formatExternalDirectoryDenyReason`, `formatExternalDirectoryUserDeniedReason`.
4. **Tool-input preview / text utilities** (~120 lines): `TOOL_INPUT_PREVIEW_MAX_LENGTH`, `TOOL_INPUT_LOG_PREVIEW_MAX_LENGTH`, `TOOL_TEXT_SUMMARY_MAX_LENGTH`, `truncateInlineText`, `sanitizeInlineText`, `countTextLines`, `formatCount`, `getPromptPath`, `formatEditInputForPrompt`, `formatWriteInputForPrompt`, `formatReadInputForPrompt`, `formatSearchInputForPrompt`, `serializeToolInputPreview`, `formatJsonInputForPrompt`, `formatToolInputForPrompt`, `formatGenericToolInputForLog`, `getToolInputPreviewForLog`, `getPermissionLogContext`.
5. **Subagent context** (~25 lines): `normalizeFilesystemPath`, `isSubagentExecutionContext`.
6. **Forwarded-permission file IO** (~180 lines): `sleep`, `formatUnknownErrorMessage`, `isErrnoCode`, `logPermissionForwardingWarning`, `logPermissionForwardingError`, `ensureDirectoryExists`, `getPermissionForwardingLocationForSession`, `ensurePermissionForwardingLocation`, `getExistingPermissionForwardingLocation`, `tryRemoveDirectoryIfEmpty`, `cleanupPermissionForwardingLocationIfEmpty`, `safeDeleteFile`, `writeJsonFileAtomic`, `readForwardedPermissionRequest`, `readForwardedPermissionResponse`.
7. **Forwarded-permission polling + confirmation** (~180 lines): `formatForwardedPermissionPrompt`, `waitForForwardedPermissionApproval`, `processForwardedPermissionRequests`, `confirmPermission`.
8. **Misc helpers** (~30 lines): `extractSkillNameFromInput`, `getEventToolName`, `getEventInput`, `getContextSystemPrompt`, `getSessionId`, `canRequestPermissionConfirmation`, `derivePiProjectPaths`, `createPermissionManagerForCwd`.

### Permission surfaces affected

None — pure refactor.

## Design Overview

### New module layout

|New file|Concern|Approx lines|
|-|-|-|
|`src/active-agent.ts`|Agent name extraction from session metadata and system prompt|~50|
|`src/external-directory.ts`|Path normalization, outside-cwd detection, `PATH_BEARING_TOOLS`, external-directory format helpers|~100|
|`src/permission-prompts.ts`|All `format*` helpers for ask/deny/user-denied prompts|~180|
|`src/tool-input-preview.ts`|Text utilities and tool-input formatting for prompts and logs|~130|
|`src/subagent-context.ts`|`isSubagentExecutionContext`, `normalizeFilesystemPath`|~30|
|`src/forwarded-permissions/io.ts`|Atomic JSON write, request/response read, directory ensure/cleanup, error helpers|~200|
|`src/forwarded-permissions/polling.ts`|`waitForForwardedPermissionApproval`, `processForwardedPermissionRequests`, `confirmPermission`|~200|

`src/index.ts` retains:

- Imports from the new modules and existing ones.
- `piPermissionSystemExtension` factory (the default export).
- Event handler registrations (`session_start`, `resources_discover`, `session_shutdown`, `before_agent_start`, `input`, `tool_call`).
- Closure-scoped lifecycle state (`permissionManager`, `runtimeContext`, `activeSkillEntries`, forwarding timer, agent-start cache keys).
- `refreshExtensionConfig`, `saveExtensionConfig`, `resolveAgentName`, `shouldExposeTool`, `logResolvedConfigPaths`, inline `reviewPermissionDecision`, `promptPermission`, `startForwardedPermissionPolling`, `stopForwardedPermissionPolling` (these are closures over extension state and belong in the factory).

A few small helpers (`extractSkillNameFromInput`, `getEventToolName`, `getEventInput`, `getContextSystemPrompt`, `getSessionId`, `canRequestPermissionConfirmation`, `derivePiProjectPaths`, `createPermissionManagerForCwd`) either move into a relevant module or stay in `index.ts` if they're tightly coupled to the factory's closure.

### Module dependency direction

```text
index.ts
  ├── active-agent.ts
  ├── external-directory.ts
  ├── permission-prompts.ts
  │     └── tool-input-preview.ts
  ├── subagent-context.ts
  └── forwarded-permissions/
        ├── io.ts
        └── polling.ts  (imports io.ts)
```

No new module imports from `index.ts` — dependency flows one way (index → modules).

### Export strategy

Each new module exports only the functions and constants that `index.ts` (or sibling modules) actually reference.
Types used across module boundaries (e.g., `PermissionReviewSource`) are exported from the module that defines them or moved to `src/types.ts` if shared by 3+ modules.

### Module-scope constant rule

Per AGENTS.md, `getAgentDir()` must not be cached at module scope.
The extracted modules receive directory values as parameters; `index.ts` calls `getAgentDir()` at invocation time inside closures (no change from current behavior).
Constants like `ACTIVE_AGENT_TAG_REGEX`, `PATH_BEARING_TOOLS`, and length limits are safe at module scope since they do not depend on the environment.

## Module-Level Changes

### Added

|File|Content|
|-|-|
|`src/active-agent.ts`|`ACTIVE_AGENT_TAG_REGEX`, `normalizeAgentName`, `getActiveAgentName`, `getActiveAgentNameFromSystemPrompt`|
|`src/external-directory.ts`|`PATH_BEARING_TOOLS`, `normalizePathForComparison`, `isPathWithinDirectory`, `getPathBearingToolPath`, `isPathOutsideWorkingDirectory`, `formatExternalDirectoryHardStopHint`, `formatExternalDirectoryAskPrompt`, `formatExternalDirectoryDenyReason`, `formatExternalDirectoryUserDeniedReason`|
|`src/permission-prompts.ts`|`formatMissingToolNameReason`, `formatUnknownToolReason`, `formatPermissionHardStopHint`, `formatDenyReason`, `formatUserDeniedReason`, `formatAskPrompt`, `formatSkillAskPrompt`, `formatSkillPathAskPrompt`, `formatSkillPathDenyReason`|
|`src/tool-input-preview.ts`|`truncateInlineText`, `sanitizeInlineText`, `countTextLines`, `formatCount`, `getPromptPath`, `formatEditInputForPrompt`, `formatWriteInputForPrompt`, `formatReadInputForPrompt`, `formatSearchInputForPrompt`, `serializeToolInputPreview`, `formatJsonInputForPrompt`, `formatToolInputForPrompt`, `formatGenericToolInputForLog`, `getToolInputPreviewForLog`, `getPermissionLogContext`, length constants|
|`src/subagent-context.ts`|`normalizeFilesystemPath`, `isSubagentExecutionContext`|
|`src/forwarded-permissions/io.ts`|`sleep`, `formatUnknownErrorMessage`, `isErrnoCode`, `logPermissionForwardingWarning`, `logPermissionForwardingError`, `ensureDirectoryExists`, `getPermissionForwardingLocationForSession`, `ensurePermissionForwardingLocation`, `getExistingPermissionForwardingLocation`, `tryRemoveDirectoryIfEmpty`, `cleanupPermissionForwardingLocationIfEmpty`, `safeDeleteFile`, `writeJsonFileAtomic`, `readForwardedPermissionRequest`, `readForwardedPermissionResponse`|
|`src/forwarded-permissions/polling.ts`|`formatForwardedPermissionPrompt`, `waitForForwardedPermissionApproval`, `processForwardedPermissionRequests`, `confirmPermission`|

### Changed

|File|Change|
|-|-|
|`src/index.ts`|Remove extracted functions/constants; add imports from new modules; target ~300 lines|
|`src/types.ts`|Add `PermissionReviewSource` type if needed by 3+ modules (currently only used in `index.ts` — may stay there)|

### Unchanged

All existing modules (`src/permission-manager.ts`, `src/bash-filter.ts`, `src/wildcard-matcher.ts`, `src/system-prompt-sanitizer.ts`, `src/skill-prompt-sanitizer.ts`, `src/extension-config.ts`, etc.) and test files are not modified.

## TDD Order

Since this is a pure mechanical refactor with no behavior change, the cycle is extract → verify → commit.
Existing tests must pass after each step without modification (other than import path adjustments if tests import directly from `index.ts`).

1. **Extract `src/active-agent.ts`** — move agent-name detection functions.
   Verify: `npm run build && npm test`.
   Commit: `refactor: extract active-agent detection into src/active-agent.ts (#21)`

2. **Extract `src/subagent-context.ts`** — move subagent detection helpers.
   Verify: `npm run build && npm test`.
   Commit: `refactor: extract subagent context into src/subagent-context.ts (#21)`

3. **Extract `src/tool-input-preview.ts`** — move text utilities and tool-input formatters.
   Verify: `npm run build && npm test`.
   Commit: `refactor: extract tool-input preview into src/tool-input-preview.ts (#21)`

4. **Extract `src/external-directory.ts`** — move path utilities and external-directory format helpers.
   Verify: `npm run build && npm test`.
   Commit: `refactor: extract external-directory logic into src/external-directory.ts (#21)`

5. **Extract `src/permission-prompts.ts`** — move ask/deny/user-denied prompt formatters (imports `tool-input-preview.ts`).
   Verify: `npm run build && npm test`.
   Commit: `refactor: extract permission prompts into src/permission-prompts.ts (#21)`

6. **Extract `src/forwarded-permissions/io.ts`** — move file IO, directory management, and error helpers.
   Verify: `npm run build && npm test`.
   Commit: `refactor: extract forwarded-permission IO into src/forwarded-permissions/io.ts (#21)`

7. **Extract `src/forwarded-permissions/polling.ts`** — move polling loop and `confirmPermission`.
   Verify: `npm run build && npm test`.
   Commit: `refactor: extract forwarded-permission polling into src/forwarded-permissions/polling.ts (#21)`

8. **Final cleanup** — remove any dead imports from `index.ts`, verify line count ≤ 300, run full lint.
   Verify: `npm run build && npm run lint:all && npm test`.
   Commit: `refactor: finalize index.ts split (#21)`

## Risks and Mitigations

|Risk|Mitigation|
|-|-|
|Could this silently weaken a permission?|No — pure refactor moves functions without changing logic. Every step verifies `npm test` passes, and the test suite covers tool/bash/mcp/skill/special/external-directory permission decisions.|
|Circular dependency between new modules|Dependency flows one way (index → modules → shared types). No module imports from `index.ts`. `tool-input-preview.ts` is imported by `permission-prompts.ts` only.|
|Module-scope caching of `getAgentDir()`|Extracted modules receive directory paths as parameters. `getAgentDir()` is called only in `index.ts` closures at invocation time, matching the existing pattern and the AGENTS.md rule.|
|Import path breaks in tests|Only two test files import from `index.ts` (`tests/permission-system.test.ts`, `tests/session-start.test.ts`), both importing only the default export `piPermissionSystemExtension`, which remains in `index.ts`.|
|Forwarded-permission closures depend on logger state|`logPermissionForwardingWarning` and `logPermissionForwardingError` reference the module-scoped logger. These helpers move to `forwarded-permissions/io.ts` and continue importing from `src/logging.ts` — no change in behavior.|

## Open Questions

- **Should `PermissionReviewSource` move to `src/types.ts`?** Currently only used in `index.ts`. Defer until a second module needs it.
- **Should `extractSkillNameFromInput` move to `src/skill-prompt-sanitizer.ts`?** It's closely related but currently only called in the `input` event handler. Defer to keep this change mechanical.
- **Unit tests for extracted modules?** Not required by the issue. Consider as a follow-up if the extracted modules gain independent consumers.
