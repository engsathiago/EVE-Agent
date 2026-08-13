// Verifies importing context helpers does not eagerly load runtime config for
// lightweight CLI commands.
import { importFreshModule } from "eve-agent/plugin-sdk/test-fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock("../config/config.js", () => ({ getRuntimeConfig: loadConfigMock }));

describe("agents/context eager warmup", () => {
  const originalArgv = process.argv.slice();

  beforeEach(() => {
    loadConfigMock.mockReset();
  });

  afterEach(() => {
    process.argv = originalArgv.slice();
  });

  it.each([
    ["models", ["node", "eve", "models", "set", "openai/gpt-5.4"]],
    ["agent", ["node", "eve", "agent", "--message", "ok"]],
    ["memory", ["node", "eve", "memory", "search", "--json"]],
  ])("does not eager-load config for %s commands on import", async (_label, argv) => {
    // Import-time config reads are expensive and can fail for commands that only
    // need static context helpers.
    process.argv = argv;
    await importFreshModule(import.meta.url, `./context.js?scope=${_label}`);

    expect(loadConfigMock).not.toHaveBeenCalled();
  });
});
