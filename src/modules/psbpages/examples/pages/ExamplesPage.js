"use client";

import { useCallback, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faChevronUp, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import {
  Badge,
  Button,
  Card,
  Dropdown,
  Input,
  Modal,
  SearchBar,
  TableZ,
  TABLE_FILTER_TYPES,
  createFilterConfig,
  toastError,
  toastInfo,
  toastSuccess,
  toastWarning,
} from "@/shared/components/ui";
import styles from "./ExamplesPage.module.css";

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const WORKFLOW_ACTIONS = [
  { key: "approve", label: "Approve", type: "success",   critical: false },
  { key: "reject",  label: "Reject",  type: "danger",    critical: true  },
  { key: "return",  label: "Return",  type: "warning",   critical: false },
  { key: "recall",  label: "Recall",  type: "secondary", critical: false },
  { key: "void",    label: "Void",    type: "danger",    critical: true  },
  { key: "confirm", label: "Confirm", type: "primary",   critical: false },
];

const STATUS_OPTIONS = [
  { label: "Active",    value: "active"    },
  { label: "Pending",   value: "pending"   },
  { label: "Inactive",  value: "inactive"  },
  { label: "Suspended", value: "suspended" },
];

const DEMO_STATUS_OPTIONS = STATUS_OPTIONS.length > 0
  ? STATUS_OPTIONS
  : [
      { label: "Active", value: "active" },
      { label: "Pending", value: "pending" },
      { label: "Inactive", value: "inactive" },
      { label: "Suspended", value: "suspended" },
    ];

const TABLE_SOURCE_ROWS = [
  { id: 1, employee_code: "EMP-1101", full_name: "Avery Nguyen",   email: "avery.nguyen@psbuniverse.local",   team: "Platform",   role: "admin",   status: "active",    created_at: "2026-03-22" },
  { id: 2, employee_code: "EMP-1102", full_name: "Jordan Patel",   email: "jordan.patel@psbuniverse.local",   team: "Risk",       role: "manager", status: "pending",   created_at: "2026-03-18" },
  { id: 3, employee_code: "EMP-1103", full_name: "Riley Walker",   email: "riley.walker@psbuniverse.local",   team: "Operations", role: "analyst", status: "inactive",  created_at: "2026-03-11" },
  { id: 4, employee_code: "EMP-1104", full_name: "Morgan Torres",  email: "morgan.torres@psbuniverse.local",  team: "Finance",    role: "viewer",  status: "suspended", created_at: "2026-03-06" },
  { id: 5, employee_code: "EMP-1105", full_name: "Taylor Lopez",   email: "taylor.lopez@psbuniverse.local",   team: "Support",    role: "manager", status: "active",    created_at: "2026-02-28" },
  { id: 6, employee_code: "EMP-1106", full_name: "Casey Johnson",  email: "casey.johnson@psbuniverse.local",  team: "Audit",      role: "analyst", status: "pending",   created_at: "2026-02-21" },
];

// ---------------------------------------------------------------------------
// Snippets
// ---------------------------------------------------------------------------

const SNIPPET_IMPORT = `import { TableZ, Button, Input, Modal, Badge, SearchBar, Dropdown, toastSuccess } from "@/shared/components/ui";`;

const SNIPPET_TABLE_BASIC = `import { TableZ } from "@/shared/components/ui";

<TableZ
  data={rows}
  columns={columns}
  state={tableState}
  filterConfig={filterConfig}
  actions={actions}
  loading={loading}
  onChange={handleTableChange}
/>`;

const SNIPPET_TABLE_STATE = `const [tableState, setTableState] = useState({
  filters: {},
  sorting: { key: "created_at", direction: "desc" },
  pagination: { page: 1, pageSize: 10, total: 0 },
  columnVisibility: {},
  columnSizing: {},
});`;

const SNIPPET_TABLE_DATABIND = `// --- FULL END-TO-END: How data flows from Database to your Table ---
//
// This shows the COMPLETE journey of data in a real module.
// Read each layer top to bottom — this is the exact pattern every module follows.
//
// DATA SOURCE
//   Table: psb_s_appcard (Supabase)
//   Columns: card_id (PK), group_id (FK), card_name, card_desc,
//            route_path, icon, display_order, is_active
//
// LAYER STACK (each layer has ONE job)
//   1. Model   – maps raw DB row → UI-friendly shape (so UI never sees raw columns)
//   2. Repo    – Supabase queries (ONLY layer that calls .from())
//   3. Service – business logic, validation, orchestration
//   4. Hook    – calls service, returns data for the page (runs on server)
//   5. API     – Next.js route handler (POST /api/admin/card-module-setup/cards)
//   6. Page    – server component that loads data and passes to View
//   7. View    – client component that wires hook → components → <TableZ />

// -- 1. MODEL -- src/modules/admin/card-module-setup/model/card.model.js
export function isCardActive(card) {
  if (card?.is_active === false || card?.is_active === 0) return false;
  const text = String(card?.is_active ?? "").trim().toLowerCase();
  return !(text === "false" || text === "0");
}

export function getCardDisplayName(card) {
  return card?.card_name || card?.name || "Unknown";
}

// -- 2. REPO -- src/modules/admin/card-module-setup/repo/cards.repo.js
const TABLE = "psb_s_appcard";

export async function fetchCardsByGroupId(supabase, groupId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("group_id", groupId)
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

export async function createCard(supabase, payload) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// -- 3. SERVICE -- src/modules/admin/card-module-setup/services/cardModuleSetup.service.js
import { fetchCardsByGroupId, createCard } from "../repo/cards.repo.js";

export async function getCardList(supabase) {
  const rows = await fetchAllCards(supabase);
  return rows.sort((a, b) =>
    Number(a.display_order || 0) - Number(b.display_order || 0)
  );
}

export async function createCardRecord(supabase, payload) {
  const cardName = String(payload?.card_name ?? "").trim();
  if (!cardName) throw new Error("Card name is required.");
  if (!payload?.group_id) throw new Error("Group ID is required.");

  return createCard(supabase, {
    group_id: payload.group_id,
    card_name: cardName,
    card_desc: payload?.card_desc ?? "",
    route_path: payload?.route_path ?? "#",
    icon: payload?.icon ?? "bi-grid-3x3-gap",
    is_active: true,
  });
}

// -- 4. HOOK -- src/modules/admin/card-module-setup/hooks/cardModuleSetupData.js
import { getSupabase } from "../utils/supabase.js";
import { getCardModuleSetupViewModel } from "../services/cardModuleSetup.service.js";

export async function loadCardModuleSetupData() {
  const supabase = await getSupabase();
  return getCardModuleSetupViewModel(supabase);
}

// -- 5. API ROUTE -- src/app/api/admin/card-module-setup/cards/route.js
import { NextResponse } from "next/server";
import { getSupabase } from "@/modules/admin/card-module-setup/utils/supabase.js";
import { createCardRecord } from "@/modules/admin/card-module-setup/services/cardModuleSetup.service.js";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const supabase = await getSupabase();
  const card = await createCardRecord(supabase, body);
  return NextResponse.json({ ok: true, card });
}

// -- 6. CLIENT PAGE -- src/app/admin/card-module-setup/page.js (server component)
import CardModuleSetupPage from "@/modules/admin/card-module-setup/pages/CardModuleSetupPage";
import { loadCardModuleSetupData } from "@/modules/admin/card-module-setup/hooks/cardModuleSetupData.js";

export default async function CardModuleSetupPage() {
  const { cardGroups, cards } = await loadCardModuleSetupData();
  return <CardModuleSetupClient seedCardGroups={cardGroups} seedCards={cards} />;
}

// -- 7. CLIENT COMPONENT -- binds data to TableZ
const selectedGroupCards = useMemo(() =>
  allCards
    .filter((card) => card.group_id === selectedGroup?.group_id)
    .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)),
  [allCards, selectedGroup?.group_id],
);

const cardColumns = useMemo(() => [
  { key: "display_order", label: "Order",  sortable: false, width: 80 },
  { key: "card_name",     label: "Card",   sortable: true,  width: 200 },
  { key: "route_path",    label: "Route",  sortable: false, width: 200 },
  {
    key: "is_active",
    label: "Active",
    width: 100,
    render: (row) => <Badge bg={row.is_active ? "success" : "secondary"}>
      {row.is_active ? "Active" : "Inactive"}
    </Badge>,
  },
], []);

<TableZ
  columns={cardColumns}
  data={selectedGroupCards}
  rowIdKey="card_id"
  actions={cardActions}
  emptyMessage="No cards in this group."
  draggable={true}
  onReorder={handleCardReorder}
/>`;

const SNIPPET_TABLE_FILTERS_HARDCODE = `// Hardcoded filter items (use when options are fixed/known at build time)
//
// Real example: Card Module Setup — filter cards by active status
const filterConfig = createFilterConfig([
  {
    key: "is_active",
    label: "Status",
    type: TABLE_FILTER_TYPES.SELECT,
    options: [
      { label: "Active",   value: true  },
      { label: "Inactive", value: false },
    ],
  },
]);`;

const SNIPPET_TABLE_FILTERS_DATABIND = `// Databind filter items from API (use when options come from the database)
//
// Real example: User Master Setup — role filter loaded from psb_s_app_roles
// API endpoint: GET /api/admin/user-master-setup/lookups
//
// Backend returns: { roles: [{ role_id: 1, role_name: "Admin" }, ...] }
const [roleOptions, setRoleOptions] = useState([]);

useEffect(() => {
  fetch("/api/admin/user-master-setup/lookups")
    .then((r) => r.json())
    .then((data) => {
      // Map API response to the { label, value } shape the filter expects
      const mapped = (data.roles || []).map((role) => ({
        label: role.role_name,
        value: role.role_id,
      }));
      setRoleOptions(mapped);
    });
}, []);

const filterConfig = createFilterConfig([
  {
    key: "role_id",
    label: "Role",
    type: TABLE_FILTER_TYPES.SELECT,
    options: roleOptions,   // ? populated from the API response
  },
  {
    key: "created_at",
    label: "Created Date",
    type: TABLE_FILTER_TYPES.DATERANGE,
    // No options needed — date range uses a date picker
  },
]);`;

const SNIPPET_TABLE_COLUMNS = `// Real example: Card Module Setup — card groups table columns
// Source table: psb_m_appcardgroup
// Columns map directly to database fields
const groupColumns = useMemo(() => [
  // "Order" shows the display_order field (drag-to-reorder sets this)
  { key: "display_order", label: "Order",       sortable: false, width: 80  },
  // "Group Name" is the primary identifier
  { key: "group_name",    label: "Group Name",  sortable: true,  width: 220 },
  // "Description" is optional context
  { key: "group_desc",    label: "Description", sortable: false, width: 250 },
  // "Icon" — hidden by default, available via Customize Table panel
  { key: "icon",          label: "Icon",        sortable: false, width: 120, defaultVisible: false },
  // "Active" — render with Badge for visual status
  {
    key: "is_active",
    label: "Active",
    sortable: false,
    width: 100,
    render: (row) => (
      <Badge bg={row.is_active ? "success" : "secondary"}>
        {row.is_active ? "Yes" : "No"}
      </Badge>
    ),
  },
], []);

// Column options:
//   key            — matches the field name in the row object (from DB)
//   label          — column header text
//   sortable       — enables click-to-sort on this column
//   width          — pixel width
//   defaultVisible — set to false to hide on first render (still in Customize panel)
//   render         — custom cell renderer: (row) => ReactNode`;

const SNIPPET_TABLE_ACTIONS = `// Real example: Card Module Setup — row actions for the card groups table
// Actions appear as a dropdown in the leftmost "Actions" column
//
// Each action needs: key, label, type, onClick
// Optional: visible, disabled, confirm, confirmMessage, icon
const groupActions = useMemo(() => [
  {
    key: "edit",
    label: "Edit",
    type: "primary",           // primary | secondary | danger
    icon: "pen",              // Font Awesome icon name
    onClick: (row) => {
      // Open edit dialog pre-filled with this group's data
      setDialog({ kind: "edit-group", groupId: row.group_id });
      setGroupDraft({
        name: row.group_name,
        desc: row.group_desc || "",
        icon: row.icon || "",
      });
    },
  },
  {
    key: "deactivate",
    label: "Deactivate",
    type: "danger",
    icon: "trash",
    // Only show for active, non-pending groups
    visible: (row) => row.is_active && !isTempGroupId(row.group_id),
    // Confirm dialog before executing
    confirm: true,
    confirmMessage: (row) => \`Deactivate group "\${row.group_name}"?\`,
    onClick: (row) => {
      // Add to batch deactivation list (saved on "Save Batch")
      setPendingBatch((prev) => ({
        ...prev,
        groupDeactivations: [...prev.groupDeactivations, row.group_id],
      }));
    },
  },
], []);

// Action type determines button color:
//   "primary"   ? blue
//   "secondary" ? gray
//   "danger"    ? red`;

const SNIPPET_TABLE_ONCHANGE = `// onChange receives ALL table events through a single channel.
// event.type tells you what happened. Switch on it.
//
// Real example from: useDataTableModuleController.js (Data Table Example)
//
// Event types emitted by <TableZ />:
//   "search"           ? user typed in the search bar
//   "filters"          ? user changed a filter dropdown / date range
//   "sorting"          ? user clicked a sortable column header
//   "pagination"       ? user changed page or page size
//   "action"           ? user clicked a row action button
//   "export"           ? user clicked CSV/Excel export
//   "columnVisibility" ? user toggled a column in Customize panel
//   "columnResize"     ? user resized a column by dragging

function handleTableChange(event) {
  switch (event.type) {
    case "search":
      // event.value = search string
      setTableState((prev) => ({
        ...prev,
        filters: { ...prev.filters, search: event.value },
        pagination: { ...prev.pagination, page: 1 },
      }));
      break;

    case "filters":
      // event.filters = full filter object from filter bar
      setTableState((prev) => ({
        ...prev,
        filters: event.filters,
        pagination: { ...prev.pagination, page: 1 },
      }));
      break;

    case "sorting":
      // event.sorting = { key: "column_key", direction: "asc" | "desc" }
      setTableState((prev) => ({
        ...prev,
        sorting: event.sorting,
        pagination: { ...prev.pagination, page: 1 },
      }));
      break;

    case "pagination":
      // event.pagination = { page: number, pageSize: number }
      setTableState((prev) => ({
        ...prev,
        pagination: { ...prev.pagination, ...event.pagination },
      }));
      break;

    case "action":
      // event.action = the action config object
      // event.row = the row data object
      event.action.onClick(event.row);
      break;

    case "export":
      // event.format = "csv" | "excel"
      callExportApi(event.format);
      break;

    case "columnVisibility":
      // event.columnVisibility = { columnKey: boolean }
      setTableState((prev) => ({
        ...prev,
        columnVisibility: event.columnVisibility,
      }));
      break;
  }
}`;

const SNIPPET_BUTTON = `import { Button } from "@/shared/components/ui";

// Variants determine the visual style and semantic meaning:
//   "primary"   ? main action (Save, Submit, Approve)
//   "secondary" ? secondary action (Cancel, Back, Reset)
//   "danger"    ? destructive action (Delete, Deactivate, Reject)
//   "ghost"     ? subtle/text-only action (Help, View Details)

// Real example: Card Module Setup batch save toolbar
<Button variant="primary" loading={isSaving} onClick={handleSaveBatch}>
  Save Batch ({pendingSummary.total})
</Button>
<Button variant="secondary" onClick={handleCancelBatch} disabled={isSaving}>
  Cancel
</Button>

// Real example: Modal footer with save flow
<Button variant="ghost" onClick={closeDialog} disabled={isMutatingAction}>
  Cancel
</Button>
<Button variant="primary" loading={isMutatingAction} onClick={handleConfirmAddGroup}>
  Add Group
</Button>

// Disabled state — prevents all interaction
<Button variant="primary" disabled>Disabled</Button>`;

const SNIPPET_INPUT = `import { Input } from "@/shared/components/ui";

// Real example: Card Module Setup — Add Card Group dialog form fields
// Draft state holds the form values
const [groupDraft, setGroupDraft] = useState({ name: "", desc: "", icon: "" });

// Group name input — required field
<Input
  value={groupDraft.name}
  onChange={(e) => setGroupDraft((prev) => ({ ...prev, name: e.target.value }))}
  placeholder="Enter group name"
  isInvalid={!groupDraft.name.trim()}   // red border when empty
/>

// Description input — optional field
<Input
  value={groupDraft.desc}
  onChange={(e) => setGroupDraft((prev) => ({ ...prev, desc: e.target.value }))}
  placeholder="Optional description"
/>

// Read-only display (e.g. showing a generated ID)
<Input value="GRP-10042" disabled />`;

const SNIPPET_SEARCHBAR = `import { SearchBar } from "@/shared/components/ui";

// SearchBar debounces input so API calls don't fire on every keystroke.
// onDebouncedChange fires after the user stops typing for debounceMs.
//
// Real example: Data Table Example — search bar triggers table reload
<SearchBar
  value={tableState.filters?.search || ""}
  debounceMs={350}
  placeholder="Search code, name, team, role, status"
  onDebouncedChange={(nextValue) => {
    // Update table state ? triggers data re-fetch
    setTableState((prev) => ({
      ...prev,
      filters: { ...prev.filters, search: nextValue },
      pagination: { ...prev.pagination, page: 1 },
    }));
  }}
/>`;

const SNIPPET_DROPDOWN_BASIC = `import { Dropdown } from "@/shared/components/ui";

// Basic dropdown — static menu items, click handlers
// Used for: row action menus, toolbar option menus
<Dropdown>
  <Dropdown.Toggle variant="secondary" size="sm">
    Actions
  </Dropdown.Toggle>
  <Dropdown.Menu>
    <Dropdown.Item onClick={handleEdit}>Edit</Dropdown.Item>
    <Dropdown.Item onClick={handleDuplicate}>Duplicate</Dropdown.Item>
    <Dropdown.Divider />
    <Dropdown.Item onClick={handleDeactivate}>Deactivate</Dropdown.Item>
  </Dropdown.Menu>
</Dropdown>`;

const SNIPPET_DROPDOWN_DATABIND = `// Databind dropdown from API
//
// Real example: Card Module Setup — Application Selector
// Data source: psb_s_application table
// API: loaded via server component props (seedApplications)
//
// The page.js server component fetches applications:
//   const applications = await loadApplications();
//   return <CardModuleSetupClient seedApplications={applications} />;
//
// Client component binds to a <select> (or Dropdown):
const [selectedApp, setSelectedApp] = useState(null);

// Using native <select> for application selector (simpler for single-value):
<Form.Select
  value={selectedApp?.app_id ?? ""}
  onChange={(e) => {
    const appId = Number(e.target.value);
    const app = applications.find((a) => a.app_id === appId);
    setSelectedApp(app);
  }}
>
  <option value="" disabled>Select Application</option>
  {applications.map((app) => (
    <option key={app.app_id} value={app.app_id}>
      {app.app_name}
    </option>
  ))}
</Form.Select>

// Using Dropdown for richer display:
<Dropdown>
  <Dropdown.Toggle variant="secondary" size="sm">
    {selectedApp?.app_name || "Select Application"}
  </Dropdown.Toggle>
  <Dropdown.Menu>
    {applications.map((app) => (
      <Dropdown.Item
        key={app.app_id}
        onClick={() => setSelectedApp(app)}
      >
        {app.app_name}
      </Dropdown.Item>
    ))}
  </Dropdown.Menu>
</Dropdown>`;

const SNIPPET_DROPDOWN_HARDCODE = `// Hardcoded combo items (use when options are known at build time)
//
// Real example: status filter options for a table
const statusItems = [
  { label: "Active",    value: "active"    },
  { label: "Pending",   value: "pending"   },
  { label: "Inactive",  value: "inactive"  },
  { label: "Suspended", value: "suspended" },
];

<Dropdown.Menu>
  {statusItems.map((item) => (
    <Dropdown.Item key={item.value} onClick={() => onSelect(item.value)}>
      {item.label}
    </Dropdown.Item>
  ))}
</Dropdown.Menu>`;

const SNIPPET_INPUT_VALIDATION = `// Input with validation — show error only after user interaction
//
// Real example: Card Module Setup — validate group name before saving
const [groupDraft, setGroupDraft] = useState({ name: "", desc: "", icon: "" });
const [touched, setTouched] = useState(false);
const nameError = touched && !groupDraft.name.trim();

<Input
  value={groupDraft.name}
  onChange={(e) => setGroupDraft((prev) => ({ ...prev, name: e.target.value }))}
  onBlur={() => setTouched(true)}           // mark as touched on blur
  placeholder="Group Name"
  isInvalid={nameError}                     // red border when empty + touched
/>
{nameError && <p className="field-error">Group name is required.</p>}

// In the submit handler:
const handleConfirmAddGroup = () => {
  setTouched(true);
  if (!groupDraft.name.trim()) {
    toastError("Group name is required.", "Validation");
    return;
  }
  // ... proceed with API call
};`;

const SNIPPET_MODAL = `import { Modal, Button } from "@/shared/components/ui";

// Modal is used for: confirmation dialogs, add/edit forms, workflow actions
//
// Real example: Card Module Setup — Add Card Group dialog
const [dialog, setDialog] = useState({ kind: null });
const [isMutatingAction, setIsMutatingAction] = useState(false);

<Modal
  show={dialog.kind === "add-group"}
  onHide={() => setDialog({ kind: null })}
  title="Add Card Group"
  footer={
    <>
      <Button variant="ghost" onClick={() => setDialog({ kind: null })} disabled={isMutatingAction}>
        Cancel
      </Button>
      <Button variant="primary" loading={isMutatingAction} onClick={handleConfirmAddGroup}>
        Add Group
      </Button>
    </>
  }
>
  <Input
    value={groupDraft.name}
    onChange={(e) => setGroupDraft((prev) => ({ ...prev, name: e.target.value }))}
    placeholder="Group Name"
  />
  <Input
    value={groupDraft.desc}
    onChange={(e) => setGroupDraft((prev) => ({ ...prev, desc: e.target.value }))}
    placeholder="Description (optional)"
  />
</Modal>`;

const SNIPPET_SEARCHBAR_WITH_API = `// SearchBar with server-side search (for large datasets)
//
// Real example: Data Table Example — server-side search via API
// API endpoint: GET /api/examples/data-table?search=query&page=1&pageSize=10
//
// The controller hook sends the search term as a query parameter:
const loadData = useCallback(async () => {
  setLoading(true);
  try {
    const params = new URLSearchParams({
      page: String(tableState.pagination.page),
      pageSize: String(tableState.pagination.pageSize),
      search: tableState.filters?.search || "",
      sortKey: tableState.sorting?.key || "",
      sortDir: tableState.sorting?.direction || "",
    });

    // Append active filters
    Object.entries(tableState.filters || {}).forEach(([key, value]) => {
      if (key !== "search" && value) params.set(key, String(value));
    });

    const response = await fetch(\`/api/examples/data-table?\${params}\`);
    const payload = await response.json();

    setRows(payload.rows || []);
    setTableState((prev) => ({
      ...prev,
      pagination: { ...prev.pagination, total: payload.total || 0 },
    }));
  } finally {
    setLoading(false);
  }
}, [tableState.filters, tableState.sorting, tableState.pagination.page, tableState.pagination.pageSize]);

// The SearchBar is built into <TableZ /> via searchPlaceholder prop,
// OR you can use it standalone:
<SearchBar
  value={search}
  debounceMs={350}
  placeholder="Search employees..."
  onDebouncedChange={(next) => {
    setSearch(next);
    loadData(next);
  }}
/>`;

const SNIPPET_MODAL_SAVE_FLOW = `// Modal with full save-to-API flow
//
// Real example: Card Module Setup — Add Card Group with API call
// API: POST /api/admin/card-module-setup/card-groups
// Request body: { app_id, group_name, group_desc, icon }
//
const [dialog, setDialog] = useState({ kind: null });
const [isMutatingAction, setIsMutatingAction] = useState(false);
const [groupDraft, setGroupDraft] = useState({ name: "", desc: "", icon: "" });

const handleConfirmAddGroup = async () => {
  const groupName = groupDraft.name.trim();
  if (!groupName) {
    toastError("Group name is required.", "Validation");
    return;
  }

  setIsMutatingAction(true);
  try {
    const response = await fetch("/api/admin/card-module-setup/card-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: selectedApp.app_id,
        group_name: groupName,
        group_desc: groupDraft.desc.trim(),
        icon: groupDraft.icon.trim() || "bi-collection",
      }),
    });

    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Failed to create group.");

    toastSuccess("Card group added to batch.", "Add Group");
    setDialog({ kind: null });
    setGroupDraft({ name: "", desc: "", icon: "" });
  } catch (err) {
    toastError(err.message, "Error");
  } finally {
    setIsMutatingAction(false);
  }
};

<Modal
  show={dialog.kind === "add-group"}
  onHide={() => !isMutatingAction && setDialog({ kind: null })}
  title="Add Card Group"
  footer={
    <>
      <Button variant="ghost" onClick={() => setDialog({ kind: null })} disabled={isMutatingAction}>
        Cancel
      </Button>
      <Button variant="primary" loading={isMutatingAction} onClick={handleConfirmAddGroup}>
        Add Group
      </Button>
    </>
  }
>
  <Input value={groupDraft.name} onChange={(e) => setGroupDraft(p => ({...p, name: e.target.value}))} placeholder="Group Name" />
  <Input value={groupDraft.desc} onChange={(e) => setGroupDraft(p => ({...p, desc: e.target.value}))} placeholder="Description" />
</Modal>`;

const SNIPPET_BADGE = `import { Badge } from "@/shared/components/ui";

// Badge displays status labels with color-coded backgrounds.
// Used inside table column renderers to show row status visually.
//
// Real example: Card Module Setup — is_active column renderer
{
  key: "is_active",
  label: "Active",
  width: 100,
  render: (row) => (
    <Badge bg={row.is_active ? "success" : "secondary"}>
      {row.is_active ? "Yes" : "No"}
    </Badge>
  ),
}

// Real example: User Master Setup — user status column
{
  key: "status",
  label: "Status",
  render: (row) => {
    const map = {
      active:   { bg: "success",   text: "light" },
      pending:  { bg: "warning",   text: "dark"  },
      inactive: { bg: "secondary", text: "light" },
    };
    const s = map[row.status] || { bg: "dark", text: "light" };
    return <Badge bg={s.bg} text={s.text}>{row.status}</Badge>;
  },
}

// Available bg values: success, warning, secondary, danger, dark, primary, info`;

const SNIPPET_TOAST = `import { toastSuccess, toastError, toastWarning, toastInfo } from "@/shared/components/ui";

// Toast shows temporary notification messages in the top-right corner.
// GlobalToastHost is already mounted once in the app layout — do NOT add it again.
//
// Real examples from Card Module Setup:
//
// After batch save succeeds:
toastSuccess(\`Saved \${pendingSummary.total} batched change(s).\`, "Save Batch");

// After an API call fails:
toastError(error?.message || "Failed to save batched changes.", "Error");

// After adding a card to pending batch:
toastSuccess("Card added to batch.", "Add Card");

// Warning for unsaved changes:
toastWarning("You have unsaved changes.", "Warning");

// Informational message:
toastInfo("Drag rows to reorder.", "Tip");

// Signature: toastSuccess(message, title?)
// All four variants: toastSuccess, toastError, toastWarning, toastInfo`;

const SNIPPET_CARD_SURFACE = `import { Card } from "@/shared/components/ui";

// Card is a container surface with optional title, subtitle, and toolbar.
// Used to wrap tables, forms, and content sections on setup pages.
//
// Real example: Card Module Setup — left panel wraps Card Groups table
<Card
  title="Card Groups"
  subtitle="Drag rows to reorder groups"
  toolbar={
    <Button size="sm" variant="primary" onClick={() => setDialog({ kind: "add-group" })}>
      <FontAwesomeIcon icon={faPlus} /> Add Group
    </Button>
  }
>
  <TableZ
    columns={groupColumns}
    data={decoratedAppGroups}
    rowIdKey="group_id"
    actions={groupActions}
    emptyMessage="No card groups for this application."
    draggable={!isSaving}
    onReorder={handleGroupReorder}
  />
</Card>

// Props:
//   title    (string)    — Card header text
//   subtitle (string)    — Smaller text below title
//   toolbar  (ReactNode) — Right-aligned header content (buttons, etc.)
//   children (ReactNode) — Card body content`;

const SNIPPET_TOKENS = `/* Design tokens \u2014 from src/styles/variables.css */

/* Spacing */
--psb-space-4  --psb-space-8  --psb-space-12
--psb-space-16 --psb-space-24

/* Radius */
--psb-radius-6  --psb-radius-8  --psb-radius-12

/* Font size */
--psb-font-12  --psb-font-14  --psb-font-16

/* Transitions */
--psb-transition-150  --psb-transition-200`;

const SNIPPET_MODULE_STRUCTURE = `src/modules/admin/<module-name>/
  index.js              ← module entry point (routes, metadata)
  pages/                ← server components (data loading, access gate)
  view/                 ← client components ("use client" layout layer)
  components/           ← pure UI (props only, no logic)
  hooks/                ← state management + side effects
  services/             ← business logic + validation
  repo/
    <module>.repo.js    ← Supabase queries (ONLY place that calls .from())
  model/
    <module>.model.js   ← maps DB rows → UI-friendly objects
  utils/                ← helpers, constants, formatters`;

const SNIPPET_MODULE_MANIFEST = `// index.js — this is your module's registration file.
// The module loader reads this to know your module exists.
//
// key      → unique slug (used in URLs and the dynamic router)
// app_id   → must match the row in psb_s_application table
// routes   → page: string name that maps to a file in pages/

export default {
  key: "gutter",
  app_id: 1001,
  name: "Gutter",
  description: "Gutter ordering and configuration.",
  icon: "bi-bucket",
  routes: [
    { path: "/admin/gutter", page: "DashboardPage" },
  ],
};`;

const SNIPPET_MODULE_BUILD_SEQUENCE = `1. Create folder: src/modules/admin/<module-name>/
2. Create required subfolders: pages/, view/, components/, hooks/, services/, repo/, model/, utils/
3. Register app in psb_s_application table
4. Create groups in psb_m_appcardgroup
5. Create cards in psb_s_appcard
6. Assign role access in psb_m_appcardroleaccess
7. Create index.js with module manifest (key, app_id, routes)
8. Create page route: src/app/admin/<module-name>/page.js
9. Build UI using shared components (TableZ, Card, Modal, etc.)
10. Apply card access checks via ModuleAccessGate
11. Test authorized and unauthorized flows
12. Run npm run build — must pass clean`;

const SNIPPET_CRUD_REPOSITORY_PATTERN = `// hooks/useUsersData.js
import { usersService } from "../services/users.service";

export async function useUsersData() {
  return usersService.createUser(payload);
}

// services/users.service.js
import { getSupabase } from "../utils/supabase";
import { userRepository } from "../repo/user.repo";

export const usersService = {
  async createUser(payload) {
    const supabase = await getSupabase();
    return userRepository.create(supabase, payload);
  },
};

// repo/user.repo.js
export const userRepository = {
  async create(supabase, payload) {
    const { data, error } = await supabase
    .from("psb_s_user")
    .insert(payload)
    .select("*")
    .single();

    if (error) throw new Error(error.message);
    return data;
  },
};

// Rule: UI -> Hooks -> Services -> Repository -> Database`;

const SNIPPET_MODEL_MAPPER = `// model/appRole.model.js

export function mapAppRole(row) {
  return {
    roleId: row.role_id,
    roleName: row.role_name,
    description: row.description,
    isActive: row.is_active
  };
}`;

const SNIPPET_REPO_SUPABASE = `// utils/supabase.js
//
// ?? Every module MUST use this helper instead of calling getSupabase() directly.
// Modules are loaded at runtime via a dynamic filesystem loader.
// The core Supabase singleton may not be initialized yet at that point.
//
export async function getSupabase() {
  const mod = await import("../../../../core/supabase/client.js");

  try {
    // Case 1: core already initialized the singleton
    return mod.getSupabase();
  } catch {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && anonKey) {
      // Case 2: initialize it ourselves with public env keys
      return mod.initSupabase(url, anonKey);
    }

    // Case 3: server-side — fall back to admin client
    const { getSupabaseAdmin } = await import("../../../../core/supabase/admin.js");
    return getSupabaseAdmin();
  }
}

// repo/appRole.repo.js
// ? Repo receives supabase as a parameter — it never imports it directly.
import { mapAppRole } from "../model/appRole.model";

export const appRoleRepo = {
  async getAll(supabase) {
    const { data, error } = await supabase
      .from("psb_s_app_roles")
      .select("*");

    if (error) throw new Error(error.message);
    return data.map(mapAppRole);
  },
};`;

const SNIPPET_SERVICE_LAYER = `// services/appRole.service.js
import { getSupabase } from "../utils/supabase";
import { appRoleRepo } from "../repo/appRole.repo";

export const appRoleService = {
  async create(data) {
    const supabase = await getSupabase();
    return appRoleRepo.insert(supabase, data);
  },
};`;

const SNIPPET_ROLES_STRUCTURE = `src/modules/admin/roles/
  index.js
  pages/
    RolesPage.jsx         ← server component (loads data, wraps in access gate)
    DashboardPage.js      ← static landing page
  view/
    RolesView.jsx         ← "use client" layout (wires hook → components)
  components/
    RolesTable.jsx        ← pure UI table (receives data via props)
  hooks/
    useRolesTable.js      ← manages state, calls service
  services/
    roles.service.js      ← business logic + validation
  repo/
    roles.repo.js         ← Supabase CRUD queries
  model/
    roles.model.js        ← maps DB rows → clean objects
  utils/
    supabase.js           ← module-local Supabase client helper`;

const SNIPPET_ROLES_MODEL = `// model/roles.model.js

export function mapRole(row) {
  return {
    id: row.role_id,
    name: row.role_name,
    description: row.role_desc,
    isActive: row.is_active,
    createdAt: row.created_at
  };
}`;

const SNIPPET_ROLES_REPO = `// repo/roles.repo.js

import { mapRole } from "../model/roles.model";

const TABLE = "psb_s_role";

export const rolesRepo = {

  async getAll(supabase) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return data.map(mapRole);
  },

  async insert(supabase, payload) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        role_name: payload.name,
        role_desc: payload.description,
        is_active: true
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return mapRole(data);
  },

  async update(supabase, payload) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        role_name: payload.name,
        role_desc: payload.description,
        is_active: payload.isActive,
        updated_at: new Date()
      })
      .eq("role_id", payload.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return mapRole(data);
  },

  async delete(supabase, id) {
    // First, remove all user-role access mappings for this role
    const { error: accessError } = await supabase
      .from("psb_m_userapproleaccess")
      .delete()
      .eq("role_id", id);

    if (accessError) throw new Error(accessError.message);

    // Then delete the role itself
    const { error: roleError } = await supabase
      .from(TABLE)
      .delete()
      .eq("role_id", id);

    if (roleError) throw new Error(roleError.message);

    return true;
  }
};`;

const SNIPPET_ROLES_SERVICE = `// services/roles.service.js

import { getSupabase } from "../utils/supabase";
import { rolesRepo } from "../repo/roles.repo";

export const rolesService = {

  async getRoles() {
    const supabase = await getSupabase();
    return rolesRepo.getAll(supabase);
  },

  async createRole(data) {
    if (!data.name) throw new Error("Role name is required");
    const supabase = await getSupabase();
    return rolesRepo.insert(supabase, data);
  },

  async updateRole(data) {
    const supabase = await getSupabase();
    return rolesRepo.update(supabase, data);
  },

  async deleteRole(id) {
    const supabase = await getSupabase();
    return rolesRepo.delete(supabase, id);
  }
};`;

const SNIPPET_ROLES_HOOK = `// hooks/useRolesTable.js

import { useEffect, useState } from "react";
import { rolesService } from "../services/roles.service";

export function useRolesTable() {
  const [data, setData] = useState([]);

  async function load() {
    const res = await rolesService.getRoles();
    setData(res);
  }

  useEffect(() => {
    load();
  }, []);

  return {
    data,
    reload: load
  };
}`;

const SNIPPET_ROLES_COMPONENT = `// components/RolesTable.jsx

export default function RolesTable({ data, onDelete }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {data.map(role => (
          <tr key={role.id}>
            <td>{role.name}</td>
            <td>{role.isActive ? "Active" : "Inactive"}</td>
            <td>
              <button onClick={() => onDelete(role.id)}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}`;

const SNIPPET_ROLES_PAGE = `// pages/RolesPage.jsx — SERVER COMPONENT (no "use client")
// This runs on the server. It loads data and passes it to the View.

import ModuleAccessGate from "@/core/auth/ModuleAccessGate";
import RolesView from "../view/RolesView";
import { rolesService } from "../services/roles.service";

const APP_ID = 1001; // must match psb_s_application row

export default async function RolesPage() {
  const data = await rolesService.getRoles();

  return (
    <ModuleAccessGate appId={APP_ID}>
      <RolesView roles={data} />
    </ModuleAccessGate>
  );
}`;

const SNIPPET_ROLES_VIEW = `// view/RolesView.jsx — CLIENT COMPONENT ("use client")
// This is the glue between the hook and the UI components.
// It calls the hook and spreads its return values to components.

"use client";

import { useRolesTable } from "../hooks/useRolesTable";
import RolesTable from "../components/RolesTable";
import { Card } from "@/shared/components/ui";
import { rolesService } from "../services/roles.service";

export default function RolesView({ roles }) {
  // The hook manages ALL state and returns everything the UI needs
  const { data, reload } = useRolesTable({ roles });

  return (
    <main className="container py-4">
      <Card title="Roles">
        <RolesTable data={data} onDelete={async (id) => {
          await rolesService.deleteRole(id);
          reload();
        }} />
      </Card>
    </main>
  );
}`;

const SNIPPET_ROLES_INDEX = `// index.js — module manifest
// The module loader scans for this file to register your module.

export default {
  key: "roles",
  app_id: 1001,
  name: "Roles",
  description: "Manage user roles and permissions.",
  icon: "bi-shield-lock",
  routes: [
    { path: "/admin/roles", page: "DashboardPage" },
  ],
};`;

const SNIPPET_MODULE_DEPLOY_CHECKLIST = `Before release:
- Build passes
- Login/session flow verified
- Unauthorized route access blocked
- Dashboard visibility verified for multiple users
- Module cards verified against role mappings
- No hardcoded role names/permissions
- Table row action types use only: primary | secondary | danger`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function parseDateOnly(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function getStatusBadge(status) {
  const s = normalizeText(status);
  if (s === "active")   return { bg: "success",   text: "light" };
  if (s === "pending")  return { bg: "warning",   text: "dark"  };
  if (s === "inactive") return { bg: "secondary", text: "light" };
  return { bg: "dark", text: "light" };
}

async function copyText(text) {
  const v = String(text || "");
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(v); return true; } catch { /* fall through */ }
  }
  if (typeof document === "undefined") return false;
  const el = document.createElement("textarea");
  el.value = v;
  el.setAttribute("readonly", "readonly");
  el.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(el);
  el.select();
  el.setSelectionRange(0, el.value.length);
  const ok = document.execCommand("copy");
  document.body.removeChild(el);
  return ok;
}

