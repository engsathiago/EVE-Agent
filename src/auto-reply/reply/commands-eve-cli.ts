// Formats EVE CLI command snippets for chat-facing command responses.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { isBunRuntime } from "../../daemon/runtime-binary.js";
import { resolveEVEPackageRootSync } from "../../infra/eve-root.js";

const requireFromHere = createRequire(import.meta.url);
const EVE_CLI_ENTRY_BASENAMES = new Set(["eve", "eve.mjs"]);
const EVE_PACKAGE_ENTRY_PATHS = new Set([
  path.join("dist", "entry.js"),
  path.join("dist", "entry.mjs"),
  path.join("dist", "index.js"),
  path.join("dist", "index.mjs"),
  path.join("src", "entry.ts"),
]);
const TEST_RUNNER_ENV_PREFIXES = ["VITEST_", "EVE_VITEST_"];

function quoteShellArg(value: string): string {
  if (process.platform === "win32") {
    return `'${value.replaceAll("'", "''")}'`;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function isEVECliLauncherEntry(entry: string): boolean {
  return EVE_CLI_ENTRY_BASENAMES.has(path.basename(entry));
}

function isEVEPackageEntry(entry: string, packageRoot: string): boolean {
  const relativeEntry = path.relative(path.resolve(packageRoot), path.resolve(entry));
  return EVE_PACKAGE_ENTRY_PATHS.has(relativeEntry);
}

function safeCwd(): string | undefined {
  try {
    return process.cwd();
  } catch {
    return undefined;
  }
}

function buildPackageRootCliArgvPrefix(packageRoot: string): string[] {
  const sourceEntry = path.join(packageRoot, "src", "entry.ts");
  if (fs.existsSync(sourceEntry)) {
    const tsxLoader = resolveTrustedTsxLoader(packageRoot);
    return isBunRuntime(process.execPath)
      ? [process.execPath, sourceEntry]
      : tsxLoader
        ? [process.execPath, "--import", tsxLoader, sourceEntry]
        : [process.execPath, path.join(packageRoot, "eve.mjs")];
  }
  return [process.execPath, path.join(packageRoot, "eve.mjs")];
}

function resolveTrustedTsxLoader(packageRoot: string): string | null {
  try {
    return requireFromHere.resolve("tsx", { paths: [packageRoot] });
  } catch {
    return null;
  }
}

function resolveCurrentEVECliArgvPrefix(): string[] {
  const entry = process.argv[1]?.trim();
  if (entry && entry !== process.execPath && isEVECliLauncherEntry(entry)) {
    return [process.execPath, ...process.execArgv, entry];
  }
  const entryPackageRoot = entry ? resolveEVEPackageRootSync({ argv1: entry }) : null;
  if (entry && entryPackageRoot && isEVEPackageEntry(entry, entryPackageRoot)) {
    return [process.execPath, ...process.execArgv, entry];
  }
  const packageRoot = resolveEVEPackageRootSync({
    argv1: entry,
    cwd: safeCwd(),
    moduleUrl: import.meta.url,
  });
  if (packageRoot) {
    return buildPackageRootCliArgvPrefix(packageRoot);
  }
  return entry && entry !== process.execPath ? [process.execPath, entry] : [process.execPath];
}

/** Reconstructs the current EVE CLI invocation with extra args. */
export function buildCurrentEVECliArgv(args: string[]): string[] {
  return [...resolveCurrentEVECliArgvPrefix(), ...args];
}

/** Clears test-runner env inherited by harness-hosted gateways before spawning the CLI. */
export function buildCurrentEVECliExecEnv(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> | undefined {
  const overrides: Record<string, string> = {};
  for (const key of Object.keys(env)) {
    if (key === "VITEST" || TEST_RUNNER_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      overrides[key] = "";
    }
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

/** Builds a shell-quoted command string for rerunning the current EVE CLI. */
export function buildCurrentEVECliCommand(args: string[]): string {
  return buildCurrentEVECliArgv(args).map(quoteShellArg).join(" ");
}
