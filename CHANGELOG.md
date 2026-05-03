# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.4](https://github.com/gotgenes/pi-permission-system/compare/v3.0.3...v3.0.4) (2026-05-03)


### Documentation

* plan drop .js extensions from internal imports ([#32](https://github.com/gotgenes/pi-permission-system/issues/32)) ([1d73759](https://github.com/gotgenes/pi-permission-system/commit/1d73759bafb4de02f20817d977eca181a5df5a54))
* **retro:** add retro notes for issue [#33](https://github.com/gotgenes/pi-permission-system/issues/33) ([4e4ef43](https://github.com/gotgenes/pi-permission-system/commit/4e4ef4397efe9fd0c75ac00b1b411eef50603f33))


### Miscellaneous Chores

* add lint:imports guard against .js extensions ([#32](https://github.com/gotgenes/pi-permission-system/issues/32)) ([fa0b924](https://github.com/gotgenes/pi-permission-system/commit/fa0b924fb5a8741de294eff8b2f2f94aded34f5d))

## [3.0.3](https://github.com/gotgenes/pi-permission-system/compare/v3.0.2...v3.0.3) (2026-05-03)


### Bug Fixes

* stop findSection at first non-body line instead of EOF ([#33](https://github.com/gotgenes/pi-permission-system/issues/33)) ([15c178e](https://github.com/gotgenes/pi-permission-system/commit/15c178ea1aa42c091885f0aeacd87ba5b298ce24))


### Documentation

* plan fix for findSection greedy end boundary ([#33](https://github.com/gotgenes/pi-permission-system/issues/33)) ([72a5f9e](https://github.com/gotgenes/pi-permission-system/commit/72a5f9e4ab14cc9959781994cdc7dc52f1dfa657))
* **retro:** add retro notes for issue [#35](https://github.com/gotgenes/pi-permission-system/issues/35) ([89830cb](https://github.com/gotgenes/pi-permission-system/commit/89830cb7c562ed092d4f08031584f0e0855326de))

## [3.0.2](https://github.com/gotgenes/pi-permission-system/compare/v3.0.1...v3.0.2) (2026-05-03)


### Documentation

* plan align test mock-cleanup and node:* default-export rules ([#35](https://github.com/gotgenes/pi-permission-system/issues/35)) ([480aa02](https://github.com/gotgenes/pi-permission-system/commit/480aa02183009a6693a6699948563345871f198d))
* **retro:** add retro notes for issue [#21](https://github.com/gotgenes/pi-permission-system/issues/21) ([c7aae09](https://github.com/gotgenes/pi-permission-system/commit/c7aae099a48e58506195d843de797a1ae45b723a))

## [3.0.1](https://github.com/gotgenes/pi-permission-system/compare/v3.0.0...v3.0.1) (2026-05-03)


### Documentation

* add descriptions to all JSON schema entities ([cb3a7ce](https://github.com/gotgenes/pi-permission-system/commit/cb3a7ce5257111159312ebb95a9f75dd4e4a9527))
* enrich JSON schema with examples, defaults, and markdown descriptions ([6f38d7e](https://github.com/gotgenes/pi-permission-system/commit/6f38d7edf01b950f20e2fab8604a398bf725a6c4))
* plan index.ts split into focused modules ([#21](https://github.com/gotgenes/pi-permission-system/issues/21)) ([ccd736a](https://github.com/gotgenes/pi-permission-system/commit/ccd736a83a4af208044eec925c80555ee645e344))
* **retro:** add retro notes for issue [#10](https://github.com/gotgenes/pi-permission-system/issues/10) ([31e59d6](https://github.com/gotgenes/pi-permission-system/commit/31e59d6172da7b0e9f02894afd2ba66a292de168))
* **retro:** correct formatting friction attribution ([#10](https://github.com/gotgenes/pi-permission-system/issues/10)) ([2e96b7b](https://github.com/gotgenes/pi-permission-system/commit/2e96b7bc1007a2ef55f95b29c40b8417c2c6c52f))
* update plan with Phase 2 unit tests using DI and vitest mocks ([#21](https://github.com/gotgenes/pi-permission-system/issues/21)) ([ad7f5fe](https://github.com/gotgenes/pi-permission-system/commit/ad7f5feeb856c84142a2a4258a9e173c8006532d))

## [3.0.0](https://github.com/gotgenes/pi-permission-system/compare/v2.0.0...v3.0.0) (2026-05-03)


### ⚠ BREAKING CHANGES

* Config is now loaded from ~/.pi/agent/extensions/pi-permission-system/config.json (global) and <cwd>/.pi/extensions/pi-permission-system/config.json (project). Legacy paths are detected and merged with migration warnings.
* Config and log file paths move from the extension install directory and ~/.pi/agent/ to the extensions/<id>/ convention.

### Features

* add config-paths module with new layout paths ([#10](https://github.com/gotgenes/pi-permission-system/issues/10)) ([532d2a1](https://github.com/gotgenes/pi-permission-system/commit/532d2a1f1d816c1cfba5419f7d0041382c848b31))
* add unified config loader ([#10](https://github.com/gotgenes/pi-permission-system/issues/10)) ([20143e0](https://github.com/gotgenes/pi-permission-system/commit/20143e0f7b608965d889433a6b9bbd6f9ab8b4cc))
* detect and merge legacy config paths ([#10](https://github.com/gotgenes/pi-permission-system/issues/10)) ([95046de](https://github.com/gotgenes/pi-permission-system/commit/95046de6a57d604c5f0d9fa8c13a64478ba15c89))
* implement config merge in unified loader ([#10](https://github.com/gotgenes/pi-permission-system/issues/10)) ([30b9afe](https://github.com/gotgenes/pi-permission-system/commit/30b9afe3d83940aa3ad708c9d6783bb2d4337743))
* update config-reporter for consolidated layout ([#10](https://github.com/gotgenes/pi-permission-system/issues/10)) ([96c9ef4](https://github.com/gotgenes/pi-permission-system/commit/96c9ef4964f9551b0fa89bbbc506f7660c055d74))
* wire index.ts to consolidated config layout ([#10](https://github.com/gotgenes/pi-permission-system/issues/10)) ([e7f8e5f](https://github.com/gotgenes/pi-permission-system/commit/e7f8e5f2fb094f0d291561258190d1892a1e6856))


### Documentation

* plan config layout consolidation ([#10](https://github.com/gotgenes/pi-permission-system/issues/10)) ([eb2924d](https://github.com/gotgenes/pi-permission-system/commit/eb2924d57655d06f67891574839aebfa0586a43d))
* **retro:** add retro notes for issue [#20](https://github.com/gotgenes/pi-permission-system/issues/20) ([4735f0c](https://github.com/gotgenes/pi-permission-system/commit/4735f0c646a0ede11c9a76083822969eb6ca4a8f))
* update schema, example, and docs for consolidated config ([#10](https://github.com/gotgenes/pi-permission-system/issues/10)) ([39b5c01](https://github.com/gotgenes/pi-permission-system/commit/39b5c01de1c8c721e998b244e9c825a6eb05f858))

## [2.0.0](https://github.com/gotgenes/pi-permission-system/compare/v1.2.1...v2.0.0) (2026-05-03)


### ⚠ BREAKING CHANGES

* the pi-permission-system:permission-request event channel is no longer emitted. No known consumers exist; the type was never exported. Re-adding with a proper public contract is tracked

### Features

* add /build-plan prompt template for non-TDD plans ([e98f13c](https://github.com/gotgenes/pi-permission-system/commit/e98f13c2ef32f51edda58ea065635bef31365baa))
* delete permission-request event channel ([#20](https://github.com/gotgenes/pi-permission-system/issues/20)) ([6a41cfa](https://github.com/gotgenes/pi-permission-system/commit/6a41cfadc56e709d255538f63ff63d587e1b64f3))


### Documentation

* plan delete permission-request event channel ([#20](https://github.com/gotgenes/pi-permission-system/issues/20)) ([e202350](https://github.com/gotgenes/pi-permission-system/commit/e2023509f9ab849f5a1d8bc28a5705b2898b912b))
* remove event channel from preserved-identity list ([#20](https://github.com/gotgenes/pi-permission-system/issues/20)) ([52299a2](https://github.com/gotgenes/pi-permission-system/commit/52299a27aeaed6e35849878fa224d8a78dcf0f6d))
* **retro:** add retro notes for issue [#22](https://github.com/gotgenes/pi-permission-system/issues/22) ([55629fe](https://github.com/gotgenes/pi-permission-system/commit/55629fed16b6d73b6d7b02698227e2adab7acd3e))
* update copyright in license ([b27994e](https://github.com/gotgenes/pi-permission-system/commit/b27994e7d67863ce8b28aa6bd680b60bc700d66d))

## [1.2.1](https://github.com/gotgenes/pi-permission-system/compare/v1.2.0...v1.2.1) (2026-05-03)


### Bug Fixes

* **retro:** correct MD060 rule — column alignment, not separator spacing ([7f116b8](https://github.com/gotgenes/pi-permission-system/commit/7f116b884c03d9c346a640f306bca934b91214cd))


### Documentation

* plan relax on-disk identity rule ([#22](https://github.com/gotgenes/pi-permission-system/issues/22)) ([d886862](https://github.com/gotgenes/pi-permission-system/commit/d886862a3686746f48e618ab2f950c7b1109d804))
* relax on-disk identity rule for config/log paths ([#22](https://github.com/gotgenes/pi-permission-system/issues/22)) ([352b103](https://github.com/gotgenes/pi-permission-system/commit/352b1038b1492b1f8222950edf4b6d093157128d))
* **retro:** add retro notes for issue [#19](https://github.com/gotgenes/pi-permission-system/issues/19) ([1d4a4a6](https://github.com/gotgenes/pi-permission-system/commit/1d4a4a6959905f102dea08273e7b827d8111a583))
* update README badges to match pi-autoformat style ([5c6ef1f](https://github.com/gotgenes/pi-permission-system/commit/5c6ef1fcfb2b6f5ee353765ebeeac7cdf09d2bbb))

## [1.2.0](https://github.com/gotgenes/pi-permission-system/compare/v1.1.0...v1.2.0) (2026-05-03)


### Features

* drop legacy settings.json fallback for MCP server names ([#19](https://github.com/gotgenes/pi-permission-system/issues/19)) ([3978f94](https://github.com/gotgenes/pi-permission-system/commit/3978f94acfe01b32e6e37c4fa0f5ca3b22881208))


### Documentation

* plan drop legacy settings.json MCP fallback ([#19](https://github.com/gotgenes/pi-permission-system/issues/19)) ([fd88aac](https://github.com/gotgenes/pi-permission-system/commit/fd88aac8e52c0b617b5ce2582c700bbb86b9bf84))
* **retro:** add retro notes for issue [#18](https://github.com/gotgenes/pi-permission-system/issues/18) ([1bb9cc5](https://github.com/gotgenes/pi-permission-system/commit/1bb9cc52abe159d77b8ab29960bafdb2740c9c98))

## [1.1.0](https://github.com/gotgenes/pi-permission-system/compare/v1.0.0...v1.1.0) (2026-05-03)


### Features

* emit deprecation warning for special.tool_call_limit ([#18](https://github.com/gotgenes/pi-permission-system/issues/18)) ([1170d40](https://github.com/gotgenes/pi-permission-system/commit/1170d401d3adc438ad3c69bf96f5264b981ed4d5))
* notify user of deprecated config fields at startup ([#18](https://github.com/gotgenes/pi-permission-system/issues/18)) ([3408672](https://github.com/gotgenes/pi-permission-system/commit/3408672afb94783f173b579e9e33fe088f0971f3))
* surface config issues from PermissionManager ([#18](https://github.com/gotgenes/pi-permission-system/issues/18)) ([4c8103b](https://github.com/gotgenes/pi-permission-system/commit/4c8103bed99c3d31813f5450a6f4d1938fd74f25))


### Documentation

* plan drop unread special.tool_call_limit from schema ([#18](https://github.com/gotgenes/pi-permission-system/issues/18)) ([c45f6f7](https://github.com/gotgenes/pi-permission-system/commit/c45f6f7e5a504cac4f6156a97f51ff9588639d94))
* remove tool_call_limit from schema and README ([#18](https://github.com/gotgenes/pi-permission-system/issues/18)) ([780b414](https://github.com/gotgenes/pi-permission-system/commit/780b41431b1ac06ccf11dca00e1c59575386bbd2))

## [1.0.0](https://github.com/gotgenes/pi-permission-system/compare/v0.8.0...v1.0.0) (2026-05-03)


### ⚠ BREAKING CHANGES

* The bundled temperature-stripping shim for OpenAI Responses-style APIs (openai-codex-responses, openai-responses, azure-openai-responses) has been removed. This module monkey-patched the provider stack at the process level and had no connection to permission enforcement. Users who need the shim can extract it into a standalone extension.

### Features

* remove out-of-scope model-option-compatibility provider shim ([#17](https://github.com/gotgenes/pi-permission-system/issues/17)) ([b390896](https://github.com/gotgenes/pi-permission-system/commit/b39089611fe565f81dacf7fa0bff3af36d50f7ce))


### Documentation

* plan removal of out-of-scope model-option-compatibility shim ([#17](https://github.com/gotgenes/pi-permission-system/issues/17)) ([a48f2ef](https://github.com/gotgenes/pi-permission-system/commit/a48f2ef025cbe970d21071b94552fcb9a4f7de89))
* **retro:** add retro notes for issue [#16](https://github.com/gotgenes/pi-permission-system/issues/16) ([ee710cb](https://github.com/gotgenes/pi-permission-system/commit/ee710cba9b1fe92a39016c61348d2a0eb2895d1f))

## [0.8.0](https://github.com/gotgenes/pi-permission-system/compare/v0.7.0...v0.8.0) (2026-05-03)


### Features

* replace vendored zellij-modal with direct pi-tui SettingsList ([#16](https://github.com/gotgenes/pi-permission-system/issues/16)) ([868675f](https://github.com/gotgenes/pi-permission-system/commit/868675ff2df1ab429dc48160c7e545ddc8a451e1))


### Documentation

* plan delete vendored zellij-modal and rebuild settings UI ([#16](https://github.com/gotgenes/pi-permission-system/issues/16)) ([35274da](https://github.com/gotgenes/pi-permission-system/commit/35274da005b90023de29bbc144abfa6ad27bb73c))


### Miscellaneous Chores

* add project-local pi-autoformat config ([13a6f33](https://github.com/gotgenes/pi-permission-system/commit/13a6f339a52a546812432bc055bdb32cc2bd6d90))

## [0.7.0](https://github.com/gotgenes/pi-permission-system/compare/v0.6.1...v0.7.0) (2026-05-02)


### Features

* add prek pre-commit hooks for Biome and markdownlint ([#14](https://github.com/gotgenes/pi-permission-system/issues/14)) ([1093e87](https://github.com/gotgenes/pi-permission-system/commit/1093e8774145517f4b65f1e489a86143d7c54fb0))
* align prek config with pi-autoformat conventions ([#14](https://github.com/gotgenes/pi-permission-system/issues/14)) ([a9b72aa](https://github.com/gotgenes/pi-permission-system/commit/a9b72aaecaa8c5d7fc5feac588ef2da2c4e5372d))


### Bug Fixes

* use check-only mode for pre-commit hooks ([#14](https://github.com/gotgenes/pi-permission-system/issues/14)) ([fc37f1f](https://github.com/gotgenes/pi-permission-system/commit/fc37f1f1aa6d3aed9a8b8c9c88a98bf021250996))


### Documentation

* plan prek pre-commit linting setup ([#14](https://github.com/gotgenes/pi-permission-system/issues/14)) ([5debd98](https://github.com/gotgenes/pi-permission-system/commit/5debd986bd24621105d1138daacb17fa4fb3ab8e))
* **retro:** add retro notes for issue [#13](https://github.com/gotgenes/pi-permission-system/issues/13) ([a0b889d](https://github.com/gotgenes/pi-permission-system/commit/a0b889d176ed607e5fcf3af793318ab35c871ac3))

## [0.6.1](https://github.com/gotgenes/pi-permission-system/compare/v0.6.0...v0.6.1) (2026-05-02)


### Bug Fixes

* consolidate duplicate session_start handlers ([#13](https://github.com/gotgenes/pi-permission-system/issues/13)) ([6f5591a](https://github.com/gotgenes/pi-permission-system/commit/6f5591ac6097f5411075e2d10469df9ec5445329))


### Documentation

* plan consolidate duplicate session_start handlers ([#13](https://github.com/gotgenes/pi-permission-system/issues/13)) ([3b045c2](https://github.com/gotgenes/pi-permission-system/commit/3b045c272a848687642bedca7da463ab56ade688))
* remove dual-handler caveat from AGENTS.md ([#13](https://github.com/gotgenes/pi-permission-system/issues/13)) ([5e8bf87](https://github.com/gotgenes/pi-permission-system/commit/5e8bf870fb3aa04c942e6804a5c2023c1e3e487e))
* **retro:** add retro notes for issue [#6](https://github.com/gotgenes/pi-permission-system/issues/6) ([8921a47](https://github.com/gotgenes/pi-permission-system/commit/8921a473f1864d2c0f3c8417f6effdcbc6b35e89))

## [0.6.0](https://github.com/gotgenes/pi-permission-system/compare/v0.5.0...v0.6.0) (2026-05-02)


### Features

* add getResolvedPolicyPaths to PermissionManager ([#6](https://github.com/gotgenes/pi-permission-system/issues/6)) ([663b892](https://github.com/gotgenes/pi-permission-system/commit/663b892fbcaa092c9ac139283ed2e7bdd7e42b43))
* emit config.resolved review-log entry at startup ([#6](https://github.com/gotgenes/pi-permission-system/issues/6)) ([6968171](https://github.com/gotgenes/pi-permission-system/commit/6968171aca2e86c60a104c09df7d58d5bb1e59aa))


### Documentation

* document config.resolved diagnostic log entry ([#6](https://github.com/gotgenes/pi-permission-system/issues/6)) ([332fe41](https://github.com/gotgenes/pi-permission-system/commit/332fe413457a6913021ffc4cb8d6e80a7cd7fff2))
* plan config.resolved diagnostic log entry ([#6](https://github.com/gotgenes/pi-permission-system/issues/6)) ([8d51ff3](https://github.com/gotgenes/pi-permission-system/commit/8d51ff3a4464866ba9604e3bd6b52ab9bfb8f258))

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
