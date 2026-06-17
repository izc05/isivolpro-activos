# Roadmap oficial: ecosistema IsiVolt

## Vision

IsiVolt debe crecer como una suite profesional para mantenimiento, instalaciones y servicios tecnicos.

El ecosistema se divide en dos lineas:

1. **IsiVoltPro Activos QR**
   - Gestion interna de clientes, instalaciones, ubicaciones, activos, QR, documentos, fotos, OT, checklist, historico e informes.

2. **IsiVolt Servicios**
   - Marketplace de tecnicos verificados para particulares, comunidades y pequenas empresas.
   - Modelo tipo anuncio/oferta, pero con control legal, verificacion, presupuesto, fotos, garantia e historial.

---

## Producto 1: IsiVoltPro Activos QR

### Objetivo
Crear la mejor app de mantenimiento tecnico para empresas, comunidades, residencias, clinicas y servicios de mantenimiento.

### Flujo principal

```text
Cliente
→ Instalaciones
→ Ubicaciones
→ Activos
→ Documentos / fotos / videos / QR
→ Incidencias
→ Ordenes de trabajo
→ Checklist
→ Materiales
→ Firma
→ Informe PDF
→ Historico
```

### Prioridades inmediatas

1. Despliegue estable en GitHub Pages.
2. Pantalla Clientes separada de Dashboard.
3. Pantalla Instalaciones filtrada por cliente activo.
4. Fotos sin duplicados.
5. Selector superior estable: Cliente activo / Instalacion activa.
6. Vista movil clara para tecnicos.

### Funciones clave

- Cliente con logo/foto, datos y estado.
- Instalacion con foto principal, direccion, tipo y estado.
- Ubicaciones por instalacion.
- Activos con ficha 360 grados.
- QR por instalacion, ubicacion y activo.
- Documentos y fotos asociados a cada entidad.
- Incidencias internas y desde QR publico.
- OT con visitas, fotos, materiales, checklist y firma.
- Acta final PDF.
- Historico completo por activo.

### Ficha 360 de activo

Cada activo debe tener:

- Foto principal.
- Datos tecnicos.
- Cliente e instalacion.
- Ubicacion.
- QR.
- Documentos.
- Fotos.
- Ultimas OT.
- Incidencias.
- Materiales usados.
- Preventivos.
- Historico.
- Boton crear OT.
- Boton crear incidencia.

### Checklist por especialidad

Crear plantillas para:

- Electricidad.
- Cuadros electricos.
- SAI.
- Climatizacion.
- ACS.
- Grupo de presion.
- PCI.
- BIE / extintores / central de alarma.
- Legionella.
- RITE.
- Residencias.
- Clinicas / zonas sanitarias.

Cada punto debe permitir:

- OK / No OK / No aplica.
- Foto obligatoria.
- Medicion.
- Observacion.
- Defecto.
- Accion realizada.
- Material usado.

### Informes PDF

Tipos de informes:

- Informe cliente.
- Informe interno.
- Acta final de OT.
- Informe de preventivo.
- Historico del activo.

El PDF debe incluir:

- Logo.
- Cliente.
- Instalacion.
- Activo.
- Tecnico.
- Fecha.
- Trabajo realizado.
- Checklist.
- Fotos antes/despues.
- Materiales.
- Firma.
- Conclusion.

---

## Producto 2: IsiVolt Servicios

### Objetivo
Crear un marketplace serio de tecnicos verificados, no una app de chapuzas.

El cliente publica un trabajo y tecnicos registrados pueden enviar presupuesto.

### Flujo del cliente

```text
Publicar trabajo
→ Categoria
→ Descripcion
→ Fotos
→ Ubicacion aproximada
→ Urgencia
→ Presupuesto orientativo
→ Recibir ofertas
→ Aceptar presupuesto
→ Chat con tecnico
→ Trabajo realizado
→ Fotos antes/despues
→ Confirmar trabajo
→ Valoracion
```

### Flujo del tecnico

