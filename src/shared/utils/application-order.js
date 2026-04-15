function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asText(value) {
  return String(value ?? "").trim();
}

export function resolveApplicationOrder(application, fallbackOrder = Number.MAX_SAFE_INTEGER) {
  const candidates = [
    application?.display_order,
    application?.app_order,
    application?.sort_order,
    application?.order_no,
  ];

  for (const candidate of candidates) {
    const parsed = toFiniteNumber(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  const appIdOrder = toFiniteNumber(application?.app_id);
  if (appIdOrder !== null) {
    return appIdOrder;
  }

  return fallbackOrder;
}

export function compareApplicationsByOrder(left, right) {
  const orderDiff = resolveApplicationOrder(left) - resolveApplicationOrder(right);
  if (orderDiff !== 0) return orderDiff;

  const nameDiff = asText(left?.app_name).localeCompare(asText(right?.app_name));
  if (nameDiff !== 0) return nameDiff;

  return asText(left?.app_id).localeCompare(asText(right?.app_id));
}
