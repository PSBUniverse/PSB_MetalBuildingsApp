/**
 * RoleTable Component
 * Displays roles in table format with status
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faBan, faTrash } from '@fortawesome/free-solid-svg-icons';
import { getRoleDisplayName, getRoleDescription, isRoleActive } from '../model/role.model.js';
import { getStatusBadgeColor, getStatusLabel } from '../utils/status.js';

export function RoleTable({ selectedApp, appRoles }) {
  if (!selectedApp) {
    return (
      <div style={{ padding: '12px', backgroundColor: '#cfe2ff', borderRadius: '4px', color: '#084298' }}>
        Select an application to view roles.
      </div>
    );
  }

  if (appRoles.length === 0) {
    return (
      <div style={{ padding: '12px', backgroundColor: '#cfe2ff', borderRadius: '4px', color: '#084298' }}>
        No roles assigned to this application.
      </div>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #ddd' }}>
          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Role Name</th>
          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Description</th>
          <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>Active</th>
          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, width: '132px' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {appRoles.map((role) => {
          const isActive = isRoleActive(role);
          const badgeColor = getStatusBadgeColor(isActive);

          return (
            <tr key={role.role_id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px' }}>{getRoleDisplayName(role)}</td>
              <td style={{ padding: '12px', color: '#666' }}>{getRoleDescription(role)}</td>
              <td style={{ padding: '12px', textAlign: 'center' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: badgeColor.bg,
                    color: badgeColor.text,
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  {getStatusLabel(isActive)}
                </span>
              </td>
              <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                <span
                  className="table-actions-icon-btn action-color-edit action-btn-disabled"
                  style={{ marginRight: '6px' }}
                  title="Edit action available in full admin setup"
                >
                  <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                </span>
                <span
                  className="table-actions-icon-btn action-color-deactivate action-btn-disabled"
                  style={{ marginRight: '6px' }}
                  title="Status action available in full admin setup"
                >
                  <FontAwesomeIcon icon={faBan} aria-hidden="true" />
                </span>
                <span
                  className="table-actions-icon-btn action-color-delete action-btn-disabled"
                  title="Deactivate action available in full admin setup"
                >
                  <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
