/**
 * ApplicationSelector Component
 * Displays applications in table format for selection
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faBan, faTrash } from '@fortawesome/free-solid-svg-icons';
import {
  getApplicationDisplayOrder,
  getApplicationDisplayName,
  getApplicationDescription,
  isApplicationActive,
} from '../model/application.model.js';

export function ApplicationSelector({ applications, selectedAppId }) {
  if (!Array.isArray(applications) || applications.length === 0) {
    return (
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px' }}>
        <h3 style={{ marginBottom: '16px' }}>Applications</h3>
        <div style={{ padding: '12px', backgroundColor: '#fff3cd', borderRadius: '4px', color: '#664d03' }}>
          No active applications found.
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px' }}>
      <h3 style={{ marginBottom: '16px' }}>Applications</h3>
      <div style={{ color: '#6c757d', fontSize: '12px', marginBottom: '8px' }}>
        Click a row action to load roles for that application.
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, width: '120px' }}>Actions</th>
            <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Application</th>
            <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, width: '72px' }}>Order</th>
            <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Description</th>
            <th style={{ padding: '10px', textAlign: 'center', fontWeight: 600, width: '110px' }}>Active</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => {
            const isSelected = String(selectedAppId || '') === String(app.app_id || '');
            const isActive = isApplicationActive(app);
            const appOrder = getApplicationDisplayOrder(app, 0);

            return (
              <tr
                key={app.app_id}
                style={{
                  borderBottom: '1px solid #eee',
                  backgroundColor: isSelected ? '#f0f4ff' : '#fff',
                }}
              >
                <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                  <a
                    href={`?app=${app.app_id}`}
                    className="table-actions-icon-btn action-color-edit"
                    style={{ textDecoration: 'none', marginRight: '6px' }}
                    title="View roles"
                    aria-label={`View roles for ${getApplicationDisplayName(app)}`}
                  >
                    <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                  </a>
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
                <td style={{ padding: '10px' }}>
                  <a
                    href={`?app=${app.app_id}`}
                    style={{ color: 'inherit', textDecoration: 'none', display: 'block', fontWeight: isSelected ? 600 : 500 }}
                  >
                    {getApplicationDisplayName(app)}
                  </a>
                </td>
                <td style={{ padding: '10px' }}>
                  {appOrder > 0 ? String(appOrder) : '--'}
                </td>
                <td style={{ padding: '10px', color: '#666' }}>
                  <a
                    href={`?app=${app.app_id}`}
                    style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}
                  >
                    {getApplicationDescription(app)}
                  </a>
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: isActive ? '#d1e7dd' : '#cfe2ff',
                      color: isActive ? '#0a3622' : '#084298',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
