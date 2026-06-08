import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import FormField from '../components/Forms/FormField';
import { publicQrContext, submitPublicIncident } from '../services/qrService';

const emptyForm = {
  nombre: '',
  contacto: '',
  titulo: '',
  descripcion: '',
  prioridad: 'media'
};

export default function PublicIncidentReport() {
  const { token } = useParams();
  const [context, setContext] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
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

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await submitPublicIncident(token, form);
      setSent(true);
      setForm(emptyForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const targetName = [context?.installation_name, context?.location_name, context?.asset_name].filter(Boolean).join(' / ');

  return (
    <main className="public-report-page">
      <section className="public-report-hero">
        <div>
          <span className="brand-mark">IV</span>
          <h1>Aviso tecnico IsiVoltPro</h1>
          <p>Comunica una incidencia de esta instalacion sin acceder a documentacion privada.</p>
        </div>
      </section>

      <section className="public-report-panel">
        {loading && <p className="muted">Comprobando QR...</p>}

        {!loading && !context && (
          <div className="empty-state">
            <AlertTriangle size={24} />
            <strong>QR no valido o revocado</strong>
            <span>Comprueba que has escaneado el codigo correcto.</span>
          </div>
        )}

        {context && sent && (
          <div className="empty-state success-state">
            <CheckCircle2 size={28} />
            <strong>Aviso enviado</strong>
            <span>Gracias. El equipo autorizado revisara la incidencia. Para evitar duplicados, no se permite repetir avisos iguales en poco tiempo.</span>
            <Link className="ghost-button" to="/login">Acceso privado</Link>
          </div>
        )}

        {context && !sent && (
          <>
            <div className="public-target-card">
              <ShieldCheck size={22} />
              <div>
                <strong>{targetName || 'Elemento tecnico'}</strong>
                <span>Solo se enviara el aviso. No se muestran documentos, fotos privadas ni datos internos.</span>
              </div>
            </div>

            <form className="form-grid" onSubmit={submit}>
              <FormField label="Nombre">
                <input value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} maxLength={120} required />
              </FormField>
              <FormField label="Telefono o email de contacto">
                <input value={form.contacto} onChange={(event) => updateField('contacto', event.target.value)} maxLength={160} required />
              </FormField>
              <FormField label="Titulo del aviso">
                <input value={form.titulo} onChange={(event) => updateField('titulo', event.target.value)} maxLength={160} placeholder="Ej. No funciona la puerta del garaje" required />
              </FormField>
              <FormField label="Prioridad">
                <select value={form.prioridad} onChange={(event) => updateField('prioridad', event.target.value)}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </FormField>
              <FormField label="Descripcion">
                <textarea rows="5" value={form.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} maxLength={1200} placeholder="Cuenta que ocurre, desde cuando y cualquier detalle util." required />
              </FormField>
              <p className="muted">Para reducir spam, se limita el envio repetido desde el mismo contacto y QR durante 1 hora.</p>
              {error && <p className="error-text">{error}</p>}
              <button className="primary-button" disabled={submitting} type="submit">{submitting ? 'Enviando...' : 'Enviar aviso'}</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
