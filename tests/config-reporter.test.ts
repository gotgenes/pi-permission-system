import assert from "node:assert/strict";
import { test } from "vitest";
import { buildResolvedConfigLogEntry } from "../src/config-reporter.js";
import type { ResolvedPolicyPaths } from "../src/permission-manager.js";

test("buildResolvedConfigLogEntry merges extension config path with policy paths", () => {
  const policyPaths: ResolvedPolicyPaths = {
    globalConfigPath: "/home/user/.pi/agent/pi-permissions.jsonc",
    globalConfigExists: true,
    projectConfigPath: "/projects/my-app/.pi/agent/pi-permissions.jsonc",
    projectConfigExists: false,
    agentsDir: "/home/user/.pi/agent/agents",
    agentsDirExists: true,
    projectAgentsDir: "/projects/my-app/.pi/agent/agents",
    projectAgentsDirExists: false,
  };

  const result = buildResolvedConfigLogEntry(
    "/ext/pi-permission-system/config.json",
    true,
    policyPaths,
  );

  assert.equal(result.extensionConfigPath, "/ext/pi-permission-system/config.json");
  assert.equal(result.extensionConfigExists, true);
  assert.equal(result.globalConfigPath, "/home/user/.pi/agent/pi-permissions.jsonc");
  assert.equal(result.globalConfigExists, true);
  assert.equal(result.projectConfigPath, "/projects/my-app/.pi/agent/pi-permissions.jsonc");
  assert.equal(result.projectConfigExists, false);
  assert.equal(result.agentsDir, "/home/user/.pi/agent/agents");
  assert.equal(result.agentsDirExists, true);
  assert.equal(result.projectAgentsDir, "/projects/my-app/.pi/agent/agents");
  assert.equal(result.projectAgentsDirExists, false);
});

test("buildResolvedConfigLogEntry handles null project paths", () => {
  const policyPaths: ResolvedPolicyPaths = {
    globalConfigPath: "/home/user/.pi/agent/pi-permissions.jsonc",
    globalConfigExists: false,
    projectConfigPath: null,
    projectConfigExists: false,
    agentsDir: "/home/user/.pi/agent/agents",
    agentsDirExists: false,
    projectAgentsDir: null,
    projectAgentsDirExists: false,
  };

  const result = buildResolvedConfigLogEntry(
    "/ext/config.json",
    false,
    policyPaths,
  );

  assert.equal(result.extensionConfigPath, "/ext/config.json");
  assert.equal(result.extensionConfigExists, false);
  assert.equal(result.projectConfigPath, null);
  assert.equal(result.projectConfigExists, false);
  assert.equal(result.projectAgentsDir, null);
  assert.equal(result.projectAgentsDirExists, false);
});
