import { useEffect, useRef, useState } from 'react';
import { Bell, BriefcaseBusiness, ExternalLink, History, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { listAuditNotifications, listTechnicianNotifications, subscribeToAuditNotifications, subscribeToTechnicianWorkOrders } from '../../services/notificationService';
import { supabase } from '../../services/supabaseClient';
import { auditActionLabel, auditEntityLabel } from '../../utils/auditLabels';
import { formatDateTime } from '../../utils/dateUtils';
import { priorityLabel, priorityTone, workOrderStatusLabel } from '../../utils/workOrderLifecycle';

function readKey(mode, tenantId, userId) {
  return `isivoltpro-notifications-read:${mode}:${tenantId || 'global'}:${userId || 'anon'}`;
}

function loadReadAt(mode, tenantId, userId) {
  return localStorage.getItem(readKey(mode, tenantId, userId));
}

function saveReadAt(mode, tenantId, userId, value) {
  localStorage.setItem(readKey(mode, tenantId, userId), value);
}

function rowDate(row, mode) {
  if (mode === 'technician') return row.updated_at || row.created_at || row.fecha_prevista;
  return row.created_at;
}

function auditActor(row) {
  return row?.profiles?.nombre || row?.profiles?.email || 'Sistema';
}

function workOrderSubtitle(row) {
  return [row.instalaciones?.nombre, row.activos?.nombre].filter(Boolean).join(' · ') || 'Orden asignada';
}

export default function NotificationBell() {
  const { user } = useAuth();
  const { activeTenantId, canViewAudit, isTechnician, canManageWorkOrders } = useTenant();
  const mode = canViewAudit ? 'audit' : isTechnician || canManageWorkOrders ? 'technician' : null;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [readAt, setReadAt] = useState(null);
  const readAtRef = useRef(null);

  useEffect(() => {
    if (!activeTenantId || !user?.id || !mode) {
      setItems([]);
      setUnread(0);
      setError('');
      return undefined;
    }

    let mounted = true;
    const storedAt = loadReadAt(mode, activeTenantId, user.id);
    const initialReadAt = storedAt || new Date().toISOString();
    if (!storedAt) saveReadAt(mode, activeTenantId, user.id, initialReadAt);
    readAtRef.current = initialReadAt;
    setReadAt(initialReadAt);

    async function refresh() {
      try {
        const rows = mode === 'audit'
          ? await listAuditNotifications(activeTenantId)
          : await listTechnicianNotifications(activeTenantId, user.id);
        if (!mounted) return;
        setItems(rows);
        setUnread(rows.filter((row) => rowDate(row, mode) > (readAtRef.current || initialReadAt)).length);
        setError('');
      } catch (err) {
        if (mounted) setError('No se pudieron cargar notificaciones.');
      }
    }

    refresh();
    const timer = window.setInterval(refresh, 60000);
    const channel = mode === 'audit'
      ? subscribeToAuditNotifications(activeTenantId, async (row) => {
          if (!mounted) return;
          if (row.user_id) {
            const { data } = await supabase.from('profiles').select('email,nombre').eq('id', row.user_id).maybeSingle();
            row.profiles = data || null;
          }
          setItems((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 12));
          if (row.created_at > (readAtRef.current || initialReadAt)) setUnread((current) => current + 1);
        })
      : subscribeToTechnicianWorkOrders(activeTenantId, user.id, (row) => {
          if (!mounted) return;
          setItems((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 12));
          if (rowDate(row, mode) > (readAtRef.current || initialReadAt)) setUnread((current) => current + 1);
        });

    return () => {
      mounted = false;
      window.clearInterval(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeTenantId, user?.id, mode]);

  if (!activeTenantId || !user?.id || !mode) return null;

  function markRead() {
    const value = new Date().toISOString();
    saveReadAt(mode, activeTenantId, user.id, value);
    readAtRef.current = value;
    setReadAt(value);
    setUnread(0);
  }

  function toggleOpen() {
    setOpen((current) => {
      const next = !current;
      if (next) markRead();
      return next;
    });
  }

  return (
    <div className="notification-wrap">
      <button className={`ghost-button notification-button ${unread ? 'has-unread' : ''}`} type="button" onClick={toggleOpen} aria-label="Notificaciones" aria-expanded={open}>
        <Bell size={18} />
        {unread > 0 && <span className="notification-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <section className="notification-panel">
          <header>
            <div>
              <strong>{mode === 'audit' ? 'Movimientos recientes' : 'Avisos de tus OT'}</strong>
              <span>{unread ? `${unread} sin leer` : 'Todo revisado'}</span>
            </div>
            <button className="sidebar-icon-button notification-close" type="button" onClick={() => setOpen(false)} aria-label="Cerrar notificaciones">
              <X size={16} />
            </button>
          </header>
          {error && <p className="notification-error">{error}</p>}
          <div className="notification-list">
            {!items.length && !error && (
              <div className="notification-empty">
                {mode === 'audit' ? <History size={20} /> : <BriefcaseBusiness size={20} />}
                <span>{mode === 'audit' ? 'Sin movimientos recientes.' : 'No tienes avisos de OT.'}</span>
              </div>
            )}
            {items.map((item) => mode === 'audit'
              ? <AuditNotificationItem item={item} readAt={readAt} key={item.id} />
              : <TechnicianNotificationItem item={item} readAt={readAt} key={item.id} />
            )}
          </div>
          <Link className="notification-footer" to={mode === 'audit' ? '/auditoria' : '/mis-ots'} onClick={() => setOpen(false)}>
            {mode === 'audit' ? 'Ver auditoría completa' : 'Ver mis OT'} <ExternalLink size={15} />
          </Link>
        </section>
      )}
    </div>
  );
}

function AuditNotificationItem({ item, readAt }) {
  return (
    <article className={`notification-item ${readAt && item.created_at > readAt ? 'unread' : ''}`}>
      <div className="notification-dot" />
      <div>
        <strong>{auditActionLabel(item.action)}</strong>
        <span>{auditEntityLabel(item.entity_type)} · {auditActor(item)}</span>
        <small>{formatDateTime(item.created_at)}</small>
      </div>
    </article>
  );
}

function TechnicianNotificationItem({ item, readAt }) {
  const date = rowDate(item, 'technician');
  return (
    <article className={`notification-item ${readAt && date > readAt ? 'unread' : ''}`}>
      <div className="notification-dot" />
      <div>
        <strong>{item.codigo_ot || item.titulo || 'OT asignada'}</strong>
        <span>{workOrderStatusLabel(item.estado)} · {workOrderSubtitle(item)}</span>
        <div className="notification-badges">
          <small className={`badge ${priorityTone(item.prioridad)}`}>{priorityLabel(item.prioridad || 'normal')}</small>
          {item.fecha_prevista && <small>{formatDateTime(item.fecha_prevista)}</small>}
        </div>
      </div>
    </article>
  );
}
