"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function InlineEditCell({
  value,
  onCommit,
  disabled = false,
  placeholder = "--",
  type = "text",
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    setDraft(String(value ?? ""));
    setEditing(true);
  }, [disabled, value]);

  const handleCommit = useCallback(() => {
    setEditing(false);
    const trimmed = String(draft ?? "").trim();
    const original = String(value ?? "").trim();
    if (trimmed !== original) {
      onCommit?.(trimmed);
    }
  }, [draft, onCommit, value]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleCommit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setEditing(false);
        setDraft(String(value ?? ""));
      }
    },
    [handleCommit, value],
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="form-control form-control-sm psb-inline-edit-input"
        type={type}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
      />
    );
  }

  const displayValue = String(value ?? "").trim() || placeholder;

  return (
    <span
      className={`psb-inline-edit-cell${disabled ? "" : " psb-inline-edit-cell-editable"}`}
      onClick={disabled ? undefined : handleClick}
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? undefined : 0}
      onKeyDown={
        disabled
          ? undefined
          : (event) => {
              if (event.key === "Enter" || event.key === " ") handleClick();
            }
      }
    >
      {displayValue}
    </span>
  );
}
