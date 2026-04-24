export function setAccessTokenCookie(session) {
  if (!session?.access_token) return;
  const maxAge = Number.isFinite(session.expires_in) ? session.expires_in : 3600;
  document.cookie = `sb-access-token=${encodeURIComponent(session.access_token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

async function hasServerSession() {
  try {
    const response = await fetch("/api/me/bootstrap", {
      method: "GET", cache: "no-store", credentials: "include",
    });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => null);
    return Boolean(payload?.authUser?.id);
  } catch { return false; }
}

export async function waitForServerSession(maxAttempts = 4) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await hasServerSession()) return true;
    await new Promise((resolve) => { window.setTimeout(resolve, 120); });
  }
  return false;
}

export function validateFields(nextEmail, nextPassword) {
  const errors = { email: "", password: "" };
  const normalizedEmail = String(nextEmail || "").trim();
  const normalizedPassword = String(nextPassword || "").trim();
  if (!normalizedEmail) errors.email = "Email is required.";
  else if (!normalizedEmail.includes("@")) errors.email = "Please enter a valid email address.";
  if (!normalizedPassword) errors.password = "Password is required.";
  return errors;
}

export function mapLoginError(errorMessage) {
  const text = String(errorMessage || "").toLowerCase();
  if (text.includes("invalid") || text.includes("credentials")) return "Email or password is incorrect.";
  if (text.includes("email not confirmed")) return "Email is not confirmed. Check your inbox for the confirmation link.";
  if (String(errorMessage || "").trim()) return String(errorMessage);
  return "Unable to sign in right now. Please try again.";
}
