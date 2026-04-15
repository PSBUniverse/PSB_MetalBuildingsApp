import { NextResponse } from "next/server";
import { resolveUserRoleAccess } from "@/modules/user-master/access/user-master.access";
import {
  getAuthenticatedContext,
  toErrorResponse,
} from "@/modules/user-master/services/user-master-route-auth.service";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const appKey = searchParams.get("appKey");

    const auth = await getAuthenticatedContext();
    if (auth.error) return auth.error;

    const scopedAccess = appKey
      ? await resolveUserRoleAccess({
          userId: auth.userRecord.user_id,
          appKey,
          supabaseClient: auth.supabaseClient,
        })
      : auth.access;

    const limitedAccess =
      Boolean(auth.accountInactive) ||
      Boolean(auth.statusRestricted) ||
      !Boolean(scopedAccess?.isDevMain || scopedAccess?.hasAccess || scopedAccess?.hasAppAccess);

    const response = NextResponse.json({
      session: auth.session,
      user: auth.safeUser,
      status: auth.statusRecord,
      access: scopedAccess,
      accountInactive: Boolean(auth.accountInactive),
      statusRestricted: Boolean(auth.statusRestricted),
      limitedAccess,
    });

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (error) {
    return toErrorResponse(error?.message || "Unable to load session", 500);
  }
}


