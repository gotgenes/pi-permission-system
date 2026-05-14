import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  resolvePermissionForwardingTargetSessionId,
  SUBAGENT_PARENT_SESSION_ENV_CANDIDATES,
  SUBAGENT_PARENT_SESSION_ENV_KEY,
} from "../src/permission-forwarding";

afterEach(() => {
  vi.unstubAllEnvs();
});

function layoutParentChild(root: string, parentId: string): string {
  const parentName = `2026-05-11T14-52-32-234Z_${parentId}`;
  const childDir = join(root, parentName, "runId", "run-0");
  mkdirSync(childDir, { recursive: true });
  writeFileSync(
    join(root, `${parentName}.jsonl`),
    `${JSON.stringify({
      type: "session",
      version: 3,
      id: parentId,
      timestamp: "2026-05-11T14:52:32.234Z",
      cwd: "/home/me/proj",
    })}\n`,
    "utf-8",
  );
  return childDir;
}

describe("SUBAGENT_PARENT_SESSION_ENV_CANDIDATES", () => {
  test("is an array containing PI_AGENT_ROUTER_PARENT_SESSION_ID", () => {
    expect(Array.isArray(SUBAGENT_PARENT_SESSION_ENV_CANDIDATES)).toBe(true);
    expect(SUBAGENT_PARENT_SESSION_ENV_CANDIDATES).toContain(
      "PI_AGENT_ROUTER_PARENT_SESSION_ID",
    );
  });

  test("contains PI_SUBAGENT_PARENT_SESSION for CLI-based subagent extensions", () => {
    expect(SUBAGENT_PARENT_SESSION_ENV_CANDIDATES).toContain(
      "PI_SUBAGENT_PARENT_SESSION",
    );
  });

  test("deprecated SUBAGENT_PARENT_SESSION_ENV_KEY equals the first candidate", () => {
    expect(SUBAGENT_PARENT_SESSION_ENV_KEY).toBe(
      SUBAGENT_PARENT_SESSION_ENV_CANDIDATES[0],
    );
  });
});

describe("resolvePermissionForwardingTargetSessionId", () => {
  test("hasUI=true returns the current session ID (UI host owns forwarding)", () => {
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: true,
        isSubagent: false,
        currentSessionId: "parent-session-abc",
        env: {},
      }),
    ).toBe("parent-session-abc");
  });

  test("hasUI=true with isSubagent=true still returns current session ID", () => {
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: true,
        isSubagent: true,
        currentSessionId: "session-xyz",
        env: { PI_AGENT_ROUTER_PARENT_SESSION_ID: "other" },
      }),
    ).toBe("session-xyz");
  });

  test("hasUI=false, isSubagent=false returns null", () => {
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: false,
        isSubagent: false,
        currentSessionId: "session-xyz",
        env: { PI_AGENT_ROUTER_PARENT_SESSION_ID: "parent-session-abc" },
      }),
    ).toBeNull();
  });

  test("isSubagent=true, no candidates set returns null", () => {
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: false,
        isSubagent: true,
        currentSessionId: "session-xyz",
        env: {},
      }),
    ).toBeNull();
  });

  test("isSubagent=true, PI_AGENT_ROUTER_PARENT_SESSION_ID set returns its value", () => {
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: false,
        isSubagent: true,
        currentSessionId: "session-xyz",
        env: { PI_AGENT_ROUTER_PARENT_SESSION_ID: "parent-session-abc" },
      }),
    ).toBe("parent-session-abc");
  });

  test("isSubagent=true, PI_SUBAGENT_PARENT_SESSION resolves when PI_AGENT_ROUTER_PARENT_SESSION_ID is absent", () => {
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: false,
        isSubagent: true,
        currentSessionId: "session-xyz",
        env: {
          PI_SUBAGENT_PARENT_SESSION: "parent-from-convention",
        },
      }),
    ).toBe("parent-from-convention");
  });

  test("isSubagent=true, PI_AGENT_ROUTER_PARENT_SESSION_ID takes precedence over PI_SUBAGENT_PARENT_SESSION", () => {
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: false,
        isSubagent: true,
        currentSessionId: "session-xyz",
        env: {
          PI_AGENT_ROUTER_PARENT_SESSION_ID: "parent-from-router",
          PI_SUBAGENT_PARENT_SESSION: "parent-from-convention",
        },
      }),
    ).toBe("parent-from-router");
  });

  test("isSubagent=true, candidate value is empty string returns null", () => {
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: false,
        isSubagent: true,
        currentSessionId: "session-xyz",
        env: { PI_AGENT_ROUTER_PARENT_SESSION_ID: "" },
      }),
    ).toBeNull();
  });

  test("isSubagent=true, candidate value is 'unknown' returns null", () => {
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: false,
        isSubagent: true,
        currentSessionId: "session-xyz",
        env: { PI_AGENT_ROUTER_PARENT_SESSION_ID: "unknown" },
      }),
    ).toBeNull();
  });

  test("env defaults to process.env when omitted", () => {
    vi.stubEnv("PI_AGENT_ROUTER_PARENT_SESSION_ID", "env-session-abc");
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: false,
        isSubagent: true,
      }),
    ).toBe("env-session-abc");
  });
});

describe("resolvePermissionForwardingTargetSessionId — sessionDir fallback", () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(
      join(tmpdir(), "pi-permission-system-forwarding-sessiondir-"),
    );
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  test("resolves parent ID from session directory when no env candidate is set", () => {
    const childDir = layoutParentChild(workDir, "parent-from-disk");
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: false,
        isSubagent: true,
        currentSessionId: "child-session-id",
        env: {},
        sessionDir: childDir,
      }),
    ).toBe("parent-from-disk");
  });

  test("env candidate takes precedence over sessionDir", () => {
    const childDir = layoutParentChild(workDir, "parent-from-disk");
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: false,
        isSubagent: true,
        currentSessionId: "child-session-id",
        env: { PI_AGENT_ROUTER_PARENT_SESSION_ID: "parent-from-env" },
        sessionDir: childDir,
      }),
    ).toBe("parent-from-env");
  });

  test("sessionDir is ignored when isSubagent=false", () => {
    const childDir = layoutParentChild(workDir, "parent-from-disk");
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: false,
        isSubagent: false,
        currentSessionId: "current-session",
        env: {},
        sessionDir: childDir,
      }),
    ).toBeNull();
  });

  test("sessionDir is ignored when hasUI=true (UI host owns forwarding)", () => {
    const childDir = layoutParentChild(workDir, "parent-from-disk");
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: true,
        isSubagent: true,
        currentSessionId: "ui-session",
        env: {},
        sessionDir: childDir,
      }),
    ).toBe("ui-session");
  });

  test("sessionDir undefined falls back to env-only behaviour", () => {
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: false,
        isSubagent: true,
        currentSessionId: "child-session-id",
        env: {},
      }),
    ).toBeNull();
  });

  test("sessionDir null is treated the same as undefined", () => {
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: false,
        isSubagent: true,
        currentSessionId: "child-session-id",
        env: {},
        sessionDir: null,
      }),
    ).toBeNull();
  });

  test("sessionDir without a matching ancestor returns null", () => {
    const orphanDir = join(workDir, "no-parent", "runId", "run-0");
    mkdirSync(orphanDir, { recursive: true });
    expect(
      resolvePermissionForwardingTargetSessionId({
        hasUI: false,
        isSubagent: true,
        currentSessionId: "child-session-id",
        env: {},
        sessionDir: orphanDir,
      }),
    ).toBeNull();
  });
});
