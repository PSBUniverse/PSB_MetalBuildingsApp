"use client";

import { useCallback, useMemo } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Button from "@/shared/components/ui/controls/Button";
import ActionColumn from "@/shared/components/ui/table/ActionColumn";

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

function toRowId(row, rowIdKey, index) {
  const value = row?.[rowIdKey];
  return value === undefined || value === null || value === "" ? `row-${index}` : String(value);
}

function renderValue(value) {
  return value === undefined || value === null || value === "" ? "--" : value;
}

function resolveCellStyle(column) {
  return {
    width: column?.width,
    textAlign: column?.align || "left",
    verticalAlign: "middle",
    wordBreak: "break-word",
  };
}

function ActionCell({
  row,
  rowIndex,
  draggable,
  dragHandleProps,
  actions,
  batchMode,
  onBatchChange,
}) {
  const handleAction = ({ action, row: actionRow }) => {
    const targetRow = actionRow || row;

    if (batchMode && typeof onBatchChange === "function") {
      const batchType = resolveBatchTypeFromAction(action);
      const nextBatchState = resolveNextBatchState(targetRow?.__batchState, batchType);
      const nextRow = {
        ...(targetRow || {}),
        __batchState: nextBatchState,
      };

      onBatchChange({
        type: batchType,
        row: nextRow,
        previousRow: targetRow,
        action,
        batchState: nextBatchState,
        source: "SetupTable",
      });
      return;
    }

    if (typeof action?.onClick === "function") {
      action.onClick(targetRow, rowIndex);
    }
  };

  return (
    <td
      style={{ width: 140, verticalAlign: "middle", textAlign: "center", whiteSpace: "nowrap" }}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      {draggable ? (
        <div className="d-flex align-items-center justify-content-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2 psb-setup-action-btn psb-setup-action-drag"
            aria-label="Drag row to reorder"
            title="Drag row to reorder"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            {...dragHandleProps}
          >
            <i className="bi bi-grip-vertical" aria-hidden="true" />
          </Button>
          <ActionColumn row={row} actions={actions} onAction={handleAction} />
        </div>
      ) : (
        <ActionColumn row={row} actions={actions} onAction={handleAction} />
      )}
    </td>
  );
}

function SortableBodyRow({
  row,
  rowIndex,
  rowId,
  columns,
  actionColumnVisible,
  rowClickable,
  isSelected,
  onRowClick,
  draggable,
  actions,
  rowClassName,
  batchMode,
  onBatchChange,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rowId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: isSelected ? "#eef4ff" : undefined,
    opacity: isDragging ? 0.85 : 1,
    cursor: rowClickable ? "pointer" : "default",
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={["psb-setup-row", rowClassName, isSelected ? "psb-setup-row-selected" : ""].filter(Boolean).join(" ")}
      onClick={rowClickable ? () => onRowClick(row) : undefined}
    >
      {actionColumnVisible ? (
        <ActionCell
          row={row}
          rowIndex={rowIndex}
          draggable={draggable}
          dragHandleProps={{ ...attributes, ...listeners }}
          actions={actions}
          batchMode={batchMode}
          onBatchChange={onBatchChange}
        />
      ) : null}
      {columns.map((column) => {
        const rawValue = row?.[column.key];
        const rendered = typeof column.render === "function" ? column.render(row, rawValue, rowIndex) : renderValue(rawValue);

        return (
          <td key={`${rowId}-${column.key}`} style={resolveCellStyle(column)}>
            {rendered}
          </td>
        );
      })}
    </tr>
  );
}

function StaticBodyRow({
  row,
  rowIndex,
  rowId,
  columns,
  actionColumnVisible,
  rowClickable,
  isSelected,
  onRowClick,
  draggable,
  actions,
  rowClassName,
  batchMode,
  onBatchChange,
}) {
  return (
    <tr
      style={{
        backgroundColor: isSelected ? "#eef4ff" : undefined,
        cursor: rowClickable ? "pointer" : "default",
      }}
      className={["psb-setup-row", rowClassName, isSelected ? "psb-setup-row-selected" : ""].filter(Boolean).join(" ")}
      onClick={rowClickable ? () => onRowClick(row) : undefined}
    >
      {actionColumnVisible ? (
        <ActionCell
          row={row}
          rowIndex={rowIndex}
          draggable={draggable}
          actions={actions}
          batchMode={batchMode}
          onBatchChange={onBatchChange}
        />
      ) : null}
      {columns.map((column) => {
        const rawValue = row?.[column.key];
        const rendered = typeof column.render === "function" ? column.render(row, rawValue, rowIndex) : renderValue(rawValue);

        return (
          <td key={`${rowId}-${column.key}`} style={resolveCellStyle(column)}>
            {rendered}
          </td>
        );
      })}
    </tr>
  );
}

