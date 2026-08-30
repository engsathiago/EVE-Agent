// Profile CLI tests cover profile selection, persistence, and command wiring.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs(["node", "eve", "gateway", "--dev", "--allow-unconfigured"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "eve", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("leaves gateway --dev for subcommands after leading root options", () => {
    const res = parseCliProfileArgs([
      "node",
      "eve",
      "--no-color",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual([
      "node",
      "eve",
      "--no-color",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "eve", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "eve", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "eve", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "eve", "status"]);
  });

  it("parses interleaved --profile after the command token", () => {
    const res = parseCliProfileArgs(["node", "eve", "status", "--profile", "work", "--deep"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "eve", "status", "--deep"]);
  });

  it("preserves Matrix QA --profile for the command parser", () => {
    const res = parseCliProfileArgs([
      "node",
      "eve",
      "qa",
      "matrix",
      "--profile",
      "fast",
      "--fail-fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "eve", "qa", "matrix", "--profile", "fast", "--fail-fast"]);
  });

  it("preserves Matrix QA --profile after leading root options", () => {
    const res = parseCliProfileArgs([
      "node",
      "eve",
      "--no-color",
      "qa",
      "matrix",
      "--profile=fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "eve", "--no-color", "qa", "matrix", "--profile=fast"]);
  });

  it("parses qa run --profile smoke-ci as a root profile", () => {
    const res = parseCliProfileArgs([
      "node",
      "eve",
      "qa",
      "run",
      "--profile",
      "smoke-ci",
      "--category",
      "agent-runtime-and-provider-execution.agent-turn-execution",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("smoke-ci");
    expect(res.argv).toEqual([
      "node",
      "eve",
      "qa",
      "run",
      "--category",
      "agent-runtime-and-provider-execution.agent-turn-execution",
    ]);
  });

  it("parses qa run --profile=release self-check invocations as root profiles", () => {
    const res = parseCliProfileArgs([
      "node",
      "eve",
      "qa",
      "run",
      "--profile=release",
      "--output",
      "qa-report.md",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("release");
    expect(res.argv).toEqual(["node", "eve", "qa", "run", "--output", "qa-report.md"]);
  });

  it("preserves qa run --qa-profile for the command parser", () => {
    const res = parseCliProfileArgs([
      "node",
      "eve",
      "qa",
      "run",
      "--qa-profile",
      "smoke-ci",
      "--surface",
      "agent-runtime-and-provider-execution",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual([
      "node",
      "eve",
      "qa",
      "run",
      "--qa-profile",
      "smoke-ci",
      "--surface",
      "agent-runtime-and-provider-execution",
    ]);
  });

  it("parses arbitrary qa run --profile values as root profiles", () => {
    const res = parseCliProfileArgs([
      "node",
      "eve",
      "qa",
      "run",
      "--profile",
      "work",
      "--output",
      "qa-report.md",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "eve", "qa", "run", "--output", "qa-report.md"]);
  });

  it("parses arbitrary qa run --profile= values as root profiles", () => {
    const res = parseCliProfileArgs([
      "node",
      "eve",
      "qa",
      "run",
      "--profile=work",
      "--output",
      "qa-report.md",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "eve", "qa", "run", "--output", "qa-report.md"]);
  });

  it("still parses root --profile before qa run", () => {
    const res = parseCliProfileArgs([
      "node",
      "eve",
      "--profile",
      "work",
      "qa",
      "run",
      "--qa-profile",
      "smoke-ci",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "eve", "qa", "run", "--qa-profile", "smoke-ci"]);
  });

  it("still parses root --profile before Matrix QA", () => {
    const res = parseCliProfileArgs([
      "node",
      "eve",
      "--profile",
      "work",
      "qa",
      "matrix",
      "--fail-fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "eve", "qa", "matrix", "--fail-fast"]);
  });

  it("parses interleaved --dev after the command token", () => {
    const res = parseCliProfileArgs(["node", "eve", "status", "--dev"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "eve", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "eve", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "eve", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "eve", "--profile", "work", "--dev", "status"]],
    ["interleaved after command", ["node", "eve", "status", "--profile", "work", "--dev"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".eve-dev");
    expect(env.EVE_PROFILE).toBe("dev");
    expect(env.EVE_STATE_DIR).toBe(expectedStateDir);
    expect(env.EVE_CONFIG_PATH).toBe(path.join(expectedStateDir, "eve.json"));
    expect(env.EVE_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      EVE_PROFILE: "prod",
      EVE_STATE_DIR: "/custom",
      EVE_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.EVE_PROFILE).toBe("dev");
    expect(env.EVE_STATE_DIR).toBe("/custom");
    expect(env.EVE_GATEWAY_PORT).toBe("19099");
    expect(env.EVE_CONFIG_PATH).toBe(path.join("/custom", "eve.json"));
  });

  it("uses EVE_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      EVE_HOME: "/srv/eve-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/eve-home");
    expect(env.EVE_STATE_DIR).toBe(path.join(resolvedHome, ".eve-work"));
    expect(env.EVE_CONFIG_PATH).toBe(path.join(resolvedHome, ".eve-work", "eve.json"));
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "eve doctor --fix",
      env: {},
      expected: "eve doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "eve doctor --fix",
      env: { EVE_PROFILE: "default" },
      expected: "eve doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "eve doctor --fix",
      env: { EVE_PROFILE: "Default" },
      expected: "eve doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "eve doctor --fix",
      env: { EVE_PROFILE: "bad profile" },
      expected: "eve doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "eve --profile work doctor --fix",
      env: { EVE_PROFILE: "work" },
      expected: "eve --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "eve --dev doctor",
      env: { EVE_PROFILE: "dev" },
      expected: "eve --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("eve doctor --fix", { EVE_PROFILE: "work" })).toBe(
      "eve --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("eve doctor --fix", { EVE_PROFILE: "  jbeve  " })).toBe(
      "eve --profile jbeve doctor --fix",
    );
  });

  it("handles command with no args after eve", () => {
    expect(formatCliCommand("eve", { EVE_PROFILE: "test" })).toBe("eve --profile test");
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm eve doctor", { EVE_PROFILE: "work" })).toBe(
      "pnpm eve --profile work doctor",
    );
  });

  it("inserts --container when a container hint is set", () => {
    expect(formatCliCommand("eve gateway status --deep", { EVE_CONTAINER_HINT: "demo" })).toBe(
      "eve --container demo gateway status --deep",
    );
  });

  it("ignores unsafe container hints", () => {
    expect(
      formatCliCommand("eve gateway status --deep", {
        EVE_CONTAINER_HINT: "demo; rm -rf /",
      }),
    ).toBe("eve gateway status --deep");
  });

  it("preserves both --container and --profile hints", () => {
    expect(
      formatCliCommand("eve doctor", {
        EVE_CONTAINER_HINT: "demo",
        EVE_PROFILE: "work",
      }),
    ).toBe("eve --container demo doctor");
  });

  it("does not prepend --container for update commands", () => {
    expect(formatCliCommand("eve update", { EVE_CONTAINER_HINT: "demo" })).toBe("eve update");
    expect(formatCliCommand("pnpm eve update --channel beta", { EVE_CONTAINER_HINT: "demo" })).toBe(
      "pnpm eve update --channel beta",
    );
  });
});
