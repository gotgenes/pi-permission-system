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
- Reduce `src/index.ts` line count by moving all extractable module-scope functions out.
- Preserve all existing behavior — no observable change from the test suite.
- Add unit tests for the newly extracted modules and the pre-existing focused modules that lack them, using dependency injection and vitest mocks to test each module in isolation.

## Non-Goals

- Behavior changes of any kind.
- Restructuring the `piPermissionSystemExtension` factory or its closure-scoped helpers (they are inherently coupled to extension lifecycle state).

## Background

### Dependency status

|Issue|Title|Status|Relevance|
|-|-|-|-|
|#10|Consolidate config layout|Closed/implemented|Was a prerequisite — no longer blocks.|
|#20|Delete permission-request event channel|Closed/implemented|Removed `emitPermissionRequestEvent` and related types, reducing `index.ts` slightly.|

### What was in src/index.ts (~1,973 lines)

The file contained these function/constant groups beyond the extension factory:

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

### Test coverage gap

Before this issue, the entire `src/index.ts` — and every pre-existing focused module that was *already* extracted (`bash-filter.ts`, `wildcard-matcher.ts`, `system-prompt-sanitizer.ts`, `skill-prompt-sanitizer.ts`, `permission-manager.ts`, etc.) — was tested exclusively through 2 integration test files:

|File|Tests|Lines|
|-|-|-|
|`tests/permission-system.test.ts`|68|2,490|
|`tests/session-start.test.ts`|2|114|

These are flat lists of `test()` calls (no `describe()` grouping) that exercise the full `piPermissionSystemExtension` factory end-to-end via a mock `ExtensionAPI`.
The modules listed below have **no dedicated unit test file** at all:

- `src/active-agent.ts` (58 lines) — newly extracted
- `src/bash-filter.ts` (51 lines) — pre-existing
- `src/before-agent-start-cache.ts` (44 lines) — pre-existing
- `src/common.ts` (88 lines) — pre-existing
- `src/external-directory.ts` (113 lines) — newly extracted
- `src/logging.ts` (118 lines) — pre-existing
- `src/permission-dialog.ts` (89 lines) — pre-existing
- `src/permission-forwarding.ts` (126 lines) — pre-existing
- `src/permission-manager.ts` (941 lines) — pre-existing
- `src/permission-prompts.ts` (131 lines) — newly extracted
- `src/skill-prompt-sanitizer.ts` (344 lines) — pre-existing
- `src/status.ts` (35 lines) — pre-existing
- `src/subagent-context.ts` (52 lines) — newly extracted
- `src/system-prompt-sanitizer.ts` (210 lines) — pre-existing
- `src/tool-input-preview.ts` (206 lines) — newly extracted
- `src/tool-registry.ts` (139 lines) — pre-existing
- `src/wildcard-matcher.ts` (84 lines) — pre-existing
- `src/yolo-mode.ts` (29 lines) — pre-existing
- `src/forwarded-permissions/io.ts` (328 lines) — newly extracted
- `src/forwarded-permissions/polling.ts` (334 lines) — newly extracted

### Design challenges still in index.ts

After extraction, `src/index.ts` is ~970 lines.
The factory function itself is ~740 lines because it owns:

1. **Module-scope mutable state** — `extensionConfig`, `extensionLogger`, `loggingWarningReporter`, and `reportedLoggingWarnings` live outside the factory. The factory writes to them via `setExtensionConfig` / `setLoggingWarningReporter` and every extracted module that needs logging receives it via setter injection (`setForwardedPermissionLogger`). This works but creates hidden temporal coupling: callers must call the setter before any logging function is invoked.

2. **Module-scope constants derived from `getAgentDir()`** — `PI_AGENT_DIR`, `SESSIONS_DIR`, `SUBAGENT_SESSIONS_DIR`, `PERMISSION_FORWARDING_DIR`, and `GLOBAL_LOGS_DIR` are all computed at import time, which violates the AGENTS.md rule *"Do not cache `getAgentDir()` at module scope."* They happen to work because `getAgentDir()` returns a stable value in production, but they make the module difficult to test in isolation (tests set `PI_CODING_AGENT_DIR` after import).

3. **Closure-scoped helpers that could be pure** — `refreshExtensionConfig`, `saveExtensionConfig`, `resolveAgentName`, `shouldExposeTool`, `logResolvedConfigPaths`, `reviewPermissionDecision`, `promptPermission`, `startForwardedPermissionPolling`, and `stopForwardedPermissionPolling` are all closures over `permissionManager`, `runtimeContext`, `extensionConfig`, and the forwarding timer. Some of these (e.g., `resolveAgentName`, `shouldExposeTool`) could be pure functions if given their dependencies as parameters; others (e.g., `startForwardedPermissionPolling`) genuinely need mutable timer state.

