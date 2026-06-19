import { useEffect, useRef, useState } from 'react';
import { Bell, ExternalLink, History, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { listRecentNotifications, subscribeToNotifications } from '../../services/notificationService';
import { supabase } from '../../services/supabaseClient';
import { auditActionLabel, auditEntityLabel } from '../../utils/auditLabels';
import { formatDateTime } from '../../utils/dateUtils';

function readKey(tenantId, userId) {
  return `isivoltpro-notifications-read:${tenantId || 'global'}:${userId || 'anon'}`;
}

function readStoredAt(tenantId, userId) {
  return localStorage.getItem(readKey(tenantId, userId));
}

function storeReadAt(tenantId, userId, value) {
  localStorage.setItem(readKey(tenantId, userId), value);
}

function actorLabel(row) {
  return row?.profiles?.nombre || row?.profiles?.email || 'Sistema';
}

export default function NotificationBell() {
  const { user } = useAuth();
  const { activeTenantId, canViewAudit } = useTenant();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const lastReadRef = useRef(null);
  const [readAt, setReadAt] = useState(null);

  useEffect(() => {
    if (!activeTenantId || !canViewAudit) {
      setItems([]);
      setUnread(0);
      setError('');
      return undefined;
    }

    let mounted = true;
    const storedAt = readStoredAt(activeTenantId, user?.id);
    const initialReadAt = storedAt || new Date().toISOString();
    if (!storedAt) storeReadAt(activeTenantId, user?.id, initialReadAt);
    lastReadRef.current = initialReadAt;
    setReadAt(initialReadAt);

    async function refresh() {
      try {
        const rows = await listRecentNotifications(activeTenantId);
        if (!mounted) return;
        setItems(rows);
        setUnread(rows.filter((row) => row.created_at > (lastReadRef.current || initialReadAt)).length);
        setError('');
      } catch (err) {
        if (mounted) setError('No se pudieron cargar notificaciones.');
      }
    }

    refresh();
    const timer = window.setInterval(refresh, 60000);
    const channel = subscribeToNotifications(activeTenantId, async (row) => {
      if (!mounted) return;
      if (row.user_id) {
        const { data } = await supabase.from('profiles').select('email,nombre').eq('id', row.user_id).maybeSingle();
        row.profiles = data || null;
      }
      setItems((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 12));
      setUnread((current) => current + 1);
    });

    return () => {
      mounted = false;
      window.clearInterval(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeTenantId, canViewAudit, user?.id]);

  if (!activeTenantId || !canViewAudit) return null;

  function markRead() {
    const value = new Date().toISOString();
    storeReadAt(activeTenantId, user?.id, value);
    lastReadRef.current = value;
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
              <strong>Movimientos recientes</strong>
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
                <History size={20} />
                <span>Sin movimientos recientes.</span>
              </div>
            )}
            {items.map((item) => (
              <article className={`notification-item ${readAt && item.created_at > readAt ? 'unread' : ''}`} key={item.id}>
                <div className="notification-dot" />
                <div>
                  <strong>{auditActionLabel(item.action)}</strong>
                  <span>{auditEntityLabel(item.entity_type)} · {actorLabel(item)}</span>
                  <small>{formatDateTime(item.created_at)}</small>
                </div>
              </article>
            ))}
          </div>
          <Link className="notification-footer" to="/auditoria" onClick={() => setOpen(false)}>
            Ver auditoría completa <ExternalLink size={15} />
          </Link>
        </section>
      )}
    </div>
  );
}
