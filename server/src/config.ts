import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

// All settings come from environment variables (ADR-001). No config files with
// values in them.

// `<package root>` is one level above this file whether it runs as
// src/config.ts (tsx, vitest) or dist/config.js (the image). The Dockerfile
// copies the built console to `<package root>/public`.
export const packageRoot = fileURLToPath(new URL("..", import.meta.url));

const envSchema = z.object({
  // Must match the Dockerfile's ENV PORT and deploy.yml's --target-port.
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export interface Config {
  port: number;
  /** Directory holding the built console. It may not exist yet (ADR-003). */
  publicDir: string;
  /** Frank's version, from package.json. */
  version: string;
  /** When Frank booted, for uptime. */
  startedAt: Date;
}

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Reads and validates config at boot, so a bad value fails now rather than on first request. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Frank's configuration is invalid: ${problems}`);
  }
  return {
    port: parsed.data.PORT,
    publicDir: path.join(packageRoot, "public"),
    version: readVersion(),
    startedAt: new Date(),
  };
}
