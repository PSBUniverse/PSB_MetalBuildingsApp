"use client";

import { Col, Container, Row } from "react-bootstrap";
import { useProfile } from "../hooks/useProfile";
import { ProfileSocialCard } from "../components/ProfileSocialCard";
import { ProfileSummaryCard } from "../components/ProfileSummaryCard";
import { ProfileRequestCard } from "../components/ProfileRequestCard";
import { ProfilePasswordModal } from "../components/ProfilePasswordModal";

export default function ProfilePage() {
  const h = useProfile();

  if (h.loading) {
    return <Container className="py-4">Loading profile...</Container>;
  }

  return (
    <Container className="py-4 profile-page-shell" style={{ maxWidth: 1120 }}>
      <div className="mb-3">
        <h2 className="mb-0">User Profile</h2>
        <p className="text-muted mb-0">Profile view for your account.</p>
      </div>

      <div className="profile-readonly-alert notice-banner notice-banner-info mb-3">
        Profile field updates are managed by administrators.
        You can update your password below.
      </div>

      {!h.hasAccess ? (
        <div className="notice-banner notice-banner-warning mb-3">
          Your account currently has no active app assignments.
        </div>
      ) : null}

      <Row className="g-3 align-items-start">
        <Col lg={4} className="profile-social-col">
          <ProfileSocialCard
            profile={h.profile} fullName={h.fullName} initials={h.initials}
            isActive={h.isActive} companyLabel={h.companyLabel} departmentLabel={h.departmentLabel}
            adminEmail={h.adminEmail} requestUpdateHref={h.requestUpdateHref}
            copyToClipboard={h.copyToClipboard} hasText={h.hasText}
          />
        </Col>
        <Col lg={8}>
          <ProfileSummaryCard
            profile={h.profile} companyLabel={h.companyLabel} departmentLabel={h.departmentLabel}
            roleGroupsByApp={h.roleGroupsByApp} requestUpdateHref={h.requestUpdateHref}
            copyToClipboard={h.copyToClipboard}
          />
          <ProfileRequestCard
            requestUpdateHref={h.requestUpdateHref} openPasswordModal={h.openPasswordModal}
          />
        </Col>
      </Row>

      <ProfilePasswordModal
        showPasswordModal={h.showPasswordModal} closePasswordModal={h.closePasswordModal}
        submitPasswordUpdate={h.submitPasswordUpdate}
        newPassword={h.newPassword} setNewPassword={h.setNewPassword}
        confirmPassword={h.confirmPassword} setConfirmPassword={h.setConfirmPassword}
        showNewPassword={h.showNewPassword} setShowNewPassword={h.setShowNewPassword}
        showConfirmPassword={h.showConfirmPassword} setShowConfirmPassword={h.setShowConfirmPassword}
        passwordSubmitting={h.passwordSubmitting} passwordError={h.passwordError}
        setPasswordError={h.setPasswordError}
      />
    </Container>
  );
}
