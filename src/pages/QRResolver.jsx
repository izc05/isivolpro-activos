import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveQr } from '../services/qrService';
import { logAudit } from '../services/auditService';

export default function QRResolver() {
  const { token } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function run() {
      try {
        const resolved = await resolveQr(token);
        if (!resolved) {
          navigate('/qr-no-valido', { replace: true });
          return;
        }
        const routeMap = {
          instalacion: `/instalaciones/${resolved.entity_id}`,
          ubicacion: `/ubicaciones/${resolved.entity_id}`,
          activo: `/activos/${resolved.entity_id}`,
          documento: `/documentos`
        };
        navigate(routeMap[resolved.entity_type] || '/qr-no-valido', { replace: true });
      } catch (error) {
        await logAudit({ tenantId: null, action: 'permission_denied', metadata: { reason: error.message } });
        navigate('/denegado', { replace: true });
      }
    }
    run();
  }, [token, navigate]);

  return <div className="center-screen">Comprobando permisos del QR...</div>;
}
