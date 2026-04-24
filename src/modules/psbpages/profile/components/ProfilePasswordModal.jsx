import { Button, Form, Modal, Spinner } from "react-bootstrap";

export function ProfilePasswordModal({
  showPasswordModal, closePasswordModal, submitPasswordUpdate,
  newPassword, setNewPassword, confirmPassword, setConfirmPassword,
  showNewPassword, setShowNewPassword, showConfirmPassword, setShowConfirmPassword,
  passwordSubmitting, passwordError, setPasswordError,
}) {
  return (
    <Modal show={showPasswordModal} onHide={closePasswordModal} centered
      backdrop={passwordSubmitting ? "static" : true} keyboard={!passwordSubmitting}>
      <Form onSubmit={submitPasswordUpdate}>
        <Modal.Header closeButton={!passwordSubmitting}>
          <Modal.Title>Update Password</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3" controlId="profile-update-password-new">
            <Form.Label>New Password</Form.Label>
            <div className="d-flex align-items-center gap-2">
              <Form.Control type={showNewPassword ? "text" : "password"} placeholder="Enter new password"
                value={newPassword} onChange={(e) => { setNewPassword(e.target.value); if (passwordError) setPasswordError(""); }}
                autoComplete="new-password" required disabled={passwordSubmitting} />
              <Button type="button" variant="outline-secondary"
                onClick={() => setShowNewPassword((p) => !p)} disabled={passwordSubmitting}>
                {showNewPassword ? "Hide" : "Show"}
              </Button>
            </div>
          </Form.Group>

          <Form.Group className="mb-0" controlId="profile-update-password-confirm">
            <Form.Label>Confirm Password</Form.Label>
            <div className="d-flex align-items-center gap-2">
              <Form.Control type={showConfirmPassword ? "text" : "password"} placeholder="Retype new password"
                value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); if (passwordError) setPasswordError(""); }}
                autoComplete="new-password" required disabled={passwordSubmitting} />
              <Button type="button" variant="outline-secondary"
                onClick={() => setShowConfirmPassword((p) => !p)} disabled={passwordSubmitting}>
                {showConfirmPassword ? "Hide" : "Show"}
              </Button>
            </div>
          </Form.Group>

          {passwordError ? (
            <div className="text-danger small mt-3" role="alert">{passwordError}</div>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="outline-secondary" onClick={closePasswordModal} disabled={passwordSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={passwordSubmitting}>
            {passwordSubmitting ? (
              <><Spinner size="sm" animation="border" className="me-2" />Updating...</>
            ) : "Confirm Update"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
