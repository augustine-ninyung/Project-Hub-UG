# Student Project Hub

A community platform where students showcase projects, discover each other's work, and collaborate. Students upload projects with screenshots and links. Other students like, comment on, reply to and share them, invite contributors, and get notified about activity. Administrators moderate users, projects, reports, categories and featured content.

| | |
|---|---|
| **Client** | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui-style components on Radix, TanStack Query, React Router, React Hook Form + Zod, Axios |
| **Server** | Node.js, Express 5, TypeScript, Prisma 6, PostgreSQL, Zod |
| **Auth** | Argon2id password hashing, short-lived JWT access cookie + rotating refresh token (httpOnly cookies), email verification, password reset, role-based access |
| **Storage** | Supabase Storage (falls back to local disk in development) |
| **Tests** | Vitest + Supertest against a real PostgreSQL (server), Vitest + Testing Library (client) |

---

## Contents

1. [Quick start](#quick-start)
2. [Project structure](#project-structure)
3. [Environment variables](#environment-variables)
4. [Database, migrations and seed data](#database-migrations-and-seed-data)
5. [Testing](#testing)
6. [API reference](#api-reference)
7. [Security model](#security-model)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

---

## Quick start

**Requirements:** Node.js 20 or newer (developed on Node 24) and npm 10 or newer. You do **not** need to install PostgreSQL or Docker. The repo includes an embedded PostgreSQL server for development.

```bash
# 1. Install dependencies for both apps (npm workspaces)
npm install

# 2. Create environment files
cp server/.env.example server/.env
cp client/.env.example client/.env
#    then set JWT_ACCESS_SECRET in server/.env:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Start the development database (leave this terminal running)
npm run db:local

# 4. In a second terminal: apply migrations and load sample data
npm run db:migrate
npm run db:seed

# 5. Start the API (http://localhost:4000) and client (http://localhost:5173)
npm run dev
```

**Sample accounts** (created by the seed):

| Role | Login | Password |
|---|---|---|
| Admin | `admin@studenthub.dev` | `Admin12345` |
| Student | `kwame_dev@students.example.edu` (or username `kwame_dev`) | `Password123` |

All seeded students use `Password123`. Their usernames are `kwame_dev`, `ama_codes`, `yawml`, `efua_designs`, `kofisec`, `abena_data`, `chidi_builds`, `zainab_mobile`, `nana_akua` and `dtetteh`.

> **Emails in development.** With `SMTP_HOST` empty, verification and password-reset emails are printed to the API terminal. Copy the link from there.

> **Using your own PostgreSQL?** Skip `npm run db:local` and point `DATABASE_URL` in `server/.env` at your database.

---

## Project structure

```
student-project-hub/
├── package.json              # npm workspaces + root scripts
├── server/
│   ├── prisma/
│   │   ├── schema.prisma     # data model
│   │   ├── migrations/       # SQL migrations (committed)
│   │   └── seed.ts           # development seed data
│   ├── scripts/local-db.ts   # embedded PostgreSQL for development
│   ├── src/
│   │   ├── app.ts            # Express app: security middleware, routes, error handling
│   │   ├── server.ts         # HTTP server + graceful shutdown
│   │   ├── routes.ts         # mounts module routers under /api/v1
│   │   ├── config/           # validated env, Prisma client
│   │   ├── middleware/       # auth, CSRF, validation, uploads, rate limits, errors
│   │   ├── services/         # storage (Supabase/local) and email
│   │   ├── utils/            # ApiError, response helpers, token helpers, shared schemas
│   │   └── modules/          # feature modules: routes → controller → service (+ schemas)
│   │       ├── auth/  users/  projects/  engagement/  notifications/
│   │       └── reports/  admin/  meta/
│   └── tests/                # API tests (auth, projects, engagement, admin)
└── client/
    ├── vercel.json           # /api proxy to Render + SPA rewrites
    └── src/
        ├── components/       # ui/ (design-system primitives), common/, layout/
        ├── features/         # auth, projects, comments, notifications, users, admin
        ├── pages/            # route-level pages (lazy-loaded)
        ├── context/          # AuthProvider, ThemeProvider
        ├── services/         # Axios client + typed API services
        ├── hooks/  layouts/  routes/  types/  utils/
        └── test/             # component tests
```

**Server conventions.** Each module has a `*.routes.ts` file that wires middleware and validation, a `*.controller.ts` file that handles HTTP, a `*.service.ts` file that holds business logic and Prisma access, and a `*.schemas.ts` file of Zod schemas. Very small modules (meta, reports) keep their handlers in the routes file. Every response uses the same shape:

```jsonc
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 12, "total": 40, "totalPages": 4 } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "details": [{ "path": "title", "message": "..." }] } }
```

---

## Environment variables

### Server (`server/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | | `development` | `development`, `test` or `production` |
| `PORT` | | `4000` | HTTP port |
| `DATABASE_URL` | ✅ | | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | ✅ | | ≥ 32 random characters, used to sign access tokens |
| `ACCESS_TOKEN_TTL_MINUTES` | | `15` | Access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | | `30` | Session (refresh-token) lifetime |
| `CORS_ORIGINS` | ✅ in prod | `http://localhost:5173` | Comma-separated client origins allowed to call the API |
| `CLIENT_URL` | ✅ in prod | `http://localhost:5173` | Used to build links in emails |
| `API_URL` | | `http://localhost:4000` | Used to build URLs for locally stored uploads |
| `TRUST_PROXY` | | `1` | Proxies in front of the API: `2` behind the Vercel rewrite plus Render |
| `COOKIE_SAME_SITE` | | `lax` | `lax` when the client reaches the API on the same site; `none` only for a cross-site setup |
| `SUPABASE_URL` | ✅ in prod | | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ in prod | | Service-role key (server-side only, never sent to the client) |
| `SUPABASE_BUCKET` | | `project-hub` | Name of a **public** storage bucket |
| `LOCAL_UPLOAD_DIR` | | `uploads` | Local-disk fallback directory when Supabase is not configured |
| `SMTP_HOST` | ✅ in prod | | SMTP server. In development, if empty, emails are logged to the console |
| `SMTP_PORT` / `SMTP_SECURE` | | `587` / `false` | SMTP connection settings |
| `SMTP_USER` / `SMTP_PASS` | | | SMTP credentials |
| `EMAIL_FROM` | ✅ in prod | `Student Project Hub <no-reply@example.com>` | Sender address (must be a domain your SMTP provider lets you send from) |

The server validates its environment at startup and exits with a clear message if anything is missing or malformed. In production it refuses to start without Supabase credentials, `SMTP_HOST` and `EMAIL_FROM`.

### Client (`client/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | API base URL including `/api/v1`. Locally `http://localhost:4000/api/v1`; on Vercel `/api/v1` (see Deployment) |

### External credentials you need to provide

None are committed, and none are needed for local development:

- **Supabase:** create a project, then go to *Storage* and create a **public** bucket (default name `project-hub`). Copy the project URL and the `service_role` key from *Project Settings → API*.
- **SMTP:** any provider works (Resend, Brevo, Mailgun, SendGrid, or Gmail with an app password).
- **PostgreSQL:** any Prisma-compatible host (Neon, Supabase Postgres, Render Postgres, Railway).

---

## Database, migrations and seed data

The data model lives in [server/prisma/schema.prisma](server/prisma/schema.prisma):

- **User**, **UserSession** (one row per signed-in device, refresh token stored as a SHA-256 hash), **AuthToken** (hashed single-use email-verification and password-reset tokens).
- **Project** with **Category**, **Technology** (many-to-many through **ProjectTechnology**), **ProjectImage** (screenshots) and **ProjectContributor** (invitations with `PENDING` / `ACCEPTED` / `DECLINED` status).
- **Like**: the unique key `(userId, projectId)` makes duplicate likes impossible at the database level.
- **Comment**: arbitrarily nested through `parentId`. `rootId` lets the API load a whole thread in one query. Deleting a comment soft-deletes it, so replies keep their context.
- **Notification**, **Report**.

All primary keys are UUIDs. Foreign keys cascade where the child data is meaningless without its parent (a project's images, likes and comments). A category that still has projects cannot be deleted (`Restrict`). `likeCount` and `commentCount` on Project are denormalised and updated inside the same transaction as the like or comment, so feeds can sort by popularity without aggregate queries. Indexes cover the feed, visibility, notification and moderation queries.

| Command (from repo root) | What it does |
|---|---|
| `npm run db:local` | Starts the embedded PostgreSQL on port 5433. Data persists in `server/.pgdata/` |
| `npm run db:migrate` | Creates and applies migrations in development (`prisma migrate dev`) |
| `npm run db:seed` | **Clears all data** and loads sample users, categories, technologies, 16 projects with generated cover images, likes, threaded comments, notifications and a pending report. Refuses to run when `NODE_ENV=production` |
| `npm run db:deploy -w server` | Applies pending migrations in production (`prisma migrate deploy`) |
| `npm run db:reset -w server` | Drops and recreates the development database (destructive) |

---

## Testing

```bash
npm test              # server + client
npm test -w server    # API tests
npm test -w client    # component tests
npm run typecheck     # TypeScript, both apps
```

**Server (43 tests).** The tests start a throwaway embedded PostgreSQL on port 5434, apply migrations, and truncate tables between tests. Nothing is mocked: requests go through the real middleware, validation, Prisma and storage. To use an existing database instead (for example in CI), set `TEST_DATABASE_URL`.

| File | Covers |
|---|---|
| `auth.test.ts` | registration, hashing, duplicate detection, login by email/username, generic errors, suspended accounts, refresh-token rotation, logout, CSRF rejection, email verification (single use), password reset (enumeration-safe, expiry, session revocation) |
| `projects.test.ts` | create with cover and screenshots, auth and verified-email requirements, validation, rejecting fake images, contributor invites and notifications, private-project access control, owner/admin-only edit and delete, screenshot removal, search/filter/sort/pagination, trending and featured, invitation accept flow |
| `engagement.test.ts` | idempotent likes and counts, like notifications, threaded comments and notification targeting, author-only edit, soft delete, notifications list and read state, duplicate reports |
| `admin.test.ts` | students blocked from all admin endpoints, statistics, suspension revoking sessions, featuring, resolving reports by removing content, category management |

**Client (14 tests).** Login validation and error display, like button (optimistic update, server reconciliation, rollback on failure, anonymous redirect), comment threads (rendering, posting, keeping the draft when posting fails, anonymous view), and the project form (validation, a complete submission with technologies and a cover image, image type and size checks).

---

## API reference

Base path: `/api/v1`. 🔒 means a session is required, ✉️ means a verified email is required, and 🛡️ means admin only.

**Auth:**
`POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `POST /auth/refresh` · `GET /auth/me` 🔒 · `POST /auth/verify-email` · `POST /auth/resend-verification` 🔒 · `POST /auth/forgot-password` · `POST /auth/reset-password`

**Users:**
`GET /users/me` 🔒 · `PATCH /users/me` 🔒 · `POST /users/me/avatar` 🔒 (multipart `avatar`) · `DELETE /users/me/avatar` 🔒 · `GET /users/me/invitations` 🔒 · `GET /users/:idOrUsername` · `GET /users?search=` 🔒 · `GET /users/active`

**Projects:**
`GET /projects?search=&category=&technology=&sort=newest|most_liked|most_commented&page=&limit=` · `GET /projects/search?q=` · `GET /projects/trending` · `GET /projects/featured` · `GET /projects/recommended` · `GET /projects/:id` · `GET /projects/:id/related` · `POST /projects` 🔒✉️ · `PATCH /projects/:id` 🔒 (owner/admin) · `DELETE /projects/:id` 🔒 (owner/admin)

`POST` and `PATCH` take `multipart/form-data`: a `data` field (JSON), an optional `cover` file and up to 8 `screenshots` files. `PATCH` also accepts `removeScreenshotIds` and `removeCover` inside `data`.

**Engagement:**
`POST /projects/:id/like` 🔒 · `DELETE /projects/:id/like` 🔒 · `GET /projects/:id/comments` · `POST /projects/:id/comments` 🔒✉️ (`{ content, parentId? }`) · `PATCH /comments/:id` 🔒 (author) · `DELETE /comments/:id` 🔒 (author/admin)

**Contributors:**
`POST /projects/:id/contributors` 🔒✉️ (owner; `{ username, role? }`) · `PATCH /projects/:id/contributors/:userId` 🔒 (the invitee answers with `{ status: ACCEPTED|DECLINED }`; the owner can change `{ role }`) · `DELETE /projects/:id/contributors/:userId` 🔒 (owner removes, or the contributor leaves)

**Notifications:**
`GET /notifications?page=&unread=` 🔒 · `GET /notifications/unread-count` 🔒 · `PATCH /notifications/:id/read` 🔒 · `PATCH /notifications/read-all` 🔒

**Reports:**
`POST /reports` 🔒✉️ (`{ targetType: PROJECT|COMMENT, targetId, reason, details? }`)

**Reference data:**
`GET /categories` · `GET /technologies?search=`

**Admin** 🛡️:
`GET /admin/statistics` · `GET /admin/activity` · `GET /admin/users` · `PATCH /admin/users/:id` (`{ role?, status? }`) · `GET /admin/projects` · `PATCH /admin/projects/:id/feature` · `DELETE /admin/projects/:id` · `GET /admin/reports?status=` · `PATCH /admin/reports/:id` (`{ status, resolutionNote?, removeContent? }`) · `POST/PATCH/DELETE /admin/categories[/:id]`

---

## Security model

- **Passwords** are hashed with Argon2id. Login errors are identical for an unknown user and a wrong password, and a dummy hash keeps response timing uniform.
- **Sessions:** a 15-minute JWT access token and a 30-day opaque refresh token, both in `httpOnly` cookies (`Secure; SameSite=Lax` in production). In production the browser only talks to the Vercel origin, which forwards `/api` to Render, so the cookies are first-party and keep working in browsers that block third-party cookies. Refresh tokens rotate on every use and only their hashes are stored. If a rotated token is replayed, every session for that user is revoked. A password reset or an account suspension also revokes all sessions.
- **CSRF:** every state-changing request must carry `X-Requested-With: XMLHttpRequest`. Browsers only send a custom header cross-origin after a CORS preflight, and the CORS allowlist rejects untrusted origins.
- **Authorization** is enforced on the server for every request: owner-or-admin checks for project changes, author checks for comment edits, and `requireRole('ADMIN')` on the whole admin router. The client's route guards only improve the user experience.
- **Private projects** are filtered in every query through one helper (`visibleProjectsWhere`). An unauthorized viewer gets a 404, so the project's existence isn't revealed.
- **Validation:** Zod validates every body, query and params object. Prisma parameterises all queries, which prevents SQL injection.
- **XSS:** user content is stored as plain text and rendered as text by React. URLs must use `http(s)` (no `javascript:` links). Helmet sets secure headers.
- **Uploads:** files are buffered in memory with a 5 MB limit and at most 9 per request, and only image MIME types are accepted. Every file is then decoded and re-encoded as WebP with sharp. This rejects files that aren't real images, strips EXIF and embedded payloads, and resizes for performance.
- **Rate limiting:** a global per-IP limit, a stricter per-IP limit on auth endpoints, a per-account limit on login and password-reset requests (so brute force is capped even if IPs rotate), and a write limit on likes, comments, reports and invites. Limits are kept in memory, so they apply per server instance.
- **Secrets** come only from environment variables. `.env` files are git-ignored.

---

## Deployment

### 1. Database

Create a PostgreSQL database (Neon, Supabase, Render Postgres, …) and copy its connection string. If the host gives you a pooled URL, use a direct (non-pooled) URL for migrations.

### 2. API on Render

1. Push the repository to GitHub. The project lives in the `student-project-hub/` folder of the repo, and the Blueprint file is `render.yaml` at the **repo root** (one level above this README).
2. In Render, choose **New → Blueprint** and select the repo; Render reads `render.yaml`, which sets `rootDir: student-project-hub`. Alternatively create a **Web Service** manually with these settings:
   - Root directory: `student-project-hub`
   - Build command: `npm ci && npm run build -w server`
   - Pre-deploy command: `npm run db:deploy -w server`
   - Start command: `npm start -w server`
   - Health check path: `/health`
3. Set the environment variables: `DATABASE_URL`, `JWT_ACCESS_SECRET` (the blueprint generates one), `CORS_ORIGINS` and `CLIENT_URL` (your Vercel URL), `API_URL` (the Render URL), the Supabase variables, `SMTP_*` and `EMAIL_FROM`. The blueprint sets `TRUST_PROXY=2` and `COOKIE_SAME_SITE=lax`.
4. Note the service URL Render gives you (normally `https://student-project-hub-api.onrender.com`; Render adds a suffix if the name is taken).
5. After the first deploy, create an admin. Either register normally and promote that account with SQL (`UPDATE "User" SET role = 'ADMIN' WHERE email = '…';`), or, for a demo environment only, run the seed once with `SEED_FORCE=true`. **The seed deletes all data.**

### 3. Client on Vercel

1. Import the repository in Vercel and set **Root Directory** to `student-project-hub/client`.
2. The framework preset is Vite. The build command is `npm run build` and the output directory is `dist`.
3. Set `VITE_API_URL=/api/v1`.
4. In [`client/vercel.json`](client/vercel.json), make sure the `/api/:path*` rewrite's destination is your Render service URL from step 2.4. Vercel forwards every `/api` request there, so the browser only ever talks to the Vercel origin and auth cookies stay first-party. The second rule rewrites all other routes to `index.html` so deep links work.
5. Deploy.

Make sure the API's `CORS_ORIGINS` includes the exact Vercel origin (scheme and host, no trailing slash). Add your custom domain too if you use one.

**Check after the first deploy:** sign in on Safari or in a private window (both block third-party cookies) and confirm you stay signed in after a reload. In the Render logs, the request lines should show visitors' real IP addresses, not a small set of Vercel addresses; if they don't, adjust `TRUST_PROXY`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Invalid environment configuration` on start | Check the variable named in the message in `server/.env` |
| `Can't reach database server` | Start `npm run db:local`, or fix `DATABASE_URL` |
| `pre-existing shared memory block is still in use` | An old embedded Postgres is still running. Stop the `postgres.exe` processes for that data directory (Task Manager) and retry |
| Signed in, but requests return 401 in production | Set `VITE_API_URL=/api/v1` on Vercel and point the `/api` rewrite in `client/vercel.json` at your Render URL. Calling the Render URL directly makes the cookies third-party, and many browsers block them |
| Server exits with `Missing required production configuration` | Set the variables it names (Supabase, `SMTP_HOST`, `EMAIL_FROM`) in Render |
| "Verify your email" banner and no email arrived | In development the link is printed in the API logs. In production, check the SMTP settings and the API logs for `Failed to send email`, then use **Resend email** in the banner |
| Everyone gets "Too many requests" at once | `TRUST_PROXY` is too low, so all visitors share one proxy IP. Use `2` behind the Vercel rewrite |
| Slow installs or file-lock errors (`EPERM`) | The repo is in a OneDrive-synced folder. Move it somewhere not synced, or pause syncing while installing |
