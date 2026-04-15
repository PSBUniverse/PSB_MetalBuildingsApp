# CRUD SUPABASE (Explain Like You Are New)

This guide explains Supabase in very simple words.

If you have never touched databases before, this is for you.

## 1) What Is Supabase?

Supabase is an online database system plus tools.

Simple meaning:

- It stores your app data (users, cards, roles, items).
- Your app can read and change that data.

Real-life analogy:

- Supabase is like a giant digital notebook.
- Tables are notebook pages.
- Rows are lines on each page.
- Columns are labeled boxes on each line.

## 2) CRUD Means What?

CRUD is four basic actions:

1. Create -> add new data
2. Read -> get data
3. Update -> change existing data
4. Delete -> remove data

Real-life analogy (library):

- Create: add a new book record
- Read: list books
- Update: fix book title
- Delete: remove old book record

## 2.5) Database Tables And Naming Convention (Important)

In this project, table names follow a predictable pattern:

- `<module_prefix>_<table_type>_<entity_name>`

Examples:

- `psb_s_user`
- `inv_t_items`
- `psb_m_userapproleaccess`

Table type meaning:

- `s` = setup/master/reference data
- `t` = transaction data
- `m` = mapping/join table

How to use this in code:

1. Keep a single table map constant per module.
2. Query using constants (not random repeated strings).
3. Keep SQL table names and app constants exactly matched.

Example:

```javascript
const INVENTORY_TABLES = {
  items: "inv_t_items",
};

const { data, error } = await supabase
  .from(INVENTORY_TABLES.items)
  .select("*")
  .order("created_at", { ascending: false });
```

For full rules and more examples, read [DATABASE_TABLE_NAMING.md](DATABASE_TABLE_NAMING.md).

## 3) Supabase Methods Explained One by One

### Method: .from("table_name")

What it does:

- Picks which table you want to work with.

Real-life example:

- Choosing which notebook page to open.

Code example:

```javascript
supabase.from("psb_s_user")
```

### Method: .select("columns")

What it does:

- Reads data from selected columns.

Real-life example:

- Asking for student names and grades from the school record page.

Code example:

```javascript
supabase.from("psb_s_user").select("user_id, username, email")
```

### Method: .insert(payload)

What it does:

- Adds new row(s).

Real-life example:

- Adding a new student to class list.

Code example:

```javascript
supabase.from("psb_s_user").insert({ username: "sam", email: "sam@site.com" })
```

### Method: .update(updates)

What it does:

- Changes existing row values.

Real-life example:

- Updating a student's phone number.

Code example:

```javascript
supabase.from("psb_s_user").update({ phone: "123-456-7890" }).eq("user_id", 10)
```

### Method: .delete()

What it does:

- Deletes rows that match filter.

Real-life example:

- Removing a duplicate record from registry.

Code example:

```javascript
supabase.from("psb_s_user").delete().eq("user_id", 10)
```

### Method: .eq("column", value)

What it does:

- Filter rows where column is exactly value.

Real-life example:

- "Give me records where class_id equals 5."

Code example:

```javascript
supabase.from("psb_s_user").select("*").eq("status_id", 1)
```

### Method: .order("column", { ascending: true/false })

What it does:

- Sorts returned rows.

Real-life example:

- Sort students by latest created date.

Code example:

```javascript
supabase.from("psb_s_user").select("*").order("created_at", { ascending: false })
```

### Method: .single()

What it does:

- Says: I expect exactly one row.

Real-life example:

- Asking office for exactly one student record by ID.

Code example:

```javascript
supabase.from("psb_s_user").select("*").eq("user_id", 10).single()
```

### Method: .maybeSingle()

What it does:

- Returns one row or null (without throwing for "no row" case).

Real-life example:

- "Find this person, but if not found, just say none."

Code example:

```javascript
supabase.from("psb_s_user").select("*").eq("user_id", 10).maybeSingle()
```

### Method: .limit(number)

What it does:

- Returns only first N rows.

Real-life example:

- Show top 10 latest entries.

Code example:

```javascript
supabase.from("psb_s_user").select("*").limit(10)
```

## 4) Full CRUD Example (Server Route Style)

Example table:

- `inv_t_items`

Columns (example):

- `item_id`
- `item_name`
- `item_price`
- `is_active`
- `created_at`

Create file:

- `src/modules/inventory/services/inventory-items.service.js`

```javascript
import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/infrastructure/supabase/server";

export async function GET(request) {
  try {
    const supabase = getServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const itemId = Number(searchParams.get("itemId") || 0);

    let query = supabase.from("inv_t_items").select("*").order("created_at", { ascending: false });

    if (itemId > 0) {
      query = supabase.from("inv_t_items").select("*").eq("item_id", itemId).single();
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = getServerSupabaseClient();
    const body = await request.json();

    const payload = {
      item_name: String(body?.itemName || "").trim(),
      item_price: Number(body?.itemPrice || 0),
      is_active: Boolean(body?.isActive ?? true),
    };

    if (!payload.item_name) {
      return NextResponse.json({ success: false, error: "itemName is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("inv_t_items")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const supabase = getServerSupabaseClient();
    const body = await request.json();

    const itemId = Number(body?.itemId || 0);
    if (!itemId) {
      return NextResponse.json({ success: false, error: "itemId is required" }, { status: 400 });
    }

    const updates = {
      item_name: String(body?.itemName || "").trim(),
      item_price: Number(body?.itemPrice || 0),
      is_active: Boolean(body?.isActive ?? true),
    };

    const { data, error } = await supabase
      .from("inv_t_items")
      .update(updates)
      .eq("item_id", itemId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const supabase = getServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const itemId = Number(searchParams.get("itemId") || 0);

    if (!itemId) {
      return NextResponse.json({ success: false, error: "itemId is required" }, { status: 400 });
    }

    const { error } = await supabase.from("inv_t_items").delete().eq("item_id", itemId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

## 5) Error Handling (Very Important)

Always check these things:

1. Input is valid before query.
2. Supabase returned no error.
3. Response status code makes sense.
4. Return clear message for frontend.

Simple response style you should keep:

```json
{ "success": true, "data": [] }
```

or

```json
{ "success": false, "error": "Clear message here" }
```

## 6) Common Mistakes and How to Avoid Them

Mistake: Calling `.single()` when many rows may exist.

- Problem: runtime error.
- Fix: use `.select(...)` without `.single()`.

Mistake: Missing filter on update/delete.

- Problem: can affect too many rows.
- Fix: always add `.eq(...)` with clear primary key.

Mistake: Trusting frontend values blindly.

- Problem: bad or unsafe data.
- Fix: validate and sanitize inside server service.

Mistake: Using service role key in client-side code.

- Problem: security risk.
- Fix: service role key only in server files.

Mistake: Not handling `error` from Supabase.

- Problem: silent failures.
- Fix: always check `if (error)` and return meaningful error response.

## 7) Which Supabase Client to Use

- Browser UI reads: use client-side helpers with safe anon key.
- Protected/privileged server CRUD: use server client from `src/infrastructure/supabase/server.js`.
- Admin-level operations: use admin client from `src/infrastructure/supabase/admin.js` when required.

## 8) Beginner Memory Trick

Use this sentence:

- from = choose table
- select = read
- insert = create
- update = change
- delete = remove
- eq = filter exact rows
- order = sort
- single = one row only

If you remember this list, you can already do real CRUD work.