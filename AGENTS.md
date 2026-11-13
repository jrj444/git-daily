# GitDaily — Agent Guide

## Project
Next.js 14 App Router + TypeScript + Tailwind CSS. Daily commit report tool consuming GitLab API v4. MySQL via Prisma, Redis via ioredis (required for SSE notifications), auth via NextAuth v4 (Credentials + GitLab OAuth).

## Setup
- `pnpm install` — no npm/yarn
- `cp .env.example .env` (prod) or `.env.local` (dev) — fill at minimum: `DATABASE_URL`, `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, `REDIS_URL`
- `pnpm db:migrate` — create MySQL schema
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
- `lib/` — pure logic: auth, crypto, gitlab client, token refresh, report generation, stats, session, Redis, SSE notifications
- `components/` — React client components
- `prisma/` — schema, migrations, seed
- Path alias `@/` → project root (in both tsconfig and vitest config)

### Request flow (every API route follows this)
```ts
export const GET = withErrors(async (req) => {
  const user = await requireUser();       // throws 401 NextResponse
  // ... handler logic with Zod validation
  return NextResponse.json({ ... });
});
```
- `withErrors()` catches thrown `Response` objects and `NextResponse`, converts others to 500.
- `requireUser()` returns `{ id, username, role }` or throws 401. `requireAdmin()` also checks `role === "ADMIN"`.
- All handlers are named exports (`GET`, `POST`, `PATCH`, `DELETE`).

### Auth & middleware
- `middleware.ts` uses `next-auth/middleware` with `withAuth`, guards `/`, `/history/*`, `/settings/*`, `/admin/*` — redirects unauthenticated to `/login`.
- NextAuth v4: Credentials Provider + GitLab OAuth Provider. Session is JWT-based.
- GitLab OAuth: `signIn` callback auto-creates users on first login (handles username collisions with `_gitlab` suffix, up to 10 retries).

### Token management (`lib/gitlab-token.ts`)
- Two types: Personal Access Token (starts with `glpat-`, never refreshed) and OAuth access token (auto-refreshed via refresh_token when expired).
- `resolveGitLabToken(userId)` is the single entrypoint — decrypts, checks expiration, refreshes if needed, returns plaintext token.

### Prisma client
- `lib/prisma.ts` exports a singleton. Uses `globalThis` to survive Next.js hot reload — never create new `PrismaClient()` instances.

### SSE notifications (`lib/notify.ts` + `lib/redis.ts`)
- `createNotification()` writes to DB then publishes to Redis channel `notifications:{userId}`.
- `/api/notifications/stream` creates an SSE `ReadableStream` that subscribes to that Redis channel.
- Publisher is a singleton (`getPublisher()`); each SSE connection gets its own subscriber instance (`createSubscriber()`) because a subscribed Redis client can't issue other commands.

### Date handling
- MySQL `DATE` column; all dates stored/queried as UTC midnight via `utcDate("YYYY-MM-DD")` helper in `lib/utils.ts`.
- Never use `new Date(str)` without `T00:00:00.000Z` — will break across timezones.

### Docker
- Multi-stage build (`deps` → `builder` → `runner`), Node 20 Alpine, `output: "standalone"`.
- CMD: `node node_modules/prisma/build/index.js migrate deploy && node server.js`
- `docker compose up -d --build` builds + starts app + Redis.

## Conventions
- Conventional commit parsing: supports ASCII `()` and fullwidth `（）` parens, both `:` and `：` separators.
- Noise filter regex is user-configurable (UI setting in Settings page), stored as nullable `@db.Text`.
- Merge commits (2+ parents) are dropped by default in filtering.
- Dedup: commits with same `(type, scope, title.toLowerCase())` — only first kept.
- Tailwind dark mode via `class` strategy. Component styles use CSS variables (`rgb(var(--color) / <alpha-value>)`), not Tailwind's `dark:` variant. Themes managed by `next-themes`.
- ESLint: `react-hooks/exhaustive-deps` set to `warn` (not error).
- Vitest alias `@/` matches tsconfig paths; `globals: true`, `environment: "node"` (not jsdom).
- Tests in `lib/__tests__/` co-located with source. Run single file: `pnpm test -- lib/__tests__/report.test.ts`.
- Prisma: `ENCRYPTION_KEY` must be 64 hex chars; key rotation requires re-encrypting all stored tokens.
- `pnpm-workspace.yaml` allows builds for native packages (`@prisma/client`, `prisma`, `esbuild`, `unrs-resolver`).
- `next.config.mjs`: `output: "standalone"`, `serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"]`.

## Deeper reference
`CLAUDE.md` covers data model relationships, report pipeline, stats computation, theme system, and GitLab OAuth user provisioning in detail.
