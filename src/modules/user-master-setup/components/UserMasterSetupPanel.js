"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Input,
  SetupTable,
  toastError,
  toastInfo,
  toastSuccess,
  toastWarning,
} from "@/shared/components/ui";

const TABS = [
  {
    key: "profile",
    label: "Profile",
    description: "Core identity and contact details for the selected user.",
  },
  {
    key: "organization",
    label: "Organization",
    description: "Company assignment, department hierarchy, position, and workflow status.",
  },
  {
    key: "access",
    label: "Access",
    description: "Application and role mappings for what the user can access.",
  },
  {
    key: "account",
    label: "Account",
    description: "Authentication account controls and last login activity.",
  },
];

const EMPTY_LOOKUPS = {
  companies: [],
  departments: [],
  statuses: [],
  applications: [],
  roles: [],
};

function createEmptyPendingBatch() {
  return {
    creates: [],
    updates: {},
    accessUpserts: {},
    accessDeletes: {},
  };
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  const text = normalizeText(value).toLowerCase();
  return text || "";
}

function normalizeOptionalText(value) {
  const text = normalizeText(value);
  return text === "" ? null : text;
}

function asChoiceValue(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function rowIdOf(row) {
  return String(row?.id ?? row?.user_id ?? "");
}

function isTemporaryId(value) {
  return normalizeText(value).startsWith("tmp-");
}

function isTruthy(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const text = normalizeText(value).toLowerCase();
  if (!text) {
    return false;
  }

  return !(text === "false" || text === "0" || text === "f" || text === "n" || text === "no");
}

function inferActiveFromStatus(statusId, statuses, fallback = true) {
  const status = (Array.isArray(statuses) ? statuses : []).find((entry) => String(entry?.status_id) === String(statusId));

  if (!status) {
    return Boolean(fallback);
  }

  const label = normalizeText(status?.label).toLowerCase();
  if (!label) {
    return Boolean(fallback);
  }

  if (/(inactive|deactiv|disable|suspend|closed|terminated)/.test(label)) {
    return false;
  }

  if (/(active|enable|open)/.test(label)) {
    return true;
  }

  return Boolean(fallback);
}

function formatDateForInput(value) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }

  if (text.includes("T")) {
    return text.split("T")[0];
  }

  return text;
}

function formatDateTime(value) {
  const text = normalizeText(value);
  if (!text) {
    return "--";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toLocaleString();
}

function buildFullName(form) {
  const firstName = normalizeText(form?.first_name);
  const middleName = normalizeText(form?.middle_name);
  const lastName = normalizeText(form?.last_name);
  const username = normalizeText(form?.username);

  if (!firstName && !lastName) {
    return username;
  }

  const composed = [firstName, middleName, lastName]
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .join(" ")
    .trim();

  if (composed) {
    return composed;
  }

  return username;
}

function createEmptyForm(defaultStatusId = null, statuses = []) {
  const resolvedStatusId = defaultStatusId ?? null;

  return {
    username: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    comp_id: null,
    dept_id: null,
    position: "",
    hire_date: "",
    status_id: resolvedStatusId,
    is_active: inferActiveFromStatus(resolvedStatusId, statuses, true),
    last_login_at: "",
  };
}

function createFormFromUser(user, fallbackStatusId, statuses) {
  const statusId = user?.status_id ?? fallbackStatusId ?? null;
  const firstName = normalizeText(user?.first_name);
  const middleName = normalizeText(user?.middle_name);
  const lastName = normalizeText(user?.last_name);

  return {
    username: normalizeText(user?.username),
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    email: normalizeText(user?.email),
    phone: normalizeText(user?.phone),
    address: normalizeText(user?.address),
    comp_id: user?.comp_id ?? null,
    dept_id: user?.dept_id ?? null,
    position: normalizeText(user?.position),
    hire_date: formatDateForInput(user?.hire_date),
    status_id: statusId,
    is_active: hasOwn(user, "is_active")
      ? isTruthy(user?.is_active)
      : inferActiveFromStatus(statusId, statuses, true),
    last_login_at: normalizeText(user?.last_login_at),
  };
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

function cloneForm(form) {
  return {
    ...form,
  };
}

function cloneAccessRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
  }));
}

function findLabel(options, idKey, idValue) {
  const source = Array.isArray(options) ? options : [];
  const matched = source.find((item) => String(item?.[idKey]) === String(idValue));
  return normalizeText(matched?.label) || "--";
}

function summarizeUserRow(form, lookups, previousRow = {}) {
  const fullName = buildFullName(form) || "--";
  const statusLabel = findLabel(lookups?.statuses, "status_id", form?.status_id)
    || (form?.is_active ? "ACTIVE" : "INACTIVE");

  return {
    ...previousRow,
    id: previousRow?.id ?? previousRow?.user_id,
    user_id: previousRow?.user_id ?? previousRow?.id,
    username: normalizeText(form?.username) || "--",
    full_name: fullName,
    display_name: fullName,
    email: normalizeText(form?.email) || "--",
    company_name: findLabel(lookups?.companies, "comp_id", form?.comp_id),
    department_name: findLabel(lookups?.departments, "dept_id", form?.dept_id),
    status_label: statusLabel.toUpperCase(),
    status_id: form?.status_id ?? null,
    comp_id: form?.comp_id ?? null,
    dept_id: form?.dept_id ?? null,
    is_active: Boolean(form?.is_active),
  };
}

function makeLocalAccessRow(appId, roleId, lookups, current = {}) {
  const applicationName = findLabel(lookups?.applications, "app_id", appId);
  const roleName = findLabel(lookups?.roles, "role_id", roleId);
  const generatedKey = `${String(appId)}::${String(roleId)}::${Date.now().toString(36)}`;

  return {
    ...current,
    access_key: current?.access_key || generatedKey,
    app_id: appId,
    role_id: roleId,
    application_name: applicationName,
    role_name: roleName,
    is_active: true,
  };
}

function toAccessSet(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const mapValue = new Map();

  source.forEach((row) => {
    if (!row || !isTruthy(row?.is_active)) {
      return;
    }

    const appId = normalizeText(row?.app_id);
    const roleId = normalizeText(row?.role_id);

    if (!appId || !roleId) {
      return;
    }

    const key = `${appId}::${roleId}`;
    if (!mapValue.has(key)) {
      mapValue.set(key, {
        app_id: appId,
        role_id: roleId,
      });
    }
  });

  return mapValue;
}

