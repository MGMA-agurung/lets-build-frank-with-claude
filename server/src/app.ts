import { existsSync } from "node:fs";
import path from "node:path";
import express, { type Express, type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Config } from "./config.js";
import { createMcpServer } from "./mcp.js";

function jsonRpcError(res: Response, status: number, code: number, message: string): void {
  res.status(status).json({ jsonrpc: "2.0", error: { code, message }, id: null });
}

/**
 * MCP makes `tools/call` arguments optional, but a strict zod object (ADR-002)
 * rejects `undefined`. Treat "no arguments" as `{}` so a parameterless tool
 * works from every client; anything actually sent is still validated strictly.
 */
function defaultToolArguments(body: unknown): unknown {
  const fill = (msg: unknown) => {
    if (msg && typeof msg === "object" && (msg as { method?: unknown }).method === "tools/call") {
      const params = (msg as { params?: { arguments?: unknown } }).params;
      if (params && typeof params === "object" && params.arguments === undefined) params.arguments = {};
    }
    return msg;
  };
  return Array.isArray(body) ? body.map(fill) : fill(body);
}

/**
 * One container, three routes (ADR-001, ADR-006):
 *   POST /mcp     MCP over Streamable HTTP; stateless and unauthenticated (ADR-007 was rejected)
 *   GET  /healthz 200 for probes
 *   /             the built console, or a note saying it isn't built yet
 */
export function createApp(config: Config, now: () => Date = () => new Date()): Express {
  const app = express();
  app.disable("x-powered-by");

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", version: config.version });
  });

  // Stateless: a new server and transport per request, so one Frank serves
  // many clients concurrently with no session bookkeeping.
  app.post("/mcp", express.json({ limit: "1mb" }), async (req: Request, res: Response) => {
    const server = createMcpServer(config, now);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, defaultToolArguments(req.body));
    } catch (error) {
      console.error("[frank] /mcp request failed:", error);
      if (!res.headersSent) jsonRpcError(res, 500, -32603, "Frank hit an internal error handling that request.");
    }
  });

  // No server-initiated stream and no sessions to end in stateless mode. The
  // SDK client treats 405 on GET as "no notifications", which is what we want.
  const notAllowed = (_req: Request, res: Response) => {
    res.setHeader("Allow", "POST");
    jsonRpcError(res, 405, -32000, "Method not allowed. Frank's MCP endpoint accepts POST only.");
  };
  app.get("/mcp", notAllowed);
  app.delete("/mcp", notAllowed);

  // The console is optional (ADR-003): Frank must serve MCP before it exists.
  const indexHtml = path.join(config.publicDir, "index.html");
  if (existsSync(indexHtml)) {
    app.use(express.static(config.publicDir));
    // Unknown GETs fall back to the console shell so client-side routes work.
    app.get(/^\/(?!mcp$|healthz$).*/, (_req, res) => res.sendFile(indexHtml));
  } else {
    app.get("/", (_req, res) => {
      res
        .status(200)
        .type("text/plain")
        .send(
          "Frank is running, but his console hasn't been built yet (ADR-003).\n" +
            "MCP is at POST /mcp and health at GET /healthz.\n",
        );
    });
  }

  return app;
}
