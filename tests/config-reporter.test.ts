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
import { buildResolvedConfigLogEntry } from "../src/config-reporter.js";
import { createPermissionSystemLogger } from "../src/logging.js";
import type { ResolvedPolicyPaths } from "../src/permission-manager.js";
import { PermissionManager } from "../src/permission-manager.js";

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

  assert.equal(
    result.extensionConfigPath,
    "/ext/pi-permission-system/config.json",
  );
  assert.equal(result.extensionConfigExists, true);
  assert.equal(
    result.globalConfigPath,
    "/home/user/.pi/agent/pi-permissions.jsonc",
  );
  assert.equal(result.globalConfigExists, true);
  assert.equal(
    result.projectConfigPath,
    "/projects/my-app/.pi/agent/pi-permissions.jsonc",
  );
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

    const extensionConfigPath = join(tempDir, "config.json");
    writeFileSync(extensionConfigPath, "{}", "utf-8");

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
    const entry = buildResolvedConfigLogEntry(
      extensionConfigPath,
      true,
      policyPaths,
    );
    logger.review(
      "config.resolved",
      entry as unknown as Record<string, unknown>,
    );

    const logContent = readFileSync(reviewLogPath, "utf-8").trim();
    const parsed = JSON.parse(logContent) as Record<string, unknown>;

    assert.equal(parsed.event, "config.resolved");
    assert.equal(parsed.extensionConfigPath, extensionConfigPath);
    assert.equal(parsed.extensionConfigExists, true);
    assert.equal(parsed.globalConfigPath, globalConfigPath);
    assert.equal(parsed.globalConfigExists, true);
    assert.equal(parsed.agentsDir, agentsDir);
    assert.equal(parsed.agentsDirExists, false);
    assert.equal(parsed.projectConfigPath, null);
    assert.equal(parsed.projectConfigExists, false);
    assert.equal(parsed.projectAgentsDir, null);
    assert.equal(parsed.projectAgentsDirExists, false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
