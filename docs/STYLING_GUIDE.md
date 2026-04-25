# Styling Guide

## Document Purpose
This guide standardizes UI and UX implementation for PSBUniverse Core and all modules.

Goals:
1. Consistent SaaS-grade visual quality
2. Predictable component structure
3. Maintainable styling patterns
4. Clear boundaries between core shell and module UI

## 1) Styling Strategy s

Current platform baseline:
1. Global foundation styles in src/app/globals.css
2. Shared shell layout in src/core/layout/AppLayout.js
3. Module-level styles should be scoped and predictable

Recommended approach:
1. Keep global styles minimal and foundational.
2. Use component-local styles for module-specific visuals.
3. Reuse core shell structure for spacing and navigation consistency.

## 2) Core UI Consistency Rules

| Rule | Requirement |
|---|---|
| Shell consistency | Keep top navigation and app shell behavior from AppLayout |
| Spacing rhythm | Use consistent spacing scale (8px based where practical) |
| Typography hierarchy | Use clear heading and body hierarchy |
| State visibility | Loading, empty, error, and no-access states must be explicit |
| Interaction clarity | Buttons and links must indicate intent and state |

## 3) Layout Usage Rules

### Use core shell
All pages should render inside the core layout wrapper from src/app/layout.js and src/core/layout/AppLayout.js.

### Keep module pages focused
Module pages should render domain content inside the provided shell, not create competing top-level shells.

### Avoid shell overrides
Do not reset root body styles per module.

## 4) Component Structure Standards

Recommended component pattern:

```text
FeaturePage
  Header block
  Filter/search block (if needed)
  Content grid/list/table block
  Action block
  Empty/error state block
```

Use small composable components rather than one large page component.

## 5) Visual Quality Guidelines

### Typography
1. One consistent body font across platform.
2. Clear heading levels (h1 for page title, h2 for section title).
3. Avoid random font-size jumps.

### Spacing
1. Prefer consistent vertical rhythm.
2. Keep container padding and card spacing predictable.
3. Avoid mixed spacing values without reason.

### Color usage
1. Keep semantic meaning stable:
   - success for valid completion
   - warning for caution
   - danger for destructive action
2. Avoid using color alone to communicate state.

### Icons
1. Use icons to reinforce meaning, not replace labels.
2. Keep icon usage consistent for recurring actions.

## 6) State UI Requirements

Every module should handle:
1. Loading state
2. Empty state
3. Error state
4. No access state (when feature-level checks fail)

Example no-access panel pattern:

```jsx
<div style={{ padding: 40 }}>
  <h2>No Access</h2>
  <p>You do not have permission to view this module.</p>
</div>
```

## 7) Styling Do and Do Not

### Do
1. Reuse core shell and shared behavior.
2. Keep module styling readable and scoped.
3. Keep forms, tables, and cards visually consistent.
4. Preserve accessibility basics (contrast, focus visibility, labels).

### Do not
1. Build a separate shell UI inside modules.
2. Hardcode many one-off inline styles without reason.
3. Override global body/html styles from module pages.
4. Hide loading or error states.
5. Mix unrelated visual systems in one module.

## 8) SaaS-Quality UI Checklist

Before merging module UI changes:

1. Page has clear title and purpose.
2. Actions are obvious and labeled.
3. Loading and empty states are implemented.
4. Unauthorized states are explicit where needed.
5. Spacing and typography are consistent.
6. Core navigation and shell remain intact.

## 9) Example: Consistent Card Grid Pattern

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

This pattern is simple, readable, and easy to standardize across modules.

## 10) Long-Term Styling Governance

As module count grows:
1. Keep a shared token strategy for spacing, color, and typography.
2. Review module UI against this guide during code review.
3. Prefer incremental consistency improvements over large visual rewrites.

The goal is not visual rigidity. The goal is predictable quality and maintainable UX across all modules.

## 11) Shared UI Wrapper Components

Core now includes wrapper components under `src/shared/components/ui`:
1. Button
2. Card
3. Input
4. Modal
5. Table
6. Badge

Usage goals:
1. Keep Bootstrap usage consistent across pages.
2. Centralize common class contracts (`psb-ui-*`).
3. Reduce one-off markup divergence between modules.

Guidance:
1. Prefer wrapper imports from `src/shared/components/ui/index.js` in new module pages.
2. Legacy direct React-Bootstrap usage can remain in place during incremental migration.