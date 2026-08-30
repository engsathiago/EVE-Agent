import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "eve-agent/plugin-sdk/state-paths";
import type { EVEPluginApi } from "../api.js";
import type { EveIntegrationItem, JsonObject } from "./types.js";

type Manifest = {
  id?: string;
  name?: string;
  description?: string;
  enabledByDefault?: boolean;
  channels?: string[];
  channelEnvVars?: Record<string, string[]>;
};

type PluginRecord = {
  manifest: Manifest;
  directory: string;
  version?: string;
  description?: string;
};

// Athena 0.4's reviewed optional MCP set is surfaced as discovery metadata.
// Installation remains owned by EVE's canonical `mcp.servers` manager.
const OPTIONAL_MCP_CATALOG = [
  {
    name: "blender",
    description: "Drive a live Blender session for modeling, scenes, and renders.",
    source: "https://github.com/ahujasid/blender-mcp",
    authType: "none",
    requiredEnv: [],
  },
  {
    name: "comfy-cloud",
    description: "Generate images, video, audio, and 3D through Comfy Cloud.",
    source: "https://docs.comfy.org/agent-tools/cloud",
    authType: "oauth",
    requiredEnv: [],
  },
  {
    name: "figma",
    description: "Use Figma design context, Code Connect, and canvas tools.",
    source: "https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/",
    authType: "oauth",
    requiredEnv: [],
  },
  {
    name: "linear",
    description: "Find, create, and update Linear issues, projects, and comments.",
    source: "https://linear.app/docs/mcp",
    authType: "oauth",
    requiredEnv: [],
  },
  {
    name: "n8n",
    description: "Manage and inspect n8n workflows through an MCP bridge.",
    source: "https://github.com/CyberSamuraiX/athena-n8n-mcp",
    authType: "api_key",
    requiredEnv: ["N8N_BASE_URL", "N8N_API_KEY"],
  },
  {
    name: "unreal-engine",
    description: "Drive Unreal Engine through its editor-hosted MCP server.",
    source: "https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor",
    authType: "none",
    requiredEnv: [],
  },
] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readJson(file: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function scanDirectory(directory: string): PluginRecord[] {
  const stat = fs.statSync(directory, { throwIfNoEntry: false });
  if (!stat?.isDirectory()) {
    return [];
  }
  const candidates = [directory];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      candidates.push(path.join(directory, entry.name));
    }
  }
  return candidates.flatMap((candidate) => {
    const manifest = readJson(path.join(candidate, "eve.plugin.json")) as Manifest | undefined;
    if (!manifest?.id) {
      return [];
    }
    const packageJson = readJson(path.join(candidate, "package.json"));
    return [
      {
        manifest,
        directory: candidate,
        version: typeof packageJson?.version === "string" ? packageJson.version : undefined,
        description:
          manifest.description ??
          (typeof packageJson?.description === "string" ? packageJson.description : undefined),
      },
    ];
  });
}

function isConfigured(value: unknown): boolean {
  if (value === true) {
    return true;
  }
  const config = record(value);
  return Object.keys(config).some((key) => key !== "enabled") || config.enabled === true;
}

function remoteDescription(url: string): string {
  try {
    return `Remote MCP server at ${new URL(url).host}`;
  } catch {
    return "Remote MCP server";
  }
}

export class IntegrationCatalog {
  constructor(
    private readonly api: EVEPluginApi,
    private readonly bundledRoot: string,
  ) {}

  list(): JsonObject {
    const pluginConfig = this.api.config.plugins;
    const roots = [
      this.bundledRoot,
      path.join(resolveStateDir(), "extensions"),
      ...(pluginConfig?.load?.paths ?? []).map((entry) => path.resolve(entry)),
    ];
    const plugins = new Map<string, PluginRecord>();
    for (const root of roots) {
      for (const entry of scanDirectory(root)) {
        plugins.set(entry.manifest.id!, entry);
      }
    }

    const allow = new Set(pluginConfig?.allow ?? []);
    const deny = new Set(pluginConfig?.deny ?? []);
    const hasAllowlist = allow.size > 0;
    const items: EveIntegrationItem[] = [];
    for (const [id, entry] of [...plugins].toSorted(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const configured = pluginConfig?.entries?.[id];
      const enabled =
        pluginConfig?.enabled !== false &&
        !deny.has(id) &&
        (!hasAllowlist || allow.has(id)) &&
        configured?.enabled !== false &&
        (configured?.enabled === true || entry.manifest.enabledByDefault === true || allow.has(id));
      items.push({
        id: `plugin:${id}`,
        kind: "plugin",
        name: entry.manifest.name || id,
        description: entry.description || "EVE extension",
        source: entry.directory.startsWith(this.bundledRoot) ? "EVE" : entry.directory,
        installed: true,
        enabled,
        authType: "setup",
        requiredEnv: [],
        ...(entry.version ? { version: entry.version } : {}),
      });
    }

    const channelConfig = record(this.api.config.channels);
    const seenChannels = new Set<string>();
    for (const [pluginId, entry] of plugins) {
      for (const channel of entry.manifest.channels ?? []) {
        if (seenChannels.has(channel)) {
          continue;
        }
        seenChannels.add(channel);
        const value = channelConfig[channel];
        const config = record(value);
        const requiredEnv = entry.manifest.channelEnvVars?.[channel] ?? [];
        const configured =
          isConfigured(value) || requiredEnv.some((name) => Boolean(process.env[name]));
        items.push({
          id: `channel:${channel}`,
          kind: "channel",
          name: channel,
          description: `${entry.manifest.name || pluginId} communication channel`,
          source: "EVE",
          installed: configured,
          enabled: configured && config.enabled !== false,
          authType: requiredEnv.length > 0 ? "credentials" : "setup",
          requiredEnv,
        });
      }
    }

    const configuredMcpServers = this.api.config.mcp?.servers ?? {};
    for (const catalogEntry of OPTIONAL_MCP_CATALOG) {
      if (catalogEntry.name in configuredMcpServers) {
        continue;
      }
      items.push({
        id: `mcp:${catalogEntry.name}`,
        kind: "mcp",
        name: catalogEntry.name,
        description: catalogEntry.description,
        source: catalogEntry.source,
        installed: false,
        enabled: false,
        authType: catalogEntry.authType,
        requiredEnv: [...catalogEntry.requiredEnv],
      });
    }

    for (const [name, value] of Object.entries(configuredMcpServers)) {
      const server = record(value);
      items.push({
        id: `mcp:${name}`,
        kind: "mcp",
        name,
        description:
          typeof server.url === "string"
            ? remoteDescription(server.url)
            : typeof server.command === "string"
              ? `Local MCP server (${path.basename(server.command)})`
              : "Configured MCP server",
        source: typeof server.url === "string" ? "remote" : "local",
        installed: true,
        enabled: server.enabled !== false,
        authType: server.auth === "oauth" ? "oauth" : "configured",
        requiredEnv: Object.keys(record(server.env)),
      });
    }

    items.sort(
      (left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name),
    );
    return {
      items,
      counts: {
        total: items.length,
        installed: items.filter((item) => item.installed).length,
        enabled: items.filter((item) => item.enabled).length,
        byKind: {
          mcp: items.filter((item) => item.kind === "mcp").length,
          plugin: items.filter((item) => item.kind === "plugin").length,
          channel: items.filter((item) => item.kind === "channel").length,
        },
      },
    };
  }
}
