import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Maximum directory levels to climb when searching for a sibling session log.
 *
 * Subagent nesting is depth-bounded in practice (e.g. `nicobailon/pi-subagents`
 * caps recursion via `PI_SUBAGENT_DEPTH`). Eight levels comfortably covers any
 * realistic `<parent>/<runId>/run-<n>/session/<runId>/run-<n>` chain.
 */
const MAX_WALK_DEPTH = 8;

/**
 * Cap on bytes read when probing a candidate session log file.
 *
 * The session header is the first JSONL line and is ~150 bytes in practice.
 * Reading 16 KiB is enough to capture any realistic header without loading
 * a multi-megabyte session log on every permission probe.
 */
const HEADER_READ_BUFFER_BYTES = 16 * 1024;

/**
 * Pi session log header shape — the first line of every session JSONL file.
 *
 * Mirrors the relevant subset of `SessionHeader` exported by
 * `@earendil-works/pi-coding-agent`. Only `type` and `id` are read here.
 */
interface SessionHeaderShape {
  readonly type: unknown;
  readonly id: unknown;
}

/**
 * Resolve a parent session ID from Pi's session-directory layout.
 *
 * Pi (and `nicobailon/pi-subagents` via its `getSubagentSessionRoot`) nest
 * subagent session directories under their parent session file's basename:
 *
 *   <sessionsDir>/
 *     <parentBaseName>.jsonl              ← parent session log; header.id is the parent ID
 *     <parentBaseName>/
 *       <runId>/run-<n>/                  ← child session directory
 *         session.jsonl                   ← child session log
 *
 * Climbs up from `sessionDir` up to `MAX_WALK_DEPTH` levels. At each level it
 * checks whether `<currentDir>.jsonl` exists as a sibling file. The first such
 * file whose first JSONL line is a valid `{ type: "session", id: <string> }`
 * record wins — its `id` is returned.
 *
 * Returns `null` for any degenerate input or when no matching ancestor is
 * found. Filesystem and parse errors at intermediate levels are silently
 * skipped so the function never throws.
 */
export function resolveParentSessionIdFromSessionDir(
  sessionDir: string | null | undefined,
): string | null {
  if (typeof sessionDir !== "string") {
    return null;
  }
  const trimmed = sessionDir.trim();
  if (!trimmed) {
    return null;
  }

  let current = trimmed;
  for (let depth = 0; depth < MAX_WALK_DEPTH; depth++) {
    const parent = dirname(current);
    if (parent === current) {
      // Reached filesystem root.
      return null;
    }
    const candidateLog = `${current}.jsonl`;
    const parsed = tryReadSessionId(candidateLog);
    if (parsed !== null) {
      return parsed;
    }
    current = parent;
  }
  return null;
}

function tryReadSessionId(candidateLog: string): string | null {
  if (!existsSync(candidateLog)) {
    return null;
  }
  let fd: number;
  try {
    // Reject directories and non-regular files before opening.
    if (!statSync(candidateLog).isFile()) {
      return null;
    }
    fd = openSync(candidateLog, "r");
  } catch {
    return null;
  }

  let firstLine: string;
  try {
    const buffer = Buffer.alloc(HEADER_READ_BUFFER_BYTES);
    const bytesRead = readSync(fd, buffer, 0, HEADER_READ_BUFFER_BYTES, 0);
    if (bytesRead <= 0) {
      return null;
    }
    const chunk = buffer.toString("utf-8", 0, bytesRead);
    const newlineIndex = chunk.indexOf("\n");
    firstLine = newlineIndex === -1 ? chunk : chunk.slice(0, newlineIndex);
    if (!firstLine) {
      return null;
    }
  } catch {
    return null;
  } finally {
    try {
      closeSync(fd);
    } catch {
      // Best-effort close — the read result is already captured.
    }
  }

  return parseSessionHeaderId(firstLine);
}

function parseSessionHeaderId(line: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") {
    return null;
  }
  const header = parsed as SessionHeaderShape;
  if (header.type !== "session") {
    return null;
  }
  if (typeof header.id !== "string") {
    return null;
  }
  const trimmedId = header.id.trim();
  return trimmedId ? trimmedId : null;
}
