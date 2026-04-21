"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Form, Spinner, Table as BootstrapTable } from "react-bootstrap";
import Button from "@/shared/components/ui/controls/Button";
import SearchBar from "@/shared/components/ui/controls/SearchBar";
import ActionColumn from "@/shared/components/ui/table/ActionColumn";
import TableContextMenu from "@/shared/components/ui/table/TableContextMenu";
import TableSidePanel from "@/shared/components/ui/table/TableSidePanel";
import { createFilterConfig, TABLE_FILTER_TYPES } from "@/shared/components/ui/table/filterSchema";

const DEFAULT_SEARCH_DEBOUNCE_MS = 350;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 30, 50, 100, 500];
const DEFAULT_MIN_COLUMN_WIDTH = 96;
const ACTION_COLUMN_VISIBILITY_KEY = "__psb_action_column__";
const ACTION_COLUMN_WIDTH = 112;

const BATCH_TYPE_CREATED = "create";
const BATCH_TYPE_UPDATED = "update";
const BATCH_TYPE_DELETED = "delete";

const BATCH_STATE_NONE = "none";
const BATCH_STATE_CREATED = "created";
const BATCH_STATE_UPDATED = "updated";
const BATCH_STATE_DELETED = "deleted";

function normalizeBatchType(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (!raw) return "";
  if (raw === BATCH_TYPE_CREATED || raw === BATCH_STATE_CREATED || raw === "new") return BATCH_TYPE_CREATED;
  if (raw === BATCH_TYPE_UPDATED || raw === BATCH_STATE_UPDATED || raw === "edited") return BATCH_TYPE_UPDATED;
  if (raw === BATCH_TYPE_DELETED || raw === BATCH_STATE_DELETED || raw === "deactivated") return BATCH_TYPE_DELETED;

  return "";
}

function inferBatchTypeFromText(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";

  if (/(delete|deactivate|remove|archive)/.test(raw)) return BATCH_TYPE_DELETED;
  if (/(create|add|new)/.test(raw)) return BATCH_TYPE_CREATED;
  if (/(edit|update|toggle|enable|disable|save)/.test(raw)) return BATCH_TYPE_UPDATED;

  return "";
}

function resolveBatchTypeFromAction(action) {
  const explicitType = normalizeBatchType(
    action?.batchType
    || action?.batchEventType
    || action?.mutationType
    || action?.intent,
  );

  if (explicitType) {
    return explicitType;
  }

  const inferredType = inferBatchTypeFromText(`${action?.key || ""} ${action?.label || ""}`);
  return inferredType || BATCH_TYPE_UPDATED;
}

function normalizeBatchState(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (!raw || raw === BATCH_STATE_NONE) return BATCH_STATE_NONE;
  if (raw === BATCH_STATE_CREATED || raw === "new") return BATCH_STATE_CREATED;
  if (raw === BATCH_STATE_UPDATED || raw === "edited") return BATCH_STATE_UPDATED;
  if (raw === BATCH_STATE_DELETED || raw === "deactivated") return BATCH_STATE_DELETED;

  return BATCH_STATE_NONE;
}

function resolveNextBatchState(currentBatchState, batchType) {
  const normalizedState = normalizeBatchState(currentBatchState);
  const normalizedType = normalizeBatchType(batchType);

  if (normalizedType === BATCH_TYPE_CREATED) {
    return BATCH_STATE_CREATED;
  }

  if (normalizedType === BATCH_TYPE_DELETED) {
    return BATCH_STATE_DELETED;
  }

  if (normalizedType === BATCH_TYPE_UPDATED) {
    return normalizedState === BATCH_STATE_CREATED ? BATCH_STATE_CREATED : BATCH_STATE_UPDATED;
  }

  return normalizedState;
}

function resolveBatchClassName(batchState) {
  const normalizedState = normalizeBatchState(batchState);

  if (normalizedState === BATCH_STATE_CREATED) return "psb-row-created";
  if (normalizedState === BATCH_STATE_UPDATED) return "psb-row-updated";
  if (normalizedState === BATCH_STATE_DELETED) return "psb-row-deleted";

  return "";
}

