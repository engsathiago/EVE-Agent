// Plugin npm release tests validate plugin npm release artifacts.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bundledPluginFile, bundledPluginRoot } from "eve-agent/plugin-sdk/test-fixtures";
import { afterEach, describe, expect, it } from "vitest";
import { collectClawHubPublishablePluginPackages } from "../scripts/lib/plugin-clawhub-release.ts";
import {
  collectChangedExtensionIdsFromPaths,
  collectPluginReleaseVersionFloorErrors,
  collectPublishablePluginPackages,
  collectPublishablePluginPackageErrors,
  EVE_PLUGIN_NPM_REPOSITORY_URL,
  parsePluginReleaseArgs,
  parsePluginReleaseSelection,
  parsePluginReleaseSelectionMode,
  resolveChangedPublishablePluginPackages,
  resolveSelectedPublishablePluginPackages,
  type PublishablePluginPackage,
} from "../scripts/lib/plugin-npm-release.ts";
import { cleanupTempDirs, makeTempRepoRoot, writeJsonFile } from "./helpers/temp-repo.js";

const tempDirs: string[] = [];

afterEach(() => {
  cleanupTempDirs(tempDirs);
});

describe("parsePluginReleaseSelection", () => {
  it("returns an empty list for blank input", () => {
    expect(parsePluginReleaseSelection("")).toStrictEqual([]);
    expect(parsePluginReleaseSelection("   ")).toStrictEqual([]);
    expect(parsePluginReleaseSelection(undefined)).toStrictEqual([]);
  });

  it("dedupes and sorts comma or whitespace separated package names", () => {
    expect(
      parsePluginReleaseSelection(" @eve/zalo, @eve/feishu  @eve/zalo "),
    ).toEqual(["@eve/feishu", "@eve/zalo"]);
  });
});

describe("parsePluginReleaseSelectionMode", () => {
  it("accepts the supported explicit selection modes", () => {
    expect(parsePluginReleaseSelectionMode("selected")).toBe("selected");
    expect(parsePluginReleaseSelectionMode("all-publishable")).toBe("all-publishable");
  });

  it("rejects unsupported selection modes", () => {
    expect(() => parsePluginReleaseSelectionMode("all")).toThrowError(
      'Unknown selection mode: all. Expected "selected" or "all-publishable".',
    );
  });
});

describe("parsePluginReleaseArgs", () => {
  it("rejects blank explicit plugin selections", () => {
    expect(() => parsePluginReleaseArgs(["--plugins", "   "])).toThrowError(
      "`--plugins` must include at least one package name.",
    );
  });

  it("rejects flags where option values are required", () => {
    for (const { args, message } of [
      { args: ["--plugins", "--base-ref"], message: "--plugins requires a value." },
      {
        args: ["--selection-mode", "--plugins"],
        message: "--selection-mode requires a value.",
      },
      {
        args: ["--base-ref", "--head-ref", "main"],
        message: "--base-ref requires a value.",
      },
      {
        args: ["--head-ref", "--base-ref", "main"],
        message: "--head-ref requires a value.",
      },
    ]) {
      expect(() => parsePluginReleaseArgs(args)).toThrowError(message);
    }
  });

  it("requires plugin names for selected explicit publish mode", () => {
    expect(() => parsePluginReleaseArgs(["--selection-mode", "selected"])).toThrowError(
      "`--selection-mode selected` requires `--plugins`.",
    );
  });

  it("rejects plugin names when all-publishable mode is selected", () => {
    expect(() =>
      parsePluginReleaseArgs([
        "--selection-mode",
        "all-publishable",
        "--plugins",
        "@eve/zalo",
      ]),
    ).toThrowError("`--selection-mode all-publishable` must not be combined with `--plugins`.");
  });

  it("parses explicit all-publishable mode", () => {
    expect(parsePluginReleaseArgs(["--selection-mode", "all-publishable"])).toEqual({
      baseRef: undefined,
      headRef: undefined,
      selectionMode: "all-publishable",
      selection: [],
      pluginsFlagProvided: false,
    });
  });
});

