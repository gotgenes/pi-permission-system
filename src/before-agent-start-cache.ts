export interface BeforeAgentStartPromptStateInput {
  agentName: string | null;
  cwd: string;
  permissionStamp: string;
  systemPrompt: string;
  allowedToolNames: readonly string[];
}

function normalizeAgentName(agentName: string | null): string {
  return agentName ?? "";
}

function normalizePrompt(prompt: string): string {
  return prompt.replace(/\r\n/g, "\n");
}

function createCacheKey(parts: readonly unknown[]): string {
  return JSON.stringify(parts);
}

export function createActiveToolsCacheKey(
  allowedToolNames: readonly string[],
): string {
  return createCacheKey(allowedToolNames);
}

export function createBeforeAgentStartPromptStateKey(
  input: BeforeAgentStartPromptStateInput,
): string {
  return createCacheKey([
    normalizeAgentName(input.agentName),
    input.cwd,
    input.permissionStamp,
    createActiveToolsCacheKey(input.allowedToolNames),
    normalizePrompt(input.systemPrompt),
  ]);
}

export function shouldApplyCachedAgentStartState(
  previousKey: string | null,
  nextKey: string,
): boolean {
  return previousKey !== nextKey;
}
