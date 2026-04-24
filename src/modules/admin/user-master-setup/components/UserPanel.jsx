import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faCheck } from "@fortawesome/free-solid-svg-icons";
import { Badge, Button, Input, TableZ } from "@/shared/components/ui";
import { TABS, normalizeText, normalizeOptionalText, asChoiceValue, formatDateTime } from "../utils/userMasterHelpers";

export function UserPanel({
  panelOpen, panelMode, isPanelLoading, panelDirty, panelEditable,
  canDeactivateCurrentUser, isStaging, isLoadingLookups, isSavingBatch,
  activeTab, form, setForm, accessRows, accessEditor, setAccessEditor,
  enableNewPassword, setEnableNewPassword, newPasswordValue, setNewPasswordValue,
  confirmNewPassword, setConfirmNewPassword,
  selectedStatusLabel, departmentsForCompany, roleOptionsForAccessEditor, lookups,
  setPendingAccessDeactivateRow,
  setActiveTab, setPanelMode, closePanel,
  handleStatusChange, handleCompanyChange,
  startAccessCreate, cancelAccessEditor, submitAccessEditor,
  stagePanelChanges, restorePanelToBaseline, deactivateCurrentUser,
}) {
  const activeTabMeta = TABS.find((t) => t.key === activeTab) || TABS[0];

  const accessColumns = useMemo(() => [
    { key: "application_name", label: "Application", width: 260 },
    { key: "role_name", label: "Role", width: 260 },
    { key: "is_active", label: "Status", width: 120, align: "center",
      render: (r) => <Badge bg={r?.is_active ? "success" : "secondary"} text="light">{r?.is_active ? "ACTIVE" : "INACTIVE"}</Badge> },
  ], []);

  const accessTableActions = useMemo(() => [
    { key: "edit-access", label: "Edit Access", type: "secondary", icon: "pen",
      visible: () => panelEditable,
      onClick: (r) => { if (!panelEditable) return; setAccessEditor({ mode: "edit", access_key: r?.access_key, original_app_id: normalizeText(r?.app_id), original_role_id: normalizeText(r?.role_id), app_id: normalizeText(r?.app_id), role_id: normalizeText(r?.role_id) }); } },
    { key: "deactivate-access", label: "Deactivate Access", type: "secondary", icon: "ban",
      visible: () => panelEditable, onClick: (r) => { if (panelEditable) setPendingAccessDeactivateRow(r || null); } },
  ], [panelEditable, setAccessEditor, setPendingAccessDeactivateRow]);

  const accessEditorReady = Boolean(normalizeText(accessEditor?.app_id) && normalizeText(accessEditor?.role_id));

  return (
    <aside className={`umsp-sidepanel ${panelOpen ? "is-open" : ""}`} aria-hidden={!panelOpen}>
      <div className="umsp-sidepanel-header">
        <div>
          <h2 className="h6 mb-1">{panelMode === "add" ? "Add User" : panelMode === "edit" ? "Edit User" : "User Details"}</h2>
          <div className="d-flex align-items-center gap-1 flex-wrap umsp-status-row">
            <Badge bg={form?.is_active ? "success" : "secondary"} text="light">{selectedStatusLabel}</Badge>
            <Badge bg={panelMode === "view" ? "info" : "warning"} text="dark">{panelMode.toUpperCase()}</Badge>
            {panelDirty ? <span className="small text-danger fw-semibold">Unsaved changes</span> : <span className="small text-muted">All changes staged</span>}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="umsp-close-btn" onClick={closePanel}><FontAwesomeIcon icon={faXmark} aria-hidden="true" /></Button>
      </div>

      {isPanelLoading ? (
        <div className="umsp-sidepanel-loading">Loading user details...</div>
      ) : (
        <>
          <div className="umsp-tabs">
            {TABS.map((t) => (
              <Button key={t.key} type="button" variant="ghost" className={`umsp-tab-btn ${activeTab === t.key ? "is-active" : ""}`} onClick={() => setActiveTab(t.key)}>{t.label}</Button>
            ))}
          </div>
          <div className="umsp-tab-description"><p className="mb-0">{activeTabMeta?.description}</p></div>

          <div className="umsp-tab-content">
            {activeTab === "profile" ? (
              <div className="row g-2">
                <div className="col-12 col-md-6"><label className="form-label mb-1">Username</label>
                  <Input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} disabled={!panelEditable || isPanelLoading} placeholder="Enter username" /></div>
                <div className="col-12 col-md-6"><label className="form-label mb-1">Email</label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} disabled={!panelEditable || isPanelLoading} placeholder="Enter email" /></div>
                <div className="col-12 col-md-4"><label className="form-label mb-1">First Name</label>
                  <Input value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} disabled={!panelEditable || isPanelLoading} placeholder="First name" /></div>
                <div className="col-12 col-md-4"><label className="form-label mb-1">Middle Name</label>
                  <Input value={form.middle_name} onChange={(e) => setForm((p) => ({ ...p, middle_name: e.target.value }))} disabled={!panelEditable || isPanelLoading} placeholder="Middle name" /></div>
                <div className="col-12 col-md-4"><label className="form-label mb-1">Last Name</label>
                  <Input value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} disabled={!panelEditable || isPanelLoading} placeholder="Last name" /></div>
                <div className="col-12 col-md-6"><label className="form-label mb-1">Phone</label>
                  <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} disabled={!panelEditable || isPanelLoading} placeholder="Phone" /></div>
                <div className="col-12"><label className="form-label mb-1">Address</label>
                  <Input as="textarea" rows={2} value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} disabled={!panelEditable || isPanelLoading} placeholder="Address" /></div>
              </div>
            ) : null}

            {activeTab === "organization" ? (
              <div className="row g-2">
                <div className="col-12 col-md-6"><label className="form-label mb-1">Company</label>
                  <Input as="select" value={asChoiceValue(form.comp_id)} onChange={(e) => handleCompanyChange(e.target.value)} disabled={!panelEditable || isPanelLoading}>
                    <option value="">Select company</option>
                    {(lookups?.companies || []).map((c) => <option key={String(c?.comp_id)} value={String(c?.comp_id)}>{c?.label}</option>)}
                  </Input></div>
                <div className="col-12 col-md-6"><label className="form-label mb-1">Department</label>
                  <Input as="select" value={asChoiceValue(form.dept_id)} onChange={(e) => setForm((p) => ({ ...p, dept_id: normalizeOptionalText(e.target.value) }))} disabled={!panelEditable || isPanelLoading}>
                    <option value="">Select department</option>
                    {departmentsForCompany.map((d) => <option key={String(d?.dept_id)} value={String(d?.dept_id)}>{d?.label}</option>)}
                  </Input></div>
                <div className="col-12 col-md-6"><label className="form-label mb-1">Position</label>
                  <Input value={form.position} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))} disabled={!panelEditable || isPanelLoading} placeholder="Position" /></div>
                <div className="col-12 col-md-6"><label className="form-label mb-1">Hire Date</label>
                  <Input type="date" value={form.hire_date} onChange={(e) => setForm((p) => ({ ...p, hire_date: e.target.value }))} disabled={!panelEditable || isPanelLoading} /></div>
                <div className="col-12"><label className="form-label mb-1">Status</label>
                  <Input as="select" value={asChoiceValue(form.status_id)} onChange={(e) => handleStatusChange(e.target.value)} disabled={!panelEditable || isPanelLoading}>
                    <option value="">Select status</option>
                    {(lookups?.statuses || []).map((s) => <option key={String(s?.status_id)} value={String(s?.status_id)}>{s?.label}</option>)}
                  </Input></div>
              </div>
            ) : null}

            {activeTab === "access" ? (
              <>
                <div className="d-flex justify-content-between align-items-center mb-2 umsp-access-toolbar">
                  <div className="small text-muted umsp-access-helper-text">Assign application role access using shared setup table controls.</div>
                  <Button type="button" variant="secondary" size="sm" className="umsp-access-trigger-btn" onClick={startAccessCreate} disabled={!panelEditable}>Add Access</Button>
                </div>
                {accessEditor?.mode ? (
                  <div className="umsp-access-editor mb-2">
                    <div className="umsp-access-editor-head">
                      <h3 className="umsp-access-editor-title mb-0">{accessEditor?.mode === "edit" ? "Edit Access Mapping" : "Add Access Mapping"}</h3>
                      <p className="umsp-access-editor-subtitle mb-0">Choose one application and the role to assign.</p>
                    </div>
                    <div className="row g-2 umsp-access-editor-grid">
                      <div className="col-12 col-md-6"><label className="form-label mb-1">Application</label>
                        <Input as="select" value={asChoiceValue(accessEditor?.app_id)} onChange={(e) => setAccessEditor((p) => ({ ...p, app_id: e.target.value, role_id: "" }))}>
                          <option value="">Select application</option>
                          {(lookups?.applications || []).map((a) => <option key={String(a?.app_id)} value={String(a?.app_id)}>{a?.label}</option>)}
                        </Input></div>
                      <div className="col-12 col-md-6"><label className="form-label mb-1">Role</label>
                        <Input as="select" value={asChoiceValue(accessEditor?.role_id)} onChange={(e) => setAccessEditor((p) => ({ ...p, role_id: e.target.value }))} disabled={!normalizeText(accessEditor?.app_id)}>
                          <option value="">{normalizeText(accessEditor?.app_id) ? "Select role" : "Select application first"}</option>
                          {roleOptionsForAccessEditor.map((r) => <option key={String(r?.role_id)} value={String(r?.role_id)}>{r?.label}</option>)}
                        </Input></div>
                    </div>
                    <div className="umsp-access-editor-actions">
                      <Button type="button" variant="primary" size="sm" onClick={submitAccessEditor} disabled={!accessEditorReady}><FontAwesomeIcon icon={faCheck} className="me-1" aria-hidden="true" />Save</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={cancelAccessEditor}>Cancel</Button>
                    </div>
                  </div>
                ) : null}
                <TableZ className="umsp-access-table" columns={accessColumns} data={accessRows} rowIdKey="access_key" selectedRowId={null} emptyMessage="No access mappings assigned." actions={accessTableActions} />
              </>
            ) : null}

            {activeTab === "account" ? (
              <div className="row g-2">
                <div className="col-12"><label className="form-label mb-1">Last Login</label><Input value={formatDateTime(form?.last_login_at)} readOnly disabled /></div>
                <div className="col-12">
                  <div className="form-check mt-1">
                    <input id="umsp-set-password" className="form-check-input" type="checkbox" checked={enableNewPassword}
                      onChange={(e) => { setEnableNewPassword(e.target.checked); if (!e.target.checked) { setNewPasswordValue(""); setConfirmNewPassword(""); } }} disabled={!panelEditable || isPanelLoading} />
                    <label htmlFor="umsp-set-password" className="form-check-label">Set New Password</label>
                  </div>
                </div>
                {enableNewPassword ? (
                  <>
                    <div className="col-12 col-md-6"><label className="form-label mb-1">New Password</label>
                      <Input type="password" value={newPasswordValue} onChange={(e) => setNewPasswordValue(e.target.value)} disabled={!panelEditable || isPanelLoading} placeholder="At least 8 characters" /></div>
                    <div className="col-12 col-md-6"><label className="form-label mb-1">Confirm Password</label>
                      <Input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} disabled={!panelEditable || isPanelLoading} placeholder="Re-enter password" /></div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="umsp-sidepanel-footer">
            {panelMode === "view" ? (
              <>
                <Button type="button" variant="primary" size="sm" onClick={() => setPanelMode("edit")} disabled={isLoadingLookups}>Edit</Button>
                <Button type="button" variant="ghost" size="sm" onClick={closePanel}>Close</Button>
              </>
            ) : (
              <>
                <Button type="button" variant="primary" size="sm" onClick={stagePanelChanges} disabled={isStaging || isSavingBatch || isLoadingLookups}>
                  {isStaging ? "Staging..." : "Stage Changes"}</Button>
                <Button type="button" variant="ghost" size="sm" onClick={restorePanelToBaseline} disabled={isStaging || isSavingBatch}>
                  {panelMode === "add" ? "Cancel" : "Revert"}</Button>
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
