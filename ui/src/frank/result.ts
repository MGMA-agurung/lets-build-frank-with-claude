import type { CallToolResult } from "./client";

/** The JSON a tool returned: structured content when present, else text content parsed if it is JSON. */
export function resultPayload(result: CallToolResult): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
  const texts = result.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text);
  const joined = texts.join("\n");
  try {
    return JSON.parse(joined);
  } catch {
    return joined;
  }
}

/** ADR-002 outputs carry a top-level `summary`; errors carry a plain-language message. */
export function resultSummary(result: CallToolResult): string | undefined {
  const payload = resultPayload(result);
  if (payload && typeof payload === "object" && typeof (payload as { summary?: unknown }).summary === "string") {
    return (payload as { summary: string }).summary;
  }
  return typeof payload === "string" ? payload : undefined;
}
