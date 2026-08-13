// Extension Package Boundary script supports EVE repository automation.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import { privateLocalOnlyPluginSdkEntrypoints } from "./plugin-sdk-entries.mjs";

export const EXTENSION_PACKAGE_BOUNDARY_INCLUDE = ["./*.ts", "./src/**/*.ts"] as const;
export const EXTENSION_PACKAGE_BOUNDARY_EXCLUDE = [
  "./**/*.test.ts",
  "./dist/**",
  "./node_modules/**",
  "./src/test-support/**",
  "./src/**/*test-helpers.ts",
  "./src/**/*test-harness.ts",
  "./src/**/*test-support.ts",
] as const;

const privateLocalOnlyPluginSdkPackageDtsPaths = Object.fromEntries(
  privateLocalOnlyPluginSdkEntrypoints.map((entrypoint) => [
    `eve-agent/plugin-sdk/${entrypoint}`,
    [`../packages/plugin-sdk/dist/src/plugin-sdk/${entrypoint}.d.ts`],
  ]),
) as Record<string, readonly string[]>;

function buildPackageBoundaryDtsPaths(params: {
  packageName: string;
  packageDir: string;
}): Record<string, readonly string[]> {
  const packageJson = JSON.parse(
    readFileSync(join("packages", params.packageDir, "package.json"), "utf8"),
  ) as { exports?: Record<string, unknown> };
  return Object.fromEntries(
    Object.entries(packageJson.exports ?? {}).flatMap(([exportKey, value]) => {
      const subpath =
        exportKey === "." ? "" : exportKey.startsWith("./") ? exportKey.slice(2) : null;
      const importPath =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>).import
          : value;
      if (subpath === null || subpath.includes("..") || typeof importPath !== "string") {
        return [];
      }
      if (!importPath.startsWith("./dist/") || !importPath.endsWith(".mjs")) {
        return [];
      }
      const specifier = subpath ? `${params.packageName}/${subpath}` : params.packageName;
      return [
        [
          specifier,
          [`../dist/plugin-sdk/packages/${params.packageDir}/src/${subpath || "index"}.d.ts`],
        ],
      ];
    }),
  );
}

