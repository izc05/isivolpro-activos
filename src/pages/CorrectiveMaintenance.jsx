import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/Layout/PageHeader';
import FormField from '../components/Forms/FormField';
import DataTable from '../components/Cards/DataTable';
import MaintenanceSchemaNotice from '../components/Maintenance/MaintenanceSchemaNotice';
import { useTenantRows } from '../hooks/useTenantRows';
import { createCorrectiveMaintenance } from '../services/correctiveMaintenanceService';
import { isMaintenanceSchemaMissing } from '../services/maintenanceSchemaGuard';
import { formatDate } from '../utils/dateUtils';
import { maintenanceStatusClass, maintenanceStatusLabel } from '../constants/maintenance';

export default function CorrectiveMaintenance() {
  const { rows: installations, activeTenantId } = useTenantRows('instalaciones', 'id,nombre', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', 'id,nombre,instalacion_id', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', 'id,nombre,instalacion_id,ubicacion_id,estado', { order: 'nombre', ascending: true });
  const { rows: incidents } = useTenantRows('incidencias', 'id,titulo,instalacion_id,ubicacion_id,activo_id,prioridad,estado', { order: 'fecha_apertura' });
  const { rows: correctives, refresh } = useTenantRows('mantenimientos_programados', '*, activos(nombre), instalaciones(nombre), ordenes_trabajo(id,codigo_ot,estado)', { order: 'fecha_programada' });
  const [error, setError] = useState('');
  const [schemaPending, setSchemaPending] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    instalacion_id: '',
    ubicacion_id: '',
    activo_id: '',
    incidencia_id: '',
    titulo: '',
    descripcion: '',
    prioridad: 'alta',
    fecha_programada: new Date().toISOString().slice(0, 10),
    assigned_to: ''
  });

  function updateField(field, value) {
    const patch = { [field]: value };
    if (field === 'activo_id') {
      const asset = assets.find((item) => item.id === value);
      if (asset) Object.assign(patch, { instalacion_id: asset.instalacion_id, ubicacion_id: asset.ubicacion_id || '' });
    }
    if (field === 'incidencia_id') {
      const incident = incidents.find((item) => item.id === value);
      if (incident) Object.assign(patch, { instalacion_id: incident.instalacion_id, ubicacion_id: incident.ubicacion_id || '', activo_id: incident.activo_id || '', titulo: `Correctivo: ${incident.titulo}`, prioridad: incident.prioridad || 'alta' });
    }
    setForm((current) => ({ ...current, ...patch }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSchemaPending(false);
    try {
      const result = await createCorrectiveMaintenance(activeTenantId, {
        ...form,
        tipo: 'correctivo',
        origen: form.incidencia_id ? 'incidencia' : 'activo'
      }, { generateOt: true });
      setMessage(`Correctivo creado${result.workOrder ? ' y OT generada' : ''}.`);
      setForm({ instalacion_id: '', ubicacion_id: '', activo_id: '', incidencia_id: '', titulo: '', descripcion: '', prioridad: 'alta', fecha_programada: new Date().toISOString().slice(0, 10), assigned_to: '' });
      refresh();
    } catch (err) {
      if (isMaintenanceSchemaMissing(err)) {
        setSchemaPending(true);
        return;
      }
      setError(err.message);
    }
  }

  const openCorrectives = correctives.filter((row) => row.tipo === 'correctivo');

  return (
    <>
      <PageHeader title="Correctivos" subtitle="Registro y control de averías sin ejecutar el trabajo fuera del módulo OT." />
      {schemaPending && <MaintenanceSchemaNotice />}
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}
      <div className="grid two">
        <section className="card">
          <h2 className="section-heading">Crear mantenimiento correctivo</h2>
          <form className="form-grid" onSubmit={submit}>
            <FormField label="Incidencia vinculada">
              <select value={form.incidencia_id} onChange={(event) => updateField('incidencia_id', event.target.value)}>
                <option value="">Sin incidencia</option>
                {incidents.filter((item) => !['cerrada', 'descartada', 'convertida_en_ot'].includes(item.estado)).map((incident) => <option key={incident.id} value={incident.id}>{incident.titulo}</option>)}
              </select>
            </FormField>
            <FormField label="Activo">
              <select value={form.activo_id} onChange={(event) => updateField('activo_id', event.target.value)} required>
                <option value="">Seleccionar</option>
                {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.nombre}</option>)}
              </select>
            </FormField>
            <div className="grid two">
              <FormField label="Instalación">
                <select value={form.instalacion_id} onChange={(event) => updateField('instalacion_id', event.target.value)} required>
                  <option value="">Seleccionar</option>
                  {installations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </FormField>
              <FormField label="Ubicación">
                <select value={form.ubicacion_id} onChange={(event) => updateField('ubicacion_id', event.target.value)}>
                  <option value="">Sin ubicación concreta</option>
                  {locations.filter((item) => !form.instalacion_id || item.instalacion_id === form.instalacion_id).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Descripción de avería"><input value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} required /></FormField>
            <FormField label="Detalle"><textarea rows="4" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} /></FormField>
            <div className="grid two">
              <FormField label="Prioridad"><select value={form.prioridad} onChange={(event) => updateField('prioridad', event.target.value)}>{['baja', 'media', 'alta', 'urgente', 'critica'].map((item) => <option key={item} value={item}>{item}</option>)}</select></FormField>
              <FormField label="Fecha prevista"><input type="date" value={form.fecha_programada} onChange={(event) => updateField('fecha_programada', event.target.value)} /></FormField>
            </div>
            <button className="primary-button" type="submit" disabled={schemaPending}>Crear correctivo y generar OT</button>
          </form>
        </section>
        <section>
          <h2 className="section-heading">Correctivos registrados</h2>
          <DataTable columns={[
            { key: 'fecha_programada', label: 'Fecha', render: (row) => formatDate(row.fecha_programada) },
            { key: 'titulo', label: 'Avería' },
            { key: 'activo', label: 'Activo', render: (row) => row.activos?.nombre },
            { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${maintenanceStatusClass(row.estado)}`}>{maintenanceStatusLabel(row.estado)}</span> },
            { key: 'ot', label: 'OT', render: (row) => row.ot_id ? <Link className="table-link" to={`/ots/${row.ot_id}`}>{row.ordenes_trabajo?.codigo_ot || 'Abrir'}</Link> : '-' }
          ]} rows={openCorrectives} empty="Sin correctivos." />
        </section>
      </div>
    </>
  );
}