function isDevEnvironment() {
  return process.env.NODE_ENV !== "production";
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(`[Table] ${message}`);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toIntegerOrFallback(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function isEmptyFilterValue(value) {
  if (value === undefined || value === null || value === "") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (isPlainObject(value)) {
    return Object.values(value).every((entry) => isEmptyFilterValue(entry));
  }

  return false;
}

function getDateRangeValue(rawValue) {
  if (!isPlainObject(rawValue)) {
    return {
      start: "",
      end: "",
    };
  }

  return {
    start: String(rawValue.start || ""),
    end: String(rawValue.end || ""),
  };
}

function normalizeColumns(columns) {
  return (Array.isArray(columns) ? columns : []).map((column, index) => {
    const key = String(column?.key || `column_${index}`).trim();
    const configuredWidth = toIntegerOrFallback(column?.width, 0);
    const configuredMinWidth = toIntegerOrFallback(column?.minWidth, DEFAULT_MIN_COLUMN_WIDTH);

    const minWidth = Math.max(DEFAULT_MIN_COLUMN_WIDTH, configuredMinWidth);
    const width = configuredWidth > 0 ? Math.max(configuredWidth, minWidth) : minWidth;

    return {
      ...column,
      key,
      label: String(column?.label || key),
      sortable: column?.sortable === true,
      resizable: column?.resizable !== false,
      minWidth,
      width,
    };
  });
}

function normalizeColumnSizing(rawColumnSizing, columns) {
  const providedSizing = isPlainObject(rawColumnSizing) ? rawColumnSizing : {};
  const normalized = {};

  columns.forEach((column) => {
    const providedWidth = toIntegerOrFallback(providedSizing[column.key], 0);
    normalized[column.key] = providedWidth > 0 ? Math.max(providedWidth, column.minWidth) : column.width;
  });

  return normalized;
}

function normalizePagination(rawPagination) {
  const page = Math.max(1, toIntegerOrFallback(rawPagination?.page, 1));
  const pageSize = Math.max(1, toIntegerOrFallback(rawPagination?.pageSize, DEFAULT_PAGE_SIZE));
  const total = Math.max(0, toIntegerOrFallback(rawPagination?.total, 0));

  return {
    page,
    pageSize,
    total,
  };
}

function normalizeSortDirection(direction) {
  return String(direction || "").toLowerCase() === "desc" ? "desc" : "asc";
}

function normalizeSorting(rawSorting) {
  if (!isPlainObject(rawSorting)) {
    return {
      key: "",
      direction: "",
    };
  }

  const key = String(rawSorting.key || "").trim();

  return {
    key,
    direction: key ? normalizeSortDirection(rawSorting.direction) : "",
  };
}

function normalizeFilterOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map((option) => {
    if (isPlainObject(option)) {
      return {
        label: String(option.label ?? option.value ?? ""),
        value: option.value,
      };
    }

    return {
      label: String(option),
      value: option,
    };
  });
}

function getNestedValue(target, path) {
  if (!target || !path) {
    return undefined;
  }

  return String(path)
    .split(".")
    .reduce((acc, segment) => (acc === undefined || acc === null ? undefined : acc[segment]), target);
}

function buildPageList(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pageSet = new Set([1, totalPages, page, page - 1, page + 1, page - 2, page + 2]);
  const sortedPages = Array.from(pageSet)
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((left, right) => left - right);

  const result = [];

  sortedPages.forEach((candidate, index) => {
    const previous = sortedPages[index - 1];

    if (index > 0 && previous + 1 < candidate) {
      result.push("ellipsis");
    }

    result.push(candidate);
  });

  return result;
}

function normalizePageSizeOptions(pageSizeOptions, currentPageSize) {
  const values = Array.isArray(pageSizeOptions) ? pageSizeOptions : DEFAULT_PAGE_SIZE_OPTIONS;

  const uniqueValues = new Set(
    values
      .map((value) => toIntegerOrFallback(value, 0))
      .filter((value) => value > 0 && value <= 500),
  );

  uniqueValues.add(Math.min(500, Math.max(1, toIntegerOrFallback(currentPageSize, DEFAULT_PAGE_SIZE))));

  return Array.from(uniqueValues).sort((left, right) => left - right);
}

function validateDataTableProps({
  data,
  columns,
  state,
  filterConfig,
  actions,
  onChange,
  loading,
  children,
  batchMode,
  onBatchChange,
}) {
  ensure(children === undefined || children === null, "children are not supported in data table mode.");
  ensure(Array.isArray(data), "data must be an array.");
  ensure(Array.isArray(columns), "columns must be an array.");
  ensure(isPlainObject(state), "state must be an object.");
  ensure(Array.isArray(filterConfig), "filterConfig must be an array.");
  ensure(Array.isArray(actions), "actions must be an array.");
  ensure(typeof onChange === "function", "onChange must be a function.");
  ensure(typeof loading === "boolean", "loading must be a boolean.");

  if (batchMode === true) {
    ensure(typeof onBatchChange === "function", "onBatchChange must be a function when batchMode is enabled.");
  }

  createFilterConfig(filterConfig);

  const usedColumnKeys = new Set();

  columns.forEach((column, index) => {
    ensure(isPlainObject(column), `column at index ${index} must be an object.`);

    const key = String(column.key || "").trim();
    ensure(key !== "", `column at index ${index} is missing key.`);
    ensure(key !== ACTION_COLUMN_VISIBILITY_KEY, `column key "${ACTION_COLUMN_VISIBILITY_KEY}" is reserved.`);
    ensure(!usedColumnKeys.has(key), `column key \"${key}\" is duplicated.`);
    usedColumnKeys.add(key);

    ensure(String(column.label || "").trim() !== "", `column ${key} is missing label.`);

    if (column.render !== undefined) {
      ensure(typeof column.render === "function", `column ${key} render must be a function.`);
    }
  });

  const usedActionKeys = new Set();

  actions.forEach((action, index) => {
    ensure(isPlainObject(action), `action at index ${index} must be an object.`);

    const key = String(action.key || "").trim();
    ensure(key !== "", `action at index ${index} is missing key.`);
    ensure(!usedActionKeys.has(key), `action key \"${key}\" is duplicated.`);
    usedActionKeys.add(key);

    ensure(String(action.label || "").trim() !== "", `action ${key} is missing label.`);
    ensure(typeof action.onClick === "function", `action ${key} onClick must be a function.`);

    const actionType = String(action.type || "secondary").toLowerCase();
    ensure(
      actionType === "primary" || actionType === "secondary" || actionType === "danger",
      `action ${key} has unsupported type \"${actionType}\".`,
    );

    if (action.visible !== undefined) {
      ensure(typeof action.visible === "function", `action ${key} visible must be a function when provided.`);
    }

    if (action.disabled !== undefined) {
      ensure(typeof action.disabled === "function", `action ${key} disabled must be a function when provided.`);
    }
  });
}

export default function Table({
  data = [],
  columns = [],
  state,
  filterConfig = [],
  actions = [],
  onChange,
  batchMode = false,
  onBatchChange,
  loading = false,
  className = "",
  emptyMessage = "No records found.",
  loadingMessage = "Loading records...",
  searchPlaceholder = "Search",
  searchDebounceMs = DEFAULT_SEARCH_DEBOUNCE_MS,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  exportFormats = ["csv", "excel"],
  children,
}) {
  const tableId = useId();

  if (isDevEnvironment()) {
    validateDataTableProps({
      data,
      columns,
      state,
      filterConfig,
      actions,
      onChange,
      batchMode,
      onBatchChange,
      loading,
      children,
    });
  }

  const normalizedColumns = useMemo(() => normalizeColumns(columns), [columns]);
  const actionColumnEnabled = Array.isArray(actions) && actions.length > 0;
  const batchModeEnabled = batchMode === true && typeof onBatchChange === "function";
  const normalizedFilterConfig = useMemo(() => createFilterConfig(filterConfig), [filterConfig]);
  const normalizedPagination = useMemo(() => normalizePagination(state?.pagination), [state?.pagination]);
  const normalizedSorting = useMemo(() => normalizeSorting(state?.sorting), [state?.sorting]);
  const columnSizing = useMemo(
    () => normalizeColumnSizing(state?.columnSizing, normalizedColumns),
    [normalizedColumns, state?.columnSizing],
  );

  const filters = useMemo(() => (isPlainObject(state?.filters) ? state.filters : {}), [state?.filters]);

  const columnVisibility = useMemo(() => {
    const visibilityState = isPlainObject(state?.columnVisibility) ? state.columnVisibility : {};
    const visibilityMap = {};

    if (actionColumnEnabled) {
      visibilityMap[ACTION_COLUMN_VISIBILITY_KEY] = visibilityState[ACTION_COLUMN_VISIBILITY_KEY] !== false;
    }

    normalizedColumns.forEach((column) => {
      visibilityMap[column.key] = visibilityState[column.key] !== false;
    });

    return visibilityMap;
  }, [actionColumnEnabled, normalizedColumns, state?.columnVisibility]);

  const actionColumnVisible = actionColumnEnabled && columnVisibility[ACTION_COLUMN_VISIBILITY_KEY] !== false;

  const visibleColumns = useMemo(() => {
    const nextVisibleColumns = normalizedColumns.filter((column) => columnVisibility[column.key] !== false);
    return nextVisibleColumns.length > 0 ? nextVisibleColumns : normalizedColumns.slice(0, 1);
  }, [columnVisibility, normalizedColumns]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(normalizedPagination.total / normalizedPagination.pageSize)),
    [normalizedPagination.pageSize, normalizedPagination.total],
  );

  const safePage = useMemo(
    () => Math.min(Math.max(1, normalizedPagination.page), totalPages),
    [normalizedPagination.page, totalPages],
  );

  const pageList = useMemo(() => buildPageList(safePage, totalPages), [safePage, totalPages]);

  const firstVisibleIndex = normalizedPagination.total === 0 ? 0 : (safePage - 1) * normalizedPagination.pageSize + 1;
  const lastVisibleIndex =
    normalizedPagination.total === 0
      ? 0
      : Math.min(normalizedPagination.total, safePage * normalizedPagination.pageSize);

  const normalizedPageSizeOptions = useMemo(
    () => normalizePageSizeOptions(pageSizeOptions, normalizedPagination.pageSize),
    [normalizedPagination.pageSize, pageSizeOptions],
  );

  const tableColSpan = visibleColumns.length + (actionColumnVisible ? 1 : 0);

  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [activeResizeColumnKey, setActiveResizeColumnKey] = useState("");
  const [contextMenuState, setContextMenuState] = useState({
    open: false,
    x: 0,
    y: 0,
  });

  const resizeStateRef = useRef(null);
  const columnSizingRef = useRef(columnSizing);
  const searchInputId = `${tableId}-search`;
  const searchValue = String(filters.search || "");

  useEffect(() => {
    columnSizingRef.current = columnSizing;
  }, [columnSizing]);

  const emitChange = useCallback(
    (event) => {
      onChange(event);
    },
    [onChange],
  );

  const getColumnWidth = useCallback(
    (column) => {
      const fromState = toIntegerOrFallback(columnSizing[column.key], column.width);
      return Math.max(column.minWidth, fromState);
    },
    [columnSizing],
  );

  const handleSearchDebouncedChange = useCallback(
    (nextValue) => {
      emitChange({
        type: "search",
        value: String(nextValue || ""),
      });
    },
    [emitChange],
  );

  const handleFilterValueChange = useCallback(
    (filterKey, nextValue) => {
      const nextFilters = {
        ...filters,
        [filterKey]: nextValue,
      };

      if (isEmptyFilterValue(nextValue)) {
        delete nextFilters[filterKey];
      }

      emitChange({
        type: "filters",
        filters: nextFilters,
      });
    },
    [emitChange, filters],
  );

  const handleSortToggle = useCallback(
    (column) => {
      if (!column.sortable) {
        return;
      }

      const nextDirection =
        normalizedSorting.key === column.key
          ? normalizedSorting.direction === "asc"
            ? "desc"
            : "asc"
          : "asc";

      emitChange({
        type: "sorting",
        sorting: {
          key: column.key,
          direction: nextDirection,
        },
      });
    },
    [emitChange, normalizedSorting.direction, normalizedSorting.key],
  );

  const requestPage = useCallback(
    (nextPage, nextPageSize = normalizedPagination.pageSize) => {
      const safePageSize = Math.min(500, Math.max(1, toIntegerOrFallback(nextPageSize, normalizedPagination.pageSize)));
      const boundedPage = Math.min(Math.max(1, toIntegerOrFallback(nextPage, 1)), Math.max(1, Math.ceil(normalizedPagination.total / safePageSize)));

      emitChange({
        type: "pagination",
        pagination: {
          page: boundedPage,
          pageSize: safePageSize,
        },
      });
    },
    [emitChange, normalizedPagination.pageSize, normalizedPagination.total],
  );

  const handlePageSizeChange = useCallback(
    (event) => {
      const nextPageSize = Math.min(500, Math.max(1, toIntegerOrFallback(event.target.value, normalizedPagination.pageSize)));
      requestPage(1, nextPageSize);
    },
    [normalizedPagination.pageSize, requestPage],
  );

  const handleHeaderContextMenu = useCallback((event) => {
    event.preventDefault();

    setContextMenuState({
      open: true,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuState((current) => ({
      ...current,
      open: false,
    }));
  }, []);

  const handleOpenCustomization = useCallback(() => {
    setSidePanelOpen(true);
  }, []);

  const startResize = useCallback((event, column) => {
    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      columnKey: column.key,
      minWidth: column.minWidth,
      startX: event.clientX,
      startWidth: getColumnWidth(column),
    };

    setActiveResizeColumnKey(column.key);
  }, [getColumnWidth]);

  const handleResizeMouseMove = useCallback(
    (event) => {
      if (!resizeStateRef.current) {
        return;
      }

      const { columnKey, minWidth, startX, startWidth } = resizeStateRef.current;
      const deltaX = event.clientX - startX;
      const nextWidth = Math.max(minWidth, startWidth + deltaX);
      const nextColumnSizing = {
        ...columnSizingRef.current,
        [columnKey]: nextWidth,
      };

      emitChange({
        type: "columnResize",
        columnKey,
        width: nextWidth,
        columnSizing: nextColumnSizing,
      });
    },
    [emitChange],
  );

  const handleResizeMouseUp = useCallback(() => {
    if (!resizeStateRef.current) {
      return;
    }

    resizeStateRef.current = null;
    setActiveResizeColumnKey("");
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleResizeMouseMove);
    window.addEventListener("mouseup", handleResizeMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleResizeMouseMove);
      window.removeEventListener("mouseup", handleResizeMouseUp);
    };
  }, [handleResizeMouseMove, handleResizeMouseUp]);

  const handleToggleColumnVisibility = useCallback(
    (columnKey, nextVisible) => {
      const currentlyVisible = columnVisibility[columnKey] !== false;
      const visibleDataColumnCount = normalizedColumns.filter((column) => columnVisibility[column.key] !== false).length;

      if (
        columnKey !== ACTION_COLUMN_VISIBILITY_KEY &&
        !nextVisible &&
        currentlyVisible &&
        visibleDataColumnCount <= 1
      ) {
        return;
      }

      const nextVisibility = {
        ...columnVisibility,
        [columnKey]: nextVisible,
      };

      emitChange({
        type: "columnVisibility",
        columnVisibility: nextVisibility,
        columnKey,
        visible: nextVisible,
      });
    },
    [columnVisibility, emitChange, normalizedColumns],
  );

  const handleClearSorting = useCallback(() => {
    emitChange({
      type: "sorting",
      sorting: {
        key: "",
        direction: "",
      },
      reason: "clear",
    });
  }, [emitChange]);

  const handleExport = useCallback(
    (format) => {
      emitChange({
        type: "export",
        format,
        context: {
          filters,
          sorting: normalizedSorting,
          pagination: {
            page: safePage,
            pageSize: normalizedPagination.pageSize,
            total: normalizedPagination.total,
          },
          visibleColumnKeys: visibleColumns.map((column) => column.key),
        },
      });
    },
    [emitChange, filters, normalizedPagination.pageSize, normalizedPagination.total, normalizedSorting, safePage, visibleColumns],
  );

  const handleAction = useCallback(
    ({ action, row }) => {
      if (batchModeEnabled) {
        const batchType = resolveBatchTypeFromAction(action);
        const nextBatchState = resolveNextBatchState(row?.__batchState, batchType);
        const nextRow = {
          ...(row || {}),
          __batchState: nextBatchState,
        };

        onBatchChange({
          type: batchType,
          row: nextRow,
          previousRow: row,
          action,
          batchState: nextBatchState,
          source: "Table",
        });
        return;
      }

      emitChange({
        type: "action",
        action,
        row,
      });
    },
    [batchModeEnabled, emitChange, onBatchChange],
  );

  const sidePanelColumns = useMemo(() => {
    if (!actionColumnEnabled) {
      return normalizedColumns;
    }

    return [
      {
        key: ACTION_COLUMN_VISIBILITY_KEY,
        label: "Actions",
        isSystem: true,
      },
      ...normalizedColumns,
    ];
  }, [actionColumnEnabled, normalizedColumns]);

  const mergedClassName = ["psb-ui-table", "psb-ui-data-table", className].filter(Boolean).join(" ");

  return (
    <section className="psb-ui-table-shell" aria-label="Data table">
      <div className="psb-ui-table-filters-shell">
        <button
          type="button"
          className="psb-ui-table-filters-toggle"
          aria-expanded={filtersExpanded}
          onClick={() => setFiltersExpanded((current) => !current)}
        >
          <span>Filters</span>
          <i className={`bi ${filtersExpanded ? "bi-chevron-up" : "bi-chevron-down"}`} aria-hidden="true" />
        </button>

        {filtersExpanded ? (
          <div className="psb-ui-table-filters" role="group" aria-label="Table filters">
            {normalizedFilterConfig.map((filter) => {
              const filterId = `${tableId}-filter-${filter.key}`;
              const filterValue = filters[filter.key];

              if (filter.type === TABLE_FILTER_TYPES.SELECT) {
                const options = normalizeFilterOptions(filter.options);
                const selectedValue = filterValue === undefined || filterValue === null ? "" : String(filterValue);

                return (
                  <div key={filter.key} className="psb-ui-table-filter">
                    <Form.Label className="psb-ui-table-filter-label" htmlFor={filterId}>
                      {filter.label}
                    </Form.Label>
                    <Form.Select
                      id={filterId}
                      value={selectedValue}
                      disabled={filter.loading === true}
                      onChange={(event) => handleFilterValueChange(filter.key, event.target.value)}
                    >
                      <option value="">All</option>
                      {options.map((option, index) => (
                        <option key={`${filter.key}-${index}`} value={String(option.value ?? "")}>
                          {option.label}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                );
              }

              if (filter.type === TABLE_FILTER_TYPES.DATE) {
                return (
                  <div key={filter.key} className="psb-ui-table-filter">
                    <Form.Label className="psb-ui-table-filter-label" htmlFor={filterId}>
                      {filter.label}
                    </Form.Label>
                    <Form.Control
                      id={filterId}
                      type="date"
                      value={String(filterValue || "")}
                      onChange={(event) => handleFilterValueChange(filter.key, event.target.value)}
                    />
                  </div>
                );
              }

              if (filter.type === TABLE_FILTER_TYPES.DATERANGE) {
                const dateRange = getDateRangeValue(filterValue);

                return (
                  <div key={filter.key} className="psb-ui-table-filter psb-ui-table-filter-range">
                    <Form.Label className="psb-ui-table-filter-label" htmlFor={`${filterId}-start`}>
                      {filter.label}
                    </Form.Label>
                    <div className="psb-ui-table-range-inputs">
                      <Form.Control
                        id={`${filterId}-start`}
                        type="date"
                        value={dateRange.start}
                        onChange={(event) =>
                          handleFilterValueChange(filter.key, {
                            start: event.target.value,
                            end: dateRange.end,
                          })
                        }
                      />
                      <Form.Control
                        id={`${filterId}-end`}
                        type="date"
                        value={dateRange.end}
                        onChange={(event) =>
                          handleFilterValueChange(filter.key, {
                            start: dateRange.start,
                            end: event.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                );
              }

              return (
                <div key={filter.key} className="psb-ui-table-filter">
                  <Form.Label className="psb-ui-table-filter-label" htmlFor={filterId}>
                    {filter.label}
                  </Form.Label>
                  <Form.Control
                    id={filterId}
                    type="text"
                    value={String(filterValue || "")}
                    onChange={(event) => handleFilterValueChange(filter.key, event.target.value)}
                  />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="psb-ui-table-search-shell">
        <Form.Label className="psb-ui-table-filter-label" htmlFor={searchInputId}>
          Search
        </Form.Label>
        <SearchBar
          id={searchInputId}
          value={searchValue}
          debounceMs={Math.max(0, toIntegerOrFallback(searchDebounceMs, DEFAULT_SEARCH_DEBOUNCE_MS))}
          className="psb-ui-table-search-input"
          placeholder={searchPlaceholder}
          onDebouncedChange={handleSearchDebouncedChange}
        />
      </div>

      <div className="table-responsive">
        <BootstrapTable bordered hover className={mergedClassName}>
          <colgroup>
            {actionColumnVisible ? (
              <col
                style={{
                  width: `${ACTION_COLUMN_WIDTH}px`,
                  minWidth: `${ACTION_COLUMN_WIDTH}px`,
                }}
              />
            ) : null}
            {visibleColumns.map((column) => (
              <col
                key={column.key}
                style={{
                  width: `${getColumnWidth(column)}px`,
                  minWidth: `${column.minWidth}px`,
                }}
              />
            ))}
          </colgroup>

          <thead onContextMenu={handleHeaderContextMenu}>
            <tr>
              {actionColumnVisible ? (
                <th scope="col" className="psb-ui-table-actions-header" onContextMenu={handleHeaderContextMenu}>
                  Actions
                </th>
              ) : null}

              {visibleColumns.map((column) => {
                const isSortedColumn = normalizedSorting.key === column.key;
                const sortIcon =
                  !isSortedColumn
                    ? "bi-arrow-down-up"
                    : normalizedSorting.direction === "asc"
                      ? "bi-sort-up"
                      : "bi-sort-down";

                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={{
                      width: `${getColumnWidth(column)}px`,
                      minWidth: `${column.minWidth}px`,
                    }}
                    className={column.resizable ? "psb-ui-table-th-resizable" : ""}
                    onContextMenu={handleHeaderContextMenu}
                  >
                    <div className="psb-ui-table-th-content">
                      {column.sortable ? (
                        <button
                          type="button"
                          className="psb-ui-table-sort-btn"
                          onClick={() => handleSortToggle(column)}
                          onContextMenu={handleHeaderContextMenu}
                          aria-label={`Sort by ${column.label}`}
                        >
                          <span>{column.label}</span>
                          <i className={`bi ${sortIcon}`} aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="psb-ui-table-header-label" onContextMenu={handleHeaderContextMenu}>{column.label}</span>
                      )}

                      {column.resizable ? (
                        <span
                          className={["psb-ui-table-resizer", activeResizeColumnKey === column.key ? "is-active" : ""]
                            .filter(Boolean)
                            .join(" ")}
                          onMouseDown={(event) => startResize(event, column)}
                          role="presentation"
                        />
                      ) : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="psb-ui-table-loading" colSpan={tableColSpan}>
                  <span className="d-inline-flex align-items-center gap-2">
                    <Spinner size="sm" animation="border" role="status" />
                    <span>{loadingMessage}</span>
                  </span>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td className="psb-ui-table-empty" colSpan={tableColSpan}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={String(row?.id || rowIndex)} className={resolveBatchClassName(row?.__batchState) || undefined}>
                  {actionColumnVisible ? (
                    <td className="psb-ui-table-actions-cell">
                      <ActionColumn row={row} actions={actions} onAction={handleAction} />
                    </td>
                  ) : null}

                  {visibleColumns.map((column) => {
                    const rawValue = getNestedValue(row, column.key);
                    const renderedValue =
                      typeof column.render === "function"
                        ? column.render(row, rawValue, {
                            rowIndex,
                            column,
                          })
                        : rawValue;

                    return (
                      <td key={`${rowIndex}-${column.key}`}>
                        {renderedValue === undefined || renderedValue === null || renderedValue === ""
                          ? "-"
                          : renderedValue}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </BootstrapTable>
      </div>

      <div className="psb-ui-table-pagination">
        <div className="psb-ui-table-pagination-summary">
          {normalizedPagination.total === 0
            ? "No records"
            : `Showing ${firstVisibleIndex}-${lastVisibleIndex} of ${normalizedPagination.total}`}
        </div>

        <div className="psb-ui-table-pagination-controls">
          <div className="psb-ui-table-page-size-wrap">
            <Form.Label htmlFor={`${tableId}-page-size`} className="psb-ui-table-filter-label mb-0">
              Rows
            </Form.Label>
            <Form.Select
              id={`${tableId}-page-size`}
              className="psb-ui-table-page-size-select"
              size="sm"
              value={String(normalizedPagination.pageSize)}
              onChange={handlePageSizeChange}
            >
              {normalizedPageSizeOptions.map((option) => (
                <option key={option} value={String(option)}>
                  {option}
                </option>
              ))}
            </Form.Select>
          </div>

          <Button size="sm" variant="secondary" disabled={safePage <= 1} onClick={() => requestPage(safePage - 1)}>
            Prev
          </Button>

          <div className="psb-ui-table-page-list" aria-label="Pagination">
            {pageList.map((entry, index) =>
              entry === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="psb-ui-table-page-ellipsis" aria-hidden="true">
                  ...
                </span>
              ) : (
                <button
                  key={`page-${entry}`}
                  type="button"
                  className={["psb-ui-table-page-btn", entry === safePage ? "is-active" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => requestPage(Number(entry))}
                >
                  {entry}
                </button>
              ),
            )}
          </div>

          <Button
            size="sm"
            variant="secondary"
            disabled={safePage >= totalPages}
            onClick={() => requestPage(safePage + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <TableContextMenu
        open={contextMenuState.open}
        position={{ x: contextMenuState.x, y: contextMenuState.y }}
        onCustomize={handleOpenCustomization}
        onClose={closeContextMenu}
      />

      <TableSidePanel
        open={sidePanelOpen}
        columns={sidePanelColumns}
        columnVisibility={columnVisibility}
        sorting={normalizedSorting}
        exportFormats={exportFormats}
        onToggleColumn={handleToggleColumnVisibility}
        onClearSorting={handleClearSorting}
        onExport={handleExport}
        onClose={() => setSidePanelOpen(false)}
      />
    </section>
  );
}
