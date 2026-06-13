# Auditoria OT IsiVoltPro

Fecha: 2026-06-12
Rama revisada: `mejora-flujo-ot-v1`

## 1. Flujo actual

El modulo actual permite crear ordenes de trabajo desde `Ordenes de trabajo`, asignarlas a un tecnico, iniciar una visita, completar un checklist, subir fotos por punto, capturar firma de cliente y generar un PDF.

El flujo real es:

1. Admin crea OT en `WorkOrders.jsx`.
2. Se genera un checklist base segun `tipo`.
3. Tecnico ve sus OT en `MyWorkOrders.jsx`.
4. Tecnico abre `WorkOrderVisit.jsx` e inicia una visita.
5. Checklist y fotos se registran en `WorkOrderChecklist.jsx`.
6. Firma cliente se guarda desde `WorkOrderSignature.jsx`.
7. PDF se genera desde `WorkOrderReport.jsx`.

## 2. Archivos utilizados

- `src/pages/WorkOrders.jsx`
- `src/pages/MyWorkOrders.jsx`
- `src/pages/WorkOrderDetail.jsx`
- `src/pages/WorkOrderVisit.jsx`
- `src/pages/WorkOrderChecklist.jsx`
- `src/pages/WorkOrderSignature.jsx`
- `src/pages/WorkOrderReport.jsx`
- `src/pages/WorkOrderDashboard.jsx`
- `src/services/workOrderService.js`
- `src/services/workOrderSignatureService.js`
- `src/services/workOrderPdfService.js`
- `src/services/fileService.js`
- `src/services/auditService.js`
- `src/services/qrService.js`
- `src/App.jsx`
- `supabase/sql/20260610_work_orders_v1.sql`

## 3. Tablas implicadas

- `ordenes_trabajo`
- `ot_visitas`
- `ot_checklist_respuestas`
- `ot_fotos`
- `ot_informes`
- `instalaciones`
- `ubicaciones`
- `activos`
- `documentos`
- `fotos`
- `videos`
- `historial_mantenimiento`
- `incidencias`
- `qr_registry`
- `audit_logs`
- `tenant_members`
- `profiles`

## 4. Estados actuales

Estados existentes de OT:

- `BORRADOR`
- `ASIGNADA`
- `ACEPTADA`
- `EN_CURSO`
- `PENDIENTE_MATERIAL`
- `PENDIENTE_CLIENTE`
- `FINALIZADA`
- `FIRMADA`
- `INFORME_GENERADO`
- `CERRADA`
- `CANCELADA`

La UI actual permitia mostrar todos los estados como botones en el detalle. Esto es riesgoso porque salta transiciones y mezcla estado principal con hitos secundarios como firma e informe.

## 5. Permisos actuales

RLS V1:

- `ordenes_trabajo`: select para miembros activos del tenant; insert/update para `admin_cliente`, `tecnico` o asignado.
- `ot_visitas`, `ot_checklist_respuestas`, `ot_fotos`, `ot_informes`: politica generica `for all` para cualquier miembro activo del tenant.
- Storage privado se valida por rutas con `tenant_id`.

Riesgo: las tablas hijas de OT no diferencian bien admin, tecnico asignado, creador o OT cerrada.

## 6. Problemas detectados

- `tipo` de OT esta limitado a seis valores, orientados a averia/mantenimiento.
- No existe `tipo_visita`.
- No hay configuracion dinamica por OT para decidir checklist, fotos, firmas, materiales, mediciones, informe, revision admin o QR.
- No existe snapshot completo de requisitos de cierre.
- No existe tabla de materiales de visita.
- La finalizacion de visita solo marca `FINALIZADA`.
- No hay resultado de cierre guiado: pendiente material, pendiente cliente, otra visita, no realizada.
- No hay inmutabilidad fuerte para OT cerrada.
- Firma solo cubre cliente/responsable; no separa firma tecnico.
- QR resuelve fichas, pero no verifica explicitamente contra una OT activa.
- Checklist es funcional, pero aun bastante rigido.
- PDF no incluye campos especificos de tipos de actuacion ni materiales.

## 7. Riesgos

- Cambiar checks de `tipo` sin migracion romperia inserts.
- Forzar nuevos requisitos sin valores por defecto bloquearia OT existentes.
- Convertir `FIRMADA` e `INFORME_GENERADO` a indicadores secundarios requiere migracion y compatibilidad historica; de momento deben mantenerse.
- Endurecer RLS demasiado pronto puede bloquear tecnicos externos si no estan bien modelados en `tenant_members`.

## 8. Funciones reutilizables

- `listWorkOrders`, `getWorkOrder`, `createWorkOrder`.
- `startWorkOrderVisit`, `finishWorkOrderVisit`.
- `ensureDefaultChecklist`, `createChecklistItem`, `updateChecklistItem`.
- `uploadChecklistPhoto` y signed URLs.
- `uploadVisitSignature`.
- `generateWorkOrderPdfBlob` y `generateAndUploadWorkOrderPdf`.
- `resolveQr` y `logAudit`.

## 9. Cambios necesarios

- Ampliar modelo con `tipo_ot`, `tipo_ot_detalle`, `configuracion`, campos de definicion del trabajo y requisitos de cierre.
- Ampliar visitas con `tipo_visita`, resultado de cierre, estado final del activo, proximas acciones y metadatos de dispositivo.
- Crear `ot_visita_materiales`.
- Crear tabla o estructura de tipos configurables. Para esta fase se propone `ot_tipos_actuacion` y valores por defecto por tenant.
- Hacer que la UI muestre solo acciones validas.
- Bloquear edicion de OT cerrada en servicios y RLS.
- Mejorar experiencia movil de "Mis OT" y visita.

## 10. Migraciones propuestas

Se crea `supabase/sql/20260612_work_orders_configurable_v2.sql`.

Efecto:

- Relaja el check de `ordenes_trabajo.tipo` y permite nuevos tipos.
- Anade columnas JSON/configuracion y campos de trabajo.
- Anade campos de visita para tipo, resultado, estado de activo y dispositivo.
- Crea tabla `ot_tipos_actuacion`.
- Crea tabla `ot_visita_materiales`.
- Refuerza RLS basica por tenant.
- Anade trigger para impedir modificaciones normales en OT cerradas salvo reapertura autorizada.

No se aplica automaticamente en remoto.

## 11. Plan de implementacion por fases

Fase 1:

- Modelo configurable compatible.
- Formulario admin guiado.
- Tipos amplios de OT/visita.
- Requisitos de cierre por OT.
- Visita con finalizacion guiada.
- Materiales no catalogados o vinculados a inventario futuro.

Fase 2:

- Plantillas de checklist persistentes y snapshot completo.
- Verificacion QR dentro de OT.
- Revision admin formal y solicitud de correcciones.
- Firmas separadas tecnico/cliente.
- PDF enriquecido.

Fase 3:

- Inventario real con movimientos de stock.
- Notificaciones.
- Offline/autoguardado robusto.
- Paneles de metricas y SLAs.
