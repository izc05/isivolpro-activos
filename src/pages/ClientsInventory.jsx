import { Archive, Building2, Home, RotateCcw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/Cards/DataTable';
import PageHeader from '../components/Layout/PageHeader';
import { useTenant } from '../hooks/useTenant';
import { archiveTenant, listAllTenantsForManagement, restoreTenant } from '../services/tenantService';

export default function ClientsInventory() {
  const navigate = useNavigate();
  const { setActiveTenantId, setActiveInstallationId, refreshTenants } = useTenant();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('activos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try { setItems(await listAllTenantsForManagement()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return items.filter((row) => {
      const okText = !text || [row.nombre, row.direccion].filter(Boolean).some((value) => String(value).toLowerCase().includes(text));
      const okStatus = statusFilter === 'todos' || (statusFilter === 'activos' ? row.estado !== 'inactivo' : row.estado === 'inactivo');
      return okText && okStatus;
    });
  }, [items, query, statusFilter]);

  function initials(name) { return String(name || 'C').split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
  function logo(row) { return row.image_data_url ? <img className="client-logo-photo" src={row.image_data_url} alt={row.nombre} /> : <span className="client-logo-placeholder"><Building2 size={18} /><strong>{initials(row.nombre)}</strong></span>; }
  function name(row) { return <div className="client-table-name"><strong>{row.nombre}</strong><span>{row.direccion || 'Sin direccion registrada'}</span></div>; }
  function open(row) { setActiveTenantId(row.id); setActiveInstallationId(null); navigate('/instalaciones'); }
  async function archive(row) { if (!window.confirm(`Dar de baja el cliente "${row.nombre}"?`)) return; await archiveTenant(row); await refreshTenants(); await load(); }
  async function restore(row) { await restoreTenant(row); await refreshTenants(); await load(); }

  return (
    <>
      <PageHeader title="Clientes" subtitle="Listado general de clientes con buscador, foto/logo y acceso a instalaciones." />
      {error && <p className="error-text">{error}</p>}
      <section className="client-search-panel">
        <div className="client-search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente..." /></div>
        <div className="client-filter-tabs"><button className={statusFilter === 'activos' ? 'active' : ''} type="button" onClick={() => setStatusFilter('activos')}>Activos</button><button className={statusFilter === 'inactivos' ? 'active' : ''} type="button" onClick={() => setStatusFilter('inactivos')}>Baja</button><button className={statusFilter === 'todos' ? 'active' : ''} type="button" onClick={() => setStatusFilter('todos')}>Todos</button></div>
      </section>
      {loading ? <p className="muted">Cargando clientes...</p> : <DataTable columns={[{ key: 'foto', label: 'Foto', render: logo }, { key: 'nombre', label: 'Cliente', render: name }, { key: 'plan', label: 'Plan', render: (row) => <span className="badge">{row.plan || 'starter'}</span> }, { key: 'estado', label: 'Estado', render: (row) => <span className={row.estado === 'activo' ? 'badge ok' : 'badge danger'}>{row.estado || 'activo'}</span> }, { key: 'actions', label: 'Acciones', render: (row) => <div className="inline-actions"><button className="primary-button" type="button" onClick={() => open(row)}><Home size={16} /> Ver instalaciones</button>{row.estado === 'inactivo' ? <button className="secondary-button" type="button" onClick={() => restore(row)}><RotateCcw size={16} /> Reactivar</button> : <button className="danger-button" type="button" onClick={() => archive(row)}><Archive size={16} /> Baja</button>}</div> }]} rows={rows} empty="No hay clientes que coincidan con la busqueda." />}
      <p className="muted" style={{ marginTop: 12 }}>El selector superior Cliente activo / Instalacion activa se mantiene como acceso rapido global.</p>
    </>
  );
}
