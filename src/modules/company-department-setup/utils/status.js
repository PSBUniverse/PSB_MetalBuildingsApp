/**
 * Status Utilities
 * Helper functions for active/inactive status display.
 */

export function isActiveRow(record) {
  if (record === false || record === 0) return false;
  const text = String(record ?? "").trim().toLowerCase();
  return !(text === "false" || text === "0" || text === "f" || text === "n" || text === "no");
}

export function getStatusBadgeColor(isActive) {
  return isActive
    ? { bg: "#d1e7dd", text: "#0a3622" }
    : { bg: "#cfe2ff", text: "#084298" };
}

export function getStatusLabel(isActive) {
  return isActive ? "Active" : "Inactive";
}
