import { afterEach, describe, expect, test, vi } from "vitest";

import {
  compileWildcardPattern,
  compileWildcardPatternEntries,
  findCompiledWildcardMatch,
  findCompiledWildcardMatchForNames,
} from "../src/wildcard-matcher.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("compileWildcardPatternEntries", () => {
  test("returns empty array for empty iterable", () => {
    const result = compileWildcardPatternEntries([]);
    expect(result).toEqual([]);
  });

  test("compiles a single exact pattern", () => {
    const result = compileWildcardPatternEntries([["read", "allow"]]);
    expect(result).toHaveLength(1);
    expect(result[0].pattern).toBe("read");
    expect(result[0].state).toBe("allow");
  });

  test("compiles multiple patterns in order", () => {
    const entries: [string, string][] = [
      ["read", "allow"],
      ["write", "deny"],
      ["bash *", "ask"],
    ];
    const result = compileWildcardPatternEntries(entries);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.pattern)).toEqual(["read", "write", "bash *"]);
  });
});

describe("findCompiledWildcardMatch", () => {
  test("returns null for empty patterns array", () => {
    const result = findCompiledWildcardMatch([], "read");
    expect(result).toBeNull();
  });

  test("matches exact pattern", () => {
    const patterns = compileWildcardPatternEntries([["read", "allow"]]);
    const result = findCompiledWildcardMatch(patterns, "read");
    expect(result).not.toBeNull();
    expect(result?.state).toBe("allow");
    expect(result?.matchedPattern).toBe("read");
    expect(result?.matchedName).toBe("read");
  });

  test("returns null when no pattern matches", () => {
    const patterns = compileWildcardPatternEntries([["read", "allow"]]);
    const result = findCompiledWildcardMatch(patterns, "write");
    expect(result).toBeNull();
  });

  test("matches glob * pattern", () => {
    const patterns = compileWildcardPatternEntries([["git *", "allow"]]);
    const result = findCompiledWildcardMatch(patterns, "git status");
    expect(result).not.toBeNull();
    expect(result?.state).toBe("allow");
    expect(result?.matchedPattern).toBe("git *");
  });

  test("glob * matches zero or more characters", () => {
    const patterns = compileWildcardPatternEntries([["git*", "allow"]]);
    expect(findCompiledWildcardMatch(patterns, "git")).not.toBeNull();
    expect(findCompiledWildcardMatch(patterns, "git status")).not.toBeNull();
    expect(findCompiledWildcardMatch(patterns, "npm install")).toBeNull();
  });

  test("last-match-wins precedence: later pattern overrides earlier", () => {
    const patterns = compileWildcardPatternEntries([
      ["git *", "allow"],
      ["git push *", "deny"],
    ]);
    const result = findCompiledWildcardMatch(patterns, "git push origin main");
    expect(result).not.toBeNull();
    expect(result?.state).toBe("deny");
    expect(result?.matchedPattern).toBe("git push *");
  });

  test("last-match-wins: specific deny before broad allow matches the later one", () => {
    const patterns = compileWildcardPatternEntries([
      ["*", "deny"],
      ["git status", "allow"],
    ]);
    const result = findCompiledWildcardMatch(patterns, "git status");
    expect(result).not.toBeNull();
    expect(result?.state).toBe("allow");
  });

  test("exact pattern does not match partial name", () => {
    const patterns = compileWildcardPatternEntries([["read", "allow"]]);
    expect(findCompiledWildcardMatch(patterns, "read ")).toBeNull();
    expect(findCompiledWildcardMatch(patterns, "readonly")).toBeNull();
  });

  test("regex special characters in pattern are escaped", () => {
    const patterns = compileWildcardPatternEntries([
      ["tool.name", "allow"],
      ["tool+extra", "deny"],
    ]);
    // "tool.name" should not match "toolXname" (dot is escaped)
    expect(findCompiledWildcardMatch(patterns, "toolXname")).toBeNull();
    // Exact match works
    expect(findCompiledWildcardMatch(patterns, "tool.name")).not.toBeNull();
    expect(findCompiledWildcardMatch(patterns, "tool+extra")).not.toBeNull();
  });
});

describe("findCompiledWildcardMatchForNames", () => {
  test("returns null for empty names array", () => {
    const patterns = compileWildcardPatternEntries([["read", "allow"]]);
    const result = findCompiledWildcardMatchForNames(patterns, []);
    expect(result).toBeNull();
  });

  test("returns null when all names are whitespace", () => {
    const patterns = compileWildcardPatternEntries([["  ", "allow"]]);
    const result = findCompiledWildcardMatchForNames(patterns, ["  ", "\t"]);
    expect(result).toBeNull();
  });

  test("matches first name that has a pattern match", () => {
    const patterns = compileWildcardPatternEntries([
      ["read", "allow"],
      ["write", "deny"],
    ]);
    const result = findCompiledWildcardMatchForNames(patterns, [
      "grep",
      "write",
    ]);
    expect(result).not.toBeNull();
    expect(result?.matchedName).toBe("write");
    expect(result?.state).toBe("deny");
  });

  test("trims whitespace from names before matching", () => {
    const patterns = compileWildcardPatternEntries([["read", "allow"]]);
    const result = findCompiledWildcardMatchForNames(patterns, ["  read  "]);
    expect(result).not.toBeNull();
    expect(result?.state).toBe("allow");
  });

  test("returns null when no name matches any pattern", () => {
    const patterns = compileWildcardPatternEntries([["read", "allow"]]);
    const result = findCompiledWildcardMatchForNames(patterns, [
      "write",
      "grep",
    ]);
    expect(result).toBeNull();
  });

  test("multi-name lookup: returns match for first matching name in order", () => {
    const patterns = compileWildcardPatternEntries([
      ["read", "allow"],
      ["write", "deny"],
    ]);
    // "read" comes before "write" in names array, so "read" should match first
    const result = findCompiledWildcardMatchForNames(patterns, [
      "read",
      "write",
    ]);
    expect(result).not.toBeNull();
    expect(result?.matchedName).toBe("read");
    expect(result?.state).toBe("allow");
  });

  test("compileWildcardPattern produces correct pattern metadata", () => {
    const compiled = compileWildcardPattern("bash *", "ask");
    expect(compiled.pattern).toBe("bash *");
    expect(compiled.state).toBe("ask");
    expect(compiled.regex.test("bash ls -la")).toBe(true);
    expect(compiled.regex.test("echo hello")).toBe(false);
  });
});
