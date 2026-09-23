import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import type { Config } from "../config.js";

/** What a tool can see. Scope (e.g. the resource group) comes from here, never from a parameter. */
export interface ToolContext {
  config: Config;
  now: () => Date;
}

type Output = z.ZodObject<{ summary: z.ZodString }>;

/**
 * One tool per module (ADR-002). Inputs are strict zod objects; outputs carry a
 * top-level `summary` plus typed detail fields.
 */
export interface ToolDefinition<In extends z.ZodObject = z.ZodObject, Out extends Output = Output> {
  name: string;
  title: string;
  description: string;
  inputSchema: In;
  outputSchema: Out;
  handler: (input: z.infer<In>, ctx: ToolContext) => Promise<z.infer<Out>> | z.infer<Out>;
}

/** Thrown by a tool to fail with a message that is safe to show a caller as-is. */
export class ToolError extends Error {}

export function toResult(output: { summary: string }): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    structuredContent: output,
  };
}

export function toError(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}
