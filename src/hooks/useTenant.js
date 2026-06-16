import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentTenantMember, listTenants } from '../services/tenantService';
import { listInstallationsForTenant } from '../services/entityService';
import { buildTenantPermissions, roleLabel } from '../utils/permissions';
import { useAuth } from './useAuth';

const TenantContext = createContext(null);

function installationStorageKey(tenantId) {
  return tenantId ? `activeInstallationId:${tenantId}` : 'activeInstallationId';
}

export function TenantProvider({ children }) {
  const { isAuthenticated, isSuperAdmin } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [activeTenantId, setActiveTenantIdState] = useState(sessionStorage.getItem('activeTenantId'));
  const [activeMember, setActiveMember] = useState(null);
  const [installations, setInstallations] = useState([]);
  const [activeInstallationId, setActiveInstallationIdState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [installationsLoading, setInstallationsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setTenants([]);
      setActiveTenantIdState(null);
      setActiveMember(null);
      setInstallations([]);
      setActiveInstallationIdState(null);
      setRoleLoading(false);
      setInstallationsLoading(false);
      sessionStorage.removeItem('activeTenantId');
      return;
    }

    setLoading(true);
    listTenants()
      .then((items) => {
        setTenants(items);
        const storedTenantId = sessionStorage.getItem('activeTenantId');
        const storedIsValid = items.some((tenant) => tenant.id === storedTenantId);
        const currentIsValid = items.some((tenant) => tenant.id === activeTenantId);
        const nextTenantId = storedIsValid ? storedTenantId : currentIsValid ? activeTenantId : items[0]?.id || null;
        setActiveTenantIdState(nextTenantId);
        if (nextTenantId) sessionStorage.setItem('activeTenantId', nextTenantId);
        else sessionStorage.removeItem('activeTenantId');
      })
      .catch((error) => {
        console.error('No se pudieron cargar tenants', error);
        setTenants([]);
        setActiveTenantIdState(null);
        setActiveMember(null);
        setInstallations([]);
        setActiveInstallationIdState(null);
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !activeTenantId) {
      setActiveMember(null);
      setRoleLoading(false);
      return;
    }

    setRoleLoading(true);
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
        const storedInstallationId = sessionStorage.getItem(installationStorageKey(activeTenantId));
        const storedIsValid = items.some((installation) => installation.id === storedInstallationId);
        const currentIsValid = items.some((installation) => installation.id === activeInstallationId);
        const nextInstallationId = storedIsValid ? storedInstallationId : currentIsValid ? activeInstallationId : items[0]?.id || null;
        setActiveInstallationIdState(nextInstallationId);
        if (nextInstallationId) sessionStorage.setItem(installationStorageKey(activeTenantId), nextInstallationId);
        else sessionStorage.removeItem(installationStorageKey(activeTenantId));
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
    ...permissions,
    isTechnician: permissions.isInternalTechnician || permissions.isExternalTechnician,
    loading,
    roleLoading,
    installationsLoading,
    setActiveTenantId: (tenantId) => {
      setActiveTenantIdState(tenantId);
      setActiveInstallationIdState(null);
      if (tenantId) sessionStorage.setItem('activeTenantId', tenantId);
      else sessionStorage.removeItem('activeTenantId');
    },
    setActiveInstallationId: (installationId) => {
      setActiveInstallationIdState(installationId || null);
      if (activeTenantId && installationId) sessionStorage.setItem(installationStorageKey(activeTenantId), installationId);
      else if (activeTenantId) sessionStorage.removeItem(installationStorageKey(activeTenantId));
    },
    refreshTenants: async () => {
      const items = await listTenants();
      setTenants(items);
      return items;
    },
    refreshInstallations: async () => {
      if (!activeTenantId) return [];
      const items = await listInstallationsForTenant(activeTenantId);
      setInstallations(items);
      return items;
    }
  }), [tenants, activeTenant, activeTenantId, activeMember, activeRole, isSuperAdmin, installations, activeInstallation, activeInstallationId, permissions, loading, roleLoading, installationsLoading]);

  return createElement(TenantContext.Provider, { value }, children);
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant debe usarse dentro de TenantProvider');
  return context;
}
