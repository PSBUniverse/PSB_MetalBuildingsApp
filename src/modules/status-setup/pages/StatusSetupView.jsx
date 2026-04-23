"use client";

import { useStatusSetup } from "../hooks/useStatusSetup";
import { StatusHeader } from "../components/StatusHeader";
import { StatusTable } from "../components/StatusTable";
import { StatusDialog } from "../components/StatusDialog";

export default function StatusSetupView({ statuses }) {
  const hook = useStatusSetup({ statuses });

  return (
    <main className="container py-4">
      <StatusHeader
        hasPendingChanges={hook.hasPendingChanges}
        pendingSummary={hook.pendingSummary}
        isSavingBatch={hook.isSavingBatch}
        isMutatingAction={hook.isMutatingAction}
        handleSaveBatch={hook.handleSaveBatch}
        handleCancelBatch={hook.handleCancelBatch}
        openAddStatusDialog={hook.openAddStatusDialog}
      />

      <StatusTable
        decoratedStatuses={hook.decoratedStatuses}
        isMutatingAction={hook.isMutatingAction}
        isSavingBatch={hook.isSavingBatch}
        pendingDeactivatedStatusIds={hook.pendingDeactivatedStatusIds}
        editingStatusId={hook.editingStatusId}
        onStartEditing={hook.startEditingStatus}
        onStopEditing={hook.stopEditingStatus}
        onInlineEdit={hook.handleInlineEdit}
        openToggleStatusDialog={hook.openToggleStatusDialog}
        openDeactivateStatusDialog={hook.openDeactivateStatusDialog}
      />

      <StatusDialog
        dialog={hook.dialog}
        statusDraft={hook.statusDraft}
        isMutatingAction={hook.isMutatingAction}
        isSavingBatch={hook.isSavingBatch}
        setStatusDraft={hook.setStatusDraft}
        closeDialog={hook.closeDialog}
        submitAddStatus={hook.submitAddStatus}
        submitEditStatus={hook.submitEditStatus}
        submitToggleStatus={hook.submitToggleStatus}
        submitDeactivateStatus={hook.submitDeactivateStatus}
      />
    </main>
  );
}
