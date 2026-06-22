# Checklist antes de producción

## IsiVoltPro Activos QR

Lista de comprobación antes de presentar la aplicación a clientes reales o usarla comercialmente.

## Marca y repositorio

- [ ] Renombrar repositorio a `isivoltpro-activos`.
- [ ] Revisar nombre visible del proyecto.
- [ ] Añadir logo oficial.
- [ ] Añadir capturas de pantalla.
- [ ] Añadir vídeo corto de demostración.
- [ ] Añadir enlace de contacto.

## Seguridad

- [ ] Confirmar que no existe ninguna clave privada subida al repositorio.
- [ ] Confirmar que `.env` no está publicado.
- [ ] Confirmar que `.env.example` no contiene credenciales reales.
- [ ] Confirmar que no se usa `service_role_key` en frontend.
- [ ] Revisar todas las políticas RLS.
- [ ] Probar acceso con usuario admin.
- [ ] Probar acceso con usuario técnico.
- [ ] Probar acceso con usuario de solo lectura.
- [ ] Confirmar que un cliente no puede ver datos de otro cliente.
- [ ] Confirmar que Storage es privado.
- [ ] Confirmar que documentos y fotos se abren con URLs firmadas temporales.
- [ ] Desactivar modo demo en producción.

## Base de datos

- [ ] Revisar migraciones SQL.
- [ ] Crear datos de prueba realistas.
- [ ] Confirmar que los ejemplos demo cubren comunidad, clinica/residencia, activos criticos, documentos, incidencias, mantenimiento y OT.
- [ ] Confirmar que ningun ejemplo visible queda vacio sin accion, historial, documento o explicacion.
- [ ] Probar soft delete.
- [ ] Probar auditoría de accesos.
- [ ] Probar invitaciones de usuarios.
- [ ] Crear copia de seguridad inicial.

## Funcionalidad

- [ ] Crear instalación.
- [ ] Crear ubicación.
- [ ] Crear activo.
- [ ] Subir documento.
- [ ] Subir foto.
- [ ] Registrar incidencia.
- [ ] Registrar actuación o historial.
- [ ] Generar QR.
- [ ] Escanear QR desde móvil.
- [ ] Probar etiqueta NFC.

## Comercial

- [ ] Definir plan Demo.
- [ ] Definir plan Profesional.
- [ ] Definir plan Empresa.
- [ ] Preparar precio mensual/anual.
- [ ] Preparar contrato o condiciones de uso.
- [ ] Preparar política de privacidad definitiva.
- [ ] Preparar landing page.
- [ ] Preparar correo de contacto.

## Publicación

- [ ] Crear release `v0.1.0-demo`.
- [ ] Adjuntar APK o ZIP de la PWA.
- [ ] Añadir notas de versión.
- [ ] Probar descarga desde otro dispositivo.
- [ ] Probar instalación Android.
