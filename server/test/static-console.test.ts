import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectClient, startApp, testConfig, type Running } from "./helpers.js";

describe("serving the built console at / (ADR-006)", () => {
  let app: Running;

  beforeAll(async () => {
    const publicDir = mkdtempSync(path.join(tmpdir(), "frank-console-"));
    mkdirSync(path.join(publicDir, "assets"));
    writeFileSync(path.join(publicDir, "index.html"), "<!doctype html><title>Frank console</title>");
    writeFileSync(path.join(publicDir, "assets", "app.js"), "console.log('frank')");
    app = await startApp(testConfig({ publicDir }));
  });
  afterAll(() => app.close());

  it("serves index.html at /", async () => {
    const res = await fetch(`${app.baseUrl}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Frank console");
  });

  it("serves static assets", async () => {
    const res = await fetch(`${app.baseUrl}/assets/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
  });

  it("falls back to index.html for client-side routes", async () => {
    const res = await fetch(`${app.baseUrl}/tools`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Frank console");
  });

  it("does not shadow /healthz or /mcp", async () => {
    expect((await fetch(`${app.baseUrl}/healthz`)).status).toBe(200);
    expect((await fetch(`${app.baseUrl}/mcp`)).status).toBe(405);
  });

  it("still answers POST /mcp over the real MCP client", async () => {
    const client = await connectClient(app.baseUrl);
    const result = await client.callTool({ name: "get_status", arguments: {} });
    expect(result.isError).toBeFalsy();
    await client.close();
  });
});
