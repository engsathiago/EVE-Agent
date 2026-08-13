/**
 * Tests cron-triggered tool assembly.
 * Ensures cron runs scope cron tool behavior to self-removal of the current
 * job only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyAgentTool } from "./tools/common.js";

const mocks = vi.hoisted(() => {
  const stubTool = (name: string) =>
    ({
      name,
      label: name,
      displaySummary: name,
      description: name,
      parameters: { type: "object", properties: {} },
      execute: vi.fn(),
    }) satisfies AnyAgentTool;

  return {
    createEVEToolsOptions: vi.fn(),
    stubTool,
  };
});

vi.mock("./eve-tools.js", () => ({
  createEVETools: (options: unknown) => {
    mocks.createEVEToolsOptions(options);
    return [mocks.stubTool("cron")];
  },
}));

import "./test-helpers/fast-bash-tools.js";
import "./test-helpers/fast-coding-tools.js";
import { createEVECodingTools } from "./agent-tools.js";

function firstEVEToolsOptions(): { cronSelfRemoveOnlyJobId?: string } | undefined {
  return mocks.createEVEToolsOptions.mock.calls[0]?.[0] as
    | { cronSelfRemoveOnlyJobId?: string }
    | undefined;
}

describe("createEVECodingTools cron scope", () => {
  beforeEach(() => {
    mocks.createEVEToolsOptions.mockClear();
  });

  it("scopes cron-triggered jobs to self-removal", () => {
    const tools = createEVECodingTools({
      trigger: "cron",
      jobId: "job-current",
    });

    expect(tools.map((tool) => tool.name)).toContain("cron");
    expect(firstEVEToolsOptions()?.cronSelfRemoveOnlyJobId).toBe("job-current");
  });

  it("does not scope non-cron sessions", () => {
    createEVECodingTools({
      trigger: "user",
      jobId: "job-current",
    });

    expect(firstEVEToolsOptions()?.cronSelfRemoveOnlyJobId).toBeUndefined();
  });
});
