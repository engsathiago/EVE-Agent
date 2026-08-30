// Program route tests cover CLI route table registration and dispatch.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultRuntime } from "../../runtime.js";
import { findRoutedCommand } from "./routes.js";

const runConfigGetMock = vi.hoisted(() => vi.fn(async () => {}));
const runConfigUnsetMock = vi.hoisted(() => vi.fn(async () => {}));
const modelsListCommandMock = vi.hoisted(() => vi.fn(async () => {}));
const modelsStatusCommandMock = vi.hoisted(() => vi.fn(async () => {}));
const runDaemonStatusMock = vi.hoisted(() => vi.fn(async () => {}));
const statusJsonCommandMock = vi.hoisted(() => vi.fn(async () => {}));
const tasksListJsonCommandMock = vi.hoisted(() => vi.fn(async () => {}));
const tasksAuditJsonCommandMock = vi.hoisted(() => vi.fn(async () => {}));
const channelsListCommandMock = vi.hoisted(() => vi.fn(async () => {}));
const channelsStatusCommandMock = vi.hoisted(() => vi.fn(async () => {}));
const agentsListCommandMock = vi.hoisted(() => vi.fn(async () => {}));
const runPluginsListCommandMock = vi.hoisted(() => vi.fn(async () => {}));
const pluginsCliLoadedMock = vi.hoisted(() => vi.fn());

vi.mock("../config-cli.js", () => ({
  runConfigGet: runConfigGetMock,
  runConfigUnset: runConfigUnsetMock,
}));

vi.mock("../../commands/models/list.list-command.js", () => ({
  modelsListCommand: modelsListCommandMock,
}));
vi.mock("../../commands/models/list.status-command.js", () => ({
  modelsStatusCommand: modelsStatusCommandMock,
}));

vi.mock("../daemon-cli/status.js", () => ({
  runDaemonStatus: runDaemonStatusMock,
}));

vi.mock("../../commands/status-json.js", () => ({
  statusJsonCommand: statusJsonCommandMock,
}));

vi.mock("../../commands/tasks-json.js", () => ({
  tasksListJsonCommand: tasksListJsonCommandMock,
  tasksAuditJsonCommand: tasksAuditJsonCommandMock,
}));

vi.mock("../../commands/tasks.js", () => {
  throw new Error("routed task JSON commands must not import the full tasks command module");
});

vi.mock("../../commands/channels/list.js", () => ({
  channelsListCommand: channelsListCommandMock,
}));

vi.mock("../../commands/channels/status.js", () => ({
  channelsStatusCommand: channelsStatusCommandMock,
}));

vi.mock("../../commands/agents.commands.list.js", () => ({
  agentsListCommand: agentsListCommandMock,
}));

vi.mock("../plugins-list-command.js", () => ({
  runPluginsListCommand: runPluginsListCommandMock,
}));

vi.mock("../plugins-cli.js", () => {
  pluginsCliLoadedMock();
  return {
    registerPluginsCli: vi.fn(),
  };
});

