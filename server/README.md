# Frank — the MCP server

Built from [ADR-001](../docs/adr/ADR-001-mcp-server-stack.md) (stack) and
[ADR-002](../docs/adr/ADR-002-mcp-tool-conventions.md) (tool rules).
TypeScript on Node 22+, the official `@modelcontextprotocol/sdk`, Streamable HTTP behind Express.

```bash
npm ci
npm run dev        # tsx watch on :3000
npm test           # vitest
npm run build      # tsc -> dist/
npm start          # node dist/index.js
npx vitest run test/get_status.test.ts   # a single test file
npx vitest run -t "rejects unknown"      # tests matching a name
```

## Routes

| Route | What |
|---|---|
| `POST /mcp` | MCP over Streamable HTTP, stateless (a fresh server per request). Unauthenticated on purpose — ADR-007 was rejected. |
| `GET/DELETE /mcp` | `405` — no server-initiated stream, no sessions. |
| `GET /healthz` | `200 {"status":"ok","version":...}` |
| `/` | The built console from `<package root>/public`, or a plain-text note if it hasn't been built (ADR-003 makes it optional). |

## Environment

All config comes from environment variables (ADR-001). No secrets belong in this table or in files.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Must match the Dockerfile's `ENV PORT` and `deploy.yml`'s `--target-port`. |

A bad value fails at boot with a plain-language message, not on the first request.

## Adding a tool

Follow the `frank-tools` skill (ADR-002): one module in `src/tools/<verb_noun>.ts`
exporting a `ToolDefinition`, listed in `src/tools/index.ts`, with a test in
`test/`. `test/conventions.test.ts` enforces the naming, strict inputs,
described parameters and `summary` output for every registered tool. The
console shows new tools automatically. Run the `tool-conventions` agent after
changing `src/tools/`.
