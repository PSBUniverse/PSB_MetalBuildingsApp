import {
  getCompanyDisplayName, getCompanyEmail, getCompanyPhone,
  getCompanyShortName, isCompanyActive,
} from "@/modules/admin/company-department-setup/model/company.model.js";
import {
  getDepartmentDisplayName, getDepartmentShortName, isDepartmentActive,
} from "@/modules/admin/company-department-setup/model/department.model.js";

export function parseCompanyId(value) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  const asNumber = Number(text);
  return Number.isFinite(asNumber) ? asNumber : text;
}

export function isSameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

export function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, { sensitivity: "base", numeric: true });
}

export function normalizeText(value) {
  return String(value ?? "").trim();
}

function resolveErrorMessage(payload, fallbackMessage) {
  if (payload && typeof payload === "object" && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  return fallbackMessage;
}

export function mapCompanyRow(company, index) {
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

export function mapDepartmentRow(department, index) {
  return {
    ...department,
    id: department?.dept_id ?? `department-${index}`,
    dept_name: getDepartmentDisplayName(department),
    dept_short_name: getDepartmentShortName(department),
    is_active_bool: isDepartmentActive(department),
  };
}

export function removeObjectKey(objectValue, keyToRemove) {
  const normalizedKey = String(keyToRemove ?? "");
  const nextObject = {};
  Object.entries(objectValue || {}).forEach(([key, value]) => { if (key !== normalizedKey) nextObject[key] = value; });
  return nextObject;
}

export function mergeUpdatePatch(previousPatch, nextPatch) {
  const merged = { ...(previousPatch || {}) };
  Object.entries(nextPatch || {}).forEach(([key, value]) => { if (value !== undefined) merged[key] = value; });
  return merged;
}

export function appendUniqueId(idList, value) {
  const normalizedValue = String(value ?? "");
  if (!normalizedValue) return Array.isArray(idList) ? [...idList] : [];
  const existing = Array.isArray(idList) ? idList : [];
  if (existing.some((entry) => isSameId(entry, normalizedValue))) return [...existing];
  return [...existing, normalizedValue];
}

export const EMPTY_DIALOG = { kind: null, target: null, nextIsActive: null };
export const TEMP_COMPANY_PREFIX = "tmp-company-";
export const TEMP_DEPARTMENT_PREFIX = "tmp-department-";

export function createTempId(prefix) {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isTempCompanyId(value) { return String(value ?? "").startsWith(TEMP_COMPANY_PREFIX); }
export function isTempDepartmentId(value) { return String(value ?? "").startsWith(TEMP_DEPARTMENT_PREFIX); }

export function createEmptyCompanyChanges() { return { creates: [], updates: {}, deactivations: [], hardDeletes: [] }; }
export function createEmptyDepartmentChanges() { return { creates: [], updates: {}, deactivations: [], hardDeletes: [] }; }

function remapDepartmentCreatesByCompanyId(creates, companyIdMap) {
  return (Array.isArray(creates) ? creates : []).map((entry) => {
    const sourceId = entry?.payload?.comp_id;
    const nextId = companyIdMap.get(String(sourceId ?? "")) ?? sourceId;
    return { ...entry, payload: { ...(entry?.payload || {}), comp_id: nextId } };
  });
}

export function remapDepartmentsByCompanyId(departments, companyIdMap) {
  return (Array.isArray(departments) ? departments : []).map((department, index) => {
    const sourceId = department?.comp_id;
    const nextId = companyIdMap.get(String(sourceId ?? "")) ?? sourceId;
    return mapDepartmentRow({ ...department, comp_id: nextId }, index);
  });
}

async function requestJson(url, options, fallbackMessage) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) throw new Error(resolveErrorMessage(payload, fallbackMessage));
  return payload;
}

export async function executeBatchSave(companyChanges, departmentChanges, orderedCompanies, selectedCompanyId) {
  const companyIdMap = new Map();
  const deactivatedCompanySet = new Set(
    [...(companyChanges.deactivations || []), ...(companyChanges.hardDeletes || [])].map((id) => String(id ?? "")),
  );
  const deactivatedDepartmentSet = new Set(
    [...(departmentChanges.deactivations || []), ...(departmentChanges.hardDeletes || [])].map((id) => String(id ?? "")),
  );

  for (const createEntry of companyChanges.creates || []) {
    const payload = await requestJson("/api/admin/company-department-setup/companies",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(createEntry.payload) },
      "Failed to create company.");
    const createdId = payload?.company?.comp_id;
    if (createdId == null || createdId === "") throw new Error("Created company response is invalid.");
    companyIdMap.set(String(createEntry.tempId), createdId);
  }

  for (const [companyId, updates] of Object.entries(companyChanges.updates || {})) {
    const resolvedId = companyIdMap.get(String(companyId)) ?? companyId;
    if (deactivatedCompanySet.has(String(resolvedId)) || isTempCompanyId(resolvedId)) continue;
    if (Object.keys(updates || {}).length === 0) continue;
    await requestJson(`/api/admin/company-department-setup/companies/${encodeURIComponent(String(resolvedId))}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) },
      "Failed to update company.");
  }

  for (const companyId of companyChanges.deactivations || []) {
    const resolvedId = companyIdMap.get(String(companyId)) ?? companyId;
    if (isTempCompanyId(resolvedId)) continue;
    await requestJson(`/api/admin/company-department-setup/companies/${encodeURIComponent(String(resolvedId))}`,
      { method: "DELETE" }, "Failed to deactivate company.");
  }

  const remappedDeptCreates = remapDepartmentCreatesByCompanyId(departmentChanges.creates, companyIdMap);
  if (remappedDeptCreates.some((e) => isTempCompanyId(e?.payload?.comp_id))) {
    throw new Error("Save company batch first before saving departments for a newly created company.");
  }

  for (const createEntry of remappedDeptCreates) {
    const resolvedCompId = createEntry?.payload?.comp_id;
    if (deactivatedCompanySet.has(String(resolvedCompId ?? ""))) continue;
    await requestJson("/api/admin/company-department-setup/departments",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(createEntry.payload || {}), comp_id: resolvedCompId }) },
      "Failed to create department.");
  }

  for (const [deptId, updates] of Object.entries(departmentChanges.updates || {})) {
    if (deactivatedDepartmentSet.has(String(deptId)) || isTempDepartmentId(deptId)) continue;
    if (Object.keys(updates || {}).length === 0) continue;
    const resolvedCompId = Object.prototype.hasOwnProperty.call(updates || {}, "comp_id")
      ? (companyIdMap.get(String(updates?.comp_id ?? "")) ?? updates?.comp_id) : undefined;
    if (resolvedCompId !== undefined && deactivatedCompanySet.has(String(resolvedCompId ?? ""))) continue;
    const payload = resolvedCompId === undefined ? updates : { ...updates, comp_id: resolvedCompId };
    await requestJson(`/api/admin/company-department-setup/departments/${encodeURIComponent(String(deptId))}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      "Failed to update department.");
  }

  for (const deptId of departmentChanges.deactivations || []) {
    if (isTempDepartmentId(deptId)) continue;
    await requestJson(`/api/admin/company-department-setup/departments/${encodeURIComponent(String(deptId))}`,
      { method: "DELETE" }, "Failed to deactivate department.");
  }

  for (const deptId of departmentChanges.hardDeletes || []) {
    if (isTempDepartmentId(deptId)) continue;
    await requestJson(`/api/admin/company-department-setup/departments/${encodeURIComponent(String(deptId))}?permanent=true`,
      { method: "DELETE" }, "Failed to permanently delete department.");
  }

  for (const companyId of companyChanges.hardDeletes || []) {
    const resolvedId = companyIdMap.get(String(companyId)) ?? companyId;
    if (isTempCompanyId(resolvedId)) continue;
    await requestJson(`/api/admin/company-department-setup/companies/${encodeURIComponent(String(resolvedId))}?permanent=true`,
      { method: "DELETE" }, "Failed to permanently delete company.");
  }

  const orderedPersistedCompanyIds = orderedCompanies
    .map((c) => companyIdMap.get(String(c?.comp_id ?? "")) ?? c?.comp_id)
    .filter((id) => id != null && id !== "")
    .filter((id) => !deactivatedCompanySet.has(String(id)) && !isTempCompanyId(id));

  const selectedResolved = companyIdMap.get(String(selectedCompanyId ?? "")) ?? selectedCompanyId ?? null;
  const nextSelectedCompanyId = selectedResolved && !deactivatedCompanySet.has(String(selectedResolved)) && !isTempCompanyId(selectedResolved)
    ? selectedResolved : (orderedPersistedCompanyIds[0] ?? null);

  return { companyIdMap, nextSelectedCompanyId };
}
