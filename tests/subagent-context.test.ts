import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SUBAGENT_ENV_HINT_KEYS } from "../src/permission-forwarding";
import {
  isSubagentExecutionContext,
  normalizeFilesystemPath,
} from "../src/subagent-context";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function makeCtx(sessionDir: string | null): ExtensionContext {
  return {
    sessionManager: {
      getSessionDir: vi.fn(() => sessionDir),
    },
  } as unknown as ExtensionContext;
}

describe("normalizeFilesystemPath", () => {
  test("normalizes a simple absolute path", () => {
    expect(normalizeFilesystemPath("/projects/my-app")).toBe(
      "/projects/my-app",
    );
  });

  test("collapses redundant separators", () => {
    expect(normalizeFilesystemPath("/projects//my-app")).toBe(
      "/projects/my-app",
    );
  });

  test("resolves . and .. segments", () => {
    expect(normalizeFilesystemPath("/projects/my-app/../other")).toBe(
      "/projects/other",
    );
  });
});

describe("isSubagentExecutionContext — env hint detection", () => {
  test("returns true when PI_IS_SUBAGENT is set", () => {
    vi.stubEnv("PI_IS_SUBAGENT", "true");
    expect(
      isSubagentExecutionContext(makeCtx(null), "/sessions/subagents"),
    ).toBe(true);
  });

  test("returns true when PI_SUBAGENT_SESSION_ID is set", () => {
    vi.stubEnv("PI_SUBAGENT_SESSION_ID", "abc123");
    expect(
      isSubagentExecutionContext(makeCtx(null), "/sessions/subagents"),
    ).toBe(true);
  });

  test("returns true when PI_AGENT_ROUTER_SUBAGENT is set", () => {
    vi.stubEnv("PI_AGENT_ROUTER_SUBAGENT", "1");
    expect(
      isSubagentExecutionContext(makeCtx(null), "/sessions/subagents"),
    ).toBe(true);
  });

  test("covers all three declared SUBAGENT_ENV_HINT_KEYS", () => {
    // Verify the keys we test match what the module declares.
    expect(SUBAGENT_ENV_HINT_KEYS).toContain("PI_IS_SUBAGENT");
    expect(SUBAGENT_ENV_HINT_KEYS).toContain("PI_SUBAGENT_SESSION_ID");
    expect(SUBAGENT_ENV_HINT_KEYS).toContain("PI_AGENT_ROUTER_SUBAGENT");
  });

  test("returns false when env hint value is empty string", () => {
    vi.stubEnv("PI_IS_SUBAGENT", "");
    expect(
      isSubagentExecutionContext(makeCtx(null), "/sessions/subagents"),
    ).toBe(false);
  });

  test("returns false when env hint value is whitespace only", () => {
    vi.stubEnv("PI_IS_SUBAGENT", "   ");
    expect(
      isSubagentExecutionContext(makeCtx(null), "/sessions/subagents"),
    ).toBe(false);
  });
});

describe("isSubagentExecutionContext — session dir detection", () => {
  const subagentRoot = "/home/user/.pi/agent/sessions/subagents";

  test("returns true when session dir is within subagent root", () => {
    const sessionDir = `${subagentRoot}/session-abc`;
    expect(isSubagentExecutionContext(makeCtx(sessionDir), subagentRoot)).toBe(
      true,
    );
  });

  test("returns true when session dir equals subagent root", () => {
    expect(
      isSubagentExecutionContext(makeCtx(subagentRoot), subagentRoot),
    ).toBe(true);
  });

  test("returns false when session dir is outside subagent root", () => {
    const sessionDir = "/home/user/.pi/agent/sessions/main-session";
    expect(isSubagentExecutionContext(makeCtx(sessionDir), subagentRoot)).toBe(
      false,
    );
  });

  test("returns false when session dir is a sibling with shared prefix", () => {
    // "/sessions/subagents-extra" should not match root "/sessions/subagents"
    const sessionDir = `${subagentRoot}-extra/session-abc`;
    expect(isSubagentExecutionContext(makeCtx(sessionDir), subagentRoot)).toBe(
      false,
    );
  });

  test("returns false when getSessionDir returns null", () => {
    expect(isSubagentExecutionContext(makeCtx(null), subagentRoot)).toBe(false);
  });

  test("returns false when getSessionDir returns empty string", () => {
    expect(isSubagentExecutionContext(makeCtx(""), subagentRoot)).toBe(false);
  });
});
