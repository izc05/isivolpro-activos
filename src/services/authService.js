import { supabase } from './supabaseClient';
import { logAudit } from './auditService';

export async function signIn(email, password) {
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (!result.error) {
    await logAudit({ tenantId: null, action: 'login', metadata: { email } });
  }
  return result;
}

export async function signUpWithInvitationEmail(email, password) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/registro`
    }
  });
}

export async function signUpDemoUser({ nombre, email, password }) {
  const signup = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre },
      emailRedirectTo: `${window.location.origin}/registro`
    }
  });
  if (signup.error) return signup;

  if (!signup.data.session) {
    return {
      ...signup,
      pendingEmailConfirmation: true
    };
  }

  const { error } = await supabase.rpc('claim_demo_access', {
    demo_name: nombre
  });

  if (error) return { data: signup.data, error };
  return signup;
}

export async function claimDemoAccess(nombre) {
  return supabase.rpc('claim_demo_access', {
    demo_name: nombre
  });
}

export async function signOut() {
  await logAudit({ tenantId: null, action: 'logout' });
  return supabase.auth.signOut();
}

export function resetPassword(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/settings`
  });
}

export async function getProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function upsertOwnProfile(profile) {
  const { data, error } = await supabase.from('profiles').upsert(profile).select().single();
  if (error) throw error;
  return data;
}
