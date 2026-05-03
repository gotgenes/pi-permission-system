---
issue: 16
issue_title: "Delete vendored src/zellij-modal.ts; rebuild settings UI on pi-tui"
---

# Delete vendored zellij-modal and rebuild settings UI on pi-tui

## Problem Statement

`src/zellij-modal.ts` is 1,117 lines vendored from upstream's sibling `zellij-modal` package.
Its header comment instructs maintainers to "keep this module in sync when upstream zellij-modal primitives change" — the textbook maintenance trap AGENTS.md warns against.
The sole consumer is `src/config-modal.ts`, which uses `ZellijModal` and `ZellijSettingsModal` to render a 3-toggle settings dialog for `yoloMode`, `permissionReviewLog`, and `debugLog`.

The vendored code is unnecessary because `pi-tui` already exports `SettingsList` — a `Component`-conformant class with built-in navigation, value cycling, `onChange`/`onCancel` callbacks, and `updateValue()`.
The entire `ZellijModal` + `ZellijSettingsModal` layer exists only to add border rendering and title-bar chrome around `SettingsList`.
Since `ctx.ui.custom` already provides overlay positioning, the modal chrome can be dropped entirely or replaced with a few lines of `Box` wrapping.

### Why keep the interactive modal at all?

The three settings (`yoloMode`, `permissionReviewLog`, `debugLog`) are simple booleans that an agent could edit in `config.json` directly.
However, toggling a setting via the slash command is instant and free; asking the agent to do it costs a round-trip of token usage.
The interactive UI earns its keep as a zero-cost escape hatch for quick config changes, especially for `yoloMode` which users toggle frequently.
Issue #10 will later consolidate config paths, but the toggle UI remains useful regardless of where the file lives.

## Goals

- Delete `src/zellij-modal.ts` entirely (~1,117 lines removed).
- Rewrite `openSettingsModal()` in `src/config-modal.ts` to use `SettingsList` from `pi-tui` directly, removing the `ZellijModal` / `ZellijSettingsModal` abstraction layer.
- Keep the `/permission-system` slash command name, all subcommands (`show`, `path`, `reset`, `help`), and no-args interactive behaviour unchanged.
- Update `tests/config-modal.test.ts` to remove the `zellij-modal` mock surface and validate the new UI shape.
- Net result: ~1,100 lines removed, zero new vendored code.

## Non-Goals

