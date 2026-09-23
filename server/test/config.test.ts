import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, packageRoot } from "../src/config.js";

describe("loadConfig (ADR-001: config from env only)", () => {
  it("defaults PORT to 3000 to match the Dockerfile and deploy.yml", () => {
    expect(loadConfig({}).port).toBe(3000);
  });

  it("reads PORT from the environment", () => {
    expect(loadConfig({ PORT: "8080" }).port).toBe(8080);
  });

  it("fails at boot with a plain-language message on a bad PORT", () => {
    expect(() => loadConfig({ PORT: "not-a-port" })).toThrow(/Frank's configuration is invalid: PORT/);
    expect(() => loadConfig({ PORT: "70000" })).toThrow(/PORT/);
  });

  it("resolves the console as <package root>/public", () => {
    expect(loadConfig({}).publicDir).toBe(path.join(packageRoot, "public"));
  });

  it("takes the version from package.json", () => {
    expect(loadConfig({}).version).toBe("0.1.0");
  });
});
