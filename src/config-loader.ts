import { existsSync, readFileSync } from "node:fs";

import { isPermissionState, toRecord } from "./common.js";
import type { PermissionDefaultPolicy, PermissionState } from "./types.js";

/**
 * Unified config shape combining runtime knobs and policy in one object.
 * All fields are optional so partial configs (project-only, global-only) work.
 */
export interface UnifiedPermissionConfig {
  // Runtime knobs
  debugLog?: boolean;
  permissionReviewLog?: boolean;
  yoloMode?: boolean;

  // Policy
  defaultPolicy?: Partial<PermissionDefaultPolicy>;
  tools?: Record<string, PermissionState>;
  bash?: Record<string, PermissionState>;
  mcp?: Record<string, PermissionState>;
  skills?: Record<string, PermissionState>;
  special?: Record<string, PermissionState>;
}

export interface UnifiedConfigLoadResult {
  config: UnifiedPermissionConfig;
  issues: string[];
}

const DEPRECATED_SPECIAL_KEYS: ReadonlySet<string> = new Set([
  "tool_call_limit",
]);

const BUILT_IN_TOOL_PERMISSION_NAMES = new Set([
  "bash",
  "read",
  "write",
  "edit",
  "grep",
  "find",
  "ls",
]);

const SPECIAL_PERMISSION_KEYS = new Set(["doom_loop", "external_directory"]);

export function stripJsonComments(input: string): string {
  let output = "";
  let inString = false;
  let stringQuote: '"' | "'" | "" = "";
  let escaping = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1] || "";

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (!inString && char === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }

    if (!inString && char === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    output += char;

    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringQuote = char;
      escaping = false;
      continue;
    }

    if (!inString) {
      continue;
    }

    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (char === stringQuote) {
      inString = false;
      stringQuote = "";
    }
  }

  return output;
}

function normalizePartialPolicy(
  value: unknown,
): Partial<PermissionDefaultPolicy> | undefined {
  const record = toRecord(value);
  const normalized: Partial<PermissionDefaultPolicy> = {};
  let hasAny = false;

  for (const key of ["tools", "bash", "mcp", "skills", "special"] as const) {
    if (isPermissionState(record[key])) {
      normalized[key] = record[key] as PermissionState;
      hasAny = true;
    }
  }

  return hasAny ? normalized : undefined;
}

function normalizePermissionRecord(
  value: unknown,
): Record<string, PermissionState> | undefined {
  const record = toRecord(value);
  const normalized: Record<string, PermissionState> = {};
  let hasAny = false;

  for (const [key, state] of Object.entries(record)) {
    if (isPermissionState(state)) {
      normalized[key] = state;
      hasAny = true;
    }
  }

  return hasAny ? normalized : undefined;
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

/**
 * Normalize raw parsed JSON into the unified config shape.
 * Handles top-level shorthand keys (e.g. `bash: "allow"` at root)
 * and deprecated special keys, collecting issues along the way.
 */
export function normalizeUnifiedConfig(raw: unknown): {
  config: UnifiedPermissionConfig;
  issues: string[];
} {
  const record = toRecord(raw);
  const issues: string[] = [];

  const config: UnifiedPermissionConfig = {};

  // Runtime knobs
  const debugLog = normalizeOptionalBoolean(record.debugLog);
  if (debugLog !== undefined) config.debugLog = debugLog;

  const permissionReviewLog = normalizeOptionalBoolean(
    record.permissionReviewLog,
  );
  if (permissionReviewLog !== undefined)
    config.permissionReviewLog = permissionReviewLog;

  const yoloMode = normalizeOptionalBoolean(record.yoloMode);
  if (yoloMode !== undefined) config.yoloMode = yoloMode;

  // Policy
  const defaultPolicy = normalizePartialPolicy(record.defaultPolicy);
  if (defaultPolicy) config.defaultPolicy = defaultPolicy;

  const tools = normalizePermissionRecord(record.tools);
  if (tools) config.tools = tools;

  const bash = normalizePermissionRecord(record.bash);
  if (bash) config.bash = bash;

  const mcp = normalizePermissionRecord(record.mcp);
  if (mcp) config.mcp = mcp;

  const skills = normalizePermissionRecord(record.skills);
  if (skills) config.skills = skills;

  const special = normalizePermissionRecord(record.special);
  if (special) config.special = special;

  // Detect deprecated special keys
  const rawSpecial = toRecord(record.special);
  for (const key of DEPRECATED_SPECIAL_KEYS) {
    if (key in rawSpecial) {
      issues.push(
        `special.${key} is deprecated and ignored — remove it from your config file.`,
      );
      if (config.special) {
        delete config.special[key];
        if (Object.keys(config.special).length === 0) {
          delete config.special;
        }
      }
    }
  }

  // Handle top-level shorthand keys (e.g. `bash: "allow"` at root level)
  for (const [key, value] of Object.entries(record)) {
    if (!isPermissionState(value)) continue;

    if (BUILT_IN_TOOL_PERMISSION_NAMES.has(key)) {
      config.tools = { ...(config.tools || {}), [key]: value };
    } else if (SPECIAL_PERMISSION_KEYS.has(key)) {
      config.special = { ...(config.special || {}), [key]: value };
    }
  }

  return { config, issues };
}

/**
 * Load and normalize a unified config file.
 * Returns an empty config with no issues if the file does not exist.
 * Returns an empty config with an issue if the file cannot be parsed.
 */
export function loadUnifiedConfig(path: string): UnifiedConfigLoadResult {
  if (!existsSync(path)) {
    return { config: {}, issues: [] };
  }

  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(stripJsonComments(raw)) as unknown;
    return normalizeUnifiedConfig(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      config: {},
      issues: [`Failed to read config at '${path}': ${message}`],
    };
  }
}
