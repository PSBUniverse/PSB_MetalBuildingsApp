"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Container, Spinner } from "react-bootstrap";
import {
  getCachedJson,
  USER_MASTER_CACHE_KEYS,
  USER_MASTER_CACHE_TTL,
} from "@/modules/user-master/cache/user-master.cache";
import SetupCardsTab from "@/modules/user-master/components/setup-cards-tab";
import {
  compareApplicationsByOrder,
  resolveApplicationOrder,
} from "@/shared/utils/application-order";
import { toastError } from "@/shared/utils/toast";

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function asText(value) {
  return String(value ?? "").trim();
}

export default function CardsSetupPage() {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [roles, setRoles] = useState([]);
  const [activeAppId, setActiveAppId] = useState("");

  const loadReferences = useCallback(async (options = {}) => {
    const forceFresh = Boolean(options.forceFresh);
    setLoading(true);

    try {
      const payload = await getCachedJson({
        key: USER_MASTER_CACHE_KEYS.bootstrap,
        url: "/api/user-master/bootstrap",
        ttlMs: USER_MASTER_CACHE_TTL.refsMs,
        forceFresh,
        allowStaleOnError: true,
      });

      setApplications(Array.isArray(payload?.applications) ? payload.applications : []);
      setRoles(Array.isArray(payload?.roles) ? payload.roles : []);
    } catch (error) {
      toastError(error?.message || "Unable to load setup cards.", "Setup Cards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  const appOptions = useMemo(() => {
    const orderedApps = [...(applications || [])]
      .filter((app) => hasValue(app?.app_id))
      .sort(compareApplicationsByOrder);

    return orderedApps
      .map((app) => ({
        app_id: app?.app_id,
        app_name: asText(app?.app_name) || `App ${app?.app_id}`,
        app_order: resolveApplicationOrder(app),
        is_active: app?.is_active !== false,
      }))
      .filter((app) => hasValue(app.app_id));
  }, [applications]);

  useEffect(() => {
    if (appOptions.length === 0) {
      setActiveAppId("");
      return;
    }

    const exists = appOptions.some((item) => String(item.app_id) === String(activeAppId));
    if (!hasValue(activeAppId) || !exists) {
      setActiveAppId(String(appOptions[0].app_id));
    }
  }, [activeAppId, appOptions]);

  const selectedApp = useMemo(() => {
    return appOptions.find((item) => String(item.app_id) === String(activeAppId)) || null;
  }, [activeAppId, appOptions]);

  const scopedApplications = useMemo(() => {
    if (!hasValue(activeAppId)) return [];
    return appOptions.filter((item) => String(item.app_id) === String(activeAppId));
  }, [activeAppId, appOptions]);

  return (
    <Container className="py-4 setup-shell cards-setup-page" style={{ maxWidth: 1260 }}>
      <div className="d-flex align-items-center mb-3">
        <Link href="/setup/admin" className="back-link me-3">
          <i className="bi bi-arrow-left" aria-hidden="true" /> Back
        </Link>
        <div>
          <h2 className="mb-0">Setup Cards</h2>
          <p className="text-muted mb-0">
            Manage card groups and cards for each application.
          </p>
        </div>
      </div>

      <div className="setup-split-layout">
        <aside className="setup-side-nav" aria-label="Application list">
          <p className="setup-side-nav-label">Applications</p>

          {loading && appOptions.length === 0 ? (
            <div className="d-flex align-items-center gap-2 text-muted small">
              <Spinner size="sm" animation="border" />
              <span>Loading applications...</span>
            </div>
          ) : appOptions.length === 0 ? (
            <div className="notice-banner notice-banner-warning mb-0">
              No applications are available for setup cards.
            </div>
          ) : (
            <div className="setup-side-nav-list">
              {appOptions.map((app) => {
                const isActive = String(activeAppId) === String(app.app_id);

                return (
                  <button
                    key={`cards-app-nav-${app.app_id}`}
                    type="button"
                    className={`setup-side-nav-item ${isActive ? "is-active" : ""} ${!app.is_active ? "is-inactive" : ""}`}
                    onClick={() => setActiveAppId(String(app.app_id))}
                  >
                    <span className="setup-side-nav-item-main">
                      <span className="setup-side-nav-item-title">{app.app_name}</span>
                      <span className="setup-side-nav-item-meta">
                        Order {app.app_order} - {app.is_active ? "Active application" : "Inactive application"}
                      </span>
                    </span>
                    <span className="setup-side-nav-item-end">
                      {!app.is_active ? (
                        <span className="setup-side-nav-pill-muted">Inactive</span>
                      ) : null}
                      <i className="bi bi-chevron-right" aria-hidden="true" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <div className="setup-content-pane">
          {!hasValue(activeAppId) ? (
            <div className="notice-banner notice-banner-muted">
              Select an application to manage cards and card groups.
            </div>
          ) : (
            <div className="setup-content-panel cards-setup-host">
              <section className="setup-editor-card mb-3">
                <div className="setup-table-header">
                  <div>
                    <h3 className="setup-editor-title mb-0">{selectedApp?.app_name || "Application"}</h3>
                    <p className="setup-editor-description mb-0">
                      Configure card groups, cards, routes, and role assignments.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => void loadReferences({ forceFresh: true })}
                    disabled={loading}
                  >
                    Refresh Apps
                  </Button>
                </div>
              </section>

              <SetupCardsTab key={activeAppId} applications={scopedApplications} roles={roles} />
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
