# Pingyun Report

A Next.js full-stack tool that reads your self-hosted GitLab commits and generates a daily report. Built for an internal team — multi-user, MySQL-backed, AI polish supported.

## Tech stack

- Next.js 14 App Router + TypeScript
- Tailwind CSS, react-md-editor (Markdown editing)
- Prisma + MySQL
- NextAuth.js (credentials provider, JWT sessions)
- GitLab REST API v4 (server-side proxy)
- Optional OpenAI-compatible LLM for AI polish

## Local development

```bash
pnpm install
cp .env.example .env
# fill DATABASE_URL, NEXTAUTH_SECRET, ENCRYPTION_KEY (openssl rand -hex 32)
pnpm prisma migrate dev
pnpm seed                   # creates initial admin user (admin / admin12345)
pnpm dev
```

Open http://localhost:3000 and log in as `admin` / `admin12345`. Change the password in 用户管理 immediately.

## First-time configuration

1. Login → 设置.
2. Fill GitLab base URL (e.g. `https://gitlab.company.com`) and a Personal Access Token with `read_api` and `read_repository` scopes. Click 保存并校验.
3. The system fetches your project list. Tick the projects you commit to. Optionally set a non-default branch per project.
4. Optionally edit the noise regex (e.g. `^Merge|^chore:`) and create custom Handlebars templates.

## Daily usage

- Open `/`. Today's report is auto-generated from your commits.
- Edit the markdown, click 复制 to copy, or 保存 to persist.
- Click `AI 润色` to rewrite via the configured LLM (requires `LLM_API_BASE` and `LLM_API_KEY`).
- Visit `/history` for the calendar view of past reports.

## Admin

- `/admin/users` — create users, reset passwords, toggle role.
- `/admin/team-reports?date=YYYY-MM-DD` — see who has submitted today.

## Production deployment

```bash
docker compose up -d --build
```

`docker-compose.yml` runs the Next.js standalone build and applies pending Prisma migrations on startup. Point `DATABASE_URL` at your company MySQL.

Required env vars (see `.env.example`):

| Var | Notes |
|---|---|
| `DATABASE_URL` | mysql://user:pass@host:3306/db |
| `NEXTAUTH_URL` | external URL of the app |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | 64 hex chars; encrypts GitLab tokens at rest |
| `LLM_API_BASE` / `LLM_API_KEY` / `LLM_MODEL` | optional, for AI polish |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_DISPLAY_NAME` | seed-only initial admin |

## Security notes

- GitLab Personal Access Tokens are encrypted with AES-256-GCM before persistence; they are never returned to the browser, only a masked preview.
- All GitLab API calls go through Next.js route handlers (server-side) — no token leaves the server.
- Passwords stored as bcrypt hashes.
- Rotate `ENCRYPTION_KEY` only after re-encrypting existing tokens; otherwise users must re-enter their PAT.

## API surface

| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/[...nextauth] | NextAuth |
| GET / PATCH | /api/me | current user info / preferences |
| POST | /api/gitlab/validate-token | save base URL + (optional) token, refresh project list |
| GET / PATCH | /api/gitlab/projects | list / toggle / set branch |
| GET | /api/reports/generate?date=YYYY-MM-DD | live-fetch + render |
| GET / POST / DELETE | /api/reports | per-day CRUD |
| GET / POST / PATCH / DELETE | /api/templates | template CRUD |
| POST | /api/ai/polish | LLM rewrite |
| GET / POST / PATCH / DELETE | /api/admin/users | admin only |
| GET | /api/admin/team-reports?date=YYYY-MM-DD | admin only |
