import { afterEach, describe, expect, test, vi } from "vitest";
import type { PermissionManager } from "../src/permission-manager.js";
import {
  findSkillPathMatch,
  resolveSkillPromptEntries,
} from "../src/skill-prompt-sanitizer.js";
import type { PermissionCheckResult } from "../src/types.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helpers ────────────────────────────────────────────────────────────────

const CWD = "/projects/my-app";

function makeManager(
  defaultState: "allow" | "deny" | "ask" = "allow",
  overrides: Record<string, "allow" | "deny" | "ask"> = {},
): PermissionManager {
  return {
    checkPermission: vi.fn(
      (_surface: string, input: { name?: string }): PermissionCheckResult => {
        const name = input.name ?? "";
        const state = overrides[name] ?? defaultState;
        return { toolName: "skill", state, source: "tool" };
      },
    ),
  } as unknown as PermissionManager;
}

function skillBlock(
  name: string,
  location = `/skills/${name}/SKILL.md`,
): string {
  return [
    "  <skill>",
    `    <name>${name}</name>`,
    `    <description>Description of ${name}</description>`,
    `    <location>${location}</location>`,
    "  </skill>",
  ].join("\n");
}

function availableSkillsSection(...names: string[]): string {
  return [
    "<available_skills>",
    ...names.map((n) => skillBlock(n)),
    "</available_skills>",
  ].join("\n");
}

// ── resolveSkillPromptEntries ───────────────────────────────────────────────

describe("resolveSkillPromptEntries", () => {
  test("returns unchanged prompt and empty entries when no skills section present", () => {
    const input = "You are a helpful assistant.";
    const manager = makeManager("allow");
    const result = resolveSkillPromptEntries(input, manager, null, CWD);
    expect(result.prompt).toBe(input);
    expect(result.entries).toEqual([]);
    expect(manager.checkPermission).not.toHaveBeenCalled();
  });

  test("keeps all skills when all are allowed", () => {
    const input = availableSkillsSection("librarian", "ask-user");
    const manager = makeManager("allow");
    const result = resolveSkillPromptEntries(input, manager, null, CWD);
    expect(result.prompt).toContain("librarian");
    expect(result.prompt).toContain("ask-user");
    expect(result.entries).toHaveLength(2);
  });

  test("removes denied skill from section", () => {
    const input = availableSkillsSection("librarian", "dangerous");
    const manager = makeManager("allow", { dangerous: "deny" });
    const result = resolveSkillPromptEntries(input, manager, null, CWD);
    expect(result.prompt).toContain("librarian");
    expect(result.prompt).not.toContain("dangerous");
    // denied skill is excluded from returned entries
    expect(result.entries.map((e) => e.name)).not.toContain("dangerous");
  });

  test("removes entire section when all skills are denied", () => {
    const input = `Intro\n${availableSkillsSection("dangerous")}\nOutro`;
    const manager = makeManager("deny");
    const result = resolveSkillPromptEntries(input, manager, null, CWD);
    expect(result.prompt).not.toContain("<available_skills>");
    expect(result.prompt).toContain("Intro");
    expect(result.prompt).toContain("Outro");
    expect(result.entries).toHaveLength(0);
  });

  test("keeps ask-state skills in section and entries", () => {
    const input = availableSkillsSection("librarian");
    const manager = makeManager("ask");
    const result = resolveSkillPromptEntries(input, manager, null, CWD);
    expect(result.prompt).toContain("librarian");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].state).toBe("ask");
  });

  test("delegates permission check to permissionManager for each skill", () => {
    const input = availableSkillsSection("alpha", "beta");
    const manager = makeManager("allow");
    resolveSkillPromptEntries(input, manager, null, CWD);
    expect(manager.checkPermission).toHaveBeenCalledWith(
      "skill",
      { name: "alpha" },
      undefined,
    );
    expect(manager.checkPermission).toHaveBeenCalledWith(
      "skill",
      { name: "beta" },
      undefined,
    );
  });

  test("passes agentName to permissionManager", () => {
    const input = availableSkillsSection("librarian");
    const manager = makeManager("allow");
    resolveSkillPromptEntries(input, manager, "my-agent", CWD);
    expect(manager.checkPermission).toHaveBeenCalledWith(
      "skill",
      { name: "librarian" },
      "my-agent",
    );
  });

  test("caches permission result: checkPermission called once per unique skill name", () => {
    // Same skill appears in two separate sections.
    const input = [
      availableSkillsSection("librarian"),
      availableSkillsSection("librarian"),
    ].join("\n");
    const manager = makeManager("allow");
    resolveSkillPromptEntries(input, manager, null, CWD);
    // Should only be called once despite appearing twice.
    expect(manager.checkPermission).toHaveBeenCalledTimes(1);
  });

  test("resolves entry normalizedLocation relative to cwd", () => {
    const location = "/skills/librarian/SKILL.md";
    const input = availableSkillsSection("librarian");
    const manager = makeManager("allow");
    const result = resolveSkillPromptEntries(input, manager, null, CWD);
    expect(result.entries[0].normalizedLocation).toBe(location);
    expect(result.entries[0].normalizedBaseDir).toBe("/skills/librarian");
  });

  test("handles multi-section prompt: processes each section independently", () => {
    const section1 = availableSkillsSection("alpha");
    const section2 = availableSkillsSection("beta");
    const input = `${section1}\n${section2}`;
    const manager = makeManager("allow", { beta: "deny" });
    const result = resolveSkillPromptEntries(input, manager, null, CWD);
    expect(result.entries.map((e) => e.name)).toContain("alpha");
    expect(result.entries.map((e) => e.name)).not.toContain("beta");
  });
});

