"use client";

import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/core/auth/useAuth";
import { getSupabase } from "@/core/supabase/client";
import { toastError, toastInfo, toastSuccess } from "@/shared/utils/toast";
import {
  hasText, getLabel, buildInitials, statusIsActive, buildRequestUpdateMailto,
  buildProfile, buildRelations, buildRoleGroupsByApp,
  MIN_PASSWORD_LENGTH, PASSWORD_NUMBER_OR_SYMBOL_REGEX,
} from "../utils/profileHelpers";

export function useProfile() {
  const { dbUser, authUser, roles, loading } = useAuth();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const profile = useMemo(() => buildProfile(dbUser, authUser), [authUser, dbUser]);
  const relations = useMemo(() => buildRelations(dbUser), [dbUser]);

  const companyLabel = useMemo(() => {
    if (relations?.company) return getLabel(relations.company, ["comp_name", "company_name"]);
    return "No company assigned";
  }, [relations]);

  const departmentLabel = useMemo(() => {
    if (relations?.department) return getLabel(relations.department, ["dept_name", "department_name"]);
    return "No department assigned";
  }, [relations]);

  const statusLabel = useMemo(() => {
    if (relations?.status) return getLabel(relations.status, ["sts_name", "status_name"]);
    return "No status assigned";
  }, [relations]);

  const fullName = useMemo(() => {
    const first = String(profile.first_name || "").trim();
    const last = String(profile.last_name || "").trim();
    if (first || last) return `${first} ${last}`.trim();
    return profile.username || profile.email || "User";
  }, [profile.email, profile.first_name, profile.last_name, profile.username]);

  const initials = useMemo(() => buildInitials(profile.first_name, profile.last_name, profile.username), [profile.first_name, profile.last_name, profile.username]);

  const adminEmail = useMemo(() => String(relations?.company?.comp_email || "").trim(), [relations]);
  const isActive = useMemo(() => statusIsActive(statusLabel, relations?.status), [relations?.status, statusLabel]);
  const roleGroupsByApp = useMemo(() => buildRoleGroupsByApp(roles), [roles]);
  const requestUpdateHref = useMemo(() => buildRequestUpdateMailto(adminEmail, profile.username), [adminEmail, profile.username]);
  const hasAccess = roleGroupsByApp.length > 0;

  const copyToClipboard = useCallback(async (value, label) => {
    const text = String(value || "").trim();
    if (!text) { toastInfo(`${label} is not available to copy.`, "User Profile"); return; }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text; textarea.style.position = "fixed"; textarea.style.left = "-9999px";
        document.body.appendChild(textarea); textarea.focus(); textarea.select();
        document.execCommand("copy"); document.body.removeChild(textarea);
      }
      toastSuccess(`${label} copied.`, "User Profile");
    } catch { toastError(`Unable to copy ${label.toLowerCase()}.`, "User Profile"); }
  }, []);

  const resetPasswordModal = useCallback(() => {
    setNewPassword(""); setConfirmPassword(""); setShowNewPassword(false);
    setShowConfirmPassword(false); setPasswordError(""); setPasswordSubmitting(false);
  }, []);

  const openPasswordModal = useCallback(() => { resetPasswordModal(); setShowPasswordModal(true); }, [resetPasswordModal]);

  const closePasswordModal = useCallback(() => {
    if (passwordSubmitting) return;
    setShowPasswordModal(false); resetPasswordModal();
  }, [passwordSubmitting, resetPasswordModal]);

  const submitPasswordUpdate = useCallback(async (event) => {
    event.preventDefault();
    if (passwordSubmitting) return;
    const nextPassword = String(newPassword || "");
    const nextConfirm = String(confirmPassword || "");
    if (!nextPassword.trim() || !nextConfirm.trim()) { setPasswordError("Password is required"); return; }
    if (nextPassword.length < MIN_PASSWORD_LENGTH) { setPasswordError("Password must be at least 8 characters"); return; }
    if (!PASSWORD_NUMBER_OR_SYMBOL_REGEX.test(nextPassword)) { setPasswordError("Password must include at least one number or symbol"); return; }
    if (nextPassword !== nextConfirm) { setPasswordError("Passwords do not match"); return; }
    setPasswordError(""); setPasswordSubmitting(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password: nextPassword });
      if (error) { setPasswordError(error.message || "Unable to update password right now"); return; }
      toastSuccess("Password updated successfully", "User Profile");
      setShowPasswordModal(false); resetPasswordModal();
    } catch (error) { setPasswordError(error?.message || "Unable to update password right now"); }
    finally { setPasswordSubmitting(false); }
  }, [confirmPassword, newPassword, passwordSubmitting, resetPasswordModal]);

  return {
    loading, profile, relations, companyLabel, departmentLabel, statusLabel,
    fullName, initials, adminEmail, isActive, roleGroupsByApp, requestUpdateHref, hasAccess,
    copyToClipboard,
    showPasswordModal, newPassword, setNewPassword, confirmPassword, setConfirmPassword,
    showNewPassword, setShowNewPassword, showConfirmPassword, setShowConfirmPassword,
    passwordSubmitting, passwordError, setPasswordError,
    openPasswordModal, closePasswordModal, submitPasswordUpdate,
    hasText,
  };
}
