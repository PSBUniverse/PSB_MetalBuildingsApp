import { APP_CONFIG, buildModuleUrl } from "@config/app";

const ABSOLUTE_HTTP_URL_PATTERN = /^https?:\/\//i;
const URI_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i;
const MODULE_ROUTE_REFERENCE_PATTERN = /^module:([a-z0-9_-]+)(\/.*)?$/i;

function readOrigin(value) {
  try {
    return new URL(String(value || "")).origin.toLowerCase();
  } catch {
    return "";
  }
}

const APP_ORIGIN = readOrigin(APP_CONFIG?.baseUrl);
const MODULE_ORIGIN_SET = new Set(
  Object.values(APP_CONFIG?.modules || {})
    .map((value) => readOrigin(value))
    .filter(Boolean)
);

function normalizeAbsoluteHttpUrl(value) {
  try {
    const parsed = new URL(value);
    const parsedOrigin = String(parsed.origin || "").toLowerCase();

    if (APP_ORIGIN && parsedOrigin === APP_ORIGIN) {
      const relativePath = `${parsed.pathname || "/"}${parsed.search || ""}${parsed.hash || ""}`;
      return relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
    }

    if (MODULE_ORIGIN_SET.has(parsedOrigin)) {
      return value;
    }

    return value;
  } catch {
    return "";
  }
}

export function normalizeRoutePath(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  // Internal absolute URLs are converted to relative paths; module/external links stay absolute.
  if (ABSOLUTE_HTTP_URL_PATTERN.test(raw)) {
    return normalizeAbsoluteHttpUrl(raw);
  }

  // Keep non-HTTP URI schemes intact (for example: mailto:, tel:).
  if (URI_SCHEME_PATTERN.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return raw;
  }

  return `/${raw.replace(/^\/+/, "")}`;
}

export function resolveRouteTarget(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { href: "", external: false };
  }

  const moduleMatch = raw.match(MODULE_ROUTE_REFERENCE_PATTERN);
  if (moduleMatch) {
    const moduleKey = moduleMatch[1];
    const modulePath = normalizeRoutePath(moduleMatch[2] || "/");
    const moduleHref = buildModuleUrl(moduleKey, modulePath);
    return {
      href: moduleHref,
      external: true,
    };
  }

  const href = normalizeRoutePath(raw);
  const hasUriScheme = URI_SCHEME_PATTERN.test(href);
  const isAbsoluteHttp = ABSOLUTE_HTTP_URL_PATTERN.test(href);

  return {
    href,
    external: isAbsoluteHttp || (hasUriScheme && !href.startsWith("/")),
  };
}
