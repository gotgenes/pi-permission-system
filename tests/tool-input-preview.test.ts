import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock logging collaborator before importing the module under test.
vi.mock("../src/logging.js", () => ({
  safeJsonStringify: vi.fn((value: unknown) => JSON.stringify(value)),
}));

import { safeJsonStringify } from "../src/logging.js";
import {
  countTextLines,
  formatCount,
  formatEditInputForPrompt,
  formatGenericToolInputForLog,
  formatReadInputForPrompt,
  formatSearchInputForPrompt,
  formatToolInputForPrompt,
  formatWriteInputForPrompt,
  getPermissionLogContext,
  getPromptPath,
  getToolInputPreviewForLog,
  sanitizeInlineText,
  serializeToolInputPreview,
  TOOL_INPUT_LOG_PREVIEW_MAX_LENGTH,
  TOOL_INPUT_PREVIEW_MAX_LENGTH,
  TOOL_TEXT_SUMMARY_MAX_LENGTH,
  truncateInlineText,
} from "../src/tool-input-preview.js";
import type { PermissionCheckResult } from "../src/types.js";

const mockedStringify = vi.mocked(safeJsonStringify);

beforeEach(() => {
  mockedStringify.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("constants", () => {
  test("TOOL_INPUT_PREVIEW_MAX_LENGTH is 200", () => {
    expect(TOOL_INPUT_PREVIEW_MAX_LENGTH).toBe(200);
  });

  test("TOOL_INPUT_LOG_PREVIEW_MAX_LENGTH is 1000", () => {
    expect(TOOL_INPUT_LOG_PREVIEW_MAX_LENGTH).toBe(1000);
  });

  test("TOOL_TEXT_SUMMARY_MAX_LENGTH is 80", () => {
    expect(TOOL_TEXT_SUMMARY_MAX_LENGTH).toBe(80);
  });
});

describe("truncateInlineText", () => {
  test("returns text unchanged when within maxLength", () => {
    expect(truncateInlineText("hello", 10)).toBe("hello");
  });

  test("does not truncate when length equals maxLength", () => {
    const text = "a".repeat(200);
    expect(truncateInlineText(text, 200)).toBe(text);
  });

  test("truncates and appends ellipsis when length exceeds maxLength", () => {
    const text = "a".repeat(201);
    const result = truncateInlineText(text, 200);
    expect(result).toBe(`${"a".repeat(200)}…`);
  });

  test("truncates long text and appends ellipsis", () => {
    const result = truncateInlineText("abcdef", 3);
    expect(result).toBe("abc…");
  });
});

describe("sanitizeInlineText", () => {
  test("collapses whitespace and trims", () => {
    expect(sanitizeInlineText("  hello   world  ")).toBe("hello world");
  });

  test("returns 'empty text' for blank string", () => {
    expect(sanitizeInlineText("")).toBe("empty text");
    expect(sanitizeInlineText("   ")).toBe("empty text");
  });

  test("truncates to default TOOL_TEXT_SUMMARY_MAX_LENGTH", () => {
    const long = "x".repeat(100);
    const result = sanitizeInlineText(long);
    expect(result.length).toBeLessThanOrEqual(TOOL_TEXT_SUMMARY_MAX_LENGTH + 1); // +1 for ellipsis char
    expect(result).toContain("…");
  });

  test("respects custom maxLength", () => {
    const result = sanitizeInlineText("hello world", 5);
    expect(result).toBe("hello…");
  });
});

describe("countTextLines", () => {
  test("returns 0 for empty string", () => {
    expect(countTextLines("")).toBe(0);
  });

  test("returns 1 for a single line with no newline", () => {
    expect(countTextLines("hello")).toBe(1);
  });

  test("counts LF-separated lines", () => {
    expect(countTextLines("line1\nline2\nline3")).toBe(3);
  });

  test("counts CRLF-separated lines", () => {
    expect(countTextLines("line1\r\nline2")).toBe(2);
  });

  test("counts CR-separated lines", () => {
    expect(countTextLines("line1\rline2")).toBe(2);
  });
});

describe("formatCount", () => {
  test("uses singular form for 1", () => {
    expect(formatCount(1, "line", "lines")).toBe("1 line");
  });

  test("uses plural form for 0", () => {
    expect(formatCount(0, "line", "lines")).toBe("0 lines");
  });

  test("uses plural form for 2+", () => {
    expect(formatCount(3, "line", "lines")).toBe("3 lines");
  });
});

describe("getPromptPath", () => {
  test("returns path from 'path' key", () => {
    expect(getPromptPath({ path: "/foo/bar" })).toBe("/foo/bar");
  });

  test("falls back to 'file_path' key", () => {
    expect(getPromptPath({ file_path: "/baz" })).toBe("/baz");
  });

  test("returns null when neither key is present", () => {
    expect(getPromptPath({})).toBeNull();
  });

  test("returns null when path is empty string", () => {
    expect(getPromptPath({ path: "" })).toBeNull();
  });
});

describe("formatEditInputForPrompt", () => {
  test("returns path-only description when no edits provided", () => {
    const result = formatEditInputForPrompt({ path: "/foo.ts" });
    expect(result).toBe("for '/foo.ts' with edit input");
  });

  test("formats single replacement with line counts", () => {
    const result = formatEditInputForPrompt({
      path: "/foo.ts",
      edits: [{ oldText: "line1\nline2", newText: "replaced" }],
    });
    expect(result).toContain("for '/foo.ts'");
    expect(result).toContain("1 replacement");
    expect(result).toContain("2 lines");
    expect(result).toContain("1 line");
  });

  test("formats multiple replacements mentioning additional edits", () => {
    const result = formatEditInputForPrompt({
      path: "/foo.ts",
      edits: [
        { oldText: "a", newText: "b" },
        { oldText: "c", newText: "d" },
        { oldText: "e", newText: "f" },
      ],
    });
    expect(result).toContain("3 replacements");
    expect(result).toContain("2 additional edits");
  });

  test("falls back to oldText/newText when no edits array", () => {
    const result = formatEditInputForPrompt({
      path: "/bar.ts",
      oldText: "old",
      newText: "new",
    });
    expect(result).toContain("for '/bar.ts'");
    expect(result).toContain("1 replacement");
  });

  test("works without a path", () => {
    const result = formatEditInputForPrompt({
      edits: [{ oldText: "x", newText: "y" }],
    });
    expect(result).not.toContain("for '");
    expect(result).toContain("1 replacement");
  });
});

describe("formatWriteInputForPrompt", () => {
  test("includes path, line count, and character count", () => {
    const result = formatWriteInputForPrompt({
      path: "/out.ts",
      content: "line1\nline2",
    });
    expect(result).toContain("for '/out.ts'");
    expect(result).toContain("2 lines");
    expect(result).toContain("11 characters");
  });

  test("handles missing content as empty", () => {
    const result = formatWriteInputForPrompt({ path: "/out.ts" });
    expect(result).toContain("0 lines");
    expect(result).toContain("0 characters");
  });
});

describe("formatReadInputForPrompt", () => {
  test("includes path", () => {
    expect(formatReadInputForPrompt({ path: "/src/foo.ts" })).toBe(
      "for path '/src/foo.ts'",
    );
  });

  test("includes offset and limit when present", () => {
    const result = formatReadInputForPrompt({
      path: "/x",
      offset: 10,
      limit: 50,
    });
    expect(result).toContain("offset 10");
    expect(result).toContain("limit 50");
  });

  test("returns empty string when no path and no options", () => {
    expect(formatReadInputForPrompt({})).toBe("");
  });
});

describe("formatSearchInputForPrompt", () => {
  test("includes pattern and path", () => {
    const result = formatSearchInputForPrompt("grep", {
      pattern: "TODO",
      path: "/src",
    });
    expect(result).toContain("pattern 'TODO'");
    expect(result).toContain("path '/src'");
  });

  test("includes glob when present", () => {
    const result = formatSearchInputForPrompt("find", { glob: "*.ts" });
    expect(result).toContain("glob '*.ts'");
  });

  test("uses 'current working directory' for find/grep/ls without path", () => {
    for (const toolName of ["find", "grep", "ls"]) {
      const result = formatSearchInputForPrompt(toolName, {});
      expect(result).toContain("current working directory");
    }
  });

  test("returns empty string for other tools with no input", () => {
    expect(formatSearchInputForPrompt("other", {})).toBe("");
  });
});

describe("serializeToolInputPreview", () => {
  test("delegates serialization to safeJsonStringify", () => {
    mockedStringify.mockReturnValue('{"key":"value"}');
    const result = serializeToolInputPreview({ key: "value" });
    expect(mockedStringify).toHaveBeenCalledWith({ key: "value" });
    expect(result).toBe('{"key":"value"}');
  });

  test("returns empty string when safeJsonStringify returns undefined", () => {
    mockedStringify.mockReturnValue(undefined);
    expect(serializeToolInputPreview({})).toBe("");
  });

  test("returns empty string when serialized value is '{}'", () => {
    mockedStringify.mockReturnValue("{}");
    expect(serializeToolInputPreview({})).toBe("");
  });

  test("returns empty string when serialized value is 'null'", () => {
    mockedStringify.mockReturnValue("null");
    expect(serializeToolInputPreview(null)).toBe("");
  });

  test("collapses whitespace in serialized output", () => {
    mockedStringify.mockReturnValue('{\n  "key":  "val"\n}');
    const result = serializeToolInputPreview({});
    expect(result).toBe('{ "key": "val" }');
  });
});

describe("formatToolInputForPrompt", () => {
  test("dispatches 'edit' to formatEditInputForPrompt", () => {
    mockedStringify.mockReturnValue(undefined);
    const result = formatToolInputForPrompt("edit", {
      path: "/foo.ts",
      edits: [],
    });
    expect(result).toContain("for '/foo.ts'");
  });

  test("dispatches 'write' to formatWriteInputForPrompt", () => {
    const result = formatToolInputForPrompt("write", {
      path: "/out.ts",
      content: "hi",
    });
    expect(result).toContain("for '/out.ts'");
  });

  test("dispatches 'read' to formatReadInputForPrompt", () => {
    const result = formatToolInputForPrompt("read", { path: "/src/x.ts" });
    expect(result).toContain("path '/src/x.ts'");
  });

  test("dispatches 'find'/'grep'/'ls' to formatSearchInputForPrompt", () => {
    for (const tool of ["find", "grep", "ls"]) {
      const result = formatToolInputForPrompt(tool, {});
      expect(result).toContain("current working directory");
    }
  });

  test("falls back to JSON preview for unknown tools", () => {
    mockedStringify.mockReturnValue('{"x":1}');
    const result = formatToolInputForPrompt("unknown", { x: 1 });
    expect(result).toContain('{"x":1}');
  });
});

describe("formatGenericToolInputForLog", () => {
  test("returns undefined when serialization yields empty string", () => {
    mockedStringify.mockReturnValue(undefined);
    expect(formatGenericToolInputForLog({})).toBeUndefined();
  });

  test("returns prefixed input preview", () => {
    mockedStringify.mockReturnValue('{"k":"v"}');
    expect(formatGenericToolInputForLog({ k: "v" })).toBe('input {"k":"v"}');
  });

  test("truncates to TOOL_INPUT_LOG_PREVIEW_MAX_LENGTH", () => {
    const longJson = `{"k":"${"x".repeat(2000)}"}`;
    mockedStringify.mockReturnValue(longJson);
    const result = formatGenericToolInputForLog({});
    expect(result).toBeDefined();
    // result is "input " + truncated, so total > TOOL_INPUT_LOG_PREVIEW_MAX_LENGTH by "input ".length
    const preview = result!.slice("input ".length);
    expect(preview.length).toBeLessThanOrEqual(
      TOOL_INPUT_LOG_PREVIEW_MAX_LENGTH + 1,
    );
  });
});

describe("getToolInputPreviewForLog", () => {
  const pathBearingTools = new Set(["read", "write", "edit"]);

  test("returns undefined for bash tool", () => {
    const result: PermissionCheckResult = {
      toolName: "bash",
      state: "allow",
      source: "tool",
    };
    expect(
      getToolInputPreviewForLog(result, { command: "ls" }, pathBearingTools),
    ).toBeUndefined();
  });

  test("returns undefined for mcp tool", () => {
    const result: PermissionCheckResult = {
      toolName: "mcp",
      state: "allow",
      source: "tool",
    };
    expect(
      getToolInputPreviewForLog(result, {}, pathBearingTools),
    ).toBeUndefined();
  });

  test("returns undefined for mcp source", () => {
    const result: PermissionCheckResult = {
      toolName: "some-server:some-tool",
      state: "allow",
      source: "mcp",
    };
    expect(
      getToolInputPreviewForLog(result, {}, pathBearingTools),
    ).toBeUndefined();
  });

  test("returns path-based preview for path-bearing tools", () => {
    const result: PermissionCheckResult = {
      toolName: "read",
      state: "allow",
      source: "tool",
    };
    const preview = getToolInputPreviewForLog(
      result,
      { path: "/src/foo.ts" },
      pathBearingTools,
    );
    expect(preview).toContain("/src/foo.ts");
  });

  test("returns generic JSON preview for non-path-bearing tools", () => {
    mockedStringify.mockReturnValue('{"n":1}');
    const result: PermissionCheckResult = {
      toolName: "task",
      state: "allow",
      source: "tool",
    };
    const preview = getToolInputPreviewForLog(
      result,
      { n: 1 },
      pathBearingTools,
    );
    expect(preview).toContain('{"n":1}');
  });
});

describe("getPermissionLogContext", () => {
  const pathBearingTools = new Set(["read", "write", "edit"]);

  test("returns command, target, and toolInputPreview", () => {
    const result: PermissionCheckResult = {
      toolName: "bash",
      state: "allow",
      source: "tool",
      command: "ls -la",
    };
    const ctx = getPermissionLogContext(result, {}, pathBearingTools);
    expect(ctx.command).toBe("ls -la");
    expect(ctx.target).toBeUndefined();
    expect(ctx.toolInputPreview).toBeUndefined();
  });

  test("includes toolInputPreview for non-bash path-bearing tools", () => {
    const result: PermissionCheckResult = {
      toolName: "read",
      state: "allow",
      source: "tool",
    };
    const ctx = getPermissionLogContext(
      result,
      { path: "/foo.ts" },
      pathBearingTools,
    );
    expect(ctx.toolInputPreview).toContain("/foo.ts");
  });
});
