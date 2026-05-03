import {
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, normalize } from "node:path";
import {
  type ExtensionAPI,
  type ExtensionCommandContext,
  type ExtensionContext,
  getAgentDir,
  isToolCallEventType,
} from "@mariozechner/pi-coding-agent";
import {
  getActiveAgentName,
  getActiveAgentNameFromSystemPrompt,
} from "./active-agent.js";
import {
  createActiveToolsCacheKey,
  createBeforeAgentStartPromptStateKey,
  shouldApplyCachedAgentStartState,
} from "./before-agent-start-cache.js";
import { toRecord } from "./common.js";
import { loadAndMergeConfigs, loadUnifiedConfig } from "./config-loader.js";
import { registerPermissionSystemCommand } from "./config-modal.js";
import {
  DEBUG_LOG_FILENAME,
  getGlobalConfigPath,
  getGlobalLogsDir,
  getLegacyExtensionConfigPath,
  getLegacyGlobalPolicyPath,
  getLegacyProjectPolicyPath,
  getProjectConfigPath,
  REVIEW_LOG_FILENAME,
} from "./config-paths.js";
import { buildResolvedConfigLogEntry } from "./config-reporter.js";
import {
  DEFAULT_EXTENSION_CONFIG,
  EXTENSION_ROOT,
  ensurePermissionSystemLogsDirectory,
  normalizePermissionSystemConfig,
  type PermissionSystemExtensionConfig,
} from "./extension-config.js";
import {
  formatExternalDirectoryAskPrompt,
  formatExternalDirectoryDenyReason,
  formatExternalDirectoryUserDeniedReason,
  getPathBearingToolPath,
  isPathOutsideWorkingDirectory,
  normalizePathForComparison,
  PATH_BEARING_TOOLS,
} from "./external-directory.js";
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
  setForwardedPermissionLogger,
  sleep,
  writeJsonFileAtomic,
} from "./forwarded-permissions/io.js";
import { createPermissionSystemLogger } from "./logging.js";
import {
  type PermissionPromptDecision,
  requestPermissionDecisionFromUi,
} from "./permission-dialog.js";
import {
  type ForwardedPermissionRequest,
  type ForwardedPermissionResponse,
  isForwardedPermissionRequestForSession,
  PERMISSION_FORWARDING_POLL_INTERVAL_MS,
  PERMISSION_FORWARDING_TIMEOUT_MS,
  resolvePermissionForwardingTargetSessionId,
} from "./permission-forwarding.js";
import { PermissionManager } from "./permission-manager.js";
import {
  formatAskPrompt,
  formatDenyReason,
  formatMissingToolNameReason,
  formatSkillAskPrompt,
  formatSkillPathAskPrompt,
  formatSkillPathDenyReason,
  formatUnknownToolReason,
  formatUserDeniedReason,
} from "./permission-prompts.js";
import {
  findSkillPathMatch,
  resolveSkillPromptEntries,
  type SkillPromptEntry,
} from "./skill-prompt-sanitizer.js";
import {
  PERMISSION_SYSTEM_STATUS_KEY,
  syncPermissionSystemStatus,
} from "./status.js";
import { isSubagentExecutionContext } from "./subagent-context.js";
import { sanitizeAvailableToolsSection } from "./system-prompt-sanitizer.js";
import { getPermissionLogContext } from "./tool-input-preview.js";
import {
  checkRequestedToolRegistration,
  getToolNameFromValue,
} from "./tool-registry.js";
import type { PermissionCheckResult } from "./types.js";
import {
  canResolveAskPermissionRequest,
  shouldAutoApprovePermissionState,
} from "./yolo-mode.js";

const PI_AGENT_DIR = getAgentDir();
const SESSIONS_DIR = join(PI_AGENT_DIR, "sessions");
const SUBAGENT_SESSIONS_DIR = join(PI_AGENT_DIR, "subagent-sessions");
const PERMISSION_FORWARDING_DIR = join(SESSIONS_DIR, "permission-forwarding");

