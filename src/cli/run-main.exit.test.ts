// Run main exit tests cover process exit behavior for CLI failures.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { CommanderError } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loggingState } from "../logging/state.js";
import { withEnvAsync } from "../test-utils/env.js";
import { getGatewayRunRuntimeHooks } from "./gateway-cli/runtime-hooks.js";
import type { RootHelpRenderOptions } from "./program/root-help.js";
import { runCli, shouldStartProxyForCli } from "./run-main.js";

type ConfigSnapshotStub = {
  exists: boolean;
  hash?: string;
  path?: string;
  raw?: string | null;
  valid: boolean;
  sourceConfig: Record<string, unknown>;
};

type ConfigSnapshotReadOptionsStub = {
  isolateEnv?: boolean;
  observe?: boolean;
  recoverSuspicious?: boolean;
  allowSuspiciousRecovery?: (
    candidate: Record<string, unknown>,
    current: Record<string, unknown>,
  ) => boolean | Promise<boolean>;
};

const tryRouteCliMock = vi.hoisted(() => vi.fn());
const loadDotEnvMock = vi.hoisted(() => vi.fn());
const normalizeEnvMock = vi.hoisted(() => vi.fn());
const pinConfigDirMock = vi.hoisted(() => vi.fn());
const pinRuntimePathsMock = vi.hoisted(() => vi.fn());
const ensurePathMock = vi.hoisted(() => vi.fn());
const assertRuntimeMock = vi.hoisted(() => vi.fn());
const closeActiveMemorySearchManagersMock = vi.hoisted(() => vi.fn(async () => {}));
const hasMemoryRuntimeMock = vi.hoisted(() => vi.fn(() => false));
const listRegisteredAgentHarnessesMock = vi.hoisted(() => vi.fn((): unknown[] => []));
const disposeRegisteredAgentHarnessesMock = vi.hoisted(() => vi.fn(async () => {}));
const ensureTaskRegistryReadyMock = vi.hoisted(() => vi.fn());
const startTaskRegistryMaintenanceMock = vi.hoisted(() => vi.fn());
const outputRootHelpMock = vi.hoisted(() => vi.fn());
const outputPrecomputedRootHelpTextMock = vi.hoisted(() => vi.fn(() => false));
const outputPrecomputedBrowserHelpTextMock = vi.hoisted(() => vi.fn(() => false));
const outputPrecomputedSecretsHelpTextMock = vi.hoisted(() => vi.fn(() => false));
const outputPrecomputedNodesHelpTextMock = vi.hoisted(() => vi.fn(() => false));
const outputPrecomputedSubcommandHelpTextMock = vi.hoisted(() => vi.fn(() => false));
const loadRootHelpRenderOptionsForConfigSensitivePluginsMock = vi.hoisted(() =>
  vi.fn<() => Promise<RootHelpRenderOptions | null>>(async () => null),
);
const tryOutputSetupOnboardConfigureHelpMock = vi.hoisted(() => vi.fn(async () => true));
const buildProgramMock = vi.hoisted(() => vi.fn());
const getProgramContextMock = vi.hoisted(() => vi.fn(() => null));
const registerCoreCliByNameMock = vi.hoisted(() => vi.fn());
const registerSubCliByNameMock = vi.hoisted(() => vi.fn());
const registerPluginCliCommandsFromValidatedConfigMock = vi.hoisted(() => vi.fn(async () => ({})));
const resolvePluginCliRootOwnerIdsMock = vi.hoisted(() => vi.fn());
const resolveManifestCommandAliasOwnerMock = vi.hoisted(() => vi.fn());
const resolveManifestToolOwnerMock = vi.hoisted(() => vi.fn());
const resolveManifestCliCommandSurfaceOwnerMock = vi.hoisted(() => vi.fn());
const restoreTerminalStateMock = vi.hoisted(() => vi.fn());
const hasEnvHttpProxyAgentConfiguredMock = vi.hoisted(() => vi.fn(() => false));
const ensureGlobalUndiciEnvProxyDispatcherMock = vi.hoisted(() => vi.fn());
const readConfigFileSnapshotMock = vi.hoisted(() =>
  vi.fn<(options?: ConfigSnapshotReadOptionsStub) => Promise<ConfigSnapshotStub>>(async () => ({
    exists: true,
    valid: true,
    sourceConfig: { gateway: { mode: "local" } },
  })),
);
const setupWizardCommandMock = vi.hoisted(() => vi.fn(async () => {}));
const runCrestodianMock = vi.hoisted(() =>
  vi.fn<(options?: unknown) => Promise<void>>(async () => {}),
);
const commanderParseAsyncMock = vi.hoisted(() => vi.fn(async () => {}));
type GatewayRunCommandHooks = {
  beforeRun?: (opts: { reset?: boolean }) => Promise<void>;
};
type CliExecutionBootstrapOptions = {
  beforeStateMigrations?: () => Promise<boolean>;
};
const addGatewayRunCommandMock = vi.hoisted(() =>
  vi.fn<(command: unknown, hooks?: GatewayRunCommandHooks) => unknown>((command) => command),
);
const ensureCliExecutionBootstrapMock = vi.hoisted(() =>
  vi.fn<(_opts: CliExecutionBootstrapOptions) => Promise<void>>(async () => {}),
);
const emitCliBannerMock = vi.hoisted(() => vi.fn());
const enableConsoleCaptureMock = vi.hoisted(() => vi.fn());
const progressDoneMock = vi.hoisted(() => vi.fn());
const createCliProgressMock = vi.hoisted(() =>
  vi.fn(() => ({
    done: progressDoneMock,
  })),
);
const loadConfigMock = vi.hoisted(() => vi.fn(() => ({})));
const startProxyMock = vi.hoisted(() =>
  vi.fn<(config: unknown) => Promise<unknown>>(async () => null),
);
const stopProxyMock = vi.hoisted(() => vi.fn<(handle: unknown) => Promise<void>>(async () => {}));
const maybeRunCliInContainerMock = vi.hoisted(() =>
  vi.fn<
    (argv: string[]) => { handled: true; exitCode: number } | { handled: false; argv: string[] }
  >((argv: string[]) => ({ handled: false, argv })),
);

function requireRunCrestodianOptions(index = 0): { onReady?: unknown } {
  const call = runCrestodianMock.mock.calls[index];
  if (!call) {
    throw new Error(`expected runCrestodian call ${index}`);
  }
  expect(typeof call[0]).toBe("object");
  if (typeof call[0] !== "object" || call[0] === null) {
    throw new Error(`expected runCrestodian call ${index} to receive options`);
  }
  return call[0] as { onReady?: unknown };
}

vi.mock("commander", () => {
  class MockCommanderError extends Error {
    exitCode: number;
    code: string;

    constructor(exitCode: number, code: string, message: string) {
      super(message);
      this.exitCode = exitCode;
      this.code = code;
    }
  }

  class MockCommand {
    name = vi.fn(() => this);
    enablePositionalOptions = vi.fn(() => this);
    option = vi.fn(() => this);
    exitOverride = vi.fn(() => this);
    description = vi.fn(() => this);
    command = vi.fn(() => new MockCommand());
    parseAsync = commanderParseAsyncMock;
  }

  return {
    Command: MockCommand,
    CommanderError: MockCommanderError,
  };
});

vi.mock("./route.js", () => ({
  tryRouteCli: tryRouteCliMock,
}));

vi.mock("./gateway-cli/run-command.js", () => ({
  addGatewayRunCommand: addGatewayRunCommandMock,
}));

vi.mock("./command-execution-startup.js", () => ({
  ensureCliExecutionBootstrap: ensureCliExecutionBootstrapMock,
}));

vi.mock("../version.js", () => ({
  VERSION: "9.9.9-test",
}));

vi.mock("./banner.js", () => ({
  emitCliBanner: emitCliBannerMock,
}));

vi.mock("../logging.js", async () => ({
  ...(await vi.importActual<typeof import("../logging.js")>("../logging.js")),
  enableConsoleCapture: enableConsoleCaptureMock,
}));

vi.mock("./container-target.js", () => ({
  maybeRunCliInContainer: maybeRunCliInContainerMock,
  parseCliContainerArgs: (argv: string[]) => ({ ok: true, container: null, argv }),
}));

vi.mock("./dotenv.js", () => ({
  loadCliDotEnv: loadDotEnvMock,
}));

vi.mock("../infra/env.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../infra/env.js")>()),
  isTruthyEnvValue: (value?: string) =>
    typeof value === "string" && ["1", "on", "true", "yes"].includes(value.trim().toLowerCase()),
  normalizeEnv: normalizeEnvMock,
}));

vi.mock("../config/paths.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../config/paths.js")>()),
  pinRuntimePaths: pinRuntimePathsMock,
}));

vi.mock("../utils.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils.js")>()),
  pinConfigDir: pinConfigDirMock,
}));

vi.mock("../infra/path-env.js", () => ({
  ensureEVECliOnPath: ensurePathMock,
}));

vi.mock("../infra/runtime-guard.js", () => ({
  assertSupportedRuntime: assertRuntimeMock,
}));

vi.mock("../plugins/memory-runtime.js", () => ({
  closeActiveMemorySearchManagers: closeActiveMemorySearchManagersMock,
}));

vi.mock("../plugins/memory-state.js", () => ({
  hasMemoryRuntime: hasMemoryRuntimeMock,
}));

vi.mock("../agents/harness/registry.js", () => ({
  listRegisteredAgentHarnesses: listRegisteredAgentHarnessesMock,
  disposeRegisteredAgentHarnesses: disposeRegisteredAgentHarnessesMock,
}));

vi.mock("../tasks/task-registry.js", () => ({
  ensureTaskRegistryReady: ensureTaskRegistryReadyMock,
}));

vi.mock("../tasks/task-registry.maintenance.js", () => ({
  startTaskRegistryMaintenance: startTaskRegistryMaintenanceMock,
}));

vi.mock("./program/root-help.js", () => ({
  outputRootHelp: outputRootHelpMock,
}));

vi.mock("./root-help-metadata.js", () => ({
  outputPrecomputedBrowserHelpText: outputPrecomputedBrowserHelpTextMock,
  outputPrecomputedNodesHelpText: outputPrecomputedNodesHelpTextMock,
  outputPrecomputedRootHelpText: outputPrecomputedRootHelpTextMock,
  outputPrecomputedSecretsHelpText: outputPrecomputedSecretsHelpTextMock,
  outputPrecomputedSubcommandHelpText: outputPrecomputedSubcommandHelpTextMock,
}));

vi.mock("./root-help-live-config.js", () => ({
  loadRootHelpRenderOptionsForConfigSensitivePlugins:
    loadRootHelpRenderOptionsForConfigSensitivePluginsMock,
}));

vi.mock("./setup-onboard-configure-help-fast-path.js", () => ({
  tryOutputSetupOnboardConfigureHelp: tryOutputSetupOnboardConfigureHelpMock,
}));

vi.mock("./program.js", () => ({
  buildProgram: buildProgramMock,
}));

vi.mock("./program/program-context.js", () => ({
  getProgramContext: getProgramContextMock,
}));

vi.mock("./program/command-registry.js", () => ({
  registerCoreCliByName: registerCoreCliByNameMock,
}));

vi.mock("./program/register.subclis.js", () => ({
  registerSubCliByName: registerSubCliByNameMock,
}));

vi.mock("../plugins/cli.js", () => ({
  registerPluginCliCommandsFromValidatedConfig: registerPluginCliCommandsFromValidatedConfigMock,
}));

vi.mock("../plugins/cli-registry-loader.js", () => ({
  resolvePluginCliRootOwnerIds: resolvePluginCliRootOwnerIdsMock,
}));

vi.mock("../plugins/manifest-command-aliases.runtime.js", () => ({
  resolveManifestCliCommandSurfaceOwner: resolveManifestCliCommandSurfaceOwnerMock,
  resolveManifestCommandAliasOwner: resolveManifestCommandAliasOwnerMock,
  resolveManifestToolOwner: resolveManifestToolOwnerMock,
}));

vi.mock("../../packages/terminal-core/src/restore.js", () => ({
  restoreTerminalState: restoreTerminalStateMock,
}));

vi.mock("../infra/net/proxy-env.js", () => ({
  hasEnvHttpProxyAgentConfigured: hasEnvHttpProxyAgentConfiguredMock,
}));

vi.mock("../infra/net/undici-global-dispatcher.js", () => ({
  ensureGlobalUndiciEnvProxyDispatcher: ensureGlobalUndiciEnvProxyDispatcherMock,
}));

vi.mock("../config/config.js", () => ({
  readConfigFileSnapshot: readConfigFileSnapshotMock,
}));