function diffAccessRows(originalRows, currentRows) {
  const originalSet = toAccessSet(originalRows);
  const currentSet = toAccessSet(currentRows);

  const deletes = [];
  originalSet.forEach((value, key) => {
    if (!currentSet.has(key)) {
      deletes.push(value);
    }
  });

  const upserts = [];
  currentSet.forEach((value, key) => {
    if (!originalSet.has(key)) {
      upserts.push(value);
    }
  });

  return {
    deletes,
    upserts,
  };
}

function buildUserPayload(form, password) {
  return {
    username: normalizeText(form?.username),
    email: normalizeEmail(form?.email),
    first_name: normalizeOptionalText(form?.first_name),
    middle_name: normalizeOptionalText(form?.middle_name),
    last_name: normalizeOptionalText(form?.last_name),
    phone: normalizeOptionalText(form?.phone),
    address: normalizeOptionalText(form?.address),
    comp_id: normalizeOptionalText(form?.comp_id),
    dept_id: normalizeOptionalText(form?.dept_id),
    position: normalizeOptionalText(form?.position),
    hire_date: normalizeOptionalText(form?.hire_date),
    status_id: normalizeOptionalText(form?.status_id),
    is_active: Boolean(form?.is_active),
    ...(normalizeText(password) ? { password: normalizeText(password) } : {}),
  };
}

function buildPanelSnapshot(form, accessRows, setNewPassword, password, confirmPassword) {
  const accessPayload = (Array.isArray(accessRows) ? accessRows : [])
    .map((row) => ({
      app_id: normalizeText(row?.app_id),
      role_id: normalizeText(row?.role_id),
      is_active: isTruthy(row?.is_active),
    }))
    .filter((row) => row.app_id && row.role_id)
    .sort((left, right) => `${left.app_id}:${left.role_id}`.localeCompare(`${right.app_id}:${right.role_id}`));

  const payload = {
    form: {
      username: normalizeText(form?.username),
      first_name: normalizeText(form?.first_name),
      middle_name: normalizeText(form?.middle_name),
      last_name: normalizeText(form?.last_name),
      email: normalizeText(form?.email),
      phone: normalizeText(form?.phone),
      address: normalizeText(form?.address),
      comp_id: normalizeText(form?.comp_id),
      dept_id: normalizeText(form?.dept_id),
      position: normalizeText(form?.position),
      hire_date: normalizeText(form?.hire_date),
      status_id: normalizeText(form?.status_id),
      is_active: isTruthy(form?.is_active),
    },
    access: accessPayload,
    password: setNewPassword ? normalizeText(password) : "",
    password_confirm: setNewPassword ? normalizeText(confirmPassword) : "",
  };

  return JSON.stringify(payload);
}

async function parseJsonResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || fallbackMessage);
  }

  return payload;
}

function pendingBatchCount(batch) {
  const createsCount = Array.isArray(batch?.creates) ? batch.creates.length : 0;
  const updatesCount = Object.keys(batch?.updates || {}).length;
  const accessUpsertsCount = Object.values(batch?.accessUpserts || {}).reduce((sum, rows) => sum + (rows?.length || 0), 0);
  const accessDeletesCount = Object.values(batch?.accessDeletes || {}).reduce((sum, rows) => sum + (rows?.length || 0), 0);

  return createsCount + updatesCount + accessUpsertsCount + accessDeletesCount;
}

function replaceObjectKeyWithArray(source, key, rows) {
  const next = {
    ...(source || {}),
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    delete next[key];
    return next;
  }

  next[key] = rows;
  return next;
}

function removeObjectKey(source, key) {
  const next = {
    ...(source || {}),
  };

  delete next[key];
  return next;
}

