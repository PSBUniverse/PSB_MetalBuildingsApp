import { Button, Card } from "react-bootstrap";

export function ProfileRequestCard({ requestUpdateHref, openPasswordModal }) {
  return (
    <Card className="profile-request-card border-0 shadow-sm">
      <Card.Body>
        <h5 className="mb-2">Need to update something?</h5>
        <p className="text-muted mb-2">Profile field changes are handled by administrators.</p>
        {requestUpdateHref ? (
          <>
            <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
              <a href={requestUpdateHref} className="btn btn-sm btn-primary">Request Update</a>
              <Button type="button" variant="outline-secondary" size="sm" onClick={openPasswordModal}>
                Update Password
              </Button>
            </div>
            <p className="mb-0">
              Send your profile update request by email and include your username plus exact changes needed.
            </p>
          </>
        ) : (
          <>
            <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
              <Button type="button" variant="outline-secondary" size="sm" onClick={openPasswordModal}>
                Update Password
              </Button>
            </div>
            <p className="mb-0">Contact your administrator to request profile field updates.</p>
          </>
        )}
      </Card.Body>
    </Card>
  );
}
