import { useMemo } from "react";
import { Badge, Card, InlineEditCell, TableZ } from "@/shared/components/ui";
import { isSameId } from "../utils/companyDeptHelpers";

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

export function CompanyTable({
  decoratedCompanies, selectedCompany, isSaving, isMutatingAction,
  pendingDeactivatedCompanyIds, pendingHardDeletedCompanyIds, handleCompanyRowClick,
  editingCompanyId, onStartEditing, onStopEditing, onInlineEdit,
  openToggleCompanyDialog, openDeactivateCompanyDialog, stageHardDeleteCompany, onUndoBatchAction,
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
              onCancel={onStopEditing}
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
            onCancel={onStopEditing}
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
            onCancel={onStopEditing}
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
            onCancel={onStopEditing}
            disabled={editDisabled}
          />
        );
      },
    },
    {
      key: "is_active_bool", label: "Active", width: "12%", sortable: true, align: "center",
      render: (row) => <StatusBadge isActive={Boolean(row?.is_active_bool)} />,
    },
  ], [editingCompanyId, isMutatingAction, isSaving, onInlineEdit, onStopEditing, selectedCompany?.comp_id]);

  const actions = useMemo(() => [
    { key: "edit-company", label: "Edit", type: "secondary", icon: "pen",
      visible: (r) => String(r?.comp_id ?? "") !== String(editingCompanyId ?? ""),
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => onStartEditing(r) },
    { key: "cancel-edit-company", label: "Cancel", type: "secondary", icon: "xmark",
      visible: (r) => String(r?.comp_id ?? "") === String(editingCompanyId ?? ""),
      onClick: () => onStopEditing() },
    { key: "restore-company", label: "Restore", type: "secondary", icon: "rotate-left",
      visible: (r) => (!Boolean(r?.is_active_bool) || pendingDeactivatedCompanyIds.has(String(r?.comp_id ?? ""))) && String(r?.comp_id ?? "") !== String(editingCompanyId ?? ""),
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => openToggleCompanyDialog(r) },
    { key: "deactivate-company", label: "Deactivate", type: "secondary", icon: "ban",
      visible: (r) => Boolean(r?.is_active_bool) && !pendingDeactivatedCompanyIds.has(String(r?.comp_id ?? "")) && String(r?.comp_id ?? "") !== String(editingCompanyId ?? ""),
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => openDeactivateCompanyDialog(r) },
    { key: "delete-company", label: "Delete", type: "danger", icon: "trash",
      visible: (r) => String(r?.comp_id ?? "") !== String(editingCompanyId ?? ""),
      confirm: true,
      confirmMessage: (r) => `Permanently delete ${r?.comp_name || "this company"}? This action cannot be undone.`,
      disabled: (r) => isSaving || isMutatingAction,
      onClick: (r) => stageHardDeleteCompany(r) },
  ], [editingCompanyId, isMutatingAction, isSaving, onStartEditing, onStopEditing,
    openDeactivateCompanyDialog, openToggleCompanyDialog, pendingDeactivatedCompanyIds, stageHardDeleteCompany]);

  return (
    <Card title="Companies" subtitle="Master company records.">
      <TableZ columns={columns} data={decoratedCompanies} rowIdKey="comp_id"
        selectedRowId={selectedCompany?.comp_id ?? null} onRowClick={handleCompanyRowClick}
        actions={actions} emptyMessage="No companies found."
        onUndoBatchAction={onUndoBatchAction} />
    </Card>
  );
}
