import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_INSTALLATIONS_STORAGE_VALUE,
  installationSelectionStorageValue,
  matchesContextSearch,
  resolveInstallationSelection,
  workContextLabel
} from '../src/utils/workContext.js';

const installations = [
  { id: 'a', nombre: 'Clínica San Rafael', codigo: 'CSR-01', direccion: 'Granada' },
  { id: 'b', nombre: 'Hospital Norte', codigo: 'HN-02', direccion: 'Jaén' }
];

test('mantiene una instalacion guardada cuando pertenece al cliente activo', () => {
  assert.equal(resolveInstallationSelection({ installations, storedValue: 'b' }), 'b');
});

test('permite recordar explicitamente la vista de todas las instalaciones', () => {
  assert.equal(installationSelectionStorageValue(null), ALL_INSTALLATIONS_STORAGE_VALUE);
  assert.equal(resolveInstallationSelection({ installations, storedValue: ALL_INSTALLATIONS_STORAGE_VALUE }), null);
});

test('selecciona automaticamente la unica instalacion disponible', () => {
  assert.equal(resolveInstallationSelection({ installations: [installations[0]] }), 'a');
});

test('no arrastra una instalacion que pertenece a otro cliente', () => {
  assert.equal(resolveInstallationSelection({ installations, storedValue: 'externa', currentValue: 'externa' }), null);
});

test('la busqueda de contexto ignora mayusculas y acentos y usa codigo o direccion', () => {
  assert.equal(matchesContextSearch(installations[0], 'clinica granada'), true);
  assert.equal(matchesContextSearch(installations[1], 'hn-02 jaen'), true);
  assert.equal(matchesContextSearch(installations[0], 'hospital'), false);
});

test('el texto de contexto distingue instalacion concreta y vista agregada', () => {
  const tenant = { nombre: 'Comunidad Los Olivos' };
  assert.equal(
    workContextLabel({ tenant, installation: installations[0], installationCount: 2 }),
    'Comunidad Los Olivos / Clínica San Rafael'
  );
  assert.equal(
    workContextLabel({ tenant, installation: null, installationCount: 2 }),
    'Comunidad Los Olivos / Todas las instalaciones'
  );
});
