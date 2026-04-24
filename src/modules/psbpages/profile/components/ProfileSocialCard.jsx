import { Badge, Button, Card } from "react-bootstrap";

export function ProfileSocialCard({
  profile, fullName, initials, isActive, companyLabel, departmentLabel,
  adminEmail, requestUpdateHref, copyToClipboard, hasText,
}) {
  return (
    <Card className="profile-social-card border-0 shadow-sm">
      <Card.Body className="profile-social-card-body">
        <div className="profile-card-actions">
          {requestUpdateHref ? (
            <Button as="a" href={requestUpdateHref} size="sm" className="profile-action-primary">
              Request Update
            </Button>
          ) : null}
          <Button type="button" variant="outline-secondary" size="sm"
            onClick={() => void copyToClipboard(profile.email, "Email")}>
            Copy Email
          </Button>
          <Button type="button" variant="outline-secondary" size="sm"
            onClick={() => void copyToClipboard(profile.username, "Username")}>
            Copy Username
          </Button>
        </div>

        <div className="profile-social-content">
          <div className="profile-avatar">{initials}</div>
          <h3 className="profile-name mb-1 text-center">{fullName}</h3>
          <p className="profile-handle mb-2 text-center">@{String(profile.username || "unknown")}</p>
          <Badge bg="light" text="dark"
            className={`profile-status-badge ${isActive ? "status-active" : "status-inactive"}`}>
            <span className="profile-status-indicator" aria-hidden="true" />
            <span>{isActive ? "Active" : "Inactive"}</span>
          </Badge>

          <div className="profile-org-lines mt-3 text-center">
            <p className="mb-1">{companyLabel}</p>
            <p className="mb-0">{departmentLabel}</p>
          </div>

          {hasText(adminEmail) ? (
            <div className="profile-admin-contact mt-3 text-center">
              <p className="mb-1 text-muted">Administrator Contact</p>
              <a href={`mailto:${adminEmail}`} className="profile-admin-link">{adminEmail}</a>
            </div>
          ) : null}
        </div>
      </Card.Body>
    </Card>
  );
}
