import { getNonEmptyString, toRecord } from "./common.js";
import { safeJsonStringify } from "./logging.js";
import type { PermissionCheckResult } from "./types.js";

export const TOOL_INPUT_PREVIEW_MAX_LENGTH = 200;
export const TOOL_INPUT_LOG_PREVIEW_MAX_LENGTH = 1000;
export const TOOL_TEXT_SUMMARY_MAX_LENGTH = 80;

export function truncateInlineText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

export function sanitizeInlineText(
  value: string,
  maxLength = TOOL_TEXT_SUMMARY_MAX_LENGTH,
): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? truncateInlineText(normalized, maxLength) : "empty text";
}

export function countTextLines(value: string): number {
  if (!value) {
    return 0;
  }

  return value.split(/\r\n|\r|\n/).length;
}

export function formatCount(
  value: number,
  singular: string,
  plural: string,
): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function getPromptPath(input: Record<string, unknown>): string | null {
  return getNonEmptyString(input.path) ?? getNonEmptyString(input.file_path);
}

export function formatEditInputForPrompt(
  input: Record<string, unknown>,
): string {
  const path = getPromptPath(input);
  const rawEdits = Array.isArray(input.edits)
    ? input.edits
    : typeof input.oldText === "string" && typeof input.newText === "string"
      ? [{ oldText: input.oldText, newText: input.newText }]
      : [];

  const edits = rawEdits
    .map((edit) => toRecord(edit))
    .filter(
      (edit) =>
        typeof edit.oldText === "string" && typeof edit.newText === "string",
    );

  const pathPart = path ? `for '${path}'` : "";
  if (edits.length === 0) {
    return pathPart ? `${pathPart} with edit input` : "with edit input";
  }

  const firstEdit = edits[0];
  const oldText = String(firstEdit.oldText);
  const newText = String(firstEdit.newText);
  const firstEditSummary = `edit #1 replaces ${formatCount(countTextLines(oldText), "line", "lines")} with ${formatCount(countTextLines(newText), "line", "lines")}`;
  const extraEdits =
    edits.length > 1
      ? `, plus ${formatCount(edits.length - 1, "additional edit", "additional edits")}`
      : "";
  const summary = `(${formatCount(edits.length, "replacement", "replacements")}: ${firstEditSummary}${extraEdits})`;
  return pathPart ? `${pathPart} ${summary}` : summary;
}

export function formatWriteInputForPrompt(
  input: Record<string, unknown>,
): string {
  const path = getPromptPath(input);
  const content = typeof input.content === "string" ? input.content : "";
  const summary = `(${formatCount(countTextLines(content), "line", "lines")}, ${formatCount(content.length, "character", "characters")})`;
  return path ? `for '${path}' ${summary}` : summary;
}

export function formatReadInputForPrompt(
  input: Record<string, unknown>,
): string {
  const path = getPromptPath(input);
  const parts = path ? [`path '${path}'`] : [];
  if (typeof input.offset === "number") {
    parts.push(`offset ${input.offset}`);
  }
  if (typeof input.limit === "number") {
    parts.push(`limit ${input.limit}`);
  }
  return parts.length > 0 ? `for ${parts.join(", ")}` : "";
}

export function formatSearchInputForPrompt(
  toolName: string,
  input: Record<string, unknown>,
): string {
  const parts: string[] = [];
  const path = getPromptPath(input);
  const pattern = getNonEmptyString(input.pattern);
  const glob = getNonEmptyString(input.glob);

  if (pattern) {
    parts.push(`pattern '${sanitizeInlineText(pattern)}'`);
  }
  if (glob) {
    parts.push(`glob '${sanitizeInlineText(glob)}'`);
  }
  if (path) {
    parts.push(`path '${path}'`);
  } else if (toolName === "find" || toolName === "grep" || toolName === "ls") {
    parts.push("current working directory");
  }

  return parts.length > 0 ? `for ${parts.join(", ")}` : "";
}

export function serializeToolInputPreview(input: unknown): string {
  const serialized = safeJsonStringify(input);
  if (!serialized || serialized === "{}" || serialized === "null") {
    return "";
  }

  return serialized.replace(/\s+/g, " ").trim();
}

export function formatJsonInputForPrompt(input: unknown): string {
  const inline = serializeToolInputPreview(input);
  return inline
    ? `with input ${truncateInlineText(inline, TOOL_INPUT_PREVIEW_MAX_LENGTH)}`
    : "";
}

export function formatToolInputForPrompt(
  toolName: string,
  input: unknown,
): string {
  const inputRecord = toRecord(input);

  switch (toolName) {
    case "edit":
      return formatEditInputForPrompt(inputRecord);
    case "write":
      return formatWriteInputForPrompt(inputRecord);
    case "read":
      return formatReadInputForPrompt(inputRecord);
    case "find":
    case "grep":
    case "ls":
      return formatSearchInputForPrompt(toolName, inputRecord);
    default:
      return formatJsonInputForPrompt(input);
  }
}

export function formatGenericToolInputForLog(
  input: unknown,
): string | undefined {
  const inline = serializeToolInputPreview(input);
  return inline
    ? `input ${truncateInlineText(inline, TOOL_INPUT_LOG_PREVIEW_MAX_LENGTH)}`
    : undefined;
}

export function getToolInputPreviewForLog(
  result: PermissionCheckResult,
  input: unknown,
  pathBearingTools: ReadonlySet<string>,
): string | undefined {
  if (
    result.toolName === "bash" ||
    result.toolName === "mcp" ||
    result.source === "mcp"
  ) {
    return undefined;
  }

  if (pathBearingTools.has(result.toolName)) {
    const inputPreview = formatToolInputForPrompt(result.toolName, input);
    return inputPreview
      ? truncateInlineText(inputPreview, TOOL_INPUT_LOG_PREVIEW_MAX_LENGTH)
      : undefined;
  }

  return formatGenericToolInputForLog(input);
}

export function getPermissionLogContext(
  result: PermissionCheckResult,
  input: unknown,
  pathBearingTools: ReadonlySet<string>,
): { command?: string; target?: string; toolInputPreview?: string } {
  return {
    command: result.command,
    target: result.target,
    toolInputPreview: getToolInputPreviewForLog(
      result,
      input,
      pathBearingTools,
    ),
  };
}
