#!/usr/bin/env node

/**
 * create-module.js
 *
 * Scaffolds a new module with the standard folder structure.
 *
 * Usage:
 *   npm run create-module -- metal-buildings
 *   npm run create-module -- admin/inventory-tracker
 *   npm run create-module -- psbpages/reports
 *
 * Generates:
 *   src/modules/<group?>/<module-name>/
 *     ├── index.js                          (module definition)
 *     ├── data/
 *     │   ├── <moduleName>.actions.js       ("use server" — DB queries)
 *     │   └── <moduleName>.data.js          (client helpers — forms, mappers)
 *     └── pages/
 *         ├── <ModuleName>Page.js           (server component — loads data)
 *         └── <ModuleName>View.jsx          ("use client" — UI, hooks, components)
 *
 * Then auto-runs generate-routes.js to create the app/ page entry.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(process.cwd());
const MODULES_DIR = path.join(ROOT, "src", "modules");

// ---------------------------------------------------------------------------
// 1. Parse arguments
// ---------------------------------------------------------------------------

const rawInput = process.argv.slice(2).filter((a) => !a.startsWith("--"))[0];

if (!rawInput) {
  console.error(`
  Usage:  npm run create-module -- <module-name>

  The module name can include a group prefix with a slash:

  Examples:
    npm run create-module -- metal-buildings           →  src/modules/metal-buildings/
    npm run create-module -- admin/inventory-tracker   →  src/modules/admin/inventory-tracker/
    npm run create-module -- psbpages/reports          →  src/modules/psbpages/reports/
  `);
  process.exit(1);
}

// Parse "admin/inventory-tracker" → group="admin", rawName="inventory-tracker"
// Parse "metal-buildings"         → group=null,    rawName="metal-buildings"
const parts = rawInput.replace(/^\/+/, "").split("/").filter(Boolean);
const group = parts.length > 1 ? parts.slice(0, -1).join("/") : null;
const rawName = parts[parts.length - 1];

// ---------------------------------------------------------------------------
// 2. Name conversions
// ---------------------------------------------------------------------------

function toPascalCase(slug) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

function toCamelCase(slug) {
  const p = toPascalCase(slug);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

function toDisplayName(slug) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const moduleSlug = rawName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
const pascal = toPascalCase(moduleSlug);
const camel = toCamelCase(moduleSlug);
const displayName = toDisplayName(moduleSlug);

const routePath = group ? `/${group}/${moduleSlug}` : `/${moduleSlug}`;
const moduleDir = group
  ? path.join(MODULES_DIR, group, moduleSlug)
  : path.join(MODULES_DIR, moduleSlug);

// ---------------------------------------------------------------------------
// 3. Check for conflicts
// ---------------------------------------------------------------------------

if (fs.existsSync(moduleDir)) {
  console.error(`\n  ERROR: Module folder already exists at:`);
  console.error(`         ${path.relative(ROOT, moduleDir)}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 4. File templates
// ---------------------------------------------------------------------------

const GROUP_DEFAULTS = {
  admin: { group_name: "Administration", group_desc: "Tools for system configuration and management." },
  psbpages: { group_name: "System", group_desc: "Core system pages." },
};

const groupInfo = GROUP_DEFAULTS[group] || {
  group_name: "TODO: Pick a sidebar group",
  group_desc: "TODO: Describe this group",
};

// ── index.js ───────────────────────────────────────────────

const indexContent = `\
/**
 * Module Definition — ${moduleSlug}
 *
 * Registers your module with the app. The route generator reads this
 * to auto-create page files under src/app/ when you run dev or build.
 *
 * FIELDS:
 *   key         → Unique slug for this module (already set).
 *   module_key  → Must match an application key in Application Setup.
 *   name        → Display name shown in the sidebar.
 *   description → Short summary for tooltips.
 *   icon        → Bootstrap Icons class. Browse: https://icons.getbootstrap.com
 *   group_name  → Sidebar section this appears under.
 *   group_desc  → Description for the sidebar section.
 *   order       → Sidebar position (lower = higher up).
 *   routes      → path = URL user visits, page = filename in pages/ (no extension).
 */
const ${camel}Module = {
  key: "${moduleSlug}",
  module_key: "psbuniverse",          // ← change to your app key from Application Setup
  name: "${displayName}",
  description: "TODO: Describe what this module does.",
  icon: "bi-box",                     // ← pick from https://icons.getbootstrap.com
  group_name: "${groupInfo.group_name}",
  group_desc: "${groupInfo.group_desc}",
  order: 200,                         // ← adjust to control sidebar position
  routes: [
    { path: "${routePath}", page: "${pascal}Page" },
  ],
};

