"use client";

import { useState } from "react";
import { getSupabase } from "@/core/supabase/client";
import { toastError, toastSuccess } from "@/shared/utils/toast";
import {
  setAccessTokenCookie, waitForServerSession, validateFields, mapLoginError,
} from "../utils/loginHelpers";

export function useLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [inlineError, setInlineError] = useState("");
  const [shakeForm, setShakeForm] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validateFields(email, password);
    const hasValidationError = Boolean(validationErrors.email || validationErrors.password);
    setTouched({ email: true, password: true });
    setFieldErrors(validationErrors);

    if (hasValidationError) {
      setShakeForm(true);
      window.setTimeout(() => setShakeForm(false), 320);
      return;
    }

    setInlineError("");
    setSubmitting(true);
    const supabase = getSupabase();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setAccessTokenCookie(data?.session);
      await waitForServerSession();
      toastSuccess("Welcome to PSBUniverse. You have signed in successfully.", "Sign In Success");
      window.location.assign("/dashboard");
    } catch (error) {
      const message = mapLoginError(error?.message);
      setInlineError(message);
      toastError(message, "Sign In Failed", { durationMs: 4500 });
      setShakeForm(true);
      window.setTimeout(() => setShakeForm(false), 320);
    } finally {
      setSubmitting(false);
    }
  }

  function handleEmailChange(event) {
    const nextValue = event.target.value;
    setEmail(nextValue);
    setInlineError("");
    if (touched.email || fieldErrors.email) {
      const errors = validateFields(nextValue, password);
      setFieldErrors((prev) => ({ ...prev, email: errors.email }));
    }
  }

  function handlePasswordChange(event) {
    const nextValue = event.target.value;
    setPassword(nextValue);
    setInlineError("");
    if (touched.password || fieldErrors.password) {
      const errors = validateFields(email, nextValue);
      setFieldErrors((prev) => ({ ...prev, password: errors.password }));
    }
  }

  function handleFieldBlur(fieldName) {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
    const errors = validateFields(email, password);
    setFieldErrors((prev) => ({ ...prev, [fieldName]: errors[fieldName] }));
  }

  function handlePasswordToggle() {
    setShowPassword((prev) => !prev);
  }

  return {
    email, password, showPassword, submitting, touched, fieldErrors, inlineError, shakeForm,
    handleSubmit, handleEmailChange, handlePasswordChange, handleFieldBlur, handlePasswordToggle,
  };
}
