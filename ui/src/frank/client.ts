import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

export type { CallToolResult, Tool };

/** Everything the console needs from Frank. Pages depend on this, not on the SDK. */
export interface FrankClient {
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
}

/**
 * Talks to Frank over Streamable HTTP with the official SDK. The endpoint is
 * relative: the console is served by Frank, so there is no VITE_FRANK_URL and
 * no CORS (ADR-006). The console holds no secrets (ADR-003).
 */
export function createFrankClient(options: { endpoint?: string } = {}): FrankClient {
  const endpoint = new URL(options.endpoint ?? "/mcp", window.location.origin);
  let connection: Promise<Client> | null = null;

  const connect = (): Promise<Client> => {
    if (!connection) {
      const client = new Client({ name: "frank-console", version: "0.1.0" });
      connection = client.connect(new StreamableHTTPClientTransport(endpoint)).then(() => client);
      // A failed connect must not poison every later attempt.
      connection.catch(() => {
        connection = null;
      });
    }
    return connection;
  };

  // If Frank restarted (scale-to-zero), drop the connection and retry once.
  const withRetry = async <T>(fn: (c: Client) => Promise<T>): Promise<T> => {
    try {
      return await fn(await connect());
    } catch {
      connection = null;
      return fn(await connect());
    }
  };

  return {
    async listTools() {
      return withRetry(async (c) => {
        const tools: Tool[] = [];
        let cursor: string | undefined;
        do {
          const page = await c.listTools(cursor ? { cursor } : undefined);
          tools.push(...page.tools);
          cursor = page.nextCursor;
        } while (cursor);
        return tools;
      });
    },
    async callTool(name, args) {
      return withRetry(async (c) => (await c.callTool({ name, arguments: args })) as CallToolResult);
    },
  };
}
