# Getting Started (Shell/Base)

This guide is for the PSBUniverse shell repository.

Use this repo as the base framework that will be cloned for each module project (for example PSB_GutterApp, PSB_OHDApp, PSB_MetalBuildingsApp).

## 1. Prerequisites

1. Install Node.js 20+ and npm 10+.
2. Install Git.
3. Get Supabase project access (URL, anon key, service role key).

## 2. Local Setup

1. Install dependencies.

```bash
npm install
```

2. Create `.env.local` in the repository root.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
USER_MASTER_SESSION_SECRET=your_long_random_secret
```

3. Run the app.

```bash
npm run dev
```

4. Validate before commit.

```bash
npm run lint
npm run build
```

## 3. Create Your First Module Project (Step by Step)

This creates a full module repository from the shell.

1. Clone/copy the shell into a new folder.

```text
PSBUniverse -> PSB_InventoryApp
```

2. Keep full app structure. Do NOT strip shared folders.

```text
src/app
src/core
src/infrastructure
src/modules
src/providers
src/shared
src/styles
```

3. Create module folder.

```text
src/modules/inventory/
  components/
  services/
  hooks/
  validators/
  types/
```

4. Add protected route wrapper.

```text
src/app/(protected)/inventory/page.js
```

```javascript
import InventoryPage from "@/modules/inventory/components/inventory.page";

export default function InventoryRoutePage() {
  return <InventoryPage />;
}
```

5. Add API route wrapper.

```text
src/app/api/inventory/items/route.js
```

```javascript
import { GET as itemsGet, POST as itemsPost } from "@/modules/inventory/services/inventory-items.service";

export const GET = itemsGet;
export const POST = itemsPost;
```

6. Register the module card from Setup Admin in the shell using a full launch URL.

Example launch URL:

```text
https://inventory.company.com/inventory
```

7. Confirm module access rules exist in user/role/app mappings before testing.

## 4. Rules and Naming Conventions

### 4.1 Database Naming

Use snake_case for tables and columns.

Recommended table patterns:

1. `core_s_*` for shared setup/master tables.
2. `<module>_t_*` for transactional records.
3. `<module>_m_*` for mapping/detail records.

Recommended module prefixes:

1. `gtr` for gutter.
2. `ohd` for OHD.
3. `mbl` for metal buildings.
4. choose one stable 3-letter prefix for new modules.

Examples:

1. `ohd_t_projects`
2. `ohd_m_project_items`
3. `mbl_t_quotes`

### 4.2 Module File Naming

1. Components: `<module>-<feature>.page.js` or `<feature>.page.js`
2. Services: `<module>-<feature>.service.js`
3. Hooks: `use<Feature>.js`
4. Validators: `<feature>.validator.js`
5. Route wrappers stay thin (import and export page/service only).

## 5. How to CRUD with Supabase

Use server route handlers for writes and protected reads.

### Read (GET)

```javascript
const { data, error } = await supabase
  .from("ohd_t_projects")
  .select("*")
  .order("created_at", { ascending: false });
```

### Create (POST)

```javascript
const { data, error } = await supabase
  .from("ohd_t_projects")
  .insert(payload)
  .select("*")
  .single();
```

### Update (PATCH)

```javascript
const { data, error } = await supabase
  .from("ohd_t_projects")
  .update(updates)
  .eq("proj_id", projId)
  .select("*")
  .single();
```

### Delete (DELETE)

```javascript
const { error } = await supabase
  .from("ohd_t_projects")
  .delete()
  .eq("proj_id", projId);
```

Rules:

1. Validate input first.
2. Return consistent JSON responses.
3. Use cache invalidation after successful mutations.

## 6. Session-Based User Model

PSBUniverse uses session cookies, not token-in-URL.

Flow:

1. Login API validates password and writes signed cookie.
2. Protected APIs call auth context helpers to resolve session user.
3. Access is role/app-based using user-role-app mapping tables.

Implementation points:

1. Session cookie helpers: `src/modules/user-master/session/user-master.session.js`
2. Auth context guard: `src/modules/user-master/services/user-master-route-auth.service.js`
3. Client session access query: `src/modules/user-master/cache/user-master.query.js`

Rules:

1. Never trust client user IDs in request body.
2. Always resolve user from session on the server.
3. Keep `USER_MASTER_SESSION_SECRET` set in every environment.

## 7. When to Use Querystrings (GET and POST)

### Use querystrings for GET

Use query parameters for fetch filters and retrieval context.

Examples:

1. `/api/projects?projId=123`
2. `/api/items?status=active&page=2&limit=50`

### POST default: use JSON body

Create/update payloads belong in body, not in query.

Examples:

1. Good: `POST /api/items` with `{ name, price, status }` in body.
2. Avoid: `POST /api/items?name=...&price=...`

### POST with querystring is allowed only for small context flags

Examples:

1. `POST /api/setup/cards?appKey=admin-config`
2. `POST /api/files/upload?dryRun=true`

Rules:

1. Never put secrets in querystrings.
2. Keep querystrings idempotent/context-like.
3. Keep business payload in body.

## 8. Base Project Rules

1. PSBUniverse stays shell/base framework.
2. Module-specific business logic lives in module repositories.
3. Shell changes must remain module-agnostic.
4. New module repos are created by cloning the shell, then adding module code.

### 6. Copy/Paste Starter Template

Use this as a quick starting point.

#### Folder Template

```text
src/modules/<app-name>/
	components/
		<app-name>.page.js
	services/
		<app-name>.service.js
	hooks/
		use<AppName>.js
	validators/
		<app-name>.validator.js

src/app/(protected)/<app-name>/
	page.js
```

#### Route File Template (thin only)

```javascript
import AppPage from "@/modules/<app-name>/components/<app-name>.page";

export default function AppRoutePage() {
	return <AppPage />;
}
```

#### Page Component Template

```javascript
"use client";

import { useEffect, useState } from "react";
import { load<AppName>Items } from "@/modules/<app-name>/services/<app-name>.service";

export default function AppPage() {
	const [items, setItems] = useState([]);

	useEffect(() => {
		async function load() {
			const data = await load<AppName>Items();
			setItems(data);
		}
		load();
	}, []);

	return (
		<main>
			<h2><AppName></h2>
			<p>Total items: {items.length}</p>
		</main>
	);
}
```

#### Service Template

```javascript
import { supabase } from "@/infrastructure/supabase/client";

export async function load<AppName>Items() {
	const { data, error } = await supabase
		.from("<table_name>")
		.select("*")
		.order("id", { ascending: true });

	if (error) throw error;
	return data || [];
}
```

Tip:

- Replace <app-name>, <AppName>, and <table_name> first.
- Keep all logic in module files, not in src/app route files.