vi.mock("../commands/onboard.js", () => ({
  setupWizardCommand: setupWizardCommandMock,
}));

vi.mock("../crestodian/crestodian.js", () => ({
  runCrestodian: runCrestodianMock,
}));

vi.mock("./progress.js", () => ({
  createCliProgress: createCliProgressMock,
}));

vi.mock("../config/io.js", () => ({
  readBestEffortConfig: loadConfigMock,
}));

vi.mock("../infra/net/proxy/proxy-lifecycle.js", () => ({
  startProxy: startProxyMock,
  stopProxy: stopProxyMock,
}));

function makeProxyHandle() {
  return {
    proxyUrl: "http://127.0.0.1:19876",
    stop: vi.fn(async () => {}),
    kill: vi.fn(),
  };
}

async function withInteractiveTty(fn: () => Promise<void>): Promise<void> {
  const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
  Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
  try {
    await fn();
  } finally {
    if (stdinDescriptor) {
      Object.defineProperty(process.stdin, "isTTY", stdinDescriptor);
    } else {
      Reflect.deleteProperty(process.stdin, "isTTY");
    }
    if (stdoutDescriptor) {
      Object.defineProperty(process.stdout, "isTTY", stdoutDescriptor);
    } else {
      Reflect.deleteProperty(process.stdout, "isTTY");
    }
  }
}

