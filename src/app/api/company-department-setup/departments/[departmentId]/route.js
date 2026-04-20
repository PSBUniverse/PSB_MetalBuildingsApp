import { NextResponse } from "next/server";
import { getSupabase } from "@/modules/company-department-setup/utils/supabase.js";
import {
  deleteDepartmentRecord,
  updateDepartmentRecord,
} from "@/modules/company-department-setup/services/companyDepartmentSetup.service.js";

export const dynamic = "force-dynamic";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };
}

function normalizeId(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  const asNumber = Number(text);
  return Number.isFinite(asNumber) ? asNumber : text;
}

function extractDepartmentUpdates(body) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body || {}, "comp_id")) {
    payload.comp_id = body.comp_id;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "dept_name")) {
    payload.dept_name = body.dept_name;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "dept_short_name")) {
    payload.dept_short_name = body.dept_short_name;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "is_active")) {
    payload.is_active = body.is_active;
  }

  return payload;
}

export async function PATCH(request, context) {
  try {
    const params = await context.params;
    const departmentId = normalizeId(params?.departmentId);

    if (departmentId === null) {
      throw new Error("Invalid department id.");
    }

    const body = await request.json().catch(() => ({}));
    const updates = extractDepartmentUpdates(body);

    const supabase = await getSupabase();
    const updated = await updateDepartmentRecord(supabase, departmentId, updates);

    return NextResponse.json(
      {
        ok: true,
        department: updated,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update department.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

export async function DELETE(request, context) {
  try {
    const params = await context.params;
    const departmentId = normalizeId(params?.departmentId);

    if (departmentId === null) {
      throw new Error("Invalid department id.");
    }

    const supabase = await getSupabase();
    const result = await deleteDepartmentRecord(supabase, departmentId);

    return NextResponse.json(
      {
        ok: true,
        deleted: result,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to deactivate department.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
