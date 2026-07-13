# CLIuno Fastify template

Fastify 5 + TypeScript + TypeORM (better-sqlite3) REST API serving the CLIuno contract:
JWT auth (refresh, reset, email verification, OTP), users, todos, posts+comments,
follows, roles — under `/api/v1`.

## Commands

```bash
pnpm dev         # nodemon + tsx src/app.ts
pnpm build       # tsup
pnpm lint        # oxlint
pnpm type-check  # tsc --noEmit
pnpm format      # oxfmt src/
```

SQLite `db.sqlite` auto-creates (TypeORM `synchronize: true`; delete for a reset).
Env (all defaulted for dev): `PORT`, `API_VERSION`, `JWT_SECRET_KEY`,
`REFRESH_JWT_SECRET_KEY`, `DB_FILE`.

## Structure

- `src/app.ts` — fastify bootstrap; registers per-resource route plugins at `/api/v1/*`
  and a JSON content-type parser that tolerates **empty bodies** (clients send
  `Content-Type: application/json` on bodyless posts/deletes — don't remove it).
- `src/routes/*.routes.ts` — one plugin per resource; `authenticate`/`adminOnly`
  preHandlers come from `src/auth.ts` (Bearer JWT → `request.user`).
- `src/entities.ts` — all TypeORM entities; `src/db.ts` — data source, `defaultRole()`
  (first-use creation), `safeUser()` (never leak password/secret columns).
- `src/totp.ts` — RFC 6238 TOTP via otpauth.

## Contract rules this codebase follows

- Responses: `{status, message, data}` with the exact keys frontends destructure
  (`data.users/user/todos/todo/posts/post/followers/following/isFollowing`, login `data.token`).
- Request keys: camelCase (`usernameOrEmail`, `refreshToken`, `oldPassword`/`newPassword`, `otp`).
- One-time tokens live on the user row (`reset_token`, `verify_token`); lookups are by token;
  registration stores the verify token it "emails".
- The `user` role is created on first registration (fresh clone needs no seeding).
- OTP endpoints act on the authenticated user; creates attach the Bearer user as owner.

## Conventions

oxc-only lint/format (`semi: false`, single quotes, 4-space); prettier for json/md;
conventional commits (commitlint + husky); pnpm build approvals in `pnpm-workspace.yaml`.
