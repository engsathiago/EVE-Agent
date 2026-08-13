// Onboard config tests cover workspace, bootstrap, and local setup config mutations.
import { describe, expect, it } from "vitest";
import type { EVEConfig } from "../config/config.js";
import { applyLocalSetupWorkspaceConfig } from "./onboard-config.js";

describe("applyLocalSetupWorkspaceConfig", () => {
  it("sets secure dmScope default when unset", () => {
    const baseConfig: EVEConfig = {};
    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.session?.dmScope).toBe("per-channel-peer");
    expect(result.gateway?.mode).toBe("local");
    expect(result.agents?.defaults?.workspace).toBe("/tmp/workspace");
    expect(result.tools?.profile).toBe("coding");
  });

  it("preserves existing dmScope when already configured", () => {
    const baseConfig: EVEConfig = {
      session: {
        dmScope: "main",
      },
    };
    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.session?.dmScope).toBe("main");
  });

  it("preserves explicit non-main dmScope values", () => {
    const baseConfig: EVEConfig = {
      session: {
        dmScope: "per-account-channel-peer",
      },
    };
    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.session?.dmScope).toBe("per-account-channel-peer");
  });

  it("preserves an explicit tools.profile when already configured", () => {
    const baseConfig: EVEConfig = {
      tools: {
        profile: "full",
      },
    };
    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.tools?.profile).toBe("full");
  });

  it("preserves agents.list and bindings on onboard rerun (eve#84692)", () => {
    const baseConfig: EVEConfig = {
      agents: {
        list: [
          { id: "alpha", model: "anthropic/claude-3-5-sonnet" },
          { id: "beta", model: "openai/gpt-4o" },
        ],
      },
      bindings: [
        {
          type: "route",
          agentId: "alpha",
          match: { channel: "discord", peer: { kind: "direct", id: "user-1" } },
        },
      ],
    } as EVEConfig;

    const result = applyLocalSetupWorkspaceConfig(baseConfig, "/tmp/workspace");

    expect(result.agents?.list).toHaveLength(2);
    expect(result.agents?.list?.map((a) => a.id)).toEqual(["alpha", "beta"]);
    expect(result.bindings).toEqual(baseConfig.bindings);
  });
});
