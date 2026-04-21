# Shared UI System Lockdown

Purpose:
- Define all shared UI components, behavior, and rules so every module follows one system.
- No custom implementations allowed.

---

## Core Principles (Non-Negotiable)

1. Shared components must be reused, never recreated.
2. No styling overrides per module.
3. No business logic inside UI components.
4. All behavior must be config-driven.
5. UI must remain consistent across all modules.

---

## Approved Shared Components Only

Approved list:
- Table
- ActionColumn
- FilterSchema
- SearchBar
- TableContextMenu
- TableSidePanel
- Dropdown
- Button
- Input
- Modal
- Card
- Badge
- Toast
- GlobalToastHost

Hard rule:
- Anything outside this list is rejected unless the shared UI system is explicitly extended first.

---

## Table System (Strict)

Behavior:
- Display only.
- Emits events.
- No API calls.

Controlled by module:
- Data
- Filters
- Sorting
- Pagination
- Column visibility

Data flow:
- User -> Table event -> Module state -> API -> Table update

Rules:
- No business logic inside Table.
- No direct data fetching in Table.
- Table renders controls and emits state changes; modules own data/query behavior.

---

## Action Column (Strict)

Rendering rules:
- 1 action: inline button
- 2+ actions: dropdown only

Behavior:
- Fully config-driven
- Per-row visibility allowed
- Supports disabled + confirm

Layout:
- No wrapping
- No multiple inline buttons for multi-action rows

Ordering:
1. Primary
2. Secondary
3. Danger

Row action type contract (strict):
- Supported row action `type` values are only:
	- `primary`
	- `secondary`
	- `danger`
- Do not pass `success` or `warning` directly to ActionColumn/Table row actions.
- If business semantics are success/warning, map semantics to a supported UI type before emitting row actions.

---

## Filter System

Rules:
- Developer-defined only
- No user-created filters
- DB is optional for options (supports static or API-resolved options)

Behavior:
- Updates module state
- Triggers reload through module data flow

---

## Search Bar

Rules:
- Must be debounced
- Updates filter/query state
- Triggers module/API reload path

---

## Right-Click System

Entry point for:
- Column visibility
- Export (CSV, Excel)
- Clear sorting

Rules:
- Right-click customization flow is the single access point for these table customization features.
- Do not duplicate the same customization controls in parallel toolbar UIs.

---

## Export

Rules:
- Server-side only
- Uses current table state/context
- CSV and Excel only

## SetupTable vs Table


1.	## SetupTable in SetupTable.js is a lightweight setup-grid:
	•	simple rows + columns rendering
	•	optional row click selection
	•	custom per-row actions via renderActions
	•	optional drag reorder
	•	supports batch row styling with __batchClassName
2.	## Table in Table.js is a full data-table system:
	•	controlled state + onChange contract
	•	filters, search, sorting, pagination
	•	column resize/visibility
	•	context menu + side panel + export
	•	standardized action config via actions

---

## Design System (Locked)

Tokens:
- Spacing: 4, 8, 12, 16, 24
- Radius: 6, 8, 12
- Font sizes: 12, 14, 16
- Transition: 0.15s, 0.2s

### Button

Variants:
- Primary
- Secondary
- Danger
- Ghost

States:
- Default
- Hover
- Active
- Disabled
- Loading

Rules:
- Fixed height
- No wrapping
- Consistent padding

### Input

States:
- Default
- Focus
- Error
- Disabled

Rules:
- Same height as button
- Clean, consistent padding

### Modal

Behavior:
- Centered
- Dim background
- Scroll inside

Rules:
- Fixed max width
- Footer right-aligned

### Card

Rules:
- Consistent padding
- Optional hover lift

### Badge

Rules:
- Small
- Rounded
- Inline

---

## Toast (Strict)

Behavior:
- Auto-dismiss always
- Top-right anchor
- Stack downward
- New toast on top

Hover:
- Pause timer
- Expand spacing

States:
- Enter
- Visible
- Exit

Host:
- Single GlobalToastHost instance for app shell

---

## Global Rules

Disabled behavior:
- Lower opacity
- No interaction

Icon rules:
- 16px or 20px
- Center aligned

Z-index layering:
- Dropdown
- Modal
- Toast
- Overlay

Animation:
- No arbitrary timings
- Use standard transitions

---

## Workflow Toolbar Actions (Locked)

Scope:
- Workflow actions are toolbar-level actions, not ActionColumn row actions.

Standard actions:
- Approve
- Reject
- Return
- Recall
- Void
- Confirm

Semantic mapping (workflow intent):

| Action | Semantic Type | Preferred UI Variant |
| --- | --- |
| Approve | Success | Primary |
| Confirm | Primary | Primary |
| Reject | Danger | Danger |
| Void | Danger | Danger |
| Return | Warning | Secondary |
| Recall | Secondary | Secondary |

Rules:
- Critical actions must require confirmation
- Actions must show loading while executing
- These actions are implemented in toolbar flows; ActionColumn rules apply only to row actions
- Toolbar workflow actions may use semantic labels like success/warning, but Table row actions must still comply with the ActionColumn row action type contract
- All actions must be state-driven
- Disable actions when not allowed
- Do not show invalid actions

After action:
- Show toast feedback
- Log action for audit

---

## Responsibilities

| Area | Owner |
| --- | --- |
| Data | Module |
| Filters | Module |
| Actions | Module |
| UI Rendering | Shared Components |
| UI Rules | Shared Components |

---

## Do Not

- Add new UI patterns ad hoc
- Override shared styles per module
- Create duplicate components
- Add inline business logic inside shared UI
- Break action rules

---

## Performance Rules

- Debounce search
- Server-side pagination
- Max 500 rows per page
- No full dataset loading in table flows

---

## Testing Rules

- Filters match API behavior
- Sorting matches backend behavior
- Actions respect permission/state constraints

---

## Extensibility Rules

- Add features via config only
- Do not fork or duplicate shared components in modules
- Follow existing shared patterns

---

## UX Rules

- No layout shifting
- No inconsistent action behavior
- No random module-specific interaction changes
