import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { buildResolvedConfigLogEntry } from "../src/config-reporter";
import { createPermissionSystemLogger } from "../src/logging";
import type { ResolvedPolicyPaths } from "../src/permission-manager";
import { PermissionManager } from "../src/permission-manager";

test("buildResolvedConfigLogEntry includes policy paths and legacy detection flags", () => {
  const policyPaths: ResolvedPolicyPaths = {
    globalConfigPath:
      "/home/user/.pi/agent/extensions/pi-permission-system/config.json",
    globalConfigExists: true,
    projectConfigPath:
      "/projects/my-app/.pi/extensions/pi-permission-system/config.json",
    projectConfigExists: false,
    agentsDir: "/home/user/.pi/agent/agents",
    agentsDirExists: true,
    projectAgentsDir: "/projects/my-app/.pi/agent/agents",
    projectAgentsDirExists: false,
  };

  const result = buildResolvedConfigLogEntry({ policyPaths });

  assert.equal(
    result.globalConfigPath,
    "/home/user/.pi/agent/extensions/pi-permission-system/config.json",
  );
  assert.equal(result.globalConfigExists, true);
  assert.equal(
    result.projectConfigPath,
    "/projects/my-app/.pi/extensions/pi-permission-system/config.json",
  );
  assert.equal(result.projectConfigExists, false);
  assert.equal(result.agentsDir, "/home/user/.pi/agent/agents");
  assert.equal(result.agentsDirExists, true);
  assert.equal(result.projectAgentsDir, "/projects/my-app/.pi/agent/agents");
  assert.equal(result.projectAgentsDirExists, false);
  assert.equal(result.legacyGlobalPolicyDetected, false);
  assert.equal(result.legacyProjectPolicyDetected, false);
  assert.equal(result.legacyExtensionConfigDetected, false);
});

test("buildResolvedConfigLogEntry handles null project paths", () => {
  const policyPaths: ResolvedPolicyPaths = {
    globalConfigPath:
      "/home/user/.pi/agent/extensions/pi-permission-system/config.json",
    globalConfigExists: false,
    projectConfigPath: null,
    projectConfigExists: false,
    agentsDir: "/home/user/.pi/agent/agents",
    agentsDirExists: false,
    projectAgentsDir: null,
    projectAgentsDirExists: false,
  };

  const result = buildResolvedConfigLogEntry({ policyPaths });

  assert.equal(result.projectConfigPath, null);
  assert.equal(result.projectConfigExists, false);
  assert.equal(result.projectAgentsDir, null);
  assert.equal(result.projectAgentsDirExists, false);
});

test("buildResolvedConfigLogEntry surfaces legacy detection flags", () => {
  const policyPaths: ResolvedPolicyPaths = {
    globalConfigPath:
      "/home/user/.pi/agent/extensions/pi-permission-system/config.json",
    globalConfigExists: true,
    projectConfigPath: null,
    projectConfigExists: false,
    agentsDir: "/home/user/.pi/agent/agents",
    agentsDirExists: false,
    projectAgentsDir: null,
    projectAgentsDirExists: false,
  };

  const result = buildResolvedConfigLogEntry({
    policyPaths,
    legacyGlobalPolicyDetected: true,
    legacyExtensionConfigDetected: true,
  });

  assert.equal(result.legacyGlobalPolicyDetected, true);
  assert.equal(result.legacyProjectPolicyDetected, false);
  assert.equal(result.legacyExtensionConfigDetected, true);
});

test("config.resolved entry appears in review log via logger", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "config-resolved-log-"));
  try {
    const logsDir = join(tempDir, "logs");
    mkdirSync(logsDir, { recursive: true });
    const reviewLogPath = join(logsDir, "review.jsonl");

    const globalConfigPath = join(tempDir, "pi-permissions.jsonc");
    writeFileSync(globalConfigPath, "{}", "utf-8");
    const agentsDir = join(tempDir, "agents");

    const pm = new PermissionManager({
      globalConfigPath,
      agentsDir,
    });

    const logger = createPermissionSystemLogger({
      getConfig: () => ({
        debugLog: false,
        permissionReviewLog: true,
        yoloMode: false,
      }),
      reviewLogPath,
      ensureLogsDirectory: () => undefined,
    });

    const policyPaths = pm.getResolvedPolicyPaths();
    const entry = buildResolvedConfigLogEntry({ policyPaths });
    logger.review(
      "config.resolved",
      entry as unknown as Record<string, unknown>,
    );

    const logContent = readFileSync(reviewLogPath, "utf-8").trim();
    const parsed = JSON.parse(logContent) as Record<string, unknown>;

    assert.equal(parsed.event, "config.resolved");
    assert.equal(parsed.globalConfigPath, globalConfigPath);
    assert.equal(parsed.globalConfigExists, true);
    assert.equal(parsed.agentsDir, agentsDir);
    assert.equal(parsed.agentsDirExists, false);
    assert.equal(parsed.projectConfigPath, null);
    assert.equal(parsed.projectConfigExists, false);
    assert.equal(parsed.projectAgentsDir, null);
    assert.equal(parsed.projectAgentsDirExists, false);
    assert.equal(parsed.legacyGlobalPolicyDetected, false);
    assert.equal(parsed.legacyProjectPolicyDetected, false);
    assert.equal(parsed.legacyExtensionConfigDetected, false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
