"use client";

import { useCallback } from "react";
import { toastError, toastSuccess } from "@/shared/components/ui";
import {
  isSameId, normalizeText, mapCompanyRow, removeObjectKey, mergeUpdatePatch, appendUniqueId,
  EMPTY_DIALOG, TEMP_COMPANY_PREFIX, createTempId, isTempCompanyId, isTempDepartmentId,
} from "../utils/companyDeptHelpers";

export function useCompanyActions({
  isSaving, isMutatingAction, selectedCompany, allDepartments, orderedCompanies,
  dialog, companyDraft, pendingDeactivatedCompanyIds,
  setOrderedCompanies, setAllDepartments, setCompanyChanges, setDepartmentChanges,
  setDialog, setCompanyDraft, updateSelectedCompanyInQuery,
}) {
  const openAddCompanyDialog = useCallback(() => {
    if (isMutatingAction || isSaving) return;
    setCompanyDraft({ name: "", shortName: "", email: "", phone: "" });
    setDialog({ kind: "add-company", target: null, nextIsActive: true });
  }, [isMutatingAction, isSaving, setCompanyDraft, setDialog]);

  const openEditCompanyDialog = useCallback((row) => {
    if (isMutatingAction || isSaving) return;
    setCompanyDraft({
      name: String(row?.comp_name || ""), shortName: String(row?.comp_short_name || ""),
      email: String(row?.comp_email || ""), phone: String(row?.comp_phone || ""),
    });
    setDialog({ kind: "edit-company", target: row, nextIsActive: null });
  }, [isMutatingAction, isSaving, setCompanyDraft, setDialog]);

  const openToggleCompanyDialog = useCallback((row) => {
    if (isMutatingAction || isSaving) return;
    const companyId = String(row?.comp_id ?? "");
    if (pendingDeactivatedCompanyIds.has(companyId)) {
      const linkedDeptIds = allDepartments.filter((d) => isSameId(d?.comp_id, companyId)).map((d) => String(d?.dept_id ?? ""));
      setCompanyChanges((prev) => ({
        ...prev,
        deactivations: (prev.deactivations || []).filter((id) => !isSameId(id, companyId)),
      }));
      setDepartmentChanges((prev) => ({
        ...prev,
        deactivations: (prev.deactivations || []).filter((id) => !linkedDeptIds.some((lr) => isSameId(lr, id))),
      }));
      toastSuccess("Company deactivation un-staged.", "Batching");
      return;
    }
    setDialog({ kind: "toggle-company", target: row, nextIsActive: !Boolean(row?.is_active_bool) });
  }, [allDepartments, isMutatingAction, isSaving, pendingDeactivatedCompanyIds, setCompanyChanges, setDepartmentChanges, setDialog]);

  const openDeactivateCompanyDialog = useCallback((row) => {
    if (isMutatingAction || isSaving) return;
    setDialog({ kind: "deactivate-company", target: row, nextIsActive: null });
  }, [isMutatingAction, isSaving, setDialog]);

  const submitAddCompany = useCallback(() => {
    const companyName = normalizeText(companyDraft.name);
    if (!companyName) { toastError("Company name is required."); return; }
    const shortName = normalizeText(companyDraft.shortName);
    const email = normalizeText(companyDraft.email);
    const phone = normalizeText(companyDraft.phone);
    const tempId = createTempId(TEMP_COMPANY_PREFIX);

    setOrderedCompanies((prev) => [...prev, mapCompanyRow({
      comp_id: tempId, comp_name: companyName, comp_short_name: shortName,
      comp_email: email, comp_phone: phone, is_active: true,
    }, prev.length)]);

    setCompanyChanges((prev) => ({ ...prev, creates: [...prev.creates, {
      tempId, payload: { comp_name: companyName, comp_short_name: shortName, comp_email: email, comp_phone: phone, is_active: true },
    }]}));

    updateSelectedCompanyInQuery(tempId);
    setDialog(EMPTY_DIALOG); setCompanyDraft({ name: "", shortName: "", email: "", phone: "" });
    toastSuccess("Company staged for Save Batch.", "Batching");
  }, [companyDraft, setCompanyChanges, setCompanyDraft, setDialog, setOrderedCompanies, updateSelectedCompanyInQuery]);

  const submitEditCompany = useCallback(() => {
    const row = dialog?.target;
    if (!row?.comp_id) { toastError("Invalid company."); return; }
    const companyName = normalizeText(companyDraft.name);
    if (!companyName) { toastError("Company name is required."); return; }
    const shortName = normalizeText(companyDraft.shortName);
    const email = normalizeText(companyDraft.email);
    const phone = normalizeText(companyDraft.phone);
    const companyId = row.comp_id;

    setOrderedCompanies((prev) => prev.map((c, i) => isSameId(c?.comp_id, companyId)
      ? mapCompanyRow({ ...c, comp_name: companyName, comp_short_name: shortName, comp_email: email, comp_phone: phone }, i) : c));

    setCompanyChanges((prev) => {
      if (isTempCompanyId(companyId)) {
        return { ...prev,
          creates: prev.creates.map((e) => isSameId(e?.tempId, companyId)
            ? { ...e, payload: { ...e.payload, comp_name: companyName, comp_short_name: shortName, comp_email: email, comp_phone: phone } } : e),
          updates: removeObjectKey(prev.updates, companyId),
        };
      }
      return { ...prev, updates: { ...prev.updates,
        [String(companyId)]: mergeUpdatePatch(prev.updates?.[String(companyId)], { comp_name: companyName, comp_short_name: shortName, comp_email: email, comp_phone: phone }),
      }};
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess("Company update staged for Save Batch.", "Batching");
  }, [companyDraft, dialog, setCompanyChanges, setDialog, setOrderedCompanies]);

  const submitToggleCompany = useCallback(() => {
    const row = dialog?.target; const nextIsActive = Boolean(dialog?.nextIsActive);
    if (!row?.comp_id) { toastError("Invalid company."); return; }
    const companyId = row.comp_id;

    setOrderedCompanies((prev) => prev.map((c, i) => isSameId(c?.comp_id, companyId)
      ? mapCompanyRow({ ...c, is_active: nextIsActive }, i) : c));

    setCompanyChanges((prev) => {
      if (isTempCompanyId(companyId)) {
        return { ...prev,
          creates: prev.creates.map((e) => isSameId(e?.tempId, companyId) ? { ...e, payload: { ...e.payload, is_active: nextIsActive } } : e),
          updates: removeObjectKey(prev.updates, companyId),
        };
      }
      return { ...prev, updates: { ...prev.updates,
        [String(companyId)]: mergeUpdatePatch(prev.updates?.[String(companyId)], { is_active: nextIsActive }),
      }};
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess(`Company ${nextIsActive ? "enable" : "disable"} staged for Save Batch.`, "Batching");
  }, [dialog, setCompanyChanges, setDialog, setOrderedCompanies]);

  const submitDeactivateCompany = useCallback(() => {
    const row = dialog?.target;
    if (!row?.comp_id) { toastError("Invalid company."); return; }
    const companyId = row.comp_id;
    const linkedDeptIds = allDepartments.filter((d) => isSameId(d?.comp_id, companyId)).map((d) => String(d?.dept_id ?? ""));

    if (isTempCompanyId(companyId)) {
      const nextCompanies = orderedCompanies.filter((c) => !isSameId(c?.comp_id, companyId));
      setOrderedCompanies(nextCompanies);
      setAllDepartments((prev) => prev.filter((d) => !isSameId(d?.comp_id, companyId)));
      setCompanyChanges((prev) => ({
        ...prev,
        creates: prev.creates.filter((e) => !isSameId(e?.tempId, companyId)),
        updates: removeObjectKey(prev.updates, companyId),
        deactivations: (prev.deactivations || []).filter((id) => !isSameId(id, companyId)),
      }));
      setDepartmentChanges((prev) => ({
        creates: prev.creates.filter((e) => !isSameId(e?.payload?.comp_id, companyId)),
        updates: linkedDeptIds.reduce((m, id) => removeObjectKey(m, id), prev.updates),
        deactivations: (prev.deactivations || []).filter((id) => !linkedDeptIds.some((lr) => isSameId(lr, id))),
      }));
      if (isSameId(selectedCompany?.comp_id, companyId)) updateSelectedCompanyInQuery(nextCompanies[0]?.comp_id ?? null);
      setDialog(EMPTY_DIALOG); toastSuccess("Company deactivation staged for Save Batch.", "Batching"); return;
    }

    setCompanyChanges((prev) => ({
      ...prev, updates: removeObjectKey(prev.updates, companyId),
      deactivations: appendUniqueId(prev.deactivations, companyId),
    }));
    setDepartmentChanges((prev) => ({
      creates: prev.creates.filter((e) => !isSameId(e?.payload?.comp_id, companyId)),
      updates: linkedDeptIds.reduce((m, id) => removeObjectKey(m, id), prev.updates),
      deactivations: linkedDeptIds.reduce((ids, id) => appendUniqueId(ids, id), prev.deactivations || []),
    }));
    setDialog(EMPTY_DIALOG); toastSuccess("Company deactivation staged for Save Batch.", "Batching");
  }, [allDepartments, dialog, orderedCompanies, selectedCompany?.comp_id, setAllDepartments, setCompanyChanges, setDepartmentChanges, setDialog, setOrderedCompanies, updateSelectedCompanyInQuery]);

  const stageHardDeleteCompany = useCallback((row) => {
    const companyId = String(row?.comp_id ?? "");
    if (!companyId || isMutatingAction || isSaving) return;
    const linkedDeptIds = allDepartments.filter((d) => isSameId(d?.comp_id, companyId)).map((d) => String(d?.dept_id ?? ""));

    if (isTempCompanyId(companyId)) {
      const nextCompanies = orderedCompanies.filter((c) => !isSameId(c?.comp_id, companyId));
      setOrderedCompanies(nextCompanies);
      setAllDepartments((prev) => prev.filter((d) => !isSameId(d?.comp_id, companyId)));
      setCompanyChanges((prev) => ({
        ...prev,
        creates: prev.creates.filter((e) => !isSameId(e?.tempId, companyId)),
        updates: removeObjectKey(prev.updates, companyId),
      }));
      setDepartmentChanges((prev) => ({
        ...prev,
        creates: prev.creates.filter((e) => !isSameId(e?.payload?.comp_id, companyId)),
        updates: linkedDeptIds.reduce((m, id) => removeObjectKey(m, id), prev.updates),
        deactivations: (prev.deactivations || []).filter((id) => !linkedDeptIds.some((lr) => isSameId(lr, id))),
        hardDeletes: (prev.hardDeletes || []).filter((id) => !linkedDeptIds.some((lr) => isSameId(lr, id))),
      }));
      if (isSameId(selectedCompany?.comp_id, companyId)) updateSelectedCompanyInQuery(nextCompanies[0]?.comp_id ?? null);
      toastSuccess("Staged company removed.", "Batching");
      return;
    }

    setCompanyChanges((prev) => ({
      ...prev,
      updates: removeObjectKey(prev.updates, companyId),
      deactivations: (prev.deactivations || []).filter((id) => !isSameId(id, companyId)),
      hardDeletes: appendUniqueId(prev.hardDeletes || [], companyId),
    }));
    setDepartmentChanges((prev) => ({
      ...prev,
      creates: prev.creates.filter((e) => !isSameId(e?.payload?.comp_id, companyId)),
      updates: linkedDeptIds.reduce((m, id) => removeObjectKey(m, id), prev.updates),
      deactivations: (prev.deactivations || []).filter((id) => !linkedDeptIds.some((lr) => isSameId(lr, id))),
      hardDeletes: linkedDeptIds.reduce(
        (ids, id) => isTempDepartmentId(id) ? ids : appendUniqueId(ids, id),
        (prev.hardDeletes || []).filter((id) => !linkedDeptIds.some((lr) => isSameId(lr, id))),
      ),
    }));
    toastSuccess("Company deletion staged for Save Batch.", "Batching");
  }, [allDepartments, isMutatingAction, isSaving, orderedCompanies, selectedCompany?.comp_id, setAllDepartments, setCompanyChanges, setDepartmentChanges, setOrderedCompanies, updateSelectedCompanyInQuery]);

  return {
    openAddCompanyDialog, openEditCompanyDialog, openToggleCompanyDialog, openDeactivateCompanyDialog,
    submitAddCompany, submitEditCompany, submitToggleCompany, submitDeactivateCompany, stageHardDeleteCompany,
  };
}
