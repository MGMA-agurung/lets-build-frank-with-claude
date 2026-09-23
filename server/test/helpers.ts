import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp } from "../src/app.js";
import type { Config } from "../src/config.js";

export const STARTED_AT = new Date("2026-09-01T12:00:00.000Z");

/** A config whose console directory is an empty temp dir unless one is given. */
export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: 0,
    publicDir: mkdtempSync(path.join(tmpdir(), "frank-public-")),
    version: "9.9.9-test",
    startedAt: STARTED_AT,
    ...overrides,
  };
}

export interface Running {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startApp(config: Config, now?: () => Date): Promise<Running> {
  const server: Server = await new Promise((resolve) => {
    const s = createApp(config, now).listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

export async function connectClient(baseUrl: string): Promise<Client> {
  const client = new Client({ name: "frank-test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", baseUrl)));
  return client;
}
