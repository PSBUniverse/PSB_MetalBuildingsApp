# Shared UI System

This document defines every shared UI component, its behavior contract, and the design tokens that govern the visual system. All modules must use these components — no custom implementations allowed.

---

## Approved Shared Components

| Component | Purpose |
|-----------|---------|
| TableZ | Full data-table: controlled state, filters, sorting, pagination, column resize/visibility, context menu, side panel, batch edit, export |
| TableX | Data-binding wrapper around TableZ: connects to server-side query/filter/export Server Actions |
| ActionColumn | Row action buttons: inline (1 action) or dropdown (2+ actions) |
| InlineEditCell | Inline cell editor for batch edit mode |
| SearchBar | Debounced global search input |
| Dropdown | Select/menu component |
| Button | Standard action button |
| Input | Form text input |
| Modal | Dialog overlay |
| Card | Content container |
| Badge | Inline status label |
| Toast | Auto-dismiss notification (via `toastSuccess`, `toastError`, etc.) |
| GlobalToastHost | Single app-level toast container |

**Import all from the barrel export:**

> **In simple terms:** A "barrel export" just means there's one file that re-exports everything. Instead of remembering which subfolder each component lives in, you import them all from one place: `@/shared/components/ui`.

```js
import { TableZ, TableX, Button, Modal, Badge } from "@/shared/components/ui";
```

**Hard rule:** Anything outside this list is rejected unless the shared UI system is explicitly extended first.

---

## Table System

### Behavior

- Display only — emits events, never fetches data.
- Fully controlled by the parent module.

> **In simple terms:** The table is like a whiteboard. Your module writes on it (passes data) and tells it what to display. When the user clicks "sort" or "filter", the table tells your module "hey, the user wants to sort by name" — but it doesn't sort anything itself. Your module does the sorting and passes the new data back.

### What the Module Controls

- Data array
- Filters configuration and state
- Sorting state
- Pagination state
- Column visibility array

### Data Flow

```
User interacts with TableZ
  → TableZ emits event (onSortChange, onFilterChange, etc.)
  → Module updates its state
  → Module fetches data via Server Action
  → Module passes updated data back to TableZ
```

### TableZ vs TableX

| Feature | TableZ | TableX |
|---------|--------|--------|
| Purpose | Full-featured table for module pages | Data-binding wrapper that connects to Server Actions |
| State management | Controlled — module manages all state | Manages query/filter/pagination state internally via databind |
| Filters/search/sort | Full support | Full support (delegates to Server Actions) |
| Column resize/visibility | Full support | Full support |
| Batch edit mode | Built-in (via `useTableBatchEdit`) | Inherits from TableZ |
| Export | Full support | Full support (via databind export) |
| Drag reorder | Via `useTableDragNDrop` hook | Via `useTableDragNDrop` hook |

**Use `TableZ`** when you manage data fetching yourself (via Server Actions in your module).
**Use `TableX`** when you want automatic data binding to the databind Server Actions.

> **For example:** If you're building a simple list page and want the table to handle fetching, filtering, and pagination for you, use `TableX`. If you need full control over how data is loaded and transformed, use `TableZ`.

---

## Row Actions

Row actions are config-driven via the `actions` prop on TableZ/TableX. The `ActionColumn` component renders them.

### Row Action Type Contract

The only supported `type` values for row actions are:

| Type | Use For |
|------|---------|
| `primary` | Default/main actions |
| `secondary` | Less prominent actions |
| `danger` | Destructive actions (delete, deactivate) |

**Do not** pass `success` or `warning` to row actions. If your business meaning is success/warning, map it to a supported type before passing actions.

---

## Filter System

- Developer-defined only — no user-created filters.
- Supports static options or server-resolved options.
- Module resolves options (via Server Actions) and passes them as `options`; the table does not execute server calls.
- Filter changes update module state and trigger a data reload.

---

## Search Bar

- Must be debounced.
- Updates the module's filter/query state.
- Triggers data reload through the module's normal flow.

> **In simple terms:** "Debounced" means the search doesn't fire on every single keystroke. It waits until the user stops typing (usually ~300ms) and then searches. This prevents hammering the server with a request for every letter.

---

## Right-Click Context Menu

The table context menu is the **single access point** for:

- Column visibility toggles
- Export (CSV, Excel)
- Clear sorting

Do not duplicate these controls in a separate toolbar.

---

## Export

- Server-side only.
- Uses the current table state/context (filters, sort).
- CSV and Excel only.

---

## Design Tokens

All shared components follow these locked design tokens.

> **In simple terms:** "Design tokens" are just the approved values for spacing, font sizes, and border radius that every component uses. Think of them as the building code for the UI — everyone uses the same measurements so everything looks consistent.

### Spacing

```
4px, 8px, 12px, 16px, 24px
```

### Border Radius

```
6px, 8px, 12px
```

### Font Sizes

```
12px, 14px, 16px
```

### Transitions

```
0.15s, 0.2s
```

---

## Component Specs

### Button

| Property | Spec |
|----------|------|
| Variants | Primary, Secondary, Danger, Ghost |
| States | Default, Hover, Active, Disabled, Loading |
| Layout | Fixed height, no wrapping, consistent padding |

### Input

| Property | Spec |
|----------|------|
| States | Default, Focus, Error, Disabled |
| Layout | Same height as Button, clean consistent padding |

### Modal

| Property | Spec |
|----------|------|
| Behavior | Centered, dim background, scroll inside |
| Layout | Fixed max width, footer right-aligned |

