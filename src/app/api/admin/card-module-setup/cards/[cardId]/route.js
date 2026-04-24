import { NextResponse } from "next/server";
import { getSupabase } from "@/modules/admin/card-module-setup/utils/supabase.js";
import {
  deleteCardRecord,
  hardDeleteCardRecord,
  updateCardRecord,
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

function extractCardUpdates(body) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(body || {}, "card_name")) {
    payload.card_name = body.card_name;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "card_desc")) {
    payload.card_desc = body.card_desc;
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "route_path")) {
    payload.route_path = body.route_path;
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
    const cardId = normalizeId(params?.cardId);

    if (cardId === null) {
      throw new Error("Invalid card id.");
    }

    const body = await request.json().catch(() => ({}));
    const updates = extractCardUpdates(body);

    const supabase = await getSupabase();
    const updated = await updateCardRecord(supabase, cardId, updates);

    return NextResponse.json(
      {
        ok: true,
        card: updated,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update card.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

export async function DELETE(request, context) {
  try {
    const params = await context.params;
    const cardId = normalizeId(params?.cardId);

    if (cardId === null) {
      throw new Error("Invalid card id.");
    }

    const url = new URL(request.url);
    const permanent = url.searchParams.get("permanent") === "true";

    const supabase = await getSupabase();
    const result = permanent
      ? await hardDeleteCardRecord(supabase, cardId)
      : await deleteCardRecord(supabase, cardId);

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
        error: error?.message || "Failed to delete card.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