type PermissionReviewSource = "tool_call" | "skill_input" | "skill_read";

let extensionConfig: PermissionSystemExtensionConfig = {
  ...DEFAULT_EXTENSION_CONFIG,
};
const GLOBAL_LOGS_DIR = getGlobalLogsDir(PI_AGENT_DIR);
const extensionLogger = createPermissionSystemLogger({
  getConfig: () => extensionConfig,
  debugLogPath: join(GLOBAL_LOGS_DIR, DEBUG_LOG_FILENAME),
  reviewLogPath: join(GLOBAL_LOGS_DIR, REVIEW_LOG_FILENAME),
  ensureLogsDirectory: () =>
    ensurePermissionSystemLogsDirectory(GLOBAL_LOGS_DIR),
});
const reportedLoggingWarnings = new Set<string>();
let loggingWarningReporter: ((message: string) => void) | null = null;

function setExtensionConfig(config: PermissionSystemExtensionConfig): void {
  extensionConfig = normalizePermissionSystemConfig(config);
}

function setLoggingWarningReporter(
  reporter: ((message: string) => void) | null,
): void {
  loggingWarningReporter = reporter;
}

function reportLoggingWarning(message: string): void {
  if (!loggingWarningReporter || reportedLoggingWarnings.has(message)) {
    return;
  }

  reportedLoggingWarnings.add(message);
  loggingWarningReporter(message);
}

function writeDebugLog(
  event: string,
  details: Record<string, unknown> = {},
): void {
  const warning = extensionLogger.debug(event, details);
  if (warning) {
    reportLoggingWarning(warning);
  }
}

function writeReviewLog(
  event: string,
  details: Record<string, unknown> = {},
): void {
  const warning = extensionLogger.review(event, details);
  if (warning) {
    reportLoggingWarning(warning);
  }
}

function extractSkillNameFromInput(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/skill:")) {
    return null;
  }

  const afterPrefix = trimmed.slice("/skill:".length);
  if (!afterPrefix) {
    return null;
  }

  const firstWhitespace = afterPrefix.search(/\s/);
  const skillName = (
    firstWhitespace === -1 ? afterPrefix : afterPrefix.slice(0, firstWhitespace)
  ).trim();
  return skillName || null;
}

function getEventToolName(event: unknown): string | null {
  return getToolNameFromValue(event);
}

