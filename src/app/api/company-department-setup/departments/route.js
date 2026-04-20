import { NextResponse } from "next/server";
import { getSupabase } from "@/modules/company-department-setup/utils/supabase.js";
import { createDepartmentRecord } from "@/modules/company-department-setup/services/companyDepartmentSetup.service.js";

export const dynamic = "force-dynamic";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };
}

function readCreatePayload(body) {
  return {
    comp_id: body?.comp_id,
    dept_name: body?.dept_name,
    dept_short_name: body?.dept_short_name,
    is_active: body?.is_active,
  };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const payload = readCreatePayload(body);

    const supabase = await getSupabase();
    const department = await createDepartmentRecord(supabase, payload);

    return NextResponse.json(
      {
        ok: true,
        department,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to create department.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