// ── findSkillPathMatch ──────────────────────────────────────────────────────

describe("findSkillPathMatch", () => {
  const entries = [
    {
      name: "librarian",
      description: "desc",
      location: "/skills/librarian/SKILL.md",
      state: "allow" as const,
      normalizedLocation: "/skills/librarian/SKILL.md",
      normalizedBaseDir: "/skills/librarian",
    },
    {
      name: "ask-user",
      description: "desc",
      location: "/skills/ask-user/SKILL.md",
      state: "allow" as const,
      normalizedLocation: "/skills/ask-user/SKILL.md",
      normalizedBaseDir: "/skills/ask-user",
    },
  ];

  test("returns null for empty normalized path", () => {
    expect(findSkillPathMatch("", entries)).toBeNull();
  });

  test("returns null for empty entries array", () => {
    expect(findSkillPathMatch("/skills/librarian/SKILL.md", [])).toBeNull();
  });

  test("matches exact location path", () => {
    const match = findSkillPathMatch("/skills/librarian/SKILL.md", entries);
    expect(match?.name).toBe("librarian");
  });

  test("matches path within skill base directory", () => {
    const match = findSkillPathMatch(
      "/skills/librarian/extra/helper.md",
      entries,
    );
    expect(match?.name).toBe("librarian");
  });

  test("returns null for path not within any skill directory", () => {
    const match = findSkillPathMatch("/other/path/file.md", entries);
    expect(match).toBeNull();
  });

  test("returns null for sibling path that shares a prefix", () => {
    // "/skills/librarian-extra" should not match "/skills/librarian"
    const match = findSkillPathMatch(
      "/skills/librarian-extra/SKILL.md",
      entries,
    );
    expect(match).toBeNull();
  });

  test("prefers longer matching base directory (most specific skill wins)", () => {
    const nestedEntries = [
      {
        name: "parent",
        description: "desc",
        location: "/skills/parent/SKILL.md",
        state: "allow" as const,
        normalizedLocation: "/skills/parent/SKILL.md",
        normalizedBaseDir: "/skills/parent",
      },
      {
        name: "child",
        description: "desc",
        location: "/skills/parent/child/SKILL.md",
        state: "allow" as const,
        normalizedLocation: "/skills/parent/child/SKILL.md",
        normalizedBaseDir: "/skills/parent/child",
      },
    ];
    const match = findSkillPathMatch(
      "/skills/parent/child/helper.md",
      nestedEntries,
    );
    expect(match?.name).toBe("child");
  });
});
