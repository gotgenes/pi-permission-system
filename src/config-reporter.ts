import type { ResolvedPolicyPaths } from "./permission-manager.js";

export interface ResolvedConfigLogEntry {
  extensionConfigPath: string;
  extensionConfigExists: boolean;
  globalConfigPath: string;
  globalConfigExists: boolean;
  projectConfigPath: string | null;
  projectConfigExists: boolean;
  agentsDir: string;
  agentsDirExists: boolean;
  projectAgentsDir: string | null;
  projectAgentsDirExists: boolean;
}

export function buildResolvedConfigLogEntry(
  extensionConfigPath: string,
  extensionConfigExists: boolean,
  policyPaths: ResolvedPolicyPaths,
): ResolvedConfigLogEntry {
  return {
    extensionConfigPath,
    extensionConfigExists,
    ...policyPaths,
  };
}
