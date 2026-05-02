import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  detectMisplacedPermissionKeys,
  loadPermissionSystemConfig,
} from "../src/extension-config.js";

describe("detectMisplacedPermissionKeys", () => {
  it("returns an empty array for a record with only valid extension keys", () => {
    const result = detectMisplacedPermissionKeys({
      debugLog: true,
      permissionReviewLog: true,
      yoloMode: false,
    });
    expect(result).toEqual([]);
  });

  it("returns an empty array for an empty record", () => {
    const result = detectMisplacedPermissionKeys({});
    expect(result).toEqual([]);
  });

  it("returns misplaced key names when permission-rule keys are present", () => {
    const result = detectMisplacedPermissionKeys({
      debugLog: true,
      defaultPolicy: { tools: "ask" },
      bash: { "git status": "allow" },
    });
    expect(result).toEqual(["defaultPolicy", "bash"]);
  });

  it("detects all known permission-rule keys", () => {
    const result = detectMisplacedPermissionKeys({
      defaultPolicy: {},
      tools: {},
      bash: {},
      mcp: {},
      skills: {},
      special: {},
      external_directory: {},
      doom_loop: {},
    });
    expect(result).toEqual([
      "defaultPolicy",
      "tools",
      "bash",
      "mcp",
      "skills",
      "special",
      "external_directory",
      "doom_loop",
    ]);
  });

  it("ignores unknown keys that are not permission-rule keys", () => {
    const result = detectMisplacedPermissionKeys({
      debugLog: true,
      someRandomKey: "value",
    });
    expect(result).toEqual([]);
  });
});

describe("loadPermissionSystemConfig", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "perm-config-test-"));
    configPath = join(tempDir, "config.json");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns no warning for a clean config", () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        debugLog: false,
        permissionReviewLog: true,
        yoloMode: false,
      }),
    );
    const result = loadPermissionSystemConfig(configPath);
    expect(result.warning).toBeUndefined();
  });

  it("returns a warning naming misplaced permission-rule keys", () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        debugLog: true,
        defaultPolicy: { tools: "ask" },
        bash: { "git status": "allow" },
      }),
    );
    const result = loadPermissionSystemConfig(configPath);
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain("defaultPolicy");
    expect(result.warning).toContain("bash");
    expect(result.warning).toContain("pi-permissions.jsonc");
  });

  it("still returns the valid extension config fields when misplaced keys are present", () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        debugLog: true,
        bash: { "git status": "allow" },
      }),
    );
    const result = loadPermissionSystemConfig(configPath);
    expect(result.config.debugLog).toBe(true);
  });
});
