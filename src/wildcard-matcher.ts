export type CompiledWildcardPattern<TState> = {
  pattern: string;
  state: TState;
  regex: RegExp;
};

export type WildcardPatternMatch<TState> = {
  state: TState;
  matchedPattern: string;
  matchedName: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function compileWildcardPattern<TState>(
  pattern: string,
  state: TState,
): CompiledWildcardPattern<TState> {
  const escaped = pattern
    .split("*")
    .map((part) => escapeRegExp(part))
    .join(".*");

  return {
    pattern,
    state,
    regex: new RegExp(`^${escaped}$`),
  };
}

export function compileWildcardPatternEntries<TState>(
  entries: Iterable<readonly [string, TState]>,
): CompiledWildcardPattern<TState>[] {
  return Array.from(entries, ([pattern, state]) =>
    compileWildcardPattern(pattern, state),
  );
}

export function compileWildcardPatterns<TState>(
  patterns: Record<string, TState>,
): CompiledWildcardPattern<TState>[] {
  return compileWildcardPatternEntries(Object.entries(patterns));
}

export function findCompiledWildcardMatch<TState>(
  patterns: readonly CompiledWildcardPattern<TState>[],
  name: string,
): WildcardPatternMatch<TState> | null {
  for (let index = patterns.length - 1; index >= 0; index -= 1) {
    const pattern = patterns[index];
    if (pattern.regex.test(name)) {
      return {
        state: pattern.state,
        matchedPattern: pattern.pattern,
        matchedName: name,
      };
    }
  }

  return null;
}

export function findCompiledWildcardMatchForNames<TState>(
  patterns: readonly CompiledWildcardPattern<TState>[],
  names: readonly string[],
): WildcardPatternMatch<TState> | null {
  const normalizedNames = names
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (normalizedNames.length === 0) {
    return null;
  }

  for (const name of normalizedNames) {
    const match = findCompiledWildcardMatch(patterns, name);
    if (match) {
      return match;
    }
  }

  return null;
}
