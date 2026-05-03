---
issue: 33
issue_title: "sanitizeAvailableToolsSection silently removes content after the last recognised section header"
---

# Fix `findSection` greedy end boundary

## Problem Statement

`findSection` in `src/system-prompt-sanitizer.ts` defaults `end` to `lines.length` when no subsequent top-level section header is found.
This means any content after the last recognised section — plain prose, custom instructions, trailing notes — is silently included in the section range and deleted by `removeLineSection`.

The bug is masked in production because the real Pi system prompt always places `Guidelines:` after `Available tools:`, so `end` is always updated before EOF.
Unit tests from #21 exposed the bug with a minimal prompt where `"Other content"` follows the tools section.

## Goals

- Make `findSection` stop at the end of the section's own content (header + bullet/indented lines), not at EOF.
- Preserve all content that follows the section being removed.
- Flip the existing `test.fails` test for bug #33 to a passing assertion.

## Non-Goals

- Refactoring `sanitizeGuidelinesSection` — it uses the same `findSection` but is always followed by another section in practice; any latent issue there is covered by the same fix.
- Changing the `isTopLevelSectionHeader` heuristic beyond what's needed to fix the boundary.
- Adding new config fields or schema changes.

## Background

### Relevant modules

|File|Role|
|----|-----|
|`src/system-prompt-sanitizer.ts`|Contains `findSection`, `removeLineSection`, `sanitizeAvailableToolsSection`, `sanitizeGuidelinesSection`|
|`tests/system-prompt-sanitizer.test.ts`|Existing tests including the `test.fails` for #33|

### Permission surface

None — this is a system-prompt sanitisation bug, not a permission-policy change.
However, the impact is security-adjacent: silently deleting post-section content could remove user-authored safety instructions from the system prompt.

## Design Overview

### Current behaviour

```typescript
let end = lines.length;           // greedy: eat to EOF
for (let index = start + 1; ...) {
  if (isTopLevelSectionHeader(lines[index])) {
    end = index;
    break;
  }
}
```

### Proposed change

Treat the section as the header line plus all contiguous "section body" lines that follow it.
A line is part of the section body if it is:

- blank, or
- a bullet (`- …`), or
- indented (starts with whitespace).

The first line that is non-blank, non-bullet, non-indented, and not a recognised section header marks the end of the section.
A recognised section header also ends the section (preserving existing behaviour).

```typescript
function isSectionBodyLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return true;       // blank
  if (trimmed.startsWith("- ")) return true;   // bullet
  if (line !== line.trimStart()) return true;   // indented
  return false;
}
```

Then `findSection` becomes:

```typescript
let end = start + 1;
for (let index = start + 1; index < lines.length; index += 1) {
  if (isTopLevelSectionHeader(lines[index])) {
    end = index;
    break;
  }
  if (!isSectionBodyLine(lines[index])) {
    end = index;
    break;
  }
  end = index + 1;
}
```

This ensures trailing blank lines between the section and the next non-section content are consumed by the section (avoiding stray blank lines after removal), while non-section prose is preserved.

### Edge cases

1. **Section at EOF with trailing blanks only** — `end` reaches `lines.length`, same as today; no content is lost because only blank lines follow.
2. **Section immediately followed by another header** — `isTopLevelSectionHeader` fires first, same as today.
3. **Section followed by non-bullet, non-indented prose** — new `isSectionBodyLine` check fires, `end` stops before the prose. This is the fix.
4. **Guidelines section** — same `findSection` is used, same fix applies.

## Module-Level Changes

### `src/system-prompt-sanitizer.ts`

- Add `isSectionBodyLine(line: string): boolean` helper.
- Update `findSection` loop to stop at non-body lines (see Design Overview).

### `tests/system-prompt-sanitizer.test.ts`

- Change `test.fails` for bug #33 to a regular `test`.
- Add new cases:
  - Content after `Guidelines:` section is preserved when Guidelines is the last section.
  - Content after both sections removed; trailing prose survives.
  - Section at EOF (no trailing content) still works.
  - Section followed by blank lines then prose — prose survives, extra blanks collapsed.

## TDD Order

1. **Red → green: flip the existing `test.fails` to `test` and verify it fails before the fix.**
   - Surface: `tests/system-prompt-sanitizer.test.ts` — the `test.fails` for bug #33.
   - Commit: `test: expect content after Available tools section to be preserved (#33)`

2. **Green: implement `isSectionBodyLine` and update `findSection`.**
   - Surface: `src/system-prompt-sanitizer.ts`.
   - The flipped test should now pass.
   - Commit: `fix: stop findSection at first non-body line instead of EOF (#33)`

3. **Add edge-case tests.**
   - Content after `Guidelines:` preserved.
   - Both sections removed, trailing prose survives.
   - Section at EOF with only trailing blanks.
   - Commit: `test: add edge cases for findSection boundary (#33)`

4. **Verify all existing tests still pass.**
   - `npm test` — no regressions.

## Risks and Mitigations

|Risk|Mitigation|
|----|----------|
|Could this silently weaken a permission?|No policy logic changes. The fix only affects system-prompt text manipulation. However, the bug itself weakens safety by silently removing user content; fixing it restores the intended behaviour.|
|`isSectionBodyLine` is too conservative and leaves bullet lines outside the section|The heuristic mirrors the existing section format (header + bullets). Tests explicitly cover bullet-only and mixed content.|
|`isSectionBodyLine` is too liberal and still eats non-section content|Non-blank, non-bullet, non-indented lines stop the scan. The reproducer from the issue (`"Other content"`) is the direct test.|
|Guidelines section has the same latent bug|Same `findSection` is used — the fix applies to both. Added edge-case test confirms.|

## Open Questions

None — the fix is well-scoped and the issue's proposed approach aligns with the design above.