export function UserMasterSetupPanel({ users = [], totalUsers = 0 }) {
  const [tableRows, setTableRows] = useState(Array.isArray(users) ? users : []);
  const [lookups, setLookups] = useState(EMPTY_LOOKUPS);
  const [pendingBatch, setPendingBatch] = useState(createEmptyPendingBatch);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [isStaging, setIsStaging] = useState(false);
  const [isDeactivatingUser, setIsDeactivatingUser] = useState(false);

  const [userHeaderMenuState, setUserHeaderMenuState] = useState({
    open: false,
    x: 0,
    y: 0,
  });
  const [userColumnVisibility, setUserColumnVisibility] = useState({});

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState("view");
  const [panelUserId, setPanelUserId] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [isPanelLoading, setIsPanelLoading] = useState(false);

  const [form, setForm] = useState(createEmptyForm());
  const [baselineForm, setBaselineForm] = useState(createEmptyForm());
  const [accessRows, setAccessRows] = useState([]);
  const [baselineAccessRows, setBaselineAccessRows] = useState([]);

  const [enableNewPassword, setEnableNewPassword] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [accessEditor, setAccessEditor] = useState({
    mode: null,
    access_key: null,
    original_app_id: "",
    original_role_id: "",
    app_id: "",
    role_id: "",
  });

  const [baselineSnapshot, setBaselineSnapshot] = useState(
    buildPanelSnapshot(createEmptyForm(), [], false, "", ""),
  );

  const panelSnapshot = useMemo(
    () => buildPanelSnapshot(form, accessRows, enableNewPassword, newPasswordValue, confirmNewPassword),
    [accessRows, confirmNewPassword, enableNewPassword, form, newPasswordValue],
  );

  const panelDirty = panelOpen && panelSnapshot !== baselineSnapshot;
  const panelEditable = panelMode === "edit" || panelMode === "add";
  const canDeactivateCurrentUser =
    panelMode !== "add"
    && normalizeText(panelUserId) !== ""
    && !isTemporaryId(panelUserId);

  const selectedUserRow = useMemo(
    () => tableRows.find((row) => rowIdOf(row) === String(panelUserId ?? "")) || null,
    [panelUserId, tableRows],
  );

  const pendingCount = useMemo(() => pendingBatchCount(pendingBatch), [pendingBatch]);
  const hasPendingChanges = pendingCount > 0;

  const totalRowCount = useMemo(() => {
    const fallback = Number.isFinite(Number(totalUsers)) ? Number(totalUsers) : 0;
    return tableRows.length || fallback;
  }, [tableRows.length, totalUsers]);

  const selectedStatusLabel = useMemo(() => {
    const label = findLabel(lookups?.statuses, "status_id", form?.status_id);
    if (label && label !== "--") {
      return label.toUpperCase();
    }

    return form?.is_active ? "ACTIVE" : "INACTIVE";
  }, [form?.is_active, form?.status_id, lookups?.statuses]);

  const departmentsForCompany = useMemo(() => {
    if (!normalizeText(form?.comp_id)) {
      return lookups?.departments || [];
    }

    return (lookups?.departments || []).filter(
      (row) => String(row?.comp_id) === String(form?.comp_id),
    );
  }, [form?.comp_id, lookups?.departments]);

  const roleOptionsForAccessEditor = useMemo(() => {
    if (!normalizeText(accessEditor?.app_id)) {
      return [];
    }

    return (lookups?.roles || []).filter((row) => String(row?.app_id) === String(accessEditor.app_id));
  }, [accessEditor?.app_id, lookups?.roles]);

  const userColumns = useMemo(
    () => [
      { key: "username", label: "Username", width: "16%" },
      { key: "full_name", label: "Full Name", width: "22%" },
      { key: "email", label: "Email", width: "24%" },
      { key: "company_name", label: "Company", width: "14%" },
      { key: "department_name", label: "Department", width: "14%" },
      {
        key: "status_label",
        label: "Status",
        width: "10%",
        render: (row) => (
          <Badge bg={row?.is_active ? "success" : "secondary"} text="light">
            {normalizeText(row?.status_label).toUpperCase() || (row?.is_active ? "ACTIVE" : "INACTIVE")}
          </Badge>
        ),
      },
    ],
    [],
  );

  const visibleUserColumnCount = useMemo(
    () => userColumns.filter((column) => userColumnVisibility[column.key] !== false).length,
    [userColumnVisibility, userColumns],
  );

  const visibleUserColumns = useMemo(() => {
    const nextVisibleColumns = userColumns.filter((column) => userColumnVisibility[column.key] !== false);
    return nextVisibleColumns.length > 0 ? nextVisibleColumns : userColumns.slice(0, 1);
  }, [userColumnVisibility, userColumns]);

  const userHeaderMenuPosition = useMemo(() => {
    const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
    const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
    const menuWidth = 240;
    const menuHeight = Math.min(420, Math.max(160, (userColumns.length * 34) + 56));
    const rawX = Math.max(8, Number(userHeaderMenuState.x) || 0);
    const rawY = Math.max(8, Number(userHeaderMenuState.y) || 0);

    return {
      x: Math.max(8, Math.min(rawX, Math.max(8, viewportWidth - menuWidth - 8))),
      y: Math.max(8, Math.min(rawY, Math.max(8, viewportHeight - menuHeight - 8))),
    };
  }, [userColumns.length, userHeaderMenuState.x, userHeaderMenuState.y]);

  const accessColumns = useMemo(
    () => [
      { key: "application_name", label: "Application", width: "42%" },
      { key: "role_name", label: "Role", width: "42%" },
      {
        key: "is_active",
        label: "Status",
        width: "16%",
        render: (row) => (
          <Badge bg={row?.is_active ? "success" : "secondary"} text="light">
            {row?.is_active ? "ACTIVE" : "INACTIVE"}
          </Badge>
        ),
      },
    ],
    [],
  );

  const loadLookups = useCallback(async () => {
    setIsLoadingLookups(true);

    try {
      const response = await fetch("/api/user-master-setup/lookups", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await parseJsonResponse(response, "Failed to load lookups.");
      setLookups(payload?.lookups || EMPTY_LOOKUPS);
    } catch (error) {
      toastError(error?.message || "Failed to load lookups.", "User Master Setup");
    } finally {
      setIsLoadingLookups(false);
    }
  }, []);

  const refreshUsers = useCallback(async ({ silent = false } = {}) => {
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/user-master-setup/users?limit=200", {
        method: "GET",
        cache: "no-store",
      });

      const payload = await parseJsonResponse(response, "Failed to load users.");
      const nextRows = Array.isArray(payload?.users) ? payload.users : [];
      setTableRows(nextRows.map((row) => ({ ...row, __batchClassName: "" })));

      if (!silent) {
        toastSuccess("User list refreshed.", "User Master Setup");
      }
    } catch (error) {
      toastError(error?.message || "Failed to load users.", "User Master Setup");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    setUserColumnVisibility((previous) => {
      const next = {};

      userColumns.forEach((column) => {
        next[column.key] = previous?.[column.key] !== false;
      });

      return next;
    });
  }, [userColumns]);

  const closeUserHeaderMenu = useCallback(() => {
    setUserHeaderMenuState((current) => ({
      ...current,
      open: false,
    }));
  }, []);

  const handleUserHeaderContextMenu = useCallback((event) => {
    const target = event?.target;
    const inHeader = target instanceof Element ? target.closest("thead th") : null;

    if (!inHeader) {
      return;
    }

    event.preventDefault();

    setUserHeaderMenuState({
      open: true,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const toggleUserColumnVisibility = useCallback(
    (columnKey, nextVisible) => {
      setUserColumnVisibility((previous) => {
        const currentlyVisible = previous?.[columnKey] !== false;
        const visibleCount = userColumns.filter((column) => previous?.[column.key] !== false).length;

        if (!nextVisible && currentlyVisible && visibleCount <= 1) {
          return previous;
        }

        return {
          ...previous,
          [columnKey]: nextVisible,
        };
      });
    },
    [userColumns],
  );

  useEffect(() => {
    if (!userHeaderMenuState.open) {
      return undefined;
    }

    const closeIfOutside = (event) => {
      const target = event?.target;
      const clickedInside = target instanceof Element ? target.closest(".umsp-column-context-menu") : null;

      if (clickedInside) {
        return;
      }

      closeUserHeaderMenu();
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        closeUserHeaderMenu();
      }
    };

    const closeOnScroll = () => {
      closeUserHeaderMenu();
    };

    window.addEventListener("mousedown", closeIfOutside);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeOnScroll, true);

    return () => {
      window.removeEventListener("mousedown", closeIfOutside);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [closeUserHeaderMenu, userHeaderMenuState.open]);

  function confirmDiscardDraft() {
    if (!panelDirty) {
      return true;
    }

    if (typeof window === "undefined") {
      return false;
    }

    return window.confirm("You have unsaved panel changes. Discard them?");
  }

  function resetPanelState() {
    const nextForm = createEmptyForm();

    setPanelOpen(false);
    setPanelMode("view");
    setPanelUserId(null);
    setActiveTab("profile");

    setForm(nextForm);
    setBaselineForm(nextForm);

    setAccessRows([]);
    setBaselineAccessRows([]);

    setEnableNewPassword(false);
    setNewPasswordValue("");
    setConfirmNewPassword("");

    setAccessEditor({
      mode: null,
      access_key: null,
      original_app_id: "",
      original_role_id: "",
      app_id: "",
      role_id: "",
    });

    setBaselineSnapshot(buildPanelSnapshot(nextForm, [], false, "", ""));
    setIsPanelLoading(false);
  }

  async function openExistingUserPanel(row, mode) {
    const userId = rowIdOf(row);

    if (!userId) {
      toastError("Invalid user row selected.", "User Master Setup");
      return;
    }

    if (isTemporaryId(userId)) {
      toastWarning("Save Batch first before opening staged users.", "User Master Setup");
      return;
    }

    if (!confirmDiscardDraft()) {
      return;
    }

    setPanelOpen(true);
    setPanelMode(mode);
    setPanelUserId(userId);
    setActiveTab("profile");
    setIsPanelLoading(true);

    try {
      const [detailResponse, accessResponse] = await Promise.all([
        fetch(`/api/user-master-setup/users/${encodeURIComponent(userId)}`, {
          method: "GET",
          cache: "no-store",
        }),
        fetch(`/api/user-master-setup/users/${encodeURIComponent(userId)}/access`, {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      const detailPayload = await parseJsonResponse(detailResponse, "Failed to load user detail.");
      const accessPayload = await parseJsonResponse(accessResponse, "Failed to load user access.");

      const fallbackStatusId = lookups?.statuses?.[0]?.status_id ?? null;
      const nextForm = createFormFromUser(detailPayload?.user || {}, fallbackStatusId, lookups?.statuses || []);
      const nextAccessRows = Array.isArray(accessPayload?.accessRows) ? accessPayload.accessRows : [];

      setForm(nextForm);
      setBaselineForm(cloneForm(nextForm));

      setAccessRows(cloneAccessRows(nextAccessRows));
      setBaselineAccessRows(cloneAccessRows(nextAccessRows));

      setEnableNewPassword(false);
      setNewPasswordValue("");
      setConfirmNewPassword("");

      setAccessEditor({
        mode: null,
        access_key: null,
        original_app_id: "",
        original_role_id: "",
        app_id: "",
        role_id: "",
      });

      setBaselineSnapshot(buildPanelSnapshot(nextForm, nextAccessRows, false, "", ""));
    } catch (error) {
      toastError(error?.message || "Failed to load selected user.", "User Master Setup");
      resetPanelState();
    } finally {
      setIsPanelLoading(false);
    }
  }

  function openAddUserPanel() {
    if (!confirmDiscardDraft()) {
      return;
    }

    const fallbackStatusId = lookups?.statuses?.[0]?.status_id ?? null;
    const nextForm = createEmptyForm(fallbackStatusId, lookups?.statuses || []);

    setPanelOpen(true);
    setPanelMode("add");
    setPanelUserId(null);
    setActiveTab("profile");
    setIsPanelLoading(false);

    setForm(nextForm);
    setBaselineForm(cloneForm(nextForm));

    setAccessRows([]);
    setBaselineAccessRows([]);

    setEnableNewPassword(true);
    setNewPasswordValue("");
    setConfirmNewPassword("");

    setAccessEditor({
      mode: null,
      access_key: null,
      original_app_id: "",
      original_role_id: "",
      app_id: "",
      role_id: "",
    });

    setBaselineSnapshot(buildPanelSnapshot(nextForm, [], true, "", ""));
  }

  function closePanel() {
    if (!confirmDiscardDraft()) {
      return;
    }

    resetPanelState();
  }

  function updateTableRow(nextRow, { prepend = false } = {}) {
    const nextRowId = rowIdOf(nextRow);

    if (!nextRowId) {
      return;
    }

    setTableRows((previous) => {
      const index = previous.findIndex((row) => rowIdOf(row) === nextRowId);

      if (index < 0) {
        return prepend ? [nextRow, ...previous] : [...previous, nextRow];
      }

      const copy = [...previous];
      copy[index] = nextRow;
      return copy;
    });
  }

  function handleStatusChange(nextStatusId) {
    setForm((previous) => ({
      ...previous,
      status_id: normalizeOptionalText(nextStatusId),
      is_active: inferActiveFromStatus(nextStatusId, lookups?.statuses || [], previous?.is_active),
    }));
  }

  function handleCompanyChange(nextCompId) {
    setForm((previous) => {
      const normalizedCompId = normalizeOptionalText(nextCompId);
      const deptStillValid = (lookups?.departments || []).some(
        (row) => String(row?.dept_id) === String(previous?.dept_id) && String(row?.comp_id) === String(normalizedCompId),
      );

      return {
        ...previous,
        comp_id: normalizedCompId,
        dept_id: deptStillValid ? previous?.dept_id : null,
      };
    });
  }

  function startAccessCreate() {
    if (!panelEditable) {
      return;
    }

    if (panelMode === "add") {
      toastInfo("Save this new user in batch first, then assign access.", "User Master Setup");
      return;
    }

    setAccessEditor({
      mode: "add",
      access_key: null,
      original_app_id: "",
      original_role_id: "",
      app_id: "",
      role_id: "",
    });
  }

  function startAccessEdit(row) {
    if (!panelEditable) {
      return;
    }

    setAccessEditor({
      mode: "edit",
      access_key: row?.access_key,
      original_app_id: normalizeText(row?.app_id),
      original_role_id: normalizeText(row?.role_id),
      app_id: normalizeText(row?.app_id),
      role_id: normalizeText(row?.role_id),
    });
  }

  function removeAccessRow(row) {
    if (!panelEditable) {
      return;
    }

    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Deactivate access ${row?.application_name || "Application"} / ${row?.role_name || "Role"}?`);
      if (!confirmed) {
        return;
      }
    }

    setAccessRows((previous) => previous.filter((entry) => String(entry?.access_key) !== String(row?.access_key)));
  }

  function cancelAccessEditor() {
    setAccessEditor({
      mode: null,
      access_key: null,
      original_app_id: "",
      original_role_id: "",
      app_id: "",
      role_id: "",
    });
  }

  function submitAccessEditor() {
    const appId = normalizeText(accessEditor?.app_id);
    const roleId = normalizeText(accessEditor?.role_id);

    if (!appId || !roleId) {
      toastError("Application and role are required.", "User Master Setup");
      return;
    }

    const duplicateExists = accessRows.some((row) => {
      const sameMapping = String(row?.app_id) === appId && String(row?.role_id) === roleId;
      if (!sameMapping) {
        return false;
      }

      if (accessEditor?.mode !== "edit") {
        return true;
      }

      return String(row?.access_key) !== String(accessEditor?.access_key);
    });

    if (duplicateExists) {
      toastError("That application/role mapping already exists.", "User Master Setup");
      return;
    }

    if (accessEditor?.mode === "edit") {
      setAccessRows((previous) =>
        previous.map((row) => {
          if (String(row?.access_key) !== String(accessEditor?.access_key)) {
            return row;
          }

          return makeLocalAccessRow(appId, roleId, lookups, row);
        }),
      );
      cancelAccessEditor();
      return;
    }

    setAccessRows((previous) => [...previous, makeLocalAccessRow(appId, roleId, lookups)]);
    cancelAccessEditor();
  }

  function validatePanelBeforeStage() {
    const username = normalizeText(form?.username);
    const email = normalizeEmail(form?.email);

    if (!username) {
      throw new Error("Username is required.");
    }

    if (!email) {
      throw new Error("Email is required.");
    }

    if (enableNewPassword) {
      const password = normalizeText(newPasswordValue);
      const confirm = normalizeText(confirmNewPassword);

      if (!password) {
        throw new Error("Password is required when Set New Password is enabled.");
      }

      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }

      if (password !== confirm) {
        throw new Error("Confirm password must match.");
      }
    }
  }

  function stagePanelChanges() {
    if (!panelEditable) {
      return;
    }

    setIsStaging(true);

    try {
      validatePanelBeforeStage();

      const stagedPassword = enableNewPassword ? normalizeText(newPasswordValue) : "";
      const payload = buildUserPayload(form, stagedPassword);

      if (panelMode === "add") {
        const tempId = `tmp-${Date.now().toString(36)}`;
        const previewRow = summarizeUserRow(form, lookups, {
          id: tempId,
          user_id: tempId,
          __batchClassName: "table-info",
        });

        updateTableRow(previewRow, { prepend: true });

        setPendingBatch((previous) => ({
          ...previous,
          creates: [
            ...(Array.isArray(previous?.creates) ? previous.creates : []),
            {
              tempId,
              payload,
              accessRows: [],
            },
          ],
        }));

        toastSuccess("New user staged. Use Save Batch to commit.", "User Master Setup");
        resetPanelState();
        return;
      }

      const userId = normalizeText(panelUserId);
      if (!userId || isTemporaryId(userId)) {
        throw new Error("Invalid user selected for update.");
      }

      const { deletes, upserts } = diffAccessRows(baselineAccessRows, accessRows);
      const previewRow = summarizeUserRow(form, lookups, {
        ...(selectedUserRow || {}),
        id: userId,
        user_id: userId,
        __batchClassName: "table-warning",
      });

      updateTableRow(previewRow);

      setPendingBatch((previous) => {
        const nextUpdates = {
          ...(previous?.updates || {}),
          [userId]: payload,
        };

        return {
          ...previous,
          updates: nextUpdates,
          accessUpserts: replaceObjectKeyWithArray(previous?.accessUpserts, userId, upserts),
          accessDeletes: replaceObjectKeyWithArray(previous?.accessDeletes, userId, deletes),
        };
      });

      setBaselineForm(cloneForm(form));
      setBaselineAccessRows(cloneAccessRows(accessRows));
      setEnableNewPassword(false);
      setNewPasswordValue("");
      setConfirmNewPassword("");
      setPanelMode("view");
      setBaselineSnapshot(buildPanelSnapshot(form, accessRows, false, "", ""));
      cancelAccessEditor();

      toastSuccess("User changes staged. Use Save Batch to commit.", "User Master Setup");
    } catch (error) {
      toastError(error?.message || "Failed to stage changes.", "User Master Setup");
    } finally {
      setIsStaging(false);
    }
  }

  async function saveBatch() {
    if (!hasPendingChanges) {
      toastInfo("There are no staged changes.", "User Master Setup");
      return;
    }

    if (panelDirty) {
      toastWarning("Stage or discard panel changes before saving the batch.", "User Master Setup");
      return;
    }

    setIsSavingBatch(true);

    try {
      const createdIdMap = new Map();

      for (const entry of pendingBatch.creates || []) {
        const response = await fetch("/api/user-master-setup/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(entry?.payload || {}),
        });

        const payload = await parseJsonResponse(response, "Failed to create staged user.");
        const createdUser = payload?.user;
        const createdId = rowIdOf(createdUser);

        if (!createdId) {
          throw new Error("Created user did not return a valid id.");
        }

        createdIdMap.set(String(entry?.tempId), String(createdId));

        for (const access of entry?.accessRows || []) {
          const accessResponse = await fetch(`/api/user-master-setup/users/${encodeURIComponent(createdId)}/access`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              app_id: access?.app_id,
              role_id: access?.role_id,
            }),
          });

          await parseJsonResponse(accessResponse, "Failed to save staged access mapping.");
        }
      }

      for (const [rawUserId, payload] of Object.entries(pendingBatch.updates || {})) {
        const resolvedUserId = createdIdMap.get(String(rawUserId)) || rawUserId;

        if (!resolvedUserId || isTemporaryId(resolvedUserId)) {
          continue;
        }

        const response = await fetch(`/api/user-master-setup/users/${encodeURIComponent(resolvedUserId)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload || {}),
        });

        await parseJsonResponse(response, "Failed to update staged user.");
      }

      for (const [rawUserId, rows] of Object.entries(pendingBatch.accessDeletes || {})) {
        const resolvedUserId = createdIdMap.get(String(rawUserId)) || rawUserId;

        if (!resolvedUserId || isTemporaryId(resolvedUserId)) {
          continue;
        }

        for (const row of rows || []) {
          const response = await fetch(`/api/user-master-setup/users/${encodeURIComponent(resolvedUserId)}/access`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              app_id: row?.app_id,
              role_id: row?.role_id,
            }),
          });

          await parseJsonResponse(response, "Failed to deactivate staged access mapping.");
        }
      }

      for (const [rawUserId, rows] of Object.entries(pendingBatch.accessUpserts || {})) {
        const resolvedUserId = createdIdMap.get(String(rawUserId)) || rawUserId;

        if (!resolvedUserId || isTemporaryId(resolvedUserId)) {
          continue;
        }

        for (const row of rows || []) {
          const response = await fetch(`/api/user-master-setup/users/${encodeURIComponent(resolvedUserId)}/access`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              app_id: row?.app_id,
              role_id: row?.role_id,
            }),
          });

          await parseJsonResponse(response, "Failed to save staged access mapping.");
        }
      }

      setPendingBatch(createEmptyPendingBatch());
      await refreshUsers({ silent: true });

      if (isTemporaryId(panelUserId)) {
        resetPanelState();
      }

      toastSuccess("Batch saved successfully.", "User Master Setup");
    } catch (error) {
      toastError(error?.message || "Failed to save staged batch.", "User Master Setup");
    } finally {
      setIsSavingBatch(false);
    }
  }

  async function cancelBatch() {
    if (!hasPendingChanges) {
      toastInfo("There are no staged changes to cancel.", "User Master Setup");
      return;
    }

    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Cancel all staged batch changes?");
      if (!confirmed) {
        return;
      }
    }

    setPendingBatch(createEmptyPendingBatch());
    await refreshUsers({ silent: true });

    if (isTemporaryId(panelUserId)) {
      resetPanelState();
    }

    toastSuccess("Staged batch changes canceled.", "User Master Setup");
  }

  async function deactivateCurrentUser() {
    const userId = normalizeText(panelUserId);

    if (!userId || isTemporaryId(userId)) {
      toastError("Invalid user selected for deactivation.", "User Master Setup");
      return;
    }

    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Deactivate this user? This is a soft delete and will revoke all system access.",
      );

      if (!confirmed) {
        return;
      }
    }

    setIsDeactivatingUser(true);

    try {
      const response = await fetch(`/api/user-master-setup/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });

      const payload = await parseJsonResponse(response, "Failed to deactivate user.");
      const revokedAccessCount = Number(payload?.deleted?.revokedAccessCount || 0);

      setPendingBatch((previous) => ({
        ...previous,
        updates: removeObjectKey(previous?.updates, userId),
        accessUpserts: removeObjectKey(previous?.accessUpserts, userId),
        accessDeletes: removeObjectKey(previous?.accessDeletes, userId),
      }));

      await refreshUsers({ silent: true });
      resetPanelState();

      toastSuccess(
        `User deactivated successfully. Revoked ${revokedAccessCount} access mapping(s).`,
        "User Master Setup",
      );
    } catch (error) {
      toastError(error?.message || "Failed to deactivate user.", "User Master Setup");
    } finally {
      setIsDeactivatingUser(false);
    }
  }

  function restorePanelToBaseline() {
    if (panelMode === "add") {
      closePanel();
      return;
    }

    setForm(cloneForm(baselineForm));
    setAccessRows(cloneAccessRows(baselineAccessRows));
    setEnableNewPassword(false);
    setNewPasswordValue("");
    setConfirmNewPassword("");
    cancelAccessEditor();
    setBaselineSnapshot(buildPanelSnapshot(baselineForm, baselineAccessRows, false, "", ""));
  }

  function renderTabButton(tab) {
    return (
      <Button
        key={tab.key}
        type="button"
        variant="ghost"
        className={`umsp-tab-btn ${activeTab === tab.key ? "is-active" : ""}`}
        onClick={() => setActiveTab(tab.key)}
      >
        {tab.label}
      </Button>
    );
  }

  function renderProfileTab() {
    return (
      <div className="row g-2">
        <div className="col-12 col-md-6">
          <label className="form-label mb-1">Username</label>
          <Input
            value={form.username}
            onChange={(event) => setForm((previous) => ({ ...previous, username: event.target.value }))}
            disabled={!panelEditable || isPanelLoading}
            placeholder="Enter username"
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label mb-1">Email</label>
          <Input
            type="email"
            value={form.email}
            onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
            disabled={!panelEditable || isPanelLoading}
            placeholder="Enter email"
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label mb-1">First Name</label>
          <Input
            value={form.first_name}
            onChange={(event) => setForm((previous) => ({ ...previous, first_name: event.target.value }))}
            disabled={!panelEditable || isPanelLoading}
            placeholder="First name"
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label mb-1">Middle Name</label>
          <Input
            value={form.middle_name}
            onChange={(event) => setForm((previous) => ({ ...previous, middle_name: event.target.value }))}
            disabled={!panelEditable || isPanelLoading}
            placeholder="Middle name"
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label mb-1">Last Name</label>
          <Input
            value={form.last_name}
            onChange={(event) => setForm((previous) => ({ ...previous, last_name: event.target.value }))}
            disabled={!panelEditable || isPanelLoading}
            placeholder="Last name"
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label mb-1">Phone</label>
          <Input
            value={form.phone}
            onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))}
            disabled={!panelEditable || isPanelLoading}
            placeholder="Phone"
          />
        </div>
        <div className="col-12">
          <label className="form-label mb-1">Address</label>
          <Input
            as="textarea"
            rows={2}
            value={form.address}
            onChange={(event) => setForm((previous) => ({ ...previous, address: event.target.value }))}
            disabled={!panelEditable || isPanelLoading}
            placeholder="Address"
          />
        </div>
      </div>
    );
  }

  function renderOrganizationTab() {
    return (
      <div className="row g-2">
        <div className="col-12 col-md-6">
          <label className="form-label mb-1">Company</label>
          <Input
            as="select"
            value={asChoiceValue(form.comp_id)}
            onChange={(event) => handleCompanyChange(event.target.value)}
            disabled={!panelEditable || isPanelLoading}
          >
            <option value="">Select company</option>
            {(lookups?.companies || []).map((company) => (
              <option key={String(company?.comp_id)} value={String(company?.comp_id)}>
                {company?.label}
              </option>
            ))}
          </Input>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label mb-1">Department</label>
          <Input
            as="select"
            value={asChoiceValue(form.dept_id)}
            onChange={(event) => setForm((previous) => ({ ...previous, dept_id: normalizeOptionalText(event.target.value) }))}
            disabled={!panelEditable || isPanelLoading}
          >
            <option value="">Select department</option>
            {departmentsForCompany.map((department) => (
              <option key={String(department?.dept_id)} value={String(department?.dept_id)}>
                {department?.label}
              </option>
            ))}
          </Input>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label mb-1">Position</label>
          <Input
            value={form.position}
            onChange={(event) => setForm((previous) => ({ ...previous, position: event.target.value }))}
            disabled={!panelEditable || isPanelLoading}
            placeholder="Position"
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label mb-1">Hire Date</label>
          <Input
            type="date"
            value={form.hire_date}
            onChange={(event) => setForm((previous) => ({ ...previous, hire_date: event.target.value }))}
            disabled={!panelEditable || isPanelLoading}
          />
        </div>
        <div className="col-12">
          <label className="form-label mb-1">Status</label>
          <Input
            as="select"
            value={asChoiceValue(form.status_id)}
            onChange={(event) => handleStatusChange(event.target.value)}
            disabled={!panelEditable || isPanelLoading}
          >
            <option value="">Select status</option>
            {(lookups?.statuses || []).map((status) => (
              <option key={String(status?.status_id)} value={String(status?.status_id)}>
                {status?.label}
              </option>
            ))}
          </Input>
        </div>
      </div>
    );
  }

  function renderAccessTab() {
    const accessEditorReady = Boolean(
      normalizeText(accessEditor?.app_id) && normalizeText(accessEditor?.role_id),
    );

    return (
      <>
        <div className="d-flex justify-content-between align-items-center mb-2 umsp-access-toolbar">
          <div className="small text-muted umsp-access-helper-text">Assign application role access using shared setup table controls.</div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="umsp-access-trigger-btn"
            onClick={startAccessCreate}
            disabled={!panelEditable}
          >
            Add Access
          </Button>
        </div>

        {accessEditor?.mode ? (
          <div className="umsp-access-editor mb-2">
            <div className="umsp-access-editor-head">
              <h3 className="umsp-access-editor-title mb-0">
                {accessEditor?.mode === "edit" ? "Edit Access Mapping" : "Add Access Mapping"}
              </h3>
              <p className="umsp-access-editor-subtitle mb-0">Choose one application and the role to assign.</p>
            </div>

            <div className="row g-2 umsp-access-editor-grid">
              <div className="col-12 col-md-6">
                <label className="form-label mb-1">Application</label>
                <Input
                  as="select"
                  value={asChoiceValue(accessEditor?.app_id)}
                  onChange={(event) =>
                    setAccessEditor((previous) => ({
                      ...previous,
                      app_id: event.target.value,
                      role_id: "",
                    }))
                  }
                >
                  <option value="">Select application</option>
                  {(lookups?.applications || []).map((application) => (
                    <option key={String(application?.app_id)} value={String(application?.app_id)}>
                      {application?.label}
                    </option>
                  ))}
                </Input>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label mb-1">Role</label>
                <Input
                  as="select"
                  value={asChoiceValue(accessEditor?.role_id)}
                  onChange={(event) => setAccessEditor((previous) => ({ ...previous, role_id: event.target.value }))}
                  disabled={!normalizeText(accessEditor?.app_id)}
                >
                  <option value="">{normalizeText(accessEditor?.app_id) ? "Select role" : "Select application first"}</option>
                  {roleOptionsForAccessEditor.map((role) => (
                    <option key={String(role?.role_id)} value={String(role?.role_id)}>
                      {role?.label}
                    </option>
                  ))}
                </Input>
              </div>
            </div>

            <div className="umsp-access-editor-actions">
              <Button type="button" variant="primary" size="sm" onClick={submitAccessEditor} disabled={!accessEditorReady}>
                <i className="bi bi-check2 me-1" aria-hidden="true" />
                  Save
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={cancelAccessEditor}>
                  Cancel
              </Button>
            </div>
          </div>
        ) : null}

        <SetupTable
          className="umsp-access-table"
          columns={accessColumns}
          rows={accessRows}
          rowIdKey="access_key"
          selectedRowId={null}
          emptyMessage="No access mappings assigned."
          renderActions={(row) =>
            panelEditable ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="px-2 psb-setup-action-btn"
                  aria-label="Edit access"
                  title="Edit access"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    startAccessEdit(row);
                  }}
                >
                  <i className="bi bi-pencil-square" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="px-2 psb-setup-action-btn"
                  aria-label="Deactivate access"
                  title="Deactivate access"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    removeAccessRow(row);
                  }}
                >
                  <i className="bi bi-slash-circle" aria-hidden="true" />
                </Button>
              </>
            ) : null
          }
        />
      </>
    );
  }

  function renderAccountTab() {
    return (
      <div className="row g-2">
        <div className="col-12">
          <label className="form-label mb-1">Last Login</label>
          <Input value={formatDateTime(form?.last_login_at)} readOnly disabled />
        </div>
        <div className="col-12">
          <div className="form-check mt-1">
            <input
              id="umsp-set-password"
              className="form-check-input"
              type="checkbox"
              checked={enableNewPassword}
              onChange={(event) => {
                const checked = event.target.checked;
                setEnableNewPassword(checked);

                if (!checked) {
                  setNewPasswordValue("");
                  setConfirmNewPassword("");
                }
              }}
              disabled={!panelEditable || isPanelLoading}
            />
            <label htmlFor="umsp-set-password" className="form-check-label">
              Set New Password
            </label>
          </div>
        </div>

        {enableNewPassword ? (
          <>
            <div className="col-12 col-md-6">
              <label className="form-label mb-1">New Password</label>
              <Input
                type="password"
                value={newPasswordValue}
                onChange={(event) => setNewPasswordValue(event.target.value)}
                disabled={!panelEditable || isPanelLoading}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label mb-1">Confirm Password</label>
              <Input
                type="password"
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                disabled={!panelEditable || isPanelLoading}
                placeholder="Re-enter password"
              />
            </div>
          </>
        ) : null}

        {canDeactivateCurrentUser ? (
          <div className="col-12 mt-2 pt-2 border-top">
            <div className="d-flex justify-content-between align-items-center gap-2">
              <p className="small text-muted mb-0">
                Soft delete this user and revoke all application-role access.
              </p>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={deactivateCurrentUser}
                disabled={isPanelLoading || isDeactivatingUser || isSavingBatch || isStaging || isRefreshing}
              >
                {isDeactivatingUser ? "Deactivating..." : "Deactivate User"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const activeTabMeta = TABS.find((tab) => tab.key === activeTab) || TABS[0];

  return (
    <main className="container-fluid py-3 umsp-shell">
      <section className={`umsp-users-pane ${panelOpen ? "is-panel-open" : ""}`}>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h1 className="h4 mb-1">User Master Setup</h1>
            <p className="text-muted mb-0">{totalRowCount} user row(s)</p>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className={`small ${hasPendingChanges ? "text-warning" : "text-muted"}`}>
              {hasPendingChanges ? `${pendingCount} staged change(s)` : "No staged changes"}
            </span>
            <Button type="button" variant="secondary" size="sm" onClick={openAddUserPanel} disabled={isSavingBatch || isRefreshing}>
              Add User
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={saveBatch} disabled={!hasPendingChanges || isSavingBatch || isRefreshing}>
              {isSavingBatch ? "Saving..." : "Save Batch"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={cancelBatch} disabled={!hasPendingChanges || isSavingBatch || isRefreshing}>
              Cancel Batch
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => refreshUsers()} disabled={isSavingBatch || isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <Card bodyClassName="p-0">
          <SetupTable
            columns={visibleUserColumns}
            rows={tableRows}
            rowIdKey="id"
            selectedRowId={panelUserId}
            onRowClick={(row) => openExistingUserPanel(row, "view")}
            showActionColumn={false}
            onHeaderContextMenu={handleUserHeaderContextMenu}
            emptyMessage="No users found."
          />
        </Card>

        {userHeaderMenuState.open ? (
          <div
            className="psb-ui-table-context-menu umsp-column-context-menu"
            style={{
              left: `${userHeaderMenuPosition.x}px`,
              top: `${userHeaderMenuPosition.y}px`,
            }}
            onContextMenu={(event) => event.preventDefault()}
            role="menu"
            aria-label="User table columns"
          >
            <div className="px-2 pb-1 mb-1 border-bottom small fw-semibold text-uppercase text-muted">Columns</div>
            {userColumns.map((column) => {
              const checked = userColumnVisibility[column.key] !== false;
              const disableToggle = checked && visibleUserColumnCount <= 1;

              return (
                <label
                  key={column.key}
                  className="d-flex align-items-center gap-2 px-2 py-1 small"
                  style={{
                    cursor: disableToggle ? "not-allowed" : "pointer",
                    opacity: disableToggle ? 0.58 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disableToggle}
                    onChange={(event) => toggleUserColumnVisibility(column.key, event.target.checked)}
                  />
                  <span>{column.label}</span>
                </label>
              );
            })}
          </div>
        ) : null}
      </section>

      <aside className={`umsp-sidepanel ${panelOpen ? "is-open" : ""}`} aria-hidden={!panelOpen}>
        <div className="umsp-sidepanel-header">
          <div>
            <h2 className="h6 mb-1">
              {panelMode === "add" ? "Add User" : panelMode === "edit" ? "Edit User" : "User Details"}
            </h2>
            <div className="d-flex align-items-center gap-1 flex-wrap umsp-status-row">
              <Badge bg={form?.is_active ? "success" : "secondary"} text="light">
                {selectedStatusLabel}
              </Badge>
              <Badge bg={panelMode === "view" ? "info" : "warning"} text="dark">
                {panelMode.toUpperCase()}
              </Badge>
              {panelDirty ? (
                <span className="small text-danger fw-semibold">Unsaved changes</span>
              ) : (
                <span className="small text-muted">All changes staged</span>
              )}
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" className="umsp-close-btn" onClick={closePanel}>
            <i className="bi bi-x-lg" aria-hidden="true" />
          </Button>
        </div>

        {isPanelLoading ? (
          <div className="umsp-sidepanel-loading">Loading user details...</div>
        ) : (
          <>
            <div className="umsp-tabs">{TABS.map((tab) => renderTabButton(tab))}</div>

            <div className="umsp-tab-description">
              <p className="mb-0">{activeTabMeta?.description}</p>
            </div>

            <div className="umsp-tab-content">
              {activeTab === "profile" ? renderProfileTab() : null}
              {activeTab === "organization" ? renderOrganizationTab() : null}
              {activeTab === "access" ? renderAccessTab() : null}
              {activeTab === "account" ? renderAccountTab() : null}
            </div>

            <div className="umsp-sidepanel-footer">
              {panelMode === "view" ? (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setPanelMode("edit")}
                    disabled={isLoadingLookups}
                  >
                    Edit
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={closePanel}>
                    Close
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={stagePanelChanges}
                    disabled={isStaging || isSavingBatch || isLoadingLookups}
                  >
                    {isStaging ? "Staging..." : "Stage Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={restorePanelToBaseline}
                    disabled={isStaging || isSavingBatch}
                  >
                    {panelMode === "add" ? "Cancel" : "Revert"}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </aside>
    </main>
  );
}
