import { useMemo } from "react";
import { Badge, Card, InlineEditCell, TableZ } from "@/shared/components/ui";
import { isSameId } from "../utils/applicationHelpers";

function StatusBadge({ isActive }) {
  return <Badge bg={isActive ? "success" : "danger"} text="light">{isActive ? "Active" : "Inactive"}</Badge>;
}

function batchMarker(batchState) {
  if (batchState === "deleted") return { text: "Deactivated", cls: "psb-batch-marker psb-batch-marker-deleted" };
  if (batchState === "created") return { text: "New", cls: "psb-batch-marker psb-batch-marker-new" };
  if (batchState === "updated") return { text: "Edited", cls: "psb-batch-marker psb-batch-marker-edited" };
  return { text: "", cls: "" };
}

export function ApplicationTable({
  decoratedApplications, selectedApp, isSavingOrder, isMutatingAction,
  pendingDeactivatedAppIds, handleApplicationRowClick, handleApplicationReorder,
  editingAppId, onStartEditing, onStopEditing, onInlineEdit,
  openToggleApplicationDialog, openDeactivateApplicationDialog,
}) {
  const columns = useMemo(() => [
    {
      key: "app_name", label: "Application Name", width: "30%", sortable: true,
      render: (row) => {
        const m = batchMarker(row?.__batchState || "");
        const isEditing = String(row?.app_id ?? "") === String(editingAppId ?? "");
        const editDisabled = !isEditing || isSavingOrder || isMutatingAction;
        const isSelected = isSameId(row?.app_id, selectedApp?.app_id);
        return (
          <span className={isSelected ? "fw-semibold text-primary" : ""}>
            <InlineEditCell
              value={row?.app_name || ""}
              onCommit={(val) => onInlineEdit?.(row, "app_name", val)}
              disabled={editDisabled}
            />
            {m.text ? <span className={m.cls}>{m.text}</span> : null}
          </span>
        );
      },
    },
    { key: "app_order", label: "Order", width: "10%", sortable: true, align: "center" },
    {
      key: "app_desc", label: "Description", width: "38%", sortable: true,
      render: (row) => {
        const isEditing = String(row?.app_id ?? "") === String(editingAppId ?? "");
        const editDisabled = !isEditing || isSavingOrder || isMutatingAction;
        return (
          <InlineEditCell
            value={row?.app_desc || ""}
            onCommit={(val) => onInlineEdit?.(row, "app_desc", val)}
            disabled={editDisabled}
          />
        );
      },
    },
    {
      key: "is_active_bool", label: "Active", width: "12%", sortable: true, align: "center",
      render: (row) => <StatusBadge isActive={Boolean(row?.is_active_bool)} />,
    },
  ], [editingAppId, isMutatingAction, isSavingOrder, onInlineEdit, selectedApp?.app_id]);

  const actions = useMemo(() => [
    {
      key: "edit-application", label: "Edit", type: "secondary", icon: "pencil-square",
      visible: (r) => String(r?.app_id ?? "") !== String(editingAppId ?? ""),
      disabled: (r) => isSavingOrder || isMutatingAction || pendingDeactivatedAppIds.has(String(r?.app_id ?? "")),
      onClick: (r) => onStartEditing(r),
    },
    {
      key: "done-edit-application", label: "Done", type: "success", icon: "check-circle",
      visible: (r) => String(r?.app_id ?? "") === String(editingAppId ?? ""),
      onClick: () => onStopEditing(),
    },
    {
      key: "disable-application", label: "Disable", type: "secondary", icon: "slash-circle",
      visible: (r) => Boolean(r?.is_active_bool),
      disabled: (r) => isSavingOrder || isMutatingAction || pendingDeactivatedAppIds.has(String(r?.app_id ?? "")),
      onClick: (r) => openToggleApplicationDialog(r),
    },
    {
      key: "enable-application", label: "Enable", type: "secondary", icon: "check-circle",
      visible: (r) => !Boolean(r?.is_active_bool),
      disabled: (r) => isSavingOrder || isMutatingAction || pendingDeactivatedAppIds.has(String(r?.app_id ?? "")),
      onClick: (r) => openToggleApplicationDialog(r),
    },
    {
      key: "deactivate-application", label: "Deactivate", type: "danger", icon: "trash",
      disabled: (r) => isSavingOrder || isMutatingAction || pendingDeactivatedAppIds.has(String(r?.app_id ?? "")),
      onClick: (r) => openDeactivateApplicationDialog(r),
    },
  ], [editingAppId, isMutatingAction, isSavingOrder, onStartEditing, onStopEditing,
    openDeactivateApplicationDialog, openToggleApplicationDialog, pendingDeactivatedAppIds]);

  return (
    <Card title="Applications" subtitle="Drag the grip icon in Actions to reorder applications.">
      <TableZ
        columns={columns} data={decoratedApplications} rowIdKey="app_id"
        selectedRowId={selectedApp?.app_id ?? null} onRowClick={handleApplicationRowClick}
        actions={actions} draggable={!isSavingOrder && !isMutatingAction}
        onReorder={handleApplicationReorder} emptyMessage="No applications found."
      />
    </Card>
  );
}