function toButtonVariantByType(type) {
  if (type === "danger") return "danger";
  if (type === "secondary" || type === "warning") return "secondary";
  return "primary";
}

// ---------------------------------------------------------------------------
// Primitive components
// ---------------------------------------------------------------------------

function Snippet({ title, code }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    const ok = await copyText(code);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };
  return (
    <div className={styles.snippet}>
      <div className={styles.snippetHeader}>
        <span className={styles.snippetTitle}>{title}</span>
        <button
          type="button"
          onClick={handle}
          className={[styles.copyBtn, copied ? styles.copyBtnDone : ""].filter(Boolean).join(" ")}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className={styles.codeBlock}><code>{code}</code></pre>
    </div>
  );
}

function ExampleBlock({ title, when, children, snippet, snippetTitle, rules }) {
  return (
    <div className={styles.exampleBlock}>
      {title ? <p className={styles.exampleTitle}>{title}</p> : null}
      {when  ? <p className={styles.exampleWhen}>{when}</p>   : null}
      <div className={styles.examplePreview}>{children}</div>
      {snippet ? <Snippet title={snippetTitle || "Usage"} code={snippet} /> : null}
      {rules ? (
        <ul className={styles.exampleRules}>
          {rules.map((r) => <li key={r}>{r}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

function StepBar({ steps, active, onChange }) {
  return (
    <div className={styles.stepBar} role="tablist">
      {steps.map((s, i) => (
        <button
          key={s.id}
          type="button"
          role="tab"
          aria-selected={active === s.id}
          className={[styles.stepTab, active === s.id ? styles.stepTabActive : ""].filter(Boolean).join(" ")}
          onClick={() => onChange(s.id)}
        >
          <span className={styles.stepNum}>{i + 1}</span>
          <span className={styles.stepLabel}>{s.label}</span>
        </button>
      ))}
    </div>
  );
}

function Accordion({ items }) {
  const [openKey, setOpenKey] = useState(items[0]?.key || "");
  return (
    <div className={styles.accordion}>
      {items.map((item) => {
        const isOpen = openKey === item.key;
        return (
          <div key={item.key} className={[styles.accordionItem, isOpen ? styles.accordionItemOpen : ""].filter(Boolean).join(" ")}>
            <button
              type="button"
              className={styles.accordionHeader}
              onClick={() => setOpenKey(isOpen ? "" : item.key)}
              aria-expanded={isOpen}
            >
              <span>{item.title}</span>
              <FontAwesomeIcon icon={isOpen ? faChevronUp : faChevronDown} aria-hidden="true" />
            </button>
            {isOpen ? <div className={styles.accordionBody}>{item.content}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

function RefPropRow({ prop, required, type, desc }) {
  return (
    <div className={styles.propRow}>
      <div className={styles.propLeft}>
        <span className={styles.propName}>{prop}</span>
        <span className={[styles.propBadge, required ? styles.propBadgeReq : styles.propBadgeOpt].filter(Boolean).join(" ")}>
          {required ? "required" : "optional"}
        </span>
      </div>
      <span className={styles.propType}>{type}</span>
      <span className={styles.propDesc}>{desc}</span>
    </div>
  );
}

function PatternToggle({ modes, active, onChange }) {
  return (
    <div className={styles.patternToggle}>
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          className={[styles.patternBtn, active === m.id ? styles.patternBtnActive : ""].filter(Boolean).join(" ")}
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Start tab
// ---------------------------------------------------------------------------

const MODULE_CREATION_STEPS = [
  {
    key: "step-0",
    title: "Step 0: Project Architecture (How Everything Fits Together)",
    content: (
      <div className={styles.refBody}>
        <p className={styles.stepNote}>
          Before writing any code, understand how the project is organized. This is a <strong>Next.js App Router</strong> project
          with <strong>Supabase</strong> as the database. Here is how the folders map to responsibilities:
        </p>
        <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
          <pre style={{ fontSize: "0.85rem", overflow: "auto", margin: 0 }}>{`PSBUniverse-core/
  src/
    app/                        ← Next.js routing (URLs)
      admin/                    ← Admin page routes (/admin/application-setup, etc.)
        <module>/page.js        ← Thin wrapper that imports the module's Page component
      api/                      ← API routes (server-side endpoints)
        admin/                  ← Admin API routes (/api/admin/application-setup/...)
          <module>/route.js     ← Handles GET/POST/PATCH/DELETE
        databind/               ← Generic data engine (query, options, export, schema)
      login/                    ← Login page
      dashboard/                ← Dashboard page
      [...modulePath]/page.js   ← Dynamic router (catches all module routes)

    modules/                    ← All business logic lives here
      admin/                    ← Admin modules
        application-setup/      ← Each module has the same folder structure
        card-module-setup/
        company-department-setup/
        status-setup/
        user-master-setup/
      examples/                 ← This examples page
      loadModules.js            ← Scans modules/ for index.js files at startup

    core/                       ← Framework code (DO NOT modify)
      auth/                     ← Login, session, RBAC, access gates
      supabase/                 ← Database client setup (admin + browser)
      layout/                   ← App shell (navbar, sidebar)

    shared/                     ← Reusable UI components
      components/ui/            ← TableX, TableZ, Button, Input, Modal, Badge, etc.
      utils/                    ← toast.js, navbar-loader.js

    styles/                     ← CSS variables, theme, globals`}</pre>
        </div>
        <div style={{ marginTop: "1.5rem" }}>
          <p className={styles.ruleHeading}>How a Page Request Works (Simplified)</p>
          <pre style={{ fontSize: "0.85rem", overflow: "auto", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>{`User visits /admin/application-setup
  → Next.js matches src/app/admin/application-setup/page.js
    → page.js imports ApplicationSetupPage from src/modules/admin/application-setup/pages/
      → ApplicationSetupPage (server) loads data via hook → service → repo → Supabase
      → Wraps in ModuleAccessGate (checks if user has permission)
      → Passes data to ApplicationSetupView (client "use client" component)
        → View calls useApplicationSetup hook (manages all state)
          → Hook returns state + handlers to components
            → Components render using shared UI (TableZ, Card, Modal, Badge)`}</pre>
        </div>
        <div style={{ marginTop: "1.5rem" }}>
          <p className={styles.ruleHeading}>Key Concepts for New Devs</p>
          <div className={styles.ruleGrid}>
            <div className={styles.ruleCol}>
              <ul className={styles.ruleList}>
                <li><strong>Modules are self-contained</strong> — each module has its own pages, hooks, services, repo, and model. No module imports from another module.</li>
                <li><strong>Core is off-limits</strong> — never edit files in <code>src/core/</code>. It handles auth, layout, and database setup.</li>
                <li><strong>Shared UI is your toolkit</strong> — import from <code>@/shared/components/ui</code> for all UI components. Never build your own table or modal.</li>
              </ul>
            </div>
            <div className={styles.ruleCol}>
              <ul className={styles.ruleList}>
                <li><strong>API routes are optional</strong> — the <code>/api/databind/</code> engine handles CRUD for any table. Only create custom API routes when you need special business logic.</li>
                <li><strong>Admin prefix</strong> — all admin modules live under <code>src/modules/admin/</code> and their routes start with <code>/admin/</code>.</li>
                <li><strong>Server vs Client</strong> — Pages load data on the server. Views render on the client with <code>&quot;use client&quot;</code>. This separation is important for performance and security.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "step-1",
    title: "Step 1: Core System Purpose (Foundation, Not Features)",
    content: (
      <div className={styles.refBody}>
        <p className={styles.stepNote}>Core enforces architecture and shared engines; modules implement business features. Keep core generic.</p>
        <div className={styles.ruleGrid}>
          <div className={styles.ruleCol}>
            <p className={styles.ruleHeading}>Core Owns</p>
            <ul className={styles.ruleList}>
              <li>Auth/session lifecycle</li>
              <li>RBAC enforcement</li>
              <li>Shared UI engines (table/forms/components)</li>
              <li>Global rules and contracts</li>
            </ul>
          </div>
          <div className={styles.ruleCol}>
            <p className={styles.ruleHeading}>Core Must Not</p>
            <ul className={styles.ruleList}>
              <li>Contain module-specific business logic</li>
              <li>Contain one-off feature behavior</li>
              <li>Allow architecture drift across modules</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "step-2",
    title: "Step 2: Module Structure + Role Of Each Part (No Optional Sections)",
    content: (
      <div className={styles.refBody}>
        <Snippet title="Required module structure" code={SNIPPET_MODULE_STRUCTURE} />
        <div className={styles.ruleGrid}>
          <div className={styles.ruleCol}>
            <p className={styles.ruleHeading}>Role Breakdown</p>
            <ul className={styles.ruleList}>
              <li><code>index.js</code>: Acts as the module entry point. Registers routes, exports module config, and integrates with core loader.</li>
              <li><code>pages/</code>: Server components (<code>async</code> functions). Load data from services, wrap in <code>ModuleAccessGate</code>, and pass data down to the view. No <code>&quot;use client&quot;</code> here.</li>
              <li><code>view/</code>: Client layout components (<code>&quot;use client&quot;</code>). Wire the hook to components. This is where you call <code>useMyModuleSetup()</code> and spread its return values to child components. Think of it as the &quot;glue&quot; between the hook and the UI.</li>
              <li><code>components/</code>: Pure UI only. Receives data and handlers via props. MUST NOT contain business logic or data fetching.</li>
              <li><code>services/</code>: Contains all business logic and workflows (e.g. create, approve, reject). Acts as the only layer UI interacts with for actions. MUST NOT call Supabase directly.</li>
              <li><code>repo/&lt;module&gt;.repo.js</code>: Handles ALL Supabase/database operations. Responsible for CRUD execution. MUST NOT contain business logic. MUST transform payloads before sending to DB.</li>
              <li><code>model/&lt;module&gt;.model.js</code>: Maps database response into application-friendly structure. Acts as a lightweight data normalization layer. MUST be used on all read operations from repo.</li>
              <li><code>hooks/</code>: Encapsulates reusable UI logic and state handling. Can call services. MUST NOT contain business logic duplication. The main hook is the &quot;brain&quot; of the module — it holds all state and returns everything the view needs.</li>
              <li><code>utils/</code>: Contains pure helper functions (formatters, transformers, constants). No side effects, no API calls. Also contains <code>supabase.js</code> — the module-local database client helper.</li>
            </ul>
          </div>
          <div className={styles.ruleCol}>
            <p className={styles.ruleHeading}>How They Work Together</p>
            <ul className={styles.ruleList}>
              <li><strong>Page</strong> (server) loads data via hook/service, wraps in access gate, passes data to <strong>View</strong></li>
              <li><strong>View</strong> (client) calls the main hook, spreads its return values to <strong>Components</strong></li>
              <li><strong>Hook</strong> manages all state, calls services for business logic</li>
              <li><strong>Services</strong> call repo for data access</li>
              <li><strong>Repo</strong> communicates with Supabase, returns data through <strong>Model</strong> mapper</li>
              <li><strong>Components</strong> receive clean, mapped data via props — they never fetch or compute</li>
            </ul>
          </div>
        </div>
        <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
          <p className={styles.ruleHeading}>Enforced Data Flow (Mandatory)</p>
          <pre style={{ fontSize: "0.85rem", overflow: "auto" }}>{`Page (server, loads data)
  → View ("use client", wires hook to components)
    → Hook (state + handlers)
      → Services (business logic)
        → Repo (Supabase queries)
          → Model (maps DB rows → clean objects)

Why this order?
  • Pages run on the server = secrets stay safe, data loads fast
  • Views run on the client = React state, interactivity, "use client"
  • Hooks hold ALL state = one place to debug, one place to change
  • Services hold ALL rules = validation lives here, not scattered in UI
  • Repo is the ONLY layer that calls .from() = easy to find all DB queries
  • Model maps EVERY read = UI never sees raw DB column names`}</pre>
        </div>
        <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: "#fff3cd", borderRadius: "4px", borderLeft: "4px solid #ff6b6b" }}>
          <p className={styles.ruleHeading}>Strict Rules (Non-Negotiable)</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <p style={{ fontWeight: "600", marginBottom: "0.5rem", color: "#d32f2f" }}>NEVER call Supabase (<code>.from()</code>) directly from:</p>
              <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
                <li>components (they&apos;re just UI — no data fetching)</li>
                <li>pages (they delegate to services via hooks)</li>
                <li>hooks (they call services, not the database)</li>
                <li>services (use utils/supabase.js to get the client, then pass it to repo)</li>
              </ul>
              <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.5rem" }}>Why? Because if DB calls are everywhere, bugs are impossible to track. One layer = one place to fix.</p>
            </div>
            <div>
              <p style={{ fontWeight: "600", marginBottom: "0.5rem", color: "#d32f2f" }}>NEVER place business logic inside:</p>
              <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
                <li>repo (it only does database reads/writes)</li>
                <li>components (they only render what they&apos;re given)</li>
                <li>hooks (they manage state, not business rules)</li>
              </ul>
              <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.5rem" }}>Why? Because business rules in UI code get duplicated and forgotten. Keep them in services/ so there&apos;s one source of truth.</p>
            </div>
            <div>
              <p style={{ fontWeight: "600", marginBottom: "0.5rem", color: "#2e7d32" }}>ALWAYS map database responses using:</p>
              <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
                <li>model/&lt;module&gt;.model.js</li>
              </ul>
              <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.5rem" }}>Why? If you pass raw DB rows to the UI, a column rename breaks every component. The model is your safety layer.</p>
            </div>
            <div>
              <p style={{ fontWeight: "600", marginBottom: "0.5rem", color: "#2e7d32" }}>ALWAYS centralize workflows inside:</p>
              <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
                <li>services/</li>
              </ul>
              <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.5rem" }}>Why? When a feature needs changes (e.g. &quot;add email notification on create&quot;), you change ONE file in services/ instead of hunting through 10 components.</p>
            </div>
          </div>
        </div>
        <hr style={{ margin: "2rem 0", borderColor: "#ddd" }} />
        <div style={{ marginTop: "2rem" }}>
          <h4 style={{ marginBottom: "1rem", color: "#333" }}>Step 2.1: Example</h4>
          <Accordion items={[
            {
              key: "roles-structure",
              title: "STRUCTURE",
              content: (
                <div>
                  <p className={styles.stepNote}>
                    This folder layout is the contract for every module. It keeps responsibilities separated so the codebase stays predictable and easy to maintain.
                  </p>
                  <p className={styles.stepNote}>
                    Use it as your starting scaffold before writing business code.
                  </p>
                  <Snippet code={SNIPPET_ROLES_STRUCTURE} />
                </div>
              )
            },
            {
              key: "roles-model",
              title: "1. MODEL (maps DB ? UI)",
              content: (
                <div>
                  <p className={styles.stepNote}>
                    The model is a mapper between database column names and UI-friendly names. It protects the UI from raw table shapes and makes future schema changes safer.
                  </p>
                  <p className={styles.stepNote}>
                    Every read path should normalize rows here before they reach components.
                  </p>
                  <Snippet code={SNIPPET_ROLES_MODEL} />
                </div>
              )
            },
            {
              key: "roles-repo",
              title: "2. REPO (Supabase only)",
              content: (
                <div>
                  <p className={styles.stepNote}>
                    The repository is the only layer that talks to Supabase. It owns SQL-like query construction, persistence details, and DB payload transformation.
                  </p>
                  <p className={styles.stepNote}>
                    Keep business decisions out of this layer; focus only on data access and returning mapped results.
                  </p>
                  <Snippet code={SNIPPET_ROLES_REPO} />
                </div>
              )
            },
            {
              key: "roles-service",
              title: "3. SERVICE (business layer)",
              content: (
                <div>
                  <p className={styles.stepNote}>
                    The service layer is where business rules live, such as validation and workflow decisions.
                  </p>
                  <p className={styles.stepNote}>
                    UI code should call services, not repositories, so logic stays centralized and reusable.
                  </p>
                  <Snippet code={SNIPPET_ROLES_SERVICE} />
                </div>
              )
            },
            {
              key: "roles-hook",
              title: "4. HOOK (UI state control)",
              content: (
                <div>
                  <p className={styles.stepNote}>
                    Hooks manage view state and lifecycle behavior for a screen. They coordinate loading and refresh patterns while keeping components clean.
                  </p>
                  <p className={styles.stepNote}>
                    Hooks can call services, but should avoid duplicating business logic.
                  </p>
                  <Snippet code={SNIPPET_ROLES_HOOK} />
                </div>
              )
            },
            {
              key: "roles-component",
              title: "5. COMPONENT (pure UI)",
              content: (
                <div>
                  <p className={styles.stepNote}>
                    Components are presentation-only. They receive data and callbacks through props and render the interface.
                  </p>
                  <p className={styles.stepNote}>
                    No direct data fetching and no business workflow code belongs here.
                  </p>
                  <Snippet code={SNIPPET_ROLES_COMPONENT} />
                </div>
              )
            },
            {
              key: "roles-page",
              title: "6. PAGE (server component — loads data)",
              content: (
                <div>
                  <p className={styles.stepNote}>
                    The page is a <strong>server component</strong> (no &quot;use client&quot;). It loads data from the service layer,
                    wraps the content in <code>ModuleAccessGate</code> (permission check), and passes data to the <strong>View</strong>.
                  </p>
                  <p className={styles.stepNote}>
                    Think of it as the entry point that says: &quot;load data, check permissions, hand off to the client.&quot;
                  </p>
                  <Snippet code={SNIPPET_ROLES_PAGE} />
                </div>
              )
            },
            {
              key: "roles-view",
              title: "7. VIEW (client layout — wires hook to components)",
              content: (
                <div>
                  <p className={styles.stepNote}>
                    The view is a <strong>client component</strong> (<code>&quot;use client&quot;</code>). It&apos;s the glue between
                    the hook and the UI components. It calls your main hook and passes its return values to child components as props.
                  </p>
                  <p className={styles.stepNote}>
                    <strong>Why do we need this?</strong> Because pages are server components (they can&apos;t use React state or hooks),
                    but your UI needs interactivity. The View bridges that gap — it receives server data as props and enables client-side state.
                  </p>
                  <Snippet code={SNIPPET_ROLES_VIEW} />
                </div>
              )
            },
            {
              key: "roles-index",
              title: "8. INDEX (module entry)",
              content: (
                <div>
                  <p className={styles.stepNote}>
                    The module index is the registration point consumed by the module loader. It declares route metadata and the root page component.
                  </p>
                  <p className={styles.stepNote}>
                    Keep this file small and declarative so module bootstrapping stays consistent.
                  </p>
                  <Snippet code={SNIPPET_ROLES_INDEX} />
                </div>
              )
            },
            {
              key: "roles-proof",
              title: "WHAT THIS PROVES",
              content: (
                <div style={{ padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
                  <p className={styles.stepNote}>
                    These outcomes show the architecture is practical in real feature work: clean separation, real CRUD, and scalability without unnecessary complexity.
                  </p>
                  <p>This is now:</p>
                  <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
                    <li>? Real DB (your table)</li>
                    <li>? Real CRUD</li>
                    <li>? Clean separation</li>
                    <li>? No overengineering</li>
                    <li>? No DTO/interface bloat</li>
                    <li>? Still scalable</li>
                  </ul>
                </div>
              )
            },
            {
              key: "roles-important",
              title: "Important (don't miss this)",
              content: (
                <div style={{ padding: "1rem", backgroundColor: "#fff3cd", borderRadius: "4px", borderLeft: "4px solid #ff6b6b" }}>
                  <p className={styles.stepNote}>
                    This is the key guardrail in the pattern: map DB rows before exposing them to the app.
                  </p>
                  <p>This line:</p>
                  <pre style={{ margin: "0.5rem 0", padding: "0.5rem", backgroundColor: "#fff", borderRadius: "4px", overflow: "auto" }}>return data.map(mapRole);</pre>
                  <p style={{ marginTop: "0.5rem" }}>?? That&apos;s your entire protection layer</p>
                  <p>Remove that — your system degrades fast.</p>
                </div>
              )
            }
          ]} />
        </div>
      </div>
    ),
  },
  {
    key: "step-3",
    title: "Step 3: Styling Approach + Standards",
    content: (
      <div className={styles.refBody}>
        <p className={styles.stepNote}>Use a single design system with shared components and tokens only.</p>
        <div className={styles.ruleGrid}>
          <div className={styles.ruleCol}>
            <p className={styles.ruleHeading}>Standards</p>
            <ul className={styles.ruleList}>
              <li>Use predefined tokens for color, spacing, typography, radius</li>
              <li>Apply theme consistently (e.g., gold + gray) with contrast/accessibility</li>
              <li>Keep states explicit: loading, empty, error, no-access</li>
            </ul>
          </div>
          <div className={styles.ruleCol}>
            <p className={styles.ruleHeading}>Restrictions</p>
            <ul className={styles.ruleList}>
              <li>No inline style hacks unless promoted into system standards</li>
              <li>No one-off visual overrides that drift from shared UI</li>
              <li>No module-specific redesign of core shell patterns</li>
            </ul>
          </div>
        </div>
        <Snippet title="Shared imports baseline" code={SNIPPET_IMPORT} />
      </div>
    ),
  },
  {
    key: "step-4",
    title: "Step 4: Database + File Naming Conventions",
    content: (
      <div className={styles.refBody}>
        <div className={styles.ruleGrid}>
          <div className={styles.ruleCol}>
            <p className={styles.ruleHeading}>Database Naming</p>
            <ul className={styles.ruleList}>
              <li>Use predictable snake_case naming</li>
              <li>Keep table/column names descriptive and consistent</li>
              <li>Use stable key patterns for PK/FK fields</li>
              <li>Keep naming governance consistent across all modules</li>
            </ul>
          </div>
          <div className={styles.ruleCol}>
            <p className={styles.ruleHeading}>File Naming</p>
            <ul className={styles.ruleList}>
              <li>Use strict, consistent file patterns across modules</li>
              <li>Service/repository naming must communicate purpose clearly</li>
              <li>Keep module folder hierarchy aligned to the required structure</li>
              <li>No ad hoc naming patterns</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "step-5",
    title: "Step 5: Supabase CRUD Through Repository Layer",
    content: (
      <div className={styles.refBody}>
        <p className={styles.stepNote}>All CRUD must flow through repository + service layers. UI must not call Supabase directly.</p>
        <Snippet title="Service + repository CRUD pattern" code={SNIPPET_CRUD_REPOSITORY_PATTERN} />
        <div className={styles.ruleGrid}>
          <div className={styles.ruleCol}>
            <p className={styles.ruleHeading}>Required Pattern</p>
            <ul className={styles.ruleList}>
              <li>UI to hook/page to service to repository to Supabase</li>
              <li>Centralize business logic in service layer</li>
              <li>Standardize response/error transformation</li>
            </ul>
          </div>
          <div className={styles.ruleCol}>
            <p className={styles.ruleHeading}>Not Allowed</p>
            <ul className={styles.ruleList}>
              <li>Direct Supabase calls inside UI components</li>
              <li>Duplicated query/error logic across pages</li>
            </ul>
          </div>
        </div>
        <hr style={{ margin: "2rem 0", borderColor: "#ddd" }} />
        <div style={{ marginTop: "2rem" }}>
          <h4 style={{ marginBottom: "1rem", color: "#333" }}>Final Clean Pattern (3-Layer Example)</h4>
          <Snippet title="1. MODEL (light mapper)" code={SNIPPET_MODEL_MAPPER} />
          <Snippet title="2. REPO (Supabase only)" code={SNIPPET_REPO_SUPABASE} />
          <Snippet title="3. SERVICE (your brain)" code={SNIPPET_SERVICE_LAYER} />
          <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
            <p className={styles.ruleHeading}>Final Flow</p>
            <pre style={{ fontSize: "0.85rem", overflow: "auto" }}>UI to Service to Repo to Supabase
              |
            Model (mapping)</pre>
          </div>
        </div>
        <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: "#fff3cd", borderRadius: "4px", borderLeft: "4px solid #ff6b6b" }}>
          <p className={styles.ruleHeading}>Non-negotiables (even in simplified version)</p>
          <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
            <li>ALWAYS map response: <code>return mapAppRole(data);</code></li>
            <li>NEVER call supabase in UI: Still banned.</li>
            <li>Keep payload transformation in repo: Do not scatter it in UI.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    key: "step-6",
    title: "Step 6: Define Module Contract + Access Setup",
    content: (
      <div className={styles.refBody}>
        <p className={styles.stepNote}>Define manifest and seed access tables before feature testing.</p>
        <Snippet title="Module manifest" code={SNIPPET_MODULE_MANIFEST} />
        <Snippet title="Build sequence (from docs/dev)" code={SNIPPET_MODULE_BUILD_SEQUENCE} />
      </div>
    ),
  },
  {
    key: "step-7",
    title: "Step 7: Validate Module End-To-End",
    content: (
      <div className={styles.refBody}>
        <div className={styles.ruleGrid}>
          <div className={styles.ruleCol}>
            <p className={styles.ruleHeading}>Must Pass</p>
            <ul className={styles.ruleList}>
              <li>Authorized users can open module routes</li>
              <li>Unauthorized users are blocked by core gate</li>
              <li>Card visibility follows hasCardAccess mappings</li>
              <li>Shared Table remains controlled by module state</li>
            </ul>
          </div>
          <div className={styles.ruleCol}>
            <p className={styles.ruleHeading}>Hard Fails</p>
            <ul className={styles.ruleList}>
              <li>Hardcoded roles or permissions</li>
              <li>Unsupported row action types</li>
              <li>Business logic inside shared UI components</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "step-8",
    title: "Step 8: Deployment + Release Checklist",
    content: (
      <div className={styles.refBody}>
        <Snippet title="Pre-deploy checklist" code={SNIPPET_MODULE_DEPLOY_CHECKLIST} />
      </div>
    ),
  },
];

function QuickStartTab() {
  return (
    <div className={styles.tabContent}>
      <Accordion items={MODULE_CREATION_STEPS} />
    </div>
  );
}

function QuickStartUiRecipesContent() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [showErr, setShowErr] = useState(false);
  const emailErr = showErr && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  return (
    <div className={styles.refBody}>
      <Snippet title="Import" code={SNIPPET_IMPORT} />
      <Snippet title="Table state" code={SNIPPET_TABLE_STATE} />
      <Snippet title="Table columns" code={SNIPPET_TABLE_COLUMNS} />
      <Snippet title="Table component" code={SNIPPET_TABLE_BASIC} />
      <Snippet title="Actions config" code={SNIPPET_TABLE_ACTIONS} />
      <Snippet title="Table onChange" code={SNIPPET_TABLE_ONCHANGE} />
      <ExampleBlock title="Input + Validation" snippet={SNIPPET_INPUT} snippetTitle="Input usage">
        <div className={styles.formStack}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" isInvalid={emailErr} />
          <Input value="READ-ONLY-001" disabled />
        </div>
        <div className={styles.actionRow}>
          <Button variant="primary" onClick={() => { setShowErr(true); if (!emailErr && email) toastSuccess("Saved.", "Form Demo"); }}>
            Validate
          </Button>
        </div>
      </ExampleBlock>
      <ExampleBlock title="Toast" snippet={SNIPPET_TOAST}>
        <div className={styles.actionRow}>
          <Button variant="primary"   onClick={() => toastSuccess("Done.", "Success")}>Success</Button>
          <Button variant="secondary" onClick={() => toastInfo("FYI.", "Info")}>Info</Button>
          <Button variant="secondary" onClick={() => toastWarning("Check this.", "Warning")}>Warning</Button>
          <Button variant="danger"    onClick={() => toastError("Failed.", "Error")}>Error</Button>
        </div>
      </ExampleBlock>
      <ExampleBlock title="Badge" snippet={SNIPPET_BADGE}>
        <div className={styles.badgeRow}>
          <Badge bg="success">Active</Badge>
          <Badge bg="warning" text="dark">Pending</Badge>
          <Badge bg="secondary">Inactive</Badge>
          <Badge bg="dark">Suspended</Badge>
        </div>
      </ExampleBlock>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Playground tab
// ---------------------------------------------------------------------------

function PlaygroundTab() {
  const [tableState, setTableState] = useState({
    filters: {},
    sorting: { key: "created_at", direction: "desc" },
    pagination: { page: 1, pageSize: 5, total: TABLE_SOURCE_ROWS.length },
    columnVisibility: {},
    columnSizing: {},
  });
  const [lastEvent,      setLastEvent]      = useState({ type: "unknown" });
  const [showTableLog,   setShowTableLog]   = useState(false);
  const [workflowKey,    setWorkflowKey]    = useState("");
  const [pendingWorkflowAction, setPendingWorkflowAction] = useState(null);
  const [tableSearch,    setTableSearch]    = useState("");
  const [inputValue,     setInputValue]     = useState("Jordan Carter");
  const [inputInvalid,   setInputInvalid]   = useState(false);
  const [searchValue,    setSearchValue]    = useState("");
  const [dropdownValue,  setDropdownValue]  = useState(null);
  const [dropdownShow,   setDropdownShow]   = useState(false);
  const [modalOpen,      setModalOpen]      = useState(false);
  const [modalSaving,    setModalSaving]    = useState(false);
  const [toastCount,     setToastCount]     = useState(0);

  const tableColumns = useMemo(() => [
    { key: "employee_code", label: "Code",    sortable: true, width: 130 },
    { key: "full_name",     label: "Name",    sortable: true, width: 180 },
    { key: "team",          label: "Team",    sortable: true, width: 120 },
    {
      key: "status", label: "Status", sortable: true, width: 120,
      render: (row) => {
        const s = getStatusBadge(row.status);
        return <Badge bg={s.bg} text={s.text}>{row.status}</Badge>;
      },
    },
    { key: "created_at", label: "Created", sortable: true, width: 130 },
  ], []);

  const filterConfig = useMemo(() => createFilterConfig([
    { key: "status",     label: "Status",       type: TABLE_FILTER_TYPES.SELECT,    options: STATUS_OPTIONS },
    { key: "created_at", label: "Created Date", type: TABLE_FILTER_TYPES.DATERANGE },
  ]), []);

  const actions = useMemo(() => [
    {
      key: "preview", label: "Preview", type: "primary", icon: "eye",
      onClick: (row) => toastInfo(`Preview: ${row.employee_code}`, "Row Action"),
    },
    {
      key: "edit", label: "Edit", type: "secondary", icon: "pen",
      visible: (row) => row.status === "active",
      onClick: (row) => toastSuccess(`Edit: ${row.full_name}`, "Row Action"),
    },
    {
      key: "deactivate", label: "Deactivate", type: "secondary", icon: "ban",
      visible: (row) => row.status === "active",
      confirm: true,
      confirmMessage: (row) => `Deactivate ${row.full_name}?`,
      onClick: (row) => toastWarning(`Deactivated: ${row.full_name}`, "Row Action"),
    },
  ], []);

  const filteredRows = useMemo(() => {
    const f  = tableState.filters || {};
    const sq = normalizeText(f.search);
    const st = normalizeText(f.status);
    const dr = f.created_at || {};
    const start = parseDateOnly(dr.start);
    const end   = parseDateOnly(dr.end);
    return TABLE_SOURCE_ROWS.filter((row) => {
      if (sq) {
        const hay = [row.employee_code, row.full_name, row.team, row.role, row.status, row.created_at].map(normalizeText).join(" ");
        if (!hay.includes(sq)) return false;
      }
      if (st && normalizeText(row.status) !== st) return false;
      const d = parseDateOnly(row.created_at);
      if (start && d && d < start) return false;
      if (end   && d && d > end)   return false;
      return true;
    });
  }, [tableState.filters]);

  const sortedRows = useMemo(() => {
    const { key: sk, direction: sd } = tableState.sorting || {};
    if (!sk) return filteredRows;
    const dir = sd === "desc" ? -1 : 1;
    return filteredRows.slice().sort((a, b) => {
      if (sk === "created_at") {
        return ((parseDateOnly(a.created_at)?.getTime() || 0) - (parseDateOnly(b.created_at)?.getTime() || 0)) * dir;
      }
      return String(a[sk] || "").localeCompare(String(b[sk] || ""), undefined, { sensitivity: "base", numeric: true }) * dir;
    });
  }, [filteredRows, tableState.sorting]);

  const pageSize  = Math.max(1, Number(tableState.pagination?.pageSize || 5));
  const total     = sortedRows.length;
  const maxPage   = Math.max(1, Math.ceil(total / pageSize));
  const page      = Math.min(Math.max(1, Number(tableState.pagination?.page || 1)), maxPage);
  const tableRows = useMemo(() => sortedRows.slice((page - 1) * pageSize, page * pageSize), [sortedRows, page, pageSize]);
  const tableViewState = useMemo(() => ({
    ...tableState,
    pagination: { ...tableState.pagination, page, pageSize, total },
  }), [tableState, page, pageSize, total]);

  const handleTableChange = useCallback((event) => {
    setLastEvent(event || { type: "unknown" });
    const t = String(event?.type || "").toLowerCase();
    if (t === "search") {
      const v = String(event.value || "").trim();
      setTableState((prev) => ({
        ...prev,
        filters: v ? { ...prev.filters, search: v } : Object.fromEntries(Object.entries(prev.filters).filter(([k]) => k !== "search")),
        pagination: { ...prev.pagination, page: 1 },
      }));
    } else if (t === "filters") {
      setTableState((prev) => ({ ...prev, filters: event.filters || {}, pagination: { ...prev.pagination, page: 1 } }));
    } else if (t === "sorting") {
      setTableState((prev) => ({ ...prev, sorting: event.sorting || {}, pagination: { ...prev.pagination, page: 1 } }));
    } else if (t === "pagination") {
      setTableState((prev) => ({
        ...prev,
        pagination: {
          ...prev.pagination,
          page:     Math.max(1, Number(event.pagination?.page     || 1)),
          pageSize: Math.max(1, Number(event.pagination?.pageSize || pageSize)),
        },
      }));
    } else if (t === "columnvisibility") {
      setTableState((prev) => ({ ...prev, columnVisibility: event.columnVisibility || prev.columnVisibility }));
    } else if (t === "columnresize") {
      setTableState((prev) => ({ ...prev, columnSizing: event.columnSizing || prev.columnSizing }));
    } else if (t === "action") {
      event?.action?.onClick?.(event.row);
    } else if (t === "export") {
      toastInfo(`Export: ${String(event?.format || "csv").toUpperCase()}`, "Export");
    }
  }, [pageSize]);

  const startWorkflowAction = (action) => {
    if (!action) {
      return;
    }

    setWorkflowKey(action.key);
    window.setTimeout(() => { setWorkflowKey(""); toastSuccess(`${action.label} complete.`, "Workflow"); }, 900);
  };

  const runWorkflow = (action) => {
    if (action?.critical) {
      setPendingWorkflowAction(action);
      return;
    }

    startWorkflowAction(action);
  };

  const confirmWorkflowAction = () => {
    const action = pendingWorkflowAction;
    setPendingWorkflowAction(null);
    startWorkflowAction(action);
  };

  const runModalSave = () => {
    setModalSaving(true);
    window.setTimeout(() => { setModalSaving(false); setModalOpen(false); toastSuccess("Saved.", "Modal"); }, 900);
  };

  const playgroundItems = [
    {
      key: "play-workflow",
      title: "Workflow Actions (Buttons)",
      content: (
        <div className={styles.playBody}>
          <p className={styles.playLabel}>Click buttons to trigger actions:</p>
          <div className={styles.toolbarRow}>
            {WORKFLOW_ACTIONS.map((a) => (
              <Button key={a.key} size="sm" variant={toButtonVariantByType(a.type)} loading={workflowKey === a.key} onClick={() => runWorkflow(a)}>
                {a.label}
              </Button>
            ))}
          </div>

          <Modal
            show={Boolean(pendingWorkflowAction)}
            onHide={() => setPendingWorkflowAction(null)}
            title={`Confirm: ${pendingWorkflowAction?.label || "Action"}`}
            footer={(
              <>
                <Button variant="secondary" onClick={() => setPendingWorkflowAction(null)}>
                  Cancel
                </Button>
                <Button variant={toButtonVariantByType(pendingWorkflowAction?.type)} onClick={confirmWorkflowAction}>
                  Yes, {pendingWorkflowAction?.label || "Continue"}
                </Button>
              </>
            )}
          >
            <p style={{ margin: 0, fontSize: 14 }}>
              Continue with {pendingWorkflowAction?.label || "this action"}?
            </p>
          </Modal>
        </div>
      ),
    },
    {
      key: "play-input",
      title: "Input Field",
      content: (
        <div className={styles.playBody}>
          <div className={styles.formStack}>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter text"
              isInvalid={inputInvalid}
            />
            <Button size="sm" onClick={() => setInputInvalid(!inputInvalid)}>
              {inputInvalid ? "Clear Error" : "Show Error"}
            </Button>
          </div>
          <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>Value: <code>{inputValue}</code></p>
        </div>
      ),
    },
    {
      key: "play-searchbar",
      title: "SearchBar (with Debounce)",
      content: (
        <div className={styles.playBody}>
          <SearchBar
            value={searchValue}
            debounceMs={300}
            placeholder="Search with debounce..."
            onDebouncedChange={(v) => {
              setSearchValue(v);
              if (v) toastInfo(`Searching: ${v}`, "Search");
            }}
          />
          <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>Value: <code>{searchValue}</code></p>
        </div>
      ),
    },
    {
      key: "play-dropdown",
      title: "Dropdown (Combo Box)",
      content: (
        <div className={styles.playBody}>
          <p className={styles.playLabel}>Click to open menu:</p>
          <Dropdown show={dropdownShow} onToggle={(show) => setDropdownShow(show)}>
            <Dropdown.Toggle variant="secondary" size="sm">
              {dropdownValue?.label || "Select Status"}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {DEMO_STATUS_OPTIONS.map((item) => (
                <Dropdown.Item
                  key={item.value}
                  onClick={() => {
                    setDropdownValue(item);
                    setDropdownShow(false);
                    toastSuccess(`Selected: ${item.label}`, "Selection");
                  }}
                >
                  {item.label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>Selected: <code>{dropdownValue?.label || "None"}</code></p>
        </div>
      ),
    },
    {
      key: "play-modal",
      title: "Modal Dialog",
      content: (
        <div className={styles.playBody}>
          <Button size="sm" variant="secondary" onClick={() => setModalOpen(true)}>Open Modal</Button>
          <Modal
            show={modalOpen}
            onHide={() => setModalOpen(false)}
            title="Confirm Change"
            footer={
              <>
                <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button variant="primary" loading={modalSaving} onClick={runModalSave}>Save</Button>
              </>
            }
          >
            <p style={{ margin: 0, fontSize: 14 }}>Shared modal with footer actions.</p>
          </Modal>
        </div>
      ),
    },
    {
      key: "play-table",
      title: "Data Table (with Filters & Actions)",
      content: (
        <div className={styles.playBody}>
          <TableZ
            data={tableRows}
            columns={tableColumns}
            state={tableViewState}
            filterConfig={filterConfig}
            actions={actions}
            loading={false}
            pageSizeOptions={[5, 10, 20]}
            searchPlaceholder="Search code, name, team, role, status"
            onChange={handleTableChange}
          />
          <div className={styles.eventLogWrap} style={{ marginTop: 16 }}>
            <button type="button" className={styles.eventLogToggle} onClick={() => setShowTableLog((v) => !v)}>
              <FontAwesomeIcon icon={showTableLog ? faChevronUp : faChevronDown} aria-hidden="true" />
              {showTableLog ? "Hide" : "Show"} table events
            </button>
            {showTableLog ? <pre className={styles.eventPre}>{JSON.stringify(lastEvent, null, 2)}</pre> : null}
          </div>
        </div>
      ),
    },
    {
      key: "play-badges",
      title: "Badges (Status Display)",
      content: (
        <div className={styles.playBody}>
          <div className={styles.badgeRow}>
            <Badge bg="success">Active</Badge>
            <Badge bg="warning" text="dark">Pending</Badge>
            <Badge bg="secondary">Inactive</Badge>
            <Badge bg="dark">Suspended</Badge>
          </div>
        </div>
      ),
    },
    {
      key: "play-toast",
      title: "Toast Notifications",
      content: (
        <div className={styles.playBody}>
          <div className={styles.actionRow}>
            <Button size="sm" onClick={() => { setToastCount(c => c + 1); toastSuccess("Success message!", "Success"); }}>Success</Button>
            <Button size="sm" variant="secondary" onClick={() => { setToastCount(c => c + 1); toastInfo("Info message!", "Info"); }}>Info</Button>
            <Button size="sm" variant="secondary" onClick={() => { setToastCount(c => c + 1); toastWarning("Warning message!", "Warning"); }}>Warning</Button>
            <Button size="sm" variant="danger" onClick={() => { setToastCount(c => c + 1); toastError("Error message!", "Error"); }}>Error</Button>
          </div>
          <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>Toasts shown: {toastCount}</p>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.tabContent}>
      <Accordion items={playgroundItems} />
      <div className={styles.bonusSection}>
        <p className={styles.bonusSectionLabel}>Bonus Playground</p>
        <p className={styles.bonusSectionSub}>Extended scenarios beyond the basics.</p>
        <Accordion items={[
          { key: "bonus-workflow", title: "Workflow Actions with Modal Confirmation", content: <BonusWorkflowModal /> },
          { key: "bonus-table",    title: "Real-World Table Scenario (Employee Review)", content: <BonusRealWorldTable /> },
          { key: "bonus-form",     title: "Add User Form", content: <BonusAddUserForm /> },
        ]} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bonus Playground components
// ---------------------------------------------------------------------------

const TEAM_OPTIONS = [
  { label: "Platform",   value: "platform"   },
  { label: "Risk",       value: "risk"       },
  { label: "Operations", value: "operations" },
  { label: "Finance",    value: "finance"    },
  { label: "Support",    value: "support"    },
  { label: "Audit",      value: "audit"      },
];

const ROLE_OPTIONS = [
  { label: "Admin",   value: "admin"   },
  { label: "Manager", value: "manager" },
  { label: "Analyst", value: "analyst" },
  { label: "Viewer",  value: "viewer"  },
];

const FORM_TEAM_OPTIONS = TEAM_OPTIONS.length > 0
  ? TEAM_OPTIONS
  : [
      { label: "Platform", value: "platform" },
      { label: "Operations", value: "operations" },
      { label: "Risk", value: "risk" },
    ];

const FORM_ROLE_OPTIONS = ROLE_OPTIONS.length > 0
  ? ROLE_OPTIONS
  : [
      { label: "Admin", value: "admin" },
      { label: "Manager", value: "manager" },
      { label: "Viewer", value: "viewer" },
    ];

const FORM_STATUS_OPTIONS = DEMO_STATUS_OPTIONS.length > 0
  ? DEMO_STATUS_OPTIONS
  : [
      { label: "Active", value: "active" },
      { label: "Pending", value: "pending" },
      { label: "Inactive", value: "inactive" },
    ];

const BONUS_WORKFLOW_ACTIONS = [
  { key: "reject",  label: "Reject",  variant: "danger",    message: "This will reject the selected record and notify the submitter." },
  { key: "return",  label: "Return",  variant: "warning",   message: "This will return the record to the submitter for corrections." },
  { key: "recall",  label: "Recall",  variant: "secondary", message: "This will recall the record and place it back in draft state." },
  { key: "void",    label: "Void",    variant: "danger",    message: "This permanently voids the record. This action cannot be undone." },
];

function BonusWorkflowModal() {
  const [pending,  setPending]  = useState(null); // action being confirmed
  const [loading,  setLoading]  = useState(false);

  const handleConfirm = () => {
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setPending(null);
      toastSuccess(`${pending.label} completed successfully.`, pending.label);
    }, 900);
  };

  return (
    <div className={styles.playBody}>
      <p className={styles.playLabel}>
        Critical workflow actions USE shared modal confirmation instead of browser-native prompts.
        Developers remain free to define what happens on click - this is just a pattern example.
      </p>
      <div className={styles.toolbarRow}>
        {BONUS_WORKFLOW_ACTIONS.map((a) => (
          <Button key={a.key} size="sm" variant={a.variant} onClick={() => setPending(a)}>
            {a.label}
          </Button>
        ))}
      </div>

      <Modal
        show={!!pending}
        onHide={() => setPending(null)}
        title={`Confirm: ${pending?.label || ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
            <Button variant={pending?.variant || "primary"} loading={loading} onClick={handleConfirm}>
              Yes, {pending?.label}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 14 }}>{pending?.message}</p>
      </Modal>
    </div>
  );
}

const REVIEW_SOURCE_ROWS = [
  { id: 1, employee_code: "EMP-1101", full_name: "Avery Nguyen",  team: "Platform",   role: "admin",   status: "pending",  submitted_at: "2026-04-10" },
  { id: 2, employee_code: "EMP-1102", full_name: "Jordan Patel",  team: "Risk",       role: "manager", status: "pending",  submitted_at: "2026-04-09" },
  { id: 3, employee_code: "EMP-1103", full_name: "Riley Walker",  team: "Operations", role: "analyst", status: "pending",  submitted_at: "2026-04-08" },
  { id: 4, employee_code: "EMP-1104", full_name: "Morgan Torres", team: "Finance",    role: "viewer",  status: "approved", submitted_at: "2026-04-07" },
  { id: 5, employee_code: "EMP-1105", full_name: "Taylor Lopez",  team: "Support",    role: "manager", status: "rejected", submitted_at: "2026-04-06" },
];

function BonusRealWorldTable() {
  const [rows,       setRows]       = useState(REVIEW_SOURCE_ROWS);
  const [tableState, setTableState] = useState({
    filters: {},
    sorting: { key: "submitted_at", direction: "desc" },
    pagination: { page: 1, pageSize: 5, total: REVIEW_SOURCE_ROWS.length },
    columnVisibility: {},
    columnSizing: {},
  });
  const [confirm, setConfirm]   = useState(null); // { action, row }
  const [saving,  setSaving]    = useState(false);

  const columns = useMemo(() => [
    { key: "employee_code", label: "Code",      sortable: true, width: 120 },
    { key: "full_name",     label: "Name",      sortable: true, width: 180 },
    { key: "team",          label: "Team",      sortable: true, width: 120 },
    { key: "role",          label: "Role",      sortable: true, width: 110 },
    {
      key: "status", label: "Status", sortable: true, width: 120,
      render: (row) => {
        const map = { pending: { bg: "warning", text: "dark" }, approved: { bg: "success" }, rejected: { bg: "danger" } };
        const s = map[row.status] || { bg: "secondary" };
        return <Badge bg={s.bg} text={s.text}>{row.status}</Badge>;
      },
    },
    { key: "submitted_at", label: "Submitted", sortable: true, width: 130 },
  ], []);

  const filterConfig = useMemo(() => createFilterConfig([
    { key: "status", label: "Status", type: TABLE_FILTER_TYPES.SELECT, options: [
      { label: "Pending",  value: "pending"  },
      { label: "Approved", value: "approved" },
      { label: "Rejected", value: "rejected" },
    ]},
  ]), []);

  const actions = useMemo(() => [
    {
      key: "approve", label: "Approve", type: "primary", icon: "check-circle",
      visible: (row) => row.status === "pending",
      onClick: (row) => setConfirm({ action: "approve", row }),
    },
    {
      key: "reject", label: "Reject", type: "danger", icon: "trash",
      visible: (row) => row.status === "pending",
      onClick: (row) => setConfirm({ action: "reject", row }),
    },
  ], []);

  const handleTableChange = useCallback((event) => {
    const t = String(event?.type || "").toLowerCase();
    if (t === "filters") {
      setTableState((prev) => ({ ...prev, filters: event.filters || {}, pagination: { ...prev.pagination, page: 1 } }));
    } else if (t === "sorting") {
      setTableState((prev) => ({ ...prev, sorting: event.sorting || {} }));
    } else if (t === "pagination") {
      setTableState((prev) => ({ ...prev, pagination: { ...prev.pagination, page: Number(event.pagination?.page || 1), pageSize: Number(event.pagination?.pageSize || 5) } }));
    } else if (t === "action") {
      event?.action?.onClick?.(event.row);
    }
  }, []);

  const filteredRows = useMemo(() => {
    const st = tableState.filters?.status;
    return st ? rows.filter((r) => r.status === st) : rows;
  }, [rows, tableState.filters]);

  const pageSize = Number(tableState.pagination?.pageSize || 5);
  const page     = Number(tableState.pagination?.page || 1);
  const tableViewState = useMemo(() => ({
    ...tableState,
    pagination: { ...tableState.pagination, page, pageSize, total: filteredRows.length },
  }), [tableState, page, pageSize, filteredRows.length]);
  const tableRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page, pageSize]);

  const handleConfirmAction = () => {
    setSaving(true);
    window.setTimeout(() => {
      const newStatus = confirm.action === "approve" ? "approved" : "rejected";
      setRows((prev) => prev.map((r) => r.id === confirm.row.id ? { ...r, status: newStatus } : r));
      setSaving(false);
      setConfirm(null);
      if (confirm.action === "approve") toastSuccess(`${confirm.row.full_name} approved.`, "Review");
      else toastError(`${confirm.row.full_name} rejected.`, "Review");
    }, 800);
  };

  return (
    <div className={styles.playBody}>
      <p className={styles.playLabel}>Employee access requests awaiting review. Approve or reject from row actions.</p>
      <TableZ
        data={tableRows}
        columns={columns}
        state={tableViewState}
        filterConfig={filterConfig}
        actions={actions}
        loading={false}
        pageSizeOptions={[5, 10]}
        searchPlaceholder="Search employees..."
        onChange={handleTableChange}
      />
      <Modal
        show={!!confirm}
        onHide={() => setConfirm(null)}
        title={confirm?.action === "approve" ? "Approve Access" : "Reject Access"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant={confirm?.action === "approve" ? "primary" : "danger"}
              loading={saving}
              onClick={handleConfirmAction}
            >
              {confirm?.action === "approve" ? "Yes, Approve" : "Yes, Reject"}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 14 }}>
          {confirm?.action === "approve"
            ? `Grant system access to ${confirm?.row?.full_name}?`
            : `Reject access request from ${confirm?.row?.full_name}? They will be notified.`}
        </p>
      </Modal>
    </div>
  );
}

const EMPTY_FORM = { full_name: "", email: "", team: null, role: null, status: null };

function BonusAddUserForm() {
  const [form,    setForm]    = useState(EMPTY_FORM);
  const [touched, setTouched] = useState({});
  const [saving,  setSaving]  = useState(false);

  const errors = {
    full_name: !form.full_name.trim()                           ? "Name is required." : null,
    email:     !form.email.trim()                               ? "Email is required."
             : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) ? "Enter a valid email." : null,
    team:      !form.team   ? "Team is required."   : null,
    role:      !form.role   ? "Role is required."   : null,
    status:    !form.status ? "Status is required." : null,
  };
  const isValid = Object.values(errors).every((e) => !e);

  const set = (field, val) => setForm((prev) => ({ ...prev, [field]: val }));
  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = () => {
    setTouched({ full_name: true, email: true, team: true, role: true, status: true });
    if (!isValid) { toastError("Please fix the errors before submitting.", "Validation"); return; }
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setForm(EMPTY_FORM);
      setTouched({});
      toastSuccess(`User "${form.full_name}" added successfully.`, "Add User");
    }, 900);
  };

  return (
    <div className={styles.playBody}>
      <p className={styles.playLabel}>Realistic Add User form built entirely with shared components.</p>
      <div className={styles.addUserGrid}>

        <div className={styles.addUserField}>
          <label className={styles.fieldLabel}>Full Name <span className={styles.fieldRequired}>*</span></label>
          <Input
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            onBlur={() => touch("full_name")}
            placeholder="e.g. Jordan Patel"
            isInvalid={!!(touched.full_name && errors.full_name)}
          />
          {touched.full_name && errors.full_name && <p className={styles.fieldError}>{errors.full_name}</p>}
        </div>

        <div className={styles.addUserField}>
          <label className={styles.fieldLabel}>Email <span className={styles.fieldRequired}>*</span></label>
          <Input
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            onBlur={() => touch("email")}
            placeholder="e.g. jordan@psbuniverse.local"
            isInvalid={!!(touched.email && errors.email)}
          />
          {touched.email && errors.email && <p className={styles.fieldError}>{errors.email}</p>}
        </div>

        <div className={styles.addUserField}>
          <label className={styles.fieldLabel}>Team <span className={styles.fieldRequired}>*</span></label>
          <Dropdown drop="up">
            <Dropdown.Toggle
              variant={touched.team && errors.team ? "danger" : "secondary"}
              size="sm"
              style={{ width: "100%", textAlign: "left" }}
            >
              {form.team?.label || "Select Team"}
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ width: "100%" }}>
              {FORM_TEAM_OPTIONS.map((o) => (
                <Dropdown.Item key={o.value} onClick={() => { set("team", o); touch("team"); }}>
                  {o.label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          {touched.team && errors.team && <p className={styles.fieldError}>{errors.team}</p>}
        </div>

        <div className={styles.addUserField}>
          <label className={styles.fieldLabel}>Role <span className={styles.fieldRequired}>*</span></label>
          <Dropdown drop="up">
            <Dropdown.Toggle
              variant={touched.role && errors.role ? "danger" : "secondary"}
              size="sm"
              style={{ width: "100%", textAlign: "left" }}
            >
              {form.role?.label || "Select Role"}
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ width: "100%" }}>
              {FORM_ROLE_OPTIONS.map((o) => (
                <Dropdown.Item key={o.value} onClick={() => { set("role", o); touch("role"); }}>
                  {o.label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          {touched.role && errors.role && <p className={styles.fieldError}>{errors.role}</p>}
        </div>

        <div className={styles.addUserField}>
          <label className={styles.fieldLabel}>Status <span className={styles.fieldRequired}>*</span></label>
          <Dropdown drop="up">
            <Dropdown.Toggle
              variant={touched.status && errors.status ? "danger" : "secondary"}
              size="sm"
              style={{ width: "100%", textAlign: "left" }}
            >
              {form.status?.label || "Select Status"}
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ width: "100%" }}>
              {FORM_STATUS_OPTIONS.map((o) => (
                <Dropdown.Item key={o.value} onClick={() => { set("status", o); touch("status"); }}>
                  {o.label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          {touched.status && errors.status && <p className={styles.fieldError}>{errors.status}</p>}
        </div>

      </div>
      <div className={styles.addUserActions}>
        <Button variant="secondary" onClick={() => { setForm(EMPTY_FORM); setTouched({}); }}>Reset</Button>
        <Button variant="primary" loading={saving} onClick={handleSubmit}>Add User</Button>
      </div>
    </div>
  );
}

// Reference tab components
function InputRefContent() {
  const [mode, setMode] = useState("basic");
  return (
    <div className={styles.refBody}>
      <div className={styles.propGrid}>
        <RefPropRow prop="value"      required type="string"   desc="Controlled value." />
        <RefPropRow prop="onChange"   required type="function" desc="(event) => void" />
        <RefPropRow prop="placeholder"         type="string"   desc="Hint text." />
        <RefPropRow prop="isInvalid"            type="boolean"  desc="Red border for validation errors." />
        <RefPropRow prop="disabled"             type="boolean"  desc="Prevents interaction." />
      </div>
      <PatternToggle
        modes={[
          { id: "basic", label: "Basic" },
          { id: "validation", label: "Validation" },
        ]}
        active={mode}
        onChange={setMode}
      />
      {mode === "basic" && <Snippet title="Basic input" code={SNIPPET_INPUT} />}
      {mode === "validation" && <Snippet title="With validation" code={SNIPPET_INPUT_VALIDATION} />}
    </div>
  );
}

function SearchBarRefContent() {
  const [mode, setMode] = useState("basic");
  return (
    <div className={styles.refBody}>
      <div className={styles.propGrid}>
        <RefPropRow prop="value"             required type="string"   desc="Controlled search value." />
        <RefPropRow prop="onDebouncedChange" required type="function" desc="Fired after debounce with the new value." />
        <RefPropRow prop="debounceMs"                 type="number"   desc="Debounce delay in ms. Default 350." />
        <RefPropRow prop="placeholder"                type="string"   desc="Hint text." />
      </div>
      <PatternToggle
        modes={[
          { id: "basic", label: "Basic" },
          { id: "api", label: "With API" },
        ]}
        active={mode}
        onChange={setMode}
      />
      {mode === "basic" && <Snippet title="Basic search" code={SNIPPET_SEARCHBAR} />}
      {mode === "api" && <Snippet title="With API reload" code={SNIPPET_SEARCHBAR_WITH_API} />}
    </div>
  );
}

function ModalRefContent() {
  const [mode, setMode] = useState("basic");
  return (
    <div className={styles.refBody}>
      <div className={styles.propGrid}>
        <RefPropRow prop="show"   required type="boolean"    desc="Controls visibility." />
        <RefPropRow prop="onHide" required type="function"   desc="Called on backdrop/close click." />
        <RefPropRow prop="title"  required type="string"     desc="Header text." />
        <RefPropRow prop="footer"          type="ReactNode"  desc="Footer slot - put Cancel + Save here." />
      </div>
      <PatternToggle
        modes={[
          { id: "basic", label: "Basic" },
          { id: "saveflow", label: "Save Flow" },
        ]}
        active={mode}
        onChange={setMode}
      />
      {mode === "basic" && <Snippet title="Basic modal" code={SNIPPET_MODAL} />}
      {mode === "saveflow" && <Snippet title="With save flow" code={SNIPPET_MODAL_SAVE_FLOW} />}
    </div>
  );
}

function ReferenceTab() {
  const accordionItems = [
    {
      key: "ref-quickstart-recipes",
      title: "Quick Start UI Recipes (Moved From Quick Start Tab)",
      content: <QuickStartUiRecipesContent />,
    },
    {
      key: "ref-table",
      title: "Table",
      content: (
        <div className={styles.refBody}>
          <p className={styles.stepNote}>
            The shared Table component is a fully-featured data grid with sorting, filtering, pagination,
            column visibility, drag-to-reorder, row actions, and CSV/Excel export.
            It uses a single <code>onChange</code> event channel for all interactions.
          </p>
          <p className={styles.ruleHeading}>Props Reference</p>
          <div className={styles.propGrid}>
            <RefPropRow prop="data"              required type="Array&lt;object&gt;"  desc="Rows for the current page." />
            <RefPropRow prop="columns"           required type="Array&lt;column&gt;"  desc="key, label, sortable, width, render, defaultVisible." />
            <RefPropRow prop="state"             required type="object"               desc="filters, sorting, pagination, columnVisibility, columnSizing." />
            <RefPropRow prop="filterConfig"      required type="Array&lt;filter&gt;"  desc="Built with createFilterConfig + TABLE_FILTER_TYPES." />
            <RefPropRow prop="actions"           required type="Array&lt;action&gt;"  desc="Row actions. Empty array hides ActionColumn." />
            <RefPropRow prop="onChange"          required type="function"              desc="Single event channel for all table interactions." />
            <RefPropRow prop="loading"           required type="boolean"              desc="Shows loading state in the table body." />
            <RefPropRow prop="rowIdKey"                   type="string"               desc="Unique row identifier key (e.g. 'card_id'). Required for drag-to-reorder." />
            <RefPropRow prop="draggable"                  type="boolean"              desc="Enable drag-to-reorder rows." />
            <RefPropRow prop="onReorder"                  type="function"             desc="(reorderedRows) => void. Called after drag completes." />
            <RefPropRow prop="pageSizeOptions"            type="number[]"             desc="e.g. [10, 20, 50]" />
            <RefPropRow prop="exportFormats"              type="string[]"             desc='["csv"] or ["csv","excel"]' />
            <RefPropRow prop="searchPlaceholder"          type="string"               desc="Search bar hint text." />
            <RefPropRow prop="emptyMessage"               type="string"               desc="Message shown when data is empty." />
          </div>

          <hr style={{ margin: "2rem 0", borderColor: "#ddd" }} />
          <p className={styles.ruleHeading}>How to Databind Table (End-to-End: Database ? API ? Frontend)</p>
          <p className={styles.stepNote}>
            This is the <strong>complete flow</strong> for binding a Supabase database table to the shared Table component.
            Real example from: Card Module Setup (table: <code>psb_s_appcard</code>).
          </p>
          <Snippet title="Full Data Binding Flow (DB ? API ? Frontend ? Table)" code={SNIPPET_TABLE_DATABIND} />

          <hr style={{ margin: "2rem 0", borderColor: "#ddd" }} />
          <p className={styles.ruleHeading}>Column Configuration</p>
          <p className={styles.stepNote}>
            Columns map to database fields. Each column defines how a field is displayed in the table.
          </p>
          <Snippet title="Real column config (from Card Module Setup)" code={SNIPPET_TABLE_COLUMNS} />

          <hr style={{ margin: "2rem 0", borderColor: "#ddd" }} />
          <p className={styles.ruleHeading}>Row Actions</p>
          <p className={styles.stepNote}>
            Actions appear as a dropdown in the leftmost column. Each action can be conditionally visible/disabled.
          </p>
          <Snippet title="Real actions config (from Card Module Setup)" code={SNIPPET_TABLE_ACTIONS} />

          <hr style={{ margin: "2rem 0", borderColor: "#ddd" }} />
          <p className={styles.ruleHeading}>onChange Event Handler</p>
          <p className={styles.stepNote}>
            Every table interaction flows through one callback. Switch on <code>event.type</code>.
          </p>
          <Snippet title="onChange handler (all event types)" code={SNIPPET_TABLE_ONCHANGE} />

          <hr style={{ margin: "2rem 0", borderColor: "#ddd" }} />
          <p className={styles.ruleHeading}>Filter Configuration</p>
          <Snippet title="Hardcoded filters (fixed options)" code={SNIPPET_TABLE_FILTERS_HARDCODE} />
          <Snippet title="Databind filters from API (dynamic options)" code={SNIPPET_TABLE_FILTERS_DATABIND} />

          <hr style={{ margin: "2rem 0", borderColor: "#ddd" }} />
          <p className={styles.ruleHeading}>Table State</p>
          <p className={styles.stepNote}>
            The table is controlled. Your module owns the state object and updates it via onChange.
          </p>
          <Snippet title="Table state structure" code={SNIPPET_TABLE_STATE} />
        </div>
      ),
    },
    {
      key: "ref-button",
      title: "Button",
      content: (
        <div className={styles.refBody}>
          <p className={styles.stepNote}>
            Shared button with variant-based styling, loading spinner, and disabled state.
            Used for: save/cancel actions, toolbar buttons, modal footers.
          </p>
          <div className={styles.propGrid}>
            <RefPropRow prop="variant"  required type="string"   desc="primary | secondary | danger | ghost" />
            <RefPropRow prop="onClick"  required type="function" desc="Click handler." />
            <RefPropRow prop="loading"           type="boolean"  desc="Spinner + disables interaction." />
            <RefPropRow prop="disabled"          type="boolean"  desc="Prevents interaction." />
            <RefPropRow prop="size"              type="string"   desc="sm | md (default)" />
          </div>
          <Snippet title="Button usage (real examples from Card Module Setup)" code={SNIPPET_BUTTON} />
        </div>
      ),
    },
    {
      key: "ref-input",
      title: "Input",
      content: <InputRefContent />,
    },
    {
      key: "ref-searchbar",
      title: "SearchBar",
      content: <SearchBarRefContent />,
    },
    {
      key: "ref-dropdown",
      title: "Dropdown (combo box)",
      content: (
        <div className={styles.refBody}>
          <p className={styles.stepNote}>
            Dropdown wraps Bootstrap&apos;s Dropdown for menus and combo box selectors.
            Used for: action menus, application selectors, form field selectors.
          </p>
          <div className={styles.propGrid}>
            <RefPropRow prop="children" required type="ReactNode"  desc="Must contain Dropdown.Toggle + Dropdown.Menu." />
            <RefPropRow prop="show"              type="boolean"    desc="Controlled visibility. Omit for uncontrolled." />
            <RefPropRow prop="onToggle"          type="function"   desc="(show: boolean) => void. Called when visibility changes." />
            <RefPropRow prop="drop"              type="string"     desc="'up' | 'down' | 'start' | 'end'. Menu direction." />
          </div>
          <Snippet title="Basic dropdown (static items)" code={SNIPPET_DROPDOWN_BASIC} />
          <Snippet title="Databind from API (real example: Application Selector)" code={SNIPPET_DROPDOWN_DATABIND} />
          <Snippet title="Hardcoded combo items" code={SNIPPET_DROPDOWN_HARDCODE} />
        </div>
      ),
    },
    {
      key: "ref-modal",
      title: "Modal",
      content: <ModalRefContent />,
    },
    {
      key: "ref-badge",
      title: "Badge",
      content: (
        <div className={styles.refBody}>
          <p className={styles.stepNote}>
            Badge renders a small colored label. Commonly used inside table column renderers
            to display status (active/inactive/pending) with visual distinction.
          </p>
          <div className={styles.propGrid}>
            <RefPropRow prop="bg"       required type="string"    desc="success | warning | secondary | danger | dark | primary | info" />
            <RefPropRow prop="text"              type="string"    desc="'light' | 'dark'. Text color for contrast." />
            <RefPropRow prop="children" required type="ReactNode" desc="Label text." />
          </div>
          <div className={styles.badgeRow}>
            <Badge bg="success">Active</Badge>
            <Badge bg="warning" text="dark">Pending</Badge>
            <Badge bg="secondary">Inactive</Badge>
            <Badge bg="dark">Suspended</Badge>
          </div>
          <Snippet title="Badge in table column renderer (real examples)" code={SNIPPET_BADGE} />
        </div>
      ),
    },
    {
      key: "ref-toast",
      title: "Toast",
      content: (
        <div className={styles.refBody}>
          <p className={styles.stepNote}>
            Toast fires a temporary notification in the top-right corner.
            <code>GlobalToastHost</code> is mounted once in the app layout — never add it again.
            Just call the function from anywhere.
          </p>
          <div className={styles.propGrid}>
            <RefPropRow prop="message"  required type="string" desc="Notification text." />
            <RefPropRow prop="title"             type="string" desc="Optional header for the toast." />
          </div>
          <div className={styles.actionRow}>
            <Button size="sm" variant="primary"   onClick={() => toastSuccess("Done.", "Success")}>Success</Button>
            <Button size="sm" variant="secondary" onClick={() => toastInfo("FYI.", "Info")}>Info</Button>
            <Button size="sm" variant="secondary" onClick={() => toastWarning("Check.", "Warning")}>Warning</Button>
            <Button size="sm" variant="danger"    onClick={() => toastError("Failed.", "Error")}>Error</Button>
          </div>
          <Snippet title="Toast usage (real examples from Card Module Setup)" code={SNIPPET_TOAST} />
        </div>
      ),
    },
    {
      key: "ref-card",
      title: "Card (surface container)",
      content: (
        <div className={styles.refBody}>
          <p className={styles.stepNote}>
            Card wraps content sections with an optional title, subtitle, and toolbar area.
            Used on every setup page to frame tables and form sections.
          </p>
          <div className={styles.propGrid}>
            <RefPropRow prop="title"    type="string"    desc="Card header text." />
            <RefPropRow prop="subtitle" type="string"    desc="Smaller text below title." />
            <RefPropRow prop="toolbar"  type="ReactNode" desc="Right-aligned header content (buttons)." />
            <RefPropRow prop="children" required type="ReactNode" desc="Card body content." />
          </div>
          <Snippet title="Card usage (real example from Card Module Setup)" code={SNIPPET_CARD_SURFACE} />
        </div>
      ),
    },
    {
      key: "ref-inline-edit",
      title: "InlineEditCell",
      content: (
        <div className={styles.refBody}>
          <p className={styles.stepNote}>
            InlineEditCell makes a table cell clickable and editable. When enabled, users can click the cell text
            to turn it into an input field, type a new value, and press Enter to confirm. Used for inline row editing
            across all admin modules (Application Setup, Card Module Setup, etc.).
          </p>
          <div className={styles.propGrid}>
            <RefPropRow prop="value"       required type="string | number" desc="Current value to display in the cell." />
            <RefPropRow prop="onCommit"    required type="function"        desc="(newValue) => void. Called when editing completes (Enter or blur)." />
            <RefPropRow prop="disabled"             type="boolean"         desc="When true, cell is read-only. Default: false" />
            <RefPropRow prop="placeholder"          type="string"          desc="Text shown when value is empty. Default: '--'" />
            <RefPropRow prop="type"                 type="string"          desc="Input type: 'text' | 'number'. Default: 'text'" />
          </div>
          <Snippet title="InlineEditCell usage (real example from Application Setup)" code={`import { InlineEditCell } from "@/shared/components/ui";

// In a TableZ column renderer:
{
  key: "app_name",
  label: "Application Name",
  render: (row) => (
    <InlineEditCell
      value={row?.app_name || ""}
      onCommit={(val) => handleInlineEdit(row, "app_name", val)}
      disabled={String(row?.app_id) !== String(editingAppId)}
    />
  ),
}

// The cell shows as normal text when disabled.
// When enabled (row is in edit mode), it shows a dashed underline.
// Click it to type. Press Enter or click away to confirm.`} />
        </div>
      ),
    },
    {
      key: "ref-rules",
      title: "Rules",
      content: (
        <div className={styles.refBody}>
          <div className={styles.ruleGrid}>
            <div className={styles.ruleCol}>
              <p className={styles.ruleHeading}>DO</p>
              <ul className={styles.ruleList}>
                <li>Import from <code>@/shared/components/ui</code> only.</li>
                <li>Keep all logic in module/controller files.</li>
                <li>Drive behavior through config and props.</li>
                <li>Event flow: UI ? module state ? API ? re-render.</li>
                <li>Own <code>state</code> in your module, not in shared components.</li>
              </ul>
            </div>
            <div className={styles.ruleCol}>
              <p className={styles.ruleHeading}>DO NOT</p>
              <ul className={styles.ruleList}>
                <li>Override shared styles inside module files.</li>
                <li>Create duplicate custom component versions.</li>
                <li>Place API calls or business rules inside shared UI.</li>
                <li>Use reserved key <code>__psb_action_column__</code>.</li>
                <li>Pass actions without <code>key</code>, <code>label</code>, and <code>onClick</code>.</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "ref-tokens",
      title: "Tokens",
      content: (
        <div className={styles.refBody}>
          <Snippet title="Design tokens" code={SNIPPET_TOKENS} />
        </div>
      ),
    },
  ];

  return (
    <div className={styles.tabContent}>
      <div className={styles.refLayout}>
        <nav className={styles.refNav} aria-label="Reference navigation">
          <div className={styles.refNavGroup}>
            <p className={styles.refNavGroupLabel}>GET STARTED</p>
            <span className={styles.refNavItem}>Quick Start</span>
          </div>
          <div className={styles.refNavGroup}>
            <p className={styles.refNavGroupLabel}>BUILDING</p>
            <span className={styles.refNavItem}>Table</span>
            <span className={styles.refNavItem}>Forms</span>
            <span className={styles.refNavItem}>Actions</span>
            <span className={styles.refNavItem}>Feedback</span>
          </div>
          <div className={styles.refNavGroup}>
            <p className={styles.refNavGroupLabel}>PLAYGROUND</p>
            <span className={styles.refNavItem}>Live Demo</span>
          </div>
          <div className={styles.refNavGroup}>
            <p className={styles.refNavGroupLabel}>REFERENCE</p>
            <span className={styles.refNavItem}>Components</span>
            <span className={styles.refNavItem}>Rules</span>
            <span className={styles.refNavItem}>Tokens</span>
          </div>
        </nav>

        <div className={styles.refDocs}>
          <Accordion items={accordionItems} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TableX Tab — The Easy Table (for jr devs)
// ---------------------------------------------------------------------------

const TABLEX_SNIPPET_BASIC = `import { TableX } from "@/shared/components/ui";

// That's it. Just tell it which table and which columns.
// It fetches the data, sorts, filters, paginates — all automatic.

<TableX
  source="psb_s_user"
  columns={["user_id", "first_name", "last_name", "email"]}
/>`;

const TABLEX_SNIPPET_COLUMNS_STRING = `// SIMPLE WAY: just list the column names as strings
// Labels are created automatically: "first_name" becomes "First Name"

<TableX
  source="psb_s_user"
  columns={["user_id", "first_name", "last_name", "email"]}
/>`;

const TABLEX_SNIPPET_COLUMNS_OBJECT = `// ADVANCED WAY: use objects when you need custom labels or rendering

<TableX
  source="psb_s_user"
  columns={[
    "user_id",
    "first_name",
    { key: "status", label: "User Status", sortable: true },
    {
      key: "is_active",
      label: "Active",
      render: (row) => (
        <Badge bg={row.is_active ? "success" : "secondary"}>
          {row.is_active ? "Yes" : "No"}
        </Badge>
      ),
    },
  ]}
/>

// You can mix strings and objects in the same array!`;

const TABLEX_SNIPPET_FILTERS = `// Filters let users narrow down the table rows.
// Each filter needs: key, type
// For "select" filters, also add: source, display

const userFilters = [
  // SELECT filter — dropdown loaded from another table
  {
    key: "status_id",         // column in your table to filter on
    type: "select",           // makes a dropdown
    source: "psb_s_status",   // which table to load options from
    display: "sts_name",      // which column to show as the label
  },

  // TEXT filter — free text search on that column
  {
    key: "email",
    type: "text",
  },

  // DATERANGE filter — pick a start and end date
  {
    key: "created_at",
    type: "daterange",
    label: "Created Date",    // optional custom label
  },
];

<TableX
  source="psb_s_user"
  columns={["user_id", "first_name", "email", "status_id", "created_at"]}
  filters={userFilters}
/>`;

const TABLEX_SNIPPET_ACTIONS = `// Actions show buttons on each row (Edit, Delete, etc.)
// Each action needs: key, label, type, onClick

const userActions = [
  {
    key: "edit",
    label: "Edit",
    type: "primary",            // blue button
    icon: "pen",               // Font Awesome icon name
    onClick: (row) => {
      console.log("Edit user:", row);
    },
  },
  {
    key: "deactivate",
    label: "Deactivate",
    type: "secondary",          // amber button
    icon: "ban",                // ban icon (soft delete)
    confirm: true,              // shows "Are you sure?" popup
    confirmMessage: (row) => \`Deactivate \${row.first_name}?\`,
    onClick: (row) => {
      console.log("Deactivate user:", row);
    },
  },
];

<TableX
  source="psb_s_user"
  columns={["user_id", "first_name", "last_name"]}
  actions={userActions}
/>

// Action types:
//   "primary"   ? blue button  (for: Edit, View, Preview)
//   "secondary" ? gray button  (for: Duplicate, Export)
//   "danger"    ? red button   (for: Delete, Deactivate)`;

const TABLEX_SNIPPET_FEATURES = `// Features let you turn table powers on or off.
// By default, everything is ON except drag and batch.

const userFeatures = {
  sorting: true,      // click column header to sort (ON by default)
  filtering: true,    // show filter bar (ON by default)
  pagination: true,   // show page controls (ON by default)
  resizing: true,     // drag to resize columns (ON by default)
  drag: false,        // drag rows to reorder (OFF by default)
  batch: false,       // batch edit mode (OFF by default)
};

<TableX
  source="psb_s_user"
  columns={["user_id", "first_name"]}
  features={userFeatures}
/>

// Want a read-only table? Just turn everything off:
<TableX
  source="psb_s_user"
  columns={["user_id", "first_name"]}
  features={{ sorting: false, filtering: false }}
/>`;

const TABLEX_SNIPPET_FULL = `import { TableX } from "@/shared/components/ui";

// FULL EXAMPLE — everything together

const userFilters = [
  { key: "status_id", type: "select", source: "psb_s_status", display: "sts_name" },
  { key: "created_at", type: "daterange", label: "Created Date" },
];

const userActions = [
  {
    key: "edit",
    label: "Edit",
    type: "primary",
    icon: "pen",
    onClick: (row) => openEditDialog(row),
  },
  {
    key: "delete",
    label: "Delete",
    type: "danger",
    confirm: true,
    confirmMessage: (row) => \`Permanently delete \${row.first_name} \${row.last_name}? This action cannot be undone.\`,
    onClick: (row) => deleteUser(row.user_id),
  },
];

<TableX
  source="psb_s_user"
  columns={["user_id", "first_name", "last_name", "email", "status_id", "created_at"]}
  filters={userFilters}
  actions={userActions}
  features={{ sorting: true, filtering: true }}
/>`;

const TABLEX_SNIPPET_EXPORT = `// Export is built-in. You don't write any code for it.
// Users can click the "Customize Table" button (side panel),
// then click "Export CSV" or "Export Excel".
//
// What gets exported:
//   - Only visible columns
//   - Respects current filters and sorting
//   - Column headers use the labels you defined
//
// That's it. Nothing to configure.`;

function TableXTab() {
  return (
    <div className={styles.tabContent}>
      <div className={styles.refBody}>
        <h2 className={styles.stepHeading}>TableX — The Easy Table</h2>
        <p className={styles.stepNote}>
          TableX is for everyday use. Give it a table name and column list — it does everything else.
          No hooks. No state. No fetch logic. Just props.
        </p>
      </div>

      <Accordion items={[
        {
          key: "tablex-basic",
          title: "1. Basic Table (just show data)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>
                The simplest possible table. Just two props: <code>source</code> (your database table name)
                and <code>columns</code> (which columns to show). It loads the data automatically.
              </p>
              <Snippet title="Code" code={TABLEX_SNIPPET_BASIC} />
              <div className={styles.propGrid}>
                <RefPropRow prop="source" required type="string" desc="The database table name (e.g. psb_s_user)" />
                <RefPropRow prop="columns" required type="string[]" desc="Which columns to show. Order matters — left to right." />
              </div>
            </div>
          ),
        },
        {
          key: "tablex-columns",
          title: "2. Columns — Strings vs Objects",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>
                You can pass column names as simple strings (easy) or as objects (when you need custom labels or cell rendering).
              </p>
              <Snippet title="Simple — Just Strings" code={TABLEX_SNIPPET_COLUMNS_STRING} />
              <Snippet title="Advanced — Objects" code={TABLEX_SNIPPET_COLUMNS_OBJECT} />
              <div className={styles.ruleGrid}>
                <div className={styles.ruleCol}>
                  <p className={styles.ruleHeading}>String Column</p>
                  <ul className={styles.ruleList}>
                    <li>Just the field name</li>
                    <li>Label is auto-generated</li>
                    <li>Sorting is on by default</li>
                  </ul>
                </div>
                <div className={styles.ruleCol}>
                  <p className={styles.ruleHeading}>Object Column</p>
                  <ul className={styles.ruleList}>
                    <li>Custom label, width, render</li>
                    <li>Use render for Badges, icons, etc.</li>
                    <li>Mix with strings in same array</li>
                  </ul>
                </div>
              </div>
            </div>
          ),
        },
        {
          key: "tablex-filters",
          title: "3. Filters (dropdown, text, date range)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>
                Filters appear above the table. Users can narrow down rows.
                For dropdowns, TableX loads the options from the database automatically.
              </p>
              <Snippet title="Code" code={TABLEX_SNIPPET_FILTERS} />
              <div className={styles.propGrid}>
                <RefPropRow prop="key" required type="string" desc="The column name in YOUR table to filter on" />
                <RefPropRow prop="type" required type="string" desc="select | text | date | daterange" />
                <RefPropRow prop="source" required={false} type="string" desc="For select: which table to load dropdown options from" />
                <RefPropRow prop="display" required={false} type="string" desc="For select: which column to show as the label" />
                <RefPropRow prop="label" required={false} type="string" desc="Custom label (default: auto from key name)" />
              </div>
            </div>
          ),
        },
        {
          key: "tablex-actions",
          title: "4. Row Actions (Edit, Delete, etc.)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>
                Actions add buttons to each row. You decide what each button does.
              </p>
              <Snippet title="Code" code={TABLEX_SNIPPET_ACTIONS} />
              <div className={styles.propGrid}>
                <RefPropRow prop="key" required type="string" desc="Unique name for this action" />
                <RefPropRow prop="label" required type="string" desc="Button text" />
                <RefPropRow prop="type" required type="string" desc="primary | secondary | danger" />
                <RefPropRow prop="onClick" required type="function" desc="What happens when clicked. Receives the row data." />
                <RefPropRow prop="icon" required={false} type="string" desc="Font Awesome icon name (e.g. pen, trash, eye)" />
                <RefPropRow prop="confirm" required={false} type="boolean" desc="Show confirmation popup before running onClick" />
                <RefPropRow prop="confirmMessage" required={false} type="function" desc="Custom confirmation text. Receives row." />
                <RefPropRow prop="visible" required={false} type="function" desc="Show/hide per row. (row) => boolean" />
                <RefPropRow prop="disabled" required={false} type="function" desc="Enable/disable per row. (row) => boolean" />
              </div>
            </div>
          ),
        },
        {
          key: "tablex-features",
          title: "5. Features (turn things on/off)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>
                Features control what the table can do. Everything is ON by default except drag and batch.
              </p>
              <Snippet title="Code" code={TABLEX_SNIPPET_FEATURES} />
              <div className={styles.propGrid}>
                <RefPropRow prop="sorting" required={false} type="boolean" desc="Click column headers to sort. Default: true" />
                <RefPropRow prop="filtering" required={false} type="boolean" desc="Show filter bar. Default: true" />
                <RefPropRow prop="pagination" required={false} type="boolean" desc="Show page controls. Default: true" />
                <RefPropRow prop="resizing" required={false} type="boolean" desc="Drag to resize columns. Default: true" />
                <RefPropRow prop="drag" required={false} type="boolean" desc="Drag rows to reorder. Default: false" />
                <RefPropRow prop="batch" required={false} type="boolean" desc="Batch edit mode. Default: false" />
              </div>
            </div>
          ),
        },
        {
          key: "tablex-export",
          title: "6. Export (CSV / Excel)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>
                Export is built-in. No extra code needed. Users click the side panel button to download.
              </p>
              <Snippet title="How It Works" code={TABLEX_SNIPPET_EXPORT} />
            </div>
          ),
        },
        {
          key: "tablex-full",
          title: "7. Full Example (everything together)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>
                Here is a complete, real-world example with columns, filters, actions, and features all in one.
              </p>
              <Snippet title="Full Code" code={TABLEX_SNIPPET_FULL} />
            </div>
          ),
        },
        {
          key: "tablex-props",
          title: "8. All Props (quick reference)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>Every prop TableX accepts, in one place.</p>
              <div className={styles.propGrid}>
                <RefPropRow prop="source" required type="string" desc="Database table name" />
                <RefPropRow prop="columns" required type="(string | object)[]" desc="Column names or column config objects" />
                <RefPropRow prop="filters" required={false} type="object[]" desc="Filter definitions array" />
                <RefPropRow prop="features" required={false} type="object" desc="Feature toggles (sorting, filtering, etc.)" />
                <RefPropRow prop="actions" required={false} type="object[]" desc="Row action buttons" />
              </div>
            </div>
          ),
        },
        {
          key: "tablex-databind",
          title: "9. How It Works Behind the Scenes (Databind)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>
                TableX is powered by the <strong>databind engine</strong> — a set of generic API routes at <code>/api/databind/</code>
                that can query, filter, sort, paginate, and export data from <em>any</em> Supabase table.
                You never call these APIs directly — TableX does it for you.
              </p>
              <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
                <p className={styles.ruleHeading}>What Happens When You Render a TableX</p>
                <pre style={{ fontSize: "0.85rem", overflow: "auto", margin: 0 }}>{`You write:
  <TableX source="psb_s_user" columns={["user_id", "first_name", "email"]} />

TableX automatically:
  1. Calls POST /api/databind/query with:
     { table: "psb_s_user", fields: ["user_id","first_name","email"], page: 1, pageSize: 50 }

  2. For select filters, calls POST /api/databind/options with:
     { table: "psb_s_status", key: "status_id", display: "sts_name" }

  3. For export, calls POST /api/databind/export with:
     { table: "psb_s_user", format: "csv", columns: [...], filters: {...} }

  4. For column discovery, calls GET /api/databind/schema?table=psb_s_user`}</pre>
              </div>
              <div style={{ marginTop: "1.5rem" }}>
                <p className={styles.ruleHeading}>When Do You Need Custom API Routes?</p>
                <div className={styles.ruleGrid}>
                  <div className={styles.ruleCol}>
                    <p style={{ fontWeight: 600, color: "#2e7d32" }}>Use Databind (no custom API)</p>
                    <ul className={styles.ruleList}>
                      <li>Show data from a single table</li>
                      <li>Filter, sort, paginate</li>
                      <li>Export to CSV / Excel</li>
                      <li>Load dropdown options from a table</li>
                    </ul>
                  </div>
                  <div className={styles.ruleCol}>
                    <p style={{ fontWeight: 600, color: "#d32f2f" }}>Write Custom API Route</p>
                    <ul className={styles.ruleList}>
                      <li>Multi-step operations (create user + assign role)</li>
                      <li>Complex validation beyond DB constraints</li>
                      <li>Cross-table joins or aggregations</li>
                      <li>Custom business logic (batch save, reorder, etc.)</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#fff3cd", borderRadius: "4px", borderLeft: "4px solid #ffc107" }}>
                <p style={{ margin: 0, fontSize: "0.9rem" }}>
                  <strong>Rule of thumb:</strong> Start with TableX + databind. Only create a custom API route when databind cannot do what you need.
                  Most new modules will never need custom API routes.
                </p>
              </div>
            </div>
          ),
        },
      ]} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table Tab — The Power Table (for senior devs)
// ---------------------------------------------------------------------------

const TABLE_SNIPPET_UNCONTROLLED = `import { TableZ } from "@/shared/components/ui";

// UNCONTROLLED MODE — TableZ handles sorting, filtering, pagination internally.
// You just pass data and columns. Good for small, local datasets.

const columns = [
  { key: "group_name",    label: "Group Name",  sortable: true, width: 220 },
  { key: "group_desc",    label: "Description", sortable: false, width: 250 },
  {
    key: "is_active",
    label: "Active",
    width: 100,
    render: (row) => (
      <Badge bg={row.is_active ? "success" : "secondary"}>
        {row.is_active ? "Yes" : "No"}
      </Badge>
    ),
  },
];

const actions = [
  {
    key: "edit",
    label: "Edit",
    type: "primary",
    icon: "pen",
    onClick: (row) => openEditDialog(row),
  },
];

<TableZ
  data={groups}
  columns={columns}
  rowIdKey="group_id"
  actions={actions}
  emptyMessage="No groups found."
/>`;

const TABLE_SNIPPET_CONTROLLED = `import { TableZ, createFilterConfig, TABLE_FILTER_TYPES } from "@/shared/components/ui";

// CONTROLLED MODE — You manage the state. TableZ tells you what changed.
// Use this when you need server-side sorting, filtering, pagination.
// You must pass: state + onChange

const [tableState, setTableState] = useState({
  filters: {},
  sorting: { key: "created_at", direction: "desc" },
  pagination: { page: 1, pageSize: 50, total: 0 },
  columnVisibility: {},
  columnSizing: {},
});

const filterConfig = createFilterConfig([
  { key: "status", label: "Status", type: TABLE_FILTER_TYPES.SELECT, options: statusOptions },
  { key: "created_at", label: "Created", type: TABLE_FILTER_TYPES.DATERANGE },
]);

function handleTableChange(event) {
  switch (event.type) {
    case "search":
      setTableState(prev => ({
        ...prev,
        filters: { ...prev.filters, search: event.value },
        pagination: { ...prev.pagination, page: 1 },
      }));
      break;
    case "filters":
      setTableState(prev => ({ ...prev, filters: event.filters, pagination: { ...prev.pagination, page: 1 } }));
      break;
    case "sorting":
      setTableState(prev => ({ ...prev, sorting: event.sorting, pagination: { ...prev.pagination, page: 1 } }));
      break;
    case "pagination":
      setTableState(prev => ({ ...prev, pagination: { ...prev.pagination, ...event.pagination } }));
      break;
    case "action":
      event.action.onClick(event.row);
      break;
  }
}

<TableZ
  data={rows}
  columns={columns}
  state={tableState}
  filterConfig={filterConfig}
  actions={actions}
  loading={loading}
  onChange={handleTableChange}
/>`;

const TABLE_SNIPPET_DRAGGABLE = `// DRAG & DROP — let users reorder rows by dragging.
// The table auto-updates the "order" field on each row.
// Use with onReorder to save the new order.

<TableZ
  data={groups}
  columns={groupColumns}
  rowIdKey="group_id"
  actions={groupActions}
  draggable={true}
  onReorder={(reorderedRows) => {
    // reorderedRows = same data, but with updated order values
    setGroups(reorderedRows);
    saveSortOrder(reorderedRows);
  }}
/>`;

const TABLE_SNIPPET_BATCH = `// BATCH EDIT — track created, updated, and deleted rows.
// Table highlights changed rows. You save all changes at once.

<TableZ
  data={users}
  columns={userColumns}
  rowIdKey="user_id"
  actions={userActions}
  batchMode={true}
  onBatchChange={(payload) => {
    // payload = { created: [...], updated: [...], deleted: [...] }
    // payload.hasPendingChanges = true if anything changed
    setPendingChanges(payload);
  }}
  onBatchSave={async (payload) => {
    await saveBatchToServer(payload);
  }}
/>`;

const TABLE_SNIPPET_MASTERDETAIL = `// MASTER-DETAIL PATTERN — click a row in the left table,
// show related data in the right table.
// Used in: Application Setup, Card Module Setup, Company Department Setup

const [selectedCompany, setSelectedCompany] = useState(null);

// Filter departments by selected company
const departments = allDepartments.filter(
  (d) => d.comp_id === selectedCompany?.comp_id
);

// LEFT TABLE — Companies (master)
<TableZ
  data={companies}
  columns={companyColumns}
  rowIdKey="comp_id"
  selectedRowId={selectedCompany?.comp_id}
  onRowClick={(row) => setSelectedCompany(row)}
  actions={companyActions}
/>

// RIGHT TABLE — Departments (detail)
<TableZ
  data={departments}
  columns={departmentColumns}
  rowIdKey="dept_id"
  actions={departmentActions}
  emptyMessage={
    selectedCompany
      ? "No departments for this company."
      : "Select a company first."
  }
/>`;

const TABLE_SNIPPET_COLUMNS_FULL = `// COLUMN OPTIONS — full list of what you can set on a column

const columns = [
  {
    key: "employee_code",     // (required) field name from your data
    label: "Employee Code",   // (required) column header text
    sortable: true,           // click header to sort by this column
    width: 150,               // starting pixel width
    minWidth: 80,             // won't shrink below this
    defaultVisible: true,     // set false to hide on first load (still in panel)
    render: (row) => (        // custom cell content
      <span style={{ fontWeight: 700 }}>{row.employee_code}</span>
    ),
  },
];`;

const TABLE_SNIPPET_ACTIONS_FULL = `// ACTION OPTIONS — full list of what you can set on an action

const actions = [
  {
    key: "edit",                    // (required) unique name
    label: "Edit",                  // (required) button text
    type: "primary",                // (required) primary | secondary | danger
    icon: "pen",                   // Font Awesome icon name
    onClick: (row) => {},           // (required) what happens on click
    visible: (row) => true,         // show/hide per row
    disabled: (row) => false,       // enable/disable per row
    confirm: false,                 // show "Are you sure?" popup
    confirmMessage: (row) =>        // custom confirmation text
      \`Delete \${row.name}?\`,
  },
];`;

const TABLE_SNIPPET_EVENTS = `// TABLE EVENTS — what event.type values you will receive in onChange (TableZ)

// "search"           — user typed in the search bar
//                      event.value = the search text
//
// "filters"          — user changed a filter (dropdown, date, etc.)
//                      event.filters = { filterKey: filterValue }
//
// "sorting"          — user clicked a sortable column header
//                      event.sorting = { key: "column", direction: "asc"|"desc" }
//
// "pagination"       — user changed page or page size
//                      event.pagination = { page: 2, pageSize: 50 }
//
// "action"           — user clicked a row action button
//                      event.action = the action config, event.row = the row data
//
// "export"           — user clicked CSV or Excel export
//                      event.format = "csv"|"excel", event.context = { filters, sorting, ... }
//
// "columnVisibility" — user toggled a column in the Customize panel
//                      event.columnVisibility = { columnKey: true|false }
//
// "columnResize"     — user resized a column by dragging
//                      event.columnSizing = { columnKey: newWidth }`;

function TableZTab() {
  return (
    <div className={styles.tabContent}>
      <div className={styles.refBody}>
        <h2 className={styles.stepHeading}>TableZ — The Power Table</h2>
        <p className={styles.stepNote}>
          TableZ is the full engine. Use it when you need complete control — server-side state,
          drag-and-drop, batch editing, master-detail, or custom rendering.
          For simple tables, use TableX instead.
        </p>
      </div>

      <Accordion items={[
        {
          key: "table-uncontrolled",
          title: "1. Uncontrolled Mode (easy, local data)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>
                Pass <code>data</code> and <code>columns</code>. TableZ handles sorting, filtering, and pagination inside itself.
                Best for small datasets that are already loaded.
              </p>
              <Snippet title="Code" code={TABLE_SNIPPET_UNCONTROLLED} />
            </div>
          ),
        },
        {
          key: "table-controlled",
          title: "2. Controlled Mode (server-driven)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>
                Pass <code>state</code> and <code>onChange</code>. You manage the state, fetch data from the server,
                and update the state when events come in. Use for large datasets.
              </p>
              <Snippet title="Code" code={TABLE_SNIPPET_CONTROLLED} />
            </div>
          ),
        },
        {
          key: "table-masterdetail",
          title: "3. Master-Detail (click row ? show related data)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>
                Two tables side by side. Click a row in the left table, the right table shows related rows.
                Used in Application Setup, Card Module Setup, Company Department Setup.
              </p>
              <Snippet title="Code" code={TABLE_SNIPPET_MASTERDETAIL} />
            </div>
          ),
        },
        {
          key: "table-draggable",
          title: "4. Drag & Drop Reorder",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>
                Let users drag rows to reorder them. The table updates the order field automatically.
              </p>
              <Snippet title="Code" code={TABLE_SNIPPET_DRAGGABLE} />
            </div>
          ),
        },
        {
          key: "table-batch",
          title: "5. Batch Editing (Draft + Baseline + Diff Pattern)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>
                Batch editing lets users make multiple changes (add, edit, delete rows) without saving each one individually.
                All changes are collected and saved at once when the user clicks &quot;Save Batch&quot;.
              </p>
              <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
                <p className={styles.ruleHeading}>How Batch Mode Works (Every Admin Module Uses This)</p>
                <pre style={{ fontSize: "0.85rem", overflow: "auto", margin: 0 }}>{`1. LOAD: Fetch data from API → store as BASELINE (frozen) + DRAFT (working copy)
2. EDIT: User adds/edits/deletes rows → changes go to DRAFT only
3. DIFF: Compare DRAFT vs BASELINE → compute what changed (useMemo)
4. SHOW: Highlight changed rows (green=new, blue=modified, red=deleted)
5. SAVE: User clicks "Save Batch" → send only the changes to API
6. RESET: Reload from server → new BASELINE, DRAFT = clone of BASELINE`}</pre>
              </div>
              <Snippet title="Basic Batch Mode" code={TABLE_SNIPPET_BATCH} />
              <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#fff3cd", borderRadius: "4px", borderLeft: "4px solid #ffc107" }}>
                <p style={{ margin: 0, fontSize: "0.9rem" }}>
                  <strong>Key concept:</strong> The <code>__batchState</code> field on each row tells the table how to highlight it.
                  Values: <code>&quot;created&quot;</code> (green), <code>&quot;updated&quot;</code> (blue), <code>&quot;deleted&quot;</code> (red strikethrough).
                  Your hook computes this by comparing draft vs baseline.
                </p>
              </div>
            </div>
          ),
        },
        {
          key: "table-inline-edit",
          title: "5.1 Inline Editing with InlineEditCell",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>
                <code>InlineEditCell</code> lets users click a table cell to edit its value directly — no modal needed.
                Used in Application Setup, Card Module Setup, and other admin modules for quick field edits.
              </p>
              <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
                <p className={styles.ruleHeading}>How It Works</p>
                <pre style={{ fontSize: "0.85rem", overflow: "auto", margin: 0 }}>{`1. Cell shows text normally (read-only)
2. User clicks the "Edit" row action → row enters edit mode
3. Cells with InlineEditCell become clickable (dashed underline)
4. User clicks a cell → it becomes an input field
5. User types new value → presses Enter or clicks away
6. onCommit fires → your hook stages the change in the batch
7. User clicks "Done" → row exits edit mode
8. All changes saved together via "Save Batch"`}</pre>
              </div>
              <Snippet title="InlineEditCell in a Column Renderer" code={`import { InlineEditCell } from "@/shared/components/ui";

// Inside your column definition:
{
  key: "app_name",
  label: "Application",
  render: (row) => {
    // Only enable editing for the row currently in edit mode
    const isEditing = String(row?.app_id) === String(editingAppId);

    return (
      <InlineEditCell
        value={row?.app_name || ""}
        onCommit={(newValue) => onInlineEdit(row, "app_name", newValue)}
        disabled={!isEditing}
        placeholder="Enter name"
      />
    );
  },
}`} />
              <div className={styles.propGrid}>
                <RefPropRow prop="value" required type="string | number" desc="Current cell value to display" />
                <RefPropRow prop="onCommit" required type="function" desc="(newValue) => void. Called when user finishes editing." />
                <RefPropRow prop="disabled" required={false} type="boolean" desc="When true, cell is read-only (not clickable). Default: false" />
                <RefPropRow prop="placeholder" required={false} type="string" desc="Shown when value is empty. Default: '--'" />
                <RefPropRow prop="type" required={false} type="string" desc="Input type: 'text' | 'number'. Default: 'text'" />
              </div>
              <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#fff3cd", borderRadius: "4px", borderLeft: "4px solid #ffc107" }}>
                <p style={{ margin: 0, fontSize: "0.9rem" }}>
                  <strong>Pattern:</strong> The row&apos;s edit mode is controlled by an <code>editingAppId</code> state in the hook.
                  Only one row can be in edit mode at a time. The &quot;Edit&quot; action sets it, the &quot;Done&quot; action clears it.
                  This prevents accidental edits and keeps the UI clean.
                </p>
              </div>
            </div>
          ),
        },
        {
          key: "table-columns-ref",
          title: "6. Column Options (full reference)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>Every option you can set on a column.</p>
              <Snippet title="Code" code={TABLE_SNIPPET_COLUMNS_FULL} />
              <div className={styles.propGrid}>
                <RefPropRow prop="key" required type="string" desc="Field name from your row data" />
                <RefPropRow prop="label" required type="string" desc="Column header text" />
                <RefPropRow prop="sortable" required={false} type="boolean" desc="Enable click-to-sort. Default: false" />
                <RefPropRow prop="width" required={false} type="number" desc="Starting pixel width" />
                <RefPropRow prop="minWidth" required={false} type="number" desc="Minimum width when resizing" />
                <RefPropRow prop="defaultVisible" required={false} type="boolean" desc="Set false to hide initially" />
                <RefPropRow prop="render" required={false} type="function" desc="Custom cell renderer: (row) => ReactNode" />
              </div>
            </div>
          ),
        },
        {
          key: "table-actions-ref",
          title: "7. Action Options (full reference)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>Every option you can set on a row action.</p>
              <Snippet title="Code" code={TABLE_SNIPPET_ACTIONS_FULL} />
            </div>
          ),
        },
        {
          key: "table-events-ref",
          title: "8. Table Events (what onChange receives)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>All the event types the table emits through onChange.</p>
              <Snippet title="Event Types" code={TABLE_SNIPPET_EVENTS} />
            </div>
          ),
        },
        {
          key: "table-props-ref",
          title: "9. All Props (quick reference)",
          content: (
            <div className={styles.refBody}>
              <p className={styles.stepNote}>Every prop the TableZ component accepts.</p>
              <div className={styles.propGrid}>
                <RefPropRow prop="data" required type="array" desc="Array of row objects" />
                <RefPropRow prop="columns" required type="object[]" desc="Column config objects" />
                <RefPropRow prop="rowIdKey" required={false} type="string" desc="Unique ID field per row. Default: id" />
                <RefPropRow prop="actions" required={false} type="object[]" desc="Row action buttons" />
                <RefPropRow prop="state" required={false} type="object" desc="Controlled state (turns on controlled mode)" />
                <RefPropRow prop="onChange" required={false} type="function" desc="Event handler (required with state)" />
                <RefPropRow prop="filterConfig" required={false} type="object[]" desc="Filter definitions (controlled mode)" />
                <RefPropRow prop="loading" required={false} type="boolean" desc="Show loading spinner" />
                <RefPropRow prop="selectedRowId" required={false} type="string | number" desc="Highlight a row (master-detail)" />
                <RefPropRow prop="onRowClick" required={false} type="function" desc="Click handler for row selection" />
                <RefPropRow prop="draggable" required={false} type="boolean" desc="Enable drag-and-drop reorder" />
                <RefPropRow prop="onReorder" required={false} type="function" desc="Callback with reordered rows" />
                <RefPropRow prop="batchMode" required={false} type="boolean" desc="Enable batch editing" />
                <RefPropRow prop="onBatchChange" required={false} type="function" desc="Callback with batch payload" />
                <RefPropRow prop="onBatchSave" required={false} type="function" desc="Callback to save batch" />
                <RefPropRow prop="emptyMessage" required={false} type="string" desc="Message when no rows" />
                <RefPropRow prop="searchPlaceholder" required={false} type="string" desc="Search bar placeholder text" />
              </div>
            </div>
          ),
        },
        {
          key: "table-when-to-use",
          title: "11. When to Use TableZ vs TableX",
          content: (
            <div className={styles.refBody}>
              <div className={styles.ruleGrid}>
                <div className={styles.ruleCol}>
                  <p className={styles.ruleHeading}>Use TableX When</p>
                  <ul className={styles.ruleList}>
                    <li>You just need to show data from a database table</li>
                    <li>You want filters, sorting, pagination to just work</li>
                    <li>You don not need drag, batch, or master-detail</li>
                    <li>You want the simplest possible code</li>
                  </ul>
                </div>
                <div className={styles.ruleCol}>
                  <p className={styles.ruleHeading}>Use TableZ When</p>
                  <ul className={styles.ruleList}>
                    <li>You need full control over state and data fetching</li>
                    <li>You need drag-and-drop reordering</li>
                    <li>You need batch editing (create/update/delete)</li>
                    <li>You need master-detail (click row ? show related)</li>
                    <li>You need custom server-side logic</li>
                  </ul>
                </div>
              </div>
            </div>
          ),
        },
      ]} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

const TABS = [
  { id: "quick-start", label: "Quick Start" },
  { id: "playground",  label: "Playground"  },
  { id: "tablex",      label: "TableX"      },
  { id: "tablez",      label: "TableZ"      },
  { id: "reference",   label: "Reference"   },
];

export default function SharedUiReferencePage() {
  const [activeTab, setActiveTab] = useState("quick-start");

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.kicker}>Shared UI Components</p>
          <h1 className={styles.title}>Developer Guide</h1>
          <p className={styles.subtitle}>Scan, copy, move on.</p>
        </div>
        <nav className={styles.tabBar} role="tablist" aria-label="Page sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={[styles.tab, activeTab === tab.id ? styles.tabActive : ""].filter(Boolean).join(" ")}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {activeTab === "quick-start" && <QuickStartTab />}
      {activeTab === "playground"  && <PlaygroundTab />}
      {activeTab === "tablex"      && <TableXTab />}
      {activeTab === "tablez"      && <TableZTab />}
      {activeTab === "reference"   && <ReferenceTab  />}
    </div>
  );
}
