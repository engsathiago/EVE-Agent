/**
 * Gateway tool-resolution exclusion tests.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EVEConfig } from "../config/types.eve.js";

type CreateEVEToolsArg = {
  cronCreatorToolAllowlist?: Array<string | { name: string; pluginId?: string }>;
  inheritedToolDenylist?: string[];
  pluginToolDenylist?: string[];
};

const hoisted = vi.hoisted(() => {
  function makeTool(name: string) {
    return {
      name,
      description: `${name} tool`,
      parameters: { type: "object", properties: {} },
      execute: vi.fn(),
    };
  }
  return {
    makeTool,
    createEVEToolsMock: vi.fn((_args: CreateEVEToolsArg) => [
      makeTool("read"),
      makeTool("sessions_spawn"),
      makeTool("cron"),
      makeTool("gateway"),
      makeTool("nodes"),
    ]),
  };
});

vi.mock("../agents/eve-tools.js", () => ({
  createEVETools: (args: CreateEVEToolsArg) => hoisted.createEVEToolsMock(args),
}));

import { resolveGatewayScopedTools } from "./tool-resolution.js";

describe("resolveGatewayScopedTools excludeToolNames", () => {
  beforeEach(() => {
    hoisted.createEVEToolsMock.mockClear();
  });

  function readCreateToolsArgs(): {
    cronCreatorToolAllowlist?: Array<string | { name: string; pluginId?: string }>;
    inheritedToolDenylist?: string[];
    pluginToolDenylist?: string[];
  } {
    const args = hoisted.createEVEToolsMock.mock.calls[0]?.[0];
    if (!args || typeof args !== "object") {
      throw new Error("expected createEVETools args");
    }
    return args as {
      cronCreatorToolAllowlist?: Array<string | { name: string; pluginId?: string }>;
      inheritedToolDenylist?: string[];
      pluginToolDenylist?: string[];
    };
  }

  it("filters loopback dedup exclusions without inheriting policy denies", () => {
    const result = resolveGatewayScopedTools({
      cfg: {} as EVEConfig,
      sessionKey: "agent:main:direct:test",
      surface: "loopback",
      excludeToolNames: ["read", "apply_patch"],
    });

    expect(result.tools.map((tool) => tool.name)).toEqual([
      "sessions_spawn",
      "cron",
      "gateway",
      "nodes",
    ]);
    const args = readCreateToolsArgs();
    expect(args.pluginToolDenylist).toEqual([]);
    expect(args.inheritedToolDenylist).toEqual([]);
  });

  it("filters owner-only core tools from non-owner loopback callers", () => {
    const result = resolveGatewayScopedTools({
      cfg: {
        gateway: { tools: { allow: ["gateway"] } },
      } as EVEConfig,
      sessionKey: "agent:main:direct:test",
      surface: "loopback",
      senderIsOwner: false,
    });

    expect(result.tools.map((tool) => tool.name)).toEqual(["read", "sessions_spawn"]);
    const args = readCreateToolsArgs();
    expect(args.pluginToolDenylist).toEqual(["cron", "gateway", "nodes"]);
    expect(args.inheritedToolDenylist).toEqual(["cron", "gateway", "nodes"]);
  });

  it("keeps real gateway deny policy inheritable while excluding native dedup tools", () => {
    resolveGatewayScopedTools({
      cfg: {
        gateway: { tools: { deny: ["exec"] } },
      } as EVEConfig,
      sessionKey: "agent:main:direct:test",
      surface: "loopback",
      excludeToolNames: ["read", "apply_patch"],
    });

    const args = readCreateToolsArgs();
    expect(args.pluginToolDenylist).toEqual(["exec"]);
    expect(args.inheritedToolDenylist).toEqual(["exec"]);
  });

  it("passes final filtered tool surface to gateway cron jobs", () => {
    hoisted.createEVEToolsMock.mockReturnValueOnce([
      hoisted.makeTool("read"),
      hoisted.makeTool("cron"),
      hoisted.makeTool("exec"),
    ]);

    const result = resolveGatewayScopedTools({
      cfg: {
        tools: { allow: ["read", "cron"] },
      } as EVEConfig,
      sessionKey: "agent:main:direct:test",
      surface: "loopback",
    });

    expect(result.tools.map((tool) => tool.name)).toEqual(["read", "cron"]);
    expect(readCreateToolsArgs().cronCreatorToolAllowlist).toEqual([
      { name: "read" },
      { name: "cron" },
    ]);
  });
});
