import { logAudit } from './auditService';
import { createWorkOrder, seedChecklist } from './workOrderService';
import { supabase } from './supabaseClient';

const FV_BASE_REQUIREMENTS = {
  requiere_checklist: true,
  requiere_fotos_iniciales: false,
  requiere_fotos_finales: true,
  requiere_verificacion_qr: true,
  requiere_mediciones: true,
  requiere_materiales: false,
  requiere_firma_tecnico: true,
  requiere_firma_cliente: false,
  requiere_informe: true,
  requiere_revision_admin: true,
  requiere_geolocalizacion: false,
  requiere_fecha_prevista: true,
  requiere_tiempo_empleado: true,
  requiere_valoracion_economica: false,
  requiere_documentacion_adjunta: false,
  requiere_prueba_funcional_final: true
};

function item(punto, descripcion, options = {}) {
  return {
    punto: String(punto),
    descripcion,
    obligatorio: options.obligatorio !== false,
    requiere_foto: Boolean(options.requiere_foto),
    tipo_respuesta: options.tipo_respuesta || 'ok_no_ok',
    unidad: options.unidad || null,
    valor_minimo: options.valor_minimo ?? null,
    valor_maximo: options.valor_maximo ?? null
  };
}

export const FV_WORK_ORDER_TEMPLATES = [
  {
    key: 'fv_revision_inversor',
    nombre: 'Revisión preventiva inversor FV',
    descripcion: 'Revisión de alarmas, ventilación, conexiones, producción, comunicaciones y estado general del inversor fotovoltaico.',
    tipo_ot: 'mantenimiento_preventivo',
    prioridad: 'normal',
    periodicidad: 'trimestral',
    tipo_activo_recomendado: 'inversor_fotovoltaico',
    titulo: 'Revisión preventiva inversor FV',
    trabajo_solicitado: 'Realizar revisión preventiva del inversor FV, comprobar alarmas, ventilación, comunicaciones y producción.',
    instrucciones_tecnico: 'Registrar fotos del equipo, comprobar display/app de monitorización, revisar ventilación, conexiones accesibles y alarmas activas.',
    resultado_esperado: 'Inversor revisado, sin alarmas críticas y con producción/estado documentado.',
    configuracion: { ...FV_BASE_REQUIREMENTS },
    items: [
      item(1, 'Comprobar acceso seguro y ausencia de riesgos en sala/armario del inversor', { requiere_foto: true }),
      item(2, 'Identificar inversor, marca, modelo y número de serie', { requiere_foto: true }),
      item(3, 'Comprobar ausencia de alarmas activas en display o monitorización', { requiere_foto: true }),
      item(4, 'Revisar ventilación, filtros, limpieza y temperatura del equipo'),
      item(5, 'Registrar tensión AC de salida del inversor', { tipo_respuesta: 'medicion', unidad: 'V', valor_minimo: 360, valor_maximo: 430 }),
      item(6, 'Registrar potencia instantánea o estado de producción', { tipo_respuesta: 'medicion', unidad: 'kW' }),
      item(7, 'Comprobar comunicaciones y monitorización remota'),
      item(8, 'Realizar prueba funcional final y dejar equipo operativo', { requiere_foto: true })
    ]
  },
  {
    key: 'fv_revision_cuadro_dc',
    nombre: 'Revisión cuadro DC FV',
    descripcion: 'Revisión de cuadro DC, seccionadores, fusibles, SPD, aprietes visibles y señalización.',
    tipo_ot: 'mantenimiento_preventivo',
    prioridad: 'alta',
    periodicidad: 'semestral',
    tipo_activo_recomendado: 'cuadro_dc_fv',
    titulo: 'Revisión cuadro DC fotovoltaico',
    trabajo_solicitado: 'Revisar protecciones DC, SPD, fusibles, seccionadores, rotulación y estado del cuadro DC.',
    instrucciones_tecnico: 'No manipular en carga sin procedimiento. Registrar fotografías antes/después y cualquier anomalía detectada.',
    resultado_esperado: 'Cuadro DC revisado, protecciones identificadas y defectos documentados.',
    configuracion: { ...FV_BASE_REQUIREMENTS, requiere_fotos_iniciales: true },
    items: [
      item(1, 'Verificar señalización de riesgo eléctrico DC y rotulación del cuadro', { requiere_foto: true }),
      item(2, 'Comprobar estado de envolvente, cierre, prensaestopas y entradas de cable', { requiere_foto: true }),
      item(3, 'Revisar estado visual de fusibles, portafusibles y seccionadores DC'),
      item(4, 'Comprobar estado de protectores de sobretensión DC', { requiere_foto: true }),
      item(5, 'Registrar tensión DC de entrada o bus si procede', { tipo_respuesta: 'medicion', unidad: 'V' }),
      item(6, 'Comprobar ausencia de calentamientos, olores o marcas de arco'),
      item(7, 'Documentar material pendiente si se detecta SPD/fusible deteriorado'),
      item(8, 'Dejar cuadro cerrado, seguro y correctamente identificado', { requiere_foto: true })
    ]
  },
  {
    key: 'fv_medicion_strings',
    nombre: 'Medición de strings FV',
    descripcion: 'Medición de tensiones/corrientes de strings y comparación de desviaciones entre cadenas.',
    tipo_ot: 'medicion',
    prioridad: 'alta',
    periodicidad: 'semestral',
    tipo_activo_recomendado: 'campo_fotovoltaico',
    titulo: 'Medición de strings y comprobación de producción FV',
    trabajo_solicitado: 'Medir strings DC, registrar valores y documentar desviaciones entre cadenas.',
    instrucciones_tecnico: 'Aplicar procedimiento de seguridad DC. Registrar condiciones de medida y fotos del punto de conexión.',
    resultado_esperado: 'Strings medidos, desviaciones identificadas y resultados incluidos en informe.',
    configuracion: { ...FV_BASE_REQUIREMENTS, requiere_fotos_iniciales: true },
    items: [
      item(1, 'Identificar strings a medir y condiciones de irradiación aproximadas', { requiere_foto: true }),
      item(2, 'Registrar tensión string 1', { tipo_respuesta: 'medicion', unidad: 'V' }),
      item(3, 'Registrar tensión string 2', { tipo_respuesta: 'medicion', unidad: 'V' }),
      item(4, 'Registrar tensión string 3', { tipo_respuesta: 'medicion', unidad: 'V', obligatorio: false }),
      item(5, 'Registrar tensión string 4', { tipo_respuesta: 'medicion', unidad: 'V', obligatorio: false }),
      item(6, 'Comprobar desviaciones significativas entre strings'),
      item(7, 'Documentar conexiones, bornes o protecciones asociadas', { requiere_foto: true }),
      item(8, 'Indicar acciones recomendadas si hay desviaciones o valores anómalos')
    ]
  },
  {
    key: 'fv_aislamiento_dc',
    nombre: 'Comprobación aislamiento DC',
    descripcion: 'Prueba de aislamiento de circuito DC, registro de valor y evaluación de seguridad.',
    tipo_ot: 'medicion',
    prioridad: 'alta',
    periodicidad: 'anual',
    tipo_activo_recomendado: 'campo_fotovoltaico',
    titulo: 'Comprobación de aislamiento DC fotovoltaico',
    trabajo_solicitado: 'Comprobar aislamiento de circuitos DC y registrar valores obtenidos.',
    instrucciones_tecnico: 'Realizar la prueba con procedimiento autorizado, equipo adecuado y circuito en condiciones seguras.',
    resultado_esperado: 'Aislamiento DC comprobado y valores documentados para revisión.',
    configuracion: { ...FV_BASE_REQUIREMENTS, requiere_fotos_iniciales: true },
    items: [
      item(1, 'Confirmar consignación o condiciones seguras para la prueba de aislamiento', { requiere_foto: true }),
      item(2, 'Identificar circuito/string sometido a prueba'),
      item(3, 'Registrar tensión de prueba aplicada', { tipo_respuesta: 'medicion', unidad: 'V' }),
      item(4, 'Registrar resistencia de aislamiento polo positivo-tierra', { tipo_respuesta: 'medicion', unidad: 'MΩ' }),
      item(5, 'Registrar resistencia de aislamiento polo negativo-tierra', { tipo_respuesta: 'medicion', unidad: 'MΩ' }),
      item(6, 'Comprobar que no aparecen alarmas de aislamiento en inversor/monitorización'),
      item(7, 'Documentar equipo de medida y conexiones de prueba', { requiere_foto: true }),
      item(8, 'Indicar resultado final y recomendaciones')
    ]
  },
  {
    key: 'fv_revision_cuadro_ac',
    nombre: 'Revisión cuadro AC FV',
    descripcion: 'Revisión de protecciones AC, diferencial, magnetotérmicos, SPD AC, aprietes visibles y señalización.',
    tipo_ot: 'mantenimiento_preventivo',
    prioridad: 'alta',
    periodicidad: 'semestral',
    tipo_activo_recomendado: 'cuadro_ac_fv',
    titulo: 'Revisión cuadro AC fotovoltaico y protecciones',
    trabajo_solicitado: 'Revisar cuadro AC FV, protecciones, diferencial, SPD AC y señalización.',
    instrucciones_tecnico: 'Registrar fotos, comprobar estado visual y anotar cualquier protección disparada o deteriorada.',
    resultado_esperado: 'Cuadro AC revisado y protecciones en estado correcto o defectos documentados.',
    configuracion: { ...FV_BASE_REQUIREMENTS, requiere_fotos_iniciales: true },
    items: [
      item(1, 'Comprobar rotulación del cuadro AC FV y esquema disponible', { requiere_foto: true }),
      item(2, 'Revisar estado de magnetotérmicos, diferencial y SPD AC'),
      item(3, 'Comprobar ausencia de calentamientos, olor o decoloración'),
      item(4, 'Registrar tensión entre fases o fase-neutro según instalación', { tipo_respuesta: 'medicion', unidad: 'V' }),
      item(5, 'Comprobar estado de puesta a tierra y continuidad visual de conductor PE'),
      item(6, 'Comprobar maniobra de seccionamiento si procede'),
      item(7, 'Documentar defectos o material pendiente', { requiere_foto: true }),
      item(8, 'Cerrar cuadro y dejar protecciones en posición correcta', { requiere_foto: true })
    ]
  },
  {
    key: 'fv_contador_vertido_cero',
    nombre: 'Contador bidireccional / vertido cero',
    descripcion: 'Verificación de contador bidireccional, analizador, pinzas y sistema de vertido cero.',
    tipo_ot: 'verificacion_funcionamiento',
    prioridad: 'normal',
    periodicidad: 'anual',
    tipo_activo_recomendado: 'contador_fv',
    titulo: 'Verificación contador bidireccional y vertido cero FV',
    trabajo_solicitado: 'Comprobar contador bidireccional, lectura de energía, comunicaciones y funcionamiento de vertido cero.',
    instrucciones_tecnico: 'Verificar lecturas, sentido de medida, comunicaciones y coherencia de potencia importada/exportada.',
    resultado_esperado: 'Sistema de medida y vertido cero verificado y documentado.',
    configuracion: { ...FV_BASE_REQUIREMENTS, requiere_firma_tecnico: false, requiere_fotos_finales: false },
    items: [
      item(1, 'Identificar contador/analizador y transformadores de medida', { requiere_foto: true }),
      item(2, 'Registrar potencia importada o consumida', { tipo_respuesta: 'medicion', unidad: 'kW' }),
      item(3, 'Registrar potencia exportada o vertida', { tipo_respuesta: 'medicion', unidad: 'kW' }),
      item(4, 'Comprobar comunicaciones con inversor o plataforma de monitorización'),
      item(5, 'Verificar coherencia de sentido de medida de pinzas/TC'),
      item(6, 'Comprobar estado del control de vertido cero'),
      item(7, 'Documentar pantalla o lectura relevante', { requiere_foto: true })
    ]
  },
  {
    key: 'fv_limpieza_modulos',
    nombre: 'Limpieza módulos FV',
    descripcion: 'Limpieza e inspección visual de módulos, suciedad, sombras, roturas, fijaciones y canalizaciones visibles.',
    tipo_ot: 'mantenimiento_preventivo',
    prioridad: 'normal',
    periodicidad: 'semestral',
    tipo_activo_recomendado: 'campo_fotovoltaico',
    titulo: 'Limpieza e inspección visual de módulos FV',
    trabajo_solicitado: 'Realizar limpieza de módulos FV e inspección visual de campo solar.',
    instrucciones_tecnico: 'Registrar fotos antes/después, revisar suciedad, sombras, roturas visibles y fijaciones accesibles.',
    resultado_esperado: 'Módulos limpios, campo solar inspeccionado y anomalías documentadas.',
    configuracion: { ...FV_BASE_REQUIREMENTS, requiere_mediciones: false, requiere_firma_tecnico: true },
    items: [
      item(1, 'Registrar estado inicial de suciedad de módulos', { requiere_foto: true }),
      item(2, 'Comprobar acceso seguro a cubierta/marquesina y protecciones colectivas'),
      item(3, 'Limpiar módulos según procedimiento sin productos agresivos'),
      item(4, 'Revisar roturas, puntos calientes visibles, sombras o suciedad persistente', { requiere_foto: true }),
      item(5, 'Revisar fijaciones y cableado visible sin manipulación innecesaria'),
      item(6, 'Registrar estado final tras limpieza', { requiere_foto: true }),
      item(7, 'Indicar incidencias pendientes o necesidad de otra intervención')
    ]
  },
  {
    key: 'fv_seccionador_bomberos',
    nombre: 'Seccionador emergencia bomberos FV',
    descripcion: 'Revisión de seccionador de emergencia, accesibilidad, señalización y estado operativo.',
    tipo_ot: 'mantenimiento_preventivo',
    prioridad: 'alta',
    periodicidad: 'anual',
    tipo_activo_recomendado: 'seguridad_fv',
    titulo: 'Revisión seccionador emergencia bomberos FV',
    trabajo_solicitado: 'Comprobar seccionador de emergencia FV, señalización, accesibilidad y estado visual.',
    instrucciones_tecnico: 'No accionar si no procede. Documentar ubicación, señalización, accesibilidad y estado del equipo.',
    resultado_esperado: 'Seccionador identificado, accesible, señalizado y sin defectos visibles.',
    configuracion: { ...FV_BASE_REQUIREMENTS, requiere_mediciones: false, requiere_fotos_iniciales: true },
    items: [
      item(1, 'Comprobar accesibilidad al seccionador de emergencia', { requiere_foto: true }),
      item(2, 'Comprobar señalización visible para bomberos/emergencias', { requiere_foto: true }),
      item(3, 'Revisar estado de envolvente, mando y cierre'),
      item(4, 'Verificar identificación de circuitos afectados'),
      item(5, 'Comprobar ausencia de daños, humedad o manipulación indebida'),
      item(6, 'Documentar ubicación y estado final', { requiere_foto: true })
    ]
  }
];