- Changing the set of configurable runtime knobs (`yoloMode`, `permissionReviewLog`, `debugLog`).
- Changing the `/permission-system` slash command name or any on-disk identity (config directory, log filenames, event channel names).
- Consolidating config paths (#10) — that issue builds on this cleanup.

## Background

### Relevant modules

| File | Role |
| --- | --- |
| `src/zellij-modal.ts` | Vendored modal framework (~1,117 lines). Wraps `pi-tui` `SettingsList`, `Container`, `Box`, `Text` to add border rendering, overlay sizing, title bar, and key handling. |
| `src/config-modal.ts` | Slash command handler. Registers `/permission-system`, dispatches subcommands, and calls `openSettingsModal()` for no-args invocation. |
| `src/extension-config.ts` | Loads/saves `config.json` (the 3-boolean runtime config). No changes needed. |
| `tests/config-modal.test.ts` | Mocks `pi-tui` and `pi-coding-agent` exports; tests completions, subcommands, headless guard, and custom-modal call count. |

### Permission surface

None — this change is purely UI/DX.
No policy semantics, permission surfaces, or merge precedence are affected.

### Key `pi-tui` / `pi-coding-agent` APIs

`SettingsList` from `pi-tui` is the critical primitive.
It already implements the `Component` interface (`render`, `handleInput`, `invalidate`) and accepts:

```typescript
constructor(
  items: SettingItem[],
  maxVisible: number,
  theme: SettingsListTheme,
  onChange: (id: string, newValue: string) => void,
  onCancel: () => void,
  options?: SettingsListOptions,
)
```

- `onChange` fires when a value is toggled — wired to `controller.setConfig()`.
- `onCancel` fires on Escape — wired to the `done()` callback from `ctx.ui.custom`.
- `updateValue(id, newValue)` lets us sync display after a persist round-trip.

`ctx.ui.custom<T>(factory, options)` renders a custom `Component` in an overlay.
The factory receives `(tui, theme, keybindings, done)` and returns the component.

`getSettingsListTheme()` from `pi-coding-agent` provides the `SettingsListTheme`.

## Design Overview

### Approach: `SettingsList` as the sole component

The `ZellijModal` + `ZellijSettingsModal` two-class indirection is replaced by passing a `SettingsList` instance directly to `ctx.ui.custom`.
No `Container`, `Box`, or `Text` wrapper is needed — `SettingsList` is already a self-contained `Component` that handles rendering, input, and invalidation.

The factory passed to `ctx.ui.custom`:

1. Instantiates `SettingsList` with items from `buildSettingItems()`, theme from `getSettingsListTheme()`, and callbacks.
2. Wires `onChange` → `applySetting()` → `controller.setConfig()` → `syncSettingValues()` (same logic as today).
3. Wires `onCancel` → `done()` (closes the overlay).
4. Returns the `SettingsList` instance directly as the component.

The overlay options on `ctx.ui.custom` handle positioning.
The elaborate border chrome from `ZellijModal` (title bar, help undertitle, rounded corners) is dropped — `SettingsList` already renders its own hint line and description, which is sufficient for 3 toggle items.

### What stays the same

- `registerPermissionSystemCommand()` signature and registration.
- `handleArgs()` — all subcommand handlers (`show`, `path`, `reset`, `help`, unknown).
- `getArgumentCompletions()` — completions for subcommands.
- `buildSettingItems()`, `applySetting()`, `summarizeConfig()` helpers — unchanged in logic.
- `PermissionSystemConfigController` interface.

### What changes

- `openSettingsModal()` body: rewritten (~60 lines → ~20 lines).
- Import block: removes `ZellijModal`, `ZellijSettingsModal`; adds `SettingsList` from `pi-tui` and `getSettingsListTheme` from `pi-coding-agent`.
- `SettingValueSyncTarget` interface: deleted (was an abstraction over `ZellijSettingsModal.updateValue`; `SettingsList.updateValue` is used directly).
- `syncSettingValues()`: parameter type changes from `SettingValueSyncTarget` to `SettingsList` (or inlined, since the function just calls `updateValue` three times).

## Module-Level Changes

### `src/zellij-modal.ts` — deleted

Entire file removed.

### `src/config-modal.ts` — simplified

- Remove import of `ZellijModal`, `ZellijSettingsModal` from `./zellij-modal.js`.
- Add imports: `SettingsList` from `@mariozechner/pi-tui`, `getSettingsListTheme` from `@mariozechner/pi-coding-agent`.
- Delete `SettingValueSyncTarget` interface.
- Rewrite `openSettingsModal()`:
  - Create `SettingsList` with `buildSettingItems(current)`, `getSettingsListTheme()`, `onChange`, `onCancel: done`.
  - Return it directly as the component from the `ctx.ui.custom` factory.
- Simplify or inline `syncSettingValues()` to call `settingsList.updateValue()` directly.

### `tests/config-modal.test.ts` — mock surface trimmed

- The `pi-tui` mock already stubs `SettingsList` — verify constructor signature matches.
- Add `getSettingsListTheme` to the `pi-coding-agent` mock (currently only mocks `getSettingsListTheme: () => ({})`; confirm this is present and sufficient).
- Existing assertions (completions, subcommand notifications, headless guard, `custom()` call count = 1) should pass without logic changes.

## TDD Order

1. **Baseline.** Run `npm test -- tests/config-modal.test.ts` and `npm run build` to confirm green.
   No commit (baseline verification only).

2. **Delete `zellij-modal.ts` and rewrite `openSettingsModal()`.** Do both together — there is no useful intermediate state where the vendored file exists but nothing imports it.
   - Delete `src/zellij-modal.ts`.
   - Update imports in `src/config-modal.ts`.
   - Delete `SettingValueSyncTarget` interface.
   - Rewrite `openSettingsModal()` to use `SettingsList` directly.
   - Simplify `syncSettingValues()`.
   - Update test mocks if needed.
   - Run full test suite and `npm run build`.
   - Commit: `feat: replace vendored zellij-modal with direct pi-tui SettingsList (#16)`

3. **Docs.** Scan `README.md`, `AGENTS.md`, `docs/` for references to `zellij-modal.ts` and remove them.
   - Commit: `docs: remove zellij-modal references (#16)` (skip if none found)

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| **Could this silently weaken a permission?** | No. This change is purely UI/DX for the `/permission-system` settings command. No permission decision logic is touched. |
| **`SettingsList` constructor signature mismatch.** | Verified from `pi-tui` type declarations above. The vendored code already uses `SettingsList` internally with the same constructor shape. |
| **Visual regression.** Losing the `ZellijModal` border chrome (title bar, rounded corners, help undertitle). | Acceptable. `SettingsList` renders its own hint line and item descriptions. With only 3 items the chrome was decorative, not functional. If needed later, `Box` can add a border in a few lines. |
| **Test mock drift.** | The `pi-tui` mock already stubs `SettingsList`. TDD step 2 verifies mocks before committing. |
| **On-disk identity change.** | None. Command name stays `/permission-system`; config directory, log filenames, and event channels are untouched. |

## Open Questions

None — the design is straightforward.
The only aesthetic question (border chrome vs. bare `SettingsList`) is answered by "start simple, add later if needed."
