import { NextResponse } from "next/server";
import { USER_MASTER_TABLES } from "@/modules/user-master/access/user-master.access";
import {
  getAuthenticatedContext,
  toErrorResponse,
} from "@/modules/user-master/services/user-master-route-auth.service";

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function sanitizeProfileRow(row) {
  return {
    comp_id: row?.comp_id ?? null,
    comp_name: String(row?.comp_name || "Premium Steel Buildings Inc"),
    short_name: String(row?.short_name || "PSB"),
    comp_email: String(row?.comp_email || ""),
    comp_phone: String(row?.comp_phone || ""),
  };
}

async function resolveCompanyRecord(supabaseClient, userRecord) {
  const userCompanyId = userRecord?.comp_id;

  if (hasValue(userCompanyId)) {
    const { data, error } = await supabaseClient
      .from(USER_MASTER_TABLES.companies)
      .select("comp_id, comp_name, short_name, comp_email, comp_phone")
      .eq("comp_id", userCompanyId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;
  }

  const { data, error } = await supabaseClient
    .from(USER_MASTER_TABLES.companies)
    .select("comp_id, comp_name, short_name, comp_email, comp_phone")
    .order("comp_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function GET() {
  try {
    const auth = await getAuthenticatedContext();
    if (auth.error) return auth.error;

    const company = await resolveCompanyRecord(auth.supabaseClient, auth.userRecord);

    return NextResponse.json({
      success: true,
      profile: sanitizeProfileRow(company),
    });
  } catch (error) {
    return toErrorResponse(error?.message || "Unable to load company profile", 500);
  }
}

export async function PATCH(request) {
  try {
    const auth = await getAuthenticatedContext();
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const payload = {
      comp_name: String(body?.name || body?.comp_name || "").trim() || "Premium Steel Buildings Inc",
      short_name: String(body?.shortName || body?.short_name || "").trim() || "PSB",
      comp_email: String(body?.email || body?.comp_email || "").trim() || null,
      comp_phone: String(body?.phone || body?.comp_phone || "").trim() || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const targetCompanyId =
      body?.comp_id ?? body?.compId ?? auth.userRecord?.comp_id ?? null;

    let profileRow = null;

    if (hasValue(targetCompanyId)) {
      const { data, error } = await auth.supabaseClient
        .from(USER_MASTER_TABLES.companies)
        .update(payload)
        .eq("comp_id", targetCompanyId)
        .select("comp_id, comp_name, short_name, comp_email, comp_phone")
        .maybeSingle();

      if (error) throw error;
      profileRow = data || null;
    }

    if (!profileRow) {
      const { data, error } = await auth.supabaseClient
        .from(USER_MASTER_TABLES.companies)
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select("comp_id, comp_name, short_name, comp_email, comp_phone")
        .single();

      if (error) throw error;
      profileRow = data;
    }

    return NextResponse.json({
      success: true,
      profile: sanitizeProfileRow(profileRow),
    });
  } catch (error) {
    return toErrorResponse(error?.message || "Unable to save company profile", 500);
  }
}
