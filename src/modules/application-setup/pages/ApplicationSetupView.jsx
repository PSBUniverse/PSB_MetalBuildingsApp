"use client";

import { useApplicationSetup } from "../hooks/useApplicationSetup";
import { ApplicationHeader } from "../components/ApplicationHeader";
import { ApplicationTable } from "../components/ApplicationTable";
import { RolePanel } from "../components/RolePanel";
import { ApplicationDialog } from "../components/ApplicationDialog";

export default function ApplicationSetupView({ applications, roles, initialSelectedAppId }) {
  const h = useApplicationSetup({ applications, roles, initialSelectedAppId });

  return (
    <main className="container py-4">
      <ApplicationHeader
        hasPendingChanges={h.hasPendingChanges} pendingSummary={h.pendingSummary}
        isSavingOrder={h.isSavingOrder} isMutatingAction={h.isMutatingAction}
        isSelectedAppPendingDeactivation={h.isSelectedAppPendingDeactivation} selectedApp={h.selectedApp}
        handleSaveOrderChanges={h.handleSaveOrderChanges} handleCancelOrderChanges={h.handleCancelOrderChanges}
        openAddApplicationDialog={h.openAddApplicationDialog} openAddRoleDialog={h.openAddRoleDialog}
      />

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-6">
          <ApplicationTable
            decoratedApplications={h.decoratedApplications} selectedApp={h.selectedApp}
            isSavingOrder={h.isSavingOrder} isMutatingAction={h.isMutatingAction}
            pendingDeactivatedAppIds={h.pendingDeactivatedAppIds}
            handleApplicationRowClick={h.handleApplicationRowClick}
            handleApplicationReorder={h.handleApplicationReorder}
            editingAppId={h.editingAppId}
            onStartEditing={h.startEditingApp}
            onStopEditing={h.stopEditingApp}
            onInlineEdit={h.handleInlineEditApplication}
            openToggleApplicationDialog={h.openToggleApplicationDialog}
            openDeactivateApplicationDialog={h.openDeactivateApplicationDialog}
          />
        </div>
        <div className="col-12 col-xl-6">
          <RolePanel
            selectedApp={h.selectedApp} decoratedSelectedAppRoles={h.decoratedSelectedAppRoles}
            isSavingOrder={h.isSavingOrder} isMutatingAction={h.isMutatingAction}
            pendingDeactivatedRoleIds={h.pendingDeactivatedRoleIds}
            editingRoleId={h.editingRoleId}
            onStartEditing={h.startEditingRole}
            onStopEditing={h.stopEditingRole}
            onInlineEdit={h.handleInlineEditRole}
            openToggleRoleDialog={h.openToggleRoleDialog}
            openDeactivateRoleDialog={h.openDeactivateRoleDialog}
          />
        </div>
      </div>

      <ApplicationDialog
        dialog={h.dialog} applicationDraft={h.applicationDraft} roleDraft={h.roleDraft}
        isMutatingAction={h.isMutatingAction}
        setApplicationDraft={h.setApplicationDraft} setRoleDraft={h.setRoleDraft}
        closeDialog={h.closeDialog}
        submitAddApplication={h.submitAddApplication} submitEditApplication={h.submitEditApplication}
        submitToggleApplication={h.submitToggleApplication} submitDeactivateApplication={h.submitDeactivateApplication}
        submitEditRole={h.submitEditRole} submitToggleRole={h.submitToggleRole}
        submitDeactivateRole={h.submitDeactivateRole} submitAddRole={h.submitAddRole}
      />
    </main>
  );
}
