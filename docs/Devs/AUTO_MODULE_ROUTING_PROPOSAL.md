# Auto-Discovery Module Routing — Proposal

## Problem

Every new module requires a senior dev to edit the core catch-all route file
(`src/app/[...modulePath]/page.js`) to register a `pageImporters` entry.
Junior devs should never need to touch core files — they should only work
inside their own `src/modules/<ModuleName>/` folder.

## Solution

Two **one-time** core changes that eliminate the hardcoded `pageImporters` map.
After these changes, adding a new module never requires editing a core file again.

---

## Changes Required (Senior Dev, One-Time)

### 1. `src/modules/loadModules.js`

After loading each module's `index.js`, attach a `_importPage` helper that
knows how to import pages from that module's `pages/` directory. This uses
the same `pathToFileURL` + `webpackIgnore` pattern already established.

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function readModuleEntries(modulesDir) {
  try {
    return await fs.readdir(modulesDir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function resolveModulePath(modulesDir, moduleName) {
  const modulePath = path.join(modulesDir, moduleName, "index.js");

  try {
    await fs.access(modulePath);
    return modulePath;
  } catch {
    return null;
  }
}

function createModuleUrl(modulePath) {
  const moduleUrl = pathToFileURL(modulePath);

  if (process.env.NODE_ENV !== "production") {
    moduleUrl.searchParams.set("t", String(Date.now()));
  }

  return moduleUrl;
}

// ── NEW: builds an importer function scoped to a module's pages/ folder ──
function createPageImporter(modulePath) {
  const moduleDir = path.dirname(modulePath);

  return async function importPage(pageName) {
    const pagePath = path.join(moduleDir, "pages", `${pageName}.js`);

    try {
      await fs.access(pagePath);
    } catch {
      return null;
    }

    const pageUrl = createModuleUrl(pagePath);
    return import(/* webpackIgnore: true */ pageUrl.href);
  };
}

export async function loadModules() {
  const modules = [];
  const seenModuleKeys = new Set();
  const modulesDir = path.join(process.cwd(), "src", "modules");
  const entries = await readModuleEntries(modulesDir);

  async function scanDirectory(dir, dirEntries) {
    for (const entry of dirEntries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const modulePath = await resolveModulePath(dir, entry.name);

      if (!modulePath) {
        const subDir = path.join(dir, entry.name);
        const subEntries = await readModuleEntries(subDir);
        if (subEntries.length > 0) {
          await scanDirectory(subDir, subEntries);
        }
        continue;
      }

      const moduleUrl = createModuleUrl(modulePath);
      const importedModule = await import(/* webpackIgnore: true */ moduleUrl.href);
      const moduleDefinition = importedModule.default ?? importedModule;
      const moduleKey = String(moduleDefinition?.key || entry.name);

      if (seenModuleKeys.has(moduleKey)) {
        continue;
      }

      // ── NEW: attach the auto-importer so the catch-all route can use it ──
      moduleDefinition._importPage = createPageImporter(modulePath);

      seenModuleKeys.add(moduleKey);
      modules.push(moduleDefinition);
    }
  }

  await scanDirectory(modulesDir, entries);

  return modules;
}
```

**What changed:** Added `createPageImporter()` and one line that attaches
`_importPage` to each module definition. Everything else is untouched.

---

### 2. `src/app/[...modulePath]/page.js`

Remove the entire hardcoded `pageImporters` map. Use `moduleDefinition._importPage()`
instead.

```javascript
import { notFound } from "next/navigation";
import { loadModules } from "@/modules/loadModules";
import ModuleAccessGate from "@/core/auth/ModuleAccessGate";

// ── DELETED: the entire pageImporters map is gone ──

function buildPath(segments) {
  return `/${segments.join("/")}`;
}

export default async function ModuleRoutePage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const currentPath = buildPath(resolvedParams?.modulePath || []);
  const modules = await loadModules();

  if (!Array.isArray(modules)) {
    notFound();
  }

  modules.forEach((mod) => {
    mod.routes?.sort((a, b) => b.path.length - a.path.length);
  });

  for (const moduleDefinition of modules) {
    if (!moduleDefinition?.key || !moduleDefinition?.app_id) {
      continue;
    }

    if (!moduleDefinition?.routes) {
      continue;
    }

    for (const route of moduleDefinition.routes) {
      if (!currentPath.startsWith(route.path)) {
        continue;
      }

      // ── CHANGED: use the auto-attached importer instead of the map ──
      if (!moduleDefinition._importPage || !route.page) {
        continue;
      }

      const pageModule = await moduleDefinition._importPage(route.page);

      if (!pageModule) {
        continue;
      }

      const Component = pageModule.default;

      return (
        <ModuleAccessGate appId={moduleDefinition.app_id}>
          <Component searchParams={resolvedSearchParams} />
        </ModuleAccessGate>
      );
    }
  }

  notFound();
}
```

**What changed:** Deleted the `pageImporters` object. Replaced
`pageImporters[moduleDefinition.key]` lookup with `moduleDefinition._importPage()`.

---

## After These Changes

### What junior devs do (module folder only)

Create their module folder and files — nothing else:

```
src/modules/Metal-Buildings/
  index.js          ← module definition (key, routes, etc.)
  pages/
    DashboardPage.js
  components/
  services/
  hooks/
  utils/
```

The system auto-discovers the module and auto-resolves its pages.
**No core file edits required.**

---

## Important: Page Component Rules

Because pages are loaded via `webpackIgnore` (Node.js runtime import, not
webpack-bundled), there is one rule:

> **Module page files (in `pages/`) must be server components.**
> Do NOT put `"use client"` at the top of a page file.

For client-side interactivity, import client components from the page:

```
// pages/DashboardPage.js  ← server component (no directive)
import MyWidget from "../components/MyWidget";  // ← "use client" goes here

export default function DashboardPage() {
  return <MyWidget />;
}
```

```
// components/MyWidget.js
"use client";

export default function MyWidget() {
  return <h1>Hello World</h1>;
}
```

This is the standard Next.js App Router pattern and keeps webpack's client
boundary detection working correctly.

---

## Summary

| Before | After |
|--------|-------|
| Jr dev adds module → must edit core `page.js` | Jr dev adds module → done, only touches module folder |
| Hardcoded `pageImporters` map grows forever | Map eliminated, auto-discovery via `loadModules` |
| Core file is a merge-conflict magnet | Core files are stable, no per-module edits |
| 2 core files changed (one-time) | 0 core files changed per new module (forever) |
