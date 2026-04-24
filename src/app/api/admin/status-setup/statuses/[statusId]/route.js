import { NextResponse } from "next/server";
import { getSupabase } from "@/modules/admin/status-setup/utils/supabase.js";
import {
  deleteStatusRecord,
  hardDeleteStatusRecord,
  updateStatusRecord,
} from "@/modules/admin/status-setup/services/statusSetup.service.js";

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

function extractStatusUpdates(body) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body || {}, "sts_name")) {
    payload.sts_name = body.sts_name;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "sts_desc")) {
    payload.sts_desc = body.sts_desc;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "is_active")) {
    payload.is_active = body.is_active;
  }

  return payload;
}

export async function PATCH(request, context) {
  try {
    const params = await context.params;
    const statusId = normalizeId(params?.statusId);

    if (statusId === null) {
      throw new Error("Invalid status id.");
    }

    const body = await request.json().catch(() => ({}));
    const updates = extractStatusUpdates(body);

    const supabase = await getSupabase();
    const updated = await updateStatusRecord(supabase, statusId, updates);

    return NextResponse.json(
      {
        ok: true,
        status: updated,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update status.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

export async function DELETE(request, context) {
  try {
    const params = await context.params;
    const statusId = normalizeId(params?.statusId);

    if (statusId === null) {
      throw new Error("Invalid status id.");
    }

    const url = new URL(request.url);
    const permanent = url.searchParams.get("permanent") === "true";

    const supabase = await getSupabase();
    const result = permanent
      ? await hardDeleteStatusRecord(supabase, statusId)
      : await deleteStatusRecord(supabase, statusId);

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
        error: error?.message || "Failed to delete status.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
