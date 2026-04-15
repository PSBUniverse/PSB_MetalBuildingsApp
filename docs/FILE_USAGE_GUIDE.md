# FILE USAGE GUIDE (How Files Work Together)

This guide explains how files should interact in this project.

Goal:

- Keep code organized
- Avoid putting logic in wrong places
- Help beginners know where to write code

## 1) The Big Rule: One File, One Job

Think of a restaurant:

- Waiter = UI component
- Order slip = hook
- Kitchen = service
- Storage room = database

If waiter also cooks, chaos starts.

Same in code.

Keep each file doing its own job.

## 2) File Roles (When to Use What)

### Components

Where:

- `src/shared/components`
- `src/modules/*/components`

Use for:

- Visual UI (forms, cards, page rendering)

Do not use for:

- Heavy DB logic
- Complex permission checks

### Hooks

Where:

- `src/modules/*/hooks`

Use for:

- Reusable state/data logic
- React Query usage

Do not use for:

- Raw route exports
- Big server-only operations

### Services

Where:

- `src/modules/*/services`

Use for:

- API method handlers (`GET`, `POST`, `PATCH`, `DELETE`)
- Validation
- Supabase operations
- Access checks

Do not use for:

- UI rendering

### Utilities

Where:

- `src/shared/utils`

Use for:

- Small helper functions reused by many places

Do not use for:

- Large feature logic tied to one module

### API route wrappers

Where:

- `src/app/api/**/route.js`

Use for:

- Method forwarding to services

Do not use for:

- Large business logic

## 3) How Import/Export Works (Simple)

### Named export

Use when file exports multiple things.

Example:

```javascript
export async function GET() {}
export async function POST() {}
```

Import:

```javascript
import { GET, POST } from "@/modules/inventory/services/inventory-items.service";
```

### Default export

Use when file has one main thing (often a page component).

Example:

```javascript
export default function InventoryPage() {}
```

Import:

```javascript
import InventoryPage from "@/modules/inventory/components/inventory.page";
```

## 4) Data Flow Example (UI to Database)

Example action:

- User clicks Save Item.

Flow:

1. Component button click handler runs.
2. Hook or local function sends fetch request to `/api/inventory/items`.
3. API route wrapper receives request.
4. Wrapper calls service function.
5. Service validates body and calls Supabase.
6. Service returns JSON result.
7. Component shows success/error and updates list.

Short version:

Component -> Hook -> API route -> Service -> Supabase -> Service -> Component.

## 5) Real Project Pattern Used in This Shell

### Example A: Login API

- Route wrapper: `src/app/api/auth/login/route.js`
- Service logic: `src/modules/user-master/services/user-master-login.service.js`

Meaning:

- Route file is just connector.
- Service file contains real logic.

### Example B: Setup Cards API

- Route wrapper: `src/app/api/setup/cards/route.js`
- Service logic: `src/modules/user-master/services/user-master-setup-cards.service.js`

Meaning:

- Clean separation keeps code easier to test and maintain.

### Example C: Protected app shell

- Layout route: `src/app/(protected)/layout.js`
- Shell logic: `src/shared/components/layout/AppLayout.js`
- Header UI: `src/shared/components/layout/Header.js`

Meaning:

- Routing, shell control, and UI are separated by purpose.

## 6) How UI Connects to Database (Beginner Steps)

1. Build UI component in module components folder.
2. Build fetch logic in hook.
3. Create API wrapper in `src/app/api`.
4. Create service with Supabase queries.
5. Return JSON.
6. In UI, show loading, success, and error states.

## 7) File Naming Suggestions

Use predictable names.

Examples:

- Page component: `inventory.page.js`
- Hook: `useInventoryItems.js`
- Service: `inventory-items.service.js`
- Validator: `inventory-item.validator.js`

Why:

- New developers can find files faster.

## 8) Common File Usage Mistakes

Mistake: putting fetch/Supabase code directly in page components.

- Why bad: page becomes huge and hard to test.

Mistake: writing big logic inside `src/app/api/**/route.js`.

- Why bad: route wrappers should stay tiny.

Mistake: duplicate helper functions in many files.

- Why bad: bug fixes must be repeated everywhere.

Mistake: importing from deep relative paths (`../../../../`).

- Why bad: hard to read and easy to break.

Better:

- Use alias imports with `@/` configured by `jsconfig.json`.

## 9) Beginner-Friendly Build Order for New Feature

1. Create component UI.
2. Create service API methods.
3. Create API route wrapper.
4. Create hook to fetch/mutate.
5. Connect hook in component.
6. Test success path.
7. Test error path.

## 10) Quick Decision Matrix

Question: "Where should this code go?"

- Is it visual? -> component
- Is it reusable state/fetch behavior? -> hook
- Is it database/business logic? -> service
- Is it tiny reusable helper? -> utils
- Is it URL endpoint mapping? -> route wrapper

## 11) Final Beginner Reminder

If you feel stuck, ask this:

- "Is this file showing UI or doing logic?"

If both are mixed heavily, split it.

Clean separation today saves many hours later.