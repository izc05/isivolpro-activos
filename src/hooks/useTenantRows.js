import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useTenant } from './useTenant';

export function useTenantRows(table, select = '*', options = {}) {
  const { activeTenantId } = useTenant();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!activeTenantId) return;
    setLoading(true);
    let query = supabase.from(table).select(select).eq('tenant_id', activeTenantId);
    if (options.order) query = query.order(options.order, { ascending: options.ascending ?? false });
    query
      .then(({ data, error }) => {
        if (error) throw error;
        setRows(data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTenantId, table, select, options.order, options.ascending]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rows, loading, activeTenantId, refresh };
}
