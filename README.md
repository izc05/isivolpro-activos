# IsiVoltPro Activos QR

Aplicacion profesional para documentacion tecnica y mantenimiento mediante QR/NFC. El QR solo contiene un token opaco, la app resuelve el recurso internamente y Supabase valida permisos mediante RLS antes de mostrar datos.

## Stack tecnico

- React + Vite
- Capacitor para APK Android
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage privado
- Row Level Security en tablas publicas
- URLs firmadas temporales para documentos privados
- Auditoria de accesos y acciones

## Instalacion

```bash
npm install
cp .env.example .env
npm run dev
```

Completa `.env`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ENABLE_DEMO_SIGNUP=false
```

No pongas `service_role_key` en el frontend.

## Configuracion Supabase

Ejecuta los SQL en este orden desde SQL Editor o migraciones:

1. `src/sql/001_schema.sql`
2. `src/sql/002_rls_policies.sql`
3. `src/sql/003_storage_policies.sql`
4. `src/sql/004_seed_demo.sql` opcional
5. `src/sql/005_demo_signup.sql` opcional solo para registro demo
6. `src/sql/006_installation_location_images.sql` si ya habias creado la base antes de anadir imagenes
7. `src/sql/020_asset_images.sql` si ya habias creado la base antes de anadir imagenes a activos

El seed crea datos demo sin usuarios. Para probar con un usuario real:

1. Crea usuario en Supabase Auth.
2. Inserta su fila en `profiles`.
3. Asignalo a `tenant_members` con rol `admin_cliente`, `tecnico` o `cliente_lectura`.

## RLS y seguridad

- Todas las tablas publicas tienen RLS activado.
- El acceso se controla por `tenant_id`.
- `super_admin` puede ver todo mediante `profiles.global_role`.
- `admin_cliente` gestiona su tenant.
- `tecnico` puede consultar y crear historial/incidencias dentro de su tenant.
- `cliente_lectura` solo debe consultar informacion visible para cliente.
- Los registros importantes usan `deleted_at` para soft delete.
- Los buckets `documents-private`, `photos-private` y `videos-private` no son publicos.
- Storage exige rutas con `tenant_id` como primer segmento.
- Los documentos se abren con `createSignedUrl`, nunca con URLs publicas permanentes.
- Las acciones importantes llaman a `auditService.logAudit()`.
- MFA queda preparado con `profiles.mfa_required`; activa factores desde Supabase Auth antes de produccion.
- Las invitaciones se gestionan con `tenant_invitations` y RPCs `create_tenant_invitation` / `accept_tenant_invitation`.
- El token de invitacion solo se muestra una vez; en base de datos se guarda `token_hash`, no el token en claro.
- La aceptacion de invitacion comprueba usuario autenticado, email coincidente, estado pendiente y caducidad.

## Invitaciones y usuarios

Desde `Usuarios y permisos`, un `admin_cliente` o `super_admin` puede:

- Crear invitaciones temporales por email.
- Elegir rol `admin_cliente`, `tecnico` o `cliente_lectura`.
- Marcar MFA requerido para administradores o usuarios sensibles.
- Revocar invitaciones pendientes.
- Cambiar rol o estado de miembros existentes.

La pantalla `/registro` permite crear cuenta con Supabase Auth y aceptar el token. Si tu proyecto Supabase exige confirmacion de email, el usuario debe confirmar el correo y volver a aceptar la invitacion autenticado.

## Registro demo

Para desarrollo puedes activar un registro rapido:

```bash
VITE_ENABLE_DEMO_SIGNUP=true
```

Requisitos:

- Ejecutar `004_seed_demo.sql`.
- Ejecutar `005_demo_signup.sql`.

Con esto, `/registro` muestra `Usuario demo` y asigna el usuario autenticado al tenant `Comunidad Los Olivos` como `admin_cliente`. No uses este helper en produccion.

## Ejecutar en desarrollo

```bash
npm run dev
```

## Build

```bash
npm run build
```

## APK Android con Capacitor

```bash
npm run build
npm run android:add
npm run android:sync
npm run android:open
```

Desde Android Studio compila el APK. Revisa permisos de camara para el escaner QR.

## Estructura

```text
src/
  components/
    Layout/
    Cards/
    Forms/
    QR/
    Files/
    Security/
  hooks/
  pages/
  services/
  sql/
  styles/
  utils/
```

## Datos demo

`004_seed_demo.sql` crea:

- Cliente: Comunidad Los Olivos
- Instalacion: Garaje Comunidad Los Olivos
- Ubicacion: Cuarto electrico
- Activos: Cuadro general garaje, Bomba achique garaje y Grupo presion agua
- Documentos con metadatos, historial, incidencias y video externo demo

## Proximos pasos

- Implementar invitaciones reales de usuario con backend seguro o Edge Functions.
- Completar formularios CRUD con soft delete.
- Anadir imagenes a activos y galerias visuales por instalacion.
- Crear Edge Function para emitir signed URLs con comprobaciones adicionales por documento.
- Completar PDF imprimible por lotes de QR.
- Activar MFA obligatorio para administradores.
- Anadir cola offline persistente y sincronizacion controlada.
