/**
 * Company Department Setup Service
 * Contains business/orchestration logic for company and department setup workflows.
 */

import {
  createCompany,
  deleteCompanyById,
  fetchCompanies,
  fetchCompanyById,
  updateCompanyById,
} from "../repo/companies.repo.js";
import {
  createDepartment,
  deleteDepartmentById,
  fetchAllDepartments,
  fetchDepartmentsByCompanyId,
  updateDepartmentById,
} from "../repo/departments.repo.js";

const COMPANY_NAME_FIELDS = ["comp_name", "company_name", "name"];
const COMPANY_SHORT_NAME_FIELDS = ["comp_short_name", "short_name", "comp_short", "abbr"];
const COMPANY_EMAIL_FIELDS = ["comp_email", "company_email", "email"];
const COMPANY_PHONE_FIELDS = ["comp_phone", "company_phone", "phone"];

const DEPARTMENT_NAME_FIELDS = ["dept_name", "department_name", "name"];
const DEPARTMENT_SHORT_NAME_FIELDS = ["dept_short_name", "short_name", "dept_short", "abbr"];

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

function normalizeText(value, fallback = "") {
  const text = String(value ?? fallback).trim();
  return text;
}

function sanitizeOptionalText(value) {
  const text = normalizeText(value);
  return text === "" ? null : text;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return false;
  return !(text === "false" || text === "0" || text === "n" || text === "no" || text === "f");
}

function resolveWritableField(row, candidates, fallback = null) {
  for (const candidate of candidates) {
    if (row && hasOwn(row, candidate)) {
      return candidate;
    }
  }

  return fallback;
}

function normalizeEntityId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const asNumber = Number(text);
  return Number.isFinite(asNumber) ? asNumber : text;
}

function buildCompanyPayloadFromInput(input, sampleRow) {
  const payload = {};

  const nameField = resolveWritableField(sampleRow, COMPANY_NAME_FIELDS, "comp_name");
  const shortField = resolveWritableField(sampleRow, COMPANY_SHORT_NAME_FIELDS, null);
  const emailField = resolveWritableField(sampleRow, COMPANY_EMAIL_FIELDS, "comp_email");
  const phoneField = resolveWritableField(sampleRow, COMPANY_PHONE_FIELDS, "comp_phone");

  if (hasOwn(input, "comp_name")) {
    const name = normalizeText(input.comp_name);
    if (!name) {
      throw new Error("Company name is required.");
    }

    if (!nameField) {
      throw new Error("Unable to resolve company name field.");
    }

    payload[nameField] = name;
  }

  if (hasOwn(input, "comp_short_name") && shortField) {
    payload[shortField] = sanitizeOptionalText(input.comp_short_name);
  }

  if (hasOwn(input, "comp_email") && emailField) {
    payload[emailField] = sanitizeOptionalText(input.comp_email);
  }

  if (hasOwn(input, "comp_phone") && phoneField) {
    payload[phoneField] = sanitizeOptionalText(input.comp_phone);
  }

  if (hasOwn(input, "is_active")) {
    payload.is_active = normalizeBoolean(input.is_active);
  }

  return payload;
}

function buildDepartmentPayloadFromInput(input, sampleRow) {
  const payload = {};

  const nameField = resolveWritableField(sampleRow, DEPARTMENT_NAME_FIELDS, "dept_name");
  const shortField = resolveWritableField(sampleRow, DEPARTMENT_SHORT_NAME_FIELDS, null);

  if (hasOwn(input, "dept_name")) {
    const departmentName = normalizeText(input.dept_name);
    if (!departmentName) {
      throw new Error("Department name is required.");
    }

    if (!nameField) {
      throw new Error("Unable to resolve department name field.");
    }

    payload[nameField] = departmentName;
  }

  if (hasOwn(input, "dept_short_name") && shortField) {
    payload[shortField] = sanitizeOptionalText(input.dept_short_name);
  }

  if (hasOwn(input, "is_active")) {
    payload.is_active = normalizeBoolean(input.is_active);
  }

  if (hasOwn(input, "comp_id")) {
    payload.comp_id = normalizeEntityId(input.comp_id);
  }

  return payload;
}

