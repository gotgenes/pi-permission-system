---
issue: 17
issue_title: "Remove src/model-option-compatibility.ts (out-of-scope provider monkey-patch)"
---

# Remove model-option-compatibility provider monkey-patch

## Problem Statement

`src/model-option-compatibility.ts` (~180 lines) monkey-patches `getApiProvider` from `@mariozechner/pi-ai` to strip unsupported `temperature` options for OpenAI Responses-style APIs (`openai-codex-responses`, `openai-responses`, `azure-openai-responses`).
It stashes state on `globalThis` and registers itself via `registerModelOptionCompatibilityGuard(pi)` from `src/index.ts`.

This module is out of scope for a permission-enforcement extension:

1. It has nothing to do with policy gates over tools, bash, MCP, skills, or special operations.
2. It mutates every extension's view of the provider stack at the process level via `pi.registerProvider()`.
3. It violates AGENTS.md's "Keep modules focused" and "Permission decisions should be pure functions of (policy, request)" principles by introducing global, infectious side effects.

## Goals

- Delete `src/model-option-compatibility.ts`.
- Remove the `registerModelOptionCompatibilityGuard(pi)` call and its import from `src/index.ts`.
- Remove any associated tests or fixtures (none exist today — confirmed by grep).
- Remove any documentation references (none exist today).
- This is a **breaking change** for users who relied on the temperature-stripping shim being bundled in this extension.

## Non-Goals

- Building a replacement extension (e.g. `pi-openai-responses-temperature-shim`).
  If users still need the shim, that can ship separately; this issue is purely about removing it from the permission-system surface.
- Changing any permission logic, policy semantics, or on-disk identity.

## Background

### Relevant modules

| File | Role |
| --- | --- |
| `src/model-option-compatibility.ts` | The module to delete. Exports `registerModelOptionCompatibilityGuard()` and helpers for temperature sanitization. |
| `src/index.ts` | Extension entry point. Imports and calls `registerModelOptionCompatibilityGuard(pi)` at line 1341 during extension initialization. |

### Permission surface

None — this change removes code that has nothing to do with permission enforcement.
No policy semantics, permission surfaces, merge precedence, or on-disk identity are affected.

### Current call chain

```text
src/index.ts  piPermissionSystemExtension(pi)
  └─ registerModelOptionCompatibilityGuard(pi)          ← line 1341
       └─ ensureModelOptionGuardForApi(pi, api)         ← for each of 3 APIs
            └─ pi.registerProvider(providerName, ...)   ← monkey-patches provider stack
```

After removal, nothing in the extension references provider APIs or temperature options.

## Design Overview

This is a pure deletion — no new code, no refactoring, no migration path.

### Steps

1. Delete `src/model-option-compatibility.ts`.
2. In `src/index.ts`:
   - Remove the import line: `import { registerModelOptionCompatibilityGuard } from "./model-option-compatibility.js";`
   - Remove the call: `registerModelOptionCompatibilityGuard(pi);`

### What stays the same

Everything else.
The extension entry point, all permission logic, all event handlers, config loading, slash command, logging, permission forwarding — none of these reference `model-option-compatibility`.

## Module-Level Changes

### `src/model-option-compatibility.ts` — deleted

Entire file removed (~180 lines).

### `src/index.ts` — two lines removed

- Remove import of `registerModelOptionCompatibilityGuard` from `"./model-option-compatibility.js"`.
- Remove the `registerModelOptionCompatibilityGuard(pi);` call.

### Tests — no changes needed

No tests reference `model-option-compatibility`.
Confirmed by grepping `tests/` for `model.option`, `modelOption`, `temperatur`, `registerModelOption`, and `compatibility`.

### Docs — no changes needed

No references to model-option-compatibility exist in `README.md`, `AGENTS.md`, or `docs/`.

## TDD Order

1. **Baseline verification.** Run `npm test` and `npm run build` to confirm green.
   No commit.

2. **Delete module and remove references.**
   - Delete `src/model-option-compatibility.ts`.
   - Remove the import and call from `src/index.ts`.
   - Run `npm test` and `npm run build` to confirm green.
   - Commit: `feat!: remove out-of-scope model-option-compatibility provider shim (#17)`

3. **Verify no stale references.** Grep the entire repo for `model-option-compatibility`, `registerModelOptionCompatibilityGuard`, `ModelOption`, `temperatur` (catching both `temperature` and `Temperature`), and `GUARDED_TEMPERATURE_APIS`.
   If any references remain in docs or config, remove them and amend or add a commit: `docs: remove model-option-compatibility references (#17)`

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| **Could this silently weaken a permission?** | No. The deleted code has nothing to do with permission enforcement. It is a provider-level temperature shim with no connection to any permission surface. |
| **Breaking change for users relying on the temperature shim.** | Acknowledged. The `feat!:` commit prefix signals the breaking change. Users who need the shim can extract it into a standalone extension. The shim was never documented as a feature of this extension. |
| **`globalThis` state left behind.** | The `globalThis.__piPermissionSystem*` keys are set lazily by the deleted module. After removal, no code writes or reads them. If a previous version populated them, they are inert — no cleanup needed. |
| **On-disk identity change.** | None. Config directory, log filenames, `/permission-system` slash command, and event channel names are untouched. |

## Open Questions

None — the scope is unambiguous.
