import CompanyDepartmentSetupView from "../view/CompanyDepartmentSetupView";
import { loadCompanyDepartmentSetupData } from "../hooks/companyDepartmentSetupData.js";

function parseCompanyId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : String(value);
}

export default async function CompanyDepartmentSetupPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;

  try {
    const viewModel = await loadCompanyDepartmentSetupData();
    const companies = Array.isArray(viewModel?.companies) ? viewModel.companies : [];
    const departments = Array.isArray(viewModel?.departments) ? viewModel.departments : [];

    const initialSelectedCompanyId =
      parseCompanyId(resolvedSearchParams?.company)
      ?? companies[0]?.comp_id
      ?? null;

    return (
      <CompanyDepartmentSetupView
        companies={companies}
        departments={departments}
        initialSelectedCompanyId={initialSelectedCompanyId}
      />
    );
  } catch (error) {
    return (
      <main className="container py-4">
        <div className="notice-banner notice-banner-danger mb-0">
          <strong className="d-block">Failed to load company-department setup.</strong>
          <span>{error?.message || "Unknown error"}</span>
        </div>
      </main>
    );
  }
}
