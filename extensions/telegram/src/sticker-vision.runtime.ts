// Telegram plugin module implements sticker vision behavior.
import {
  findModelInCatalog,
  loadModelCatalog,
  modelSupportsVision,
  resolveDefaultModelForAgent,
} from "eve-agent/plugin-sdk/agent-runtime";
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";

export async function resolveStickerVisionSupportRuntime(params: {
  cfg: EVEConfig;
  agentId?: string;
}): Promise<boolean> {
  const catalog = await loadModelCatalog({ config: params.cfg });
  const defaultModel = resolveDefaultModelForAgent({
    cfg: params.cfg,
    agentId: params.agentId,
  });
  const entry = findModelInCatalog(catalog, defaultModel.provider, defaultModel.model);
  if (!entry) {
    return false;
  }
  return modelSupportsVision(entry);
}
