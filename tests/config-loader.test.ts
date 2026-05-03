import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  loadUnifiedConfig,
  mergeUnifiedConfigs,
} from "../src/config-loader.js";

describe("loadUnifiedConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "config-loader-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("parses a valid JSON file with runtime knobs and policy", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        debugLog: true,
        permissionReviewLog: false,
        yoloMode: true,
        defaultPolicy: { tools: "allow", bash: "deny" },
        tools: { read: "allow", write: "deny" },
        bash: { "git status": "allow" },
      }),
    );

    const result = loadUnifiedConfig(configPath);
    expect(result.issues).toEqual([]);
    expect(result.config.debugLog).toBe(true);
    expect(result.config.permissionReviewLog).toBe(false);
    expect(result.config.yoloMode).toBe(true);
    expect(result.config.defaultPolicy).toEqual({
      tools: "allow",
      bash: "deny",
    });
    expect(result.config.tools).toEqual({ read: "allow", write: "deny" });
    expect(result.config.bash).toEqual({ "git status": "allow" });
  });

  it("strips JSONC comments before parsing", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      `{
  // This is a comment
  "debugLog": true,
  /* block comment */
  "defaultPolicy": { "tools": "ask" }
}`,
    );

    const result = loadUnifiedConfig(configPath);
    expect(result.issues).toEqual([]);
    expect(result.config.debugLog).toBe(true);
    expect(result.config.defaultPolicy).toEqual({ tools: "ask" });
  });

  it("ignores unknown keys without emitting issues", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        debugLog: false,
        unknownField: "ignored",
        anotherRandom: 42,
      }),
    );

    const result = loadUnifiedConfig(configPath);
    expect(result.issues).toEqual([]);
    expect(result.config.debugLog).toBe(false);
    expect(result.config).not.toHaveProperty("unknownField");
  });

  it("returns defaults and no issues when the file does not exist", () => {
    const configPath = join(tempDir, "nonexistent.json");
    const result = loadUnifiedConfig(configPath);
    expect(result.issues).toEqual([]);
    expect(result.config.debugLog).toBeUndefined();
    expect(result.config.defaultPolicy).toBeUndefined();
    expect(result.config.tools).toBeUndefined();
  });

  it("returns defaults and an issue when the file contains invalid JSON", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(configPath, "not valid json {{{");

    const result = loadUnifiedConfig(configPath);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain(configPath);
  });

  it("normalizes boolean fields strictly", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        debugLog: "yes",
        permissionReviewLog: 1,
        yoloMode: null,
      }),
    );

    const result = loadUnifiedConfig(configPath);
    // Non-boolean values are not included
    expect(result.config.debugLog).toBeUndefined();
    expect(result.config.permissionReviewLog).toBeUndefined();
    expect(result.config.yoloMode).toBeUndefined();
  });

  it("normalizes permission maps, keeping only valid PermissionState values", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        tools: { read: "allow", write: "invalid", edit: "deny" },
        bash: { "git *": "ask", "rm -rf": 42 },
      }),
    );

    const result = loadUnifiedConfig(configPath);
    expect(result.config.tools).toEqual({ read: "allow", edit: "deny" });
    expect(result.config.bash).toEqual({ "git *": "ask" });
  });

  it("collects deprecated special key issues", () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        special: { doom_loop: "deny", tool_call_limit: "ask" },
      }),
    );

    const result = loadUnifiedConfig(configPath);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain("tool_call_limit");
    expect(result.config.special).toEqual({ doom_loop: "deny" });
  });
});

describe("mergeUnifiedConfigs", () => {
  it("deep-merges object fields so project overrides global per-key", () => {
    const merged = mergeUnifiedConfigs(
      {
        defaultPolicy: { tools: "ask", bash: "deny" },
        tools: { read: "allow", write: "deny" },
        bash: { "git status": "allow" },
      },
      {
        defaultPolicy: { tools: "allow" },
        tools: { write: "allow", edit: "ask" },
      },
    );

    expect(merged.defaultPolicy).toEqual({ tools: "allow", bash: "deny" });
    expect(merged.tools).toEqual({
      read: "allow",
      write: "allow",
      edit: "ask",
    });
    expect(merged.bash).toEqual({ "git status": "allow" });
  });

  it("replaces scalar runtime knobs (project wins)", () => {
    const merged = mergeUnifiedConfigs(
      { debugLog: true, permissionReviewLog: true, yoloMode: false },
      { debugLog: false, yoloMode: true },
    );

    expect(merged.debugLog).toBe(false);
    expect(merged.permissionReviewLog).toBe(true);
    expect(merged.yoloMode).toBe(true);
  });

  it("returns base unchanged when override is empty", () => {
    const base = {
      debugLog: true,
      defaultPolicy: { tools: "ask" as const },
      tools: { read: "allow" as const },
    };
    const merged = mergeUnifiedConfigs(base, {});

    expect(merged.debugLog).toBe(true);
    expect(merged.defaultPolicy).toEqual({ tools: "ask" });
    expect(merged.tools).toEqual({ read: "allow" });
  });

  it("returns override unchanged when base is empty", () => {
    const override = {
      yoloMode: true,
      bash: { "rm -rf": "deny" as const },
    };
    const merged = mergeUnifiedConfigs({}, override);

    expect(merged.yoloMode).toBe(true);
    expect(merged.bash).toEqual({ "rm -rf": "deny" });
  });

  it("does not set undefined keys in the merged result", () => {
    const merged = mergeUnifiedConfigs({ debugLog: true }, { yoloMode: false });

    expect(merged.debugLog).toBe(true);
    expect(merged.yoloMode).toBe(false);
    expect(merged).not.toHaveProperty("permissionReviewLog");
    expect(merged).not.toHaveProperty("defaultPolicy");
    expect(merged).not.toHaveProperty("tools");
  });
});
