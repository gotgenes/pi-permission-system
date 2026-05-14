import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { resolveParentSessionIdFromSessionDir } from "../src/parent-session-discovery";

const SESSION_HEADER_JSON = JSON.stringify({
  type: "session",
  version: 3,
  id: "019e1786-8469-743c-8960-3a86d222fcb3",
  timestamp: "2026-05-11T14:52:32.234Z",
  cwd: "/home/me/proj",
});

const ENTRY_LINE_JSON = JSON.stringify({
  type: "model_change",
  id: "196c6bc5",
  parentId: null,
  timestamp: "2026-05-11T14:52:33.000Z",
  provider: "deepseek",
  modelId: "deepseek-v4-pro",
});

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "pi-permission-system-parent-discovery-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

/**
 * Lay out a Pi session-directory tree mirroring nicobailon/pi-subagents:
 *
 *   <root>/
 *     <parentName>.jsonl              ← parent session log with given header
 *     <parentName>/
 *       <runId>/
 *         run-<attempt>/              ← child session dir (returned)
 *           session.jsonl             ← child session log (created if `withChildHeader`)
 */
function layoutChild(opts: {
  root: string;
  parentName: string;
  parentHeaderJson?: string | null;
  runId?: string;
  attempt?: number;
  withChildHeader?: boolean;
}): string {
  const runId = opts.runId ?? "c6825838";
  const attempt = opts.attempt ?? 0;
  const childDir = join(opts.root, opts.parentName, runId, `run-${attempt}`);
  mkdirSync(childDir, { recursive: true });
  if (opts.parentHeaderJson !== null) {
    writeFileSync(
      join(opts.root, `${opts.parentName}.jsonl`),
      `${opts.parentHeaderJson ?? SESSION_HEADER_JSON}\n${ENTRY_LINE_JSON}\n`,
      "utf-8",
    );
  }
  if (opts.withChildHeader !== false) {
    writeFileSync(
      join(childDir, "session.jsonl"),
      `${JSON.stringify({
        type: "session",
        version: 3,
        id: "019e1ae2-ff6d-748c-8205-9850d77d49cd",
        timestamp: "2026-05-12T06:32:24.685Z",
        cwd: "/home/me/proj",
      })}\n`,
      "utf-8",
    );
  }
  return childDir;
}

describe("resolveParentSessionIdFromSessionDir — degenerate input", () => {
  test("returns null for null", () => {
    expect(resolveParentSessionIdFromSessionDir(null)).toBeNull();
  });

  test("returns null for undefined", () => {
    expect(resolveParentSessionIdFromSessionDir(undefined)).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(resolveParentSessionIdFromSessionDir("")).toBeNull();
  });

  test("returns null for whitespace-only string", () => {
    expect(resolveParentSessionIdFromSessionDir("   ")).toBeNull();
  });
});

describe("resolveParentSessionIdFromSessionDir — happy path", () => {
  test("resolves parent ID from sibling .jsonl one level up from run-N", () => {
    const childDir = layoutChild({
      root: workDir,
      parentName: "2026-05-11T14-52-32-234Z_019e1786-8469-743c-8960-3a86d222fcb3",
    });
    expect(resolveParentSessionIdFromSessionDir(childDir)).toBe(
      "019e1786-8469-743c-8960-3a86d222fcb3",
    );
  });

  test("returns the session id from the JSONL header, not the directory basename", () => {
    // Directory name has a deliberately different ID from the header.id.
    // Discovery must honor the header — directory naming is not part of the SDK contract.
    const childDir = layoutChild({
      root: workDir,
      parentName: "2026-05-11T14-52-32-234Z_NOT-THE-REAL-SESSION-ID",
      parentHeaderJson: JSON.stringify({
        type: "session",
        version: 3,
        id: "real-parent-session-id-from-header",
        timestamp: "2026-05-11T14:52:32.234Z",
        cwd: "/home/me/proj",
      }),
    });
    expect(resolveParentSessionIdFromSessionDir(childDir)).toBe(
      "real-parent-session-id-from-header",
    );
  });
});

describe("resolveParentSessionIdFromSessionDir — nested grandchild", () => {
  test("walks past intermediate directories that have no sibling .jsonl", () => {
    // Grandchild layout: <outer>.jsonl exists; <outer>/<runA>/run-0/session/<runB>/run-0 is the grandchild dir.
    // No sibling .jsonl exists for the intermediate <runA>, run-0, session, or <runB> directories.
    const outer = "2026-05-11T14-52-32-234Z_outer-parent-id";
    const innerName = "session"; // basename of the nested "session.jsonl"
    const grandchild = join(
      workDir,
      outer,
      "runA",
      "run-0",
      innerName,
      "runB",
      "run-0",
    );
    mkdirSync(grandchild, { recursive: true });
    writeFileSync(
      join(workDir, `${outer}.jsonl`),
      `${JSON.stringify({
        type: "session",
        version: 3,
        id: "outer-parent-id",
        timestamp: "2026-05-11T14:52:32.234Z",
        cwd: "/home/me/proj",
      })}\n`,
      "utf-8",
    );
    // Intermediate "session.jsonl" simulates the immediate parent (a subagent that itself spawned).
    writeFileSync(
      join(workDir, outer, "runA", "run-0", "session.jsonl"),
      `${JSON.stringify({
        type: "session",
        version: 3,
        id: "immediate-parent-id",
        timestamp: "2026-05-12T06:00:00.000Z",
        cwd: "/home/me/proj",
      })}\n`,
      "utf-8",
    );
    // Closest sibling .jsonl wins — immediate parent, not the outermost.
    expect(resolveParentSessionIdFromSessionDir(grandchild)).toBe(
      "immediate-parent-id",
    );
  });
});

