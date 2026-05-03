---
issue: 19
issue_title: "Drop legacy ~/.pi/agent/settings.json fallback for MCP server names"
---

# Drop legacy `~/.pi/agent/settings.json` fallback for MCP server names

## Problem Statement

`PermissionManager.getConfiguredMcpServerNames()` reads MCP server names from two paths: `mcp.json` and the legacy `settings.json` (Pi's own settings file).
The `settings.json` fallback reaches into another package's config file whose structure Pi can change at any time.
The supported MCP server config source is `mcp.json`, which the manager already reads.
Keeping the fallback creates a fragile coupling and a confusing second source of truth for MCP server name derivation.

## Goals

- Remove `defaultLegacyGlobalSettingsPath()` and all references to `legacyGlobalSettingsPath` from `src/permission-manager.ts`.
- Remove `legacyGlobalSettingsPath` from the `PermissionManager` constructor options.
- Keep `mcp.json` as the sole file-based source for derived MCP server names (the `mcpServerNames` override remains).
- Add a test confirming that server names in a `settings.json`-style file are **not** picked up.
- Verify no README or docs reference `settings.json` as a source for MCP server names (none found).

## Non-Goals

- Changing the MCP target derivation logic (`pushMcpToolPermissionTargets`, `addDerivedMcpServerTargets`, `createMcpPermissionTargets`).
- Changing how users configure MCP servers in Pi itself.
- Adding any new MCP config sources.

## Background

### Relevant modules

| File | Role |
| --- | --- |
| `src/permission-manager.ts` | Contains `defaultLegacyGlobalSettingsPath()`, the `legacyGlobalSettingsPath` field, and uses it in `getConfiguredMcpServerNames()`. This is the only file that references the legacy path. |
| `src/index.ts` | Constructs `PermissionManager` — does not pass `legacyGlobalSettingsPath`, so it gets the default. No changes needed. |
| `tests/permission-system.test.ts` | Tests use the `mcpServerNames` override, not the file-based lookup. No existing tests exercise the legacy path. |

### Permission surface

**MCP** — specifically the server-name derivation used to expand bare tool names into `server:tool` permission targets.
The change does not affect any permission decision logic; it only narrows the set of files consulted for server name discovery.

### Existing code path

```typescript
// In getConfiguredMcpServerNames():
const paths = [this.globalMcpConfigPath, this.legacyGlobalSettingsPath];
```

After this change, the array becomes `[this.globalMcpConfigPath]` — or the method simplifies to read only `mcp.json`.

## Design Overview

This is a pure removal — no new types, no new config fields, no merge-precedence changes.

### What's removed

1. `defaultLegacyGlobalSettingsPath()` — the free function returning `join(getAgentDir(), "settings.json")`.
2. `legacyGlobalSettingsPath` — the private field on `PermissionManager`.
3. `legacyGlobalSettingsPath` — the optional constructor parameter.
4. The second element in the `paths` array inside `getConfiguredMcpServerNames()`.

### What stays

- `globalMcpConfigPath` and `defaultGlobalMcpConfigPath()` — unchanged.
- `mcpServerNames` constructor override — unchanged.
- `getConfiguredMcpServerNamesFromPaths()` and `readConfiguredMcpServerNamesFromConfigPath()` — unchanged (still used for `mcp.json`).

### Edge cases

- A user who only had MCP servers defined in `settings.json` (not `mcp.json`) would silently lose server-name derivation.
  This is intentional: `settings.json` was never documented as a permission-system config source, and any servers there are still usable in Pi — they just won't influence permission target expansion.
  The worst case is that a bare tool name `foo_myserver` stops matching the `myserver:foo_myserver` expansion, falling through to the default MCP policy (which defaults to `ask`, not `allow`).
  This cannot silently weaken a permission — it can only make a permission stricter.

## Module-Level Changes

### `src/permission-manager.ts` — changed

- Delete `defaultLegacyGlobalSettingsPath()`.
- Remove `legacyGlobalSettingsPath` from the private fields.
- Remove `legacyGlobalSettingsPath` from the constructor options interface and the constructor body.
- In `getConfiguredMcpServerNames()`, change the `paths` array to `[this.globalMcpConfigPath]`.

### `tests/permission-system.test.ts` — changed

- Add a test constructing a `PermissionManager` with a temp `settings.json` containing `mcpServers` and confirm `getConfiguredMcpServerNames()` (via `checkPermission` on an MCP tool) does **not** derive targets from those names.
  Since `getConfiguredMcpServerNames()` is private, the test will use `checkPermission("mcp", ...)` with a bare tool name and assert the server-derived targets are absent.
- Alternatively, add a focused unit test for `getConfiguredMcpServerNamesFromPaths()` (the module-level function) to confirm only the `mcp.json` path is consulted.

### No schema, config, or README changes required

`settings.json` is not referenced in `schemas/permissions.schema.json`, `config/config.example.json`, or `README.md`.

## TDD Order

1. **Red: test that `settings.json` server names are not used.**
   Write a test that creates a temp `settings.json` with `{ "mcpServers": { "legacy-server": {} } }` and a `mcp.json` without that server.
   Construct a `PermissionManager` with those paths.
   Call `checkPermission("mcp", { tool: "some_tool_legacy-server" })` and assert the result does **not** produce a `legacy-server:some_tool_legacy-server` target match.
   This test should pass even before the removal (since the derivation path exists but only affects ordering), so frame the assertion as: the manager must produce identical results whether or not `settings.json` exists.
   Commit: `test: verify MCP server names come only from mcp.json (#19)`

2. **Green: remove legacy settings.json fallback.**
   Delete `defaultLegacyGlobalSettingsPath()`, the `legacyGlobalSettingsPath` field, the constructor option, and the array entry in `getConfiguredMcpServerNames()`.
   All existing tests must still pass.
   Commit: `feat: drop legacy settings.json fallback for MCP server names (#19)`

3. **Verify: run full test suite.**
   Confirm `npm test` and `npm run build` pass cleanly.
   Commit (if any fixups needed): `fix: adjust tests after legacy path removal (#19)`

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| **Could this silently weaken a permission?** | No. Removing a server-name source can only make derivation *less* permissive — a bare tool name that previously matched a server-qualified allow rule would now fall through to the default MCP policy (`ask`). This is stricter, not weaker. |
| **Users relying on `settings.json` for MCP server name derivation.** | This was never documented. Users who configure MCP servers in `settings.json` can add the same entries to `mcp.json` or use explicit `server:tool` patterns in their permission policy. |
| **On-disk identity change.** | None. No config directory, log filename, slash command, or event channel name is affected. |
| **Breaking change?** | Non-breaking. The constructor option `legacyGlobalSettingsPath` was internal and not part of any public API contract. No policy file format changes. |

## Open Questions

None — the scope is narrow and unambiguous.
