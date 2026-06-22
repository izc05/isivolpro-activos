# Guion de demostracion

## Objetivo

Este guion sirve para enseñar IsiVoltPro Activos QR con ejemplos completos, claros y visuales. La demo debe transmitir tres ideas: el tecnico encuentra informacion rapido, el administrador controla la trazabilidad y el cliente ve un resultado profesional.

## Escenario demo recomendado

Cliente activo: `Comunidad Los Olivos`.

Instalaciones de ejemplo:

- `Garaje Comunidad Los Olivos`: inventario base, QR, documentos e incidencia preventiva.
- `Clinica San Rafael Demo`: activos criticos de PCI y baja tension.
- `Residencia Virgen del Carmen Demo`: mantenimiento preventivo de ACS y ejemplo de incidencia en curso.

Activos clave:

- `Bomba achique garaje`: activo con revision proxima y prioridad alta.
- `Bomba PCI demo`: activo critico con procedimiento tecnico.
- `Produccion ACS demo`: activo pendiente, ideal para explicar OT, checklist, fotos, firma e informe.

## Flujo de venta

### 1. Contexto

Explicar el problema: documentacion repartida entre papeles, correos, fotos de movil y partes de trabajo. El valor de la aplicacion es ordenar ese caos alrededor de instalaciones, ubicaciones, activos y OT.

### 2. Inventario

Abrir `Instalaciones`, entrar en una instalacion y mostrar:

- Imagen o contexto visual de la instalacion.
- Ubicaciones internas.
- Activos con criticidad, estado y proxima revision.
- Documentos asociados al activo o instalacion.

El ejemplo debe sentirse real: nombre reconocible, activo concreto, estado tecnico y siguiente accion.

### 3. QR

Abrir `Generador QR` y enseñar que se puede generar QR por instalacion, ubicacion o activo.

Mensaje clave: el QR no contiene datos sensibles; solo apunta a un recurso protegido por permisos.

### 4. Incidencias

Abrir `Incidencias` y mostrar una incidencia ya creada. Despues explicar que puede convertirse en OT para que no se quede como aviso suelto.

Ejemplo recomendado: `Temperatura ACS irregular`.

### 5. OT

Abrir el bloque OT en este orden:

1. `Dashboard OT`: vision global sin depender del cliente o instalacion seleccionada.
2. `Agenda OT`: planificacion por calendario.
3. `Todas las OT`: listado operativo.
4. Detalle de una OT: estado, activo, instalacion, tecnico, requisitos.
5. `Checklist`: puntos, observaciones y fotos.
6. `Firma cliente`.
7. `Informe PDF`.

Mensaje clave: la OT no es solo un parte; es un expediente tecnico completo.

### 6. Mantenimiento

Abrir `Panel mantenimiento` y explicar la diferencia:

- Plan de mantenimiento: que toca hacer.
- Mantenimiento programado: cuando toca hacerlo.
- OT: ejecucion real.
- Historial: resultado consolidado.

### 7. Cierre

Cerrar con una frase simple: IsiVoltPro reduce busquedas, mejora evidencias y deja un historico tecnico ordenado por instalacion y activo.

## Checklist de calidad de cada ejemplo

Antes de enseñar una pantalla, confirmar:

- Tiene un nombre realista, no generico.
- Tiene una instalacion y ubicacion asociadas.
- Tiene un activo concreto cuando aplica.
- Tiene estado, prioridad o criticidad visibles.
- Tiene siguiente accion o fecha prevista.
- Tiene al menos un documento, foto, historial, incidencia u OT relacionada.
- No muestra cajas vacias sin explicacion.
- No depende de datos de otro cliente para entenderse.

## Preguntas frecuentes

### El cliente puede ver todo?

No necesariamente. La visibilidad depende del rol y de los permisos.

### El QR contiene documentos?

No. El QR identifica el recurso; los documentos y fotos se sirven desde Storage privado con control de permisos.

### Se puede usar con NFC?

Si. El mismo enlace del QR puede grabarse en una etiqueta NFC.

### Se puede personalizar?

Si. El modelo encaja con mantenimiento electrico, climatizacion, PCI, ACS, comunidades, hospitales, residencias o empresas multisede.
