import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../services/supabaseClient';

export function usePermissions(activeTenantId) {
  const { isSuperAdmin, user } = useAuth();

  return useMemo(() => ({
    isSuperAdmin,
    canRead: Boolean(user && activeTenantId),
    canManageTenant: async () => {
      if (!activeTenantId) return false;
      const { data } = await supabase.rpc('can_manage_tenant', { tenant_uuid: activeTenantId });
      return Boolean(data);
    },
    hasRole: async (role) => {
      if (!activeTenantId) return false;
      const { data } = await supabase.rpc('has_tenant_role', { tenant_uuid: activeTenantId, role_text: role });
      return Boolean(data);
    }
  }), [isSuperAdmin, user, activeTenantId]);
}
