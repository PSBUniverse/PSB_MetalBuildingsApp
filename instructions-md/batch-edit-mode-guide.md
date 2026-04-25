# TableZ Batch Edit Mode vs Without Batch Edit Mode

## Quick Summary

| Feature | Without Batch Mode | With Batch Mode (internal) | With Batch Mode (external) |
|---|---|---|---|
| **Who manages row state?** | Module hooks | TableZ (draft/baseline engine) | Module hooks (via `onBatchChange`) |
| **Row changes saved when?** | Immediately (per action) | All at once (`saveBatch`) | All at once (module calls its own save) |
| **Row CSS highlighting?** | Via `__batchState` stamp on row | Via diff engine (`batchDiff`) | Via `__batchState` stamp on row |
| **Undo delete built-in?** | Yes, via `onUndoBatchAction` prop | Yes, `removeRow` toggles `__pendingRemove` | Yes, via `onUndoBatchAction` prop |
| **Used by** | Admin modules (Status, App, Card, Company) | Future / data-table examples | Admin modules (for legacy `__batchState` flow) |

---

## 1. Without Batch Edit Mode (Default)

This is the mode used when `batchMode` is **not set** (or `false`) on `<TableZ>`.

### How actions work

```
User clicks action button
  → ActionColumn emits { action, row }
  → tableActions.handleAction receives it
  → Skips the batchMode branch entirely
  → Calls action.onClick(row, rowIndex) directly
```

Each action's `onClick` is a **module-provided callback** (e.g., `stageHardDeleteStatus`, `openDeactivateStatusDialog`). The module hook decides what to do — call an API, update local state, open a dialog, etc.

### Row state management

- The **module hook** is responsible for stamping `__batchState` on each row (e.g., `"hardDeleted"`, `"deleted"`, `"created"`, `"updated"`, `"deactivated"`, `"activated"`).
- TableZ does NOT manage row state — it just renders whatever `data` array is passed to it.
- The module decorates rows before passing them as `data` to TableZ.

### Row CSS highlighting

TableZ renders use `resolveBatchClassName(row.__batchState)` to apply CSS classes:

| `__batchState` | CSS Class | Visual |
|---|---|---|
| `"created"` | `psb-row-created` | Green highlight |
| `"updated"` | `psb-row-updated` | Blue highlight |
| `"deleted"` | `psb-row-deleted` | Red strikethrough |
| `"hardDeleted"` | `psb-row-deleted` | Red strikethrough |
| `"reordered"` | `psb-row-updated` | Blue highlight |

### Undo delete (built-in to ActionColumn)

When a row has `__batchState === "deleted"` or `"hardDeleted"` (or `__pendingRemove === true`):

1. **ActionColumn automatically hides ALL normal actions** (Edit, Deactivate, Delete, Restore, etc.)
2. **ActionColumn renders a single "Undo Delete" button** (rotate-left icon, green restore color)
3. Clicking it calls the `onUndoBatchAction(row)` callback passed to `<TableZ>`

The module provides the undo callback:
```jsx
<TableZ
  data={decoratedStatuses}
  actions={actions}
  onUndoBatchAction={hook.unstageHardDeleteStatus}
/>
```

### Confirmation modals

When an action has `type: "danger"` or `confirm: true`, ActionColumn shows a confirmation modal before executing the action. This works the same in all modes.

### What the module is responsible for

- Defining the `actions` array with `onClick` callbacks
- Stamping `__batchState` on rows
- Managing pending state (e.g., `pendingHardDeletedStatusIds`, `pendingDeactivatedStatusIds`)
- Providing `onUndoBatchAction` callback for undo
- Calling APIs to persist changes
- Handling save/cancel logic

---

## 2. With Batch Edit Mode (Internal — `batchMode={true}`)

This is the mode used when `batchMode={true}` is set on `<TableZ>` and **`onBatchChange` is NOT provided** (or batchFields are provided). TableZ manages everything internally.

### How actions work

```
User clicks action button
  → ActionColumn emits { action, row }
  → tableActions.handleAction receives it
  → Enters the batchMode branch
  → Infers batch type from the action (delete/create/update)
  → For deletes: calls batchApi.removeRow(rowId)
  → For others: calls batchApi.stageRowChange(payload)
```

The action's `onClick` is **NOT called** in this mode. TableZ's internal batch engine handles everything.

### How batch type is inferred from actions

`resolveBatchTypeFromAction(action)` checks in order:
1. Explicit `action.batchType` / `action.batchEventType` / `action.mutationType` / `action.intent`
2. Infers from `action.key` + `action.label` text:
   - `/(delete|deactivate|remove|archive)/` → `"delete"`
   - `/(create|add|new)/` → `"create"`
   - `/(edit|update|toggle|enable|disable|save)/` → `"update"`
