import UserMasterSetupView from "./UserMasterSetupView";
import { loadUserMasterSetupData } from "../data/userMasterSetup.actions.js";

export const dynamic = "force-dynamic";

export default async function UserMasterSetupPage() {
  try {
    const { users, totalUsers } = await loadUserMasterSetupData();

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
