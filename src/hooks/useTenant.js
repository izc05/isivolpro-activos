import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentTenantMember, listTenants } from '../services/tenantService';
import { listInstallationsForTenant } from '../services/entityService';
import { buildTenantPermissions, roleLabel } from '../utils/permissions';
import {
  installationSelectionStorageValue,
  resolveInstallationSelection,
  workContextLabel
} from '../utils/workContext';
import { useAuth } from './useAuth';

const TenantContext = createContext(null);
const ACTIVE_TENANT_STORAGE_KEY = 'activeTenantId';

function installationStorageKey(tenantId) {
  return tenantId ? `activeInstallationId:${tenantId}` : 'activeInstallationId';
}

function readStoredValue(key) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredValue(key, value) {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // La aplicacion sigue funcionando aunque el navegador bloquee el almacenamiento.
  }
}

function persistInstallationSelection(tenantId, installationId) {
  if (!tenantId) return;
  writeStoredValue(installationStorageKey(tenantId), installationSelectionStorageValue(installationId));
}

export function TenantProvider({ children }) {
  const { isAuthenticated, isSuperAdmin, loading: authLoading } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [activeTenantId, setActiveTenantIdState] = useState(() => readStoredValue(ACTIVE_TENANT_STORAGE_KEY));
  const [activeMember, setActiveMember] = useState(undefined);
  const [installations, setInstallations] = useState([]);
  const [activeInstallationId, setActiveInstallationIdState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tenantResolved, setTenantResolved] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [installationsLoading, setInstallationsLoading] = useState(false);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      setTenantResolved(false);
      return;
    }

    if (!isAuthenticated) {
      setTenants([]);
      setActiveTenantIdState(null);
      setActiveMember(null);
      setInstallations([]);
      setActiveInstallationIdState(null);
      setRoleLoading(false);
      setInstallationsLoading(false);
      setLoading(false);
      setTenantResolved(true);
      return;
    }

    setLoading(true);
    setTenantResolved(false);
    listTenants()
      .then((items) => {
        setTenants(items);
        const storedTenantId = readStoredValue(ACTIVE_TENANT_STORAGE_KEY);
        const storedIsValid = items.some((tenant) => tenant.id === storedTenantId);
        const currentIsValid = items.some((tenant) => tenant.id === activeTenantId);
        const nextTenantId = storedIsValid ? storedTenantId : currentIsValid ? activeTenantId : items[0]?.id || null;
        setActiveMember(undefined);
        setActiveTenantIdState(nextTenantId);
        writeStoredValue(ACTIVE_TENANT_STORAGE_KEY, nextTenantId);
      })
      .catch((error) => {
        console.error('No se pudieron cargar tenants', error);
        setTenants([]);
        setActiveTenantIdState(null);
        setActiveMember(null);
        setInstallations([]);
        setActiveInstallationIdState(null);
      })
      .finally(() => {
        setLoading(false);
        setTenantResolved(true);
      });
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !activeTenantId) {
      setActiveMember(null);
      setRoleLoading(false);
      return;
    }

    setRoleLoading(true);
    setActiveMember(undefined);
    getCurrentTenantMember(activeTenantId)
      .then(setActiveMember)
      .catch((error) => {
        console.error('No se pudo cargar el rol del usuario activo', error);
        setActiveMember(null);
      })
      .finally(() => setRoleLoading(false));
  }, [isAuthenticated, activeTenantId]);

  useEffect(() => {
    if (!isAuthenticated || !activeTenantId) {
      setInstallations([]);
      setActiveInstallationIdState(null);
      setInstallationsLoading(false);
      return;
    }

    setInstallationsLoading(true);
    listInstallationsForTenant(activeTenantId)
      .then((items) => {
        setInstallations(items);
        const storedInstallationId = readStoredValue(installationStorageKey(activeTenantId));
        const nextInstallationId = resolveInstallationSelection({
          installations: items,
          storedValue: storedInstallationId,
          currentValue: activeInstallationId
        });
        setActiveInstallationIdState(nextInstallationId);
        persistInstallationSelection(activeTenantId, nextInstallationId);
      })
      .catch((error) => {
        console.error('No se pudieron cargar instalaciones del cliente activo', error);
        setInstallations([]);
        setActiveInstallationIdState(null);
      })
      .finally(() => setInstallationsLoading(false));
  }, [isAuthenticated, activeTenantId]);

  const activeTenant = tenants.find((tenant) => tenant.id === activeTenantId) || null;
  const activeInstallation = installations.find((installation) => installation.id === activeInstallationId) || null;
  const activeRole = activeMember?.estado === 'activo' ? activeMember?.role || null : null;
  const permissions = buildTenantPermissions({
    activeRole,
    isSuperAdmin,
    hasTenantContext: Boolean(activeTenantId)
  });

  const value = useMemo(() => ({
    tenants,
    activeTenant,
    activeTenantId,
    activeMember,
    activeRole,
    activeRoleLabel: roleLabel(isSuperAdmin ? 'super_admin' : activeRole),
    installations,
    activeInstallation,
    activeInstallationId,
    isAllInstallations: Boolean(activeTenantId && installations.length > 1 && !activeInstallationId),
    contextLabel: workContextLabel({
      tenant: activeTenant,
      installation: activeInstallation,
      installationCount: installations.length
    }),
    ...permissions,
    isTechnician: permissions.isInternalTechnician || permissions.isExternalTechnician,
    loading: authLoading || loading || !tenantResolved,
    roleLoading,
    installationsLoading,
    setActiveTenantId: (tenantId) => {
      const nextTenantId = tenantId || null;
      if (nextTenantId === activeTenantId) return;
      setActiveMember(undefined);
      setActiveTenantIdState(nextTenantId);
      setInstallations([]);
      setActiveInstallationIdState(null);
      setInstallationsLoading(Boolean(nextTenantId));
      writeStoredValue(ACTIVE_TENANT_STORAGE_KEY, nextTenantId);
    },
    setActiveInstallationId: (installationId) => {
      const nextInstallationId = installationId || null;
      if (nextInstallationId === activeInstallationId) return;
      setActiveInstallationIdState(nextInstallationId);
      persistInstallationSelection(activeTenantId, nextInstallationId);
    },
    setWorkContext: ({ tenantId, installationId = null }) => {
      const nextTenantId = tenantId || null;
      const nextInstallationId = installationId || null;
      if (nextTenantId !== activeTenantId) {
        setActiveMember(undefined);
        setInstallations([]);
        setInstallationsLoading(Boolean(nextTenantId));
      }
      setActiveTenantIdState(nextTenantId);
      setActiveInstallationIdState(nextInstallationId);
      writeStoredValue(ACTIVE_TENANT_STORAGE_KEY, nextTenantId);
      if (nextTenantId) persistInstallationSelection(nextTenantId, nextInstallationId);
    },
    refreshTenants: async () => {
      const items = await listTenants();
      setTenants(items);
      return items;
    },
    refreshInstallations: async () => {
      if (!activeTenantId) return [];
      setInstallationsLoading(true);
      try {
        const items = await listInstallationsForTenant(activeTenantId);
        setInstallations(items);
        const nextInstallationId = resolveInstallationSelection({
          installations: items,
          storedValue: readStoredValue(installationStorageKey(activeTenantId)),
          currentValue: activeInstallationId
        });
        setActiveInstallationIdState(nextInstallationId);
        persistInstallationSelection(activeTenantId, nextInstallationId);
        return items;
      } finally {
        setInstallationsLoading(false);
      }
    }
  }), [tenants, activeTenant, activeTenantId, activeMember, activeRole, isSuperAdmin, installations, activeInstallation, activeInstallationId, permissions, authLoading, loading, tenantResolved, roleLoading, installationsLoading]);

  return createElement(TenantContext.Provider, { value }, children);
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant debe usarse dentro de TenantProvider');
  return context;
}