export const FV_WORK_ORDER_TEMPLATE_OPTIONS = FV_WORK_ORDER_TEMPLATES.map((template) => ({
  key: template.key,
  label: template.nombre,
  description: template.descripcion,
  periodicidad: template.periodicidad,
  tipoActivo: template.tipo_activo_recomendado
}));

export function getFvWorkOrderTemplate(key) {
  return FV_WORK_ORDER_TEMPLATES.find((template) => template.key === key) || null;
}

export function applyFvWorkOrderTemplateToDraft(draft, key) {
  const template = getFvWorkOrderTemplate(key);
  if (!template) return { ...draft, template_key: '' };
  return {
    ...draft,
    template_key: template.key,
    titulo: draft.titulo || template.titulo,
    descripcion: draft.descripcion || template.descripcion,
    tipo: template.tipo_ot,
    tipo_ot: template.tipo_ot,
    prioridad: template.prioridad || draft.prioridad || 'normal',
    trabajo_solicitado: draft.trabajo_solicitado || template.trabajo_solicitado,
    instrucciones_tecnico: draft.instrucciones_tecnico || template.instrucciones_tecnico,
    resultado_esperado: draft.resultado_esperado || template.resultado_esperado,
    configuracion: {
      ...(draft.configuracion || {}),
      ...(template.configuracion || {})
    }
  };
}

