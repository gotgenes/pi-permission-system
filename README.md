# 🔐 @gotgenes/pi-permission-system

[![npm version](https://img.shields.io/npm/v/@gotgenes/pi-permission-system?style=flat&logo=npm&logoColor=white)](https://www.npmjs.com/package/@gotgenes/pi-permission-system) [![CI](https://img.shields.io/github/actions/workflow/status/gotgenes/pi-permission-system/ci.yml?style=flat&logo=github&label=CI)](https://github.com/gotgenes/pi-permission-system/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Pi Package](https://img.shields.io/badge/Pi-Package-6366F1?style=flat)](https://pi.mariozechner.at/)

Permission enforcement extension for the Pi coding agent that provides centralized, deterministic permission gates for tool, bash, MCP, skill, and special operations.

> **Fork notice:** This package is a friendly fork of [MasuRii/pi-permission-system](https://github.com/MasuRii/pi-permission-system), published to npm as `@gotgenes/pi-permission-system`.
> This fork diverges from upstream in config layout (#10).
> The `/permission-system` slash command name is preserved; the config and log paths are not.

## Features

- **Tool Filtering** — Hides disallowed tools from the agent before it starts (reduces "try another tool" behavior)
- **System Prompt Sanitization** — Removes denied tool entries from the `Available tools:` system prompt section so the agent only sees tools it can actually call
- **Runtime Enforcement** — Blocks/asks/allows at tool call time with UI confirmation dialogs and readable approval summaries
- **Bash Command Control** — Wildcard pattern matching for granular bash command permissions
- **MCP Access Control** — Server and tool-level permissions for MCP operations
- **Skill Protection** — Controls which skills can be loaded or read from disk, including multi-block prompt sanitization
- **Per-Agent Overrides** — Agent-specific permission policies via YAML frontmatter
- **Subagent Permission Forwarding** — Forwards `ask` confirmations from non-UI subagents back to the main interactive session
- **File-Based Review Logging** — Writes permission request/denial review entries to a file by default for later auditing
- **Optional Debug Logging** — Keeps verbose extension diagnostics in a separate file when enabled in `config.json`
- **JSON Schema Validation** — Full schema for editor autocomplete and config validation
- **External Directory Guard** — Enforces `special.external_directory` for path-bearing file tools that target paths outside the active working directory

## Installation

### npm package

```bash
pi install npm:pi-permission-system
```

### Local extension folder

Place this folder in one of the following locations:

| Scope          | Path                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| Global default | `~/.pi/agent/extensions/pi-permission-system` (respects `PI_CODING_AGENT_DIR`) |
| Project        | `.pi/extensions/pi-permission-system`                                          |

Pi auto-discovers extensions in these paths.

> **Tip:** All `~/.pi/agent` paths shown in this document are defaults. If the `PI_CODING_AGENT_DIR` environment variable is set, pi uses that directory instead. The extension automatically follows pi's `getAgentDir()` helper, so global policy files, per-agent overrides, session directories, and extension installation paths all resolve under the configured agent directory.

## Usage

### Quick Start

1. Create the global config file (default: `~/.pi/agent/extensions/pi-permission-system/config.json`, respects `PI_CODING_AGENT_DIR`):

```jsonc
{
  "defaultPolicy": {
    "tools": "ask",
    "bash": "ask",
    "mcp": "ask",
    "skills": "ask",
    "special": "ask"
  },
  "tools": {
    "read": "allow",
    "write": "deny"
  }
}
```

1. Start Pi — the extension automatically loads and enforces your policy.

### Permission States

All permissions use one of three states:

| State   | Behavior                                 |
| ------- | ---------------------------------------- |
| `allow` | Permits the action silently              |
| `deny`  | Blocks the action with an error message  |
| `ask`   | Prompts the user for confirmation via UI |

### Pi Integration Hooks

The extension integrates via Pi's lifecycle hooks:

| Hook                 | Behavior                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `before_agent_start` | Filters active tools, removes denied tool entries from the system prompt, and hides denied skills |
| `tool_call`          | Enforces permissions for every tool invocation                                                    |
| `input`              | Intercepts `/skill:<name>` requests and enforces skill policy                                     |

**Additional behaviors:**

- Unknown/unregistered tools are blocked before permission checks (prevents bypass attempts)
- The `Available tools:` system prompt section is rewritten to match the filtered active tool set
- Extension-provided tools like `task`, `mcp`, and third-party tools are handled by exact registered name instead of private built-in hardcodes
- When a subagent hits an `ask` permission without direct UI access, the request can be forwarded to the main interactive session for confirmation
- Generic extension-tool approval prompts include a bounded input preview; built-in file tools use concise human-readable summaries instead of raw multiline JSON
- Permission review logs include bounded `toolInputPreview` values for non-bash/non-MCP tool calls so approvals can be audited without writing raw full payloads
- Path-bearing file tools (`read`, `write`, `edit`, `find`, `grep`, `ls`) evaluate `special.external_directory` before their normal tool permission when an explicit path points outside `ctx.cwd`

## Configuration

### Config File

**Location:** one unified config file per scope, following the `pi-autoformat` convention:

| Scope   | Path                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------- |
| Global  | `~/.pi/agent/extensions/pi-permission-system/config.json` (respects `PI_CODING_AGENT_DIR`)        |
| Project | `<cwd>/.pi/extensions/pi-permission-system/config.json`                                           |

Project config overrides global config; per-agent frontmatter overrides both.
Object-shaped fields (`defaultPolicy`, `tools`, `bash`, `mcp`, `skills`, `special`) use shallow-merge (later source wins per-key).
Scalar fields (`debugLog`, `permissionReviewLog`, `yoloMode`) use simple replacement.

The config file combines runtime knobs and permission policy in one object:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/gotgenes/pi-permission-system/main/schemas/permissions.schema.json",

  // Runtime knobs
  "debugLog": false,
  "permissionReviewLog": true,
  "yoloMode": false,

  // Policy
  "defaultPolicy": {
    "tools": "ask",
    "bash": "ask",
    "mcp": "ask",
    "skills": "ask",
    "special": "ask"
  },
  "tools": { "read": "allow", "write": "deny" },
  "bash": { "git status": "allow", "git *": "ask" },
  "mcp": { "mcp_status": "allow" },
  "skills": { "*": "ask" },
  "special": { "doom_loop": "deny", "external_directory": "ask" }
}
```

#### Runtime knobs

| Key                   | Default | Description                                                                                             |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `debugLog`            | `false` | Enables verbose diagnostic logging to `logs/pi-permission-system-debug.jsonl`                           |
| `permissionReviewLog` | `true`  | Enables the permission request/denial review log at `logs/pi-permission-system-permission-review.jsonl` |
| `yoloMode`            | `false` | Auto-approves `ask` results instead of prompting when yolo mode is enabled                              |

Both logs write to `~/.pi/agent/extensions/pi-permission-system/logs/`.
No debug output is printed to the terminal.

#### Policy sections

The config file is a JSON object with these policy sections:

| Section         | Description                                                                  |
| --------------- | ---------------------------------------------------------------------------- |
| `defaultPolicy` | Fallback permissions per category                                            |
| `tools`         | Exact-name tool permissions for registered tools                             |
| `bash`          | Command pattern permissions                                                  |
| `mcp`           | MCP server/tool permissions for calls routed through a registered `mcp` tool |
| `skills`        | Skill name pattern permissions                                               |
| `special`       | Reserved permission checks such as external directory access                 |

> **Note:** Trailing commas are **not** supported. If parsing fails, the extension falls back to `ask` for all categories.

### Global Per-Agent Overrides

Override global permissions for specific agents via YAML frontmatter in the global Pi agents directory (default: `~/.pi/agent/agents/<agent>.md`, respects `PI_CODING_AGENT_DIR`):

```yaml
---
name: my-agent
permission:
  tools:
    read: allow
    write: deny
    mcp: allow
  bash:
    git status: allow
    git *: ask
  mcp:
    chrome_devtools_*: deny
    exa_*: allow
  skills:
    "*": ask
---
```

**MCP behavior:** `permission.tools.mcp` is the coarse entry/fallback permission for a registered `mcp` tool when one is available. More specific `permission.mcp` target rules override that fallback when they match.

**Limitations:** The frontmatter parser is intentionally minimal. Use only `key: value` scalars and nested maps. Avoid arrays, multi-line scalars, and YAML anchors.

### Project-Level Config and Overrides

Project-local config uses the same format as the global config file.
Per-agent overrides use YAML frontmatter in the project agents directory:

| Scope                  | Path                                                          |
| ---------------------- | ------------------------------------------------------------- |
| Project config         | `<cwd>/.pi/extensions/pi-permission-system/config.json`       |
| Project agent override | `<cwd>/.pi/agent/agents/<agent>.md`                           |

These project files are resolved from Pi's current session `cwd`, so they are workspace-specific and do **not** move under `PI_CODING_AGENT_DIR`.

**Precedence order:**

1. Global config file
2. Project config file
3. Global agent frontmatter
4. Project agent frontmatter

Later layers override earlier layers within the same permission category. For wildcard-based sections like `bash`, `mcp`, `skills`, and `special`, matching still follows the extension's existing **last matching rule wins** behavior after the layers are combined. The recommended convention — also used by [OpenCode's permission model](https://opencode.ai/docs/permissions/#granular-rules-object-syntax) — is to put the broad catch-all rule first and specific overrides after it.

---

## Policy Reference

### `defaultPolicy`

Sets fallback permissions when no specific rule matches:

```jsonc
{
  "defaultPolicy": {
    "tools": "ask",
    "bash": "ask",
    "mcp": "ask",
    "skills": "ask",
    "special": "ask",
  },
}
```

### `tools`

Controls tools by exact registered name (no wildcards). This is the recommended standalone format for **all** tool entries, including Pi built-ins and arbitrary third-party extension tools.

| Tool name example  | Description                                                               |
| ------------------ | ------------------------------------------------------------------------- |
| `bash`             | Shell command execution (tool-level fallback before `bash` pattern rules) |
| `read` / `write`   | Canonical Pi built-in file tools                                          |
| `mcp`              | Registered MCP proxy tool entry/fallback when available                   |
| `task`             | Delegation tool handled like any other registered extension tool          |
| `third_party_tool` | Arbitrary registered extension tool                                       |

```jsonc
{
  "tools": {
    "read": "allow",
    "write": "deny",
    "mcp": "allow",
    "third_party_tool": "ask",
  },
}
```

Unknown or absent tools are not required in the config. If another extension is not installed, its tool simply will not be registered at runtime, and this extension will block attempts to call that missing tool before permission checks run.

> **Note:** Setting `tools.bash` affects the _default_ for bash commands, but `bash` patterns can provide command-level overrides.
>
> **Note:** Setting `tools.mcp` controls coarse access to a registered `mcp` tool when one is available. Specific `mcp` rules still override it when a target pattern matches.
>
> **Note:** Top-level shorthand is only supported for the canonical Pi built-ins (`bash`, `read`, `write`, `edit`, `grep`, `find`, `ls`) in agent frontmatter. Use `permission.tools.<name>` for `mcp`, `task`, and any third-party tool.

### `bash`

Command patterns use `*` wildcards and match against the full command string. If multiple patterns match, the **last matching rule wins**, so put broad fallback rules first and specific overrides after them.

```jsonc
{
  "bash": {
    "git *": "ask",
    "git status": "allow",
    "rm -rf *": "deny",
  },
}
```

### `mcp`

MCP permissions match against derived targets from tool input. These rules are more specific than `tools.mcp` and override that fallback when a pattern matches:

| Target Type       | Examples                                                              |
| ----------------- | --------------------------------------------------------------------- |
| Baseline ops      | `mcp_status`, `mcp_list`, `mcp_search`, `mcp_describe`, `mcp_connect` |
| Server name       | `myServer`                                                            |
| Server/tool combo | `myServer:search`, `myServer_search`                                  |
| Generic           | `mcp_call`                                                            |

```jsonc
{
  "mcp": {
    "mcp_status": "allow",
    "mcp_list": "allow",
    "myServer:*": "ask",
    "dangerousServer": "deny",
  },
}
```

> **Note:** Baseline discovery targets may auto-allow when you permit any MCP rule.

#### MCP Tool Fallback via `tools.mcp`

A registered `mcp` tool can use `tools.mcp` as an entry permission point. This provides a fallback when no specific MCP pattern matches:

```jsonc
{
  "tools": {
    "mcp": "allow",
  },
}
```

This is useful for per-agent configurations where you want to grant MCP access broadly:

```yaml
# In the global Pi agents directory (default: ~/.pi/agent/agents/researcher.md; respects PI_CODING_AGENT_DIR)
---
name: researcher
permission:
  tools:
    mcp: allow
---
```

The permission resolution order for MCP operations:

1. Specific `mcp` patterns (e.g., `myServer:toolName`, `myServer_*`)
2. `tools.mcp` fallback (if set)
3. `defaultPolicy.mcp`

### `skills`

Skill name patterns use `*` wildcards:

```jsonc
{
  "skills": {
    "*": "ask",
    "dangerous-*": "deny",
  },
}
```

### `special`

Reserved permission checks:

| Key                  | Description                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doom_loop`          | Controls doom loop detection behavior                                                                                                                                         |
| `external_directory` | Enforces ask/allow/deny decisions for path-bearing built-in tools (`read`, `write`, `edit`, `find`, `grep`, `ls`) when they target paths outside the active working directory |

```jsonc
{
  "special": {
    "doom_loop": "deny",
    "external_directory": "ask",
  },
}
```

`external_directory` is evaluated before the normal tool permission check. For example, `tools.read: "allow"` can permit ordinary reads while `special.external_directory: "ask"` still requires confirmation before reading `../outside.txt` or an absolute path outside `ctx.cwd`. Optional-path search tools (`find`, `grep`, `ls`) skip this check when no `path` is provided because they default to the active working directory.

---

## Common Recipes

### Read-Only Mode

```jsonc
{
  "defaultPolicy": {
    "tools": "ask",
    "bash": "ask",
    "mcp": "ask",
    "skills": "ask",
    "special": "ask",
  },
  "tools": {
    "read": "allow",
    "grep": "allow",
    "find": "allow",
    "ls": "allow",
    "write": "deny",
    "edit": "deny",
  },
}
```

### Restricted Bash Surface

```jsonc
{
  "defaultPolicy": {
    "tools": "ask",
    "bash": "deny",
    "mcp": "ask",
    "skills": "ask",
    "special": "ask",
  },
  "bash": {
    "git *": "ask",
    "git status": "allow",
    "git diff": "allow",
    "git log *": "allow",
  },
}
```

### MCP Discovery Only

```jsonc
{
  "defaultPolicy": {
    "tools": "ask",
    "bash": "ask",
    "mcp": "ask",
    "skills": "ask",
    "special": "ask",
  },
  "mcp": {
    "*": "ask",
    "mcp_status": "allow",
    "mcp_list": "allow",
    "mcp_search": "allow",
    "mcp_describe": "allow",
  },
}
```

### Per-Agent Lockdown

In the global Pi agents directory (default: `~/.pi/agent/agents/reviewer.md`, respects `PI_CODING_AGENT_DIR`):

```yaml
---
permission:
  tools:
    write: deny
    edit: deny
  bash:
    "*": deny
---
```

---

## Technical Details

### Permission Prompt Summaries

When a tool permission resolves to `ask`, the prompt is designed to be readable enough for an informed approval decision:

- `bash` prompts show the command and matched bash pattern when available.
- `mcp` prompts show the derived MCP target and matched rule when available.
- Built-in file tools show concise summaries, such as the target path and edit/write line counts, instead of raw multiline JSON.
- Unknown or third-party extension tools show a bounded single-line JSON preview of the input so users are not asked to approve a blind tool name.

Example edit approval prompt:

```text
Current agent requested tool 'edit' for '.gitignore' (1 replacement: edit #1 replaces 5 lines with 2 lines). Allow this call?
```

### Subagent Permission Forwarding

When a delegated or routed subagent runs without direct UI access, `ask` permissions can still be enforced by forwarding the confirmation request through Pi session directories. The main interactive session polls for forwarded requests, shows the confirmation prompt, writes the response, and the subagent resumes once that decision is available.

This keeps `ask` policies usable even when the original permission check happens inside a non-UI execution context.

### Logging

When the extension prompts, denies, or forwards permission requests, it can append structured JSONL entries under:

```text
Default global logs directory: ~/.pi/agent/extensions/pi-permission-system/logs/
Actual global logs directory: $PI_CODING_AGENT_DIR/extensions/pi-permission-system/logs/ when PI_CODING_AGENT_DIR is set
```

- `pi-permission-system-permission-review.jsonl` — enabled by default for permission review/audit history, including bounded `toolInputPreview` values for non-bash/non-MCP tool calls
- `pi-permission-system-debug.jsonl` — disabled by default and intended for troubleshooting

On every session start, the extension emits a `config.resolved` entry to both logs listing the resolved config paths and whether each exists.
This makes it easy to verify which files the extension actually loaded:

```jsonc
{
  "event": "config.resolved",
  "globalConfigPath": "/…/.pi/agent/extensions/pi-permission-system/config.json",
  "globalConfigExists": true,
  "projectConfigPath": "/…/my-project/.pi/extensions/pi-permission-system/config.json",
  "projectConfigExists": false,
  "agentsDir": "/…/.pi/agent/agents",
  "agentsDirExists": true,
  "projectAgentsDir": "/…/my-project/.pi/agent/agents",
  "projectAgentsDirExists": false,
  "legacyGlobalPolicyDetected": false,
  "legacyProjectPolicyDetected": false,
  "legacyExtensionConfigDetected": false
}
```

### Architecture

```text
index.ts                    → Root Pi entrypoint shim
src/
├── index.ts                → Extension bootstrap, permission checks, readable prompts, review logging, reload handling, and subagent forwarding
├── config-loader.ts        → Unified config loader, merger, and legacy-path detection
├── config-paths.ts         → Path derivation for global, project, and legacy config locations
├── config-reporter.ts      → Resolved config path reporting for diagnostic logs
├── extension-config.ts     → Runtime config normalization and defaults
├── logging.ts              → File-only debug/review logging helpers
├── permission-manager.ts   → Global/project policy loading, merging, and resolution with caching
├── skill-prompt-sanitizer.ts → Skill prompt parsing, multi-block sanitization, and skill-read path matching
├── bash-filter.ts          → Bash command wildcard pattern matching
├── wildcard-matcher.ts     → Shared wildcard pattern compilation and matching
├── common.ts               → Shared utilities (YAML parsing, type guards, etc.)
├── tool-registry.ts        → Registered tool name resolution
└── types.ts                → TypeScript type definitions
tests/
├── permission-system.test.ts → Core permission, layering, forwarding, and policy tests
├── config-modal.test.ts      → Config command and modal behavior tests
└── test-harness.ts           → Shared lightweight test helpers
schemas/
└── permissions.schema.json → JSON Schema for policy validation
config/
└── config.example.json     → Starter global policy template
```

#### Module Organization

The extension uses a modular architecture with shared utilities:

| Module                      | Purpose                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `common.ts`                 | Shared utilities: `toRecord()`, `getNonEmptyString()`, `isPermissionState()`, `parseSimpleYamlMap()`, `extractFrontmatter()` |
| `wildcard-matcher.ts`       | Compile-once wildcard patterns with last-match-wins evaluation: `compileWildcardPatterns()`, `findCompiledWildcardMatch()`   |
| `permission-manager.ts`     | Policy resolution with file stamp caching for performance                                                                    |
| `bash-filter.ts`            | Uses shared wildcard matcher for bash command patterns                                                                       |
| `skill-prompt-sanitizer.ts` | Parses all available skill prompt blocks, removes denied skills, and tracks visible skill paths for read protection          |

#### Performance Optimizations

- **File stamp caching**: Configurations are cached with file modification timestamps to avoid redundant reads
- **Pre-compiled patterns**: Wildcard patterns are compiled to regex once and reused across permission checks
- **Resolved permissions caching**: Merged agent+global permissions are cached per-agent with invalidation on file changes

### Threat Model

**Goal:** Enforce policy at the host level, not the model level.

**What this stops:**

- Agent calling tools it shouldn't use (e.g., `write`, dangerous `bash`)
- Tool switching attempts (calling non-existent tool names)
- Accidental escalation via skill loading
- Unapproved path-bearing tool access outside the active working directory when `external_directory` is `ask` or `deny`

**Limitations:**

- If a dangerous action is possible via an allowed tool, policy must explicitly restrict it
- This is a permission decision layer, not a sandbox

### Schema Validation

Validate your config against the included schema:

```bash
npx --yes ajv-cli@5 validate \
  -s ./schemas/permissions.schema.json \
  -d ./pi-permissions.valid.json
```

**Editor tip:** Add `"$schema": "./schemas/permissions.schema.json"` to your config for autocomplete support.

---

## Migration from pre-v2 layout

Before v2, config was split across two files:

- Policy: `~/.pi/agent/pi-permissions.jsonc`
- Runtime knobs: `<extension-install-dir>/config.json`

These are now consolidated into one file.
The extension detects legacy files and merges them with a warning for one release.
To migrate manually:

```bash
# Move the global policy file
mkdir -p ~/.pi/agent/extensions/pi-permission-system
mv ~/.pi/agent/pi-permissions.jsonc ~/.pi/agent/extensions/pi-permission-system/config.json

# If you had project-level policy:
mkdir -p .pi/extensions/pi-permission-system
mv .pi/agent/pi-permissions.jsonc .pi/extensions/pi-permission-system/config.json
```

Then add any runtime knobs (`debugLog`, `permissionReviewLog`, `yoloMode`) to the same file.
The old extension-root `config.json` is no longer read from the install directory.

> **Note:** Logs also moved from `<extension-install-dir>/logs/` to `~/.pi/agent/extensions/pi-permission-system/logs/`.
> Old log files are not deleted or migrated — they remain readable but no new entries are appended.

---

## Troubleshooting

| Problem                              | Cause                                                      | Solution                                                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config not applied (everything asks) | File not found or parse error                              | Verify the global config at `~/.pi/agent/extensions/pi-permission-system/config.json` (respects `PI_CODING_AGENT_DIR`); check for trailing commas                    |
| Per-agent override not applied       | Frontmatter parsing issue                                  | Ensure `---` delimiters at file top; keep YAML simple; restart session                                                                                               |
| Tool blocked as unregistered         | Unknown tool name                                          | Use a registered `mcp` tool for server tools: `{ "tool": "server:tool" }`                                                                                            |
| `/skill:<name>` blocked              | Deny policy or confirmation unavailable                    | Check merged `skills` policy (global/project/agent layers). Active agent context is optional in the main session; `ask` still requires UI or forwarded confirmation. |
| External file path blocked           | `special.external_directory` is `ask` without UI or `deny` | Allow/ask the special permission or keep file tools inside the active working directory.                                                                             |
| Permission prompt is too verbose     | Generic extension tool input is large                      | Built-in file tools are summarized automatically; third-party tools are capped to a bounded one-line JSON preview.                                                   |

---

## Development

```bash
pnpm run build       # Type-check TypeScript (no emit)
pnpm run lint        # Biome lint + format check
pnpm run lint:fix    # Biome lint + format auto-fix
pnpm run lint:md     # markdownlint-cli2 on README etc.
pnpm run lint:all    # lint + lint:md
pnpm run format      # Biome format --write
pnpm run test        # Run tests from ./tests
pnpm run check       # build + lint:all + test
```

### Pre-commit hooks

This project uses [prek](https://prek.j178.dev/) to run Biome and markdownlint on staged files before each commit.
This catches lint and formatting issues locally instead of waiting for CI.

1. Install prek ([installation guide](https://prek.j178.dev/installation/)).
2. Run `pnpm install` — the `prepare` script calls `prek install` automatically.
   If prek is not installed, the script prints a warning and continues.
3. Hooks run automatically on `git commit`.
   To skip in emergencies: `git commit --no-verify`.

The hook configuration lives in `prek.toml` at the repo root.

---

## Related Pi Extensions

- [pi-multi-auth](https://github.com/MasuRii/pi-multi-auth) — Multi-provider credential management and quota-aware rotation
- [pi-tool-display](https://github.com/MasuRii/pi-tool-display) — Compact tool rendering and diff visualization
- [pi-rtk-optimizer](https://github.com/MasuRii/pi-rtk-optimizer) — RTK command rewriting and output compaction
- [pi-MUST-have-extension](https://github.com/MasuRii/pi-MUST-have-extension) — RFC 2119 keyword normalization for prompts

## License

[MIT](LICENSE)
