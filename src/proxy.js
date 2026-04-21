import { NextResponse } from "next/server";

export function proxy(req) {
  const url = req.nextUrl.clone();
  const isLoginPage = url.pathname === "/login";
  const token = String(req.cookies.get("sb-access-token")?.value || "").trim();

  if (!token && !isLoginPage) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api).*)"],
};