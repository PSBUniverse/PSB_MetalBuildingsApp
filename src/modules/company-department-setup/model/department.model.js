/**
 * Department Model
 * Defines department data access helpers for rendering/setup workflows.
 */

export function isDepartmentActive(department) {
  if (department?.is_active === false || department?.is_active === 0) return false;
  const text = String(department?.is_active ?? "").trim().toLowerCase();
  return !(text === "false" || text === "0" || text === "f" || text === "n" || text === "no");
}

export function getDepartmentDisplayName(department) {
  return department?.dept_name || department?.department_name || department?.name || "Unknown";
}

export function getDepartmentShortName(department) {
  return department?.dept_short_name || department?.short_name || department?.dept_short || department?.abbr || "--";
}