export const EXTENSION_PACKAGE_BOUNDARY_BASE_PATHS = {
  "eve-agent/extension-api": ["../src/extensionAPI.ts"],
  "eve-agent/plugin-sdk": ["../dist/plugin-sdk/index.d.ts"],
  "eve-agent/plugin-sdk/*": ["../dist/plugin-sdk/*.d.ts"],
  ...privateLocalOnlyPluginSdkPackageDtsPaths,
  "eve-agent/plugin-sdk/account-id": ["../dist/plugin-sdk/account-id.d.ts"],
  "eve-agent/plugin-sdk/channel-entry-contract": ["../dist/plugin-sdk/channel-entry-contract.d.ts"],
  "eve-agent/plugin-sdk/browser-maintenance": [
    "../packages/plugin-sdk/dist/extensions/browser/browser-maintenance.d.ts",
  ],
  "eve-agent/plugin-sdk/channel-secret-basic-runtime": [
    "../dist/plugin-sdk/channel-secret-basic-runtime.d.ts",
  ],
  "eve-agent/plugin-sdk/channel-secret-runtime": ["../dist/plugin-sdk/channel-secret-runtime.d.ts"],
  "eve-agent/plugin-sdk/channel-secret-tts-runtime": [
    "../dist/plugin-sdk/channel-secret-tts-runtime.d.ts",
  ],
  "eve-agent/plugin-sdk/channel-streaming": ["../dist/plugin-sdk/channel-streaming.d.ts"],
  "eve-agent/plugin-sdk/error-runtime": ["../dist/plugin-sdk/error-runtime.d.ts"],
  "eve-agent/plugin-sdk/provider-catalog-live-runtime": [
    "../dist/plugin-sdk/provider-catalog-live-runtime.d.ts",
  ],
  "eve-agent/plugin-sdk/provider-catalog-shared": [
    "../dist/plugin-sdk/provider-catalog-shared.d.ts",
  ],
  "eve-agent/plugin-sdk/provider-entry": ["../dist/plugin-sdk/provider-entry.d.ts"],
  "eve-agent/plugin-sdk/secret-ref-runtime": ["../dist/plugin-sdk/secret-ref-runtime.d.ts"],
  "eve-agent/plugin-sdk/ssrf-runtime": ["../dist/plugin-sdk/ssrf-runtime.d.ts"],
  "@eve/qa-channel/api.js": ["../dist/plugin-sdk/extensions/qa-channel/api.d.ts"],
  "@eve/discord/api.js": ["../dist/plugin-sdk/extensions/discord/api.d.ts"],
  "@eve/slack/api.js": ["../dist/plugin-sdk/extensions/slack/api.d.ts"],
  "@eve/whatsapp/api.js": ["../dist/plugin-sdk/extensions/whatsapp/api.d.ts"],
  "@eve/llm-core": ["../dist/plugin-sdk/packages/llm-core/src/index.d.ts"],
  "@eve/llm-core/diagnostics": [
    "../dist/plugin-sdk/packages/llm-core/src/utils/diagnostics.d.ts",
  ],
  "@eve/llm-core/event-stream": [
    "../dist/plugin-sdk/packages/llm-core/src/utils/event-stream.d.ts",
  ],
  "@eve/llm-core/types": ["../dist/plugin-sdk/packages/llm-core/src/types.d.ts"],
  "@eve/llm-core/validation": ["../dist/plugin-sdk/packages/llm-core/src/validation.d.ts"],
  "@eve/llm-core/*": ["../dist/plugin-sdk/packages/llm-core/src/*.d.ts"],
  "@eve/model-catalog-core": ["../dist/plugin-sdk/packages/model-catalog-core/src/index.d.ts"],
  "@eve/model-catalog-core/configured-model-refs": [
    "../dist/plugin-sdk/packages/model-catalog-core/src/configured-model-refs.d.ts",
  ],
  "@eve/model-catalog-core/model-catalog-refs": [
    "../dist/plugin-sdk/packages/model-catalog-core/src/model-catalog-refs.d.ts",
  ],
  "@eve/model-catalog-core/model-catalog-normalize": [
    "../dist/plugin-sdk/packages/model-catalog-core/src/model-catalog-normalize.d.ts",
  ],
  "@eve/model-catalog-core/model-catalog-types": [
    "../dist/plugin-sdk/packages/model-catalog-core/src/model-catalog-types.d.ts",
  ],
  "@eve/model-catalog-core/provider-id": [
    "../dist/plugin-sdk/packages/model-catalog-core/src/provider-id.d.ts",
  ],
  "@eve/model-catalog-core/provider-model-id-normalization": [
    "../dist/plugin-sdk/packages/model-catalog-core/src/provider-model-id-normalization.d.ts",
  ],
  "@eve/model-catalog-core/provider-model-id-normalize": [
    "../dist/plugin-sdk/packages/model-catalog-core/src/provider-model-id-normalize.d.ts",
  ],
  "@eve/model-catalog-core/*": ["../dist/plugin-sdk/packages/model-catalog-core/src/*.d.ts"],
  "@eve/markdown-core": ["../dist/plugin-sdk/packages/markdown-core/src/index.d.ts"],
  "@eve/markdown-core/code-spans": [
    "../dist/plugin-sdk/packages/markdown-core/src/code-spans.d.ts",
  ],
  "@eve/markdown-core/fences": ["../dist/plugin-sdk/packages/markdown-core/src/fences.d.ts"],
  "@eve/markdown-core/frontmatter": [
    "../dist/plugin-sdk/packages/markdown-core/src/frontmatter.d.ts",
  ],
  "@eve/markdown-core/ir": ["../dist/plugin-sdk/packages/markdown-core/src/ir.d.ts"],
  "@eve/markdown-core/render": ["../dist/plugin-sdk/packages/markdown-core/src/render.d.ts"],
  "@eve/markdown-core/render-aware-chunking": [
    "../dist/plugin-sdk/packages/markdown-core/src/render-aware-chunking.d.ts",
  ],
  "@eve/markdown-core/tables": ["../dist/plugin-sdk/packages/markdown-core/src/tables.d.ts"],
  "@eve/markdown-core/types": ["../dist/plugin-sdk/packages/markdown-core/src/types.d.ts"],
  "@eve/markdown-core/*": ["../dist/plugin-sdk/packages/markdown-core/src/*.d.ts"],
  "@eve/media-generation-core": [
    "../dist/plugin-sdk/packages/media-generation-core/src/index.d.ts",
  ],
  "@eve/media-generation-core/capability-model-ref": [
    "../dist/plugin-sdk/packages/media-generation-core/src/capability-model-ref.d.ts",
  ],
  "@eve/media-generation-core/catalog": [
    "../dist/plugin-sdk/packages/media-generation-core/src/catalog.d.ts",
  ],
  "@eve/media-generation-core/model-ref": [
    "../dist/plugin-sdk/packages/media-generation-core/src/model-ref.d.ts",
  ],
  "@eve/media-generation-core/normalization": [
    "../dist/plugin-sdk/packages/media-generation-core/src/normalization.d.ts",
  ],
  "@eve/media-generation-core/*": [
    "../dist/plugin-sdk/packages/media-generation-core/src/*.d.ts",
  ],
  "@eve/media-core": ["../dist/plugin-sdk/packages/media-core/src/index.d.ts"],
  "@eve/media-core/base64": ["../dist/plugin-sdk/packages/media-core/src/base64.d.ts"],
  "@eve/media-core/constants": ["../dist/plugin-sdk/packages/media-core/src/constants.d.ts"],
  "@eve/media-core/content-length": [
    "../dist/plugin-sdk/packages/media-core/src/content-length.d.ts",
  ],
  "@eve/media-core/file-name": ["../dist/plugin-sdk/packages/media-core/src/file-name.d.ts"],
  "@eve/media-core/inbound-path-policy": [
    "../dist/plugin-sdk/packages/media-core/src/inbound-path-policy.d.ts",
  ],
  "@eve/media-core/inline-image-data-url": [
    "../dist/plugin-sdk/packages/media-core/src/inline-image-data-url.d.ts",
  ],
  "@eve/media-core/media-source-url": [
    "../dist/plugin-sdk/packages/media-core/src/media-source-url.d.ts",
  ],
  "@eve/media-core/mime": ["../dist/plugin-sdk/packages/media-core/src/mime.d.ts"],
  "@eve/media-core/read-byte-stream-with-limit": [
    "../dist/plugin-sdk/packages/media-core/src/read-byte-stream-with-limit.d.ts",
  ],
  "@eve/media-core/read-response-with-limit": [
    "../dist/plugin-sdk/packages/media-core/src/read-response-with-limit.d.ts",
  ],
  "@eve/media-core/*": ["../dist/plugin-sdk/packages/media-core/src/*.d.ts"],
  "@eve/normalization-core/record-coerce": [
    "../dist/plugin-sdk/packages/normalization-core/src/record-coerce.d.ts",
  ],
  "@eve/normalization-core/string-coerce": [
    "../dist/plugin-sdk/packages/normalization-core/src/string-coerce.d.ts",
  ],
  "@eve/normalization-core/*": ["../dist/plugin-sdk/packages/normalization-core/src/*.d.ts"],
  ...buildPackageBoundaryDtsPaths({
    packageName: "@eve/acp-core",
    packageDir: "acp-core",
  }),
  "@eve/acp-core/*": ["../dist/plugin-sdk/packages/acp-core/src/*.d.ts"],
  "@eve/terminal-core": ["../dist/plugin-sdk/packages/terminal-core/src/index.d.ts"],
  "@eve/terminal-core/ansi": ["../dist/plugin-sdk/packages/terminal-core/src/ansi.d.ts"],
  "@eve/terminal-core/decorative-emoji": [
    "../dist/plugin-sdk/packages/terminal-core/src/decorative-emoji.d.ts",
  ],
  "@eve/terminal-core/health-style": [
    "../dist/plugin-sdk/packages/terminal-core/src/health-style.d.ts",
  ],
  "@eve/terminal-core/links": ["../dist/plugin-sdk/packages/terminal-core/src/links.d.ts"],
  "@eve/terminal-core/note": ["../dist/plugin-sdk/packages/terminal-core/src/note.d.ts"],
  "@eve/terminal-core/osc-progress": [
    "../dist/plugin-sdk/packages/terminal-core/src/osc-progress.d.ts",
  ],
  "@eve/terminal-core/palette": ["../dist/plugin-sdk/packages/terminal-core/src/palette.d.ts"],
  "@eve/terminal-core/progress-line": [
    "../dist/plugin-sdk/packages/terminal-core/src/progress-line.d.ts",
  ],
  "@eve/terminal-core/prompt-select-styled": [
    "../dist/plugin-sdk/packages/terminal-core/src/prompt-select-styled.d.ts",
  ],
  "@eve/terminal-core/prompt-select-styled-params": [
    "../dist/plugin-sdk/packages/terminal-core/src/prompt-select-styled-params.d.ts",
  ],
  "@eve/terminal-core/prompt-style": [
    "../dist/plugin-sdk/packages/terminal-core/src/prompt-style.d.ts",
  ],
  "@eve/terminal-core/restore": ["../dist/plugin-sdk/packages/terminal-core/src/restore.d.ts"],
  "@eve/terminal-core/safe-text": [
    "../dist/plugin-sdk/packages/terminal-core/src/safe-text.d.ts",
  ],
  "@eve/terminal-core/stream-writer": [
    "../dist/plugin-sdk/packages/terminal-core/src/stream-writer.d.ts",
  ],
  "@eve/terminal-core/table": ["../dist/plugin-sdk/packages/terminal-core/src/table.d.ts"],
  "@eve/terminal-core/terminal-link": [
    "../dist/plugin-sdk/packages/terminal-core/src/terminal-link.d.ts",
  ],
  "@eve/terminal-core/theme": ["../dist/plugin-sdk/packages/terminal-core/src/theme.d.ts"],
  "@eve/terminal-core/*": ["../dist/plugin-sdk/packages/terminal-core/src/*.d.ts"],
  "@eve/*.js": ["../packages/plugin-sdk/dist/extensions/*.d.ts", "../extensions/*"],
  "@eve/*": ["../packages/plugin-sdk/dist/extensions/*", "../extensions/*"],
  "eve-agent/plugin-sdk/qa-channel": ["../dist/plugin-sdk/src/plugin-sdk/qa-channel.d.ts"],
  "eve-agent/plugin-sdk/qa-channel-protocol": [
    "../dist/plugin-sdk/src/plugin-sdk/qa-channel-protocol.d.ts",
  ],
  "eve-agent/plugin-sdk/qa-runtime": ["../dist/plugin-sdk/src/plugin-sdk/qa-runtime.d.ts"],
  "@eve/plugin-sdk/*": ["../dist/plugin-sdk/*.d.ts"],
} as const;

