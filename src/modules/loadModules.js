import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function loadModules() {
  const modulesDir = path.join(process.cwd(), "modules");

  let entries = [];

  try {
    entries = await fs.readdir(modulesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const modules = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const modulePath = path.join(modulesDir, entry.name, "src", "index.js");

    try {
      await fs.access(modulePath);
    } catch {
      continue;
    }

    const importedModule = await import(/* webpackIgnore: true */ pathToFileURL(modulePath).href);
    const moduleDefinition = importedModule.default ?? importedModule;
    modules.push(moduleDefinition);
  }

  return modules;
}
