# Suite IsiVolt: modulos oficiales

## Vision general

IsiVolt debe funcionar como una suite de aplicaciones conectadas para mantenimiento, inspecciones, almacenes y servicios tecnicos.

La idea no es tener apps sueltas, sino varios modulos con una base comun:

```text
Clientes
Usuarios
Instalaciones
Ubicaciones
Activos
Fotos
Documentos
QR
Historial
Informes
Permisos
```

---

## Modulo 1: IsiVoltPro Activos QR

### Objetivo
Gestionar mantenimiento profesional de instalaciones, activos, ubicaciones, documentos, fotos, QR, incidencias, OT, checklist e informes.

### Flujo base

```text
Cliente
→ Instalacion
→ Ubicacion
→ Activo
→ Incidencia / OT
→ Checklist
→ Fotos
→ Materiales
→ Firma
→ Informe PDF
→ Historico
```

### Funciones clave

- Clientes e instalaciones.
- Ubicaciones y activos.
- QR por instalacion, ubicacion y activo.
- Documentos, fotos y videos.
- Incidencias.
- Ordenes de trabajo.
- Checklist por especialidad.
- Informes PDF.
- Historico completo.

---

## Modulo 2: IsiVolt Inspecciones Electricas

### Objetivo
Gestionar inspecciones electricas, preinspecciones, puntos ASOCAN/REBT, fotos, mediciones, defectos e informes.

### Flujo base

```text
Cliente
→ Instalacion inspeccionada
→ Datos generales
→ Reglamento aplicable
→ Bloques de inspeccion
→ Checklist normativo
→ Mediciones
→ Defectos
→ Fotos
→ Informe final
```

### Funciones clave

- REBT 1973 / REBT 2002.
- Guia ASOCAN y codigos de defecto.
- Bloques por tipo de instalacion.
- Mediciones de diferenciales.
- Resistencia de tierra.
- Alumbrado de emergencia.
- Fotos por bloque.
- Informe final con defectos DL/DG/DMG.
- Historico de inspecciones por instalacion.

### Conexion con Activos QR

Una instalacion inspeccionada puede convertirse en instalacion mantenida:

```text
Inspeccion electrica
→ genera defectos
→ crea tareas correctivas
→ genera OT en IsiVoltPro
→ queda historico en la instalacion
```

---

## Modulo 3: IsiVolt Almacen Control

### Objetivo
Controlar stock, materiales, herramientas, repuestos, entradas, salidas, ubicaciones de almacen y materiales usados en OT.

### Flujo base

```text
Almacen
→ Familias de material
→ Articulos
→ Stock
→ Entradas
→ Salidas
→ Asignacion a tecnico / OT
→ Reposicion
→ Historico
```

### Funciones clave

- Articulos por familia.
- Referencia interna.
- Proveedor.
- Stock minimo.
- Ubicacion en almacen.
- Precio aproximado.
- Entrada de material.
- Salida a OT.
- Salida a tecnico.
- Alerta de stock bajo.
- Inventario por QR.

### Conexion con Activos QR

Cuando una OT usa material:

```text
OT
→ selecciona material
→ descuenta stock
→ guarda material usado
→ queda en historico del activo
```

---

## Modulo 4: IsiVolt Servicios

### Objetivo
Marketplace de tecnicos verificados para trabajos puntuales de particulares, comunidades y pequenas empresas.

### Flujo base

```text
Cliente publica trabajo
→ Tecnicos cercanos lo ven
→ Envio de presupuesto
→ Cliente acepta
→ Chat
→ Trabajo realizado
→ Fotos antes/despues
→ Confirmacion
→ Valoracion
```

### Funciones clave

- Registro de cliente.
- Registro de tecnico.
- Tecnico verificado.
- Empresa o autonomo validado.
- Publicacion de trabajos.
- Busqueda por distancia.
- Ofertas y presupuestos.
- Chat.
- Fotos antes/despues.
- Valoraciones.
- Garantia.
- Pago seguro en fase avanzada.

### Conexion con Activos QR

Un trabajo puntual puede crear cliente recurrente:

```text
Trabajo realizado
→ justificante
→ historial
→ posible mantenimiento
→ alta en IsiVoltPro
```

---

## Base comun de todos los modulos

Todos los modulos deberian compartir:

- Usuarios.
- Roles y permisos.
- Clientes.
- Instalaciones.
- Fotos.
- Documentos.
- Informes PDF.
- QR.
- Auditoria.
- Notificaciones.
- Buscador global.

---

## Orden recomendado de desarrollo

### Fase 1
Estabilizar IsiVoltPro Activos QR:

- Build y despliegue.
- Clientes.
- Instalaciones.
- Ubicaciones.
- Activos.
- Fotos.
- Documentos.
- QR.

### Fase 2
Fortalecer mantenimiento:

- OT.
- Checklist.
- Fotos obligatorias.
- Materiales usados.
- Firma.
- Informes PDF.

### Fase 3
Conectar Almacen Control:

- Stock.
- Materiales.
- Entradas/salidas.
- Stock minimo.
- Material usado en OT.

### Fase 4
Conectar Inspecciones Electricas:

- Importar instalacion.
- Generar defectos.
- Crear tareas correctivas.
- Generar OT desde defectos.

### Fase 5
Crear IsiVolt Servicios MVP:

- Cliente publica trabajo.
- Tecnico envia presupuesto.
- Chat.
- Fotos.
- Valoracion.

---

## Objetivo final

Crear una plataforma donde una instalacion pueda tener todo su ciclo de vida:

```text
Alta inicial
→ Inspeccion
→ Documentacion
→ Activos
→ Mantenimiento
→ Almacen
→ Incidencias
→ OT
→ Informes
→ Servicios externos
→ Historico completo
```
