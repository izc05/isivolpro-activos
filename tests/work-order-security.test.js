import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  isWorkOrderClosed,
  isWorkOrderReadOnly,
  normalizedStatus,
  validNextActions
} from '../src/utils/workOrderLifecycle.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('normaliza estados historicos al modelo oficial', () => {
  assert.equal(normalizedStatus('CERRADA'), 'VALIDADA');
  assert.equal(normalizedStatus('INFORME_GENERADO'), 'FINALIZADA');
  assert.equal(normalizedStatus('FIRMADA'), 'FINALIZADA');
});

test('una OT validada o cancelada es definitivamente cerrada', () => {
  assert.equal(isWorkOrderClosed('VALIDADA'), true);
  assert.equal(isWorkOrderClosed('CANCELADA'), true);
  assert.equal(isWorkOrderClosed('FINALIZADA'), false);
});

test('una OT finalizada ya es de solo lectura operativa', () => {
  assert.equal(isWorkOrderReadOnly('FINALIZADA'), true);
  assert.equal(isWorkOrderReadOnly('VALIDADA'), true);
  assert.equal(isWorkOrderReadOnly('EN_CURSO'), false);
});

test('una OT finalizada solo permite validar o reabrir', () => {
  assert.deepEqual(validNextActions({ estado: 'FINALIZADA' }), ['VALIDADA', 'EN_CURSO']);
  assert.deepEqual(validNextActions({ estado: 'VALIDADA' }), ['REABRIR']);
});

test('la migracion de fase 1 protege estados finales y requisitos de cierre', async () => {
  const sql = await readFile(path.join(root, 'src/sql/038_phase1_work_order_integrity.sql'), 'utf8');
  assert.match(sql, /estado not in \('FINALIZADA','VALIDADA','CERRADA','CANCELADA'\)/);
  assert.match(sql, /checklist incompleto/);
  assert.match(sql, /faltan fotos obligatorias/);
  assert.match(sql, /falta la firma del cliente/);
  assert.match(sql, /falta el informe PDF/);
  assert.match(sql, /for select to authenticated/);
  assert.match(sql, /for insert to authenticated/);
  assert.match(sql, /for update to authenticated/);
  assert.match(sql, /for delete to authenticated/);
  assert.match(sql, /finalize_work_order_visit/);
  assert.match(sql, /for update;/);
});

test('la fase 2 conserva un snapshot completo del checklist', async () => {
  const sql = await readFile(new URL('../src/sql/040_phase2_checklist_snapshot.sql', import.meta.url), 'utf8');
  assert.match(sql, /checklist_snapshot jsonb/i);
  assert.match(sql, /obligatorio boolean/i);
  assert.match(sql, /tipo_respuesta text/i);
  assert.match(sql, /valor_minimo numeric/i);
  assert.match(sql, /jsonb_agg/i);
});

test('la fase 2 exige una verificacion QR vinculada a la OT', async () => {
  const sql = await readFile(new URL('../src/sql/041_phase2_work_order_qr_verification.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table if not exists public\.ot_verificaciones_qr/i);
  assert.match(sql, /verify_work_order_qr/i);
  assert.match(sql, /requiere_verificacion_qr/i);
  assert.match(sql, /revoke execute[^;]+from public, anon/is);
});

test('la fase 2 separa las firmas de tecnico y cliente', async () => {
  const sql = await readFile(new URL('../src/sql/042_phase2_separate_signatures.sql', import.meta.url), 'utf8');
  assert.match(sql, /firma_tecnico_path text/i);
  assert.match(sql, /requiere_firma_tecnico/i);
  assert.match(sql, /requiere_firma_cliente/i);
  assert.match(sql, /enforce_work_order_signature_requirements/i);
});

test('la fase 2 registra la revision administrativa y sus correcciones', async () => {
  const sql = await readFile(new URL('../src/sql/043_phase2_admin_review_workflow.sql', import.meta.url), 'utf8');
  assert.match(sql, /ot_revisiones_admin/i);
  assert.match(sql, /review_work_order/i);
  assert.match(sql, /correccion_solicitada/i);
  assert.match(sql, /for update/i);
});

test('una OT finalizada no puede conservar visitas en curso', async () => {
  const sql = await readFile(new URL('../src/sql/044_reconcile_finalized_work_order_visits.sql', import.meta.url), 'utf8');
  assert.match(sql, /set estado='FINALIZADA'/i);
  assert.match(sql, /enforce_no_active_visit_on_finished_order/i);
  assert.match(sql, /visita en curso/i);
});
