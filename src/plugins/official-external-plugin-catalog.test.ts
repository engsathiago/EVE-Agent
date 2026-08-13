import { describe, expect, it } from "vitest";
import {
  type OfficialExternalPluginCatalogEntry,
  getOfficialExternalPluginCatalogEntry,
  listOfficialExternalPluginCatalogEntries,
  resolveOfficialExternalProviderContractPluginIds,
  resolveOfficialExternalProviderPluginIds,
  resolveOfficialExternalProviderPluginIdsForEnv,
  resolveOfficialExternalWebProviderContractPluginIdsForEnv,
  resolveOfficialExternalPluginId,
  resolveOfficialExternalPluginInstall,
} from "./official-external-plugin-catalog.js";

function expectCatalogEntry(id: string): OfficialExternalPluginCatalogEntry {
  const entry = getOfficialExternalPluginCatalogEntry(id);
  if (entry === undefined) {
    throw new Error(`Expected external plugin catalog entry for ${id}`);
  }
  return entry;
}

describe("official external plugin catalog", () => {
  it("lists the externalized provider and capability plugins with install metadata", () => {
    const providers = [
      ["arcee", "@eve/arcee-provider"],
      ["cerebras", "@eve/cerebras-provider"],
      ["chutes", "@eve/chutes-provider"],
      ["cloudflare-ai-gateway", "@eve/cloudflare-ai-gateway-provider"],
      ["deepinfra", "@eve/deepinfra-provider"],
      ["deepseek", "@eve/deepseek-provider"],
      ["groq", "@eve/groq-provider"],
      ["kilocode", "@eve/kilocode-provider"],
      ["kimi", "@eve/kimi-provider"],
      ["qianfan", "@eve/qianfan-provider"],
      ["qwen", "@eve/qwen-provider"],
    ] as const;
    const plugins = [
      ["exa", "@eve/exa-plugin"],
      ["firecrawl", "@eve/firecrawl-plugin"],
      ["gradium", "@eve/gradium-speech"],
      ["inworld", "@eve/inworld-speech"],
      ["parallel", "@eve/parallel-plugin"],
      ["perplexity", "@eve/perplexity-plugin"],
    ] as const;

    for (const [id, npmSpec] of [...providers, ...plugins]) {
      expect(resolveOfficialExternalPluginInstall(expectCatalogEntry(id))).toEqual({
        clawhubSpec: `clawhub:${npmSpec}`,
        npmSpec,
        defaultChoice: "npm",
        minHostVersion: ">=2026.6.8",
      });
    }
  });

  it("keeps StepFun npm-only because its ClawHub package name is unavailable", () => {
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("stepfun"))).toEqual({
      npmSpec: "@eve/stepfun-provider",
      defaultChoice: "npm",
      minHostVersion: ">=2026.6.8",
    });
  });

  it("resolves third-party channel lookup aliases to published plugin ids", () => {
    const wecomByChannel = expectCatalogEntry("wecom");
    const wecomByPlugin = expectCatalogEntry("wecom-eve-plugin");
    const yuanbaoByChannel = expectCatalogEntry("yuanbao");

    expect(resolveOfficialExternalPluginId(wecomByChannel)).toBe("wecom-eve-plugin");
    expect(resolveOfficialExternalPluginId(wecomByPlugin)).toBe("wecom-eve-plugin");
    expect(resolveOfficialExternalPluginInstall(wecomByChannel)?.npmSpec).toBe(
      "@wecom/wecom-eve-plugin@2026.5.7",
    );
    expect(resolveOfficialExternalPluginId(yuanbaoByChannel)).toBe("eve-plugin-yuanbao");
    expect(resolveOfficialExternalPluginInstall(yuanbaoByChannel)?.npmSpec).toBe(
      "eve-plugin-yuanbao@2.13.1",
    );
  });

  it("keeps official launch package specs on the production package names", () => {
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("acpx"))?.npmSpec).toBe(
      "@eve/acpx",
    );
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("googlechat"))?.npmSpec).toBe(
      "@eve/googlechat",
    );
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("line"))?.npmSpec).toBe(
      "@eve/line",
    );
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("diffs-language-pack"))).toEqual(
      {
        npmSpec: "@eve/diffs-language-pack",
        clawhubSpec: "clawhub:@eve/diffs-language-pack",
        defaultChoice: "npm",
        minHostVersion: ">=2026.5.27",
      },
    );
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("llama-cpp"))?.npmSpec).toBe(
      "@eve/llama-cpp-provider",
    );
  });

  it("lists GMI Cloud as an official external provider", () => {
    const gmi = expectCatalogEntry("gmi");

    expect(resolveOfficialExternalPluginId(gmi)).toBe("gmi");
    expect(getOfficialExternalPluginCatalogEntry("gmi-cloud")).toBe(gmi);
    expect(resolveOfficialExternalPluginInstall(gmi)).toEqual({
      clawhubSpec: "clawhub:@eve/gmi-provider",
      npmSpec: "@eve/gmi-provider",
      defaultChoice: "npm",
      minHostVersion: ">=2026.6.8",
    });
  });

  it("lists Cohere as an official external provider", () => {
    const cohere = expectCatalogEntry("cohere");

    expect(resolveOfficialExternalPluginId(cohere)).toBe("cohere");
    expect(resolveOfficialExternalPluginInstall(cohere)).toEqual({
      clawhubSpec: "clawhub:@eve/cohere-provider",
      npmSpec: "@eve/cohere-provider",
      defaultChoice: "npm",
      minHostVersion: ">=2026.6.8",
    });
  });

  it("resolves external provider aliases beyond the primary provider id", () => {
    const qwen = expectCatalogEntry("qwen");

    expect(getOfficialExternalPluginCatalogEntry("modelstudio")).toBe(qwen);
    expect(getOfficialExternalPluginCatalogEntry("qwen-oauth")).toBe(qwen);
    expect(getOfficialExternalPluginCatalogEntry("qwen-portal")).toBe(qwen);
  });

  it("maps external speech and web-fetch contracts to plugin owners", () => {
    expect(
      resolveOfficialExternalProviderContractPluginIds({
        contract: "speechProviders",
        providerIds: new Set(["gradium", "inworld"]),
      }),
    ).toEqual(["gradium", "inworld"]);
    expect(
      resolveOfficialExternalProviderContractPluginIds({
        contract: "webFetchProviders",
        providerIds: new Set(["firecrawl"]),
      }),
    ).toEqual(["firecrawl"]);
    expect(
      resolveOfficialExternalProviderContractPluginIds({
        contract: "mediaUnderstandingProviders",
        providerIds: new Set(["groq"]),
      }),
    ).toEqual(["groq"]);
  });

  it("maps env-only web-fetch credentials to external plugin owners", () => {
    expect(
      resolveOfficialExternalWebProviderContractPluginIdsForEnv({
        contract: "webFetchProviders",
        env: { FIRECRAWL_API_KEY: "firecrawl-key" },
      }),
    ).toEqual(["firecrawl"]);
    expect(
      resolveOfficialExternalWebProviderContractPluginIdsForEnv({
        contract: "webFetchProviders",
        env: { EXA_API_KEY: "exa-key" },
      }),
    ).toEqual([]);
  });

  it("maps configured provider ids and aliases even without an auth choice", () => {
    expect(
      resolveOfficialExternalProviderPluginIds({
        providerIds: new Set(["groq", "modelstudio"]),
      }),
    ).toEqual(["groq", "qwen"]);
  });

  it("maps env-only provider credentials to external installs", () => {
    expect(
      resolveOfficialExternalProviderPluginIdsForEnv({
        ARCEEAI_API_KEY: "arcee-key",
        CEREBRAS_API_KEY: "cerebras-key",
        CHUTES_OAUTH_TOKEN: "chutes-token",
        CLOUDFLARE_AI_GATEWAY_API_KEY: "cloudflare-key",
        DEEPINFRA_API_KEY: "deepinfra-key",
        DEEPSEEK_API_KEY: "deepseek-key",
        GROQ_API_KEY: "groq-key",
        KILOCODE_API_KEY: "kilocode-key",
        KIMICODE_API_KEY: "kimi-key",
        QIANFAN_API_KEY: "qianfan-key",
        MODELSTUDIO_API_KEY: "qwen-key",
        STEPFUN_API_KEY: "stepfun-key",
      }),
    ).toEqual([
      "arcee",
      "cerebras",
      "chutes",
      "cloudflare-ai-gateway",
      "deepinfra",
      "deepseek",
      "groq",
      "kilocode",
      "kimi",
      "qianfan",
      "qwen",
      "stepfun",
    ]);
    expect(resolveOfficialExternalProviderPluginIdsForEnv({ GROQ_API_KEY: " " })).toEqual([]);
  });

  it("keeps Groq available through the cold-install auth catalog", () => {
    const groq = expectCatalogEntry("groq");
    const authChoice = groq.eve?.providers?.find((provider) => provider.id === "groq")
      ?.authChoices?.[0];

    expect(authChoice).toMatchObject({
      choiceId: "groq-api-key",
      optionKey: "groqApiKey",
      cliFlag: "--groq-api-key",
      cliOption: "--groq-api-key <key>",
    });
  });

  it("allows invalid-config recovery for externalized stock plugins", () => {
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("brave"))).toMatchObject({
      npmSpec: "@eve/brave-plugin",
      allowInvalidConfigRecovery: true,
    });
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("slack"))).toMatchObject({
      npmSpec: "@eve/slack",
      allowInvalidConfigRecovery: true,
    });
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("discord"))).toMatchObject({
      npmSpec: "@eve/discord",
      allowInvalidConfigRecovery: true,
    });
  });

  it("lists Matrix as an official external ClawHub channel after cutover", () => {
    const ids = new Set<string>();
    for (const entry of listOfficialExternalPluginCatalogEntries()) {
      const pluginId = resolveOfficialExternalPluginId(entry);
      if (pluginId) {
        ids.add(pluginId);
      }
    }

    expect(ids.has("matrix")).toBe(true);
    expect(ids.has("mattermost")).toBe(false);
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("matrix"))).toEqual({
      clawhubSpec: "clawhub:@eve/matrix",
      npmSpec: "@eve/matrix",
      defaultChoice: "clawhub",
      minHostVersion: ">=2026.4.10",
      allowInvalidConfigRecovery: true,
    });
  });
});
