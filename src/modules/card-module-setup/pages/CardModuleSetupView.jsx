"use client";

import { useCardModuleSetup } from "../hooks/useCardModuleSetup";
import { CardModuleHeader } from "../components/GroupHeader";
import { GroupTable } from "../components/GroupTable";
import { CardPanel } from "../components/CardPanel";
import { CardModuleDialog } from "../components/CardModuleDialog";

export default function CardModuleSetupView({ applications, cardGroups, cards, initialSelectedAppId }) {
  const h = useCardModuleSetup({ applications, cardGroups, cards, initialSelectedAppId });

  return (
    <main className="container py-4">
      <CardModuleHeader
        safeApplications={h.safeApplications} selectedApp={h.selectedApp}
        hasPendingChanges={h.hasPendingChanges} pendingSummary={h.pendingSummary}
        isSaving={h.isSaving} isMutatingAction={h.isMutatingAction}
        isSelectedGroupPendingDeactivation={h.isSelectedGroupPendingDeactivation}
        selectedGroup={h.selectedGroup}
        handleSaveBatch={h.handleSaveBatch} handleCancelBatch={h.handleCancelBatch}
        handleApplicationChange={h.handleApplicationChange}
        openAddGroupDialog={h.openAddGroupDialog} openAddCardDialog={h.openAddCardDialog}
      />

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-5">
          <GroupTable
            decoratedGroups={h.decoratedGroups} selectedGroup={h.selectedGroup}
            isSaving={h.isSaving} isMutatingAction={h.isMutatingAction}
            pendingDeactivatedGroupIds={h.pendingDeactivatedGroupIds}
            handleGroupRowClick={h.handleGroupRowClick} handleGroupReorder={h.handleGroupReorder}
            editingGroupId={h.editingGroupId}
            onStartEditing={h.startEditingGroup}
            onStopEditing={h.stopEditingGroup}
            onInlineEdit={h.handleInlineEditGroup}
            openToggleGroupDialog={h.openToggleGroupDialog}
            openDeactivateGroupDialog={h.openDeactivateGroupDialog}
          />
        </div>
        <div className="col-12 col-xl-7">
          <CardPanel
            selectedGroup={h.selectedGroup} decoratedSelectedGroupCards={h.decoratedSelectedGroupCards}
            isSaving={h.isSaving} isMutatingAction={h.isMutatingAction}
            pendingDeactivatedCardIds={h.pendingDeactivatedCardIds}
            handleCardReorder={h.handleCardReorder}
            editingCardId={h.editingCardId}
            onStartEditing={h.startEditingCard}
            onStopEditing={h.stopEditingCard}
            onInlineEdit={h.handleInlineEditCard}
            openToggleCardDialog={h.openToggleCardDialog}
            openDeactivateCardDialog={h.openDeactivateCardDialog}
          />
        </div>
      </div>

      <CardModuleDialog
        dialog={h.dialog} groupDraft={h.groupDraft} cardDraft={h.cardDraft}
        isMutatingAction={h.isMutatingAction}
        setGroupDraft={h.setGroupDraft} setCardDraft={h.setCardDraft} closeDialog={h.closeDialog}
        submitAddGroup={h.submitAddGroup} submitEditGroup={h.submitEditGroup}
        submitToggleGroup={h.submitToggleGroup} submitDeactivateGroup={h.submitDeactivateGroup}
        submitAddCard={h.submitAddCard} submitEditCard={h.submitEditCard}
        submitToggleCard={h.submitToggleCard} submitDeactivateCard={h.submitDeactivateCard}
      />
    </main>
  );
}
