import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestPluginApi } from "eve-agent/plugin-sdk/plugin-test-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EVEPluginApi } from "../api.js";
import { registerAdaptiveRouting } from "./adaptive-routing.js";
import { createIntelligenceServices, type IntelligenceServices } from "./services.js";

const roots: string[] = [];
const servicesToClose: IntelligenceServices[] = [];

afterEach(() => {
  for (const services of servicesToClose.splice(0)) {
    services.close();
  }
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("EVE adaptive routing hook", () => {
  it("pins a same-provider canary model only for a new session", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eve-adaptive-routing-"));
    roots.push(root);
    const on = vi.fn();
    const patchSessionEntry = vi.fn(
      async (_params: {
        update: (entry: {
          sessionId: string;
          updatedAt: number;
        }) =>
          | { modelOverride?: string; modelOverrideSource?: string }
          | Promise<{ modelOverride?: string; modelOverrideSource?: string }>;
      }) => ({}),
    );
    let systemSent = false;
    const runtime = {
      agent: {
        session: {
          getSessionEntry: vi.fn(() => ({
            sessionId: "session-1",
            updatedAt: Date.now(),
            systemSent,
          })),
          patchSessionEntry,
        },
      },
      config: {},
    } as unknown as EVEPluginApi["runtime"];
    const api = createTestPluginApi({
      source: path.join(process.cwd(), "extensions", "intelligence", "index.ts"),
      rootDir: path.join(process.cwd(), "extensions", "intelligence"),
      pluginConfig: {
        adaptiveRoutingEnabled: true,
        adaptiveRoutingCandidates: [
          { model: "strong", provider: "openai", tasks: ["coding"] },
          { model: "remote", provider: "other", tasks: ["coding"] },
        ],
      },
      on,
      runtime,
    });
    const services = createIntelligenceServices(api, path.join(root, "operations.sqlite"));
    servicesToClose.push(services);
    const experiment = services.routing.createExperiment({
      name: "router-canary",
      kind: "model-routing",
      baseline: "weak",
      candidate: "strong",
      trafficPercent: 100,
    });
    services.routing.setExperimentStatus(experiment.id, "running");
    registerAdaptiveRouting(api, services);

    const registration = on.mock.calls.find((call) => call[0] === "before_model_resolve");
    expect(registration).toBeDefined();
    const handler = registration![1] as (
      event: { prompt: string },
      context: {
        agentId: string;
        sessionKey: string;
        sessionId: string;
        modelId: string;
        modelProviderId: string;
      },
    ) => Promise<{ modelOverride?: string } | undefined>;
    const context = {
      agentId: "main",
      sessionKey: "agent:main:test",
      sessionId: "session-1",
      modelId: "weak",
      modelProviderId: "openai",
    };
    await expect(handler({ prompt: "corrija este código" }, context)).resolves.toEqual({
      modelOverride: "strong",
    });
    expect(patchSessionEntry).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "main", sessionKey: "agent:main:test" }),
    );
    expect(
      await patchSessionEntry.mock.calls[0]![0].update({ sessionId: "session-1", updatedAt: 1 }),
    ).toMatchObject({ modelOverride: "strong", modelOverrideSource: "auto" });

    systemSent = true;
    await expect(handler({ prompt: "outra mensagem" }, context)).resolves.toBeUndefined();
    expect(patchSessionEntry).toHaveBeenCalledTimes(1);

    systemSent = false;
    patchSessionEntry.mockRejectedValueOnce(new Error("session store unavailable"));
    await expect(handler({ prompt: "corrija este código" }, context)).resolves.toBeUndefined();
    expect(patchSessionEntry).toHaveBeenCalledTimes(2);
  });

  it("registers no model hook until routing is explicitly enabled", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eve-adaptive-routing-off-"));
    roots.push(root);
    const on = vi.fn();
    const api = createTestPluginApi({ pluginConfig: {}, on });
    const services = createIntelligenceServices(api, path.join(root, "operations.sqlite"));
    servicesToClose.push(services);
    registerAdaptiveRouting(api, services);
    expect(on).not.toHaveBeenCalled();
  });
});
