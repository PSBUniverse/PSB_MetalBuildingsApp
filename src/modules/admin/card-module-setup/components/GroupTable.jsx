import { useMemo } from "react";
import { Badge, Card, InlineEditCell, TableZ } from "@/shared/components/ui";
import { isSameId } from "../utils/cardModuleHelpers";

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

export function GroupTable({
  decoratedGroups, selectedGroup, isSaving, isMutatingAction,
  pendingDeactivatedGroupIds, pendingHardDeletedGroupIds, handleGroupRowClick, handleGroupReorder,
  editingGroupId, onStartEditing, onStopEditing, onInlineEdit,
  openToggleGroupDialog, openDeactivateGroupDialog, stageHardDeleteGroup,
}) {
  const columns = useMemo(() => [
    {
      key: "display_order", label: "Order", width: "10%", sortable: true, align: "center",
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
      key: "group_name", label: "Group Name", width: "35%", sortable: true,
      render: (row) => {
        const m = batchMarker(row?.__batchState || "");
        const isEditing = String(row?.group_id ?? "") === String(editingGroupId ?? "");
        const editDisabled = !isEditing || isSaving || isMutatingAction;
        const isSelected = isSameId(row?.group_id, selectedGroup?.group_id);
        return (
          <span className={isSelected ? "fw-semibold text-primary" : ""}>
            <InlineEditCell
              value={row?.group_name || ""}
              onCommit={(val) => onInlineEdit?.(row, "group_name", val)}
              onCancel={onStopEditing}
              disabled={editDisabled}
            />
            {m.t ? <span className={m.c}>{m.t}</span> : null}
          </span>
        );
      },
    },
    {
      key: "group_desc", label: "Description", width: "28%", sortable: true,
      render: (row) => {
        const isEditing = String(row?.group_id ?? "") === String(editingGroupId ?? "");
        const editDisabled = !isEditing || isSaving || isMutatingAction;
        return (
          <InlineEditCell
            value={row?.group_desc || ""}
            onCommit={(val) => onInlineEdit?.(row, "group_desc", val)}
            onCancel={onStopEditing}
            disabled={editDisabled}
          />
        );
      },
    },
    {
      key: "group_icon", label: "Icon", width: "12%", sortable: false, align: "center", defaultVisible: false,
      render: (row) => {
        const isEditing = String(row?.group_id ?? "") === String(editingGroupId ?? "");
        const editDisabled = !isEditing || isSaving || isMutatingAction;
        return (
          <InlineEditCell
            value={row?.group_icon || row?.icon || ""}
            onCommit={(val) => onInlineEdit?.(row, "icon", val)}
            onCancel={onStopEditing}
            disabled={editDisabled}
            placeholder="bi-collection"
          />
        );
      },
    },
    {
      key: "is_active_bool", label: "Active", width: "10%", sortable: true, align: "center",
      render: (row) => <StatusBadge isActive={Boolean(row?.is_active_bool)} />,
    },
  ], [editingGroupId, isMutatingAction, isSaving, onInlineEdit, onStopEditing, selectedGroup?.group_id]);

  const actions = useMemo(() => [
    { key: "edit-group", label: "Edit", type: "secondary", icon: "pen",
      visible: (r) => r?.__batchState !== "hardDeleted" && String(r?.group_id ?? "") !== String(editingGroupId ?? ""),
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => onStartEditing(r) },
    { key: "cancel-edit-group", label: "Cancel", type: "secondary", icon: "xmark",
      visible: (r) => String(r?.group_id ?? "") === String(editingGroupId ?? ""),
      onClick: () => onStopEditing() },
    { key: "restore-group", label: "Restore", type: "secondary", icon: "rotate-left",
      visible: (r) => r?.__batchState !== "hardDeleted" && (!Boolean(r?.is_active_bool) || pendingDeactivatedGroupIds.has(String(r?.group_id ?? ""))) && String(r?.group_id ?? "") !== String(editingGroupId ?? ""),
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => openToggleGroupDialog(r) },
    { key: "deactivate-group", label: "Deactivate", type: "secondary", icon: "ban",
      visible: (r) => r?.__batchState !== "hardDeleted" && Boolean(r?.is_active_bool) && !pendingDeactivatedGroupIds.has(String(r?.group_id ?? "")) && String(r?.group_id ?? "") !== String(editingGroupId ?? ""),
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => openDeactivateGroupDialog(r) },
    { key: "delete-group", label: "Delete", type: "danger", icon: "trash",
      visible: (r) => r?.__batchState !== "hardDeleted" && String(r?.group_id ?? "") !== String(editingGroupId ?? ""),
      confirm: true,
      confirmMessage: (r) => `Permanently delete ${r?.group_name || "this group"}? This action cannot be undone.`,
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => stageHardDeleteGroup(r) },
  ], [editingGroupId, isMutatingAction, isSaving, onStartEditing, onStopEditing,
    openDeactivateGroupDialog, openToggleGroupDialog, pendingDeactivatedGroupIds, stageHardDeleteGroup]);

  return (
    <Card title="Card Groups" subtitle="Drag the grip icon in Actions to reorder groups.">
      <TableZ columns={columns} data={decoratedGroups} rowIdKey="group_id"
        selectedRowId={selectedGroup?.group_id ?? null} onRowClick={handleGroupRowClick}
        actions={actions} draggable={!isSaving && !isMutatingAction}
        onReorder={handleGroupReorder} emptyMessage="No card groups found for this application." />
    </Card>
  );
}
