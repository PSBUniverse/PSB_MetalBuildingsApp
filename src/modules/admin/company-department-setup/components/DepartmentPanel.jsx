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
  };
  return map[bs] || { t: "", c: "" };
}

export function DepartmentPanel({
  selectedCompany, decoratedDepartments, isSaving, isMutatingAction,
  pendingDeactivatedDepartmentIds, pendingHardDeletedDepartmentIds,
  editingDeptId, onStartEditing, onStopEditing, onInlineEdit,
  openToggleDepartmentDialog, openDeactivateDepartmentDialog, stageHardDeleteDepartment, onUndoBatchAction,
}) {
  const columns = useMemo(() => [
    {
      key: "dept_name", label: "Department Name", width: "48%", sortable: true,
      render: (row) => {
        const m = batchMarker(row?.__batchState || "");
        const isEditing = String(row?.dept_id ?? "") === String(editingDeptId ?? "");
        const editDisabled = !isEditing || isSaving || isMutatingAction;
        return (
          <span>
            <InlineEditCell
              value={row?.dept_name || ""}
              onCommit={(val) => onInlineEdit?.(row, "dept_name", val)}
              onCancel={onStopEditing}
              disabled={editDisabled}
            />
            {m.t ? <span className={m.c}>{m.t}</span> : null}
          </span>
        );
      },
    },
    {
      key: "dept_short_name", label: "Short Name", width: "30%", sortable: true,
      render: (row) => {
        const isEditing = String(row?.dept_id ?? "") === String(editingDeptId ?? "");
        const editDisabled = !isEditing || isSaving || isMutatingAction;
        return (
          <InlineEditCell
            value={row?.dept_short_name || ""}
            onCommit={(val) => onInlineEdit?.(row, "dept_short_name", val)}
            onCancel={onStopEditing}
            disabled={editDisabled}
          />
        );
      },
    },
    {
      key: "is_active_bool", label: "Active", width: "22%", sortable: true, align: "center",
      render: (row) => <StatusBadge isActive={Boolean(row?.is_active_bool)} />,
    },
  ], [editingDeptId, isMutatingAction, isSaving, onInlineEdit, onStopEditing]);

  const actions = useMemo(() => [
    { key: "edit-department", label: "Edit", type: "secondary", icon: "pen",
      visible: (r) => String(r?.dept_id ?? "") !== String(editingDeptId ?? ""),
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => onStartEditing(r) },
    { key: "cancel-edit-department", label: "Cancel", type: "secondary", icon: "xmark",
      visible: (r) => String(r?.dept_id ?? "") === String(editingDeptId ?? ""),
      onClick: () => onStopEditing() },
    { key: "restore-department", label: "Restore", type: "secondary", icon: "rotate-left",
      visible: (r) => (!Boolean(r?.is_active_bool) || pendingDeactivatedDepartmentIds.has(String(r?.dept_id ?? ""))) && String(r?.dept_id ?? "") !== String(editingDeptId ?? ""),
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => openToggleDepartmentDialog(r) },
    { key: "deactivate-department", label: "Deactivate", type: "secondary", icon: "ban",
      visible: (r) => Boolean(r?.is_active_bool) && !pendingDeactivatedDepartmentIds.has(String(r?.dept_id ?? "")) && String(r?.dept_id ?? "") !== String(editingDeptId ?? ""),
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => openDeactivateDepartmentDialog(r) },
    { key: "delete-department", label: "Delete", type: "danger", icon: "trash",
      visible: (r) => String(r?.dept_id ?? "") !== String(editingDeptId ?? ""),
      confirm: true,
      confirmMessage: (r) => `Permanently delete ${r?.dept_name || "this department"}? This action cannot be undone.`,
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => stageHardDeleteDepartment(r) },
  ], [editingDeptId, isMutatingAction, isSaving, onStartEditing, onStopEditing,
    openDeactivateDepartmentDialog, openToggleDepartmentDialog, pendingDeactivatedDepartmentIds, stageHardDeleteDepartment]);

  return (
    <Card
      title={selectedCompany ? `Departments for: ${selectedCompany.comp_name}` : "Departments"}
      subtitle={selectedCompany ? "Company-scoped departments" : "Click a company row to view its departments."}
    >
      {selectedCompany ? (
        <TableZ columns={columns} data={decoratedDepartments} rowIdKey="dept_id"
          actions={actions} emptyMessage="No departments found for this company."
          onUndoBatchAction={onUndoBatchAction} />
      ) : (
        <div className="notice-banner notice-banner-info mb-0">Click a company row to view its departments.</div>
      )}
    </Card>
  );
}
