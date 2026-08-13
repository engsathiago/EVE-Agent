import { afterEach, describe, expect, it } from "vitest";
import { resolveMemoryFlushContextWindowTokens } from "../auto-reply/reply/memory-flush.js";
import type { EVEConfig } from "../config/types.eve.js";
import { refreshContextWindowCache, resetContextWindowCacheForTest } from "./context.js";

describe("OpenCode Go context metadata", () => {
  afterEach(() => {
    resetContextWindowCacheForTest();
  });

  it("warms the provider-owned context window without writing model config", async () => {
    const cfg: EVEConfig = {};

    await refreshContextWindowCache(cfg);

    expect(
      resolveMemoryFlushContextWindowTokens({
        cfg,
        provider: "opencode-go",
        modelId: "deepseek-v4-pro",
      }),
    ).toBe(1_000_000);
    expect(cfg.models).toBeUndefined();
  });
});
