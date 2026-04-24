import { useCallback } from "react";
import { Badge, Button, Card, Col, Row } from "react-bootstrap";

export function ProfileSummaryCard({
  profile, companyLabel, departmentLabel,
  roleGroupsByApp, requestUpdateHref, copyToClipboard,
}) {
  const renderValue = useCallback((value, options = {}) => {
    const text = String(value || "").trim();
    if (text) {
      if (options.type === "email") return <a href={`mailto:${text}`} className="profile-inline-link">{text}</a>;
      return <span>{text}</span>;
    }
    return (
      <span className="profile-empty-value">
        <span className="profile-empty-icon" aria-hidden="true">i</span>
        <span>Not available</span>
        {requestUpdateHref ? <a href={requestUpdateHref} className="profile-empty-action-link">Request update</a> : null}
      </span>
    );
  }, [requestUpdateHref]);

  return (
    <Card className="profile-summary-card border-0 shadow-sm mb-3">
      <Card.Body className="profile-summary-card-body">
        <p className="profile-section-kicker mb-1">My PSB</p>
        <h4 className="mb-1">Profile Snapshot</h4>
        <p className="text-muted mb-2">Your account details are visible here for quick reference.</p>

        <div className="profile-roles-panel mb-2">
          <p className="profile-detail-label mb-1">Roles</p>
          {roleGroupsByApp.length > 0 ? (
            <div className="profile-role-groups">
              {roleGroupsByApp.map((group) => (
                <div key={`role-group-${group.appId || group.appName}`} className="profile-role-group-card">
                  <p className="profile-role-app-name mb-1">{group.appName}</p>
                  <div className="profile-role-pills">
                    {group.roles.map((role) => (
                      <Badge key={`role-pill-${group.appId}-${role.roleId || role.roleName}`}
                        className="profile-role-pill" bg="light" text="dark">
                        {role.roleName}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="profile-empty-value profile-empty-roles">
              <span className="profile-empty-icon" aria-hidden="true">i</span>
              <span>No roles assigned</span>
            </div>
          )}
        </div>

        <Row className="g-2 profile-info-grid">
          <Col sm={6}>
            <div className="profile-detail-tile" tabIndex={0}>
              <p className="profile-detail-label mb-1">Email</p>
              <p className="profile-detail-value mb-0">{renderValue(profile.email, { type: "email" })}</p>
            </div>
          </Col>
          <Col sm={6}>
            <div className="profile-detail-tile" tabIndex={0}>
              <p className="profile-detail-label mb-1">Phone</p>
              <p className="profile-detail-value mb-0">{renderValue(profile.phone)}</p>
            </div>
          </Col>
          <Col sm={6}>
            <div className="profile-detail-tile" tabIndex={0}>
              <p className="profile-detail-label mb-1">Address</p>
              <p className="profile-detail-value mb-0">{renderValue(profile.address)}</p>
            </div>
          </Col>
          <Col sm={6}>
            <div className="profile-detail-tile" tabIndex={0}>
              <p className="profile-detail-label mb-1">Username</p>
              <p className="profile-detail-value mb-0 d-flex align-items-center justify-content-between gap-2">
                <span>{String(profile.username || "unknown")}</span>
                <button type="button" className="profile-mini-copy"
                  onClick={() => void copyToClipboard(profile.username, "Username")}>
                  Copy
                </button>
              </p>
            </div>
          </Col>
          <Col sm={6}>
            <div className="profile-detail-tile" tabIndex={0}>
              <p className="profile-detail-label mb-1">Company</p>
              <p className="profile-detail-value mb-0">{companyLabel}</p>
            </div>
          </Col>
          <Col sm={6}>
            <div className="profile-detail-tile" tabIndex={0}>
              <p className="profile-detail-label mb-1">Department</p>
              <p className="profile-detail-value mb-0">{departmentLabel}</p>
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}
