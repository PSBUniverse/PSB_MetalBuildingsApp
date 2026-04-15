import { NextResponse } from "next/server";
import {
  ADMIN_ROLE_PERMISSION_MAP,
  requireActionPermission,
  toErrorResponse,
} from "@/modules/user-master/services/user-master-route-auth.service";

const SETUP_SECTION_CONFIG = {
  statuses: {
    tableName: "core_s_statuses",
    pkColumn: "status_id",
    payloadKey: "statuses",
    columns: [
      { key: "name", type: "text" },
      { key: "description", type: "text" },
    ],
  },
  colors: {
    tableName: "core_s_colors",
    pkColumn: "color_id",
    payloadKey: "colors",
    columns: [{ key: "name", type: "text" }],
  },
  manufacturers: {
    tableName: "core_s_manufacturers",
    pkColumn: "manufacturer_id",
    payloadKey: "manufacturers",
    columns: [
      { key: "name", type: "text" },
      { key: "rate", type: "number" },
    ],
  },
  "leaf-guard": {
    tableName: "core_s_leaf_guards",
    pkColumn: "leaf_guard_id",
    payloadKey: "leafGuards",
    columns: [
      { key: "name", type: "text" },
      { key: "price", type: "number" },
    ],
  },
  discounts: {
    tableName: "core_s_discounts",
    pkColumn: "discount_id",
    payloadKey: "discounts",
    columns: [
      { key: "percentage", type: "number" },
      { key: "description", type: "text" },
    ],
  },
  "trip-fee-rates": {
    tableName: "core_s_trip_rates",
    pkColumn: "trip_id",
    payloadKey: "tripRates",
    columns: [
      { key: "label", type: "text" },
      { key: "rate", type: "number" },
    ],
  },
};

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function asNumber(value) {
  if (!hasValue(value)) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getAdminAppKey(request) {
  const { searchParams } = new URL(request.url);
  return (
    String(searchParams.get("appKey") || "").trim() ||
    String(process.env.USER_MASTER_ADMIN_APP_KEY || "").trim() ||
    null
  );
}

function normalizeRows(rows, columns) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const source = row && typeof row === "object" ? row : {};
      const cleaned = {};

      columns.forEach((column) => {
        if (column.type === "number") {
          cleaned[column.key] = asNumber(source[column.key]);
          return;
        }

        cleaned[column.key] = String(source[column.key] ?? "").trim();
      });

      return cleaned;
    })
    .filter((row) =>
      columns.some((column) => {
        const value = row[column.key];
        if (column.type === "number") {
          return Number.isFinite(Number(value));
        }

        return hasValue(value);
      })
    );
}

export async function GET(request) {
  try {
    const gate = await requireActionPermission({
      action: "read",
      appKey: getAdminAppKey(request),
      rolePermissionMap: ADMIN_ROLE_PERMISSION_MAP,
    });

    if (gate.error) return gate.error;

    const entries = Object.entries(SETUP_SECTION_CONFIG);
    const settled = await Promise.allSettled(
      entries.map(([, config]) =>
        gate.context.supabaseClient
          .from(config.tableName)
          .select("*")
          .order(config.pkColumn, { ascending: true })
      )
    );

    const payload = {
      statuses: [],
      colors: [],
      manufacturers: [],
      leafGuards: [],
      discounts: [],
      tripRates: [],
      sourceErrors: [],
    };

    settled.forEach((result, index) => {
      const sectionConfig = entries[index][1];

      if (result.status === "fulfilled" && !result.value.error) {
        payload[sectionConfig.payloadKey] = result.value.data || [];
        return;
      }

      payload.sourceErrors.push(sectionConfig.payloadKey);
    });

    return NextResponse.json(payload);
  } catch (error) {
    return toErrorResponse(error?.message || "Unable to load setup options", 500);
  }
}

export async function POST(request) {
  try {
    const gate = await requireActionPermission({
      action: "update",
      appKey: getAdminAppKey(request),
      rolePermissionMap: ADMIN_ROLE_PERMISSION_MAP,
    });

    if (gate.error) return gate.error;

    const body = await request.json().catch(() => ({}));
    const sectionId = String(body?.sectionId || "").trim();

    const sectionConfig = SETUP_SECTION_CONFIG[sectionId];
    if (!sectionConfig) {
      return toErrorResponse("Unsupported setup section", 400);
    }

    const rows = normalizeRows(body?.rows, sectionConfig.columns);

    const { error: deleteError } = await gate.context.supabaseClient
      .from(sectionConfig.tableName)
      .delete()
      .gt(sectionConfig.pkColumn, 0);

    if (deleteError) throw deleteError;

    if (rows.length > 0) {
      const { error: insertError } = await gate.context.supabaseClient
        .from(sectionConfig.tableName)
        .insert(rows);

      if (insertError) throw insertError;
    }

    return NextResponse.json({
      success: true,
      sectionId,
      count: rows.length,
    });
  } catch (error) {
    return toErrorResponse(error?.message || "Unable to save setup rows", 500);
  }
}
