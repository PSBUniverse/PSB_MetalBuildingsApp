import DashboardPage from "./pages/DashboardPage.js";

const appIdFromEnv = Number(process.env.COMPANY_DEPARTMENT_SETUP_APP_ID);
const appId = Number.isFinite(appIdFromEnv) ? appIdFromEnv : 1;

const companyDepartmentSetupModule = {
  key: "company-department-setup",
  app_id: appId,
  name: "Company Department Setup",
  description: "Configure companies and company-linked departments.",
  icon: "bi-diagram-3",
  group_name: "Administration",
  group_desc: "Tools for organization setup and management.",
  order: 120,
  routes: [
    { path: "/company-department-setup", component: DashboardPage },
  ],
};

export default companyDepartmentSetupModule;
