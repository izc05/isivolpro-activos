import { Database } from 'lucide-react';
import { MAINTENANCE_SCHEMA_PENDING_DETAIL, MAINTENANCE_SCHEMA_PENDING_MESSAGE } from '../../services/maintenanceSchemaGuard';

export default function MaintenanceSchemaNotice() {
  return (
    <section className="maintenance-schema-notice" role="status">
      <div className="maintenance-schema-notice-icon">
        <Database size={20} />
      </div>
      <div>
        <strong>{MAINTENANCE_SCHEMA_PENDING_MESSAGE}</strong>
        <p>{MAINTENANCE_SCHEMA_PENDING_DETAIL}</p>
      </div>
    </section>
  );
}
