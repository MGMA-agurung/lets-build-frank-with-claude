import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getStatus } from "./get_status.js";
import { ToolError, toError, toResult, type ToolContext, type ToolDefinition } from "./types.js";

// Every tool Frank exposes. Add a module under tools/ and list it here; the
// console picks it up from MCP discovery with no UI change (ADR-003).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tools: ToolDefinition<any, any>[] = [getStatus];

export function registerTools(server: McpServer, ctx: ToolContext): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        // ADR-002: Frank observes; he does not act.
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async (input: unknown) => {
        try {
          return toResult(await tool.handler(input, ctx));
        } catch (error) {
          // Plain language only, never a stack trace (ADR-002).
          if (error instanceof ToolError) return toError(error.message);
          console.error(`[frank] ${tool.name} failed:`, error);
          return toError(`${tool.name} failed unexpectedly. Frank logged the details; try again shortly.`);
        }
      },
    );
  }
}
