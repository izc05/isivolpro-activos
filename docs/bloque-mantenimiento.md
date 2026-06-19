# Bloque Mantenimiento

El bloque separa tres responsabilidades:

- Plan de mantenimiento: define qué debe hacerse sobre un activo.
- Mantenimiento programado: define cuándo debe hacerse y controla su estado.
- Orden de trabajo: ejecuta la intervención con técnico, visitas, checklist, fotos, materiales, firma e informe.
- Historial técnico: conserva el resultado definitivo de la intervención.

No incluye OCA, inspecciones reglamentarias, actas oficiales, defectos legales ni expedientes administrativos.

## Tablas

`planes_mantenimiento`

Guarda periodicidad, próxima fecha, checklist base, responsable, instrucciones, materiales previstos, herramientas, estado activo/inactivo y generación automática de OT.

`mantenimientos_programados`

Guarda cada actuación concreta: fecha programada, límite, prioridad, estado, origen, técnico asignado, incidencia vinculada y OT vinculada. La restricción `uq_mantenimientos_programados_plan_fecha` evita duplicar el mismo plan en la misma fecha.

`historial_mantenimiento`

Se amplía sin borrar columnas existentes. Añade vínculos a plan, mantenimiento programado, OT e incidencia; trabajo previsto/realizado; resultado; causa/solución; estado anterior/final del activo; parada, costes, garantía y próxima acción.

## Flujo preventivo

1. Crear o editar un plan en `/mantenimiento/planes`.
2. Calcular `fecha_proxima_realizacion`.
3. Generar una actuación en `mantenimientos_programados`.
4. Generar una OT desde calendario, pendientes o detalle del plan.
5. Ejecutar la OT en el bloque OT.
6. Al cerrar la OT, usar `closeMaintenanceFromWorkOrder` para crear o actualizar historial, completar el programado, actualizar activo, recalcular el plan y generar solo la siguiente actuación.

## Flujo correctivo

1. Registrar avería desde `/mantenimiento/correctivos`, desde una incidencia o desde la ficha del activo.
2. Crear un `mantenimientos_programados` de tipo `correctivo`.
3. Generar una OT correctiva.
4. Ejecutar y cerrar la OT.
5. Consolidar el resultado en `historial_mantenimiento`.

## Orden de migraciones

Ejecutar todas las migraciones previas del repositorio y después:

`src/sql/030_bloque_mantenimiento.sql`

La migración depende de tablas existentes: `tenants`, `profiles`, `instalaciones`, `ubicaciones`, `activos`, `incidencias`, `ordenes_trabajo` e `historial_mantenimiento`.
