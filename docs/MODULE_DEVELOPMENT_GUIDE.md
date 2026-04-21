# Module Development Guide

## Document Purpose
This guide teaches developers how to build modules that plug into PSBUniverse Core correctly.

It focuses on:
1. Required module contract
2. Routing integration
3. Auth and RBAC usage
4. What to avoid

## 1) Module Role in the Architecture

Module responsibility is feature delivery.

Core responsibility remains:
1. Auth identity and business user mapping
2. App-level access checks
3. Route entry gating

Module responsibility is:
1. Feature/card loading
2. Card-level access checks
3. Domain UI and workflow logic

## 2) Required Module Structure

Create module under src/modules.

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

Minimum required file:
1. src/modules/<module-name>/index.js

## 3) Required Module Definition Contract

Each module must export a default object with this shape:

```js
import DashboardPage from "./pages/DashboardPage";

export default {
  key: "gutter",
  app_id: 1001,
  name: "Gutter",
  routes: [
    { path: "/gutter", component: DashboardPage },
    { path: "/gutter/settings", component: DashboardPage },
  ],
};
```

Field meaning:

| Field | Required | Purpose |
|---|---|---|
| key | Yes | Stable module identifier used by core/module tooling |
| app_id | Yes | Application ID used by core hasAppAccess checks |
| name | Yes | Human-readable module label |
| routes | Yes | Route definitions for dynamic module resolver |

## 4) How Modules Plug Into Core

