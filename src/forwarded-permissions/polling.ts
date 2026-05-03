import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

import {
  getActiveAgentName,
  getActiveAgentNameFromSystemPrompt,
} from "../active-agent.js";
import { toRecord } from "../common.js";
import type { PermissionPromptDecision } from "../permission-dialog.js";
import {
  type ForwardedPermissionRequest,
  type ForwardedPermissionResponse,
  isForwardedPermissionRequestForSession,
  PERMISSION_FORWARDING_POLL_INTERVAL_MS,
  PERMISSION_FORWARDING_TIMEOUT_MS,
  resolvePermissionForwardingTargetSessionId,
} from "../permission-forwarding.js";
import { isSubagentExecutionContext } from "../subagent-context.js";

import {
  cleanupPermissionForwardingLocationIfEmpty,
  ensurePermissionForwardingLocation,
  getExistingPermissionForwardingLocation,
  listRequestFiles,
  logPermissionForwardingError,
  logPermissionForwardingWarning,
  readForwardedPermissionRequest,
  readForwardedPermissionResponse,
  safeDeleteFile,
  sleep,
  writeJsonFileAtomic,
} from "./io.js";

export interface PermissionForwardingDeps {
  forwardingDir: string;
  subagentSessionsDir: string;
  writeReviewLog: (event: string, details: Record<string, unknown>) => void;
  requestPermissionDecisionFromUi: (
    ui: ExtensionContext["ui"],
    title: string,
    message: string,
  ) => Promise<PermissionPromptDecision>;
  shouldAutoApprove: () => boolean;
}

export function getSessionId(ctx: ExtensionContext): string {
  try {
    const sessionId = ctx.sessionManager.getSessionId();
    if (typeof sessionId === "string" && sessionId.trim()) {
      return sessionId.trim();
    }
  } catch {}

  return "unknown";
}

function getContextSystemPrompt(ctx: ExtensionContext): string | undefined {
  const getSystemPrompt = toRecord(ctx).getSystemPrompt;
  if (typeof getSystemPrompt !== "function") {
    return undefined;
  }

  try {
    const systemPrompt = getSystemPrompt.call(ctx);
    return typeof systemPrompt === "string" ? systemPrompt : undefined;
  } catch (error) {
    logPermissionForwardingWarning(
      "Failed to read context system prompt for forwarded permission metadata",
      error,
    );
    return undefined;
  }
}

export function formatForwardedPermissionPrompt(
  request: ForwardedPermissionRequest,
): string {
  const agentName = request.requesterAgentName || "unknown";
  const sessionId = request.requesterSessionId || "unknown";
  return [
    `Subagent '${agentName}' requested permission.`,
    `Session ID: ${sessionId}`,
    "",
    request.message,
  ].join("\n");
}

