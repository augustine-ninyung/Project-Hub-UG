# ProjectHub — Student Project Showcase & Community

**Live site:** https://project-hub-ug.vercel.app

ProjectHub is a community platform where students showcase what they build, discover each other's work and collaborate. Students publish projects with a cover image, screenshots, a tech stack and links. Others like, comment and reply in threads, share projects and report content. Owners invite contributors, and everyone gets live notifications. Administrators moderate users, projects, reports, categories and featured content.

**Features**

- Landing page for visitors; personal dashboard for signed-in students
- Explore page with search, category and technology filters, and sorting
- Project pages with screenshots, likes, threaded comments, sharing and reporting
- Live updates: likes, comments, new projects and notifications appear without a refresh
- Rich link previews when a project is shared on WhatsApp, LinkedIn, X, Slack and others
- Contributor invitations, student profiles, light and dark mode, fully responsive
- Email verification, password reset, and an admin dashboard for moderation

| | |
|---|---|
| **Client** | React 19, TypeScript, Vite 7, Tailwind CSS v4, Radix-based components, TanStack Query, React Router, React Hook Form + Zod, Axios |
| **Server** | Node.js, Express 5, TypeScript, Prisma 7 (`pg` driver adapter), PostgreSQL, Zod 4 |
| **Auth** | Argon2id passwords, short-lived JWT access cookie + rotating refresh token (httpOnly cookies), email verification, password reset, role-based access |
| **Hosting** | One Vercel project (website + API as a serverless function) |
| **Supabase** | PostgreSQL database, Storage (images), Realtime (live updates) |
| **Email** | Any SMTP provider (production uses Resend) |
| **Tests** | Vitest + Supertest against a real PostgreSQL (server), Vitest + Testing Library (client) |

---

## Contents