3. Falls back to `"update"` if nothing matches

### Draft / Baseline / Diff engine

TableZ internally uses `useTableBatchEdit` which manages:

- **`baseline`**: Snapshot of the original data (from props). Resets when `data` prop changes.
- **`draft`**: Working copy. User edits mutate this.
- **`diff`**: Computed from comparing `draft` vs `baseline` field-by-field (using `batchFields`).

```
data prop → baseline (frozen snapshot)
         → draft (user edits this)
         → diff = compare(draft, baseline)  →  row highlighting + save payload
```

### Row mutations (batchApi)

| Method | What it does |
|---|---|
| `addRow(newRow)` | Prepends a new row with a temp ID to the draft |
| `removeRow(rowId)` | Toggles `__pendingRemove` on the row. If temp ID, removes entirely. |
| `updateRow(rowId, updates)` | Merges updates into the draft row |
| `stageRowChange(payload)` | Replaces a draft row by ID |
| `applyReorder(nextRows)` | Replaces the entire draft array (for drag-and-drop) |
| `cancelBatch()` | Resets draft back to baseline |
| `saveBatch()` | Builds save payload and calls `onBatchSave(payload)` |

### Row CSS highlighting (diff-based)

With `batchFields`, highlighting is based on the **diff engine** rather than `__batchState`:

| Diff state | CSS Class | Visual |
|---|---|---|
| New row (temp ID) | `psb-row-new` | Green highlight |
| Modified (field changed) | `psb-row-modified` | Blue highlight |
| Pending remove | `psb-row-pending-remove` | Red strikethrough |

Individual cells that changed also get `psb-cell-changed` highlighting.

### Undo delete

When `removeRow` is called:
- It **toggles** `__pendingRemove` on the row (true ↔ false)
- ActionColumn detects `row.__pendingRemove === true` and auto-shows "Undo Delete"
- Clicking undo again calls `removeRow`, which toggles `__pendingRemove` back to `false`
- If `onUndoBatchAction` is also provided, it's used instead for the undo button

### Save payload

When `saveBatch()` is called, it builds a structured payload:

```js
{
  deleted: [{ id: "row-id" }, ...],           // Rows marked __pendingRemove
  created: [{ tempId: "tmp-...", data: {...} }, ...],  // New rows (temp IDs)
  updated: [{ id: "row-id", data: {...}, changedColumns: Set }, ...],  // Modified rows
}
```

This payload is passed to the `onBatchSave(payload)` callback.

### What the module is responsible for

- Providing `data`, `columns`, `batchFields`, and `actions`
- Providing `onBatchSave` to persist changes to the server
- Everything else is automatic

---

## 3. With Batch Edit Mode (External — `batchMode={true}` + `onBatchChange`)

This is the mode used when `batchMode={true}` AND `onBatchChange` is a function. TableZ delegates all state management to the module.

### How actions work

```
User clicks action button
  → ActionColumn emits { action, row }
  → tableActions.handleAction receives it
  → Enters the batchMode branch
  → Infers batch type
  → Calls onBatchChange({ type, row, previousRow, action, batchState, rowIndex })
```

The module's `onBatchChange` handler receives every mutation and decides how to update its own state.

### Row state management

- The **module** stamps `__batchState` on rows (same as without batch mode).
- TableZ does NOT manage draft/baseline internally.
- The module passes already-decorated rows as `data`.

### Row CSS highlighting

Same as "without batch mode" — uses `resolveBatchClassName(row.__batchState)`.

### Undo delete

Same as "without batch mode" — uses the `onUndoBatchAction` prop on `<TableZ>`.

---

## Built-in Behaviors Comparison

### ActionColumn built-ins (ALL modes)

| Behavior | How it works |
|---|---|
| **Action ordering** | Icons are sorted: View(1) → Edit/Cancel(2) → Save/Deactivate/Restore(3) → Delete(4) |
| **Action coloring** | Icon name maps to CSS class (pen=blue, trash=red, ban=amber, rotate-left=green, etc.) |
| **Confirmation modal** | Actions with `type: "danger"` or `confirm: true` show a modal before executing |
| **Visible filtering** | Actions with `visible(row)` returning `false` are hidden |
| **Disabled state** | Actions with `disabled(row)` returning `true` are grayed out |
| **Auto-hide on delete** | When row is pending removal, ALL normal actions are hidden automatically |
| **Auto-show undo** | When row is pending removal AND `onUndoBatchAction` is provided, an undo button appears |

