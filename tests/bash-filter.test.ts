import { afterEach, describe, expect, test, vi } from "vitest";

import type { PermissionState } from "../src/types.js";

// Mock wildcard-matcher before importing the module under test.
vi.mock("../src/wildcard-matcher.js", () => ({
  compileWildcardPatterns: vi.fn((patterns: Record<string, PermissionState>) =>
    Object.entries(patterns).map(([pattern, state]) => ({
      pattern,
      state,
      regex: new RegExp(`^${pattern.replace(/\*/g, ".*")}$`),
    })),
  ),
  findCompiledWildcardMatch: vi.fn(),
}));

import { BashFilter } from "../src/bash-filter.js";
import {
  compileWildcardPatterns,
  findCompiledWildcardMatch,
} from "../src/wildcard-matcher.js";

const mockedFindMatch = vi.mocked(findCompiledWildcardMatch);

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("BashFilter.check", () => {
  test("returns matched state when wildcard-matcher finds a pattern match", () => {
    mockedFindMatch.mockReturnValue({
      state: "allow",
      matchedPattern: "git *",
      matchedName: "git status",
    });

    const filter = new BashFilter({ "git *": "allow" }, "ask");
    const result = filter.check("git status");

    expect(result.state).toBe("allow");
    expect(result.matchedPattern).toBe("git *");
    expect(result.command).toBe("git status");
    expect(mockedFindMatch).toHaveBeenCalledOnce();
  });

  test("returns default state when wildcard-matcher returns null", () => {
    mockedFindMatch.mockReturnValue(null);

    const filter = new BashFilter({ "git *": "allow" }, "ask");
    const result = filter.check("npm install");

    expect(result.state).toBe("ask");
    expect(result.matchedPattern).toBeUndefined();
    expect(result.command).toBe("npm install");
  });

  test("delegates pattern compilation to compileWildcardPatterns", () => {
    mockedFindMatch.mockReturnValue(null);

    const permissions: Record<string, PermissionState> = {
      "git *": "allow",
      "npm *": "deny",
    };
    new BashFilter(permissions, "ask");

    expect(compileWildcardPatterns).toHaveBeenCalledWith(permissions);
  });

  test("default fallback is the configured defaultState", () => {
    mockedFindMatch.mockReturnValue(null);

    const denyFilter = new BashFilter({}, "deny");
    expect(denyFilter.check("anything").state).toBe("deny");

    const allowFilter = new BashFilter({}, "allow");
    expect(allowFilter.check("anything").state).toBe("allow");
  });

  test("passes command string to findCompiledWildcardMatch", () => {
    mockedFindMatch.mockReturnValue(null);

    const filter = new BashFilter({}, "ask");
    filter.check("echo hello");

    expect(mockedFindMatch).toHaveBeenCalledWith(
      expect.any(Array),
      "echo hello",
    );
  });

  test("empty command falls through to default state", () => {
    mockedFindMatch.mockReturnValue(null);

    const filter = new BashFilter({}, "ask");
    const result = filter.check("");

    expect(result.state).toBe("ask");
    expect(result.command).toBe("");
  });

  test("accepts pre-compiled pattern list instead of permissions object", () => {
    mockedFindMatch.mockReturnValue({
      state: "deny",
      matchedPattern: "rm *",
      matchedName: "rm -rf /",
    });

    const compiledPatterns = [
      {
        pattern: "rm *",
        state: "deny" as const,
        regex: /^rm .*$/,
      },
    ];
    const filter = new BashFilter(compiledPatterns, "ask");
    const result = filter.check("rm -rf /");

    // compileWildcardPatterns should NOT be called for a pre-compiled list
    expect(compileWildcardPatterns).not.toHaveBeenCalled();
    expect(result.state).toBe("deny");
  });

  test("last-match-wins: matched pattern state overrides default", () => {
    mockedFindMatch.mockReturnValue({
      state: "deny",
      matchedPattern: "rm *",
      matchedName: "rm -rf /",
    });

    const filter = new BashFilter({ "rm *": "deny" }, "allow");
    const result = filter.check("rm -rf /");

    expect(result.state).toBe("deny");
    expect(result.matchedPattern).toBe("rm *");
  });
});
