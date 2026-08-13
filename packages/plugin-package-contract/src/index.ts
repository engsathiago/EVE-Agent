// External code plugin package.json compatibility and validation contracts.

/** JSON object shape accepted by package contract helpers. */
export type JsonObject = Record<string, unknown>;

/** Compatibility metadata extracted from an external plugin package. */
export type ExternalPluginCompatibility = {
  pluginApiRange?: string;
  builtWithEVEVersion?: string;
  pluginSdkVersion?: string;
  minGatewayVersion?: string;
};

/** One validation issue for an external plugin package. */
export type ExternalPluginValidationIssue = {
  fieldPath: string;
  message: string;
};

/** Validation result plus any normalized compatibility metadata. */
export type ExternalCodePluginValidationResult = {
  compatibility?: ExternalPluginCompatibility;
  issues: ExternalPluginValidationIssue[];
};

/** Required package.json field paths for external code plugin packages. */
export const EXTERNAL_CODE_PLUGIN_REQUIRED_FIELD_PATHS = [
  "eve.compat.pluginApi",
  "eve.build.eveVersion",
] as const;

/** Narrow unknown values to plain records. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalize optional package metadata strings. */
function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** Read EVE package.json blocks without trusting caller input shape. */
function readEVEBlock(packageJson: unknown) {
  const root = isRecord(packageJson) ? packageJson : undefined;
  const eve = isRecord(root?.eve) ? root.eve : undefined;
  const compat = isRecord(eve?.compat) ? eve.compat : undefined;
  const build = isRecord(eve?.build) ? eve.build : undefined;
  const install = isRecord(eve?.install) ? eve.install : undefined;
  return { root, eve, compat, build, install };
}

/** Normalize compatibility metadata from an external plugin package.json. */
export function normalizeExternalPluginCompatibility(
  packageJson: unknown,
): ExternalPluginCompatibility | undefined {
  const { root, compat, build, install } = readEVEBlock(packageJson);
  const version = normalizeOptionalString(root?.version);
  const minHostVersion = normalizeOptionalString(install?.minHostVersion);
  const compatibility: ExternalPluginCompatibility = {};

  const pluginApi = normalizeOptionalString(compat?.pluginApi);
  if (pluginApi) {
    compatibility.pluginApiRange = pluginApi;
  }

  const minGatewayVersion = normalizeOptionalString(compat?.minGatewayVersion) ?? minHostVersion;
  if (minGatewayVersion) {
    compatibility.minGatewayVersion = minGatewayVersion;
  }

  const builtWithEVEVersion = normalizeOptionalString(build?.eveVersion) ?? version;
  if (builtWithEVEVersion) {
    compatibility.builtWithEVEVersion = builtWithEVEVersion;
  }

  const pluginSdkVersion = normalizeOptionalString(build?.pluginSdkVersion);
  if (pluginSdkVersion) {
    compatibility.pluginSdkVersion = pluginSdkVersion;
  }

  return Object.keys(compatibility).length > 0 ? compatibility : undefined;
}

/** List missing required field paths for an external code plugin package.json. */
export function listMissingExternalCodePluginFieldPaths(packageJson: unknown): string[] {
  const { compat, build } = readEVEBlock(packageJson);
  const missing: string[] = [];
  if (!normalizeOptionalString(compat?.pluginApi)) {
    missing.push("eve.compat.pluginApi");
  }
  if (!normalizeOptionalString(build?.eveVersion)) {
    missing.push("eve.build.eveVersion");
  }
  return missing;
}

/** Validate an external code plugin package.json against required compatibility fields. */
export function validateExternalCodePluginPackageJson(
  packageJson: unknown,
): ExternalCodePluginValidationResult {
  const issues = listMissingExternalCodePluginFieldPaths(packageJson).map((fieldPath) => ({
    fieldPath,
    message: `${fieldPath} is required for external code plugin packages.`,
  }));
  return {
    compatibility: normalizeExternalPluginCompatibility(packageJson),
    issues,
  };
}
