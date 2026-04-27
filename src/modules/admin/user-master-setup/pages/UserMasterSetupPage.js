import UserMasterSetupView from "../view/UserMasterSetupView";
import { loadUserMasterSetupData } from "../hooks/useUserMasterSetupData.js";

export const dynamic = "force-dynamic";

export default async function UserMasterSetupPage() {
  try {
    const viewModel = await loadUserMasterSetupData();
    const users = Array.isArray(viewModel?.users) ? viewModel.users : [];
    const totalUsers = Number.isFinite(Number(viewModel?.totalUsers))
      ? Number(viewModel.totalUsers)
      : users.length;

    return <UserMasterSetupView users={users} totalUsers={totalUsers} />;
  } catch (error) {
    return (
      <main className="container py-4">
        <div className="notice-banner notice-banner-danger mb-0">
          <strong className="d-block">Failed to load user master setup.</strong>
          <span>{error?.message || "Unknown error"}</span>
        </div>
      </main>
    );
  }
}
