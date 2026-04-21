"use client";

import { useMemo, useState } from "react";
import Button from "@/shared/components/ui/controls/Button";
import Dropdown from "@/shared/components/ui/controls/Dropdown";
import Modal from "@/shared/components/ui/overlay/Modal";

const ACTION_TYPE_ORDER = Object.freeze({
  primary: 1,
  secondary: 2,
  danger: 3,
});

function normalizeActionType(value) {
  const raw = String(value || "secondary").trim().toLowerCase();

  if (raw === "primary") return "primary";
  if (raw === "danger") return "danger";
  return "secondary";
}

function resolveButtonVariant(type) {
  if (type === "primary") return "primary";
  if (type === "danger") return "danger";
  return "secondary";
}

function resolveIconClassName(icon) {
  const raw = String(icon || "").trim();
  if (!raw) return "";

  if (raw.includes(" ")) {
    return raw;
  }

  if (raw.startsWith("bi-")) {
    return `bi ${raw}`;
  }

  if (raw.startsWith("bi")) {
    return raw;
  }

  return `bi bi-${raw}`;
}

function resolveVisibleActions(actions, row) {
  return actions
    .filter((action) => {
      if (!action || typeof action !== "object") {
        return false;
      }

      if (typeof action.visible !== "function") {
        return true;
      }

      try {
        return action.visible(row) !== false;
      } catch {
        return false;
      }
    })
    .map((action) => ({
      ...action,
      type: normalizeActionType(action.type),
    }))
    .sort((left, right) => {
      const leftOrder = ACTION_TYPE_ORDER[left.type] || ACTION_TYPE_ORDER.secondary;
      const rightOrder = ACTION_TYPE_ORDER[right.type] || ACTION_TYPE_ORDER.secondary;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return String(left.label || "").localeCompare(String(right.label || ""));
    });
}

function isDisabled(action, row) {
  if (typeof action.disabled === "function") {
    try {
      return action.disabled(row) === true;
    } catch {
      return true;
    }
  }

  return action.disabled === true;
}

function requiresConfirmation(action) {
  const actionType = normalizeActionType(action.type);
  return actionType === "danger" || action.confirm === true;
}

function resolveConfirmationMessage(action, row) {
  const label = String(action.label || "this action").trim();
  const fallbackMessage = `Confirm ${label}?`;

  const customMessage =
    typeof action.confirmMessage === "function"
      ? action.confirmMessage(row, action)
      : action.confirmMessage;

  return String(customMessage || fallbackMessage).trim() || fallbackMessage;
}

export default function ActionColumn({ row, actions = [], onAction }) {
  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  const visibleActions = useMemo(
    () => resolveVisibleActions(Array.isArray(actions) ? actions : [], row),
    [actions, row],
  );

  const emitActionDirectly = (action) => {
    if (typeof onAction === "function") {
      onAction({ action, row });
    }
  };

  const emitAction = (action) => {
    if (!action || isDisabled(action, row)) {
      return;
    }

    if (requiresConfirmation(action)) {
      setPendingConfirmation({
        action,
        message: resolveConfirmationMessage(action, row),
      });
      return;
    }

    emitActionDirectly(action);
  };

  const closeConfirmation = () => {
    setPendingConfirmation(null);
  };

  const confirmPendingAction = () => {
    const action = pendingConfirmation?.action;
    setPendingConfirmation(null);

    if (!action || isDisabled(action, row)) {
      return;
    }

    emitActionDirectly(action);
  };

  if (visibleActions.length === 0) {
    return null;
  }

  let actionContent = null;

  if (visibleActions.length === 1) {
    const action = visibleActions[0];
    const iconClassName = resolveIconClassName(action.icon);
    const useIconOnlyMode = Boolean(iconClassName);

    actionContent = (
      <Button
        size="sm"
        variant={resolveButtonVariant(action.type)}
        className={[
          "table-actions-inline-btn",
          useIconOnlyMode ? "table-actions-inline-btn-icon" : "",
        ].filter(Boolean).join(" ")}
        disabled={isDisabled(action, row)}
        onClick={() => emitAction(action)}
        title={String(action.label || "").trim() || undefined}
        aria-label={String(action.label || "").trim() || undefined}
      >
        {iconClassName ? <i className={iconClassName} aria-hidden="true" /> : null}
        {useIconOnlyMode ? <span className="visually-hidden">{action.label}</span> : action.label}
      </Button>
    );
  } else {
    const nonDangerActions = visibleActions.filter((action) => action.type !== "danger");
    const dangerActions = visibleActions.filter((action) => action.type === "danger");

    actionContent = (
      <Dropdown align="end">
        <Dropdown.Toggle variant="secondary" size="sm" className="table-actions-toggle" aria-label="Open actions">
          <i className="bi bi-three-dots-vertical" aria-hidden="true" />
        </Dropdown.Toggle>

        <Dropdown.Menu>
          {nonDangerActions.map((action) => {
            const iconClassName = resolveIconClassName(action.icon);

            return (
              <Dropdown.Item
                key={String(action.key || action.label)}
                className="table-actions-item"
                disabled={isDisabled(action, row)}
                onClick={() => emitAction(action)}
              >
                {iconClassName ? <i className={`${iconClassName} me-2`} aria-hidden="true" /> : null}
                {action.label}
              </Dropdown.Item>
            );
          })}

          {nonDangerActions.length > 0 && dangerActions.length > 0 ? <Dropdown.Divider /> : null}

          {dangerActions.map((action) => {
            const iconClassName = resolveIconClassName(action.icon);

            return (
              <Dropdown.Item
                key={String(action.key || action.label)}
                className="table-actions-item table-actions-danger-item"
                disabled={isDisabled(action, row)}
                onClick={() => emitAction(action)}
              >
                {iconClassName ? <i className={`${iconClassName} me-2`} aria-hidden="true" /> : null}
                {action.label}
              </Dropdown.Item>
            );
          })}
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  const confirmAction = pendingConfirmation?.action || null;
  const confirmActionType = normalizeActionType(confirmAction?.type);
  const confirmButtonVariant = confirmActionType === "danger" ? "danger" : "primary";
  const confirmButtonLabel = String(confirmAction?.label || "Confirm").trim() || "Confirm";

  return (
    <>
      {actionContent}

      <Modal
        show={Boolean(pendingConfirmation)}
        onHide={closeConfirmation}
        title="Confirm Action"
        footer={(
          <>
            <Button type="button" variant="ghost" onClick={closeConfirmation}>
              Cancel
            </Button>
            <Button type="button" variant={confirmButtonVariant} onClick={confirmPendingAction}>
              {confirmButtonLabel}
            </Button>
          </>
        )}
      >
        <p className="mb-0">{pendingConfirmation?.message || "Are you sure you want to continue?"}</p>
      </Modal>
    </>
  );
}
