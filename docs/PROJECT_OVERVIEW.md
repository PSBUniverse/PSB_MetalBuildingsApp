# PROJECT OVERVIEW (Beginner Version)

## 1) What This System Does

PSBUniverse is the base shell app for business tools.

Think of it like a mall building:

- The mall building itself is PSBUniverse (shared login, shared security, shared layout).
- Each store in the mall is a module app (like Gutter, OHD, Metal Buildings).
- The shell gives each store the same safe entrance, same hallways, and same rules.

So this project is not one big business feature. It is the shared foundation that every feature app starts from.

## 2) Real-Life Analogy: A School Campus

Imagine a school campus:

- Front desk = login page
- Hallway map = routing
- School rules = access control
- Classroom tools = module features
- Student records office = database

PSBUniverse is like the campus foundation:

- It controls who can enter.
- It knows where people are allowed to go.
- It provides common services (notifications, loading bars, API patterns).
- It lets teams build new classrooms (modules) without rebuilding the campus.

## 3) Main Parts of the System

### A) Frontend (What users see)

Frontend is the screen UI in the browser.

Main location:

- `src/app` for route files (pages)
- `src/modules/user-master/components` for page UI components
- `src/shared/components` for reusable shared UI

Simple meaning:

- Buttons, forms, tables, cards, headers, and pages.

### B) Backend (Server logic)

Backend is the logic that runs on the server.

Main location:

- `src/app/api/**/route.js` (API endpoints)
- `src/modules/user-master/services` (real business logic)

Simple meaning:

- Checks login
- Checks permission
- Reads/writes database
- Returns JSON responses

### C) Database (Long-term storage)

Database is where data lives after the page refreshes.

Main connection files:

- `src/infrastructure/supabase/server.js`
- `src/infrastructure/supabase/admin.js`
- `src/lib/supabaseClient.js`

Simple meaning:

- It stores users, roles, cards, and setup data.

## 4) How Everything Connects

Here is the simple full flow:

1. User clicks something on the page.
2. Frontend component calls a function (often from a hook or service).
3. That function sends request to an API route.
4. API route calls server service code.
5. Service talks to Supabase database.
6. Database returns data.
7. Service sends result back through API.
8. Frontend receives result and updates UI.

Short sentence version:

User click -> Frontend -> Backend API -> Database -> Backend API -> Frontend update.

## 5) Actual Example in This Repo

Example: user opens dashboard.

1. Browser goes to `/dashboard`.
2. Route file in `src/app/(protected)/dashboard/page.js` renders dashboard component.
3. Protected layout `src/app/(protected)/layout.js` wraps page with app shell.
4. `src/shared/components/layout/AppLayout.js` checks session/access.
5. Dashboard component can call APIs like `/api/my-apps`.
6. API route file `src/app/api/my-apps/route.js` forwards to service.
7. Service file `src/modules/user-master/services/user-master-my-apps.service.js` reads database.
8. Response comes back and cards are shown on screen.

## 6) Why This Architecture Is Useful

- Reuse: Teams reuse shell behavior (auth, layout, access).
- Safety: Access checks happen in one standard pattern.
- Speed: New modules can be created faster from the same base.
- Clean code: UI files stay UI-focused, service files stay data-focused.

## 7) Shell vs Module (Important)

- Shell repo (this one): shared platform and patterns.
- Module repo: business-specific logic and pages for one module.

Rule:

- Keep shell module-agnostic.
- Put module business code in module repositories.

## 8) Beginner Summary

If you remember only this, remember:

- `src/app` = map of routes
- `src/app/api` = server doors
- `src/modules/*/services` = brains
- Supabase = storage room
- UI pages = what users touch

This is a platform where teams can build safely without stepping on each other.