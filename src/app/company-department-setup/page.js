import ModuleAccessGate from "@/core/auth/ModuleAccessGate";
import CompanyDepartmentSetupClient from "./CompanyDepartmentSetupClient";
import { loadCompanyDepartmentSetupData } from "@/modules/company-department-setup/hooks/companyDepartmentSetupData.js";

function parseCompanyId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const asNumber = Number(value);

  if (Number.isFinite(asNumber)) {
    return asNumber;
  }

  return String(value);
}

const appIdFromEnv = Number(process.env.COMPANY_DEPARTMENT_SETUP_APP_ID);
const companyDepartmentSetupAppId = Number.isFinite(appIdFromEnv) ? appIdFromEnv : 1;

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
      <ModuleAccessGate appId={companyDepartmentSetupAppId}>
        <CompanyDepartmentSetupClient
          companies={companies}
          departments={departments}
          initialSelectedCompanyId={initialSelectedCompanyId}
        />
      </ModuleAccessGate>
    );
  } catch (error) {
    return (
      <ModuleAccessGate appId={companyDepartmentSetupAppId}>
        <main className="container py-4">
          <div className="notice-banner notice-banner-danger mb-0">
            <strong className="d-block">Failed to load company-department setup.</strong>
            <span>{error?.message || "Unknown error"}</span>
          </div>
        </main>
      </ModuleAccessGate>
    );
  }
}
