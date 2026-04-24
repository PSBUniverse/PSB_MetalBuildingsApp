/**
 * Status Setup Service
 * Contains business/orchestration logic for status setup workflows.
 */

import {
  createStatus,
  deleteStatusById,
  hardDeleteStatusById,
  fetchStatuses,
  fetchStatusById,
  updateStatusById,
} from "../repo/statuses.repo.js";

const STATUS_NAME_FIELDS = ["sts_name", "status_name", "name"];
const STATUS_DESC_FIELDS = ["sts_desc", "status_desc", "description"];

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

function buildStatusPayloadFromInput(input, sampleRow) {
  const payload = {};

  const nameField = resolveWritableField(sampleRow, STATUS_NAME_FIELDS, "sts_name");
  const descField = resolveWritableField(sampleRow, STATUS_DESC_FIELDS, "sts_desc");

  if (hasOwn(input, "sts_name")) {
    const name = normalizeText(input.sts_name);
    if (!name) {
      throw new Error("Status name is required.");
    }

    if (!nameField) {
      throw new Error("Unable to resolve status name field.");
    }

    payload[nameField] = name;
  }

  if (hasOwn(input, "sts_desc") && descField) {
    payload[descField] = sanitizeOptionalText(input.sts_desc);
  }

  if (hasOwn(input, "is_active")) {
    payload.is_active = normalizeBoolean(input.is_active);
  }

  return payload;
}

function assertValidPayload(payload, message) {
  if (!payload || Object.keys(payload).length === 0) {
    throw new Error(message);
  }
}

export async function getStatusList(supabase) {
  return fetchStatuses(supabase);
}

export async function getStatusSetupViewModel(supabase) {
  const statuses = await getStatusList(supabase);

  return {
    statuses: Array.isArray(statuses) ? statuses : [],
  };
}

export async function updateStatusRecord(supabase, statusId, updates) {
  const existing = await fetchStatusById(supabase, statusId);
  const payload = buildStatusPayloadFromInput(updates, existing);

  assertValidPayload(payload, "No valid status updates supplied.");

  return updateStatusById(supabase, statusId, payload);
}

export async function deleteStatusRecord(supabase, statusId) {
  await deleteStatusById(supabase, statusId);

  return {
    statusId,
    deactivated: true,
    deleted: true,
  };
}

export async function hardDeleteStatusRecord(supabase, statusId) {
  await hardDeleteStatusById(supabase, statusId);

  return {
    statusId,
    permanentlyDeleted: true,
  };
}

export async function createStatusRecord(supabase, payload) {
  const statuses = await fetchStatuses(supabase);
  const sample = statuses[0] || null;

  const createPayload = buildStatusPayloadFromInput(
    {
      sts_name: payload?.sts_name,
      sts_desc: payload?.sts_desc,
      is_active: hasOwn(payload || {}, "is_active") ? payload?.is_active : true,
    },
    sample,
  );

  if (!hasOwn(createPayload, "is_active")) {
    createPayload.is_active = true;
  }

  assertValidPayload(createPayload, "No valid status payload supplied.");

  return createStatus(supabase, createPayload);
}
