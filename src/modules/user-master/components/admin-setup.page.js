"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createCacheKey, invalidateCacheKey } from "@/core/cache";
import {
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  Modal,
  Offcanvas,
  Row,
  Tab,
  Table,
  Tabs,
} from "react-bootstrap";
import {
  cacheReferenceData,
  clearSessionCache,
  getCachedJson,
  invalidateUserMasterCache,
  USER_MASTER_CACHE_KEYS,
  USER_MASTER_CACHE_TTL,
} from "@/modules/user-master/cache/user-master.cache";
import {
  invalidateUserAccessQueries,
  notifyUserMasterSessionRefresh,
} from "@/modules/user-master/cache/user-master.query";
import { useUserAccess } from "@/modules/user-master/hooks/useUserAccess";
import {
  compareApplicationsByOrder,
  resolveApplicationOrder,
} from "@/shared/utils/application-order";
import { toastError, toastInfo, toastSuccess, toastWarning } from "@/shared/utils/toast";
import { startNavbarLoader } from "@/shared/utils/navbar-loader";

const ADMIN_APP_KEY = "admin-config";
const ADMIN_MAIN_TABS = ["users", "companies", "statuses", "applications"];
const TEMP_ID_PREFIX = "tmp-";
const APPLICATION_ORDER_FIELDS = ["display_order", "app_order", "sort_order", "order_no"];
const MY_APPS_CACHE_NAMESPACE = "user-master";
const MY_APPS_CACHE_KEY = createCacheKey("my-apps", "dashboard");

const DEFAULT_DIFF_ENTRY = {
  isNew: false,
  isChanged: false,
  isPendingRemove: false,
  changedColumns: new Set(),
};

function normalizeMainTabKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ADMIN_MAIN_TABS.includes(normalized) ? normalized : "";
}