4. **Six event handlers inline** — `session_start`, `resources_discover`, `session_shutdown`, `before_agent_start`, `input`, and `tool_call` are defined inline as lambdas inside the factory. The `tool_call` handler alone is ~250 lines. These could be separate named functions that receive a context object with the shared state.

Addressing these is out of scope for this issue (pure refactor) but would be the next step toward a testable, sub-300-line `index.ts`.

## Design Overview

### New module layout (implemented)

|New file|Concern|Actual lines|
|-|-|-|
|`src/active-agent.ts`|Agent name extraction from session metadata and system prompt|58|
|`src/external-directory.ts`|Path normalization, outside-cwd detection, `PATH_BEARING_TOOLS`, external-directory format helpers|113|
|`src/permission-prompts.ts`|All `format*` helpers for ask/deny/user-denied prompts|131|
|`src/tool-input-preview.ts`|Text utilities and tool-input formatting for prompts and logs|206|
|`src/subagent-context.ts`|`isSubagentExecutionContext`, `normalizeFilesystemPath`|52|
|`src/forwarded-permissions/io.ts`|Atomic JSON write, request/response read, directory ensure/cleanup, error helpers, logger setter|328|
|`src/forwarded-permissions/polling.ts`|`waitForForwardedPermissionApproval`, `processForwardedPermissionRequests`, `confirmPermission`, `getSessionId`, `getContextSystemPrompt`, `formatForwardedPermissionPrompt`, `PermissionForwardingDeps`|334|

`src/index.ts` retains (~970 lines):

- Imports from the new modules and existing ones.
- Module-scope logging state and helpers (`extensionConfig`, `extensionLogger`, `writeDebugLog`, `writeReviewLog`, etc.).
- Module-scope constants (`PI_AGENT_DIR`, `SESSIONS_DIR`, etc.).
- Small helpers tightly coupled to module state (`extractSkillNameFromInput`, `getEventToolName`, `getEventInput`, `canRequestPermissionConfirmation`, `derivePiProjectPaths`, `createPermissionManagerForCwd`).
- `piPermissionSystemExtension` factory (the default export) with closure-scoped helpers and six event handlers.

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
        └── polling.ts  (imports io.ts, active-agent.ts, subagent-context.ts)
```

No new module imports from `index.ts` — dependency flows one way (index → modules).

### Dependency injection patterns used

- `isSubagentExecutionContext(ctx, subagentSessionsDir)` — takes the directory as a parameter instead of reading a module-scope constant.
- `getToolInputPreviewForLog(result, input, pathBearingTools)` / `getPermissionLogContext(result, input, pathBearingTools)` — receive the `PATH_BEARING_TOOLS` set as a parameter.
- `ensurePermissionForwardingLocation(forwardingDir, sessionId)` / `getExistingPermissionForwardingLocation(forwardingDir, sessionId)` — receive the forwarding directory as a parameter.
- `setForwardedPermissionLogger({ writeReviewLog, writeDebugLog })` — setter injection for the IO module's logger.
- `PermissionForwardingDeps` — context object passed to `confirmPermission`, `processForwardedPermissionRequests`, and `waitForForwardedPermissionApproval` carrying `forwardingDir`, `subagentSessionsDir`, `writeReviewLog`, `requestPermissionDecisionFromUi`, and `shouldAutoApprove`.

### Testing strategy: dependency injection and vitest mocks

Every module has collaborators — other modules it imports and calls.
Unit tests should verify each module in isolation by mocking its collaborators with `vi.mock()` and, where needed, `vi.fn()` / `vi.spyOn()`.
This ensures tests exercise the module's own logic and boundary conditions without coupling to the real behavior of dependencies.

**Guiding principles:**

1. **Mock collaborators, not the module under test.** If `permission-prompts.ts` imports `formatToolInputForPrompt` from `tool-input-preview.ts`, the permission-prompts tests mock `tool-input-preview.ts` and verify that the prompts module calls it with the right arguments and uses its return value correctly.
2. **Use `vi.mock()` for module-level imports.** Vitest hoists `vi.mock()` calls so the module under test receives mocked versions of its dependencies at import time.
3. **Use `vi.fn()` for injected function dependencies.** When a function takes a callback or deps object (e.g., `PermissionForwardingDeps`), pass `vi.fn()` stubs and assert they were called correctly.
4. **Mock `ExtensionContext` as a plain object.** The Pi `ExtensionContext` is an interface — tests construct minimal objects satisfying only the properties the module actually reads (e.g., `{ sessionManager: { getEntries: vi.fn() } }`).
5. **Mock filesystem operations.** Modules that use `node:fs` (`forwarded-permissions/io.ts`) should have `node:fs` mocked via `vi.mock("node:fs")` so tests never touch the real filesystem.
6. **Restore mocks between tests.** Use `afterEach(() => { vi.restoreAllMocks(); })` to prevent test pollution.

**Example pattern for a module with collaborators:**

```typescript
import { describe, expect, test, vi, afterEach } from "vitest";

