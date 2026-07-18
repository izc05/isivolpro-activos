const DAY_MS = 86400000;

function todayStart() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function daysUntil(date) {
  if (!date) return null;
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - todayStart()) / DAY_MS);
}

function checklistItem(orden, titulo, descripcion, options = {}) {
  return {
    id: options.id || `fv-${orden}`,
    orden,
    titulo,
    descripcion,
    obligatorio: options.obligatorio !== false,
    requiere_foto: Boolean(options.requiere_foto),
    tipo_respuesta: options.tipo_respuesta || 'ok_no_ok',
    unidad: options.unidad || '',
    valor_minimo: options.valor_minimo ?? '',
    valor_maximo: options.valor_maximo ?? ''
  };
}

export const FV_PREVENTIVE_PLAN_TEMPLATES = [
  {
    id: 'fv_inversor_preventivo',
    nombre: 'Revisión preventiva inversor FV',
    categoria: 'fotovoltaica_inversor',
    tipo: 'preventivo',
    prioridad: 'alta',
    periodicidad_valor: 6,
    periodicidad_unidad: 'meses',
    tiempo_estimado_minutos: 60,
    dias_aviso: 20,
    tolerancia_dias: 7,
    descripcion: 'Revisión periódica del inversor fotovoltaico, ventilación, alarmas, comunicaciones y estado general.',
    instrucciones: 'Comprobar alarmas del inversor, ventilación, limpieza, aprietes visibles, comunicaciones y registrar evidencias fotográficas.',
    checklist_json: [
      checklistItem(1, 'Identificar inversor y placa', 'Confirmar equipo, potencia, número de serie y ubicación.', { requiere_foto: true }),
      checklistItem(2, 'Comprobar ausencia de alarmas', 'Revisar pantalla, app o portal de monitorización y anotar alarmas activas.'),
      checklistItem(3, 'Revisar ventilación y temperatura', 'Comprobar rejillas, ventiladores, entorno y temperatura de trabajo.'),
      checklistItem(4, 'Revisar conexiones visibles AC/DC', 'Inspección visual de conexiones, prensaestopas y protecciones próximas.', { requiere_foto: true }),
      checklistItem(5, 'Registrar potencia instantánea', 'Anotar potencia o producción observada durante la revisión.', { tipo_respuesta: 'medicion', unidad: 'kW' })
    ]
  },
  {
    id: 'fv_cuadro_dc',
    nombre: 'Revisión cuadro DC FV',
    categoria: 'fotovoltaica_dc',
    tipo: 'revision_tecnica',
    prioridad: 'alta',
    periodicidad_valor: 6,
    periodicidad_unidad: 'meses',
    tiempo_estimado_minutos: 45,
    dias_aviso: 20,
    tolerancia_dias: 7,
    descripcion: 'Revisión de cuadro DC, seccionadores, fusibles, SPD y estado visual de cableado solar.',
    instrucciones: 'Revisar cuadro DC sin manipulación innecesaria, documentar estado de SPD, seccionadores, fusibles y entradas de strings.',
    checklist_json: [
      checklistItem(1, 'Foto general cuadro DC', 'Registrar estado inicial del cuadro DC.', { requiere_foto: true }),
      checklistItem(2, 'Estado SPD DC', 'Comprobar indicador de sobretensiones y necesidad de sustitución.', { requiere_foto: true }),
      checklistItem(3, 'Estado seccionadores DC', 'Comprobar posición, accesibilidad y rotulación.'),
      checklistItem(4, 'Estado cableado y prensaestopas', 'Comprobar orden, apriete visual, degradación o entrada de agua.', { requiere_foto: true })
    ]
  },
  {
    id: 'fv_strings_medicion',
    nombre: 'Medición de strings FV',
    categoria: 'fotovoltaica_strings',
    tipo: 'predictivo',
    prioridad: 'alta',
    periodicidad_valor: 6,
    periodicidad_unidad: 'meses',
    tiempo_estimado_minutos: 90,
    dias_aviso: 20,
    tolerancia_dias: 10,
    descripcion: 'Medición preventiva de strings fotovoltaicos para detectar desviaciones, strings abiertos o baja producción.',
    instrucciones: 'Medir strings en condiciones seguras, registrar valores comparables y documentar diferencias relevantes.',
    checklist_json: [
      checklistItem(1, 'Identificar strings a medir', 'Confirmar nomenclatura, cuadro y entradas de strings.', { requiere_foto: true }),
      checklistItem(2, 'Tensión string 1', 'Registrar tensión del string 1.', { tipo_respuesta: 'medicion', unidad: 'V', valor_minimo: 250, valor_maximo: 1000 }),
      checklistItem(3, 'Tensión string 2', 'Registrar tensión del string 2.', { tipo_respuesta: 'medicion', unidad: 'V', valor_minimo: 250, valor_maximo: 1000 }),
      checklistItem(4, 'Comparativa entre strings', 'Anotar desviaciones o valores anómalos.'),
      checklistItem(5, 'Foto medición o equipo', 'Registrar evidencia de medición si procede.', { requiere_foto: true })
    ]
  },
  {
    id: 'fv_aislamiento_dc',
    nombre: 'Comprobación aislamiento DC FV',
    categoria: 'fotovoltaica_aislamiento',
    tipo: 'predictivo',
    prioridad: 'alta',
    periodicidad_valor: 12,
    periodicidad_unidad: 'meses',
    tiempo_estimado_minutos: 90,
    dias_aviso: 30,
    tolerancia_dias: 15,
    descripcion: 'Comprobación periódica de aislamiento en corriente continua de la instalación fotovoltaica.',
    instrucciones: 'Realizar prueba de aislamiento siguiendo procedimiento seguro y dejar valores documentados.',
    checklist_json: [
      checklistItem(1, 'Preparar prueba segura', 'Confirmar consignación o procedimiento seguro antes de medir.'),
      checklistItem(2, 'Aislamiento polo positivo', 'Registrar valor de aislamiento positivo.', { tipo_respuesta: 'medicion', unidad: 'MΩ' }),
      checklistItem(3, 'Aislamiento polo negativo', 'Registrar valor de aislamiento negativo.', { tipo_respuesta: 'medicion', unidad: 'MΩ' }),
      checklistItem(4, 'Resultado global', 'Indicar si el aislamiento es aceptable o requiere actuación.'),
      checklistItem(5, 'Evidencia de prueba', 'Adjuntar foto del equipo de medida o registro.', { requiere_foto: true })
    ]
  },
  {
    id: 'fv_cuadro_ac',
    nombre: 'Revisión cuadro AC FV',
    categoria: 'fotovoltaica_ac',
    tipo: 'revision_tecnica',
    prioridad: 'alta',
    periodicidad_valor: 6,
    periodicidad_unidad: 'meses',
    tiempo_estimado_minutos: 45,
    dias_aviso: 20,
    tolerancia_dias: 7,
    descripcion: 'Revisión de protecciones AC, magnetotérmicos, diferenciales, protecciones de sobretensión y rotulación.',
    instrucciones: 'Revisar cuadro AC FV, protecciones, estado visual, rotulación y evidencias fotográficas.',
    checklist_json: [
      checklistItem(1, 'Foto general cuadro AC', 'Registrar vista general del cuadro AC FV.', { requiere_foto: true }),
      checklistItem(2, 'Estado protecciones AC', 'Comprobar magnetotérmicos, diferencial y protecciones asociadas.'),
      checklistItem(3, 'Estado SPD AC', 'Comprobar indicador y necesidad de sustitución.', { requiere_foto: true }),
      checklistItem(4, 'Rotulación y accesibilidad', 'Verificar que está correctamente identificado y accesible.')
    ]
  },
  {
    id: 'fv_contador_vertido_cero',
    nombre: 'Contador bidireccional / vertido cero FV',
    categoria: 'fotovoltaica_contador',
    tipo: 'prueba_funcional',
    prioridad: 'normal',
    periodicidad_valor: 6,
    periodicidad_unidad: 'meses',
    tiempo_estimado_minutos: 45,
    dias_aviso: 20,
    tolerancia_dias: 7,
    descripcion: 'Verificación funcional de contador bidireccional, analizador o equipo de control de vertido cero.',
    instrucciones: 'Comprobar lectura, comunicaciones, sentido de energía y funcionamiento del vertido cero si aplica.',
    checklist_json: [
      checklistItem(1, 'Foto contador o analizador', 'Registrar equipo instalado y lectura visible.', { requiere_foto: true }),
      checklistItem(2, 'Comprobar comunicaciones', 'Verificar comunicación con inversor o sistema de monitorización.'),
      checklistItem(3, 'Lectura energía importada', 'Registrar lectura importada si está disponible.', { tipo_respuesta: 'medicion', unidad: 'kWh' }),
      checklistItem(4, 'Lectura energía exportada', 'Registrar lectura exportada si está disponible.', { tipo_respuesta: 'medicion', unidad: 'kWh' })
    ]
  },
  {
    id: 'fv_limpieza_modulos',
    nombre: 'Limpieza módulos FV',
    categoria: 'fotovoltaica_limpieza',
    tipo: 'limpieza',
    prioridad: 'media',
    periodicidad_valor: 12,
    periodicidad_unidad: 'meses',
    tiempo_estimado_minutos: 120,
    dias_aviso: 30,
    tolerancia_dias: 30,
    descripcion: 'Limpieza programada de módulos fotovoltaicos y revisión visual del campo solar.',
    instrucciones: 'Registrar estado inicial, realizar limpieza si procede y documentar estado final.',
    checklist_json: [
      checklistItem(1, 'Estado inicial módulos', 'Foto de suciedad, polvo, excrementos o sombras antes de limpiar.', { requiere_foto: true }),
      checklistItem(2, 'Limpieza realizada', 'Confirmar limpieza de la zona programada.'),
      checklistItem(3, 'Estado final módulos', 'Foto del campo FV tras la limpieza.', { requiere_foto: true }),
      checklistItem(4, 'Observaciones de sombras o daños', 'Anotar roturas, hotspots visibles, sombras o elementos extraños.')
    ]
  },
  {
    id: 'fv_seccionador_emergencia',
    nombre: 'Seccionador emergencia bomberos FV',
    categoria: 'fotovoltaica_seguridad',
    tipo: 'prueba_funcional',
    prioridad: 'alta',
    periodicidad_valor: 12,
    periodicidad_unidad: 'meses',
    tiempo_estimado_minutos: 45,
    dias_aviso: 30,
    tolerancia_dias: 15,
    descripcion: 'Verificación del seccionador de emergencia para bomberos o corte rápido FV.',
    instrucciones: 'Comprobar accesibilidad, rotulación, estado del mando y prueba funcional según procedimiento.',
    checklist_json: [
      checklistItem(1, 'Accesibilidad y rotulación', 'Confirmar que el seccionador está accesible y rotulado.', { requiere_foto: true }),
      checklistItem(2, 'Estado físico del mando', 'Revisar caja, accionamiento, protección y señalización.'),
      checklistItem(3, 'Prueba funcional', 'Registrar resultado de prueba funcional si procede.'),
      checklistItem(4, 'Estado final', 'Dejar el sistema en estado operativo y documentarlo.', { requiere_foto: true })
    ]
  }
];

