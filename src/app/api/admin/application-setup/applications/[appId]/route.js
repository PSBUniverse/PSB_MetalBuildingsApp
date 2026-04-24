import { NextResponse } from "next/server";
import { getSupabase } from "@/modules/admin/application-setup/utils/supabase.js";
import {
  deleteApplicationRecord,
  hardDeleteApplicationRecord,
  updateApplicationRecord,
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

function extractAppUpdates(body) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body || {}, "app_name")) {
    payload.app_name = body.app_name;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "app_desc")) {
    payload.app_desc = body.app_desc;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "is_active")) {
    payload.is_active = body.is_active;
  }

  return payload;
}

export async function PATCH(request, context) {
  try {
    const params = await context.params;
    const appId = normalizeId(params?.appId);

    if (appId === null) {
      throw new Error("Invalid application id.");
    }

    const body = await request.json().catch(() => ({}));
    const updates = extractAppUpdates(body);

    const supabase = await getSupabase();
    const updated = await updateApplicationRecord(supabase, appId, updates);

    return NextResponse.json(
      {
        ok: true,
        application: updated,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update application.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

export async function DELETE(request, context) {
  try {
    const params = await context.params;
    const appId = normalizeId(params?.appId);

    if (appId === null) {
      throw new Error("Invalid application id.");
    }

    const url = new URL(request.url);
    const permanent = url.searchParams.get("permanent") === "true";

    const supabase = await getSupabase();
    const result = permanent
      ? await hardDeleteApplicationRecord(supabase, appId)
      : await deleteApplicationRecord(supabase, appId);

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
        error: error?.message || "Failed to delete application.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
