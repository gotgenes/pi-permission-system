import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  loadAndMergeConfigs,
  loadUnifiedConfig,
  mergeUnifiedConfigs,
} from "../src/config-loader";

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

describe("loadAndMergeConfigs", () => {
  let tempDir: string;
  let agentDir: string;
  let cwd: string;
  let extensionRoot: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "config-merge-test-"));
    agentDir = join(tempDir, "agent");
    cwd = join(tempDir, "project");
    extensionRoot = join(tempDir, "ext");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeGlobal(content: Record<string, unknown>): void {
    const dir = join(agentDir, "extensions", "pi-permission-system");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "config.json"), JSON.stringify(content));
  }

  function writeProject(content: Record<string, unknown>): void {
    const dir = join(cwd, ".pi", "extensions", "pi-permission-system");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "config.json"), JSON.stringify(content));
  }

  function writeLegacyGlobalPolicy(content: Record<string, unknown>): void {
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(
      join(agentDir, "pi-permissions.jsonc"),
      JSON.stringify(content),
    );
  }

  function writeLegacyProjectPolicy(content: Record<string, unknown>): void {
    const dir = join(cwd, ".pi", "agent");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "pi-permissions.jsonc"), JSON.stringify(content));
  }

  function writeLegacyExtensionConfig(content: Record<string, unknown>): void {
    mkdirSync(extensionRoot, { recursive: true });
    writeFileSync(join(extensionRoot, "config.json"), JSON.stringify(content));
  }

  it("merges global and project new-layout configs", () => {
    writeGlobal({
      debugLog: true,
      defaultPolicy: { tools: "ask", bash: "deny" },
      tools: { read: "allow" },
    });
    writeProject({
      defaultPolicy: { tools: "allow" },
      tools: { write: "deny" },
    });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.issues).toEqual([]);
    expect(result.merged.debugLog).toBe(true);
    expect(result.merged.defaultPolicy).toEqual({
      tools: "allow",
      bash: "deny",
    });
    expect(result.merged.tools).toEqual({ read: "allow", write: "deny" });
  });

  it("detects legacy global policy and emits migration issue", () => {
    writeLegacyGlobalPolicy({
      defaultPolicy: { tools: "allow" },
      tools: { read: "allow" },
    });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain("pi-permissions.jsonc");
    expect(result.issues[0]).toContain("extensions/pi-permission-system");
    // Legacy values are merged
    expect(result.merged.defaultPolicy).toEqual({ tools: "allow" });
    expect(result.merged.tools).toEqual({ read: "allow" });
  });

  it("detects legacy project policy and emits migration issue", () => {
    writeLegacyProjectPolicy({
      bash: { "git status": "allow" },
    });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain(".pi/agent/pi-permissions.jsonc");
    expect(result.issues[0]).toContain(".pi/extensions/pi-permission-system");
    expect(result.merged.bash).toEqual({ "git status": "allow" });
  });

  it("detects legacy extension runtime config and emits migration issue", () => {
    writeLegacyExtensionConfig({
      debugLog: true,
      yoloMode: true,
    });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain(extensionRoot);
    expect(result.merged.debugLog).toBe(true);
    expect(result.merged.yoloMode).toBe(true);
  });

  it("does not emit legacy extension config issue when path equals new global path", () => {
    // If the extension happens to be installed at the new path, no warning
    const newGlobalDir = join(agentDir, "extensions", "pi-permission-system");
    mkdirSync(newGlobalDir, { recursive: true });
    writeFileSync(
      join(newGlobalDir, "config.json"),
      JSON.stringify({ debugLog: true }),
    );

    const result = loadAndMergeConfigs(agentDir, cwd, newGlobalDir);
    expect(result.issues.filter((i) => i.includes("legacy"))).toHaveLength(0);
  });

  it("emits no issues when no legacy files exist and no new files exist", () => {
    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    expect(result.issues).toEqual([]);
  });

  it("new-layout config takes precedence over legacy config at same scope", () => {
    writeGlobal({
      defaultPolicy: { tools: "deny" },
    });
    writeLegacyGlobalPolicy({
      defaultPolicy: { tools: "allow" },
    });

    const result = loadAndMergeConfigs(agentDir, cwd, extensionRoot);
    // New layout wins
    expect(result.merged.defaultPolicy).toEqual({ tools: "deny" });
    // But legacy still emits a migration warning
    expect(result.issues.some((i) => i.includes("pi-permissions.jsonc"))).toBe(
      true,
    );
  });
});
