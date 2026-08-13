// EVE MCP tools tests cover core tool server startup and registration.
import { describe, expect, it } from "vitest";
import { resolveEVEToolsForMcp } from "./eve-tools-serve.js";
import { createPluginToolsMcpHandlers } from "./plugin-tools-handlers.js";

describe("EVE tools MCP server", () => {
  it("exposes cron", async () => {
    const handlers = createPluginToolsMcpHandlers(resolveEVEToolsForMcp());

    const listed = await handlers.listTools();
    expect(listed.tools.map((tool) => tool.name)).toContain("cron");
  });
});
