import { notFound } from "next/navigation";
import { loadModules } from "@/modules/loadModules";
import ModuleAccessGate from "@/core/auth/ModuleAccessGate";

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