```text
Registro verificado
→ Especialidades
→ Zona de trabajo
→ Ver trabajos cercanos
→ Enviar presupuesto
→ Cliente acepta
→ Ejecutar trabajo
→ Subir fotos
→ Finalizar
→ Cobrar
→ Recibir valoracion
```

### Verificacion de tecnicos

Requisitos:

- Identidad verificada.
- Telefono y email verificados.
- Alta de autonomo o empresa, cuando aplique.
- Seguro de responsabilidad civil, cuando aplique.
- Certificados/carnes por especialidad.
- Especialidades declaradas.
- Zona de trabajo.
- Historial y valoraciones.

### Verificacion de clientes

- Email y telefono verificados.
- Direccion exacta solo al aceptar presupuesto.
- Historial de trabajos.
- Valoracion como cliente.
- Sistema de denuncia y bloqueo.

### Categorias iniciales

- Electricidad.
- Fontaneria.
- Climatizacion.
- Montaje.
- Persianas/motores.
- Antenas/telecomunicaciones.
- Pequenas reparaciones.

### Control legal

La app debe distinguir:

- Trabajo simple.
- Trabajo que puede requerir instalador habilitado.
- Trabajo que puede requerir certificado.
- Trabajo que debe realizar empresa autorizada.

Ejemplos:

- Instalar ventilador: trabajo simple si no modifica instalacion fija compleja.
- Nueva linea desde cuadro: requiere tecnico/empresa habilitada.
- IRVE: requiere cumplimiento normativo especifico.
- Modificar cuadro: requiere empresa instaladora habilitada.

### Ofertas y presupuestos

Cada tecnico debe poder enviar:

- Precio de mano de obra.
- Desplazamiento.
- Material incluido o no incluido.
- Tiempo estimado.
- Disponibilidad.
- Garantia ofrecida.
- Mensaje al cliente.

### Pago y confianza

Modelo recomendado:

- Cliente acepta presupuesto.
- Pago retenido o reserva.
- Tecnico realiza trabajo.
- Cliente confirma.
- Se libera pago.
- En caso de conflicto se revisan fotos, chat y presupuesto.

### Valoraciones

No solo estrellas. Valorar:

- Puntualidad.
- Limpieza.
- Calidad.
- Comunicacion.
- Precio correcto.
- Trabajo documentado.
- Cancelaciones.

### Badges

- Tecnico verificado.
- Empresa verificada.
- Instalador BT.
- Seguro validado.
- Top puntualidad.
- Especialista en climatizacion.
- Especialista en electricidad.

---

## Conexion entre ambos productos

IsiVolt Servicios puede alimentar IsiVoltPro:

```text
Trabajo realizado en marketplace
→ se crea historial
→ se guardan fotos
→ se genera justificante
→ se ofrece mantenimiento
→ se puede crear cliente/instalacion en IsiVoltPro
```

Esto permite convertir trabajos puntuales en clientes recurrentes.

---

## Prioridad de desarrollo

### Fase 1: estabilizar IsiVoltPro

- Build y despliegue estable.
- Clientes distinto de Dashboard.
- Instalaciones limpias.
- Fotos ordenadas.
- Flujo Cliente → Instalacion → Ubicacion → Activo.

### Fase 2: mantenimiento profesional

- Ficha 360 de activo.
- OT potente.
- Checklist por especialidad.
- Fotos obligatorias.
- PDF profesional.
- Historico.

### Fase 3: producto vendible

- Roles.
- Plan demo/pro.
- Logo cliente.
- Informes descargables.
- Preventivo automatico.
- Dashboard jefe mantenimiento.

### Fase 4: IsiVolt Servicios MVP

- Registro cliente.
- Registro tecnico.
- Publicar trabajo.
- Buscar trabajos por zona.
- Enviar presupuesto.
- Aceptar presupuesto.
- Chat.
- Fotos antes/despues.
- Finalizar trabajo.
- Valoracion.

### Fase 5: funciones premium

- Pago seguro.
- Verificacion avanzada.
- IA para describir averias desde foto.
- Presupuesto orientativo automatico.
- Ranking de tecnicos.
- Agenda.
- Integracion completa con IsiVoltPro.
