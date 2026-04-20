# JR Developer Development Guide

Canonical standard:
- Follow [PSBUniverse Development Rules (Final)](./PSBUNIVERSE_DEVELOPMENT_RULES_FINAL.md) for all non-negotiable architecture, UI, Table, and module constraints.
- Follow [Shared UI System Lockdown](./SHARED_UI_SYSTEM_LOCKDOWN.md) for strict shared component usage, behavior contracts, and design consistency rules.

Strict rules for junior developers working on PSBUniverse Core.

This is not a tutorial.
This is a working rulebook.

If you break these rules, you can break:
1. RBAC
2. Module consistency
3. Platform stability

---

## 1) Overview

PSBUniverse Core is a modular SaaS platform.

System model:
1. Core layer
2. Module layer

Core handles:
1. Login and session
2. User identity mapping
3. App-level RBAC checks
4. Route protection

Modules handle:
1. Feature pages
2. Feature cards
3. Card-level access filtering

Why strict discipline is required:
1. Core and modules share one security model.
2. If one module ignores the rules, users can see wrong data or wrong features.
3. Fixing inconsistent access logic later is expensive.

---

## 2) Your Role as a Jr Developer

Your role is feature delivery, not architecture redesign.

You should:
1. Build module features
2. Follow the existing contract
3. Use core helpers and hooks

You should not:
1. Change core auth flow on your own
2. Invent a new RBAC model
3. Create parallel systems

Simple rule:
1. Use core
2. Do not replace core

---

## 3) What You Are Allowed to Do

You are allowed to:
1. Build module UI pages and components
2. Define module routes in module manifest
3. Read cards and card groups from DB
4. Apply card-level checks using hasCardAccess()
5. Use useAuth() to read authUser, dbUser, roles, loading
6. Add module services for module data access

---

## 4) What You Are NOT Allowed to Do (Strict)

### Rule tree

1. Authentication and identity
   - Do NOT create your own auth system
   - Do NOT use password_hash for login logic
   - Do NOT fetch auth user manually in every component
   - Why dangerous:
     - session mismatch
     - duplicated auth behavior
     - security risk

2. Roles and permissions
   - Do NOT create roles in module code
   - Do NOT assign users to roles in module code
   - Do NOT hardcode role names or permissions
   - Why dangerous:
     - permissions stop matching DB
     - access becomes impossible to audit
     - module behavior differs by developer style

3. Access control
   - Do NOT bypass app RBAC
   - Do NOT skip card access checks
   - Why dangerous:
     - unauthorized users can open routes
     - hidden data can appear in UI

4. Session and login flow
    - Do NOT rename or replace sb-access-token behavior without lead approval
    - Do NOT bypass /api/me/bootstrap checks in login/session stabilization logic
    - Why dangerous:
       - users can be redirected back to login after successful sign in
       - server/client auth state can diverge

If your task needs any forbidden action:
1. Stop
2. Escalate to tech lead/core owner

---

## 5) Module Structure Rules

Required structure:

```text
src/modules/<APP_NAME> (Roles)/
  index.js
  pages/
    RolesPage.jsx
  components/
    RolesTable.jsx
  services/
    useRoles.js
  repo/
    roles.repo.js
  model/
    roles.model.js
  hooks/
    useRolesTable.js
  utils/
```

Purpose:
1. index.js
   - module contract for core loader
2. pages/
   - route-level screens
3. components/
   - reusable UI blocks

Optional folders:
1. services/
2. hooks/
3. utils/

Hard rule:
1. Never remove index.js
2. Core cannot load module without it

---

## 6) Module Contract

Required export in src/index.js:

```js
{
  key,
  app_id,
  name,
  routes
}
```

Field meaning:
1. key
   - stable module id
2. app_id
   - app id from psb_s_application
   - used by core hasAppAccess()
3. name
   - display name in dashboard
4. routes
   - route list with path and component

Why app_id is critical:
1. Core RBAC checks app access by app_id
2. Missing/wrong app_id causes wrong access behavior

Example:

```js
export default {
  key: "gutter",
  app_id: 1001,
  name: "Gutter",
  routes: [
    { path: "/gutter", component: GutterPage },
  ],
};
```

