---
issue: 6
issue_title: "Log resolved config paths at startup so misconfiguration is debuggable"
---

# Log resolved config paths at startup

## Problem Statement

There is no way for a user to see which permission-config files the extension actually loaded.
When permissions do not work as expected, debugging requires reading source to figure out the search paths.
A single review-log entry listing all resolved paths and their existence status would unblock most debugging.

## Goals

- At extension startup (and on each `session_start`), emit a single `config.resolved` review-log entry listing every config path the extension considers and whether each file exists.
- Also emit the entry to the debug log when debug logging is enabled.
- Expose a `getResolvedConfigPaths()` method on `PermissionManager` so the path set is testable without IO side effects.
- The log entry appears regardless of whether any rules are ultimately matched.

## Non-Goals

- A `pi config`-style TUI view (mentioned in the issue as a bonus; separate work).
- Changing any policy semantics, merge precedence, or on-disk identity.
- Logging the *contents* of each config file (only paths and existence).

## Background

### Relevant modules

- `src/permission-manager.ts` — `PermissionManager` constructor receives `globalConfigPath`, `agentsDir`, `projectGlobalConfigPath`, `projectAgentsDir`, plus internally computes `legacyGlobalSettingsPath` and `globalMcpConfigPath`.
  The paths are stored as private fields but are not externally queryable.
- `src/extension-config.ts` — `CONFIG_PATH` is the extension's own `config.json`.
  `loadPermissionSystemConfig` loads it and returns a result with optional warning.
- `src/index.ts` — `piPermissionSystemExtension` wires everything together.
  `refreshExtensionConfig()` runs at module load and on every `session_start`.
  `createPermissionManagerForCwd()` constructs the `PermissionManager` with project-scoped paths derived from `ctx.cwd`.
- `src/logging.ts` — `PermissionSystemLogger.review()` and `.debug()` write structured JSONL lines.

### Permission surface

This is a **diagnostic/observability** concern.
No permission surface (tools / bash / mcp / skills / special / external_directory) is changed.
No policy semantics or merge precedence is affected.

### Prerequisites

- Issue #4 (warn on misplaced permission keys in `config.json`) is already implemented and closed.
  This plan builds on the same startup path but is independent.

## Design Overview

### Data shape

```typescript
interface ResolvedConfigPaths {
  extensionConfigPath: string;
  extensionConfigExists: boolean;
  globalConfigPath: string;
  globalConfigExists: boolean;
  projectConfigPath: string | null;
  projectConfigExists: boolean;
  agentsDir: string;
  agentsDirExists: boolean;
  projectAgentsDir: string | null;
  projectAgentsDirExists: boolean;
}
```

### New method on `PermissionManager`

Add a public `getResolvedConfigPaths(): ResolvedConfigPaths` method that returns the struct above.
It checks `existsSync` for each path (cheap, synchronous, already imported in the file).
The method is a pure query — no caching side effects.

`extensionConfigPath` is not owned by `PermissionManager`; it will be passed in by the caller (or injected via a new optional constructor option) since the extension config path lives in `extension-config.ts`.
To keep the method self-contained without adding a constructor dependency, the caller in `index.ts` will combine the `PermissionManager` paths with the extension config path when building the log entry.

Revised approach: add `getResolvedPolicyPaths()` to `PermissionManager` (returns only the policy-related paths it owns), and have the startup reporter in `index.ts` merge in the extension config path to produce the full `config.resolved` log entry.

```typescript
interface ResolvedPolicyPaths {
  globalConfigPath: string;
  globalConfigExists: boolean;
  projectConfigPath: string | null;
  projectConfigExists: boolean;
  agentsDir: string;
  agentsDirExists: boolean;
  projectAgentsDir: string | null;
  projectAgentsDirExists: boolean;
}
```

### Where the log entry is emitted

In `index.ts`, after `permissionManager` is (re)created in the `session_start` handler, call a new helper `logResolvedConfigPaths(permissionManager)` that:

1. Calls `permissionManager.getResolvedPolicyPaths()`.
2. Adds `extensionConfigPath` / `extensionConfigExists` from `CONFIG_PATH`.
3. Writes a single `config.resolved` entry to both `writeReviewLog` and `writeDebugLog`.

### Log entry format

