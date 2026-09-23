import { describe, expect, it } from "vitest";
import { buildArguments, fieldsFromSchema, initialValues } from "../src/schema-form/schema";

// Shaped like what zod's JSON Schema output looks like over MCP discovery.
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "count"],
  properties: {
    name: { type: "string", description: "Who to look up." },
    count: { type: "integer", description: "How many." },
    ratio: { type: "number" },
    verbose: { type: "boolean", default: true },
    level: { type: "string", enum: ["low", "high"] },
    filter: { type: "object" },
    note: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
};

describe("fieldsFromSchema", () => {
  it("maps each property to a field of the right kind", () => {
    const fields = fieldsFromSchema(schema);
    expect(fields.map((f) => [f.name, f.kind, f.required])).toEqual([
      ["name", "string", true],
      ["count", "integer", true],
      ["ratio", "number", false],
      ["verbose", "boolean", false],
      ["level", "enum", false],
      ["filter", "json", false],
      ["note", "string", false],
    ]);
    expect(fields[0]!.description).toBe("Who to look up.");
    expect(fields.find((f) => f.name === "level")!.options).toEqual(["low", "high"]);
  });

  it("treats a schema with no properties as no fields", () => {
    expect(fieldsFromSchema({ type: "object", properties: {} })).toEqual([]);
    expect(fieldsFromSchema(undefined)).toEqual([]);
  });
});

describe("buildArguments", () => {
  const fields = fieldsFromSchema(schema);

  it("converts values to typed arguments and omits empty optionals", () => {
    const values = { ...initialValues(fields), name: " frank ", count: "3", filter: '{"a":1}' };
    expect(buildArguments(fields, values)).toEqual({
      ok: true,
      args: { name: "frank", count: 3, verbose: true, filter: { a: 1 } },
    });
  });

  it("reports missing required fields and bad values", () => {
    const values = { ...initialValues(fields), count: "2.5", ratio: "abc", filter: "{" };
    const result = buildArguments(fields, values);
    expect(result).toEqual({
      ok: false,
      errors: { name: "Required.", count: "Enter a whole number.", ratio: "Enter a number.", filter: "Enter valid JSON." },
    });
  });

  it("builds empty arguments for a parameterless tool", () => {
    expect(buildArguments([], {})).toEqual({ ok: true, args: {} });
  });
});
