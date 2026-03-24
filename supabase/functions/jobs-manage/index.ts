// Detailed Edge Function: jobs-manage
// Purpose:
// - Create/update jobs and equipment records
// - Reserve equipment for jobs
// - Check equipment out to jobs and return it
// - Enforce basic availability rules

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
async function resolveJobIdByCode(supabase: any, code?: string | null) {
  const clean = String(code || '').trim();
  if (!clean) return null;
  const { data } = await supabase.from('jobs').select('id').eq('job_code', clean).limit(1).maybeSingle();
  return data?.id || null;
}
async function resolveEquipmentIdByCode(supabase: any, code?: string | null) {
  const clean = String(code || '').trim();
  if (!clean) return null;
  const { data } = await supabase.from('equipment_items').select('id').eq('equipment_code', clean).limit(1).maybeSingle();
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

  const body = await req.json().catch(() => ({}));
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
        for (const r of body.requirements) {
          const neededQty = Number(r.needed_qty ?? 1);
          const equipmentId = await resolveEquipmentIdByCode(supabase, r.equipment_code || r.name);
          let reservedQty = 0;
          if (equipmentId) {
            const { data: item } = await supabase.from('equipment_items').select('status').eq('id', equipmentId).single();
            if (item?.status === 'available' || item?.status === 'reserved') reservedQty = 1;
          }
          await supabase.from('job_equipment_requirements').insert({
            job_id: data.id,
            equipment_item_id: equipmentId,
            equipment_code: r.equipment_code || null,
            equipment_name: r.name,
            needed_qty: neededQty,
            reserved_qty: reservedQty,
            reservation_status: reservedQty >= Math.min(1, neededQty) ? 'reserved' : 'needed',
            notes: r.notes ?? null,
          });
          if (equipmentId && reservedQty > 0) {
            await supabase.from('equipment_items').update({ status: 'reserved', current_job_id: data.id, assigned_supervisor_profile_id: payload.site_supervisor_profile_id, updated_at: new Date().toISOString() }).eq('id', equipmentId);
          }
        }
      }
      return Response.json({ ok:true, record: data }, { headers: corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'upsert') {
      const homeSiteId = await resolveSiteIdByCodeOrName(supabase, body.home_site);
      const currentJobId = await resolveJobIdByCode(supabase, body.current_job_code);
      const { data, error } = await supabase.from('equipment_items').upsert({
        equipment_code: body.equipment_code,
        equipment_name: body.equipment_name,
        category: body.category ?? null,
        home_site_id: homeSiteId,
        status: body.status ?? 'available',
        current_job_id: currentJobId,
        assigned_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.assigned_supervisor_name),
        serial_number: body.serial_number ?? null,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'equipment_code' }).select('*').single();
      if (error) throw error;
      return Response.json({ ok:true, record: data }, { headers: corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'checkout') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      const jobId = await resolveJobIdByCode(supabase, body.job_code);
      if (!equipmentId || !jobId) return Response.json({ ok:false, error:'Equipment and job are required' }, { status:400, headers:corsHeaders });
      const { data: item } = await supabase.from('equipment_items').select('*').eq('id', equipmentId).single();
      if (!item) return Response.json({ ok:false, error:'Equipment not found' }, { status:404, headers:corsHeaders });
      if (!['available','reserved'].includes(item.status)) return Response.json({ ok:false, error:'Equipment is not available for checkout' }, { status:409, headers:corsHeaders });
      await supabase.from('equipment_items').update({ status:'checked_out', current_job_id: jobId, assigned_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.supervisor_name), updated_at:new Date().toISOString() }).eq('id', equipmentId);
      const { data, error } = await supabase.from('equipment_signouts').insert({ equipment_item_id: equipmentId, job_id: jobId, checked_out_by_profile_id: actorProfile.id, checked_out_to_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.supervisor_name), signout_notes: body.notes ?? null }).select('*').single();
      if (error) throw error;
      await supabase.from('admin_notifications').insert({ notification_type:'equipment_checkout', target_table:'equipment_signouts', target_id:data.id, recipient_role:'admin', subject:`Equipment checked out: ${body.equipment_code}`, body: JSON.stringify({ equipment_code: body.equipment_code, job_code: body.job_code }), status:'queued', created_by_profile_id: actorProfile.id });
      return Response.json({ ok:true, record:data }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'return') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      await supabase.from('equipment_items').update({ status:'available', current_job_id:null, assigned_supervisor_profile_id:null, updated_at:new Date().toISOString() }).eq('id', equipmentId);
      const { data: signout } = await supabase.from('equipment_signouts').select('*').eq('equipment_item_id', equipmentId).is('returned_at', null).order('checked_out_at', { ascending:false }).limit(1).maybeSingle();
      if (signout?.id) await supabase.from('equipment_signouts').update({ returned_at:new Date().toISOString() }).eq('id', signout.id);
      await supabase.from('admin_notifications').insert({ notification_type:'equipment_return', target_table:'equipment_items', target_id:equipmentId, recipient_role:'admin', subject:`Equipment returned: ${body.equipment_code}`, body: JSON.stringify({ equipment_code: body.equipment_code }), status:'queued', created_by_profile_id: actorProfile.id });
      return Response.json({ ok:true }, { headers:corsHeaders });
    }

    return Response.json({ ok:false, error:'Unsupported entity/action' }, { status:400, headers:corsHeaders });
  } catch (error) {
    return Response.json({ ok:false, error:String(error) }, { status:500, headers:corsHeaders });
  }
});
