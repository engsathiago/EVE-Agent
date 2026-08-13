// Migrate Hermes provider module implements model/runtime integration.
import fs from "node:fs/promises";
import path from "node:path";
import type { MigrationProviderContext } from "eve-agent/plugin-sdk/plugin-entry";
import type { EVEConfig } from "eve-agent/plugin-sdk/provider-auth";
import { resolvePreferredEVETmpDir } from "eve-agent/plugin-sdk/temp-path";

const tempRoots = new Set<string>();
const TEMP_ROOT_PREFIX = "eve-migrate-hermes-";

function noop() {}

const logger: MigrationProviderContext["logger"] = {
  debug: noop,
  error: noop,
  info: noop,
  warn: noop,
};

export async function makeTempRoot() {
  const root = await fs.mkdtemp(path.join(resolvePreferredEVETmpDir(), TEMP_ROOT_PREFIX));
  tempRoots.add(root);
  return root;
}

export async function cleanupTempRoots() {
  await Promise.all([...tempRoots].map((root) => fs.rm(root, { force: true, recursive: true })));
  tempRoots.clear();
}

export async function writeFile(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

export function makeConfigRuntime(
  config: EVEConfig,
  onWrite?: (next: EVEConfig) => void,
): NonNullable<MigrationProviderContext["runtime"]> {
  const commitConfig = (next: EVEConfig) => {
    (Object.keys(config) as Array<keyof EVEConfig>).forEach((key) => delete config[key]);
    Object.assign(config, next);
    onWrite?.(next);
  };

  return {
    config: {
      current: () => config,
      mutateConfigFile: async ({
        afterWrite,
        mutate,
      }: {
        afterWrite?: unknown;
        mutate: (draft: EVEConfig, context: unknown) => Promise<unknown> | void;
      }) => {
        const next = structuredClone(config);
        const result = await mutate(next, {
          previousHash: null,
          persistedHash: null,
          snapshot: { config, raw: "", hash: null },
        });
        commitConfig(next);
        return {
          afterWrite,
          followUp: { mode: "auto", requiresRestart: false },
          nextConfig: next,
          result,
        };
      },
      replaceConfigFile: async ({
        afterWrite,
        nextConfig,
      }: {
        afterWrite?: unknown;
        nextConfig: EVEConfig;
      }) => {
        commitConfig(nextConfig);
        return { afterWrite, followUp: { mode: "auto", requiresRestart: false }, nextConfig };
      },
    },
  } as NonNullable<MigrationProviderContext["runtime"]>;
}

export function makeContext(params: {
  source: string;
  stateDir: string;
  workspaceDir: string;
  config?: EVEConfig;
  includeSecrets?: boolean;
  overwrite?: boolean;
  model?: NonNullable<NonNullable<EVEConfig["agents"]>["defaults"]>["model"];
  reportDir?: string;
  runtime?: MigrationProviderContext["runtime"];
}): MigrationProviderContext {
  const config =
    params.config ??
    ({
      agents: {
        defaults: {
          workspace: params.workspaceDir,
          ...(params.model !== undefined ? { model: params.model } : {}),
        },
      },
    } as EVEConfig);
  return {
    config,
    stateDir: params.stateDir,
    source: params.source,
    includeSecrets: params.includeSecrets,
    overwrite: params.overwrite,
    reportDir: params.reportDir,
    runtime: params.runtime,
    logger,
  };
}
