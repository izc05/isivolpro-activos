# Bloque Control OCA

El Bloque Control OCA es el calendario, archivo documental e historial de cumplimiento reglamentario por instalación. No realiza técnicamente inspecciones OCA ni genera actas oficiales.

## Alcance

Incluye:

- Control de última y próxima inspección.
- Resultado, organismo, expediente y número de acta.
- Documentación vinculada reutilizando `documentos`.
- Incidencias OCA y defectos detectados.
- Relación con OT de subsanación.
- Vencimientos próximos o vencidos.
- Historial por control e instalación.

Queda fuera:

- Checklist reglamentario avanzado.
- Motor de normativa.
- Generación de actas oficiales.
- Gestión avanzada de organismos acreditados.

## Tablas

- `controles_oca`: control reglamentario por instalación, con ubicación o activo opcional.
- `inspecciones_oca`: inspecciones realizadas o programadas.
- `incidencias_oca`: defectos o incidencias detectadas.
- `incidencia_oca_ot`: relación entre incidencias OCA y órdenes de trabajo.
- `oca_documentos`: vínculo con documentos existentes.

## Flujo

1. Crear o seleccionar un control OCA.
2. Registrar inspección.
3. Calcular o introducir manualmente la próxima fecha.
4. Subir o vincular acta/documentación.
5. Crear incidencias si existen defectos.
6. Generar OT correctiva desde la incidencia.
7. Cerrar la OT técnica.
8. Marcar incidencia como subsanada o pendiente de verificación.
9. Verificar incidencia.
10. Registrar segunda visita o nueva inspección cuando corresponda.

El cierre de la OT no verifica automáticamente la incidencia OCA.

## Permisos

La migración aplica RLS por `tenant_id`:

- `admin_cliente`: gestión completa.
- `tecnico`: puede consultar y gestionar controles/incidencias/documentos dentro del tenant.
- `cliente_lectura`: consulta mediante `has_tenant_access`, sin políticas de escritura.

Las capacidades frontend preparadas son:

- `oca_view`
- `oca_create`
- `oca_edit`
- `oca_manage_documents`
- `oca_manage_incidents`
- `oca_create_work_order`
- `oca_verify_incident`
- `oca_close`

## Orden de ejecución SQL

Aplicar después de todo el esquema base y del Bloque Mantenimiento:

1. `src/sql/000_run_all_setup_demo.sql`, si es una instalación nueva.
2. Migraciones existentes en orden numérico hasta `030_bloque_mantenimiento.sql`.
3. `src/sql/031_bloque_control_oca.sql`.

No modifica migraciones anteriores.