1. Core loader scans src/modules/*/index.js.
2. Core imports module definitions at runtime.
3. Core dashboard lists modules user can access.
4. Core route resolver matches URL to module route.
5. Core access gate checks app_id authorization before rendering component.

## 4.1) Dashboard Source Resolution Order

Current dashboard behavior in `src/app/dashboard/page.js`:
1. Use setup-source-of-truth cards first (`psb_m_appcardgroup`, `psb_s_appcard`, `psb_m_appcardroleaccess`).
2. If setup cards are unavailable, fall back to dynamic module metadata from `loadModules()`.
3. If module metadata is unavailable, fall back to assigned app tiles from `psb_s_application`.

Implication for module teams:
1. Setup table records drive production visibility.
2. Module metadata is fallback behavior, not the primary source of access display.

## 5) Route Definition Rules

1. Use absolute route paths that start with slash.
2. Keep routes unique across modules.
3. Provide more specific paths when needed; core sorts by route length.
4. Do not define route handlers that bypass core routing flow.

## 6) How Modules Use Auth and Roles

Modules must use shared core auth context:

```js
import { useAuth } from "@/core/auth/useAuth";

function MyFeature() {
  const { authUser, dbUser, roles, loading } = useAuth();

  if (loading) return <p>Loading...</p>;
  if (!dbUser) return <p>No business user found.</p>;

  return <div>User ID: {dbUser.user_id}</div>;
}
```

Rules:
1. Do not call supabase.auth.getUser repeatedly in module components.
2. Use useAuth once and pass state down.

## 7) Card Access Pattern (Module Layer)

Core provides helper hasCardAccess(cardId, userRoles, cardRoleAccess).

Module should:
1. Load cards for its app_id
2. Load active card-role mappings
3. Filter cards by hasCardAccess

Example:

```js
import { hasCardAccess } from "@/core/auth/access";
import { useAuth } from "@/core/auth/useAuth";

function CardsView({ cards, cardRoleAccess }) {
  const { roles } = useAuth();

  const visibleCards = cards.filter((card) =>
    hasCardAccess(card.card_id, roles, cardRoleAccess)
  );

  return (
    <div>
      {visibleCards.map((card) => (
        <div key={card.card_id}>{card.card_name}</div>
      ))}
    </div>
  );
}
```

## 8) SQL Pattern for Module Card Loading

```sql
SELECT c.*, g.*
FROM psb_s_appcard c
JOIN psb_m_appcardgroup g ON g.group_id = c.group_id
WHERE c.app_id = :module_app_id
  AND c.is_active = true
ORDER BY g.display_order, c.display_order;
```

Card-role mapping query:

```sql
SELECT *
FROM psb_m_appcardroleaccess
WHERE is_active = true;
```

## 9) What Not To Do

Do not:
1. Create roles inside modules.
2. Assign user-role mappings inside modules.
3. Hardcode permission labels like if roleName is Admin.
4. Bypass hasCardAccess for sensitive features.
5. Store separate auth state inside module-local providers.

## 10) Module Development Checklist

Before opening a pull request:

1. Module exports key, app_id, name, routes.
2. All routes are valid and unique.
3. Module UI uses useAuth from core.
4. Card visibility uses hasCardAccess.
5. No module code attempts to override core app access rules.
6. No hardcoded permissions exist.

## 11) Recommended Module Build Sequence

1. Register app in psb_s_application.
2. Define roles in psb_s_role (governed centrally).
3. Add user-app-role mappings in psb_m_userapproleaccess.
4. Build module manifest and pages.
5. Add cards and card-role mappings.
6. Filter visible cards by role mapping.

Following this sequence keeps module development safe, predictable, and architecture-compliant.

_______________________________________________________________________________________________________________

PURPOSE OF MODULAR SUBAPPS (CORE ARCHITECTURE)
🎯 OBJECTIVE
Understand the architectural purpose of separating the system into:
•	Core App (PSB Universe Core) 
•	Sub Applications (Modules like Gutter Calculator, OHD Calculator, etc.) 
This is a modular SaaS architecture, not a monolithic app.
________________________________________
🧱 CORE IDEA (READ THIS FIRST)
We are building a system where:
The Core App is the platform, and
Sub Apps are independent modules that plug into it
If you treat everything as one app → you will destroy scalability, versioning, and maintainability.
________________________________________
🧩 WHY THIS EXISTS (NON-NEGOTIABLE REASONS)
1. 🔄 INDEPENDENT VERSIONING
Each sub app must:
•	Be deployable independently 
•	Be updatable without touching the core 
•	Not break other modules when changed 
Example:
•	Update Gutter Calculator v2 
•	Core remains untouched 
•	OHD Calculator unaffected 
If changing one module breaks another → your architecture is trash.
________________________________________
2. 🧱 ISOLATION OF RESPONSIBILITY
Each sub app:
•	Owns its own logic 
•	Owns its own UI 
•	Owns its own workflows 
Core should NOT:
•	Contain business logic of modules 
•	Be aware of internal implementation of sub apps 
Core only manages:
•	Authentication 
•	User management 
•	Role assignments 
•	Application registry 
•	Navigation 
________________________________________
3. 👥 ROLE-BASED ACCESS (PER APPLICATION)
Roles are:
•	Scoped per application (not global) 
Example:
User can be:
•	ADMIN in PSB Universe 
•	USER in Gutter Calculator 
•	No access in OHD Calculator 
This is why:
→ Applications and Roles are linked
________________________________________
4. 🧩 PLUG-AND-PLAY SYSTEM
New sub apps should:
•	Be registerable via Application Setup 
•	Appear automatically in the system 
•	Not require core modification 
If adding a new app requires changing core code → you failed.
________________________________________
5. 🛠️ TEAM SCALABILITY (CRITICAL FOR YOUR JR DEVS)
Different teams can:
•	Work on different sub apps 
•	Deploy independently 
•	Not step on each other 
Without modularization:
→ everyone edits the same codebase → chaos
________________________________________
6. 🔐 STABILITY OF CORE (LOCKED CORE PRINCIPLE)
Core must be:
•	Stable 
•	Rarely changed 
•	Treated as infrastructure 
Once core is “locked”:
•	Sub apps evolve around it 
•	Core does NOT constantly adjust for module needs 
If core keeps changing → you built it wrong.
________________________________________
🧠 HOW THIS AFFECTS YOUR CURRENT SYSTEM
Application Setup Page
This is:
The registry of sub apps
It defines:
•	What apps exist 
•	Their order 
•	Their activation state 
________________________________________
Roles per Application
This is:
Access control layer per module
________________________________________
Company / Department Setup
This is:
Organizational structure shared across modules
But:
•	Modules consume this data 
•	Core owns it 
________________________________________
⚙️ DEVELOPMENT RULES (STRICT)
🔒 Core Rules
•	Core must NOT depend on any sub app 
•	Core must NOT contain module-specific logic 
•	Core exposes shared services only 
________________________________________
🧩 Sub App Rules
Each sub app:
•	Can depend on core 
•	Must NOT affect other sub apps 
•	Must be self-contained 
________________________________________
🔄 Versioning Rules
•	Each sub app versioned independently 
•	Breaking changes must NOT affect core 
•	Backward compatibility must be considered 
________________________________________
❌ WHAT NOT TO DO (THIS WILL BREAK YOUR SYSTEM)
•	❌ Hardcoding module logic inside core 
•	❌ Sharing UI components without proper abstraction 
•	❌ Creating cross-module dependencies 
•	❌ Letting one module directly access another module’s data 
•	❌ Treating roles as global instead of per app 
________________________________________
🧪 MENTAL MODEL (USE THIS)
Think of:
•	Core = Operating System 
•	Sub Apps = Installed Applications 
Windows doesn’t break when you update Chrome.
That’s the level of isolation expected.
________________________________________
✅ SUCCESS CRITERIA
You understand this system correctly if:
•	You can add a new sub app WITHOUT touching core 
•	You can update a sub app WITHOUT affecting others 
•	You can assign roles PER application 
•	Core remains stable across changes