function getEventInput(event: unknown): unknown {
  const record = toRecord(event);

  if (record.input !== undefined) {
    return record.input;
  }

  if (record.arguments !== undefined) {
    return record.arguments;
  }

  return {};
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

function getSessionId(ctx: ExtensionContext): string {
  try {
    const sessionId = ctx.sessionManager.getSessionId();
    if (typeof sessionId === "string" && sessionId.trim()) {
      return sessionId.trim();
    }
  } catch {}

  return "unknown";
}

function canRequestPermissionConfirmation(ctx: ExtensionContext): boolean {
  return canResolveAskPermissionRequest({
    config: extensionConfig,
    hasUI: ctx.hasUI,
    isSubagent: isSubagentExecutionContext(ctx, SUBAGENT_SESSIONS_DIR),
  });
}

function formatForwardedPermissionPrompt(
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

async function waitForForwardedPermissionApproval(
  ctx: ExtensionContext,
  message: string,
): Promise<PermissionPromptDecision> {
  const requesterSessionId = getSessionId(ctx);
  const targetSessionId = resolvePermissionForwardingTargetSessionId({
    hasUI: ctx.hasUI,
    isSubagent: isSubagentExecutionContext(ctx, SUBAGENT_SESSIONS_DIR),
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
    PERMISSION_FORWARDING_DIR,
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

  writeReviewLog("forwarded_permission.request_created", {
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
      writeReviewLog("forwarded_permission.response_received", {
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
  writeReviewLog("forwarded_permission.response_timed_out", {
    requestId,
    requesterAgentName,
    targetSessionId,
    responsePath,
  });
  safeDeleteFile(requestPath, "forwarded permission request");
  cleanupPermissionForwardingLocationIfEmpty(location);
  return { approved: false, state: "denied" };
}

async function processForwardedPermissionRequests(
  ctx: ExtensionContext,
): Promise<void> {
  if (!ctx.hasUI) {
    return;
  }

  const currentSessionId = getSessionId(ctx);
  const location = getExistingPermissionForwardingLocation(
    PERMISSION_FORWARDING_DIR,
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
    if (shouldAutoApprovePermissionState("ask", extensionConfig)) {
      writeReviewLog(
        "forwarded_permission.auto_approved",
        forwardedPermissionLogDetails,
      );
      decision = { approved: true, state: "approved" };
    } else {
      writeReviewLog(
        "forwarded_permission.prompted",
        forwardedPermissionLogDetails,
      );
      try {
        decision = await requestPermissionDecisionFromUi(
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
    writeReviewLog(
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

async function confirmPermission(
  ctx: ExtensionContext,
  message: string,
): Promise<PermissionPromptDecision> {
  if (ctx.hasUI) {
    return requestPermissionDecisionFromUi(
      ctx.ui,
      "Permission Required",
      message,
    );
  }

  if (!isSubagentExecutionContext(ctx, SUBAGENT_SESSIONS_DIR)) {
    return { approved: false, state: "denied" };
  }

  return waitForForwardedPermissionApproval(ctx, message);
}

function derivePiProjectPaths(cwd: string | undefined | null): {
  projectGlobalConfigPath: string;
  projectAgentsDir: string;
} | null {
  if (!cwd) {
    return null;
  }

  return {
    projectGlobalConfigPath: getProjectConfigPath(cwd),
    projectAgentsDir: join(cwd, ".pi", "agent", "agents"),
  };
}

function createPermissionManagerForCwd(
  cwd: string | undefined | null,
): PermissionManager {
  const agentDir = getAgentDir();
  const projectPaths = derivePiProjectPaths(cwd);

  return new PermissionManager({
    globalConfigPath: getGlobalConfigPath(agentDir),
    projectGlobalConfigPath: projectPaths?.projectGlobalConfigPath,
    projectAgentsDir: projectPaths?.projectAgentsDir,
  });
}

export default function piPermissionSystemExtension(pi: ExtensionAPI): void {
  let permissionManager = new PermissionManager();
  let activeSkillEntries: SkillPromptEntry[] = [];
  let lastKnownActiveAgentName: string | null = null;
  let lastActiveToolsCacheKey: string | null = null;
  let lastPromptStateCacheKey: string | null = null;
  let permissionForwardingContext: ExtensionContext | null = null;
  let permissionForwardingTimer: NodeJS.Timeout | null = null;
  let isProcessingForwardedRequests = false;
  let runtimeContext: ExtensionContext | null = null;
  let lastConfigWarning: string | null = null;

  const invalidateAgentStartCache = (): void => {
    activeSkillEntries = [];
    lastActiveToolsCacheKey = null;
    lastPromptStateCacheKey = null;
  };

  const notifyWarning = (message: string): void => {
    if (!runtimeContext?.hasUI) {
      return;
    }

    runtimeContext.ui.notify(message, "warning");
  };

  const refreshExtensionConfig = (ctx?: ExtensionContext): void => {
    if (ctx) {
      runtimeContext = ctx;
    }

    const cwd = runtimeContext?.cwd ?? null;
    const agentDir = getAgentDir();
    const mergeResult = loadAndMergeConfigs(
      agentDir,
      cwd ?? "",
      EXTENSION_ROOT,
    );
    const runtimeConfig = normalizePermissionSystemConfig(mergeResult.merged);
    setExtensionConfig(runtimeConfig);

    if (runtimeContext?.hasUI) {
      syncPermissionSystemStatus(runtimeContext, runtimeConfig);
    }

    const warning =
      mergeResult.issues.length > 0 ? mergeResult.issues.join("\n") : undefined;
    if (warning && warning !== lastConfigWarning) {
      lastConfigWarning = warning;
      notifyWarning(warning);
    } else if (!warning) {
      lastConfigWarning = null;
    }

    writeDebugLog("config.loaded", {
      warning: warning ?? null,
      debugLog: runtimeConfig.debugLog,
      permissionReviewLog: runtimeConfig.permissionReviewLog,
      yoloMode: runtimeConfig.yoloMode,
    });
  };

  const saveExtensionConfig = (
    next: PermissionSystemExtensionConfig,
    ctx: ExtensionCommandContext,
  ): void => {
    const normalized = normalizePermissionSystemConfig(next);
    const globalPath = getGlobalConfigPath(getAgentDir());

    // Load existing global config and merge runtime knobs into it
    const existing = loadUnifiedConfig(globalPath);
    const merged = {
      ...existing.config,
      debugLog: normalized.debugLog,
      permissionReviewLog: normalized.permissionReviewLog,
      yoloMode: normalized.yoloMode,
    };

    const tmpPath = `${globalPath}.tmp`;
    try {
      mkdirSync(dirname(globalPath), { recursive: true });
      writeFileSync(tmpPath, `${JSON.stringify(merged, null, 2)}\n`, "utf-8");
      renameSync(tmpPath, globalPath);
    } catch (error) {
      try {
        if (existsSync(tmpPath)) {
          unlinkSync(tmpPath);
        }
      } catch {
        // Ignore cleanup failures.
      }
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(
        `Failed to save permission-system config at '${globalPath}': ${message}`,
        "error",
      );
      return;
    }

    setExtensionConfig(normalized);
    syncPermissionSystemStatus(ctx, normalized);
    lastConfigWarning = null;

    writeDebugLog("config.saved", {
      debugLog: normalized.debugLog,
      permissionReviewLog: normalized.permissionReviewLog,
      yoloMode: normalized.yoloMode,
    });
  };

  setLoggingWarningReporter(notifyWarning);
  setForwardedPermissionLogger({ writeReviewLog, writeDebugLog });
  refreshExtensionConfig();
  registerPermissionSystemCommand(pi, {
    getConfig: () => extensionConfig,
    setConfig: saveExtensionConfig,
    getConfigPath: () => getGlobalConfigPath(getAgentDir()),
  });

  const createPermissionRequestId = (prefix: string): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${process.pid}`;
  };

  const reviewPermissionDecision = (
    event: string,
    details: {
      requestId: string;
      source: PermissionReviewSource;
      agentName: string | null;
      message: string;
      toolCallId?: string;
      toolName?: string;
      skillName?: string;
      path?: string;
      command?: string;
      target?: string;
      toolInputPreview?: string;
      resolution?: string;
      denialReason?: string;
    },
  ): void => {
    writeReviewLog(event, {
      requestId: details.requestId,
      source: details.source,
      agentName: details.agentName,
      message: details.message,
      toolCallId: details.toolCallId ?? null,
      toolName: details.toolName ?? null,
      skillName: details.skillName ?? null,
      path: details.path ?? null,
      command: details.command ?? null,
      target: details.target ?? null,
      toolInputPreview: details.toolInputPreview ?? null,
      resolution: details.resolution ?? null,
      denialReason: details.denialReason ?? null,
    });
  };

  const promptPermission = async (
    ctx: ExtensionContext,
    details: {
      requestId: string;
      source: PermissionReviewSource;
      agentName: string | null;
      message: string;
      toolCallId?: string;
      toolName?: string;
      skillName?: string;
      path?: string;
      command?: string;
      target?: string;
      toolInputPreview?: string;
    },
  ): Promise<PermissionPromptDecision> => {
    if (shouldAutoApprovePermissionState("ask", extensionConfig)) {
      reviewPermissionDecision("permission_request.auto_approved", details);
      return { approved: true, state: "approved" };
    }

    reviewPermissionDecision("permission_request.waiting", details);

    const decision = await confirmPermission(ctx, details.message);
    reviewPermissionDecision(
      decision.approved
        ? "permission_request.approved"
        : "permission_request.denied",
      {
        ...details,
        resolution: decision.state,
        denialReason: decision.denialReason,
      },
    );
    return decision;
  };

  const stopForwardedPermissionPolling = (): void => {
    if (permissionForwardingTimer) {
      clearInterval(permissionForwardingTimer);
      permissionForwardingTimer = null;
    }

    permissionForwardingContext = null;
    isProcessingForwardedRequests = false;
  };

  const startForwardedPermissionPolling = (ctx: ExtensionContext): void => {
    if (!ctx.hasUI || isSubagentExecutionContext(ctx, SUBAGENT_SESSIONS_DIR)) {
      stopForwardedPermissionPolling();
      return;
    }

    permissionForwardingContext = ctx;
    if (permissionForwardingTimer) {
      return;
    }

    permissionForwardingTimer = setInterval(() => {
      if (!permissionForwardingContext || isProcessingForwardedRequests) {
        return;
      }

      isProcessingForwardedRequests = true;
      void processForwardedPermissionRequests(
        permissionForwardingContext,
      ).finally(() => {
        isProcessingForwardedRequests = false;
      });
    }, PERMISSION_FORWARDING_POLL_INTERVAL_MS);
  };

  const resolveAgentName = (
    ctx: ExtensionContext,
    systemPrompt?: string,
  ): string | null => {
    const fromSession = getActiveAgentName(ctx);
    if (fromSession) {
      lastKnownActiveAgentName = fromSession;
      return fromSession;
    }

    const fromSystemPrompt = getActiveAgentNameFromSystemPrompt(systemPrompt);
    if (fromSystemPrompt) {
      lastKnownActiveAgentName = fromSystemPrompt;
      return fromSystemPrompt;
    }

    return lastKnownActiveAgentName;
  };

  const shouldExposeTool = (
    toolName: string,
    agentName: string | null,
  ): boolean => {
    // Use tool-level permission check for tool injection decisions
    // This ensures that agent-specific tool deny rules (e.g., bash: deny) are respected
    // before any command-level permissions are considered
    const toolPermission = permissionManager.getToolPermission(
      toolName,
      agentName ?? undefined,
    );
    return toolPermission !== "deny";
  };

  const logResolvedConfigPaths = (): void => {
    const policyPaths = permissionManager.getResolvedPolicyPaths();
    const cwd = runtimeContext?.cwd ?? null;

    // Detect legacy files for the log entry
    const agentDir = getAgentDir();
    const legacyGlobalPolicyDetected = existsSync(
      getLegacyGlobalPolicyPath(agentDir),
    );
    const legacyProjectPolicyDetected = cwd
      ? existsSync(getLegacyProjectPolicyPath(cwd))
      : false;
    const legacyExtConfigPath = getLegacyExtensionConfigPath(EXTENSION_ROOT);
    const newGlobalPath = getGlobalConfigPath(agentDir);
    const legacyExtensionConfigDetected =
      normalize(legacyExtConfigPath) !== normalize(newGlobalPath) &&
      existsSync(legacyExtConfigPath);

    const entry = buildResolvedConfigLogEntry({
      policyPaths,
      legacyGlobalPolicyDetected,
      legacyProjectPolicyDetected,
      legacyExtensionConfigDetected,
    });
    writeReviewLog(
      "config.resolved",
      entry as unknown as Record<string, unknown>,
    );
    writeDebugLog(
      "config.resolved",
      entry as unknown as Record<string, unknown>,
    );
  };

  pi.on("session_start", async (event, ctx) => {
    runtimeContext = ctx;
    refreshExtensionConfig(ctx);
    permissionManager = createPermissionManagerForCwd(ctx.cwd);
    invalidateAgentStartCache();
    lastKnownActiveAgentName = getActiveAgentName(ctx);
    startForwardedPermissionPolling(ctx);
    logResolvedConfigPaths();

    const policyIssues = permissionManager.getConfigIssues(
      lastKnownActiveAgentName,
    );
    for (const issue of policyIssues) {
      notifyWarning(issue);
    }

    if (event.reason === "reload") {
      writeDebugLog("lifecycle.reload", {
        triggeredBy: "session_start",
        reason: event.reason,
        cwd: ctx.cwd,
      });
    }
  });

  pi.on("resources_discover", async (event, _ctx) => {
    if (event.reason === "reload") {
      permissionManager = runtimeContext
        ? createPermissionManagerForCwd(runtimeContext.cwd)
        : new PermissionManager();
      invalidateAgentStartCache();
      writeDebugLog("lifecycle.reload", {
        triggeredBy: "resources_discover",
        reason: event.reason,
        cwd: runtimeContext?.cwd ?? null,
      });
    }
  });

  pi.on("session_shutdown", async () => {
    runtimeContext?.ui.setStatus(PERMISSION_SYSTEM_STATUS_KEY, undefined);
    runtimeContext = null;
    invalidateAgentStartCache();
    stopForwardedPermissionPolling();
  });

  pi.on("before_agent_start", async (event, ctx) => {
    runtimeContext = ctx;
    refreshExtensionConfig(ctx);
    startForwardedPermissionPolling(ctx);
    const agentName = resolveAgentName(ctx, event.systemPrompt);
    const allTools = pi.getAllTools();
    const allowedTools: string[] = [];

    for (const tool of allTools) {
      const toolName = getEventToolName(tool);
      if (!toolName) {
        continue;
      }

      if (shouldExposeTool(toolName, agentName)) {
        allowedTools.push(toolName);
      }
    }

    const activeToolsCacheKey = createActiveToolsCacheKey(allowedTools);
    if (
      shouldApplyCachedAgentStartState(
        lastActiveToolsCacheKey,
        activeToolsCacheKey,
      )
    ) {
      pi.setActiveTools(allowedTools);
      lastActiveToolsCacheKey = activeToolsCacheKey;
    }

    const promptStateCacheKey = createBeforeAgentStartPromptStateKey({
      agentName,
      cwd: ctx.cwd,
      permissionStamp: permissionManager.getPolicyCacheStamp(
        agentName ?? undefined,
      ),
      systemPrompt: event.systemPrompt,
      allowedToolNames: allowedTools,
    });

    if (
      !shouldApplyCachedAgentStartState(
        lastPromptStateCacheKey,
        promptStateCacheKey,
      )
    ) {
      return {};
    }

    lastPromptStateCacheKey = promptStateCacheKey;
    const toolPromptResult = sanitizeAvailableToolsSection(
      event.systemPrompt,
      allowedTools,
    );
    const skillPromptResult = resolveSkillPromptEntries(
      toolPromptResult.prompt,
      permissionManager,
      agentName,
      ctx.cwd,
    );
    activeSkillEntries = skillPromptResult.entries;

    if (skillPromptResult.prompt !== event.systemPrompt) {
      return { systemPrompt: skillPromptResult.prompt };
    }

    return {};
  });

  pi.on("input", async (event, ctx) => {
    runtimeContext = ctx;
    startForwardedPermissionPolling(ctx);
    const skillName = extractSkillNameFromInput(event.text);
    if (!skillName) {
      return { action: "continue" };
    }

    const agentName = resolveAgentName(ctx);
    const check = permissionManager.checkPermission(
      "skill",
      { name: skillName },
      agentName ?? undefined,
    );

    if (check.state === "deny") {
      if (ctx.hasUI) {
        const message = agentName
          ? `Skill '${skillName}' is not permitted for agent '${agentName}'.`
          : `Skill '${skillName}' is not permitted by the current skill policy.`;
        ctx.ui.notify(message, "warning");
      }
      writeReviewLog("permission_request.blocked", {
        source: "skill_input",
        skillName,
        agentName,
        resolution: "policy_denied",
      });
      return { action: "handled" };
    }

    if (check.state === "ask") {
      const message = formatSkillAskPrompt(skillName, agentName ?? undefined);
      if (!canRequestPermissionConfirmation(ctx)) {
        writeReviewLog("permission_request.blocked", {
          source: "skill_input",
          skillName,
          agentName,
          message,
          resolution: "confirmation_unavailable",
        });
        return { action: "handled" };
      }

      const decision = await promptPermission(ctx, {
        requestId: createPermissionRequestId("skill-input"),
        source: "skill_input",
        agentName,
        message,
        skillName,
      });
      if (!decision.approved) {
        return { action: "handled" };
      }
    }

    return { action: "continue" };
  });

  pi.on("tool_call", async (event, ctx) => {
    runtimeContext = ctx;
    startForwardedPermissionPolling(ctx);
    const agentName = resolveAgentName(ctx);
    const toolName = getEventToolName(event);

    if (!toolName) {
      return { block: true, reason: formatMissingToolNameReason() };
    }

    const registrationCheck = checkRequestedToolRegistration(
      toolName,
      pi.getAllTools(),
    );
    if (registrationCheck.status === "missing-tool-name") {
      return { block: true, reason: formatMissingToolNameReason() };
    }

    if (registrationCheck.status === "unregistered") {
      return {
        block: true,
        reason: formatUnknownToolReason(
          registrationCheck.requestedToolName,
          registrationCheck.availableToolNames,
        ),
      };
    }

    if (isToolCallEventType("read", event) && activeSkillEntries.length > 0) {
      const normalizedReadPath = normalizePathForComparison(
        event.input.path,
        ctx.cwd,
      );
      const matchedSkill = findSkillPathMatch(
        normalizedReadPath,
        activeSkillEntries,
      );

      if (matchedSkill) {
        if (matchedSkill.state === "deny") {
          writeReviewLog("permission_request.blocked", {
            source: "skill_read",
            skillName: matchedSkill.name,
            agentName,
            path: event.input.path,
            resolution: "policy_denied",
          });
          return {
            block: true,
            reason: formatSkillPathDenyReason(
              matchedSkill,
              event.input.path,
              agentName ?? undefined,
            ),
          };
        }

        if (matchedSkill.state === "ask") {
          const message = formatSkillPathAskPrompt(
            matchedSkill,
            event.input.path,
            agentName ?? undefined,
          );
          if (!canRequestPermissionConfirmation(ctx)) {
            writeReviewLog("permission_request.blocked", {
              source: "skill_read",
              skillName: matchedSkill.name,
              agentName,
              path: event.input.path,
              message,
              resolution: "confirmation_unavailable",
            });
            return {
              block: true,
              reason: `Accessing skill '${matchedSkill.name}' requires approval, but no interactive UI is available.`,
            };
          }

          const decision = await promptPermission(ctx, {
            requestId: event.toolCallId,
            source: "skill_read",
            agentName,
            message,
            toolCallId: event.toolCallId,
            toolName: toolName,
            skillName: matchedSkill.name,
            path: event.input.path,
          });
          if (!decision.approved) {
            const denialReason = decision.denialReason
              ? ` Reason: ${decision.denialReason}.`
              : "";
            return {
              block: true,
              reason: `User denied access to skill '${matchedSkill.name}'.${denialReason}`,
            };
          }
        }
      }
    }

    const input = getEventInput(event);
    const externalDirectoryPath = ctx.cwd
      ? getPathBearingToolPath(toolName, input)
      : null;

    if (
      ctx.cwd &&
      externalDirectoryPath &&
      isPathOutsideWorkingDirectory(externalDirectoryPath, ctx.cwd)
    ) {
      const extCheck = permissionManager.checkPermission(
        "external_directory",
        {},
        agentName ?? undefined,
      );

      if (extCheck.state === "deny") {
        writeReviewLog("permission_request.blocked", {
          source: "tool_call",
          toolCallId: event.toolCallId,
          toolName,
          agentName,
          path: externalDirectoryPath,
          resolution: "policy_denied",
        });
        return {
          block: true,
          reason: formatExternalDirectoryDenyReason(
            toolName,
            externalDirectoryPath,
            ctx.cwd,
            agentName ?? undefined,
          ),
        };
      }

      if (extCheck.state === "ask") {
        const message = formatExternalDirectoryAskPrompt(
          toolName,
          externalDirectoryPath,
          ctx.cwd,
          agentName ?? undefined,
        );
        if (!canRequestPermissionConfirmation(ctx)) {
          writeReviewLog("permission_request.blocked", {
            source: "tool_call",
            toolCallId: event.toolCallId,
            toolName,
            agentName,
            path: externalDirectoryPath,
            message,
            resolution: "confirmation_unavailable",
          });
          return {
            block: true,
            reason: `Accessing '${externalDirectoryPath}' outside the working directory requires approval, but no interactive UI is available.`,
          };
        }

        const extDecision = await promptPermission(ctx, {
          requestId: event.toolCallId,
          source: "tool_call",
          agentName,
          message,
          toolCallId: event.toolCallId,
          toolName,
          path: externalDirectoryPath,
        });

        if (!extDecision.approved) {
          return {
            block: true,
            reason: formatExternalDirectoryUserDeniedReason(
              toolName,
              externalDirectoryPath,
              extDecision.denialReason,
            ),
          };
        }
      }
      // state === "allow" → fall through to normal permission check
    }

    const check = permissionManager.checkPermission(
      toolName,
      input,
      agentName ?? undefined,
    );
    const permissionLogContext = getPermissionLogContext(
      check,
      input,
      PATH_BEARING_TOOLS,
    );

    if (check.state === "deny") {
      writeReviewLog("permission_request.blocked", {
        source: "tool_call",
        toolCallId: event.toolCallId,
        toolName,
        agentName,
        ...permissionLogContext,
        resolution: "policy_denied",
      });
      return {
        block: true,
        reason: formatDenyReason(check, agentName ?? undefined),
      };
    }

    if (check.state === "ask") {
      const unavailableReason =
        toolName === "bash" && isToolCallEventType("bash", event)
          ? `Running bash command '${event.input.command}' requires approval, but no interactive UI is available.`
          : toolName === "mcp"
            ? "Using tool 'mcp' requires approval, but no interactive UI is available."
            : `Using tool '${toolName}' requires approval, but no interactive UI is available.`;

      const message = formatAskPrompt(check, agentName ?? undefined, input);
      if (!canRequestPermissionConfirmation(ctx)) {
        writeReviewLog("permission_request.blocked", {
          source: "tool_call",
          toolCallId: event.toolCallId,
          toolName,
          agentName,
          message,
          ...permissionLogContext,
          resolution: "confirmation_unavailable",
        });
        return {
          block: true,
          reason: unavailableReason,
        };
      }

      const decision = await promptPermission(ctx, {
        requestId: event.toolCallId,
        source: "tool_call",
        agentName,
        message,
        toolCallId: event.toolCallId,
        toolName,
        ...permissionLogContext,
      });
      if (!decision.approved) {
        return {
          block: true,
          reason: formatUserDeniedReason(check, decision.denialReason),
        };
      }
    }

    return {};
  });
}
