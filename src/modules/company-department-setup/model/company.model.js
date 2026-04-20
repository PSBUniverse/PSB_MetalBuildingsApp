/**
 * Company Model
 * Defines company data access helpers for rendering/setup workflows.
 */

export function isCompanyActive(company) {
  if (company?.is_active === false || company?.is_active === 0) return false;
  const text = String(company?.is_active ?? "").trim().toLowerCase();
  return !(text === "false" || text === "0" || text === "f" || text === "n" || text === "no");
}

export function getCompanyDisplayName(company) {
  return company?.comp_name || company?.company_name || company?.name || "Unknown";
}

export function getCompanyShortName(company) {
  return company?.comp_short_name || company?.short_name || company?.comp_short || company?.abbr || "--";
}

export function getCompanyEmail(company) {
  return company?.comp_email || company?.company_email || company?.email || "--";
}

export function getCompanyPhone(company) {
  return company?.comp_phone || company?.company_phone || company?.phone || "--";
}
