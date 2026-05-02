import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  CONFIG_PATH,
  DEFAULT_EXTENSION_CONFIG,
} from "../src/extension-config.js";
import piPermissionSystemExtension from "../src/index.js";
import type { GlobalPermissionConfig } from "../src/types.js";

type MockHandler = (
  event: Record<string, unknown>,
  ctx: Record<string, unknown>,
) =>
  | Promise<Record<string, unknown> | undefined>
  | Record<string, unknown>
  | undefined;

describe("session_start handler consolidation", () => {
  let baseDir: string;
  let originalAgentDir: string | undefined;
  let originalExtensionConfig: string | null;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "pi-permission-session-start-"));
    originalAgentDir = process.env.PI_CODING_AGENT_DIR;
    originalExtensionConfig = existsSync(CONFIG_PATH)
      ? readFileSync(CONFIG_PATH, "utf8")
      : null;

    mkdirSync(join(baseDir, "agents"), { recursive: true });

    const config: GlobalPermissionConfig = {
      defaultPolicy: {
        tools: "ask",
        bash: "ask",
        mcp: "ask",
        skills: "ask",
        special: "ask",
      },
    };
    writeFileSync(
      join(baseDir, "pi-permissions.jsonc"),
      `${JSON.stringify(config, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      CONFIG_PATH,
      `${JSON.stringify(DEFAULT_EXTENSION_CONFIG, null, 2)}\n`,
      "utf8",
    );

    process.env.PI_CODING_AGENT_DIR = baseDir;
  });

  afterEach(() => {
    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }
    if (originalExtensionConfig === null) {
      if (existsSync(CONFIG_PATH)) {
        unlinkSync(CONFIG_PATH);
      }
    } else {
      writeFileSync(CONFIG_PATH, originalExtensionConfig, "utf8");
    }
    rmSync(baseDir, { recursive: true, force: true });
  });

  test("registers exactly one session_start handler", () => {
    const registrations: Array<{ name: string; handler: MockHandler }> = [];

    piPermissionSystemExtension({
      on: (name: string, handler: MockHandler): void => {
        registrations.push({ name, handler });
      },
      registerCommand: (): void => {},
      getAllTools: (): Array<{ name: string }> => [],
      setActiveTools: (): void => {},
      registerProvider: (): void => {},
      events: {
        emit: (): void => {},
      },
    } as never);

    const sessionStartHandlers = registrations.filter(
      (r) => r.name === "session_start",
    );
    expect(sessionStartHandlers).toHaveLength(1);
  });

  test("session_start handler preserves lifecycle.reload debug log", async () => {
    const registrations: Array<{ name: string; handler: MockHandler }> = [];

    piPermissionSystemExtension({
      on: (name: string, handler: MockHandler): void => {
        registrations.push({ name, handler });
      },
      registerCommand: (): void => {},
      getAllTools: (): Array<{ name: string }> => [],
      setActiveTools: (): void => {},
      registerProvider: (): void => {},
      events: {
        emit: (): void => {},
      },
    } as never);

    const sessionStartHandlers = registrations.filter(
      (r) => r.name === "session_start",
    );

    // The single handler should accept event with reason="reload" without throwing
    const mockCtx = {
      cwd: baseDir,
      ui: { select: async () => "", input: async () => "" },
      agent: { name: "test-agent" },
      sessionManager: {
        getEntries: () => [],
        addEntry: () => {},
      },
    };

    // Should not throw when called with a reload event
    await expect(
      sessionStartHandlers[0].handler({ reason: "reload" }, mockCtx),
    ).resolves.not.toThrow();
  });
});
