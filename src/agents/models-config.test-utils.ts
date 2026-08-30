/**
 * Shared assertions helpers for models-config tests. These helpers read the
 * generated agent-local model snapshot through the same path setup uses.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { resolveDefaultAgentDir } from "./agent-scope.js";
import { listPluginModelCatalogFiles } from "./plugin-model-catalog.js";

/** Read and parse the generated `models.json` file for assertions. */
export async function readGeneratedModelsJson<T>(
  agentDir = resolveDefaultAgentDir({}),
): Promise<T> {
  const modelPath = path.join(agentDir, "models.json");
  const raw = await fs.readFile(modelPath, "utf8");
  return JSON.parse(raw) as T;
}

/** Read the effective provider map across models.json and generated plugin catalogs. */
export async function readGeneratedModelProviders<T>(
  agentDir = resolveDefaultAgentDir({}),
): Promise<Record<string, T>> {
  const root = await readGeneratedModelsJson<{ providers?: Record<string, T> }>(agentDir);
  const providers = { ...root.providers };
  for (const catalog of listPluginModelCatalogFiles(agentDir)) {
    const parsed = JSON.parse(await fs.readFile(catalog.path, "utf8")) as {
      providers?: Record<string, T>;
    };
    Object.assign(providers, parsed.providers ?? {});
  }
  return providers;
}
