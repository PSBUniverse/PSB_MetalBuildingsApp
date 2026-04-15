import { NextResponse } from "next/server";
import {
  USER_MASTER_COLUMNS,
  USER_MASTER_TABLES,
} from "@/modules/user-master/access/user-master.access";
import {
  ADMIN_ROLE_PERMISSION_MAP,
  requireActionPermission,
  toErrorResponse,
} from "@/modules/user-master/services/user-master-route-auth.service";
import { compareApplicationsByOrder } from "@/shared/utils/application-order";

const APPLICATION_ORDER_FIELDS = ["display_order", "app_order", "sort_order", "order_no"];

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function toNullableNumber(value) {
  if (value === "" || value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectApplicationOrderField(applications) {
  const rows = Array.isArray(applications) ? applications : [];

  for (const field of APPLICATION_ORDER_FIELDS) {
    if (rows.some((row) => Object.prototype.hasOwnProperty.call(row || {}, field))) {
      return field;
    }
  }

  return "";
}

function parseOrderField(value) {
  const normalized = String(value ?? "").trim();
  return APPLICATION_ORDER_FIELDS.includes(normalized) ? normalized : "";
}

function asText(value) {
  return String(value ?? "").trim();
}

function normalizeBatchApplicationRow(row = {}) {
  const appId = toNullableNumber(row?.app_id ?? row?.appId);
  const displayOrder = toNullableNumber(row?.display_order ?? row?.displayOrder);
  const pendingRemoveValue =
    row?.is_pending_remove ?? row?.isPendingRemove ?? row?.__pendingRemove;
  const activeValue = row?.is_active ?? row?.isActive ?? true;

  return {
    app_id: appId === null ? null : String(appId),
    app_name: asText(row?.app_name ?? row?.appName) || null,
    app_desc: asText(row?.app_desc ?? row?.appDesc) || null,
    is_active: Boolean(activeValue),
    display_order: displayOrder === null ? null : String(displayOrder),
    is_pending_remove: Boolean(pendingRemoveValue),
  };
}

function getAdminAppKey(request) {
  const { searchParams } = new URL(request.url);
  return (
    String(searchParams.get("appKey") || "").trim() ||
    String(process.env.USER_MASTER_ADMIN_APP_KEY || "").trim() ||
    null
  );
}

export async function GET(request) {
  try {
    const gate = await requireActionPermission({
      action: "read",
      appKey: getAdminAppKey(request),
      rolePermissionMap: ADMIN_ROLE_PERMISSION_MAP,
      requiredRoleKey: "devmain",
    });

    if (gate.error) return gate.error;

    const { data, error } = await gate.context.supabaseClient
      .from(USER_MASTER_TABLES.applications)
      .select("*");

    if (error) throw error;
    const applications = [...(data || [])].sort(compareApplicationsByOrder);
    const applicationOrderField = detectApplicationOrderField(applications);
    return NextResponse.json({
      success: true,
      message: "Applications loaded",
      data: {
        applications,
        applicationOrderField,
      },
      applicationOrderField,
      applications,
    });
  } catch (error) {
    return toErrorResponse(error?.message || "Unable to list applications", 500);
  }
}

export async function POST(request) {
  try {
    const gate = await requireActionPermission({
      action: "create",
      appKey: getAdminAppKey(request),
      rolePermissionMap: ADMIN_ROLE_PERMISSION_MAP,
      requiredRoleKey: "devmain",
    });

    if (gate.error) return gate.error;

    const body = await request.json();
    const mode = asText(body?.mode).toLowerCase();

    if (mode === "batch") {
      const orderField = parseOrderField(body?.order_field ?? body?.orderField);
      if (hasValue(orderField) && orderField !== "display_order") {
        return toErrorResponse("Batch save supports display_order only", 400);
      }

      const batchRows = Array.isArray(body?.applications)
        ? body.applications.map((row) => normalizeBatchApplicationRow(row))
        : [];

      if (batchRows.length === 0) {
        const emptySummary = { inserted_count: 0, updated_count: 0, deleted_count: 0 };
        return NextResponse.json({
          success: true,
          message: "No application changes to apply",
          data: { summary: emptySummary },
          summary: emptySummary,
        });
      }

      const seenOrderValues = new Set();

      for (const row of batchRows) {
        if (row.is_pending_remove) continue;

        if (!hasValue(row.app_name)) {
          return toErrorResponse("Application name is required", 400);
        }

        const orderValue = toNullableNumber(row.display_order);
        if (orderValue === null || orderValue <= 0) {
          return toErrorResponse("display_order must be a positive number", 400);
        }

        const orderKey = String(orderValue);
        if (seenOrderValues.has(orderKey)) {
          return toErrorResponse(`Duplicate application order ${orderValue} detected`, 409);
        }
        seenOrderValues.add(orderKey);
      }

      const { data: rpcResult, error: rpcError } = await gate.context.supabaseClient.rpc(
        "psb_save_applications_batch",
        { p_rows: batchRows }
      );

      if (rpcError) {
        if (String(rpcError?.code || "") === "42883") {
          return toErrorResponse(
            "Batch RPC is missing. Run migration: supabase/migrations/202604110002_add_applications_batch_rpc.sql",
            500
          );
        }
        throw rpcError;
      }

      const summary =
        Array.isArray(rpcResult) && rpcResult.length > 0
          ? rpcResult[0]
          : rpcResult || { inserted_count: 0, updated_count: 0, deleted_count: 0 };

      return NextResponse.json({
        success: true,
        message: "Applications batch saved",
        data: { summary },
        summary,
      });
    }

    const payload = { ...(body || {}) };
    const orderField = parseOrderField(body?.order_field ?? body?.orderField);
    const hasDisplayOrderInput =
      Object.prototype.hasOwnProperty.call(body || {}, "display_order") ||
      Object.prototype.hasOwnProperty.call(body || {}, "displayOrder");

    delete payload.app_id;
    delete payload.appId;
    delete payload.order_field;
    delete payload.orderField;
    delete payload.display_order;
    delete payload.displayOrder;

    if (hasDisplayOrderInput && hasValue(orderField)) {
      const displayOrder = toNullableNumber(body?.display_order ?? body?.displayOrder);
      if (displayOrder === null) {
        return toErrorResponse("display_order must be a valid number", 400);
      }
      payload[orderField] = displayOrder;
    }

    const { data, error } = await gate.context.supabaseClient
      .from(USER_MASTER_TABLES.applications)
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({
      success: true,
      message: "Application created",
      data: {
        application: data,
      },
      application: data,
    });
  } catch (error) {
    return toErrorResponse(error?.message || "Unable to create application", 500);
  }
}

export async function PATCH(request) {
  try {
    const gate = await requireActionPermission({
      action: "update",
      appKey: getAdminAppKey(request),
      rolePermissionMap: ADMIN_ROLE_PERMISSION_MAP,
      requiredRoleKey: "devmain",
    });

    if (gate.error) return gate.error;

    const body = await request.json();
    const appId = body?.app_id ?? body?.appId;

    if (!hasValue(appId)) {
      return toErrorResponse("app_id is required", 400);
    }

    const updates = { ...(body || {}) };
    const orderField = parseOrderField(body?.order_field ?? body?.orderField);
    const hasDisplayOrderInput =
      Object.prototype.hasOwnProperty.call(body || {}, "display_order") ||
      Object.prototype.hasOwnProperty.call(body || {}, "displayOrder");

    delete updates.app_id;
    delete updates.appId;
    delete updates.order_field;
    delete updates.orderField;
    delete updates.display_order;
    delete updates.displayOrder;

    if (hasDisplayOrderInput && hasValue(orderField)) {
      const displayOrder = toNullableNumber(body?.display_order ?? body?.displayOrder);
      if (displayOrder === null) {
        return toErrorResponse("display_order must be a valid number", 400);
      }
      updates[orderField] = displayOrder;
    }

    if (Object.keys(updates).length === 0) {
      return toErrorResponse("No application update fields were provided", 400);
    }

    const { data, error } = await gate.context.supabaseClient
      .from(USER_MASTER_TABLES.applications)
      .update(updates)
      .eq(USER_MASTER_COLUMNS.appId, appId)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({
      success: true,
      message: "Application updated",
      data: {
        application: data,
      },
      application: data,
    });
  } catch (error) {
    return toErrorResponse(error?.message || "Unable to update application", 500);
  }
}

export async function DELETE(request) {
  try {
    const gate = await requireActionPermission({
      action: "delete",
      appKey: getAdminAppKey(request),
      rolePermissionMap: ADMIN_ROLE_PERMISSION_MAP,
      requiredRoleKey: "devmain",
    });

    if (gate.error) return gate.error;

    const { searchParams } = new URL(request.url);
    const appId = searchParams.get("app_id") || searchParams.get("appId");

    if (!hasValue(appId)) {
      return toErrorResponse("app_id is required", 400);
    }

    const { error } = await gate.context.supabaseClient
      .from(USER_MASTER_TABLES.applications)
      .delete()
      .eq(USER_MASTER_COLUMNS.appId, appId);

    if (error) {
      if (String(error?.code || "") === "23503") {
        return toErrorResponse("Cannot delete: record is in use", 409);
      }

      throw error;
    }
    return NextResponse.json({
      success: true,
      message: "Application deleted",
      data: {
        app_id: appId,
        deleted: true,
      },
    });
  } catch (error) {
    return toErrorResponse(error?.message || "Unable to delete application", 500);
  }
}


