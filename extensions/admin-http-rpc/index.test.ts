// Admin Http Rpc tests cover index plugin behavior.
import { describe, expect, it } from "vitest";
import manifest from "./eve.plugin.json" with { type: "json" };
import plugin from "./index.js";

describe("admin-http-rpc plugin entry", () => {
  it("stays startup-off until the plugin entry is explicitly enabled", () => {
    expect(manifest.activation).toEqual({
      onStartup: false,
      onConfigPaths: ["plugins.entries.admin-http-rpc"],
    });
    expect(manifest.contracts).toEqual({
      gatewayMethodDispatch: ["authenticated-request"],
    });
  });

  it("registers one trusted gateway HTTP route", () => {
    const routes: Array<Record<string, unknown>> = [];
    plugin.register({
      registerHttpRoute(route) {
        routes.push(route as unknown as Record<string, unknown>);
      },
    } as Parameters<typeof plugin.register>[0]);

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      path: "/api/v1/admin/rpc",
      auth: "gateway",
      match: "exact",
      gatewayRuntimeScopeSurface: "trusted-operator",
    });
  });
});