### TableZ built-ins with `batchMode={true}` (internal only)

| Behavior | How it works |
|---|---|
| **Draft/baseline tracking** | Automatic — TableZ snapshots data on load, tracks user edits |
| **Field-level diff** | Compares each `batchFields` entry between draft and baseline |
| **Cell-level highlighting** | Changed cells get `psb-cell-changed` class |
| **Row-level highlighting** | New/modified/removed rows get distinct CSS classes |
| **Pending remove toggle** | `removeRow` toggles instead of deleting — user can undo |
| **Temp ID for new rows** | `addRow` generates a `tmp-{entity}-{timestamp}-{random}` ID |
| **Cancel resets** | `cancelBatch()` restores draft from baseline |
| **Save payload builder** | `saveBatch()` computes `{ deleted, created, updated }` automatically |
| **Dirty tracking** | `hasPendingChanges` tells you if anything was changed |

### TableZ built-ins WITHOUT `batchMode`

| Behavior | How it works |
|---|---|
| **Action routing** | `action.onClick(row, rowIndex)` is called directly |
| **Row CSS from `__batchState`** | Module stamps state, TableZ applies CSS class |
| **Undo via `onUndoBatchAction`** | Module provides callback, ActionColumn renders button |
| **No draft/baseline** | Module manages all state |
| **No diff engine** | No cell-level highlighting |
| **No save payload** | Module builds its own save logic |

---

## Usage Pattern Examples

### Without batch mode (admin modules)

```jsx
// View file passes callbacks
<StatusTable
  decoratedStatuses={hook.decoratedStatuses}
  stageHardDeleteStatus={hook.stageHardDeleteStatus}
  onUndoBatchAction={hook.unstageHardDeleteStatus}
  ...otherProps
/>

// Table component defines actions
const actions = [
  { key: "delete-status", label: "Delete", type: "danger", icon: "trash",
    confirm: true,
    onClick: (row) => stageHardDeleteStatus(row) },
  // No undo action needed — ActionColumn handles it automatically
];

// TableZ renders without batchMode
<TableZ data={decoratedStatuses} actions={actions}
  onUndoBatchAction={onUndoBatchAction} />
```

### With batch mode (internal)

```jsx
<TableZ
  data={users}
  columns={userColumns}
  rowIdKey="user_id"
  actions={[
    { key: "delete-user", label: "Delete", icon: "trash", onClick: () => {} },
    { key: "edit-user", label: "Edit", icon: "pen", onClick: () => {} },
  ]}
  batchMode={true}
  batchFields={[
    { key: "first_name", type: "text" },
    { key: "last_name", type: "text" },
    { key: "is_active", type: "boolean" },
  ]}
  onBatchSave={async (payload) => {
    // payload.deleted = [{ id }, ...]
    // payload.created = [{ tempId, data }, ...]
    // payload.updated = [{ id, data, changedColumns }, ...]
    await saveToServer(payload);
  }}
/>
```

---

## Action Flow Diagram

```
                        ┌──────────────────────┐
                        │  User clicks action   │
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │    ActionColumn       │
                        │  (confirmation modal  │
                        │   if type=danger)     │
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │  tableActions.js      │
                        │  handleAction()       │
                        └──────────┬───────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 │                 │                  │
          batchMode=true    batchMode=true     batchMode=false
          (internal)        (external)         (no batch)
                 │                 │                  │
        ┌────────▼──────┐  ┌──────▼────────┐  ┌─────▼──────────┐
        │ batchApi.*    │  │ onBatchChange  │  │ action.onClick  │
        │ removeRow()   │  │ (module hook)  │  │ (module hook)   │
        │ stageRow()    │  │               │  │                 │
        └───────────────┘  └───────────────┘  └─────────────────┘
```

## Undo Delete Flow

```
                    ┌────────────────────────┐
                    │  Row has pending        │
                    │  removal state?         │
                    │  (__pendingRemove=true   │
                    │  OR __batchState=        │
                    │  "deleted"/"hardDeleted")│
                    └───────────┬────────────┘
                                │ YES
                    ┌───────────▼────────────┐
                    │  ActionColumn:          │
                    │  • Hides ALL actions    │
                    │  • Shows "Undo Delete"  │
                    │    (if onUndoBatchAction │
                    │     is provided)        │
                    └───────────┬────────────┘
                                │ Click
                    ┌───────────▼────────────┐
                    │  onUndoBatchAction(row) │
                    │  (module callback)      │
                    │  → unstages the delete  │
                    │  → row returns to       │
                    │    normal state          │
                    └────────────────────────┘
```
