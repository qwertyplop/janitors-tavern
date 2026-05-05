# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## App: Janitor's Tavern

A SillyTavern-compatible AI proxy for JanitorAI. Users configure API connections (OpenAI, Anthropic, custom endpoints), import SillyTavern presets, and use the app as a proxy server between JanitorAI and their AI provider.

### Features
- Dashboard with proxy URL, API key management, usage stats, request log
- Connections page — manage multiple API providers with round-robin key rotation
- Presets page — import/manage SillyTavern chat completion presets
- Extensions page — regex scripts for transforming messages
- Request Inspector — preview assembled request body before sending
- Settings — theme (dark/light/system), language (EN/RU), post-processing defaults
- Optional auth — register username/password to protect the instance

### Data storage
- **Frontend**: localStorage (connections, presets, regex scripts, settings)
- **Backend**: in-memory server state (active connection/preset, usage stats) + `data/auth.json` for auth persistence

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite, Tailwind CSS v4, shadcn/ui, wouter routing
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (scaffold only — app uses localStorage + in-memory state)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

- `artifacts/janitors-tavern/` — React + Vite frontend, served at `/`
- `artifacts/api-server/` — Express backend, served at `/api`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
