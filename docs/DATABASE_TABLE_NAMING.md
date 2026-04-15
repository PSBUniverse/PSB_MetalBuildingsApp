# DATABASE TABLES + NAMING CONVENTION (How To Use It)

This guide explains how database table names are structured in this project.

If you follow this naming pattern, your module stays predictable and easier to maintain.

## 1) Why Naming Convention Matters

- Faster onboarding for new developers.
- Easier to find tables by module and purpose.
- Safer CRUD code because table intent is obvious.
- Less duplication and fewer random one-off names.

## 2) Table Name Format

Use this format:

`<module_prefix>_<table_type>_<entity_name>`

Example:

- `psb_s_user`

Meaning:

- `psb` -> module or domain prefix
- `s` -> table type
- `user` -> entity name

## 3) Table Type Meanings

- `s` (setup/master/reference table)
- `t` (transaction/business-record table)
- `m` (mapping/join table)

Examples:

- Setup: `psb_s_status`, `psb_s_role`, `gtr_s_colors`
- Transaction: `gtr_t_projects`, `inv_t_items`
- Mapping: `psb_m_userapproleaccess`, `gtr_m_project_sides`

## 4) Real Patterns In This Repo

User Master examples:

- `psb_s_user`
- `psb_s_company`
- `psb_s_department`
- `psb_s_role`
- `psb_s_application`
- `psb_s_status`
- `psb_m_userapproleaccess`

Gutter examples:

- Setup tables use `gtr_s_*`
- Transaction tables use `gtr_t_*`
- Mapping tables use `gtr_m_*`

## 5) How To Use Table Names In Code

Do not hardcode table names all over service files.

Create one table map constant, then reuse it.

```javascript
export const INVENTORY_TABLES = {
  items: "inv_t_items",
  statuses: "inv_s_status",
  itemDiscountAccess: "inv_m_itemdiscountaccess",
};
```

Then query using constants:

```javascript
const { data, error } = await supabase
  .from(INVENTORY_TABLES.items)
  .select("*")
  .order("created_at", { ascending: false });
```

Why this is better:

- One source of truth for table names.
- Easy rename if table name changes.
- Fewer typos across services.

## 6) How To Pick Names For New Module Tables

1. Choose module prefix (example: `inv`, `gtr`, `psb`).
2. Choose table type (`s`, `t`, `m`).
3. Use singular entity names unless team has a specific plural rule.
4. Keep names lowercase with underscores only.
5. Avoid abbreviations that new devs cannot understand.

Examples:

- `inv_s_category`
- `inv_t_item`
- `inv_m_itemcategory`

## 7) Practical Workflow (Create + Use)

1. Define table names first in module access/constants file.
2. Create table in Supabase using the same exact name.
3. Add CRUD service methods using `.from(TABLES.someTable)`.
4. Add API route wrappers under `src/app/api/.../route.js`.
5. Call API from hooks/components (not direct privileged Supabase writes in UI).
6. Test `GET`, `POST`, `PATCH`, `DELETE` for both success and error paths.

## 8) Do / Dont

DO:

- Keep naming consistent across SQL scripts and app code.
- Keep table constants in one place per module.
- Use the same prefix for all tables in one module.

DONT:

- Do not mix random prefixes inside one module.
- Do not put setup data in transaction tables by accident.
- Do not hardcode table strings repeatedly in many files.

## 9) Quick Memory Rule

- `s` = setup/master data (usually edited less frequently)
- `t` = transaction data (day-to-day records)
- `m` = many-to-many or cross-link relationships

If you apply this pattern from day one, your module schema stays clean and scalable.

## 10) SQL Starter Templates (Create Table)

Use these as starter patterns in Supabase SQL editor.

Replace `inv` with your module prefix and adjust columns as needed.

### A) Setup table (`s`)

```sql
create table if not exists public.inv_s_status (
  status_id bigserial primary key,
  status_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Use this for stable reference data like statuses, types, categories, and options.

### B) Transaction table (`t`)

```sql
create table if not exists public.inv_t_item (
  item_id bigserial primary key,
  item_name text not null,
  item_price numeric(12,2) not null default 0,
  status_id bigint references public.inv_s_status(status_id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Use this for day-to-day business records users create or change often.

### C) Mapping table (`m`)

```sql
create table if not exists public.inv_m_itemcategory (
  item_category_map_id bigserial primary key,
  item_id bigint not null references public.inv_t_item(item_id) on delete cascade,
  category_id bigint not null references public.inv_s_status(status_id),
  created_at timestamptz not null default now(),
  unique (item_id, category_id)
);
```

Use this when one row can be connected to many rows in another table (many-to-many).

### D) Matching App Constant Map

After creating tables, define a module table map in code so SQL and app names stay aligned.

```javascript
export const INVENTORY_TABLES = {
  statuses: "inv_s_status",
  items: "inv_t_item",
  itemCategoryMap: "inv_m_itemcategory",
};
```