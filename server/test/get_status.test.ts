import { describe, expect, it } from "vitest";
import { getStatus, outputSchema } from "../src/tools/get_status.js";
import { STARTED_AT, testConfig } from "./helpers.js";

describe("get_status", () => {
  const config = testConfig();

  it("returns version, uptime, a greeting and a summary", async () => {
    const now = () => new Date(STARTED_AT.getTime() + 125_000);
    const out = await getStatus.handler({}, { config, now });

    expect(outputSchema.parse(out)).toEqual(out);
    expect(out.version).toBe("9.9.9-test");
    expect(out.uptimeSeconds).toBe(125);
    expect(out.startedAt).toBe(STARTED_AT.toISOString());
    expect(out.greeting).toMatch(/Frank/);
    expect(out.summary).toBe("Frank 9.9.9-test is up and has been running for 2m 5s.");
  });

  it("never reports negative uptime if the clock steps back", async () => {
    const out = await getStatus.handler({}, { config, now: () => new Date(STARTED_AT.getTime() - 5000) });
    expect(out.uptimeSeconds).toBe(0);
  });

  it("rejects unknown input fields", () => {
    expect(getStatus.inputSchema.safeParse({ resource_group: "someone-else" }).success).toBe(false);
  });
});
