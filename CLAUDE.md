# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The classroom repo for a one-day course. It builds **Frank**: an MCP server with a Cloudscape web console, shipped as **one container** to Azure Container Apps. `server/` and `ui/` start **empty on purpose**. They get built from the ADRs in `docs/adr/`, so read the relevant ADR before you write code, and cite ADRs by number.

The ADRs are the spec. Where an ADR and this file disagree, the ADR wins. Several ADRs are partly superseded, so check each one's **Status** line to see which clauses still apply:
- ADR-006 replaces ADR-003's `VITE_FRANK_URL` + CORS wiring, ADR-004's Static Web Apps hosting, and ADR-005's OIDC auth.
- ADR-010 replaces ADR-006's per-seat credential model.
- ADR-007 (MCP authentication) is **Rejected**. `/mcp` stays unauthenticated deliberately, so don't add auth.
- ADR-008 and ADR-009 don't exist yet. Students write them in class.

## Commands

Each package (`server/`, `ui/`) is a self-contained npm package and has to provide these scripts, because the Dockerfile and CI call them:

```bash
npm ci && npm test && npm run build   # what CI and the Dockerfile run, per package
npm run dev                           # local dev
```

Both packages use Vitest. Run a single test file or test name from inside the package:
```bash
npx vitest run test/get_status.test.ts   # one file
npx vitest run -t "rejects unknown"      # tests whose name matches
```

Build the whole image locally (the build context is the repo root):
```bash
docker build -t frank . && docker run -p 3000:3000 frank
```

## Architecture (the big picture)

**One container, three routes (ADR-006):**
- `POST /mcp`: MCP over Streamable HTTP, using the official `@modelcontextprotocol/sdk` behind Express (ADR-001)
- `GET /healthz`: returns 200
- `/`: the built console as static files. The UI calls `/mcp` **relatively**, so it needs no `VITE_FRANK_URL` and no CORS.

**Things the root `Dockerfile` expects from the code you write:**
- `server/` compiles to `dist/`, the entry point is `dist/index.js`, and it needs a committed `package-lock.json`.
- The server resolves the console directory as `<package root>/public`. In the image, `ui/dist` gets copied there.
- The server must start and serve MCP even when there's no console. The Dockerfile comments assume `app.ts` handles a missing `public/` by saying so at `/`, and that `config.ts` holds the `PORT` default.
- `PORT` defaults to **3000**. That value has to match `deploy.yml`'s `--target-port 3000` and the Dockerfile's `ENV PORT`.
- `ui/` is optional. If `ui/package.json` is missing, the UI build stage outputs an empty `dist`.
- Tests run **inside the Docker build**. On `main`, the image build is the only test gate, so a failing suite means no deploy.

**CI (`.github/workflows/deploy.yml`):**
- **PRs:** the build and test jobs run for each package, but only once that package's `package-lock.json` is committed. Until then they pass with a notice.
- **Pushes to `main`:** these deploy straight away. The workflow fetches the class credential from `CREDENTIAL_URL` (ADR-010), runs `az acr build`, then `az containerapp create`/`update`. The app is named `frank-<github-owner>`.
- **Don't use `az containerapp up --source`.** It crashes on some azure-cli builds.
- The container gets `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_CLIENT_SECRET` as env vars. Frank reads Azure with the same credential that deployed him. The resource group comes from env at boot, **never from a tool parameter**, so a caller can't redirect him.

**Server layout (ADR-001/002):**
- One module per tool in `server/src/tools/`, registered in `server/src/tools/index.ts`, with tests in `server/test/`.
- All config comes from env vars. Don't create config files that contain values.

**Console (ADR-003):**
- React 18 + TypeScript + Vite, using only `@cloudscape-design/components` and `@cloudscape-design/global-styles`. No other component library, and no custom CSS beyond layout glue.
- Two pages: *Overview* shows `get_status` and connection health. *Tools* shows the list from MCP discovery and renders a form **from each tool's input schema**. New tools should show up in the UI without any UI changes.
- The UI holds no secrets.

## Tool rules (ADR-002). These are policy, not style.

- Names are `verb_noun` in snake_case. The verb must be one of `get`, `list`, `search`, `summarize`. `create_`/`update_`/`delete_`/`run_` are out of policy and would need a new ADR.
- Inputs use `zod` schemas, reject unknown fields, and describe every parameter.
- Output is JSON with a top-level `summary` string plus typed detail fields. Errors return `isError: true` with a plain-language message and no stack traces.
- **Read-only:** no tool may mutate Azure, GitHub, or the filesystem beyond temp space.
- The first tool is `get_status`, which returns version, uptime, and a greeting.

The `frank-tools` skill covers these rules. Run the `tool-conventions` agent after you change `server/src/tools/`.

## Repo workflow

- To create a new ADR, use `/adr <title>`. It takes the next number, sets Status: Proposed, keeps to about 290–375 words, updates the ADR tables in **both** `docs/adr/README.md` and `README.md`, and runs `adr-reviewer`. Never edit an Accepted ADR. Supersede it with a new one. Accepting an ADR is a human's call, so leave the file uncommitted.
- A push to `main` deploys to Azure. Work on a branch and open a PR.
- Run the `secret-scanner` agent before you commit or open a PR. Credentials must never end up in the repo, in prompts, in CLAUDE.md or in ADRs. The class credential lives only in the pipeline, per ADR-010.
- `.claude/` is committed team config: skills, agents and commands. `.claude/settings.local.json` is gitignored.