---

## 7) How to Build a Module (Step-by-Step)

Follow this exact sequence:

```text
1. Copy module template
2. Register app in DB (if not existing)
3. Create groups in psb_m_appcardgroup
4. Create cards in psb_s_appcard
5. Assign role access in psb_m_appcardroleaccess
6. Build UI
7. Apply card access checks
8. Test module
```

Step details:
1. Copy module template
   - prevents contract mistakes
2. Register app in DB
   - ensures valid app_id exists
3. Create groups
   - defines grouping and order
4. Create cards
   - defines feature cards and paths
5. Assign card-role access
   - links card_id to role_id
6. Build UI
   - page/component implementation
7. Apply access checks
   - hide/disable unauthorized cards/actions
8. Test module
   - verify allowed and blocked users

---

## 8) How to Use RBAC in Module

Use:
1. roles from useAuth()
2. hasCardAccess() from core

Concept example:

```js
const { roles, loading } = useAuth();

if (loading) return <p>Loading...</p>;

const visibleCards = cards.filter((card) =>
  hasCardAccess(card.card_id, roles, cardRoleAccessRows)
);
```

Do not:
1. Parse roles manually
2. Hardcode Admin/Manager checks

Always:
1. Use role_id and card_id mappings from DB

---

## 9) How to Work with Database

Use DB as source of truth.

Rules:
1. Do not hardcode cards in code
2. Do not hardcode permissions in code
3. Query by app_id for module data
4. Filter by is_active where needed

Module-level expected tables:
1. psb_m_appcardgroup
2. psb_s_appcard
3. psb_m_appcardroleaccess

Data flow in module:
1. load cards and groups
2. load card-role mappings
3. filter cards with hasCardAccess()

---

## 10) Routing Rules

Rules:
1. Define routes in module src/index.js
2. Route path must start with /
3. Route path should match DB card route_path
4. Core resolves and gates route access

Why this matters:
1. If code route and DB route differ, UI and permission logic drift
2. Drift causes wrong navigation and wrong feature visibility

Example:
1. DB card route_path = /gutter/settings
2. Module route path must also be /gutter/settings

---

## 11) UI and Styling Rules

Follow shared platform look and behavior.

Do:
1. Use core shell layout
2. Keep spacing and typography consistent
3. Show clear loading/empty/error/no-access states

Do not:
1. Redesign core nav from module code
2. Add random style systems
3. Hide denied access silently

Goal:
1. Users should feel one platform, not many unrelated mini apps

---

## 12) Shared Table Rules (Required for New Module Tables)

Use shared table from core UI for all new module tables.

Import:

```js
import { Table } from "@/shared/components/ui";
```

Hard rules:
1. Do not install table libraries inside a module folder
2. Do not build one-off table behavior per page when shared table already supports it
3. Keep data and filter values in module state and pass into shared table via props
4. Table is controlled mode only. Do not pass children rows manually.

What shared table already supports:
1. Header sorting
2. Global search
3. Data-driven filters and databound select options provided by module state
4. Column resize with minimum width enforcement
5. Dynamic column visibility toggles
6. Row actions
7. Controlled pagination
8. Loading and empty states
9. Export hooks (CSV or Excel)

Data Table API example:

