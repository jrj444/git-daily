# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

See `AGENTS.md` for the full command table. Key commands:

```bash
pnpm dev              # next dev (port 3000)
pnpm lint && pnpm build && pnpm test   # Full verification (order matters)
pnpm test -- lib/__tests__/report.test.ts  # Run a single test file
npx prisma studio     # Visual DB browser
pnpm seed             # Create admin/admin12345
```

## Architecture

This is a **Next.js 14 App Router** full-stack app. The backend and frontend live in the same project — API routes are server-side only and call GitLab on behalf of authenticated users (tokens never reach the browser).

### Request flow (API handlers)

Every API route follows the same pattern:

```
export const GET = withErrors(async (req) => {
  const user = await requireUser();          // throws 401 NextResponse
  // ... handler logic with Zod validation
  return NextResponse.json({ ... });
});
```

- `withErrors()` catches thrown `NextResponse` objects and converts them to proper responses
- `requireUser()` returns `{ id, username, role }` or throws 401
- `requireAdmin()` calls `requireUser()` then throws 403 if `role !== "ADMIN"`
- Request bodies are validated with **Zod** schemas defined per-route
- All handlers are named exports (`GET`, `POST`, `PATCH`, `DELETE`)

### Auth (NextAuth.js v4)

- **Credentials provider**: username + bcrypt password hash
- **GitLab OAuth provider**: auto-creates users on first sign-in via `signIn` callback
- Session is JWT-based (`strategy: "jwt"`), stored in a cookie
- `middleware.ts` guards `/`, `/history/*`, `/settings/*`, `/admin/*` — unauthenticated users are redirected to `/login`
- Session user carries `{ id, username, role: "MEMBER" | "ADMIN" }`

#### GitLab OAuth user provisioning
The `signIn` callback in `lib/auth.ts` runs on first OAuth login:
1. Looks up existing user by `gitlabUserId`
2. If found, updates the refresh token
3. If not found, creates a new `User` with `passwordHash: null`, encrypted OAuth tokens, and the GitLab issuer URL
4. Handles username collisions by appending `_gitlab` or `_gitlab_<random>` suffixes (up to 10 retries)

### Token management (`lib/gitlab-token.ts`)

Two token types are supported:

| Token type | Detection | Refresh |
|---|---|---|
| Personal Access Token (PAT) | Starts with `glpat-` | Never refreshed |
| OAuth access token | Doesn't start with `glpat-` | Auto-refreshed via refresh_token when expired |

`resolveGitLabToken(userId)` is the single entry point — it decrypts the stored token, checks expiration for OAuth tokens, refreshes if needed, and returns the plaintext access token. Callers never deal with encryption/refresh logic.

### Encryption (`lib/crypto.ts`)

AES-256-GCM with a 32-byte key (stored as 64 hex chars in `ENCRYPTION_KEY`). Encrypted payloads are `base64(iv + tag + ciphertext)`. Used for GitLab tokens stored in the `User` table. **Key rotation requires re-encrypting all stored tokens** — there's no versioning mechanism.

### Real-time notifications (`lib/notify.ts` + SSE)

```
Client (SSE) ──GET /api/notifications/stream──> Server
                                                  │
                                          Redis subscriber
                                                  │
Comment/Like creates ──> Redis PUBLISH ──────────┘
  Notification row       notifications:{userId}
```

- `createNotification()` writes to DB then publishes to Redis channel `notifications:{userId}`
- `/api/notifications/stream` creates an SSE `ReadableStream` that subscribes to the user's Redis channel
- The SSE endpoint uses `getSessionUser()` (returns null instead of throwing 401) because SSE can't set response headers after the stream starts
- Each SSE connection gets its own Redis subscriber instance (`createSubscriber()`), while publishes share a singleton (`getPublisher()`)

### Report generation pipeline (`lib/report.ts`)

```
GitLab commits
  └─ filterCommits()    # Drop merges, filter by author email, apply noise regex
    └─ toCleanCommits() # Parse conventional commit format: type(scope): subject
      └─ dedupe()       # Remove commits with identical (type, scope, title.toLowerCase())
        └─ buildContext() # Group by project, produce ReportContext
          └─ renderTemplate() # Handlebars rendering with noEscape
```

Conventional commit regex supports both ASCII `()` and fullwidth `（）` parens, both `:` and `：` separators.

### Stats computation (`lib/stats.ts`)

`computeUserStats(user, since, until)` fetches commits for all enabled projects in parallel, producing:
- `breakdown` — counts by commit type (feat/fix/refactor/docs/style/test/chore/perf/ci/build/other)
- `byProject[]` — per-project breakdown with individual commit details
- `dailyTrend[]` — per-day counts for the date range

Fails silently for individual projects (one broken project doesn't block the rest). Returns `null` if the user has no GitLab credentials.

### Date handling

- All dates are stored as MySQL `DATE` columns, always at UTC midnight
- `utcDate("2024-01-15")` → `new Date("2024-01-15T00:00:00.000Z")` — both in `lib/utils.ts` and duplicated inline in some route files
- Never construct `new Date(dateStr)` without the `T00:00:00.000Z` suffix

### Data model relationships

- **User** → has many Projects, Reports, Templates, Comments, Likes, Notifications
- **Project** → belongs to User, identified by GitLab project ID (`@@unique([userId, gitlabProjectId])`)
- **Report** → belongs to User, unique per user+date (`@@unique([userId, date])`), stores rendered Markdown and raw commit JSON
- **Comment** → belongs to Report, authored by User (separate relation name `CommentAuthor`)
- **Like** → belongs to Report + User (`@@unique([reportId, userId])`)
- **Notification** → belongs to User, indexed by `[userId, read, createdAt]` for efficient unread queries
- Cascading deletes: deleting a User removes all their Projects/Reports/Templates/Comments/Likes/Notifications

### Theme system

Dark mode uses `next-themes` with `class` strategy (not media-query). Component styles use CSS variables (`rgb(...)` values) rather than Tailwind's built-in `dark:` variant. The `<html>` tag gets a `class="dark"` or `class="light"` attribute. `next-themes` is configured with `defaultTheme="system"` and `enableSystem: true`.

## Path aliases

`@/` maps to the project root in both `tsconfig.json` and `vitest.config.ts`. Imports look like `import { prisma } from "@/lib/prisma"`.

## Prisma client

`lib/prisma.ts` exports a singleton Prisma client. It uses `globalThis` to survive Next.js hot reload — do not create new `PrismaClient()` instances.
