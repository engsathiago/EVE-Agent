// Tests EVE execution environment construction.
import { describe, expect, it } from "vitest";
import {
  ensureEVEExecMarkerOnProcess,
  markEVEExecEnv,
  EVE_CLI_ENV_VALUE,
  EVE_CLI_ENV_VAR,
} from "./eve-exec-env.js";

describe("markEVEExecEnv", () => {
  it("returns a cloned env object with the exec marker set", () => {
    const env = { PATH: "/usr/bin", EVE_CLI: "0" };
    const marked = markEVEExecEnv(env);

    expect(marked).toEqual({
      PATH: "/usr/bin",
      EVE_CLI: EVE_CLI_ENV_VALUE,
    });
    expect(marked).not.toBe(env);
    expect(env.EVE_CLI).toBe("0");
  });
});

describe("ensureEVEExecMarkerOnProcess", () => {
  it.each([
    {
      name: "mutates and returns the provided process env",
      env: { PATH: "/usr/bin" } as NodeJS.ProcessEnv,
    },
    {
      name: "overwrites an existing marker on the provided process env",
      env: { PATH: "/usr/bin", [EVE_CLI_ENV_VAR]: "0" } as NodeJS.ProcessEnv,
    },
  ])("$name", ({ env }) => {
    expect(ensureEVEExecMarkerOnProcess(env)).toBe(env);
    expect(env[EVE_CLI_ENV_VAR]).toBe(EVE_CLI_ENV_VALUE);
  });

  it("defaults to mutating process.env when no env object is provided", () => {
    const previous = process.env[EVE_CLI_ENV_VAR];
    delete process.env[EVE_CLI_ENV_VAR];

    try {
      expect(ensureEVEExecMarkerOnProcess()).toBe(process.env);
      expect(process.env[EVE_CLI_ENV_VAR]).toBe(EVE_CLI_ENV_VALUE);
    } finally {
      if (previous === undefined) {
        delete process.env[EVE_CLI_ENV_VAR];
      } else {
        process.env[EVE_CLI_ENV_VAR] = previous;
      }
    }
  });
});
