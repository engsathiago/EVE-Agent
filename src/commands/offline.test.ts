import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildOfflineOllamaConfig,
  prepareOfflineBundle,
  type OfflineCommandRunner,
} from "./offline.js";

const execFileAsync = promisify(execFile);
const cleanup: string[] = [];

async function trustedManifestHash(output: string): Promise<string> {
  return createHash("sha256")
    .update(await fs.readFile(path.join(output, "offline-manifest.json")))
    .digest("hex");
}

afterEach(async () => {
  for (const root of cleanup.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "eve-offline-"));
  cleanup.push(root);
  const source = path.join(root, "source");
  const output = path.join(root, "bundle");
  await fs.mkdir(path.join(source, "scripts"), { recursive: true });
  for (const script of ["install-offline.sh", "verify-offline-manifest.mjs"]) {
    await fs.copyFile(
      path.resolve(import.meta.dirname, "../../scripts", script),
      path.join(source, "scripts", script),
    );
  }
  const calls: Array<{ executable: string; args: string[] }> = [];
  const runner: OfflineCommandRunner = async (executable, args) => {
    calls.push({ executable, args });
    if (executable === "npm" && args[0] === "pack") {
      await fs.writeFile(path.join(output, "eve-agent-1.0.0.tgz"), "package payload\n");
      return { stdout: "eve-agent-1.0.0.tgz\n" };
    }
    if (executable === "npm" && args[0] === "install") {
      const cacheIndex = args.indexOf("--cache");
      const cache = args[cacheIndex + 1];
      if (!cache) {
        throw new Error("missing npm cache argument");
      }
      await fs.mkdir(path.join(cache, "_cacache"), { recursive: true });
      await fs.writeFile(path.join(cache, "_cacache", "fixture"), "dependency cache\n");
    }
    return { stdout: "" };
  };
  return { root, source, output, runner, calls };
}

describe("offline bundle", () => {
  it("builds a complete checksummed bundle whose manifest verifier succeeds", async () => {
    const { source, output, runner, calls } = await fixture();
    const result = await prepareOfflineBundle({ output, sourceRoot: source }, runner);

    expect(calls[0]).toEqual({ executable: "pnpm", args: ["build"] });
    expect(calls.some((call) => call.executable === "npm" && call.args[0] === "pack")).toBe(true);
    expect(result).toMatchObject({
      package: "eve-agent-1.0.0.tgz",
      modelsBundled: false,
      ollamaBundled: false,
    });
    const manifest = JSON.parse(await fs.readFile(result.manifest, "utf8")) as {
      checksums: Record<string, string>;
    };
    expect(Object.keys(manifest.checksums)).toEqual(
      expect.arrayContaining([
        "eve-agent-1.0.0.tgz",
        "install-offline.sh",
        "npm-cache/_cacache/fixture",
        "verify-offline-manifest.mjs",
      ]),
    );
    await expect(
      execFileAsync(process.execPath, [
        path.join(output, "verify-offline-manifest.mjs"),
        output,
        await trustedManifestHash(output),
      ]),
    ).resolves.toMatchObject({ stdout: expect.stringContaining("Verified EVE offline bundle") });
  });

  it("refuses outputs inside the source tree and non-empty destinations", async () => {
    const { root, source, output, runner } = await fixture();
    await expect(
      prepareOfflineBundle({ output: path.join(source, "bundle"), sourceRoot: source }, runner),
    ).rejects.toThrow("outside the EVE source tree");
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, "existing.txt"), "do not overwrite\n");
    await expect(prepareOfflineBundle({ output, sourceRoot: source }, runner)).rejects.toThrow(
      "is not empty",
    );
    expect(await fs.readFile(path.join(root, "bundle", "existing.txt"), "utf8")).toBe(
      "do not overwrite\n",
    );
  });

  it("detects payload tampering", async () => {
    const { source, output, runner } = await fixture();
    await prepareOfflineBundle({ output, sourceRoot: source, skipBuild: true }, runner);
    await fs.appendFile(path.join(output, "eve-agent-1.0.0.tgz"), "tampered\n");
    await expect(
      execFileAsync(process.execPath, [
        path.join(output, "verify-offline-manifest.mjs"),
        output,
        await trustedManifestHash(output),
      ]),
    ).rejects.toMatchObject({ stderr: expect.stringContaining("checksum mismatch") });
  });

  it("streams bundled model blobs through manifest creation and verification", async () => {
    const { root, source, output, runner } = await fixture();
    const models = path.join(root, "ollama-models");
    await fs.mkdir(path.join(models, "blobs"), { recursive: true });
    await fs.writeFile(path.join(models, "blobs", "sha256-fixture"), Buffer.alloc(8 * 1024 * 1024));

    const result = await prepareOfflineBundle(
      {
        output,
        sourceRoot: source,
        skipBuild: true,
        includeModels: true,
        ollamaModels: models,
      },
      runner,
    );

    expect(result.modelsBundled).toBe(true);
    await expect(
      execFileAsync(process.execPath, [
        path.join(output, "verify-offline-manifest.mjs"),
        output,
        await trustedManifestHash(output),
      ]),
    ).resolves.toMatchObject({ stdout: expect.stringContaining("Verified EVE offline bundle") });
  });
});

describe("offline local-model configuration", () => {
  it("enables Ollama and preserves existing fallback and provider models", () => {
    const result = buildOfflineOllamaConfig(
      {
        agents: { defaults: { model: { primary: "openai/gpt", fallbacks: ["other/model"] } } },
        models: {
          providers: {
            ollama: {
              baseUrl: "http://old:11434",
              api: "ollama",
              models: [
                {
                  id: "existing",
                  name: "Existing",
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 8192,
                  maxTokens: 2048,
                },
              ],
            },
          },
        },
      },
      { model: "ollama/qwen3:8b", baseUrl: "http://localhost:11434/v1/" },
    );
    expect(result.agents?.defaults?.model).toEqual({
      primary: "ollama/qwen3:8b",
      fallbacks: ["other/model"],
    });
    expect(result.models?.providers?.ollama?.baseUrl).toBe("http://localhost:11434");
    expect(result.models?.providers?.ollama?.models.map((model) => model.id)).toEqual(["existing"]);
    expect(result.plugins?.entries?.ollama?.enabled).toBe(true);
  });
});
