export const FV_DEMO_SCENARIO = {
  tenantName: 'Comunidad Los Olivos',
  installations: [
    'Instalación Fotovoltaica Cubierta Los Olivos Demo',
    'Instalación Fotovoltaica Parking Marquesinas Demo'
  ],
  expectedWorkOrders: ['FV-OT-001', 'FV-OT-002', 'FV-OT-003', 'FV-OT-004', 'FV-OT-005', 'FV-OT-006'],
  expectedAssets: [
    'Campo FV Cubierta - Strings 1 a 4',
    'Inversor FV 50 kW Cubierta',
    'Cuadro DC fotovoltaico cubierta',
    'Cuadro AC fotovoltaico y protecciones',
    'Contador bidireccional y vertido cero',
    'Campo FV Marquesinas Parking',
    'Inversor FV Parking 20 kW',
    'Seccionador emergencia bomberos FV'
  ]
};

export const FV_SMOKE_TESTS = [
  {
    id: 'fv-dashboard',
    area: 'Dashboard OT',
    goal: 'Ver métricas FV y abrir una OT desde seguimiento FV.',
    steps: ['Entrar en Dashboard OT', 'Filtrar Solo FV', 'Abrir FV-OT-005', 'Volver al dashboard'],
    expected: 'La tabla FV muestra OT ordenadas por urgencia y mantiene seguimiento general.'
  },
  {
    id: 'fv-technician-flow',
    area: 'Vista técnico',
    goal: 'Ejecutar una OT asignada desde móvil.',
    steps: ['Abrir Mis OT', 'Abrir FV-OT-001', 'Iniciar intervención', 'Completar checklist/fotos/firma/informe'],
    expected: 'La OT solo permite finalizar cuando se cumplen requisitos.'
  },
  {
    id: 'fv-admin-correction',
    area: 'Revisión admin',
    goal: 'Solicitar correcciones con nota obligatoria.',
    steps: ['Abrir FV-OT-004', 'Escribir nota', 'Solicitar correcciones', 'Volver a Mis OT técnico'],
    expected: 'La corrección aparece destacada arriba con botón Corregir OT.'
  },
  {
    id: 'fv-admin-validate',
    area: 'Revisión admin',
    goal: 'Validar una OT lista.',
    steps: ['Abrir FV-OT-005', 'Revisar requisitos', 'Validar OT'],
    expected: 'La OT queda VALIDADA y en solo lectura.'
  },
  {
    id: 'fv-planning',
    area: 'Planes preventivos',
    goal: 'Crear plan FV desde plantilla y generar actuación sin duplicados.',
    steps: ['Abrir Mantenimiento > Planes', 'Elegir plantilla Inversor FV', 'Guardar plan', 'Generar actuación dos veces'],
    expected: 'La segunda generación se bloquea para la misma fecha abierta.'
  },
  {
    id: 'fv-pdf-audit',
    area: 'Informe y auditoría',
    goal: 'Ver informe PDF FV y trazabilidad.',
    steps: ['Generar informe', 'Abrir Auditoría', 'Filtrar Solo OT', 'Buscar la OT'],
    expected: 'Aparecen informe, checklist, firma, correcciones, validación o anulación con texto claro.'
  }
];

export function demoScenarioChecklist() {
  return [
    `Tenant demo: ${FV_DEMO_SCENARIO.tenantName}`,
    `Instalaciones FV mínimas: ${FV_DEMO_SCENARIO.installations.length}`,
    `Activos FV mínimos: ${FV_DEMO_SCENARIO.expectedAssets.length}`,
    `OT FV esperadas: ${FV_DEMO_SCENARIO.expectedWorkOrders.join(', ')}`,
    `Pruebas humo: ${FV_SMOKE_TESTS.length}`
  ];
}

export function testPlanByArea() {
  return FV_SMOKE_TESTS.reduce((acc, test) => {
    acc[test.area] = acc[test.area] || [];
    acc[test.area].push(test);
    return acc;
  }, {});
}
