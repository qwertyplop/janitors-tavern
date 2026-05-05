# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (not used by Janitor's Tavern — localStorage + server in-memory)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Janitor's Tavern App

**Purpose**: A proxy layer app using SillyTavern mechanics for JanitorAI. Lets users configure AI provider connections and prompt presets, then use the proxy URL in JanitorAI's "Custom AI" setting.

**Architecture**:
- Frontend: `artifacts/janitors-tavern/` — Vite + React SPA at `/` (port 20418)
- Backend: `artifacts/api-server/` — Express server at `/api` (port 8080)

**Storage**:
- Client-side: All presets, connections, regex scripts, settings stored in localStorage (keys prefixed `jt.`)
- Server-side: In-memory state in `server-state.ts` (active connection/preset, stats, logging)

**Key Endpoints**:
- `POST /api/proxy/chat-completion` — Main proxy (JanitorAI sends requests here)
- `GET /api/proxy/models` — Fetch available models from a provider
- `POST /api/proxy/test-connection` — Test a provider connection
- `GET /api/settings` — Get server state
- `POST /api/settings` — Update active connection/preset/scripts on server
- `GET /api/settings/stats` — Usage stats
- `POST /api/settings/stats/reset` — Reset stats

**Proxy Flow**:
1. User configures a ConnectionPreset + optional ChatCompletionPreset in the frontend
2. User clicks "Activate Configuration" → frontend POSTs to `/api/settings`
3. JanitorAI sends chat completion requests to the proxy URL
4. Server uses in-memory active presets to: parse JanitorAI request → build prompt (if preset) → apply regex scripts → apply post-processing → forward to provider → return response

**Key Files**:
- `artifacts/api-server/src/lib/types.ts` — All TypeScript types
- `artifacts/api-server/src/lib/server-state.ts` — In-memory server state
- `artifacts/api-server/src/lib/prompt-builder.ts` — Builds messages from SillyTavern preset + JanitorAI data
- `artifacts/api-server/src/lib/regex-processor.ts` — Applies regex scripts to messages
- `artifacts/api-server/src/lib/macros.ts` — SillyTavern macro processor ({{char}}, {{user}}, etc.)
- `artifacts/api-server/src/lib/janitor-parser.ts` — Parses JanitorAI XML-tagged system messages
- `artifacts/api-server/src/routes/proxy.ts` — Full proxy logic with Anthropic/OpenAI support + streaming
- `artifacts/api-server/src/routes/settings.ts` — Server state management
- `artifacts/janitors-tavern/src/lib/types.ts` — Shared types (mirrored from server)
- `artifacts/janitors-tavern/src/lib/storage.ts` — localStorage CRUD helpers
- `artifacts/janitors-tavern/src/lib/api.ts` — API client functions
- `artifacts/janitors-tavern/src/pages/Dashboard.tsx` — Main control panel
- `artifacts/janitors-tavern/src/pages/Connections.tsx` — Connection management
- `artifacts/janitors-tavern/src/pages/Presets.tsx` — Preset management (imports SillyTavern JSON)
- `artifacts/janitors-tavern/src/pages/Extensions.tsx` — Regex scripts
- `artifacts/janitors-tavern/src/pages/Settings.tsx` — App settings

**Post-processing Modes**:
none, merge, merge-tools, semi-strict, semi-strict-tools, strict, strict-tools, single-user, anthropic, anthropic-merge-consecutives

**Theme**: Dark amber/tavern aesthetic with CSS custom properties (HSL). Light mode also supported.
