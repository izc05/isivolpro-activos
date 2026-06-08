import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { getProfile } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        try {
          setProfile(await getProfile(data.session.user.id));
        } catch (error) {
          console.error('No se pudo cargar el perfil', error);
        }
      }
      setLoading(false);
    }

    loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setProfile(nextSession?.user ? await getProfile(nextSession.user.id).catch(() => null) : null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    profile,
    loading,
    isAuthenticated: Boolean(session?.user),
    isSuperAdmin: profile?.global_role === 'super_admin',
    refreshProfile: async () => {
      if (session?.user) setProfile(await getProfile(session.user.id));
    }
  }), [session, profile, loading]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
