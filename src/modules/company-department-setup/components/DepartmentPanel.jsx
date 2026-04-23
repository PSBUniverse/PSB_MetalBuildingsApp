import { useMemo } from "react";
import { Badge, Card, InlineEditCell, TableZ } from "@/shared/components/ui";

function StatusBadge({ isActive }) {
  return <Badge bg={isActive ? "success" : "danger"} text="light">{isActive ? "Active" : "Inactive"}</Badge>;
}

function batchMarker(bs) {
  const map = {
    deleted: { t: "Deactivated", c: "psb-batch-marker psb-batch-marker-deleted" },
    created: { t: "New", c: "psb-batch-marker psb-batch-marker-new" },
    updated: { t: "Edited", c: "psb-batch-marker psb-batch-marker-edited" },
  };
  return map[bs] || { t: "", c: "" };
}

export function DepartmentPanel({
  selectedCompany, decoratedDepartments, isSaving, isMutatingAction,
  pendingDeactivatedDepartmentIds,
  editingDeptId, onStartEditing, onStopEditing, onInlineEdit,
  openToggleDepartmentDialog, openDeactivateDepartmentDialog,
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
            disabled={editDisabled}
          />
        );
      },
    },
    {
      key: "is_active_bool", label: "Active", width: "22%", sortable: true, align: "center",
      render: (row) => <StatusBadge isActive={Boolean(row?.is_active_bool)} />,
    },
  ], [editingDeptId, isMutatingAction, isSaving, onInlineEdit]);

  const actions = useMemo(() => [
    { key: "edit-department", label: "Edit", type: "secondary", icon: "pencil-square",
      visible: (r) => String(r?.dept_id ?? "") !== String(editingDeptId ?? ""),
      disabled: (r) => isSaving || isMutatingAction || pendingDeactivatedDepartmentIds.has(String(r?.dept_id ?? "")),
      onClick: (r) => onStartEditing(r) },
    { key: "done-edit-department", label: "Done", type: "success", icon: "check-circle",
      visible: (r) => String(r?.dept_id ?? "") === String(editingDeptId ?? ""),
      onClick: () => onStopEditing() },
    { key: "disable-department", label: "Disable", type: "secondary", icon: "slash-circle",
      visible: (r) => Boolean(r?.is_active_bool),
      disabled: (r) => isSaving || isMutatingAction || pendingDeactivatedDepartmentIds.has(String(r?.dept_id ?? "")),
      onClick: (r) => openToggleDepartmentDialog(r) },
    { key: "enable-department", label: "Enable", type: "secondary", icon: "check-circle",
      visible: (r) => !Boolean(r?.is_active_bool),
      disabled: (r) => isSaving || isMutatingAction || pendingDeactivatedDepartmentIds.has(String(r?.dept_id ?? "")),
      onClick: (r) => openToggleDepartmentDialog(r) },
    { key: "deactivate-department", label: "Deactivate", type: "danger", icon: "trash",
      disabled: (r) => isSaving || isMutatingAction || pendingDeactivatedDepartmentIds.has(String(r?.dept_id ?? "")),
      onClick: (r) => openDeactivateDepartmentDialog(r) },
  ], [editingDeptId, isMutatingAction, isSaving, onStartEditing, onStopEditing,
    openDeactivateDepartmentDialog, openToggleDepartmentDialog, pendingDeactivatedDepartmentIds]);

  return (
    <Card
      title={selectedCompany ? `Departments for: ${selectedCompany.comp_name}` : "Departments"}
      subtitle={selectedCompany ? "Company-scoped departments" : "Click a company row to view its departments."}
    >
      {selectedCompany ? (
        <TableZ columns={columns} data={decoratedDepartments} rowIdKey="dept_id"
          actions={actions} emptyMessage="No departments found for this company." />
      ) : (
        <div className="notice-banner notice-banner-info mb-0">Click a company row to view its departments.</div>
      )}
    </Card>
  );
}
