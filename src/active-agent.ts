import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

/**
 * Matches the `<active_agent name="...">` tag injected by pi-agent-router
 * into the system prompt to identify which agent definition is active.
 */
export const ACTIVE_AGENT_TAG_REGEX =
  /<active_agent\s+name=["']([^"']+)["'][^>]*>/i;

export function normalizeAgentName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getActiveAgentName(ctx: ExtensionContext): string | null {
  const entries = ctx.sessionManager.getEntries();
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i] as {
      type: string;
      customType?: string;
      data?: unknown;
    };
    if (entry.type !== "custom" || entry.customType !== "active_agent") {
      continue;
    }

    const data = entry.data as { name?: unknown } | undefined;
    const normalizedName = normalizeAgentName(data?.name);
    if (normalizedName) {
      return normalizedName;
    }

    if (data?.name === null) {
      return null;
    }
  }

  return null;
}

export function getActiveAgentNameFromSystemPrompt(
  systemPrompt: string | undefined,
): string | null {
  if (!systemPrompt) {
    return null;
  }

  const match = systemPrompt.match(ACTIVE_AGENT_TAG_REGEX);
  if (!match?.[1]) {
    return null;
  }

  return normalizeAgentName(match[1]);
}
