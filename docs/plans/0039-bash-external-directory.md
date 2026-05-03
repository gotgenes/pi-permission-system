---
issue: 39
issue_title: "external_directory check does not cover bash commands referencing paths outside CWD"
---

# Extend `external_directory` gate to bash commands

## Problem Statement

The `external_directory` special permission fires only for path-bearing file tools (`read`, `write`, `edit`, `find`, `grep`, `ls`).
When the agent invokes the `bash` tool with a command that references paths outside CWD (e.g., `cat /etc/hosts`), the check is bypassed entirely.
A user who sets `special.external_directory: "ask"` still has external paths silently accessed through bash.

## Goals

- Bash commands containing tokens that resolve to paths outside CWD trigger the same `external_directory` gate.
- No new config key — reuse `special.external_directory` policy as-is.
- Same precedence as file tools: external directory check fires **before** the bash wildcard pattern check.
- Defense-in-depth heuristic; explicitly not a sandbox.

## Non-Goals

- Full shell parsing (variable expansion, subshells, heredocs, process substitution).
- Catching every possible bypass — this is acknowledged as best-effort tokenization.
- Changing the `bash` permission surface or default policy.
- Modifying the schema or example config (no new fields).

## Background

### Permission surfaces involved

- **special / external_directory** — the gate being extended.
- **bash** — the permission surface that currently handles bash commands independently.

### Existing modules

| File | Role |
| ---- | ---- |
| `src/external-directory.ts` | `isPathOutsideWorkingDirectory`, `normalizePathForComparison`, format helpers |
| `src/index.ts` | Tool-call interceptor; currently gates file tools at line ~822 |
| `src/permission-manager.ts` | `checkPermission("external_directory", ...)` resolution |
| `src/bash-filter.ts` | Wildcard pattern matching for bash commands |

### Flow today (file tools)

```text
tool_call event → getPathBearingToolPath → isPathOutsideWorkingDirectory
  → checkPermission("external_directory") → deny/ask/allow
  → (if allowed) normal tool permission check
```

### Flow today (bash)

```text
tool_call event → checkPermission("bash", {command}) → BashFilter.check
  → deny/ask/allow based on wildcard patterns
```

## Design Overview

### New function: `extractExternalPathsFromBashCommand`

Lives in `src/external-directory.ts`.
Accepts `(command: string, cwd: string)` and returns `string[]` of paths that resolve outside CWD.

Tokenization strategy:

1. Split command on shell metacharacters (`|`, `&&`, `||`, `;`, `>`, `<`, whitespace) to isolate tokens.
2. For each token, apply heuristics to decide if it's a path candidate:
   - **Skip** if it starts with `-` (flag).
   - **Skip** if it contains `=` before any `/` (env assignment like `FOO=/bar`).
   - **Skip** if it matches a known non-path pattern (e.g., URL `http://...`, `@scope/package`).
3. Classify path candidates:
   - Absolute: starts with `/`.
   - Home-relative: starts with `~/`.
   - Dot-dot-relative: contains `..` segment.
4. Resolve each candidate via `normalizePathForComparison(token, cwd)`.
5. Test with `isPathOutsideWorkingDirectory`.
6. Return the list of external paths (deduplicated).

### Updated tool-call interceptor in `src/index.ts`

After the existing file-tool external directory block (~line 815) and before the normal `checkPermission` call, add:

```typescript
if (ctx.cwd && toolName === "bash") {
  const command = getNonEmptyString(toRecord(input).command);
  if (command) {
    const externalPaths = extractExternalPathsFromBashCommand(command, ctx.cwd);
    if (externalPaths.length > 0) {
      // Same deny/ask/allow flow as file-tool external_directory
    }
  }
}
```

The deny/ask logic mirrors the existing file-tool block, with adjusted format messages that show the command and extracted paths.

### Format helpers

Add to `src/external-directory.ts`:

- `formatBashExternalDirectoryAskPrompt(command, externalPaths, cwd, agentName?)` — shows the full command, highlighted external paths, and CWD.
- `formatBashExternalDirectoryDenyReason(command, externalPaths, cwd, agentName?)` — same pattern as existing deny reason.

### Merge precedence

No change — `special.external_directory` resolves via the standard global → project → per-agent merge in `PermissionManager`.

## Module-Level Changes

| File | Change |
| ---- | ------ |
| `src/external-directory.ts` | Add `extractExternalPathsFromBashCommand`, `formatBashExternalDirectoryAskPrompt`, `formatBashExternalDirectoryDenyReason` |
| `src/index.ts` | Add bash external-directory gate block before normal `checkPermission` |
| `tests/external-directory.test.ts` | Unit tests for `extractExternalPathsFromBashCommand` |
| `tests/bash-external-directory.test.ts` | Integration tests for the gate in the tool-call interceptor |

## TDD Order

1. **Red**: Unit tests for `extractExternalPathsFromBashCommand` — absolute paths, home-relative, dot-dot-relative, within-CWD (no match), flags skipped, env assignments skipped, pipes/semicolons split, URL skipped, `@scope/package` skipped.
   Commit: `test: cover extractExternalPathsFromBashCommand path extraction`

2. **Green**: Implement `extractExternalPathsFromBashCommand` in `src/external-directory.ts`.
   Commit: `feat: extract external paths from bash command tokens (#39)`

3. **Red**: Unit tests for `formatBashExternalDirectoryAskPrompt` and `formatBashExternalDirectoryDenyReason`.
   Commit: `test: cover bash external-directory format helpers`

4. **Green**: Implement format helpers in `src/external-directory.ts`.
   Commit: `feat: add bash external-directory format helpers (#39)`

5. **Red**: Integration tests in `tests/bash-external-directory.test.ts` — bash command with external path triggers deny, triggers ask, passes through on allow, does not fire for in-CWD paths, normal bash pattern still applies after allow.
   Commit: `test: integration tests for bash external_directory gate`

6. **Green**: Wire the gate into `src/index.ts`.
   Commit: `feat: enforce external_directory gate on bash commands (#39)`

7. **Refactor**: Review for any shared logic that can be extracted, ensure review log entries are written for bash external-directory events.
   Commit: `refactor: consolidate bash external-directory review logging (#39)`

## Risks and Mitigations

| Risk | Mitigation |
| ---- | ---------- |
| False positives on non-path tokens (regex `/etc/.*`, package `@foo/bar`) | Skip tokens starting with `@`, skip tokens matching URL patterns, skip tokens without `/` unless they contain `..` |
| Agent bypasses via variable expansion (`$HOME/secret`) | Acknowledged as out of scope — defense-in-depth, not sandbox. Document limitation. |
| Could this silently weaken a permission? | No — this only *adds* a check. If `external_directory` is `allow`, the new code is a no-op (falls through). Existing bash pattern permissions still apply after. |
| Performance on long commands | Token extraction is O(n) string splitting; negligible for realistic command lengths. |
| Pipe chains with mixed internal/external paths (`ls src/ \| xargs cat /etc/passwd`) | Tokenization catches `/etc/passwd` as external regardless of pipe position. |

## Open Questions

- Should the prompt show all external paths found, or just the first? (Suggest: show all, capped at 5, with "and N more" overflow.)
- Should there be a config escape hatch to disable the bash extension of `external_directory` independently? (Suggest: defer — if users ask, add `special.bash_external_directory` in a follow-up.)
