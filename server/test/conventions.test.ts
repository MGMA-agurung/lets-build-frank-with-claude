import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { tools } from "../src/tools/index.js";

// ADR-002 is policy, not style: these fail the build when a tool drifts.
const VERBS = ["get", "list", "search", "summarize"] as const;
const NAME = new RegExp(`^(${VERBS.join("|")})_[a-z][a-z0-9]*(_[a-z0-9]+)*$`);

describe("ADR-002 tool conventions", () => {
  it("registers at least get_status", () => {
    expect(tools.map((t) => t.name)).toContain("get_status");
  });

  it("has unique tool names", () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has one module per registered tool", () => {
    const dir = fileURLToPath(new URL("../src/tools/", import.meta.url));
    const modules = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && !["index.ts", "types.ts"].includes(f))
      .map((f) => f.replace(/\.ts$/, ""));
    expect(modules.sort()).toEqual(tools.map((t) => t.name).sort());
  });

  for (const tool of tools) {
    describe(tool.name, () => {
      it("is verb_noun snake_case with a verb from the closed set", () => {
        expect(tool.name).toMatch(NAME);
      });

      it("has a one-or-two sentence description", () => {
        const sentences = tool.description.split(/(?<=[.!?])\s+/).filter(Boolean);
        expect(tool.description.length).toBeGreaterThan(20);
        expect(sentences.length).toBeLessThanOrEqual(2);
      });

      it("rejects unknown input fields", () => {
        expect(tool.inputSchema.safeParse({ __unexpected__: true }).success).toBe(false);
      });

      it("describes every input parameter", () => {
        for (const [key, schema] of Object.entries(tool.inputSchema.shape)) {
          expect((schema as z.ZodType).description, `${tool.name}.${key}`).toBeTruthy();
        }
      });

      it("outputs a top-level summary string", () => {
        expect(tool.outputSchema.shape.summary).toBeInstanceOf(z.ZodString);
      });
    });
  }
});