function assertValidPayload(payload, message) {
  if (!payload || Object.keys(payload).length === 0) {
    throw new Error(message);
  }
}

export async function getCompanyList(supabase) {
  return fetchCompanies(supabase);
}

export async function getDepartmentList(supabase) {
  return fetchAllDepartments(supabase);
}

export function buildCompanyDepartmentSetupViewModel(companies, departments) {
  const safeCompanies = Array.isArray(companies) ? companies : [];
  const safeDepartments = Array.isArray(departments) ? departments : [];

  const selectedCompany = safeCompanies[0] || null;
  const selectedCompanyId = selectedCompany?.comp_id;

  const companyDepartments = selectedCompany
    ? safeDepartments.filter((department) => String(department.comp_id || "") === String(selectedCompanyId || ""))
    : [];

  return {
    companies: safeCompanies,
    departments: safeDepartments,
    selectedCompany,
    selectedCompanyId,
    companyDepartments,
  };
}

export async function getCompanyDepartmentSetupViewModel(supabase) {
  const companies = await getCompanyList(supabase);
  const departments = await getDepartmentList(supabase);

  return buildCompanyDepartmentSetupViewModel(companies, departments);
}

export async function updateCompanyRecord(supabase, companyId, updates) {
  const existing = await fetchCompanyById(supabase, companyId);
  const payload = buildCompanyPayloadFromInput(updates, existing);

  assertValidPayload(payload, "No valid company updates supplied.");

  return updateCompanyById(supabase, companyId, payload);
}

export async function deleteCompanyRecord(supabase, companyId) {
  const departments = await fetchDepartmentsByCompanyId(supabase, companyId);

  for (const department of departments) {
    await deleteDepartmentById(supabase, department.dept_id);
  }

  await deleteCompanyById(supabase, companyId);

  return {
    companyId,
    deactivatedDepartmentCount: departments.length,
    deactivated: true,
    deleted: true,
  };
}

export async function createCompanyRecord(supabase, payload) {
  const companies = await fetchCompanies(supabase);
  const sample = companies[0] || null;

  const createPayload = buildCompanyPayloadFromInput(
    {
      comp_name: payload?.comp_name,
      comp_short_name: payload?.comp_short_name,
      comp_email: payload?.comp_email,
      comp_phone: payload?.comp_phone,
      is_active: hasOwn(payload || {}, "is_active") ? payload?.is_active : true,
    },
    sample,
  );

  if (!hasOwn(createPayload, "is_active")) {
    createPayload.is_active = true;
  }

  assertValidPayload(createPayload, "No valid company payload supplied.");

  return createCompany(supabase, createPayload);
}

export async function updateDepartmentRecord(supabase, departmentId, updates) {
  const existingDepartments = await fetchAllDepartments(supabase);
  const existing = existingDepartments.find((department) => String(department?.dept_id) === String(departmentId)) || null;

  if (!existing) {
    throw new Error("Department not found.");
  }

  const payload = buildDepartmentPayloadFromInput(updates, existing);
  delete payload.comp_id;

  assertValidPayload(payload, "No valid department updates supplied.");

  return updateDepartmentById(supabase, departmentId, payload);
}

export async function deleteDepartmentRecord(supabase, departmentId) {
  await deleteDepartmentById(supabase, departmentId);

  return {
    departmentId,
    deactivated: true,
    deleted: true,
  };
}

export async function createDepartmentRecord(supabase, payload) {
  const companyId = normalizeEntityId(payload?.comp_id);

  if (companyId === null) {
    throw new Error("Company id is required.");
  }

  await fetchCompanyById(supabase, companyId);

  const departments = await fetchAllDepartments(supabase);
  const sample = departments[0] || null;

  const createPayload = buildDepartmentPayloadFromInput(
    {
      comp_id: companyId,
      dept_name: payload?.dept_name,
      dept_short_name: payload?.dept_short_name,
      is_active: hasOwn(payload || {}, "is_active") ? payload?.is_active : true,
    },
    sample,
  );

  createPayload.comp_id = companyId;

  if (!hasOwn(createPayload, "is_active")) {
    createPayload.is_active = true;
  }

  assertValidPayload(createPayload, "No valid department payload supplied.");

  return createDepartment(supabase, createPayload);
}
