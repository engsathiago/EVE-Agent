/**
 * Tests agent directory compatibility helpers.
 */
import { describe, expect, it } from "vitest";
import { resolveEVEAgentDir } from "./agent-dir-compat.js";

describe("resolveEVEAgentDir", () => {
  it("keeps the shipped Pi env alias for deprecated plugin SDK callers", () => {
    expect(
      resolveEVEAgentDir({
        PI_CODING_AGENT_DIR: "/tmp/eve-legacy-agent",
      }),
    ).toBe("/tmp/eve-legacy-agent");
  });

  it("prefers the EVE env override over the deprecated Pi alias", () => {
    expect(
      resolveEVEAgentDir({
        EVE_AGENT_DIR: "/tmp/eve-agent",
        PI_CODING_AGENT_DIR: "/tmp/eve-legacy-agent",
      }),
    ).toBe("/tmp/eve-agent");
  });
});
