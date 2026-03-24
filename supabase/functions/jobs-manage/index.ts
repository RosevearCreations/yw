// Detailed Edge Function: jobs-manage
// Purpose:
// - Create/update jobs and equipment records
// - Reserve equipment for jobs using real quantity-pool checks across overlapping jobs
// - Check equipment out to jobs and return it
// - Queue approval/conflict notifications and send email when configured

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function roleRank(role: string) {
  return { worker:10, staff:15, onsite_admin:18, site_leader:20, supervisor:30, hse:40, job_admin:45, admin:50 }[role] ?? 0;
}
function normalizePoolKey(value?: string | null) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function overlaps(aStart?: string | null, aEnd?: string | null, bStart?: string | null, bEnd?: string | null) {
  const a1 = aStart || '1900-01-01';
  const a2 = aEnd || aStart || '2999-12-31';
  const b1 = bStart || '1900-01-01';
  const b2 = bEnd || bStart || '2999-12-31';
  return a1 <= b2 && b1 <= a2;
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
async function sendEmailIfConfigured(notification: any) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM');
  const to = notification?.email_to || Deno.env.get('ADMIN_NOTIFICATION_TO');
  if (!apiKey || !from || !to) return { attempted: false, status: 'pending' };

  const subject = notification?.email_subject || notification?.title || 'YWI HSE notification';
  const text = notification?.body || notification?.message || JSON.stringify(notification?.payload || {});
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: String(to).split(/[;,]/).map((v) => v.trim()).filter(Boolean), subject, text })
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend email failed: ${body}`);
  return { attempted: true, status: 'sent' };
}
async function insertNotification(supabase: any, row: any) {
  const payload = row?.payload || {};
  const insertRow = {
    notification_type: row.notification_type,
    recipient_role: row.recipient_role || 'admin',
    target_profile_id: row.target_profile_id || null,
    target_table: row.target_table || null,
    target_id: row.target_id != null ? String(row.target_id) : null,
    title: row.title || 'Notification',
    body: row.body || row.message || JSON.stringify(payload),
    message: row.message || row.body || JSON.stringify(payload),
    payload,
    status: row.status || 'queued',
    email_to: row.email_to || null,
    email_subject: row.email_subject || row.title || 'Notification',
    email_status: 'pending',
    created_by_profile_id: row.created_by_profile_id || null,
  };
  const { data, error } = await supabase.from('admin_notifications').insert(insertRow).select('*').single();
  if (error) throw error;
  try {
    const sent = await sendEmailIfConfigured(insertRow);
    if (sent.attempted) {
      await supabase.from('admin_notifications').update({ email_status: sent.status, status: 'sent', sent_at: new Date().toISOString() }).eq('id', data.id);
    }
  } catch (err) {
    await supabase.from('admin_notifications').update({ email_status: 'failed', email_error: String(err), status: 'failed' }).eq('id', data.id);
  }
  return data;
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
      const supervisorId = await resolveProfileIdByNameOrEmail(supabase, body.supervisor_name);
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
        site_supervisor_profile_id: supervisorId,
        signing_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.signing_supervisor_name),
        admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.admin_name),
        approval_status: body.request_approval ? 'requested' : (body.approval_status ?? 'not_requested'),
        approval_requested_at: body.request_approval ? new Date().toISOString() : null,
        notes: body.notes ?? null,
        created_by_profile_id: actorProfile.id,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('jobs').upsert(payload, { onConflict: 'job_code' }).select('*').single();
      if (error) throw error;

      const { data: allJobs } = await supabase.from('jobs').select('id,job_code,start_date,end_date').neq('id', data.id);
      const { data: allEquipment } = await supabase.from('equipment_items').select('*').order('equipment_code');
      const otherJobs = allJobs || [];
      const equipmentRows = allEquipment || [];

      if (Array.isArray(body.requirements)) {
        await supabase.from('job_equipment_requirements').delete().eq('job_id', data.id);
        for (const r of body.requirements) {
          const neededQty = Math.max(0, Number(r.needed_qty ?? 1));
          const requestedCode = String(r.equipment_code || '').trim();
          const directEquipmentId = requestedCode ? await resolveEquipmentIdByCode(supabase, requestedCode) : null;
          const poolKey = normalizePoolKey(r.equipment_pool_key || r.pool_key || r.name || r.category || requestedCode);

          let candidates = equipmentRows.filter((item: any) => {
            if (directEquipmentId) return item.id === directEquipmentId;
            if (requestedCode) return String(item.equipment_code || '').trim() === requestedCode;
            return normalizePoolKey(item.equipment_pool_key || item.category || item.equipment_name || item.equipment_code) === poolKey;
          });
          if (!candidates.length && requestedCode) {
            candidates = equipmentRows.filter((item: any) => normalizePoolKey(item.equipment_pool_key || item.category || item.equipment_name || item.equipment_code) === poolKey);
          }

          const overlappingJobIds = new Set(otherJobs.filter((job: any) => overlaps(data.start_date, data.end_date, job.start_date, job.end_date)).map((job: any) => job.id));
          const blocked = candidates.filter((item: any) => {
            if (item.current_job_id && overlappingJobIds.has(item.current_job_id)) return true;
            return item.status === 'checked_out';
          });
          const free = candidates.filter((item: any) => !blocked.some((b: any) => b.id === item.id) && ['available','reserved'].includes(item.status));
          const reserved = free.slice(0, neededQty);
          const reservedQty = reserved.length;
          const reservationStatus = reservedQty >= neededQty ? 'reserved' : 'needed';

          await supabase.from('job_equipment_requirements').insert({
            job_id: data.id,
            equipment_item_id: directEquipmentId,
            equipment_code: requestedCode || null,
            equipment_name: r.name,
            equipment_pool_key: poolKey || null,
            needed_qty: neededQty,
            reserved_qty: reservedQty,
            reservation_status: reservationStatus,
            approval_status: reservedQty >= neededQty ? 'not_required' : 'pending',
            notes: r.notes ?? null,
          });

          if (reservedQty) {
            await supabase.from('equipment_items').update({ status: 'reserved', current_job_id: data.id, assigned_supervisor_profile_id: supervisorId, equipment_pool_key: poolKey || null, updated_at: new Date().toISOString() }).in('id', reserved.map((x: any) => x.id));
          }

          if (reservedQty < neededQty) {
            await insertNotification(supabase, {
              notification_type: 'equipment_reservation_conflict',
              recipient_role: 'admin',
              target_table: 'jobs',
              target_id: data.id,
              title: `Reservation conflict for job ${data.job_code}`,
              body: JSON.stringify({ job_code: data.job_code, equipment_name: r.name, pool_key: poolKey, needed_qty: neededQty, reserved_qty: reservedQty, available_codes: free.map((x: any) => x.equipment_code), blocked_codes: blocked.map((x: any) => x.equipment_code) }),
              created_by_profile_id: actorProfile.id,
              email_subject: `YWI HSE reservation conflict: ${data.job_code}`,
              payload: { job_code: data.job_code, equipment_name: r.name, pool_key: poolKey, needed_qty: neededQty, reserved_qty: reservedQty }
            });
          }
        }
      }

      if (body.request_approval) {
        await insertNotification(supabase, {
          notification_type: 'job_approval_requested',
          recipient_role: 'admin',
          target_table: 'jobs',
          target_id: data.id,
          title: `Job approval requested: ${data.job_code}`,
          body: JSON.stringify({ job_code: data.job_code, job_name: data.job_name, start_date: data.start_date, end_date: data.end_date }),
          created_by_profile_id: actorProfile.id,
          email_subject: `YWI HSE job approval requested: ${data.job_code}`,
          payload: { job_code: data.job_code, job_name: data.job_name }
        });
      }
      return Response.json({ ok:true, record: data }, { headers: corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'upsert') {
      const homeSiteId = await resolveSiteIdByCodeOrName(supabase, body.home_site);
      const currentJobId = await resolveJobIdByCode(supabase, body.current_job_code);
      const poolKey = normalizePoolKey(body.equipment_pool_key || body.category || body.equipment_name || body.equipment_code);
      const { data, error } = await supabase.from('equipment_items').upsert({
        equipment_code: body.equipment_code,
        equipment_name: body.equipment_name,
        category: body.category ?? null,
        home_site_id: homeSiteId,
        status: body.status ?? 'available',
        current_job_id: currentJobId,
        assigned_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.assigned_supervisor_name),
        equipment_pool_key: poolKey || null,
        serial_number: body.serial_number ?? null,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'equipment_code' }).select('*').single();
      if (error) throw error;
      return Response.json({ ok:true, record: data }, { headers:corsHeaders });
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
      await insertNotification(supabase, { notification_type:'equipment_checkout', target_table:'equipment_signouts', target_id:data.id, recipient_role:'admin', title:`Equipment checked out: ${body.equipment_code}`, body: JSON.stringify({ equipment_code: body.equipment_code, job_code: body.job_code }), created_by_profile_id: actorProfile.id, email_subject: `YWI HSE equipment checkout: ${body.equipment_code}`, payload: { equipment_code: body.equipment_code, job_code: body.job_code } });
      return Response.json({ ok:true, record:data }, { headers:corsHeaders });
    }

    if (body.entity === 'equipment' && body.action === 'return') {
      const equipmentId = await resolveEquipmentIdByCode(supabase, body.equipment_code);
      if (!equipmentId) return Response.json({ ok:false, error:'Equipment required' }, { status:400, headers:corsHeaders });
      await supabase.from('equipment_items').update({ status:'available', current_job_id:null, assigned_supervisor_profile_id:null, updated_at:new Date().toISOString() }).eq('id', equipmentId);
      const { data: signout } = await supabase.from('equipment_signouts').select('*').eq('equipment_item_id', equipmentId).is('returned_at', null).order('checked_out_at', { ascending:false }).limit(1).maybeSingle();
      if (signout?.id) await supabase.from('equipment_signouts').update({ returned_at:new Date().toISOString() }).eq('id', signout.id);
      await insertNotification(supabase, { notification_type:'equipment_return', target_table:'equipment_items', target_id:equipmentId, recipient_role:'admin', title:`Equipment returned: ${body.equipment_code}`, body: JSON.stringify({ equipment_code: body.equipment_code }), created_by_profile_id: actorProfile.id, email_subject: `YWI HSE equipment return: ${body.equipment_code}`, payload: { equipment_code: body.equipment_code } });
      return Response.json({ ok:true }, { headers:corsHeaders });
    }

    return Response.json({ ok:false, error:'Unsupported entity/action' }, { status:400, headers:corsHeaders });
  } catch (error) {
    return Response.json({ ok:false, error:String(error) }, { status:500, headers:corsHeaders });
  }
});
