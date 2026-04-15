"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Container,
  Table,
  Button,
  Form,
} from "react-bootstrap";
import { createCacheKey, invalidateCacheKeys } from "@/core/cache";
import { toastError, toastSuccess } from "@/shared/utils/toast";

const CACHE_NAMESPACE = "psb-universe";
const CACHE_KEYS = {
  statuses: createCacheKey("setup", "statuses"),
  colors: createCacheKey("setup", "colors"),
  manufacturers: createCacheKey("setup", "manufacturers"),
  leafGuards: createCacheKey("setup", "leafGuards"),
  discounts: createCacheKey("setup", "discounts"),
  tripRates: createCacheKey("setup", "tripRates"),
  projectsList: createCacheKey("projects", "list"),
};

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const normalizeForCompare = (value, type) => {
  if (type === "number") {
    if (!hasValue(value)) return "";
    const numeric = Number(value);
    return Number.isFinite(numeric) ? String(numeric) : "";
  }

  return String(value ?? "").trim();
};

const cloneRows = (rows) =>
  Array.isArray(rows) ? rows.map((row) => ({ ...(row || {}) })) : [];

function SetupTable({
  sectionId,
  title,
  description,
  tableName,
  pkColumn,
  columns,
  data,
  onSave,
  onStateChange,
  cacheNamespace,
  cacheKey,
  invalidateKeys,
}) {
  const [editing, setEditing] = useState(new Set());
  const [draft, setDraft] = useState([]);
  const [baselineRows, setBaselineRows] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextRows = cloneRows(data);
      setDraft(nextRows);
      setBaselineRows(nextRows);
      setEditing(new Set());
    }, 0);

    return () => clearTimeout(timer);
  }, [data]);

  const diff = useMemo(() => {
    const baselineByPk = new Map();
    (baselineRows || []).forEach((row) => {
      const pkValue = row?.[pkColumn];
      if (hasValue(pkValue)) {
        baselineByPk.set(String(pkValue), row);
      }
    });

    const byRowIndex = new Map();
    let newRows = 0;
    let modifiedRows = 0;
    let removedRows = 0;

    (draft || []).forEach((row, index) => {
      const pkValue = row?.[pkColumn];
      const rowHasPk = hasValue(pkValue);
      const baselineRow = rowHasPk ? baselineByPk.get(String(pkValue)) : null;
      const changedColumns = new Set();

      columns.forEach((column) => {
        const draftValue = normalizeForCompare(row?.[column.key], column.type);
        const baselineValue = baselineRow
          ? normalizeForCompare(baselineRow?.[column.key], column.type)
          : "";

        if (draftValue !== baselineValue) {
          if (baselineRow || draftValue !== "") {
            changedColumns.add(column.key);
          }
        }
      });

      const rowHasAnyValue = columns.some(
        (column) => normalizeForCompare(row?.[column.key], column.type) !== ""
      );
      const isNew = !baselineRow;
      const isPendingRemove = Boolean(row?.__pendingRemove);

      if (isPendingRemove) {
        if (baselineRow) {
          removedRows += 1;
        }

        byRowIndex.set(index, {
          isNew,
          isChanged: Boolean(baselineRow),
          isPendingRemove: true,
          changedColumns,
        });
        return;
      }

      const isChanged = baselineRow ? changedColumns.size > 0 : rowHasAnyValue;

      if (isNew && isChanged) {
        newRows += 1;
      } else if (!isNew && isChanged) {
        modifiedRows += 1;
      }

      byRowIndex.set(index, {
        isNew,
        isChanged,
        isPendingRemove: false,
        changedColumns,
      });
    });

    return {
      byRowIndex,
      newRows,
      modifiedRows,
      removedRows,
      hasPendingChanges: newRows > 0 || modifiedRows > 0 || removedRows > 0,
    };
  }, [baselineRows, columns, draft, pkColumn]);

  const changeSummary = diff.hasPendingChanges
    ? `${diff.newRows} new, ${diff.modifiedRows} modified, ${diff.removedRows} removed`
    : "No changes";

  useEffect(() => {
    if (!onStateChange || !sectionId) return;

    const rowCount = (draft || []).filter((row) => {
      if (row?.__pendingRemove) return false;
      return columns.some((column) =>
        normalizeForCompare(row?.[column.key], column.type) !== ""
      );
    }).length;

    onStateChange(sectionId, {
      isDirty: diff.hasPendingChanges,
      rowCount,
    });
  }, [columns, diff.hasPendingChanges, draft, onStateChange, sectionId]);

  const startEdit = (i) => {
    setEditing((prev) => new Set(prev).add(i));
  };

  const updateDraft = (i, col, value) => {
    setDraft((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [col]: value };
      return next;
    });
  };

  const addRow = () => {
    const newRow = {};
    columns.forEach((c) => {
      newRow[c.key] = "";
    });
    newRow.__pendingRemove = false;

    setDraft((prev) => [...prev, newRow]);
    setEditing((prev) => new Set(prev).add(draft.length));
  };

  const toggleRemoveRow = (i) => {
    setDraft((prev) => {
      const next = [...prev];
      const current = next[i] || {};
      next[i] = {
        ...current,
        __pendingRemove: !Boolean(current.__pendingRemove),
      };
      return next;
    });

    setEditing((prev) => {
      const next = new Set(prev);
      next.delete(i);
      return next;
    });
  };

  const cancelEditRow = (i) => {
    const row = draft[i] || {};
    const pkValue = row?.[pkColumn];
    const baselineRow = hasValue(pkValue)
      ? (baselineRows || []).find((item) => String(item?.[pkColumn]) === String(pkValue))
      : null;

    if (baselineRow) {
      setDraft((prev) => {
        const next = [...prev];
        next[i] = { ...baselineRow };
        return next;
      });
      setEditing((prev) => {
        const next = new Set(prev);
        next.delete(i);
        return next;
      });
      return;
    }

    setDraft((prev) => prev.filter((_, idx) => idx !== i));
    setEditing((prev) => {
      const next = new Set();
      prev.forEach((v) => {
        if (v < i) next.add(v);
        else if (v > i) next.add(v - 1);
      });
      return next;
    });
  };

  const cancel = () => {
    setDraft(cloneRows(baselineRows));
    setEditing(new Set());
  };

  const save = async () => {
    if (!diff.hasPendingChanges) return;

    const rows = draft
      .filter((r) => !r.__pendingRemove)
      .filter((r) => columns.some((c) => String(r[c.key] || "").trim() !== ""))
      .map((r) => {
        const cleaned = {};
        columns.forEach((c) => {
          cleaned[c.key] =
            c.type === "number" ? parseFloat(r[c.key]) || 0 : r[c.key];
        });
        return cleaned;
      });

    const response = await fetch("/api/setup/global", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        sectionId,
        rows,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toastError("Error: " + (payload?.message || payload?.error || "Unable to save rows"), title);
      return;
    }

    setEditing(new Set());
    toastSuccess("Saved!", title);
    const keysToInvalidate = [cacheKey, ...(invalidateKeys || [])].filter(
      Boolean
    );
    if (keysToInvalidate.length > 0) {
      invalidateCacheKeys(keysToInvalidate, { namespace: cacheNamespace });
    }
    if (onSave) onSave();
  };

  return (
    <section className="setup-editor-card" aria-label={title}>
      <div className="setup-table-header">
        <div>
          <h3 className="setup-editor-title mb-0">{title}</h3>
          {description ? <p className="setup-editor-description mb-0">{description}</p> : null}
        </div>
        {diff.hasPendingChanges ? (
          <span className="setup-pending-pill">Unsaved</span>
        ) : null}
      </div>

      <Table size="sm" bordered className="setup-table mb-2">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            <th style={{ width: 120 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {draft.map((row, i) => {
            const rowDiff = diff.byRowIndex.get(i) || {
              isNew: false,
              isChanged: false,
              isPendingRemove: false,
              changedColumns: new Set(),
            };

            return (
              <tr
                key={i}
                className={
                  rowDiff.isPendingRemove
                    ? "setup-row-pending-remove"
                    : rowDiff.isNew
                    ? "setup-row-new"
                    : rowDiff.isChanged
                      ? "setup-row-modified"
                      : ""
                }
              >
                {columns.map((c) => {
                  const isCellChanged = rowDiff.changedColumns.has(c.key);
                  return (
                    <td key={c.key} className={isCellChanged ? "setup-cell-changed" : ""}>
                      {editing.has(i) ? (
                        <Form.Control
                          size="sm"
                          type={c.type === "number" ? "number" : "text"}
                          step={c.type === "number" ? "0.01" : undefined}
                          value={row[c.key] ?? ""}
                          className={isCellChanged ? "setup-input-changed" : ""}
                          onChange={(e) => updateDraft(i, c.key, e.target.value)}
                        />
                      ) : (
                        <span
                          className="small"
                          style={{ cursor: "pointer" }}
                          onClick={() => startEdit(i)}
                        >
                          {row[c.key] ?? ""}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td>
                  {editing.has(i) ? (
                    <>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        className="me-1 setup-row-icon-btn"
                        onClick={() => cancelEditRow(i)}
                        aria-label="Cancel row edit"
                        title="Cancel row edit"
                      >
                        <i className="bi bi-x-lg" aria-hidden="true" />
                      </Button>
                      <Button
                        variant={rowDiff.isPendingRemove ? "outline-warning" : "outline-danger"}
                        size="sm"
                        className="setup-row-icon-btn"
                        onClick={() => toggleRemoveRow(i)}
                        aria-label={rowDiff.isPendingRemove ? "Undo row removal" : "Mark row for removal"}
                        title={rowDiff.isPendingRemove ? "Undo row removal" : "Mark row for removal"}
                      >
                        <i
                          className={`bi ${rowDiff.isPendingRemove ? "bi-arrow-counterclockwise" : "bi-trash"}`}
                          aria-hidden="true"
                        />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-1 setup-row-icon-btn"
                        onClick={() => startEdit(i)}
                        disabled={rowDiff.isPendingRemove}
                        aria-label="Edit row"
                        title="Edit row"
                      >
                        <i className="bi bi-pencil" aria-hidden="true" />
                      </Button>
                      <Button
                        variant={rowDiff.isPendingRemove ? "outline-warning" : "outline-danger"}
                        size="sm"
                        className="setup-row-icon-btn"
                        onClick={() => toggleRemoveRow(i)}
                        aria-label={rowDiff.isPendingRemove ? "Undo row removal" : "Mark row for removal"}
                        title={rowDiff.isPendingRemove ? "Undo row removal" : "Mark row for removal"}
                      >
                        <i
                          className={`bi ${rowDiff.isPendingRemove ? "bi-arrow-counterclockwise" : "bi-trash"}`}
                          aria-hidden="true"
                        />
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <div className="d-flex gap-2 align-items-center setup-batch-actions">
        <span className={`small me-auto setup-change-summary ${diff.hasPendingChanges ? "is-dirty" : ""}`}>
          {changeSummary}
        </span>
        <Button variant="outline-success" size="sm" onClick={save} disabled={!diff.hasPendingChanges}>
          Save Batch
        </Button>
        <Button variant="outline-secondary" size="sm" onClick={cancel} disabled={!diff.hasPendingChanges}>
          Cancel Batch
        </Button>
        <Button variant="outline-primary" size="sm" onClick={addRow}>
          Add Row
        </Button>
      </div>
    </section>
  );
}

export default function CoreSetupPage() {
  const [statuses, setStatuses] = useState([]);
  const [colors, setColors] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [leafGuards, setLeafGuards] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [tripFeeRates, setTripFeeRates] = useState([]);
  const [activeSetupId, setActiveSetupId] = useState("statuses");
  const [sectionState, setSectionState] = useState({});

  const handleSectionStateChange = useCallback((sectionId, nextState) => {
    setSectionState((prev) => {
      const current = prev?.[sectionId];
      if (
        current &&
        current.isDirty === nextState.isDirty &&
        current.rowCount === nextState.rowCount
      ) {
        return prev;
      }

      return {
        ...prev,
        [sectionId]: nextState,
      };
    });
  }, []);

  const setupSections = useMemo(
    () => [
      {
        id: "statuses",
        title: "Status List",
        description: "Control which statuses can be used when managing records.",
        tableName: "core_s_statuses",
        pkColumn: "status_id",
        cacheKey: CACHE_KEYS.statuses,
        invalidateKeys: [CACHE_KEYS.projectsList],
        columns: [
          { key: "name", label: "Status", type: "text" },
          { key: "description", label: "Description", type: "text" },
        ],
        data: statuses,
      },
      {
        id: "colors",
        title: "Color Names",
        description: "Maintain the list of available color options.",
        tableName: "core_s_colors",
        pkColumn: "color_id",
        cacheKey: CACHE_KEYS.colors,
        invalidateKeys: [],
        columns: [{ key: "name", label: "Color Name", type: "text" }],
        data: colors,
      },
      {
        id: "manufacturers",
        title: "Manufacturers",
        description: "Manage manufacturer labels and their default rates.",
        tableName: "core_s_manufacturers",
        pkColumn: "manufacturer_id",
        cacheKey: CACHE_KEYS.manufacturers,
        invalidateKeys: [CACHE_KEYS.projectsList],
        columns: [
          { key: "name", label: "Manufacturer Name", type: "text" },
          { key: "rate", label: "Rate", type: "number" },
        ],
        data: manufacturers,
      },
      {
        id: "leaf-guard",
        title: "Leaf Guard",
        description: "Keep leaf guard options and pricing up to date.",
        tableName: "core_s_leaf_guards",
        pkColumn: "leaf_guard_id",
        cacheKey: CACHE_KEYS.leafGuards,
        invalidateKeys: [],
        columns: [
          { key: "name", label: "Name", type: "text" },
          { key: "price", label: "Price", type: "number" },
        ],
        data: leafGuards,
      },
      {
        id: "discounts",
        title: "Discounts",
        description: "Define discount percentages and when they should be used.",
        tableName: "core_s_discounts",
        pkColumn: "discount_id",
        cacheKey: CACHE_KEYS.discounts,
        invalidateKeys: [],
        columns: [
          { key: "percentage", label: "Percent", type: "number" },
          { key: "description", label: "Description", type: "text" },
        ],
        data: discounts,
      },
      {
        id: "trip-fee-rates",
        title: "Trip Fee Rates",
        description: "Set travel fee labels and rates for distance tiers.",
        tableName: "core_s_trip_rates",
        pkColumn: "trip_id",
        cacheKey: CACHE_KEYS.tripRates,
        invalidateKeys: [CACHE_KEYS.projectsList],
        columns: [
          { key: "label", label: "Trip", type: "text" },
          { key: "rate", label: "Rate", type: "number" },
        ],
        data: tripFeeRates,
      },
    ],
    [colors, discounts, leafGuards, manufacturers, statuses, tripFeeRates]
  );

  const loadAll = useCallback(async () => {
    try {
      const response = await fetch("/api/setup/global", {
        method: "GET",
        cache: "no-store",
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Unable to load setup options");
      }

      setStatuses(Array.isArray(payload?.statuses) ? payload.statuses : []);
      setColors(Array.isArray(payload?.colors) ? payload.colors : []);
      setManufacturers(Array.isArray(payload?.manufacturers) ? payload.manufacturers : []);
      setLeafGuards(Array.isArray(payload?.leafGuards) ? payload.leafGuards : []);
      setDiscounts(Array.isArray(payload?.discounts) ? payload.discounts : []);
      setTripFeeRates(Array.isArray(payload?.tripRates) ? payload.tripRates : []);

      const sourceErrors = Array.isArray(payload?.sourceErrors) ? payload.sourceErrors : [];
      if (sourceErrors.length > 0) {
        toastError("Some setup categories failed to load. Please refresh and try again.", "Setup Controls");
      }
    } catch (error) {
      console.error("Failed to load global setup data", error);
      toastError(error?.message || "Unable to load setup options", "Setup Controls");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAll();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadAll]);

  useEffect(() => {
    if (setupSections.length === 0) return;

    const activeExists = setupSections.some((section) => section.id === activeSetupId);
    if (!activeExists) {
      setActiveSetupId(setupSections[0].id);
    }
  }, [activeSetupId, setupSections]);

  return (
    <Container className="py-4 setup-shell" style={{ maxWidth: 1220 }}>
      <div className="d-flex align-items-center mb-3">
        <Link href="/" className="back-link me-3">
          <i className="bi bi-arrow-left" aria-hidden="true" /> Back
        </Link>
        <div>
          <h2 className="mb-0">Setup Controls</h2>
          <p className="text-muted mb-0">
            Manage shared options used across your apps.
          </p>
        </div>
      </div>

      <div className="setup-split-layout">
        <aside className="setup-side-nav" aria-label="Setup categories">
          <p className="setup-side-nav-label">Setup Categories</p>
          <div className="setup-side-nav-list">
            {setupSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`setup-side-nav-item ${activeSetupId === section.id ? "is-active" : ""}`}
                onClick={() => setActiveSetupId(section.id)}
              >
                <span className="setup-side-nav-item-main">
                  <span className="setup-side-nav-item-title">{section.title}</span>
                  <span className="setup-side-nav-item-meta">
                    {(sectionState?.[section.id]?.rowCount ?? section.data.length)} items
                  </span>
                </span>
                <span className="setup-side-nav-item-end">
                  {sectionState?.[section.id]?.isDirty ? (
                    <span className="setup-side-nav-dirty-dot" aria-label="Unsaved changes" />
                  ) : null}
                  <i className="bi bi-chevron-right" aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="setup-content-pane" role="region" aria-live="polite">
          {setupSections.map((section) => (
            <div
              key={section.id}
              className={activeSetupId === section.id ? "setup-content-panel" : "setup-content-panel d-none"}
            >
              <SetupTable
                sectionId={section.id}
                title={section.title}
                description={section.description}
                tableName={section.tableName}
                pkColumn={section.pkColumn}
                onStateChange={handleSectionStateChange}
                cacheNamespace={CACHE_NAMESPACE}
                cacheKey={section.cacheKey}
                invalidateKeys={section.invalidateKeys}
                columns={section.columns}
                data={section.data}
                onSave={loadAll}
              />
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}


