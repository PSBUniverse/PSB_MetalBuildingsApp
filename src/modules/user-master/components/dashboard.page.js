"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Container, Row, Col, Card } from "react-bootstrap";
import psbLogo from "@/styles/psb_logo_notitle.png";
import { normalizeRoutePath, resolveRouteTarget } from "@/shared/utils/route-path";
import { createCacheKey, getOrFetchCached } from "@/core/cache/adapters/browser-cache.adapter";

const DEFAULT_CARD_ICON = "bi-grid-3x3-gap";
const DEFAULT_GROUP_ICON = "bi-collection";
const MY_APPS_CACHE_NAMESPACE = "user-master";
const MY_APPS_CACHE_TTL_MS = 2 * 60 * 1000;
const MY_APPS_CACHE_KEY = createCacheKey("my-apps", "dashboard");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function toIconClass(iconValue, fallbackIcon) {
  const raw = String(iconValue || "").trim();
  if (!raw) return `bi ${fallbackIcon}`;

  if (raw.includes(" ")) {
    return raw;
  }

  if (raw.startsWith("bi-")) {
    return `bi ${raw}`;
  }

  return `bi ${raw}`;
}

function normalizeGroups(payload) {
  const source = Array.isArray(payload?.groups) ? payload.groups : [];

  return source.map((group) => ({
    group_id: group?.group_id,
    group_name: String(group?.group_name || "Application").trim(),
    group_desc: String(group?.group_desc || "").trim(),
    group_icon: String(group?.group_icon || "").trim(),
    group_order: Number(group?.group_order || 0),
    cards: (Array.isArray(group?.cards) ? group.cards : []).map((card) => ({
      card_id: card?.card_id,
      card_name: String(card?.card_name || "Module").trim(),
      card_desc: String(card?.description || card?.card_desc || "").trim(),
      route_path: normalizeRoutePath(card?.route || card?.route_path || ""),
      icon: String(card?.icon || "").trim(),
    })),
  }));
}

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [groups, setGroups] = useState([]);
  const [noModulesAssigned, setNoModulesAssigned] = useState(false);

  const hasGroups = useMemo(() => groups.length > 0, [groups]);

  useEffect(() => {
    let cancelled = false;

    async function loadApps() {
      setLoading(true);
      setErrorMessage("");
      setNoModulesAssigned(false);

      try {
        const cachedResult = await getOrFetchCached({
          key: MY_APPS_CACHE_KEY,
          namespace: MY_APPS_CACHE_NAMESPACE,
          ttlMs: MY_APPS_CACHE_TTL_MS,
          allowStaleOnError: true,
          fetcher: async () => {
            const response = await fetch("/api/my-apps", {
              method: "GET",
              cache: "no-store",
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
              throw new Error(
                payload?.message || "Unable to load your applications. Please try again."
              );
            }

            return payload || {};
          },
        });

        if (cancelled) return;

        const payload = cachedResult?.data || {};

        const normalizedGroups = normalizeGroups(payload);
        setGroups(normalizedGroups);
        setNoModulesAssigned(Boolean(payload?.noModulesAssigned));
      } catch (error) {
        if (cancelled) return;
        setGroups([]);
        setNoModulesAssigned(false);
        setErrorMessage(error?.message || "Unable to load your applications. Please try again.");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    void loadApps();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Container className="py-4" style={{ maxWidth: 1200 }}>
      <div className="my-apps-portal-hero mb-4 rounded-3">
        <Row className="align-items-center g-3">
          <Col md={7}>
            <div className="my-apps-portal-title-row">
              <Image src={psbLogo} alt="PSBUniverse logo" className="my-apps-portal-logo" />
              <h1 className="my-apps-portal-title mb-0">PSBUniverse Portal</h1>
            </div>
            <p className="my-apps-portal-subtitle mb-1">All Applications Workspace</p>
            <p className="my-apps-portal-copy mb-0">
              Access and manage all your assigned applications in one place.
            </p>
          </Col>
          <Col md={5}>
            <Card className="my-apps-org-card">
              <Card.Body>
                <p className="my-apps-org-name mb-1">Premium Steel Building</p>
                <p className="my-apps-org-tagline mb-2">
                  Premium Gutters and Doors
                </p>
                <p className="my-apps-org-contact-row mb-1">
                  <i className="bi bi-envelope-at-fill" aria-hidden="true" />
                  <span>Sales.pgd@premiumsteelgroup.com</span>
                </p>
                <p className="my-apps-org-contact-row mb-0">
                  <i className="bi bi-telephone-fill" aria-hidden="true" />
                  <span>817-502-2520</span>
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>

      {loading ? (
        <div className="my-apps-skeleton-stack">
          {[1, 2].map((sectionIndex) => (
            <div key={`skeleton-group-${sectionIndex}`} className="mb-4">
              <div className="my-apps-skeleton-line my-apps-skeleton-line-header" />
              <Row className="g-3">
                {[1, 2, 3].map((cardIndex) => (
                  <Col key={`skeleton-card-${sectionIndex}-${cardIndex}`} md={4}>
                    <div className="tile-card bg-white my-apps-skeleton-card">
                      <div className="my-apps-skeleton-line my-apps-skeleton-line-icon" />
                      <div className="my-apps-skeleton-line my-apps-skeleton-line-title" />
                      <div className="my-apps-skeleton-line my-apps-skeleton-line-copy" />
                      <div className="my-apps-skeleton-line my-apps-skeleton-line-copy short" />
                    </div>
                  </Col>
                ))}
              </Row>
            </div>
          ))}
        </div>
      ) : hasValue(errorMessage) ? (
        <div className="notice-banner notice-banner-danger mb-0">{errorMessage}</div>
      ) : !hasGroups ? (
        noModulesAssigned ? (
          <div className="notice-banner notice-banner-warning mb-0">
            <strong className="d-block">No modules assigned.</strong>
            <span>Your app access is active, but no modules are currently assigned.</span>
          </div>
        ) : (
          <div className="notice-banner notice-banner-warning mb-0">
            <strong className="d-block">No applications assigned yet.</strong>
            <span>Please contact your administrator to get access.</span>
          </div>
        )
      ) : (
        groups.map((group) => (
          <div key={`group-${group.group_id || group.group_name}`} className="mb-4">
            <div className="my-apps-group-heading">
              <i
                className={toIconClass(group.group_icon, DEFAULT_GROUP_ICON)}
                aria-hidden="true"
              />
              <div>
                <p className="text-uppercase fw-bold mb-0 tile-badge">{group.group_name}</p>
                {hasValue(group.group_desc) ? (
                  <p className="text-muted mb-0 my-apps-group-desc">{group.group_desc}</p>
                ) : null}
              </div>
            </div>

            <Row className="g-3 mt-1">
              {group.cards.map((card) => (
                <Col key={`card-${card.card_id || card.route_path}`} md={4}>
                  {(() => {
                    const target = resolveRouteTarget(card.route_path);
                    const href = target.href || "#";

                    const cardContent = (
                      <>
                        <div className="my-app-card-icon">
                          <i
                            className={toIconClass(card.icon, DEFAULT_CARD_ICON)}
                            aria-hidden="true"
                          />
                        </div>
                        <h5 className="mt-2 mb-2">{card.card_name}</h5>
                        <p className="text-muted my-app-card-copy">{card.card_desc || "Open module."}</p>
                        <span className="tile-cta">Open Module</span>
                      </>
                    );

                    if (target.external) {
                      return (
                        <a href={href} className="tile-card bg-white my-app-card" rel="noreferrer">
                          {cardContent}
                        </a>
                      );
                    }

                    return (
                      <Link href={href} className="tile-card bg-white my-app-card">
                        {cardContent}
                      </Link>
                    );
                  })()}
                </Col>
              ))}
            </Row>
          </div>
        ))
      )}
    </Container>
  );
}
