import { afterEach, describe, expect, test, vi } from "vitest";

import { sanitizeAvailableToolsSection } from "../src/system-prompt-sanitizer.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// Helpers for building prompt sections.
function availableToolsSection(tools: string[]): string {
  return ["Available tools:", ...tools.map((t) => `- ${t}`)].join("\n");
}

function guidelinesSection(guidelines: string[]): string {
  return ["Guidelines:", ...guidelines.map((g) => `- ${g}`)].join("\n");
}

function prompt(...sections: string[]): string {
  return sections.join("\n\n");
}

describe("sanitizeAvailableToolsSection — Available tools section", () => {
  test("sets removed:true and strips the Available tools header", () => {
    const input = prompt(
      availableToolsSection(["bash", "read"]),
      "Other content",
    );
    const result = sanitizeAvailableToolsSection(input, ["bash", "read"]);
    expect(result.removed).toBe(true);
    expect(result.prompt).not.toContain("Available tools:");
  });

  // Bug #33: findSection extends to lines.length when no subsequent recognised
  // header follows, so content after the last section is silently deleted.
  test.fails("preserves content that follows the Available tools section (bug #33)", () => {
    const input = prompt(
      availableToolsSection(["bash", "read"]),
      "Other content",
    );
    const result = sanitizeAvailableToolsSection(input, ["bash", "read"]);
    expect(result.prompt).toContain("Other content");
  });

  test("removed flag is false when no Available tools section is present", () => {
    const input = "Just some instructions.\n\nNo tools section.";
    const result = sanitizeAvailableToolsSection(input, ["bash"]);
    expect(result.removed).toBe(false);
    expect(result.prompt).toBe(input);
  });

  test("removes only the tools section and leaves other sections intact", () => {
    const input = prompt(
      "Preamble text",
      availableToolsSection(["bash"]),
      guidelinesSection(["use bash for file operations like ls, rg, find"]),
    );
    const result = sanitizeAvailableToolsSection(input, ["bash"]);
    expect(result.prompt).not.toContain("Available tools:");
    expect(result.prompt).toContain("Guidelines:");
  });

  test("returns original prompt reference unchanged when nothing is removed", () => {
    const input = "No tools section here.";
    const result = sanitizeAvailableToolsSection(input, []);
    expect(result.prompt).toBe(input);
  });
});

describe("sanitizeAvailableToolsSection — Guidelines section", () => {
  test("removes bash guideline when bash is not in allowed tools", () => {
    const input = prompt(
      guidelinesSection(["use bash for file operations like ls, rg, find"]),
    );
    const result = sanitizeAvailableToolsSection(input, []);
    expect(result.removed).toBe(true);
    expect(result.prompt).not.toContain("use bash for file operations");
  });

  test("keeps bash guideline when bash is in allowed tools", () => {
    const input = prompt(
      guidelinesSection(["use bash for file operations like ls, rg, find"]),
    );
    const result = sanitizeAvailableToolsSection(input, ["bash"]);
    expect(result.removed).toBe(false);
    expect(result.prompt).toContain("use bash for file operations");
  });

  test("removes read guideline when read is not allowed", () => {
    const input = prompt(
      guidelinesSection(["use read to examine files instead of cat or sed."]),
    );
    const result = sanitizeAvailableToolsSection(input, []);
    expect(result.removed).toBe(true);
    expect(result.prompt).not.toContain("use read to examine files");
  });

  test("keeps read guideline when read is allowed", () => {
    const input = prompt(
      guidelinesSection(["use read to examine files instead of cat or sed."]),
    );
    const result = sanitizeAvailableToolsSection(input, ["read"]);
    expect(result.removed).toBe(false);
    expect(result.prompt).toContain("use read to examine files");
  });

  test("removes edit guideline when edit is not allowed", () => {
    const input = prompt(
      guidelinesSection([
        "use edit for precise changes (old text must match exactly)",
      ]),
    );
    const result = sanitizeAvailableToolsSection(input, []);
    expect(result.removed).toBe(true);
    expect(result.prompt).not.toContain("use edit for precise changes");
  });

  test("removes write guideline when write is not allowed", () => {
    const input = prompt(
      guidelinesSection(["use write only for new files or complete rewrites"]),
    );
    const result = sanitizeAvailableToolsSection(input, []);
    expect(result.removed).toBe(true);
    expect(result.prompt).not.toContain("use write only for new files");
  });

  test("removes entire Guidelines section when all bullets are filtered out", () => {
    const input = prompt(
      guidelinesSection([
        "use bash for file operations like ls, rg, find",
        "use write only for new files or complete rewrites",
      ]),
    );
    const result = sanitizeAvailableToolsSection(input, []);
    expect(result.removed).toBe(true);
    expect(result.prompt).not.toContain("Guidelines:");
  });

  test("preserves unrecognised guidelines regardless of allowed tools", () => {
    const input = prompt(
      guidelinesSection(["some custom guideline not in the rules"]),
    );
    const result = sanitizeAvailableToolsSection(input, []);
    expect(result.removed).toBe(false);
    expect(result.prompt).toContain("some custom guideline not in the rules");
  });

  test("handles both sections together: removes tools section and filters guidelines", () => {
    const input = prompt(
      availableToolsSection(["bash"]),
      guidelinesSection([
        "use bash for file operations like ls, rg, find",
        "use write only for new files or complete rewrites",
        "some custom guideline not in the rules",
      ]),
    );
    const result = sanitizeAvailableToolsSection(input, []);
    expect(result.removed).toBe(true);
    expect(result.prompt).not.toContain("Available tools:");
    expect(result.prompt).not.toContain("use bash for file operations");
    expect(result.prompt).not.toContain("use write only for new files");
    expect(result.prompt).toContain("some custom guideline not in the rules");
  });

  test("trims whitespace from allowed tool names", () => {
    const input = prompt(
      guidelinesSection(["use bash for file operations like ls, rg, find"]),
    );
    const result = sanitizeAvailableToolsSection(input, ["  bash  "]);
    expect(result.removed).toBe(false);
    expect(result.prompt).toContain("use bash for file operations");
  });
});

describe("sanitizeAvailableToolsSection — multi-section prompt", () => {
  test("collapses extra blank lines after removal", () => {
    const input = prompt(
      "Intro",
      availableToolsSection(["bash"]),
      guidelinesSection(["use bash for file operations like ls, rg, find"]),
      "Closing",
    );
    const result = sanitizeAvailableToolsSection(input, []);
    // No run of 3+ consecutive newlines
    expect(result.prompt).not.toMatch(/\n{3,}/);
  });
});