function externalPluginContract(version: string) {
  return {
    compat: {
      pluginApi: `>=${version}`,
    },
    build: {
      eveVersion: version,
    },
  };
}

function writePluginReadme(repoDir: string, extensionId: string): void {
  const packageDir = join(repoDir, "extensions", extensionId);
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(join(packageDir, "README.md"), `# ${extensionId}\n`);
}

describe("collectPublishablePluginPackageErrors", () => {
  it("accepts a valid publishable plugin package candidate", () => {
    expect(
      collectPublishablePluginPackageErrors({
        extensionId: "zalo",
        packageDir: bundledPluginRoot("zalo"),
        readmeText: "# Zalo\n",
        packageJson: {
          name: "@eve/zalo",
          version: "2026.3.15",
          type: "module",
          repository: {
            type: "git",
            url: EVE_PLUGIN_NPM_REPOSITORY_URL,
          },
          eve: {
            extensions: ["./index.ts"],
            ...externalPluginContract("2026.3.15"),
            install: {
              npmSpec: "@eve/zalo",
            },
            release: {
              publishToNpm: true,
            },
          },
        },
      }),
    ).toStrictEqual([]);
  });

  it("flags invalid publishable plugin metadata", () => {
    expect(
      collectPublishablePluginPackageErrors({
        extensionId: "broken",
        packageDir: bundledPluginRoot("broken"),
        readmeText: "# Broken\n",
        packageJson: {
          name: "broken",
          version: "latest",
          private: true,
          eve: {
            extensions: [""],
            ...externalPluginContract("2026.3.15"),
            install: {
              npmSpec: "   ",
            },
            release: {
              publishToNpm: true,
            },
          },
        },
      }),
    ).toEqual([
      'package name must start with "@eve/"; found "broken".',
      "package.json private must not be true.",
      'package.json type must be "module" so built .js runtime entries load as ESM.',
      `package.json repository.url must be "${EVE_PLUGIN_NPM_REPOSITORY_URL}" so npm provenance can validate GitHub trusted publishing; found "<missing>".`,
      'package.json version must match YYYY.M.PATCH, YYYY.M.PATCH-N, YYYY.M.PATCH-alpha.N, or YYYY.M.PATCH-beta.N; found "latest".',
      "eve.extensions must contain only non-empty strings.",
      "eve.install.npmSpec must be a non-empty string for publishable plugins.",
    ]);
  });

  it("requires the GitHub repository URL npm provenance validates for trusted publishing", () => {
    expect(
      collectPublishablePluginPackageErrors({
        extensionId: "twitch",
        packageDir: bundledPluginRoot("twitch"),
        readmeText: "# Twitch\n",
        packageJson: {
          name: "@eve/twitch",
          version: "2026.5.1-beta.1",
          type: "module",
          eve: {
            extensions: ["./index.ts"],
            ...externalPluginContract("2026.5.1-beta.1"),
            install: {
              npmSpec: "@eve/twitch",
            },
            release: {
              publishToNpm: true,
            },
          },
        },
      }),
    ).toEqual([
      `package.json repository.url must be "${EVE_PLUGIN_NPM_REPOSITORY_URL}" so npm provenance can validate GitHub trusted publishing; found "<missing>".`,
    ]);
  });

  it("requires npm install metadata for publishable plugins", () => {
    expect(
      collectPublishablePluginPackageErrors({
        extensionId: "voice-call",
        packageDir: bundledPluginRoot("voice-call"),
        readmeText: "# Voice call\n",
        packageJson: {
          name: "@eve/voice-call",
          version: "2026.5.1-beta.1",
          type: "module",
          repository: {
            type: "git",
            url: EVE_PLUGIN_NPM_REPOSITORY_URL,
          },
          eve: {
            extensions: ["./index.ts"],
            ...externalPluginContract("2026.5.1-beta.1"),
            release: {
              publishToNpm: true,
            },
          },
        },
      }),
    ).toEqual(["eve.install.npmSpec must be a non-empty string for publishable plugins."]);
  });

  it("requires the external plugin package compatibility contract for npm publish", () => {
    expect(
      collectPublishablePluginPackageErrors({
        extensionId: "voice-call",
        packageDir: bundledPluginRoot("voice-call"),
        readmeText: "# Voice call\n",
        packageJson: {
          name: "@eve/voice-call",
          version: "2026.5.1-beta.1",
          type: "module",
          repository: {
            type: "git",
            url: EVE_PLUGIN_NPM_REPOSITORY_URL,
          },
          eve: {
            extensions: ["./index.ts"],
            install: {
              npmSpec: "@eve/voice-call",
            },
            release: {
              publishToNpm: true,
            },
          },
        },
      }),
    ).toEqual([
      "eve.compat.pluginApi is required for external code plugin packages.",
      "eve.build.eveVersion is required for external code plugin packages.",
    ]);
  });

  it("requires package documentation before publishing", () => {
    expect(
      collectPublishablePluginPackageErrors({
        extensionId: "zalo",
        packageDir: bundledPluginRoot("zalo"),
        readmeText: " \n",
        packageJson: {
          name: "@eve/zalo",
          version: "2026.3.15",
          type: "module",
          repository: {
            type: "git",
            url: EVE_PLUGIN_NPM_REPOSITORY_URL,
          },
          eve: {
            extensions: ["./index.ts"],
            ...externalPluginContract("2026.3.15"),
            install: {
              npmSpec: "@eve/zalo",
            },
            release: {
              publishToNpm: true,
            },
          },
        },
      }),
    ).toEqual(["README.md must exist and contain package documentation."]);
  });
});

