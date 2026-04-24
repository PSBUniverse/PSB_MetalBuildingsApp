import { NextResponse } from "next/server";
import { getSupabase } from "@/modules/admin/card-module-setup/utils/supabase.js";
import {
  deleteCardGroupRecord,
  hardDeleteCardGroupRecord,
  updateCardGroupRecord,
} from "@/modules/admin/card-module-setup/services/cardModuleSetup.service.js";

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

function extractGroupUpdates(body) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body || {}, "group_name")) {
    payload.group_name = body.group_name;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "group_desc")) {
    payload.group_desc = body.group_desc;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "icon")) {
    payload.icon = body.icon;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "is_active")) {
    payload.is_active = body.is_active;
  }

  return payload;
}

export async function PATCH(request, context) {
  try {
    const params = await context.params;
    const groupId = normalizeId(params?.groupId);

    if (groupId === null) {
      throw new Error("Invalid card group id.");
    }

    const body = await request.json().catch(() => ({}));
    const updates = extractGroupUpdates(body);

    const supabase = await getSupabase();
    const updated = await updateCardGroupRecord(supabase, groupId, updates);

    return NextResponse.json(
      {
        ok: true,
        cardGroup: updated,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update card group.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

export async function DELETE(request, context) {
  try {
    const params = await context.params;
    const groupId = normalizeId(params?.groupId);

    if (groupId === null) {
      throw new Error("Invalid card group id.");
    }

    const url = new URL(request.url);
    const permanent = url.searchParams.get("permanent") === "true";

    const supabase = await getSupabase();
    const result = permanent
      ? await hardDeleteCardGroupRecord(supabase, groupId)
      : await deleteCardGroupRecord(supabase, groupId);

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
        error: error?.message || "Failed to delete card group.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
