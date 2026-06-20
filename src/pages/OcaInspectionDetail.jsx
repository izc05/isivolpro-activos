import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, FileText, Link2, Plus, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/Layout/PageHeader';
import DataTable from '../components/Cards/DataTable';
import FormField from '../components/Forms/FormField';
import Modal from '../components/Layout/Modal';
import { useTenant } from '../hooks/useTenant';
import { useTenantRows } from '../hooks/useTenantRows';
import { listOcaControls, createOcaControl } from '../services/ocaControlService';
import { createOcaInspection, getOcaInspection, updateOcaInspection, closeOcaInspection } from '../services/ocaInspectionService';
import { createOcaIncident, listOcaIncidentsForInspection, setOcaIncidentState } from '../services/ocaIncidentService';
import { listOcaDocumentsForInspection, uploadOcaDocument } from '../services/ocaDocumentService';
import { createOcaCorrectiveWorkOrder, listOcaWorkOrdersForInspection } from '../services/ocaWorkOrderBridgeService';
import { formatDate } from '../utils/dateUtils';
import { calculateNextOcaDate, daysUntil, OCA_DOCUMENT_TYPES, OCA_INCIDENT_CLASSIFICATIONS, OCA_INCIDENT_STATES, OCA_INSPECTION_STATES, OCA_INSPECTION_TYPES, OCA_RESULTS, OCA_SPECIALTIES, ocaLabel, ocaStatusClass } from '../constants/oca';

const emptyInspection = {
  control_oca_id: '',
  instalacion_id: '',
  ubicacion_id: '',
  activo_id: '',
  especialidad: 'baja_tension',
  codigo: '',
  tipo_inspeccion: 'periodica',
  fecha_programada: '',
  fecha_realizada: '',
  organismo_control: '',
  inspector_nombre: '',
  numero_expediente: '',
  numero_acta: '',
  resultado: 'pendiente',
  estado: 'programada',
  periodicidad_aplicada: '',
  periodicidad_unidad: 'anos',
  fecha_proxima_inspeccion: '',
  observaciones: '',
  conclusiones: ''
};

