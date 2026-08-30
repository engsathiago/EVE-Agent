// Prepares and inspects portable network-free EVE installations.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mutateConfigFileWithRetry } from "../config/config.js";
import type { EVEConfig } from "../config/types.eve.js";
import { type RuntimeEnv, writeRuntimeJson } from "../runtime.js";
import { resolveUserPath } from "../utils.js";

export type OfflineBundleOptions = {
  output: string;
  sourceRoot?: string;
  skipBuild?: boolean;
  includeModels?: boolean;
  ollamaModels?: string;
  includeOllama?: boolean;
  ollamaBinary?: string;
  json?: boolean;
};

export type OfflineCommandRunner = (
  executable: string,
  args: string[],
  options: { cwd: string },
) => Promise<{ stdout: string }>;

function sourceRoot(): string {
  return path.resolve(import.meta.dirname, "../..");
}

async function runCommand(
  executable: string,
  args: string[],
  options: { cwd: string },
): Promise<{ stdout: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0
        ? resolve({ stdout })
        : reject(new Error(stderr.trim() || `${executable} exited with ${code}`)),
    );
  });
}

async function checksum(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function filesUnder(root: string): Promise<string[]> {
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        files.push(absolute);
      }
    }
  };
  await visit(root);
  return files.toSorted();
}

async function assertEmptyOutput(output: string, source: string): Promise<void> {
  const relative = path.relative(source, output);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error("offline bundle output must be outside the EVE source tree");
  }
  const stat = await fs.stat(output).catch(() => undefined);
  if (stat && !stat.isDirectory()) {
    throw new Error(`offline output is not a directory: ${output}`);
  }
  if (stat && (await fs.readdir(output)).length > 0) {
    throw new Error(`offline output directory is not empty: ${output}`);
  }
  await fs.mkdir(output, { recursive: true, mode: 0o700 });
}

export async function prepareOfflineBundle(
  options: OfflineBundleOptions,
  runner: OfflineCommandRunner = runCommand,
) {
  const source = path.resolve(options.sourceRoot ?? sourceRoot());
  const output = resolveUserPath(options.output);
  await assertEmptyOutput(output, source);
  if (!options.skipBuild) {
    await runner("pnpm", ["build"], { cwd: source });
  }

  const npmCache = path.join(output, "npm-cache");
  const warmRoot = path.join(output, ".warm");
  await fs.mkdir(npmCache, { recursive: true, mode: 0o700 });
  const packed = await runner("npm", ["pack", "--pack-destination", output], { cwd: source });
  const tarballName = packed.stdout.trim().split(/\r?\n/u).findLast(Boolean);
  if (!tarballName) {
    throw new Error("npm pack did not report an output tarball");
  }
  const tarball = path.join(output, path.basename(tarballName));
  if (!(await fs.stat(tarball).catch(() => undefined))?.isFile()) {
    throw new Error(`npm pack output was not found: ${tarball}`);
  }
  await runner(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--cache",
      npmCache,
      "--prefix",
      warmRoot,
      tarball,
    ],
    { cwd: source },
  );
  await fs.rm(warmRoot, { recursive: true, force: true });

  const installer = path.join(source, "scripts", "install-offline.sh");
  const verifier = path.join(source, "scripts", "verify-offline-manifest.mjs");
  for (const file of [installer, verifier]) {
    if (!(await fs.stat(file).catch(() => undefined))?.isFile()) {
      throw new Error(`offline bundle support file is missing: ${file}`);
    }
    await fs.copyFile(file, path.join(output, path.basename(file)));
  }
  await fs.chmod(path.join(output, "install-offline.sh"), 0o755);

  let modelsBundled = false;
  if (options.includeModels) {
    const models = resolveUserPath(
      options.ollamaModels ?? path.join(os.homedir(), ".ollama", "models"),
    );
    if (!(await fs.stat(models).catch(() => undefined))?.isDirectory()) {
      throw new Error(`Ollama model store was not found: ${models}`);
    }
    await fs.cp(models, path.join(output, "ollama-models"), {
      recursive: true,
      dereference: true,
    });
    modelsBundled = true;
  }

  let ollamaBundled = false;
  if (options.includeOllama) {
    const binary = options.ollamaBinary?.trim();
    if (!binary) {
      throw new Error("--ollama-binary is required with --include-ollama");
    }
    const resolved = resolveUserPath(binary);
    if (!(await fs.stat(resolved).catch(() => undefined))?.isFile()) {
      throw new Error(`Ollama executable was not found: ${resolved}`);
    }
    await fs.mkdir(path.join(output, "bin"), { recursive: true, mode: 0o700 });
    await fs.copyFile(resolved, path.join(output, "bin", "ollama"));
    await fs.chmod(path.join(output, "bin", "ollama"), 0o755);
    ollamaBundled = true;
  }

  const files = (await filesUnder(output)).filter(
    (file) => path.basename(file) !== "offline-manifest.json",
  );
  const checksums: Record<string, string> = {};
  // Model blobs can be many gigabytes. Sequential streaming keeps checksum
  // memory bounded while preserving deterministic manifest ordering.
  for (const file of files) {
    checksums[path.relative(output, file).replaceAll(path.sep, "/")] = await checksum(file);
  }
  const manifest = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    platform: `${process.platform}-${process.arch}`,
    nodeVersion: process.version,
    package: path.basename(tarball),
    npmCache: "npm-cache",
    modelsBundled,
    ollamaBundled,
    install: "Run ./install-offline.sh without internet access.",
    checksums,
  };
  const manifestPath = path.join(output, "offline-manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  const manifestSha256 = createHash("sha256")
    .update(await fs.readFile(manifestPath))
    .digest("hex");
  return {
    bundle: output,
    manifest: manifestPath,
    manifestSha256,
    files: files.length + 1,
    ...manifest,
  };
}

