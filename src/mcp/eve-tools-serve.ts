/**
 * Standalone MCP server for selected built-in EVE tools.
 *
 * Run via: node --import tsx src/mcp/eve-tools-serve.ts
 * Or: bun src/mcp/eve-tools-serve.ts
 */
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { createCronTool } from "../agents/tools/cron-tool.js";
import { formatErrorMessage } from "../infra/errors.js";
import { connectToolsMcpServerToStdio, createToolsMcpServer } from "./tools-stdio-server.js";

export function resolveEVEToolsForMcp(): AnyAgentTool[] {
  return [createCronTool({ creatorToolAllowlist: [{ name: "cron" }] })];
}

function createEVEToolsMcpServer(
  params: {
    tools?: AnyAgentTool[];
  } = {},
): Server {
  const tools = params.tools ?? resolveEVEToolsForMcp();
  return createToolsMcpServer({ name: "eve-tools", tools });
}

async function serveEVEToolsMcp(): Promise<void> {
  const server = createEVEToolsMcpServer();
  await connectToolsMcpServerToStdio(server);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  serveEVEToolsMcp().catch((err: unknown) => {
    process.stderr.write(`eve-tools-serve: ${formatErrorMessage(err)}\n`);
    process.exit(1);
  });
}