function getLabel(record, preferred = []) {
  const fields = [
    ...preferred,
    "role_name",
    "app_name",
    "sts_name",
    "comp_name",
    "dept_name",
    "name",
    "label",
    "code",
    "description",
  ];

  for (const field of fields) {
    const value = record?.[field];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "(Unnamed)";
}

function asSelectValue(value) {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function toNullableNumber(value) {
  if (value === "" || value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isTempId(value) {
  return String(value || "").startsWith(TEMP_ID_PREFIX);
}

function createTempId(entityKey) {
  return `${TEMP_ID_PREFIX}${String(entityKey || "row")}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function cloneBatchRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...(row || {}),
    __pendingRemove: false,
  }));
}

function moveArrayItem(items, sourceIndex, targetIndex) {
  const nextItems = Array.isArray(items) ? [...items] : [];
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= nextItems.length ||
    targetIndex >= nextItems.length ||
    sourceIndex === targetIndex
  ) {
    return nextItems;
  }

  const [moved] = nextItems.splice(sourceIndex, 1);
  nextItems.splice(targetIndex, 0, moved);
  return nextItems;
}

function resequenceApplicationRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    ...(row || {}),
    display_order: index + 1,
  }));
}

function detectApplicationOrderField(rows) {
  const records = Array.isArray(rows) ? rows : [];

  for (const field of APPLICATION_ORDER_FIELDS) {
    if (records.some((row) => Object.prototype.hasOwnProperty.call(row || {}, field))) {
      return field;
    }
  }

  return "";
}

function normalizeApplicationRows(rows) {
  const ordered = [...(Array.isArray(rows) ? rows : [])]
    .filter((row) => hasValue(row?.app_id))
    .sort(compareApplicationsByOrder);

  return ordered.map((row, index) => ({
    ...(row || {}),
    display_order: resolveApplicationOrder(row, index + 1),
  }));
}

function normalizeBatchValue(value, type = "text") {
  if (type === "number") {
    if (!hasValue(value)) return "";
    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(parsed) : "";
  }

  if (type === "boolean") {
    return value === false || value === 0 || value === "0" ? "0" : "1";
  }

  return String(value ?? "").trim();
}

function buildBatchDiff(draftRows, baselineRows, idKey, fields) {
  const baselineMap = new Map(
    (Array.isArray(baselineRows) ? baselineRows : [])
      .filter((row) => hasValue(row?.[idKey]))
      .map((row) => [String(row[idKey]), row])
  );

  const byId = new Map();
  let newRows = 0;
  let modifiedRows = 0;
  let removedRows = 0;

  (Array.isArray(draftRows) ? draftRows : []).forEach((row) => {
    const rowId = String(row?.[idKey] ?? "");
    const baselineRow = baselineMap.get(rowId);
    const isNew = isTempId(rowId) || !baselineRow;
    const isPendingRemove = Boolean(row?.__pendingRemove);
    const changedColumns = new Set();

    if (!isNew && baselineRow) {
      (fields || []).forEach((field) => {
        const key = typeof field === "string" ? field : field?.key;
        const type = typeof field === "string" ? "text" : field?.type || "text";
        if (!key) return;

        const draftValue = normalizeBatchValue(row?.[key], type);
        const baselineValue = normalizeBatchValue(baselineRow?.[key], type);

        if (draftValue !== baselineValue) {
          changedColumns.add(key);
        }
      });
    }

    const isChanged = isNew || changedColumns.size > 0;

    if (isPendingRemove) {
      if (!isNew) {
        removedRows += 1;
      }
    } else if (isNew) {
      newRows += 1;
    } else if (changedColumns.size > 0) {
      modifiedRows += 1;
    }

    byId.set(rowId, {
      isNew,
      isChanged,
      isPendingRemove,
      changedColumns,
    });
  });

  return {
    byId,
    newRows,
    modifiedRows,
    removedRows,
    hasPendingChanges: newRows > 0 || modifiedRows > 0 || removedRows > 0,
  };
}

function formatDateTime(value) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "--";
  }
}

function emptyUserDraft() {
  return {
    user_id: null,
    username: "",
    email: "",
    password: "",
    confirm_password: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    phone: "",
    address: "",
    position: "",
    hire_date: "",
    last_login: null,
    comp_id: "",
    dept_id: "",
    status_id: "",
  };
}

function emptyDepartmentDraft() {
  return {
    dept_id: null,
    dept_name: "",
    short_name: "",
    comp_id: "",
    is_active: true,
  };
}

function emptyRoleDraft() {
  return {
    role_id: null,
    app_id: "",
    role_name: "",
    role_desc: "",
    is_active: true,
  };
}

function emptyCompanyDraft() {
  return {
    comp_id: null,
    comp_name: "",
    short_name: "",
    comp_email: "",
    comp_phone: "",
    is_active: true,
  };
}

function emptyStatusDraft() {
  return {
    status_id: null,
    sts_name: "",
    sts_desc: "",
    is_active: true,
  };
}

function emptyApplicationDraft() {
  return {
    app_id: null,
    app_name: "",
    app_desc: "",
    display_order: 1,
    is_active: true,
  };
}

function emptyAccessDraft() {
  return {
    uar_id: null,
    user_id: "",
    role_id: "",
    app_id: "",
    is_active: true,
  };
}

export default function AdminUserMasterPage({ forcedTab = null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const normalizedForcedTab = normalizeMainTabKey(forcedTab);
  const isSingleSectionMode = hasValue(normalizedForcedTab);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({ text: "", variant: "info" });
  const [accessDeniedMessage, setAccessDeniedMessage] = useState("");
  const [activeTab, setActiveTab] = useState(() => normalizedForcedTab || "users");
  const {
    access,
    loading: accessLoading,
    error: accessError,
    refetch: refetchAccess,
  } = useUserAccess({ appKey: ADMIN_APP_KEY });

  const [references, setReferences] = useState({
    companies: [],
    departments: [],
    statuses: [],
    roles: [],
    applications: [],
  });

  const [users, setUsers] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [batchBaseline, setBatchBaseline] = useState({
    users: [],
    companies: [],
    statuses: [],
    applications: [],
  });
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [applicationDragContext, setApplicationDragContext] = useState({
    sourceAppId: "",
    targetAppId: "",
  });
  const [applicationOrderField, setApplicationOrderField] = useState("");
  const [applicationRoles, setApplicationRoles] = useState([]);
  const [loadingApplicationRoles, setLoadingApplicationRoles] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [expandedCompanyId, setExpandedCompanyId] = useState(null);
  const [userDrawer, setUserDrawer] = useState({
    show: false,
    activeTab: "profile",
    setNewPassword: false,
    showNewPassword: false,
    showStoredPassword: false,
  });
  const [devmainPasswordInfo, setDevmainPasswordInfo] = useState({
    loading: false,
    hash: "",
  });

  const [userModal, setUserModal] = useState({
    show: false,
    mode: "create",
    draft: emptyUserDraft(),
    isPasswordVisible: false,
  });

  const [roleModal, setRoleModal] = useState({
    show: false,
    mode: "create",
    draft: emptyRoleDraft(),
  });

  const [companyModal, setCompanyModal] = useState({
    show: false,
    mode: "create",
    draft: emptyCompanyDraft(),
  });

  const [statusModal, setStatusModal] = useState({
    show: false,
    mode: "create",
    draft: emptyStatusDraft(),
  });

  const [applicationModal, setApplicationModal] = useState({
    show: false,
    mode: "create",
    draft: emptyApplicationDraft(),
  });

  const [accessModal, setAccessModal] = useState({
    show: false,
    mode: "create",
    draft: emptyAccessDraft(),
    lockUser: false,
  });

  const [departmentModal, setDepartmentModal] = useState({
    show: false,
    mode: "create",
    draft: emptyDepartmentDraft(),
  });

  const [removeModal, setRemoveModal] = useState({
    show: false,
    table: "",
    id: null,
    label: "",
  });

  const departmentOptionsByCompany = useMemo(() => {
    return references.departments.reduce((map, department) => {
      const key = String(department.comp_id || "");
      if (!map[key]) map[key] = [];
      map[key].push(department);
      return map;
    }, {});
  }, [references.departments]);

  const roleLookup = useMemo(() => {
    return new Map(references.roles.map((role) => [String(role.role_id), role]));
  }, [references.roles]);

  const selectedApplication = useMemo(() => {
    return (references.applications || []).find(
      (application) => String(application?.app_id || "") === String(selectedApplicationId)
    ) || null;
  }, [references.applications, selectedApplicationId]);

  const accessRoleOptions = useMemo(() => {
    const appId = asSelectValue(accessModal?.draft?.app_id);
    if (!hasValue(appId)) return [];

    return (references.roles || [])
      .filter((role) => String(role?.app_id || "") === String(appId))
      .sort((a, b) =>
        getLabel(a, ["role_name"]).localeCompare(getLabel(b, ["role_name"]))
      );
  }, [accessModal?.draft?.app_id, references.roles]);

  const applicationLookup = useMemo(() => {
    return new Map(references.applications.map((app) => [String(app.app_id), app]));
  }, [references.applications]);

  const companyLookup = useMemo(() => {
    return new Map(references.companies.map((company) => [String(company.comp_id), company]));
  }, [references.companies]);

  const departmentLookup = useMemo(() => {
    return new Map(references.departments.map((department) => [String(department.dept_id), department]));
  }, [references.departments]);

  const statusLookup = useMemo(() => {
    return new Map(references.statuses.map((status) => [String(status.status_id), status]));
  }, [references.statuses]);

  const activeStatusId = useMemo(() => {
    const status = (references.statuses || []).find((item) => {
      const text = `${String(item?.sts_name || item?.status_name || "")} ${String(item?.sts_desc || item?.status_desc || "")}`.toLowerCase();
      return text.includes("active") && !text.includes("inactive");
    });
    return status ? asSelectValue(status.status_id) : "";
  }, [references.statuses]);

  const inactiveStatusId = useMemo(() => {
    const status = (references.statuses || []).find((item) => {
      const text = `${String(item?.sts_name || item?.status_name || "")} ${String(item?.sts_desc || item?.status_desc || "")}`.toLowerCase();
      return text.includes("inactive");
    });
    return status ? asSelectValue(status.status_id) : "";
  }, [references.statuses]);

  const isStatusActive = useCallback(
    (statusId) => {
      const status = statusLookup.get(String(statusId || ""));
      const text = `${String(status?.sts_name || status?.status_name || "")} ${String(status?.sts_desc || status?.status_desc || "")}`.toLowerCase();
      return text.includes("inactive") ? false : true;
    },
    [statusLookup]
  );

  const isUserRecordActive = useCallback(
    (userRecord) => {
      const statusId = asSelectValue(userRecord?.status_id);
      if (hasValue(statusId)) {
        return isStatusActive(statusId);
      }
      return userRecord?.is_active !== false;
    },
    [isStatusActive]
  );

  const userModalDepartmentOptions = useMemo(() => {
    const compId = String(userModal.draft.comp_id || "");
    return departmentOptionsByCompany[compId] || references.departments;
  }, [departmentOptionsByCompany, references.departments, userModal.draft.comp_id]);

  const userDrawerDepartmentOptions = useMemo(() => {
    const compId = String(userModal.draft.comp_id || "");
    const scoped = departmentOptionsByCompany[compId] || [];
    return scoped.filter((department) => department?.is_active !== false);
  }, [departmentOptionsByCompany, userModal.draft.comp_id]);

  const selectedUserMappings = useMemo(() => {
    if (!selectedUserId) return [];
    return mappings.filter((mapping) => String(mapping.user_id) === String(selectedUserId));
  }, [mappings, selectedUserId]);

  const usersDiff = useMemo(
    () =>
      buildBatchDiff(users, batchBaseline.users, "user_id", [
        "username",
        "email",
        "first_name",
        "middle_name",
        "last_name",
        "phone",
        "address",
        "position",
        "hire_date",
        { key: "comp_id", type: "number" },
        { key: "dept_id", type: "number" },
        { key: "status_id", type: "number" },
      ]),
    [batchBaseline.users, users]
  );

  const companiesDiff = useMemo(
    () =>
      buildBatchDiff(references.companies, batchBaseline.companies, "comp_id", [
        "comp_name",
        "short_name",
        "comp_email",
        "comp_phone",
        { key: "is_active", type: "boolean" },
      ]),
    [batchBaseline.companies, references.companies]
  );

  const statusesDiff = useMemo(
    () =>
      buildBatchDiff(references.statuses, batchBaseline.statuses, "status_id", [
        "sts_name",
        "sts_desc",
        { key: "is_active", type: "boolean" },
      ]),
    [batchBaseline.statuses, references.statuses]
  );

  const applicationsDiff = useMemo(
    () =>
      buildBatchDiff(references.applications, batchBaseline.applications, "app_id", [
        "app_name",
        "app_desc",
        { key: "display_order", type: "number" },
        { key: "is_active", type: "boolean" },
      ]),
    [batchBaseline.applications, references.applications]
  );

  const hasAnyPendingBatchChanges =
    usersDiff.hasPendingChanges ||
    companiesDiff.hasPendingChanges ||
    statusesDiff.hasPendingChanges ||
    applicationsDiff.hasPendingChanges;

  const selectedApplicationIsPendingRemove = useMemo(() => {
    if (!hasValue(selectedApplicationId)) return false;
    const rowDiff = applicationsDiff.byId.get(String(selectedApplicationId || ""));
    return Boolean(rowDiff?.isPendingRemove);
  }, [applicationsDiff, selectedApplicationId]);

  const roleKeys = useMemo(
    () =>
      Array.isArray(access?.roleKeys)
        ? access.roleKeys.map((value) => String(value || "").toLowerCase())
        : [],
    [access?.roleKeys]
  );

  const isDevMainUser = Boolean(access?.isDevMain) || roleKeys.includes("devmain");
  const isAdminUser =
    isDevMainUser ||
    roleKeys.includes("admin") ||
    Boolean(access?.hasAppAccess || access?.hasAccess);
  const canManagePrivilegedSetup = isDevMainUser;
  const visibleMainTabs = useMemo(
    () =>
      canManagePrivilegedSetup
        ? ["users", "companies", "statuses", "applications"]
        : isAdminUser
          ? ["users", "companies"]
          : [],
    [canManagePrivilegedSetup, isAdminUser]
  );

  useEffect(() => {
    if (visibleMainTabs.length === 0) return;

    if (isSingleSectionMode) {
      const preferredTab = visibleMainTabs.includes(normalizedForcedTab)
        ? normalizedForcedTab
        : visibleMainTabs[0];

      if (activeTab !== preferredTab) {
        setActiveTab(preferredTab);
      }
      return;
    }

    if (!visibleMainTabs.includes(activeTab)) {
      setActiveTab("users");
    }
  }, [activeTab, isSingleSectionMode, normalizedForcedTab, visibleMainTabs]);

  useEffect(() => {
    if (canManagePrivilegedSetup) return;
    if (userDrawer.activeTab === "access") {
      setUserDrawer((prev) => ({ ...prev, activeTab: "profile" }));
    }
  }, [canManagePrivilegedSetup, userDrawer.activeTab]);

  const setError = useCallback((text) => {
    setFeedback({ text, variant: "danger" });
  }, []);

  const setInfo = useCallback((text, variant = "info") => {
    setFeedback({ text, variant });
  }, []);

  const invalidateAccessCache = useCallback(async () => {
    await invalidateUserAccessQueries(queryClient);
    notifyUserMasterSessionRefresh();
  }, [queryClient]);

  useEffect(() => {
    if (!feedback?.text) return;

    const message = String(feedback.text || "").trim();
    const variant = String(feedback.variant || "info").toLowerCase();

    if (!message) return;

    if (variant === "success") {
      toastSuccess(message, "Configuration & Settings");
    } else if (variant === "danger" || variant === "error") {
      toastError(message, "Configuration & Settings");
    } else if (variant === "warning") {
      toastWarning(message, "Configuration & Settings");
    } else {
      toastInfo(message, "Configuration & Settings");
    }

    setFeedback((prev) => ({ ...prev, text: "" }));
  }, [feedback]);

  useEffect(() => {
    if (!userDrawer.show || !selectedUserId || !canManagePrivilegedSetup) {
      setDevmainPasswordInfo({ loading: false, hash: "" });
      return;
    }

    let cancelled = false;

    const loadStoredPasswordHash = async () => {
      setDevmainPasswordInfo({ loading: true, hash: "" });
      try {
        const response = await fetch(
          `/api/user-master/admin/users/password?appKey=${encodeURIComponent(ADMIN_APP_KEY)}&user_id=${encodeURIComponent(selectedUserId)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const payload = await response.json().catch(() => ({}));
        const hash = String(payload?.password_hash || payload?.data?.password_hash || "").trim();

        if (!cancelled) {
          setDevmainPasswordInfo({ loading: false, hash });
        }
      } catch {
        if (!cancelled) {
          setDevmainPasswordInfo({ loading: false, hash: "" });
        }
      }
    };

    void loadStoredPasswordHash();

    return () => {
      cancelled = true;
    };
  }, [canManagePrivilegedSetup, selectedUserId, userDrawer.show]);

  const loadData = useCallback(
    async (options = {}) => {
      const forceFresh = Boolean(options.forceFresh);
      setLoading(true);
      setAccessDeniedMessage("");
      setFeedback((prev) => ({ ...prev, text: "" }));

      try {
        const sessionAccess = access || null;
        const sessionRoleKeys = Array.isArray(sessionAccess?.roleKeys)
          ? sessionAccess.roleKeys.map((value) => String(value || "").toLowerCase())
          : [];
        const sessionIsDevMain =
          Boolean(sessionAccess?.isDevMain) || sessionRoleKeys.includes("devmain");
        const hasScopedReadPermission =
          sessionIsDevMain ||
          sessionRoleKeys.includes("admin") ||
          Boolean(
            sessionAccess?.hasAppAccess ||
              sessionAccess?.hasAccess ||
              sessionAccess?.permissions?.read
          );

        if (!hasScopedReadPermission) {
          setReferences({
            companies: [],
            departments: [],
            statuses: [],
            roles: [],
            applications: [],
          });
          setApplicationOrderField("");
          setUsers([]);
          setMappings([]);
          return;
        }

        const [bootstrapPayload, usersPayload] = await Promise.all([
          getCachedJson({
            key: USER_MASTER_CACHE_KEYS.bootstrap,
            url: "/api/user-master/bootstrap",
            ttlMs: USER_MASTER_CACHE_TTL.refsMs,
            forceFresh,
            allowStaleOnError: true,
          }),
          getCachedJson({
            key: USER_MASTER_CACHE_KEYS.users,
            url: `/api/user-master/admin/users?appKey=${encodeURIComponent(ADMIN_APP_KEY)}&includeInactive=true`,
            ttlMs: USER_MASTER_CACHE_TTL.listsMs,
            forceFresh,
            allowStaleOnError: true,
          }),
        ]);

        let mappingsPayload = null;
        let statusesPayload = null;

        if (sessionIsDevMain) {
          [mappingsPayload, statusesPayload] = await Promise.all([
            getCachedJson({
              key: USER_MASTER_CACHE_KEYS.mappings,
              url: `/api/user-master/admin/access-mappings?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
              ttlMs: USER_MASTER_CACHE_TTL.listsMs,
              forceFresh,
              allowStaleOnError: true,
            }),
            getCachedJson({
              key: `${USER_MASTER_CACHE_KEYS.bootstrap}:statuses:admin`,
              url: `/api/user-master/admin/statuses?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
              ttlMs: USER_MASTER_CACHE_TTL.listsMs,
              forceFresh,
              allowStaleOnError: true,
            }),
          ]);
        }

        const rawApplications = Array.isArray(bootstrapPayload.applications)
          ? bootstrapPayload.applications
          : [];
        setApplicationOrderField(detectApplicationOrderField(rawApplications));

        const nextReferences = {
          companies: bootstrapPayload.companies || [],
          departments: bootstrapPayload.departments || [],
          statuses:
            (sessionIsDevMain
              ? statusesPayload?.statuses || statusesPayload?.data?.statuses
              : null) ||
            bootstrapPayload.statuses ||
            [],
          roles: bootstrapPayload.roles || [],
          applications: normalizeApplicationRows(rawApplications),
        };

        const nextUsers = usersPayload.users || [];

        setReferences(nextReferences);

        cacheReferenceData(bootstrapPayload);

        setUsers(nextUsers);
        setMappings(sessionIsDevMain ? mappingsPayload?.mappings || [] : []);
        setBatchBaseline({
          users: cloneBatchRows(nextUsers),
          companies: cloneBatchRows(nextReferences.companies),
          statuses: cloneBatchRows(nextReferences.statuses),
          applications: normalizeApplicationRows(cloneBatchRows(nextReferences.applications)),
        });
      } catch (error) {
        const statusCode = Number(error?.status || error?.payload?.status || 0);
        const message = error?.message || "Unable to load configuration data";

        if (statusCode === 401 || statusCode === 403) {
          setAccessDeniedMessage(message);
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    },
    [access, setError]
  );

  useEffect(() => {
    if (accessLoading) {
      return;
    }

    if (accessError) {
      const statusCode = Number(accessError?.status || accessError?.payload?.status || 0);
      if (statusCode === 401 || statusCode === 403) {
        setAccessDeniedMessage(accessError?.message || "Access denied");
      } else {
        setError(accessError?.message || "Unable to load access");
      }
      setLoading(false);
      return;
    }

    void loadData();
  }, [accessError, accessLoading, loadData, setError]);

  useEffect(() => {
    if (!canManagePrivilegedSetup) {
      setSelectedApplicationId("");
      return;
    }

    const applications = references.applications || [];
    if (applications.length === 0) {
      setSelectedApplicationId("");
      return;
    }

    const exists = applications.some(
      (application) => String(application?.app_id || "") === String(selectedApplicationId)
    );

    if (!hasValue(selectedApplicationId) || !exists) {
      setSelectedApplicationId(asSelectValue(applications[0]?.app_id));
    }
  }, [canManagePrivilegedSetup, references.applications, selectedApplicationId]);

  const loadRolesForApplication = useCallback(
    async (appId, options = {}) => {
      if (!canManagePrivilegedSetup) {
        setApplicationRoles([]);
        return;
      }

      if (!hasValue(appId)) {
        setApplicationRoles([]);
        return;
      }

      const forceFresh = Boolean(options.forceFresh);
      setLoadingApplicationRoles(true);

      try {
        const rolesPayload = await getCachedJson({
          key: `${USER_MASTER_CACHE_KEYS.bootstrap}:roles:app:${appId}`,
          url: `/api/setup/roles?appKey=${encodeURIComponent(ADMIN_APP_KEY)}&app_id=${encodeURIComponent(appId)}`,
          ttlMs: USER_MASTER_CACHE_TTL.listsMs,
          forceFresh,
          allowStaleOnError: false,
        });

        const nextRoles = Array.isArray(rolesPayload)
          ? rolesPayload
          : rolesPayload?.roles ||
            rolesPayload?.data?.roles ||
            [];

        setApplicationRoles(nextRoles);
      } catch (error) {
        setApplicationRoles([]);
        setError(error?.message || "Unable to load roles for selected application");
      } finally {
        setLoadingApplicationRoles(false);
      }
    },
    [canManagePrivilegedSetup, setError]
  );

  useEffect(() => {
    if (!canManagePrivilegedSetup || !hasValue(selectedApplicationId)) {
      setApplicationRoles([]);
      return;
    }

    if (isTempId(selectedApplicationId) || selectedApplicationIsPendingRemove) {
      setApplicationRoles([]);
      return;
    }

    void loadRolesForApplication(selectedApplicationId);
  }, [
    canManagePrivilegedSetup,
    loadRolesForApplication,
    selectedApplicationId,
    selectedApplicationIsPendingRemove,
  ]);

  const handleRefresh = useCallback(async () => {
    if (
      hasAnyPendingBatchChanges &&
      !window.confirm("Discard staged changes and refresh from server?")
    ) {
      return;
    }

    await refetchAccess();
    await loadData({ forceFresh: true });
  }, [hasAnyPendingBatchChanges, loadData, refetchAccess]);

  async function callApi(url, method, body) {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(
        payload?.message ||
          payload?.error ||
          payload?.details?.message ||
          `${method} failed (${response.status})`
      );
    }

    return payload;
  }

  const cancelUsersBatch = useCallback(() => {
    if (!usersDiff.hasPendingChanges) return;

    setUsers(cloneBatchRows(batchBaseline.users));
    setSelectedUserId(null);
    closeUserDrawer();
    closeUserModal();
    setInfo("Staged user changes discarded.", "success");
  }, [batchBaseline.users, usersDiff.hasPendingChanges, setInfo]);

  const cancelCompaniesBatch = useCallback(() => {
    if (!companiesDiff.hasPendingChanges) return;

    setReferences((previous) => ({
      ...previous,
      companies: cloneBatchRows(batchBaseline.companies),
    }));
    closeCompanyModal();
    setInfo("Staged company changes discarded.", "success");
  }, [batchBaseline.companies, companiesDiff.hasPendingChanges, setInfo]);

  const cancelStatusesBatch = useCallback(() => {
    if (!statusesDiff.hasPendingChanges) return;

    setReferences((previous) => ({
      ...previous,
      statuses: cloneBatchRows(batchBaseline.statuses),
    }));
    closeStatusModal();
    setInfo("Staged status changes discarded.", "success");
  }, [batchBaseline.statuses, setInfo, statusesDiff.hasPendingChanges]);

  const cancelApplicationsBatch = useCallback(() => {
    if (!applicationsDiff.hasPendingChanges) return;

    setReferences((previous) => ({
      ...previous,
      applications: normalizeApplicationRows(cloneBatchRows(batchBaseline.applications)),
    }));

    if (isTempId(selectedApplicationId)) {
      setSelectedApplicationId("");
    }

    setApplicationDragContext({ sourceAppId: "", targetAppId: "" });

    closeApplicationModal();
    setInfo("Staged application changes discarded.", "success");
  }, [
    applicationsDiff.hasPendingChanges,
    batchBaseline.applications,
    selectedApplicationId,
    setInfo,
  ]);

  const clearApplicationDragContext = useCallback(() => {
    setApplicationDragContext({ sourceAppId: "", targetAppId: "" });
  }, []);

  const handleApplicationDragStart = useCallback((appId, event) => {
    const sourceAppId = String(appId || "");
    if (!hasValue(sourceAppId) || busy) return;

    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", sourceAppId);
    }

    setApplicationDragContext({
      sourceAppId,
      targetAppId: "",
    });
  }, [busy]);

  const handleApplicationDragOver = useCallback((targetAppId, event) => {
    const targetId = String(targetAppId || "");
    const sourceId = String(applicationDragContext.sourceAppId || "");
    if (!hasValue(targetId) || !hasValue(sourceId) || sourceId === targetId) return;

    event.preventDefault();
    if (event?.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    setApplicationDragContext((previous) =>
      previous.targetAppId === targetId
        ? previous
        : {
            ...previous,
            targetAppId: targetId,
          }
    );
  }, [applicationDragContext.sourceAppId]);

  const handleApplicationDrop = useCallback((targetAppId, event) => {
    event.preventDefault();

    const sourceId = String(applicationDragContext.sourceAppId || "");
    const targetId = String(targetAppId || "");

    if (!hasValue(sourceId) || !hasValue(targetId) || sourceId === targetId) {
      clearApplicationDragContext();
      return;
    }

    setReferences((previous) => {
      const currentApplications = Array.isArray(previous.applications) ? previous.applications : [];
      const sourceIndex = currentApplications.findIndex(
        (application) => String(application?.app_id || "") === sourceId
      );
      const targetIndex = currentApplications.findIndex(
        (application) => String(application?.app_id || "") === targetId
      );

      if (sourceIndex < 0 || targetIndex < 0) {
        return previous;
      }

      const reorderedApplications = moveArrayItem(currentApplications, sourceIndex, targetIndex);

      return {
        ...previous,
        applications: normalizeApplicationRows(resequenceApplicationRows(reorderedApplications)),
      };
    });

    clearApplicationDragContext();
  }, [applicationDragContext.sourceAppId, clearApplicationDragContext]);

  const saveUsersBatch = useCallback(async () => {
    if (!usersDiff.hasPendingChanges) return;

    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      const baselineById = new Map(
        (batchBaseline.users || []).map((row) => [String(row?.user_id), row])
      );

      for (const row of users || []) {
        const rowId = String(row?.user_id || "");
        if (!row?.__pendingRemove || !baselineById.has(rowId)) {
          continue;
        }

        await callApi(
          `/api/user-master/admin/users?appKey=${encodeURIComponent(ADMIN_APP_KEY)}&user_id=${encodeURIComponent(row.user_id)}&hard=true`,
          "DELETE"
        );
      }

      for (const row of users || []) {
        if (row?.__pendingRemove) continue;

        const rowId = String(row?.user_id || "");
        const baselineRow = baselineById.get(rowId);
        const isNew = isTempId(rowId) || !baselineRow;
        const rowDiff = usersDiff.byId.get(rowId) || DEFAULT_DIFF_ENTRY;

        const payload = {
          username: String(row?.username || "").trim() || null,
          email: String(row?.email || "").trim() || null,
          first_name: String(row?.first_name || "").trim() || null,
          middle_name: String(row?.middle_name || "").trim() || null,
          last_name: String(row?.last_name || "").trim() || null,
          phone: String(row?.phone || "").trim() || null,
          address: String(row?.address || "").trim() || null,
          position: String(row?.position || "").trim() || null,
          hire_date: String(row?.hire_date || "").trim() || null,
          comp_id: toNullableNumber(row?.comp_id),
          dept_id: toNullableNumber(row?.dept_id),
          status_id: toNullableNumber(row?.status_id),
        };

        if (isNew) {
          const password = String(row?.password || "").trim();
          if (!password) {
            throw new Error(
              `Password is required to save new user ${row?.username || row?.email || "(new user)"}.`
            );
          }

          await callApi(
            `/api/user-master/admin/users?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
            "POST",
            {
              ...payload,
              password,
            }
          );
          continue;
        }

        if (!rowDiff.isChanged) continue;

        await callApi(
          `/api/user-master/admin/users?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
          "PATCH",
          {
            user_id: row.user_id,
            ...payload,
            ...(String(row?.password || "").trim()
              ? { password: String(row.password) }
              : {}),
          }
        );
      }

      invalidateUserMasterCache([
        USER_MASTER_CACHE_KEYS.users,
        USER_MASTER_CACHE_KEYS.bootstrap,
        USER_MASTER_CACHE_KEYS.mappings,
      ]);
      await invalidateAccessCache();
      await loadData({ forceFresh: true });
      setInfo("Users batch saved.", "success");
    } catch (error) {
      setError(error?.message || "Unable to save users batch");
    } finally {
      setBusy(false);
    }
  }, [
    batchBaseline.users,
    invalidateAccessCache,
    loadData,
    setError,
    setInfo,
    users,
    usersDiff,
  ]);

  const saveCompaniesBatch = useCallback(async () => {
    if (!companiesDiff.hasPendingChanges) return;

    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      const draftCompanies = references.companies || [];
      const baselineById = new Map(
        (batchBaseline.companies || []).map((row) => [String(row?.comp_id), row])
      );

      for (const company of draftCompanies) {
        const companyId = String(company?.comp_id || "");
        if (!company?.__pendingRemove || !baselineById.has(companyId)) {
          continue;
        }

        await callApi(
          `/api/user-master/admin/companies?appKey=${encodeURIComponent(ADMIN_APP_KEY)}&comp_id=${encodeURIComponent(company.comp_id)}`,
          "DELETE"
        );
      }

      for (const company of draftCompanies) {
        if (company?.__pendingRemove) continue;

        const companyId = String(company?.comp_id || "");
        const baselineCompany = baselineById.get(companyId);
        const isNew = isTempId(companyId) || !baselineCompany;
        const rowDiff = companiesDiff.byId.get(companyId) || DEFAULT_DIFF_ENTRY;

        const payload = {
          comp_name: String(company?.comp_name || "").trim() || null,
          short_name: String(company?.short_name || "").trim() || null,
          comp_email: String(company?.comp_email || "").trim() || null,
          comp_phone: String(company?.comp_phone || "").trim() || null,
          is_active: Boolean(company?.is_active),
        };

        if (!payload.comp_name) {
          throw new Error("Company name is required before saving batch.");
        }

        if (isNew) {
          await callApi(
            `/api/user-master/admin/companies?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
            "POST",
            payload
          );
          continue;
        }

        if (!rowDiff.isChanged) continue;

        await callApi(
          `/api/user-master/admin/companies?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
          "PATCH",
          {
            comp_id: company.comp_id,
            ...payload,
          }
        );
      }

      invalidateUserMasterCache([
        USER_MASTER_CACHE_KEYS.bootstrap,
        USER_MASTER_CACHE_KEYS.users,
      ]);
      await loadData({ forceFresh: true });
      setInfo("Companies batch saved.", "success");
    } catch (error) {
      setError(error?.message || "Unable to save companies batch");
    } finally {
      setBusy(false);
    }
  }, [
    batchBaseline.companies,
    companiesDiff,
    loadData,
    references.companies,
    setError,
    setInfo,
  ]);

  const saveStatusesBatch = useCallback(async () => {
    if (!statusesDiff.hasPendingChanges) return;

    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      const draftStatuses = references.statuses || [];
      const baselineById = new Map(
        (batchBaseline.statuses || []).map((row) => [String(row?.status_id), row])
      );

      for (const status of draftStatuses) {
        const statusId = String(status?.status_id || "");
        if (!status?.__pendingRemove || !baselineById.has(statusId)) {
          continue;
        }

        await callApi(
          `/api/user-master/admin/statuses?appKey=${encodeURIComponent(ADMIN_APP_KEY)}&status_id=${encodeURIComponent(status.status_id)}`,
          "DELETE"
        );
      }

      for (const status of draftStatuses) {
        if (status?.__pendingRemove) continue;

        const statusId = String(status?.status_id || "");
        const baselineStatus = baselineById.get(statusId);
        const isNew = isTempId(statusId) || !baselineStatus;
        const rowDiff = statusesDiff.byId.get(statusId) || DEFAULT_DIFF_ENTRY;

        const payload = {
          sts_name: String(status?.sts_name || status?.status_name || "").trim() || null,
          sts_desc: String(status?.sts_desc || status?.status_desc || "").trim() || null,
          is_active: Boolean(status?.is_active),
        };

        if (!payload.sts_name) {
          throw new Error("Status name is required before saving batch.");
        }

        if (isNew) {
          await callApi(
            `/api/user-master/admin/statuses?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
            "POST",
            payload
          );
          continue;
        }

        if (!rowDiff.isChanged) continue;

        await callApi(
          `/api/user-master/admin/statuses?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
          "PATCH",
          {
            status_id: status.status_id,
            ...payload,
          }
        );
      }

      invalidateUserMasterCache([
        USER_MASTER_CACHE_KEYS.bootstrap,
        USER_MASTER_CACHE_KEYS.users,
      ]);
      await loadData({ forceFresh: true });
      setInfo("Statuses batch saved.", "success");
    } catch (error) {
      setError(error?.message || "Unable to save statuses batch");
    } finally {
      setBusy(false);
    }
  }, [
    batchBaseline.statuses,
    loadData,
    references.statuses,
    setError,
    setInfo,
    statusesDiff,
  ]);

  const saveApplicationsBatch = useCallback(async () => {
    if (!applicationsDiff.hasPendingChanges) return;

    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      let resolvedApplicationOrderField = applicationOrderField;

      if (!hasValue(resolvedApplicationOrderField)) {
        const response = await fetch(
          `/api/user-master/admin/applications?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const payload = await response.json().catch(() => ({}));

        if (response.ok && payload?.success !== false) {
          resolvedApplicationOrderField =
            String(payload?.applicationOrderField || payload?.data?.applicationOrderField || "").trim() ||
            "";

          if (!hasValue(resolvedApplicationOrderField)) {
            const sourceApplications = Array.isArray(payload?.applications)
              ? payload.applications
              : Array.isArray(payload?.data?.applications)
              ? payload.data.applications
              : [];

            resolvedApplicationOrderField = detectApplicationOrderField(sourceApplications);
          }

          if (hasValue(resolvedApplicationOrderField)) {
            setApplicationOrderField(resolvedApplicationOrderField);
          }
        }
      }

      const draftApplications = references.applications || [];
      const baselineById = new Map(
        (batchBaseline.applications || []).map((row) => [String(row?.app_id), row])
      );

      const activeApplications = draftApplications.filter((application) => !application?.__pendingRemove);
      const seenOrderValues = new Set();

      for (const application of activeApplications) {
        const displayOrder = toNullableNumber(application?.display_order);
        if (displayOrder === null || displayOrder <= 0) {
          throw new Error("Application order must be a positive number before saving batch.");
        }

        const orderKey = String(displayOrder);
        if (seenOrderValues.has(orderKey)) {
          throw new Error(`Duplicate application order ${displayOrder} detected. Please make orders unique.`);
        }

        seenOrderValues.add(orderKey);
      }

      if (!hasValue(resolvedApplicationOrderField)) {
        const attemptedOrderChange = activeApplications.some((application) => {
          const appId = String(application?.app_id || "");
          if (isTempId(appId)) return false;

          const baselineApplication = baselineById.get(appId);
          if (!baselineApplication) return false;

          return (
            normalizeBatchValue(application?.display_order, "number") !==
            normalizeBatchValue(baselineApplication?.display_order, "number")
          );
        });

        if (attemptedOrderChange) {
          throw new Error(
            "Application ordering cannot be saved because no order column was detected on applications. Add one of: display_order, app_order, sort_order, order_no. Run migrations: supabase/migrations/202604110001_add_application_display_order.sql and supabase/migrations/202604110002_add_applications_batch_rpc.sql"
          );
        }
      }

      if (resolvedApplicationOrderField !== "display_order") {
        throw new Error(
          `Batch save optimization requires display_order. Detected: ${resolvedApplicationOrderField}`
        );
      }

      const batchPayloadRows = draftApplications.map((application) => {
        const appId = isTempId(application?.app_id)
          ? null
          : toNullableNumber(application?.app_id);

        return {
          app_id: appId,
          app_name: String(application?.app_name || "").trim() || null,
          app_desc: String(application?.app_desc || "").trim() || null,
          is_active: Boolean(application?.is_active),
          display_order: toNullableNumber(application?.display_order),
          is_pending_remove: Boolean(application?.__pendingRemove),
        };
      });

      await callApi(
        `/api/user-master/admin/applications?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
        "POST",
        {
          mode: "batch",
          order_field: "display_order",
          applications: batchPayloadRows,
        }
      );

      invalidateUserMasterCache([
        USER_MASTER_CACHE_KEYS.bootstrap,
        USER_MASTER_CACHE_KEYS.mappings,
      ]);
      invalidateCacheKey(MY_APPS_CACHE_KEY, {
        namespace: MY_APPS_CACHE_NAMESPACE,
      });
      await loadData({ forceFresh: true });
      setInfo("Applications batch saved.", "success");
    } catch (error) {
      setError(error?.message || "Unable to save applications batch");
    } finally {
      setBusy(false);
    }
  }, [
    applicationOrderField,
    applicationsDiff,
    batchBaseline.applications,
    loadData,
    references.applications,
    setApplicationOrderField,
    setError,
    setInfo,
  ]);

  const upsertAccessMappingInState = useCallback((nextMapping) => {
    if (!nextMapping || nextMapping.uar_id === null || nextMapping.uar_id === undefined) {
      return;
    }

    setMappings((previous) => {
      let found = false;
      const next = previous.map((item) => {
        if (String(item.uar_id) !== String(nextMapping.uar_id)) {
          return item;
        }

        found = true;
        return {
          ...item,
          ...nextMapping,
        };
      });

      if (!found) {
        return [nextMapping, ...next];
      }

      return next;
    });
  }, []);

  const upsertUserInState = useCallback((nextUser) => {
    if (!nextUser || nextUser.user_id === null || nextUser.user_id === undefined) {
      return;
    }

    setUsers((previous) => {
      let found = false;
      const next = previous.map((item) => {
        if (String(item.user_id) !== String(nextUser.user_id)) {
          return item;
        }

        found = true;
        return {
          ...item,
          ...nextUser,
        };
      });

      if (!found) {
        return [nextUser, ...next];
      }

      return next;
    });
  }, []);

  const upsertRoleInState = useCallback((nextRole) => {
    if (!nextRole || nextRole.role_id === null || nextRole.role_id === undefined) {
      return;
    }

    setReferences((previous) => {
      let found = false;
      const nextRoles = (previous.roles || []).map((item) => {
        if (String(item.role_id) !== String(nextRole.role_id)) {
          return item;
        }

        found = true;
        return {
          ...item,
          ...nextRole,
        };
      });

      return {
        ...previous,
        roles: found ? nextRoles : [nextRole, ...nextRoles],
      };
    });
  }, []);

  const upsertCompanyInState = useCallback((nextCompany) => {
    if (!nextCompany || nextCompany.comp_id === null || nextCompany.comp_id === undefined) {
      return;
    }

    setReferences((previous) => {
      let found = false;
      const nextCompanies = (previous.companies || []).map((item) => {
        if (String(item.comp_id) !== String(nextCompany.comp_id)) {
          return item;
        }

        found = true;
        return {
          ...item,
          ...nextCompany,
        };
      });

      return {
        ...previous,
        companies: found ? nextCompanies : [nextCompany, ...nextCompanies],
      };
    });
  }, []);

  const upsertStatusInState = useCallback((nextStatus) => {
    if (!nextStatus || nextStatus.status_id === null || nextStatus.status_id === undefined) {
      return;
    }

    setReferences((previous) => {
      let found = false;
      const nextStatuses = (previous.statuses || []).map((item) => {
        if (String(item.status_id) !== String(nextStatus.status_id)) {
          return item;
        }

        found = true;
        return {
          ...item,
          ...nextStatus,
        };
      });

      return {
        ...previous,
        statuses: found ? nextStatuses : [nextStatus, ...nextStatuses],
      };
    });
  }, []);

  const upsertDepartmentInState = useCallback((nextDepartment) => {
    if (
      !nextDepartment ||
      nextDepartment.dept_id === null ||
      nextDepartment.dept_id === undefined
    ) {
      return;
    }

    setReferences((previous) => {
      let found = false;
      const nextDepartments = (previous.departments || []).map((item) => {
        if (String(item.dept_id) !== String(nextDepartment.dept_id)) {
          return item;
        }

        found = true;
        return {
          ...item,
          ...nextDepartment,
        };
      });

      return {
        ...previous,
        departments: found ? nextDepartments : [nextDepartment, ...nextDepartments],
      };
    });
  }, []);

  const upsertApplicationInState = useCallback((nextApplication) => {
    if (
      !nextApplication ||
      nextApplication.app_id === null ||
      nextApplication.app_id === undefined
    ) {
      return;
    }

    setReferences((previous) => {
      let found = false;
      const nextApplications = (previous.applications || []).map((item) => {
        if (String(item.app_id) !== String(nextApplication.app_id)) {
          return item;
        }

        found = true;
        return {
          ...item,
          ...nextApplication,
        };
      });

      return {
        ...previous,
        applications: normalizeApplicationRows(
          found ? nextApplications : [nextApplication, ...nextApplications]
        ),
      };
    });
  }, []);

  async function handleLogout() {
    setBusy(true);
    setFeedback({ text: "", variant: "info" });
    try {
      await callApi("/api/auth/logout", "POST");
      clearSessionCache(ADMIN_APP_KEY);
      await invalidateAccessCache();
      startNavbarLoader();
      router.push("/login");
    } catch (error) {
      setError(error?.message || "Logout failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleEmulateUser(userIdOverride = null) {
    if (!canManagePrivilegedSetup) {
      setError("Only DEVMAN can emulate users.");
      return;
    }

    const targetUserId = userIdOverride ?? selectedUserId;

    if (!targetUserId) {
      setError("Select a user to emulate.");
      return;
    }

    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      const payloadResponse = await callApi("/api/auth/emulate", "POST", {
        user_id: targetUserId,
        appKey: ADMIN_APP_KEY,
      });

      clearSessionCache(ADMIN_APP_KEY);
      await invalidateAccessCache();
      startNavbarLoader();
      setInfo(payloadResponse?.message || "Now emulating user.", "success");
      router.push("/dashboard");
    } catch (error) {
      setError(error?.message || "Unable to emulate user");
    } finally {
      setBusy(false);
    }
  }

  function openCreateUserModal() {
    setSelectedUserId(null);
    setUserModal({
      show: true,
      mode: "create",
      draft: {
        ...emptyUserDraft(),
        status_id: activeStatusId || "",
      },
      isPasswordVisible: false,
    });
  }

  function openEditUserModal(user) {
    const nextDraft = {
      user_id: user.user_id,
      username: user.username || "",
      email: user.email || "",
      password: "",
      confirm_password: "",
      first_name: user.first_name || "",
      middle_name: user.middle_name || "",
      last_name: user.last_name || "",
      phone: user.phone || "",
      address: user.address || "",
      position: user.position || "",
      hire_date: user.hire_date ? String(user.hire_date).slice(0, 10) : "",
      last_login: user.last_login || null,
      comp_id: asSelectValue(user.comp_id),
      dept_id: asSelectValue(user.dept_id),
      status_id:
        asSelectValue(user.status_id) ||
        (isUserRecordActive(user) ? activeStatusId : inactiveStatusId),
    };

    setSelectedUserId(user.user_id);
    setUserModal({
      show: false,
      mode: "edit",
      draft: nextDraft,
      isPasswordVisible: false,
    });

    setUserDrawer({
      show: true,
      activeTab: "profile",
      setNewPassword: false,
      showNewPassword: false,
      showStoredPassword: false,
    });
  }

  function closeUserModal() {
    setUserModal((prev) => ({ ...prev, show: false }));
  }

  function closeUserDrawer() {
    setUserDrawer((prev) => ({ ...prev, show: false }));
  }

  async function reloadDepartmentsForCompany(companyId) {
    if (!hasValue(companyId)) {
      return;
    }

    try {
      const payloadResponse = await callApi(
        `/api/user-master/admin/departments?appKey=${encodeURIComponent(ADMIN_APP_KEY)}&comp_id=${encodeURIComponent(companyId)}&includeInactive=false`,
        "GET"
      );

      const scopedDepartments = payloadResponse?.data?.departments || payloadResponse?.departments || [];

      setReferences((previous) => {
        const remaining = (previous.departments || []).filter(
          (department) => String(department.comp_id || "") !== String(companyId)
        );

        return {
          ...previous,
          departments: [...scopedDepartments, ...remaining],
        };
      });
    } catch {
      // Keep existing cached departments if scoped load fails.
    }
  }

  async function submitUserModal(event) {
    event.preventDefault();

    const draft = userModal.draft;

    if (!String(draft.username || "").trim() && !String(draft.email || "").trim()) {
      setError("Username or email is required.");
      return;
    }

    if (userModal.mode === "create" && !String(draft.password || "").trim()) {
      setError("Password is required when adding a user.");
      return;
    }

    if (
      userModal.mode === "create" &&
      String(draft.password || "") !== String(draft.confirm_password || "")
    ) {
      setError("Password and confirm password do not match.");
      return;
    }

    if (!hasValue(draft.status_id)) {
      setError("Status is required.");
      return;
    }

    const stagedPayload = {
      username: String(draft.username || "").trim() || null,
      email: String(draft.email || "").trim() || null,
      first_name: String(draft.first_name || "").trim() || null,
      middle_name: String(draft.middle_name || "").trim() || null,
      last_name: String(draft.last_name || "").trim() || null,
      phone: String(draft.phone || "").trim() || null,
      address: String(draft.address || "").trim() || null,
      position: String(draft.position || "").trim() || null,
      hire_date: String(draft.hire_date || "").trim() || null,
      comp_id: toNullableNumber(draft.comp_id),
      dept_id: toNullableNumber(draft.dept_id),
      status_id: toNullableNumber(draft.status_id),
      password: String(draft.password || "").trim() || "",
      confirm_password: String(draft.confirm_password || "").trim() || "",
    };

    if (userModal.mode === "create") {
      const tempUserId = createTempId("user");
      setUsers((previous) => [
        {
          user_id: tempUserId,
          ...stagedPayload,
          is_active: true,
          __pendingRemove: false,
        },
        ...(previous || []),
      ]);
      setInfo("User creation staged. Save Batch to apply.", "success");
    } else {
      setUsers((previous) =>
        (previous || []).map((item) =>
          String(item.user_id) === String(draft.user_id)
            ? {
                ...item,
                ...stagedPayload,
              }
            : item
        )
      );
      setInfo("User update staged. Save Batch to apply.", "success");
    }

    closeUserModal();
  }

  async function submitUserDrawer(event) {
    event.preventDefault();

    const draft = userModal.draft;

    if (!draft?.user_id) {
      setError("Select a user to edit.");
      return;
    }

    if (!hasValue(draft.status_id)) {
      setError("Status is required.");
      return;
    }

    if (userDrawer.setNewPassword) {
      if (!String(draft.password || "").trim()) {
        setError("New password is required when password reset is enabled.");
        return;
      }

      if (String(draft.password || "") !== String(draft.confirm_password || "")) {
        setError("New password and confirm password do not match.");
        return;
      }
    }

    setUsers((previous) =>
      (previous || []).map((item) =>
        String(item.user_id) === String(draft.user_id)
          ? {
              ...item,
              username: String(draft.username || "").trim() || null,
              email: String(draft.email || "").trim() || null,
              first_name: String(draft.first_name || "").trim() || null,
              middle_name: String(draft.middle_name || "").trim() || null,
              last_name: String(draft.last_name || "").trim() || null,
              phone: String(draft.phone || "").trim() || null,
              address: String(draft.address || "").trim() || null,
              position: String(draft.position || "").trim() || null,
              hire_date: String(draft.hire_date || "").trim() || null,
              comp_id: toNullableNumber(draft.comp_id),
              dept_id: toNullableNumber(draft.dept_id),
              status_id: toNullableNumber(draft.status_id),
              ...(userDrawer.setNewPassword && String(draft.password || "").trim()
                ? { password: String(draft.password) }
                : {}),
            }
          : item
      )
    );

    setInfo("User update staged. Save Batch to apply.", "success");
    closeUserDrawer();
  }

  async function deactivateUser(userId) {
    if (!hasValue(inactiveStatusId)) {
      setError("Inactive status is not configured.");
      return;
    }

    setUsers((previous) =>
      (previous || []).map((item) =>
        String(item.user_id) === String(userId)
          ? { ...item, status_id: toNullableNumber(inactiveStatusId) }
          : item
      )
    );

    setInfo("User status staged as inactive. Save Batch to apply.", "success");
  }

  async function activateUser(userId) {
    if (!hasValue(activeStatusId)) {
      setError("Active status is not configured.");
      return;
    }

    setUsers((previous) =>
      (previous || []).map((item) =>
        String(item.user_id) === String(userId)
          ? { ...item, status_id: toNullableNumber(activeStatusId) }
          : item
      )
    );

    setInfo("User status staged as active. Save Batch to apply.", "success");
  }

  function openCreateRoleModal(appId = null) {
    const resolvedAppId = hasValue(appId) ? asSelectValue(appId) : asSelectValue(selectedApplicationId);

    if (!hasValue(resolvedAppId)) {
      setError("Select an application first.");
      return;
    }

    setRoleModal({
      show: true,
      mode: "create",
      draft: {
        ...emptyRoleDraft(),
        app_id: resolvedAppId,
      },
    });
  }

  function openEditRoleModal(role) {
    setRoleModal({
      show: true,
      mode: "edit",
      draft: {
        role_id: role.role_id,
        app_id: asSelectValue(role.app_id),
        role_name: role.role_name || "",
        role_desc: role.role_desc || "",
        is_active: role.is_active !== false,
      },
    });
  }

  function closeRoleModal() {
    setRoleModal((prev) => ({ ...prev, show: false }));
  }

  async function submitRoleModal(event) {
    event.preventDefault();

    const draft = roleModal.draft;
    if (!String(draft.role_name || "").trim()) {
      setError("Role name is required.");
      return;
    }

    const roleAppId = asSelectValue(draft.app_id || selectedApplicationId);
    if (!hasValue(roleAppId)) {
      setError("Application context is required for roles.");
      return;
    }

    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      const payload = {
        role_name: String(draft.role_name || "").trim(),
        role_desc: String(draft.role_desc || "").trim() || null,
        app_id: roleAppId,
        is_active: Boolean(draft.is_active),
      };

      if (roleModal.mode === "create") {
        const payloadResponse = await callApi(
          `/api/user-master/admin/roles?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
          "POST",
          payload
        );

        const nextRole = payloadResponse?.data?.role || payloadResponse?.role;
        if (nextRole) {
          upsertRoleInState(nextRole);
        }

        setInfo(payloadResponse?.message || "Role added.", "success");
      } else {
        const payloadResponse = await callApi(
          `/api/user-master/admin/roles?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
          "PATCH",
          {
            role_id: draft.role_id,
            ...payload,
          }
        );

        const nextRole = payloadResponse?.data?.role || payloadResponse?.role;
        if (nextRole) {
          upsertRoleInState(nextRole);
        }

        setInfo(payloadResponse?.message || "Role updated.", "success");
      }

      closeRoleModal();
      invalidateUserMasterCache([USER_MASTER_CACHE_KEYS.bootstrap, USER_MASTER_CACHE_KEYS.mappings]);
      await invalidateAccessCache();
      await loadRolesForApplication(roleAppId, { forceFresh: true });
    } catch (error) {
      setError(error?.message || "Unable to save role");
    } finally {
      setBusy(false);
    }
  }

  async function deactivateRole(roleId) {
    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      const payloadResponse = await callApi(
        `/api/user-master/admin/roles?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
        "PATCH",
        {
          role_id: roleId,
          is_active: false,
        }
      );

      const nextRole = payloadResponse?.data?.role || payloadResponse?.role;
      if (nextRole) {
        upsertRoleInState(nextRole);
      } else {
        setReferences((previous) => ({
          ...previous,
          roles: (previous.roles || []).map((item) =>
            String(item.role_id) === String(roleId) ? { ...item, is_active: false } : item
          ),
        }));
      }

      invalidateUserMasterCache([USER_MASTER_CACHE_KEYS.bootstrap, USER_MASTER_CACHE_KEYS.mappings]);
      await invalidateAccessCache();
      setInfo(payloadResponse?.message || "Role deactivated.", "success");
      if (hasValue(selectedApplicationId)) {
        await loadRolesForApplication(selectedApplicationId, { forceFresh: true });
      }
    } catch (error) {
      setError(error?.message || "Unable to deactivate role");
    } finally {
      setBusy(false);
    }
  }

  async function activateRole(roleId) {
    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      const payloadResponse = await callApi(
        `/api/user-master/admin/roles?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
        "PATCH",
        {
          role_id: roleId,
          is_active: true,
        }
      );

      const nextRole = payloadResponse?.data?.role || payloadResponse?.role;
      if (nextRole) {
        upsertRoleInState(nextRole);
      } else {
        setReferences((previous) => ({
          ...previous,
          roles: (previous.roles || []).map((item) =>
            String(item.role_id) === String(roleId) ? { ...item, is_active: true } : item
          ),
        }));
      }

      invalidateUserMasterCache([USER_MASTER_CACHE_KEYS.bootstrap, USER_MASTER_CACHE_KEYS.mappings]);
      await invalidateAccessCache();
      setInfo(payloadResponse?.message || "Role activated.", "success");
      if (hasValue(selectedApplicationId)) {
        await loadRolesForApplication(selectedApplicationId, { forceFresh: true });
      }
    } catch (error) {
      setError(error?.message || "Unable to activate role");
    } finally {
      setBusy(false);
    }
  }

  function openCreateCompanyModal() {
    setCompanyModal({
      show: true,
      mode: "create",
      draft: emptyCompanyDraft(),
    });
  }

  function openEditCompanyModal(company) {
    setCompanyModal({
      show: true,
      mode: "edit",
      draft: {
        comp_id: company.comp_id,
        comp_name: company.comp_name || "",
        short_name: company.short_name || "",
        comp_email: company.comp_email || "",
        comp_phone: company.comp_phone || "",
        is_active: company.is_active !== false,
      },
    });
  }

  function closeCompanyModal() {
    setCompanyModal((prev) => ({ ...prev, show: false }));
  }

  async function submitCompanyModal(event) {
    event.preventDefault();

    const draft = companyModal.draft;
    if (!String(draft.comp_name || "").trim()) {
      setError("Company name is required.");
      return;
    }

    const stagedPayload = {
      comp_name: String(draft.comp_name || "").trim(),
      short_name: String(draft.short_name || "").trim() || null,
      comp_email: String(draft.comp_email || "").trim() || null,
      comp_phone: String(draft.comp_phone || "").trim() || null,
      is_active: Boolean(draft.is_active),
      __pendingRemove: false,
    };

    if (companyModal.mode === "create") {
      const tempCompId = createTempId("company");
      setReferences((previous) => ({
        ...previous,
        companies: [{ comp_id: tempCompId, ...stagedPayload }, ...(previous.companies || [])],
      }));
      setInfo("Company creation staged. Save Batch to apply.", "success");
    } else {
      setReferences((previous) => ({
        ...previous,
        companies: (previous.companies || []).map((item) =>
          String(item.comp_id) === String(draft.comp_id)
            ? {
                ...item,
                ...stagedPayload,
              }
            : item
        ),
      }));
      setInfo("Company update staged. Save Batch to apply.", "success");
    }

    closeCompanyModal();
  }

  async function deactivateCompany(compId) {
    setReferences((previous) => ({
      ...previous,
      companies: (previous.companies || []).map((item) =>
        String(item.comp_id) === String(compId) ? { ...item, is_active: false } : item
      ),
    }));

    setInfo("Company status staged as inactive. Save Batch to apply.", "success");
  }

  async function activateCompany(compId) {
    setReferences((previous) => ({
      ...previous,
      companies: (previous.companies || []).map((item) =>
        String(item.comp_id) === String(compId) ? { ...item, is_active: true } : item
      ),
    }));

    setInfo("Company status staged as active. Save Batch to apply.", "success");
  }

  function toggleCompanyDetails(compId) {
    setExpandedCompanyId((previous) =>
      String(previous || "") === String(compId || "") ? null : compId
    );
  }

  function openCreateDepartmentModal(compId) {
    setDepartmentModal({
      show: true,
      mode: "create",
      draft: {
        ...emptyDepartmentDraft(),
        comp_id: asSelectValue(compId),
      },
    });
  }

  function openEditDepartmentModal(department) {
    setDepartmentModal({
      show: true,
      mode: "edit",
      draft: {
        dept_id: department.dept_id,
        dept_name: department.dept_name || "",
        short_name: department.short_name || "",
        comp_id: asSelectValue(department.comp_id),
        is_active: department.is_active !== false,
      },
    });
  }

  function closeDepartmentModal() {
    setDepartmentModal((prev) => ({ ...prev, show: false }));
  }

  async function submitDepartmentModal(event) {
    event.preventDefault();

    const draft = departmentModal.draft;
    if (!String(draft.dept_name || "").trim()) {
      setError("Department name is required.");
      return;
    }

    if (!hasValue(draft.comp_id)) {
      setError("Company is required for a department.");
      return;
    }

    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      const payload = {
        dept_name: String(draft.dept_name || "").trim(),
        short_name: String(draft.short_name || "").trim() || null,
        comp_id: toNullableNumber(draft.comp_id),
        is_active: Boolean(draft.is_active),
      };

      if (departmentModal.mode === "create") {
        const payloadResponse = await callApi(
          `/api/user-master/admin/departments?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
          "POST",
          payload
        );

        const nextDepartment = payloadResponse?.data?.department || payloadResponse?.department;
        if (nextDepartment) {
          upsertDepartmentInState(nextDepartment);
        }

        setInfo(payloadResponse?.message || "Department added.", "success");
      } else {
        const payloadResponse = await callApi(
          `/api/user-master/admin/departments?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
          "PATCH",
          {
            dept_id: draft.dept_id,
            ...payload,
          }
        );

        const nextDepartment = payloadResponse?.data?.department || payloadResponse?.department;
        if (nextDepartment) {
          upsertDepartmentInState(nextDepartment);
        }

        setInfo(payloadResponse?.message || "Department updated.", "success");
      }

      closeDepartmentModal();
      invalidateUserMasterCache([USER_MASTER_CACHE_KEYS.bootstrap, USER_MASTER_CACHE_KEYS.users]);
    } catch (error) {
      setError(error?.message || "Unable to save department");
    } finally {
      setBusy(false);
    }
  }

  async function activateDepartment(deptId) {
    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      const payloadResponse = await callApi(
        `/api/user-master/admin/departments?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
        "PATCH",
        {
          dept_id: deptId,
          is_active: true,
        }
      );

      const nextDepartment = payloadResponse?.data?.department || payloadResponse?.department;
      if (nextDepartment) {
        upsertDepartmentInState(nextDepartment);
      }

      invalidateUserMasterCache([USER_MASTER_CACHE_KEYS.bootstrap, USER_MASTER_CACHE_KEYS.users]);
      setInfo(payloadResponse?.message || "Department activated.", "success");
    } catch (error) {
      setError(error?.message || "Unable to activate department");
    } finally {
      setBusy(false);
    }
  }

  async function deactivateDepartment(deptId) {
    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      const payloadResponse = await callApi(
        `/api/user-master/admin/departments?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
        "PATCH",
        {
          dept_id: deptId,
          is_active: false,
        }
      );

      const nextDepartment = payloadResponse?.data?.department || payloadResponse?.department;
      if (nextDepartment) {
        upsertDepartmentInState(nextDepartment);
      }

      invalidateUserMasterCache([USER_MASTER_CACHE_KEYS.bootstrap, USER_MASTER_CACHE_KEYS.users]);
      setInfo(payloadResponse?.message || "Department deactivated.", "success");
    } catch (error) {
      setError(error?.message || "Unable to deactivate department");
    } finally {
      setBusy(false);
    }
  }

  function openCreateStatusModal() {
    setStatusModal({
      show: true,
      mode: "create",
      draft: emptyStatusDraft(),
    });
  }

  function openEditStatusModal(status) {
    setStatusModal({
      show: true,
      mode: "edit",
      draft: {
        status_id: status.status_id,
        sts_name: status.sts_name || status.status_name || "",
        sts_desc: status.sts_desc || status.status_desc || "",
        is_active: status.is_active !== false,
      },
    });
  }

  function closeStatusModal() {
    setStatusModal((prev) => ({ ...prev, show: false }));
  }

  async function submitStatusModal(event) {
    event.preventDefault();

    const draft = statusModal.draft;
    if (!String(draft.sts_name || "").trim()) {
      setError("Status name is required.");
      return;
    }

    const stagedPayload = {
      sts_name: String(draft.sts_name || "").trim(),
      sts_desc: String(draft.sts_desc || "").trim() || null,
      is_active: Boolean(draft.is_active),
      __pendingRemove: false,
    };

    if (statusModal.mode === "create") {
      const tempStatusId = createTempId("status");
      setReferences((previous) => ({
        ...previous,
        statuses: [{ status_id: tempStatusId, ...stagedPayload }, ...(previous.statuses || [])],
      }));
      setInfo("Status creation staged. Save Batch to apply.", "success");
    } else {
      setReferences((previous) => ({
        ...previous,
        statuses: (previous.statuses || []).map((item) =>
          String(item.status_id) === String(draft.status_id)
            ? {
                ...item,
                ...stagedPayload,
              }
            : item
        ),
      }));
      setInfo("Status update staged. Save Batch to apply.", "success");
    }

    closeStatusModal();
  }

  async function deactivateStatus(statusId) {
    setReferences((previous) => ({
      ...previous,
      statuses: (previous.statuses || []).map((item) =>
        String(item.status_id) === String(statusId) ? { ...item, is_active: false } : item
      ),
    }));

    setInfo("Status staged as inactive. Save Batch to apply.", "success");
  }

  async function activateStatus(statusId) {
    setReferences((previous) => ({
      ...previous,
      statuses: (previous.statuses || []).map((item) =>
        String(item.status_id) === String(statusId) ? { ...item, is_active: true } : item
      ),
    }));

    setInfo("Status staged as active. Save Batch to apply.", "success");
  }

  function openCreateApplicationModal() {
    const nextDisplayOrder =
      (references.applications || []).reduce(
        (max, item) => Math.max(max, toNullableNumber(item?.display_order) ?? 0),
        0
      ) + 1;

    setApplicationModal({
      show: true,
      mode: "create",
      draft: {
        ...emptyApplicationDraft(),
        display_order: nextDisplayOrder,
      },
    });
  }

  function openEditApplicationModal(application) {
    setApplicationModal({
      show: true,
      mode: "edit",
      draft: {
        app_id: application.app_id,
        app_name: application.app_name || "",
        app_desc: application.app_desc || "",
        display_order: toNullableNumber(application.display_order) ?? resolveApplicationOrder(application, 1),
        is_active: application.is_active !== false,
      },
    });
  }

  function closeApplicationModal() {
    setApplicationModal((prev) => ({ ...prev, show: false }));
  }

  async function submitApplicationModal(event) {
    event.preventDefault();

    const draft = applicationModal.draft;
    if (!String(draft.app_name || "").trim()) {
      setError("Application name is required.");
      return;
    }

    const displayOrder = toNullableNumber(draft.display_order);
    if (displayOrder === null || displayOrder <= 0) {
      setError("Application order must be a positive number.");
      return;
    }

    const stagedPayload = {
      app_name: String(draft.app_name || "").trim(),
      app_desc: String(draft.app_desc || "").trim() || null,
      display_order: displayOrder,
      is_active: Boolean(draft.is_active),
      __pendingRemove: false,
    };

    if (applicationModal.mode === "create") {
      const tempAppId = createTempId("application");
      setReferences((previous) => ({
        ...previous,
        applications: normalizeApplicationRows([
          { app_id: tempAppId, ...stagedPayload },
          ...(previous.applications || []),
        ]),
      }));
      setInfo("Application creation staged. Save Batch to apply.", "success");
    } else {
      setReferences((previous) => ({
        ...previous,
        applications: normalizeApplicationRows(
          (previous.applications || []).map((item) =>
            String(item.app_id) === String(draft.app_id)
              ? {
                  ...item,
                  ...stagedPayload,
                }
              : item
          )
        ),
      }));
      setInfo("Application update staged. Save Batch to apply.", "success");
    }

    closeApplicationModal();
  }

  async function deactivateApplication(appId) {
    setReferences((previous) => ({
      ...previous,
      applications: normalizeApplicationRows(
        (previous.applications || []).map((item) =>
          String(item.app_id) === String(appId) ? { ...item, is_active: false } : item
        )
      ),
    }));

    setInfo("Application staged as inactive. Save Batch to apply.", "success");
  }

  async function activateApplication(appId) {
    setReferences((previous) => ({
      ...previous,
      applications: normalizeApplicationRows(
        (previous.applications || []).map((item) =>
          String(item.app_id) === String(appId) ? { ...item, is_active: true } : item
        )
      ),
    }));

    setInfo("Application staged as active. Save Batch to apply.", "success");
  }

  function openCreateAccessModal(userId = "") {
    setAccessModal({
      show: true,
      mode: "create",
      draft: {
        ...emptyAccessDraft(),
        user_id: hasValue(userId) ? asSelectValue(userId) : "",
      },
      lockUser: hasValue(userId),
    });
  }

  function openEditAccessModal(mapping) {
    setAccessModal({
      show: true,
      mode: "edit",
      draft: {
        uar_id: mapping.uar_id,
        user_id: asSelectValue(mapping.user_id),
        role_id: asSelectValue(mapping.role_id),
        app_id: asSelectValue(mapping.app_id),
        is_active: mapping.is_active !== false,
      },
      lockUser: true,
    });
  }

  function closeAccessModal() {
    setAccessModal((prev) => ({ ...prev, show: false, lockUser: false }));
  }

  async function submitAccessModal(event) {
    event.preventDefault();

    const draft = accessModal.draft;
    if (!draft.user_id || !draft.role_id || !draft.app_id) {
      setError("User, role, and application are required.");
      return;
    }

    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      const payload = {
        user_id: toNullableNumber(draft.user_id),
        role_id: toNullableNumber(draft.role_id),
        app_id: toNullableNumber(draft.app_id),
        is_active: Boolean(draft.is_active),
      };

      if (accessModal.mode === "create") {
        const payloadResponse = await callApi(
          `/api/user-master/admin/access-mappings?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
          "POST",
          payload
        );

        const nextMapping = payloadResponse?.data?.mapping || payloadResponse?.mapping;
        if (nextMapping) {
          upsertAccessMappingInState(nextMapping);
        }

        setInfo(payloadResponse?.message || "Access mapping added.", "success");
      } else {
        const payloadResponse = await callApi(
          `/api/user-master/admin/access-mappings?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
          "PATCH",
          {
            id: draft.uar_id,
            ...payload,
          }
        );

        const nextMapping = payloadResponse?.data?.mapping || payloadResponse?.mapping;
        if (nextMapping) {
          upsertAccessMappingInState(nextMapping);
        }

        setInfo(payloadResponse?.message || "Access mapping updated.", "success");
      }

      closeAccessModal();
      invalidateUserMasterCache([
        USER_MASTER_CACHE_KEYS.mappings,
        USER_MASTER_CACHE_KEYS.access(ADMIN_APP_KEY),
        USER_MASTER_CACHE_KEYS.profile,
      ]);
      await invalidateAccessCache();
    } catch (error) {
      setError(error?.message || "Unable to save access mapping");
    } finally {
      setBusy(false);
    }
  }

  async function deactivateAccessMapping(uarId) {
    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      const payloadResponse = await callApi(
        `/api/user-master/admin/access-mappings?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
        "PATCH",
        {
          id: uarId,
          is_active: false,
        }
      );

      const nextMapping = payloadResponse?.data?.mapping || payloadResponse?.mapping;
      if (nextMapping) {
        upsertAccessMappingInState(nextMapping);
      } else {
        setMappings((previous) =>
          previous.map((item) =>
            String(item.uar_id) === String(uarId) ? { ...item, is_active: false } : item
          )
        );
      }

      invalidateUserMasterCache([
        USER_MASTER_CACHE_KEYS.mappings,
        USER_MASTER_CACHE_KEYS.access(ADMIN_APP_KEY),
        USER_MASTER_CACHE_KEYS.profile,
      ]);
      await invalidateAccessCache();
      setInfo(payloadResponse?.message || "Access mapping deactivated.", "success");
    } catch (error) {
      setError(error?.message || "Unable to deactivate access mapping");
    } finally {
      setBusy(false);
    }
  }

  async function activateAccessMapping(uarId) {
    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      const payloadResponse = await callApi(
        `/api/user-master/admin/access-mappings?appKey=${encodeURIComponent(ADMIN_APP_KEY)}`,
        "PATCH",
        {
          id: uarId,
          is_active: true,
        }
      );

      const nextMapping = payloadResponse?.data?.mapping || payloadResponse?.mapping;
      if (nextMapping) {
        upsertAccessMappingInState(nextMapping);
      } else {
        setMappings((previous) =>
          previous.map((item) =>
            String(item.uar_id) === String(uarId) ? { ...item, is_active: true } : item
          )
        );
      }

      invalidateUserMasterCache([
        USER_MASTER_CACHE_KEYS.mappings,
        USER_MASTER_CACHE_KEYS.access(ADMIN_APP_KEY),
        USER_MASTER_CACHE_KEYS.profile,
      ]);
      await invalidateAccessCache();
      setInfo(payloadResponse?.message || "Access mapping activated.", "success");
    } catch (error) {
      setError(error?.message || "Unable to activate access mapping");
    } finally {
      setBusy(false);
    }
  }

  function openRemoveModal(table, id, label) {
    setRemoveModal({
      show: true,
      table,
      id,
      label: String(label || "").trim() || "this record",
    });
  }

  function closeRemoveModal() {
    setRemoveModal({
      show: false,
      table: "",
      id: null,
      label: "",
    });
  }

  async function confirmRemoveRecord() {
    if (!removeModal.table || removeModal.id === null || removeModal.id === undefined) {
      return;
    }

    setBusy(true);
    setFeedback({ text: "", variant: "info" });

    try {
      const table = String(removeModal.table || "").toLowerCase();
      const id = removeModal.id;

      if (table === "users") {
        if (isTempId(id)) {
          setUsers((previous) =>
            (previous || []).filter((item) => String(item.user_id) !== String(id))
          );
          closeRemoveModal();
          setInfo("Staged new user removed.", "success");
          return;
        }

        setUsers((previous) =>
          (previous || []).map((item) =>
            String(item.user_id) !== String(id)
              ? item
              : {
                  ...item,
                  __pendingRemove: !Boolean(item.__pendingRemove),
                }
          )
        );

        closeRemoveModal();
        setInfo("User deletion staged. Save Batch to apply.", "success");
        return;
      }

      if (table === "companies") {
        if (isTempId(id)) {
          setReferences((previous) => ({
            ...previous,
            companies: (previous.companies || []).filter(
              (item) => String(item.comp_id) !== String(id)
            ),
          }));
          closeRemoveModal();
          setInfo("Staged new company removed.", "success");
          return;
        }

        setReferences((previous) => ({
          ...previous,
          companies: (previous.companies || []).map((item) =>
            String(item.comp_id) !== String(id)
              ? item
              : {
                  ...item,
                  __pendingRemove: !Boolean(item.__pendingRemove),
                }
          ),
        }));

        closeRemoveModal();
        setInfo("Company deletion staged. Save Batch to apply.", "success");
        return;
      }

      if (table === "statuses") {
        if (isTempId(id)) {
          setReferences((previous) => ({
            ...previous,
            statuses: (previous.statuses || []).filter(
              (item) => String(item.status_id) !== String(id)
            ),
          }));
          closeRemoveModal();
          setInfo("Staged new status removed.", "success");
          return;
        }

        setReferences((previous) => ({
          ...previous,
          statuses: (previous.statuses || []).map((item) =>
            String(item.status_id) !== String(id)
              ? item
              : {
                  ...item,
                  __pendingRemove: !Boolean(item.__pendingRemove),
                }
          ),
        }));

        closeRemoveModal();
        setInfo("Status deletion staged. Save Batch to apply.", "success");
        return;
      }

      if (table === "applications") {
        if (isTempId(id)) {
          setReferences((previous) => ({
            ...previous,
            applications: normalizeApplicationRows(
              (previous.applications || []).filter(
                (item) => String(item.app_id) !== String(id)
              )
            ),
          }));
          closeRemoveModal();
          setInfo("Staged new application removed.", "success");
          return;
        }

        setReferences((previous) => ({
          ...previous,
          applications: normalizeApplicationRows(
            (previous.applications || []).map((item) =>
              String(item.app_id) !== String(id)
                ? item
                : {
                    ...item,
                    __pendingRemove: !Boolean(item.__pendingRemove),
                  }
            )
          ),
        }));

        closeRemoveModal();
        setInfo("Application deletion staged. Save Batch to apply.", "success");
        return;
      }

      if (table === "roles") {
        const payloadResponse = await callApi(
          `/api/user-master/admin/roles?appKey=${encodeURIComponent(ADMIN_APP_KEY)}&role_id=${encodeURIComponent(id)}`,
          "DELETE"
        );

        setReferences((previous) => ({
          ...previous,
          roles: (previous.roles || []).filter((item) => String(item.role_id) !== String(id)),
        }));
        invalidateUserMasterCache([USER_MASTER_CACHE_KEYS.bootstrap, USER_MASTER_CACHE_KEYS.mappings]);
        await invalidateAccessCache();
        if (hasValue(selectedApplicationId)) {
          await loadRolesForApplication(selectedApplicationId, { forceFresh: true });
        }
        setInfo(payloadResponse?.message || "Role removed.", "success");
      } else if (table === "departments") {
        const payloadResponse = await callApi(
          `/api/user-master/admin/departments?appKey=${encodeURIComponent(ADMIN_APP_KEY)}&dept_id=${encodeURIComponent(id)}`,
          "DELETE"
        );

        setReferences((previous) => ({
          ...previous,
          departments: (previous.departments || []).filter(
            (item) => String(item.dept_id) !== String(id)
          ),
        }));
        invalidateUserMasterCache([USER_MASTER_CACHE_KEYS.bootstrap, USER_MASTER_CACHE_KEYS.users]);
        setInfo(payloadResponse?.message || "Department removed.", "success");
      } else if (table === "access") {
        const payloadResponse = await callApi(
          `/api/user-master/admin/access-mappings?appKey=${encodeURIComponent(ADMIN_APP_KEY)}&id=${encodeURIComponent(id)}`,
          "DELETE"
        );

        setMappings((previous) => previous.filter((item) => String(item.uar_id) !== String(id)));
        invalidateUserMasterCache([
          USER_MASTER_CACHE_KEYS.mappings,
          USER_MASTER_CACHE_KEYS.access(ADMIN_APP_KEY),
          USER_MASTER_CACHE_KEYS.profile,
        ]);
        await invalidateAccessCache();
        setInfo(payloadResponse?.message || "Access mapping removed.", "success");
      }

      closeRemoveModal();
    } catch (error) {
      setError(error?.message || "Unable to remove record");
    } finally {
      setBusy(false);
    }
  }

  const selectedUserStatus = statusLookup.get(String(userModal.draft.status_id || ""));
  const selectedUserStatusLabel = selectedUserStatus
    ? getLabel(selectedUserStatus, ["sts_name", "status_name"])
    : "--";
  const selectedUserIsActive = isStatusActive(userModal.draft.status_id);
  const roleModalApplication = applicationLookup.get(String(roleModal?.draft?.app_id || ""));
  const roleModalApplicationLabel = roleModalApplication
    ? getLabel(roleModalApplication, ["app_name"])
    : hasValue(roleModal?.draft?.app_id)
    ? `App ${roleModal.draft.app_id}`
    : "--";
  const removeModalTableKey = String(removeModal?.table || "").toLowerCase();
  const isBatchRemoveTable = ["users", "companies", "statuses", "applications"].includes(
    removeModalTableKey
  );

  if (loading) {
    return <Container className="py-4">Loading configuration...</Container>;
  }

  if (accessDeniedMessage) {
    return (
      <Container className="py-4" style={{ maxWidth: 980 }}>
        <Card className="border-0 shadow-sm">
          <Card.Body className="py-4">
            <h3 className="mb-2">You do not have access</h3>
            <p className="text-muted mb-3">
              Configuration & Settings is restricted. Contact your administrator if this is unexpected.
            </p>
            <div className="notice-banner notice-banner-danger mb-0">{accessDeniedMessage}</div>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  if (access && !isAdminUser && !access.permissions?.read) {
    return (
      <Container className="py-4" style={{ maxWidth: 980 }}>
        <div className="notice-banner notice-banner-danger">
          You do not have permission to access Configuration & Settings.
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-4" style={{ maxWidth: 1260 }}>
      <div className="d-flex align-items-center mb-3 justify-content-between">
        <div className="d-flex align-items-center">
          <div>
            <h2 className="mb-0">Configuration and Settings</h2>
            <p className="text-muted mb-0">
              Manage setup tables and mapping assignments for User Master.
            </p>
          </div>
        </div>
        <div className="d-flex gap-2">
          {canManagePrivilegedSetup ? (
            <Button
              type="button"
              variant="outline-primary"
              onClick={() => {
                startNavbarLoader();
                router.push("/setup/admin/cards");
              }}
              disabled={busy}
            >
              Setup Cards
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline-secondary"
            onClick={() => void handleRefresh()}
            disabled={busy}
          >
            Refresh
          </Button>
          <Button type="button" variant="outline-danger" onClick={handleLogout} disabled={busy}>
            Logout
          </Button>
        </div>
      </div>

      <Tabs
        id="configuration-tabs"
        activeKey={activeTab}
        onSelect={(key) => {
          if (isSingleSectionMode) return;
          setActiveTab(key || "users");
        }}
        className={isSingleSectionMode ? "mb-0 d-none" : "mb-3"}
      >
        <Tab eventKey="users" title="Users">
          <Card>
            <Card.Header className="d-flex align-items-center justify-content-between fw-bold">
              <span>Users</span>
              <div className="d-flex align-items-center gap-2">
                <span className={`small setup-change-summary ${usersDiff.hasPendingChanges ? "is-dirty" : ""}`}>
                  {usersDiff.hasPendingChanges
                    ? `${usersDiff.newRows} new, ${usersDiff.modifiedRows} modified, ${usersDiff.removedRows} removed`
                    : "No changes"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline-success"
                  onClick={() => void saveUsersBatch()}
                  disabled={busy || !usersDiff.hasPendingChanges}
                >
                  Save Batch
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline-secondary"
                  onClick={cancelUsersBatch}
                  disabled={busy || !usersDiff.hasPendingChanges}
                >
                  Cancel Batch
                </Button>
                <Button type="button" size="sm" onClick={openCreateUserModal} disabled={busy}>
                  Add User
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              <div>
                <Table size="sm" bordered hover className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Actions</th>
                      <th>Username</th>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Company</th>
                      <th>Department</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-3">
                          No users found.
                        </td>
                      </tr>
                    ) : users.map((user) => {
                      const userId = String(user.user_id || "");
                      const company = companyLookup.get(String(user.comp_id || ""));
                      const department = departmentLookup.get(String(user.dept_id || ""));
                      const status = statusLookup.get(String(user.status_id || ""));
                      const userIsActive = isUserRecordActive(user);
                      const userDiff = usersDiff.byId.get(userId) || DEFAULT_DIFF_ENTRY;
                      const rowStateClass = userDiff.isPendingRemove
                        ? "admin-row-pending-remove"
                        : userDiff.isNew
                        ? "admin-row-new"
                        : userDiff.isChanged
                        ? "admin-row-modified"
                        : "";

                      return (
                        <tr
                          key={userId}
                          className={`${
                            String(selectedUserId || "") === userId ? "admin-row-selected" : ""
                          } ${rowStateClass}`}
                          onClick={() => {
                            if (userDiff.isPendingRemove) return;
                            openEditUserModal(user);
                          }}
                        >
                          <td>
                            <div className="d-flex gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline-primary"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (userDiff.isPendingRemove) return;
                                  openEditUserModal(user);
                                }}
                                disabled={busy || userDiff.isPendingRemove}
                                aria-label="Edit user"
                                title="Edit"
                              >
                                <i className="bi bi-pencil-square" aria-hidden="true" />
                              </Button>
                              {canManagePrivilegedSetup ? (
                                <>
                                  {userIsActive ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline-danger"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        deactivateUser(user.user_id);
                                      }}
                                      disabled={busy || userDiff.isPendingRemove}
                                      aria-label="Deactivate user"
                                      title="Deactivate"
                                    >
                                      <i className="bi bi-slash-circle" aria-hidden="true" />
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline-success"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        activateUser(user.user_id);
                                      }}
                                      disabled={busy || userDiff.isPendingRemove}
                                      aria-label="Activate user"
                                      title="Activate"
                                    >
                                      <i className="bi bi-check-circle" aria-hidden="true" />
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={userDiff.isPendingRemove ? "outline-warning" : "outline-dark"}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openRemoveModal(
                                        "users",
                                        user.user_id,
                                        user.username || user.email || `User ${user.user_id}`
                                      );
                                    }}
                                    disabled={busy}
                                    aria-label={userDiff.isPendingRemove ? "Undo remove user" : "Remove user"}
                                    title={userDiff.isPendingRemove ? "Undo remove" : "Remove"}
                                  >
                                    <i
                                      className={`bi ${
                                        userDiff.isPendingRemove
                                          ? "bi-arrow-counterclockwise"
                                          : "bi-trash"
                                      }`}
                                      aria-hidden="true"
                                    />
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </td>
                          <td className={userDiff.changedColumns.has("username") ? "admin-cell-changed" : ""}>
                            {user.username || "--"}
                          </td>
                          <td
                            className={
                              userDiff.changedColumns.has("first_name") ||
                              userDiff.changedColumns.has("middle_name") ||
                              userDiff.changedColumns.has("last_name")
                                ? "admin-cell-changed"
                                : ""
                            }
                          >
                            {[user.first_name, user.middle_name, user.last_name]
                              .filter(Boolean)
                              .join(" ") || "--"}
                          </td>
                          <td className={userDiff.changedColumns.has("email") ? "admin-cell-changed" : ""}>
                            {user.email || "--"}
                          </td>
                          <td className={userDiff.changedColumns.has("comp_id") ? "admin-cell-changed" : ""}>
                            {company ? getLabel(company, ["comp_name"]) : "--"}
                          </td>
                          <td className={userDiff.changedColumns.has("dept_id") ? "admin-cell-changed" : ""}>
                            {department ? getLabel(department, ["dept_name"]) : "--"}
                          </td>
                          <td className={userDiff.changedColumns.has("status_id") ? "admin-cell-changed" : ""}>
                            {status ? getLabel(status, ["sts_name", "status_name"]) : "--"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="companies" title="Setup • Companies">
          <Card>
            <Card.Header className="d-flex align-items-center justify-content-between fw-bold">
              <span>Companies</span>
              <div className="d-flex align-items-center gap-2">
                <span className={`small setup-change-summary ${companiesDiff.hasPendingChanges ? "is-dirty" : ""}`}>
                  {companiesDiff.hasPendingChanges
                    ? `${companiesDiff.newRows} new, ${companiesDiff.modifiedRows} modified, ${companiesDiff.removedRows} removed`
                    : "No changes"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline-success"
                  onClick={() => void saveCompaniesBatch()}
                  disabled={busy || !companiesDiff.hasPendingChanges}
                >
                  Save Batch
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline-secondary"
                  onClick={cancelCompaniesBatch}
                  disabled={busy || !companiesDiff.hasPendingChanges}
                >
                  Cancel Batch
                </Button>
                <Button type="button" size="sm" onClick={openCreateCompanyModal} disabled={busy}>
                  Add Company
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              <Table size="sm" bordered hover className="admin-data-table">
                <thead>
                  <tr>
                    <th>Actions</th>
                    <th>Company ID</th>
                    <th>Company Name</th>
                    <th>Short Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {references.companies.map((company) => {
                    const companyId = String(company.comp_id || "");
                    const isExpanded = String(expandedCompanyId || "") === String(company.comp_id);
                    const companyDepartments = (references.departments || []).filter(
                      (department) => String(department.comp_id || "") === String(company.comp_id)
                    );
                    const companyDiff = companiesDiff.byId.get(companyId) || DEFAULT_DIFF_ENTRY;
                    const rowStateClass = companyDiff.isPendingRemove
                      ? "admin-row-pending-remove"
                      : companyDiff.isNew
                      ? "admin-row-new"
                      : companyDiff.isChanged
                      ? "admin-row-modified"
                      : "";

                    return (
                      <Fragment key={companyId}>
                        <tr
                          className={`${isExpanded ? "admin-row-selected" : ""} ${rowStateClass}`}
                          onClick={() => {
                            if (companyDiff.isPendingRemove) return;
                            toggleCompanyDetails(company.comp_id);
                          }}
                        >
                          <td>
                            <div className="d-flex gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline-primary"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (companyDiff.isPendingRemove) return;
                                  openEditCompanyModal(company);
                                }}
                                disabled={busy || companyDiff.isPendingRemove}
                                aria-label="Edit company"
                                title="Edit"
                              >
                                <i className="bi bi-pencil-square" aria-hidden="true" />
                              </Button>
                              {canManagePrivilegedSetup ? (
                                <>
                                  {company.is_active ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline-danger"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        deactivateCompany(company.comp_id);
                                      }}
                                      disabled={busy || companyDiff.isPendingRemove}
                                      aria-label="Deactivate company"
                                      title="Deactivate"
                                    >
                                      <i className="bi bi-slash-circle" aria-hidden="true" />
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline-success"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        activateCompany(company.comp_id);
                                      }}
                                      disabled={busy || companyDiff.isPendingRemove}
                                      aria-label="Activate company"
                                      title="Activate"
                                    >
                                      <i className="bi bi-check-circle" aria-hidden="true" />
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={companyDiff.isPendingRemove ? "outline-warning" : "outline-dark"}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openRemoveModal(
                                        "companies",
                                        company.comp_id,
                                        company.comp_name || `Company ${company.comp_id}`
                                      );
                                    }}
                                    disabled={busy}
                                    aria-label={
                                      companyDiff.isPendingRemove ? "Undo remove company" : "Remove company"
                                    }
                                    title={companyDiff.isPendingRemove ? "Undo remove" : "Remove"}
                                  >
                                    <i
                                      className={`bi ${
                                        companyDiff.isPendingRemove
                                          ? "bi-arrow-counterclockwise"
                                          : "bi-trash"
                                      }`}
                                      aria-hidden="true"
                                    />
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </td>
                          <td>{company.comp_id}</td>
                          <td className={companyDiff.changedColumns.has("comp_name") ? "admin-cell-changed" : ""}>
                            {company.comp_name || "--"}
                          </td>
                          <td className={companyDiff.changedColumns.has("short_name") ? "admin-cell-changed" : ""}>
                            {company.short_name || "--"}
                          </td>
                          <td className={companyDiff.changedColumns.has("comp_email") ? "admin-cell-changed" : ""}>
                            {company.comp_email || "--"}
                          </td>
                          <td className={companyDiff.changedColumns.has("comp_phone") ? "admin-cell-changed" : ""}>
                            {company.comp_phone || "--"}
                          </td>
                          <td className={companyDiff.changedColumns.has("is_active") ? "admin-cell-changed" : ""}>
                            <Badge bg={company.is_active ? "success" : "secondary"}>
                              {company.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                        </tr>

                        {isExpanded ? (
                          <tr>
                            <td colSpan={7} className="bg-light-subtle">
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <strong>Departments</strong>
                                {canManagePrivilegedSetup ? (
                                  <Button
                                    size="sm"
                                    onClick={() => openCreateDepartmentModal(company.comp_id)}
                                    disabled={busy || companyDiff.isPendingRemove}
                                  >
                                    Add Department
                                  </Button>
                                ) : null}
                              </div>

                              {companyDepartments.length === 0 ? (
                                <div className="text-muted small">No departments linked to this company.</div>
                              ) : (
                                <Table size="sm" bordered hover className="admin-data-table mb-0">
                                  <thead>
                                    <tr>
                                      <th>Department Name</th>
                                      <th>Short Name</th>
                                      <th>Active</th>
                                      {canManagePrivilegedSetup ? <th>Actions</th> : null}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {companyDepartments.map((department) => (
                                      <tr key={String(department.dept_id)}>
                                        <td>{department.dept_name || "--"}</td>
                                        <td>{department.short_name || "--"}</td>
                                        <td>
                                          <Badge bg={department.is_active ? "success" : "secondary"}>
                                            {department.is_active ? "Active" : "Inactive"}
                                          </Badge>
                                        </td>
                                        {canManagePrivilegedSetup ? (
                                          <td>
                                            <div className="d-flex gap-1">
                                              <Button
                                                size="sm"
                                                variant="outline-primary"
                                                onClick={() => openEditDepartmentModal(department)}
                                                disabled={busy}
                                                aria-label="Edit department"
                                                title="Edit"
                                              >
                                                <i className="bi bi-pencil-square" aria-hidden="true" />
                                              </Button>
                                              {department.is_active ? (
                                                <Button
                                                  size="sm"
                                                  variant="outline-danger"
                                                  onClick={() => deactivateDepartment(department.dept_id)}
                                                  disabled={busy}
                                                  aria-label="Deactivate department"
                                                  title="Deactivate"
                                                >
                                                  <i className="bi bi-slash-circle" aria-hidden="true" />
                                                </Button>
                                              ) : (
                                                <Button
                                                  size="sm"
                                                  variant="outline-success"
                                                  onClick={() => activateDepartment(department.dept_id)}
                                                  disabled={busy}
                                                  aria-label="Activate department"
                                                  title="Activate"
                                                >
                                                  <i className="bi bi-check-circle" aria-hidden="true" />
                                                </Button>
                                              )}
                                              <Button
                                                size="sm"
                                                variant="outline-dark"
                                                onClick={() =>
                                                  openRemoveModal(
                                                    "departments",
                                                    department.dept_id,
                                                    department.dept_name || `Department ${department.dept_id}`
                                                  )
                                                }
                                                disabled={busy}
                                                aria-label="Remove department"
                                                title="Remove"
                                              >
                                                <i className="bi bi-trash" aria-hidden="true" />
                                              </Button>
                                            </div>
                                          </td>
                                        ) : null}
                                      </tr>
                                    ))}
                                  </tbody>
                                </Table>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>

        {canManagePrivilegedSetup ? (
          <Tab eventKey="statuses" title="Setup • Statuses">
          <Card>
            <Card.Header className="d-flex align-items-center justify-content-between fw-bold">
              <span>Statuses</span>
              <div className="d-flex align-items-center gap-2">
                <span className={`small setup-change-summary ${statusesDiff.hasPendingChanges ? "is-dirty" : ""}`}>
                  {statusesDiff.hasPendingChanges
                    ? `${statusesDiff.newRows} new, ${statusesDiff.modifiedRows} modified, ${statusesDiff.removedRows} removed`
                    : "No changes"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline-success"
                  onClick={() => void saveStatusesBatch()}
                  disabled={busy || !statusesDiff.hasPendingChanges}
                >
                  Save Batch
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline-secondary"
                  onClick={cancelStatusesBatch}
                  disabled={busy || !statusesDiff.hasPendingChanges}
                >
                  Cancel Batch
                </Button>
                <Button type="button" size="sm" onClick={openCreateStatusModal} disabled={busy}>
                  Add Status
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              <Table size="sm" bordered hover className="admin-data-table">
                <thead>
                  <tr>
                    <th>Actions</th>
                    <th>Status ID</th>
                    <th>Status Name</th>
                    <th>Description</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {references.statuses.map((status) => {
                    const statusId = String(status.status_id || "");
                    const statusDiff = statusesDiff.byId.get(statusId) || DEFAULT_DIFF_ENTRY;
                    const rowStateClass = statusDiff.isPendingRemove
                      ? "admin-row-pending-remove"
                      : statusDiff.isNew
                      ? "admin-row-new"
                      : statusDiff.isChanged
                      ? "admin-row-modified"
                      : "";

                    return (
                    <tr key={statusId} className={rowStateClass}>
                      <td>
                        <div className="d-flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline-primary"
                            onClick={() => openEditStatusModal(status)}
                            disabled={busy || statusDiff.isPendingRemove}
                            aria-label="Edit status"
                            title="Edit"
                          >
                            <i className="bi bi-pencil-square" aria-hidden="true" />
                          </Button>
                          {status.is_active ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline-danger"
                              onClick={() => deactivateStatus(status.status_id)}
                              disabled={busy || statusDiff.isPendingRemove}
                              aria-label="Deactivate status"
                              title="Deactivate"
                            >
                              <i className="bi bi-slash-circle" aria-hidden="true" />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline-success"
                              onClick={() => activateStatus(status.status_id)}
                              disabled={busy || statusDiff.isPendingRemove}
                              aria-label="Activate status"
                              title="Activate"
                            >
                              <i className="bi bi-check-circle" aria-hidden="true" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant={statusDiff.isPendingRemove ? "outline-warning" : "outline-dark"}
                            onClick={() =>
                              openRemoveModal(
                                "statuses",
                                status.status_id,
                                status.sts_name || status.status_name || `Status ${status.status_id}`
                              )
                            }
                            disabled={busy}
                            aria-label={statusDiff.isPendingRemove ? "Undo remove status" : "Remove status"}
                            title={statusDiff.isPendingRemove ? "Undo remove" : "Remove"}
                          >
                            <i
                              className={`bi ${
                                statusDiff.isPendingRemove ? "bi-arrow-counterclockwise" : "bi-trash"
                              }`}
                              aria-hidden="true"
                            />
                          </Button>
                        </div>
                      </td>
                      <td>{status.status_id}</td>
                      <td className={statusDiff.changedColumns.has("sts_name") ? "admin-cell-changed" : ""}>
                        {status.sts_name || status.status_name || "--"}
                      </td>
                      <td className={statusDiff.changedColumns.has("sts_desc") ? "admin-cell-changed" : ""}>
                        {status.sts_desc || status.status_desc || "--"}
                      </td>
                      <td className={statusDiff.changedColumns.has("is_active") ? "admin-cell-changed" : ""}>
                        <Badge bg={status.is_active ? "success" : "secondary"}>
                          {status.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
          </Tab>
        ) : null}

        {canManagePrivilegedSetup ? (
          <Tab eventKey="applications" title="Setup • Applications">
          <Row className="g-3">
            <Col lg={6}>
              <Card>
                <Card.Header className="d-flex align-items-center justify-content-between fw-bold">
                  <span>Applications</span>
                  <div className="d-flex align-items-center gap-2">
                    <span
                      className={`small setup-change-summary ${
                        applicationsDiff.hasPendingChanges ? "is-dirty" : ""
                      }`}
                    >
                      {applicationsDiff.hasPendingChanges
                        ? `${applicationsDiff.newRows} new, ${applicationsDiff.modifiedRows} modified, ${applicationsDiff.removedRows} removed`
                        : "No changes"}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline-success"
                      onClick={() => void saveApplicationsBatch()}
                      disabled={busy || !applicationsDiff.hasPendingChanges}
                    >
                      Save Batch
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline-secondary"
                      onClick={cancelApplicationsBatch}
                      disabled={busy || !applicationsDiff.hasPendingChanges}
                    >
                      Cancel Batch
                    </Button>
                    <Button type="button" size="sm" onClick={openCreateApplicationModal} disabled={busy}>
                      Add Application
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body>
                  <div className="small text-muted mb-2">
                    Drag the grip icon in Actions to reorder applications.
                  </div>
                  <Table size="sm" bordered hover className="admin-data-table mb-0">
                    <thead>
                      <tr>
                        <th>Actions</th>
                        <th>Application Name</th>
                        <th>Order</th>
                        <th>Description</th>
                        <th>Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(references.applications || []).map((application) => {
                        const appId = String(application.app_id || "");
                        const applicationDiff = applicationsDiff.byId.get(appId) || DEFAULT_DIFF_ENTRY;
                        const isDropTarget =
                          hasValue(applicationDragContext.sourceAppId) &&
                          applicationDragContext.sourceAppId !== appId &&
                          applicationDragContext.targetAppId === appId;
                        const rowStateClass = applicationDiff.isPendingRemove
                          ? "admin-row-pending-remove"
                          : applicationDiff.isNew
                          ? "admin-row-new"
                          : applicationDiff.isChanged
                          ? "admin-row-modified"
                          : "";

                        return (
                        <tr
                          key={appId}
                          className={`${
                            String(selectedApplicationId || "") === appId ? "admin-row-selected" : ""
                          } ${rowStateClass} ${isDropTarget ? "table-primary" : ""}`}
                          onClick={() => {
                            if (applicationDiff.isPendingRemove) return;
                            setSelectedApplicationId(asSelectValue(application.app_id));
                          }}
                          onDragOver={(event) => {
                            if (applicationDiff.isPendingRemove) return;
                            handleApplicationDragOver(appId, event);
                          }}
                          onDrop={(event) => {
                            if (applicationDiff.isPendingRemove) return;
                            handleApplicationDrop(appId, event);
                          }}
                        >
                          <td>
                            <div className="d-flex gap-1">
                              <span
                                className={`d-inline-flex align-items-center justify-content-center border rounded px-1 ${
                                  busy || applicationDiff.isPendingRemove ? " text-muted" : ""
                                }`}
                                draggable={!busy && !applicationDiff.isPendingRemove}
                                onDragStart={(event) => handleApplicationDragStart(appId, event)}
                                onDragEnd={clearApplicationDragContext}
                                title={
                                  applicationDiff.isPendingRemove
                                    ? "Undo remove to reorder"
                                    : "Drag to reorder"
                                }
                                aria-label="Drag to reorder"
                                style={{ cursor: busy || applicationDiff.isPendingRemove ? "not-allowed" : "grab" }}
                              >
                                <i className="bi bi-grip-vertical" aria-hidden="true" />
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline-primary"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (applicationDiff.isPendingRemove) return;
                                  openEditApplicationModal(application);
                                }}
                                disabled={busy || applicationDiff.isPendingRemove}
                                aria-label="Edit application"
                                title="Edit"
                              >
                                <i className="bi bi-pencil-square" aria-hidden="true" />
                              </Button>
                              {application.is_active ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    deactivateApplication(application.app_id);
                                  }}
                                  disabled={busy || applicationDiff.isPendingRemove}
                                  aria-label="Deactivate application"
                                  title="Deactivate"
                                >
                                  <i className="bi bi-slash-circle" aria-hidden="true" />
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline-success"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    activateApplication(application.app_id);
                                  }}
                                  disabled={busy || applicationDiff.isPendingRemove}
                                  aria-label="Activate application"
                                  title="Activate"
                                >
                                  <i className="bi bi-check-circle" aria-hidden="true" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant={applicationDiff.isPendingRemove ? "outline-warning" : "outline-dark"}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openRemoveModal(
                                    "applications",
                                    application.app_id,
                                    application.app_name || `Application ${application.app_id}`
                                  );
                                }}
                                disabled={busy}
                                aria-label={
                                  applicationDiff.isPendingRemove
                                    ? "Undo remove application"
                                    : "Remove application"
                                }
                                title={applicationDiff.isPendingRemove ? "Undo remove" : "Remove"}
                              >
                                <i
                                  className={`bi ${
                                    applicationDiff.isPendingRemove
                                      ? "bi-arrow-counterclockwise"
                                      : "bi-trash"
                                  }`}
                                  aria-hidden="true"
                                />
                              </Button>
                            </div>
                          </td>
                          <td className={applicationDiff.changedColumns.has("app_name") ? "admin-cell-changed" : ""}>
                            {application.app_name || "--"}
                          </td>
                          <td className={applicationDiff.changedColumns.has("display_order") ? "admin-cell-changed" : ""}>
                            {toNullableNumber(application.display_order) ?? "--"}
                          </td>
                          <td className={applicationDiff.changedColumns.has("app_desc") ? "admin-cell-changed" : ""}>
                            {application.app_desc || "--"}
                          </td>
                          <td className={applicationDiff.changedColumns.has("is_active") ? "admin-cell-changed" : ""}>
                            <Badge bg={application.is_active ? "success" : "secondary"}>
                              {application.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={6}>
              <Card>
                <Card.Header className="d-flex align-items-center justify-content-between fw-bold">
                  <span>
                    Roles for: {selectedApplication?.app_name || "Select application"}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openCreateRoleModal(selectedApplicationId)}
                    disabled={
                      busy ||
                      !hasValue(selectedApplicationId) ||
                      isTempId(selectedApplicationId) ||
                      selectedApplicationIsPendingRemove
                    }
                  >
                    Add Role
                  </Button>
                </Card.Header>
                <Card.Body>
                  {!hasValue(selectedApplicationId) ? (
                    <div className="notice-banner notice-banner-muted mb-0">
                      Select an application to manage roles.
                    </div>
                  ) : isTempId(selectedApplicationId) ? (
                    <div className="notice-banner notice-banner-muted mb-0">
                      Save the new application first, then roles can be managed.
                    </div>
                  ) : selectedApplicationIsPendingRemove ? (
                    <div className="notice-banner notice-banner-muted mb-0">
                      Undo application removal or save batch before managing roles.
                    </div>
                  ) : loadingApplicationRoles ? (
                    <div className="text-muted">Loading roles...</div>
                  ) : applicationRoles.length === 0 ? (
                    <div className="notice-banner notice-banner-muted mb-0">
                      No roles found for this application.
                    </div>
                  ) : (
                    <Table size="sm" bordered hover className="admin-data-table mb-0">
                      <thead>
                        <tr>
                          <th>Role Name</th>
                          <th>Description</th>
                          <th>Active</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applicationRoles.map((role) => (
                          <tr key={String(role.role_id)}>
                            <td>{role.role_name || "--"}</td>
                            <td>{role.role_desc || "--"}</td>
                            <td>
                              <Badge bg={role.is_active ? "success" : "secondary"}>
                                {role.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline-primary"
                                  onClick={() => openEditRoleModal(role)}
                                  disabled={busy}
                                  aria-label="Edit role"
                                  title="Edit"
                                >
                                  <i className="bi bi-pencil-square" aria-hidden="true" />
                                </Button>
                                {role.is_active ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => deactivateRole(role.role_id)}
                                    disabled={busy}
                                    aria-label="Deactivate role"
                                    title="Deactivate"
                                  >
                                    <i className="bi bi-slash-circle" aria-hidden="true" />
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline-success"
                                    onClick={() => activateRole(role.role_id)}
                                    disabled={busy}
                                    aria-label="Activate role"
                                    title="Activate"
                                  >
                                    <i className="bi bi-check-circle" aria-hidden="true" />
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline-dark"
                                  onClick={() =>
                                    openRemoveModal(
                                      "roles",
                                      role.role_id,
                                      role.role_name || `Role ${role.role_id}`
                                    )
                                  }
                                  disabled={busy}
                                  aria-label="Remove role"
                                  title="Remove"
                                >
                                  <i className="bi bi-trash" aria-hidden="true" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
            </Tab>
        ) : null}

      </Tabs>

      <Modal show={userModal.show} onHide={closeUserModal} centered size="lg">
        <Form onSubmit={submitUserModal}>
          <Modal.Header closeButton>
            <Modal.Title>Add User</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <h6 className="mb-2">Account</h6>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    value={userModal.draft.username}
                    onChange={(event) =>
                      setUserModal((prev) => ({
                        ...prev,
                        draft: { ...prev.draft, username: event.target.value },
                      }))
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={userModal.draft.email}
                    onChange={(event) =>
                      setUserModal((prev) => ({
                        ...prev,
                        draft: { ...prev.draft, email: event.target.value },
                      }))
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Password (required)</Form.Label>
                  <div className="d-flex gap-2">
                    <Form.Control
                      type={userModal.isPasswordVisible ? "text" : "password"}
                      value={userModal.draft.password}
                      onChange={(event) =>
                        setUserModal((prev) => ({
                          ...prev,
                          draft: { ...prev.draft, password: event.target.value },
                        }))
                      }
                      placeholder="Enter password"
                    />
                    <Button
                      type="button"
                      variant="outline-secondary"
                      onClick={() =>
                        setUserModal((prev) => ({
                          ...prev,
                          isPasswordVisible: !prev.isPasswordVisible,
                        }))
                      }
                    >
                      {userModal.isPasswordVisible ? "Hide" : "Show"}
                    </Button>
                  </div>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Confirm Password (required)</Form.Label>
                  <Form.Control
                    type={userModal.isPasswordVisible ? "text" : "password"}
                    value={userModal.draft.confirm_password}
                    onChange={(event) =>
                      setUserModal((prev) => ({
                        ...prev,
                        draft: { ...prev.draft, confirm_password: event.target.value },
                      }))
                    }
                    placeholder="Confirm password"
                  />
                </Form.Group>
              </Col>

              <Col xs={12}>
                <hr className="my-1" />
                <h6 className="mb-2 mt-1">Personal</h6>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>First Name</Form.Label>
                  <Form.Control
                    value={userModal.draft.first_name}
                    onChange={(event) =>
                      setUserModal((prev) => ({
                        ...prev,
                        draft: { ...prev.draft, first_name: event.target.value },
                      }))
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Last Name</Form.Label>
                  <Form.Control
                    value={userModal.draft.last_name}
                    onChange={(event) =>
                      setUserModal((prev) => ({
                        ...prev,
                        draft: { ...prev.draft, last_name: event.target.value },
                      }))
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    value={userModal.draft.phone}
                    onChange={(event) =>
                      setUserModal((prev) => ({
                        ...prev,
                        draft: { ...prev.draft, phone: event.target.value },
                      }))
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Address</Form.Label>
                  <Form.Control
                    value={userModal.draft.address}
                    onChange={(event) =>
                      setUserModal((prev) => ({
                        ...prev,
                        draft: { ...prev.draft, address: event.target.value },
                      }))
                    }
                  />
                </Form.Group>
              </Col>

              <Col xs={12}>
                <hr className="my-1" />
                <h6 className="mb-2 mt-1">Organization</h6>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label>Company</Form.Label>
                  <Form.Select
                    value={userModal.draft.comp_id}
                    onChange={(event) =>
                      setUserModal((prev) => ({
                        ...prev,
                        draft: {
                          ...prev.draft,
                          comp_id: event.target.value,
                          dept_id: "",
                        },
                      }))
                    }
                  >
                    <option value="">Select company...</option>
                    {references.companies.map((company) => (
                      <option key={String(company.comp_id)} value={String(company.comp_id)}>
                        {getLabel(company, ["comp_name"])}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Department</Form.Label>
                  <Form.Select
                    value={userModal.draft.dept_id}
                    onChange={(event) =>
                      setUserModal((prev) => ({
                        ...prev,
                        draft: { ...prev.draft, dept_id: event.target.value },
                      }))
                    }
                  >
                    <option value="">Select department...</option>
                    {userModalDepartmentOptions.map((department) => (
                      <option key={String(department.dept_id)} value={String(department.dept_id)}>
                        {getLabel(department, ["dept_name"])}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    value={userModal.draft.status_id}
                    onChange={(event) =>
                      setUserModal((prev) => ({
                        ...prev,
                        draft: { ...prev.draft, status_id: event.target.value },
                      }))
                    }
                  >
                    <option value="">Select status...</option>
                    {references.statuses.map((status) => (
                      <option key={String(status.status_id)} value={String(status.status_id)}>
                        {getLabel(status, ["sts_name", "status_name"])}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="outline-secondary" onClick={closeUserModal} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Stage User"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Offcanvas
        show={userDrawer.show}
        onHide={closeUserDrawer}
        placement="end"
        backdrop={false}
        className="admin-user-drawer"
      >
        <Form onSubmit={submitUserDrawer} className="h-100 d-flex flex-column">
          <Offcanvas.Header closeButton>
            <Offcanvas.Title>
              <div>{[userModal.draft.first_name, userModal.draft.last_name].filter(Boolean).join(" ") || "User"}</div>
              <div className="small text-muted">@{userModal.draft.username || "unknown"}</div>
              <div className="mt-1">
                <Badge bg={selectedUserIsActive ? "success" : "secondary"}>
                  {selectedUserStatusLabel}
                </Badge>
              </div>
            </Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body className="d-flex flex-column">
            <div className="d-flex justify-content-end gap-2 mb-2">
              <Button type="submit" size="sm" disabled={busy}>Save</Button>
              <Button type="button" size="sm" variant="outline-secondary" onClick={closeUserDrawer} disabled={busy}>
                Close
              </Button>
            </div>

            <Tabs
              activeKey={userDrawer.activeTab}
              onSelect={(key) =>
                setUserDrawer((prev) => ({ ...prev, activeTab: key || "profile" }))
              }
              className="mb-3"
            >
              <Tab eventKey="profile" title="Profile">
                <Row className="g-3 mt-1">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Username</Form.Label>
                      <Form.Control
                        value={userModal.draft.username}
                        onChange={(event) =>
                          setUserModal((prev) => ({
                            ...prev,
                            draft: { ...prev.draft, username: event.target.value },
                          }))
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        value={userModal.draft.email}
                        onChange={(event) =>
                          setUserModal((prev) => ({
                            ...prev,
                            draft: { ...prev.draft, email: event.target.value },
                          }))
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>First Name</Form.Label>
                      <Form.Control
                        value={userModal.draft.first_name}
                        onChange={(event) =>
                          setUserModal((prev) => ({
                            ...prev,
                            draft: { ...prev.draft, first_name: event.target.value },
                          }))
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Middle Name</Form.Label>
                      <Form.Control
                        value={userModal.draft.middle_name}
                        onChange={(event) =>
                          setUserModal((prev) => ({
                            ...prev,
                            draft: { ...prev.draft, middle_name: event.target.value },
                          }))
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Last Name</Form.Label>
                      <Form.Control
                        value={userModal.draft.last_name}
                        onChange={(event) =>
                          setUserModal((prev) => ({
                            ...prev,
                            draft: { ...prev.draft, last_name: event.target.value },
                          }))
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Phone</Form.Label>
                      <Form.Control
                        value={userModal.draft.phone}
                        onChange={(event) =>
                          setUserModal((prev) => ({
                            ...prev,
                            draft: { ...prev.draft, phone: event.target.value },
                          }))
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Address</Form.Label>
                      <Form.Control
                        value={userModal.draft.address}
                        onChange={(event) =>
                          setUserModal((prev) => ({
                            ...prev,
                            draft: { ...prev.draft, address: event.target.value },
                          }))
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Tab>

              <Tab eventKey="organization" title="Organization">
                <Row className="g-3 mt-1">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Company</Form.Label>
                      <Form.Select
                        value={userModal.draft.comp_id}
                        onChange={async (event) => {
                          const nextCompanyId = event.target.value;
                          setUserModal((prev) => ({
                            ...prev,
                            draft: {
                              ...prev.draft,
                              comp_id: nextCompanyId,
                              dept_id: "",
                            },
                          }));
                          await reloadDepartmentsForCompany(nextCompanyId);
                        }}
                      >
                        <option value="">Select company...</option>
                        {references.companies.map((company) => (
                          <option key={String(company.comp_id)} value={String(company.comp_id)}>
                            {getLabel(company, ["comp_name"])}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Department</Form.Label>
                      <Form.Select
                        value={userModal.draft.dept_id}
                        onChange={(event) =>
                          setUserModal((prev) => ({
                            ...prev,
                            draft: { ...prev.draft, dept_id: event.target.value },
                          }))
                        }
                      >
                        <option value="">Select department...</option>
                        {userDrawerDepartmentOptions.map((department) => (
                          <option key={String(department.dept_id)} value={String(department.dept_id)}>
                            {getLabel(department, ["dept_name"])}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Position</Form.Label>
                      <Form.Control
                        value={userModal.draft.position}
                        onChange={(event) =>
                          setUserModal((prev) => ({
                            ...prev,
                            draft: { ...prev.draft, position: event.target.value },
                          }))
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Hire Date</Form.Label>
                      <Form.Control
                        type="date"
                        value={userModal.draft.hire_date}
                        onChange={(event) =>
                          setUserModal((prev) => ({
                            ...prev,
                            draft: { ...prev.draft, hire_date: event.target.value },
                          }))
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Status</Form.Label>
                      <Form.Select
                        value={userModal.draft.status_id}
                        onChange={(event) =>
                          setUserModal((prev) => ({
                            ...prev,
                            draft: { ...prev.draft, status_id: event.target.value },
                          }))
                        }
                      >
                        <option value="">Select status...</option>
                        {references.statuses.map((status) => (
                          <option key={String(status.status_id)} value={String(status.status_id)}>
                            {getLabel(status, ["sts_name", "status_name"])}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
              </Tab>

              {canManagePrivilegedSetup ? (
                <Tab eventKey="access" title="Access">
                <div className="d-flex justify-content-end mb-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openCreateAccessModal(selectedUserId)}
                    disabled={busy || !selectedUserId}
                  >
                    Add Access
                  </Button>
                </div>

                {selectedUserMappings.length === 0 ? (
                  <div className="notice-banner notice-banner-muted">
                    No access mappings assigned to this user.
                  </div>
                ) : (
                  <Table size="sm" bordered hover className="admin-data-table">
                    <thead>
                      <tr>
                        <th>Application</th>
                        <th>Role</th>
                        <th>Active</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUserMappings.map((mapping) => {
                        const role = roleLookup.get(String(mapping.role_id || ""));
                        const application = applicationLookup.get(String(mapping.app_id || ""));

                        return (
                          <tr key={String(mapping.uar_id)}>
                            <td>{application ? getLabel(application, ["app_name"]) : "--"}</td>
                            <td>{role ? getLabel(role, ["role_name"]) : "--"}</td>
                            <td>
                              <Badge bg={mapping.is_active ? "success" : "secondary"}>
                                {mapping.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline-primary"
                                  onClick={() => openEditAccessModal(mapping)}
                                  disabled={busy}
                                  aria-label="Edit access mapping"
                                  title="Edit"
                                >
                                  <i className="bi bi-pencil-square" aria-hidden="true" />
                                </Button>
                                {mapping.is_active ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => deactivateAccessMapping(mapping.uar_id)}
                                    disabled={busy}
                                    aria-label="Deactivate access mapping"
                                    title="Deactivate"
                                  >
                                    <i className="bi bi-slash-circle" aria-hidden="true" />
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline-success"
                                    onClick={() => activateAccessMapping(mapping.uar_id)}
                                    disabled={busy}
                                    aria-label="Activate access mapping"
                                    title="Activate"
                                  >
                                    <i className="bi bi-check-circle" aria-hidden="true" />
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline-dark"
                                  onClick={() =>
                                    openRemoveModal("access", mapping.uar_id, `Mapping ${mapping.uar_id}`)
                                  }
                                  disabled={busy}
                                  aria-label="Remove access mapping"
                                  title="Remove"
                                >
                                  <i className="bi bi-trash" aria-hidden="true" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
                </Tab>
              ) : null}

              <Tab eventKey="account" title="Account">
                <div className="notice-banner notice-banner-muted mb-3">
                  Passwords are stored as one-way bcrypt hashes and cannot be reversed to plaintext.
                </div>

                <Form.Check
                  type="switch"
                  id="account-set-new-password"
                  label="Set New Password"
                  checked={Boolean(userDrawer.setNewPassword)}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setUserDrawer((prev) => ({
                      ...prev,
                      setNewPassword: enabled,
                      showNewPassword: enabled ? prev.showNewPassword : false,
                    }));
                    if (!enabled) {
                      setUserModal((prev) => ({
                        ...prev,
                        draft: {
                          ...prev.draft,
                          password: "",
                          confirm_password: "",
                        },
                      }));
                    }
                  }}
                />

                {userDrawer.setNewPassword ? (
                  <Row className="g-3 mt-1">
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>New Password</Form.Label>
                        <div className="d-flex gap-2">
                          <Form.Control
                            type={userDrawer.showNewPassword ? "text" : "password"}
                            value={userModal.draft.password}
                            onChange={(event) =>
                              setUserModal((prev) => ({
                                ...prev,
                                draft: { ...prev.draft, password: event.target.value },
                              }))
                            }
                            placeholder="Enter new password"
                          />
                          <Button
                            type="button"
                            variant="outline-secondary"
                            onClick={() =>
                              setUserDrawer((prev) => ({
                                ...prev,
                                showNewPassword: !prev.showNewPassword,
                              }))
                            }
                          >
                            {userDrawer.showNewPassword ? "Hide" : "Show"}
                          </Button>
                        </div>
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>Confirm New Password</Form.Label>
                        <Form.Control
                          type={userDrawer.showNewPassword ? "text" : "password"}
                          value={userModal.draft.confirm_password}
                          onChange={(event) =>
                            setUserModal((prev) => ({
                              ...prev,
                              draft: { ...prev.draft, confirm_password: event.target.value },
                            }))
                          }
                          placeholder="Re-enter new password"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                ) : null}

                {canManagePrivilegedSetup ? (
                  <div className="mt-3">
                    <Form.Group>
                      <Form.Label className="mb-1">Stored Password Hash (read-only)</Form.Label>
                      <div className="d-flex gap-2">
                        <Form.Control
                          readOnly
                          value={
                            userDrawer.showStoredPassword
                              ? devmainPasswordInfo.hash || "--"
                              : devmainPasswordInfo.hash
                              ? "****************"
                              : "--"
                          }
                        />
                        <Button
                          type="button"
                          variant="outline-secondary"
                          onClick={() =>
                            setUserDrawer((prev) => ({
                              ...prev,
                              showStoredPassword: !prev.showStoredPassword,
                            }))
                          }
                          disabled={devmainPasswordInfo.loading || !devmainPasswordInfo.hash}
                        >
                          {userDrawer.showStoredPassword ? "Hide" : "Show"}
                        </Button>
                      </div>
                      <Form.Text className="text-muted">
                        This value is a hash only and cannot be decrypted to the original password.
                      </Form.Text>
                    </Form.Group>
                  </div>
                ) : null}

                {canManagePrivilegedSetup ? (
                  <div className="mt-3 d-flex justify-content-between align-items-center">
                    <div className="small text-muted">
                      Last Login: {userModal.draft.last_login ? formatDateTime(userModal.draft.last_login) : "--"}
                    </div>
                    <Button
                      type="button"
                      variant="outline-warning"
                      size="sm"
                      onClick={() => handleEmulateUser(selectedUserId)}
                      disabled={busy || !selectedUserId}
                    >
                      Emulate User
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 small text-muted">
                    Last Login: {userModal.draft.last_login ? formatDateTime(userModal.draft.last_login) : "--"}
                  </div>
                )}
              </Tab>
            </Tabs>
          </Offcanvas.Body>
        </Form>
      </Offcanvas>

      <Modal show={roleModal.show} onHide={closeRoleModal} centered>
        <Form onSubmit={submitRoleModal}>
          <Modal.Header closeButton>
            <Modal.Title>{roleModal.mode === "create" ? "Add Role" : "Edit Role"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="notice-banner notice-banner-muted mb-3">
              Application: <strong>{roleModalApplicationLabel}</strong>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>Role Name</Form.Label>
              <Form.Control
                value={roleModal.draft.role_name}
                onChange={(event) =>
                  setRoleModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, role_name: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                value={roleModal.draft.role_desc}
                onChange={(event) =>
                  setRoleModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, role_desc: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Check
              type="switch"
              label="Active"
              checked={Boolean(roleModal.draft.is_active)}
              onChange={(event) =>
                setRoleModal((prev) => ({
                  ...prev,
                  draft: { ...prev.draft, is_active: event.target.checked },
                }))
              }
            />
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="outline-secondary" onClick={closeRoleModal} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : roleModal.mode === "create" ? "Add Role" : "Save Changes"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={companyModal.show} onHide={closeCompanyModal} centered>
        <Form onSubmit={submitCompanyModal}>
          <Modal.Header closeButton>
            <Modal.Title>
              {companyModal.mode === "create" ? "Add Company" : "Edit Company"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Company Name</Form.Label>
              <Form.Control
                value={companyModal.draft.comp_name}
                onChange={(event) =>
                  setCompanyModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, comp_name: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Short Name</Form.Label>
              <Form.Control
                value={companyModal.draft.short_name}
                onChange={(event) =>
                  setCompanyModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, short_name: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={companyModal.draft.comp_email}
                onChange={(event) =>
                  setCompanyModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, comp_email: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Phone</Form.Label>
              <Form.Control
                value={companyModal.draft.comp_phone}
                onChange={(event) =>
                  setCompanyModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, comp_phone: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Check
              type="switch"
              label="Active"
              checked={Boolean(companyModal.draft.is_active)}
              onChange={(event) =>
                setCompanyModal((prev) => ({
                  ...prev,
                  draft: { ...prev.draft, is_active: event.target.checked },
                }))
              }
            />
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="button"
              variant="outline-secondary"
              onClick={closeCompanyModal}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : companyModal.mode === "create" ? "Stage Company" : "Stage Changes"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={statusModal.show} onHide={closeStatusModal} centered>
        <Form onSubmit={submitStatusModal}>
          <Modal.Header closeButton>
            <Modal.Title>{statusModal.mode === "create" ? "Add Status" : "Edit Status"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Status Name</Form.Label>
              <Form.Control
                value={statusModal.draft.sts_name}
                onChange={(event) =>
                  setStatusModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, sts_name: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                value={statusModal.draft.sts_desc}
                onChange={(event) =>
                  setStatusModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, sts_desc: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Check
              type="switch"
              label="Active"
              checked={Boolean(statusModal.draft.is_active)}
              onChange={(event) =>
                setStatusModal((prev) => ({
                  ...prev,
                  draft: { ...prev.draft, is_active: event.target.checked },
                }))
              }
            />
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="button"
              variant="outline-secondary"
              onClick={closeStatusModal}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : statusModal.mode === "create" ? "Stage Status" : "Stage Changes"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={departmentModal.show} onHide={closeDepartmentModal} centered>
        <Form onSubmit={submitDepartmentModal}>
          <Modal.Header closeButton>
            <Modal.Title>
              {departmentModal.mode === "create" ? "Add Department" : "Edit Department"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Department Name</Form.Label>
              <Form.Control
                value={departmentModal.draft.dept_name}
                onChange={(event) =>
                  setDepartmentModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, dept_name: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Short Name</Form.Label>
              <Form.Control
                value={departmentModal.draft.short_name}
                onChange={(event) =>
                  setDepartmentModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, short_name: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Company</Form.Label>
              <Form.Select
                value={departmentModal.draft.comp_id}
                onChange={(event) =>
                  setDepartmentModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, comp_id: event.target.value },
                  }))
                }
              >
                <option value="">Select company...</option>
                {references.companies.map((company) => (
                  <option key={String(company.comp_id)} value={String(company.comp_id)}>
                    {getLabel(company, ["comp_name"])}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Check
              type="switch"
              label="Active"
              checked={Boolean(departmentModal.draft.is_active)}
              onChange={(event) =>
                setDepartmentModal((prev) => ({
                  ...prev,
                  draft: { ...prev.draft, is_active: event.target.checked },
                }))
              }
            />
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="outline-secondary" onClick={closeDepartmentModal} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : departmentModal.mode === "create" ? "Add Department" : "Save Changes"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={applicationModal.show} onHide={closeApplicationModal} centered>
        <Form onSubmit={submitApplicationModal}>
          <Modal.Header closeButton>
            <Modal.Title>
              {applicationModal.mode === "create" ? "Add Application" : "Edit Application"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Application Name</Form.Label>
              <Form.Control
                value={applicationModal.draft.app_name}
                onChange={(event) =>
                  setApplicationModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, app_name: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                value={applicationModal.draft.app_desc}
                onChange={(event) =>
                  setApplicationModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, app_desc: event.target.value },
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Order</Form.Label>
              <Form.Control
                type="number"
                min={1}
                value={applicationModal.draft.display_order}
                onChange={(event) =>
                  setApplicationModal((prev) => ({
                    ...prev,
                    draft: {
                      ...prev.draft,
                      display_order: toNullableNumber(event.target.value) ?? 1,
                    },
                  }))
                }
              />
            </Form.Group>

            <Form.Check
              type="switch"
              label="Active"
              checked={Boolean(applicationModal.draft.is_active)}
              onChange={(event) =>
                setApplicationModal((prev) => ({
                  ...prev,
                  draft: { ...prev.draft, is_active: event.target.checked },
                }))
              }
            />
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="outline-secondary" onClick={closeApplicationModal} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy
                ? "Saving..."
                : applicationModal.mode === "create"
                ? "Stage Application"
                : "Stage Changes"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={removeModal.show} onHide={closeRemoveModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Remove</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">
            {isBatchRemoveTable ? (
              <>
                Stage removal for <strong>{removeModal.label || "this record"}</strong>? Save Batch is
                required to commit.
              </>
            ) : (
              <>
                Remove <strong>{removeModal.label || "this record"}</strong>? This cannot be undone.
              </>
            )}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="outline-secondary" onClick={closeRemoveModal} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={confirmRemoveRecord} disabled={busy}>
            {busy ? "Processing..." : isBatchRemoveTable ? "Stage Remove" : "Remove"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={accessModal.show} onHide={closeAccessModal} centered>
        <Form onSubmit={submitAccessModal}>
          <Modal.Header closeButton>
            <Modal.Title>
              {accessModal.mode === "create" ? "Add Access Mapping" : "Edit Access Mapping"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>User</Form.Label>
              <Form.Select
                value={accessModal.draft.user_id}
                disabled={accessModal.lockUser}
                onChange={(event) =>
                  setAccessModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, user_id: event.target.value },
                  }))
                }
              >
                <option value="">Select user...</option>
                {users.map((user) => (
                  <option key={String(user.user_id)} value={String(user.user_id)}>
                    {user.username || user.email || `User ${user.user_id}`}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Select
                value={accessModal.draft.role_id}
                disabled={!hasValue(accessModal.draft.app_id)}
                onChange={(event) =>
                  setAccessModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, role_id: event.target.value },
                  }))
                }
              >
                <option value="">
                  {hasValue(accessModal.draft.app_id)
                    ? "Select role..."
                    : "Select application first..."}
                </option>
                {accessRoleOptions.map((role) => (
                  <option key={String(role.role_id)} value={String(role.role_id)}>
                    {getLabel(role, ["role_name"])}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Application</Form.Label>
              <Form.Select
                value={accessModal.draft.app_id}
                onChange={(event) =>
                  setAccessModal((prev) => ({
                    ...prev,
                    draft: { ...prev.draft, app_id: event.target.value, role_id: "" },
                  }))
                }
              >
                <option value="">Select application...</option>
                {references.applications.map((application) => (
                  <option key={String(application.app_id)} value={String(application.app_id)}>
                    {getLabel(application, ["app_name"])}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Check
              type="switch"
              label="Active"
              checked={Boolean(accessModal.draft.is_active)}
              onChange={(event) =>
                setAccessModal((prev) => ({
                  ...prev,
                  draft: { ...prev.draft, is_active: event.target.checked },
                }))
              }
            />
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="outline-secondary" onClick={closeAccessModal} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy
                ? "Saving..."
                : accessModal.mode === "create"
                ? "Add Access"
                : "Save Changes"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}
