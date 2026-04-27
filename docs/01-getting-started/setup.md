# Project Setup

This guide walks you through setting up PSBUniverse Core on your local machine from scratch.

---

## Prerequisites

Before you start, make sure you have:

| Tool | Minimum Version | Tested With |
|------|-----------------|-------------|
| Node.js | v18+ | v24.14.0 |
| npm | v9+ | v11.9.0 |
| Git | any recent version | — |

You also need access to the team's **Supabase** project. Ask your tech lead for:
- Supabase URL
- Supabase anon key
- Supabase service role key

---

## Step 1: Clone and Install

```bash
git clone <repo-url>
cd PSBUniverse-core
npm install
```

This installs all dependencies: Next.js 16, React 19, Supabase JS, Bootstrap, TanStack Query/Table, FontAwesome, and dnd-kit.

> **PowerShell users:** If `npm` is blocked, use `npm.cmd` instead.

---

## Step 2: Create `.env.local`

Create a file called `.env.local` in the project root. This file holds your secret keys and is **never committed to git** (it's already in `.gitignore`).

```env
# === REQUIRED ===
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get these values from the Supabase dashboard: **Settings → API**.

### Optional Variables

These have defaults and you usually don't need to set them:

```env
NEXT_PUBLIC_ENV=local
USER_MASTER_APP_CARD_GROUP_TABLE=psb_m_appcardgroup
USER_MASTER_APP_CARD_TABLE=psb_s_appcard
USER_MASTER_APP_CARD_ROLE_ACCESS_TABLE=psb_m_appcardroleaccess
```

The `USER_MASTER_APP_*_TABLE` variables let you override which database tables the User Master module reads from. You almost never need to change them.

> **Note:** Module `app_id` values are resolved automatically from the `module_key` column in `psb_s_application`. There are no `*_APP_ID` env vars.

### Environment Modes

The `NEXT_PUBLIC_ENV` variable controls which base URL the app uses (configured in `config/app.js`):

| Value | Base URL | When to Use |
|-------|----------|-------------|
| `local` (default) | http://localhost:3000 | Local development |
| `dev` | Vercel dev URL | Staging |
| `prod` | Production URL | Live deployment |

Do **not** change this to `dev` or `prod` locally unless your tech lead tells you to.

---

## Step 3: Start the Dev Server

```bash
npm run dev
```

The app opens at **http://localhost:3000** using **webpack** (not turbopack).

### What to Expect on First Start

1. A `PackFileCacheStrategy` rename warning in the terminal — this is harmless. Ignore it.
2. The first page load may take a few seconds while webpack compiles.

---

## Step 4: Verify the App Works

1. Open **http://localhost:3000** in your browser.
2. You should see the **login page**.
3. Sign in with your test account credentials (ask your tech lead if you don't have one).
4. After login, you should land on the **dashboard**.

---

## Step 5: Verify the Build

Before starting any feature work, make sure the project builds without errors:

```bash
npm run build
```

If the build fails on a fresh clone, **do not try to fix it** — report it to your tech lead.

---

## Step 6: Run the Linter

```bash
npm run lint
```

Fix any lint errors in your code before submitting a pull request.

---

## Available npm Scripts

| Command | What It Does |
|---------|-------------|
| `npm run dev` | Start local dev server on port 3000 |
| `npm run build` | Create a production build (run before every PR) |
| `npm run start` | Serve the production build locally |
| `npm run lint` | Run ESLint checks |

---

## Key URLs

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Main app |
| http://localhost:3000/login | Login page |
| http://localhost:3000/dashboard | Dashboard (after login) |
| http://localhost:3000/examples | Shared UI guide and playground |
| http://localhost:3000/examples/data-table | Data table reference example |
| http://localhost:3000/admin/application-setup | Admin: application setup |

---

## Project Structure

```
src/
  app/          ← Next.js routes (don't add module pages here)
  core/         ← Auth, layout, Supabase clients (DO NOT MODIFY)
  modules/      ← Your module code lives here
    admin/      ← Admin setup modules
    psbpages/   ← Platform pages (dashboard, login, profile)
  shared/       ← Shared UI components and utilities (DO NOT MODIFY)
  styles/       ← Global CSS and theme variables
config/         ← App configuration
docs/           ← Documentation
```

**Rules:**
1. Your work goes inside `src/modules/`.
2. Do **not** edit files in `src/core/` or `src/shared/` without lead approval.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm install` fails | Delete `node_modules` and `package-lock.json`, then run `npm install` again |
| Port 3000 already in use | Kill the other process, or run `PORT=3001 npm run dev` |
| Supabase connection errors | Double-check your `.env.local` values against the Supabase dashboard |
| Login redirects back to login | Check `.env.local`, check browser console for auth errors |
| Build fails on fresh clone | Don't fix it — report to tech lead |
| PowerShell blocks npm | Use `npm.cmd` instead of `npm` |

---

## Notes

- `.env*` files are excluded by `.gitignore` — **never commit credentials**.
- No database migration files exist yet in `supabase/`. Tables must already exist on your Supabase project.