export function getFvPlanTemplate(templateId) {
  return FV_PREVENTIVE_PLAN_TEMPLATES.find((template) => template.id === templateId) || null;
}

export function isFvAsset(asset = {}) {
  const text = `${asset.nombre || ''} ${asset.tipo || ''}`.toLowerCase();
  return ['fv', 'fotovolta', 'inversor', 'string', 'cuadro dc', 'cuadro ac', 'contador', 'vertido', 'seccionador'].some((term) => text.includes(term));
}

export function isFvPlan(plan = {}) {
  const text = `${plan.nombre || ''} ${plan.categoria || ''} ${plan.descripcion || ''} ${plan.activos?.nombre || ''} ${plan.activos?.tipo || ''}`.toLowerCase();
  return text.includes('fv') || text.includes('fotovolta') || text.includes('inversor') || text.includes('string') || text.includes('vertido cero');
}

export function buildFvMaintenancePlanPayload(template, base = {}) {
  const selectedTemplate = typeof template === 'string' ? getFvPlanTemplate(template) : template;
  if (!selectedTemplate) return base;
  return {
    ...base,
    nombre: selectedTemplate.nombre,
    descripcion: selectedTemplate.descripcion,
    tipo: selectedTemplate.tipo,
    categoria: selectedTemplate.categoria,
    periodicidad_valor: selectedTemplate.periodicidad_valor,
    periodicidad_unidad: selectedTemplate.periodicidad_unidad,
    dias_aviso: selectedTemplate.dias_aviso,
    tolerancia_dias: selectedTemplate.tolerancia_dias,
    prioridad: selectedTemplate.prioridad,
    tiempo_estimado_minutos: selectedTemplate.tiempo_estimado_minutos,
    instrucciones: selectedTemplate.instrucciones,
    checklist_json: selectedTemplate.checklist_json.map((item) => ({ ...item })),
    activo: true,
    auto_generar_ot: false
  };
}

