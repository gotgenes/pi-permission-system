import { afterEach, describe, expect, test, vi } from "vitest";
import type { PermissionSystemExtensionConfig } from "../src/extension-config.js";
import {
  canResolveAskPermissionRequest,
  shouldAutoApprovePermissionState,
} from "../src/yolo-mode.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeConfig(
  yoloMode: boolean | undefined,
): PermissionSystemExtensionConfig {
  return { yoloMode } as PermissionSystemExtensionConfig;
}

describe("shouldAutoApprovePermissionState", () => {
  test("returns true for 'ask' when yolo mode is on", () => {
    expect(shouldAutoApprovePermissionState("ask", makeConfig(true))).toBe(
      true,
    );
  });

  test("returns false for 'ask' when yolo mode is off", () => {
    expect(shouldAutoApprovePermissionState("ask", makeConfig(false))).toBe(
      false,
    );
  });

  test("returns false for 'ask' when yolo mode is undefined", () => {
    expect(shouldAutoApprovePermissionState("ask", makeConfig(undefined))).toBe(
      false,
    );
  });

  test("returns false for 'allow' even when yolo mode is on", () => {
    expect(shouldAutoApprovePermissionState("allow", makeConfig(true))).toBe(
      false,
    );
  });

  test("returns false for 'deny' even when yolo mode is on", () => {
    expect(shouldAutoApprovePermissionState("deny", makeConfig(true))).toBe(
      false,
    );
  });
});

describe("canResolveAskPermissionRequest", () => {
  test("returns true when hasUI is true regardless of other flags", () => {
    expect(
      canResolveAskPermissionRequest({
        config: makeConfig(false),
        hasUI: true,
        isSubagent: false,
      }),
    ).toBe(true);
  });

  test("returns true when isSubagent is true regardless of other flags", () => {
    expect(
      canResolveAskPermissionRequest({
        config: makeConfig(false),
        hasUI: false,
        isSubagent: true,
      }),
    ).toBe(true);
  });

  test("returns true when yolo mode is on regardless of UI/subagent flags", () => {
    expect(
      canResolveAskPermissionRequest({
        config: makeConfig(true),
        hasUI: false,
        isSubagent: false,
      }),
    ).toBe(true);
  });

  test("returns false when no UI, not a subagent, and yolo mode is off", () => {
    expect(
      canResolveAskPermissionRequest({
        config: makeConfig(false),
        hasUI: false,
        isSubagent: false,
      }),
    ).toBe(false);
  });

  test("returns false when no UI, not a subagent, and yolo mode is undefined", () => {
    expect(
      canResolveAskPermissionRequest({
        config: makeConfig(undefined),
        hasUI: false,
        isSubagent: false,
      }),
    ).toBe(false);
  });

  test("returns true when all three conditions are true", () => {
    expect(
      canResolveAskPermissionRequest({
        config: makeConfig(true),
        hasUI: true,
        isSubagent: true,
      }),
    ).toBe(true);
  });
});