```js
const [columns, setColumns] = useState([
   {
      key: "name",
      label: "Name",
      sortable: true,
      resizable: true,
      width: 220,
      visible: true,
   },
   {
      key: "status",
      label: "Status",
      visible: true,
      render: (row) => <Badge>{row.status}</Badge>,
   },
   {
      key: "internal_notes",
      label: "Notes",
      visible: false,
   },
]);

const [sort, setSort] = useState({ key: "name", direction: "asc" });
const [applicationOptions, setApplicationOptions] = useState([]);

useEffect(() => {
   let active = true;

   async function loadApplicationOptions() {
      const apps = await fetchApplications();
      if (!active) return;

      setApplicationOptions(
         apps.map((item) => ({
            label: item.name,
            value: item.id,
         }))
      );
   }

   loadApplicationOptions();

   return () => {
      active = false;
   };
}, []);

const filtersConfig = [
   {
      key: "status",
      label: "Status",
      type: "select",
      options: [
         { label: "Active", value: true },
         { label: "Inactive", value: false },
      ],
   },
   {
      key: "app_id",
      label: "Application",
      type: "select",
      dataSource: fetchApplications,
      options: applicationOptions,
   },
   {
      key: "created_at",
      label: "Created Date",
      type: "date-range",
   },
];

const actions = [
   { label: "Edit", onClick: (row) => handleEdit(row) },
   { label: "Delete", onClick: (row) => handleDelete(row), variant: "danger" },
];

const handleColumnVisibilityChange = (nextColumns) => {
   setColumns(nextColumns);
};

const handleColumnResizeChange = (nextColumns) => {
   setColumns(nextColumns);
};

<Table
   columns={columns}
   data={rows}
   loading={loading}
   total={total}
   page={page}
   pageSize={pageSize}
   filters={filtersConfig}
   appliedFilters={appliedFilters}
   sort={sort}
   onFilterChange={handleFilterChange}
   onSortChange={setSort}
   onPageChange={handlePageChange}
   onSearchChange={handleSearch}
   onColumnVisibilityChange={handleColumnVisibilityChange}
   onColumnResizeChange={handleColumnResizeChange}
   actions={actions}
   onExport={handleExport}
/>
```

Rules to remember:
1. Never hardcode filters inside table component files in modules
2. Databound filter options are fetched in module code and passed into `options`
3. Never place RBAC checks in Table visibility logic
4. RBAC decides whether a column exists in columns array
5. UI visibility decides if existing column is shown by user toggle
6. Keep all data/query state in module page and pass into Table
7. Always pass controlled handlers for sort, visibility, and resize

Blessed companion example:
1. Open `/examples/data-table` in dev
2. Copy from `src/app/examples/data-table/page.js`
3. Follow API pattern from `src/app/api/examples/data-table/`

Primary shared UI reference:
1. Open `/examples` in dev for the full shared UI guide/playground/reference experience
2. Use Quick Start for baseline setup sequence
3. Use Playground for interaction testing
4. Use Reference for props/pattern contracts

Row action type rule (strict):
1. Table row action `type` supports only:
   - `primary`
   - `secondary`
   - `danger`
2. Do not pass `success` or `warning` to row actions in shared Table config
3. If business meaning is success/warning, map to a supported UI type before passing actions

Bonus playground usage:
1. Use Bonus Playground table scenario as the default pattern for real-world review/approval flows
2. Use Bonus Add User form as the baseline for shared Input + Dropdown + validation composition
3. Use modal confirmation pattern for critical workflow actions instead of browser prompt UX

---

## 13) Common Mistakes

Top mistakes to avoid:
1. Hardcoding roles in components
2. Skipping card access checks
3. Duplicating auth fetch logic
4. Missing key/app_id/routes in module contract
5. Wrong app_id in module manifest
6. No loading/no-access states

Why these matter:
1. They cause most access bugs and unstable releases

---

## 14) Final Checklist Before Submitting

All items must pass before PR:

- [ ] Module structure follows required tree
- [ ] src/index.js exists and exports key, app_id, name, routes
- [ ] app_id is valid in psb_s_application
- [ ] Card groups exist in psb_m_appcardgroup
- [ ] Cards exist in psb_s_appcard with correct app_id and route_path
- [ ] Card-role mapping exists in psb_m_appcardroleaccess
- [ ] Module uses useAuth() from core
- [ ] Module uses hasCardAccess() for card visibility/action control
- [ ] No hardcoded role names or permission flags
- [ ] No custom auth logic added
- [ ] No password_hash usage
- [ ] Authorized user flow works
- [ ] Unauthorized cards are hidden/disabled
- [ ] Unauthorized app route is blocked by core gate

If any item fails:
1. Do not submit
2. Fix first

---

## Escalation Rule

If your work requires changing:
1. Auth flow
2. RBAC model
3. Role governance
4. Core route guard logic

Stop and escalate to the technical lead.
Do not make architecture changes inside module tasks.
