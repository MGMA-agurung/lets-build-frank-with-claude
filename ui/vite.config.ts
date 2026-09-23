/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, Vite serves the console and forwards /mcp to a local Frank
// (`npm run dev` in server/), so the client's relative endpoint works the same
// as in the container (ADR-006).
export default defineConfig({
  plugins: [react()],
  // Cloudscape alone is ~1 MB minified; one chunk is fine for a two-page console.
  build: { chunkSizeWarningLimit: 1600 },
  server: {
    proxy: {
      "/mcp": "http://localhost:3000",
      "/healthz": "http://localhost:3000",
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/setup.ts"],
    css: false,
  },
});
