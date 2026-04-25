// Detailed Edge Function: review-list
// Purpose:
// - Return filtered submission rows for the Logbook screen with proper CORS handling

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizeRole(role?: string | null) {
  const clean = String(role || '').trim().toLowerCase();
  if (clean === 'worker' || clean === 'staff') return 'employee';
  return clean || 'employee';
}

function roleRank(role: string) {
  return { employee:10, worker:10, staff:10, onsite_admin:18, site_leader:20, supervisor:30, hse:40, job_admin:45, admin:50 }[normalizeRole(role)] ?? 0;
}


function normalizeFormFilter(value?: string | null) {
  const clean = String(value || '').trim().toLowerCase();
  const map: Record<string, string[]> = {
    toolbox: ['toolbox','e'],
    ppe: ['ppe','d'],
    firstaid: ['firstaid','first_aid','b'],
    inspection: ['inspection','site_inspection','inspect','c'],
    drill: ['drill','emergency_drill','a'],
    incident: ['incident','incident_near_miss','near_miss','f'],
  };
  return map[clean] || (clean ? [clean] : []);
}

function formLabel(value?: string | null) {
  const clean = String(value || '').trim().toLowerCase();
  if (['toolbox','e'].includes(clean)) return 'Toolbox Talk';
  if (['ppe','d'].includes(clean)) return 'PPE Check';
  if (['firstaid','first_aid','b'].includes(clean)) return 'First Aid Kit';
  if (['inspection','site_inspection','inspect','c'].includes(clean)) return 'Site Inspection';
  if (['drill','emergency_drill','a'].includes(clean)) return 'Emergency Drill';
  if (['incident','incident_near_miss','near_miss','f'].includes(clean)) return 'Incident / Near Miss';
  return String(value || '');
}

function effectiveRole(profile: any, user: any) {
  const direct = normalizeRole(profile?.role);
  const tier = normalizeRole(profile?.staff_tier || user?.user_metadata?.staff_tier);
  const meta = normalizeRole(user?.user_metadata?.role);
  if (direct === 'admin' || tier === 'admin' || meta === 'admin') return 'admin';
  if (direct === 'supervisor' || tier === 'supervisor' || meta === 'supervisor') return 'supervisor';
  return direct || tier || meta || 'employee';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  try {
    const supabase = createClient((Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL'))!, (Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!);
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return Response.json({ ok:false, error:'Unauthorized' }, { status:401, headers:corsHeaders });

    const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
    const actorRole = effectiveRole(actorProfile, userData.user);
    if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });

    const body = await req.json().catch(() => ({}));
    const siteFilter = String(body.site || '').trim().toLowerCase();
    const formFilter = String(body.form || '').trim().toLowerCase();
    const formFilterValues = normalizeFormFilter(formFilter);
    const statusFilter = String(body.status || '').trim().toLowerCase();
    const fromDate = String(body.from || '').trim();
    const toDate = String(body.to || '').trim();

    let query = supabase.from('submissions').select('*').order('created_at', { ascending:false }).limit(500);
    if (formFilterValues.length === 1) query = query.ilike('form_type', formFilterValues[0]);
    if (formFilterValues.length > 1) query = query.or(formFilterValues.map((value) => `form_type.ilike.${value}`).join(','));
    if (statusFilter) query = query.eq('status', statusFilter);
    if (fromDate) query = query.gte('submission_date', fromDate);
    if (toDate) query = query.lte('submission_date', toDate);

    const { data, error } = await query;
    if (error) return Response.json({ ok:false, error:error.message }, { status:500, headers:corsHeaders });

    const rows = (data || []).filter((row: any) => {
      const siteText = String(row.site || row.site_name || row.site_code || '').toLowerCase();
      if (siteFilter && !siteText.includes(siteFilter)) return false;
      if (roleRank(actorRole) < roleRank('supervisor')) {
        const owner = String(row.profile_id || row.created_by_profile_id || '');
        return owner === String(actorProfile.id);
      }
      return true;
    }).map((row: any) => ({
      id: row.id,
      submission_date: row.submission_date || row.date || row.created_at,
      created_at: row.created_at,
      form_type: row.form_type || '',
      form_label: formLabel(row.form_type || ''),
      site: row.site || row.site_name || row.site_code || '',
      site_name: row.site_name || row.site || '',
      status: row.status || 'submitted',
      admin_notes: row.admin_notes || '',
      payload: row.payload || {},
      summary: row.summary || ''
    }));

    return Response.json({ ok:true, rows }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ ok:false, error: err?.message || 'Review list failed.' }, { status:500, headers:corsHeaders });
  }
});
