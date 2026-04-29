# Your First Module — Quick Start

This is a beginner-friendly walkthrough for creating your first module. If you've never worked on PSBUniverse before, start here.

---

## What Is a Module?

A module is your own mini-app that lives inside the main project. Think of it like a folder that the system automatically finds and turns into a working page on the website.

**You never need to edit files outside your module folder.**

---

## Where Does Your Code Go?

Everything you write goes inside **one folder**:

```
src/modules/Metal-Buildings/
```

That's it. You don't touch anything outside this folder.

---

## Your Folder Structure

Every module has the same basic shape:

```
src/modules/Metal-Buildings/
  index.js                        ← The ID card for your module
  data/
    metalBuildings.actions.js     ← Server Actions (database access)
    metalBuildings.data.js        ← Shared helpers (used by the view)
  pages/
    DashboardPage.js              ← Server entry (loads data)
    DashboardView.jsx             ← The interactive UI (runs in the browser)
```

For a simple module you might only have `index.js` + `pages/`. As your module grows, add a `data/` folder.

Let's walk through each file.

---

## File 1: `index.js` — Your Module's ID Card

This tells the system: "Hey, I exist. Here's my name and my URL."

```javascript
const metalBuildingsModule = {
  key: "metal-buildings",
  module_key: "metal-app",
  name: "Metal Buildings",
  description: "Metal Buildings application.",
  icon: "bi-building",
  group_name: "Applications",
  group_desc: "Business applications.",
  order: 200,
  routes: [
    { path: "/metal-buildings", page: "DashboardPage" },
  ],
};

export default metalBuildingsModule;
```

**What each field means:**

| Field | What It Does |
|-------|-------------|
| `key` | A unique ID for your module (lowercase, dashes, no spaces) |
| `module_key` | Which application this belongs to — must match a `module_key` in `psb_s_application` (ask your senior for the value) |
| `name` | The display name users see on the dashboard |
| `description` | A short sentence shown under the module card |
| `icon` | A Bootstrap icon class (e.g. `bi-building`, `bi-gear`) |
| `group_name` | Which group this card sits under on the dashboard |
| `group_desc` | Description for the group |
| `order` | Sort order (lower number = appears first) |
| `routes` | A list of URLs and which page file to load for each one |

The `routes` array is the most important part. Each entry says:
- `path` — the URL the user visits (e.g. `/metal-buildings`)
- `page` — the **filename** inside your `pages/` folder (without `.js`)

---

## File 2: `pages/DashboardPage.js` — The Page (Server Component)

This is the entry point for your page. It runs on the **server**, loads data, and passes it to the view.

```javascript
import DashboardView from "./DashboardView.jsx";

export default async function DashboardPage() {
  return <DashboardView />;
}
```

**Rules for page files:**

1. **DO NOT** put `"use client"` at the top. Pages must be server components.
2. Keep this file simple — load data, pass to view.
3. The filename must match the `page` value in your route (`"DashboardPage"` → `DashboardPage.js`).

---

## File 3: `pages/DashboardView.jsx` — The UI (Client Component)

This is where your actual visible UI code goes. It runs in the **browser**.

```javascript
"use client";

export default function DashboardView() {
  return (
    <div className="container mt-4">
      <h1>Hello World!</h1>
    </div>
  );
}
```

**Rules for view/component files:**

1. **DO** put `"use client"` at the very top. This is required for anything interactive (buttons, forms, state, etc.).
2. Put all your UI, hooks (`useState`, `useEffect`), and event handlers here.

---

## Why Two Files? (Server vs Client)

Next.js needs to know what runs on the server vs the browser.

- **Server components** (page entry files) — can talk to the database, load data, do secure stuff. They run once on the server and send HTML to the browser.
- **Client components** (view files) — can handle clicks, forms, animations, and anything interactive. They run in the user's browser.

The pattern is always:

```
Page (server) → loads data → passes to → View (client)
```

This is not something we invented — it's how Next.js works.

---

## How the System Finds Your Module

When you run `npm run dev` or `npm run build`, a script (`scripts/generate-routes.js`) runs automatically. It:

1. Scans every folder inside `src/modules/` for an `index.js`
2. Reads your `routes` array
3. Auto-generates the matching route files inside `src/app/`

When a user visits `/metal-buildings`, Next.js finds the auto-generated route file and loads your page component directly.

**You do not need to edit any file outside your module folder.** No registration step, no config file, nothing. Just define your routes in `index.js` and the system handles the rest.

---

## Adding More Pages

Want a second page at `/metal-buildings/settings`?

### Step 1: Add the route to `index.js`

```javascript
routes: [
  { path: "/metal-buildings", page: "DashboardPage" },
  { path: "/metal-buildings/settings", page: "SettingsPage" },  // ← new
],
```

### Step 2: Create the page files

```javascript
// pages/SettingsPage.js — server entry
import SettingsView from "./SettingsView.jsx";

export default async function SettingsPage() {
  return <SettingsView />;
}
```

```javascript
// pages/SettingsView.jsx — client UI
"use client";

export default function SettingsView() {
  return <h1>Settings go here</h1>;
}
```

That's it. No other files to touch.

---

## Quick Checklist

- [ ] Created `src/modules/My-Module/index.js` with module definition
- [ ] `key` is lowercase with dashes (no spaces)
- [ ] `module_key` matches a value in `psb_s_application` (ask your senior)
- [ ] `routes` array has at least one entry
- [ ] Each route `page` value matches a file in `pages/`
- [ ] Page entry files have **no** `"use client"` directive
- [ ] View/component files **do** have `"use client"` at the top
- [ ] Module shows up on the dashboard after login

---

## Common Mistakes

| Mistake | What Happens |
|---------|-------------|
| Putting `"use client"` on a page entry file | Page won't load — server data loading breaks |
| `page` in route doesn't match filename | Core can't find the file — blank page |
| Editing files outside your module folder | You might break another module or the platform |
| Forgetting `module_key` | Core can't resolve `app_id` — module throws an error |
| Creating API route files | Unnecessary — use Server Actions in `data/*.actions.js` instead |
