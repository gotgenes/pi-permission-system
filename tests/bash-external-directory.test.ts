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
  extractExternalPathsFromBashCommand,
  formatBashExternalDirectoryAskPrompt,
  formatBashExternalDirectoryDenyReason,
} from "../src/external-directory";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("extractExternalPathsFromBashCommand", () => {
  const cwd = "/projects/my-app";

  describe("absolute paths", () => {
    test("detects absolute path outside CWD", () => {
      const result = extractExternalPathsFromBashCommand("cat /etc/hosts", cwd);
      expect(result).toContain("/etc/hosts");
    });

    test("detects multiple absolute paths outside CWD", () => {
      const result = extractExternalPathsFromBashCommand(
        "diff /etc/hosts /var/log/syslog",
        cwd,
      );
      expect(result).toContain("/etc/hosts");
      expect(result).toContain("/var/log/syslog");
    });

    test("does not flag absolute path within CWD", () => {
      const result = extractExternalPathsFromBashCommand(
        "cat /projects/my-app/src/index.ts",
        cwd,
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("home-relative paths", () => {
    test("detects ~/path outside CWD", () => {
      const result = extractExternalPathsFromBashCommand(
        "cat ~/documents/secret.txt",
        cwd,
      );
      expect(result).toContain("/mock/home/documents/secret.txt");
    });

    test("does not flag ~/path that resolves within CWD", () => {
      // CWD is under /mock/home for this test
      const result = extractExternalPathsFromBashCommand(
        "cat ~/myproject/file.ts",
        "/mock/home/myproject",
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("dot-dot relative paths", () => {
    test("detects ../ path that resolves outside CWD", () => {
      const result = extractExternalPathsFromBashCommand(
        "cat ../../other-project/secrets.env",
        cwd,
      );
      expect(result).toContain("/other-project/secrets.env");
    });

    test("does not flag ../ path that stays within CWD", () => {
      const result = extractExternalPathsFromBashCommand(
        "cat src/../lib/utils.ts",
        cwd,
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("commands within CWD only", () => {
    test("returns empty for relative paths within CWD", () => {
      const result = extractExternalPathsFromBashCommand(
        "cat src/index.ts",
        cwd,
      );
      expect(result).toHaveLength(0);
    });

    test("returns empty for bare command with no path arguments", () => {
      const result = extractExternalPathsFromBashCommand("git status", cwd);
      expect(result).toHaveLength(0);
    });
  });

  describe("flags are skipped", () => {
    test("does not treat flags as paths", () => {
      const result = extractExternalPathsFromBashCommand(
        "ls -la --color=auto",
        cwd,
      );
      expect(result).toHaveLength(0);
    });

    test("detects path after flags", () => {
      const result = extractExternalPathsFromBashCommand(
        "ls -la /etc/passwd",
        cwd,
      );
      expect(result).toContain("/etc/passwd");
    });
  });

  describe("env assignments are skipped", () => {
    test("does not treat FOO=/bar as a path", () => {
      const result = extractExternalPathsFromBashCommand(
        "FOO=/usr/local/bin command",
        cwd,
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("shell metacharacters split correctly", () => {
    test("detects path after pipe", () => {
      const result = extractExternalPathsFromBashCommand(
        "echo hello | tee /tmp/output.txt",
        cwd,
      );
      expect(result).toContain("/tmp/output.txt");
    });

    test("detects path after semicolon", () => {
      const result = extractExternalPathsFromBashCommand(
        "echo done; cat /etc/hosts",
        cwd,
      );
      expect(result).toContain("/etc/hosts");
    });

    test("detects path after &&", () => {
      const result = extractExternalPathsFromBashCommand(
        "true && cat /etc/hosts",
        cwd,
      );
      expect(result).toContain("/etc/hosts");
    });

    test("detects path in redirect target", () => {
      const result = extractExternalPathsFromBashCommand(
        "echo hello > /tmp/out.txt",
        cwd,
      );
      expect(result).toContain("/tmp/out.txt");
    });
  });

  describe("URLs are skipped", () => {
    test("does not treat http:// URL as a path", () => {
      const result = extractExternalPathsFromBashCommand(
        "curl http://example.com/path",
        cwd,
      );
      expect(result).toHaveLength(0);
    });

    test("does not treat https:// URL as a path", () => {
      const result = extractExternalPathsFromBashCommand(
        "curl https://example.com/etc/hosts",
        cwd,
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("@scope/package patterns are skipped", () => {
    test("does not treat @scope/package as a path", () => {
      const result = extractExternalPathsFromBashCommand(
        "npm install @types/node",
        cwd,
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("deduplication", () => {
    test("returns deduplicated paths", () => {
      const result = extractExternalPathsFromBashCommand(
        "cat /etc/hosts; grep foo /etc/hosts",
        cwd,
      );
      const etcHostsCount = result.filter((p) => p === "/etc/hosts").length;
      expect(etcHostsCount).toBe(1);
    });
  });
});

describe("formatBashExternalDirectoryAskPrompt", () => {
  test("includes command, external paths, and CWD", () => {
    const result = formatBashExternalDirectoryAskPrompt(
      "cat /etc/hosts",
      ["/etc/hosts"],
      "/projects/my-app",
    );
    expect(result).toContain("cat /etc/hosts");
    expect(result).toContain("/etc/hosts");
    expect(result).toContain("/projects/my-app");
  });

  test("includes agent name when provided", () => {
    const result = formatBashExternalDirectoryAskPrompt(
      "cat /etc/hosts",
      ["/etc/hosts"],
      "/projects/my-app",
      "my-agent",
    );
    expect(result).toContain("my-agent");
  });

  test("shows multiple external paths", () => {
    const result = formatBashExternalDirectoryAskPrompt(
      "diff /etc/hosts /var/log/syslog",
      ["/etc/hosts", "/var/log/syslog"],
      "/projects/my-app",
    );
    expect(result).toContain("/etc/hosts");
    expect(result).toContain("/var/log/syslog");
  });
});

describe("formatBashExternalDirectoryDenyReason", () => {
  test("includes command, external paths, and CWD", () => {
    const result = formatBashExternalDirectoryDenyReason(
      "cat /etc/hosts",
      ["/etc/hosts"],
      "/projects/my-app",
    );
    expect(result).toContain("cat /etc/hosts");
    expect(result).toContain("/etc/hosts");
    expect(result).toContain("/projects/my-app");
  });

  test("includes hard stop hint", () => {
    const result = formatBashExternalDirectoryDenyReason(
      "cat /etc/hosts",
      ["/etc/hosts"],
      "/projects/my-app",
    );
    expect(result).toContain("Hard stop");
  });

  test("includes agent name when provided", () => {
    const result = formatBashExternalDirectoryDenyReason(
      "cat /etc/hosts",
      ["/etc/hosts"],
      "/projects/my-app",
      "my-agent",
    );
    expect(result).toContain("my-agent");
  });
});
