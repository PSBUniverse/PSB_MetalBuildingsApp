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
  const [isSavingBatch, setIsSavingBatch] = useState(false);
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
    setIsSavingBatch(false);

    const queryCompanyId = parseCompanyId(searchParams?.get("company"));
    const nextSelected =
      queryCompanyId
      ?? initialSelectedCompanyId
      ?? seedCompanies[0]?.comp_id
      ?? null;

    setSelectedCompanyId(nextSelected);
  }, [initialSelectedCompanyId, searchParams, seedCompanies, seedDepartments]);

  const pendingSummary = useMemo(() => {
    const companyAdded = companyChanges.creates.length;
    const companyEdited = Object.keys(companyChanges.updates || {}).length;
    const companyDeactivated = companyChanges.deactivations.length;
    const departmentAdded = departmentChanges.creates.length;
    const departmentEdited = Object.keys(departmentChanges.updates || {}).length;
    const departmentDeactivated = departmentChanges.deactivations.length;

    return {
      companyAdded,
      companyEdited,
      companyDeactivated,
      departmentAdded,
      departmentEdited,
      departmentDeactivated,
      total:
        companyAdded
        + companyEdited
        + companyDeactivated
        + departmentAdded
        + departmentEdited
        + departmentDeactivated,
    };
  }, [companyChanges, departmentChanges]);

  const hasPendingChanges = pendingSummary.total > 0;

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
          __batchState: "deleted",
        };
      }

      if (createdIds.has(id)) {
        return {
          ...row,
          __batchState: "created",
        };
      }

      if (updatedIds.has(id)) {
        return {
          ...row,
          __batchState: "updated",
        };
      }

      return {
        ...row,
        __batchState: "none",
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
          __batchState: "deleted",
        };
      }

      if (createdIds.has(id)) {
        return {
          ...row,
          __batchState: "created",
        };
      }

      if (updatedIds.has(id)) {
        return {
          ...row,
          __batchState: "updated",
        };
      }

      return {
        ...row,
        __batchState: "none",
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
    if (isMutatingAction || isSavingBatch) {
      return;
    }

    setDialog(EMPTY_DIALOG);
  }, [isMutatingAction, isSavingBatch]);

  const handleCompanyRowClick = useCallback(
    (row) => {
      if (isMutatingAction || isSavingBatch) {
        return;
      }

      const nextCompanyId = row?.comp_id;

      if (isSameId(nextCompanyId, selectedCompany?.comp_id)) {
        return;
      }

      updateSelectedCompanyInQuery(nextCompanyId);
    },
    [
      isMutatingAction,
      isSavingBatch,
      selectedCompany?.comp_id,
      updateSelectedCompanyInQuery,
    ],
  );

  const handleCancelBatch = useCallback(() => {
    if (isMutatingAction || isSavingBatch) {
      return;
    }

    if (!hasPendingChanges) {
      return;
    }

    setOrderedCompanies(seedCompanies);
    setAllDepartments(seedDepartments);
    setCompanyChanges(createEmptyCompanyChanges());
    setDepartmentChanges(createEmptyDepartmentChanges());
    setDialog(EMPTY_DIALOG);
    setCompanyDraft({ name: "", shortName: "", email: "", phone: "" });
    setDepartmentDraft({ name: "", shortName: "" });

    const fallbackCompanyId = seedCompanies[0]?.comp_id ?? null;
    updateSelectedCompanyInQuery(fallbackCompanyId);
    toastSuccess("Batch changes canceled.", "Batching");
  }, [
    hasPendingChanges,
    isMutatingAction,
    isSavingBatch,
    seedCompanies,
    seedDepartments,
    updateSelectedCompanyInQuery,
  ]);

  const handleSaveBatch = useCallback(async () => {
    if (!hasPendingChanges || isSavingBatch || isMutatingAction) {
      return;
    }

    setIsSavingBatch(true);
    setIsMutatingAction(true);

    try {
      const companyIdMap = new Map();
      const deactivatedCompanySet = new Set((companyChanges.deactivations || []).map((id) => String(id ?? "")));
      const deactivatedDepartmentSet = new Set((departmentChanges.deactivations || []).map((id) => String(id ?? "")));

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
        const resolvedCompanyId = companyIdMap.get(String(companyId)) ?? companyId;

        if (deactivatedCompanySet.has(String(resolvedCompanyId))) {
          continue;
        }

        if (isTempCompanyId(resolvedCompanyId)) {
          continue;
        }

        const updateKeys = Object.keys(updates || {});
        if (updateKeys.length === 0) {
          continue;
        }

        await requestJson(
          `/api/company-department-setup/companies/${encodeURIComponent(String(resolvedCompanyId))}`,
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
        const resolvedCompanyId = companyIdMap.get(String(companyId)) ?? companyId;

        if (isTempCompanyId(resolvedCompanyId)) {
          continue;
        }

        await requestJson(
          `/api/company-department-setup/companies/${encodeURIComponent(String(resolvedCompanyId))}`,
          {
            method: "DELETE",
          },
          "Failed to deactivate company.",
        );
      }

      const remappedDepartmentCreates = remapDepartmentCreatesByCompanyId(departmentChanges.creates, companyIdMap);
      const hasTempCompanyReference = remappedDepartmentCreates.some((entry) => isTempCompanyId(entry?.payload?.comp_id));

      if (hasTempCompanyReference) {
        throw new Error("Save company batch first before saving departments for a newly created company.");
      }

      for (const createEntry of remappedDepartmentCreates) {
        const resolvedCompanyId = createEntry?.payload?.comp_id;

        if (deactivatedCompanySet.has(String(resolvedCompanyId ?? ""))) {
          continue;
        }

        await requestJson(
          "/api/company-department-setup/departments",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...(createEntry.payload || {}),
              comp_id: resolvedCompanyId,
            }),
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

        const resolvedCompanyId = Object.prototype.hasOwnProperty.call(updates || {}, "comp_id")
          ? (companyIdMap.get(String(updates?.comp_id ?? "")) ?? updates?.comp_id)
          : undefined;

        if (resolvedCompanyId !== undefined && deactivatedCompanySet.has(String(resolvedCompanyId ?? ""))) {
          continue;
        }

        const payload = resolvedCompanyId === undefined
          ? updates
          : {
            ...updates,
            comp_id: resolvedCompanyId,
          };

        await requestJson(
          `/api/company-department-setup/departments/${encodeURIComponent(String(departmentId))}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
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

      if (companyIdMap.size > 0) {
        setAllDepartments((previous) => remapDepartmentsByCompanyId(previous, companyIdMap));
      }

      setCompanyChanges(createEmptyCompanyChanges());
      setDepartmentChanges(createEmptyDepartmentChanges());

      const orderedPersistedCompanyIds = orderedCompanies
        .map((company) => companyIdMap.get(String(company?.comp_id ?? "")) ?? company?.comp_id)
        .filter((companyId) => companyId !== undefined && companyId !== null && companyId !== "")
        .filter((companyId) => !deactivatedCompanySet.has(String(companyId)))
        .filter((companyId) => !isTempCompanyId(companyId));

      const selectedResolved = companyIdMap.get(String(selectedCompany?.comp_id ?? "")) ?? selectedCompany?.comp_id ?? null;
      const nextSelectedCompanyId =
        selectedResolved
        && !deactivatedCompanySet.has(String(selectedResolved))
        && !isTempCompanyId(selectedResolved)
          ? selectedResolved
          : (orderedPersistedCompanyIds[0] ?? null);

      updateSelectedCompanyInQuery(nextSelectedCompanyId);
      router.refresh();
      toastSuccess(`Saved ${pendingSummary.total} batched change(s).`, "Save Batch");
    } catch (error) {
      toastError(error?.message || "Failed to save batched changes.");
    } finally {
      setIsMutatingAction(false);
      setIsSavingBatch(false);
    }
  }, [
    companyChanges.creates,
    companyChanges.deactivations,
    companyChanges.updates,
    departmentChanges.creates,
    departmentChanges.deactivations,
    departmentChanges.updates,
    hasPendingChanges,
    isMutatingAction,
    isSavingBatch,
    orderedCompanies,
    pendingSummary.total,
    requestJson,
    router,
    selectedCompany?.comp_id,
    updateSelectedCompanyInQuery,
  ]);

  const openAddCompanyDialog = useCallback(() => {
    if (isMutatingAction || isSavingBatch) {
      return;
    }

    setCompanyDraft({ name: "", shortName: "", email: "", phone: "" });
    setDialog({ kind: "add-company", target: null, nextIsActive: true });
  }, [isMutatingAction, isSavingBatch]);

  const openEditCompanyDialog = useCallback((row) => {
    if (isMutatingAction || isSavingBatch) {
      return;
    }

    setCompanyDraft({
      name: String(row?.comp_name || ""),
      shortName: String(row?.comp_short_name || ""),
      email: String(row?.comp_email || ""),
      phone: String(row?.comp_phone || ""),
    });

    setDialog({ kind: "edit-company", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingBatch]);

  const openToggleCompanyDialog = useCallback((row) => {
    if (isMutatingAction || isSavingBatch) {
      return;
    }

    setDialog({ kind: "toggle-company", target: row, nextIsActive: !Boolean(row?.is_active_bool) });
  }, [isMutatingAction, isSavingBatch]);

  const openDeactivateCompanyDialog = useCallback((row) => {
    if (isMutatingAction || isSavingBatch) {
      return;
    }

    setDialog({ kind: "deactivate-company", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingBatch]);

  const openAddDepartmentDialog = useCallback(() => {
    if (isMutatingAction || isSavingBatch) {
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
    isSavingBatch,
    isSelectedCompanyPendingDeactivation,
    selectedCompany?.comp_id,
    selectedCompany?.comp_name,
  ]);

  const openEditDepartmentDialog = useCallback((row) => {
    if (isMutatingAction || isSavingBatch) {
      return;
    }

    setDepartmentDraft({
      name: String(row?.dept_name || ""),
      shortName: String(row?.dept_short_name || ""),
    });

    setDialog({ kind: "edit-department", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingBatch]);

  const openToggleDepartmentDialog = useCallback((row) => {
    if (isMutatingAction || isSavingBatch) {
      return;
    }

    setDialog({ kind: "toggle-department", target: row, nextIsActive: !Boolean(row?.is_active_bool) });
  }, [isMutatingAction, isSavingBatch]);

  const openDeactivateDepartmentDialog = useCallback((row) => {
    if (isMutatingAction || isSavingBatch) {
      return;
    }

    setDialog({ kind: "deactivate-department", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingBatch]);

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
            batchState === "deleted"
              ? "Deactivated"
              : (batchState === "created" ? "New" : (batchState === "updated" ? "Edited" : ""));
          const markerClass =
            batchState === "deleted"
              ? "psb-batch-marker psb-batch-marker-deleted"
              : (batchState === "created"
                ? "psb-batch-marker psb-batch-marker-new"
                : (batchState === "updated" ? "psb-batch-marker psb-batch-marker-edited" : ""));
          const textClassName = [
            isSameId(row?.comp_id, selectedCompany?.comp_id) ? "fw-semibold text-primary" : "",
            batchState === "deleted" ? "text-decoration-line-through" : "",
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
            batchState === "deleted"
              ? "Deactivated"
              : (batchState === "created" ? "New" : (batchState === "updated" ? "Edited" : ""));
          const markerClass =
            batchState === "deleted"
              ? "psb-batch-marker psb-batch-marker-deleted"
              : (batchState === "created"
                ? "psb-batch-marker psb-batch-marker-new"
                : (batchState === "updated" ? "psb-batch-marker psb-batch-marker-edited" : ""));

          return (
            <span className={batchState === "deleted" ? "text-decoration-line-through" : ""}>
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

  const companyActions = useMemo(
    () => [
      {
        key: "edit-company",
        label: "Edit",
        type: "secondary",
        icon: "pencil-square",
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedCompanyIds.has(String(row?.comp_id ?? ""));
          return isMutatingAction || isSavingBatch || isPendingDeactivation;
        },
        onClick: (row) => openEditCompanyDialog(row),
      },
      {
        key: "disable-company",
        label: "Disable",
        type: "secondary",
        icon: "slash-circle",
        visible: (row) => Boolean(row?.is_active_bool),
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedCompanyIds.has(String(row?.comp_id ?? ""));
          return isMutatingAction || isSavingBatch || isPendingDeactivation;
        },
        onClick: (row) => openToggleCompanyDialog(row),
      },
      {
        key: "enable-company",
        label: "Enable",
        type: "secondary",
        icon: "check-circle",
        visible: (row) => !Boolean(row?.is_active_bool),
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedCompanyIds.has(String(row?.comp_id ?? ""));
          return isMutatingAction || isSavingBatch || isPendingDeactivation;
        },
        onClick: (row) => openToggleCompanyDialog(row),
      },
      {
        key: "deactivate-company",
        label: "Deactivate",
        type: "danger",
        icon: "trash",
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedCompanyIds.has(String(row?.comp_id ?? ""));
          return isMutatingAction || isSavingBatch || isPendingDeactivation;
        },
        onClick: (row) => openDeactivateCompanyDialog(row),
      },
    ],
    [
      isMutatingAction,
      isSavingBatch,
      openDeactivateCompanyDialog,
      openEditCompanyDialog,
      openToggleCompanyDialog,
      pendingDeactivatedCompanyIds,
    ],
  );

  const departmentActions = useMemo(
    () => [
      {
        key: "edit-department",
        label: "Edit",
        type: "secondary",
        icon: "pencil-square",
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedDepartmentIds.has(String(row?.dept_id ?? ""));
          return isMutatingAction || isSavingBatch || isPendingDeactivation;
        },
        onClick: (row) => openEditDepartmentDialog(row),
      },
      {
        key: "disable-department",
        label: "Disable",
        type: "secondary",
        icon: "slash-circle",
        visible: (row) => Boolean(row?.is_active_bool),
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedDepartmentIds.has(String(row?.dept_id ?? ""));
          return isMutatingAction || isSavingBatch || isPendingDeactivation;
        },
        onClick: (row) => openToggleDepartmentDialog(row),
      },
      {
        key: "enable-department",
        label: "Enable",
        type: "secondary",
        icon: "check-circle",
        visible: (row) => !Boolean(row?.is_active_bool),
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedDepartmentIds.has(String(row?.dept_id ?? ""));
          return isMutatingAction || isSavingBatch || isPendingDeactivation;
        },
        onClick: (row) => openToggleDepartmentDialog(row),
      },
      {
        key: "deactivate-department",
        label: "Deactivate",
        type: "danger",
        icon: "trash",
        disabled: (row) => {
          const isPendingDeactivation = pendingDeactivatedDepartmentIds.has(String(row?.dept_id ?? ""));
          return isMutatingAction || isSavingBatch || isPendingDeactivation;
        },
        onClick: (row) => openDeactivateDepartmentDialog(row),
      },
    ],
    [
      isMutatingAction,
      isSavingBatch,
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

  return (
    <main className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1">Configuration and Settings</h1>
          <p className="text-muted mb-0">Manage setup tables and mapping assignments for Company-Department.</p>
        </div>
        <div className="d-flex flex-wrap align-items-center justify-content-end gap-2">
          <span className={`small ${hasPendingChanges ? "text-warning-emphasis fw-semibold" : "text-muted"}`}>
            {isMutatingAction || isSavingBatch
              ? "Saving batch..."
              : (hasPendingChanges ? `${pendingSummary.total} staged change(s)` : "No changes")}
          </span>
          {hasPendingChanges ? (
            <>
              {pendingSummary.companyAdded + pendingSummary.departmentAdded > 0 ? (
                <span className="psb-batch-chip psb-batch-chip-added">
                  +{pendingSummary.companyAdded + pendingSummary.departmentAdded} Added
                </span>
              ) : null}
              {pendingSummary.companyEdited + pendingSummary.departmentEdited > 0 ? (
                <span className="psb-batch-chip psb-batch-chip-edited">
                  ~{pendingSummary.companyEdited + pendingSummary.departmentEdited} Edited
                </span>
              ) : null}
              {pendingSummary.companyDeactivated + pendingSummary.departmentDeactivated > 0 ? (
                <span className="psb-batch-chip psb-batch-chip-deleted">
                  -{pendingSummary.companyDeactivated + pendingSummary.departmentDeactivated} Deactivated
                </span>
              ) : null}
            </>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={isSavingBatch}
            disabled={!hasPendingChanges || isSavingBatch || isMutatingAction}
            onClick={handleSaveBatch}
          >
            Save Batch
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!hasPendingChanges || isSavingBatch || isMutatingAction}
            onClick={handleCancelBatch}
          >
            Cancel Batch
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={isSavingBatch || isMutatingAction}
            onClick={openAddCompanyDialog}
          >
            Add Company
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={isSavingBatch || isMutatingAction || !selectedCompany?.comp_id || isSelectedCompanyPendingDeactivation}
            onClick={openAddDepartmentDialog}
          >
            Add Department
          </Button>
        </div>
      </div>

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-6">
          <Card title="Companies" subtitle="Master company records.">
            <SetupTable
              columns={companyColumns}
              rows={decoratedCompanies}
              rowIdKey="comp_id"
              selectedRowId={selectedCompany?.comp_id ?? null}
              onRowClick={handleCompanyRowClick}
              actions={companyActions}
              emptyMessage="No companies found."
            />
          </Card>
        </div>

        <div className="col-12 col-xl-6">
          <Card
            title={selectedCompany ? `Departments for: ${selectedCompany.comp_name}` : "Departments"}
            subtitle={selectedCompany ? "Company-scoped departments" : "Click a company row to view its departments."}
          >
            {selectedCompany ? (
              <SetupTable
                columns={departmentColumns}
                rows={decoratedDepartments}
                rowIdKey="dept_id"
                actions={departmentActions}
                emptyMessage="No departments found for this company."
              />
            ) : (
              <div className="notice-banner notice-banner-info mb-0">Click a company row to view its departments.</div>
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

