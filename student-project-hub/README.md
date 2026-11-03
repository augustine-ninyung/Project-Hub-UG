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
├── vercel.json               # Vercel build settings and routing
├── api/index.js              # Vercel Function that runs the Express API
├── scripts/vercel-build.js   # Vercel build: migrations (production) + builds
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
| `DIRECT_URL` | ✅ on Vercel | | Session-pooler connection string, used only to run migrations during production builds |
| `CORS_ORIGINS` | | `http://localhost:5173` | Comma-separated client origins allowed to call the API. On Vercel defaults to the production URL |
| `CLIENT_URL` | | `http://localhost:5173` | Used to build links in emails. On Vercel defaults to the production URL; set it if you add a custom domain |
| `API_URL` | | `http://localhost:4000` | Used to build URLs for locally stored uploads |
| `TRUST_PROXY` | | `1` | Proxies in front of the API (Vercel counts as one) |
| `COOKIE_SAME_SITE` | | `lax` | `lax` when the client and API share a site (local dev and Vercel); `none` only for a cross-site setup |
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
| `VITE_API_URL` | API base URL including `/api/v1`. Locally `http://localhost:4000/api/v1`. Production builds default to `/api/v1` (same origin), so it isn't needed on Vercel |

### External credentials you need to provide

None are committed, and none are needed for local development:

- **Supabase:** create a project. Under *Storage*, create a **public** bucket (default name `project-hub`). Copy the project URL and the `service_role` key from *Project Settings → API*, and the database connection strings from the **Connect** button (see Deployment).
- **SMTP:** Supabase doesn't send email for your app, so you need a provider such as Resend, Brevo, Mailgun, SendGrid, or Gmail with an app password.

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
- **Sessions:** a 15-minute JWT access token and a 30-day opaque refresh token, both in `httpOnly` cookies (`Secure; SameSite=Lax` in production). In production the website and the API are served from the same Vercel origin, so the cookies are first-party and keep working in browsers that block third-party cookies. Refresh tokens rotate on every use and only their hashes are stored. If a rotated token is replayed, every session for that user is revoked. A password reset or an account suspension also revokes all sessions.
- **CSRF:** every state-changing request must carry `X-Requested-With: XMLHttpRequest`. Browsers only send a custom header cross-origin after a CORS preflight, and the CORS allowlist rejects untrusted origins.
- **Authorization** is enforced on the server for every request: owner-or-admin checks for project changes, author checks for comment edits, and `requireRole('ADMIN')` on the whole admin router. The client's route guards only improve the user experience.
- **Private projects** are filtered in every query through one helper (`visibleProjectsWhere`). An unauthorized viewer gets a 404, so the project's existence isn't revealed.
- **Validation:** Zod validates every body, query and params object. Prisma parameterises all queries, which prevents SQL injection.
- **XSS:** user content is stored as plain text and rendered as text by React. URLs must use `http(s)` (no `javascript:` links). Helmet sets secure headers.
- **Uploads:** the browser first downscales images to at most 1920 px and re-encodes them, so a request stays under Vercel's 4.5 MB body limit (originals up to 20 MB can be picked). On the server, files are buffered in memory with a 5 MB limit and at most 9 per request, and only image MIME types are accepted. Every file is then decoded and re-encoded as WebP with sharp. This rejects files that aren't real images, strips EXIF and embedded payloads, and resizes for performance.
- **Rate limiting:** a stricter per-IP limit on auth endpoints and a per-account limit on login and password-reset requests (so brute force is capped even if IPs rotate). Both are counted in PostgreSQL (`RateLimit` table) because serverless instances don't share memory. A general per-IP limit and a write limit on likes, comments, reports and invites are kept in memory per instance, as lighter abuse damping.
- **Secrets** come only from environment variables. `.env` files are git-ignored.

---

## Deployment

The whole app runs as **one Vercel project**: Vercel serves the built website and runs the Express API as a serverless function ([`api/index.js`](api/index.js)) on the same domain. **Supabase** provides the PostgreSQL database and image storage. [`vercel.json`](vercel.json) holds the build settings and routes `/api/*` and `/health` to the function and everything else to the website.

### 1. Supabase

