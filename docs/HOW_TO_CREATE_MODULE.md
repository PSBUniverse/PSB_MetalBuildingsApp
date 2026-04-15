# HOW TO CREATE MODULE (Step-by-Step, Beginner-Proof)

This guide shows exactly how to create a new module feature from this shell.

We will use an example module named inventory.

Goal:

- Add a new page
- Add API endpoints
- Add service logic
- Keep code clean and easy for teams

## 1) Before You Start

Decide these 3 names first:

1. Module key: `inventory`
2. App key for access control: for example `inventory-app`
3. DB table prefix: for example `inv`

Use naming convention for tables:

- `inv_s_*` for setup/master tables
- `inv_t_*` for transaction tables
- `inv_m_*` for mapping tables

Reference: [DATABASE_TABLE_NAMING.md](DATABASE_TABLE_NAMING.md)

Why this matters:

- Naming consistency prevents confusion later.

## 2) Create Module Folder Structure

Create folder:

- `src/modules/inventory`

Create subfolders:

- `src/modules/inventory/components`
- `src/modules/inventory/services`
- `src/modules/inventory/hooks`
- `src/modules/inventory/validators`
- `src/modules/inventory/types`

Real-life analogy:

- Think of this as creating a new classroom with desks for different jobs.

## 3) Add the Page Component

Create file:

- `src/modules/inventory/components/inventory.page.js`

Example starter:

```javascript
"use client";

export default function InventoryPage() {
  return (
    <div className="py-4">
      <h2>Inventory</h2>
      <p>This is the Inventory module home page.</p>
    </div>
  );
}
```

What this file does:

- It is the visible screen users will see.

## 4) Add Protected Route Wrapper

Create file:

- `src/app/(protected)/inventory/page.js`

Example:

```javascript
import InventoryPage from "@/modules/inventory/components/inventory.page";

export default function InventoryRoutePage() {
  return <InventoryPage />;
}
```

What this file does:

- Connects URL `/inventory` to your module page.

Important rule:

- Keep wrapper thin. No business logic here.

## 5) Add API Route Wrapper

Create file:

- `src/app/api/inventory/items/route.js`

Example:

```javascript
import {
  GET as inventoryItemsGet,
  POST as inventoryItemsPost,
} from "@/modules/inventory/services/inventory-items.service";

export const GET = inventoryItemsGet;
export const POST = inventoryItemsPost;
```

What this file does:

- Connects API URL `/api/inventory/items` to service logic.

## 6) Add Service File (Server Logic)

Create file:

- `src/modules/inventory/services/inventory-items.service.js`

Example:

```javascript
import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/infrastructure/supabase/server";

export async function GET() {
  try {
    const supabase = getServerSupabaseClient();

    const { data, error } = await supabase
      .from("inv_t_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, items: data || [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const supabase = getServerSupabaseClient();

    const payload = {
      item_name: String(body?.itemName || "").trim(),
      item_price: Number(body?.itemPrice || 0),
      is_active: true,
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

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

What this file does:

- Talks to database.
- Validates input.
- Returns clean JSON responses.

## 7) Add Hook File (Client Data Logic)

Create file:

- `src/modules/inventory/hooks/useInventoryItems.js`

Example:

```javascript
"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchInventoryItems() {
  const response = await fetch("/api/inventory/items", { cache: "no-store" });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error || "Unable to load inventory items");
  }

  return payload?.items || [];
}

export function useInventoryItems() {
  return useQuery({
    queryKey: ["inventory", "items"],
    queryFn: fetchInventoryItems,
  });
}
```

What this file does:

- Keeps fetch logic reusable and simple for UI files.

## 8) Connect Hook to Page

Update page component to use hook:

```javascript
"use client";

import { useInventoryItems } from "@/modules/inventory/hooks/useInventoryItems";

export default function InventoryPage() {
  const { data: items = [], isLoading, error } = useInventoryItems();

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="py-4">
      <h2>Inventory</h2>
      <ul>
        {items.map((item) => (
          <li key={item.item_id}>{item.item_name}</li>
        ))}
      </ul>
    </div>
  );
}
```

Now full flow works:

- UI -> Hook -> API -> Service -> Database -> UI update.

## 9) Register Launch Card (Shell Setup)

In setup cards (admin), create app card with launch URL.

Example:

- `https://inventory.company.com/inventory`

Why:

- Shell can launch module apps using full URL.

## 10) Add Access Mapping

Make sure user roles are mapped to app key.

If app access is missing:

- User can log in but still be blocked from module features.

## 11) DOs and DONTs

DO:

1. Keep route wrappers thin.
2. Put DB logic in services.
3. Put reusable state logic in hooks.
4. Validate request input in services.
5. Return consistent JSON shape (`success`, `error`, payload data).

DONT:

1. Do not query Supabase directly in route wrapper page files.
2. Do not put huge logic inside UI components.
3. Do not hardcode credentials or secrets.
4. Do not skip access checks for protected data.
5. Do not invent random naming conventions per module.

## 12) Common Mistakes (Callouts)

Mistake: Creating page component but forgetting route wrapper.

- Result: URL returns 404.

Mistake: Creating API service but forgetting `src/app/api/.../route.js` wrapper.

- Result: frontend fetch gets 404.

Mistake: Using browser Supabase client for privileged writes.

- Result: permission/security issues.

Mistake: No input validation.

- Result: bad data in DB and hard-to-fix bugs.

Mistake: Putting module code in shell repo.

- Result: shell stops being clean platform.

## 13) Beginner Checklist (Copy This)

- [ ] Created module folders under `src/modules/<module>`
- [ ] Created module page component
- [ ] Added protected route wrapper in `src/app/(protected)`
- [ ] Added API route wrapper in `src/app/api`
- [ ] Added service with CRUD logic
- [ ] Added hook for data loading
- [ ] Connected page to hook
- [ ] Registered launch card URL
- [ ] Added role/app access mappings
- [ ] Tested success and error scenarios

If all boxes are checked, your module foundation is correctly set up.