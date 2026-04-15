"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Form } from "react-bootstrap";
import psbLogo from "@/styles/psb_logo.png";
import { toastSuccess, toastWarning } from "@/shared/utils/toast";
import {
  invalidateUserAccessQueries,
  notifyUserMasterSessionRefresh,
  seedUserAccessQueryData,
} from "@/modules/user-master/cache/user-master.query";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({
    identifier: false,
    password: false,
  });
  const [fieldErrors, setFieldErrors] = useState({
    identifier: "",
    password: "",
  });
  const [inlineError, setInlineError] = useState("");
  const [shakeForm, setShakeForm] = useState(false);

  function validateFields(nextIdentifier, nextPassword) {
    const errors = {
      identifier: "",
      password: "",
    };

    if (!String(nextIdentifier || "").trim()) {
      errors.identifier = "Username is required.";
    }

    if (!String(nextPassword || "").trim()) {
      errors.password = "Password is required.";
    }

    return errors;
  }

  function mapLoginError(errorMessage) {
    const text = String(errorMessage || "").toLowerCase();

    if (text.includes("incorrect") || text.includes("invalid")) {
      return "Username or password is incorrect.";
    }

    if (text.includes("account is inactive") || text.includes("status does not allow")) {
      return "Account is inactive. Contact administrator.";
    }

    if (text.includes("supabase") && text.includes("missing")) {
      return "Login is unavailable due to server configuration. Add Supabase server environment variables in Vercel.";
    }

    if (text.includes("required") && text.includes("username") && text.includes("password")) {
      return "Please enter both username and password.";
    }

    if (String(errorMessage || "").trim()) {
      return String(errorMessage);
    }

    return "Unable to sign in right now. Please try again.";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validateFields(identifier, password);
    const hasValidationError = Boolean(validationErrors.identifier || validationErrors.password);

    setTouched({
      identifier: true,
      password: true,
    });
    setFieldErrors(validationErrors);

    if (hasValidationError) {
      setShakeForm(true);
      window.setTimeout(() => setShakeForm(false), 320);
      return;
    }

    setInlineError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Login failed");
      }

      if (payload?.limitedAccess || payload?.access?.hasAccess === false) {
        toastWarning(
          "Signed in with limited access. Please contact your administrator for app access.",
          "Limited Access",
          { durationMs: 5000 }
        );
      } else {
        toastSuccess("Welcome to PSBUniverse. You have signed in successfully.", "Sign In Success");
      }

      seedUserAccessQueryData(queryClient, payload);
      await invalidateUserAccessQueries(queryClient);
      notifyUserMasterSessionRefresh();

      router.push("/profile");
    } catch (error) {
      setInlineError(mapLoginError(error?.message));
      setShakeForm(true);
      window.setTimeout(() => setShakeForm(false), 320);
    } finally {
      setSubmitting(false);
    }
  }

  function handleIdentifierChange(event) {
    const nextValue = event.target.value;
    setIdentifier(nextValue);
    setInlineError("");

    if (touched.identifier || fieldErrors.identifier) {
      const validationErrors = validateFields(nextValue, password);
      setFieldErrors((previous) => ({
        ...previous,
        identifier: validationErrors.identifier,
      }));
    }
  }

  function handlePasswordChange(event) {
    const nextValue = event.target.value;
    setPassword(nextValue);
    setInlineError("");

    if (touched.password || fieldErrors.password) {
      const validationErrors = validateFields(identifier, nextValue);
      setFieldErrors((previous) => ({
        ...previous,
        password: validationErrors.password,
      }));
    }
  }

  function handleFieldBlur(fieldName) {
    setTouched((previous) => ({
      ...previous,
      [fieldName]: true,
    }));

    const validationErrors = validateFields(identifier, password);
    setFieldErrors((previous) => ({
      ...previous,
      [fieldName]: validationErrors[fieldName],
    }));
  }

  function handlePasswordToggle() {
    setShowPassword((previous) => !previous);
  }

  return (
    <div className="portal-login-shell">
      <div className="portal-login-split">
        <aside className="portal-login-brand" aria-hidden="true">
          <div className="portal-login-brand-inner">
            <Image src={psbLogo} alt="PSBUniverse logo" className="portal-login-logo" priority />
            <h1 className="psb-title mb-3">PSBUniverse</h1>
            <p className="psb-label mb-2">Operations Workspace</p>
            <p className="portal-brand-copy mb-0">Manage apps, users, and operations in one place.</p>
          </div>
        </aside>

        <main className="portal-login-main">
          <section className={`portal-login-form-shell ${shakeForm ? "portal-login-form-shake" : ""}`}>
            <header className="portal-login-header">
              <h2 className="portal-login-title mb-2">Sign in to PSBUniverse</h2>
              <p className="portal-login-subtitle mb-0">Enter your credentials to continue</p>
            </header>

            <Form noValidate onSubmit={handleSubmit} className="portal-login-form">
              <Form.Group controlId="login-identifier">
                <Form.Label className="portal-login-label">Username</Form.Label>
                <Form.Control
                  value={identifier}
                  onChange={handleIdentifierChange}
                  onBlur={() => handleFieldBlur("identifier")}
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoFocus
                  required
                  className="portal-login-input"
                  isInvalid={Boolean(touched.identifier && fieldErrors.identifier)}
                  aria-describedby={
                    touched.identifier && fieldErrors.identifier ? "login-identifier-error" : undefined
                  }
                />
                {touched.identifier && fieldErrors.identifier ? (
                  <div id="login-identifier-error" className="portal-field-error" role="alert">
                    {fieldErrors.identifier}
                  </div>
                ) : null}
              </Form.Group>

              <Form.Group controlId="login-password">
                <Form.Label className="portal-login-label">Password</Form.Label>
                <div className="portal-password-field">
                  <Form.Control
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={handlePasswordChange}
                    onBlur={() => handleFieldBlur("password")}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="portal-login-input portal-password-input"
                    isInvalid={Boolean(touched.password && fieldErrors.password)}
                    aria-describedby={
                      touched.password && fieldErrors.password ? "login-password-error" : undefined
                    }
                  />
                  <button
                    type="button"
                    className="portal-password-toggle"
                    onClick={handlePasswordToggle}
                    onMouseDown={(event) => event.preventDefault()}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" />
                    <span>{showPassword ? "Hide" : "Show"}</span>
                  </button>
                </div>
                {touched.password && fieldErrors.password ? (
                  <div id="login-password-error" className="portal-field-error" role="alert">
                    {fieldErrors.password}
                  </div>
                ) : null}
              </Form.Group>

              {inlineError ? (
                <div className="portal-inline-error" role="alert" aria-live="assertive">
                  {inlineError}
                </div>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                className="portal-signin-btn w-100"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    Signing in...
                  </>
                ) : "Sign In"}
              </Button>
            </Form>

            <p className="portal-support-note mb-0">Need access? Contact admin</p>
          </section>
        </main>
      </div>
    </div>
  );
}

