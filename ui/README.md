# Frank's console

Built from [ADR-003](../docs/adr/ADR-003-cloudscape-ui.md): React 18 + TypeScript + Vite,
Cloudscape components only. Served by Frank at `/` and talks to `/mcp`
relatively, so there is no `VITE_FRANK_URL` and no CORS
([ADR-006](../docs/adr/ADR-006-classroom-credentials.md)). It holds no secrets.

```bash
npm ci
npm run dev     # Vite on :5173, proxying /mcp and /healthz to a local Frank on :3000
npm test        # vitest + Testing Library (jsdom)
npm run build   # typecheck, then vite build -> dist/
npx vitest run test/schema.test.ts   # a single test file
```

For local dev, run `npm run dev` in `server/` too.

## Pages

- **Overview** (`#/overview`): `get_status` output and connection health.
- **Tools** (`#/tools`): the tool list from MCP discovery. Selecting a tool renders a form from its
  input schema and shows the JSON result. New tools appear with no UI change.

## Source map

- `src/main.tsx`: mounts `App` with the real MCP client.
- `src/App.tsx`: the Cloudscape `AppLayout` and side navigation. Takes `client: FrankClient` so tests can inject a fake.
- `src/frank/client.ts`: the `FrankClient` interface over the official MCP SDK client.
- `src/frank/result.ts`: gets the JSON payload and `summary` out of a tool result.
- `src/schema-form/`: converts JSON Schema to form fields and back to arguments (`schema.ts`), plus the Cloudscape form (`SchemaForm.tsx`).
- `src/pages/`: `Overview.tsx` and `Tools.tsx`.