describe("collectPluginReleaseVersionFloorErrors", () => {
  it("blocks selected plugin stable and beta releases below the June 2026 floor", () => {
    expect(
      collectPluginReleaseVersionFloorErrors([
        {
          packageName: "@eve/demo",
          version: "2026.6.4-beta.1",
        },
      ]),
    ).toEqual([
      '@eve/demo@2026.6.4-beta.1: June 2026 stable and beta release trains must use patch 5 or higher because 2026.6.5-beta.1 is already published; found "2026.6.4-beta.1".',
    ]);
  });

  it("allows alpha compatibility and patch-floor plugin releases", () => {
    expect(
      collectPluginReleaseVersionFloorErrors([
        {
          packageName: "@eve/demo",
          version: "2026.6.4-alpha.1",
        },
        {
          packageName: "@eve/demo",
          version: "2026.6.5-beta.2",
        },
      ]),
    ).toEqual([]);
  });
});

describe("collectPublishablePluginPackages", () => {
  it("keeps publishable plugin dist trees out of the core npm package unless bundled", () => {
    const corePackageRuntimePluginIds = new Set(["discord"]);
    const rootPackage = JSON.parse(readFileSync("package.json", "utf8")) as {
      files?: unknown;
    };
    const packageFiles = new Set(Array.isArray(rootPackage.files) ? rootPackage.files : []);
    const publishablePlugins = [
      ...collectPublishablePluginPackages(),
      ...collectClawHubPublishablePluginPackages(),
    ];
    for (const plugin of publishablePlugins) {
      const packageJson = JSON.parse(
        readFileSync(join(plugin.packageDir, "package.json"), "utf8"),
      ) as {
        eve?: {
          build?: {
            bundledDist?: unknown;
          };
        };
      };
      if (packageJson.eve?.build?.bundledDist === true) {
        corePackageRuntimePluginIds.add(plugin.extensionId);
      }
    }
    const missingExclusions = Array.from(
      new Set(
        publishablePlugins
          .filter((plugin) => !corePackageRuntimePluginIds.has(plugin.extensionId))
          .map((plugin) => `!dist/extensions/${plugin.extensionId}/**`),
      ),
    ).filter((entry) => !packageFiles.has(entry));

    expect(missingExclusions).toStrictEqual([]);
  });

  it("collects publishable npm plugins from extension package manifests", () => {
    const repoDir = makeTempRepoRoot(tempDirs, "eve-plugin-npm-release-");
    mkdirSync(join(repoDir, "extensions", "demo-plugin"), { recursive: true });
    writePluginReadme(repoDir, "demo-plugin");
    writeJsonFile(join(repoDir, "extensions", "demo-plugin", "package.json"), {
      name: "@eve/demo-plugin",
      version: "2026.4.10",
      type: "module",
      repository: {
        type: "git",
        url: EVE_PLUGIN_NPM_REPOSITORY_URL,
      },
      eve: {
        extensions: ["./index.ts"],
        ...externalPluginContract("2026.4.10"),
        install: {
          npmSpec: "@eve/demo-plugin",
        },
        release: {
          publishToNpm: true,
        },
      },
    });

    expect(collectPublishablePluginPackages(repoDir)).toEqual([
      {
        extensionId: "demo-plugin",
        packageDir: "extensions/demo-plugin",
        packageName: "@eve/demo-plugin",
        version: "2026.4.10",
        channel: "stable",
        publishTag: "latest",
        installNpmSpec: "@eve/demo-plugin",
      },
    ]);
  });

  it("does not validate unselected publishable plugin manifests", () => {
    const repoDir = makeTempRepoRoot(tempDirs, "eve-plugin-npm-release-");
    mkdirSync(join(repoDir, "extensions", "demo-plugin"), { recursive: true });
    writePluginReadme(repoDir, "demo-plugin");
    writeJsonFile(join(repoDir, "extensions", "demo-plugin", "package.json"), {
      name: "@eve/demo-plugin",
      version: "2026.4.10-beta.1",
      type: "module",
      repository: {
        type: "git",
        url: EVE_PLUGIN_NPM_REPOSITORY_URL,
      },
      eve: {
        extensions: ["./index.ts"],
        ...externalPluginContract("2026.4.10-beta.1"),
        install: {
          npmSpec: "@eve/demo-plugin",
        },
        release: {
          publishToNpm: true,
        },
      },
    });
    mkdirSync(join(repoDir, "extensions", "private-plugin"), { recursive: true });
    writeJsonFile(join(repoDir, "extensions", "private-plugin", "package.json"), {
      name: "@eve/private-plugin",
      version: "2026.4.10-beta.1",
      private: true,
      eve: {
        extensions: ["./index.ts"],
        ...externalPluginContract("2026.4.10-beta.1"),
        install: {
          npmSpec: "@eve/private-plugin",
        },
        release: {
          publishToNpm: true,
        },
      },
    });

    expect(
      collectPublishablePluginPackages(repoDir, {
        packageNames: ["@eve/demo-plugin"],
      }),
    ).toEqual([
      {
        extensionId: "demo-plugin",
        packageDir: "extensions/demo-plugin",
        installNpmSpec: "@eve/demo-plugin",
        channel: "beta",
        packageName: "@eve/demo-plugin",
        publishTag: "beta",
        version: "2026.4.10-beta.1",
      },
    ]);
  });

  it("treats an explicit empty extension filter as no candidates", () => {
    const repoDir = makeTempRepoRoot(tempDirs, "eve-plugin-npm-release-");
    mkdirSync(join(repoDir, "extensions", "private-plugin"), { recursive: true });
    writeJsonFile(join(repoDir, "extensions", "private-plugin", "package.json"), {
      name: "@eve/private-plugin",
      version: "2026.4.10-beta.1",
      private: true,
      eve: {
        extensions: ["./index.ts"],
        ...externalPluginContract("2026.4.10-beta.1"),
        release: {
          publishToNpm: true,
        },
      },
    });

    expect(
      collectPublishablePluginPackages(repoDir, {
        extensionIds: [],
      }),
    ).toStrictEqual([]);
  });

  it("publishes alpha plugin packages to the alpha dist-tag", () => {
    const repoDir = makeTempRepoRoot(tempDirs, "eve-plugin-npm-release-");
    mkdirSync(join(repoDir, "extensions", "demo-plugin"), { recursive: true });
    writePluginReadme(repoDir, "demo-plugin");
    writeJsonFile(join(repoDir, "extensions", "demo-plugin", "package.json"), {
      name: "@eve/demo-plugin",
      version: "2026.4.10-alpha.1",
      type: "module",
      repository: {
        type: "git",
        url: EVE_PLUGIN_NPM_REPOSITORY_URL,
      },
      eve: {
        extensions: ["./index.ts"],
        ...externalPluginContract("2026.4.10-alpha.1"),
        install: {
          npmSpec: "@eve/demo-plugin",
        },
        release: {
          publishToNpm: true,
        },
      },
    });

    expect(collectPublishablePluginPackages(repoDir)).toEqual([
      {
        extensionId: "demo-plugin",
        packageDir: "extensions/demo-plugin",
        installNpmSpec: "@eve/demo-plugin",
        packageName: "@eve/demo-plugin",
        channel: "alpha",
        publishTag: "alpha",
        version: "2026.4.10-alpha.1",
      },
    ]);
  });
});

