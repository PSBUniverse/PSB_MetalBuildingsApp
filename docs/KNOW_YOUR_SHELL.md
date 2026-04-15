# KNOW YOUR SHELL (Beginner-Proof)

This guide explains what each base folder and key file does in plain language.

Think of PSBUniverse like a house blueprint:

- Some rooms are for display (UI)
- Some rooms are for logic (services)
- Some rooms are for tools (utils, hooks)
- Some rooms are for communication (API routes)

If every file stays in the right room, the house stays clean and easy to fix.

## 1) Quick Project Map

Top-level source folders:

- `src/app`
- `src/core`
- `src/infrastructure`
- `src/lib`
- `src/modules`
- `src/providers`
- `src/shared`
- `src/styles`

Other important root folders/files:

- `public`
- `supabase`
- `next.config.mjs`
- `jsconfig.json`
- `eslint.config.mjs`
- `package.json`

## 2) The Folder Types You Asked For

You asked for these categories: `/components`, `/pages`, `/lib`, `/services`, `/hooks`, `/utils`.

In this repo they exist in this way:

### Folder: /components

Where in this project:

- `src/shared/components`
- `src/modules/user-master/components`

What it is:

- Reusable UI pieces (screen blocks).

Why it exists:

- So we do not copy the same UI code again and again.

When to use:

- When a visual piece appears in one or more screens (card, form panel, page component).

Real-life analogy:

- LEGO bricks used to build many different models.

Example use:

- `src/shared/components/layout/Header.js` is the top bar used in the protected app shell.

### Folder: /pages

Where in this project:

- App Router uses `src/app` instead of old `pages` folder.
- Route files are `page.js` files under `src/app/**`.

What it is:

- URL-to-screen map.

Why it exists:

- To tell Next.js what to show for each URL.

When to use:

- Any time you need a new URL path, add a route file under `src/app`.

Real-life analogy:

- A city map where each address points to one building.

Example use:

- `src/app/(protected)/dashboard/page.js` loads the dashboard screen.

### Folder: /lib

Where in this project:

- `src/lib`

What it is:

- Small shared helper libraries that are not tied to one page.

Why it exists:

- Central place for shared helper instances.

When to use:

- For shared clients and utility setup used across many places.

Real-life analogy:

- A toolbox everyone can borrow from.

Example use:

- `src/lib/query-client.js` creates React Query client settings.

### Folder: /services

Where in this project:

- `src/modules/user-master/services`

What it is:

- Business logic and server operations.

Why it exists:

- Keep heavy logic out of UI files.

When to use:

- Database calls, validation, permission checks, request handling.

Real-life analogy:

- Kitchen staff doing the real cooking after waiters take orders.

Example use:

- `src/modules/user-master/services/user-master-login.service.js` handles login processing.

### Folder: /hooks

Where in this project:

- `src/modules/user-master/hooks`

What it is:

- Reusable React logic that manages state/data behavior.

Why it exists:

- Reuse logic cleanly across components.

When to use:

- Fetching user session, access state, shared page behavior.

Real-life analogy:

- A checklist you can reuse each time you do the same task.

Example use:

- `src/modules/user-master/hooks/useUserAccess.js` loads access/session payload through React Query.

### Folder: /utils

Where in this project:

- `src/shared/utils`

What it is:

- Small helper functions (formatters, normalizers, event helpers).

Why it exists:

- Keep tiny reusable logic in one place.

When to use:

- If a function can be reused and is not tied to one component.

Real-life analogy:

- Handy pocket tools (tape measure, mini flashlight).

Example use:

- `src/shared/utils/route-path.js` normalizes launch URL values.

## 3) Every Main Shell Folder Explained

### Folder: src/app

What it is:

- Main route tree for pages and APIs.

Why it exists:

- Next.js App Router reads this folder to build the app URLs.

When to use:

- Add page routes (`page.js`), layouts (`layout.js`), API routes (`route.js`).

Real-life analogy:

- The building directory board at the entrance.

Example files:

- `src/app/layout.js` (global root layout)
- `src/app/(protected)/layout.js` (protected wrapper)
- `src/app/api/**/route.js` (API endpoints)

### Folder: src/core

What it is:

- Core shared systems (security/cache/config style foundations).

Why it exists:

- Keep platform-level logic centralized.

When to use:

- Cross-module foundational behavior.

Real-life analogy:

- Building plumbing and electrical lines.

### Folder: src/infrastructure

What it is:

- External service connectors (Supabase clients).

Why it exists:

- One place to configure external services correctly.

When to use:

- Server-side and admin-level Supabase access.