export default ${camel}Module;
`;

// ── pages/Page.js (Server Component) ──────────────────────

const pageContent = `\
/**
 * Server Component — ${pascal}Page.js
 *
 * Runs on the server. Loads data, then passes it to the View.
 *
 * WHAT TO DO:
 *   1. Import your load function from "../data/${camel}.actions"
 *   2. Call it with \`await\`
 *   3. Pass the result as props to ${pascal}View
 *
 * RULES:
 *   - No useState, useEffect, or onClick here — those go in the View.
 *   - Do NOT wrap JSX in try/catch (causes a React lint error).
 */
import ${pascal}View from "./${pascal}View";
// import { load${pascal}Data } from "../data/${camel}.actions";

export const dynamic = "force-dynamic";

export default async function ${pascal}Page() {
  // TODO: Load your data here
  // const { items } = await load${pascal}Data();

  return <${pascal}View />;
}
`;

// ── pages/View.jsx (Client Component) ─────────────────────

const viewContent = `\
/**
 * Client Component — ${pascal}View.jsx
 *
 * Runs in the browser. All UI, hooks, and interaction go here.
 *
 * PATTERN:
 *   1. Create a custom hook (use${pascal}) at the top for state & logic.
 *   2. In the default export, call the hook and render your UI.
 *   3. Import helpers from "../data/${camel}.data" (forms, mappers, constants).
 *   4. Import server actions from "../data/${camel}.actions" (save, delete).
 *   5. Use shared UI from "@/shared/components/ui/" (TableZ, Card, Modal, etc).
 */
"use client";

export default function ${pascal}View(/* { items } */) {
  return (
    <main className="container py-4">
      <h2>${displayName}</h2>
      <p className="text-muted">This page is ready for development.</p>
    </main>
  );
}
`;

// ── data/actions.js (Server Actions) ──────────────────────

const actionsContent = `\
/**
 * Server Actions — ${camel}.actions.js
 *
 * Runs on the server. This is the ONLY place you talk to the database.
 *
 * WHAT TO DO:
 *   1. Import getSupabaseAdmin from "@/core/supabase/admin"
 *   2. Write one async function per operation:
 *        load___()   → SELECT
 *        create___() → INSERT
 *        update___() → UPDATE
 *        delete___() → DELETE or soft-delete
 *   3. Return clean objects — no raw DB internals.
 *
 * EXAMPLE:
 *   export async function load${pascal}Data() {
 *     const supabase = getSupabaseAdmin();
 *     const { data, error } = await supabase
 *       .from("your_table_name")
 *       .select("*")
 *       .order("created_at", { ascending: false });
 *     if (error) throw new Error(error.message);
 *     return { items: data ?? [] };
 *   }
 */
"use server";

// import { getSupabaseAdmin } from "@/core/supabase/admin";
`;

// ── data/data.js (Client Helpers) ─────────────────────────

const dataContent = `\
/**
 * Client Helpers — ${camel}.data.js
 *
 * Runs in the browser. Helper functions for your View.
 * NO database calls here — that belongs in ${camel}.actions.js.
 *
 * WHAT TO PUT HERE:
 *   - Constants (column definitions, tab lists, default values)
 *   - Form builders (createEmptyForm, createFormFromRow)
 *   - Normalizers (trimming strings, converting nulls)
 *   - Display mappers (DB row → table-friendly object)
 *   - Batch helpers (tracking pending creates/updates/deletes)
 */
`;

// ---------------------------------------------------------------------------
// 5. Write files
// ---------------------------------------------------------------------------

const files = [
  { rel: "index.js", content: indexContent },
  { rel: `pages/${pascal}Page.js`, content: pageContent },
  { rel: `pages/${pascal}View.jsx`, content: viewContent },
  { rel: `data/${camel}.actions.js`, content: actionsContent },
  { rel: `data/${camel}.data.js`, content: dataContent },
];

console.log(`\nCreating module: ${displayName}`);
console.log(`  Folder: ${path.relative(ROOT, moduleDir)}`);
console.log(`  Route:  ${routePath}\n`);

for (const file of files) {
  const filePath = path.join(moduleDir, file.rel);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, file.content, "utf-8");
  console.log(`  CREATE  ${path.relative(ROOT, filePath)}`);
}

// ---------------------------------------------------------------------------
// 6. Auto-generate route files
// ---------------------------------------------------------------------------

console.log(`\nRunning route generator...\n`);
execSync("node scripts/generate-routes.js", { cwd: ROOT, stdio: "inherit" });

console.log(`\nDone! Your module is ready at:`);
console.log(`  ${path.relative(ROOT, moduleDir)}/\n`);
console.log(`Next steps:`);
console.log(`  1. Open index.js — set module_key, icon, group_name, order`);
console.log(`  2. Add server actions in data/${camel}.actions.js`);
console.log(`  3. Build your UI in pages/${pascal}View.jsx`);
console.log(`  4. Run \`npm run dev\` and visit http://localhost:3000${routePath}\n`);
