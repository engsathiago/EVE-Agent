// Migrate Claude provider module implements model/runtime integration.
import fs from "node:fs/promises";
import path from "node:path";
import type { MigrationProviderContext } from "eve-agent/plugin-sdk/plugin-entry";
import type { EVEConfig } from "eve-agent/plugin-sdk/provider-auth";
import { resolvePreferredEVETmpDir } from "eve-agent/plugin-sdk/temp-path";

const tempRoots = new Set<string>();

const logger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

export async function makeTempRoot() {
  const root = await fs.mkdtemp(path.join(resolvePreferredEVETmpDir(), "eve-migrate-claude-"));
  tempRoots.add(root);
  return root;
}

export async function cleanupTempRoots() {
  for (const root of tempRoots) {
    await fs.rm(root, { force: true, recursive: true });
  }
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
    for (const key of Object.keys(config) as Array<keyof EVEConfig>) {
      delete config[key];
    }
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
          snapshot: {
            path: "/tmp/eve.json",
            exists: true,
            raw: "{}",
            parsed: {},
            valid: true,
            issues: [],
            warnings: [],
            legacyIssues: [],
            config: next,
            resolved: next,
            runtimeConfig: next,
            sourceConfig: next,
          },
          previousHash: "test",
        });
        commitConfig(next);
        return {
          nextConfig: next,
          afterWrite,
          followUp: { mode: "auto", requiresRestart: false },
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
        return {
          nextConfig,
          afterWrite,
          followUp: { mode: "auto", requiresRestart: false },
        };
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
  reportDir?: string;
  runtime?: MigrationProviderContext["runtime"];
}): MigrationProviderContext {
  const config =
    params.config ??
    ({
      agents: {
        defaults: {
          workspace: params.workspaceDir,
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
