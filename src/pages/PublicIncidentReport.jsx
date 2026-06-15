import { AlertTriangle, CheckCircle2, ImagePlus, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import FormField from '../components/Forms/FormField';
import { publicQrContext, submitPublicIncident } from '../services/qrService';
import { MAX_INCIDENT_PHOTO_SIZE, validateIncidentPhotoFile } from '../services/incidentPhotoService';

const emptyForm = {
  nombre: '',
  contacto: '',
  titulo: '',
  descripcion: '',
  prioridad: 'media',
  foto: null,
  comentarioFoto: ''
};

export default function PublicIncidentReport() {
  const { token } = useParams();
  const [context, setContext] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sentInfo, setSentInfo] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    publicQrContext(token)
      .then((data) => {
        if (mounted) setContext(data);
      })
      .catch((err) => {
        if (mounted) setError(err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePhoto(file) {
    setError('');
    setPreview('');
    if (!file) {
      setForm((current) => ({ ...current, foto: null }));
      return;
    }
    try {
      validateIncidentPhotoFile(file);
      setForm((current) => ({ ...current, foto: file }));
      const url = URL.createObjectURL(file);
      setPreview(url);
    } catch (err) {
      setForm((current) => ({ ...current, foto: null }));
      setError(err.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await submitPublicIncident(token, form);
      setSentInfo(result);
      setForm(emptyForm);
      setPreview('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const targetName = [context?.installation_name, context?.location_name, context?.asset_name].filter(Boolean).join(' / ');
  const shortRef = sentInfo?.incidencia_id ? sentInfo.incidencia_id.slice(0, 8).toUpperCase() : '';

  return (
    <main className="public-report-page">
      <section className="public-report-hero">
        <div>
          <span className="brand-mark">IV</span>
          <h1>Aviso técnico IsiVoltPro</h1>
          <p>Comunica una incidencia de esta instalación sin acceder a documentación privada.</p>
        </div>
      </section>

      <section className="public-report-panel">
        {loading && <p className="muted">Comprobando QR...</p>}

        {!loading && !context && (
          <div className="empty-state">
            <AlertTriangle size={24} />
            <strong>QR no válido o revocado</strong>
            <span>Comprueba que has escaneado el código correcto.</span>
          </div>
        )}

        {context && sentInfo && (
          <div className="empty-state success-state">
            <CheckCircle2 size={28} />
            <strong>Aviso enviado</strong>
            <span>Referencia del aviso: {shortRef || 'registrada'}</span>
            <span>El equipo autorizado revisará la incidencia y, si procede, la convertirá en una orden de trabajo.</span>
            <Link className="ghost-button" to="/login">Acceso privado</Link>
          </div>
        )}

        {context && !sentInfo && (
          <>
            <div className="public-target-card">
              <ShieldCheck size={22} />
              <div>
                <strong>{targetName || 'Elemento técnico'}</strong>
                <span>Solo se enviará el aviso. No se muestran documentos, fotos privadas ni datos internos.</span>
              </div>
            </div>

            <form className="form-grid" onSubmit={submit}>
              <FormField label="Nombre">
                <input value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} maxLength={120} required />
              </FormField>
              <FormField label="Teléfono o email de contacto">
                <input value={form.contacto} onChange={(event) => updateField('contacto', event.target.value)} maxLength={160} required />
              </FormField>
              <FormField label="Título del aviso">
                <input value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} maxLength={160} placeholder="Ej. No funciona la puerta del garaje" required />
              </FormField>
              <FormField label="Prioridad">
                <select value={form.prioridad} onChange={(event) => updateField('prioridad', event.target.value)}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                  <option value="critica">Crítica</option>
                </select>
              </FormField>
              <FormField label="Descripción">
                <textarea rows="5" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} maxLength={1200} placeholder="Cuenta qué ocurre, desde cuándo y cualquier detalle útil." required />
              </FormField>
              <FormField label="Foto del problema opcional">
                <div className="incident-photo-picker">
                  <label className="secondary-button">
                    <ImagePlus size={18} /> Adjuntar foto
                    <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => updatePhoto(event.target.files?.[0] || null)} hidden />
                  </label>
                  <small className="muted">Máximo {Math.round(MAX_INCIDENT_PHOTO_SIZE / 1024 / 1024)} MB. JPG, PNG o WEBP.</small>
                </div>
              </FormField>
              {preview && <img className="incident-photo-preview" src={preview} alt="Vista previa de la incidencia" />}
              {form.foto && <FormField label="Comentario de la foto"><input value={form.comentarioFoto} onChange={(event) => updateField('comentarioFoto', event.target.value)} maxLength={160} placeholder="Ej. fuga debajo de la bomba" /></FormField>}
              <p className="muted">Para reducir duplicados, se limita el envío repetido desde el mismo contacto y QR durante 1 hora.</p>
              <p className="warning-text">Para emergencias o riesgos inmediatos, avisa también por el canal urgente establecido por la empresa o el centro.</p>
              {error && <p className="error-text">{error}</p>}
              <button className="primary-button" disabled={submitting} type="submit">{submitting ? 'Enviando...' : 'Enviar aviso'}</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