Real-life analogy:

- The cables connecting your house to internet and power company.

Key files:

- `src/infrastructure/supabase/server.js`
- `src/infrastructure/supabase/admin.js`
- `src/infrastructure/supabase/client.js`

### Folder: src/lib

What it is:

- Shared low-level helper modules.

Why it exists:

- Avoid duplicated setup code.

When to use:

- Shared instances like query client or browser Supabase client.

Real-life analogy:

- The utility drawer everyone uses.

### Folder: src/modules

What it is:

- Feature domain code.

Why it exists:

- Keeps feature logic grouped by domain.

When to use:

- Add domain-specific components/services/hooks.

Real-life analogy:

- Different classrooms by subject (Math room, Science room).

Current shell module:

- `src/modules/user-master`

### Folder: src/providers

What it is:

- App-wide providers/bridges that wrap behavior around children.

Why it exists:

- Put global state systems in one place.

When to use:

- React Query provider, realtime invalidation bridges.

Real-life analogy:

- Air conditioning system that serves the whole building.

### Folder: src/shared

What it is:

- Shared UI and shared helper code used by many parts.

Why it exists:

- Reuse common pieces and keep style/behavior consistent.

When to use:

- Common components, constants, utility helpers.

Real-life analogy:

- Common school supplies room.

### Folder: src/styles

What it is:

- Global CSS and theme layers.

Why it exists:

- Central style rules for the whole app.

When to use:

- Global visual design updates.

Real-life analogy:

- Paint and decoration rules used in every room.

## 4) Key Files You Must Know

### File: src/app/layout.js

What it does:

- Global HTML/body shell.
- Loads global CSS.
- Wraps app with providers and global toast host.

Simple meaning:

- The main building frame around every page.

### File: src/app/(protected)/layout.js

What it does:

- Wraps protected pages with AppLayout.

Simple meaning:

- Security gate for private pages.

### File: src/shared/components/layout/AppLayout.js

What it does:

- Handles auth checks and route-level access checks.
- Shows loading spinner while auth state is being verified.
- Controls header loader progress behavior.
- Handles logout flow and redirect.

Simple meaning:

- Main security guard + traffic controller.

### File: src/shared/components/layout/Header.js

What it does:

- Top navigation header.
- Shows greeting and logout button.
- Switches tabs like My PSB and My Apps.
- Shows progress bar for loading.

Simple meaning:

- The top menu bar users interact with most.

### File: src/providers/QueryProvider.js

What it does:

- Adds React Query provider for app-wide data caching.
- Mounts UserAccessRealtimeBridge.

Simple meaning:

- Data memory manager for faster UI updates.

### File: src/providers/UserAccessRealtimeBridge.js

What it does:

- Listens for realtime database changes.
- Invalidates access/session queries when role/access data changes.

Simple meaning:

- Auto-refresh alarm when permission data changes.

### File: src/shared/utils/route-path.js

What it does:

- Normalizes launch URL / route path values.
- Keeps absolute HTTP(S) URLs unchanged.

Simple meaning:

- Cleans route text so launch links are safe and predictable.

## 5) Config Files (Root)

### next.config.mjs

What it is:

- Next.js project configuration.

Why it matters:

- Controls Next.js build/runtime behavior.

### jsconfig.json

What it is:

- JavaScript path alias config.

Why it matters:

- Lets imports use `@/` style paths.

Example:

- `@/modules/user-master/...` instead of long relative paths.

### eslint.config.mjs

What it is:

- Lint rules.

Why it matters:

- Helps catch mistakes before runtime.

### package.json

What it is:

- Project scripts + dependencies.

Why it matters:

- Defines commands like `npm run dev`, `npm run build`.

### .env.local (local env file)

What it is:

- Environment variables for local machine.

Why it matters:

- Holds Supabase URL/keys and session secret.

Important values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `USER_MASTER_SESSION_SECRET`

## 6) Beginner Rules for Folder Choice

If you are unsure where a new file goes, use this quick rule:

- New screen URL? -> `src/app/.../page.js`
- New reusable UI? -> `src/shared/components` or `src/modules/<feature>/components`
- New DB/API logic? -> `src/modules/<feature>/services`
- New reusable state logic? -> `src/modules/<feature>/hooks`
- Small reusable helper? -> `src/shared/utils`
- Global data provider? -> `src/providers`

## 7) Final Memory Trick

Think in 3 layers:

1. Screen layer (components/pages)
2. Logic layer (hooks/services)
3. Data layer (API/Supabase)

Keep each layer in its folder, and the project stays beginner-friendly and scalable.