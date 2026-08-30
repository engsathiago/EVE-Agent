import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerOfflineCommand } from "./register.offline.js";

const mocks = vi.hoisted(() => ({
  bundle: vi.fn(),
  configure: vi.fn(),
  status: vi.fn(),
  runtime: { log: vi.fn(), error: vi.fn(), exit: vi.fn() },
}));

vi.mock("../../commands/offline.js", () => ({
  offlineBundleCommand: mocks.bundle,
  offlineConfigureCommand: mocks.configure,
  offlineStatusCommand: mocks.status,
}));

vi.mock("../../runtime.js", () => ({ defaultRuntime: mocks.runtime }));

describe("registerOfflineCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bundle.mockResolvedValue(undefined);
    mocks.configure.mockResolvedValue(undefined);
    mocks.status.mockResolvedValue(undefined);
  });

  async function run(args: string[]) {
    const program = new Command();
    registerOfflineCommand(program);
    await program.parseAsync(args, { from: "user" });
  }

  it("forwards bundle portability options", async () => {
    await run([
      "offline",
      "bundle",
      "--output",
      "/media/eve",
      "--skip-build",
      "--include-models",
      "--ollama-models",
      "/models",
      "--include-ollama",
      "--ollama-binary",
      "/bin/ollama",
      "--json",
    ]);
    expect(mocks.bundle).toHaveBeenCalledWith(mocks.runtime, {
      output: "/media/eve",
      skipBuild: true,
      includeModels: true,
      ollamaModels: "/models",
      includeOllama: true,
      ollamaBinary: "/bin/ollama",
      json: true,
    });
  });

  it("forwards the local Ollama status endpoint", async () => {
    await run(["offline", "status", "--base-url", "http://localhost:11434/v1", "--json"]);
    expect(mocks.status).toHaveBeenCalledWith(mocks.runtime, {
      baseUrl: "http://localhost:11434/v1",
      json: true,
    });
  });

  it("forwards local-model configuration", async () => {
    await run([
      "offline",
      "configure",
      "--model",
      "qwen3:8b",
      "--base-url",
      "http://ollama:11434",
      "--allow-missing",
      "--json",
    ]);
    expect(mocks.configure).toHaveBeenCalledWith(mocks.runtime, {
      model: "qwen3:8b",
      baseUrl: "http://ollama:11434",
      allowMissing: true,
      json: true,
    });
  });
});
