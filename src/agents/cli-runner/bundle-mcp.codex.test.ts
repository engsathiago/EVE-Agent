/** Tests Codex CLI bundle-MCP config override generation. */
import { describe, expect, it } from "vitest";
import { prepareCliBundleMcpConfig } from "./bundle-mcp.js";

describe("prepareCliBundleMcpConfig codex", () => {
  it("injects codex MCP config overrides with env-backed loopback headers", async () => {
    const prepared = await prepareCliBundleMcpConfig({
      enabled: true,
      mode: "codex-config-overrides",
      backend: {
        command: "codex",
        args: ["exec", "--json"],
        resumeArgs: ["exec", "resume", "{sessionId}"],
      },
      workspaceDir: "/tmp/eve-bundle-mcp-codex",
      config: { plugins: { enabled: false } },
      additionalConfig: {
        mcpServers: {
          eve: {
            type: "http",
            url: "http://127.0.0.1:23119/mcp",
            headers: {
              Authorization: "Bearer ${EVE_MCP_TOKEN}",
              "x-session-key": "${EVE_MCP_SESSION_KEY}",
              "x-eve-cli-capture-key": "${EVE_MCP_CLI_CAPTURE_KEY}",
            },
          },
        },
      },
    });

    // Codex consumes MCP config through TOML-like -c overrides instead of a
    // generated config file.
    expect(prepared.backend.args).toEqual([
      "exec",
      "--json",
      "-c",
      'mcp_servers={ eve = { url = "http://127.0.0.1:23119/mcp", default_tools_approval_mode = "approve", bearer_token_env_var = "EVE_MCP_TOKEN", env_http_headers = { x-session-key = "EVE_MCP_SESSION_KEY", x-eve-cli-capture-key = "EVE_MCP_CLI_CAPTURE_KEY" } } }',
    ]);
    expect(prepared.backend.resumeArgs).toEqual([
      "exec",
      "resume",
      "{sessionId}",
      "-c",
      'mcp_servers={ eve = { url = "http://127.0.0.1:23119/mcp", default_tools_approval_mode = "approve", bearer_token_env_var = "EVE_MCP_TOKEN", env_http_headers = { x-session-key = "EVE_MCP_SESSION_KEY", x-eve-cli-capture-key = "EVE_MCP_CLI_CAPTURE_KEY" } } }',
    ]);
    expect(prepared.cleanup).toBeUndefined();
  });
});
