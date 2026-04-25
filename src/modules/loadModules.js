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

  // Raw file URL imports are cached by Node. Bust cache in dev so module edits appear immediately.
  if (process.env.NODE_ENV !== "production") {
    moduleUrl.searchParams.set("t", String(Date.now()));
  }

  return moduleUrl;
}

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
        // Check if the directory contains sub-modules (e.g. admin/)
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

      moduleDefinition._importPage = createPageImporter(modulePath);

      seenModuleKeys.add(moduleKey);
      modules.push(moduleDefinition);
    }
  }

  await scanDirectory(modulesDir, entries);

  return modules;
}
