import type { SkillPromptEntry } from "./skill-prompt-sanitizer.js";
import { formatToolInputForPrompt } from "./tool-input-preview.js";
import type { PermissionCheckResult } from "./types.js";

export function formatMissingToolNameReason(): string {
  return "Tool call was blocked because no tool name was provided. Use a registered tool name from pi.getAllTools().";
}

export function formatUnknownToolReason(
  toolName: string,
  availableToolNames: readonly string[],
): string {
  const preview = availableToolNames.slice(0, 10);
  const suffix = availableToolNames.length > preview.length ? ", ..." : "";
  const availableList =
    preview.length > 0 ? `${preview.join(", ")}${suffix}` : "none";

  const mcpHint =
    toolName === "mcp"
      ? ""
      : ' If this was intended as an MCP server tool, call the registered \'mcp\' tool when available (for example: {"tool":"server:tool"}).';

  return `Tool '${toolName}' is not registered in this runtime and was blocked before permission checks.${mcpHint} Registered tools: ${availableList}.`;
}

export function formatPermissionHardStopHint(
  result: PermissionCheckResult,
): string {
  if ((result.source === "mcp" || result.toolName === "mcp") && result.target) {
    return "Hard stop: this MCP permission denial is policy-enforced. Do not retry this target, do not run discovery/investigation to bypass it, and report the block to the user.";
  }

  return "Hard stop: this permission denial is policy-enforced. Do not retry or investigate bypasses; report the block to the user.";
}

export function formatDenyReason(
  result: PermissionCheckResult,
  agentName?: string,
): string {
  const parts: string[] = [];

  if (agentName) {
    parts.push(`Agent '${agentName}'`);
  }

  if ((result.source === "mcp" || result.toolName === "mcp") && result.target) {
    parts.push(`is not permitted to run MCP target '${result.target}'`);
  } else {
    parts.push(`is not permitted to run '${result.toolName}'`);
  }

  if (result.command) {
    parts.push(`command '${result.command}'`);
  }

  if (result.matchedPattern) {
    parts.push(`(matched '${result.matchedPattern}')`);
  }

  return `${parts.join(" ")}. ${formatPermissionHardStopHint(result)}`;
}

export function formatUserDeniedReason(
  result: PermissionCheckResult,
  denialReason?: string,
): string {
  const base =
    (result.source === "mcp" || result.toolName === "mcp") && result.target
      ? `User denied MCP target '${result.target}'.`
      : result.toolName === "bash" && result.command
        ? `User denied bash command '${result.command}'.`
        : `User denied tool '${result.toolName}'.`;
  const reasonSuffix = denialReason ? ` Reason: ${denialReason}.` : "";

  return `${base}${reasonSuffix} ${formatPermissionHardStopHint(result)}`;
}

export function formatAskPrompt(
  result: PermissionCheckResult,
  agentName?: string,
  input?: unknown,
): string {
  const subject = agentName ? `Agent '${agentName}'` : "Current agent";

  if (result.toolName === "bash") {
    const patternInfo = result.matchedPattern
      ? ` (matched '${result.matchedPattern}')`
      : "";
    return `${subject} requested bash command '${result.command || ""}'${patternInfo}. Allow this command?`;
  }

  if ((result.source === "mcp" || result.toolName === "mcp") && result.target) {
    const patternInfo = result.matchedPattern
      ? ` (matched '${result.matchedPattern}')`
      : "";
    return `${subject} requested MCP target '${result.target}'${patternInfo}. Allow this call?`;
  }

  const patternInfo = result.matchedPattern
    ? ` (matched '${result.matchedPattern}')`
    : "";
  const inputPreview = formatToolInputForPrompt(result.toolName, input);
  const inputSuffix = inputPreview ? ` ${inputPreview}` : "";
  return `${subject} requested tool '${result.toolName}'${patternInfo}${inputSuffix}. Allow this call?`;
}

export function formatSkillAskPrompt(
  skillName: string,
  agentName?: string,
): string {
  const subject = agentName ? `Agent '${agentName}'` : "Current agent";
  return `${subject} requested skill '${skillName}'. Allow loading this skill?`;
}

export function formatSkillPathAskPrompt(
  skill: SkillPromptEntry,
  readPath: string,
  agentName?: string,
): string {
  const subject = agentName ? `Agent '${agentName}'` : "Current agent";
  return `${subject} requested access to skill '${skill.name}' via '${readPath}'. Allow this read?`;
}

export function formatSkillPathDenyReason(
  skill: SkillPromptEntry,
  readPath: string,
  agentName?: string,
): string {
  const subject = agentName ? `Agent '${agentName}'` : "Current agent";
  return `${subject} is not permitted to access skill '${skill.name}' via '${readPath}'.`;
}
