// Turns a tool's JSON Schema (from MCP discovery) into form fields and back
// into call arguments. This is what lets a new tool appear in the console with
// no UI change (ADR-003).

export type FieldKind = "string" | "enum" | "number" | "integer" | "boolean" | "json";

export interface Field {
  name: string;
  label: string;
  description?: string;
  required: boolean;
  kind: FieldKind;
  options?: string[];
  defaultValue?: unknown;
}

/** Values as the form holds them: strings for text inputs, booleans for checkboxes. */
export type FormValues = Record<string, string | boolean>;

interface JsonSchema {
  type?: string | string[];
  title?: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  anyOf?: JsonSchema[];
}

function primaryType(schema: JsonSchema): string | undefined {
  if (Array.isArray(schema.type)) return schema.type.find((t) => t !== "null");
  if (schema.type) return schema.type;
  // zod emits optional/nullable as anyOf with a null branch.
  const branch = schema.anyOf?.find((s) => s.type !== "null");
  return branch ? primaryType(branch) : undefined;
}

export function fieldsFromSchema(schema: unknown): Field[] {
  const s = (schema ?? {}) as JsonSchema;
  const required = new Set(s.required ?? []);
  return Object.entries(s.properties ?? {}).map(([name, prop]) => {
    const type = primaryType(prop);
    const isStringEnum = Array.isArray(prop.enum) && prop.enum.every((v) => typeof v === "string");
    const kind: FieldKind = isStringEnum
      ? "enum"
      : type === "string" || type === "number" || type === "integer" || type === "boolean"
        ? type
        : "json";
    return {
      name,
      label: prop.title ?? name,
      description: prop.description,
      required: required.has(name),
      kind,
      options: isStringEnum ? (prop.enum as string[]) : undefined,
      defaultValue: prop.default,
    };
  });
}

export function initialValues(fields: Field[]): FormValues {
  const values: FormValues = {};
  for (const f of fields) {
    if (f.kind === "boolean") values[f.name] = f.defaultValue === true;
    else if (f.defaultValue === undefined) values[f.name] = "";
    else values[f.name] = f.kind === "json" ? JSON.stringify(f.defaultValue) : String(f.defaultValue);
  }
  return values;
}

export type BuildResult =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; errors: Record<string, string> };

/** Converts form values to typed arguments. Empty optional fields are omitted; the server does the real validation. */
export function buildArguments(fields: Field[], values: FormValues): BuildResult {
  const args: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const f of fields) {
    const raw = values[f.name];
    if (f.kind === "boolean") {
      args[f.name] = raw === true;
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text === "") {
      if (f.required) errors[f.name] = "Required.";
      continue;
    }
    if (f.kind === "number" || f.kind === "integer") {
      const n = Number(text);
      if (!Number.isFinite(n)) errors[f.name] = "Enter a number.";
      else if (f.kind === "integer" && !Number.isInteger(n)) errors[f.name] = "Enter a whole number.";
      else args[f.name] = n;
    } else if (f.kind === "json") {
      try {
        args[f.name] = JSON.parse(text);
      } catch {
        errors[f.name] = "Enter valid JSON.";
      }
    } else {
      args[f.name] = text;
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, args };
}
