# Plan final de pruebas FV

Objetivo: cerrar el ciclo completo de IsiVoltPro OT orientado a fotovoltaica.

## Escenario demo esperado

- Cliente: Comunidad Los Olivos.
- 2 instalaciones FV.
- 5 ubicaciones FV.
- 8 activos FV.
- 6 órdenes de trabajo FV:
  - FV-OT-001: asignada, lista para iniciar.
  - FV-OT-002: en curso, checklist parcial.
  - FV-OT-003: pendiente de material.
  - FV-OT-004: finalizada con errores para solicitar corrección.
  - FV-OT-005: finalizada y lista para validar.
  - FV-OT-006: validada, solo lectura.

## Pruebas obligatorias

### 1. Vista técnico móvil

1. Entrar en Mis OT.
2. Confirmar tarjetas: asignadas, en curso, corrección y pendiente material.
3. Abrir FV-OT-001.
4. Iniciar intervención.
5. Confirmar que no puede cerrar sin checklist, fotos, firma e informe.

### 2. Detalle técnico guiado

1. Revisar bloques: datos, QR, checklist, fotos, materiales, firma, informe y finalizar.
2. Confirmar mensajes de requisitos pendientes.
3. Generar informe PDF cuando corresponda.

### 3. Revisión administrativa

1. Abrir FV-OT-004.
2. Solicitar correcciones con nota obligatoria.
3. Confirmar que el técnico la ve como corrección.
4. Abrir FV-OT-005.
5. Validar OT.
6. Confirmar solo lectura.

### 4. Anulación OT

1. Intentar anular una OT activa.
2. Confirmar motivo obligatorio.
3. Confirmar auditoría.
4. Confirmar que no se puede anular validada/finalizada/cerrada/cancelada desde el listado.

### 5. Planificación preventiva FV

1. Abrir Mantenimiento > Planes.
2. Crear plan desde plantilla FV.
3. Generar actuación.
4. Intentar duplicar la actuación de la misma fecha.
5. Confirmar bloqueo de duplicado.

### 6. Dashboard y auditoría

1. Abrir Dashboard OT.
2. Filtrar FV abiertas, pendientes validar, vencidas y urgentes.
3. Abrir Auditoría.
4. Filtrar Solo OT.
5. Confirmar eventos de checklist, foto, material, firma, informe, corrección, validación y anulación.

## Criterio de cierre

El flujo se considera cerrado cuando se puede recorrer:

Plan preventivo FV → actuación programada → OT → intervención → informe PDF → revisión admin → validación → histórico/auditoría.

Sin duplicados, sin finalización manual saltándose requisitos y sin perder trazabilidad.
