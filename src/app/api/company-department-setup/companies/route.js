import { NextResponse } from "next/server";
import { getSupabase } from "@/modules/company-department-setup/utils/supabase.js";
import { createCompanyRecord } from "@/modules/company-department-setup/services/companyDepartmentSetup.service.js";

export const dynamic = "force-dynamic";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };
}

function readCreatePayload(body) {
  return {
    comp_name: body?.comp_name,
    comp_short_name: body?.comp_short_name,
    comp_email: body?.comp_email,
    comp_phone: body?.comp_phone,
    is_active: body?.is_active,
  };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const payload = readCreatePayload(body);

    const supabase = await getSupabase();
    const company = await createCompanyRecord(supabase, payload);

    return NextResponse.json(
      {
        ok: true,
        company,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to create company.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
