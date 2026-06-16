# Seguridad

## IsiVoltPro Activos QR

Este documento resume las medidas de seguridad previstas para la aplicación y las recomendaciones antes de usarla en producción.

## Principios básicos

- No almacenar claves privadas en el frontend.
- No incluir `service_role_key` de Supabase en archivos públicos.
- Usar variables de entorno para credenciales.
- Mantener los buckets de documentos, fotos y vídeos como privados.
- Utilizar URLs firmadas temporales para acceder a documentos privados.
- Activar Row Level Security en todas las tablas públicas.
- Controlar el acceso por `tenant_id`, usuario y rol.
- Registrar acciones relevantes mediante auditoría.
- Revisar permisos antes de publicar una versión comercial.

## Roles recomendados

- `super_admin`: administración global del sistema.
- `admin_cliente`: administración de usuarios e instalaciones de su organización.
- `tecnico`: consulta y registro de trabajos, incidencias e historial.
- `cliente_lectura`: consulta limitada de información autorizada.

## Recomendaciones antes de producción

- Activar confirmación de email en Supabase Auth.
- Activar MFA para administradores y usuarios sensibles.
- Revisar las políticas RLS con datos reales de prueba.
- Comprobar que ningún documento privado queda expuesto públicamente.
- Comprobar que los QR/NFC solo contienen tokens opacos.
- Revisar las reglas de Storage.
- Verificar que el modo demo está desactivado.
- Hacer copia de seguridad periódica de la base de datos.

## Reporte de incidencias

Para comunicar una incidencia de seguridad:

📩 isivoltpro@gmail.com
