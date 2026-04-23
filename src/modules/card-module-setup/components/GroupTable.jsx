import { useMemo } from "react";
import { Badge, Card, InlineEditCell, TableZ } from "@/shared/components/ui";
import { isSameId } from "../utils/cardModuleHelpers";

function StatusBadge({ isActive }) {
  return <Badge bg={isActive ? "success" : "danger"} text="light">{isActive ? "Active" : "Inactive"}</Badge>;
}

function batchMarker(bs) {
  const map = {
    deleted: { t: "Deactivated", c: "psb-batch-marker psb-batch-marker-deleted" },
    created: { t: "New", c: "psb-batch-marker psb-batch-marker-new" },
    updated: { t: "Edited", c: "psb-batch-marker psb-batch-marker-edited" },
    reordered: { t: "Reordered", c: "psb-batch-marker psb-batch-marker-reordered" },
  };
  return map[bs] || { t: "", c: "" };
}

export function GroupTable({
  decoratedGroups, selectedGroup, isSaving, isMutatingAction,
  pendingDeactivatedGroupIds, handleGroupRowClick, handleGroupReorder,
  editingGroupId, onStartEditing, onStopEditing, onInlineEdit,
  openToggleGroupDialog, openDeactivateGroupDialog,
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
  ], [editingGroupId, isMutatingAction, isSaving, onInlineEdit, selectedGroup?.group_id]);

  const actions = useMemo(() => [
    { key: "edit-group", label: "Edit", type: "secondary", icon: "pencil-square",
      visible: (r) => String(r?.group_id ?? "") !== String(editingGroupId ?? ""),
      disabled: (r) => isSaving || isMutatingAction || pendingDeactivatedGroupIds.has(String(r?.group_id ?? "")),
      onClick: (r) => onStartEditing(r) },
    { key: "done-edit-group", label: "Done", type: "success", icon: "check-circle",
      visible: (r) => String(r?.group_id ?? "") === String(editingGroupId ?? ""),
      onClick: () => onStopEditing() },
    { key: "disable-group", label: "Disable", type: "secondary", icon: "slash-circle",
      visible: (r) => Boolean(r?.is_active_bool),
      disabled: (r) => isSaving || isMutatingAction || pendingDeactivatedGroupIds.has(String(r?.group_id ?? "")),
      onClick: (r) => openToggleGroupDialog(r) },
    { key: "enable-group", label: "Enable", type: "secondary", icon: "check-circle",
      visible: (r) => !Boolean(r?.is_active_bool),
      disabled: (r) => isSaving || isMutatingAction || pendingDeactivatedGroupIds.has(String(r?.group_id ?? "")),
      onClick: (r) => openToggleGroupDialog(r) },
    { key: "deactivate-group", label: "Deactivate", type: "danger", icon: "trash",
      disabled: (r) => isSaving || isMutatingAction || pendingDeactivatedGroupIds.has(String(r?.group_id ?? "")),
      onClick: (r) => openDeactivateGroupDialog(r) },
  ], [editingGroupId, isMutatingAction, isSaving, onStartEditing, onStopEditing,
    openDeactivateGroupDialog, openToggleGroupDialog, pendingDeactivatedGroupIds]);

  return (
    <Card title="Card Groups" subtitle="Drag the grip icon in Actions to reorder groups.">
      <TableZ columns={columns} data={decoratedGroups} rowIdKey="group_id"
        selectedRowId={selectedGroup?.group_id ?? null} onRowClick={handleGroupRowClick}
        actions={actions} draggable={!isSaving && !isMutatingAction}
        onReorder={handleGroupReorder} emptyMessage="No card groups found for this application." />
    </Card>
  );
}