export async function createWorkOrderFromTemplate(tenantId, payload, templateKey) {
  const template = getFvWorkOrderTemplate(templateKey);
  if (!template) return createWorkOrder(tenantId, payload);

  const finalConfiguration = {
    ...(template.configuracion || {}),
    ...(payload.configuracion || {}),
    requiere_checklist: true
  };

  const created = await createWorkOrder(tenantId, {
    ...payload,
    titulo: payload.titulo || template.titulo,
    descripcion: payload.descripcion || template.descripcion,
    trabajo_solicitado: payload.trabajo_solicitado || template.trabajo_solicitado,
    instrucciones_tecnico: payload.instrucciones_tecnico || template.instrucciones_tecnico,
    resultado_esperado: payload.resultado_esperado || template.resultado_esperado,
    tipo: template.tipo_ot,
    tipo_ot: template.tipo_ot,
    prioridad: payload.prioridad || template.prioridad,
    configuracion: {
      ...finalConfiguration,
      requiere_checklist: false
    }
  });

  await seedChecklist(tenantId, created.id, template.tipo_ot, created.created_by || null, template.items);

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update({
      configuracion: finalConfiguration,
      tipo: template.tipo_ot,
      tipo_ot: template.tipo_ot,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .eq('id', created.id)
    .select()
    .single();

  if (error) {
    console.warn('No se pudo guardar configuracion final de plantilla FV. Se mantiene la OT creada.', error);
  }

  await logAudit({
    tenantId,
    action: 'apply_fv_work_order_template',
    entityType: 'orden_trabajo',
    entityId: created.id,
    metadata: {
      templateKey: template.key,
      templateName: template.nombre,
      checklistItems: template.items.length
    }
  });

  return data || { ...created, configuracion: finalConfiguration };
}
