"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, Card, Input, Modal, SetupTable, toastError, toastSuccess } from "@/shared/components/ui";
import {
  getCompanyDisplayName,
  getCompanyEmail,
  getCompanyPhone,
  getCompanyShortName,
  isCompanyActive,
} from "@/modules/company-department-setup/model/company.model.js";
import {
  getDepartmentDisplayName,
  getDepartmentShortName,
  isDepartmentActive,
} from "@/modules/company-department-setup/model/department.model.js";

function parseCompanyId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const text = String(value).trim();
  const asNumber = Number(text);
  return Number.isFinite(asNumber) ? asNumber : text;
}

function isSameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function resolveErrorMessage(payload, fallbackMessage) {
  if (payload && typeof payload === "object" && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }

  return fallbackMessage;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function mapCompanyRow(company, index) {
  return {
    ...company,
    id: company?.comp_id ?? `company-${index}`,
    comp_name: getCompanyDisplayName(company),
    comp_short_name: getCompanyShortName(company),
    comp_email: getCompanyEmail(company),
    comp_phone: getCompanyPhone(company),
    is_active_bool: isCompanyActive(company),
  };
}

function mapDepartmentRow(department, index) {
  return {
    ...department,
    id: department?.dept_id ?? `department-${index}`,
    dept_name: getDepartmentDisplayName(department),
    dept_short_name: getDepartmentShortName(department),
    is_active_bool: isDepartmentActive(department),
  };
}

function removeObjectKey(objectValue, keyToRemove) {
  const normalizedKey = String(keyToRemove ?? "");
  const nextObject = {};

  Object.entries(objectValue || {}).forEach(([key, value]) => {
    if (key !== normalizedKey) {
      nextObject[key] = value;
    }
  });

  return nextObject;
}

function mergeUpdatePatch(previousPatch, nextPatch) {
  const mergedPatch = {
    ...(previousPatch || {}),
  };

  Object.entries(nextPatch || {}).forEach(([key, value]) => {
    if (value !== undefined) {
      mergedPatch[key] = value;
    }
  });

  return mergedPatch;
}

function appendUniqueId(idList, value) {
  const normalizedValue = String(value ?? "");

  if (!normalizedValue) {
    return Array.isArray(idList) ? [...idList] : [];
  }

  const existing = Array.isArray(idList) ? idList : [];
  if (existing.some((entry) => isSameId(entry, normalizedValue))) {
    return [...existing];
  }

  return [...existing, normalizedValue];
}

function remapDepartmentCreatesByCompanyId(creates, companyIdMap) {
  return (Array.isArray(creates) ? creates : []).map((entry) => {
    const sourceCompanyId = entry?.payload?.comp_id;
    const nextCompanyId = companyIdMap.get(String(sourceCompanyId ?? "")) ?? sourceCompanyId;

    return {
      ...entry,
      payload: {
        ...(entry?.payload || {}),
        comp_id: nextCompanyId,
      },
    };
  });
}

function remapDepartmentsByCompanyId(departments, companyIdMap) {
  return (Array.isArray(departments) ? departments : []).map((department, index) => {
    const sourceCompanyId = department?.comp_id;
    const nextCompanyId = companyIdMap.get(String(sourceCompanyId ?? "")) ?? sourceCompanyId;

    return mapDepartmentRow(
      {
        ...department,
        comp_id: nextCompanyId,
      },
      index,
    );
  });
}

const EMPTY_DIALOG = {
  kind: null,
  target: null,
  nextIsActive: null,
};

const TEMP_COMPANY_PREFIX = "tmp-company-";
const TEMP_DEPARTMENT_PREFIX = "tmp-department-";

function createTempId(prefix) {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isTempCompanyId(value) {
  return String(value ?? "").startsWith(TEMP_COMPANY_PREFIX);
}

function isTempDepartmentId(value) {
  return String(value ?? "").startsWith(TEMP_DEPARTMENT_PREFIX);
}

function createEmptyCompanyChanges() {
  return {
    creates: [],
    updates: {},
    deactivations: [],
  };
}

function createEmptyDepartmentChanges() {
  return {
    creates: [],
    updates: {},
    deactivations: [],
  };
}

function StatusBadge({ isActive }) {
  return (
    <Badge bg={isActive ? "success" : "primary"} text="light">
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}

export default function CompanyDepartmentSetupClient({
  companies = [],
  departments = [],
  initialSelectedCompanyId = null,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const seedCompanies = useMemo(
    () =>
      (Array.isArray(companies) ? companies : [])
        .map((company, index) => mapCompanyRow(company, index))
        .sort((left, right) => compareText(left.comp_name, right.comp_name)),
    [companies],
  );

  const seedDepartments = useMemo(
    () =>
      (Array.isArray(departments) ? departments : [])
        .map((department, index) => mapDepartmentRow(department, index))
        .sort((left, right) => compareText(left.dept_name, right.dept_name)),
    [departments],
  );

  const [orderedCompanies, setOrderedCompanies] = useState(seedCompanies);
  const [allDepartments, setAllDepartments] = useState(seedDepartments);
  const [companyChanges, setCompanyChanges] = useState(createEmptyCompanyChanges());
  const [departmentChanges, setDepartmentChanges] = useState(createEmptyDepartmentChanges());
  const [isMutatingAction, setIsMutatingAction] = useState(false);
  const [isSavingCompanyBatch, setIsSavingCompanyBatch] = useState(false);
  const [isSavingDepartmentBatch, setIsSavingDepartmentBatch] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dialog, setDialog] = useState(EMPTY_DIALOG);
  const [companyDraft, setCompanyDraft] = useState({ name: "", shortName: "", email: "", phone: "" });
  const [departmentDraft, setDepartmentDraft] = useState({ name: "", shortName: "" });

  const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
    const companyFromQuery = parseCompanyId(searchParams?.get("company"));

    if (companyFromQuery !== null) {
      return companyFromQuery;
    }

    if (initialSelectedCompanyId !== null && initialSelectedCompanyId !== undefined && initialSelectedCompanyId !== "") {
      return initialSelectedCompanyId;
    }

    return seedCompanies[0]?.comp_id ?? null;
  });

  useEffect(() => {
    setOrderedCompanies(seedCompanies);
    setAllDepartments(seedDepartments);
    setCompanyChanges(createEmptyCompanyChanges());
    setDepartmentChanges(createEmptyDepartmentChanges());
    setDialog(EMPTY_DIALOG);
    setCompanyDraft({ name: "", shortName: "", email: "", phone: "" });
    setDepartmentDraft({ name: "", shortName: "" });
    setIsMutatingAction(false);
    setIsSavingCompanyBatch(false);
    setIsSavingDepartmentBatch(false);
    setIsRefreshing(false);

    const queryCompanyId = parseCompanyId(searchParams?.get("company"));
    const nextSelected =
      queryCompanyId
      ?? initialSelectedCompanyId
      ?? seedCompanies[0]?.comp_id
      ?? null;

    setSelectedCompanyId(nextSelected);
  }, [initialSelectedCompanyId, searchParams, seedCompanies, seedDepartments]);

  const companyChangeCount = useMemo(
    () =>
      (companyChanges.creates?.length || 0)
      + Object.keys(companyChanges.updates || {}).length
      + (companyChanges.deactivations?.length || 0),
    [companyChanges],
  );

  const departmentChangeCount = useMemo(
    () =>
      (departmentChanges.creates?.length || 0)
      + Object.keys(departmentChanges.updates || {}).length
      + (departmentChanges.deactivations?.length || 0),
    [departmentChanges],
  );

  const hasPendingChanges = companyChangeCount + departmentChangeCount > 0;

  const pendingDeactivatedCompanyIds = useMemo(
    () => new Set((companyChanges.deactivations || []).map((id) => String(id ?? ""))),
    [companyChanges.deactivations],
  );

  const pendingDeactivatedDepartmentIds = useMemo(
    () => new Set((departmentChanges.deactivations || []).map((id) => String(id ?? ""))),
    [departmentChanges.deactivations],
  );

  const selectedCompany = useMemo(
    () =>
      orderedCompanies.find((company) => isSameId(company?.comp_id, selectedCompanyId))
      ?? null,
    [orderedCompanies, selectedCompanyId],
  );

  const selectedCompanyDepartments = useMemo(
    () => {
      if (!selectedCompany?.comp_id) {
        return [];
      }

      return allDepartments
        .filter((department) => isSameId(department?.comp_id, selectedCompany.comp_id))
        .sort((left, right) => compareText(left.dept_name, right.dept_name));
    },
    [allDepartments, selectedCompany?.comp_id],
  );

  const isSelectedCompanyPendingDeactivation = useMemo(
    () => pendingDeactivatedCompanyIds.has(String(selectedCompany?.comp_id ?? "")),
    [pendingDeactivatedCompanyIds, selectedCompany?.comp_id],
  );

  const decoratedCompanies = useMemo(() => {
    const createdIds = new Set((companyChanges.creates || []).map((entry) => String(entry?.tempId ?? "")));
    const updatedIds = new Set(Object.keys(companyChanges.updates || {}));
    const deactivatedIds = new Set((companyChanges.deactivations || []).map((entry) => String(entry ?? "")));

    return orderedCompanies.map((row) => {
      const id = String(row?.comp_id ?? "");

      if (deactivatedIds.has(id)) {
        return {
          ...row,
          __batchState: "deactivated",
          __batchClassName: "psb-batch-row-deleted",
        };
      }

      if (createdIds.has(id)) {
        return {
          ...row,
          __batchState: "new",
          __batchClassName: "psb-batch-row-new",
        };
      }

      if (updatedIds.has(id)) {
        return {
          ...row,
          __batchState: "edited",
          __batchClassName: "psb-batch-row-edited",
        };
      }

      return {
        ...row,
        __batchState: "",
        __batchClassName: "",
      };
    });
  }, [companyChanges.creates, companyChanges.deactivations, companyChanges.updates, orderedCompanies]);

  const decoratedDepartments = useMemo(() => {
    const createdIds = new Set((departmentChanges.creates || []).map((entry) => String(entry?.tempId ?? "")));
    const updatedIds = new Set(Object.keys(departmentChanges.updates || {}));
    const deactivatedIds = new Set((departmentChanges.deactivations || []).map((entry) => String(entry ?? "")));

    return selectedCompanyDepartments.map((row) => {
      const id = String(row?.dept_id ?? "");

      if (deactivatedIds.has(id)) {
        return {
          ...row,
          __batchState: "deactivated",
          __batchClassName: "psb-batch-row-deleted",
        };
      }

      if (createdIds.has(id)) {
        return {
          ...row,
          __batchState: "new",
          __batchClassName: "psb-batch-row-new",
        };
      }

      if (updatedIds.has(id)) {
        return {
          ...row,
          __batchState: "edited",
          __batchClassName: "psb-batch-row-edited",
        };
      }

      return {
        ...row,
        __batchState: "",
        __batchClassName: "",
      };
    });
  }, [departmentChanges.creates, departmentChanges.deactivations, departmentChanges.updates, selectedCompanyDepartments]);

  const updateSelectedCompanyInQuery = useCallback(
    (companyId) => {
      const nextParams = new URLSearchParams(searchParams?.toString() || "");

      if (companyId === undefined || companyId === null || companyId === "") {
        nextParams.delete("company");
      } else {
        nextParams.set("company", String(companyId));
      }

      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
      setSelectedCompanyId(companyId ?? null);
    },
    [pathname, router, searchParams],
  );

  const requestJson = useCallback(async (url, options, fallbackMessage) => {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.ok === false) {
      throw new Error(resolveErrorMessage(payload, fallbackMessage));
    }

    return payload;
  }, []);

  const closeDialog = useCallback(() => {
    if (isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch) {
      return;
    }

    setDialog(EMPTY_DIALOG);
  }, [isMutatingAction, isSavingCompanyBatch, isSavingDepartmentBatch]);

  const handleCompanyRowClick = useCallback(
    (row) => {
      if (isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch) {
        return;
      }

      const nextCompanyId = row?.comp_id;

      if (isSameId(nextCompanyId, selectedCompany?.comp_id)) {
        return;
      }

      if (hasPendingChanges && typeof window !== "undefined") {
        const confirmed = window.confirm("You have unsaved batch changes. Switch company anyway?");

        if (!confirmed) {
          return;
        }
      }

      updateSelectedCompanyInQuery(nextCompanyId);
    },
    [
      hasPendingChanges,
      isMutatingAction,
      isSavingCompanyBatch,
      isSavingDepartmentBatch,
      selectedCompany?.comp_id,
      updateSelectedCompanyInQuery,
    ],
  );

  const refreshData = useCallback(async () => {
    if (isRefreshing || isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch) {
      return;
    }

    if (hasPendingChanges && typeof window !== "undefined") {
      const confirmed = window.confirm("Refreshing will discard staged changes. Continue?");
      if (!confirmed) {
        return;
      }
    }

    setIsRefreshing(true);

    try {
      setCompanyChanges(createEmptyCompanyChanges());
      setDepartmentChanges(createEmptyDepartmentChanges());
      setDialog(EMPTY_DIALOG);
      router.refresh();
      toastSuccess("Company/Department data refreshed.", "Refresh");
    } finally {
      setIsRefreshing(false);
    }
  }, [hasPendingChanges, isMutatingAction, isRefreshing, isSavingCompanyBatch, isSavingDepartmentBatch, router]);

  const cancelCompanyBatch = useCallback(() => {
    if (isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch) {
      return;
    }

    if (companyChangeCount === 0) {
      return;
    }

    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Discard staged company changes?");
      if (!confirmed) {
        return;
      }
    }

    const tempCompanyIds = new Set((companyChanges.creates || []).map((entry) => String(entry?.tempId ?? "")));

    setOrderedCompanies(seedCompanies);
    setCompanyChanges(createEmptyCompanyChanges());
    setAllDepartments((previous) =>
      previous
        .filter((department) => !tempCompanyIds.has(String(department?.comp_id ?? "")))
        .map((department, index) => mapDepartmentRow(department, index)),
    );

    setDepartmentChanges((previous) => ({
      creates: (previous.creates || []).filter((entry) => !tempCompanyIds.has(String(entry?.payload?.comp_id ?? ""))),
      updates: Object.fromEntries(
        Object.entries(previous.updates || {}).filter(([, update]) => !tempCompanyIds.has(String(update?.comp_id ?? ""))),
      ),
      deactivations: [...(previous.deactivations || [])],
    }));

    if (selectedCompanyId && tempCompanyIds.has(String(selectedCompanyId))) {
      const fallbackCompanyId = seedCompanies[0]?.comp_id ?? null;
      updateSelectedCompanyInQuery(fallbackCompanyId);
    }

    toastSuccess("Company batch canceled.", "Batching");
  }, [
    companyChangeCount,
    companyChanges.creates,
    isMutatingAction,
    isSavingCompanyBatch,
    isSavingDepartmentBatch,
    seedCompanies,
    selectedCompanyId,
    updateSelectedCompanyInQuery,
  ]);

  const cancelDepartmentBatch = useCallback(() => {
    if (isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch) {
      return;
    }

    if (departmentChangeCount === 0) {
      return;
    }

    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Discard staged department changes?");
      if (!confirmed) {
        return;
      }
    }

    setAllDepartments(seedDepartments);
    setDepartmentChanges(createEmptyDepartmentChanges());
    toastSuccess("Department batch canceled.", "Batching");
  }, [departmentChangeCount, isMutatingAction, isSavingCompanyBatch, isSavingDepartmentBatch, seedDepartments]);

  const saveCompanyBatch = useCallback(async () => {
    if (companyChangeCount === 0 || isSavingCompanyBatch || isMutatingAction) {
      return;
    }

    setIsSavingCompanyBatch(true);
    setIsMutatingAction(true);

    try {
      const companyIdMap = new Map();
      const deactivatedCompanySet = new Set((companyChanges.deactivations || []).map((id) => String(id ?? "")));

      for (const createEntry of companyChanges.creates || []) {
        const payload = await requestJson(
          "/api/company-department-setup/companies",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(createEntry.payload),
          },
          "Failed to create company.",
        );

        const createdId = payload?.company?.comp_id;

        if (createdId === undefined || createdId === null || createdId === "") {
          throw new Error("Created company response is invalid.");
        }

        companyIdMap.set(String(createEntry.tempId), createdId);
      }

      for (const [companyId, updates] of Object.entries(companyChanges.updates || {})) {
        if (deactivatedCompanySet.has(String(companyId))) {
          continue;
        }

        if (isTempCompanyId(companyId)) {
          continue;
        }

        const updateKeys = Object.keys(updates || {});
        if (updateKeys.length === 0) {
          continue;
        }

        await requestJson(
          `/api/company-department-setup/companies/${encodeURIComponent(String(companyId))}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updates),
          },
          "Failed to update company.",
        );
      }

      for (const companyId of companyChanges.deactivations || []) {
        if (isTempCompanyId(companyId)) {
          continue;
        }

        await requestJson(
          `/api/company-department-setup/companies/${encodeURIComponent(String(companyId))}`,
          {
            method: "DELETE",
          },
          "Failed to deactivate company.",
        );
      }

      if (companyIdMap.size > 0) {
        setDepartmentChanges((previous) => ({
          ...previous,
          creates: remapDepartmentCreatesByCompanyId(previous.creates, companyIdMap),
        }));

        setAllDepartments((previous) => remapDepartmentsByCompanyId(previous, companyIdMap));
      }

      setCompanyChanges(createEmptyCompanyChanges());

      const selectedResolved = companyIdMap.get(String(selectedCompany?.comp_id ?? "")) ?? selectedCompany?.comp_id ?? null;
      const nextSelectedCompanyId =
        selectedResolved && !deactivatedCompanySet.has(String(selectedResolved))
          ? selectedResolved
          : null;

      updateSelectedCompanyInQuery(nextSelectedCompanyId);
      router.refresh();
      toastSuccess("Company batch saved.", "Save Batch");
    } catch (error) {
      toastError(error?.message || "Failed to save company batch.");
    } finally {
      setIsMutatingAction(false);
      setIsSavingCompanyBatch(false);
    }
  }, [
    companyChangeCount,
    companyChanges.creates,
    companyChanges.deactivations,
    companyChanges.updates,
    isMutatingAction,
    isSavingCompanyBatch,
    requestJson,
    router,
    selectedCompany?.comp_id,
    updateSelectedCompanyInQuery,
  ]);

  const saveDepartmentBatch = useCallback(async () => {
    if (departmentChangeCount === 0 || isSavingDepartmentBatch || isMutatingAction) {
      return;
    }

    const hasTempCompanyReference = (departmentChanges.creates || []).some((entry) => isTempCompanyId(entry?.payload?.comp_id));

    if (hasTempCompanyReference) {
      toastError("Save company batch first before saving departments for a newly created company.");
      return;
    }

    setIsSavingDepartmentBatch(true);
    setIsMutatingAction(true);

    try {
      const deactivatedDepartmentSet = new Set((departmentChanges.deactivations || []).map((id) => String(id ?? "")));

      for (const createEntry of departmentChanges.creates || []) {
        await requestJson(
          "/api/company-department-setup/departments",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(createEntry.payload),
          },
          "Failed to create department.",
        );
      }

      for (const [departmentId, updates] of Object.entries(departmentChanges.updates || {})) {
        if (deactivatedDepartmentSet.has(String(departmentId))) {
          continue;
        }

        if (isTempDepartmentId(departmentId)) {
          continue;
        }

        const updateKeys = Object.keys(updates || {});
        if (updateKeys.length === 0) {
          continue;
        }

        await requestJson(
          `/api/company-department-setup/departments/${encodeURIComponent(String(departmentId))}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updates),
          },
          "Failed to update department.",
        );
      }

      for (const departmentId of departmentChanges.deactivations || []) {
        if (isTempDepartmentId(departmentId)) {
          continue;
        }

        await requestJson(
          `/api/company-department-setup/departments/${encodeURIComponent(String(departmentId))}`,
          {
            method: "DELETE",
          },
          "Failed to deactivate department.",
        );
      }

      setDepartmentChanges(createEmptyDepartmentChanges());
      router.refresh();
      toastSuccess("Department batch saved.", "Save Batch");
    } catch (error) {
      toastError(error?.message || "Failed to save department batch.");
    } finally {
      setIsMutatingAction(false);
      setIsSavingDepartmentBatch(false);
    }
  }, [
    departmentChangeCount,
    departmentChanges.creates,
    departmentChanges.deactivations,
    departmentChanges.updates,
    isMutatingAction,
    isSavingDepartmentBatch,
    requestJson,
    router,
  ]);

  const openAddCompanyDialog = useCallback(() => {
    if (isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch) {
      return;
    }

    setCompanyDraft({ name: "", shortName: "", email: "", phone: "" });
    setDialog({ kind: "add-company", target: null, nextIsActive: true });
  }, [isMutatingAction, isSavingCompanyBatch, isSavingDepartmentBatch]);

  const openEditCompanyDialog = useCallback((row) => {
    if (isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch) {
      return;
    }

    setCompanyDraft({
      name: String(row?.comp_name || ""),
      shortName: String(row?.comp_short_name || ""),
      email: String(row?.comp_email || ""),
      phone: String(row?.comp_phone || ""),
    });

    setDialog({ kind: "edit-company", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingCompanyBatch, isSavingDepartmentBatch]);

  const openToggleCompanyDialog = useCallback((row) => {
    if (isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch) {
      return;
    }

    setDialog({ kind: "toggle-company", target: row, nextIsActive: !Boolean(row?.is_active_bool) });
  }, [isMutatingAction, isSavingCompanyBatch, isSavingDepartmentBatch]);

  const openDeactivateCompanyDialog = useCallback((row) => {
    if (isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch) {
      return;
    }

    setDialog({ kind: "deactivate-company", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingCompanyBatch, isSavingDepartmentBatch]);

  const openAddDepartmentDialog = useCallback(() => {
    if (isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch) {
      return;
    }

    if (!selectedCompany?.comp_id) {
      toastError("Select a company before adding a department.");
      return;
    }

    if (isSelectedCompanyPendingDeactivation) {
      toastError("Selected company is staged for deactivation. Save or cancel company batch first.");
      return;
    }

    setDepartmentDraft({ name: "", shortName: "" });
    setDialog({
      kind: "add-department",
      target: {
        comp_id: selectedCompany.comp_id,
        comp_name: selectedCompany.comp_name,
      },
      nextIsActive: true,
    });
  }, [
    isMutatingAction,
    isSavingCompanyBatch,
    isSavingDepartmentBatch,
    isSelectedCompanyPendingDeactivation,
    selectedCompany?.comp_id,
    selectedCompany?.comp_name,
  ]);

  const openEditDepartmentDialog = useCallback((row) => {
    if (isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch) {
      return;
    }

    setDepartmentDraft({
      name: String(row?.dept_name || ""),
      shortName: String(row?.dept_short_name || ""),
    });

    setDialog({ kind: "edit-department", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingCompanyBatch, isSavingDepartmentBatch]);

  const openToggleDepartmentDialog = useCallback((row) => {
    if (isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch) {
      return;
    }

    setDialog({ kind: "toggle-department", target: row, nextIsActive: !Boolean(row?.is_active_bool) });
  }, [isMutatingAction, isSavingCompanyBatch, isSavingDepartmentBatch]);

  const openDeactivateDepartmentDialog = useCallback((row) => {
    if (isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch) {
      return;
    }

    setDialog({ kind: "deactivate-department", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingCompanyBatch, isSavingDepartmentBatch]);

  const submitAddCompany = useCallback(() => {
    const companyName = normalizeText(companyDraft.name);
    if (!companyName) {
      toastError("Company name is required.");
      return;
    }

    const tempCompanyId = createTempId(TEMP_COMPANY_PREFIX);
    const companyShortName = normalizeText(companyDraft.shortName);
    const companyEmail = normalizeText(companyDraft.email);
    const companyPhone = normalizeText(companyDraft.phone);

    setOrderedCompanies((previous) => [
      ...previous,
      mapCompanyRow(
        {
          comp_id: tempCompanyId,
          comp_name: companyName,
          comp_short_name: companyShortName,
          comp_email: companyEmail,
          comp_phone: companyPhone,
          is_active: true,
        },
        previous.length,
      ),
    ]);

    setCompanyChanges((previous) => ({
      ...previous,
      creates: [
        ...previous.creates,
        {
          tempId: tempCompanyId,
          payload: {
            comp_name: companyName,
            comp_short_name: companyShortName,
            comp_email: companyEmail,
            comp_phone: companyPhone,
            is_active: true,
          },
        },
      ],
    }));

    updateSelectedCompanyInQuery(tempCompanyId);
    setDialog(EMPTY_DIALOG);
    setCompanyDraft({ name: "", shortName: "", email: "", phone: "" });
    toastSuccess("Company staged for Save Batch.", "Batching");
  }, [companyDraft.email, companyDraft.name, companyDraft.phone, companyDraft.shortName, updateSelectedCompanyInQuery]);

  const submitEditCompany = useCallback(() => {
    const row = dialog?.target;

    if (!row?.comp_id) {
      toastError("Invalid company.");
      return;
    }

    const companyName = normalizeText(companyDraft.name);
    if (!companyName) {
      toastError("Company name is required.");
      return;
    }

    const companyShortName = normalizeText(companyDraft.shortName);
    const companyEmail = normalizeText(companyDraft.email);
    const companyPhone = normalizeText(companyDraft.phone);
    const companyId = row.comp_id;

    setOrderedCompanies((previous) =>
      previous.map((company, index) => {
        if (!isSameId(company?.comp_id, companyId)) {
          return company;
        }

        return mapCompanyRow(
          {
            ...company,
            comp_name: companyName,
            comp_short_name: companyShortName,
            comp_email: companyEmail,
            comp_phone: companyPhone,
          },
          index,
        );
      }),
    );

    setCompanyChanges((previous) => {
      if (isTempCompanyId(companyId)) {
        return {
          ...previous,
          creates: previous.creates.map((entry) => {
            if (!isSameId(entry?.tempId, companyId)) {
              return entry;
            }

            return {
              ...entry,
              payload: {
                ...entry.payload,
                comp_name: companyName,
                comp_short_name: companyShortName,
                comp_email: companyEmail,
                comp_phone: companyPhone,
              },
            };
          }),
          updates: removeObjectKey(previous.updates, companyId),
        };
      }

      return {
        ...previous,
        updates: {
          ...previous.updates,
          [String(companyId)]: mergeUpdatePatch(previous.updates?.[String(companyId)], {
            comp_name: companyName,
            comp_short_name: companyShortName,
            comp_email: companyEmail,
            comp_phone: companyPhone,
          }),
        },
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess("Company update staged for Save Batch.", "Batching");
  }, [companyDraft.email, companyDraft.name, companyDraft.phone, companyDraft.shortName, dialog]);

  const submitToggleCompany = useCallback(() => {
    const row = dialog?.target;
    const nextIsActive = Boolean(dialog?.nextIsActive);

    if (!row?.comp_id) {
      toastError("Invalid company.");
      return;
    }

    const companyId = row.comp_id;

    setOrderedCompanies((previous) =>
      previous.map((company, index) => {
        if (!isSameId(company?.comp_id, companyId)) {
          return company;
        }

        return mapCompanyRow(
          {
            ...company,
            is_active: nextIsActive,
          },
          index,
        );
      }),
    );

    setCompanyChanges((previous) => {
      if (isTempCompanyId(companyId)) {
        return {
          ...previous,
          creates: previous.creates.map((entry) => {
            if (!isSameId(entry?.tempId, companyId)) {
              return entry;
            }

            return {
              ...entry,
              payload: {
                ...entry.payload,
                is_active: nextIsActive,
              },
            };
          }),
          updates: removeObjectKey(previous.updates, companyId),
        };
      }

      return {
        ...previous,
        updates: {
          ...previous.updates,
          [String(companyId)]: mergeUpdatePatch(previous.updates?.[String(companyId)], {
            is_active: nextIsActive,
          }),
        },
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess(`Company ${nextIsActive ? "enable" : "disable"} staged for Save Batch.`, "Batching");
  }, [dialog]);

  const submitDeactivateCompany = useCallback(() => {
    const row = dialog?.target;

    if (!row?.comp_id) {
      toastError("Invalid company.");
      return;
    }

    const companyId = row.comp_id;
    const linkedDepartmentIds = allDepartments
      .filter((department) => isSameId(department?.comp_id, companyId))
      .map((department) => String(department?.dept_id ?? ""));

    if (isTempCompanyId(companyId)) {
      const nextCompanies = orderedCompanies.filter((company) => !isSameId(company?.comp_id, companyId));

      setOrderedCompanies(nextCompanies);
      setAllDepartments((previous) => previous.filter((department) => !isSameId(department?.comp_id, companyId)));

      setCompanyChanges((previous) => ({
        ...previous,
        creates: previous.creates.filter((entry) => !isSameId(entry?.tempId, companyId)),
        updates: removeObjectKey(previous.updates, companyId),
        deactivations: (previous.deactivations || []).filter((deactivatedId) => !isSameId(deactivatedId, companyId)),
      }));

      setDepartmentChanges((previous) => ({
        creates: previous.creates.filter((entry) => !isSameId(entry?.payload?.comp_id, companyId)),
        updates: linkedDepartmentIds.reduce((mapValue, departmentId) => removeObjectKey(mapValue, departmentId), previous.updates),
        deactivations: (previous.deactivations || []).filter(
          (departmentId) => !linkedDepartmentIds.some((linkedDepartmentId) => isSameId(linkedDepartmentId, departmentId)),
        ),
      }));

      if (isSameId(selectedCompany?.comp_id, companyId)) {
        updateSelectedCompanyInQuery(nextCompanies[0]?.comp_id ?? null);
      }

      setDialog(EMPTY_DIALOG);
      toastSuccess("Company deactivation staged for Save Batch.", "Batching");
      return;
    }

    setCompanyChanges((previous) => ({
      ...previous,
      updates: removeObjectKey(previous.updates, companyId),
      deactivations: appendUniqueId(previous.deactivations, companyId),
    }));

    setDepartmentChanges((previous) => ({
      creates: previous.creates.filter((entry) => !isSameId(entry?.payload?.comp_id, companyId)),
      updates: linkedDepartmentIds.reduce((mapValue, departmentId) => removeObjectKey(mapValue, departmentId), previous.updates),
      deactivations: linkedDepartmentIds.reduce(
        (ids, departmentId) => appendUniqueId(ids, departmentId),
        previous.deactivations || [],
      ),
    }));

    setDialog(EMPTY_DIALOG);
    toastSuccess("Company deactivation staged for Save Batch.", "Batching");
  }, [allDepartments, dialog, orderedCompanies, selectedCompany?.comp_id, updateSelectedCompanyInQuery]);

  const submitAddDepartment = useCallback(() => {
    const target = dialog?.target;

    if (!target?.comp_id) {
      toastError("Select a company before adding a department.");
      return;
    }

    const departmentName = normalizeText(departmentDraft.name);
    if (!departmentName) {
      toastError("Department name is required.");
      return;
    }

    const departmentShortName = normalizeText(departmentDraft.shortName);
    const tempDepartmentId = createTempId(TEMP_DEPARTMENT_PREFIX);

    setAllDepartments((previous) => [
      ...previous,
      mapDepartmentRow(
        {
          dept_id: tempDepartmentId,
          comp_id: target.comp_id,
          dept_name: departmentName,
          dept_short_name: departmentShortName,
          is_active: true,
        },
        previous.length,
      ),
    ]);

    setDepartmentChanges((previous) => ({
      ...previous,
      creates: [
        ...previous.creates,
        {
          tempId: tempDepartmentId,
          payload: {
            comp_id: target.comp_id,
            dept_name: departmentName,
            dept_short_name: departmentShortName,
            is_active: true,
          },
        },
      ],
    }));

    setDialog(EMPTY_DIALOG);
    setDepartmentDraft({ name: "", shortName: "" });
    toastSuccess("Department staged for Save Batch.", "Batching");
  }, [departmentDraft.name, departmentDraft.shortName, dialog]);

  const submitEditDepartment = useCallback(() => {
    const row = dialog?.target;

    if (!row?.dept_id) {
      toastError("Invalid department.");
      return;
    }

    const departmentName = normalizeText(departmentDraft.name);
    if (!departmentName) {
      toastError("Department name is required.");
      return;
    }

    const departmentShortName = normalizeText(departmentDraft.shortName);
    const departmentId = row.dept_id;

    setAllDepartments((previous) =>
      previous.map((department, index) => {
        if (!isSameId(department?.dept_id, departmentId)) {
          return department;
        }

        return mapDepartmentRow(
          {
            ...department,
            dept_name: departmentName,
            dept_short_name: departmentShortName,
          },
          index,
        );
      }),
    );

    setDepartmentChanges((previous) => {
      if (isTempDepartmentId(departmentId)) {
        return {
          ...previous,
          creates: previous.creates.map((entry) => {
            if (!isSameId(entry?.tempId, departmentId)) {
              return entry;
            }

            return {
              ...entry,
              payload: {
                ...entry.payload,
                dept_name: departmentName,
                dept_short_name: departmentShortName,
              },
            };
          }),
          updates: removeObjectKey(previous.updates, departmentId),
        };
      }

      return {
        ...previous,
        updates: {
          ...previous.updates,
          [String(departmentId)]: mergeUpdatePatch(previous.updates?.[String(departmentId)], {
            dept_name: departmentName,
            dept_short_name: departmentShortName,
          }),
        },
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess("Department update staged for Save Batch.", "Batching");
  }, [departmentDraft.name, departmentDraft.shortName, dialog]);

  const submitToggleDepartment = useCallback(() => {
    const row = dialog?.target;
    const nextIsActive = Boolean(dialog?.nextIsActive);

    if (!row?.dept_id) {
      toastError("Invalid department.");
      return;
    }

    const departmentId = row.dept_id;

    setAllDepartments((previous) =>
      previous.map((department, index) => {
        if (!isSameId(department?.dept_id, departmentId)) {
          return department;
        }

        return mapDepartmentRow(
          {
            ...department,
            is_active: nextIsActive,
          },
          index,
        );
      }),
    );

    setDepartmentChanges((previous) => {
      if (isTempDepartmentId(departmentId)) {
        return {
          ...previous,
          creates: previous.creates.map((entry) => {
            if (!isSameId(entry?.tempId, departmentId)) {
              return entry;
            }

            return {
              ...entry,
              payload: {
                ...entry.payload,
                is_active: nextIsActive,
              },
            };
          }),
          updates: removeObjectKey(previous.updates, departmentId),
        };
      }

      return {
        ...previous,
        updates: {
          ...previous.updates,
          [String(departmentId)]: mergeUpdatePatch(previous.updates?.[String(departmentId)], {
            is_active: nextIsActive,
          }),
        },
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess(`Department ${nextIsActive ? "enable" : "disable"} staged for Save Batch.`, "Batching");
  }, [dialog]);

  const submitDeactivateDepartment = useCallback(() => {
    const row = dialog?.target;

    if (!row?.dept_id) {
      toastError("Invalid department.");
      return;
    }

    const departmentId = row.dept_id;

    if (isTempDepartmentId(departmentId)) {
      setAllDepartments((items) => items.filter((department) => !isSameId(department?.dept_id, departmentId)));
    }

    setDepartmentChanges((previous) => {
      if (isTempDepartmentId(departmentId)) {
        return {
          ...previous,
          creates: previous.creates.filter((entry) => !isSameId(entry?.tempId, departmentId)),
          updates: removeObjectKey(previous.updates, departmentId),
          deactivations: (previous.deactivations || []).filter((deactivatedId) => !isSameId(deactivatedId, departmentId)),
        };
      }

      return {
        ...previous,
        updates: removeObjectKey(previous.updates, departmentId),
        deactivations: appendUniqueId(previous.deactivations, departmentId),
      };
    });

    setDialog(EMPTY_DIALOG);
    toastSuccess("Department deactivation staged for Save Batch.", "Batching");
  }, [dialog]);

  const companyColumns = useMemo(
    () => [
      {
        key: "comp_name",
        label: "Company Name",
        width: "26%",
        render: (row) => {
          const batchState = String(row?.__batchState || "");
          const markerText =
            batchState === "deactivated"
              ? "Deactivated"
              : (batchState === "new" ? "New" : (batchState === "edited" ? "Edited" : ""));
          const markerClass =
            batchState === "deactivated"
              ? "psb-batch-marker psb-batch-marker-deleted"
              : (batchState === "new"
                ? "psb-batch-marker psb-batch-marker-new"
                : (batchState === "edited" ? "psb-batch-marker psb-batch-marker-edited" : ""));
          const textClassName = [
            isSameId(row?.comp_id, selectedCompany?.comp_id) ? "fw-semibold text-primary" : "",
            batchState === "deactivated" ? "text-decoration-line-through" : "",
          ].filter(Boolean).join(" ");

          return (
            <span className={textClassName}>
              {row?.comp_name || "--"}
              {markerText ? <span className={markerClass}>{markerText}</span> : null}
            </span>
          );
        },
      },
      {
        key: "comp_short_name",
        label: "Short Name",
        width: "18%",
      },
      {
        key: "comp_email",
        label: "Email",
        width: "26%",
      },
      {
        key: "comp_phone",
        label: "Phone",
        width: "18%",
      },
      {
        key: "is_active_bool",
        label: "Active",
        width: "12%",
        align: "center",
        render: (row) => <StatusBadge isActive={Boolean(row?.is_active_bool)} />,
      },
    ],
    [selectedCompany?.comp_id],
  );

  const departmentColumns = useMemo(
    () => [
      {
        key: "dept_name",
        label: "Department Name",
        width: "48%",
        render: (row) => {
          const batchState = String(row?.__batchState || "");
          const markerText =
            batchState === "deactivated"
              ? "Deactivated"
              : (batchState === "new" ? "New" : (batchState === "edited" ? "Edited" : ""));
          const markerClass =
            batchState === "deactivated"
              ? "psb-batch-marker psb-batch-marker-deleted"
              : (batchState === "new"
                ? "psb-batch-marker psb-batch-marker-new"
                : (batchState === "edited" ? "psb-batch-marker psb-batch-marker-edited" : ""));

          return (
            <span className={batchState === "deactivated" ? "text-decoration-line-through" : ""}>
              {row?.dept_name || "--"}
              {markerText ? <span className={markerClass}>{markerText}</span> : null}
            </span>
          );
        },
      },
      {
        key: "dept_short_name",
        label: "Short Name",
        width: "30%",
      },
      {
        key: "is_active_bool",
        label: "Active",
        width: "22%",
        align: "center",
        render: (row) => <StatusBadge isActive={Boolean(row?.is_active_bool)} />,
      },
    ],
    [],
  );

  const renderCompanyActions = useCallback(
    (row) => {
      const isPendingDeactivation = pendingDeactivatedCompanyIds.has(String(row?.comp_id ?? ""));
      const actionDisabled = isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch || isPendingDeactivation;
      const isActive = Boolean(row?.is_active_bool);

      return (
        <>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="px-2 psb-setup-action-btn psb-setup-action-edit"
            disabled={actionDisabled}
            title="Edit company"
            aria-label={`Edit ${row?.comp_name || "company"}`}
            onClick={(event) => {
              event.stopPropagation();
              openEditCompanyDialog(row);
            }}
          >
            <i className="bi bi-pencil-square" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={`px-2 psb-setup-action-btn ${isActive ? "psb-setup-action-toggle-disable" : "psb-setup-action-toggle-enable"}`}
            disabled={actionDisabled}
            title={isActive ? "Disable company" : "Enable company"}
            aria-label={isActive ? "Disable company" : "Enable company"}
            onClick={(event) => {
              event.stopPropagation();
              openToggleCompanyDialog(row);
            }}
          >
            <i className={`bi ${isActive ? "bi-slash-circle" : "bi-check-circle"}`} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="px-2 psb-setup-action-btn psb-setup-action-delete"
            disabled={actionDisabled}
            title="Deactivate company"
            aria-label="Deactivate company"
            onClick={(event) => {
              event.stopPropagation();
              openDeactivateCompanyDialog(row);
            }}
          >
            <i className="bi bi-trash" aria-hidden="true" />
          </Button>
        </>
      );
    },
    [
      isMutatingAction,
      isSavingCompanyBatch,
      isSavingDepartmentBatch,
      openDeactivateCompanyDialog,
      openEditCompanyDialog,
      openToggleCompanyDialog,
      pendingDeactivatedCompanyIds,
    ],
  );

  const renderDepartmentActions = useCallback(
    (row) => {
      const isPendingDeactivation = pendingDeactivatedDepartmentIds.has(String(row?.dept_id ?? ""));
      const actionDisabled = isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch || isPendingDeactivation;
      const isActive = Boolean(row?.is_active_bool);

      return (
        <>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="px-2 psb-setup-action-btn psb-setup-action-edit"
            disabled={actionDisabled}
            title="Edit department"
            aria-label={`Edit ${row?.dept_name || "department"}`}
            onClick={(event) => {
              event.stopPropagation();
              openEditDepartmentDialog(row);
            }}
          >
            <i className="bi bi-pencil-square" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={`px-2 psb-setup-action-btn ${isActive ? "psb-setup-action-toggle-disable" : "psb-setup-action-toggle-enable"}`}
            disabled={actionDisabled}
            title={isActive ? "Disable department" : "Enable department"}
            aria-label={isActive ? "Disable department" : "Enable department"}
            onClick={(event) => {
              event.stopPropagation();
              openToggleDepartmentDialog(row);
            }}
          >
            <i className={`bi ${isActive ? "bi-slash-circle" : "bi-check-circle"}`} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="px-2 psb-setup-action-btn psb-setup-action-delete"
            disabled={actionDisabled}
            title="Deactivate department"
            aria-label="Deactivate department"
            onClick={(event) => {
              event.stopPropagation();
              openDeactivateDepartmentDialog(row);
            }}
          >
            <i className="bi bi-trash" aria-hidden="true" />
          </Button>
        </>
      );
    },
    [
      isMutatingAction,
      isSavingCompanyBatch,
      isSavingDepartmentBatch,
      openDeactivateDepartmentDialog,
      openEditDepartmentDialog,
      openToggleDepartmentDialog,
      pendingDeactivatedDepartmentIds,
    ],
  );

  const dialogTitle =
    dialog.kind === "add-company"
      ? "Add Company"
      : dialog.kind === "edit-company"
      ? "Edit Company"
      : dialog.kind === "toggle-company"
      ? `${dialog?.nextIsActive ? "Enable" : "Disable"} Company`
      : dialog.kind === "deactivate-company"
      ? "Deactivate Company"
      : dialog.kind === "add-department"
      ? "Add Department"
      : dialog.kind === "edit-department"
      ? "Edit Department"
      : dialog.kind === "toggle-department"
      ? `${dialog?.nextIsActive ? "Enable" : "Disable"} Department`
      : dialog.kind === "deactivate-department"
      ? "Deactivate Department"
      : "";

  const companyHeader = (
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
      <div>
        <h3 className="psb-ui-card-title mb-0">Companies</h3>
        <p className="psb-ui-card-subtitle mb-0">Master company records.</p>
      </div>
      <div className="d-flex flex-wrap align-items-center gap-2 justify-content-end">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={isSavingCompanyBatch}
          disabled={companyChangeCount === 0 || isSavingCompanyBatch || isMutatingAction || isSavingDepartmentBatch}
          onClick={saveCompanyBatch}
        >
          Save Batch
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={companyChangeCount === 0 || isSavingCompanyBatch || isMutatingAction || isSavingDepartmentBatch}
          onClick={cancelCompanyBatch}
        >
          Cancel Batch
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isRefreshing || isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch}
          onClick={refreshData}
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch}
          onClick={openAddCompanyDialog}
        >
          Add Company
        </Button>
      </div>
    </div>
  );

  const departmentHeader = (
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
      <div>
        <h3 className="psb-ui-card-title mb-0">
          {selectedCompany ? `Departments for: ${selectedCompany.comp_name}` : "Departments"}
        </h3>
        <p className="psb-ui-card-subtitle mb-0">
          {selectedCompany ? "Company-scoped departments." : "Select a company to view departments."}
        </p>
      </div>
      <div className="d-flex flex-wrap align-items-center gap-2 justify-content-end">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={isSavingDepartmentBatch}
          disabled={departmentChangeCount === 0 || isSavingDepartmentBatch || isMutatingAction || isSavingCompanyBatch}
          onClick={saveDepartmentBatch}
        >
          Save Batch
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={departmentChangeCount === 0 || isSavingDepartmentBatch || isMutatingAction || isSavingCompanyBatch}
          onClick={cancelDepartmentBatch}
        >
          Cancel Batch
        </Button>
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={isMutatingAction || isSavingCompanyBatch || isSavingDepartmentBatch || !selectedCompany?.comp_id || isSelectedCompanyPendingDeactivation}
          onClick={openAddDepartmentDialog}
        >
          Add Department
        </Button>
      </div>
    </div>
  );

  return (
    <main className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1">Company-Department Setup</h1>
          <p className="text-muted mb-0">Configure companies and their department mappings using shared setup tables.</p>
        </div>
        <div className="d-flex flex-wrap align-items-center justify-content-end gap-2">
          <span className={`small ${hasPendingChanges ? "text-warning-emphasis fw-semibold" : "text-muted"}`}>
            {(isSavingCompanyBatch || isSavingDepartmentBatch || isMutatingAction)
              ? "Saving batch..."
              : (hasPendingChanges
                ? `${companyChangeCount + departmentChangeCount} staged change(s)`
                : "No changes")}
          </span>
          {companyChangeCount > 0 ? (
            <span className="psb-batch-chip psb-batch-chip-edited">Companies: {companyChangeCount}</span>
          ) : null}
          {departmentChangeCount > 0 ? (
            <span className="psb-batch-chip psb-batch-chip-added">Departments: {departmentChangeCount}</span>
          ) : null}
        </div>
      </div>

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-6">
          <Card header={companyHeader}>
            <SetupTable
              columns={companyColumns}
              rows={decoratedCompanies}
              rowIdKey="comp_id"
              selectedRowId={selectedCompany?.comp_id ?? null}
              onRowClick={handleCompanyRowClick}
              renderActions={renderCompanyActions}
              emptyMessage="No companies found."
            />
          </Card>
        </div>

        <div className="col-12 col-xl-6">
          <Card header={departmentHeader}>
            {selectedCompany ? (
              <SetupTable
                columns={departmentColumns}
                rows={decoratedDepartments}
                rowIdKey="dept_id"
                renderActions={renderDepartmentActions}
                emptyMessage="No departments found for this company."
              />
            ) : (
              <div className="notice-banner notice-banner-info mb-0">Select a company to view departments</div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        show={Boolean(dialog.kind)}
        onHide={closeDialog}
        title={dialogTitle}
        footer={
          dialog.kind === "add-company" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={submitAddCompany} loading={isMutatingAction}>
                Add Company
              </Button>
            </>
          ) : dialog.kind === "edit-company" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={submitEditCompany} loading={isMutatingAction}>
                Save
              </Button>
            </>
          ) : dialog.kind === "toggle-company" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="secondary" onClick={submitToggleCompany} loading={isMutatingAction}>
                {dialog?.nextIsActive ? "Enable" : "Disable"}
              </Button>
            </>
          ) : dialog.kind === "deactivate-company" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={submitDeactivateCompany} loading={isMutatingAction}>
                Deactivate Company
              </Button>
            </>
          ) : dialog.kind === "add-department" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={submitAddDepartment} loading={isMutatingAction}>
                Add Department
              </Button>
            </>
          ) : dialog.kind === "edit-department" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={submitEditDepartment} loading={isMutatingAction}>
                Save
              </Button>
            </>
          ) : dialog.kind === "toggle-department" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="secondary" onClick={submitToggleDepartment} loading={isMutatingAction}>
                {dialog?.nextIsActive ? "Enable" : "Disable"}
              </Button>
            </>
          ) : dialog.kind === "deactivate-department" ? (
            <>
              <Button type="button" variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={submitDeactivateDepartment} loading={isMutatingAction}>
                Deactivate Department
              </Button>
            </>
          ) : null
        }
      >
        {dialog.kind === "add-company" || dialog.kind === "edit-company" ? (
          <div className="d-flex flex-column gap-3">
            <div>
              <label className="form-label mb-1">Company Name</label>
              <Input
                value={companyDraft.name}
                onChange={(event) =>
                  setCompanyDraft((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="Enter company name"
                autoFocus
              />
            </div>
            <div>
              <label className="form-label mb-1">Short Name</label>
              <Input
                value={companyDraft.shortName}
                onChange={(event) =>
                  setCompanyDraft((previous) => ({
                    ...previous,
                    shortName: event.target.value,
                  }))
                }
                placeholder="Enter short name"
              />
            </div>
            <div>
              <label className="form-label mb-1">Email</label>
              <Input
                value={companyDraft.email}
                onChange={(event) =>
                  setCompanyDraft((previous) => ({
                    ...previous,
                    email: event.target.value,
                  }))
                }
                placeholder="Enter company email"
              />
            </div>
            <div>
              <label className="form-label mb-1">Phone</label>
              <Input
                value={companyDraft.phone}
                onChange={(event) =>
                  setCompanyDraft((previous) => ({
                    ...previous,
                    phone: event.target.value,
                  }))
                }
                placeholder="Enter company phone"
              />
            </div>
          </div>
        ) : null}

        {dialog.kind === "add-department" || dialog.kind === "edit-department" ? (
          <div className="d-flex flex-column gap-3">
            {dialog.kind === "add-department" ? (
              <div className="small text-muted">
                Creating department for <strong>{dialog?.target?.comp_name || "selected company"}</strong>
              </div>
            ) : null}
            <div>
              <label className="form-label mb-1">Department Name</label>
              <Input
                value={departmentDraft.name}
                onChange={(event) =>
                  setDepartmentDraft((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="Enter department name"
                autoFocus
              />
            </div>
            <div>
              <label className="form-label mb-1">Short Name</label>
              <Input
                value={departmentDraft.shortName}
                onChange={(event) =>
                  setDepartmentDraft((previous) => ({
                    ...previous,
                    shortName: event.target.value,
                  }))
                }
                placeholder="Enter short name"
              />
            </div>
          </div>
        ) : null}

        {dialog.kind === "toggle-company" ? (
          <p className="mb-0">
            {dialog?.nextIsActive ? "Enable" : "Disable"} company <strong>{dialog?.target?.comp_name || ""}</strong>?
          </p>
        ) : null}

        {dialog.kind === "toggle-department" ? (
          <p className="mb-0">
            {dialog?.nextIsActive ? "Enable" : "Disable"} department <strong>{dialog?.target?.dept_name || ""}</strong>?
          </p>
        ) : null}

        {dialog.kind === "deactivate-company" ? (
          <p className="mb-0 text-danger">
            Deactivate company <strong>{dialog?.target?.comp_name || ""}</strong> and all linked departments?
          </p>
        ) : null}

        {dialog.kind === "deactivate-department" ? (
          <p className="mb-0 text-danger">
            Deactivate department <strong>{dialog?.target?.dept_name || ""}</strong>?
          </p>
        ) : null}
      </Modal>
    </main>
  );
}
