import { existsSync, readFileSync } from "node:fs";
import { normalize } from "node:path";

import { isPermissionState, toRecord } from "./common.js";
import {
  getGlobalConfigPath,
  getLegacyExtensionConfigPath,
  getLegacyGlobalPolicyPath,
  getLegacyProjectPolicyPath,
  getProjectConfigPath,
} from "./config-paths.js";
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
 * Merge two unified configs. Object-shaped fields (defaultPolicy, tools, bash,
 * mcp, skills, special) are shallow-merged (override wins per-key). Scalar
 * fields (debugLog, permissionReviewLog, yoloMode) are replaced when present
 * in the override.
 */
export function mergeUnifiedConfigs(
  base: UnifiedPermissionConfig,
  override: UnifiedPermissionConfig,
): UnifiedPermissionConfig {
  const merged: UnifiedPermissionConfig = {};

  // Scalars: override replaces base when defined
  for (const key of ["debugLog", "permissionReviewLog", "yoloMode"] as const) {
    const value = override[key] ?? base[key];
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  // Object fields: shallow spread merge
  for (const key of [
    "defaultPolicy",
    "tools",
    "bash",
    "mcp",
    "skills",
    "special",
  ] as const) {
    const baseVal = base[key];
    const overrideVal = override[key];
    if (baseVal || overrideVal) {
      merged[key] = { ...(baseVal || {}), ...(overrideVal || {}) } as never;
    }
  }

  return merged;
}

export interface MergedConfigResult {
  global: UnifiedPermissionConfig;
  project: UnifiedPermissionConfig;
  merged: UnifiedPermissionConfig;
  issues: string[];
}

/**
 * Load global and project configs from the new layout, detect legacy files,
 * merge everything, and collect issues.
 *
 * Merge order:
 * 1. Legacy global policy (if present) — lowest precedence
 * 2. Legacy extension runtime config (if present and path differs from new global)
 * 3. New global config
 * 4. Legacy project policy (if present)
 * 5. New project config — highest precedence
 */
export function loadAndMergeConfigs(
  agentDir: string,
  cwd: string,
  extensionRoot: string,
): MergedConfigResult {
  const allIssues: string[] = [];

  const newGlobalPath = getGlobalConfigPath(agentDir);
  const newProjectPath = getProjectConfigPath(cwd);
  const legacyGlobalPolicyPath = getLegacyGlobalPolicyPath(agentDir);
  const legacyProjectPolicyPath = getLegacyProjectPolicyPath(cwd);
  const legacyExtConfigPath = getLegacyExtensionConfigPath(extensionRoot);

  // Start with empty
  let merged: UnifiedPermissionConfig = {};

  // 1. Legacy global policy
  if (existsSync(legacyGlobalPolicyPath)) {
    const legacy = loadUnifiedConfig(legacyGlobalPolicyPath);
    allIssues.push(
      `Legacy global policy found at '${legacyGlobalPolicyPath}'. ` +
        `Move it to '${newGlobalPath}':\n` +
        `  mv '${legacyGlobalPolicyPath}' '${newGlobalPath}'`,
    );
    allIssues.push(...legacy.issues);
    merged = mergeUnifiedConfigs(merged, legacy.config);
  }

  // 2. Legacy extension runtime config (only if different from new global path)
  const normalizedLegacyExt = normalize(legacyExtConfigPath);
  const normalizedNewGlobal = normalize(newGlobalPath);
  if (
    normalizedLegacyExt !== normalizedNewGlobal &&
    existsSync(legacyExtConfigPath)
  ) {
    const legacy = loadUnifiedConfig(legacyExtConfigPath);
    allIssues.push(
      `Legacy extension config found at '${legacyExtConfigPath}'. ` +
        `Move runtime settings to '${newGlobalPath}':\n` +
        `  mv '${legacyExtConfigPath}' '${newGlobalPath}'`,
    );
    allIssues.push(...legacy.issues);
    merged = mergeUnifiedConfigs(merged, legacy.config);
  }

  // 3. New global config
  const globalResult = loadUnifiedConfig(newGlobalPath);
  allIssues.push(...globalResult.issues);
  const globalConfig = globalResult.config;
  merged = mergeUnifiedConfigs(merged, globalConfig);

  // 4. Legacy project policy
  if (existsSync(legacyProjectPolicyPath)) {
    const legacy = loadUnifiedConfig(legacyProjectPolicyPath);
    allIssues.push(
      `Legacy project policy found at '${legacyProjectPolicyPath}'. ` +
        `Move it to '${newProjectPath}':\n` +
        `  mv '${legacyProjectPolicyPath}' '${newProjectPath}'`,
    );
    allIssues.push(...legacy.issues);
    merged = mergeUnifiedConfigs(merged, legacy.config);
  }

  // 5. New project config
  const projectResult = loadUnifiedConfig(newProjectPath);
  allIssues.push(...projectResult.issues);
  const projectConfig = projectResult.config;
  merged = mergeUnifiedConfigs(merged, projectConfig);

  return {
    global: globalConfig,
    project: projectConfig,
    merged,
    issues: allIssues,
  };
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