```jsonc
{
  "event": "config.resolved",
  "extensionConfigPath": "/…/pi-permission-system/config.json",
  "extensionConfigExists": true,
  "globalConfigPath": "/…/.pi/agent/pi-permissions.jsonc",
  "globalConfigExists": false,
  "projectConfigPath": "/…/my-project/.pi/agent/pi-permissions.jsonc",
  "projectConfigExists": true,
  "projectConfigExists": true,
  "agentsDir": "/…/.pi/agent/agents",
  "agentsDirExists": true,
  "projectAgentsDir": "/…/my-project/.pi/agent/agents",
  "projectAgentsDirExists": false
}
```

### Edge cases

- `projectConfigPath` and `projectAgentsDir` are `null` when no `cwd` is available — logged as `null` with `*Exists: false`.
- Extension config file missing (first run, `ensurePermissionSystemConfig` creates it) — `extensionConfigExists` reflects state *after* the ensure step, so it will be `true`.
- Multiple `session_start` events (reload) — the entry is emitted each time, which is correct since `cwd` and thus project paths may change.

## Module-Level Changes

### `src/permission-manager.ts`

1. Add `ResolvedPolicyPaths` interface (exported).
2. Add public `getResolvedPolicyPaths(): ResolvedPolicyPaths` method that returns the five path pairs using `existsSync`.

### `src/index.ts`

1. Import `existsSync` (already imported) and `CONFIG_PATH` (already imported).
2. Add `logResolvedConfigPaths(pm: PermissionManager): void` helper that assembles the full entry and writes to both review and debug logs.
3. Call `logResolvedConfigPaths(permissionManager)` in the `session_start` handler after `permissionManager` is created.

### `tests/permission-manager.test.ts` (existing or new)

1. Add tests for `getResolvedPolicyPaths()` covering: all paths exist, none exist, mixed, null project paths.

### `tests/index.test.ts` or `tests/config-resolved-log.test.ts` (new)

1. Add tests for the log-entry assembly helper (if extracted as a pure function) or integration-level tests verifying the review log contains a `config.resolved` entry after startup.

### No changes needed

- `schemas/permissions.schema.json` — no policy-schema change.
- `config/config.example.json` — no extension-config change.
- `README.md` — could mention the diagnostic log entry, but optional and can be a follow-up.

## TDD Order

1. **Red:** test that `getResolvedPolicyPaths()` returns correct paths and existence flags when all policy files exist.
   `test: getResolvedPolicyPaths returns paths and existence when files exist`

2. **Green:** implement `ResolvedPolicyPaths` interface and `getResolvedPolicyPaths()` on `PermissionManager`.
   `feat: add getResolvedPolicyPaths to PermissionManager (#6)`

3. **Red:** test that `getResolvedPolicyPaths()` returns `*Exists: false` when files are missing and `null` for absent project paths.
   `test: getResolvedPolicyPaths handles missing files and null project paths`

4. **Green:** already passes from step 2 (or adjust).

5. **Red:** test the log-entry assembly helper produces the expected `config.resolved` shape combining extension config path with policy paths.
   `test: config.resolved log entry merges extension and policy paths`

6. **Green:** implement `buildResolvedConfigLogEntry()` helper in `index.ts` (or a small `src/config-reporter.ts` if warranted) and wire into `session_start`.
   `feat: emit config.resolved review-log entry at startup (#6)`

7. **Red:** integration test verifying the review log receives a `config.resolved` entry after a simulated startup sequence.
   `test: config.resolved entry appears in review log after session_start`

8. **Green:** already passes from step 6 (or adjust wiring).

9. **Docs:** mention the `config.resolved` log entry in `README.md` under a debugging/troubleshooting section.
   `docs: document config.resolved diagnostic log entry (#6)`

## Risks and Mitigations

| Risk | Mitigation |
| ---- | ---------- |
| `existsSync` on every `session_start` adds latency | Five synchronous `stat` calls are negligible; no mitigation needed. |
| Could this silently weaken a permission? | No — this change only *adds* a diagnostic log entry. Permission resolution logic is untouched. |
| Log entry leaks sensitive path information | Paths are already visible in the debug log and are user-controlled config locations; no new exposure. |
| `getResolvedPolicyPaths` exposes internal paths of `PermissionManager` | The paths are user-configured inputs, not secrets. Exposing them is the explicit goal. |
| Multiple `session_start` handlers already exist in `index.ts` | The log call will be added to the existing handler, not a new duplicate. |

## Open Questions

- Whether to extract the log-entry builder into a standalone `src/config-reporter.ts` module or keep it inline in `index.ts`.
  Decision can be made during implementation based on size.
