import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentTenantMember, listTenants } from '../services/tenantService';
import { buildTenantPermissions, roleLabel } from '../utils/permissions';
import { useAuth } from './useAuth';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const { isAuthenticated, isSuperAdmin } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [activeTenantId, setActiveTenantIdState] = useState(sessionStorage.getItem('activeTenantId'));
  const [activeMember, setActiveMember] = useState(null);
  const [loading, setLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setTenants([]);
      setActiveTenantIdState(null);
      setActiveMember(null);
      setRoleLoading(false);
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

  const activeTenant = tenants.find((tenant) => tenant.id === activeTenantId) || null;
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
    ...permissions,
    isTechnician: permissions.isInternalTechnician || permissions.isExternalTechnician,
    loading,
    roleLoading,
    setActiveTenantId: (tenantId) => {
      setActiveTenantIdState(tenantId);
      if (tenantId) sessionStorage.setItem('activeTenantId', tenantId);
      else sessionStorage.removeItem('activeTenantId');
    },
    refreshTenants: async () => {
      const items = await listTenants();
      setTenants(items);
      return items;
    }
  }), [tenants, activeTenant, activeTenantId, activeMember, activeRole, isSuperAdmin, permissions, loading, roleLoading]);

  return createElement(TenantContext.Provider, { value }, children);
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant debe usarse dentro de TenantProvider');
  return context;
}