export async function offlineStatus(baseUrl = "http://127.0.0.1:11434") {
  const root = baseUrl.replace(/\/$/u, "").replace(/\/v1$/u, "");
  let models: string[] = [];
  let error = "";
  try {
    const response = await fetch(`${root}/api/tags`, { signal: AbortSignal.timeout(800) });
    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { models?: Array<{ name?: string }> };
    models = (payload.models ?? []).flatMap((model) => (model.name ? [model.name] : []));
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }
  return {
    ready: models.length > 0,
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    ollama: { baseUrl: root, reachable: !error, models, error },
  };
}

function normalizeOllamaRoot(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/u, "").replace(/\/v1$/u, "");
}

/** Build the local-only Ollama config used by `eve offline configure`. */
export function buildOfflineOllamaConfig(
  config: EVEConfig,
  options: { model: string; baseUrl?: string },
): EVEConfig {
  const model = options.model.trim().replace(/^ollama\//u, "");
  if (!model) {
    throw new Error("Ollama model name is required");
  }
  const baseUrl = normalizeOllamaRoot(options.baseUrl ?? "http://127.0.0.1:11434");
  const existingProvider = config.models?.providers?.ollama;
  const existingModels = existingProvider?.models ?? [];
  const modelEntry = existingModels.find((entry) => entry.id === model);
  const previousDefault = config.agents?.defaults?.model;
  const nextDefault =
    previousDefault && typeof previousDefault === "object"
      ? { ...previousDefault, primary: `ollama/${model}` }
      : { primary: `ollama/${model}` };
  return {
    ...config,
    agents: {
      ...config.agents,
      defaults: { ...config.agents?.defaults, model: nextDefault },
    },
    models: {
      ...config.models,
      mode: config.models?.mode ?? "merge",
      providers: {
        ...config.models?.providers,
        ollama: {
          ...existingProvider,
          baseUrl,
          api: "ollama",
          apiKey: existingProvider?.apiKey ?? "ollama-local",
          // The Ollama plugin enriches unknown models through /api/show. Do not
          // persist invented context limits into a user configuration here.
          models: modelEntry
            ? [modelEntry, ...existingModels.filter((entry) => entry.id !== model)]
            : existingModels,
        },
      },
    },
    plugins: {
      ...config.plugins,
      entries: {
        ...config.plugins?.entries,
        ollama: { ...config.plugins?.entries?.ollama, enabled: true },
      },
    },
  };
}

export async function offlineConfigureCommand(
  runtime: RuntimeEnv,
  options: { model: string; baseUrl?: string; allowMissing?: boolean; json?: boolean },
) {
  const status = await offlineStatus(options.baseUrl);
  const model = options.model.trim().replace(/^ollama\//u, "");
  if (!options.allowMissing && !status.ollama.models.includes(model)) {
    throw new Error(
      status.ollama.reachable
        ? `Ollama model is not installed: ${model}`
        : `Ollama is not reachable at ${status.ollama.baseUrl}: ${status.ollama.error}`,
    );
  }
  const mutation = await mutateConfigFileWithRetry({
    mutate: (config) => Object.assign(config, buildOfflineOllamaConfig(config, options)),
  });
  const result = {
    configured: true,
    model: `ollama/${model}`,
    baseUrl: status.ollama.baseUrl,
    configPath: mutation.snapshot.path,
  };
  if (options.json) {
    writeRuntimeJson(runtime, result);
  } else {
    runtime.log(`Configured local model ${result.model} at ${result.baseUrl}`);
  }
  return result;
}

export async function offlineBundleCommand(runtime: RuntimeEnv, options: OfflineBundleOptions) {
  const result = await prepareOfflineBundle(options);
  if (options.json) {
    writeRuntimeJson(runtime, result);
  } else {
    runtime.log(
      `Offline bundle: ${result.bundle}\nFiles: ${result.files}\nManifest SHA-256: ${result.manifestSha256}\nInstaller: ${path.join(result.bundle, "install-offline.sh")}`,
    );
  }
  return result;
}

export async function offlineStatusCommand(
  runtime: RuntimeEnv,
  options: { baseUrl?: string; json?: boolean },
) {
  const result = await offlineStatus(options.baseUrl);
  if (options.json) {
    writeRuntimeJson(runtime, result);
  } else {
    runtime.log(
      `Offline readiness: ${result.ready ? "ready" : "not ready"}\nOllama: ${result.ollama.reachable ? "reachable" : result.ollama.error}\nModels: ${result.ollama.models.join(", ") || "none"}`,
    );
  }
  return result;
}
