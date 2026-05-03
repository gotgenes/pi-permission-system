import { homedir } from "node:os";
import { join, normalize, resolve, sep } from "node:path";

import { getNonEmptyString, toRecord } from "./common";

export const PATH_BEARING_TOOLS = new Set([
  "read",
  "write",
  "edit",
  "find",
  "grep",
  "ls",
]);

export function normalizePathForComparison(
  pathValue: string,
  cwd: string,
): string {
  const trimmed = pathValue.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) {
    return "";
  }

  let normalizedPath = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;

  if (normalizedPath === "~") {
    normalizedPath = homedir();
  } else if (
    normalizedPath.startsWith("~/") ||
    normalizedPath.startsWith("~\\")
  ) {
    normalizedPath = join(homedir(), normalizedPath.slice(2));
  }

  const absolutePath = resolve(cwd, normalizedPath);
  const normalizedAbsolutePath = normalize(absolutePath);
  return process.platform === "win32"
    ? normalizedAbsolutePath.toLowerCase()
    : normalizedAbsolutePath;
}

export function isPathWithinDirectory(
  pathValue: string,
  directory: string,
): boolean {
  if (!pathValue || !directory) {
    return false;
  }

  if (pathValue === directory) {
    return true;
  }

  const prefix = directory.endsWith(sep) ? directory : `${directory}${sep}`;
  return pathValue.startsWith(prefix);
}

export function getPathBearingToolPath(
  toolName: string,
  input: unknown,
): string | null {
  if (!PATH_BEARING_TOOLS.has(toolName)) {
    return null;
  }

  return getNonEmptyString(toRecord(input).path);
}

export function isPathOutsideWorkingDirectory(
  pathValue: string,
  cwd: string,
): boolean {
  const normalizedCwd = normalizePathForComparison(cwd, cwd);
  const normalizedPath = normalizePathForComparison(pathValue, cwd);
  return Boolean(
    normalizedCwd &&
      normalizedPath &&
      !isPathWithinDirectory(normalizedPath, normalizedCwd),
  );
}

export function formatExternalDirectoryHardStopHint(): string {
  return "Hard stop: this external directory permission denial is policy-enforced. Do not retry this path, do not attempt a filesystem bypass, and report the block to the user.";
}

export function formatExternalDirectoryAskPrompt(
  toolName: string,
  pathValue: string,
  cwd: string,
  agentName?: string,
): string {
  const subject = agentName ? `Agent '${agentName}'` : "Current agent";
  return `${subject} requested tool '${toolName}' for path '${pathValue}' outside working directory '${cwd}'. Allow this external directory access?`;
}

export function formatExternalDirectoryDenyReason(
  toolName: string,
  pathValue: string,
  cwd: string,
  agentName?: string,
): string {
  const subject = agentName ? `Agent '${agentName}'` : "Current agent";
  return `${subject} is not permitted to run tool '${toolName}' for path '${pathValue}' outside working directory '${cwd}'. ${formatExternalDirectoryHardStopHint()}`;
}

export function formatExternalDirectoryUserDeniedReason(
  toolName: string,
  pathValue: string,
  denialReason?: string,
): string {
  const reasonSuffix = denialReason ? ` Reason: ${denialReason}.` : "";
  return `User denied external directory access for tool '${toolName}' path '${pathValue}'.${reasonSuffix} ${formatExternalDirectoryHardStopHint()}`;
}

export function formatBashExternalDirectoryAskPrompt(
  command: string,
  externalPaths: string[],
  cwd: string,
  agentName?: string,
): string {
  const subject = agentName ? `Agent '${agentName}'` : "Current agent";
  const pathList = externalPaths.join(", ");
  return `${subject} requested bash command '${command}' which references path(s) outside working directory '${cwd}': ${pathList}. Allow this external directory access?`;
}

export function formatBashExternalDirectoryDenyReason(
  command: string,
  externalPaths: string[],
  cwd: string,
  agentName?: string,
): string {
  const subject = agentName ? `Agent '${agentName}'` : "Current agent";
  const pathList = externalPaths.join(", ");
  return `${subject} is not permitted to run bash command '${command}' which references path(s) outside working directory '${cwd}': ${pathList}. ${formatExternalDirectoryHardStopHint()}`;
}

/**
 * URL pattern to skip tokens that look like URLs rather than paths.
 */
const URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Determines whether a token looks like a path candidate worth resolving.
 * Returns the raw token string if it's a candidate, or null to skip.
 */
function classifyTokenAsPathCandidate(token: string): string | null {
  // Skip empty tokens
  if (!token) return null;

  // Skip flags
  if (token.startsWith("-")) return null;

  // Skip env assignments (FOO=/bar)
  const eqIndex = token.indexOf("=");
  const slashIndex = token.indexOf("/");
  if (eqIndex !== -1 && (slashIndex === -1 || eqIndex < slashIndex)) {
    return null;
  }

  // Skip URLs
  if (URL_PATTERN.test(token)) return null;

  // Skip @scope/package patterns
  if (token.startsWith("@") && !token.startsWith("@/")) return null;

  // Must look like a path: starts with /, ~/, or contains ..
  if (token.startsWith("/")) return token;
  if (token.startsWith("~/")) return token;
  if (token.includes("..")) return token;

  return null;
}

/**
 * Extracts paths from a bash command string that resolve outside CWD.
 * This is a best-effort heuristic (token splitting, not full shell parsing).
 */
export function extractExternalPathsFromBashCommand(
  command: string,
  cwd: string,
): string[] {
  // Split on shell metacharacters to isolate tokens
  const tokens = command.split(/[|;&><\s]+/).filter(Boolean);
  const seen = new Set<string>();
  const externalPaths: string[] = [];

  for (const token of tokens) {
    const candidate = classifyTokenAsPathCandidate(token);
    if (!candidate) continue;

    const normalized = normalizePathForComparison(candidate, cwd);
    if (!normalized) continue;

    if (
      isPathOutsideWorkingDirectory(candidate, cwd) &&
      !seen.has(normalized)
    ) {
      seen.add(normalized);
      externalPaths.push(normalized);
    }
  }

  return externalPaths;
}