export function preventiveBucket(plan = {}) {
  const days = daysUntil(plan.fecha_proxima_realizacion);
  if (days === null) return 'sin_fecha';
  if (days < 0) return 'vencido';
  if (days <= Number(plan.dias_aviso || 15)) return 'proximo';
  return 'programado';
}

export function preventiveBucketLabel(plan = {}) {
  const bucket = preventiveBucket(plan);
  if (bucket === 'vencido') return 'Vencido';
  if (bucket === 'proximo') return 'Próximo';
  if (bucket === 'programado') return 'Programado';
  return 'Sin fecha';
}

export function summarizeFvPreventivePlans(plans = []) {
  const fvPlans = plans.filter(isFvPlan);
  return {
    total: plans.length,
    fvTotal: fvPlans.length,
    vencidos: fvPlans.filter((plan) => preventiveBucket(plan) === 'vencido').length,
    proximos: fvPlans.filter((plan) => preventiveBucket(plan) === 'proximo').length,
    programados: fvPlans.filter((plan) => preventiveBucket(plan) === 'programado').length,
    activosCriticos: fvPlans.filter((plan) => plan.activos?.criticidad === 'alta' || plan.prioridad === 'alta' || plan.prioridad === 'urgente' || plan.prioridad === 'critica').length
  };
}

export function sortPreventivePlans(plans = []) {
  const order = { vencido: 0, proximo: 1, programado: 2, sin_fecha: 3 };
  return [...plans].sort((a, b) => {
    const byBucket = order[preventiveBucket(a)] - order[preventiveBucket(b)];
    if (byBucket !== 0) return byBucket;
    return String(a.fecha_proxima_realizacion || '').localeCompare(String(b.fecha_proxima_realizacion || ''));
  });
}