describe("resolveParentSessionIdFromSessionDir — no match", () => {
  test("returns null when no sibling .jsonl exists at any ancestor", () => {
    const childDir = join(workDir, "no-parent", "runX", "run-0");
    mkdirSync(childDir, { recursive: true });
    expect(resolveParentSessionIdFromSessionDir(childDir)).toBeNull();
  });

  test("returns null when sessionDir does not exist", () => {
    expect(
      resolveParentSessionIdFromSessionDir(join(workDir, "does-not-exist")),
    ).toBeNull();
  });
});

describe("resolveParentSessionIdFromSessionDir — malformed sibling", () => {
  test("returns null when sibling .jsonl is empty", () => {
    const parentName = "empty-parent";
    const childDir = join(workDir, parentName, "run-x", "run-0");
    mkdirSync(childDir, { recursive: true });
    writeFileSync(join(workDir, `${parentName}.jsonl`), "", "utf-8");
    expect(resolveParentSessionIdFromSessionDir(childDir)).toBeNull();
  });

  test("returns null when first line is not valid JSON", () => {
    const childDir = layoutChild({
      root: workDir,
      parentName: "bad-json",
      parentHeaderJson: "{this is not json",
    });
    expect(resolveParentSessionIdFromSessionDir(childDir)).toBeNull();
  });

  test("returns null when header is missing the type field", () => {
    const childDir = layoutChild({
      root: workDir,
      parentName: "no-type",
      parentHeaderJson: JSON.stringify({ id: "some-id", version: 3 }),
    });
    expect(resolveParentSessionIdFromSessionDir(childDir)).toBeNull();
  });

  test("returns null when header type is not 'session'", () => {
    const childDir = layoutChild({
      root: workDir,
      parentName: "wrong-type",
      parentHeaderJson: JSON.stringify({
        type: "message",
        id: "some-id",
      }),
    });
    expect(resolveParentSessionIdFromSessionDir(childDir)).toBeNull();
  });

  test("returns null when header id is missing", () => {
    const childDir = layoutChild({
      root: workDir,
      parentName: "no-id",
      parentHeaderJson: JSON.stringify({ type: "session", version: 3 }),
    });
    expect(resolveParentSessionIdFromSessionDir(childDir)).toBeNull();
  });

  test("returns null when header id is empty string", () => {
    const childDir = layoutChild({
      root: workDir,
      parentName: "empty-id",
      parentHeaderJson: JSON.stringify({
        type: "session",
        version: 3,
        id: "",
      }),
    });
    expect(resolveParentSessionIdFromSessionDir(childDir)).toBeNull();
  });

  test("skips a non-session .jsonl ancestor and continues climbing", () => {
    // Outer ancestor IS a valid session log; immediate ancestor's sibling .jsonl
    // exists but its header is not a session header. Climbing must continue.
    const outer = "outer-parent";
    const intermediate = "intermediate";
    const grandchild = join(workDir, outer, intermediate, "runId", "run-0");
    mkdirSync(grandchild, { recursive: true });
    writeFileSync(
      join(workDir, `${outer}.jsonl`),
      `${JSON.stringify({
        type: "session",
        version: 3,
        id: "outer-id",
        timestamp: "2026-05-11T14:52:32.234Z",
        cwd: "/home/me/proj",
      })}\n`,
      "utf-8",
    );
    writeFileSync(
      join(workDir, outer, `${intermediate}.jsonl`),
      `${JSON.stringify({ type: "message", id: "msg-id" })}\n`,
      "utf-8",
    );
    expect(resolveParentSessionIdFromSessionDir(grandchild)).toBe("outer-id");
  });
});

describe("resolveParentSessionIdFromSessionDir — bounded walk", () => {
  test("returns null when the walk exceeds the depth limit before finding a sibling", () => {
    // Build a chain of 12 nested empty directories with no sibling .jsonl
    // anywhere — the bounded walk must give up and return null without scanning to fs root.
    let dir = workDir;
    for (let i = 0; i < 12; i++) {
      dir = join(dir, `level-${i}`);
    }
    mkdirSync(dir, { recursive: true });
    expect(resolveParentSessionIdFromSessionDir(dir)).toBeNull();
  });
});
