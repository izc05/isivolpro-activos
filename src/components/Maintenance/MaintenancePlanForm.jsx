import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import FormField from '../Forms/FormField';
import { CHECKLIST_RESPONSE_TYPES, DEFAULT_PLAN_CHECKLIST_ITEM, MAINTENANCE_PRIORITIES, MAINTENANCE_TYPES, PERIOD_UNITS, nextDateFrom } from '../../constants/maintenance';

const emptyForm = {
  instalacion_id: '',
  ubicacion_id: '',
  activo_id: '',
  nombre: '',
  descripcion: '',
  tipo: 'preventivo',
  categoria: '',
  periodicidad_valor: 3,
  periodicidad_unidad: 'meses',
  fecha_inicio: new Date().toISOString().slice(0, 10),
  fecha_ultima_realizacion: '',
  fecha_proxima_realizacion: '',
  dias_aviso: 15,
  tolerancia_dias: 0,
  prioridad: 'media',
  responsable_id: '',
  tiempo_estimado_minutos: '',
  instrucciones: '',
  checklist_json: [],
  materiales_previstos_json: [],
  herramientas_json: [],
  auto_generar_ot: false,
  activo: true
};

export default function MaintenancePlanForm({ plan, installations = [], locations = [], assets = [], users = [], onSubmit, onCancel, saving = false }) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!plan) {
      setForm(emptyForm);
      return;
    }
    setForm({
      ...emptyForm,
      ...plan,
      ubicacion_id: plan.ubicacion_id || '',
      responsable_id: plan.responsable_id || '',
      periodicidad_valor: plan.periodicidad_valor || '',
      checklist_json: Array.isArray(plan.checklist_json) ? plan.checklist_json : [],
      materiales_previstos_json: Array.isArray(plan.materiales_previstos_json) ? plan.materiales_previstos_json : [],
      herramientas_json: Array.isArray(plan.herramientas_json) ? plan.herramientas_json : []
    });
  }, [plan]);

  const filteredLocations = useMemo(() => locations.filter((item) => !form.instalacion_id || item.instalacion_id === form.instalacion_id), [locations, form.instalacion_id]);
  const filteredAssets = useMemo(() => assets.filter((item) => !form.instalacion_id || item.instalacion_id === form.instalacion_id).filter((item) => !form.ubicacion_id || item.ubicacion_id === form.ubicacion_id), [assets, form.instalacion_id, form.ubicacion_id]);
  const calculatedNext = nextDateFrom(form.fecha_ultima_realizacion || form.fecha_inicio, form.periodicidad_valor, form.periodicidad_unidad);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateChecklist(index, field, value) {
    setForm((current) => ({
      ...current,
      checklist_json: current.checklist_json.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
    }));
  }

  function addChecklistItem() {
    setForm((current) => ({
      ...current,
      checklist_json: [...current.checklist_json, { ...DEFAULT_PLAN_CHECKLIST_ITEM, id: crypto.randomUUID(), orden: current.checklist_json.length + 1 }]
    }));
  }

  function removeChecklistItem(index) {
    setForm((current) => ({ ...current, checklist_json: current.checklist_json.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, orden: itemIndex + 1 })) }));
  }

  function submit(event) {
    event.preventDefault();
    onSubmit({ ...form, fecha_proxima_realizacion: form.fecha_proxima_realizacion || calculatedNext });
  }

  return (
    <form className="form-grid workorder-form" onSubmit={submit}>
      <div className="grid two">
        <FormField label="Nombre"><input value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} required /></FormField>
        <FormField label="Tipo">
          <select value={form.tipo} onChange={(event) => updateField('tipo', event.target.value)}>
            {MAINTENANCE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </FormField>
      </div>
      <FormField label="Descripción"><textarea rows="3" value={form.descripcion || ''} onChange={(event) => updateField('descripcion', event.target.value)} /></FormField>
      <div className="grid two">
        <FormField label="Instalación">
          <select value={form.instalacion_id} onChange={(event) => updateField('instalacion_id', event.target.value)} required>
            <option value="">Seleccionar</option>
            {installations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </FormField>
        <FormField label="Ubicación">
          <select value={form.ubicacion_id || ''} onChange={(event) => updateField('ubicacion_id', event.target.value)}>
            <option value="">Sin ubicación concreta</option>
            {filteredLocations.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </FormField>
      </div>
      <div className="grid two">
        <FormField label="Activo">
          <select value={form.activo_id} onChange={(event) => updateField('activo_id', event.target.value)} required>
            <option value="">Seleccionar</option>
            {filteredAssets.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </FormField>
        <FormField label="Categoría"><input value={form.categoria || ''} onChange={(event) => updateField('categoria', event.target.value)} /></FormField>
      </div>
      <div className="grid two">
        <FormField label="Periodicidad">
          <div className="grid two">
            <input type="number" min="1" value={form.periodicidad_valor || ''} onChange={(event) => updateField('periodicidad_valor', event.target.value)} />
            <select value={form.periodicidad_unidad} onChange={(event) => updateField('periodicidad_unidad', event.target.value)}>
              {PERIOD_UNITS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
            </select>
          </div>
        </FormField>
        <FormField label="Prioridad">
          <select value={form.prioridad} onChange={(event) => updateField('prioridad', event.target.value)}>
            {MAINTENANCE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </FormField>
      </div>
      <div className="grid two">
        <FormField label="Fecha de inicio"><input type="date" value={form.fecha_inicio || ''} onChange={(event) => updateField('fecha_inicio', event.target.value)} /></FormField>
        <FormField label="Próxima realización"><input type="date" value={form.fecha_proxima_realizacion || calculatedNext || ''} onChange={(event) => updateField('fecha_proxima_realizacion', event.target.value)} /></FormField>
      </div>
      <div className="grid two">
        <FormField label="Responsable">
          <select value={form.responsable_id || ''} onChange={(event) => updateField('responsable_id', event.target.value)}>
            <option value="">Sin responsable fijo</option>
            {users.map((user) => <option key={user.user_id || user.id} value={user.user_id || user.id}>{user.profiles?.nombre || user.profiles?.email || user.nombre || user.email}</option>)}
          </select>
        </FormField>
        <FormField label="Tiempo estimado (min)"><input type="number" min="0" value={form.tiempo_estimado_minutos || ''} onChange={(event) => updateField('tiempo_estimado_minutos', event.target.value)} /></FormField>
      </div>
      <div className="grid two">
        <FormField label="Días de preaviso"><input type="number" min="0" value={form.dias_aviso || 0} onChange={(event) => updateField('dias_aviso', event.target.value)} /></FormField>
        <FormField label="Margen permitido"><input type="number" min="0" value={form.tolerancia_dias || 0} onChange={(event) => updateField('tolerancia_dias', event.target.value)} /></FormField>
      </div>
      <FormField label="Instrucciones"><textarea rows="4" value={form.instrucciones || ''} onChange={(event) => updateField('instrucciones', event.target.value)} /></FormField>
      <div className="card maintenance-form-section">
        <div className="section-title">
          <div>
            <h2>Checklist base</h2>
            <p className="muted">Se usará como plantilla al generar la OT.</p>
          </div>
          <button className="secondary-button" type="button" onClick={addChecklistItem}><Plus size={17} /> Añadir punto</button>
        </div>
        <div className="form-grid">
          {form.checklist_json.length === 0 && <p className="muted">Sin puntos definidos.</p>}
          {form.checklist_json.map((item, index) => (
            <div className="maintenance-checklist-row" key={item.id || index}>
              <input value={item.titulo || ''} onChange={(event) => updateChecklist(index, 'titulo', event.target.value)} placeholder="Título del punto" />
              <select value={item.tipo_respuesta || 'ok_no_ok'} onChange={(event) => updateChecklist(index, 'tipo_respuesta', event.target.value)}>
                {CHECKLIST_RESPONSE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <label className="checkbox-row"><input type="checkbox" checked={Boolean(item.obligatorio)} onChange={(event) => updateChecklist(index, 'obligatorio', event.target.checked)} /><span>Obligatorio</span></label>
              <label className="checkbox-row"><input type="checkbox" checked={Boolean(item.requiere_foto)} onChange={(event) => updateChecklist(index, 'requiere_foto', event.target.checked)} /><span>Foto</span></label>
              <button className="danger-button" type="button" onClick={() => removeChecklistItem(index)} title="Eliminar punto"><Trash2 size={16} /></button>
              <textarea rows="2" value={item.descripcion || ''} onChange={(event) => updateChecklist(index, 'descripcion', event.target.value)} placeholder="Descripción o instrucciones del punto" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid two">
        <label className="checkbox-row"><input type="checkbox" checked={Boolean(form.auto_generar_ot)} onChange={(event) => updateField('auto_generar_ot', event.target.checked)} /><span>Generación automática de OT</span></label>
        <label className="checkbox-row"><input type="checkbox" checked={Boolean(form.activo)} onChange={(event) => updateField('activo', event.target.checked)} /><span>Plan activo</span></label>
      </div>
      <div className="form-actions">
        {onCancel && <button className="ghost-button" type="button" onClick={onCancel}>Cancelar</button>}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar plan'}</button>
      </div>
    </form>
  );
}
