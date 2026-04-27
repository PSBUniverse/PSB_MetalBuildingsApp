import CardModuleSetupView from "../view/CardModuleSetupView";
import { loadCardModuleSetupData, loadApplications } from "../hooks/cardModuleSetupData.js";

function parseAppId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : String(value);
}

export const dynamic = "force-dynamic";

export default async function CardModuleSetupPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;

  try {
    const [viewModel, applications] = await Promise.all([
      loadCardModuleSetupData(),
      loadApplications(),
    ]);

    const cardGroups = Array.isArray(viewModel?.cardGroups) ? viewModel.cardGroups : [];
    const cards = Array.isArray(viewModel?.cards) ? viewModel.cards : [];

    const initialSelectedAppId =
      parseAppId(resolvedSearchParams?.app)
      ?? applications[0]?.app_id
      ?? null;

    return (
      <CardModuleSetupView
        applications={applications}
        cardGroups={cardGroups}
        cards={cards}
        initialSelectedAppId={initialSelectedAppId}
      />
    );
  } catch (error) {
    return (
      <main className="container py-4">
        <div className="notice-banner notice-banner-danger mb-0">
          <strong className="d-block">Failed to load card module setup.</strong>
          <span>{error?.message || "Unknown error"}</span>
        </div>
      </main>
    );
  }
}
