# Revision de ejemplos demo

## Estado revisado

Los ejemplos demo anteriores eran funcionales, pero demasiado escuetos: una sola instalacion, pocos activos y sin una historia clara para enseñar OT, mantenimiento e incidencias.

## Criterio de buen ejemplo

Un ejemplo esta completo cuando permite responder rapidamente:

- Donde ocurre: cliente, instalacion y ubicacion.
- Sobre que ocurre: activo, criticidad y estado.
- Que ha pasado: incidencia, revision, documento, foto o visita.
- Que toca hacer: fecha prevista, prioridad, proxima accion u OT.
- Que evidencia queda: checklist, fotos, firma, informe o historial.

## Ejemplos disponibles tras la revision

### Comunidad Los Olivos

Uso recomendado: inventario base, QR, documentos e incidencia preventiva.

Incluye:

- Garaje comunitario.
- Cuarto electrico.
- Cuadro general, bomba de achique y grupo de presion.
- Documentos de esquema/manual/OCA.
- Historial de revision y mantenimiento.
- Incidencia preventiva abierta.

### Clinica San Rafael Demo

Uso recomendado: activos criticos y mantenimiento tecnico serio.

Incluye:

- Centro sanitario.
- Sala PCI.
- Bomba PCI demo y cuadro general BT demo.
- Procedimiento tecnico y video de prueba.
- Historial de prueba mensual.

### Residencia Virgen del Carmen Demo

Uso recomendado: ejemplo de mantenimiento preventivo y aviso operativo.

Incluye:

- Residencia.
- Sala de produccion ACS.
- Activo de produccion ACS.
- Checklist tecnico asociado como documento.
- Incidencia urgente en curso por temperatura irregular.

## Pendiente recomendado

Para que la demo de OT quede completamente redonda en base de datos, conviene sembrar tambien:

- Una OT `ASIGNADA` para ver agenda y tecnico pendiente.
- Una OT `EN_CURSO` con visita abierta.
- Una OT `FINALIZADA` con checklist, fotos, materiales y firma.
- Un informe PDF guardado en `ot_informes`.

No se ha sembrado aqui porque la creacion de tablas OT no esta completa en los SQL visibles del repositorio. Debe sincronizarse con el esquema real de Supabase antes de añadir inserts directos sobre `ordenes_trabajo` y tablas hijas.
