import { z } from "zod";
import type { ToolDefinition } from "./types.js";

export const inputSchema = z.object({}).strict();

export const outputSchema = z.object({
  summary: z.string().describe("One-line, human-readable status."),
  version: z.string().describe("Frank's version, from package.json."),
  uptimeSeconds: z.number().int().nonnegative().describe("Whole seconds since Frank started."),
  startedAt: z.string().describe("When Frank started, as an ISO 8601 timestamp."),
  greeting: z.string().describe("A friendly hello from Frank."),
});

export const getStatus: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: "get_status",
  title: "Get status",
  description:
    "Returns Frank's version, uptime and a greeting. Use it to check that Frank is reachable and which build is running; it reads nothing outside Frank himself.",
  inputSchema,
  outputSchema,
  handler: (_input, { config, now }) => {
    const uptimeSeconds = Math.max(0, Math.floor((now().getTime() - config.startedAt.getTime()) / 1000));
    return {
      summary: `Frank ${config.version} is up and has been running for ${formatUptime(uptimeSeconds)}.`,
      version: config.version,
      uptimeSeconds,
      startedAt: config.startedAt.toISOString(),
      greeting: "Hello, I'm Frank. I observe; I don't act.",
    };
  },
};

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
