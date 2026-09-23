import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectClient, startApp, STARTED_AT, testConfig, type Running } from "./helpers.js";

describe("MCP over Streamable HTTP (ADR-001)", () => {
  let app: Running;

  beforeAll(async () => {
    app = await startApp(testConfig(), () => new Date(STARTED_AT.getTime() + 3_000));
  });
  afterAll(() => app.close());

  it("answers GET /healthz with 200", async () => {
    const res = await fetch(`${app.baseUrl}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", version: "9.9.9-test" });
  });

  it("completes the MCP handshake and identifies as Frank", async () => {
    const client = await connectClient(app.baseUrl);
    expect(client.getServerVersion()).toMatchObject({ name: "frank", version: "9.9.9-test" });
    await client.close();
  });

  it("lists get_status with a strict input schema and read-only annotations", async () => {
    const client = await connectClient(app.baseUrl);
    const { tools } = await client.listTools();
    const status = tools.find((t) => t.name === "get_status");
    expect(status).toBeDefined();
    expect(status!.inputSchema).toMatchObject({ type: "object", additionalProperties: false });
    expect(status!.outputSchema).toMatchObject({ type: "object" });
    expect(status!.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    await client.close();
  });

  it("calls get_status and returns a summary plus typed fields", async () => {
    const client = await connectClient(app.baseUrl);
    const result = await client.callTool({ name: "get_status", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      summary: expect.stringContaining("Frank 9.9.9-test is up"),
      version: "9.9.9-test",
      uptimeSeconds: 3,
    });
    await client.close();
  });

  it("calls get_status with no arguments at all", async () => {
    const client = await connectClient(app.baseUrl);
    const result = await client.callTool({ name: "get_status" });
    expect(result.isError).toBeFalsy();
    await client.close();
  });

  it("rejects unknown arguments with isError and no stack trace", async () => {
    const client = await connectClient(app.baseUrl);
    const result = await client.callTool({ name: "get_status", arguments: { resource_group: "someone-else" } });
    expect(result.isError).toBe(true);
    const text = JSON.stringify(result.content);
    expect(text).not.toMatch(/\bat .+\(.+:\d+:\d+\)/);
    await client.close();
  });

  it("returns 405 for GET and DELETE on /mcp", async () => {
    expect((await fetch(`${app.baseUrl}/mcp`)).status).toBe(405);
    expect((await fetch(`${app.baseUrl}/mcp`, { method: "DELETE" })).status).toBe(405);
  });

  it("says the console isn't built when public/ is empty, and still serves MCP", async () => {
    const res = await fetch(`${app.baseUrl}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/console hasn't been built yet/);
  });
});