describe("program routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  type ProgramRoute = NonNullable<ReturnType<typeof findRoutedCommand>>;

  function expectRoute(path: string[], argv?: string[]): ProgramRoute {
    const route = findRoutedCommand(path, argv);
    if (route === null) {
      throw new Error(`Expected routed command for ${path.join(" ")}`);
    }
    expect(route.run).toBeTypeOf("function");
    return route;
  }

  async function expectRunFalse(path: string[], argv: string[]) {
    const route = expectRoute(path);
    await expect(route.run(argv)).resolves.toBe(false);
  }

  it("matches status route without plugin preload", () => {
    const route = expectRoute(["status"]);
    expect(route.loadPlugins).toBeUndefined();
  });

  it("matches health route without plugin preload", () => {
    const route = expectRoute(["health"]);
    expect(route.loadPlugins).toBeUndefined();
  });

  it("matches channel read-only routes without plugin preload", () => {
    expect(expectRoute(["channels", "list"]).loadPlugins).toBeUndefined();
    expect(expectRoute(["channels", "status"]).loadPlugins).toBeUndefined();
  });

  it("matches agents read-only routes without plugin preload", () => {
    expect(expectRoute(["agents"]).loadPlugins).toBeUndefined();
    expect(expectRoute(["agents", "list"]).loadPlugins).toBeUndefined();
  });

  it("passes parsed agents list flags through", async () => {
    await expect(expectRoute(["agents"]).run(["node", "eve", "agents"])).resolves.toBe(true);
    expect(agentsListCommandMock).toHaveBeenCalledWith(
      { json: false, bindings: false },
      defaultRuntime,
    );

    await expect(
      expectRoute(["agents", "list"]).run([
        "node",
        "eve",
        "agents",
        "list",
        "--json",
        "--bindings",
      ]),
    ).resolves.toBe(true);
    expect(agentsListCommandMock).toHaveBeenLastCalledWith(
      { json: true, bindings: true },
      defaultRuntime,
    );
  });

  it("passes parsed channel read-only route flags through", async () => {
    const listRoute = expectRoute(["channels", "list"]);
    await expect(listRoute.run(["node", "eve", "channels", "list", "--json"])).resolves.toBe(true);
    expect(channelsListCommandMock).toHaveBeenCalledWith(
      { json: true, all: false },
      defaultRuntime,
    );

    const statusRoute = expectRoute(["channels", "status"]);
    await expect(
      statusRoute.run([
        "node",
        "eve",
        "channels",
        "status",
        "--json",
        "--probe",
        "--channel",
        "imsg",
        "--timeout",
        "5000",
      ]),
    ).resolves.toBe(true);
    expect(channelsStatusCommandMock).toHaveBeenCalledWith(
      { channel: "imsg", json: true, probe: true, timeout: "5000" },
      defaultRuntime,
    );
  });

  it("routes plugins list JSON without importing the full plugins CLI", async () => {
    const route = expectRoute(["plugins", "list"]);
    expect(route.loadPlugins).toBeUndefined();
    expect(route.canRun?.(["node", "eve", "plugins", "list"])).toBe(false);

    await expect(
      route.run(["node", "eve", "plugins", "list", "--json", "--enabled", "--verbose"]),
    ).resolves.toBe(true);

    expect(runPluginsListCommandMock).toHaveBeenCalledWith(
      { json: true, enabled: true, verbose: true },
      defaultRuntime,
    );
    expect(pluginsCliLoadedMock).not.toHaveBeenCalled();
  });

  it("returns false for plugins list JSON route with unsupported arguments", async () => {
    await expectRunFalse(
      ["plugins", "list"],
      ["node", "eve", "plugins", "list", "--json", "--wat"],
    );
  });

  it("matches gateway status route without plugin preload", () => {
    const route = expectRoute(["gateway", "status"]);
    expect(route.loadPlugins).toBeUndefined();
  });

  it("returns false for gateway status route when option values are missing", async () => {
    await expectRunFalse(["gateway", "status"], ["node", "eve", "gateway", "status", "--url"]);
    await expectRunFalse(["gateway", "status"], ["node", "eve", "gateway", "status", "--token"]);
    await expectRunFalse(["gateway", "status"], ["node", "eve", "gateway", "status", "--password"]);
    await expectRunFalse(["gateway", "status"], ["node", "eve", "gateway", "status", "--timeout"]);
  });

  it("returns false for gateway status route when probe-only flags are present", async () => {
    await expectRunFalse(
      ["gateway", "status"],
      ["node", "eve", "gateway", "status", "--ssh", "user@host"],
    );
    await expectRunFalse(
      ["gateway", "status"],
      ["node", "eve", "gateway", "status", "--ssh-identity", "~/.ssh/id_test"],
    );
    await expectRunFalse(["gateway", "status"], ["node", "eve", "gateway", "status", "--ssh-auto"]);
  });

  it("passes parsed gateway status flags through to daemon status", async () => {
    const route = expectRoute(["gateway", "status"]);
    await expect(
      route.run([
        "node",
        "eve",
        "--profile",
        "work",
        "gateway",
        "status",
        "--url",
        "ws://127.0.0.1:18789",
        "--token",
        "abc",
        "--password",
        "def",
        "--timeout",
        "5000",
        "--deep",
        "--require-rpc",
        "--json",
      ]),
    ).resolves.toBe(true);
    expect(runDaemonStatusMock).toHaveBeenCalledWith({
      rpc: {
        url: "ws://127.0.0.1:18789",
        token: "abc",
        password: "def",
        timeout: "5000",
      },
      probe: true,
      requireRpc: true,
      deep: true,
      json: true,
    });
  });

  it("passes --no-probe through to daemon status", async () => {
    const route = expectRoute(["gateway", "status"]);
    await expect(route.run(["node", "eve", "gateway", "status", "--no-probe"])).resolves.toBe(true);

    expect(runDaemonStatusMock).toHaveBeenCalledWith({
      rpc: {
        url: undefined,
        token: undefined,
        password: undefined,
        timeout: undefined,
      },
      probe: false,
      requireRpc: false,
      deep: false,
      json: false,
    });
  });

  it("returns false when status timeout flag value is missing", async () => {
    await expectRunFalse(["status"], ["node", "eve", "status", "--timeout"]);
  });

  it("routes status --json through the lean JSON command", async () => {
    const route = expectRoute(["status"]);
    await expect(
      route.run(["node", "eve", "status", "--json", "--deep", "--usage", "--timeout", "5000"]),
    ).resolves.toBe(true);
    expect(statusJsonCommandMock).toHaveBeenCalledWith(
      { deep: true, all: false, usage: true, timeoutMs: 5000 },
      defaultRuntime,
    );
  });

  it("returns false for sessions route when --store value is missing", async () => {
    await expectRunFalse(["sessions"], ["node", "eve", "sessions", "--store"]);
  });

  it("returns false for sessions route when --active value is missing", async () => {
    await expectRunFalse(["sessions"], ["node", "eve", "sessions", "--active"]);
  });

  it("returns false for sessions route when --agent value is missing", async () => {
    await expectRunFalse(["sessions"], ["node", "eve", "sessions", "--agent"]);
  });

  it("does not fast-route sessions subcommands", () => {
    expect(findRoutedCommand(["sessions", "cleanup"])).toBeNull();
  });

  it("does not match unknown routes", () => {
    expect(findRoutedCommand(["definitely-not-real"])).toBeNull();
  });

  it("returns false for config get route when path argument is missing", async () => {
    await expectRunFalse(["config", "get"], ["node", "eve", "config", "get", "--json"]);
  });

  it("returns false for config unset route when path argument is missing", async () => {
    await expectRunFalse(["config", "unset"], ["node", "eve", "config", "unset"]);
  });

  it("passes config get path correctly when root option values precede command", async () => {
    const route = expectRoute(["config", "get"]);
    await expect(
      route.run([
        "node",
        "eve",
        "--log-level",
        "debug",
        "config",
        "get",
        "update.channel",
        "--json",
      ]),
    ).resolves.toBe(true);
    expect(runConfigGetMock).toHaveBeenCalledWith({ path: "update.channel", json: true });
  });

  it("passes config unset path correctly when root option values precede command", async () => {
    const route = expectRoute(["config", "unset"]);
    await expect(
      route.run(["node", "eve", "--profile", "work", "config", "unset", "update.channel"]),
    ).resolves.toBe(true);
    expect(runConfigUnsetMock).toHaveBeenCalledWith({
      path: "update.channel",
      cliOptions: {
        dryRun: false,
        allowExec: false,
        json: false,
      },
    });
  });

  it("passes config get path when root value options appear after subcommand", async () => {
    const route = expectRoute(["config", "get"]);
    await expect(
      route.run([
        "node",
        "eve",
        "config",
        "get",
        "--log-level",
        "debug",
        "update.channel",
        "--json",
      ]),
    ).resolves.toBe(true);
    expect(runConfigGetMock).toHaveBeenCalledWith({ path: "update.channel", json: true });
  });

  it("passes config unset path when root value options appear after subcommand", async () => {
    const route = expectRoute(["config", "unset"]);
    await expect(
      route.run(["node", "eve", "config", "unset", "--profile", "work", "update.channel"]),
    ).resolves.toBe(true);
    expect(runConfigUnsetMock).toHaveBeenCalledWith({
      path: "update.channel",
      cliOptions: {
        dryRun: false,
        allowExec: false,
        json: false,
      },
    });
  });

  it("passes config unset dry-run options", async () => {
    const route = expectRoute(["config", "unset"]);
    await expect(
      route.run([
        "node",
        "eve",
        "config",
        "unset",
        "--dry-run",
        "--json",
        "--allow-exec",
        "update.channel",
      ]),
    ).resolves.toBe(true);
    expect(runConfigUnsetMock).toHaveBeenCalledWith({
      path: "update.channel",
      cliOptions: {
        dryRun: true,
        allowExec: true,
        json: true,
      },
    });
  });

  it("returns false for config get route when unknown option appears", async () => {
    await expectRunFalse(
      ["config", "get"],
      ["node", "eve", "config", "get", "--mystery", "value", "update.channel"],
    );
  });

  it("returns false for models list route when --provider value is missing", async () => {
    await expectRunFalse(["models", "list"], ["node", "eve", "models", "list", "--provider"]);
  });

  it("returns false for models status route when probe flags are missing values", async () => {
    await expectRunFalse(
      ["models", "status"],
      ["node", "eve", "models", "status", "--probe-provider"],
    );
    await expectRunFalse(
      ["models", "status"],
      ["node", "eve", "models", "status", "--probe-timeout"],
    );
    await expectRunFalse(
      ["models", "status"],
      ["node", "eve", "models", "status", "--probe-concurrency"],
    );
    await expectRunFalse(
      ["models", "status"],
      ["node", "eve", "models", "status", "--probe-max-tokens"],
    );
    await expectRunFalse(
      ["models", "status"],
      ["node", "eve", "models", "status", "--probe-provider", "openai", "--agent"],
    );
  });

  it("returns false for models status route when --probe-profile has no value", async () => {
    await expectRunFalse(
      ["models", "status"],
      ["node", "eve", "models", "status", "--probe-profile"],
    );
  });

  it("accepts negative-number probe profile values", async () => {
    const route = expectRoute(["models", "status"]);
    await expect(
      route.run([
        "node",
        "eve",
        "models",
        "status",
        "--probe-provider",
        "openai",
        "--probe-timeout",
        "5000",
        "--probe-concurrency",
        "2",
        "--probe-max-tokens",
        "64",
        "--probe-profile",
        "-1",
        "--agent",
        "default",
      ]),
    ).resolves.toBe(true);
    expect(modelsStatusCommandMock).toHaveBeenCalledWith(
      {
        probeProvider: "openai",
        probeTimeout: "5000",
        probeConcurrency: "2",
        probeMaxTokens: "64",
        probeProfile: "-1",
        agent: "default",
        json: false,
        plain: false,
        check: false,
        probe: false,
      },
      defaultRuntime,
    );
  });

  it("routes tasks list JSON through the lean task JSON command", async () => {
    const rootRoute = expectRoute(["tasks"]);
    expect(rootRoute.loadPlugins).toBeUndefined();
    expect(rootRoute.canRun?.(["node", "eve", "tasks"])).toBe(false);
    await expect(
      rootRoute.run(["node", "eve", "tasks", "--json", "--runtime", "cli", "--status=running"]),
    ).resolves.toBe(true);
    expect(tasksListJsonCommandMock).toHaveBeenCalledWith(
      { json: true, runtime: "cli", status: "running" },
      defaultRuntime,
    );

    const listRoute = expectRoute(["tasks", "list"]);
    expect(listRoute.loadPlugins).toBeUndefined();
    await expect(
      listRoute.run(["node", "eve", "tasks", "list", "--json", "--runtime=cron"]),
    ).resolves.toBe(true);
    expect(tasksListJsonCommandMock).toHaveBeenLastCalledWith(
      { json: true, runtime: "cron", status: undefined },
      defaultRuntime,
    );
  });

  it("routes parent task filter values that command-path discovery sees as positionals", async () => {
    const separateValueArgv = [
      "node",
      "eve",
      "tasks",
      "--json",
      "--runtime",
      "cli",
      "--status",
      "running",
    ];
    const separateValueRoute = expectRoute(["tasks", "cli"], separateValueArgv);
    await expect(separateValueRoute.run(separateValueArgv)).resolves.toBe(true);
    expect(tasksListJsonCommandMock).toHaveBeenCalledWith(
      { json: true, runtime: "cli", status: "running" },
      defaultRuntime,
    );

    const parentOptionBeforeSubcommandArgv = [
      "node",
      "eve",
      "tasks",
      "--runtime",
      "cli",
      "list",
      "--json",
    ];
    const parentOptionBeforeSubcommandRoute = expectRoute(
      ["tasks", "cli"],
      parentOptionBeforeSubcommandArgv,
    );
    await expect(
      parentOptionBeforeSubcommandRoute.run(parentOptionBeforeSubcommandArgv),
    ).resolves.toBe(true);
    expect(tasksListJsonCommandMock).toHaveBeenLastCalledWith(
      { json: true, runtime: "cli", status: undefined },
      defaultRuntime,
    );
  });

  it("routes tasks audit JSON through the lean task JSON command", async () => {
    const route = expectRoute(["tasks", "audit"]);
    expect(route.loadPlugins).toBeUndefined();
    expect(route.canRun?.(["node", "eve", "tasks", "audit"])).toBe(false);
    await expect(
      route.run([
        "node",
        "eve",
        "tasks",
        "audit",
        "--json",
        "--severity",
        "error",
        "--code=stale_running",
        "--limit",
        "5",
      ]),
    ).resolves.toBe(true);
    expect(tasksAuditJsonCommandMock).toHaveBeenCalledWith(
      { json: true, severity: "error", code: "stale_running", limit: 5 },
      defaultRuntime,
    );
  });

  it("returns false for task JSON routes when option values are missing or unknown", async () => {
    await expectRunFalse(["tasks"], ["node", "eve", "tasks", "--json", "--runtime"]);
    await expectRunFalse(["tasks", "list"], ["node", "eve", "tasks", "list"]);
    await expectRunFalse(
      ["tasks", "audit"],
      ["node", "eve", "tasks", "audit", "--json", "--limit"],
    );
    await expectRunFalse(
      ["tasks", "audit"],
      ["node", "eve", "tasks", "audit", "--json", "--limit", "5abc"],
    );
    await expectRunFalse(
      ["tasks", "audit"],
      ["node", "eve", "tasks", "audit", "--json", "--unknown"],
    );
    expect(
      findRoutedCommand(["tasks", "cli"], ["node", "eve", "tasks", "--runtime", "cli"]),
    ).toBeNull();
  });
});