function prefixExtensionPackageBoundaryPaths(
  paths: Record<string, readonly string[]>,
  prefix: string,
): Record<string, readonly string[]> {
  return Object.fromEntries(
    Object.entries(paths).map(([key, values]) => [
      key,
      values.map((value) => posix.join(prefix, value)),
    ]),
  );
}

export const EXTENSION_PACKAGE_BOUNDARY_XAI_PATHS = {
  ...prefixExtensionPackageBoundaryPaths(
    (({
      "eve-agent/plugin-sdk/channel-secret-basic-runtime": _omitBasic,
      "eve-agent/plugin-sdk/channel-secret-tts-runtime": _omitTts,
      "@eve/discord/api.js": _omitDiscord,
      "@eve/slack/api.js": _omitSlack,
      "@eve/whatsapp/api.js": _omitWhatsApp,
      ...rest
    }) => rest)(EXTENSION_PACKAGE_BOUNDARY_BASE_PATHS),
    "../",
  ),
  "eve-agent/plugin-sdk/channel-entry-contract": [
    "../../dist/plugin-sdk/channel-entry-contract.d.ts",
  ],
  "eve-agent/plugin-sdk/browser-maintenance": [
    "../../dist/plugin-sdk/src/plugin-sdk/browser-maintenance.d.ts",
  ],
  "eve-agent/plugin-sdk/cli-runtime": ["../../dist/plugin-sdk/cli-runtime.d.ts"],
  "eve-agent/plugin-sdk/provider-catalog-live-runtime": [
    "../../dist/plugin-sdk/provider-catalog-live-runtime.d.ts",
  ],
  "eve-agent/plugin-sdk/provider-catalog-shared": [
    "../../dist/plugin-sdk/provider-catalog-shared.d.ts",
  ],
  "eve-agent/plugin-sdk/provider-env-vars": ["../../dist/plugin-sdk/provider-env-vars.d.ts"],
  "eve-agent/plugin-sdk/provider-entry": ["../../dist/plugin-sdk/provider-entry.d.ts"],
  "eve-agent/plugin-sdk/provider-web-search-contract": [
    "../../dist/plugin-sdk/provider-web-search-contract.d.ts",
  ],
  "@eve/qa-channel/api.js": ["../../dist/plugin-sdk/extensions/qa-channel/api.d.ts"],
  "@eve/*.js": ["../../packages/plugin-sdk/dist/extensions/*.d.ts", "../*"],
  "@eve/*": ["../*"],
  "@eve/plugin-sdk/*": ["../../dist/plugin-sdk/*.d.ts"],
  "@eve/anthropic-vertex/api.js": ["./.boundary-stubs/anthropic-vertex-api.d.ts"],
  "@eve/ollama/api.js": ["./.boundary-stubs/ollama-api.d.ts"],
  "@eve/ollama/runtime-api.js": ["./.boundary-stubs/ollama-runtime-api.d.ts"],
  "@eve/speech-core/runtime-api.js": ["./.boundary-stubs/speech-core-runtime-api.d.ts"],
} as const;