1. [Quick start (local development)](#quick-start-local-development)
2. [Project structure](#project-structure)
3. [Environment variables](#environment-variables)
4. [Database, migrations and seed data](#database-migrations-and-seed-data)
5. [Testing](#testing)
6. [API reference](#api-reference)
7. [How live updates and link previews work](#how-live-updates-and-link-previews-work)
8. [Security model](#security-model)
9. [Deployment (Vercel + Supabase)](#deployment-vercel--supabase)
10. [Running the live site](#running-the-live-site)
11. [Troubleshooting](#troubleshooting)
12. [Known limitations](#known-limitations)

---

## Quick start (local development)

**Requirements:** Node.js 20.19+ (developed on Node 24) and npm 10+. You do **not** need PostgreSQL or Docker: the repo includes an embedded PostgreSQL server for development.

```bash
# 0. The app lives in student-project-hub/; run every command below from there.
cd student-project-hub

# 1. Install dependencies for both apps (npm workspaces).
#    This also generates the Prisma client (server postinstall).
npm install

# 2. Create environment files
cp server/.env.example server/.env
cp client/.env.example client/.env
#    then set JWT_ACCESS_SECRET in server/.env to the output of:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Start the development database (leave this terminal running)
npm run db:local

# 4. In a second terminal: apply migrations and load sample data
npm run db:migrate
npm run db:seed

# 5. Start the API (http://localhost:4000) and the website (http://localhost:5173)
npm run dev
```

**Sample accounts** (created by the seed):

| Role | Login | Password |
|---|---|---|
| Admin | `admin@studenthub.dev` | `Admin12345` |
| Student | `kwame_dev` (or `kwame_dev@students.example.edu`) | `Password123` |

All seeded students use `Password123`: `kwame_dev`, `ama_codes`, `yawml`, `efua_designs`, `kofisec`, `abena_data`, `chidi_builds`, `zainab_mobile`, `nana_akua`, `dtetteh`.

Local development needs no external accounts:

- **Emails** are printed to the API terminal when `SMTP_HOST` is empty. Copy the link from there.
- **Images** are stored in `server/uploads/` when Supabase isn't configured.
- **Live updates** are off without Supabase keys; pages update when you refresh.

> **Using your own PostgreSQL?** Skip `npm run db:local` and point `DATABASE_URL` in `server/.env` at it.

---

## Project structure

```
student-project-hub/
├── package.json              # npm workspaces + root scripts
├── vercel.json               # Vercel build settings, function config, routing
├── api/index.js              # Vercel Function entry: runs the Express API
├── scripts/vercel-build.js   # Vercel build: migrations (production only) + builds
├── server/
│   ├── prisma.config.ts      # Prisma 7 config: schema, migrations, seed, DATABASE_URL
│   ├── prisma/
│   │   ├── schema.prisma     # data model
│   │   ├── migrations/       # SQL migrations (committed; includes default categories)
│   │   └── seed.ts           # development sample data
│   ├── scripts/local-db.ts   # embedded PostgreSQL for development
│   ├── src/
│   │   ├── app.ts            # Express app: security middleware, routes, error handling
│   │   ├── server.ts         # local HTTP server + graceful shutdown
│   │   ├── routes.ts         # mounts module routers under /api/v1
│   │   ├── config/           # validated env, Prisma client (pg adapter)
│   │   ├── generated/        # Prisma client (git-ignored; generated on install/build)
│   │   ├── middleware/       # auth, CSRF, validation, uploads, rate limits, errors
│   │   ├── services/         # storage (Supabase/local), email, realtime pings
│   │   ├── utils/            # ApiError, response helpers, tokens, shared schemas
│   │   └── modules/          # feature modules: routes → controller → service (+ schemas)
│   │       ├── auth/  users/  projects/  engagement/  notifications/
│   │       └── reports/  admin/  meta/  share/ (link previews)
│   └── tests/                # API tests (see Testing)
└── client/
    ├── index.html            # includes default social-preview tags
    ├── public/               # favicon.svg, og-image.png (default link-preview card)
    └── src/
        ├── components/       # ui/ (design-system primitives), common/, layout/
        ├── features/         # auth, projects, comments, notifications, users, admin
        ├── pages/            # route-level pages (lazy-loaded), incl. landing page
        ├── context/          # AuthProvider, ThemeProvider
        ├── services/         # Axios client + typed API services
        ├── hooks/            # incl. use-live-topic (Supabase Realtime)
        ├── layouts/  routes/  types/  utils/
        └── test/             # component tests
```

**Server conventions.** Each module has a `*.routes.ts` file (middleware and validation), a `*.controller.ts` file (HTTP), a `*.service.ts` file (business logic and Prisma) and a `*.schemas.ts` file (Zod). Very small modules keep their handlers in the routes file. Every API response has the same shape:

```jsonc
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 12, "total": 40, "totalPages": 4 } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "details": [{ "path": "title", "message": "..." }] } }
```

**Design.** Warm ivory surfaces, ink text and a single clay accent (tokens in `client/src/index.css`), Source Serif 4 for headlines and Geist for UI text. All text colours meet WCAG AA contrast in light and dark mode. Icons come from Lucide; the UI uses no emojis.

---

## Environment variables

### Server (`server/.env` locally, Vercel project settings in production)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | | `development` | `development`, `test` or `production`. **Don't set it on Vercel** (see Deployment) |
| `PORT` | | `4000` | Local HTTP port |
| `DATABASE_URL` | ✅ | | PostgreSQL connection string. On Vercel: Supabase **transaction pooler** + `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | ✅ on Vercel | | Supabase **session pooler** string. Used only to run migrations during production builds |
| `JWT_ACCESS_SECRET` | ✅ | | ≥ 32 random characters; signs access tokens and derives private live-update topics |
| `ACCESS_TOKEN_TTL_MINUTES` | | `15` | Access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | | `30` | Session (refresh-token) lifetime |
| `CLIENT_URL` | | `http://localhost:5173` | Public site URL, used in email links and link previews. On Vercel defaults to the production URL; **set it if you add a custom domain** |
| `CORS_ORIGINS` | | `http://localhost:5173` | Comma-separated allowed origins. On Vercel defaults to the production URL |
| `API_URL` | | `http://localhost:4000` | Used for locally stored upload URLs |
| `TRUST_PROXY` | | `1` | Proxies in front of the API (Vercel counts as one) |
| `COOKIE_SAME_SITE` | | `lax` | `lax` when the website and API share a site (local and Vercel); `none` only for a cross-site setup |
| `SUPABASE_URL` | ✅ in prod | | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ in prod | | **Secret.** Server-side only (uploads, sending live-update pings) |
| `SUPABASE_ANON_KEY` | | | Public `anon` key, given to browsers to *listen* for live updates. Without it, live updates are off |
| `SUPABASE_BUCKET` | | `project-hub` | Name of a **public** storage bucket |
| `LOCAL_UPLOAD_DIR` | | `uploads` | Local-disk image storage when Supabase isn't configured |
| `SMTP_HOST` | ✅ in prod | | SMTP server. Empty in development = emails are printed to the console |
| `SMTP_PORT` / `SMTP_SECURE` | | `587` / `false` | SMTP connection settings |
| `SMTP_USER` / `SMTP_PASS` | | | SMTP credentials |
| `EMAIL_FROM` | ✅ in prod | `Student Project Hub <no-reply@example.com>` | Sender. Must be an address/domain your provider has verified (never a Gmail/Outlook address with Resend) |

The server validates its environment at startup and exits with a clear message if anything is missing or malformed. In production it refuses to start without the Supabase URL and service key, `SMTP_HOST` and `EMAIL_FROM`.

### Client (`client/.env`, development only)

| Variable | Description |
|---|---|
| `VITE_API_URL` | API base URL including `/api/v1`. Locally `http://localhost:4000/api/v1`. Production builds default to `/api/v1` on the same domain, so **don't set it on Vercel** |
| `VITE_SITE_URL` | Optional. Absolute site URL used in the default social-preview tags. On Vercel it defaults to the production domain |

---

## Database, migrations and seed data

The data model lives in [server/prisma/schema.prisma](student-project-hub/server/prisma/schema.prisma):

- **User**, **UserSession** (one row per signed-in device; refresh token stored as a SHA-256 hash), **AuthToken** (hashed single-use email-verification and password-reset tokens).
- **Project** with **Category**, **Technology** (many-to-many through **ProjectTechnology**), **ProjectImage** (screenshots) and **ProjectContributor** (invitations with `PENDING` / `ACCEPTED` / `DECLINED`).
- **Like**: the unique key `(userId, projectId)` makes duplicate likes impossible.
- **Comment**: nested through `parentId`; `rootId` loads a whole thread in one query. Deletes are soft, so replies keep their context.
- **Notification**, **Report**, and **RateLimit** (shared counters for login brute-force protection).

All primary keys are UUIDs. Foreign keys cascade where child data is meaningless without its parent. A category that still has projects can't be deleted. `likeCount` and `commentCount` on Project are denormalised and updated in the same transaction as the like or comment. The 10 default categories are created by a migration, so every new database has them.

Prisma 7 notes: the client is generated into `server/src/generated/` (git-ignored) on `npm install` and on every build, and connects through the `pg` driver adapter ([server/src/config/prisma.ts](student-project-hub/server/src/config/prisma.ts)). The Prisma CLI reads `server/.env` via [server/prisma.config.ts](student-project-hub/server/prisma.config.ts); variables already set in the environment take precedence.

| Command (from repo root) | What it does |
|---|---|
| `npm run db:local` | Starts the embedded PostgreSQL on port 5433. Data persists in `server/.pgdata/` |
| `npm run db:migrate` | Creates and applies migrations in development (`prisma migrate dev`) |
| `npm run db:seed` | **Deletes all data**, then loads sample users, 16 projects with generated covers, likes, comments, notifications and a report. Refuses to run with `NODE_ENV=production` |
| `npm run db:deploy -w server` | Applies pending migrations (`prisma migrate deploy`); production builds do this automatically |
| `npm run db:reset -w server` | Drops and recreates the development database (destructive) |

---

## Testing

```bash
npm test              # server + client
npm test -w server    # API tests
npm test -w client    # component tests
npm run typecheck     # TypeScript, both apps
```

**Server (73 tests).** The suite starts a throwaway embedded PostgreSQL on port 5434, applies all migrations and truncates tables between tests. Requests go through the real middleware, validation, Prisma and storage. Set `TEST_DATABASE_URL` to use an existing database instead (for example in CI).

| File | Covers |
|---|---|
| `auth.test.ts` | registration, hashing, duplicates, login by email/username, generic errors, suspended accounts, refresh-token rotation and replay, logout, CSRF, email verification, password reset |
| `projects.test.ts` | create with images, auth and verified-email rules, validation, fake-image rejection, contributor invites, private-project access, owner/admin-only edit and delete, search/filter/sort/pagination, trending and featured |
| `engagement.test.ts` | idempotent likes and counts, notifications, clearing only your own notifications, threaded comments, author-only edit, soft delete, reports |
| `account-deletion.test.ts` | deletion requests need the password, end every session and hide the profile; sign-in reports the pending request only after a correct password and can withdraw it; admins delete for good (with projects) or keep the account; never for accounts that didn't ask; admin-only |
| `admin.test.ts` | students blocked from admin endpoints, statistics, suspension revoking sessions, featuring, report resolution, categories, manual email verification (admin-only, one-time, unlocks posting at once, notifies the student), unverified count |
| `meta.test.ts` | public stats count only public projects and active students |
| `rate-limit-store.test.ts` | database-backed rate-limit counters: windows, sharing across instances, concurrency |
| `realtime.test.ts` | live-update pings for likes, replies and project changes; nothing sent for failed requests; unguessable user topics; the admin topic (admins only; pinged on sign-ups, reports and admin actions) |
| `share.test.ts` | link-preview tags for public projects, HTML escaping, private projects never described, 1200×630 preview image, fallback image |

**Client (27 tests).** Login form, like button (optimistic update, rollback, anonymous redirect), comment threads, project form (validation, full submission, image checks), image compression limits, sign-out state, the live-update hook (subscribe, debounce, disabled when not configured), and the admin Students tab (instant verify with rollback, confirmation before granting admin, bulk verify, details panel, typing the username before permanent deletion), and keeping an account that is waiting to be deleted at sign-in.

---

## API reference

Base path: `/api/v1`. 🔒 session required · ✉️ verified email required · 🛡️ admin only.

**Auth:**
`POST /auth/register` · `POST /auth/login` (`{ identifier, password, cancelDeletion? }`) · `POST /auth/logout` · `POST /auth/refresh` · `GET /auth/me` 🔒 · `POST /auth/verify-email` · `POST /auth/resend-verification` 🔒 · `POST /auth/forgot-password` · `POST /auth/reset-password`

**Users:**
`GET /users/me` 🔒 · `PATCH /users/me` 🔒 · `POST /users/me/avatar` 🔒 (multipart `avatar`) · `DELETE /users/me/avatar` 🔒 · `GET /users/me/invitations` 🔒 · `POST /users/me/deletion-request` 🔒 (`{ password, reason? }`) · `GET /users/:idOrUsername` · `GET /users?search=` 🔒 · `GET /users/active`

**Projects:**
`GET /projects?search=&category=&technology=&sort=newest|most_liked|most_commented&page=&limit=` · `GET /projects/search?q=` · `GET /projects/trending` · `GET /projects/featured` · `GET /projects/recommended` · `GET /projects/:id` · `GET /projects/:id/related` · `POST /projects` 🔒✉️ · `PATCH /projects/:id` 🔒 (owner/admin) · `DELETE /projects/:id` 🔒 (owner/admin)

`POST` and `PATCH` take `multipart/form-data`: a `data` field (JSON), an optional `cover` file and up to 8 `screenshots`. `PATCH` also accepts `removeScreenshotIds` and `removeCover` inside `data`.

**Engagement:**
`POST /projects/:id/like` 🔒 · `DELETE /projects/:id/like` 🔒 · `GET /projects/:id/comments` · `POST /projects/:id/comments` 🔒✉️ (`{ content, parentId? }`) · `PATCH /comments/:id` 🔒 (author) · `DELETE /comments/:id` 🔒 (author/admin)

**Contributors:**
`POST /projects/:id/contributors` 🔒✉️ (owner; `{ username, role? }`) · `PATCH /projects/:id/contributors/:userId` 🔒 (invitee answers `{ status: ACCEPTED|DECLINED }`; owner can change `{ role }`) · `DELETE /projects/:id/contributors/:userId` 🔒

**Notifications:**
`GET /notifications?page=&unread=` 🔒 · `GET /notifications/unread-count` 🔒 · `PATCH /notifications/:id/read` 🔒 · `PATCH /notifications/read-all` 🔒 · `DELETE /notifications` 🔒 (clear all of your own)

**Reports:**
`POST /reports` 🔒✉️ (`{ targetType: PROJECT|COMMENT, targetId, reason, details? }`)

**Reference data and site info:**
`GET /categories` · `GET /technologies?search=` · `GET /stats` (public totals for the landing page) · `GET /realtime` (live-update settings for the browser, or `null` when off)

**Admin** 🛡️:
`GET /admin/statistics` · `GET /admin/activity` · `GET /admin/users?search=&role=&status=&verified=&deletion=requested` · `PATCH /admin/users/:id` (`{ role?, status? }`) · `POST /admin/users/:id/verify-email` · `DELETE /admin/users/:id` (only after the owner asked) · `POST /admin/users/:id/keep` · `GET /admin/projects` · `PATCH /admin/projects/:id/feature` · `DELETE /admin/projects/:id` · `GET /admin/reports?status=` · `PATCH /admin/reports/:id` (`{ status, resolutionNote?, removeContent? }`) · `POST/PATCH/DELETE /admin/categories[/:id]`

**Outside `/api/v1`:**
`GET /health` · `GET /projects/:id` (link-preview HTML, only for social crawlers on Vercel) · `GET /og/projects/:id.jpg` (1200×630 preview image)

---

## How live updates and link previews work

**Live updates (Supabase Realtime Broadcast).**

1. After a successful like, comment, notification, or project create/edit/delete, the server queues "changed" pings for three kinds of topic: `project:<id>`, the shared `projects:feed`, and each notified user's private topic.
2. The pings are sent in one batch just before the response, after the database transaction has committed. Nothing is sent for failed requests.
3. Browsers listen with the public anon key. On a ping they refetch through the normal API, so pings carry **no data** and every read is still authorised.
4. A user's private topic is an HMAC of their ID with the server secret, so it can't be guessed. Signed-in users see a toast for new notifications.
5. Admins also get a shared admin topic (from `/auth/me`, admins only). Sign-ups, new reports and every admin action ping it, so open dashboards, tab badges and counts refresh for all admins.

The relevant code: [realtime.service.ts](student-project-hub/server/src/services/realtime.service.ts) and [use-live-topic.ts](student-project-hub/client/src/hooks/use-live-topic.ts).

**Link previews.** Social apps don't run JavaScript, so `vercel.json` routes `/projects/:id` requests whose user agent is a known crawler (WhatsApp, LinkedIn, X, Slack, Discord, Telegram, …) to the API. The API returns the normal page HTML with that project's title, description and image tags. `/og/projects/:id.jpg` converts the cover to a 1200×630 JPEG; projects without a cover use `client/public/og-image.png`. Only public projects are described, and all user text is HTML-escaped. Regular browsers always get the static app. Previews are cached at Vercel's edge for up to 10 minutes, and social apps cache them much longer.

---

## Security model

- **Passwords** are hashed with Argon2id. Login errors are identical for an unknown user and a wrong password, and a dummy hash keeps response timing uniform.
- **Sessions:** a 15-minute JWT access token and a 30-day opaque refresh token, both in `httpOnly` cookies (`Secure; SameSite=Lax` in production). The website and API share one origin, so cookies are first-party and work where third-party cookies are blocked. Refresh tokens rotate on every use and only their hashes are stored. Replaying a rotated token revokes all of that user's sessions, as do a password reset and an account suspension. Signing out always clears the session locally, even if the server request fails.
- **CSRF:** every state-changing request must carry `X-Requested-With: XMLHttpRequest`, which browsers only send cross-origin after a CORS preflight that the allowlist rejects.
- **Authorization** is enforced on the server for every request (owner-or-admin for project changes, author for comment edits, `requireRole('ADMIN')` on the admin router). Client route guards only improve the user experience.
- **Private projects** are filtered in every query through `visibleProjectsWhere`. Unauthorized viewers get a 404, so existence isn't revealed. Live-update pings and link previews never expose private content.
- **Validation:** Zod validates every body, query and params object. Prisma parameterises all queries.
- **XSS:** user content is stored as plain text and rendered as text by React. Link-preview tags are HTML-escaped. URLs must be `http(s)`. Helmet sets secure headers on API responses.
- **Page headers:** `vercel.json` gives every page a Content-Security-Policy (scripts only from the site itself, no inline scripts, network and images limited to the site, Google Fonts and the Supabase project), `X-Frame-Options: DENY` against clickjacking, `nosniff`, a strict referrer policy and a Permissions-Policy that turns off camera, microphone and location. **If you move to a different Supabase project, update its address in that policy**, or images and live updates will be blocked.
- **Database exposure:** the browser only ever gets Supabase's public anon key (for live updates). Row Level Security on the Supabase tables means that key reads no rows and can't write; storage refuses uploads and listing with it. All data goes through the API.
- **Uploads:** the browser downscales images to at most 1920 px and re-encodes them, so a request fits Vercel's 4.5 MB body limit (originals up to 20 MB can be picked). The server buffers files in memory (5 MB each, at most 9), accepts only image types, then decodes and re-encodes every file as WebP with sharp. This rejects fake images and strips EXIF data and embedded payloads.
- **Rate limiting:** a per-IP limit on auth endpoints and a per-account limit on login and password-reset requests, both counted in PostgreSQL so they hold across serverless instances. A general per-IP limit and a write limit (likes, comments, reports, invites) are kept in memory per instance.
- **Secrets** come only from environment variables. `.env` files and the `.vercel/` folder are git-ignored. The Supabase anon key is public by design; the service-role key never leaves the server.

---

## Deployment (Vercel + Supabase)

The whole app is **one Vercel project**: Vercel serves the built website and runs the Express API as a serverless function ([api/index.js](student-project-hub/api/index.js)) on the same domain. **Supabase** provides the database, image storage and Realtime. [vercel.json](student-project-hub/vercel.json) holds the build settings and routing.

### 1. Supabase

1. Create a project and keep the database password you choose. Use only letters and numbers, so it works inside connection strings without encoding.
2. **Storage:** create a **public** bucket named `project-hub`.
3. **API keys** (*Project Settings → API*): copy the **Project URL**, the **`anon`** key (public) and the **`service_role`** key (secret).
4. **Database connection strings** (**Connect** button, top of the dashboard), each with your password filled in:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`, with `?pgbouncer=true&connection_limit=1` appended.
   - **Session pooler** (port `5432`) → `DIRECT_URL` (migrations only).

### 2. Email (Resend)

Supabase doesn't send email for your app. With [Resend](https://resend.com):

1. Create an API key with **Sending access**.
2. Use `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER=resend`, `SMTP_PASS=<the API key>`.
3. **Sender:** until you verify a domain, use `EMAIL_FROM="ProjectHub <onboarding@resend.dev>"`. With that test sender, Resend only delivers to **your own Resend account's email**. To email everyone, add and verify a domain you own under *Domains* in Resend, then set `EMAIL_FROM` to an address on it (for example `ProjectHub <no-reply@yourdomain.com>`). A Gmail or Outlook address can never be the sender.

### 3. Vercel

1. Import the GitHub repository. Set **Root Directory** to `student-project-hub` and **Framework Preset** to **Other**. Leave the build/install/output overrides off; `vercel.json` provides them.
2. Add the **Environment Variables** (Production; also Preview if you use preview deployments):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Transaction pooler string + `?pgbouncer=true&connection_limit=1` |
   | `DIRECT_URL` | Session pooler string |
   | `JWT_ACCESS_SECRET` | 48+ random characters (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key |
   | `SUPABASE_ANON_KEY` | `anon` key (enables live updates) |
   | `SUPABASE_BUCKET` | `project-hub` |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | From step 2 |
   | `EMAIL_FROM` | From step 2 |

   **Don't set** `NODE_ENV` (setting it to `production` makes `npm ci` skip the dev dependencies the build needs) or `VITE_API_URL`. Set `CLIENT_URL` and `CORS_ORIGINS` only if you add a custom domain.
3. Deploy. Every push to `main` deploys automatically. On production deployments [scripts/vercel-build.js](student-project-hub/scripts/vercel-build.js) first applies database migrations through `DIRECT_URL`, then builds the server and the website. Preview deployments skip migrations.

**Check after a deploy:**

1. `https://<your-app>.vercel.app/health` shows `{"status":"ok"}`.
2. Sign up, verify the email, and upload a project with images.
3. Sign out (you should land on the landing page), then use "Forgot password" and sign in with the new password.
4. Open a project in two browsers. A like or comment in one appears in the other within a second or two.
5. Share a project link in a chat app. The preview should show its cover and title.

**Use the production domain.** Share `project-hub-ug.vercel.app` (or your custom domain). The `…-<team>.vercel.app` deployment URLs are private team links and ask visitors to log in to Vercel.

---

## Running the live site

Day-to-day management happens in the **Admin** dashboard; no SQL needed. It updates live, and the **Students** and **Reports** tabs show badges for unverified students and pending reports. Search, filters and page number live in the address bar, so refreshing or going back keeps your place; press `/` to jump to the search box.

- **Verify an email by hand** (needed while emails only reach your own address): the overview links straight to unverified students. Click **Verify** on a row, or tick several and use **Verify selected**. They can upload and comment straight away, without signing out, and get a notification saying so. Verification can't be undone; use **Suspend** for bad actors.
- **See everything about a student:** click their row to open a side panel with their details, stats, projects and actions.
- **Make someone an admin, remove admin access, or suspend an account** from the row's **⋯** menu or the side panel. These ask for confirmation first; reactivating doesn't.
- **Account deletion requests.** Students ask in **Settings → Delete account**, confirming with their password (an optional reason is shown to admins). They are signed out everywhere and hidden at once. Requests show as a red badge on **Students** and on the overview. Open one and choose **Keep account** (it works again) or **Delete**, then type the username to confirm. Deleting removes the account, its projects, comments, likes and uploaded images for good, including other students' replies under their comments. If the student signs in before you decide, they can choose **Keep my account**, which withdraws the request. Admins can only delete accounts whose owner asked.
- Actions show on screen immediately and roll back with an error message if the server refuses.

SQL (in **Supabase → SQL Editor**, keeping the double quotes around names) is only needed if no admin can sign in, for example to create the very first admin:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'person@example.com';
```

**Logs.** Use Vercel → your project → **Logs**, or `npx vercel logs -e production` from the project folder. On the free (Hobby) plan, runtime logs are kept for only about **30 minutes**, so reproduce a problem and read the logs right away.

**Free-plan limits to know:**

- **Supabase pauses** free projects after about a week without activity. The whole site then fails until you click **Restore** in the Supabase dashboard. Use the site regularly, upgrade to Pro, or set up a scheduled ping.
- **Supabase backups** you can restore yourself need the Pro plan. On the free plan, export data periodically (*Database → Backups* or `pg_dump` through the session pooler).
- **Vercel functions** time out after 30 seconds (`maxDuration` in `vercel.json`), and request bodies are limited to 4.5 MB.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Invalid environment configuration` on start | Fix the variable named in the message in `server/.env` |
| `Can't reach database server` locally | Start `npm run db:local`, or fix `DATABASE_URL` |
| `pre-existing shared memory block is still in use` | An old embedded Postgres is still running. End its `postgres.exe` processes in Task Manager and retry |
| `EPERM` when generating the Prisma client on Windows | The running dev server locks Prisma files. Stop `npm run dev`, run the command, start it again |
| "Something went wrong" on every form in production | The API isn't answering. Open `/health`; if it fails, read the function logs right away (see *Logs*) |
| Logs: `Missing required production configuration` | Set the named variables in Vercel, then **Redeploy** (variable changes only apply to new deployments) |
| Build fails: `DIRECT_URL is required` or `P1001 Can't reach database server` | `DIRECT_URL` is missing or still contains placeholders/an old password |
| No verification email; logs: `535 Authentication credentials invalid` | Wrong Resend API key. Create a new key and update `SMTP_PASS`, then redeploy |
| Logs: `550 The gmail.com domain is not verified` | `EMAIL_FROM` uses an address you can't send from. Use `onboarding@resend.dev` or an address on your verified domain |
| Logs: `You can only send testing emails to your own email address` | Expected with `onboarding@resend.dev`. Verify a domain in Resend, or click **Verify email** for them in Admin → Users |
| Images or live updates broken after changing Supabase project | The Content-Security-Policy in `vercel.json` still names the old project. Replace `gxzbcrvsojdjbibfyieq.supabase.co` with the new project's host (three places) and redeploy |
| Likes/comments don't update live | `SUPABASE_ANON_KEY` missing (check `/api/v1/realtime` isn't `null`), or the browser blocks WebSockets. Refreshing still shows the latest data |
| Share preview shows the old/plain card | Social apps cache previews. New shares pick up changes; WhatsApp/LinkedIn may keep an old preview for a while |
| A push didn't create a Vercel deployment | GitHub's webhook was lost (happens during GitHub incidents). Push an empty commit (`git commit --allow-empty -m "Trigger deployment"`) or click **Redeploy** |
| "The upload is too large" | The images together exceed 4.5 MB even after compression. Upload fewer screenshots at a time |
| Everyone gets "Too many requests" at once | `TRUST_PROXY` doesn't match the proxy count; on Vercel leave it at `1` |
| Slow installs or file locks | The repo is in a OneDrive-synced folder. Move it outside OneDrive or pause syncing while installing |

---

## Known limitations

- **Email reaches only the owner** until a sending domain is verified in Resend (see Deployment step 2). Until then, verify accounts with **Verify email** in Admin → Users.
- **Build-log noise:** each Vercel build prints about 1,900 TypeScript errors from Vercel's function packager type-checking client files. They are harmless (deployments succeed) and don't happen in local builds; the cause on Vercel's side hasn't been identified.
- **In-memory limits:** the general per-IP and write rate limits are per serverless instance; only the auth limits are shared through the database.
- **Free plans:** Supabase pausing and the lack of self-service backups (see *Running the live site*).
