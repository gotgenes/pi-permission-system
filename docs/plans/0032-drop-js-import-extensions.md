---
issue: 32
issue_title: "Drop .js extensions from all internal imports"
---

# Drop `.js` extensions from all internal imports

## Problem Statement

All internal imports in `src/` and `tests/` carry explicit `.js` extensions (e.g. `from "./common.js"`).
This convention is required by `moduleResolution: "Node16"` / `"NodeNext"`, but the project uses `moduleResolution: "Bundler"` with `noEmit: true`, so the extensions serve no purpose.
They add noise to every new file and are a common source of copy-paste mistakes.

## Goals

- Strip `.js` from every relative import path in `src/` and `tests/` (~116 occurrences across ~30 files).
- Add a guard so `.js` extensions do not creep back in.
- Verify `npx vitest run` and `npm run build` both pass after the change.

## Non-Goals

- No behavior change to the permission system.
- No changes to `package.json`, `tsconfig.json`, or the public API.
- No changes to imports of `node:*` builtins or bare package specifiers (only relative `./` and `../` paths).

## Background

- `tsconfig.json` uses `"module": "ESNext"` and `"moduleResolution": "Bundler"` — both resolve extensionless relative imports natively.
- Vitest transforms via esbuild, which also resolves extensionless imports.
- `tsc` is `"noEmit": true` — Node's strict-ESM extension rule never fires.
- **Runtime loading**: Pi loads extensions via `@mariozechner/jiti` (a fork of `unjs/jiti`), which uses esbuild internally and resolves extensionless `.ts` imports the same way Vitest does.
  Empirically verified: stripping `.js` from `src/permission-manager.ts` imports passes both `npm run build` and `npx vitest run` with no changes.
- Biome has `useImportExtensions` (enforces extensions), which is the opposite of what we want.
  There is no built-in Biome rule to *ban* extensions, so prevention uses a lint script.

No permission surface is involved — this is a purely mechanical code-quality change.

## Design Overview

### Step 1: Mechanical find-and-replace

Use `sed` or a script to strip `.js` from every relative import in `src/**/*.ts` and `tests/**/*.ts`:

```text
from "./foo.js"  →  from "./foo"
from "../bar.js" →  from "../bar"
```

Only touch relative paths (starting with `./` or `../`).
Do not touch `node:*`, bare specifiers, or type-only imports (they follow the same rule, so strip those too).

### Step 2: Prevention guard

Add a `lint:imports` npm script that greps for `.js"` in relative imports and fails if any are found:

```jsonc
"lint:imports": "! grep -rn --include='*.ts' 'from \"\\.\\{1,2\\}/.*\\.js\"' src/ tests/"
```

Wire it into `lint:all` so `npm run check` catches regressions.

### Step 3: Verify

Run `npm run build` (tsc) and `npm run test` (vitest).
Both must pass with zero changes beyond the import paths.

## Module-Level Changes

|File / glob|Change|
|-|-|
|`src/**/*.ts` (~20 files)|Strip `.js` from relative import paths|
|`tests/**/*.ts` (~10 files)|Strip `.js` from relative import paths|
|`package.json`|Add `lint:imports` script; append to `lint:all`|

No schema, config, or documentation changes required.

## TDD Order

This change is mechanical with no new logic, so a classic red→green cycle is lightweight:

1. **Green: strip extensions in `src/`** — run `npm run build` to confirm tsc still passes.
   Commit: `refactor: drop .js extensions from src/ imports (#32)`
2. **Green: strip extensions in `tests/`** — run `npx vitest run` to confirm tests still pass.
   Commit: `refactor: drop .js extensions from tests/ imports (#32)`
3. **Guard: add lint:imports script** — add the grep guard and verify it passes on the cleaned tree and fails if a `.js` extension is reintroduced.
   Commit: `chore: add lint:imports guard against .js extensions (#32)`

Alternatively, steps 1–2 can be a single commit since the change is atomic and trivially reversible.

## Risks and Mitigations

|Risk|Mitigation|
|-|-|
|Missed an import that actually needs `.js` (e.g. a non-TS asset)|Only strip from `*.ts` files with relative paths; `npm run build` and `npm run test` catch any resolution failures immediately.|
|Could this silently weaken a permission?|No — this change touches only import specifier strings, not runtime behavior or policy resolution.|
|`lint:imports` grep is too broad / too narrow|The pattern targets `from ".<relative>.js"` only; tested against the cleaned tree and a synthetic reintroduction before committing.|

## Open Questions

None — the issue's proposed change is unambiguous and the project's toolchain already supports extensionless imports.
