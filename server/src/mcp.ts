import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "./config.js";
import { registerTools } from "./tools/index.js";

/** A fresh MCP server with all of Frank's tools registered. */
export function createMcpServer(config: Config, now: () => Date = () => new Date()): McpServer {
  const server = new McpServer({ name: "frank", title: "Frank", version: config.version });
  registerTools(server, { config, now });
  return server;
}
