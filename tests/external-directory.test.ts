import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

// Mock node:os so tilde-expansion is deterministic across platforms.
vi.mock("node:os", () => {
  const homedir = vi.fn(() => "/mock/home");
  return {
    homedir,
    default: { homedir },
  };
});

import {
  formatExternalDirectoryAskPrompt,
  formatExternalDirectoryDenyReason,
  formatExternalDirectoryHardStopHint,
  formatExternalDirectoryUserDeniedReason,
  getPathBearingToolPath,
  isPathOutsideWorkingDirectory,
  isPathWithinDirectory,
  normalizePathForComparison,
  PATH_BEARING_TOOLS,
} from "../src/external-directory.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PATH_BEARING_TOOLS", () => {
  test("contains the expected tool names", () => {
    for (const tool of ["read", "write", "edit", "find", "grep", "ls"]) {
      expect(PATH_BEARING_TOOLS.has(tool)).toBe(true);
    }
  });

  test("does not contain bash or mcp", () => {
    expect(PATH_BEARING_TOOLS.has("bash")).toBe(false);
    expect(PATH_BEARING_TOOLS.has("mcp")).toBe(false);
  });
});

describe("normalizePathForComparison", () => {
  const cwd = "/projects/my-app";

  test("resolves absolute path unchanged", () => {
    expect(normalizePathForComparison("/usr/local/bin", cwd)).toBe(
      "/usr/local/bin",
    );
  });

  test("resolves relative path against cwd", () => {
    expect(normalizePathForComparison("src/foo.ts", cwd)).toBe(
      "/projects/my-app/src/foo.ts",
    );
  });

  test("expands bare ~ to homedir", () => {
    expect(normalizePathForComparison("~", cwd)).toBe("/mock/home");
  });

  test("expands ~/... to homedir-relative path", () => {
    expect(normalizePathForComparison("~/docs/readme.md", cwd)).toBe(
      join("/mock/home", "docs/readme.md"),
    );
  });

  test("strips leading @ before resolving", () => {
    expect(normalizePathForComparison("@/usr/local/bin", cwd)).toBe(
      "/usr/local/bin",
    );
  });

  test("strips surrounding quotes", () => {
    expect(normalizePathForComparison("'/usr/local/bin'", cwd)).toBe(
      "/usr/local/bin",
    );
    expect(normalizePathForComparison('"/usr/local/bin"', cwd)).toBe(
      "/usr/local/bin",
    );
  });

  test("returns empty string for blank/whitespace-only path", () => {
    expect(normalizePathForComparison("", cwd)).toBe("");
    expect(normalizePathForComparison("   ", cwd)).toBe("");
  });
});

describe("isPathWithinDirectory", () => {
  test("returns true when path equals directory", () => {
    expect(isPathWithinDirectory("/a/b", "/a/b")).toBe(true);
  });

  test("returns true when path is a direct child", () => {
    expect(isPathWithinDirectory("/a/b/c", "/a/b")).toBe(true);
  });

  test("returns true when path is a deep descendant", () => {
    expect(isPathWithinDirectory("/a/b/c/d/e", "/a/b")).toBe(true);
  });

  test("returns false when path is a sibling directory", () => {
    expect(isPathWithinDirectory("/a/bc", "/a/b")).toBe(false);
  });

  test("returns false when path is outside the directory", () => {
    expect(isPathWithinDirectory("/other/path", "/a/b")).toBe(false);
  });

  test("returns false for empty path", () => {
    expect(isPathWithinDirectory("", "/a/b")).toBe(false);
  });

  test("returns false for empty directory", () => {
    expect(isPathWithinDirectory("/a/b", "")).toBe(false);
  });
});

