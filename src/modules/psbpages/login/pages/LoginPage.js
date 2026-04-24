"use client";

import Image from "next/image";
import { Button, Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import psbLogo from "@/styles/psb_logo.png";
import { useLogin } from "../hooks/useLogin";

export default function LoginPage() {
  const h = useLogin();

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
          <section className={`portal-login-form-shell ${h.shakeForm ? "portal-login-form-shake" : ""}`}>
            <header className="portal-login-header">
              <h2 className="portal-login-title mb-2">Sign in to PSBUniverse</h2>
              <p className="portal-login-subtitle mb-0">Enter your credentials to continue</p>
            </header>

            <Form noValidate onSubmit={h.handleSubmit} className="portal-login-form">
              <Form.Group controlId="login-email">
                <Form.Label className="portal-login-label">Email</Form.Label>
                <Form.Control
                  type="email" value={h.email} onChange={h.handleEmailChange}
                  onBlur={() => h.handleFieldBlur("email")} placeholder="Enter your email"
                  autoComplete="email" autoFocus required className="portal-login-input"
                  isInvalid={Boolean(h.touched.email && h.fieldErrors.email)}
                  aria-describedby={h.touched.email && h.fieldErrors.email ? "login-email-error" : undefined}
                />
                {h.touched.email && h.fieldErrors.email ? (
                  <div id="login-email-error" className="portal-field-error" role="alert">{h.fieldErrors.email}</div>
                ) : null}
              </Form.Group>

              <Form.Group controlId="login-password">
                <Form.Label className="portal-login-label">Password</Form.Label>
                <div className="portal-password-field">
                  <Form.Control
                    type={h.showPassword ? "text" : "password"} value={h.password}
                    onChange={h.handlePasswordChange} onBlur={() => h.handleFieldBlur("password")}
                    placeholder="Enter your password" autoComplete="current-password" required
                    className="portal-login-input portal-password-input"
                    isInvalid={Boolean(h.touched.password && h.fieldErrors.password)}
                    aria-describedby={h.touched.password && h.fieldErrors.password ? "login-password-error" : undefined}
                  />
                  <button type="button" className="portal-password-toggle" onClick={h.handlePasswordToggle}
                    onMouseDown={(e) => e.preventDefault()}
                    aria-label={h.showPassword ? "Hide password" : "Show password"} aria-pressed={h.showPassword}>
                    <FontAwesomeIcon icon={h.showPassword ? faEyeSlash : faEye} aria-hidden="true" />
                    <span>{h.showPassword ? "Hide" : "Show"}</span>
                  </button>
                </div>
                {h.touched.password && h.fieldErrors.password ? (
                  <div id="login-password-error" className="portal-field-error" role="alert">{h.fieldErrors.password}</div>
                ) : null}
              </Form.Group>

              {h.inlineError ? (
                <div className="portal-inline-error" role="alert" aria-live="assertive">{h.inlineError}</div>
              ) : null}

              <Button type="submit" variant="primary" className="portal-signin-btn w-100" disabled={h.submitting}>
                {h.submitting ? (
                  <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />Signing in...</>
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
