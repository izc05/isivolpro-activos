import { supabase } from './supabaseClient';
import { logAudit } from './auditService';

export async function listTenants() {
  const { data, error } = await supabase.from('tenants').select('*').order('nombre');
  if (error) throw error;
  return data || [];
}

export async function listTenantMembers(tenantId) {
  const { data, error } = await supabase
    .from('tenant_members')
    .select('*, profiles(nombre,email,avatar_url,mfa_required)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createTenantAsOwner(payload) {
  const { data, error } = await supabase.rpc('create_tenant_as_owner', {
    tenant_name: payload.nombre,
    tenant_cif: payload.cif || null,
    tenant_direccion: payload.direccion || null,
    tenant_telefono: payload.telefono || null,
    tenant_email: payload.email || null
  });

  if (error) throw error;
  return data;
}

export async function updateTenant(payload) {
  const { data, error } = await supabase
    .from('tenants')
    .update({
      nombre: payload.nombre,
      cif: payload.cif || null,
      direccion: payload.direccion || null,
      telefono: payload.telefono || null,
      email: payload.email || null,
      estado: payload.estado || 'activo',
      plan: payload.plan || 'starter',
      billing_status: payload.billing_status || 'trial',
      max_instalaciones: Number(payload.max_instalaciones || 5),
      max_activos: Number(payload.max_activos || 100),
      max_storage_mb: Number(payload.max_storage_mb || 1024),
      subscription_ends_at: payload.subscription_ends_at || null
    })
    .eq('id', payload.id)
    .select()
    .single();

  if (error) throw error;
  await logAudit({ tenantId: payload.id, action: 'update_tenant', entityType: 'tenant', entityId: payload.id });
  return data;
}

export async function dashboardMetrics(tenantId) {
  const [installations, assets, incidents, documents] = await Promise.all([
    supabase.from('instalaciones').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('activos').select('id,estado,fecha_proxima_revision', { count: 'exact' }).eq('tenant_id', tenantId),
    supabase.from('incidencias').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).neq('estado', 'cerrada'),
    supabase.from('documentos').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5)
  ]);

  if (installations.error) throw installations.error;
  if (assets.error) throw assets.error;
  if (incidents.error) throw incidents.error;
  if (documents.error) throw documents.error;

  const now = new Date();
  const pendingReview = (assets.data || []).filter((asset) => {
    if (asset.estado === 'pendiente' || asset.estado === 'averiado') return true;
    if (!asset.fecha_proxima_revision) return false;
    return new Date(asset.fecha_proxima_revision) <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }).length;

  return {
    totalInstalaciones: installations.count || 0,
    totalActivos: assets.count || 0,
    pendientesRevision: pendingReview,
    incidenciasAbiertas: incidents.count || 0,
    documentosRecientes: documents.data || []
  };
}
