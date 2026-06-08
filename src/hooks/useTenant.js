import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import { listTenants } from '../services/tenantService';
import { useAuth } from './useAuth';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [activeTenantId, setActiveTenantId] = useState(sessionStorage.getItem('activeTenantId'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setTenants([]);
      setActiveTenantId(null);
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

  const activeTenant = tenants.find((tenant) => tenant.id === activeTenantId) || null;

  const value = useMemo(() => ({
    tenants,
    activeTenant,
    activeTenantId,
    loading,
    setActiveTenantId: (tenantId) => {
      setActiveTenantId(tenantId);
      if (tenantId) sessionStorage.setItem('activeTenantId', tenantId);
    },
    refreshTenants: async () => setTenants(await listTenants())
  }), [tenants, activeTenant, activeTenantId, loading]);

  return createElement(TenantContext.Provider, { value }, children);
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant debe usarse dentro de TenantProvider');
  return context;
}