describe("getPathBearingToolPath", () => {
  test("returns path for a path-bearing tool", () => {
    expect(getPathBearingToolPath("read", { path: "/src/foo.ts" })).toBe(
      "/src/foo.ts",
    );
  });

  test("returns null for a non-path-bearing tool", () => {
    expect(getPathBearingToolPath("bash", { path: "/src/foo.ts" })).toBeNull();
    expect(getPathBearingToolPath("mcp", { path: "/src/foo.ts" })).toBeNull();
    expect(getPathBearingToolPath("task", { path: "/src/foo.ts" })).toBeNull();
  });

  test("returns null when input has no path", () => {
    expect(getPathBearingToolPath("read", {})).toBeNull();
    expect(getPathBearingToolPath("read", { path: "" })).toBeNull();
    expect(getPathBearingToolPath("read", null)).toBeNull();
  });
});

describe("isPathOutsideWorkingDirectory", () => {
  const cwd = "/projects/my-app";

  test("returns false when path is inside cwd", () => {
    expect(isPathOutsideWorkingDirectory("/projects/my-app/src", cwd)).toBe(
      false,
    );
  });

  test("returns false when path equals cwd", () => {
    expect(isPathOutsideWorkingDirectory("/projects/my-app", cwd)).toBe(false);
  });

  test("returns true when path is outside cwd", () => {
    expect(isPathOutsideWorkingDirectory("/etc/passwd", cwd)).toBe(true);
  });

  test("returns true for home directory when outside cwd", () => {
    expect(isPathOutsideWorkingDirectory("~/secrets", cwd)).toBe(true);
  });

  test("returns false for relative path resolving inside cwd", () => {
    expect(isPathOutsideWorkingDirectory("src/index.ts", cwd)).toBe(false);
  });

  test("returns false for empty path (normalizes to empty string)", () => {
    expect(isPathOutsideWorkingDirectory("", cwd)).toBe(false);
  });
});

describe("formatExternalDirectoryHardStopHint", () => {
  test("returns the hard stop instruction string", () => {
    const hint = formatExternalDirectoryHardStopHint();
    expect(hint).toContain("Hard stop");
    expect(hint).toContain("external directory");
  });
});

describe("formatExternalDirectoryAskPrompt", () => {
  test("uses 'Current agent' when no agent name provided", () => {
    const result = formatExternalDirectoryAskPrompt(
      "read",
      "/etc/passwd",
      "/projects/my-app",
    );
    expect(result).toContain("Current agent");
    expect(result).toContain("read");
    expect(result).toContain("/etc/passwd");
    expect(result).toContain("/projects/my-app");
  });

  test("uses agent name when provided", () => {
    const result = formatExternalDirectoryAskPrompt(
      "write",
      "/tmp/out.txt",
      "/projects/my-app",
      "my-agent",
    );
    expect(result).toContain("Agent 'my-agent'");
    expect(result).toContain("write");
    expect(result).toContain("/tmp/out.txt");
  });
});

describe("formatExternalDirectoryDenyReason", () => {
  test("includes tool name, path, cwd, agent name, and hard stop hint", () => {
    const result = formatExternalDirectoryDenyReason(
      "read",
      "/etc/passwd",
      "/projects/my-app",
      "sec-agent",
    );
    expect(result).toContain("Agent 'sec-agent'");
    expect(result).toContain("read");
    expect(result).toContain("/etc/passwd");
    expect(result).toContain("/projects/my-app");
    expect(result).toContain("Hard stop");
  });

  test("uses 'Current agent' without agent name", () => {
    const result = formatExternalDirectoryDenyReason(
      "read",
      "/etc",
      "/projects",
    );
    expect(result).toContain("Current agent");
  });
});

describe("formatExternalDirectoryUserDeniedReason", () => {
  test("includes tool name and path", () => {
    const result = formatExternalDirectoryUserDeniedReason(
      "edit",
      "/etc/hosts",
    );
    expect(result).toContain("edit");
    expect(result).toContain("/etc/hosts");
    expect(result).toContain("Hard stop");
  });

  test("appends denial reason when provided", () => {
    const result = formatExternalDirectoryUserDeniedReason(
      "edit",
      "/etc/hosts",
      "too risky",
    );
    expect(result).toContain("Reason: too risky");
  });

  test("omits reason suffix when not provided", () => {
    const result = formatExternalDirectoryUserDeniedReason(
      "edit",
      "/etc/hosts",
    );
    expect(result).not.toContain("Reason:");
  });
});
