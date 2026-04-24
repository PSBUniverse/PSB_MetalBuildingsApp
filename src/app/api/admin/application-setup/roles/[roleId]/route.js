import { NextResponse } from "next/server";
import { getSupabase } from "@/modules/admin/application-setup/utils/supabase.js";
import {
  deleteRoleRecord,
  hardDeleteRoleRecord,
  updateRoleRecord,
} from "@/modules/admin/application-setup/services/applicationSetup.service.js";

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

function extractRoleUpdates(body) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body || {}, "role_name")) {
    payload.role_name = body.role_name;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "role_desc")) {
    payload.role_desc = body.role_desc;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "is_active")) {
    payload.is_active = body.is_active;
  }

  return payload;
}

export async function PATCH(request, context) {
  try {
    const params = await context.params;
    const roleId = normalizeId(params?.roleId);

    if (roleId === null) {
      throw new Error("Invalid role id.");
    }

    const body = await request.json().catch(() => ({}));
    const updates = extractRoleUpdates(body);

    const supabase = await getSupabase();
    const updated = await updateRoleRecord(supabase, roleId, updates);

    return NextResponse.json(
      {
        ok: true,
        role: updated,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update role.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

export async function DELETE(request, context) {
  try {
    const params = await context.params;
    const roleId = normalizeId(params?.roleId);

    if (roleId === null) {
      throw new Error("Invalid role id.");
    }

    const url = new URL(request.url);
    const permanent = url.searchParams.get("permanent") === "true";

    const supabase = await getSupabase();
    const result = permanent
      ? await hardDeleteRoleRecord(supabase, roleId)
      : await deleteRoleRecord(supabase, roleId);

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
        error: error?.message || "Failed to delete role.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