describe("resolveSelectedPublishablePluginPackages", () => {
  const publishablePlugins: PublishablePluginPackage[] = [
    {
      extensionId: "feishu",
      packageDir: bundledPluginRoot("feishu"),
      packageName: "@eve/feishu",
      version: "2026.3.15",
      channel: "stable",
      publishTag: "latest",
    },
    {
      extensionId: "zalo",
      packageDir: bundledPluginRoot("zalo"),
      packageName: "@eve/zalo",
      version: "2026.3.15-beta.1",
      channel: "beta",
      publishTag: "beta",
    },
  ];

  it("returns all publishable plugins when no selection is provided", () => {
    expect(
      resolveSelectedPublishablePluginPackages({
        plugins: publishablePlugins,
        selection: [],
      }),
    ).toEqual(publishablePlugins);
  });

  it("filters by selected publishable package names", () => {
    expect(
      resolveSelectedPublishablePluginPackages({
        plugins: publishablePlugins,
        selection: ["@eve/zalo"],
      }),
    ).toEqual([publishablePlugins[1]]);
  });

  it("throws when the selection contains an unknown package name", () => {
    expect(() =>
      resolveSelectedPublishablePluginPackages({
        plugins: publishablePlugins,
        selection: ["@eve/missing"],
      }),
    ).toThrowError("Unknown or non-publishable plugin package selection: @eve/missing.");
  });
});

