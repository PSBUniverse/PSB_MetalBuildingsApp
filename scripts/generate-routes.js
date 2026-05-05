#!/usr/bin/env node

/**
 * generate-routes.js
 *
 * Scans every module index.js under src/modules/, reads route definitions,
 * and auto-generates thin page.js wrappers inside src/app/.
 *
 * Junior devs NEVER touch src/app/ — this script does it for them.
 *
 * Usage:  node scripts/generate-routes.js
 * Also runs automatically via:  npm run dev  /  npm run build
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.cwd());
const MODULES_DIR = path.join(ROOT, "src", "modules");
const APP_DIR = path.join(ROOT, "src", "app");

const GENERATED_MARKER = "// @generated — do not edit. Run `npm run gen:routes` to regenerate.";

// ---------------------------------------------------------------------------
// 1. Discover all module index.js files (recursive scan)
// ---------------------------------------------------------------------------

function findModuleIndexFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const indexPath = path.join(dir, entry.name, "index.js");
    if (fs.existsSync(indexPath)) {
      results.push(indexPath);
    } else {
      // Check sub-directories (e.g. admin/, psbpages/)
      results.push(...findModuleIndexFiles(path.join(dir, entry.name)));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// 2. Load module definition from index.js
// ---------------------------------------------------------------------------

async function loadModuleDefinition(indexPath) {
  const url = pathToFileURL(indexPath);
  url.searchParams.set("t", String(Date.now()));
  const mod = await import(url.href);
  return mod.default ?? mod;
}

// ---------------------------------------------------------------------------
// 3. Resolve the import path for the page component
// ---------------------------------------------------------------------------

function resolveImportAlias(indexPath, pageName) {
  // indexPath:  .../src/modules/admin/status-setup/index.js
  // We need:    @/modules/admin/status-setup/pages/StatusSetupPage
  const moduleDir = path.dirname(indexPath);
  const relFromSrc = path.relative(path.join(ROOT, "src"), moduleDir).replace(/\\/g, "/");
  return `@/${relFromSrc}/pages/${pageName}`;
}

// ---------------------------------------------------------------------------
// 4. Generate the thin page.js content
// ---------------------------------------------------------------------------

function generatePageContent(importPath, componentName) {
  return [
    GENERATED_MARKER,
    `import ${componentName} from "${importPath}";`,
    "",
    `export const dynamic = "force-dynamic";`,
    "",
    "export default function Page(props) {",
    `  return <${componentName} {...props} />;`,
    "}",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// 5. Write file only if content changed
// ---------------------------------------------------------------------------

function writeIfChanged(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf-8");
    // Only overwrite auto-generated files
    if (!existing.startsWith(GENERATED_MARKER)) {
      console.log(`  SKIP (manual) ${path.relative(ROOT, filePath)}`);
      return false;
    }
    if (existing === content) return false;
  }
  fs.writeFileSync(filePath, content, "utf-8");
  return true;
}

// ---------------------------------------------------------------------------
// 6. Clean up stale generated route files
// ---------------------------------------------------------------------------

function cleanStaleRoutes(generatedPaths) {
  const generatedSet = new Set(generatedPaths.map((p) => path.resolve(p)));

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === "page.js" && !generatedSet.has(path.resolve(full))) {
        // Check if it's a generated file we should clean up
        try {
          const content = fs.readFileSync(full, "utf-8");
          if (content.startsWith(GENERATED_MARKER)) {
            fs.unlinkSync(full);
            // Remove empty parent dirs
            let parent = path.dirname(full);
            while (parent !== APP_DIR) {
              const items = fs.readdirSync(parent);
              if (items.length === 0) {
                fs.rmdirSync(parent);
                parent = path.dirname(parent);
              } else {
                break;
              }
            }
            console.log(`  REMOVED stale ${path.relative(ROOT, full)}`);
          }
        } catch { /* ignore */ }
      }
    }
  }

  // Only walk known module route dirs (admin/, psbpages/), not root app files
  walk(path.join(APP_DIR, "admin"));
  walk(path.join(APP_DIR, "psbpages"));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Generating route files...\n");

  const indexFiles = findModuleIndexFiles(MODULES_DIR);
  const generatedPaths = [];
  let created = 0;
  let unchanged = 0;

  for (const indexPath of indexFiles) {
    let definition;
    try {
      definition = await loadModuleDefinition(indexPath);
    } catch (err) {
      console.log(`  ERROR loading ${path.relative(ROOT, indexPath)}: ${err.message}`);
      continue;
    }

    if (!definition?.routes || !Array.isArray(definition.routes)) continue;

    for (const route of definition.routes) {
      if (!route.path || !route.page) continue;

      // route.path = "/admin/status-setup" → app dir = src/app/admin/status-setup/page.js
      const routeDir = path.join(APP_DIR, ...route.path.split("/").filter(Boolean));
      const pageFile = path.join(routeDir, "page.js");

      // Component name from page filename (e.g. "data-table/DataTablePage" → "DataTablePage")
      const pageName = route.page.split("/").pop();
      const importPath = resolveImportAlias(indexPath, route.page);
      const content = generatePageContent(importPath, pageName);

      generatedPaths.push(pageFile);

      if (writeIfChanged(pageFile, content)) {
        console.log(`  WRITE ${path.relative(ROOT, pageFile)}`);
        created++;
      } else {
        unchanged++;
      }
    }
  }

  cleanStaleRoutes(generatedPaths);

  console.log(`\nDone. ${created} written, ${unchanged} unchanged.\n`);
}

main().catch((err) => {
  console.error("Route generation failed:", err);
  process.exit(1);
});
