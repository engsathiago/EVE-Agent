import { describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../../../runtime.js";
import { applyNonInteractiveGatewayConfig } from "./gateway-config.js";

function runtime(): RuntimeEnv {
  return { log: vi.fn(), error: vi.fn(), exit: vi.fn() };
}

describe("non-interactive custom Gateway binding", () => {
  it("rejects custom binding without an explicit host", () => {
    const env = runtime();
    expect(
      applyNonInteractiveGatewayConfig({
        nextConfig: {},
        opts: { gatewayBind: "custom" },
        runtime: env,
        defaultPort: 18_789,
      }),
    ).toBeNull();
    expect(env.error).toHaveBeenCalledWith(expect.stringContaining("gateway-custom-bind-host"));
    expect(env.exit).toHaveBeenCalledWith(1);
  });

  it("persists the supplied custom bind host", () => {
    const result = applyNonInteractiveGatewayConfig({
      nextConfig: {},
      opts: { gatewayBind: "custom", gatewayCustomBindHost: "10.0.0.5" },
      runtime: runtime(),
      defaultPort: 18_789,
    });
    expect(result?.nextConfig.gateway).toMatchObject({
      bind: "custom",
      customBindHost: "10.0.0.5",
    });
  });
});
