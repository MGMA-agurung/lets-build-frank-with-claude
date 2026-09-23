import { loadConfig, type Config } from "./config.js";
import { createApp } from "./app.js";

let config: Config;
try {
  config = loadConfig();
} catch (error) {
  console.error(`[frank] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const server = createApp(config).listen(config.port, () => {
  console.log(`[frank] ${config.version} listening on :${config.port} (MCP at POST /mcp)`);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`[frank] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  });
}
