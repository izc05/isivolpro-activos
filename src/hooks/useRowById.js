import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

export function useRowById(table, id, select = '*') {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase.from(table).select(select).eq('id', id).single()
      .then(({ data, error }) => {
        if (error) throw error;
        setRow(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [table, id, select]);

  return { row, loading };
}
