import { useMemo } from "react";
import { Badge, Card, InlineEditCell, TableZ } from "@/shared/components/ui";

function StatusBadge({ isActive }) {
  return <Badge bg={isActive ? "success" : "danger"} text="light">{isActive ? "Active" : "Inactive"}</Badge>;
}

function batchMarker(bs) {
  const map = {
    hardDeleted: { t: "Deleted", c: "psb-batch-marker psb-batch-marker-deleted" },
    deleted: { t: "Deactivated", c: "psb-batch-marker psb-batch-marker-deleted" },
    created: { t: "New", c: "psb-batch-marker psb-batch-marker-new" },
    updated: { t: "Edited", c: "psb-batch-marker psb-batch-marker-edited" },
    reordered: { t: "Reordered", c: "psb-batch-marker psb-batch-marker-reordered" },
  };
  return map[bs] || { t: "", c: "" };
}

export function CardPanel({
  selectedGroup, decoratedSelectedGroupCards, isSaving, isMutatingAction,
  pendingDeactivatedCardIds, pendingHardDeletedCardIds, handleCardReorder,
  editingCardId, onStartEditing, onStopEditing, onInlineEdit,
  openToggleCardDialog, openDeactivateCardDialog, stageHardDeleteCard, onUndoBatchAction,
}) {
  const columns = useMemo(() => [
    {
      key: "display_order", label: "Order", width: "8%", sortable: true, align: "center",
      render: (row) => {
        const prev = row?.__previousOrder;
        return (
          <span>
            {row?.display_order ?? "--"}
            {prev != null ? <> <span className="psb-batch-marker psb-batch-marker-edited">was {prev}</span></> : null}
          </span>
        );
      },
    },
    {
      key: "card_name", label: "Card Name", width: "25%", sortable: true,
      render: (row) => {
        const m = batchMarker(row?.__batchState || "");
        const isEditing = String(row?.card_id ?? "") === String(editingCardId ?? "");
        const editDisabled = !isEditing || isSaving || isMutatingAction;
        return (
          <span>
            <InlineEditCell
              value={row?.card_name || ""}
              onCommit={(val) => onInlineEdit?.(row, "card_name", val)}
              onCancel={onStopEditing}
              disabled={editDisabled}
            />
            {m.t ? <span className={m.c}>{m.t}</span> : null}
          </span>
        );
      },
    },
    {
      key: "card_desc", label: "Description", width: "20%", sortable: true, defaultVisible: false,
      render: (row) => {
        const isEditing = String(row?.card_id ?? "") === String(editingCardId ?? "");
        const editDisabled = !isEditing || isSaving || isMutatingAction;
        return (
          <InlineEditCell
            value={row?.card_desc || ""}
            onCommit={(val) => onInlineEdit?.(row, "card_desc", val)}
            onCancel={onStopEditing}
            disabled={editDisabled}
          />
        );
      },
    },
    {
      key: "route_path", label: "Route", width: "25%", sortable: true,
      render: (row) => {
        const isEditing = String(row?.card_id ?? "") === String(editingCardId ?? "");
        const editDisabled = !isEditing || isSaving || isMutatingAction;
        return (
          <InlineEditCell
            value={row?.route_path || ""}
            onCommit={(val) => onInlineEdit?.(row, "route_path", val)}
            onCancel={onStopEditing}
            disabled={editDisabled}
            placeholder="#"
          />
        );
      },
    },
    {
      key: "card_icon", label: "Icon", width: "10%", sortable: false, align: "center", defaultVisible: false,
      render: (row) => {
        const isEditing = String(row?.card_id ?? "") === String(editingCardId ?? "");
        const editDisabled = !isEditing || isSaving || isMutatingAction;
        return (
          <InlineEditCell
            value={row?.card_icon || row?.icon || ""}
            onCommit={(val) => onInlineEdit?.(row, "icon", val)}
            onCancel={onStopEditing}
            disabled={editDisabled}
            placeholder="bi-grid-3x3-gap"
          />
        );
      },
    },
    {
      key: "is_active_bool", label: "Active", width: "12%", sortable: true, align: "center",
      render: (row) => <StatusBadge isActive={Boolean(row?.is_active_bool)} />,
    },
  ], [editingCardId, isMutatingAction, isSaving, onInlineEdit, onStopEditing]);

  const actions = useMemo(() => [
    { key: "edit-card", label: "Edit", type: "secondary", icon: "pen",
      visible: (r) => String(r?.card_id ?? "") !== String(editingCardId ?? ""),
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => onStartEditing(r) },
    { key: "cancel-edit-card", label: "Cancel", type: "secondary", icon: "xmark",
      visible: (r) => String(r?.card_id ?? "") === String(editingCardId ?? ""),
      onClick: () => onStopEditing() },
    { key: "restore-card", label: "Restore", type: "secondary", icon: "rotate-left",
      visible: (r) => (!Boolean(r?.is_active_bool) || pendingDeactivatedCardIds.has(String(r?.card_id ?? ""))) && String(r?.card_id ?? "") !== String(editingCardId ?? ""),
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => openToggleCardDialog(r) },
    { key: "deactivate-card", label: "Deactivate", type: "secondary", icon: "ban",
      visible: (r) => Boolean(r?.is_active_bool) && !pendingDeactivatedCardIds.has(String(r?.card_id ?? "")) && String(r?.card_id ?? "") !== String(editingCardId ?? ""),
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => openDeactivateCardDialog(r) },
    { key: "delete-card", label: "Delete", type: "danger", icon: "trash",
      visible: (r) => String(r?.card_id ?? "") !== String(editingCardId ?? ""),
      confirm: true,
      confirmMessage: (r) => `Permanently delete ${r?.card_name || "this card"}? This action cannot be undone.`,
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => stageHardDeleteCard(r) },
  ], [editingCardId, isMutatingAction, isSaving, onStartEditing, onStopEditing,
    openDeactivateCardDialog, openToggleCardDialog, pendingDeactivatedCardIds, stageHardDeleteCard]);

  return (
    <Card
      title={selectedGroup ? `Cards for: ${selectedGroup.group_name}` : "Cards"}
      subtitle={selectedGroup ? "Drag rows to reorder cards within the group" : "Click a card group row to view its cards."}
    >
      {selectedGroup ? (
        <TableZ columns={columns} data={decoratedSelectedGroupCards} rowIdKey="card_id"
          actions={actions} emptyMessage="No cards assigned to this group."
          draggable={!isSaving && !isMutatingAction} onReorder={handleCardReorder}
          onUndoBatchAction={onUndoBatchAction} />
      ) : (
        <div className="notice-banner notice-banner-info mb-0">Click a card group row to view its cards.</div>
      )}
    </Card>
  );
}
