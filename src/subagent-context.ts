import { normalize } from "node:path";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

import { SUBAGENT_ENV_HINT_KEYS } from "./permission-forwarding";

export function normalizeFilesystemPath(pathValue: string): string {
  const normalizedPath = normalize(pathValue);
  return process.platform === "win32"
    ? normalizedPath.toLowerCase()
    : normalizedPath;
}

function isPathWithinDirectoryForSubagent(
  pathValue: string,
  directory: string,
): boolean {
  if (!pathValue || !directory) {
    return false;
  }

  if (pathValue === directory) {
    return true;
  }

  const sep = process.platform === "win32" ? "\\" : "/";
  const prefix = directory.endsWith(sep) ? directory : `${directory}${sep}`;
  return pathValue.startsWith(prefix);
}

export function isSubagentExecutionContext(
  ctx: ExtensionContext,
  subagentSessionsDir: string,
): boolean {
  for (const key of SUBAGENT_ENV_HINT_KEYS) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return true;
    }
  }

  const sessionDir = ctx.sessionManager.getSessionDir();
  if (!sessionDir) {
    return false;
  }

  const normalizedSessionDir = normalizeFilesystemPath(sessionDir);
  const normalizedSubagentRoot = normalizeFilesystemPath(subagentSessionsDir);
  return isPathWithinDirectoryForSubagent(
    normalizedSessionDir,
    normalizedSubagentRoot,
  );
}
