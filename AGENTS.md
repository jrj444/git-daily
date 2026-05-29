# GitDaily — Agent Guide

## Project
Next.js 14 App Router + TypeScript + Tailwind CSS. Daily commit report tool consuming GitLab API v4. MySQL via Prisma, Redis via ioredis, auth via NextAuth Credentials Provider + JWT.

## Setup
- `pnpm install` — no npm/yarn
- `cp .env.example .env` — fill DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_KEY
- `npx prisma migrate dev` — create MySQL schema
- `pnpm seed` — creates admin/admin12345
- `pnpm dev` — local dev on :3000

## Commands
| command | what |
|---|---|
| `pnpm dev` | next dev |
| `pnpm build` | prisma generate && next build |
| `pnpm start` | next start (prod) |
| `pnpm lint` | next lint (ESLint next/core-web-vitals) |
| `pnpm test` | vitest run |
| `pnpm test:watch` | vitest (watch) |
| `pnpm seed` | tsx prisma/seed.ts |
| `pnpm db:generate` | prisma generate |
| `pnpm db:migrate` | prisma migrate dev |
| `pnpm db:deploy` | prisma migrate deploy |
| `pnpm db:studio` | prisma studio |

**Order matters**: `pnpm lint` then `pnpm build` then `pnpm test` for full verification.

## Architecture
- `app/` — Next.js App Router pages + API routes
- `app/api/` — route handlers (server-only GitLab calls, token never reaches client)
- `lib/` — pure logic: auth, crypto, gitlab client, report generation, stats, session helpers
- `components/` — React components (client-side)
- `prisma/` — schema, migrations, seed
- Path alias `@/` → project root (in both tsconfig and vitest config)

### Auth & middleware
- `middleware.ts` guards `/`, `/history/*`, `/settings/*`, `/admin/*` — redirects unauthenticated to `/login`
- `lib/session.ts`: `requireUser()` (401), `requireAdmin()` (403), `withErrors(fn)` wraps API handlers
- Session user includes `{ id, username, role: "MEMBER" | "ADMIN" }`

### Testing
- Vitest with `globals: true`, `environment: "node"` (not jsdom)
- Tests in `lib/__tests__/` co-located with source
- `import { describe, it, expect } from "vitest"` — no global types assumed
- Run single file: `pnpm test -- lib/__tests__/report.test.ts`

### Date handling
- MySQL `DATE` column; all dates stored/queried as UTC midnight via `utcDate("YYYY-MM-DD")` helper
- Never use `new Date(str)` without `T00:00:00.000Z` — will break across timezones

### GitLab client
- `lib/gitlab.ts` — server-side only, uses `PRIVATE-TOKEN` header
- Token encrypted via AES-256-GCM (`lib/crypto.ts`), decrypted at request time

### Docker
- Multi-stage build in `Dockerfile`; entrypoint runs `prisma migrate deploy` then `server.js`
- `docker compose up -d --build` builds + starts app + redis

## Conventions
- Conventional commit parsing supports both ASCII `()` and fullwidth `（）` parens with both `:` and `：` separators
- Noise filter regex is user-configurable (UI setting), defaults at schema level
- Merge commits (2+ parents) are dropped by default in filtering
- Dedup: commits with same `(type, scope, title.toLowerCase())` — only first kept
- Tailwind dark mode via `class` strategy (not media-query)
- Component CSS via CSS variables (rgb based), not Tailwind built-in dark: variant
- ESLint: `react-hooks/exhaustive-deps` set to `warn` (not error)
- Vitest alias `@/` matches tsconfig paths
- Prisma: `ENCRYPTION_KEY` must be 64 hex chars; rotation requires re-encrypting all stored tokens
