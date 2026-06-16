# Roadmap

## IsiVoltPro Activos QR

Hoja de ruta inicial para convertir la aplicación en un producto profesional vendible.

## Fase 1 - Base técnica

- Estructura React + Vite.
- Integración con Supabase.
- Autenticación de usuarios.
- Base de datos con clientes, instalaciones, ubicaciones y activos.
- Storage privado para documentos, fotos y vídeos.
- Políticas RLS por `tenant_id`.
- Registro de auditoría.

## Fase 2 - Gestión funcional

- Alta y edición de instalaciones.
- Alta y edición de activos.
- Galería de imágenes por instalación y activo.
- Gestión de documentos técnicos.
- Registro de incidencias.
- Historial de mantenimiento.
- Buscador interno.
- Vista móvil optimizada para trabajo en campo.

## Fase 3 - QR y NFC

- Generación de códigos QR por instalación, ubicación y activo.
- Acceso mediante token opaco.
- Validación de permisos antes de mostrar información.
- Impresión por lotes de etiquetas QR.
- Compatibilidad con etiquetas NFC.

## Fase 4 - Seguridad y usuarios

- Invitaciones de usuarios.
- Roles por cliente.
- Confirmación de email.
- MFA para administradores.
- Revisión completa de políticas RLS.
- Eliminación o bloqueo del modo demo en producción.

## Fase 5 - Informes y comercialización

- Exportación de informes PDF.
- Panel de estado por cliente.
- Plan Demo.
- Plan Profesional.
- Landing page comercial.
- Manual de usuario.
- Vídeo demostrativo.
- Publicación de APK o PWA.

## Fase 6 - Ecosistema IsiVoltPro

- Módulo eléctrico.
- Módulo legionella.
- Módulo RITE.
- Módulo PCI.
- Módulo mantenimiento general.