export default function SetupTable({
  columns = [],
  rows = [],
  rowIdKey = "id",
  selectedRowId = null,
  onRowClick,
  actions = [],
  showActionColumn = true,
  onHeaderContextMenu,
  draggable = false,
  onReorder,
  emptyMessage = "No records found.",
  className = "",
  batchMode = false,
  onBatchChange,
}) {
  const normalizedColumns = Array.isArray(columns) ? columns : [];
  const normalizedRows = useMemo(
    () => (Array.isArray(rows) ? rows : []).map((row, index) => ({ row, rowId: toRowId(row, rowIdKey, index), index })),
    [rowIdKey, rows],
  );
  const rowIds = useMemo(() => normalizedRows.map((entry) => entry.rowId), [normalizedRows]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

  const rowClickable = typeof onRowClick === "function";
  const hasRows = normalizedRows.length > 0;
  const actionColumnVisible = showActionColumn === true && (draggable || Array.isArray(actions) && actions.length > 0);
  const batchModeEnabled = batchMode === true && typeof onBatchChange === "function";

  const handleHeaderContextMenu = useCallback(
    (event, column = null) => {
      if (typeof onHeaderContextMenu === "function") {
        onHeaderContextMenu(event, column);
      }
    },
    [onHeaderContextMenu],
  );

  const handleDragEnd = useCallback(
    (event) => {
      if (!draggable || typeof onReorder !== "function") {
        return;
      }

      const activeId = String(event?.active?.id || "");
      const overId = String(event?.over?.id || "");

      if (!activeId || !overId || activeId === overId) {
        return;
      }

      const oldIndex = rowIds.indexOf(activeId);
      const newIndex = rowIds.indexOf(overId);

      if (oldIndex < 0 || newIndex < 0) {
        return;
      }

      onReorder(arrayMove(rows, oldIndex, newIndex));
    },
    [draggable, onReorder, rowIds, rows],
  );

  const tableBody = !hasRows ? (
    <tbody>
      <tr>
        <td colSpan={normalizedColumns.length + (actionColumnVisible ? 1 : 0)} className="text-muted text-center py-3">
          {emptyMessage}
        </td>
      </tr>
    </tbody>
  ) : draggable ? (
    <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
      <tbody>
        {normalizedRows.map(({ row, rowId, index }) => (
          <SortableBodyRow
            key={rowId}
            row={row}
            rowIndex={index}
            rowId={rowId}
            columns={normalizedColumns}
            actionColumnVisible={actionColumnVisible}
            rowClickable={rowClickable}
            isSelected={String(selectedRowId ?? "") === String(row?.[rowIdKey] ?? "")}
            onRowClick={onRowClick}
            draggable={draggable}
            actions={actions}
            batchMode={batchModeEnabled}
            onBatchChange={onBatchChange}
            rowClassName={[
              index % 2 === 1 ? "table-light" : "",
              resolveBatchClassName(row?.__batchState),
            ].filter(Boolean).join(" ")}
          />
        ))}
      </tbody>
    </SortableContext>
  ) : (
    <tbody>
      {normalizedRows.map(({ row, rowId, index }) => (
        <StaticBodyRow
          key={rowId}
          row={row}
          rowIndex={index}
          rowId={rowId}
          columns={normalizedColumns}
          actionColumnVisible={actionColumnVisible}
          rowClickable={rowClickable}
          isSelected={String(selectedRowId ?? "") === String(row?.[rowIdKey] ?? "")}
          onRowClick={onRowClick}
          draggable={false}
          actions={actions}
          batchMode={batchModeEnabled}
          onBatchChange={onBatchChange}
          rowClassName={[
            index % 2 === 1 ? "table-light" : "",
            resolveBatchClassName(row?.__batchState),
          ].filter(Boolean).join(" ")}
        />
      ))}
    </tbody>
  );

  const tableMarkup = (
    <table className="table table-sm table-hover mb-0" style={{ width: "100%", tableLayout: "fixed" }}>
      <thead className="table-light" onContextMenu={(event) => handleHeaderContextMenu(event, null)}>
        <tr>
          {actionColumnVisible ? (
            <th style={{ width: 140, verticalAlign: "middle" }} onContextMenu={(event) => handleHeaderContextMenu(event, null)}>
              Actions
            </th>
          ) : null}
          {normalizedColumns.map((column) => (
            <th
              key={column.key}
              style={{ width: column?.width, textAlign: column?.align || "left", verticalAlign: "middle" }}
              onContextMenu={(event) => handleHeaderContextMenu(event, column)}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      {tableBody}
    </table>
  );

  return (
    <div className={className} style={{ border: "1px solid #dee2e6", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff" }}>
      {draggable && hasRows ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {tableMarkup}
        </DndContext>
      ) : tableMarkup}
    </div>
  );
}