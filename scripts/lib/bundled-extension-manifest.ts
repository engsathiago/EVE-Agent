// Bundled Extension Manifest script supports EVE repository automation.
import { validateMinHostVersion } from "../../src/plugins/min-host-version.ts";
import { isRecord } from "../../src/utils.js";

export type ExtensionPackageJson = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  eve?: {
    install?: unknown;
    releaseChecks?: unknown;
  };
};

export type BundledExtension = { id: string; packageJson: ExtensionPackageJson };

export function collectBundledExtensionManifestErrors(extensions: BundledExtension[]): string[] {
  const errors: string[] = [];

  for (const extension of extensions) {
    const install = extension.packageJson.eve?.install;
    if (install !== undefined && !isRecord(install)) {
      errors.push(
        `bundled extension '${extension.id}' manifest invalid | eve.install must be an object`,
      );
      continue;
    }
    const hasNpmSpec = isRecord(install) && "npmSpec" in install;
    if (
      hasNpmSpec &&
      (!install.npmSpec || typeof install.npmSpec !== "string" || !install.npmSpec.trim())
    ) {
      errors.push(
        `bundled extension '${extension.id}' manifest invalid | eve.install.npmSpec must be a non-empty string`,
      );
    }
    const minHostVersionError = validateMinHostVersion(install?.minHostVersion);
    if (minHostVersionError) {
      errors.push(`bundled extension '${extension.id}' manifest invalid | ${minHostVersionError}`);
    }
  }

  return errors;
}