export default function OcaInspectionDetail({ mode = 'detail' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeTenantId } = useTenant();
  const { rows: installations } = useTenantRows('instalaciones', '*', { order: 'nombre', ascending: true });
  const { rows: locations } = useTenantRows('ubicaciones', '*', { order: 'nombre', ascending: true });
  const { rows: assets } = useTenantRows('activos', '*', { order: 'nombre', ascending: true });
  const [controls, setControls] = useState([]);
  const [inspection, setInspection] = useState(null);
  const [form, setForm] = useState(emptyInspection);
  const [incidents, setIncidents] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ codigo: '', titulo: '', descripcion: '', clasificacion: 'observacion', fecha_limite: '', estado: 'pendiente' });
  const [documentForm, setDocumentForm] = useState({ titulo: '', tipo_documento: 'acta_oca', file: null, visibilidad: 'cliente' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const isNew = mode === 'new';

  useEffect(() => {
    if (!activeTenantId) return;
    listOcaControls(activeTenantId).then(setControls).catch((err) => setError(err.message));
  }, [activeTenantId]);

  useEffect(() => {
    if (!activeTenantId || isNew || !id) return;
    refreshDetail();
  }, [activeTenantId, id, isNew]);

  const selectedControl = controls.find((control) => control.id === form.control_oca_id);
  const filteredLocations = locations.filter((location) => location.instalacion_id === form.instalacion_id);
  const filteredAssets = assets.filter((asset) => asset.instalacion_id === form.instalacion_id);
  const nextDate = form.fecha_proxima_inspeccion || calculateNextOcaDate(form.fecha_realizada, form.periodicidad_aplicada, form.periodicidad_unidad);
  const remainingDays = daysUntil(nextDate);

  const title = isNew ? 'Nueva inspección OCA' : `${inspection?.codigo || 'Inspección OCA'} · ${inspection?.instalaciones?.nombre || ''}`;
  const subtitle = isNew ? 'Registra una inspección realizada o programada.' : `${ocaLabel(OCA_SPECIALTIES, inspection?.controles_oca?.especialidad)} · ${ocaLabel(OCA_RESULTS, inspection?.resultado)}`;

  function refreshDetail() {
    return Promise.all([
      getOcaInspection(activeTenantId, id),
      listOcaIncidentsForInspection(activeTenantId, id),
      listOcaDocumentsForInspection(activeTenantId, id),
      listOcaWorkOrdersForInspection(activeTenantId, id)
    ]).then(([inspectionRow, incidentRows, documentRows, workOrderRows]) => {
      setInspection(inspectionRow);
      setForm({ ...emptyInspection, ...inspectionRow, periodicidad_aplicada: inspectionRow.periodicidad_aplicada || '' });
      setIncidents(incidentRows);
      setDocuments(documentRows);
      setWorkOrders(workOrderRows);
    }).catch((err) => setError(err.message));
  }

  function updateForm(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'control_oca_id') {
        const control = controls.find((item) => item.id === value);
        if (control) {
          next.instalacion_id = control.instalacion_id;
          next.ubicacion_id = control.ubicacion_id || '';
          next.activo_id = control.activo_id || '';
          next.especialidad = control.especialidad || 'otra';
          next.periodicidad_aplicada = control.periodicidad_valor || '';
          next.periodicidad_unidad = control.periodicidad_unidad || 'anos';
        }
      }
      if (['fecha_realizada', 'periodicidad_aplicada', 'periodicidad_unidad'].includes(field)) {
        next.fecha_proxima_inspeccion = calculateNextOcaDate(next.fecha_realizada, next.periodicidad_aplicada, next.periodicidad_unidad) || next.fecha_proxima_inspeccion;
      }
      return next;
    });
  }

  async function submitInspection(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      let controlId = form.control_oca_id;
      if (!controlId) {
        const installation = installations.find((item) => item.id === form.instalacion_id);
        const createdControl = await createOcaControl(activeTenantId, {
          instalacion_id: form.instalacion_id,
          ubicacion_id: form.ubicacion_id,
          activo_id: form.activo_id,
          nombre: `${installation?.nombre || 'Instalación'} · ${ocaLabel(OCA_SPECIALTIES, form.especialidad || 'otra')}`,
          especialidad: form.especialidad || 'otra',
          periodicidad_valor: form.periodicidad_aplicada,
          periodicidad_unidad: form.periodicidad_unidad
        });
        controlId = createdControl.id;
      }
      const payload = { ...form, control_oca_id: controlId, fecha_proxima_inspeccion: nextDate || form.fecha_proxima_inspeccion };
      const saved = isNew ? await createOcaInspection(activeTenantId, payload) : await updateOcaInspection(inspection, payload);
      setSuccess('Inspección guardada correctamente.');
      if (isNew) navigate(`/oca/inspecciones/${saved.id}`);
      else refreshDetail();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitIncident(event) {
    event.preventDefault();
    setError('');
    try {
      await createOcaIncident(activeTenantId, {
        ...incidentForm,
        inspeccion_oca_id: inspection.id,
        instalacion_id: inspection.instalacion_id,
        ubicacion_id: inspection.ubicacion_id,
        activo_id: inspection.activo_id,
        fecha_deteccion: inspection.fecha_realizada
      });
      setIncidentModalOpen(false);
      setIncidentForm({ codigo: '', titulo: '', descripcion: '', clasificacion: 'observacion', fecha_limite: '', estado: 'pendiente' });
      refreshDetail();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitDocument(event) {
    event.preventDefault();
    setError('');
    try {
      await uploadOcaDocument(activeTenantId, {
        ...documentForm,
        control_oca_id: inspection.control_oca_id,
        inspeccion_oca_id: inspection.id,
        instalacion_id: inspection.instalacion_id,
        ubicacion_id: inspection.ubicacion_id,
        activo_id: inspection.activo_id,
        tipo: 'OCA'
      });
      setDocumentModalOpen(false);
      setDocumentForm({ titulo: '', tipo_documento: 'acta_oca', file: null, visibilidad: 'cliente' });
      refreshDetail();
    } catch (err) {
      setError(err.message);
    }
  }

  async function generateWorkOrder(incident) {
    setError('');
    try {
      await createOcaCorrectiveWorkOrder(activeTenantId, incident);
      refreshDetail();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!isNew && !inspection) return <PageHeader title="Inspección OCA" subtitle="Cargando..." />;

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} action={<Link className="secondary-button" to="/oca/inspecciones">Volver</Link>} />
      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}
      <form className="card form-grid" onSubmit={submitInspection}>
        <div className="grid two">
          <FormField label="Control OCA">
            <select value={form.control_oca_id} onChange={(event) => updateForm('control_oca_id', event.target.value)}>
              <option value="">Crear desde instalación</option>
              {controls.map((control) => <option key={control.id} value={control.id}>{control.instalaciones?.nombre} · {ocaLabel(OCA_SPECIALTIES, control.especialidad)}</option>)}
            </select>
          </FormField>
          <FormField label="Especialidad">
            <select value={form.especialidad || selectedControl?.especialidad || 'otra'} onChange={(event) => updateForm('especialidad', event.target.value)} disabled={Boolean(form.control_oca_id)}>
              {OCA_SPECIALTIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid two">
          <FormField label="Instalación">
            <select value={form.instalacion_id} onChange={(event) => updateForm('instalacion_id', event.target.value)} required>
              <option value="">Selecciona instalación</option>
              {installations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid three">
          <FormField label="Ubicación"><select value={form.ubicacion_id || ''} onChange={(event) => updateForm('ubicacion_id', event.target.value)}><option value="">Sin ubicación</option>{filteredLocations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></FormField>
          <FormField label="Activo"><select value={form.activo_id || ''} onChange={(event) => updateForm('activo_id', event.target.value)}><option value="">Sin activo</option>{filteredAssets.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></FormField>
          <FormField label="Código"><input value={form.codigo || ''} onChange={(event) => updateForm('codigo', event.target.value)} placeholder="OCA-2026-001" /></FormField>
        </div>
        <div className="grid three">
          <FormField label="Tipo"><select value={form.tipo_inspeccion} onChange={(event) => updateForm('tipo_inspeccion', event.target.value)}>{OCA_INSPECTION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
          <FormField label="Fecha realizada"><input type="date" value={form.fecha_realizada || ''} onChange={(event) => updateForm('fecha_realizada', event.target.value)} /></FormField>
          <FormField label="Fecha programada"><input type="date" value={form.fecha_programada || ''} onChange={(event) => updateForm('fecha_programada', event.target.value)} /></FormField>
        </div>
        <div className="grid three">
          <FormField label="Organismo de control"><input value={form.organismo_control || ''} onChange={(event) => updateForm('organismo_control', event.target.value)} /></FormField>
          <FormField label="Inspector"><input value={form.inspector_nombre || ''} onChange={(event) => updateForm('inspector_nombre', event.target.value)} /></FormField>
          <FormField label="Número de acta"><input value={form.numero_acta || ''} onChange={(event) => updateForm('numero_acta', event.target.value)} /></FormField>
        </div>
        <div className="grid three">
          <FormField label="Resultado"><select value={form.resultado} onChange={(event) => updateForm('resultado', event.target.value)}>{OCA_RESULTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
          <FormField label="Estado"><select value={form.estado} onChange={(event) => updateForm('estado', event.target.value)}>{OCA_INSPECTION_STATES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
          <FormField label="Expediente"><input value={form.numero_expediente || ''} onChange={(event) => updateForm('numero_expediente', event.target.value)} /></FormField>
        </div>
        <div className="grid three">
          <FormField label="Periodicidad"><input type="number" min="1" value={form.periodicidad_aplicada || ''} onChange={(event) => updateForm('periodicidad_aplicada', event.target.value)} /></FormField>
          <FormField label="Unidad"><select value={form.periodicidad_unidad || 'anos'} onChange={(event) => updateForm('periodicidad_unidad', event.target.value)}><option value="anos">Años</option><option value="meses">Meses</option><option value="manual">Manual</option></select></FormField>
          <FormField label="Próxima inspección"><input type="date" value={nextDate || ''} onChange={(event) => updateForm('fecha_proxima_inspeccion', event.target.value)} /></FormField>
        </div>
        <div className="oca-next-summary">
          <ShieldCheck size={18} />
          <strong>Próxima inspección:</strong>
          <span>{formatDate(nextDate)} {remainingDays !== null ? `· ${remainingDays} días` : ''}</span>
        </div>
        <FormField label="Observaciones"><textarea rows="3" value={form.observaciones || ''} onChange={(event) => updateForm('observaciones', event.target.value)} /></FormField>
        <FormField label="Conclusiones"><textarea rows="3" value={form.conclusiones || ''} onChange={(event) => updateForm('conclusiones', event.target.value)} /></FormField>
        <div className="form-actions">
          {!isNew && <button className="ghost-button" type="button" onClick={() => closeOcaInspection(inspection).then(refreshDetail)}>Cerrar inspección</button>}
          <button className="primary-button" type="submit">{isNew ? 'Crear inspección' : 'Guardar cambios'}</button>
        </div>
      </form>

      {!isNew && (
        <section className="section-stack">
          <SectionHeader icon={FileText} title="Documentación" action={<button className="secondary-button" onClick={() => setDocumentModalOpen(true)}><Plus size={16} /> Subir acta</button>} />
          <DataTable columns={[
            { key: 'tipo', label: 'Tipo', render: (row) => ocaLabel(OCA_DOCUMENT_TYPES, row.tipo_documento) },
            { key: 'titulo', label: 'Documento', render: (row) => row.documentos?.titulo || '-' },
            { key: 'archivo', label: 'Archivo', render: (row) => row.documentos?.file_name || '-' },
            { key: 'visibilidad', label: 'Visibilidad', render: (row) => row.documentos?.visibilidad || '-' }
          ]} rows={documents} empty="Sin documentación OCA vinculada." />

          <SectionHeader icon={AlertTriangle} title="Incidencias OCA" action={<button className="secondary-button" onClick={() => setIncidentModalOpen(true)}><Plus size={16} /> Añadir incidencia</button>} />
          <DataTable columns={[
            { key: 'codigo', label: 'Código', render: (row) => row.codigo || '-' },
            { key: 'titulo', label: 'Incidencia' },
            { key: 'clasificacion', label: 'Clasificación', render: (row) => <span className={`badge ${ocaStatusClass(row.clasificacion)}`}>{ocaLabel(OCA_INCIDENT_CLASSIFICATIONS, row.clasificacion)}</span> },
            { key: 'fecha_limite', label: 'Límite', render: (row) => formatDate(row.fecha_limite) },
            { key: 'estado', label: 'Estado', render: (row) => <span className={`badge ${ocaStatusClass(row.estado)}`}>{ocaLabel(OCA_INCIDENT_STATES, row.estado)}</span> },
            { key: 'acciones', label: 'Acciones', render: (row) => <div className="button-row"><button className="ghost-button" onClick={() => generateWorkOrder(row)}>Generar OT</button><button className="ghost-button" onClick={() => setOcaIncidentState(row, 'verificada').then(refreshDetail)}>Verificar</button></div> }
          ]} rows={incidents} empty="Sin incidencias OCA." />

          <SectionHeader icon={Link2} title="OT vinculadas" />
          <DataTable columns={[
            { key: 'incidencia', label: 'Incidencia', render: (row) => row.incidencias_oca?.titulo || '-' },
            { key: 'ot', label: 'OT', render: (row) => row.ordenes_trabajo ? <Link className="table-link" to={`/ots/${row.ordenes_trabajo.id}`}>{row.ordenes_trabajo.codigo_ot || row.ordenes_trabajo.titulo}</Link> : '-' },
            { key: 'estado', label: 'Estado', render: (row) => row.ordenes_trabajo?.estado || '-' },
            { key: 'fecha', label: 'Fecha prevista', render: (row) => formatDate(row.ordenes_trabajo?.fecha_prevista) }
          ]} rows={workOrders} empty="Sin OT vinculadas." />
        </section>
      )}

      <Modal title="Añadir incidencia OCA" open={incidentModalOpen} onClose={() => setIncidentModalOpen(false)}>
        <form className="form-grid" onSubmit={submitIncident}>
          <FormField label="Título"><input value={incidentForm.titulo} onChange={(event) => setIncidentForm({ ...incidentForm, titulo: event.target.value })} required /></FormField>
          <FormField label="Descripción"><textarea rows="4" value={incidentForm.descripcion} onChange={(event) => setIncidentForm({ ...incidentForm, descripcion: event.target.value })} required /></FormField>
          <div className="grid three">
            <FormField label="Código"><input value={incidentForm.codigo} onChange={(event) => setIncidentForm({ ...incidentForm, codigo: event.target.value })} /></FormField>
            <FormField label="Clasificación"><select value={incidentForm.clasificacion} onChange={(event) => setIncidentForm({ ...incidentForm, clasificacion: event.target.value })}>{OCA_INCIDENT_CLASSIFICATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
            <FormField label="Fecha límite"><input type="date" value={incidentForm.fecha_limite} onChange={(event) => setIncidentForm({ ...incidentForm, fecha_limite: event.target.value })} /></FormField>
          </div>
          <div className="form-actions"><button className="primary-button" type="submit">Crear incidencia</button></div>
        </form>
      </Modal>

      <Modal title="Subir documentación OCA" open={documentModalOpen} onClose={() => setDocumentModalOpen(false)}>
        <form className="form-grid" onSubmit={submitDocument}>
          <FormField label="Título"><input value={documentForm.titulo} onChange={(event) => setDocumentForm({ ...documentForm, titulo: event.target.value })} required /></FormField>
          <FormField label="Tipo de documento"><select value={documentForm.tipo_documento} onChange={(event) => setDocumentForm({ ...documentForm, tipo_documento: event.target.value })}>{OCA_DOCUMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
          <FormField label="Archivo"><input type="file" onChange={(event) => setDocumentForm({ ...documentForm, file: event.target.files?.[0] || null })} required /></FormField>
          <div className="form-actions"><button className="primary-button" type="submit">Subir y vincular</button></div>
        </form>
      </Modal>
    </>
  );
}

function SectionHeader({ icon: Icon, title, action }) {
  return (
    <div className="section-title">
      <h2>{Icon && <Icon size={20} />} {title}</h2>
      {action}
    </div>
  );
}
