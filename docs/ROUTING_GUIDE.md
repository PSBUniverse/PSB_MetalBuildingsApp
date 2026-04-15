# ROUTING GUIDE (Very Simple)

Routing is how URLs connect to pages and APIs.

Simple sentence:

- Typing a URL is like telling the app where to go.

Example:

- `/dashboard` means "take me to dashboard screen"

## 1) Routing in This Project

This repo uses Next.js App Router.

Main routing folder:

- `src/app`

Next.js reads folders/files in `src/app` and builds routes automatically.

## 2) Basic Route File Rules

### page.js

What it does:

- Creates a page route users can open in browser.

Example:

- `src/app/(protected)/dashboard/page.js` -> `/dashboard`

### layout.js

What it does:

- Wraps pages under that folder with shared UI/logic.

Example:

- `src/app/layout.js` wraps the whole app
- `src/app/(protected)/layout.js` wraps protected pages

### route.js

What it does:

- Creates API endpoint route.

Example:

- `src/app/api/my-apps/route.js` -> `/api/my-apps`

## 3) Route Groups (Folders in Parentheses)

In this project:

- `src/app/(public)`
- `src/app/(protected)`

Important:

- Parentheses group folders organize code, but do not appear in URL.

So:

- `src/app/(public)/login/page.js` becomes `/login`
- `src/app/(protected)/dashboard/page.js` becomes `/dashboard`

## 4) Current Route Examples in Shell

User pages:

- `/login` from `src/app/(public)/login/page.js`
- `/dashboard` from `src/app/(protected)/dashboard/page.js`
- `/profile` from `src/app/(protected)/profile/page.js`
- `/company` from `src/app/(protected)/company/page.js`

Setup/admin pages:

- `/setup/admin` and related child pages under `src/app/(protected)/setup/admin`
- `/setup/cards` from `src/app/(protected)/setup/cards/page.js`

Home route:

- `src/app/page.js` redirects to `/dashboard`

## 5) Dynamic Routes

Dynamic route uses square brackets.

Example in this repo:

- `src/app/(protected)/[module]/page.js`

Meaning:

- URL like `/something` can match dynamic segment.
- In current shell, this file intentionally calls `notFound()`.

Simple reason:

- Unknown module paths should not silently render wrong content.

## 6) API Routing (Backend Endpoints)

API routes live under:

- `src/app/api`

Pattern used in this shell:

- `route.js` forwards HTTP methods to service files in `src/modules/.../services`.

Example:

- `src/app/api/auth/login/route.js` forwards POST to `user-master-login.service.js`
- `src/app/api/setup/cards/route.js` forwards GET/POST/PATCH/DELETE to setup cards service

Why this pattern is good:

- Route file stays small.
- Real business logic lives in service files.

## 7) Navigation in UI

### Link navigation

Use Next Link for normal page movement.

Example:

```javascript
import Link from "next/link";

<Link href="/dashboard">Go to Dashboard</Link>
```

### Programmatic navigation

Use `useRouter()` when navigation happens after an action.

Example:

```javascript
import { useRouter } from "next/navigation";

const router = useRouter();
router.push("/dashboard");
```

In this shell, header and layout use this pattern.

## 8) Protected Routes (Auth)

Protected flow in this repo:

1. User enters protected URL.
2. `src/app/(protected)/layout.js` uses `AppLayout`.
3. `AppLayout` checks session and access.
4. If not authenticated -> redirect to `/login`.
5. If authenticated but no required app access -> redirect to `/dashboard`.
6. If allowed -> page renders.

This keeps sensitive pages safe.

## 9) "Where to Route" When Adding New Module

If you add new module named inventory:

1. Add page wrapper in:
   - `src/app/(protected)/inventory/page.js`
2. Add API wrapper in:
   - `src/app/api/inventory/items/route.js`
3. Put real page UI in:
   - `src/modules/inventory/components/inventory.page.js`
4. Put real server logic in:
   - `src/modules/inventory/services/inventory-items.service.js`

## 10) Launch URLs in Setup Cards

This shell supports full launch URLs (including absolute HTTP links).

File involved:

- `src/shared/utils/route-path.js`

Simple meaning:

- Cards can launch routes in same app or full URLs to other module apps.

## 11) Common Routing Mistakes

Mistake: creating component but no `page.js` route.

- Result: URL 404.

Mistake: putting logic inside route wrappers.

- Result: hard-to-maintain code.

Mistake: using wrong folder level.

- Result: URL is not what you expected.

Mistake: missing API method export (`GET`, `POST`, etc.).

- Result: endpoint exists but request method fails.

## 12) Beginner Summary

Remember this mapping:

- Browser URL route -> `src/app/**/page.js`
- Shared wrappers -> `layout.js`
- API URL route -> `src/app/api/**/route.js`
- Business logic -> `src/modules/**/services`

If you follow this map, routing stays predictable and clean.