export async function waitForForwardedPermissionApproval(
  ctx: ExtensionContext,
  message: string,
  deps: PermissionForwardingDeps,
): Promise<PermissionPromptDecision> {
  const requesterSessionId = getSessionId(ctx);
  const targetSessionId = resolvePermissionForwardingTargetSessionId({
    hasUI: ctx.hasUI,
    isSubagent: isSubagentExecutionContext(ctx, deps.subagentSessionsDir),
    currentSessionId: requesterSessionId,
    env: process.env,
  });

  if (!targetSessionId) {
    logPermissionForwardingError(
      "Permission forwarding target session could not be resolved from subagent runtime metadata (expected PI_AGENT_ROUTER_PARENT_SESSION_ID)",
    );
    return { approved: false, state: "denied" };
  }

  const location = ensurePermissionForwardingLocation(
    deps.forwardingDir,
    targetSessionId,
  );
  if (!location) {
    logPermissionForwardingError(
      `Permission forwarding is unavailable because session-scoped directories could not be prepared for '${targetSessionId}'`,
    );
    return { approved: false, state: "denied" };
  }

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${process.pid}`;
  const requesterAgentName =
    getActiveAgentName(ctx) ||
    getActiveAgentNameFromSystemPrompt(getContextSystemPrompt(ctx)) ||
    "unknown";
  const request: ForwardedPermissionRequest = {
    id: requestId,
    createdAt: Date.now(),
    requesterSessionId,
    targetSessionId,
    requesterAgentName,
    message,
  };

  const requestPath = join(location.requestsDir, `${requestId}.json`);
  const responsePath = join(location.responsesDir, `${requestId}.json`);

  deps.writeReviewLog("forwarded_permission.request_created", {
    requestId,
    requesterAgentName,
    requesterSessionId: request.requesterSessionId,
    targetSessionId,
    requestPath,
    responsePath,
  });

  try {
    writeJsonFileAtomic(requestPath, request);
  } catch (error) {
    logPermissionForwardingError(
      `Failed to write forwarded permission request '${requestPath}'`,
      error,
    );
    return { approved: false, state: "denied" };
  }

  const deadline = Date.now() + PERMISSION_FORWARDING_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (existsSync(responsePath)) {
      const response = readForwardedPermissionResponse(responsePath);
      deps.writeReviewLog("forwarded_permission.response_received", {
        requestId,
        approved: response?.approved ?? null,
        state: response?.state ?? null,
        denialReason: response?.denialReason ?? null,
        responderSessionId: response?.responderSessionId ?? null,
        targetSessionId,
        responsePath,
      });
      safeDeleteFile(responsePath, "forwarded permission response");
      safeDeleteFile(requestPath, "forwarded permission request");
      cleanupPermissionForwardingLocationIfEmpty(location);
      return response ?? { approved: false, state: "denied" };
    }

    await sleep(PERMISSION_FORWARDING_POLL_INTERVAL_MS);
  }

  logPermissionForwardingWarning(
    `Timed out waiting for forwarded permission response '${responsePath}'`,
  );
  deps.writeReviewLog("forwarded_permission.response_timed_out", {
    requestId,
    requesterAgentName,
    targetSessionId,
    responsePath,
  });
  safeDeleteFile(requestPath, "forwarded permission request");
  cleanupPermissionForwardingLocationIfEmpty(location);
  return { approved: false, state: "denied" };
}

export async function processForwardedPermissionRequests(
  ctx: ExtensionContext,
  deps: PermissionForwardingDeps,
): Promise<void> {
  if (!ctx.hasUI) {
    return;
  }

  const currentSessionId = getSessionId(ctx);
  const location = getExistingPermissionForwardingLocation(
    deps.forwardingDir,
    currentSessionId,
  );
  if (!location) {
    return;
  }

  const requestFiles = listRequestFiles(location.requestsDir);
  if (requestFiles.length === 0) {
    return;
  }

  for (const fileName of requestFiles) {
    const requestPath = join(location.requestsDir, fileName);
    const request = readForwardedPermissionRequest(requestPath);
    if (!request) {
      safeDeleteFile(
        requestPath,
        `${location.label} forwarded permission request`,
      );
      continue;
    }

    if (!isForwardedPermissionRequestForSession(request, currentSessionId)) {
      logPermissionForwardingWarning(
        `Ignoring forwarded permission request '${request.id}' because it targets session '${request.targetSessionId}' instead of '${currentSessionId}'`,
      );
      safeDeleteFile(
        requestPath,
        `${location.label} forwarded permission request`,
      );
      continue;
    }

    const forwardedPermissionLogDetails = {
      requestId: request.id,
      source: location.label,
      requesterAgentName: request.requesterAgentName,
      requesterSessionId: request.requesterSessionId,
      targetSessionId: request.targetSessionId,
      requestPath,
    };

    let decision: PermissionPromptDecision = {
      approved: false,
      state: "denied",
    };
    if (deps.shouldAutoApprove()) {
      deps.writeReviewLog(
        "forwarded_permission.auto_approved",
        forwardedPermissionLogDetails,
      );
      decision = { approved: true, state: "approved" };
    } else {
      deps.writeReviewLog(
        "forwarded_permission.prompted",
        forwardedPermissionLogDetails,
      );
      try {
        decision = await deps.requestPermissionDecisionFromUi(
          ctx.ui,
          "Permission Required (Subagent)",
          formatForwardedPermissionPrompt(request),
        );
      } catch (error) {
        logPermissionForwardingError(
          "Failed to show forwarded permission confirmation dialog",
          error,
        );
        decision = { approved: false, state: "denied" };
      }
    }

    const responsePath = join(location.responsesDir, `${request.id}.json`);
    deps.writeReviewLog(
      decision.approved
        ? "forwarded_permission.approved"
        : "forwarded_permission.denied",
      {
        requestId: request.id,
        source: location.label,
        requesterAgentName: request.requesterAgentName,
        requesterSessionId: request.requesterSessionId,
        targetSessionId: request.targetSessionId,
        responsePath,
        resolution: decision.state,
        denialReason: decision.denialReason ?? null,
      },
    );
    try {
      writeJsonFileAtomic(responsePath, {
        approved: decision.approved,
        state: decision.state,
        denialReason: decision.denialReason,
        responderSessionId: currentSessionId,
        respondedAt: Date.now(),
      } satisfies ForwardedPermissionResponse);
    } catch (error) {
      logPermissionForwardingError(
        `Failed to write ${location.label} forwarded permission response '${responsePath}'`,
        error,
      );
      continue;
    }

    safeDeleteFile(
      requestPath,
      `${location.label} forwarded permission request`,
    );
  }

  cleanupPermissionForwardingLocationIfEmpty(location);
}

export async function confirmPermission(
  ctx: ExtensionContext,
  message: string,
  deps: PermissionForwardingDeps,
): Promise<PermissionPromptDecision> {
  if (ctx.hasUI) {
    return deps.requestPermissionDecisionFromUi(
      ctx.ui,
      "Permission Required",
      message,
    );
  }

  if (!isSubagentExecutionContext(ctx, deps.subagentSessionsDir)) {
    return { approved: false, state: "denied" };
  }

  return waitForForwardedPermissionApproval(ctx, message, deps);
}