describe("runCli exit behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readConfigFileSnapshotMock.mockResolvedValue({
      exists: true,
      valid: true,
      sourceConfig: { gateway: { mode: "local" } },
    });
    hasMemoryRuntimeMock.mockReturnValue(false);
    listRegisteredAgentHarnessesMock.mockReturnValue([]);
    outputPrecomputedBrowserHelpTextMock.mockReturnValue(false);
    outputPrecomputedNodesHelpTextMock.mockReturnValue(false);
    outputPrecomputedRootHelpTextMock.mockReturnValue(false);
    outputPrecomputedSecretsHelpTextMock.mockReturnValue(false);
    outputPrecomputedSubcommandHelpTextMock.mockReturnValue(false);
    loadRootHelpRenderOptionsForConfigSensitivePluginsMock.mockResolvedValue(null);
    tryOutputSetupOnboardConfigureHelpMock.mockResolvedValue(true);
    hasEnvHttpProxyAgentConfiguredMock.mockReturnValue(false);
    loadConfigMock.mockReturnValue({});
    startProxyMock.mockResolvedValue(null);
    stopProxyMock.mockResolvedValue(undefined);
    getProgramContextMock.mockReturnValue(null);
    resolvePluginCliRootOwnerIdsMock.mockImplementation(
      ({ primaryCommand }: { primaryCommand?: string }) =>
        primaryCommand === "googlemeet" ? ["google-meet"] : [],
    );
    resolveManifestCommandAliasOwnerMock.mockReturnValue(undefined);
    resolveManifestToolOwnerMock.mockReturnValue(undefined);
    resolveManifestCliCommandSurfaceOwnerMock.mockReturnValue(undefined);
    delete process.env.EVE_DISABLE_CLI_STARTUP_HELP_FAST_PATH;
    delete process.env.EVE_HIDE_BANNER;
    loggingState.forceConsoleToStderr = false;
  });

  it("does not force process.exit after successful routed command", async () => {
    tryRouteCliMock.mockResolvedValueOnce(true);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`unexpected process.exit(${String(code)})`);
    }) as typeof process.exit);

    await runCli(["node", "eve", "status"]);

    expect(maybeRunCliInContainerMock).toHaveBeenCalledWith(["node", "eve", "status"]);
    expect(tryRouteCliMock).toHaveBeenCalledWith(["node", "eve", "status"]);
    expect(closeActiveMemorySearchManagersMock).not.toHaveBeenCalled();
    expect(disposeRegisteredAgentHarnessesMock).not.toHaveBeenCalled();
    expect(ensureTaskRegistryReadyMock).not.toHaveBeenCalled();
    expect(startTaskRegistryMaintenanceMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("disposes registered harnesses after full CLI command completion", async () => {
    listRegisteredAgentHarnessesMock.mockReturnValueOnce([{ harness: { id: "codex" } }]);
    tryRouteCliMock.mockResolvedValueOnce(false);
    const parseAsync = vi.fn().mockResolvedValueOnce(undefined);
    buildProgramMock.mockReturnValueOnce({
      commands: [{ name: () => "agent", aliases: () => [] }],
      parseAsync,
    });

    await runCli(["node", "eve", "agent", "--local"]);

    expect(parseAsync).toHaveBeenCalledWith(["node", "eve", "agent", "--local"]);
    expect(disposeRegisteredAgentHarnessesMock).toHaveBeenCalledTimes(1);
  });

  it("shows the standard spinner while loading the full CLI", async () => {
    tryRouteCliMock.mockResolvedValueOnce(false);
    const parseAsync = vi.fn().mockResolvedValueOnce(undefined);
    buildProgramMock.mockReturnValueOnce({
      commands: [{ name: () => "config", aliases: () => [] }],
      parseAsync,
    });

    await runCli(["node", "eve", "config"]);

    expect(createCliProgressMock).toHaveBeenCalledWith({
      label: "Loading EVE CLI…",
      indeterminate: true,
      delayMs: 0,
    });
    expect(progressDoneMock).toHaveBeenCalledTimes(1);
  });

  it("suppresses startup progress for json output commands before full CLI parsing", async () => {
    tryRouteCliMock.mockResolvedValueOnce(false);
    const parseAsync = vi.fn().mockResolvedValueOnce(undefined);
    buildProgramMock.mockReturnValueOnce({
      commands: [{ name: () => "sessions", aliases: () => [] }],
      parseAsync,
    });

    await runCli(["node", "eve", "sessions", "--json", "--limit", "all"]);

    expect(createCliProgressMock).toHaveBeenCalledWith({
      label: "Loading EVE CLI…",
      indeterminate: true,
      delayMs: 0,
      enabled: false,
    });
    expect(parseAsync).toHaveBeenCalledWith([
      "node",
      "eve",
      "sessions",
      "--json",
      "--limit",
      "all",
    ]);
    expect(progressDoneMock).toHaveBeenCalledTimes(1);
  });

  it("pauses non-tty stdin after full CLI command completion", async () => {
    tryRouteCliMock.mockResolvedValueOnce(false);
    const parseAsync = vi.fn().mockResolvedValueOnce(undefined);
    buildProgramMock.mockReturnValueOnce({
      commands: [{ name: () => "channels", aliases: () => [] }],
      parseAsync,
    });
    const stdinTty = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: false });
    const pauseSpy = vi.spyOn(process.stdin, "pause").mockImplementation(() => process.stdin);

    try {
      await runCli(["node", "eve", "channels"]);

      expect(parseAsync).toHaveBeenCalledWith(["node", "eve", "channels"]);
      expect(pauseSpy).toHaveBeenCalledTimes(1);
    } finally {
      pauseSpy.mockRestore();
      if (stdinTty) {
        Object.defineProperty(process.stdin, "isTTY", stdinTty);
      } else {
        Reflect.deleteProperty(process.stdin, "isTTY");
      }
    }
  });

  it("emits the startup banner before gateway foreground fast-path startup", async () => {
    await runCli(["node", "eve", "gateway", "--force"]);

    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(emitCliBannerMock).toHaveBeenCalledWith("9.9.9-test", {
      argv: ["node", "eve", "gateway", "--force"],
    });
    expect(addGatewayRunCommandMock).toHaveBeenCalledTimes(2);
    expect(commanderParseAsyncMock).toHaveBeenCalledWith([
      "node",
      "eve",
      "gateway",
      "--force",
    ]);
  });

  it("installs console capture before parsing the gateway foreground fast path", async () => {
    await runCli(["node", "eve", "gateway", "--force"]);

    expect(enableConsoleCaptureMock).toHaveBeenCalledTimes(1);
    expect(commanderParseAsyncMock).toHaveBeenCalledTimes(1);
    const captureOrder = enableConsoleCaptureMock.mock.invocationCallOrder[0] ?? 0;
    const parseOrder = commanderParseAsyncMock.mock.invocationCallOrder[0] ?? 0;
    expect(captureOrder).toBeGreaterThan(0);
    expect(parseOrder).toBeGreaterThan(captureOrder);
  });

  it("configures the gateway foreground fast path with the standard CLI bootstrap", async () => {
    await runCli(["node", "eve", "gateway", "--force"]);

    expect(readConfigFileSnapshotMock.mock.calls).toEqual([[{ isolateEnv: true, observe: false }]]);
    const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
      | { beforeRun?: (opts: { reset?: boolean }) => Promise<void> }
      | undefined;
    await hooks?.beforeRun?.({});

    expect(ensureCliExecutionBootstrapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeStateMigrations: expect.any(Function),
        commandPath: ["gateway"],
        loadPlugins: false,
      }),
    );
    expect(readConfigFileSnapshotMock).toHaveBeenCalledWith({
      isolateEnv: true,
      recoverSuspicious: true,
      allowSuspiciousRecovery: expect.any(Function),
    });
    const recoveryOrder = readConfigFileSnapshotMock.mock.invocationCallOrder[2] ?? 0;
    const bootstrapOrder = ensureCliExecutionBootstrapMock.mock.invocationCallOrder[0] ?? 0;
    expect(recoveryOrder).toBeGreaterThan(0);
    expect(bootstrapOrder).toBeGreaterThan(recoveryOrder);
  });

  it("rechecks the effective guarded config before automatic startup migrations", async () => {
    readConfigFileSnapshotMock.mockResolvedValue({
      exists: true,
      hash: "guarded",
      path: "/tmp/eve.json",
      raw: "{}",
      valid: true,
      sourceConfig: {
        cron: { store: "/tmp/included-a.json" },
        gateway: { mode: "local" },
      },
    });
    await runCli(["node", "eve", "gateway"]);
    const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
      | { beforeRun?: (opts: { reset?: boolean }) => Promise<void> }
      | undefined;
    await hooks?.beforeRun?.({});
    const beforeStateMigrations = (
      ensureCliExecutionBootstrapMock.mock.calls[0]?.[0] as
        | { beforeStateMigrations?: () => Promise<boolean> }
        | undefined
    )?.beforeStateMigrations;
    readConfigFileSnapshotMock.mockResolvedValue({
      exists: true,
      hash: "guarded",
      path: "/tmp/eve.json",
      raw: "{}",
      valid: true,
      sourceConfig: {
        cron: { store: "/tmp/included-b.json" },
        gateway: { mode: "local" },
      },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${String(code)}`);
    }) as typeof process.exit);
    try {
      await expect(beforeStateMigrations?.()).rejects.toThrow("exit:1");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("changed during startup"));
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it.each([
    {
      name: "automatic startup migrations",
      flags: [],
      marker: undefined,
      override: undefined,
      expectedAction: "run automatic gateway startup migrations",
      expectedExitCode: 1,
    },
    {
      name: "service-mode startup",
      flags: [],
      marker: "gateway",
      override: "1",
      expectedAction: "start the gateway service",
      expectedExitCode: 78,
    },
    {
      name: "forced port cleanup",
      flags: ["--force"],
      marker: undefined,
      override: undefined,
      expectedAction: "force-kill gateway port listeners",
      expectedExitCode: 1,
    },
    {
      name: "dev reset",
      flags: ["--dev", "--reset"],
      marker: undefined,
      override: undefined,
      expectedAction: "reset the dev gateway state",
      expectedExitCode: 1,
    },
    {
      name: "forced dev reset",
      flags: ["--dev", "--reset", "--force"],
      marker: undefined,
      override: undefined,
      expectedAction: "reset the dev gateway state",
      expectedExitCode: 1,
    },
  ])("blocks future-config $name before gateway bootstrap", async (params) => {
    readConfigFileSnapshotMock.mockResolvedValue({
      exists: true,
      valid: true,
      sourceConfig: { meta: { lastTouchedVersion: "9999.1.1" } },
    });
    const previousMarker = process.env.EVE_SERVICE_MARKER;
    const previousOverride = process.env.EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS;
    if (params.marker) {
      process.env.EVE_SERVICE_MARKER = params.marker;
    } else {
      delete process.env.EVE_SERVICE_MARKER;
    }
    if (params.override) {
      process.env.EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS = params.override;
    } else {
      delete process.env.EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS;
    }
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${String(code)}`);
    }) as typeof process.exit);
    try {
      await expect(runCli(["node", "eve", "gateway", ...params.flags])).rejects.toThrow(
        `exit:${params.expectedExitCode}`,
      );
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(params.expectedAction));
      expect(ensureCliExecutionBootstrapMock).not.toHaveBeenCalled();
      expect(readConfigFileSnapshotMock.mock.calls).toEqual([
        [{ isolateEnv: true, observe: false }],
      ]);
      if (params.marker) {
        expect(process.env.EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS).toBeUndefined();
      }
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
      if (previousMarker === undefined) {
        delete process.env.EVE_SERVICE_MARKER;
      } else {
        process.env.EVE_SERVICE_MARKER = previousMarker;
      }
      if (previousOverride === undefined) {
        delete process.env.EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS;
      } else {
        process.env.EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS = previousOverride;
      }
    }
  });

  it("blocks and revokes the destructive override when selected config declares service mode", async () => {
    readConfigFileSnapshotMock.mockResolvedValue({
      exists: true,
      valid: true,
      sourceConfig: {
        env: { vars: { EVE_SERVICE_MARKER: "gateway" } },
        meta: { lastTouchedVersion: "9999.1.1" },
      },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${String(code)}`);
    }) as typeof process.exit);
    try {
      await withEnvAsync(
        {
          EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS: "1",
          EVE_SERVICE_MARKER: undefined,
        },
        async () => {
          await expect(runCli(["node", "eve", "gateway"])).rejects.toThrow("exit:78");
          expect(process.env.EVE_SERVICE_MARKER).toBeUndefined();
          expect(process.env.EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS).toBeUndefined();
          expect(ensureCliExecutionBootstrapMock).not.toHaveBeenCalled();
        },
      );
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("ignores service mode declared by an invalid selected config", async () => {
    readConfigFileSnapshotMock.mockResolvedValue({
      exists: true,
      valid: false,
      sourceConfig: {
        env: { vars: { EVE_SERVICE_MARKER: "gateway" } },
        meta: { lastTouchedVersion: "9999.1.1" },
      },
    });

    await withEnvAsync(
      {
        EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS: "1",
        EVE_SERVICE_MARKER: undefined,
      },
      async () => {
        await runCli(["node", "eve", "gateway"]);

        expect(process.env.EVE_SERVICE_MARKER).toBeUndefined();
        expect(process.env.EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS).toBe("1");
      },
    );
  });

  it("guards the config selected by trusted global dotenv before the default config", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "eve-gateway-global-selection-"));
    const stateDir = path.join(homeDir, ".eve");
    const selectedConfigPath = path.join(stateDir, "selected.json");
    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(
      path.join(stateDir, ".env"),
      [
        `EVE_CONFIG_PATH=${selectedConfigPath}`,
        "EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS=1",
        "",
      ].join("\n"),
    );
    try {
      await withEnvAsync(
        {
          HOME: homeDir,
          EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS: undefined,
          EVE_CONFIG_PATH: undefined,
          EVE_HOME: homeDir,
          EVE_STATE_DIR: undefined,
        },
        async () => {
          readConfigFileSnapshotMock.mockImplementation(async () =>
            process.env.EVE_CONFIG_PATH === selectedConfigPath
              ? {
                  exists: true,
                  valid: true,
                  sourceConfig: { gateway: { mode: "local" } },
                }
              : {
                  exists: true,
                  valid: true,
                  sourceConfig: { meta: { lastTouchedVersion: "9999.1.1" } },
                },
          );

          await runCli(["node", "eve", "gateway"]);

          expect(process.env.EVE_CONFIG_PATH).toBe(selectedConfigPath);
          expect(process.env.EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS).toBeUndefined();
          expect(readConfigFileSnapshotMock).toHaveBeenCalledOnce();
        },
      );
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("loads state dotenv before a custom config-root fallback", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "eve-gateway-config-env-"));
    const stateDir = path.join(homeDir, ".eve");
    const configDir = path.join(homeDir, "profile");
    const configPath = path.join(configDir, "eve.json");
    await fs.mkdir(stateDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(stateDir, ".env"), "EVE_GATEWAY_TOKEN=state-token\n");
    await fs.writeFile(
      path.join(configDir, ".env"),
      [
        "EVE_GATEWAY_PASSWORD=config-root-password",
        "EVE_GATEWAY_TOKEN=config-root-token",
        "",
      ].join("\n"),
    );
    try {
      await withEnvAsync(
        {
          HOME: homeDir,
          EVE_CONFIG_PATH: configPath,
          EVE_GATEWAY_PASSWORD: undefined,
          EVE_GATEWAY_TOKEN: undefined,
          EVE_HOME: homeDir,
          EVE_STATE_DIR: undefined,
        },
        async () => {
          await runCli(["node", "eve", "gateway"]);

          expect(process.env.EVE_GATEWAY_TOKEN).toBe("state-token");
          expect(process.env.EVE_GATEWAY_PASSWORD).toBe("config-root-password");
        },
      );
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("loads and repins a legacy state dotenv after automatic state migration", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "eve-gateway-legacy-env-"));
    const legacyStateDir = path.join(homeDir, ".clawdbot");
    const newStateDir = path.join(homeDir, ".eve");
    await fs.mkdir(legacyStateDir, { recursive: true });
    await fs.writeFile(path.join(legacyStateDir, ".env"), "EVE_GATEWAY_TOKEN=legacy-token\n");
    try {
      await withEnvAsync(
        {
          HOME: homeDir,
          EVE_CONFIG_PATH: undefined,
          EVE_GATEWAY_TOKEN: undefined,
          EVE_HOME: homeDir,
          EVE_STATE_DIR: undefined,
          EVE_TEST_FAST: undefined,
        },
        async () => {
          ensureCliExecutionBootstrapMock.mockImplementationOnce(async () => {
            await fs.rename(legacyStateDir, newStateDir);
          });
          await runCli(["node", "eve", "gateway"]);
          const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
            | { beforeRun?: (opts: { reset?: boolean }) => Promise<void> }
            | undefined;
          await hooks?.beforeRun?.({});

          expect(process.env.EVE_GATEWAY_TOKEN).toBe("legacy-token");
          await expect(fs.access(path.join(newStateDir, ".env"))).resolves.toBeUndefined();
          const bootstrapOrder = ensureCliExecutionBootstrapMock.mock.invocationCallOrder[0] ?? 0;
          const finalPinOrder = pinRuntimePathsMock.mock.invocationCallOrder.at(-1) ?? 0;
          expect(finalPinOrder).toBeGreaterThan(bootstrapOrder);
        },
      );
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("blocks a future-config recovery candidate before destructive gateway reset", async () => {
    const currentSnapshot = {
      exists: true,
      valid: true,
      sourceConfig: { gateway: { mode: "local" } },
    };
    readConfigFileSnapshotMock.mockImplementation(async (options) => {
      if (options?.recoverSuspicious) {
        await options?.allowSuspiciousRecovery?.(
          {
            meta: { lastTouchedVersion: "9999.1.1" },
            gateway: { mode: "local" },
          },
          currentSnapshot.sourceConfig,
        );
      }
      return currentSnapshot;
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${String(code)}`);
    }) as typeof process.exit);
    try {
      await runCli(["node", "eve", "gateway", "--dev", "--reset"]);
      const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
        | { beforeRun?: (opts: { reset?: boolean }) => Promise<void> }
        | undefined;
      await expect(hooks?.beforeRun?.({ reset: true })).rejects.toThrow("exit:1");
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Refusing to reset the dev gateway state"),
      );
      expect(ensureCliExecutionBootstrapMock).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("blocks a future current config before pre-bootstrap suspicious recovery", async () => {
    const currentSnapshot = {
      exists: true,
      valid: true,
      sourceConfig: { gateway: { mode: "local" } },
    };
    readConfigFileSnapshotMock.mockImplementation(async (options) => {
      if (options?.recoverSuspicious) {
        await options.allowSuspiciousRecovery?.(
          { gateway: { mode: "local" } },
          {
            meta: { lastTouchedVersion: "9999.1.1" },
            gateway: { mode: "local" },
          },
        );
      }
      return currentSnapshot;
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${String(code)}`);
    }) as typeof process.exit);
    try {
      await runCli(["node", "eve", "gateway"]);
      const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
        | { beforeRun?: (opts: { force?: boolean }) => Promise<void> }
        | undefined;
      await expect(hooks?.beforeRun?.({})).rejects.toThrow("exit:1");
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("run automatic gateway startup migrations"),
      );
      expect(ensureCliExecutionBootstrapMock).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("blocks a future service-mode candidate before pre-bootstrap suspicious recovery", async () => {
    const currentSnapshot = {
      exists: true,
      valid: true,
      sourceConfig: { gateway: { mode: "local" } },
    };
    readConfigFileSnapshotMock.mockImplementation(async (options) => {
      if (options?.recoverSuspicious) {
        await options.allowSuspiciousRecovery?.(
          {
            env: { vars: { EVE_SERVICE_MARKER: "gateway" } },
            gateway: { mode: "local" },
            meta: { lastTouchedVersion: "9999.1.1" },
          },
          { gateway: { mode: "local" } },
        );
      }
      return currentSnapshot;
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${String(code)}`);
    }) as typeof process.exit);
    try {
      await withEnvAsync(
        {
          EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS: "1",
          EVE_SERVICE_MARKER: undefined,
        },
        async () => {
          await runCli(["node", "eve", "gateway"]);
          const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
            | { beforeRun?: (opts: { force?: boolean }) => Promise<void> }
            | undefined;
          await expect(hooks?.beforeRun?.({})).rejects.toThrow("exit:78");
        },
      );
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("start the gateway service"));
      expect(ensureCliExecutionBootstrapMock).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("re-guards config env path selection until the gateway config is stable", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "eve-gateway-selection-"));
    try {
      await withEnvAsync(
        {
          HOME: homeDir,
          EVE_CONFIG_PATH: undefined,
          EVE_HOME: homeDir,
          EVE_STATE_DIR: undefined,
        },
        async () => {
          readConfigFileSnapshotMock.mockImplementation(async () => {
            if (process.env.EVE_CONFIG_PATH === "/tmp/eve-chain-c.json") {
              return {
                exists: true,
                valid: true,
                sourceConfig: { meta: { lastTouchedVersion: "9999.1.1" } },
              };
            }
            if (process.env.EVE_STATE_DIR === "/tmp/eve-chain-b") {
              return {
                exists: true,
                valid: true,
                sourceConfig: {
                  env: { vars: { EVE_CONFIG_PATH: "/tmp/eve-chain-c.json" } },
                  gateway: { mode: "local" },
                },
              };
            }
            return {
              exists: true,
              valid: true,
              sourceConfig: {
                env: { vars: { EVE_STATE_DIR: "/tmp/eve-chain-b" } },
                gateway: { mode: "local" },
              },
            };
          });
          const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
          const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`exit:${String(code)}`);
          }) as typeof process.exit);
          try {
            await expect(runCli(["node", "eve", "gateway"])).rejects.toThrow("exit:1");
            expect(errorSpy).toHaveBeenCalledWith(
              expect.stringContaining("run automatic gateway startup migrations"),
            );
            expect(ensureCliExecutionBootstrapMock).not.toHaveBeenCalled();
            expect(readConfigFileSnapshotMock).toHaveBeenCalledTimes(3);
          } finally {
            exitSpy.mockRestore();
            errorSpy.mockRestore();
          }
        },
      );
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("re-guards config changes to Termux home selectors", async () => {
    await withEnvAsync({ ANDROID_DATA: undefined, PREFIX: undefined }, async () => {
      readConfigFileSnapshotMock.mockImplementation(async () =>
        process.env.ANDROID_DATA === "/data" &&
        process.env.PREFIX === "/data/data/com.termux/files/usr"
          ? {
              exists: true,
              valid: true,
              sourceConfig: { meta: { lastTouchedVersion: "9999.1.1" } },
            }
          : {
              exists: true,
              valid: true,
              sourceConfig: {
                env: {
                  vars: {
                    ANDROID_DATA: "/data",
                    PREFIX: "/data/data/com.termux/files/usr",
                  },
                },
                gateway: { mode: "local" },
              },
            },
      );
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
        throw new Error(`exit:${String(code)}`);
      }) as typeof process.exit);
      try {
        await expect(runCli(["node", "eve", "gateway"])).rejects.toThrow("exit:1");
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining("run automatic gateway startup migrations"),
        );
        expect(readConfigFileSnapshotMock).toHaveBeenCalledTimes(2);
      } finally {
        exitSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });
  });

  it("drops credentials from configs superseded during state selection", async () => {
    await withEnvAsync(
      {
        EVE_GATEWAY_TOKEN: undefined,
        EVE_HOME: undefined,
        EVE_STATE_DIR: undefined,
      },
      async () => {
        readConfigFileSnapshotMock.mockImplementation(async () =>
          process.env.EVE_STATE_DIR === "/tmp/eve-selected-state"
            ? {
                exists: true,
                valid: true,
                sourceConfig: {
                  env: { vars: { EVE_GATEWAY_TOKEN: "selected-token" } },
                  gateway: { mode: "local" },
                },
              }
            : {
                exists: true,
                valid: true,
                sourceConfig: {
                  env: {
                    vars: {
                      EVE_GATEWAY_TOKEN: "superseded-token",
                      EVE_STATE_DIR: "/tmp/eve-selected-state",
                    },
                  },
                  gateway: { mode: "local" },
                },
              },
        );
        await runCli(["node", "eve", "gateway"]);

        const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
          | { beforeRun?: (opts: { force?: boolean }) => Promise<void> }
          | undefined;
        await hooks?.beforeRun?.({});

        expect(process.env.EVE_STATE_DIR).toBe("/tmp/eve-selected-state");
        expect(process.env.EVE_GATEWAY_TOKEN).toBe("selected-token");
        expect(ensureCliExecutionBootstrapMock).toHaveBeenCalledOnce();
      },
    );
  });

  it("re-guards config selection from a newly selected state dotenv", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "eve-gateway-dotenv-"));
    const futureConfigPath = path.join(stateDir, "future.json");
    await fs.writeFile(
      path.join(stateDir, ".env"),
      [
        `EVE_CONFIG_PATH=${futureConfigPath}`,
        "EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS=1",
        "",
      ].join("\n"),
    );
    try {
      await withEnvAsync(
        {
          EVE_CONFIG_PATH: undefined,
          EVE_HOME: undefined,
          EVE_STATE_DIR: undefined,
          EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS: undefined,
        },
        async () => {
          readConfigFileSnapshotMock.mockImplementation(async () => {
            if (process.env.EVE_CONFIG_PATH === futureConfigPath) {
              return {
                exists: true,
                valid: true,
                sourceConfig: { meta: { lastTouchedVersion: "9999.1.1" } },
              };
            }
            return {
              exists: true,
              valid: true,
              sourceConfig: {
                env: { vars: { EVE_STATE_DIR: stateDir } },
                gateway: { mode: "local" },
              },
            };
          });
          const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
          const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`exit:${String(code)}`);
          }) as typeof process.exit);
          try {
            await expect(runCli(["node", "eve", "gateway"])).rejects.toThrow("exit:1");
            expect(errorSpy).toHaveBeenCalledWith(
              expect.stringContaining("run automatic gateway startup migrations"),
            );
            expect(ensureCliExecutionBootstrapMock).not.toHaveBeenCalled();
            expect(readConfigFileSnapshotMock).toHaveBeenCalledTimes(2);
            expect(process.env.EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS).toBeUndefined();
          } finally {
            exitSpy.mockRestore();
            errorSpy.mockRestore();
          }
        },
      );
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it("re-inspects recovery after recovery changes config selection", async () => {
    await withEnvAsync({ EVE_CONFIG_PATH: undefined }, async () => {
      const selectedConfigPath = "/tmp/eve-recovered-selection.json";
      const currentSnapshot = {
        exists: true,
        valid: true,
        sourceConfig: { gateway: { mode: "local" } },
      };
      let recoveryReads = 0;
      readConfigFileSnapshotMock.mockImplementation(async (options) => {
        if (!options?.recoverSuspicious) {
          return currentSnapshot;
        }
        recoveryReads += 1;
        if (recoveryReads === 1) {
          const recoveredSnapshot = {
            exists: true,
            valid: true,
            sourceConfig: {
              env: { vars: { EVE_CONFIG_PATH: selectedConfigPath } },
              gateway: { mode: "local" },
            },
          };
          await options.allowSuspiciousRecovery?.(
            recoveredSnapshot.sourceConfig,
            currentSnapshot.sourceConfig,
          );
          return recoveredSnapshot;
        }
        await options.allowSuspiciousRecovery?.(
          {
            meta: { lastTouchedVersion: "9999.1.1" },
            gateway: { mode: "local" },
          },
          currentSnapshot.sourceConfig,
        );
        return currentSnapshot;
      });
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
        throw new Error(`exit:${String(code)}`);
      }) as typeof process.exit);
      try {
        await runCli(["node", "eve", "gateway"]);
        const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
          | { beforeRun?: (opts: { force?: boolean }) => Promise<void> }
          | undefined;
        await expect(hooks?.beforeRun?.({})).rejects.toThrow("exit:1");
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining("run automatic gateway startup migrations"),
        );
        expect(ensureCliExecutionBootstrapMock).not.toHaveBeenCalled();
        expect(recoveryReads).toBe(2);
      } finally {
        exitSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });
  });

  it("discards env from a config replaced by suspicious recovery", async () => {
    await withEnvAsync(
      { EVE_GATEWAY_TOKEN: undefined, EVE_PROXY_ACTIVE: undefined },
      async () => {
        const clobberedSnapshot = {
          exists: true,
          valid: true,
          sourceConfig: {
            env: { vars: { EVE_GATEWAY_TOKEN: "discarded-token" } },
            gateway: { mode: "local" },
          },
          hash: "clobbered",
          path: "/tmp/eve.json",
        };
        const recoveredSnapshot = {
          exists: true,
          valid: true,
          sourceConfig: { gateway: { mode: "local" } },
          hash: "recovered",
          path: "/tmp/eve.json",
        };
        const initialSnapshot = {
          exists: true,
          valid: true,
          sourceConfig: { gateway: { mode: "local" } },
          hash: "initial",
          path: "/tmp/eve.json",
        };
        let currentSnapshot = initialSnapshot;
        let recovered = false;
        readConfigFileSnapshotMock.mockImplementation(async (options) => {
          if (!options?.recoverSuspicious) {
            return recovered ? recoveredSnapshot : currentSnapshot;
          }
          recovered = true;
          await options.allowSuspiciousRecovery?.(
            recoveredSnapshot.sourceConfig,
            currentSnapshot.sourceConfig,
          );
          return recoveredSnapshot;
        });
        await runCli(["node", "eve", "gateway"]);

        currentSnapshot = clobberedSnapshot;
        process.env.EVE_PROXY_ACTIVE = "1";
        const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
          | { beforeRun?: (opts: { force?: boolean }) => Promise<void> }
          | undefined;
        await hooks?.beforeRun?.({});

        expect(process.env.EVE_GATEWAY_TOKEN).toBeUndefined();
        expect(process.env.EVE_PROXY_ACTIVE).toBe("1");
        expect(ensureCliExecutionBootstrapMock).toHaveBeenCalledOnce();
      },
    );
  });

  it("does not apply environment variables from invalid config snapshots", async () => {
    await withEnvAsync({ EVE_INCLUDE_ROOTS: undefined }, async () => {
      readConfigFileSnapshotMock.mockResolvedValue({
        exists: true,
        valid: false,
        sourceConfig: {
          env: { vars: { EVE_INCLUDE_ROOTS: "/tmp/eve-includes" } },
          gateway: { mode: "local" },
        },
      });

      await runCli(["node", "eve", "gateway"]);
      const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
        | { beforeRun?: (opts: { force?: boolean }) => Promise<void> }
        | undefined;
      await hooks?.beforeRun?.({});

      expect(process.env.EVE_INCLUDE_ROOTS).toBeUndefined();
      expect(readConfigFileSnapshotMock.mock.calls).toEqual([
        [{ isolateEnv: true, observe: false }],
        [{ isolateEnv: true, observe: false }],
      ]);
      expect(ensureCliExecutionBootstrapMock).not.toHaveBeenCalled();
    });
  });

  it("loads selected state dotenv before config env and environment normalization", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "eve-gateway-selected-env-"));
    const stateDir = path.join(homeDir, "state");
    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(path.join(stateDir, ".env"), "EVE_GATEWAY_TOKEN=state-token\n");
    try {
      await withEnvAsync(
        {
          HOME: homeDir,
          EVE_CONFIG_PATH: undefined,
          EVE_GATEWAY_TOKEN: undefined,
          EVE_HOME: homeDir,
          EVE_STATE_DIR: undefined,
        },
        async () => {
          readConfigFileSnapshotMock.mockResolvedValue({
            exists: true,
            valid: true,
            sourceConfig: {
              env: {
                vars: {
                  EVE_GATEWAY_TOKEN: "config-token",
                  EVE_STATE_DIR: stateDir,
                },
              },
              gateway: { mode: "local" },
            },
          });
          let tokenAtNormalize: string | undefined;
          normalizeEnvMock.mockImplementation(() => {
            tokenAtNormalize = process.env.EVE_GATEWAY_TOKEN;
          });

          await runCli(["node", "eve", "gateway"]);

          expect(process.env.EVE_GATEWAY_TOKEN).toBe("state-token");
          expect(tokenAtNormalize).toBe("state-token");
        },
      );
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("drops credentials from a trusted dotenv superseded by state selection", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "eve-gateway-dotenv-hop-"));
    const defaultStateDir = path.join(homeDir, ".eve");
    const selectedStateDir = path.join(homeDir, "selected-state");
    await fs.mkdir(defaultStateDir, { recursive: true });
    await fs.mkdir(selectedStateDir, { recursive: true });
    await fs.writeFile(
      path.join(defaultStateDir, ".env"),
      [
        `EVE_STATE_DIR=${selectedStateDir}`,
        "EVE_GATEWAY_TOKEN=superseded-token",
        "",
      ].join("\n"),
    );
    await fs.writeFile(
      path.join(selectedStateDir, ".env"),
      "EVE_GATEWAY_TOKEN=selected-token\n",
    );
    try {
      await withEnvAsync(
        {
          HOME: homeDir,
          EVE_GATEWAY_TOKEN: undefined,
          EVE_HOME: homeDir,
          EVE_STATE_DIR: undefined,
        },
        async () => {
          await runCli(["node", "eve", "gateway"]);

          expect(process.env.EVE_STATE_DIR).toBe(selectedStateDir);
          expect(process.env.EVE_GATEWAY_TOKEN).toBe("selected-token");
        },
      );
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("drops gateway.env selectors when the default state dotenv selects a custom state", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "eve-gateway-fallback-hop-"));
    const defaultStateDir = path.join(homeDir, ".eve");
    const selectedStateDir = path.join(homeDir, "selected-state");
    const gatewayEnvDir = path.join(homeDir, ".config", "eve");
    await fs.mkdir(defaultStateDir, { recursive: true });
    await fs.mkdir(selectedStateDir, { recursive: true });
    await fs.mkdir(gatewayEnvDir, { recursive: true });
    await fs.writeFile(
      path.join(defaultStateDir, ".env"),
      `EVE_STATE_DIR=${selectedStateDir}\n`,
    );
    await fs.writeFile(
      path.join(gatewayEnvDir, "gateway.env"),
      [
        "EVE_CONFIG_PATH=/tmp/wrong-eve.json",
        "EVE_GATEWAY_TOKEN=fallback-token",
        "",
      ].join("\n"),
    );
    await fs.writeFile(
      path.join(selectedStateDir, ".env"),
      [
        "EVE_GATEWAY_TOKEN=selected-token",
        "EVE_INCLUDE_ROOTS=/tmp/untrusted-include-root",
        "NODE_OPTIONS=--require /tmp/untrusted.js",
        "",
      ].join("\n"),
    );
    try {
      await withEnvAsync(
        {
          HOME: homeDir,
          EVE_CONFIG_PATH: undefined,
          EVE_GATEWAY_TOKEN: undefined,
          EVE_HOME: homeDir,
          EVE_STATE_DIR: undefined,
          NODE_OPTIONS: undefined,
        },
        async () => {
          await runCli(["node", "eve", "gateway"]);

          expect(process.env.EVE_STATE_DIR).toBe(selectedStateDir);
          expect(process.env.EVE_CONFIG_PATH).toBeUndefined();
          expect(process.env.EVE_GATEWAY_TOKEN).toBe("selected-token");
        },
      );
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("preserves gateway.env selectors when the compatibility fallback selects the target", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "eve-gateway-fallback-select-"));
    const selectedStateDir = path.join(homeDir, "selected-state");
    const gatewayEnvDir = path.join(homeDir, ".config", "eve");
    await fs.mkdir(selectedStateDir, { recursive: true });
    await fs.mkdir(gatewayEnvDir, { recursive: true });
    await fs.writeFile(
      path.join(gatewayEnvDir, "gateway.env"),
      [`EVE_STATE_DIR=${selectedStateDir}`, "EVE_GATEWAY_TOKEN=fallback-token", ""].join(
        "\n",
      ),
    );
    await fs.writeFile(
      path.join(selectedStateDir, ".env"),
      "EVE_GATEWAY_TOKEN=selected-token\n",
    );
    try {
      await withEnvAsync(
        {
          HOME: homeDir,
          EVE_GATEWAY_TOKEN: undefined,
          EVE_HOME: homeDir,
          EVE_INCLUDE_ROOTS: undefined,
          EVE_STATE_DIR: undefined,
          NODE_OPTIONS: undefined,
        },
        async () => {
          await runCli(["node", "eve", "gateway"]);

          expect(process.env.EVE_STATE_DIR).toBe(selectedStateDir);
          expect(process.env.EVE_GATEWAY_TOKEN).toBe("selected-token");
          expect(process.env.EVE_INCLUDE_ROOTS).toBeUndefined();
          expect(process.env.NODE_OPTIONS).toBeUndefined();
        },
      );
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("drops old state dotenv credentials when config selects another state", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "eve-gateway-config-state-hop-"));
    const defaultStateDir = path.join(homeDir, ".eve");
    const selectedStateDir = path.join(homeDir, "selected-state");
    await fs.mkdir(defaultStateDir, { recursive: true });
    await fs.mkdir(selectedStateDir, { recursive: true });
    await fs.writeFile(
      path.join(defaultStateDir, ".env"),
      "EVE_GATEWAY_TOKEN=superseded-token\n",
    );
    await fs.writeFile(
      path.join(selectedStateDir, ".env"),
      "EVE_GATEWAY_TOKEN=selected-token\n",
    );
    try {
      await withEnvAsync(
        {
          HOME: homeDir,
          EVE_GATEWAY_TOKEN: undefined,
          EVE_HOME: homeDir,
          EVE_STATE_DIR: undefined,
        },
        async () => {
          readConfigFileSnapshotMock.mockImplementation(async () => ({
            exists: true,
            valid: true,
            sourceConfig:
              process.env.EVE_STATE_DIR === selectedStateDir
                ? { gateway: { mode: "local" } }
                : {
                    env: { vars: { EVE_STATE_DIR: selectedStateDir } },
                    gateway: { mode: "local" },
                  },
          }));

          await runCli(["node", "eve", "gateway"]);

          expect(process.env.EVE_STATE_DIR).toBe(selectedStateDir);
          expect(process.env.EVE_GATEWAY_TOKEN).toBe("selected-token");
        },
      );
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("drops early target credentials when a later guard selects another state", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "eve-gateway-late-state-hop-"));
    const defaultStateDir = path.join(homeDir, ".eve");
    const selectedStateDir = path.join(homeDir, "selected-state");
    await fs.mkdir(defaultStateDir, { recursive: true });
    await fs.mkdir(selectedStateDir, { recursive: true });
    await fs.writeFile(path.join(defaultStateDir, ".env"), "EVE_GATEWAY_TOKEN=early-token\n");
    await fs.writeFile(
      path.join(selectedStateDir, ".env"),
      "EVE_GATEWAY_TOKEN=selected-token\n",
    );
    try {
      await withEnvAsync(
        {
          HOME: homeDir,
          EVE_GATEWAY_TOKEN: undefined,
          EVE_HOME: homeDir,
          EVE_STATE_DIR: undefined,
        },
        async () => {
          let selectLateState = false;
          readConfigFileSnapshotMock.mockImplementation(async () => ({
            exists: true,
            valid: true,
            sourceConfig:
              selectLateState && process.env.EVE_STATE_DIR !== selectedStateDir
                ? {
                    env: { vars: { EVE_STATE_DIR: selectedStateDir } },
                    gateway: { mode: "local" },
                  }
                : { gateway: { mode: "local" } },
          }));

          await runCli(["node", "eve", "gateway"]);
          expect(process.env.EVE_GATEWAY_TOKEN).toBe("early-token");

          selectLateState = true;
          const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
            | { beforeRun?: (opts: { force?: boolean }) => Promise<void> }
            | undefined;
          await hooks?.beforeRun?.({});

          expect(process.env.EVE_STATE_DIR).toBe(selectedStateDir);
          expect(process.env.EVE_GATEWAY_TOKEN).toBe("selected-token");
          expect(ensureCliExecutionBootstrapMock).toHaveBeenCalledOnce();
        },
      );
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("drops normalized credentials from an early config replaced by a later guard", async () => {
    await withEnvAsync({ ZAI_API_KEY: undefined, Z_AI_API_KEY: undefined }, async () => {
      let useReplacement = false;
      readConfigFileSnapshotMock.mockImplementation(async () => ({
        exists: true,
        valid: true,
        sourceConfig: {
          env: {
            vars: {
              Z_AI_API_KEY: useReplacement ? "replacement-key" : "superseded-key",
            },
          },
          gateway: { mode: "local" },
        },
      }));
      normalizeEnvMock.mockImplementation(() => {
        if (!process.env.ZAI_API_KEY?.trim() && process.env.Z_AI_API_KEY?.trim()) {
          process.env.ZAI_API_KEY = process.env.Z_AI_API_KEY;
        }
      });

      await runCli(["node", "eve", "gateway"]);
      expect(process.env.ZAI_API_KEY).toBe("superseded-key");

      useReplacement = true;
      const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
        | { beforeRun?: (opts: { force?: boolean }) => Promise<void> }
        | undefined;
      await hooks?.beforeRun?.({});

      expect(process.env.Z_AI_API_KEY).toBe("replacement-key");
      expect(process.env.ZAI_API_KEY).toBe("replacement-key");
    });
  });

  it("does not let gateway.env authorize automatic mutations of a selected future config", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "eve-gateway-global-env-"));
    const gatewayEnvDir = path.join(homeDir, ".config", "eve");
    const futureConfigPath = path.join(homeDir, "future.json");
    await fs.mkdir(gatewayEnvDir, { recursive: true });
    await fs.writeFile(
      path.join(gatewayEnvDir, "gateway.env"),
      "EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS=1\n",
    );
    try {
      await withEnvAsync(
        {
          HOME: homeDir,
          EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS: undefined,
          EVE_CONFIG_PATH: undefined,
          EVE_HOME: homeDir,
          EVE_STATE_DIR: undefined,
        },
        async () => {
          readConfigFileSnapshotMock.mockImplementation(async () =>
            process.env.EVE_CONFIG_PATH === futureConfigPath
              ? {
                  exists: true,
                  valid: true,
                  sourceConfig: { meta: { lastTouchedVersion: "9999.1.1" } },
                }
              : {
                  exists: true,
                  valid: true,
                  sourceConfig: {
                    env: { vars: { EVE_CONFIG_PATH: futureConfigPath } },
                    gateway: { mode: "local" },
                  },
                },
          );
          const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
          const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`exit:${String(code)}`);
          }) as typeof process.exit);
          try {
            await expect(runCli(["node", "eve", "gateway"])).rejects.toThrow("exit:1");
            expect(errorSpy).toHaveBeenCalledWith(
              expect.stringContaining("run automatic gateway startup migrations"),
            );
            expect(process.env.EVE_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS).toBeUndefined();
          } finally {
            exitSpy.mockRestore();
            errorSpy.mockRestore();
          }
        },
      );
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("does not treat gateway option values as bootstrap command paths", async () => {
    await runCli(["node", "eve", "gateway", "--raw-stream-path", "status"]);

    const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
      | { beforeRun?: (opts: { reset?: boolean }) => Promise<void> }
      | undefined;
    await hooks?.beforeRun?.({});

    expect(ensureCliExecutionBootstrapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        commandPath: ["gateway"],
        loadPlugins: false,
      }),
    );
  });

  it("guards then skips state migration before destructive gateway dev resets", async () => {
    await runCli(["node", "eve", "gateway", "--dev", "--reset"]);

    const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
      | { beforeRun?: (opts: { reset?: boolean }) => Promise<void> }
      | undefined;
    await hooks?.beforeRun?.({ reset: true });

    expect(readConfigFileSnapshotMock).toHaveBeenCalledWith({ isolateEnv: true, observe: false });
    expect(ensureCliExecutionBootstrapMock).not.toHaveBeenCalled();
  });

  it("retains selected config paths and invocation reset targets", async () => {
    await withEnvAsync(
      {
        EVE_CONFIG_PATH: "/tmp/eve-invocation/eve.json",
        EVE_GATEWAY_TOKEN: undefined,
        EVE_HOME: "/tmp/eve-invocation-home",
        EVE_INCLUDE_ROOTS: undefined,
        EVE_PROFILE: undefined,
        EVE_STATE_DIR: "/tmp/eve-invocation-state",
        EVE_TEST_FAST: "1",
        EVE_WORKSPACE_DIR: "/tmp/eve-invocation-workspace",
      },
      async () => {
        readConfigFileSnapshotMock.mockResolvedValue({
          exists: true,
          valid: true,
          sourceConfig: {
            env: {
              vars: {
                EVE_CONFIG_PATH: "/tmp/eve-reset/eve.json",
                EVE_GATEWAY_TOKEN: "old-token",
                EVE_HOME: "/tmp/eve-reset-home",
                EVE_INCLUDE_ROOTS: "/tmp/eve-reset-includes",
                EVE_PROFILE: "config-dev",
                EVE_STATE_DIR: "/tmp/eve-reset",
                EVE_TEST_FAST: "0",
                EVE_WORKSPACE_DIR: "/tmp/eve-reset-workspace",
              },
            },
            gateway: { mode: "local" },
          },
        });
        await runCli(["node", "eve", "gateway", "--dev", "--reset"]);

        const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
          | { beforeRun?: (opts: { reset?: boolean }) => Promise<void> }
          | undefined;
        await hooks?.beforeRun?.({ reset: true });

        expect(process.env.EVE_CONFIG_PATH).toBe("/tmp/eve-invocation/eve.json");
        expect(process.env.EVE_HOME).toBe("/tmp/eve-invocation-home");
        expect(process.env.EVE_PROFILE).toBeUndefined();
        expect(process.env.EVE_STATE_DIR).toBe("/tmp/eve-invocation-state");
        expect(process.env.EVE_TEST_FAST).toBe("1");
        expect(process.env.EVE_WORKSPACE_DIR).toBe("/tmp/eve-invocation-workspace");
        expect(process.env.EVE_GATEWAY_TOKEN).toBeUndefined();
        expect(process.env.EVE_INCLUDE_ROOTS).toBeUndefined();
        expect(ensureCliExecutionBootstrapMock).not.toHaveBeenCalled();
      },
    );
  });

  it("does not let config env authorize or retarget an explicit reset", async () => {
    await withEnvAsync(
      { EVE_PROFILE: undefined, EVE_WORKSPACE_DIR: undefined },
      async () => {
        readConfigFileSnapshotMock.mockResolvedValue({
          exists: true,
          valid: true,
          sourceConfig: {
            env: {
              vars: {
                EVE_PROFILE: "dev",
                EVE_WORKSPACE_DIR: "/tmp/eve-config-workspace",
              },
            },
            gateway: { mode: "local" },
          },
        });

        await runCli(["node", "eve", "gateway", "--reset"]);

        expect(process.env.EVE_PROFILE).toBeUndefined();
        expect(process.env.EVE_WORKSPACE_DIR).toBeUndefined();
      },
    );
  });

  it("honors banner suppression on the gateway foreground fast path", async () => {
    process.env.EVE_HIDE_BANNER = "1";

    await runCli(["node", "eve", "gateway"]);

    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(emitCliBannerMock).not.toHaveBeenCalled();
    expect(commanderParseAsyncMock).toHaveBeenCalledWith(["node", "eve", "gateway"]);
  });

  it("renders browser help from startup metadata without building the full program", async () => {
    outputPrecomputedBrowserHelpTextMock.mockReturnValueOnce(true);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`unexpected process.exit(${String(code)})`);
    }) as typeof process.exit);

    await runCli(["node", "eve", "browser", "--help"]);

    expect(maybeRunCliInContainerMock).toHaveBeenCalledWith([
      "node",
      "eve",
      "browser",
      "--help",
    ]);
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(outputPrecomputedBrowserHelpTextMock).toHaveBeenCalledTimes(1);
    expect(outputRootHelpMock).not.toHaveBeenCalled();
    expect(buildProgramMock).not.toHaveBeenCalled();
    expect(closeActiveMemorySearchManagersMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("renders secrets help from startup metadata without building the full program", async () => {
    outputPrecomputedSecretsHelpTextMock.mockReturnValueOnce(true);

    await runCli(["node", "eve", "secrets", "--help"]);

    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(outputPrecomputedSecretsHelpTextMock).toHaveBeenCalledTimes(1);
    expect(buildProgramMock).not.toHaveBeenCalled();
    expect(registerSubCliByNameMock).not.toHaveBeenCalled();
  });

  it("renders nodes help from startup metadata without building the full program", async () => {
    outputPrecomputedNodesHelpTextMock.mockReturnValueOnce(true);

    await runCli(["node", "eve", "nodes", "--help"]);

    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(outputPrecomputedNodesHelpTextMock).toHaveBeenCalledTimes(1);
    expect(buildProgramMock).not.toHaveBeenCalled();
    expect(registerSubCliByNameMock).not.toHaveBeenCalled();
  });

  it("defers nodes help startup metadata when plugin config can change command metadata", async () => {
    const argv = ["node", "eve", "nodes", "--help"];
    const parseAsync = vi.fn().mockResolvedValueOnce(undefined);
    const program = {
      commands: [{ name: () => "nodes", aliases: () => [] }],
      parseAsync,
    };
    loadRootHelpRenderOptionsForConfigSensitivePluginsMock.mockResolvedValueOnce({ env: {} });
    outputPrecomputedNodesHelpTextMock.mockReturnValueOnce(true);
    buildProgramMock.mockReturnValueOnce(program);

    await runCli(argv);

    expect(loadRootHelpRenderOptionsForConfigSensitivePluginsMock).toHaveBeenCalledTimes(1);
    expect(outputPrecomputedNodesHelpTextMock).not.toHaveBeenCalled();
    expect(registerSubCliByNameMock.mock.calls).toEqual([[program, "nodes", argv]]);
    expect(parseAsync).toHaveBeenCalledWith(argv);
  });

  it("renders selected subcommand help from startup metadata without building the full program", async () => {
    outputPrecomputedSubcommandHelpTextMock.mockReturnValueOnce(true);

    await runCli(["node", "eve", "doctor", "--help"]);

    expect(outputPrecomputedSubcommandHelpTextMock).toHaveBeenCalledWith("doctor");
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(buildProgramMock).not.toHaveBeenCalled();
    expect(closeActiveMemorySearchManagersMock).not.toHaveBeenCalled();
  });

  it("keeps root help on the precomputed path without proxy bootstrap", async () => {
    outputPrecomputedRootHelpTextMock.mockReturnValueOnce(true);

    await runCli(["node", "eve", "--help"]);

    expect(loadRootHelpRenderOptionsForConfigSensitivePluginsMock).toHaveBeenCalledTimes(1);
    expect(outputPrecomputedRootHelpTextMock).toHaveBeenCalledTimes(1);
    expect(hasEnvHttpProxyAgentConfiguredMock).not.toHaveBeenCalled();
    expect(ensureGlobalUndiciEnvProxyDispatcherMock).not.toHaveBeenCalled();
    expect(runCrestodianMock).not.toHaveBeenCalled();
  });

  it("renders setup/onboard/configure help without building the full program", async () => {
    await runCli(["node", "eve", "setup", "--help"]);

    expect(tryOutputSetupOnboardConfigureHelpMock).toHaveBeenCalledWith([
      "node",
      "eve",
      "setup",
      "--help",
    ]);
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(buildProgramMock).not.toHaveBeenCalled();
    expect(registerPluginCliCommandsFromValidatedConfigMock).not.toHaveBeenCalled();
  });

  it("renders root help without building the full program", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`unexpected process.exit(${String(code)})`);
    }) as typeof process.exit);

    await runCli(["node", "eve", "--help"]);

    expect(maybeRunCliInContainerMock).toHaveBeenCalledWith(["node", "eve", "--help"]);
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(loadRootHelpRenderOptionsForConfigSensitivePluginsMock).toHaveBeenCalledTimes(1);
    expect(outputPrecomputedRootHelpTextMock).toHaveBeenCalledTimes(1);
    expect(outputRootHelpMock).toHaveBeenCalledTimes(1);
    expect(buildProgramMock).not.toHaveBeenCalled();
    expect(closeActiveMemorySearchManagersMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("renders config-sensitive root help live instead of precomputed metadata", async () => {
    const liveOptions: RootHelpRenderOptions = {
      config: {
        plugins: {
          slots: {
            memory: "memory-lancedb",
          },
        },
      },
      env: process.env,
    };
    loadRootHelpRenderOptionsForConfigSensitivePluginsMock.mockResolvedValueOnce(liveOptions);
    outputPrecomputedRootHelpTextMock.mockReturnValueOnce(true);

    await runCli(["node", "eve", "--help"]);

    expect(loadRootHelpRenderOptionsForConfigSensitivePluginsMock).toHaveBeenCalledTimes(1);
    expect(outputPrecomputedRootHelpTextMock).not.toHaveBeenCalled();
    expect(outputRootHelpMock).toHaveBeenCalledWith(liveOptions);
    expect(buildProgramMock).not.toHaveBeenCalled();
  });

  it("does not start the managed proxy for local gateway client commands", async () => {
    tryRouteCliMock.mockResolvedValueOnce(true);

    await runCli(["node", "eve", "status"]);

    expect(startProxyMock).not.toHaveBeenCalled();
    expect(stopProxyMock).not.toHaveBeenCalled();
  });

  it.each([
    ["gateway runtime", ["node", "eve", "gateway", "run"]],
    ["bare gateway runtime", ["node", "eve", "gateway"]],
    ["node runtime", ["node", "eve", "node", "run"]],
    ["local agent runtime", ["node", "eve", "agent", "--local"]],
    ["provider inference", ["node", "eve", "infer", "web", "fetch", "https://example.com"]],
    ["model command", ["node", "eve", "models", "auth", "login", "openai"]],
    ["plugin command", ["node", "eve", "plugins", "marketplace", "list"]],
    ["skill command", ["node", "eve", "skills", "search", "browser"]],
    ["update command", ["node", "eve", "update", "check"]],
    ["channel probe", ["node", "eve", "channels", "status", "--probe"]],
    ["channel capabilities probe", ["node", "eve", "channels", "capabilities"]],
    ["directory plugin command", ["node", "eve", "directory", "peers", "list"]],
    ["message plugin command", ["node", "eve", "message", "send", "--to", "demo"]],
    ["metadata-owned plugin command", ["node", "eve", "googlemeet", "login"]],
  ])("starts managed proxy routing for %s", (_name, argv) => {
    expect(shouldStartProxyForCli(argv)).toBe(true);
  });

  it.each([
    ["root help", ["node", "eve", "--help"]],
    ["root version", ["node", "eve", "--version"]],
    ["gateway help", ["node", "eve", "gateway", "--help"]],
    ["gateway run help", ["node", "eve", "gateway", "run", "--help"]],
    ["status", ["node", "eve", "status"]],
    ["health", ["node", "eve", "health"]],
    ["gateway status", ["node", "eve", "gateway", "status"]],
    ["gateway health", ["node", "eve", "gateway", "health"]],
    ["remote agent control-plane", ["node", "eve", "agent", "run"]],
    ["chat control-plane", ["node", "eve", "chat"]],
    ["terminal control-plane", ["node", "eve", "terminal"]],
    ["config", ["node", "eve", "config", "get", "proxy.enabled"]],
    ["channels parent help", ["node", "eve", "channels"]],
    ["completion", ["node", "eve", "completion", "zsh"]],
    ["debug proxy cli", ["node", "eve", "proxy", "start"]],
    ["agents list", ["node", "eve", "agents", "list"]],
    ["models list", ["node", "eve", "models", "list"]],
    ["models status without live probe", ["node", "eve", "models", "status"]],
    ["skills check", ["node", "eve", "skills", "check"]],
    ["skills info", ["node", "eve", "skills", "info", "weather"]],
    ["skills list", ["node", "eve", "skills", "list"]],
    ["tasks list", ["node", "eve", "tasks", "list"]],
    ["legacy singular tool namespace", ["node", "eve", "tool", "image_generate"]],
    ["gateway tools namespace typo", ["node", "eve", "tools", "effective"]],
    ["migrate", ["node", "eve", "migrate"]],
  ])("skips managed proxy routing for %s", (_name, argv) => {
    expect(shouldStartProxyForCli(argv)).toBe(false);
  });

  it("starts the managed proxy for network-capable commands by default", async () => {
    tryRouteCliMock.mockResolvedValueOnce(true);

    await runCli(["node", "eve", "plugins", "marketplace", "list"]);

    expect(startProxyMock).toHaveBeenCalledWith(undefined);
  });

  it.each([
    ["fast path", ["node", "eve", "gateway", "run"]],
    [
      "full Commander path with root options",
      ["node", "eve", "--log-level", "debug", "gateway", "run"],
    ],
  ])("loads trusted dotenv and isolates %s gateway proxy config reads", async (_name, argv) => {
    if (_name === "full Commander path with root options") {
      tryRouteCliMock.mockResolvedValueOnce(true);
    }
    await runCli(argv);

    expect(loadDotEnvMock).toHaveBeenCalledWith({ loadGlobalEnv: false, quiet: true });
    expect(loadConfigMock).toHaveBeenCalledWith({ isolateEnv: true, observe: false });
    expect(startProxyMock).toHaveBeenCalledWith(undefined);
  });

  it("validates the runtime before selecting gateway config", async () => {
    await runCli(["node", "eve", "gateway", "run"]);

    const runtimeGuardOrder = assertRuntimeMock.mock.invocationCallOrder[0] ?? 0;
    const configReadOrder = readConfigFileSnapshotMock.mock.invocationCallOrder[0] ?? 0;
    expect(runtimeGuardOrder).toBeGreaterThan(0);
    expect(configReadOrder).toBeGreaterThan(runtimeGuardOrder);
  });

  it("re-pins runtime paths after selecting gateway config", async () => {
    await runCli(["node", "eve", "gateway", "run"]);

    expect(pinRuntimePathsMock).toHaveBeenCalledWith(process.env);
    expect(pinConfigDirMock).toHaveBeenCalledWith(process.env);
    const configReadOrder = readConfigFileSnapshotMock.mock.invocationCallOrder[0] ?? 0;
    const pinOrder = pinRuntimePathsMock.mock.invocationCallOrder[0] ?? 0;
    expect(pinOrder).toBeGreaterThan(configReadOrder);
  });

  it("selects gateway config env before starting its managed proxy", async () => {
    await withEnvAsync({ EVE_TEST_PROXY_SELECTION: undefined }, async () => {
      readConfigFileSnapshotMock.mockResolvedValue({
        exists: true,
        valid: true,
        sourceConfig: {
          env: { vars: { EVE_TEST_PROXY_SELECTION: "selected" } },
          gateway: { mode: "local" },
        },
      });
      loadConfigMock.mockImplementationOnce(() => ({
        proxy: { selected: process.env.EVE_TEST_PROXY_SELECTION },
      }));

      await runCli(["node", "eve", "gateway", "run"]);

      expect(startProxyMock).toHaveBeenCalledWith({ selected: "selected" });
    });
  });

  it("replaces the early managed proxy with the final accepted gateway config", async () => {
    const earlyHandle = makeProxyHandle();
    const finalHandle = makeProxyHandle();
    const earlyProxy = { enabled: true, proxyUrl: "http://127.0.0.1:19876" };
    const finalProxy = { enabled: true, proxyUrl: "http://127.0.0.1:29876" };
    loadConfigMock.mockReturnValueOnce({ proxy: earlyProxy });
    startProxyMock.mockResolvedValueOnce(earlyHandle).mockResolvedValueOnce(finalHandle);
    commanderParseAsyncMock.mockImplementationOnce(async () => {
      const hooks = addGatewayRunCommandMock.mock.calls[0]?.[1] as
        | { beforeRun?: (opts: { force?: boolean }) => Promise<void> }
        | undefined;
      await hooks?.beforeRun?.({});
      await getGatewayRunRuntimeHooks().refreshManagedProxy?.(finalProxy);
    });

    await runCli(["node", "eve", "gateway", "run"]);

    expect(startProxyMock).toHaveBeenNthCalledWith(1, earlyProxy);
    expect(startProxyMock).toHaveBeenNthCalledWith(2, finalProxy);
    expect(stopProxyMock).toHaveBeenNthCalledWith(1, earlyHandle);
    expect(stopProxyMock).toHaveBeenNthCalledWith(2, finalHandle);
    const earlyStopOrder = stopProxyMock.mock.invocationCallOrder[0] ?? 0;
    const finalEnvironmentReadOrder = readConfigFileSnapshotMock.mock.invocationCallOrder[1] ?? 0;
    const finalStartOrder = startProxyMock.mock.invocationCallOrder[1] ?? 0;
    expect(finalEnvironmentReadOrder).toBeGreaterThan(earlyStopOrder);
    expect(finalStartOrder).toBeGreaterThan(earlyStopOrder);
  });

  it("removes early proxy signal handlers when the final config disables the proxy", async () => {
    const earlyHandle = makeProxyHandle();
    const earlyProxy = { enabled: true, proxyUrl: "http://127.0.0.1:19876" };
    const finalProxy = { enabled: false };
    loadConfigMock.mockReturnValueOnce({ proxy: earlyProxy });
    startProxyMock.mockResolvedValueOnce(earlyHandle).mockResolvedValueOnce(null);
    const processOnceSpy = vi.spyOn(process, "once");
    const processOffSpy = vi.spyOn(process, "off");
    commanderParseAsyncMock.mockImplementationOnce(async () => {
      const sigtermHandler = processOnceSpy.mock.calls.find(([event]) => event === "SIGTERM")?.[1];
      const sigintHandler = processOnceSpy.mock.calls.find(([event]) => event === "SIGINT")?.[1];
      const exitHandler = processOnceSpy.mock.calls.find(([event]) => event === "exit")?.[1];

      await getGatewayRunRuntimeHooks().refreshManagedProxy?.(finalProxy);

      expect(processOffSpy).toHaveBeenCalledWith("SIGTERM", sigtermHandler);
      expect(processOffSpy).toHaveBeenCalledWith("SIGINT", sigintHandler);
      expect(processOffSpy).toHaveBeenCalledWith("exit", exitHandler);
    });

    try {
      await runCli(["node", "eve", "gateway", "run"]);
    } finally {
      processOffSpy.mockRestore();
      processOnceSpy.mockRestore();
    }

    expect(startProxyMock).toHaveBeenNthCalledWith(1, earlyProxy);
    expect(startProxyMock).toHaveBeenNthCalledWith(2, finalProxy);
    expect(stopProxyMock).toHaveBeenCalledOnce();
    expect(stopProxyMock).toHaveBeenCalledWith(earlyHandle);
  });

  it("starts the managed proxy for metadata-owned plugin commands by default", async () => {
    tryRouteCliMock.mockResolvedValueOnce(true);

    await runCli(["node", "eve", "googlemeet", "login"]);

    expect(startProxyMock).toHaveBeenCalledWith(undefined);
  });

  it("rejects unowned command roots before proxy and plugin runtime registration", async () => {
    await expect(runCli(["node", "eve", "foo"])).rejects.toThrow(
      'No built-in command or plugin CLI metadata owns "foo"',
    );

    expect(startProxyMock).not.toHaveBeenCalled();
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(buildProgramMock).not.toHaveBeenCalled();
    expect(registerPluginCliCommandsFromValidatedConfigMock).not.toHaveBeenCalled();
  });

  it("suggests close known commands for unowned command roots before proxy startup", async () => {
    await expect(runCli(["node", "eve", "upate"])).rejects.toThrow(
      "Did you mean this?\n  eve update",
    );

    expect(startProxyMock).not.toHaveBeenCalled();
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(buildProgramMock).not.toHaveBeenCalled();
    expect(registerPluginCliCommandsFromValidatedConfigMock).not.toHaveBeenCalled();
  });

  it("keeps suggestions out of plugin-policy diagnostics", async () => {
    resolveManifestCommandAliasOwnerMock.mockReturnValueOnce({
      pluginId: "codex",
      kind: "runtime-slash",
      cliCommand: "plugins",
    });

    let error: unknown;
    try {
      await runCli(["node", "eve", "codex"]);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("runtime slash command");
    expect((error as Error).message).toContain("/codex");
    expect((error as Error).message).not.toContain("Did you mean this?");
    expect(startProxyMock).not.toHaveBeenCalled();
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(buildProgramMock).not.toHaveBeenCalled();
    expect(registerPluginCliCommandsFromValidatedConfigMock).not.toHaveBeenCalled();
  });

  it("rejects unowned command roots even when --help is appended (regression for #81077)", async () => {
    await expect(runCli(["node", "eve", "foo", "--help"])).rejects.toThrow(
      'No built-in command or plugin CLI metadata owns "foo"',
    );

    expect(startProxyMock).not.toHaveBeenCalled();
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(buildProgramMock).not.toHaveBeenCalled();
    expect(registerPluginCliCommandsFromValidatedConfigMock).not.toHaveBeenCalled();
  });

  it("rejects unowned command roots even when --version is appended", async () => {
    await expect(runCli(["node", "eve", "foo", "--version"])).rejects.toThrow(
      'No built-in command or plugin CLI metadata owns "foo"',
    );

    expect(startProxyMock).not.toHaveBeenCalled();
    expect(tryRouteCliMock).not.toHaveBeenCalled();
  });

  it("does not suggest plugins.allow for unknown command roots before proxy startup", async () => {
    loadConfigMock.mockReturnValueOnce({
      plugins: {
        allow: ["browser"],
      },
    });

    let error: unknown;
    try {
      await runCli(["node", "eve", "totally-unknown"]);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(
      'No built-in command or plugin CLI metadata owns "totally-unknown"',
    );
    expect((error as Error).message).not.toContain("plugins.allow");
    expect(startProxyMock).not.toHaveBeenCalled();
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(registerPluginCliCommandsFromValidatedConfigMock).not.toHaveBeenCalled();
  });

  it("preserves plugins.allow diagnostics for roots owned only by CLI metadata", async () => {
    loadConfigMock.mockReturnValueOnce({
      plugins: {
        allow: ["browser"],
      },
    });
    resolvePluginCliRootOwnerIdsMock.mockImplementation(
      ({
        cfg,
        primaryCommand,
      }: {
        cfg?: { plugins?: { allow?: string[] } };
        primaryCommand?: string;
      }) => (primaryCommand === "qa" && cfg?.plugins?.allow?.length === 0 ? ["qa-lab"] : []),
    );

    await expect(runCli(["node", "eve", "qa"])).rejects.toThrow(
      'Add "qa-lab" to `plugins.allow` instead of "qa"',
    );
    expect(startProxyMock).not.toHaveBeenCalled();
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(registerPluginCliCommandsFromValidatedConfigMock).not.toHaveBeenCalled();
  });

  it("reports plugin tool command mistakes before proxy startup", async () => {
    resolveManifestToolOwnerMock.mockReturnValueOnce({
      toolName: "lcm_recent",
      pluginId: "lossless-claw",
      availability: "loaded",
    });

    await expect(runCli(["node", "eve", "lcm_recent"])).rejects.toThrow(
      '"lcm_recent" is an agent tool available from the "lossless-claw" plugin',
    );

    expect(startProxyMock).not.toHaveBeenCalled();
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(registerPluginCliCommandsFromValidatedConfigMock).not.toHaveBeenCalled();
  });

  it("does not install the env proxy dispatcher for bypassed skills inspection commands", async () => {
    hasEnvHttpProxyAgentConfiguredMock.mockReturnValue(true);
    tryRouteCliMock.mockResolvedValueOnce(true);

    await runCli(["node", "eve", "skills", "check"]);

    expect(hasEnvHttpProxyAgentConfiguredMock).not.toHaveBeenCalled();
    expect(ensureGlobalUndiciEnvProxyDispatcherMock).not.toHaveBeenCalled();
  });

  it.each([
    ["auth", ["node", "eve", "auth", "--help"]],
    ["tool", ["node", "eve", "tool", "image_generate"]],
    ["tools", ["node", "eve", "tools", "effective"]],
  ])("keeps reserved %s command roots out of plugin command discovery", async (_name, argv) => {
    const parseAsync = vi.fn().mockResolvedValueOnce(undefined);
    const program = {
      commands: [],
      parseAsync,
    };
    buildProgramMock.mockReturnValueOnce(program);

    await runCli(argv);

    expect(startProxyMock).not.toHaveBeenCalled();
    expect(registerSubCliByNameMock.mock.calls).toEqual([[program, argv[2], argv]]);
    expect(registerPluginCliCommandsFromValidatedConfigMock).not.toHaveBeenCalled();
    expect(parseAsync).toHaveBeenCalledWith(argv);
  });

  it("routes lazy plugin registration logs to stderr only during --json registration", async () => {
    tryRouteCliMock.mockResolvedValueOnce(false);
    resolvePluginCliRootOwnerIdsMock.mockImplementation(
      ({ primaryCommand }: { primaryCommand?: string }) =>
        primaryCommand === "memory" ? ["memory"] : [],
    );
    let stderrDuringPluginRegistration = false;
    let stderrDuringParse = true;
    registerPluginCliCommandsFromValidatedConfigMock.mockImplementationOnce(async () => {
      stderrDuringPluginRegistration = loggingState.forceConsoleToStderr;
      return {};
    });
    const parseAsync = vi.fn().mockImplementationOnce(async () => {
      stderrDuringParse = loggingState.forceConsoleToStderr;
    });
    buildProgramMock.mockReturnValueOnce({
      commands: [],
      parseAsync,
    });

    await runCli(["node", "eve", "memory", "search", "query", "--json"]);

    expect(registerPluginCliCommandsFromValidatedConfigMock).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      undefined,
      { mode: "lazy", primary: "memory" },
    );
    expect(stderrDuringPluginRegistration).toBe(true);
    expect(stderrDuringParse).toBe(false);
    expect(loggingState.forceConsoleToStderr).toBe(false);
  });

  it("does not route lazy plugin registration logs for pass-through --json after terminator", async () => {
    tryRouteCliMock.mockResolvedValueOnce(false);
    resolvePluginCliRootOwnerIdsMock.mockImplementation(
      ({ primaryCommand }: { primaryCommand?: string }) =>
        primaryCommand === "memory" ? ["memory"] : [],
    );
    let stderrDuringPluginRegistration = true;
    registerPluginCliCommandsFromValidatedConfigMock.mockImplementationOnce(async () => {
      stderrDuringPluginRegistration = loggingState.forceConsoleToStderr;
      return {};
    });
    const parseAsync = vi.fn().mockResolvedValueOnce(undefined);
    buildProgramMock.mockReturnValueOnce({
      commands: [],
      parseAsync,
    });

    await runCli(["node", "eve", "memory", "--", "--json"]);

    expect(registerPluginCliCommandsFromValidatedConfigMock).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      undefined,
      { mode: "lazy", primary: "memory" },
    );
    expect(stderrDuringPluginRegistration).toBe(false);
    expect(loggingState.forceConsoleToStderr).toBe(false);
  });

  it("fails protected commands when managed proxy activation fails", async () => {
    startProxyMock.mockRejectedValueOnce(new Error("proxy: enabled but no HTTP proxy URL"));

    await expect(runCli(["node", "eve", "gateway", "run"])).rejects.toThrow(
      "proxy: enabled but no HTTP proxy URL",
    );

    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(stopProxyMock).not.toHaveBeenCalled();
  });

  it("fails protected commands when config cannot be loaded for managed proxy startup", async () => {
    loadConfigMock.mockImplementationOnce(() => {
      throw new Error("config parse failed");
    });

    await expect(runCli(["node", "eve", "gateway", "run"])).rejects.toThrow(
      "config parse failed",
    );

    expect(startProxyMock).not.toHaveBeenCalled();
    expect(tryRouteCliMock).not.toHaveBeenCalled();
  });

  it("stops the managed proxy after normal gateway runtime completion", async () => {
    const handle = makeProxyHandle();
    startProxyMock.mockResolvedValueOnce(handle);

    await runCli(["node", "eve", "gateway", "run"]);

    expect(startProxyMock).toHaveBeenCalledWith(undefined);
    expect(stopProxyMock).toHaveBeenCalledOnce();
    expect(stopProxyMock).toHaveBeenCalledWith(handle);
  });

  it("stops the managed proxy and exits after SIGINT", async () => {
    const handle = makeProxyHandle();
    startProxyMock.mockResolvedValueOnce(handle);
    let resolveRoute: (value: boolean) => void = () => {};
    tryRouteCliMock.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveRoute = resolve;
      }),
    );

    const processOnceSpy = vi.spyOn(process, "once");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number | string) => {
      void code;
      return undefined as never;
    }) as typeof process.exit);

    try {
      const runPromise = runCli(["node", "eve", "plugins", "marketplace", "list"]);
      await vi.waitFor(() => {
        expect(
          processOnceSpy.mock.calls.some(
            ([event, listener]) => event === "SIGINT" && typeof listener === "function",
          ),
        ).toBe(true);
      });

      const sigintHandler = processOnceSpy.mock.calls.find(([event]) => event === "SIGINT")?.[1];
      if (typeof sigintHandler !== "function") {
        throw new Error("SIGINT handler was not registered");
      }
      sigintHandler();

      await vi.waitFor(() => {
        expect(stopProxyMock).toHaveBeenCalledWith(handle);
      });
      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith(130);
      });

      resolveRoute(true);
      await runPromise;
      expect(stopProxyMock).toHaveBeenCalledTimes(1);
    } finally {
      exitSpy.mockRestore();
      processOnceSpy.mockRestore();
    }
  });

  it("synchronously kills the managed proxy during hard process exit", async () => {
    const handle = makeProxyHandle();
    startProxyMock.mockResolvedValueOnce(handle);
    let resolveRoute: (value: boolean) => void = () => {};
    tryRouteCliMock.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveRoute = resolve;
      }),
    );

    const processOnceSpy = vi.spyOn(process, "once");
    try {
      const runPromise = runCli(["node", "eve", "plugins", "marketplace", "list"]);
      await vi.waitFor(() => {
        expect(
          processOnceSpy.mock.calls.reduce(
            (count, [event]) => count + (event === "exit" ? 1 : 0),
            0,
          ),
        ).toBe(2);
      });

      const exitHandler = processOnceSpy.mock.calls.find(([event]) => event === "exit")?.[1];
      if (typeof exitHandler !== "function") {
        throw new Error("exit handler was not registered");
      }
      exitHandler(0 as never);

      expect(handle.kill).toHaveBeenCalledWith("SIGTERM");
      resolveRoute(true);
      await runPromise;
      expect(stopProxyMock).not.toHaveBeenCalledWith(handle);
    } finally {
      processOnceSpy.mockRestore();
    }
  });

  it("starts onboarding for bare root invocations before config exists", async () => {
    readConfigFileSnapshotMock.mockResolvedValueOnce({
      exists: false,
      valid: true,
      sourceConfig: {},
    });

    await withInteractiveTty(async () => {
      await runCli(["node", "eve"]);
    });

    expect(readConfigFileSnapshotMock).toHaveBeenCalledTimes(1);
    expect(setupWizardCommandMock).toHaveBeenCalledWith({});
    expect(runCrestodianMock).not.toHaveBeenCalled();
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(buildProgramMock).not.toHaveBeenCalled();
  });

  it("starts onboarding for bare root invocations when config is empty", async () => {
    readConfigFileSnapshotMock.mockResolvedValueOnce({
      exists: true,
      valid: true,
      sourceConfig: {},
    });

    await withInteractiveTty(async () => {
      await runCli(["node", "eve"]);
    });

    expect(readConfigFileSnapshotMock).toHaveBeenCalledTimes(1);
    expect(setupWizardCommandMock).toHaveBeenCalledWith({});
    expect(runCrestodianMock).not.toHaveBeenCalled();
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(buildProgramMock).not.toHaveBeenCalled();
  });

  it("starts onboarding for bare root invocations when config only has metadata", async () => {
    readConfigFileSnapshotMock.mockResolvedValueOnce({
      exists: true,
      valid: true,
      sourceConfig: {
        $schema: "https://eve.ai/config.json",
        meta: { updatedBy: "fixture" },
      },
    });

    await withInteractiveTty(async () => {
      await runCli(["node", "eve"]);
    });

    expect(readConfigFileSnapshotMock).toHaveBeenCalledTimes(1);
    expect(setupWizardCommandMock).toHaveBeenCalledWith({});
    expect(runCrestodianMock).not.toHaveBeenCalled();
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(buildProgramMock).not.toHaveBeenCalled();
  });

  it("points noninteractive fresh bare root invocations to onboarding automation", async () => {
    const previousExitCode = process.exitCode;
    const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;
    readConfigFileSnapshotMock.mockResolvedValueOnce({
      exists: false,
      valid: true,
      sourceConfig: {},
    });
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: false });
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: false });

    try {
      await runCli(["node", "eve"]);

      expect(process.exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Onboarding needs an interactive TTY. Use `eve onboard --non-interactive --accept-risk ...` for automation.",
      );
      expect(setupWizardCommandMock).not.toHaveBeenCalled();
      expect(runCrestodianMock).not.toHaveBeenCalled();
      expect(tryRouteCliMock).not.toHaveBeenCalled();
      expect(buildProgramMock).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      process.exitCode = previousExitCode;
      if (stdinDescriptor) {
        Object.defineProperty(process.stdin, "isTTY", stdinDescriptor);
      } else {
        Reflect.deleteProperty(process.stdin, "isTTY");
      }
      if (stdoutDescriptor) {
        Object.defineProperty(process.stdout, "isTTY", stdoutDescriptor);
      } else {
        Reflect.deleteProperty(process.stdout, "isTTY");
      }
    }
  });

  it("keeps bare root invocations on Crestodian when config already exists", async () => {
    await withInteractiveTty(async () => {
      await runCli(["node", "eve"]);
    });

    expect(readConfigFileSnapshotMock).toHaveBeenCalledTimes(1);
    expect(setupWizardCommandMock).not.toHaveBeenCalled();
    expect(runCrestodianMock).toHaveBeenCalledOnce();
    const crestodianOptions = requireRunCrestodianOptions();
    expect(crestodianOptions).toEqual({ onReady: crestodianOptions.onReady });
    expect(crestodianOptions.onReady).toBeTypeOf("function");
  });

  it("bootstraps env proxy before bare Crestodian startup", async () => {
    hasEnvHttpProxyAgentConfiguredMock.mockReturnValue(true);
    const stdinTty = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    const stdoutTty = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });

    try {
      await runCli(["node", "eve"]);
    } finally {
      if (stdinTty) {
        Object.defineProperty(process.stdin, "isTTY", stdinTty);
      } else {
        delete (process.stdin as { isTTY?: boolean }).isTTY;
      }
      if (stdoutTty) {
        Object.defineProperty(process.stdout, "isTTY", stdoutTty);
      } else {
        delete (process.stdout as { isTTY?: boolean }).isTTY;
      }
    }

    expect(ensureGlobalUndiciEnvProxyDispatcherMock).toHaveBeenCalledTimes(1);
    expect(runCrestodianMock).toHaveBeenCalledOnce();
    const crestodianOptions = requireRunCrestodianOptions();
    expect(crestodianOptions).toEqual({ onReady: crestodianOptions.onReady });
    expect(crestodianOptions.onReady).toBeTypeOf("function");
    expect(ensureGlobalUndiciEnvProxyDispatcherMock.mock.invocationCallOrder[0]).toBeLessThan(
      runCrestodianMock.mock.invocationCallOrder[0],
    );
  });

  it("bootstraps env proxy before modern onboard Crestodian startup", async () => {
    hasEnvHttpProxyAgentConfiguredMock.mockReturnValue(true);

    await runCli(["node", "eve", "onboard", "--modern", "--json"]);

    expect(ensureGlobalUndiciEnvProxyDispatcherMock).toHaveBeenCalledTimes(1);
    expect(runCrestodianMock).toHaveBeenCalledWith({
      message: undefined,
      yes: false,
      json: true,
      interactive: true,
    });
    expect(ensureGlobalUndiciEnvProxyDispatcherMock.mock.invocationCallOrder[0]).toBeLessThan(
      runCrestodianMock.mock.invocationCallOrder[0],
    );
  });

  it("closes memory managers when a runtime was registered", async () => {
    tryRouteCliMock.mockResolvedValueOnce(true);
    hasMemoryRuntimeMock.mockReturnValue(true);

    await runCli(["node", "eve", "status"]);

    expect(closeActiveMemorySearchManagersMock).toHaveBeenCalledTimes(1);
  });

  it("does not fail the command when memory cleanup is unavailable", async () => {
    tryRouteCliMock.mockResolvedValueOnce(true);
    hasMemoryRuntimeMock.mockImplementationOnce(() => {
      throw new Error("stale memory-state chunk");
    });

    await expect(runCli(["node", "eve", "status"])).resolves.toBeUndefined();

    expect(closeActiveMemorySearchManagersMock).not.toHaveBeenCalled();
  });

  it("returns after a handled container-target invocation", async () => {
    maybeRunCliInContainerMock.mockReturnValueOnce({ handled: true, exitCode: 0 });

    await runCli(["node", "eve", "--container", "demo", "status"]);

    expect(maybeRunCliInContainerMock).toHaveBeenCalledWith([
      "node",
      "eve",
      "--container",
      "demo",
      "status",
    ]);
    expect(loadDotEnvMock).not.toHaveBeenCalled();
    expect(tryRouteCliMock).not.toHaveBeenCalled();
    expect(closeActiveMemorySearchManagersMock).not.toHaveBeenCalled();
  });

  it("propagates a handled container-target exit code", async () => {
    const exitCode = process.exitCode;
    maybeRunCliInContainerMock.mockReturnValueOnce({ handled: true, exitCode: 7 });

    await runCli(["node", "eve", "--container", "demo", "status"]);

    expect(process.exitCode).toBe(7);
    process.exitCode = exitCode;
  });

  it("swallows Commander parse exits after recording the exit code", async () => {
    const exitCode = process.exitCode;
    const program = {
      commands: [{ name: () => "status" }],
      parseAsync: vi
        .fn()
        .mockRejectedValueOnce(
          new CommanderError(1, "commander.excessArguments", "too many arguments for 'status'"),
        ),
    };
    buildProgramMock.mockReturnValueOnce(program);

    await expect(runCli(["node", "eve", "status"])).resolves.toBeUndefined();

    expect(registerSubCliByNameMock.mock.calls).toEqual([
      [program, "status", ["node", "eve", "status"]],
    ]);
    expect(process.exitCode).toBe(1);
    process.exitCode = exitCode;
  });

  it("loads the real primary command before rendering command help", async () => {
    const program = {
      commands: [{ name: () => "doctor" }],
      parseAsync: vi.fn().mockResolvedValueOnce(undefined),
    };
    buildProgramMock.mockReturnValueOnce(program);
    const ctx = { programVersion: "0.0.0-test" };
    getProgramContextMock.mockReturnValueOnce(ctx as never);

    await runCli(["node", "eve", "doctor", "--help"]);

    expect(registerCoreCliByNameMock.mock.calls).toEqual([
      [program, ctx, "doctor", ["node", "eve", "doctor", "--help"]],
    ]);
    expect(registerSubCliByNameMock.mock.calls).toEqual([
      [program, "doctor", ["node", "eve", "doctor", "--help"]],
    ]);
  });

  it("restores terminal state before uncaught CLI exits", async () => {
    buildProgramMock.mockReturnValueOnce({
      commands: [{ name: () => "status" }],
      parseAsync: vi.fn().mockResolvedValueOnce(undefined),
    });

    const processOnSpy = vi.spyOn(process, "on");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${String(code)})`);
    }) as typeof process.exit);

    await runCli(["node", "eve", "status"]);

    const handler = processOnSpy.mock.calls.find(([event]) => event === "uncaughtException")?.[1];
    if (typeof handler !== "function") {
      throw new Error("uncaughtException handler was not registered");
    }

    try {
      expect(() => handler(new Error("boom"))).toThrow("process.exit(1)");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[eve] EVE hit an unexpected runtime error.",
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith("[eve] Reason: boom");
      expect(restoreTerminalStateMock).toHaveBeenCalledWith("uncaught exception", {
        resumeStdinIfPaused: false,
      });
    } finally {
      if (typeof handler === "function") {
        process.off("uncaughtException", handler);
      }
      consoleErrorSpy.mockRestore();
      exitSpy.mockRestore();
      processOnSpy.mockRestore();
    }
  });

  it("does not exit for transient uncaught CLI exceptions", async () => {
    buildProgramMock.mockReturnValueOnce({
      commands: [{ name: () => "status" }],
      parseAsync: vi.fn().mockResolvedValueOnce(undefined),
    });

    const processOnSpy = vi.spyOn(process, "on");
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${String(code)})`);
    }) as typeof process.exit);

    await runCli(["node", "eve", "status"]);

    const handler = processOnSpy.mock.calls.find(([event]) => event === "uncaughtException")?.[1];
    if (typeof handler !== "function") {
      throw new Error("uncaughtException handler was not registered");
    }

    try {
      const hostUnreachable = Object.assign(new Error("connect EHOSTUNREACH 149.154.167.220:443"), {
        code: "EHOSTUNREACH",
      });
      expect(handler(hostUnreachable)).toBeUndefined();
      expect(consoleWarnSpy.mock.calls).toEqual([
        ["[eve] Non-fatal uncaught exception (continuing):", hostUnreachable.stack],
      ]);
      expect(restoreTerminalStateMock).not.toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      if (typeof handler === "function") {
        process.off("uncaughtException", handler);
      }
      consoleWarnSpy.mockRestore();
      exitSpy.mockRestore();
      processOnSpy.mockRestore();
    }
  });
});
