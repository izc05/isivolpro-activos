# Matriz de roles y permisos OT/FV

Esta guía fija el comportamiento esperado para el flujo de órdenes de trabajo, instalaciones FV y activos.

## Roles

| Rol | Alcance | Puede gestionar OT | Puede ejecutar OT | Puede validar | Puede anular | Auditoría |
| --- | --- | --- | --- | --- | --- | --- |
| superadmin | Plataforma completa | Sí | No | Sí | Sí | Sí |
| admin_cliente | Cliente activo completo | Sí | No | Sí | Sí | Sí |
| coordinador | Operativa y planificación | Sí | No | Sí | Sí | Sí |
| tecnico | OT asignadas | No | Sí | No | No | No |
| tecnico_externo | OT asignadas/accesos | No | Sí | No | No | No |
| cliente_lectura | Consulta | No | No | No | No | No |

## Reglas de OT

1. El administrador crea, asigna, anula, solicita correcciones y valida.
2. El administrador no debe finalizar una OT saltándose visita, checklist, firmas e informe.
3. El técnico ejecuta: visita, checklist, fotos, materiales, firmas e informe.
4. La finalización técnica deja la OT en revisión administrativa.
5. La validación administrativa deja la OT en solo lectura.
6. La anulación requiere motivo y no borra historial.
7. Las correcciones requieren nota y devuelven la OT al técnico.
8. Toda acción crítica debe quedar auditada.

## FV

Las OT FV deben respetar el mismo ciclo:

Plan preventivo FV → actuación programada → OT → intervención → informe → revisión admin → histórico del activo.

Los roles no cambian por ser FV; solo cambian las plantillas, checklist, métricas y filtros operativos.
