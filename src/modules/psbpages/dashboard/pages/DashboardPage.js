import { loadModules } from "@/modules/loadModules";
import DashboardModules from "@/core/auth/DashboardModules";
import { normalizeRoutePath } from "../utils/dashboardHelpers";
import { loadAssignedCardsFromDatabase, loadAssignedAppsFromDatabase } from "../utils/dashboardData";

export default async function DashboardPage() {
  const setupCards = await loadAssignedCardsFromDatabase();

  if (setupCards.length > 0) {
    return <DashboardModules modules={setupCards} />;
  }

  const modules = await loadModules();

  let moduleCards = (Array.isArray(modules) ? modules : [])
    .filter((moduleDefinition) => moduleDefinition?.key && moduleDefinition?.app_id)
    .map((moduleDefinition) => ({
      key: moduleDefinition.key,
      name: moduleDefinition.name || moduleDefinition.key,
      description: moduleDefinition.description || "Open module.",
      path: normalizeRoutePath(moduleDefinition.routes?.[0]?.path || "#"),
      appId: moduleDefinition.app_id,
      icon: moduleDefinition.icon || moduleDefinition.group_icon || "bi-grid-3x3-gap",
      groupName: moduleDefinition.group_name || moduleDefinition.group || "Applications",
      groupDescription: moduleDefinition.group_desc || "",
      groupIcon: moduleDefinition.group_icon || "bi-collection",
      order: Number(moduleDefinition.order ?? moduleDefinition.display_order ?? Number.MAX_SAFE_INTEGER),
    }))
    .sort((left, right) => left.order - right.order);

  if (moduleCards.length === 0) {
    const assignedAppCards = await loadAssignedAppsFromDatabase();
    if (assignedAppCards.length > 0) {
      moduleCards = assignedAppCards;
    }
  }

  return <DashboardModules modules={moduleCards} />;
}