type ExtensionPackageBoundaryTsConfigJson = {
  extends?: unknown;
  compilerOptions?: {
    rootDir?: unknown;
    paths?: unknown;
  };
  include?: unknown;
  exclude?: unknown;
};

type ExtensionPackageBoundaryPackageJson = {
  devDependencies?: Record<string, string>;
};

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function collectBundledExtensionIds(rootDir = resolve(".")): string[] {
  return readdirSync(join(rootDir, "extensions"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();
}

function resolveExtensionTsconfigPath(extensionId: string, rootDir = resolve(".")): string {
  return join(rootDir, "extensions", extensionId, "tsconfig.json");
}

function resolveExtensionPackageJsonPath(extensionId: string, rootDir = resolve(".")): string {
  return join(rootDir, "extensions", extensionId, "package.json");
}

export function readExtensionPackageBoundaryTsconfig(
  extensionId: string,
  rootDir = resolve("."),
): ExtensionPackageBoundaryTsConfigJson {
  return readJsonFile(
    resolveExtensionTsconfigPath(extensionId, rootDir),
  ) as ExtensionPackageBoundaryTsConfigJson;
}

export function readExtensionPackageBoundaryPackageJson(
  extensionId: string,
  rootDir = resolve("."),
): ExtensionPackageBoundaryPackageJson {
  return readJsonFile(
    resolveExtensionPackageJsonPath(extensionId, rootDir),
  ) as ExtensionPackageBoundaryPackageJson;
}

export function isOptInExtensionPackageBoundaryTsconfig(
  tsconfig: ExtensionPackageBoundaryTsConfigJson,
): boolean {
  return tsconfig.extends === "../tsconfig.package-boundary.base.json";
}

export function collectExtensionsWithTsconfig(rootDir = resolve(".")): string[] {
  return collectBundledExtensionIds(rootDir).filter((extensionId) =>
    existsSync(resolveExtensionTsconfigPath(extensionId, rootDir)),
  );
}

export function collectOptInExtensionPackageBoundaries(rootDir = resolve(".")): string[] {
  return collectExtensionsWithTsconfig(rootDir).filter((extensionId) =>
    isOptInExtensionPackageBoundaryTsconfig(
      readExtensionPackageBoundaryTsconfig(extensionId, rootDir),
    ),
  );
}
