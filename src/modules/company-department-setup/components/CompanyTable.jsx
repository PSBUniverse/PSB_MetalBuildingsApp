import { useMemo } from "react";
import { Badge, Card, InlineEditCell, TableZ } from "@/shared/components/ui";
import { isSameId } from "../utils/companyDeptHelpers";

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

export function CompanyTable({
  decoratedCompanies, selectedCompany, isSaving, isMutatingAction,
  pendingDeactivatedCompanyIds, handleCompanyRowClick,
  editingCompanyId, onStartEditing, onStopEditing, onInlineEdit,
  openToggleCompanyDialog, openDeactivateCompanyDialog,
}) {
  const columns = useMemo(() => [
    {
      key: "comp_name", label: "Company Name", width: "26%", sortable: true,
      render: (row) => {
        const m = batchMarker(row?.__batchState || "");
        const isEditing = String(row?.comp_id ?? "") === String(editingCompanyId ?? "");
        const editDisabled = !isEditing || isSaving || isMutatingAction;
        const isSelected = isSameId(row?.comp_id, selectedCompany?.comp_id);
        return (
          <span className={isSelected ? "fw-semibold text-primary" : ""}>
            <InlineEditCell
              value={row?.comp_name || ""}
              onCommit={(val) => onInlineEdit?.(row, "comp_name", val)}
              disabled={editDisabled}
            />
            {m.t ? <span className={m.c}>{m.t}</span> : null}
          </span>
        );
      },
    },
    {
      key: "comp_short_name", label: "Short Name", width: "18%", sortable: true,
      render: (row) => {
        const isEditing = String(row?.comp_id ?? "") === String(editingCompanyId ?? "");
        const editDisabled = !isEditing || isSaving || isMutatingAction;
        return (
          <InlineEditCell
            value={row?.comp_short_name || ""}
            onCommit={(val) => onInlineEdit?.(row, "comp_short_name", val)}
            disabled={editDisabled}
          />
        );
      },
    },
    {
      key: "comp_email", label: "Email", width: "26%", sortable: true,
      render: (row) => {
        const isEditing = String(row?.comp_id ?? "") === String(editingCompanyId ?? "");
        const editDisabled = !isEditing || isSaving || isMutatingAction;
        return (
          <InlineEditCell
            value={row?.comp_email || ""}
            onCommit={(val) => onInlineEdit?.(row, "comp_email", val)}
            disabled={editDisabled}
          />
        );
      },
    },
    {
      key: "comp_phone", label: "Phone", width: "18%", sortable: true,
      render: (row) => {
        const isEditing = String(row?.comp_id ?? "") === String(editingCompanyId ?? "");
        const editDisabled = !isEditing || isSaving || isMutatingAction;
        return (
          <InlineEditCell
            value={row?.comp_phone || ""}
            onCommit={(val) => onInlineEdit?.(row, "comp_phone", val)}
            disabled={editDisabled}
          />
        );
      },
    },
    {
      key: "is_active_bool", label: "Active", width: "12%", sortable: true, align: "center",
      render: (row) => <StatusBadge isActive={Boolean(row?.is_active_bool)} />,
    },
  ], [editingCompanyId, isMutatingAction, isSaving, onInlineEdit, selectedCompany?.comp_id]);

  const actions = useMemo(() => [
    { key: "edit-company", label: "Edit", type: "secondary", icon: "pencil-square",
      visible: (r) => String(r?.comp_id ?? "") !== String(editingCompanyId ?? ""),
      disabled: (r) => isSaving || isMutatingAction || pendingDeactivatedCompanyIds.has(String(r?.comp_id ?? "")),
      onClick: (r) => onStartEditing(r) },
    { key: "done-edit-company", label: "Done", type: "success", icon: "check-circle",
      visible: (r) => String(r?.comp_id ?? "") === String(editingCompanyId ?? ""),
      onClick: () => onStopEditing() },
    { key: "disable-company", label: "Disable", type: "secondary", icon: "slash-circle",
      visible: (r) => Boolean(r?.is_active_bool),
      disabled: (r) => isSaving || isMutatingAction || pendingDeactivatedCompanyIds.has(String(r?.comp_id ?? "")),
      onClick: (r) => openToggleCompanyDialog(r) },
    { key: "enable-company", label: "Enable", type: "secondary", icon: "check-circle",
      visible: (r) => !Boolean(r?.is_active_bool),
      disabled: (r) => isSaving || isMutatingAction || pendingDeactivatedCompanyIds.has(String(r?.comp_id ?? "")),
      onClick: (r) => openToggleCompanyDialog(r) },
    { key: "deactivate-company", label: "Deactivate", type: "danger", icon: "trash",
      disabled: (r) => isSaving || isMutatingAction || pendingDeactivatedCompanyIds.has(String(r?.comp_id ?? "")),
      onClick: (r) => openDeactivateCompanyDialog(r) },
  ], [editingCompanyId, isMutatingAction, isSaving, onStartEditing, onStopEditing,
    openDeactivateCompanyDialog, openToggleCompanyDialog, pendingDeactivatedCompanyIds]);

  return (
    <Card title="Companies" subtitle="Master company records.">
      <TableZ columns={columns} data={decoratedCompanies} rowIdKey="comp_id"
        selectedRowId={selectedCompany?.comp_id ?? null} onRowClick={handleCompanyRowClick}
        actions={actions} emptyMessage="No companies found." />
    </Card>
  );
}
