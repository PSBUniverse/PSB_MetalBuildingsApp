import { useMemo } from "react";
import { Badge, Card, InlineEditCell, TableZ } from "@/shared/components/ui";

function StatusBadge({ isActive }) {
  return <Badge bg={isActive ? "success" : "danger"} text="light">{isActive ? "Active" : "Inactive"}</Badge>;
}

function batchMarker(batchState) {
  if (batchState === "deleted") return { text: "Deactivated", cls: "psb-batch-marker psb-batch-marker-deleted" };
  if (batchState === "created") return { text: "New", cls: "psb-batch-marker psb-batch-marker-new" };
  if (batchState === "updated") return { text: "Edited", cls: "psb-batch-marker psb-batch-marker-edited" };
  return { text: "", cls: "" };
}

export function RolePanel({
  selectedApp, decoratedSelectedAppRoles, isSavingOrder, isMutatingAction,
  pendingDeactivatedRoleIds, editingRoleId, onStartEditing, onStopEditing, onInlineEdit,
  openToggleRoleDialog, openDeactivateRoleDialog,
}) {
  const columns = useMemo(() => [
    {
      key: "role_name", label: "Role Name", width: "30%", sortable: true,
      render: (row) => {
        const m = batchMarker(row?.__batchState || "");
        const isEditing = String(row?.role_id ?? "") === String(editingRoleId ?? "");
        const editDisabled = !isEditing || isSavingOrder || isMutatingAction;
        return (
          <span>
            <InlineEditCell
              value={row?.role_name || ""}
              onCommit={(val) => onInlineEdit?.(row, "role_name", val)}
              disabled={editDisabled}
            />
            {m.text ? <span className={m.cls}>{m.text}</span> : null}
          </span>
        );
      },
    },
    {
      key: "role_desc", label: "Description", width: "44%", sortable: true,
      render: (row) => {
        const isEditing = String(row?.role_id ?? "") === String(editingRoleId ?? "");
        const editDisabled = !isEditing || isSavingOrder || isMutatingAction;
        return (
          <InlineEditCell
            value={row?.role_desc || ""}
            onCommit={(val) => onInlineEdit?.(row, "role_desc", val)}
            disabled={editDisabled}
          />
        );
      },
    },
    {
      key: "is_active_bool", label: "Active", width: "16%", sortable: true, align: "center",
      render: (row) => <StatusBadge isActive={Boolean(row?.is_active_bool)} />,
    },
  ], [editingRoleId, isMutatingAction, isSavingOrder, onInlineEdit]);

  const actions = useMemo(() => [
    {
      key: "edit-role", label: "Edit", type: "secondary", icon: "pencil-square",
      visible: (r) => String(r?.role_id ?? "") !== String(editingRoleId ?? ""),
      disabled: (r) => isSavingOrder || isMutatingAction || pendingDeactivatedRoleIds.has(String(r?.role_id ?? "")),
      onClick: (r) => onStartEditing(r),
    },
    {
      key: "done-edit-role", label: "Done", type: "success", icon: "check-circle",
      visible: (r) => String(r?.role_id ?? "") === String(editingRoleId ?? ""),
      onClick: () => onStopEditing(),
    },
    {
      key: "disable-role", label: "Disable", type: "secondary", icon: "slash-circle",
      visible: (r) => Boolean(r?.is_active_bool),
      disabled: (r) => isSavingOrder || isMutatingAction || pendingDeactivatedRoleIds.has(String(r?.role_id ?? "")),
      onClick: (r) => openToggleRoleDialog(r),
    },
    {
      key: "enable-role", label: "Enable", type: "secondary", icon: "check-circle",
      visible: (r) => !Boolean(r?.is_active_bool),
      disabled: (r) => isSavingOrder || isMutatingAction || pendingDeactivatedRoleIds.has(String(r?.role_id ?? "")),
      onClick: (r) => openToggleRoleDialog(r),
    },
    {
      key: "deactivate-role", label: "Deactivate", type: "danger", icon: "trash",
      disabled: (r) => isSavingOrder || isMutatingAction || pendingDeactivatedRoleIds.has(String(r?.role_id ?? "")),
      onClick: (r) => openDeactivateRoleDialog(r),
    },
  ], [editingRoleId, isMutatingAction, isSavingOrder, onStartEditing, onStopEditing,
    openDeactivateRoleDialog, openToggleRoleDialog, pendingDeactivatedRoleIds]);

  return (
    <Card
      title={selectedApp ? `Roles for: ${selectedApp.app_name}` : "Roles"}
      subtitle={selectedApp ? "Application-scoped roles" : "Click an application row to view its roles."}
    >
      {selectedApp ? (
        <TableZ
          columns={columns} data={decoratedSelectedAppRoles} rowIdKey="role_id"
          actions={actions} emptyMessage="No roles assigned to this application."
        />
      ) : (
        <div className="notice-banner notice-banner-info mb-0">Click an application row to view its roles.</div>
      )}
    </Card>
  );
}
