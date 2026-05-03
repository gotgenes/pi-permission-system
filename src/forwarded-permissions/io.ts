import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

import { isPermissionDecisionState } from "../permission-dialog.js";
import {
  createPermissionForwardingLocation,
  type ForwardedPermissionRequest,
  type ForwardedPermissionResponse,
  type PermissionForwardingLocation,
} from "../permission-forwarding.js";

type LogFn = (event: string, details: Record<string, unknown>) => void;

export interface ForwardedPermissionLogger {
  writeReviewLog: LogFn;
  writeDebugLog: LogFn;
}

let logger: ForwardedPermissionLogger | null = null;

export function setForwardedPermissionLogger(
  l: ForwardedPermissionLogger,
): void {
  logger = l;
}

export function formatUnknownErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

export function isErrnoCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === code,
  );
}

export function logPermissionForwardingWarning(
  message: string,
  error?: unknown,
): void {
  const details =
    typeof error === "undefined"
      ? { message }
      : { message, error: formatUnknownErrorMessage(error) };

  logger?.writeReviewLog("permission_forwarding.warning", details);
  logger?.writeDebugLog("permission_forwarding.warning", details);
}

export function logPermissionForwardingError(
  message: string,
  error?: unknown,
): void {
  const details =
    typeof error === "undefined"
      ? { message }
      : { message, error: formatUnknownErrorMessage(error) };

  logger?.writeReviewLog("permission_forwarding.error", details);
  logger?.writeDebugLog("permission_forwarding.error", details);
}

export function ensureDirectoryExists(
  path: string,
  description: string,
): boolean {
  try {
    mkdirSync(path, { recursive: true });
    return true;
  } catch (error) {
    logPermissionForwardingError(
      `Failed to create ${description} directory '${path}'`,
      error,
    );
    return false;
  }
}

export function getPermissionForwardingLocationForSession(
  forwardingDir: string,
  sessionId: string,
): PermissionForwardingLocation {
  return createPermissionForwardingLocation(forwardingDir, sessionId);
}

export function ensurePermissionForwardingLocation(
  forwardingDir: string,
  sessionId: string,
): PermissionForwardingLocation | null {
  let location: PermissionForwardingLocation;
  try {
    location = getPermissionForwardingLocationForSession(
      forwardingDir,
      sessionId,
    );
  } catch (error) {
    logPermissionForwardingError(
      "Failed to resolve permission forwarding location",
      error,
    );
    return null;
  }

  const sessionRootReady = ensureDirectoryExists(
    location.sessionRootDir,
    "permission forwarding session root",
  );
  const requestsReady = ensureDirectoryExists(
    location.requestsDir,
    "permission forwarding requests",
  );
  const responsesReady = ensureDirectoryExists(
    location.responsesDir,
    "permission forwarding responses",
  );

  return sessionRootReady && requestsReady && responsesReady ? location : null;
}

export function getExistingPermissionForwardingLocation(
  forwardingDir: string,
  sessionId: string,
): PermissionForwardingLocation | null {
  let location: PermissionForwardingLocation;
  try {
    location = getPermissionForwardingLocationForSession(
      forwardingDir,
      sessionId,
    );
  } catch {
    return null;
  }

  return existsSync(location.requestsDir) ? location : null;
}

export function tryRemoveDirectoryIfEmpty(
  path: string,
  description: string,
): void {
  if (!existsSync(path)) {
    return;
  }

  let entries: string[];
  try {
    entries = readdirSync(path);
  } catch (error) {
    logPermissionForwardingWarning(
      `Failed to inspect ${description} directory '${path}'`,
      error,
    );
    return;
  }

  if (entries.length > 0) {
    return;
  }

  try {
    rmdirSync(path);
  } catch (error) {
    if (isErrnoCode(error, "ENOENT") || isErrnoCode(error, "ENOTEMPTY")) {
      return;
    }

    logPermissionForwardingWarning(
      `Failed to remove empty ${description} directory '${path}'`,
      error,
    );
  }
}

export function cleanupPermissionForwardingLocationIfEmpty(
  location: PermissionForwardingLocation,
): void {
  tryRemoveDirectoryIfEmpty(
    location.requestsDir,
    `${location.label} permission forwarding requests`,
  );
  tryRemoveDirectoryIfEmpty(
    location.responsesDir,
    `${location.label} permission forwarding responses`,
  );
  tryRemoveDirectoryIfEmpty(
    location.sessionRootDir,
    `${location.label} permission forwarding session root`,
  );
}

export function safeDeleteFile(filePath: string, description: string): void {
  try {
    unlinkSync(filePath);
  } catch (error) {
    if (isErrnoCode(error, "ENOENT")) {
      return;
    }

    logPermissionForwardingWarning(
      `Failed to delete ${description} file '${filePath}'`,
      error,
    );
  }
}

export function writeJsonFileAtomic(filePath: string, value: unknown): void {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    writeFileSync(tempPath, JSON.stringify(value), "utf-8");
    renameSync(tempPath, filePath);
  } catch (error) {
    safeDeleteFile(tempPath, "temporary permission-forwarding");
    throw error;
  }
}

export function readForwardedPermissionRequest(
  filePath: string,
): ForwardedPermissionRequest | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ForwardedPermissionRequest>;
    if (
      !parsed ||
      typeof parsed.id !== "string" ||
      typeof parsed.createdAt !== "number" ||
      typeof parsed.requesterSessionId !== "string" ||
      typeof parsed.targetSessionId !== "string" ||
      typeof parsed.requesterAgentName !== "string" ||
      typeof parsed.message !== "string"
    ) {
      logPermissionForwardingWarning(
        `Ignoring invalid forwarded permission request format in '${filePath}'`,
      );
      return null;
    }

    return {
      id: parsed.id,
      createdAt: parsed.createdAt,
      requesterSessionId: parsed.requesterSessionId,
      targetSessionId: parsed.targetSessionId,
      requesterAgentName: parsed.requesterAgentName,
      message: parsed.message,
    };
  } catch (error) {
    logPermissionForwardingWarning(
      `Failed to read forwarded permission request '${filePath}'`,
      error,
    );
    return null;
  }
}

export function readForwardedPermissionResponse(
  filePath: string,
): ForwardedPermissionResponse | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ForwardedPermissionResponse>;
    if (
      !parsed ||
      typeof parsed.approved !== "boolean" ||
      !isPermissionDecisionState(parsed.state) ||
      typeof parsed.responderSessionId !== "string"
    ) {
      logPermissionForwardingWarning(
        `Ignoring invalid forwarded permission response format in '${filePath}'`,
      );
      return null;
    }

    return {
      approved: parsed.approved,
      state: parsed.state,
      denialReason:
        typeof parsed.denialReason === "string"
          ? parsed.denialReason
          : undefined,
      responderSessionId: parsed.responderSessionId,
      respondedAt:
        typeof parsed.respondedAt === "number"
          ? parsed.respondedAt
          : Date.now(),
    };
  } catch (error) {
    logPermissionForwardingWarning(
      `Failed to read forwarded permission response '${filePath}'`,
      error,
    );
    return null;
  }
}

export function listRequestFiles(requestsDir: string): string[] {
  try {
    return readdirSync(requestsDir)
      .filter((name) => name.endsWith(".json"))
      .sort();
  } catch (error) {
    logPermissionForwardingWarning(
      `Failed to read permission forwarding requests from '${requestsDir}'`,
      error,
    );
    return [];
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
