"use client";

import { useCallback } from "react";
import { toastError, toastSuccess } from "@/shared/components/ui";
import {
  isSameId, normalizeText, mapDepartmentRow, removeObjectKey, mergeUpdatePatch, appendUniqueId,
  EMPTY_DIALOG, TEMP_DEPARTMENT_PREFIX, createTempId, isTempDepartmentId,
} from "../utils/companyDeptHelpers";

export function useDepartmentActions({
  isSaving, isMutatingAction, isSelectedCompanyPendingDeactivation,
  selectedCompany, dialog, departmentDraft, pendingDeactivatedDepartmentIds,
  setAllDepartments, setDepartmentChanges, setDialog, setDepartmentDraft,
}) {
  const openAddDepartmentDialog = useCallback(() => {
    if (isMutatingAction || isSaving) return;
    if (!selectedCompany?.comp_id) { toastError("Select a company before adding a department."); return; }
    if (isSelectedCompanyPendingDeactivation) { toastError("Selected company is staged for deactivation. Save or cancel company batch first."); return; }
    setDepartmentDraft({ name: "", shortName: "" });
    setDialog({ kind: "add-department", target: { comp_id: selectedCompany.comp_id, comp_name: selectedCompany.comp_name }, nextIsActive: true });
  }, [isMutatingAction, isSaving, isSelectedCompanyPendingDeactivation, selectedCompany?.comp_id, selectedCompany?.comp_name, setDepartmentDraft, setDialog]);

  const openEditDepartmentDialog = useCallback((row) => {
    if (isMutatingAction || isSaving) return;
    setDepartmentDraft({ name: String(row?.dept_name || ""), shortName: String(row?.dept_short_name || "") });
    setDialog({ kind: "edit-department", target: row, nextIsActive: null });
  }, [isMutatingAction, isSaving, setDepartmentDraft, setDialog]);

  const openToggleDepartmentDialog = useCallback((row) => {
    if (isMutatingAction || isSaving) return;
    const deptId = String(row?.dept_id ?? "");
    if (pendingDeactivatedDepartmentIds.has(deptId)) {
      setDepartmentChanges((prev) => ({
        ...prev,
        deactivations: (prev.deactivations || []).filter((id) => !isSameId(id, deptId)),
      }));
      toastSuccess("Department deactivation un-staged.", "Batching");
      return;
    }
    setDialog({ kind: "toggle-department", target: row, nextIsActive: !Boolean(row?.is_active_bool) });
  }, [isMutatingAction, isSaving, pendingDeactivatedDepartmentIds, setDepartmentChanges, setDialog]);

  const openDeactivateDepartmentDialog = useCallback((row) => {
    if (isMutatingAction || isSaving) return;
    setDialog({ kind: "deactivate-department", target: row, nextIsActive: null });
  }, [isMutatingAction, isSaving, setDialog]);

  const submitAddDepartment = useCallback(() => {
    const target = dialog?.target;
    if (!target?.comp_id) { toastError("Select a company before adding a department."); return; }
    const deptName = normalizeText(departmentDraft.name);
    if (!deptName) { toastError("Department name is required."); return; }
    const shortName = normalizeText(departmentDraft.shortName);
    const tempId = createTempId(TEMP_DEPARTMENT_PREFIX);

    setAllDepartments((prev) => [...prev, mapDepartmentRow({
      dept_id: tempId, comp_id: target.comp_id, dept_name: deptName, dept_short_name: shortName, is_active: true,
    }, prev.length)]);

    setDepartmentChanges((prev) => ({ ...prev, creates: [...prev.creates, {
      tempId, payload: { comp_id: target.comp_id, dept_name: deptName, dept_short_name: shortName, is_active: true },
    }]}));
    setDialog(EMPTY_DIALOG); setDepartmentDraft({ name: "", shortName: "" });
    toastSuccess("Department staged for Save Batch.", "Batching");
  }, [departmentDraft, dialog, setAllDepartments, setDepartmentChanges, setDepartmentDraft, setDialog]);

  const submitEditDepartment = useCallback(() => {
    const row = dialog?.target;
    if (!row?.dept_id) { toastError("Invalid department."); return; }
    const deptName = normalizeText(departmentDraft.name);
    if (!deptName) { toastError("Department name is required."); return; }
    const shortName = normalizeText(departmentDraft.shortName);
    const deptId = row.dept_id;

    setAllDepartments((prev) => prev.map((d, i) => isSameId(d?.dept_id, deptId)
      ? mapDepartmentRow({ ...d, dept_name: deptName, dept_short_name: shortName }, i) : d));

    setDepartmentChanges((prev) => {
      if (isTempDepartmentId(deptId)) {
        return { ...prev,
          creates: prev.creates.map((e) => isSameId(e?.tempId, deptId)
            ? { ...e, payload: { ...e.payload, dept_name: deptName, dept_short_name: shortName } } : e),
          updates: removeObjectKey(prev.updates, deptId),
        };
      }
      return { ...prev, updates: { ...prev.updates,
        [String(deptId)]: mergeUpdatePatch(prev.updates?.[String(deptId)], { dept_name: deptName, dept_short_name: shortName }),
      }};
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess("Department update staged for Save Batch.", "Batching");
  }, [departmentDraft, dialog, setAllDepartments, setDepartmentChanges, setDialog]);

  const submitToggleDepartment = useCallback(() => {
    const row = dialog?.target; const nextIsActive = Boolean(dialog?.nextIsActive);
    if (!row?.dept_id) { toastError("Invalid department."); return; }
    const deptId = row.dept_id;

    setAllDepartments((prev) => prev.map((d, i) => isSameId(d?.dept_id, deptId)
      ? mapDepartmentRow({ ...d, is_active: nextIsActive }, i) : d));

    setDepartmentChanges((prev) => {
      if (isTempDepartmentId(deptId)) {
        return { ...prev,
          creates: prev.creates.map((e) => isSameId(e?.tempId, deptId) ? { ...e, payload: { ...e.payload, is_active: nextIsActive } } : e),
          updates: removeObjectKey(prev.updates, deptId),
        };
      }
      return { ...prev, updates: { ...prev.updates,
        [String(deptId)]: mergeUpdatePatch(prev.updates?.[String(deptId)], { is_active: nextIsActive }),
      }};
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess(`Department ${nextIsActive ? "enable" : "disable"} staged for Save Batch.`, "Batching");
  }, [dialog, setAllDepartments, setDepartmentChanges, setDialog]);

  const submitDeactivateDepartment = useCallback(() => {
    const row = dialog?.target;
    if (!row?.dept_id) { toastError("Invalid department."); return; }
    const deptId = row.dept_id;

    if (isTempDepartmentId(deptId)) {
      setAllDepartments((prev) => prev.filter((d) => !isSameId(d?.dept_id, deptId)));
    }

    setDepartmentChanges((prev) => {
      if (isTempDepartmentId(deptId)) {
        return { ...prev,
          creates: prev.creates.filter((e) => !isSameId(e?.tempId, deptId)),
          updates: removeObjectKey(prev.updates, deptId),
          deactivations: (prev.deactivations || []).filter((id) => !isSameId(id, deptId)),
        };
      }
      return { ...prev, updates: removeObjectKey(prev.updates, deptId), deactivations: appendUniqueId(prev.deactivations, deptId) };
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess("Department deactivation staged for Save Batch.", "Batching");
  }, [dialog, setAllDepartments, setDepartmentChanges, setDialog]);

  const stageHardDeleteDepartment = useCallback((row) => {
    const deptId = String(row?.dept_id ?? "");
    if (!deptId || isMutatingAction || isSaving) return;

    if (isTempDepartmentId(deptId)) {
      setAllDepartments((prev) => prev.filter((d) => !isSameId(d?.dept_id, deptId)));
      setDepartmentChanges((prev) => ({
        ...prev,
        creates: prev.creates.filter((e) => !isSameId(e?.tempId, deptId)),
        updates: removeObjectKey(prev.updates, deptId),
      }));
      toastSuccess("Staged department removed.", "Batching");
      return;
    }

    setDepartmentChanges((prev) => ({
      ...prev,
      deactivations: (prev.deactivations || []).filter((id) => !isSameId(id, deptId)),
      updates: removeObjectKey(prev.updates, deptId),
      hardDeletes: appendUniqueId(prev.hardDeletes || [], deptId),
    }));
    toastSuccess("Department deletion staged for Save Batch.", "Batching");
  }, [isMutatingAction, isSaving, setAllDepartments, setDepartmentChanges]);

  return {
    openAddDepartmentDialog, openEditDepartmentDialog, openToggleDepartmentDialog, openDeactivateDepartmentDialog,
    submitAddDepartment, submitEditDepartment, submitToggleDepartment, submitDeactivateDepartment, stageHardDeleteDepartment,
  };
}
