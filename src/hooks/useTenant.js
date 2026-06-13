import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentTenantMember, listTenants } from '../services/tenantService';
import { useAuth } from './useAuth';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const { isAuthenticated, isSuperAdmin } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [activeTenantId, setActiveTenantId] = useState(sessionStorage.getItem('activeTenantId'));
  const [activeMember, setActiveMember] = useState(null);
  const [loading, setLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setTenants([]);
      setActiveTenantId(null);
      setActiveMember(null);
      setRoleLoading(false);
      return;
    }

    setLoading(true);
    listTenants()
      .then((items) => {
        setTenants(items);
        const storedIsValid = items.some((tenant) => tenant.id === activeTenantId);
        const nextTenantId = storedIsValid ? activeTenantId : items[0]?.id || null;
        setActiveTenantId(nextTenantId);
        if (nextTenantId) sessionStorage.setItem('activeTenantId', nextTenantId);
      })
      .catch((error) => console.error('No se pudieron cargar tenants', error))
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
  const activeRole = activeMember?.role || null;
  const isTenantAdmin = Boolean(isSuperAdmin || activeRole === 'admin_cliente');
  const isTechnician = ['tecnico', 'tecnico_externo'].includes(activeRole);

  const value = useMemo(() => ({
    tenants,
    activeTenant,
    activeTenantId,
    activeMember,
    activeRole,
    isTenantAdmin,
    isTechnician,
    loading,
    roleLoading,
    setActiveTenantId: (tenantId) => {
      setActiveTenantId(tenantId);
      if (tenantId) sessionStorage.setItem('activeTenantId', tenantId);
    },
    refreshTenants: async () => setTenants(await listTenants())
  }), [tenants, activeTenant, activeTenantId, activeMember, activeRole, isTenantAdmin, isTechnician, loading, roleLoading]);

  return createElement(TenantContext.Provider, { value }, children);
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant debe usarse dentro de TenantProvider');
  return context;
}