1. Create a Supabase project and note the database password you choose.
2. **Storage:** create a **public** bucket named `project-hub`.
3. **API keys:** from *Project Settings → API*, copy the **Project URL** and the **`service_role`** key. The service-role key is secret: it goes only into Vercel's environment variables.
4. **Database connection strings:** click **Connect** at the top of the dashboard and copy two strings, replacing `[YOUR-PASSWORD]` in each:
   - **Transaction pooler** (port `6543`), for `DATABASE_URL`. Add `?pgbouncer=true&connection_limit=1` to the end.
   - **Session pooler** (port `5432`), for `DIRECT_URL`. It's used only to run migrations during the build.

### 2. Email

Supabase doesn't send email for your app. Create an SMTP account (Resend, Brevo, Mailgun, …) and verify a sender domain or address with it.

### 3. Vercel

1. Import the GitHub repository in Vercel.
2. Set **Root Directory** to `student-project-hub`. Leave the framework preset as **Other**; `vercel.json` provides the install, build and output settings.
3. Add these **Environment Variables** (for Production, and Preview if you use preview deployments):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Supabase transaction pooler string + `?pgbouncer=true&connection_limit=1` |
   | `DIRECT_URL` | Supabase session pooler string |
   | `JWT_ACCESS_SECRET` | 48+ random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | From your email provider |
   | `EMAIL_FROM` | e.g. `ProjectHub <no-reply@yourdomain.com>` (a sender your provider has verified) |

   Don't set `NODE_ENV` (Vercel handles it; setting it to `production` would skip the dev dependencies the build needs) or `VITE_API_URL` (production builds already call `/api/v1` on the same domain). `CLIENT_URL` and `CORS_ORIGINS` default to your production `*.vercel.app` URL; set both if you add a custom domain.
4. Deploy. On production deployments the build first applies database migrations through `DIRECT_URL` ([`scripts/vercel-build.js`](scripts/vercel-build.js)), then builds the server and the client. Preview deployments skip migrations.
5. Create an admin: sign up on the site, then in Supabase's **SQL Editor** run `UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';`.

**Check after the first deploy:**

1. Open `https://<your-app>.vercel.app/health`; it should show `{"status":"ok"}`.
2. Sign up, open the verification email and verify, then upload a project with images.
3. Sign out, use "Forgot password", and sign in with the new password.
4. Sign in again in Safari or a private window and confirm you stay signed in after a reload.

**Limits on Vercel:** a request body can't exceed 4.5 MB. The browser compresses images before upload to stay under this, and shows a clear message if a set of screenshots is still too large together. Functions are stopped after 30 seconds (`maxDuration` in `vercel.json`).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Invalid environment configuration` on start | Check the variable named in the message in `server/.env` |
| `Can't reach database server` | Start `npm run db:local`, or fix `DATABASE_URL` |
| `pre-existing shared memory block is still in use` | An old embedded Postgres is still running. Stop the `postgres.exe` processes for that data directory (Task Manager) and retry |
| "Something went wrong" on every form in production | The API function isn't answering. Open `/health` on your site. If it fails, check **Vercel → Deployments → (latest) → Functions/Logs** for the error |
| Function logs show `Missing required production configuration` | Set the variables it names (Supabase, `SMTP_HOST`, `EMAIL_FROM`) in Vercel, then redeploy |
| Build fails with `DIRECT_URL is required` | Add the Supabase session pooler string as `DIRECT_URL` |
| `prepared statement "s0" already exists` | `DATABASE_URL` is missing `?pgbouncer=true` |
| "The upload is too large" | The images together exceed Vercel's 4.5 MB request limit even after compression. Upload fewer screenshots at a time |
| "Verify your email" banner and no email arrived | In development the link is printed in the API logs. In production, check the SMTP settings and the API logs for `Failed to send email`, then use **Resend email** in the banner |
| Everyone gets "Too many requests" at once | `TRUST_PROXY` doesn't match the number of proxies, so all visitors share one IP. On Vercel leave it at `1` |
| Slow installs or file-lock errors (`EPERM`) | The repo is in a OneDrive-synced folder. Move it somewhere not synced, or pause syncing while installing |
