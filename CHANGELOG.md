# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0](https://github.com/gotgenes/pi-permission-system/compare/v0.4.6...v0.5.0) (2026-05-02)


### Features

* add extension config, logging system, and permission request events ([6252d9e](https://github.com/gotgenes/pi-permission-system/commit/6252d9e44ae0611dd399208f66da685dec5d4dbf))
* add getToolPermission for tool-level permission checks ([fe3ab17](https://github.com/gotgenes/pi-permission-system/commit/fe3ab179501ef57e2786dc6815ec2255eba77bc5))
* add guidelines sanitization to system prompt sanitizer ([5689e4a](https://github.com/gotgenes/pi-permission-system/commit/5689e4a3bb028517b09ba4f1d2999936316acb33))
* add yolo mode and permission forwarding ([b36e113](https://github.com/gotgenes/pi-permission-system/commit/b36e113266669b30065ccc45fcc9ed3a37ebf18d))
* **caching:** add before-agent-start cache for active tools and prompt state ([b0f1c85](https://github.com/gotgenes/pi-permission-system/commit/b0f1c85e35f61cb1b05a2ab3f92a670fdfc45f02))
* detect misplaced permission keys in config.json ([#4](https://github.com/gotgenes/pi-permission-system/issues/4)) ([5be5eda](https://github.com/gotgenes/pi-permission-system/commit/5be5eda17a473b8cd3ed0fecc4d166a8339fae7b))
* loadPermissionSystemConfig warns on misplaced permission keys ([#4](https://github.com/gotgenes/pi-permission-system/issues/4)) ([4f0e173](https://github.com/gotgenes/pi-permission-system/commit/4f0e173e62037fef57fe724fd21f3327213f4570))
* **permission-system:** expose tool input params in logs and ask prompts ([e334964](https://github.com/gotgenes/pi-permission-system/commit/e334964a9a673d17acb29c8e6d82c539827aca6a))
* **permission:** add layered policy reload handling ([ad0a4da](https://github.com/gotgenes/pi-permission-system/commit/ad0a4dac4fc274736e8f20ad08145316b30d61cb))
* **permission:** add state and denial reason to permission prompts ([d499b94](https://github.com/gotgenes/pi-permission-system/commit/d499b94985b396006598b7011877cc9885efefd3))
* **permission:** forward subagent approval requests ([bb9086e](https://github.com/gotgenes/pi-permission-system/commit/bb9086e0e1b99a665fc5ddbcc1665f6421e8ccf7))
* **permission:** log sanitized tool input previews ([192b66c](https://github.com/gotgenes/pi-permission-system/commit/192b66ce7720a20d63910bdfc95f075130a43773))
* **special:** enforce external_directory CWD boundary in tool_call handler ([6c59781](https://github.com/gotgenes/pi-permission-system/commit/6c59781a6d69e33eb297ecfb60e6d5b21c3f88b6))
* **status:** add permission system status sync for yolo mode ([0b77943](https://github.com/gotgenes/pi-permission-system/commit/0b77943adbc8a87de2161fd8037d2d80505fbfd1))


### Bug Fixes

* **events:** listen on session_start instead of nonexistent session_switch ([2bbbaba](https://github.com/gotgenes/pi-permission-system/commit/2bbbaba9d0b31fe08c19e0819f11b4c1c705aa97))
* **package:** stop publishing config.json ([af1b531](https://github.com/gotgenes/pi-permission-system/commit/af1b5311112046f32e153332bb8e0fb996b6882e))
* **permission:** add model option compatibility guard ([d9dd506](https://github.com/gotgenes/pi-permission-system/commit/d9dd5063edd1c6a7410105a92c6c45fa9c195699))
* **permission:** harden prompt and external directory enforcement ([48c3af1](https://github.com/gotgenes/pi-permission-system/commit/48c3af165a6f2c1a4c689c436d8c6c4112ec6aae))
* **permission:** summarize file tool approval prompts ([3775894](https://github.com/gotgenes/pi-permission-system/commit/3775894f23756ad0ed06ae17961d547b0cb5bc47))
* **prompt:** remove denied tools from available tools section ([f22bccc](https://github.com/gotgenes/pi-permission-system/commit/f22bcccdca7f9ce9df066973e4735cd2e0427280))


### Documentation

* add AGENTS.md and .pi/prompts workflow templates ([bebc197](https://github.com/gotgenes/pi-permission-system/commit/bebc197f59ada2dfff24f6fc1ef3cf46b2415675))
* add readme and changelog ([07e29c5](https://github.com/gotgenes/pi-permission-system/commit/07e29c57a9fcb7731ec62531e7c9f1ef5883c0d1))
* add Related Pi Extensions cross-linking section ([facdf3f](https://github.com/gotgenes/pi-permission-system/commit/facdf3fda8a5ec2486a818ada2836ef7be039f40))
* clarify config.json vs permission-policy file ([#4](https://github.com/gotgenes/pi-permission-system/issues/4)) ([464e1d1](https://github.com/gotgenes/pi-permission-system/commit/464e1d19b637807bb754d95397db9cf59d446673))
* fix recipe ordering and clarify last-match-wins precedence ([70427f6](https://github.com/gotgenes/pi-permission-system/commit/70427f662b16b655fd23867c6960cfae0923b821))
* plan warn on misplaced permission keys in config.json ([#4](https://github.com/gotgenes/pi-permission-system/issues/4)) ([ffcef67](https://github.com/gotgenes/pi-permission-system/commit/ffcef6787b7ac1bb44acc958266eed9e1b5fbf9a))
* **release:** finalize 0.4.2 notes ([ea1c587](https://github.com/gotgenes/pi-permission-system/commit/ea1c58761e468dade823b3618e43b8909b6c4aee))
* **release:** prepare 0.4.3 notes ([73a255c](https://github.com/gotgenes/pi-permission-system/commit/73a255c991c7a14d10711f99973991a68ab50c1b))
* **release:** prepare 0.4.4 notes ([78f5c48](https://github.com/gotgenes/pi-permission-system/commit/78f5c48aab6a94c7bb7356af4db1798340522848))
* **release:** prepare v0.4.5 ([e5a713b](https://github.com/gotgenes/pi-permission-system/commit/e5a713b0e3a0149e2728b81c4ca85188ebe668eb))
* **release:** update CHANGELOG for 0.4.2 ([47084d6](https://github.com/gotgenes/pi-permission-system/commit/47084d6af8fb4b515dad4519c3487f9f6b11d287))
* update README for [@gotgenes](https://github.com/gotgenes) fork ([f6ff1dd](https://github.com/gotgenes/pi-permission-system/commit/f6ff1dd687e73722e3a1cc8b1f457e6dcc2227ff))


### Miscellaneous Chores

* add biome and markdownlint-cli2 tooling ([3140f32](https://github.com/gotgenes/pi-permission-system/commit/3140f32c4bc4be13f06e1ec337ce525317f565bf))
* add license, ignores, and assets ([f59ce79](https://github.com/gotgenes/pi-permission-system/commit/f59ce79a6a3c9b48994b9c4a15e5e81d853a7b2b))
* align npm keywords for discoverability ([fabbb4d](https://github.com/gotgenes/pi-permission-system/commit/fabbb4d024d41ac4c4d01e9218d0d4cc8538ae6b))
* bootstrap extension project ([4b3e7d5](https://github.com/gotgenes/pi-permission-system/commit/4b3e7d51c5b94ec580bd06943c427a5272ad2be2))
* bump version to 0.2.0 ([4df5864](https://github.com/gotgenes/pi-permission-system/commit/4df5864414cb5a252eb757b060034ca86e5c96eb))
* **deps:** update pi peer dependencies ([bf3d7e6](https://github.com/gotgenes/pi-permission-system/commit/bf3d7e6f3610ab69f2988a6748af5c6a6a1193eb))
* exclude docs folder from version control ([3fa6a49](https://github.com/gotgenes/pi-permission-system/commit/3fa6a496f4c28e65bbcb6787a3e9b5c636706ed3))
* pin typescript as devDependency ([2ff692f](https://github.com/gotgenes/pi-permission-system/commit/2ff692f36a1061df222364ebe4f44465423d7586))
* release v0.3.0 ([36a3d7e](https://github.com/gotgenes/pi-permission-system/commit/36a3d7ee2794b9350bdac5de029d9f074a2c63ad))
* release v0.4.1 ([da22e18](https://github.com/gotgenes/pi-permission-system/commit/da22e1879aaf0bf5d0673eefddd9df29f7f4e256))
* **release:** cut v0.1.1 ([5d8739b](https://github.com/gotgenes/pi-permission-system/commit/5d8739ba5ceabcbd940ebb61b8ffbbf05a962579))
* **release:** cut v0.1.2 ([f4f0fe7](https://github.com/gotgenes/pi-permission-system/commit/f4f0fe769f274d3cd1355015620b5636d934095f))
* **release:** cut v0.1.3 ([88667f2](https://github.com/gotgenes/pi-permission-system/commit/88667f2aa9c1c8de84ad6a9b798635b155a90b65))
* **release:** cut v0.1.4 ([6c9804b](https://github.com/gotgenes/pi-permission-system/commit/6c9804b4434681248edfde07cff75d32e50240c6))
* **release:** cut v0.1.5 ([cdaca30](https://github.com/gotgenes/pi-permission-system/commit/cdaca303c1e49bcbe542037204ed77e98f78d02e))
* **release:** cut v0.1.6 ([644660e](https://github.com/gotgenes/pi-permission-system/commit/644660e37e287b0121c7b5433095e536cd46ee92))
* **release:** cut v0.1.7 ([1e73124](https://github.com/gotgenes/pi-permission-system/commit/1e731249bc2fdaf5f2e37efdaa1fa58475cd75f9))
* **release:** cut v0.1.8 ([164a6e3](https://github.com/gotgenes/pi-permission-system/commit/164a6e3434a19b817725edb3ec9db9dd51856393))
* rename package and update metadata for [@gotgenes](https://github.com/gotgenes) fork ([cd9bc5f](https://github.com/gotgenes/pi-permission-system/commit/cd9bc5f4844210f6a547ce99a8efdef985be8c7f))
* **types:** replace types-shims.d.ts with real type packages ([3809612](https://github.com/gotgenes/pi-permission-system/commit/380961271ae5bc0f4e68becb42e00335e5e5c1c4))

## [Unreleased]

## [0.4.6] - 2026-04-28

### Added
- Added bounded, sanitized tool input previews to permission review logs for non-bash/non-MCP tool calls, inspired by PR #10 from @DevkumarPatel.

### Changed
- Reused the extension's safe JSON serialization path for generic tool approval previews so circular values and BigInts are summarized without raw full-input logging.
- Updated `@mariozechner/pi-ai`, `@mariozechner/pi-coding-agent`, and `@mariozechner/pi-tui` peer dependencies to `^0.70.5`.

## [0.4.5] - 2026-04-27

### Fixed
- Added a model option compatibility guard for OpenAI Responses/Codex streams so unsupported `temperature` values are removed from stream options and outgoing payloads before provider calls.

## [0.4.4] - 2026-04-25

### Added
- Added runtime enforcement for the `external_directory` special permission on path-bearing tools (`read`, `write`, `edit`, `find`, `grep`, `ls`) before normal tool permission checks (thanks to @gotgenes for PR #9)
- Added readable `ask` prompt summaries for built-in file tools and bounded input previews for generic extension tools so users can make informed approval decisions (thanks to @beantownbytes for PR #8)
- Added `skill-prompt-sanitizer.ts` to parse and sanitize every `<available_skills>` block, including prompts with multiple skill sections

### Changed
- Updated `@mariozechner/pi-coding-agent` and `@mariozechner/pi-tui` peer dependencies to `^0.70.2`
- Refactored skill prompt filtering out of `src/index.ts` into a dedicated module for clearer ownership and reuse
- Permission prompts for `edit`, `write`, `read`, `find`, `grep`, and `ls` now show concise path/action summaries instead of raw multiline JSON

### Fixed
- Denied skills are now removed from all available-skill prompt blocks instead of only the first block
- Denied skill entries are no longer retained for later skill-read path matching after prompt sanitization
- External path access now honors `special.external_directory: deny` and blocks `ask` decisions when no UI or forwarding channel is available

### Tests
- Added runtime `tool_call` coverage for external directory deny, ask-without-UI, ask approval, internal path allow, and optional path omission
- Added prompt regression coverage for generic tool input previews and readable built-in file-tool approval summaries
- Added multi-block skill prompt sanitizer regression coverage

## [0.4.2] - 2026-04-20

### Added
- Added project-level permission layering from the active session workspace via `<cwd>/.pi/agent/pi-permissions.jsonc`
- Added project-level per-agent overrides via `<cwd>/.pi/agent/agents/<agent>.md` (thanks to @Talia-12 for PR #7)
- Added reload-aware permission manager refresh paths so policy caches are rebuilt when Pi reload events occur
- Added a dedicated `tests/` directory with modular test entrypoints and a shared test harness
- Added before-agent-start caching module to dedupe unchanged active-tool exposure and prompt state across `before_agent_start` lifecycle invocations
- Added `PermissionPromptDecision` type with `state` and `denialReason` fields for richer permission prompt resolution
- Added `getPolicyCacheStamp()` method to `PermissionManager` for cache invalidation tracking

### Changed
- Global path resolution now follows Pi's `getAgentDir()` helper, so global config, agents, sessions, and logs respect `PI_CODING_AGENT_DIR` (thanks to @jvortmann for PR #6)
- Updated `@mariozechner/pi-coding-agent` and `@mariozechner/pi-tui` peer dependencies to `^0.67.68`
- Updated TypeScript project configuration and npm scripts to run tests from `tests/` instead of `src/`
- Updated README documentation for project-level policy files, yolo mode config, test layout, and `PI_CODING_AGENT_DIR`
- Permission prompts and forwarding now return `PermissionPromptDecision` instead of boolean for richer resolution tracking
- Permission denial messages now include user-provided denial reasons when available

### Removed
- Removed the legacy packaged `asset/` directory because the README now uses externally hosted images instead of repository-bundled screenshots

### Fixed
- `/skill:<name>` permission handling now falls back to the current merged skill policy when no active agent context is available in the main session (thanks to @NSBeidou and @hidromagnetismo for reporting the issue)
- Skill denial messaging now reflects whether the block came from an agent-specific rule or the merged policy without agent context

### Tests
- Added coverage for project-level precedence across global, project, system-agent, and project-agent layers
- Added coverage for resolving config from `PI_CODING_AGENT_DIR`
- Added coverage for before-agent-start cache key generation and state deduplication
- Added coverage for cache invalidation on permission policy changes

## [0.4.1] - 2026-04-01

### Changed
- Updated npm keywords for improved discoverability (`pi-coding-agent`, `coding-agent`, `access-control`, `authorization`, `security`)
- Updated README permission prompt example image
- Added Related Pi Extensions cross-linking section to README

## [0.4.0] - 2026-04-01

### Added
- System prompt sanitizer now removes inactive tool guidelines from the `Guidelines:` section
- Guideline filtering based on allowed tools (e.g., removes task/mcp/bash/write guidance when tools are denied)
- New `TOOL_GUIDELINE_RULES` configuration for extensible guideline filtering
- Helper functions: `findSection()`, `removeLineSection()`, `sanitizeGuidelinesSection()`

### Changed
- Updated `@mariozechner/pi-coding-agent` and `@mariozechner/pi-tui` peer dependencies to ^0.64.0
- Updated `@sinclair/typebox` peer dependency to ^0.34.49
- Refactored system prompt sanitizer to handle both `Available tools:` and `Guidelines:` sections

### Tests
- Added tests for system prompt sanitizer removing Available tools section
- Added tests for guideline filtering based on allowed tools
- Added tests for inactive built-in write/edit/task/mcp guidance removal

## [0.3.1] - 2026-03-24

### Added
- Permission system status module (`status.ts`) to expose yolo mode status to the UI
- `syncPermissionSystemStatus()` function to sync status with the TUI status bar
- `PERMISSION_SYSTEM_STATUS_KEY` and `PERMISSION_SYSTEM_YOLO_STATUS_VALUE` constants for status identification

### Changed
- Integrated status sync on config load, config save, and extension unload
- Status is only exposed when yolo mode is enabled

### Tests
- Added test for permission-system status being undefined when yolo mode is disabled and "yolo" when enabled

## [0.3.0] - 2026-03-23

### Added
- Yolo mode for auto-approval when enabled — bypasses permission prompts for streamlined workflows
- Permission forwarding system for subagent-to-primary IPC communication
- Configuration modal UI with Zellij integration (`config-modal.ts`, `zellij-modal.ts`)
- `permission-forwarding.ts` module for subagent permission request routing
- `yolo-mode.ts` module for automatic permission approval when yolo mode is active

### Changed
- Updated `@mariozechner/pi-coding-agent` and `@mariozechner/pi-tui` peer dependencies to ^0.62.0
- Refactored `index.ts` to export new permission resolution utilities
- Expanded `extension-config.ts` with config normalization for new features
- Added `types-shims.d.ts` for Zellij modal type definitions

### Tests
- Added comprehensive tests for config modal functionality
- Added tests for permission forwarding behavior

## [0.2.2] - 2026-03-13

### Changed
- Removed delegation task restriction logic — the `task` tool is no longer restricted to orchestrator agent only
- Simplified tool permission lookup to use explicit `tools` entries for arbitrary registered tools instead of MCP fallback
- Renamed `TOOL_PERMISSION_NAMES` to `BUILT_IN_TOOL_PERMISSION_NAMES` to clarify it covers only canonical Pi tools
- Updated schema descriptions for `tools` and `mcp` fields to guide configuration usage

### Removed
- Removed delegation-specific permission checks (`isDelegationAllowedAgent`, `getDelegationBlockReason`) from permission evaluation

### Tests
- Added comprehensive test coverage for tool permission lookup behavior

## [0.2.1] - 2026-03-13

### Added
- Extension configuration system (`config.json`) with `debugLog` and `permissionReviewLog` options
- JSONL debug logging to `logs/pi-permission-system-debug.jsonl` when `debugLog` is enabled
- JSONL permission review logging to `logs/pi-permission-system-permission-review.jsonl` for auditing
- Permission request event emission on `pi-permission-system:permission-request` channel for external consumers
- New `extension-config.ts` module for config file management and path resolution
- New `logging.ts` module with `createPermissionSystemLogger` for structured log output

### Changed
- Replaced `console.warn`/`console.error` calls with structured logging to file
- Permission forwarding now logs request creation, response received, timeout, and user prompts
- Updated README documentation to cover extension config, logging, and event emission

## [0.2.0] - 2026-03-12

### Added
- `getToolPermission()` method to retrieve tool-level permission state without evaluating command-level rules, useful for tool injection decisions

## [0.1.8] - 2026-03-10

### Changed
- Refactored pattern compilation to support multiple sources for proper global+agent pattern merging
- Simplified `wildcard-matcher.ts` by removing unused `wildcardCount` and `literalLength` properties
- `BashFilter` now accepts pre-compiled patterns via `BashPermissionSource` type
- Replaced `compilePermissionPatterns` with `compilePermissionPatternsFromSources` for cleaner API

### Fixed
- Permission pattern priority now correctly implements last-match-wins hierarchy (opencode-style)
- MCP tool-level deny no longer blocks specific MCP allow patterns

### Tests
- Updated tests to reflect last-match-wins behavior
- Added test for specific MCP rules winning over `tools.mcp: deny`
- Rearranged test pattern declarations for clarity

## [0.1.7] - 2026-03-10

### Added
- `src/common.ts` — Shared utility module with `toRecord()`, `getNonEmptyString()`, `isPermissionState()`, `parseSimpleYamlMap()`, `extractFrontmatter()`
- `src/wildcard-matcher.ts` — Wildcard pattern compilation and matching with specificity sorting
- File stamp caching in `PermissionManager` for improved performance
- `tools.mcp` fallback permission for MCP operations
- MCP tool permission targets now inferred from configured server names in `mcp.json`

### Changed
- Refactored `bash-filter.ts` to use shared `wildcard-matcher.ts` module
- Refactored `index.ts` to use shared `common.ts` utilities
- Refactored `permission-manager.ts` to use shared modules and caching
- Pre-compiled wildcard patterns are now reused across permission checks
- Updated README architecture documentation to reflect new module organization

### Tests
- Added tests for MCP proxy tool inferring server-prefixed aliases from configured server names
- Added tests for `tools.mcp` fallback behavior
- Added tests for `task` using tool permissions instead of MCP fallback

## [0.1.6] - 2026-03-09

### Added
- Sanitized the `Available tools:` system prompt section so denied tools are removed before the agent starts.

### Changed
- Updated README documentation to describe system-prompt tool sanitization and refreshed the displayed package version.

### Fixed
- Prevented hidden tools from remaining advertised in the startup system prompt after runtime tool filtering.

## [0.1.5] - 2026-03-09

### Changed
- Added `repository`, `homepage`, and `bugs` package metadata so npm links back to the public GitHub repository and issue tracker.

## [0.1.4] - 2026-03-07

### Added
- Added permission request forwarding so non-UI subagent sessions can surface `ask` confirmations back to the main interactive session.
- Added filesystem-based request/response handling for both primary and legacy permission-forwarding directories.

### Changed
- Updated README documentation to describe subagent permission forwarding behavior and current architecture responsibilities.
- Added `package-lock.json` to the repository for reproducible local installs.

### Fixed
- Preserved interactive `ask` permission flows for delegated subagents that would otherwise fail without direct UI access.
- Improved cleanup and compatibility handling around legacy permission-forwarding directories.

## [0.1.3] - 2026-03-04

### Fixed
- Use absolute GitHub raw URL for README image to fix npm display

## [0.1.2] - 2026-03-04

### Changed
- Rewrote README.md with professional documentation standards
- Added comprehensive feature documentation, configuration reference, and usage examples

## [0.1.1] - 2026-03-02

### Changed
- Added `asset/` to the npm package `files` whitelist so README image assets are included in tarballs.

## [0.1.0] - 2026-03-02

### Changed
- Reorganized repository structure to match standard extension layout:
  - moved implementation and tests into `src/`
  - added root `index.ts` shim for Pi auto-discovery
  - standardized TypeScript project settings with Bundler module resolution
- Added package distribution metadata and scripts, including `pi.extensions` and publish file whitelist.
- Added repository scaffolding files (`README.md`, `CHANGELOG.md`, `LICENSE`, `.gitignore`, `.npmignore`) and config starter template.

### Preserved
- Global permission config path semantics remained `~/.pi/agent/pi-permissions.jsonc`.
- Permission schema location remained `schemas/permissions.schema.json`.
- Permission enforcement behavior remained intact.
