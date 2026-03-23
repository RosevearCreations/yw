// Detailed Edge Function: jobs-manage
// Purpose:
// - Create/update job drafts and equipment rows
// - Lets supervisor+ prepare work and reserve equipment in the backend

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function roleRank(role: string) {
  return { worker:10, staff:15, onsite_admin:18, site_leader:20, supervisor:30, hse:40, job_admin:45, admin:50 }[role] ?? 0;
}

async function resolveProfileIdByNameOrEmail(supabase: any, value?: string | null) {
  const clean = String(value || '').trim();
  if (!clean) return null;
  let { data } = await supabase.from('profiles').select('id').ilike('email', clean).limit(1).maybeSingle();
  if (data?.id) return data.id;
  ({ data } = await supabase.from('profiles').select('id').ilike('full_name', clean).limit(1).maybeSingle());
  return data?.id || null;
}
async function resolveSiteIdByCodeOrName(supabase: any, value?: string | null) {
  const clean = String(value || '').trim();
  if (!clean) return null;
  let { data } = await supabase.from('sites').select('id').ilike('site_code', clean.split(' — ')[0]).limit(1).maybeSingle();
  if (data?.id) return data.id;
  ({ data } = await supabase.from('sites').select('id').ilike('site_name', clean).limit(1).maybeSingle());
  return data?.id || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok:false, error:'Unauthorized' }, { status:401, headers:corsHeaders });
  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  if (!actorProfile?.is_active || roleRank(actorProfile.role) < roleRank('supervisor')) return Response.json({ ok:false, error:'Supervisor+ required' }, { status:403, headers:corsHeaders });

  const body = await req.json();
  try {
    if (body.entity === 'job' && body.action === 'upsert') {
      const siteId = await resolveSiteIdByCodeOrName(supabase, body.site_name);
      const payload = {
        job_code: body.job_code,
        job_name: body.job_name,
        site_id: siteId,
        job_type: body.job_type ?? null,
        status: body.status ?? 'planned',
        priority: body.priority ?? 'normal',
        client_name: body.client_name ?? null,
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        site_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.supervisor_name),
        signing_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.signing_supervisor_name),
        admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.admin_name),
        notes: body.notes ?? null,
        created_by_profile_id: actorProfile.id,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('jobs').upsert(payload, { onConflict: 'job_code' }).select('*').single();
      if (error) throw error;
      if (Array.isArray(body.requirements)) {
        await supabase.from('job_equipment_requirements').delete().eq('job_id', data.id);
        if (body.requirements.length) {
          await supabase.from('job_equipment_requirements').insert(body.requirements.map((r:any) => ({
            job_id: data.id,
            equipment_name: r.name,
            needed_qty: r.needed_qty ?? 1,
            reserved_qty: r.reserved_qty ?? 0,
            reservation_status: r.status ?? 'needed',
            notes: r.notes ?? null,
          })));
        }
      }
      return Response.json({ ok:true, record: data }, { headers: corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'upsert') {
      const homeSiteId = await resolveSiteIdByCodeOrName(supabase, body.home_site);
      const { data, error } = await supabase.from('equipment_items').upsert({
        equipment_code: body.equipment_code,
        equipment_name: body.equipment_name,
        category: body.category ?? null,
        home_site_id: homeSiteId,
        status: body.status ?? 'available',
        serial_number: body.serial_number ?? null,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'equipment_code' }).select('*').single();
      if (error) throw error;
      return Response.json({ ok:true, record: data }, { headers: corsHeaders });
    }

    return Response.json({ ok:false, error:'Unsupported entity/action' }, { status:400, headers:corsHeaders });
  } catch (error) {
    return Response.json({ ok:false, error:String(error) }, { status:500, headers:corsHeaders });
  }
});
