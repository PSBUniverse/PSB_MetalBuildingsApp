# CRUD Example: Roles Module

A complete, working example of a module with full CRUD operations. Use this as a reference for understanding CRUD layering.

> **Note:** This example uses the **legacy** folder structure (model/repo/service/hook/component). New modules should use the current structure: `index.js` + `data/` + `pages/`. See [Module System](../02-architecture/module-system.md) for the current pattern.

---

## Folder Structure (Legacy)

```
src/modules/roles/
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
```

---

## 1. Model — Maps Database Columns to UI Fields

The model is a simple function that converts a raw database row into the shape your UI expects. This is your **protection layer** — if the database schema changes, you only update this one file.

```js
// model/roles.model.js

export function mapRole(row) {
  return {
    id: row.role_id,
    name: row.role_name,
    description: row.role_desc,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}
```

---

## 2. Repo — Supabase Queries Only

The repo is the only place that talks to Supabase. It sends queries and returns mapped data. No business logic here.

```js
// repo/roles.repo.js

import { supabase } from "@/core/supabase/client";
import { mapRole } from "../model/roles.model";

const TABLE = "psb_s_role";

export const rolesRepo = {
  async getAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data.map(mapRole);
  },

  async insert(payload) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        role_name: payload.name,
        role_desc: payload.description,
        is_active: true,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return mapRole(data);
  },

  async update(payload) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        role_name: payload.name,
        role_desc: payload.description,
        is_active: payload.isActive,
        updated_at: new Date(),
      })
      .eq("role_id", payload.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return mapRole(data);
  },

  async delete(id) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("role_id", id);

    if (error) throw new Error(error.message);
    return true;
  },
};
```

---

## 3. Service — Business Validation

The service adds any business rules on top of the repo. For simple modules this may be thin, but it's the right place for validation.

```js
// services/useRoles.js

import { rolesRepo } from "../repo/roles.repo";

export const useRolesService = {
  async getRoles() {
    return await rolesRepo.getAll();
  },

  async createRole(data) {
    if (!data.name) throw new Error("Role name is required");
    return await rolesRepo.insert(data);
  },

  async updateRole(data) {
    return await rolesRepo.update(data);
  },

  async deleteRole(id) {
    return await rolesRepo.delete(id);
  },
};
```

---

## 4. Hook — UI State Management

The hook connects the service to React state. Components use the hook instead of calling the service directly.

```js
// hooks/useRolesTable.js

import { useEffect, useState } from "react";
import { useRolesService } from "../services/useRoles";

export function useRolesTable() {
  const [data, setData] = useState([]);

  async function load() {
    const res = await useRolesService.getRoles();
    setData(res);
  }

  useEffect(() => {
    load();
  }, []);

  return {
    data,
    reload: load,
  };
}
```

---

## 5. Component — Pure UI

The component renders data and calls callbacks. It has no knowledge of where data comes from.

```js
// components/RolesTable.jsx

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
        {data.map((role) => (
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
}
```

---

## 6. Page — Orchestrator

The page wires everything together. It uses the hook for data and the service for actions.

```js
// pages/RolesPage.jsx

import RolesTable from "../components/RolesTable";
import { useRolesTable } from "../hooks/useRolesTable";
import { useRolesService } from "../services/useRoles";

export default function RolesPage() {
  const { data, reload } = useRolesTable();

  async function handleDelete(id) {
    await useRolesService.deleteRole(id);
    reload();
  }

  return (
    <div>
      <h1>Roles</h1>
      <RolesTable data={data} onDelete={handleDelete} />
    </div>
  );
}
```

---

## 7. Module Index

```js
// index.js

export default {
  key: "roles",
  module_key: "roles-app",
  name: "Roles",
  routes: [
    { path: "/roles", page: "RolesPage" },
  ],
};
```

---

## Why This Structure Works

| Layer | Responsibility | Depends On |
|-------|---------------|------------|
| Model | Maps DB columns → UI fields | Nothing |
| Repo | Sends Supabase queries, returns mapped data | Model |
| Service | Business rules and validation | Repo |
| Hook | Connects service to React state | Service |
| Component | Renders UI, calls callbacks | Nothing (pure props) |
| Page | Wires hook + service + component together | Hook, Service, Component |

The key line is:

```js
return data.map(mapRole);
```

That's your entire protection layer between the database and your UI. Remove it and your system degrades fast.