describe("collectChangedExtensionIdsFromPaths", () => {
  it("extracts unique extension ids from changed extension paths", () => {
    expect(
      collectChangedExtensionIdsFromPaths([
        bundledPluginFile("zalo", "index.ts"),
        bundledPluginFile("zalo", "package.json"),
        bundledPluginFile("feishu", "src/client.ts"),
        "docs/reference/RELEASING.md",
      ]),
    ).toEqual(["feishu", "zalo"]);
  });
});

describe("resolveChangedPublishablePluginPackages", () => {
  const publishablePlugins: PublishablePluginPackage[] = [
    {
      extensionId: "feishu",
      packageDir: bundledPluginRoot("feishu"),
      packageName: "@eve/feishu",
      version: "2026.3.15",
      channel: "stable",
      publishTag: "latest",
    },
    {
      extensionId: "zalo",
      packageDir: bundledPluginRoot("zalo"),
      packageName: "@eve/zalo",
      version: "2026.3.15-beta.1",
      channel: "beta",
      publishTag: "beta",
    },
  ];

  it("returns only changed publishable plugins", () => {
    expect(
      resolveChangedPublishablePluginPackages({
        plugins: publishablePlugins,
        changedExtensionIds: ["zalo"],
      }),
    ).toEqual([publishablePlugins[1]]);
  });

  it("returns an empty list when no publishable plugins changed", () => {
    expect(
      resolveChangedPublishablePluginPackages({
        plugins: publishablePlugins,
        changedExtensionIds: [],
      }),
    ).toStrictEqual([]);
  });
});