### Card

| Property | Spec |
|----------|------|
| Layout | Consistent padding, optional hover lift |

### Badge

| Property | Spec |
|----------|------|
| Layout | Small, rounded, inline |

---

## Toast

| Property | Spec |
|----------|------|
| Auto-dismiss | Always |
| Position | Top-right, stack downward, newest on top |
| Hover behavior | Pause timer, expand spacing |
| States | Enter → Visible → Exit |
| Host | Single `GlobalToastHost` instance per app |

---

## Global Rules

### Disabled State

- Lower opacity.
- No interaction (no pointer events).

### Icons

- 16px or 20px.
- Center aligned.
- Use icons to reinforce meaning, not replace labels.
- Keep icon usage consistent for recurring actions across modules.

### Accessibility

- Preserve contrast ratios for text and interactive elements.
- Ensure focus visibility on all interactive components (buttons, inputs, links).
- Use labels on form inputs — do not rely on placeholder text alone.

### Z-Index Layering (Low → High)

> **In simple terms:** Z-index controls what appears on top of what. A dropdown sits below a modal, which sits below a toast notification. This prevents a dropdown from accidentally covering a popup.

1. Dropdown
2. Modal
3. Toast
4. Overlay

### Animation

- No arbitrary timings.
- Use standard transitions (0.15s, 0.2s).

---

## Workflow Toolbar Actions

These are **toolbar-level** actions, not row actions. They follow different rules.

| Action | Semantic Type | UI Variant |
|--------|--------------|------------|
| Approve | Success | Primary |
| Confirm | Primary | Primary |
| Reject | Danger | Danger |
| Void | Danger | Danger |
| Return | Warning | Secondary |
| Recall | Secondary | Secondary |

**Rules:**
- Critical actions must require confirmation.
- Actions must show loading while executing.
- Toolbar actions may use semantic labels like success/warning (unlike row actions which are limited to primary/secondary/danger).
- All actions must be state-driven. Disable actions when not allowed.
- After action: show toast feedback and log for audit.

---

## Visual Styling Rules

### Layout

- All pages render inside the core shell (`AppLayout`). Do not create competing shells.
- Keep module pages focused on domain content.
- Do not reset root body/html styles from module pages.

### Typography

- One consistent body font across the platform.
- Clear heading levels: `h1` for page title, `h2` for section title.

### Spacing

- Use consistent vertical rhythm (8px base).
- Keep container padding and card spacing predictable.

### Color

- Semantic meanings must stay stable: success = completion, warning = caution, danger = destructive.
- Do not use color alone to communicate state.

### State UI

Every module page must handle:
1. Loading state
2. Empty state
3. Error state
4. No-access state

---

## Performance Rules

- Debounce search inputs.
- Use server-side pagination.
- Maximum 500 rows per page.
- Do not load full datasets into table flows.

---

## Extensibility Rules

- Add features via config only — do not fork or duplicate shared components.
- Follow existing patterns.
- If you need a new shared component, propose it and get approval before building it.

---

## Ownership Summary

| Area | Owner |
|------|-------|
| Data | Module |
| Filters | Module |
| Actions | Module |
| UI Rendering | Shared Components |
| UI Rules | Shared Components |

---

## Testing Rules

When testing a module's table integration:

1. Filters must match server behavior — selecting a filter should produce the same results as the Server Action query.
2. Sorting must match backend behavior — the table's sort state should produce the same order as the server.
3. Actions must respect permission and state constraints — disabled/hidden actions should stay that way.

---

## UX Rules

1. No layout shifting — components should not jump around when data loads or state changes.
2. No inconsistent action behavior — the same action type should behave the same way across all modules.
3. No random module-specific interaction patterns — follow the shared patterns documented here.

---

## Do Not

1. Add new UI patterns ad hoc — propose and get approval first.
2. Override shared styles from module code.
3. Create duplicate components that already exist in the shared library.
4. Add inline business logic inside shared UI components.
5. Break action rules (row action types, toolbar semantic mappings).

---

## Component Structure Standards

Every feature page should follow this recommended structure:

```
FeaturePage
  ├── Header block          (page title, breadcrumb)
  ├── Filter/search block   (if needed)
  ├── Content block         (grid, list, or table)
  ├── Action block          (toolbar actions, batch save)
  └── Empty/error block     (shown when data is missing or load fails)
```

Use small composable components rather than one large page component.

---

## Example: Card Grid Pattern

A simple, reusable card grid pattern for modules:

```jsx
function CardGrid({ items }) {
  if (!items.length) {
    return <p>No records found.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item) => (
        <div key={item.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>{item.title}</h3>
          <p>{item.description}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## Long-Term Styling Governance

As module count grows:

1. Keep a shared token strategy for spacing, color, and typography.
2. Review module UI against this guide during code review.
3. Prefer incremental consistency improvements over large visual rewrites.

The goal is not visual rigidity — it's predictable quality and maintainable UX across all modules.

---

## Shared UI Wrapper Components

Core includes wrapper components under `src/shared/components/ui`:

1. Button
2. Card
3. Input
4. Modal
5. Table

**Usage goals:**
- Keep Bootstrap styling consistent across modules by using these wrappers.
- Centralize `psb-ui-*` contracts so changes propagate everywhere.
- Reduce visual divergence between modules.

**Migration note:** Legacy direct React-Bootstrap usage can remain during incremental migration. New code should use the shared wrappers.
