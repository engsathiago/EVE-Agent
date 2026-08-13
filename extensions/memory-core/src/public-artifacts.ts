// Memory Core plugin module implements public artifacts behavior.
import {
  listMemoryHostPublicArtifacts,
  type MemoryPluginPublicArtifact,
} from "eve-agent/plugin-sdk/memory-host-core";
import type { EVEConfig } from "../api.js";

export async function listMemoryCorePublicArtifacts(params: {
  cfg: EVEConfig;
}): Promise<MemoryPluginPublicArtifact[]> {
  return await listMemoryHostPublicArtifacts(params);
}
