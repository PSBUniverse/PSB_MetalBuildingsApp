import { NextResponse } from "next/server";
import { getSupabase } from "@/modules/company-department-setup/utils/supabase.js";
import {
  deleteCompanyRecord,
  updateCompanyRecord,
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

function extractCompanyUpdates(body) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body || {}, "comp_name")) {
    payload.comp_name = body.comp_name;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "comp_short_name")) {
    payload.comp_short_name = body.comp_short_name;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "comp_email")) {
    payload.comp_email = body.comp_email;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "comp_phone")) {
    payload.comp_phone = body.comp_phone;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "is_active")) {
    payload.is_active = body.is_active;
  }

  return payload;
}

export async function PATCH(request, context) {
  try {
    const params = await context.params;
    const companyId = normalizeId(params?.companyId);

    if (companyId === null) {
      throw new Error("Invalid company id.");
    }

    const body = await request.json().catch(() => ({}));
    const updates = extractCompanyUpdates(body);

    const supabase = await getSupabase();
    const updated = await updateCompanyRecord(supabase, companyId, updates);

    return NextResponse.json(
      {
        ok: true,
        company: updated,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update company.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

export async function DELETE(request, context) {
  try {
    const params = await context.params;
    const companyId = normalizeId(params?.companyId);

    if (companyId === null) {
      throw new Error("Invalid company id.");
    }

    const supabase = await getSupabase();
    const result = await deleteCompanyRecord(supabase, companyId);

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
        error: error?.message || "Failed to deactivate company.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