// Mock the collaborator module before importing the module under test.
vi.mock("../tool-input-preview.js", () => ({
  formatToolInputForPrompt: vi.fn(() => "mocked preview"),
}));

import { formatAskPrompt } from "../src/permission-prompts.js";
import { formatToolInputForPrompt } from "../src/tool-input-preview.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatAskPrompt", () => {
  test("includes tool input preview for non-bash tools", () => {
    const result = formatAskPrompt(
      { toolName: "read", state: "ask", source: "tool" },
      "my-agent",
      { path: "/foo" },
    );
    expect(formatToolInputForPrompt).toHaveBeenCalledWith("read", { path: "/foo" });
    expect(result).toContain("mocked preview");
  });
});
```

### Export strategy

Each new module exports only the functions and constants that `index.ts` (or sibling modules) actually reference.
`PermissionReviewSource` stays in `index.ts` as it is only used there.

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
|`src/forwarded-permissions/io.ts`|`sleep`, `formatUnknownErrorMessage`, `isErrnoCode`, `logPermissionForwardingWarning`, `logPermissionForwardingError`, `ensureDirectoryExists`, `getPermissionForwardingLocationForSession`, `ensurePermissionForwardingLocation`, `getExistingPermissionForwardingLocation`, `tryRemoveDirectoryIfEmpty`, `cleanupPermissionForwardingLocationIfEmpty`, `safeDeleteFile`, `writeJsonFileAtomic`, `readForwardedPermissionRequest`, `readForwardedPermissionResponse`, `listRequestFiles`, `setForwardedPermissionLogger`, `ForwardedPermissionLogger`|
|`src/forwarded-permissions/polling.ts`|`getSessionId`, `getContextSystemPrompt`, `formatForwardedPermissionPrompt`, `waitForForwardedPermissionApproval`, `processForwardedPermissionRequests`, `confirmPermission`, `PermissionForwardingDeps`|

### Changed

|File|Change|
|-|-|
|`src/index.ts`|Removed extracted functions/constants; added imports from new modules; reduced from ~1,973 to ~970 lines|

### Unchanged

All pre-existing modules (`src/permission-manager.ts`, `src/bash-filter.ts`, `src/wildcard-matcher.ts`, `src/system-prompt-sanitizer.ts`, `src/skill-prompt-sanitizer.ts`, `src/extension-config.ts`, etc.) and test files are not modified.

## TDD Order

### Phase 1: Extract modules (steps 1–8, completed)

Since this was a pure mechanical refactor with no behavior change, the cycle was extract → verify → commit.
Existing tests passed after each step without modification.

1. ✅ **Extract `src/active-agent.ts`** — move agent-name detection functions.
   Commit: `refactor: extract active-agent detection into src/active-agent.ts (#21)`

2. ✅ **Extract `src/subagent-context.ts`** — move subagent detection helpers.
   Commit: `refactor: extract subagent context into src/subagent-context.ts (#21)`

3. ✅ **Extract `src/tool-input-preview.ts`** — move text utilities and tool-input formatters.
   Commit: `refactor: extract tool-input preview into src/tool-input-preview.ts (#21)`

4. ✅ **Extract `src/external-directory.ts`** — move path utilities and external-directory format helpers.
   Commit: `refactor: extract external-directory logic into src/external-directory.ts (#21)`

5. ✅ **Extract `src/permission-prompts.ts`** — move ask/deny/user-denied prompt formatters (imports `tool-input-preview.ts`).
   Commit: `refactor: extract permission prompts into src/permission-prompts.ts (#21)`

6. ✅ **Extract `src/forwarded-permissions/io.ts`** — move file IO, directory management, and error helpers.
   Commit: `refactor: extract forwarded-permission IO into src/forwarded-permissions/io.ts (#21)`

7. ✅ **Extract `src/forwarded-permissions/polling.ts`** — move polling loop and `confirmPermission`.
   Commit: `refactor: extract forwarded-permission polling into src/forwarded-permissions/polling.ts (#21)`

8. ✅ **Final cleanup** — remove dead imports, fix lint warnings.
   Commit: `refactor: finalize index.ts split (#21)`

### Phase 2: Add unit tests (steps 9–20)

Each step adds a dedicated test file for a module that currently has no unit tests.
The goal is direct coverage of each module's exported functions in isolation — using `vi.mock()` to replace collaborator modules and `vi.fn()` for injected dependencies.
Tests exercise edge cases and boundary conditions that are hard to reach through the end-to-end factory tests.

Every test file should use `describe()` blocks to group tests by exported function, and `afterEach(() => { vi.restoreAllMocks(); })` to prevent cross-test pollution.

1. **`tests/wildcard-matcher.test.ts`** — test `compileWildcardPatternEntries`, `findCompiledWildcardMatch`, `findCompiledWildcardMatchForNames`.
   No collaborators to mock (pure algorithm).
   Cover: empty patterns, exact match, glob `*` matching, last-match-wins precedence, multi-name lookup, no-match returns null.
   Commit: `test: add unit tests for wildcard-matcher (#21)`

2. **`tests/common.test.ts`** — test `toRecord`, `getNonEmptyString`, `isPermissionState`, `extractFrontmatter`, `parseSimpleYamlMap`.
    No collaborators to mock (pure functions).
    Cover: non-object inputs to `toRecord`, whitespace-only strings, all three permission states, malformed frontmatter delimiters, empty YAML map, multi-line values.
    Commit: `test: add unit tests for common (#21)`

3. **`tests/bash-filter.test.ts`** — test `BashFilter.check`.
    Mock: `vi.mock("./wildcard-matcher.js")` to verify `BashFilter` delegates pattern matching to the wildcard-matcher and applies the default fallback correctly.
    Cover: exact match, glob patterns, last-match-wins, default fallback for unmatched commands, empty command, whitespace normalization.
    Commit: `test: add unit tests for bash-filter (#21)`

4. **`tests/yolo-mode.test.ts`** — test `shouldAutoApprovePermissionState`, `canResolveAskPermissionRequest`.
    No collaborators to mock (pure functions taking config/flags).
    Cover: yolo on/off × ask/allow/deny, subagent with no UI and yolo off, subagent with no UI and yolo on.
    Commit: `test: add unit tests for yolo-mode (#21)`

5. **`tests/tool-input-preview.test.ts`** — test all exported formatters and `getPermissionLogContext`.
    Mock: `vi.mock("./logging.js")` so `safeJsonStringify` returns controlled output — verifies the module delegates serialization to its collaborator and handles the result.
    Cover: truncation at exact boundary, multi-line content, empty input, edit with multiple replacements, path-bearing vs non-path-bearing tools in `getPermissionLogContext`.
    Commit: `test: add unit tests for tool-input-preview (#21)`

6. **`tests/external-directory.test.ts`** — test `normalizePathForComparison`, `isPathWithinDirectory`, `isPathOutsideWorkingDirectory`, `getPathBearingToolPath`, and format helpers.
    Mock: `vi.mock("node:os", () => ({ homedir: vi.fn(() => "/mock/home") }))` so tilde-expansion tests are deterministic and platform-independent.
    Cover: tilde expansion, relative paths, path-bearing vs non-path-bearing tools, empty strings, quoted paths, `@`-prefixed paths, format helpers with/without agent name.
    Commit: `test: add unit tests for external-directory (#21)`

7. **`tests/permission-prompts.test.ts`** — test all `format*` exported functions.
    Mock: `vi.mock("./tool-input-preview.js")` so `formatToolInputForPrompt` returns controlled strings — verifies `formatAskPrompt` calls the collaborator with the right tool name and input and incorporates the preview into the prompt string.
    Cover: with/without agent name, MCP target, bash command with/without matched pattern, denial reason, skill path deny/ask.
    Commit: `test: add unit tests for permission-prompts (#21)`

8. **`tests/active-agent.test.ts`** — test `normalizeAgentName`, `getActiveAgentName`, `getActiveAgentNameFromSystemPrompt`.
    Mock `ExtensionContext` as a plain object: `{ sessionManager: { getEntries: vi.fn(() => [...]) } }`.
    Cover: whitespace-only name, null, tag variations in system prompt, missing tag, session entries with `active_agent` custom type, last-entry-wins when multiple entries exist, entry with `name: null` resets.
    Commit: `test: add unit tests for active-agent (#21)`

9. **`tests/subagent-context.test.ts`** — test `isSubagentExecutionContext`, `normalizeFilesystemPath`.
    Mock `ExtensionContext` as a plain object: `{ sessionManager: { getSessionDir: vi.fn() } }`.
    Use `vi.stubEnv()` / `vi.unstubAllEnvs()` to control `SUBAGENT_ENV_HINT_KEYS` without leaking across tests.
    Cover: env variable detection (each of the 3 hint keys), session dir within/outside subagent root, missing session dir, empty env values.
    Commit: `test: add unit tests for subagent-context (#21)`

10. **`tests/tool-registry.test.ts`** — test `checkRequestedToolRegistration`, `getToolNameFromValue`.
    Mock: `vi.mock("./common.js")` to control `getNonEmptyString` / `toRecord` return values — verifies the registry delegates input parsing to its collaborators.
    Cover: registered tool, unregistered tool, missing tool name, event with `input` vs `arguments`, empty tool list.
    Commit: `test: add unit tests for tool-registry (#21)`

11. **`tests/system-prompt-sanitizer.test.ts`** — test `sanitizeAvailableToolsSection`.
    No collaborators to mock (pure string transformation).
    Cover: removing denied tools, preserving allowed tools, multi-section prompts, missing Available tools section, tool guidance blocks for inactive tools, empty allowed-tools list.
    Commit: `test: add unit tests for system-prompt-sanitizer (#21)`

12. **`tests/skill-prompt-sanitizer.test.ts`** — test `resolveSkillPromptEntries`, `findSkillPathMatch`.
    Mock `PermissionManager` as a plain object: `{ checkPermission: vi.fn() }` — verifies the sanitizer delegates permission checks to the manager and uses the returned state to decide whether to strip, keep, or mark skill blocks.
    Cover: skill allow/deny/ask, path matching within/outside skill directories, multi-skill prompts, no skill blocks in prompt.
    Commit: `test: add unit tests for skill-prompt-sanitizer (#21)`

## Risks and Mitigations

|Risk|Mitigation|
|-|-|
|Could this silently weaken a permission?|No — pure refactor moves functions without changing logic. Every step verifies `npm test` passes, and the test suite covers tool/bash/mcp/skill/special/external-directory permission decisions.|
|Circular dependency between new modules|Dependency flows one way (index → modules → shared types). No module imports from `index.ts`. `tool-input-preview.ts` is imported by `permission-prompts.ts` only.|
|Module-scope caching of `getAgentDir()`|Extracted modules receive directory paths as parameters. `getAgentDir()` is called only in `index.ts` closures at invocation time, matching the existing pattern and the AGENTS.md rule. Note: `index.ts` itself still caches `PI_AGENT_DIR` at module scope — this is a pre-existing violation, not introduced by this change.|
|Import path breaks in tests|Only two test files import from `index.ts` (`tests/permission-system.test.ts`, `tests/session-start.test.ts`), both importing only the default export `piPermissionSystemExtension`, which remains in `index.ts`.|
|Forwarded-permission closures depend on logger state|`forwarded-permissions/io.ts` uses a setter-injected logger (`setForwardedPermissionLogger`). The setter must be called before any IO function that logs. This is wired up in the factory before `refreshExtensionConfig()`.|
|Mocked unit tests could drift from real module contracts|Unit tests verify each module's contract with its collaborators (correct arguments passed, return values used). Integration tests in `permission-system.test.ts` continue to verify end-to-end wiring with real collaborators. Both must pass — mocks catch contract violations early, integration tests catch wiring mistakes.|
|Over-mocking hides real bugs|Mock only direct collaborators (one level deep). Never mock the module under test. If a test needs to mock more than 2–3 collaborators, that is a signal the module has too many responsibilities and should be split further.|

## Open Questions

- **Should `PermissionReviewSource` move to `src/types.ts`?** Currently only used in `index.ts`. Defer until a second module needs it.
- **Should `extractSkillNameFromInput` move to `src/skill-prompt-sanitizer.ts`?** It's closely related but currently only called in the `input` event handler. Defer to keep this change mechanical.
- **Should `permission-manager.ts` (941 lines) get its own unit test file?** It has complex logic (MCP target resolution, policy merge, caching) that would benefit from direct tests with `vi.mock("node:fs")` to control config file reads. Deferred — it would be a large effort and the integration tests cover the main paths. Consider as a separate issue.
- **Should the module-scope `PI_AGENT_DIR` constants be moved inside the factory?** This would fix the AGENTS.md rule violation but requires threading the values through more call sites. Consider as part of a future factory restructuring issue.
- **Should `forwarded-permissions/io.ts` replace setter injection with parameter injection?** The current `setForwardedPermissionLogger` pattern creates temporal coupling. An alternative is to pass the logger as a parameter to each function that logs (matching the `PermissionForwardingDeps` pattern in `polling.ts`). This would make the module fully stateless and easier to test without calling a setter first. Consider for a future cleanup.
