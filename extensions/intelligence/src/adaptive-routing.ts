import type { EVEPluginApi } from "../api.js";
import type { IntelligenceServices } from "./services.js";
import type { EveRouteCandidate } from "./types.js";

function currentCandidate(model: string, provider: string): EveRouteCandidate {
  return {
    model,
    provider,
    tasks: ["general", "coding", "research", "creative", "operations", "analysis"],
  };
}

export function registerAdaptiveRouting(api: EVEPluginApi, services: IntelligenceServices): void {
  if (!services.routingOptions.enabled) {
    return;
  }
  api.on("before_model_resolve", async (event, ctx) => {
    const sessionKey = ctx.sessionKey?.trim();
    const currentModel = ctx.modelId?.trim();
    const currentProvider = ctx.modelProviderId?.trim();
    if (!sessionKey || !currentModel || !currentProvider) {
      return;
    }

    const session = api.runtime.agent.session.getSessionEntry({
      agentId: ctx.agentId,
      sessionKey,
    });
    // Route only before the first completed prompt in a session. Persisting the
    // selected model keeps provider schemas and prompt caches stable afterward.
    if (
      session?.systemSent === true ||
      session?.modelOverrideSource === "user" ||
      (session?.modelOverride && session.modelOverrideSource !== "auto")
    ) {
      return;
    }
    // The override must be durable before this turn uses it. A missing session
    // cannot carry the pin forward, which would let later turns change schema
    // or prompt-cache identity unexpectedly.
    if (!session) {
      return;
    }

    const candidates = services.routingOptions.candidates.filter(
      (candidate) => !candidate.provider || candidate.provider === currentProvider,
    );
    if (!candidates.some((candidate) => candidate.model === currentModel)) {
      candidates.push(currentCandidate(currentModel, currentProvider));
    }
    const decision = services.routing.recommend(event.prompt, candidates, {
      currentModel,
      currentProvider,
      experimentKey: sessionKey,
    });

    try {
      await api.runtime.agent.session.patchSessionEntry({
        agentId: ctx.agentId,
        sessionKey,
        update: (entry) => ({
          ...(decision.experiment
            ? {
                pluginExtensions: {
                  ...entry.pluginExtensions,
                  intelligence: {
                    ...entry.pluginExtensions?.intelligence,
                    experiment: decision.experiment,
                  },
                },
              }
            : {}),
          ...(decision.model !== currentModel && decision.provider === currentProvider
            ? { modelOverride: decision.model, modelOverrideSource: "auto" as const }
            : {}),
        }),
      });
    } catch (error) {
      api.logger.warn(`adaptive route persistence failed: ${String(error)}`);
      return;
    }
    if (decision.model !== currentModel && decision.provider === currentProvider) {
      return { modelOverride: decision.model };
    }
    return;
  });
}
