// Detailed Edge Function: admin-manage
// Purpose:
// - Admin CRUD for profiles/sites/assignments
// - Self profile updates for employee contact/preferences fields
// - Resolve supervisor/admin name fields to profile ids for hierarchy management
// - Admin approval / dismissal actions for notifications

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


async function updateDeliveryState(supabase: any, notificationId: any, kind: 'email' | 'sms', provider: string, ok: boolean, errorText = '') {
  if (!notificationId) return;
  const countField = kind === 'sms' ? 'sms_attempt_count' : 'email_attempt_count';
  const providerField = kind === 'sms' ? 'sms_provider' : 'email_provider';
  const attemptField = kind === 'sms' ? 'sms_last_attempt_at' : 'email_last_attempt_at';
  const { data: current } = await supabase.from('admin_notifications').select(`id,${countField}`).eq('id', notificationId).maybeSingle();
  const attemptCount = Number(current?.[countField] || 0) + 1;
  const patch: Record<string, unknown> = {
    [countField]: attemptCount,
    [providerField]: provider,
    [attemptField]: new Date().toISOString(),
  };
  if (kind === 'email') {
    patch.email_status = ok ? 'sent' : 'failed';
    patch.email_error = ok ? null : String(errorText || '');
  }
  if (!ok && attemptCount >= 3) {
    patch.dead_lettered_at = new Date().toISOString();
    patch.dead_letter_reason = `${kind}:${String(errorText || 'delivery failed')}`;
    patch.status = 'dead_letter';
  }
  await supabase.from('admin_notifications').update(patch).eq('id', notificationId);
}

async function sendEmailIfConfigured(row: any, overrides: Record<string, unknown> = {}) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM');
  const to = String(overrides.email_to || row?.email_to || Deno.env.get('ADMIN_NOTIFICATION_TO') || '').trim();
  if (!apiKey || !from || !to) return { attempted: false, status: 'pending', error: '' };
  const subject = String(overrides.email_subject || row?.email_subject || row?.title || 'YWI HSE notification');
  const text = String(overrides.body || row?.body || row?.message || JSON.stringify(row?.payload || {}));
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: to.split(/[;,]/).map((v) => v.trim()).filter(Boolean),
      subject,
      text,
    })
  });
  const body = await res.text();
  if (!res.ok) throw new Error(body);
  return { attempted: true, status: 'sent', error: '' };
}

async function resolveProfileIdByNameOrEmail(supabase: any, value?: string | null) {
  const clean = String(value || '').trim();
  if (!clean) return null;
  let { data } = await supabase.from('profiles').select('id').ilike('email', clean).limit(1).maybeSingle();
  if (data?.id) return data.id;
  ({ data } = await supabase.from('profiles').select('id').ilike('full_name', clean).limit(1).maybeSingle());
  return data?.id || null;
}


async function resolveProfileByIdOrEmail(supabase: any, profileId?: string | null, email?: string | null) {
  const cleanId = String(profileId || '').trim();
  if (cleanId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', cleanId).maybeSingle();
    if (data) return data;
  }
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanEmail) {
    const { data } = await supabase.from('profiles').select('*').ilike('email', cleanEmail).maybeSingle();
    if (data) return data;
  }
  return null;
}

function getCatalogConfig(catalogType: string) {
  const key = String(catalogType || '').trim().toLowerCase();
  const map: Record<string, { table: string; nameColumn: string }> = {
    position: { table: 'position_catalog', nameColumn: 'name' },
    trade: { table: 'trade_catalog', nameColumn: 'name' },
    staff_tier: { table: 'staff_tier_catalog', nameColumn: 'name' },
    seniority: { table: 'seniority_level_catalog', nameColumn: 'name' },
    employment_status: { table: 'employment_status_catalog', nameColumn: 'name' },
    job_type: { table: 'job_type_catalog', nameColumn: 'name' },
    tax_code: { table: 'tax_codes', nameColumn: 'name' },
    service_pricing_template: { table: 'service_pricing_templates', nameColumn: 'template_name' },
  };
  return map[key] || null;
}


function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asNullableText(value: unknown) {
  const clean = String(value ?? '').trim();
  return clean ? clean : null;
}

function asNullableBool(value: unknown) {
  return value === undefined ? null : !!value;
}

function asNullableDate(value: unknown) {
  const clean = String(value ?? '').trim();
  return clean ? clean : null;
}

function asNullableDateTime(value: unknown) {
  const clean = String(value ?? '').trim();
  return clean ? clean : null;
}

async function getCostCodeIdByCode(supabase: any, code: string) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return null;
  const { data } = await supabase.from('cost_codes').select('id').eq('code', clean).maybeSingle();
  return data?.id || null;
}

async function getMaterialDefaults(supabase: any, materialId?: string | null) {
  const id = String(materialId || '').trim();
  if (!id) return null;
  const { data } = await supabase.from('materials_catalog').select('id,item_name,unit_id,default_unit_cost,default_bill_rate').eq('id', id).maybeSingle();
  return data || null;
}

async function getEquipmentDefaults(supabase: any, equipmentId?: string | null) {
  const id = String(equipmentId || '').trim();
  if (!id) return null;
  const { data } = await supabase.from('equipment_master').select('id,item_name,cost_rate_hourly,bill_rate_hourly').eq('id', id).maybeSingle();
  return data || null;
}

async function getWorkOrderLineDefaults(supabase: any, workOrderLineId?: string | null) {
  const id = String(workOrderLineId || '').trim();
  if (!id) return null;
  const { data } = await supabase.from('work_order_lines').select('id,work_order_id,description,unit_id,unit_cost,unit_price,cost_code_id,material_id').eq('id', id).maybeSingle();
  return data || null;
}

async function getRouteStopDefaults(supabase: any, routeStopId?: string | null) {
  const id = String(routeStopId || '').trim();
  if (!id) return null;
  const { data } = await supabase.from('route_stops').select('id,route_id,client_site_id,stop_order,instructions').eq('id', id).maybeSingle();
  return data || null;
}

async function getLinkedHsePacketDefaults(supabase: any, packetId?: string | null) {
  const id = String(packetId || '').trim();
  if (!id) return null;
  const { data } = await supabase.from('linked_hse_packets').select('id,job_id,work_order_id,dispatch_id,client_site_id,route_id,equipment_master_id,supervisor_profile_id,packet_number').eq('id', id).maybeSingle();
  return data || null;
}

async function recordSiteActivity(supabase: any, payload: any) {
  try {
    await supabase.from('site_activity_events').insert({
      event_type: payload.event_type,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id != null ? String(payload.entity_id) : null,
      severity: payload.severity || 'info',
      title: payload.title || 'Activity recorded',
      summary: payload.summary || null,
      metadata: payload.metadata || {},
      related_job_id: payload.related_job_id || null,
      related_profile_id: payload.related_profile_id || null,
      related_equipment_id: payload.related_equipment_id || null,
      created_by_profile_id: payload.created_by_profile_id || null,
      occurred_at: payload.occurred_at || new Date().toISOString(),
    });
  } catch {
    // ignore activity audit failures so the main workflow still succeeds
  }
}

function validateAdminSetPassword(password?: string | null) {
  const clean = String(password || '');
  if (!clean) throw new Error('A new password is required.');
  if (clean.length < 10) throw new Error('Password must be at least 10 characters long.');
  if (!/[A-Z]/.test(clean) || !/[a-z]/.test(clean) || !/[0-9]/.test(clean)) {
    throw new Error('Password must include upper, lower, and number characters.');
  }
  return clean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient((Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL'))!, (Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

  const actorId = userData.user.id;
  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', actorId).single();
  if (!actorProfile?.is_active) return Response.json({ ok: false, error: 'Inactive profile' }, { status: 403, headers: corsHeaders });

  const body = await req.json();
  const entity = body.entity;
  const action = body.action;
  const isAdmin = actorProfile.role === 'admin';

  try {
    if (entity === 'profile' && action === 'self_update') {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const field of ['full_name','phone','address_line1','address_line2','city','province','postal_code','vehicle_make_model','vehicle_plate','current_position','trade_specialty','feature_preferences','emergency_contact_name','emergency_contact_phone','start_date','strengths','employee_number']) {
        if (field in body) patch[field] = body[field] ?? null;
      }
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', actorId).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (!isAdmin) return Response.json({ ok: false, error: 'Admin role required' }, { status: 403, headers: corsHeaders });


    if (entity === 'credential' && action === 'create_user') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = validateAdminSetPassword(body.new_password || body.password || '');
      if (!email) return Response.json({ ok:false, error:'Email is required.' }, { status:400, headers:corsHeaders });
      const role = String(body.role || 'employee').trim().toLowerCase() || 'employee';
      const createResp = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: !!body.email_verified,
        phone_confirm: !!body.phone_verified,
        user_metadata: {
          full_name: body.full_name || null,
          role,
          employee_number: body.employee_number || null,
          staff_tier: body.staff_tier || role
        }
      });
      if (createResp.error || !createResp.data?.user) {
        return Response.json({ ok:false, error:createResp.error?.message || 'User create failed.' }, { status:400, headers:corsHeaders });
      }
      const userId = createResp.data.user.id;
      const profilePatch = {
        id: userId,
        email,
        full_name: body.full_name ?? null,
        role,
        is_active: body.is_active ?? true,
        phone: body.phone ?? null,
        phone_verified: !!body.phone_verified,
        email_verified: !!body.email_verified,
        employee_number: body.employee_number ?? null,
        current_position: body.current_position ?? null,
        trade_specialty: body.trade_specialty ?? null,
        seniority_level: body.seniority_level ?? null,
        employment_status: body.employment_status ?? 'active',
        staff_tier: body.staff_tier ?? role,
        start_date: body.start_date ?? null,
        years_employed: body.years_employed ?? null,
        notes: body.notes ?? null,
        hourly_cost_rate: asNullableNumber(body.hourly_cost_rate),
        overtime_cost_rate: asNullableNumber(body.overtime_cost_rate),
        hourly_bill_rate: asNullableNumber(body.hourly_bill_rate),
        overtime_bill_rate: asNullableNumber(body.overtime_bill_rate),
        payroll_burden_percent: asNullableNumber(body.payroll_burden_percent),
        password_login_ready: true,
        password_changed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data: profileRow, error: profileErr } = await supabase.from('profiles').upsert(profilePatch).select('*').single();
      if (profileErr) throw profileErr;
      await recordSiteActivity(supabase, { event_type: 'staff_created', entity_type: 'profile', entity_id: userId, severity: 'success', title: 'Staff user created', summary: `${profileRow?.full_name || email} was added as ${role}.`, metadata: { email, role, staff_tier: profileRow?.staff_tier || role, employee_number: profileRow?.employee_number || null }, related_profile_id: userId, created_by_profile_id: actorId });
      return Response.json({ ok:true, record: profileRow }, { headers:corsHeaders });
    }

    if (entity === 'credential' && action === 'send_password_reset') {
      const target = await resolveProfileByIdOrEmail(supabase, body.profile_id, body.email);
      if (!target?.email) return Response.json({ ok:false, error:'Target profile was not found.' }, { status:404, headers:corsHeaders });
      const resetResp = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: String(target.email),
        options: { redirectTo: Deno.env.get('PASSWORD_RESET_REDIRECT_TO') || Deno.env.get('SITE_URL') || undefined }
      });
      if (resetResp.error) return Response.json({ ok:false, error:resetResp.error.message }, { status:400, headers:corsHeaders });
      return Response.json({ ok:true, email: target.email, link_generated: true }, { headers:corsHeaders });
    }

    if (entity === 'credential' && action === 'set_password') {
      const target = await resolveProfileByIdOrEmail(supabase, body.profile_id, body.email);
      if (!target?.id) return Response.json({ ok:false, error:'Target profile was not found.' }, { status:404, headers:corsHeaders });
      const password = validateAdminSetPassword(body.new_password || '');
      const updateResp = await supabase.auth.admin.updateUserById(String(target.id), { password });
      if (updateResp.error) return Response.json({ ok:false, error:updateResp.error.message }, { status:400, headers:corsHeaders });
      await supabase.from('profiles').update({ password_changed_at: new Date().toISOString(), password_login_ready: true, updated_at: new Date().toISOString() }).eq('id', String(target.id));
      await supabase.from('admin_password_resets').insert({ target_profile_id: String(target.id), changed_by_profile_id: actorId, reason: body.reason ?? null, force_password_change: !!body.force_password_change, created_at: new Date().toISOString() });
      return Response.json({ ok:true }, { headers:corsHeaders });
    }

    if (entity === 'profile' && action === 'create') {
      const { data, error } = await supabase.from('profiles').insert({
        id: body.profile_id,
        email: body.email,
        full_name: body.full_name ?? null,
        role: body.role ?? 'employee',
        is_active: body.is_active ?? true,
        phone: body.phone ?? null,
        phone_verified: !!body.phone_verified,
        email_verified: !!body.email_verified,
        employee_number: body.employee_number ?? null,
        current_position: body.current_position ?? null,
        trade_specialty: body.trade_specialty ?? null,
        seniority_level: body.seniority_level ?? null,
        employment_status: body.employment_status ?? 'active',
        staff_tier: body.staff_tier ?? body.role ?? 'employee',
        start_date: body.start_date ?? null,
        years_employed: body.years_employed ?? null,
        notes: body.notes ?? null,
        hourly_cost_rate: asNullableNumber(body.hourly_cost_rate),
        overtime_cost_rate: asNullableNumber(body.overtime_cost_rate),
        hourly_bill_rate: asNullableNumber(body.hourly_bill_rate),
        overtime_bill_rate: asNullableNumber(body.overtime_bill_rate),
        payroll_burden_percent: asNullableNumber(body.payroll_burden_percent),
        updated_at: new Date().toISOString(),
      }).select('*').single();
      if (error) throw error;
      await recordSiteActivity(supabase, { event_type: 'staff_created', entity_type: 'profile', entity_id: data.id, severity: 'success', title: 'Staff profile created', summary: `${data.full_name || data.email || data.id} was added to the staff directory.`, metadata: { role: data.role || null, staff_tier: data.staff_tier || null, employment_status: data.employment_status || null }, related_profile_id: data.id, created_by_profile_id: actorId });
      return Response.json({ ok:true, record:data }, { headers:corsHeaders });
    }

    if (entity === 'profile' && action === 'set_active') {
      const { data, error } = await supabase.from('profiles').update({
        is_active: !!body.is_active,
        employment_status: body.is_active === false ? 'blocked' : (body.employment_status ?? 'active'),
        updated_at: new Date().toISOString(),
      }).eq('id', body.profile_id).select('*').single();
      if (error) throw error;
      await recordSiteActivity(supabase, { event_type: 'staff_status_changed', entity_type: 'profile', entity_id: data.id, severity: body.is_active === false ? 'warning' : 'info', title: 'Staff status changed', summary: `${data.full_name || data.email || data.id} is now ${data.is_active ? 'active' : 'blocked'}.`, metadata: { is_active: !!data.is_active, employment_status: data.employment_status || null }, related_profile_id: data.id, created_by_profile_id: actorId });
      return Response.json({ ok:true, record:data }, { headers:corsHeaders });
    }

    if (entity === 'profile' && action === 'delete') {
      const target = await resolveProfileByIdOrEmail(supabase, body.profile_id, body.email);
      if (!target?.id) return Response.json({ ok:false, error:'Target profile was not found.' }, { status:404, headers:corsHeaders });
      const delResp = await supabase.auth.admin.deleteUser(String(target.id));
      if (delResp.error) return Response.json({ ok:false, error:delResp.error.message }, { status:400, headers:corsHeaders });
      await recordSiteActivity(supabase, { event_type: 'staff_deleted', entity_type: 'profile', entity_id: target.id, severity: 'warning', title: 'Staff account deleted', summary: `${target.full_name || target.email || target.id} was removed.`, metadata: { email: target.email || null }, related_profile_id: target.id, created_by_profile_id: actorId });
      return Response.json({ ok:true }, { headers:corsHeaders });
    }

    if (entity === 'notification') {
      const notificationId = body.notification_id;
      if (!notificationId) return Response.json({ ok:false, error:'notification_id is required' }, { status:400, headers:corsHeaders });
      const { data: notification, error: loadErr } = await supabase.from('admin_notifications').select('*').eq('id', notificationId).single();
      if (loadErr || !notification) return Response.json({ ok:false, error:'Notification not found' }, { status:404, headers:corsHeaders });
      const now = new Date().toISOString();

      if (action === 'preview_email') {
        return Response.json({ ok:true, preview: {
          to: body.email_to || notification.email_to || Deno.env.get('ADMIN_NOTIFICATION_TO') || '',
          subject: body.email_subject || notification.email_subject || notification.title || 'YWI HSE notification',
          body: body.email_body || notification.body || notification.message || JSON.stringify(notification.payload || {})
        } }, { headers:corsHeaders });
      }

      if (action === 'test_send' || action === 'retry_send') {
        try {
          const sent = await sendEmailIfConfigured(notification, {
            email_to: body.email_to,
            email_subject: body.email_subject,
            body: body.email_body
          });
          if (sent.attempted) {
            const patch = {
              email_to: body.email_to || notification.email_to || null,
              email_subject: body.email_subject || notification.email_subject || notification.title || 'YWI HSE notification',
              email_status: sent.status,
              email_provider: 'resend',
              email_error: null,
              sent_at: now,
              status: 'sent',
              read_at: notification.read_at || now,
            };
            const { data: updated, error: updateErr } = await supabase.from('admin_notifications').update(patch).eq('id', notificationId).select('*').single();
            if (updateErr) throw updateErr;
            await updateDeliveryState(supabase, notificationId, 'email', 'resend', true, '');
            return Response.json({ ok:true, record: updated, preview: patch }, { headers:corsHeaders });
          }
          return Response.json({ ok:false, error:'Outbound email is not configured.' }, { status:400, headers:corsHeaders });
        } catch (err) {
          await updateDeliveryState(supabase, notificationId, 'email', 'resend', false, String(err));
          await supabase.from('admin_notifications').update({ status: 'failed', read_at: notification.read_at || now }).eq('id', notificationId);
          return Response.json({ ok:false, error:String(err?.message || err), details:Array.isArray((err as any)?.details) ? (err as any).details : [] }, { status:500, headers:corsHeaders });
        }
      }

      const patch: Record<string, unknown> = { read_at: notification.read_at || now };
      if (action === 'mark_read') patch.status = 'read';
      if (action === 'dismiss') {
        patch.status = 'dismissed';
        patch.decision_status = 'dismissed';
        patch.decided_at = now;
        patch.decided_by_profile_id = actorId;
      }
      if (action === 'resolve') {
        patch.status = 'resolved';
        patch.decision_status = 'resolved';
        patch.decision_notes = body.decision_notes ?? null;
        patch.decided_at = now;
        patch.decided_by_profile_id = actorId;
      }
      if (action === 'approve') {
        patch.status = 'approved';
        patch.decision_status = 'approved';
        patch.decision_notes = body.decision_notes ?? null;
        patch.decided_at = now;
        patch.decided_by_profile_id = actorId;
      }
      if (action === 'reject') {
        patch.status = 'rejected';
        patch.decision_status = 'rejected';
        patch.decision_notes = body.decision_notes ?? null;
        patch.decided_at = now;
        patch.decided_by_profile_id = actorId;
      }
      const { data: updated, error: notifErr } = await supabase.from('admin_notifications').update(patch).eq('id', notificationId).select('*').single();
      if (notifErr) throw notifErr;

      if (action === 'approve' && notification.notification_type === 'phone_verification_request' && notification.target_id) {
        let phone = '';
        const payload = typeof notification.payload === 'object' && notification.payload ? notification.payload : null;
        try { phone = String(payload?.phone || JSON.parse(notification.body || '{}')?.phone || '').trim(); } catch {}
        await supabase.from('profiles').update({ phone: phone || undefined, phone_verified: true, phone_verified_at: now, phone_validation_requested_at: null, updated_at: now }).eq('id', notification.target_id);
      }
      if ((action === 'approve' || action === 'reject') && notification.target_table === 'jobs' && notification.target_id) {
        await supabase.from('jobs').update({ approval_status: action === 'approve' ? 'approved' : 'rejected', approved_at: now, approved_by_profile_id: actorId, approval_notes: body.decision_notes ?? null, updated_at: now }).eq('id', Number(notification.target_id));
      }
      if ((action === 'approve' || action === 'reject') && notification.target_table === 'job_equipment_requirements' && notification.target_id) {
        await supabase.from('job_equipment_requirements').update({ approval_status: action === 'approve' ? 'approved' : 'rejected', approval_notes: body.decision_notes ?? null, approved_at: now, approved_by_profile_id: actorId }).eq('id', Number(notification.target_id));
      }
      if ((action === 'approve' || action === 'reject') && notification.target_table === 'account_identity_change_requests' && notification.target_id) {
        const requestId = Number(notification.target_id);
        const { data: requestRow } = await supabase.from('account_identity_change_requests').select('*').eq('id', requestId).maybeSingle();
        if (requestRow?.profile_id) {
          if (action === 'approve') {
            const profilePatch: Record<string, unknown> = {
              pending_email: null,
              pending_username: null,
              updated_at: now,
            };
            if (requestRow.requested_username) profilePatch.username = requestRow.requested_username;
            if (requestRow.requested_email) {
              profilePatch.email = requestRow.requested_email;
              profilePatch.recovery_email = requestRow.requested_email;
            }

            const authPatch: Record<string, unknown> = {
              user_metadata: {
                requested_username: null,
                requested_email: null,
              }
            };
            if (requestRow.requested_email) {
              authPatch.email = requestRow.requested_email;
              authPatch.email_confirm = true;
            }
            if (requestRow.requested_username) {
              authPatch.user_metadata = {
                ...(authPatch.user_metadata as Record<string, unknown>),
                username: requestRow.requested_username,
              };
            }
            const shouldSyncAuth = !!(requestRow.requested_email || requestRow.requested_username);
            if (shouldSyncAuth) {
              const { error: authSyncError } = await supabase.auth.admin.updateUserById(requestRow.profile_id, authPatch);
              if (authSyncError) {
                const syncError: any = new Error(`Auth identity sync failed: ${authSyncError.message}`);
                syncError.details = ['The approved profile change was not applied to the Auth user record.', authSyncError.message];
                throw syncError;
              }
            }
            await supabase.from('profiles').update(profilePatch).eq('id', requestRow.profile_id);
          } else {
            await supabase.from('profiles').update({ pending_email: null, pending_username: null, updated_at: now }).eq('id', requestRow.profile_id);
          }
          await supabase.from('account_identity_change_requests').update({ request_status: action === 'approve' ? 'approved' : 'rejected', reviewed_by_profile_id: actorId, reviewed_at: now, notes: body.decision_notes ?? null }).eq('id', requestId);
          await supabase.from('admin_notifications').insert({
            notification_type: action === 'approve' ? 'account_identity_change_approved' : 'account_identity_change_rejected',
            recipient_role: 'worker',
            target_table: 'account_identity_change_requests',
            target_id: String(requestId),
            target_profile_id: requestRow.profile_id,
            title: action === 'approve' ? 'Your account identity change was approved' : 'Your account identity change was rejected',
            body: JSON.stringify({
              request_id: requestId,
              request_status: action === 'approve' ? 'approved' : 'rejected',
              requested_username: requestRow.requested_username || null,
              requested_email: requestRow.requested_email || null,
              notes: body.decision_notes ?? null,
              auth_sync_applied: action === 'approve',
            }),
            payload: {
              request_id: requestId,
              profile_id: requestRow.profile_id,
              request_status: action === 'approve' ? 'approved' : 'rejected',
              requested_username: requestRow.requested_username || null,
              requested_email: requestRow.requested_email || null,
              notes: body.decision_notes ?? null,
              auth_sync_applied: action === 'approve',
            },
            status: 'queued',
            email_subject: action === 'approve' ? 'YWI HSE identity change approved' : 'YWI HSE identity change rejected',
            created_by_profile_id: actorId,
          });
        }
      }
      return Response.json({ ok:true, record: updated }, { headers:corsHeaders });
    }

    if (entity === 'job_requirement') {
      if (!body.requirement_id) return Response.json({ ok:false, error:'requirement_id is required' }, { status:400, headers:corsHeaders });
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { approval_notes: body.decision_notes ?? null };
      if (action === 'approve') {
        patch.approval_status = 'approved';
        patch.approved_at = now;
        patch.approved_by_profile_id = actorId;
      }
      if (action === 'reject') {
        patch.approval_status = 'rejected';
        patch.approved_at = now;
        patch.approved_by_profile_id = actorId;
      }
      if (action === 'request_approval') {
        patch.approval_status = 'pending';
      }
      const { data: updated, error: reqErr } = await supabase.from('job_equipment_requirements').update(patch).eq('id', body.requirement_id).select('*').single();
      if (reqErr) throw reqErr;
      if (action === 'request_approval') {
        await supabase.from('admin_notifications').insert({
          notification_type: 'job_requirement_approval_requested',
          recipient_role: 'admin',
          target_table: 'job_equipment_requirements',
          target_id: String(updated.id),
          title: `Requirement approval requested: ${updated.equipment_name || updated.equipment_code || updated.id}`,
          body: JSON.stringify({ requirement_id: updated.id, equipment_name: updated.equipment_name, needed_qty: updated.needed_qty, reserved_qty: updated.reserved_qty }),
          payload: { requirement_id: updated.id, job_id: updated.job_id, equipment_name: updated.equipment_name, needed_qty: updated.needed_qty, reserved_qty: updated.reserved_qty },
          status: 'queued',
          email_subject: `YWI HSE requirement approval requested: ${updated.equipment_name || updated.equipment_code || updated.id}`,
          created_by_profile_id: actorId,
        });
      }
      return Response.json({ ok:true, record: updated }, { headers:corsHeaders });
    }


    if (entity === 'credential' && action === 'set_password') {
      const targetProfileId = String(body.profile_id || '').trim();
      if (!targetProfileId) return Response.json({ ok:false, error:'profile_id is required' }, { status:400, headers:corsHeaders });
      const newPassword = validateAdminSetPassword(body.new_password);
      const now = new Date().toISOString();
      const { data: targetProfile, error: targetProfileErr } = await supabase.from('profiles').select('id,email,full_name,role,is_active,password_login_ready').eq('id', targetProfileId).maybeSingle();
      if (targetProfileErr || !targetProfile) return Response.json({ ok:false, error:'Target profile not found' }, { status:404, headers:corsHeaders });
      const { error: authUpdateErr } = await supabase.auth.admin.updateUserById(targetProfileId, {
        password: newPassword,
        user_metadata: {
          password_reset_required: !!body.force_password_change,
          password_set_by_admin_profile_id: actorId,
          password_set_by_admin_at: now,
        }
      });
      if (authUpdateErr) throw authUpdateErr;
      const { data: updatedProfile, error: profileUpdateErr } = await supabase
        .from('profiles')
        .update({ password_login_ready: true, password_changed_at: now, updated_at: now })
        .eq('id', targetProfileId)
        .select('*')
        .single();
      if (profileUpdateErr) throw profileUpdateErr;

      await supabase.from('admin_password_resets').insert({
        target_profile_id: targetProfileId,
        reset_by_profile_id: actorId,
        reason: body.reason ?? null,
        force_password_change: !!body.force_password_change,
        created_at: now,
      });

      await supabase.from('admin_notifications').insert({
        notification_type: 'admin_password_reset',
        recipient_role: targetProfile.role || 'employee',
        target_table: 'profiles',
        target_id: String(targetProfileId),
        target_profile_id: targetProfileId,
        title: `Password changed by admin for ${targetProfile.full_name || targetProfile.email || targetProfileId}`,
        body: JSON.stringify({
          target_profile_id: targetProfileId,
          target_email: targetProfile.email || null,
          target_name: targetProfile.full_name || null,
          force_password_change: !!body.force_password_change,
          reason: body.reason ?? null,
        }),
        payload: {
          target_profile_id: targetProfileId,
          target_email: targetProfile.email || null,
          target_name: targetProfile.full_name || null,
          force_password_change: !!body.force_password_change,
          reason: body.reason ?? null,
        },
        status: 'queued',
        email_subject: 'YWI HSE password changed by admin',
        created_by_profile_id: actorId,
      });

      return Response.json({ ok:true, record: updatedProfile }, { headers:corsHeaders });
    }

    if (entity === 'sales_order' && action === 'create') {
      const now = new Date().toISOString();
      const subtotal = Number(body.subtotal_amount || 0);
      const tax = Number(body.tax_amount || 0);
      const total = Number(body.total_amount || subtotal + tax || 0);
      const orderCode = String(body.order_code || '').trim() || `ORD-${Date.now()}`;
      const orderPatch = {
        order_code: orderCode,
        customer_name: body.customer_name ?? null,
        customer_email: body.customer_email ?? null,
        order_status: body.order_status ?? 'draft',
        currency_code: body.currency_code ?? 'CAD',
        subtotal_amount: subtotal,
        tax_amount: tax,
        total_amount: total,
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: now,
      };
      const { data: orderRow, error: orderErr } = await supabase.from('sales_orders').insert(orderPatch).select('*').single();
      if (orderErr) throw orderErr;
      const accountingPayload = {
        source_type: 'sales_order',
        source_id: orderRow.id,
        entry_type: 'order_created',
        entry_status: 'open',
        customer_name: orderRow.customer_name,
        customer_email: orderRow.customer_email,
        currency_code: orderRow.currency_code,
        subtotal_amount: orderRow.subtotal_amount,
        tax_amount: orderRow.tax_amount,
        total_amount: orderRow.total_amount,
        payload: {
          order_code: orderRow.order_code,
          notes: orderRow.notes || null,
          order_status: orderRow.order_status,
          accounting_stage: 'order_stub_created'
        },
        created_by_profile_id: actorId,
      };
      const { data: accountingRow, error: accountingErr } = await supabase.from('accounting_entries').insert(accountingPayload).select('*').single();
      if (accountingErr) throw accountingErr;
      await recordSiteActivity(supabase, { event_type: 'order_created', entity_type: 'sales_order', entity_id: orderRow.id, severity: 'success', title: 'Order created', summary: `${orderRow.order_code || orderRow.id} was created for ${orderRow.customer_name || 'customer'}.`, metadata: { order_status: orderRow.order_status || null, total_amount: orderRow.total_amount || 0 }, created_by_profile_id: actorId });
      return Response.json({ ok:true, record: orderRow, accounting_record: accountingRow }, { headers:corsHeaders });
    }

    if (entity === 'profile' && action === 'update') {
      const normalizedRole = String(body.role ?? '').trim().toLowerCase() || undefined;
      const normalizedEmail = String(body.email ?? '').trim().toLowerCase() || null;
      const patch = {
        full_name: body.full_name ?? null,
        email: normalizedEmail,
        role: normalizedRole,
        is_active: body.is_active ?? true,
        phone: body.phone ?? null,
        phone_verified: !!body.phone_verified,
        email_verified: body.email_verified === undefined ? undefined : !!body.email_verified,
        address_line1: body.address_line1 ?? null,
        address_line2: body.address_line2 ?? null,
        city: body.city ?? null,
        province: body.province ?? null,
        postal_code: body.postal_code ?? null,
        emergency_contact_name: body.emergency_contact_name ?? null,
        emergency_contact_phone: body.emergency_contact_phone ?? null,
        vehicle_make_model: body.vehicle_make_model ?? null,
        vehicle_plate: body.vehicle_plate ?? null,
        years_employed: body.years_employed ?? null,
        start_date: body.start_date ?? null,
        employee_number: body.employee_number ?? null,
        current_position: body.current_position ?? null,
        seniority_level: body.seniority_level ?? null,
        employment_status: body.employment_status ?? null,
        staff_tier: body.staff_tier ?? null,
        previous_employee: !!body.previous_employee,
        trade_specialty: body.trade_specialty ?? null,
        strengths: body.strengths ?? null,
        certifications: body.certifications ?? null,
        feature_preferences: body.feature_preferences ?? null,
        notes: body.notes ?? null,
        hourly_cost_rate: asNullableNumber(body.hourly_cost_rate),
        overtime_cost_rate: asNullableNumber(body.overtime_cost_rate),
        hourly_bill_rate: asNullableNumber(body.hourly_bill_rate),
        overtime_bill_rate: asNullableNumber(body.overtime_bill_rate),
        payroll_burden_percent: asNullableNumber(body.payroll_burden_percent),
        default_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.default_supervisor_name),
        override_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.override_supervisor_name),
        default_admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.default_admin_name),
        override_admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.override_admin_name),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', body.profile_id).select('*').single();
      if (error) throw error;
      const metadataPatch: Record<string, unknown> = {};
      if (body.full_name !== undefined) metadataPatch.full_name = body.full_name ?? null;
      if (normalizedRole !== undefined) metadataPatch.role = normalizedRole;
      if (body.employee_number !== undefined) metadataPatch.employee_number = body.employee_number ?? null;
      if (body.staff_tier !== undefined) metadataPatch.staff_tier = body.staff_tier ?? null;
      if (Object.keys(metadataPatch).length || normalizedEmail !== null) {
        const authPatch: Record<string, unknown> = { user_metadata: metadataPatch };
        if (normalizedEmail !== null) authPatch.email = normalizedEmail;
        const authResp = await supabase.auth.admin.updateUserById(String(body.profile_id), authPatch);
        if (authResp.error) return Response.json({ ok:false, error:authResp.error.message }, { status:400, headers:corsHeaders });
      }
      await recordSiteActivity(supabase, { event_type: 'staff_updated', entity_type: 'profile', entity_id: data.id, severity: 'info', title: 'Staff profile updated', summary: `${data.full_name || data.email || data.id} was updated.`, metadata: { role: data.role || null, staff_tier: data.staff_tier || null, employment_status: data.employment_status || null }, related_profile_id: data.id, created_by_profile_id: actorId });
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (entity === 'site' && action === 'create') {
      const { data, error } = await supabase.from('sites').insert({
        site_code: body.site_code,
        site_name: body.site_name,
        address: body.address ?? null,
        region: body.region ?? null,
        client_name: body.client_name ?? null,
        project_code: body.project_code ?? null,
        project_status: body.project_status ?? null,
        site_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.site_supervisor_name),
        signing_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.signing_supervisor_name),
        admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.admin_name),
        notes: body.notes ?? null,
        is_active: body.is_active ?? true,
      }).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (entity === 'site' && action === 'update') {
      const { data, error } = await supabase.from('sites').update({
        site_code: body.site_code,
        site_name: body.site_name,
        address: body.address ?? null,
        region: body.region ?? null,
        client_name: body.client_name ?? null,
        project_code: body.project_code ?? null,
        project_status: body.project_status ?? null,
        site_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.site_supervisor_name),
        signing_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.signing_supervisor_name),
        admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.admin_name),
        notes: body.notes ?? null,
        is_active: body.is_active ?? true,
        updated_at: new Date().toISOString(),
      }).eq('id', body.site_id).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (entity === 'assignment' && action === 'create') {
      const { data, error } = await supabase.from('site_assignments').insert({
        site_id: body.site_id,
        profile_id: body.profile_id,
        assignment_role: body.assignment_role ?? 'worker',
        is_primary: !!body.is_primary,
        reports_to_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.reports_to_supervisor_name),
        reports_to_admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.reports_to_admin_name),
      }).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (entity === 'assignment' && action === 'update') {
      const { data, error } = await supabase.from('site_assignments').update({
        assignment_role: body.assignment_role ?? 'worker',
        is_primary: !!body.is_primary,
        reports_to_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.reports_to_supervisor_name),
        reports_to_admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.reports_to_admin_name),
        updated_at: new Date().toISOString(),
      }).eq('id', body.assignment_id).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (entity === 'catalog') {
      const cfg = getCatalogConfig(body.catalog_type);
      if (!cfg) return Response.json({ ok:false, error:'Unsupported catalog type.' }, { status:400, headers:corsHeaders });
      const record: Record<string, unknown> = {
        [cfg.nameColumn]: body.name,
        sort_order: Number(body.sort_order ?? 100),
        is_active: body.is_active !== false,
      };
      if (action === 'create') {
        const { data, error } = await supabase.from(cfg.table).insert(record).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from(cfg.table).update(record).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from(cfg.table).delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }



    if (entity === 'unit_of_measure') {
      const patch = {
        code: String(body.code || '').trim().toUpperCase(),
        name: body.name ?? null,
        category: body.category ?? null,
        sort_order: asNumber(body.sort_order, 0),
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.code || !patch.name) return Response.json({ ok:false, error:'code and name are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('units_of_measure').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('units_of_measure').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('units_of_measure').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'cost_code') {
      const patch = {
        code: String(body.code || '').trim().toUpperCase(),
        name: body.name ?? null,
        category: body.category ?? null,
        description: body.description ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.code || !patch.name) return Response.json({ ok:false, error:'code and name are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('cost_codes').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('cost_codes').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('cost_codes').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }



    if (entity === 'tax_code') {
      const patch = {
        code: String(body.code || '').trim().toUpperCase(),
        name: body.name ?? null,
        tax_type: body.tax_type ?? 'hst',
        province_code: body.province_code ?? 'ON',
        country_code: body.country_code ?? 'CA',
        rate_percent: asNumber(body.rate_percent, 0),
        applies_to: body.applies_to ?? 'sale',
        is_default: body.is_default === true,
        is_active: body.is_active !== false,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      };
      if (!patch.code || !patch.name) return Response.json({ ok:false, error:'code and name are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('tax_codes').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('tax_codes').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('tax_codes').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'service_pricing_template') {
      const patch = {
        template_code: String(body.template_code || '').trim().toUpperCase(),
        template_name: body.template_name ?? null,
        job_family: body.job_family ?? null,
        project_scope: body.project_scope ?? null,
        service_pattern: body.service_pattern ?? null,
        default_schedule_mode: body.default_schedule_mode ?? 'standalone',
        default_estimated_visit_minutes: asNullableNumber(body.default_estimated_visit_minutes),
        default_estimated_duration_hours: asNullableNumber(body.default_estimated_duration_hours),
        default_estimated_duration_days: asNullableNumber(body.default_estimated_duration_days),
        default_estimated_cost_total: asNumber(body.default_estimated_cost_total, 0),
        default_quoted_charge_total: asNumber(body.default_quoted_charge_total, 0),
        default_pricing_method: body.default_pricing_method ?? 'manual',
        default_markup_percent: asNullableNumber(body.default_markup_percent),
        default_discount_mode: body.default_discount_mode ?? 'none',
        default_discount_value: asNumber(body.default_discount_value, 0),
        sales_tax_code_id: asNullableText(body.sales_tax_code_id),
        notes: body.notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.template_code || !patch.template_name) return Response.json({ ok:false, error:'template_code and template_name are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('service_pricing_templates').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('service_pricing_templates').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('service_pricing_templates').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }


    if (entity === 'recurring_service_agreement') {
      const patch = {
        agreement_code: String(body.agreement_code || '').trim().toUpperCase(),
        client_id: asNullableText(body.client_id),
        client_site_id: asNullableText(body.client_site_id),
        service_pricing_template_id: asNullableText(body.service_pricing_template_id),
        route_id: asNullableText(body.route_id),
        crew_id: asNullableText(body.crew_id),
        tax_code_id: asNullableText(body.tax_code_id),
        service_name: body.service_name ?? null,
        agreement_status: body.agreement_status ?? 'draft',
        billing_method: body.billing_method ?? 'per_visit',
        service_pattern: body.service_pattern ?? null,
        recurrence_basis: body.recurrence_basis ?? null,
        recurrence_rule: body.recurrence_rule ?? null,
        recurrence_interval: asNumber(body.recurrence_interval, 1),
        start_date: asNullableDate(body.start_date),
        end_date: asNullableDate(body.end_date),
        open_end_date: !!body.open_end_date,
        visit_estimated_minutes: asNullableNumber(body.visit_estimated_minutes),
        visit_estimated_duration_hours: asNullableNumber(body.visit_estimated_duration_hours),
        visit_cost_total: asNumber(body.visit_cost_total, 0),
        visit_charge_total: asNumber(body.visit_charge_total, 0),
        markup_percent: asNullableNumber(body.markup_percent),
        discount_mode: body.discount_mode ?? 'none',
        discount_value: asNumber(body.discount_value, 0),
        tiered_discount_notes: body.tiered_discount_notes ?? null,
        event_trigger_type: body.event_trigger_type ?? null,
        snow_trigger_threshold_cm: asNullableNumber(body.snow_trigger_threshold_cm),
        trigger_notes: body.trigger_notes ?? null,
        pricing_notes: body.pricing_notes ?? null,
        service_notes: body.service_notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.agreement_code || !patch.service_name) return Response.json({ ok:false, error:'agreement_code and service_name are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('recurring_service_agreements').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'agreement_created', entity_type: 'recurring_service_agreement', entity_id: data.id, severity: 'success', title: 'Recurring agreement created', summary: `${data.service_name || data.agreement_code || data.id} was created.`, metadata: { agreement_code: data.agreement_code || null, billing_method: data.billing_method || null, agreement_status: data.agreement_status || null }, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('recurring_service_agreements').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'agreement_updated', entity_type: 'recurring_service_agreement', entity_id: data.id, severity: 'info', title: 'Recurring agreement updated', summary: `${data.service_name || data.agreement_code || data.id} was updated.`, metadata: { agreement_code: data.agreement_code || null, billing_method: data.billing_method || null, agreement_status: data.agreement_status || null }, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('recurring_service_agreements').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'snow_event_trigger') {
      const patch = {
        agreement_id: asNullableText(body.agreement_id),
        event_date: asNullableDate(body.event_date) || new Date().toISOString().slice(0, 10),
        event_label: body.event_label ?? null,
        snowfall_cm: asNullableNumber(body.snowfall_cm),
        threshold_cm: asNullableNumber(body.threshold_cm),
        trigger_met: !!body.trigger_met,
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.agreement_id) return Response.json({ ok:false, error:'agreement_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('snow_event_triggers').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'snow_trigger_created', entity_type: 'snow_event_trigger', entity_id: data.id, severity: data.trigger_met ? 'warning' : 'info', title: 'Snow trigger recorded', summary: `${data.event_label || data.event_date || data.id} was logged for snow review.`, metadata: { agreement_id: data.agreement_id || null, snowfall_cm: data.snowfall_cm || null, trigger_met: !!data.trigger_met }, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('snow_event_triggers').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('snow_event_triggers').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'change_order') {
      const patch = {
        job_id: asNullableNumber(body.job_id),
        agreement_id: asNullableText(body.agreement_id),
        change_order_number: String(body.change_order_number || '').trim().toUpperCase(),
        status: body.status ?? 'draft',
        requested_at: asNullableDateTime(body.requested_at) || new Date().toISOString(),
        approved_at: asNullableDateTime(body.approved_at),
        approved_by_profile_id: asNullableText(body.approved_by_profile_id),
        scope_summary: body.scope_summary ?? null,
        reason: body.reason ?? null,
        estimated_cost_delta: asNumber(body.estimated_cost_delta, 0),
        estimated_charge_delta: asNumber(body.estimated_charge_delta, 0),
        actual_cost_delta: asNumber(body.actual_cost_delta, 0),
        actual_charge_delta: asNumber(body.actual_charge_delta, 0),
        tax_code_id: asNullableText(body.tax_code_id),
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.job_id || !patch.change_order_number || !patch.scope_summary) return Response.json({ ok:false, error:'job_id, change_order_number, and scope_summary are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('change_orders').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'change_order_created', entity_type: 'change_order', entity_id: data.id, severity: 'info', title: 'Change order created', summary: `${data.change_order_number || data.id} was created for job ${data.job_id}.`, metadata: { status: data.status || null, estimated_charge_delta: data.estimated_charge_delta || 0 }, related_job_id: data.job_id || null, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('change_orders').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('change_orders').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'customer_asset') {
      const patch = {
        asset_code: String(body.asset_code || '').trim().toUpperCase(),
        client_id: asNullableText(body.client_id),
        client_site_id: asNullableText(body.client_site_id),
        asset_name: body.asset_name ?? null,
        asset_type: body.asset_type ?? 'site_feature',
        serial_number: body.serial_number ?? null,
        install_date: asNullableDate(body.install_date),
        warranty_expiry_date: asNullableDate(body.warranty_expiry_date),
        manufacturer: body.manufacturer ?? null,
        model: body.model ?? null,
        location_notes: body.location_notes ?? null,
        service_notes: body.service_notes ?? null,
        is_active: body.is_active !== false,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.asset_code || !patch.asset_name) return Response.json({ ok:false, error:'asset_code and asset_name are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('customer_assets').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'customer_asset_created', entity_type: 'customer_asset', entity_id: data.id, severity: 'success', title: 'Customer asset added', summary: `${data.asset_name || data.asset_code || data.id} was added.`, metadata: { asset_code: data.asset_code || null, asset_type: data.asset_type || null }, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('customer_assets').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('customer_assets').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'customer_asset_job_link') {
      const patch = {
        asset_id: asNullableText(body.asset_id),
        job_id: asNullableNumber(body.job_id),
        service_date: asNullableDate(body.service_date),
        event_type: body.event_type ?? 'service',
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.asset_id || !patch.job_id) return Response.json({ ok:false, error:'asset_id and job_id are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('customer_asset_job_links').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('customer_asset_job_links').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('customer_asset_job_links').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'warranty_callback_event') {
      const patch = {
        job_id: asNullableNumber(body.job_id),
        asset_id: asNullableText(body.asset_id),
        client_site_id: asNullableText(body.client_site_id),
        callback_number: String(body.callback_number || '').trim().toUpperCase(),
        callback_type: body.callback_type ?? 'callback',
        status: body.status ?? 'open',
        warranty_covered: !!body.warranty_covered,
        opened_at: asNullableDateTime(body.opened_at) || new Date().toISOString(),
        closed_at: asNullableDateTime(body.closed_at),
        estimated_cost_total: asNumber(body.estimated_cost_total, 0),
        actual_cost_total: asNumber(body.actual_cost_total, 0),
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.callback_number) return Response.json({ ok:false, error:'callback_number is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('warranty_callback_events').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'callback_created', entity_type: 'warranty_callback_event', entity_id: data.id, severity: data.warranty_covered ? 'warning' : 'info', title: 'Callback / warranty event created', summary: `${data.callback_number || data.id} was opened.`, metadata: { callback_type: data.callback_type || null, warranty_covered: !!data.warranty_covered, status: data.status || null }, related_job_id: data.job_id || null, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('warranty_callback_events').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('warranty_callback_events').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'payroll_export_run') {
      const patch = {
        run_code: String(body.run_code || '').trim().toUpperCase(),
        period_start: asNullableDate(body.period_start),
        period_end: asNullableDate(body.period_end),
        status: body.status ?? 'draft',
        exported_at: asNullableDateTime(body.exported_at),
        exported_by_profile_id: asNullableText(body.exported_by_profile_id),
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      };
      if (!patch.run_code || !patch.period_start || !patch.period_end) return Response.json({ ok:false, error:'run_code, period_start, and period_end are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('payroll_export_runs').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'payroll_export_created', entity_type: 'payroll_export_run', entity_id: data.id, severity: 'info', title: 'Payroll export run created', summary: `${data.run_code || data.id} covers ${data.period_start || ''} to ${data.period_end || ''}.`, metadata: { status: data.status || null, period_start: data.period_start || null, period_end: data.period_end || null }, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('payroll_export_runs').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('payroll_export_runs').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }


    if (entity === 'job_financial_event') {
      const quantity = asNullableNumber(body.quantity);
      const unitCost = asNullableNumber(body.unit_cost);
      const unitPrice = asNullableNumber(body.unit_price);
      const patch = {
        job_id: asNullableNumber(body.job_id),
        job_session_id: asNullableText(body.job_session_id),
        event_date: asNullableDate(body.event_date) || new Date().toISOString().slice(0, 10),
        event_type: body.event_type ?? 'other',
        cost_amount: asNumber(body.cost_amount, (quantity !== null && unitCost !== null) ? quantity * unitCost : 0),
        revenue_amount: asNumber(body.revenue_amount, (quantity !== null && unitPrice !== null) ? quantity * unitPrice : 0),
        quantity,
        unit_cost: unitCost,
        unit_price: unitPrice,
        is_billable: body.is_billable === true,
        vendor_id: asNullableText(body.vendor_id),
        tax_code_id: asNullableText(body.tax_code_id),
        gl_account_id: asNullableText(body.gl_account_id),
        reference_number: body.reference_number ?? null,
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.job_id) return Response.json({ ok:false, error:'job_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('job_financial_events').insert({ ...patch, created_at: new Date().toISOString() }).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('job_financial_events').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('job_financial_events').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'business_tax_setting') {
      const patch = {
        profile_name: body.profile_name ?? null,
        province_code: body.province_code ?? 'ON',
        country_code: body.country_code ?? 'CA',
        currency_code: body.currency_code ?? 'CAD',
        default_sales_tax_code_id: asNullableText(body.default_sales_tax_code_id),
        default_purchase_tax_code_id: asNullableText(body.default_purchase_tax_code_id),
        hst_registration_number: body.hst_registration_number ?? null,
        fiscal_year_end_mmdd: body.fiscal_year_end_mmdd ?? null,
        small_supplier_flag: body.small_supplier_flag === true,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      };
      if (!patch.profile_name) return Response.json({ ok:false, error:'profile_name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('business_tax_settings').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('business_tax_settings').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('business_tax_settings').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }
    if (entity === 'service_area') {
      const patch = {
        area_code: asNullableText(body.area_code),
        name: body.name ?? null,
        region: body.region ?? null,
        notes: body.notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.name) return Response.json({ ok:false, error:'name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('service_areas').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('service_areas').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('service_areas').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }


    if (entity === 'employee_time_entry') {
      const patch = {
        profile_id: asNullableText(body.profile_id),
        crew_id: asNullableText(body.crew_id),
        job_id: asNullableNumber(body.job_id),
        job_session_id: asNullableText(body.job_session_id),
        site_id: asNullableNumber(body.site_id),
        clock_status: body.clock_status ?? 'active',
        signed_in_at: asNullableDateTime(body.signed_in_at),
        signed_out_at: asNullableDateTime(body.signed_out_at),
        unpaid_break_minutes: asNumber(body.unpaid_break_minutes, 0),
        paid_work_minutes: asNumber(body.paid_work_minutes, 0),
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      };
      if (action === 'create') {
        const { data, error } = await supabase.from('employee_time_entries').insert({ ...patch, created_by_profile_id: actorId, created_at: new Date().toISOString() }).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type:'employee_clock_in', entity_type:'employee_time_entry', entity_id:data?.id, title:'Employee time entry created', summary:'An employee time record was created from Admin.', related_job_id:data?.job_id || null, related_profile_id:data?.profile_id || null, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('employee_time_entries').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('employee_time_entries').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'route') {
      const patch = {
        route_code: asNullableText(body.route_code),
        name: body.name ?? null,
        service_area_id: asNullableText(body.service_area_id),
        route_type: body.route_type ?? 'recurring',
        day_of_week: asNullableNumber(body.day_of_week),
        notes: body.notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.name) return Response.json({ ok:false, error:'name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('routes').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('routes').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('routes').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'client') {
      const patch = {
        client_code: asNullableText(body.client_code),
        legal_name: body.legal_name ?? null,
        display_name: body.display_name ?? null,
        client_type: body.client_type ?? 'customer',
        billing_email: body.billing_email ?? null,
        phone: body.phone ?? null,
        address_line1: body.address_line1 ?? null,
        address_line2: body.address_line2 ?? null,
        city: body.city ?? null,
        province: body.province ?? null,
        postal_code: body.postal_code ?? null,
        payment_terms_days: asNumber(body.payment_terms_days, 30),
        tax_registration_number: body.tax_registration_number ?? null,
        notes: body.notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.legal_name) return Response.json({ ok:false, error:'legal_name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('clients').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('clients').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('clients').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'client_site') {
      const patch = {
        client_id: asNullableText(body.client_id),
        legacy_site_id: asNullableText(body.legacy_site_id),
        site_code: asNullableText(body.site_code),
        site_name: body.site_name ?? null,
        service_address: body.service_address ?? null,
        city: body.city ?? null,
        province: body.province ?? null,
        postal_code: body.postal_code ?? null,
        access_notes: body.access_notes ?? null,
        hazard_notes: body.hazard_notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.client_id || !patch.site_name) return Response.json({ ok:false, error:'client_id and site_name are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('client_sites').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('client_sites').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('client_sites').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'material') {
      const patch = {
        sku: asNullableText(body.sku),
        item_name: body.item_name ?? null,
        material_category: body.material_category ?? null,
        unit_id: asNullableText(body.unit_id),
        default_unit_cost: asNumber(body.default_unit_cost, 0),
        default_bill_rate: asNumber(body.default_bill_rate, 0),
        taxable: body.taxable !== false,
        inventory_tracked: body.inventory_tracked !== false,
        reorder_point: asNullableNumber(body.reorder_point),
        reorder_quantity: asNullableNumber(body.reorder_quantity),
        notes: body.notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.item_name) return Response.json({ ok:false, error:'item_name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('materials_catalog').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('materials_catalog').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('materials_catalog').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'equipment_master') {
      const patch = {
        equipment_code: asNullableText(body.equipment_code),
        item_name: body.item_name ?? null,
        equipment_category: body.equipment_category ?? null,
        manufacturer: body.manufacturer ?? null,
        model: body.model ?? null,
        ownership_type: body.ownership_type ?? 'owned',
        bill_rate_hourly: asNumber(body.bill_rate_hourly, 0),
        cost_rate_hourly: asNumber(body.cost_rate_hourly, 0),
        default_operator_required: !!body.default_operator_required,
        notes: body.notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.item_name) return Response.json({ ok:false, error:'item_name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('equipment_master').insert(patch).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'equipment_created', entity_type: 'equipment_master', entity_id: data.id, severity: 'success', title: 'Equipment added', summary: `${data.item_name || data.equipment_code || data.id} was added to the equipment master.`, metadata: { equipment_code: data.equipment_code || null, equipment_category: data.equipment_category || null, ownership_type: data.ownership_type || null }, related_equipment_id: data.id, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('equipment_master').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'equipment_updated', entity_type: 'equipment_master', entity_id: data.id, severity: 'info', title: 'Equipment updated', summary: `${data.item_name || data.equipment_code || data.id} was updated.`, metadata: { equipment_code: data.equipment_code || null, equipment_category: data.equipment_category || null, ownership_type: data.ownership_type || null }, related_equipment_id: data.id, created_by_profile_id: actorId });
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { data: existing } = await supabase.from('equipment_master').select('id,item_name,equipment_code').eq('id', body.item_id).maybeSingle();
        const { error } = await supabase.from('equipment_master').delete().eq('id', body.item_id);
        if (error) throw error;
        await recordSiteActivity(supabase, { event_type: 'equipment_deleted', entity_type: 'equipment_master', entity_id: body.item_id, severity: 'warning', title: 'Equipment deleted', summary: `${existing?.item_name || existing?.equipment_code || body.item_id} was removed from equipment master.`, metadata: { equipment_code: existing?.equipment_code || null }, related_equipment_id: existing?.id || null, created_by_profile_id: actorId });
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'estimate') {
      const patch = {
        estimate_number: body.estimate_number ?? null,
        client_id: asNullableText(body.client_id),
        client_site_id: asNullableText(body.client_site_id),
        estimate_type: body.estimate_type ?? 'landscaping',
        status: body.status ?? 'draft',
        valid_until: asNullableDate(body.valid_until),
        subtotal: asNumber(body.subtotal, 0),
        tax_total: asNumber(body.tax_total, 0),
        total_amount: asNumber(body.total_amount, 0),
        scope_notes: body.scope_notes ?? null,
        terms_notes: body.terms_notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.estimate_number) return Response.json({ ok:false, error:'estimate_number is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('estimates').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('estimates').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('estimates').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'work_order') {
      const patch = {
        work_order_number: body.work_order_number ?? null,
        estimate_id: asNullableText(body.estimate_id),
        client_id: asNullableText(body.client_id),
        client_site_id: asNullableText(body.client_site_id),
        legacy_job_id: asNullableNumber(body.legacy_job_id),
        work_type: body.work_type ?? 'service',
        status: body.status ?? 'draft',
        scheduled_start: asNullableDateTime(body.scheduled_start),
        scheduled_end: asNullableDateTime(body.scheduled_end),
        service_area_id: asNullableText(body.service_area_id),
        route_id: asNullableText(body.route_id),
        supervisor_profile_id: asNullableText(body.supervisor_profile_id),
        crew_notes: body.crew_notes ?? null,
        customer_notes: body.customer_notes ?? null,
        safety_notes: body.safety_notes ?? null,
        subtotal: asNumber(body.subtotal, 0),
        tax_total: asNumber(body.tax_total, 0),
        total_amount: asNumber(body.total_amount, 0),
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.work_order_number) return Response.json({ ok:false, error:'work_order_number is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('work_orders').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('work_orders').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('work_orders').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'subcontract_client') {
      const patch = {
        client_id: asNullableText(body.client_id),
        subcontract_code: asNullableText(body.subcontract_code),
        company_name: body.company_name ?? null,
        contact_name: body.contact_name ?? null,
        contact_email: body.contact_email ?? null,
        contact_phone: body.contact_phone ?? null,
        billing_basis: body.billing_basis ?? 'hourly',
        rate_notes: body.rate_notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.company_name) return Response.json({ ok:false, error:'company_name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('subcontract_clients').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('subcontract_clients').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('subcontract_clients').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'subcontract_dispatch') {
      const patch = {
        dispatch_number: body.dispatch_number ?? null,
        subcontract_client_id: asNullableText(body.subcontract_client_id),
        client_site_id: asNullableText(body.client_site_id),
        work_order_id: asNullableText(body.work_order_id),
        operator_profile_id: asNullableText(body.operator_profile_id),
        equipment_master_id: asNullableText(body.equipment_master_id),
        dispatch_status: body.dispatch_status ?? 'draft',
        dispatch_start: asNullableDateTime(body.dispatch_start),
        dispatch_end: asNullableDateTime(body.dispatch_end),
        billing_basis: body.billing_basis ?? 'hourly',
        bill_rate: asNumber(body.bill_rate, 0),
        cost_rate: asNumber(body.cost_rate, 0),
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.dispatch_number || !patch.subcontract_client_id) return Response.json({ ok:false, error:'dispatch_number and subcontract_client_id are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('subcontract_dispatches').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('subcontract_dispatches').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('subcontract_dispatches').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'gl_account') {
      const patch = {
        account_number: body.account_number ?? null,
        account_name: body.account_name ?? null,
        account_type: body.account_type ?? null,
        parent_account_id: asNullableText(body.parent_account_id),
        system_code: body.system_code ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.account_number || !patch.account_name || !patch.account_type) return Response.json({ ok:false, error:'account_number, account_name, and account_type are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('chart_of_accounts').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('chart_of_accounts').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('chart_of_accounts').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'ap_vendor') {
      const patch = {
        vendor_code: asNullableText(body.vendor_code),
        legal_name: body.legal_name ?? null,
        display_name: body.display_name ?? null,
        contact_name: body.contact_name ?? null,
        contact_email: body.contact_email ?? null,
        contact_phone: body.contact_phone ?? null,
        payment_terms_days: asNumber(body.payment_terms_days, 30),
        tax_registration_number: body.tax_registration_number ?? null,
        notes: body.notes ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.legal_name) return Response.json({ ok:false, error:'legal_name is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('ap_vendors').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('ap_vendors').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('ap_vendors').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'ar_invoice') {
      const patch = {
        invoice_number: body.invoice_number ?? null,
        client_id: asNullableText(body.client_id),
        work_order_id: asNullableText(body.work_order_id),
        dispatch_id: asNullableText(body.dispatch_id),
        invoice_status: body.invoice_status ?? 'draft',
        invoice_date: asNullableDate(body.invoice_date) || new Date().toISOString().slice(0, 10),
        due_date: asNullableDate(body.due_date),
        subtotal: asNumber(body.subtotal, 0),
        tax_total: asNumber(body.tax_total, 0),
        total_amount: asNumber(body.total_amount, 0),
        balance_due: asNumber(body.balance_due, 0),
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.invoice_number || !patch.client_id) return Response.json({ ok:false, error:'invoice_number and client_id are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('ar_invoices').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('ar_invoices').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('ar_invoices').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'ap_bill') {
      const patch = {
        bill_number: body.bill_number ?? null,
        vendor_id: asNullableText(body.vendor_id),
        bill_status: body.bill_status ?? 'draft',
        bill_date: asNullableDate(body.bill_date) || new Date().toISOString().slice(0, 10),
        due_date: asNullableDate(body.due_date),
        subtotal: asNumber(body.subtotal, 0),
        tax_total: asNumber(body.tax_total, 0),
        total_amount: asNumber(body.total_amount, 0),
        balance_due: asNumber(body.balance_due, 0),
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.bill_number || !patch.vendor_id) return Response.json({ ok:false, error:'bill_number and vendor_id are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('ap_bills').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('ap_bills').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('ap_bills').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }



    if (entity === 'route_stop') {
      const patch = {
        route_id: asNullableText(body.route_id),
        client_site_id: asNullableText(body.client_site_id),
        stop_order: asNumber(body.stop_order, 0),
        planned_arrival_time: asNullableText(body.planned_arrival_time),
        planned_duration_minutes: asNullableNumber(body.planned_duration_minutes),
        instructions: body.instructions ?? null,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!patch.route_id) return Response.json({ ok:false, error:'route_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('route_stops').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('route_stops').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('route_stops').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'estimate_line') {
      const quantity = asNumber(body.quantity, 1);
      const patch = {
        estimate_id: asNullableText(body.estimate_id),
        line_order: asNumber(body.line_order, 0),
        line_type: body.line_type ?? 'service',
        description: body.description ?? null,
        cost_code_id: asNullableText(body.cost_code_id),
        unit_id: asNullableText(body.unit_id),
        quantity,
        unit_cost: asNumber(body.unit_cost, 0),
        unit_price: asNumber(body.unit_price, 0),
        line_total: asNumber(body.line_total, quantity * asNumber(body.unit_price, 0)),
        material_id: asNullableText(body.material_id),
        equipment_master_id: asNullableText(body.equipment_master_id),
        updated_at: new Date().toISOString(),
      };
      if (patch.material_id) {
        const material = await getMaterialDefaults(supabase, patch.material_id);
        if (material) {
          if (!patch.description) patch.description = material.item_name;
          if (!patch.unit_id) patch.unit_id = material.unit_id || null;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(material.default_unit_cost, patch.unit_cost);
          if (!asNullableNumber(body.unit_price)) patch.unit_price = asNumber(material.default_bill_rate, patch.unit_price);
          if (!patch.cost_code_id) patch.cost_code_id = await getCostCodeIdByCode(supabase, 'MAT');
        }
      }
      if (patch.equipment_master_id) {
        const equipment = await getEquipmentDefaults(supabase, patch.equipment_master_id);
        if (equipment) {
          if (!patch.description) patch.description = equipment.item_name;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(equipment.cost_rate_hourly, patch.unit_cost);
          if (!asNullableNumber(body.unit_price)) patch.unit_price = asNumber(equipment.bill_rate_hourly, patch.unit_price);
          if (!patch.cost_code_id) patch.cost_code_id = await getCostCodeIdByCode(supabase, 'EQP');
        }
      }
      patch.line_total = asNumber(body.line_total, patch.quantity * patch.unit_price);
      if (!patch.estimate_id || !patch.description) return Response.json({ ok:false, error:'estimate_id and description are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('estimate_lines').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('estimate_lines').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('estimate_lines').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'work_order_line') {
      const quantity = asNumber(body.quantity, 1);
      const patch = {
        work_order_id: asNullableText(body.work_order_id),
        line_order: asNumber(body.line_order, 0),
        line_type: body.line_type ?? 'service',
        description: body.description ?? null,
        cost_code_id: asNullableText(body.cost_code_id),
        unit_id: asNullableText(body.unit_id),
        quantity,
        unit_cost: asNumber(body.unit_cost, 0),
        unit_price: asNumber(body.unit_price, 0),
        line_total: asNumber(body.line_total, quantity * asNumber(body.unit_price, 0)),
        material_id: asNullableText(body.material_id),
        equipment_master_id: asNullableText(body.equipment_master_id),
        updated_at: new Date().toISOString(),
      };
      if (patch.material_id) {
        const material = await getMaterialDefaults(supabase, patch.material_id);
        if (material) {
          if (!patch.description) patch.description = material.item_name;
          if (!patch.unit_id) patch.unit_id = material.unit_id || null;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(material.default_unit_cost, patch.unit_cost);
          if (!asNullableNumber(body.unit_price)) patch.unit_price = asNumber(material.default_bill_rate, patch.unit_price);
          if (!patch.cost_code_id) patch.cost_code_id = await getCostCodeIdByCode(supabase, 'MAT');
        }
      }
      if (patch.equipment_master_id) {
        const equipment = await getEquipmentDefaults(supabase, patch.equipment_master_id);
        if (equipment) {
          if (!patch.description) patch.description = equipment.item_name;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(equipment.cost_rate_hourly, patch.unit_cost);
          if (!asNullableNumber(body.unit_price)) patch.unit_price = asNumber(equipment.bill_rate_hourly, patch.unit_price);
          if (!patch.cost_code_id) patch.cost_code_id = await getCostCodeIdByCode(supabase, 'EQP');
        }
      }
      patch.line_total = asNumber(body.line_total, patch.quantity * patch.unit_price);
      if (!patch.work_order_id || !patch.description) return Response.json({ ok:false, error:'work_order_id and description are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('work_order_lines').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('work_order_lines').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('work_order_lines').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'ar_payment') {
      const patch = {
        payment_number: body.payment_number ?? null,
        client_id: asNullableText(body.client_id),
        invoice_id: asNullableText(body.invoice_id),
        payment_date: asNullableDate(body.payment_date) || new Date().toISOString().slice(0, 10),
        payment_method: body.payment_method ?? null,
        reference_number: body.reference_number ?? null,
        amount: asNumber(body.amount, 0),
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (patch.invoice_id) {
        const { data: invoice } = await supabase.from('ar_invoices').select('id,client_id,balance_due').eq('id', patch.invoice_id).maybeSingle();
        if (invoice) {
          if (!patch.client_id) patch.client_id = invoice.client_id || null;
          if (!(Number(body.amount) > 0)) patch.amount = asNumber(invoice.balance_due, 0);
        }
      }
      if (!patch.payment_number || !patch.client_id) return Response.json({ ok:false, error:'payment_number and client_id are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('ar_payments').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('ar_payments').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('ar_payments').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'ap_payment') {
      const patch = {
        payment_number: body.payment_number ?? null,
        vendor_id: asNullableText(body.vendor_id),
        bill_id: asNullableText(body.bill_id),
        payment_date: asNullableDate(body.payment_date) || new Date().toISOString().slice(0, 10),
        payment_method: body.payment_method ?? null,
        reference_number: body.reference_number ?? null,
        amount: asNumber(body.amount, 0),
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (patch.bill_id) {
        const { data: bill } = await supabase.from('ap_bills').select('id,vendor_id,balance_due').eq('id', patch.bill_id).maybeSingle();
        if (bill) {
          if (!patch.vendor_id) patch.vendor_id = bill.vendor_id || null;
          if (!(Number(body.amount) > 0)) patch.amount = asNumber(bill.balance_due, 0);
        }
      }
      if (!patch.payment_number || !patch.vendor_id) return Response.json({ ok:false, error:'payment_number and vendor_id are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('ap_payments').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('ap_payments').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('ap_payments').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'material_receipt') {
      const patch = {
        receipt_number: body.receipt_number ?? null,
        vendor_id: asNullableText(body.vendor_id),
        client_site_id: asNullableText(body.client_site_id),
        work_order_id: asNullableText(body.work_order_id),
        receipt_status: body.receipt_status ?? 'draft',
        receipt_date: asNullableDate(body.receipt_date) || new Date().toISOString().slice(0, 10),
        received_by_profile_id: asNullableText(body.received_by_profile_id),
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (patch.work_order_id && !patch.client_site_id) {
        const { data: workOrder } = await supabase.from('work_orders').select('id,client_site_id').eq('id', patch.work_order_id).maybeSingle();
        if (workOrder?.client_site_id) patch.client_site_id = workOrder.client_site_id;
      }
      if (!patch.receipt_number) return Response.json({ ok:false, error:'receipt_number is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('material_receipts').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('material_receipts').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('material_receipts').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'material_receipt_line') {
      const quantity = asNumber(body.quantity, 0);
      const patch = {
        receipt_id: asNullableText(body.receipt_id),
        line_order: asNumber(body.line_order, 0),
        material_id: asNullableText(body.material_id),
        description: body.description ?? null,
        unit_id: asNullableText(body.unit_id),
        quantity,
        unit_cost: asNumber(body.unit_cost, 0),
        line_total: asNumber(body.line_total, quantity * asNumber(body.unit_cost, 0)),
        cost_code_id: asNullableText(body.cost_code_id),
        work_order_line_id: asNullableText(body.work_order_line_id),
        updated_at: new Date().toISOString(),
      };
      if (patch.work_order_line_id) {
        const workOrderLine = await getWorkOrderLineDefaults(supabase, patch.work_order_line_id);
        if (workOrderLine) {
          if (!patch.description) patch.description = workOrderLine.description;
          if (!patch.unit_id) patch.unit_id = workOrderLine.unit_id || null;
          if (!patch.material_id) patch.material_id = workOrderLine.material_id || null;
          if (!patch.cost_code_id) patch.cost_code_id = workOrderLine.cost_code_id || null;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(workOrderLine.unit_cost, patch.unit_cost);
        }
      }
      if (patch.material_id) {
        const material = await getMaterialDefaults(supabase, patch.material_id);
        if (material) {
          if (!patch.description) patch.description = material.item_name;
          if (!patch.unit_id) patch.unit_id = material.unit_id || null;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(material.default_unit_cost, patch.unit_cost);
          if (!patch.cost_code_id) patch.cost_code_id = await getCostCodeIdByCode(supabase, 'MAT');
        }
      }
      patch.line_total = asNumber(body.line_total, patch.quantity * patch.unit_cost);
      if (!patch.receipt_id || !patch.description) return Response.json({ ok:false, error:'receipt_id and description are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('material_receipt_lines').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('material_receipt_lines').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('material_receipt_lines').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'linked_hse_packet') {
      const patch = {
        packet_number: body.packet_number ?? null,
        packet_type: body.packet_type ?? 'work_order',
        packet_scope: body.packet_scope ?? 'standalone',
        packet_status: body.packet_status ?? 'draft',
        job_id: asNullableNumber(body.job_id),
        work_order_id: asNullableText(body.work_order_id),
        dispatch_id: asNullableText(body.dispatch_id),
        client_site_id: asNullableText(body.client_site_id),
        route_id: asNullableText(body.route_id),
        equipment_master_id: asNullableText(body.equipment_master_id),
        supervisor_profile_id: asNullableText(body.supervisor_profile_id),
        unscheduled_project: !!body.unscheduled_project || String(body.packet_type || '') === 'unscheduled_project',
        standalone_project_name: body.standalone_project_name ?? null,
        briefing_required: body.briefing_required !== false,
        briefing_completed: !!body.briefing_completed,
        inspection_required: body.inspection_required !== false,
        inspection_completed: !!body.inspection_completed,
        emergency_review_required: !!body.emergency_review_required,
        emergency_review_completed: !!body.emergency_review_completed,
        weather_monitoring_required: !!body.weather_monitoring_required,
        weather_monitoring_completed: !!body.weather_monitoring_completed,
        heat_monitoring_required: !!body.heat_monitoring_required,
        heat_monitoring_completed: !!body.heat_monitoring_completed,
        chemical_handling_required: !!body.chemical_handling_required,
        chemical_handling_completed: !!body.chemical_handling_completed,
        traffic_control_required: !!body.traffic_control_required,
        traffic_control_completed: !!body.traffic_control_completed,
        field_signoff_required: body.field_signoff_required !== false,
        field_signoff_completed: !!body.field_signoff_completed,
        closeout_completed: !!body.closeout_completed,
        completion_percent: asNumber(body.completion_percent, 0),
        required_item_count: asNumber(body.required_item_count, 0),
        completed_item_count: asNumber(body.completed_item_count, 0),
        issued_at: asNullableText(body.issued_at),
        started_at: asNullableText(body.started_at),
        ready_for_closeout_at: asNullableText(body.ready_for_closeout_at),
        closed_at: asNullableText(body.closed_at),
        field_signed_off_at: asNullableDateTime(body.field_signed_off_at),
        field_signed_off_by_profile_id: asNullableText(body.field_signed_off_by_profile_id),
        weather_notes: body.weather_notes ?? null,
        heat_plan_notes: body.heat_plan_notes ?? null,
        chemical_notes: body.chemical_notes ?? null,
        traffic_notes: body.traffic_notes ?? null,
        public_interaction_notes: body.public_interaction_notes ?? null,
        packet_notes: body.packet_notes ?? null,
        closeout_notes: body.closeout_notes ?? null,
        reopen_in_progress: !!body.reopen_in_progress,
        reopen_reason: body.reopen_reason ?? null,
        last_reopened_by_profile_id: body.reopen_in_progress ? actorId : asNullableText(body.last_reopened_by_profile_id),
        closed_by_profile_id: asNullableText(body.closed_by_profile_id),
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (patch.work_order_id && (!patch.client_site_id || !patch.route_id || !patch.supervisor_profile_id)) {
        const { data: workOrder } = await supabase.from('work_orders').select('id,client_site_id,route_id,supervisor_profile_id,legacy_job_id').eq('id', patch.work_order_id).maybeSingle();
        if (workOrder) {
          if (!patch.client_site_id) patch.client_site_id = workOrder.client_site_id || null;
          if (!patch.route_id) patch.route_id = workOrder.route_id || null;
          if (!patch.supervisor_profile_id) patch.supervisor_profile_id = workOrder.supervisor_profile_id || null;
          if (!patch.job_id && workOrder.legacy_job_id) patch.job_id = Number(workOrder.legacy_job_id) || null;
        }
      }
      if (patch.dispatch_id && (!patch.client_site_id || !patch.work_order_id)) {
        const { data: dispatch } = await supabase.from('subcontract_dispatches').select('id,client_site_id,work_order_id,equipment_master_id').eq('id', patch.dispatch_id).maybeSingle();
        if (dispatch) {
          if (!patch.client_site_id) patch.client_site_id = dispatch.client_site_id || null;
          if (!patch.work_order_id) patch.work_order_id = dispatch.work_order_id || null;
          if (!patch.equipment_master_id) patch.equipment_master_id = dispatch.equipment_master_id || null;
        }
      }
      if (!patch.packet_number) return Response.json({ ok:false, error:'packet_number is required' }, { status:400, headers:corsHeaders });
      if (patch.packet_type === 'unscheduled_project' && !patch.standalone_project_name) {
        patch.standalone_project_name = patch.packet_number;
      }
      if (action === 'create') {
        const { data, error } = await supabase.from('linked_hse_packets').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('linked_hse_packets').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('linked_hse_packets').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }


    if (entity === 'gl_journal_batch') {
      const patch = {
        batch_number: body.batch_number ?? null,
        source_module: body.source_module ?? 'manual',
        batch_status: body.batch_status ?? 'draft',
        batch_date: asNullableDate(body.batch_date) || new Date().toISOString().slice(0, 10),
        memo: body.memo ?? null,
        source_record_type: asNullableText(body.source_record_type),
        source_record_id: asNullableText(body.source_record_id),
        posting_notes: body.posting_notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.batch_number) return Response.json({ ok:false, error:'batch_number is required' }, { status:400, headers:corsHeaders });
      if ((action === 'create' || action === 'update') && patch.batch_status === 'posted') {
        return Response.json({ ok:false, error:'Use the journal batch post action after the batch is balanced.' }, { status:400, headers:corsHeaders });
      }
      if (action === 'create') {
        const { data, error } = await supabase.from('gl_journal_batches').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('gl_journal_batches').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'post') {
        const { data: batch } = await supabase.from('gl_journal_batches').select('id,batch_number,batch_status,line_count,debit_total,credit_total,is_balanced,source_generated,source_sync_state').eq('id', body.item_id).maybeSingle();
        if (!batch?.id) return Response.json({ ok:false, error:'Journal batch not found.' }, { status:404, headers:corsHeaders });
        if (String(batch.batch_status || '') === 'posted') return Response.json({ ok:true, record:batch }, { headers:corsHeaders });
        if (!(Number(batch.line_count) > 0)) return Response.json({ ok:false, error:'Journal batch must have at least one entry before posting.' }, { status:400, headers:corsHeaders });
        if (!batch.is_balanced) return Response.json({ ok:false, error:`Journal batch is not balanced. Debit ${batch.debit_total || 0} must equal credit ${batch.credit_total || 0}.` }, { status:400, headers:corsHeaders });
        if (batch.source_generated && String(batch.source_sync_state || '') === 'stale') return Response.json({ ok:false, error:'This source-generated batch is marked stale. Review and resolve the source sync exception before posting.' }, { status:400, headers:corsHeaders });
        const { data, error } = await supabase.from('gl_journal_batches').update({ batch_status:'posted', posted_at:new Date().toISOString(), posted_by_profile_id: actorId, posting_notes: body.posting_notes ?? null, source_sync_state: batch.source_generated ? 'posted' : 'manual', source_synced_at: new Date().toISOString(), updated_at:new Date().toISOString() }).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('gl_journal_batches').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'gl_journal_sync_exception') {
      const patch = {
        exception_status: body.exception_status ?? 'open',
        severity: body.severity ?? 'warning',
        title: body.title ?? null,
        details: body.details ?? null,
        resolution_notes: body.resolution_notes ?? null,
        resolved_by_profile_id: ['resolved','dismissed'].includes(String(body.exception_status || '')) ? actorId : null,
        updated_at: new Date().toISOString(),
      };
      if (action === 'update') {
        const { data, error } = await supabase.from('gl_journal_sync_exceptions').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('gl_journal_sync_exceptions').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'gl_journal_entry') {
      const debit = asNumber(body.debit_amount, 0);
      const credit = asNumber(body.credit_amount, 0);
      const patch = {
        batch_id: asNullableText(body.batch_id),
        line_number: asNullableNumber(body.line_number),
        entry_date: asNullableDate(body.entry_date) || new Date().toISOString().slice(0, 10),
        account_id: asNullableText(body.account_id),
        debit_amount: debit,
        credit_amount: credit,
        client_id: asNullableText(body.client_id),
        work_order_id: asNullableText(body.work_order_id),
        dispatch_id: asNullableText(body.dispatch_id),
        source_record_type: asNullableText(body.source_record_type),
        source_record_id: asNullableText(body.source_record_id),
        memo: body.memo ?? null,
        created_by_profile_id: actorId,
      };
      if (!patch.batch_id || !patch.account_id) return Response.json({ ok:false, error:'batch_id and account_id are required' }, { status:400, headers:corsHeaders });
      if (!((debit > 0 && credit === 0) || (credit > 0 && debit === 0))) {
        return Response.json({ ok:false, error:'Exactly one of debit_amount or credit_amount must be greater than zero.' }, { status:400, headers:corsHeaders });
      }
      if (action === 'create') {
        const { data, error } = await supabase.from('gl_journal_entries').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('gl_journal_entries').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('gl_journal_entries').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'material_issue') {
      const patch = {
        issue_number: body.issue_number ?? null,
        work_order_id: asNullableText(body.work_order_id),
        client_site_id: asNullableText(body.client_site_id),
        issue_status: body.issue_status ?? 'draft',
        issue_date: asNullableDate(body.issue_date) || new Date().toISOString().slice(0, 10),
        issued_by_profile_id: asNullableText(body.issued_by_profile_id),
        notes: body.notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (patch.work_order_id && !patch.client_site_id) {
        const { data: workOrder } = await supabase.from('work_orders').select('id,client_site_id').eq('id', patch.work_order_id).maybeSingle();
        if (workOrder?.client_site_id) patch.client_site_id = workOrder.client_site_id;
      }
      if (!patch.issue_number) return Response.json({ ok:false, error:'issue_number is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('material_issues').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('material_issues').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('material_issues').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'route_stop_execution') {
      const patch = {
        route_stop_id: asNullableText(body.route_stop_id),
        route_id: asNullableText(body.route_id),
        client_site_id: asNullableText(body.client_site_id),
        execution_date: asNullableDate(body.execution_date) || new Date().toISOString().slice(0, 10),
        execution_sequence: asNumber(body.execution_sequence, 1),
        execution_status: body.execution_status ?? 'planned',
        started_at: asNullableDateTime(body.started_at),
        arrived_at: asNullableDateTime(body.arrived_at),
        completed_at: asNullableDateTime(body.completed_at),
        completed_by_profile_id: asNullableText(body.completed_by_profile_id),
        supervisor_profile_id: asNullableText(body.supervisor_profile_id),
        delay_minutes: asNumber(body.delay_minutes, 0),
        special_instructions_acknowledged: !!body.special_instructions_acknowledged,
        notes: body.notes ?? null,
        exception_notes: body.exception_notes ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (patch.route_stop_id) {
        const stop = await getRouteStopDefaults(supabase, patch.route_stop_id);
        if (stop) {
          if (!patch.route_id) patch.route_id = stop.route_id || null;
          if (!patch.client_site_id) patch.client_site_id = stop.client_site_id || null;
        }
      }
      if (!patch.route_stop_id) return Response.json({ ok:false, error:'route_stop_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('route_stop_executions').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('route_stop_executions').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('route_stop_executions').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'route_stop_execution_attachment') {
      const patch = {
        execution_id: asNullableText(body.execution_id),
        attachment_kind: body.attachment_kind ?? 'photo',
        storage_bucket: body.storage_bucket ?? null,
        storage_path: body.storage_path ?? null,
        file_name: body.file_name ?? null,
        mime_type: body.mime_type ?? null,
        public_url: body.public_url ?? null,
        caption: body.caption ?? null,
        created_by_profile_id: actorId,
      };
      if (!patch.execution_id) return Response.json({ ok:false, error:'execution_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('route_stop_execution_attachments').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('route_stop_execution_attachments').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('route_stop_execution_attachments').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'hse_packet_proof') {
      const patch = {
        packet_id: asNullableText(body.packet_id),
        proof_kind: body.proof_kind ?? 'photo',
        proof_stage: body.proof_stage ?? 'field',
        storage_bucket: body.storage_bucket ?? null,
        storage_path: body.storage_path ?? null,
        file_name: body.file_name ?? null,
        mime_type: body.mime_type ?? null,
        public_url: body.public_url ?? null,
        caption: body.caption ?? null,
        proof_notes: body.proof_notes ?? null,
        uploaded_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.packet_id) return Response.json({ ok:false, error:'packet_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('hse_packet_proofs').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('hse_packet_proofs').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('hse_packet_proofs').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'hse_packet_event') {
      const patch = {
        packet_id: asNullableText(body.packet_id),
        event_type: body.event_type ?? 'note',
        event_status: body.event_status ?? 'ok',
        event_at: asNullableDateTime(body.event_at) || new Date().toISOString(),
        weather_condition: body.weather_condition ?? null,
        temperature_c: asNullableNumber(body.temperature_c),
        humidex_c: asNullableNumber(body.humidex_c),
        wind_kph: asNullableNumber(body.wind_kph),
        precipitation_notes: body.precipitation_notes ?? null,
        heat_risk_level: body.heat_risk_level ?? null,
        chemical_name: body.chemical_name ?? null,
        sds_reviewed: asNullableBool(body.sds_reviewed),
        ppe_verified: asNullableBool(body.ppe_verified),
        traffic_control_level: body.traffic_control_level ?? null,
        public_interaction_notes: body.public_interaction_notes ?? null,
        notes: body.notes ?? null,
        proof_url: body.proof_url ?? null,
        created_by_profile_id: actorId,
        updated_at: new Date().toISOString(),
      };
      if (!patch.packet_id) return Response.json({ ok:false, error:'packet_id is required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('hse_packet_events').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('hse_packet_events').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('hse_packet_events').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'field_upload_failure') {
      const patch = {
        retry_status: body.retry_status ?? 'pending',
        resolution_notes: body.resolution_notes ?? null,
        retry_owner_profile_id: asNullableText(body.retry_owner_profile_id),
        retry_owner_notes: body.retry_owner_notes ?? null,
        upload_attempts: asNumber(body.upload_attempts, 0),
        last_retry_at: asNullableDateTime(body.last_retry_at),
        next_retry_after: asNullableDateTime(body.next_retry_after),
        resolved_by_profile_id: ['resolved','abandoned'].includes(String(body.retry_status || '')) ? actorId : null,
        updated_at: new Date().toISOString(),
      };
      if (action === 'update') {
        const { data, error } = await supabase.from('field_upload_failures').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('field_upload_failures').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }


    if (entity === 'backend_monitor_event') {
      const patch = {
        lifecycle_status: body.lifecycle_status ?? 'open',
        severity: body.severity ?? 'warning',
        resolution_notes: body.resolution_notes ?? null,
        resolved_by_profile_id: ['resolved','dismissed'].includes(String(body.lifecycle_status || '')) ? actorId : null,
        updated_at: new Date().toISOString(),
      };
      if (action === 'update') {
        const { data, error } = await supabase.from('backend_monitor_events').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('backend_monitor_events').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'app_traffic_event') {
      if (action === 'delete') {
        const { error } = await supabase.from('app_traffic_events').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    if (entity === 'material_issue_line') {
      const quantity = asNumber(body.quantity, 0);
      const patch = {
        issue_id: asNullableText(body.issue_id),
        line_order: asNumber(body.line_order, 0),
        material_id: asNullableText(body.material_id),
        work_order_line_id: asNullableText(body.work_order_line_id),
        description: body.description ?? null,
        unit_id: asNullableText(body.unit_id),
        quantity,
        unit_cost: asNumber(body.unit_cost, 0),
        line_total: asNumber(body.line_total, quantity * asNumber(body.unit_cost, 0)),
        cost_code_id: asNullableText(body.cost_code_id),
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      };
      if (patch.work_order_line_id) {
        const workOrderLine = await getWorkOrderLineDefaults(supabase, patch.work_order_line_id);
        if (workOrderLine) {
          if (!patch.description) patch.description = workOrderLine.description;
          if (!patch.unit_id) patch.unit_id = workOrderLine.unit_id || null;
          if (!patch.material_id) patch.material_id = workOrderLine.material_id || null;
          if (!patch.cost_code_id) patch.cost_code_id = workOrderLine.cost_code_id || null;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(workOrderLine.unit_cost, patch.unit_cost);
        }
      }
      if (patch.material_id) {
        const material = await getMaterialDefaults(supabase, patch.material_id);
        if (material) {
          if (!patch.description) patch.description = material.item_name;
          if (!patch.unit_id) patch.unit_id = material.unit_id || null;
          if (!asNullableNumber(body.unit_cost)) patch.unit_cost = asNumber(material.default_unit_cost, patch.unit_cost);
          if (!patch.cost_code_id) patch.cost_code_id = await getCostCodeIdByCode(supabase, 'MAT');
        }
      }
      patch.line_total = asNumber(body.line_total, patch.quantity * patch.unit_cost);
      if (!patch.issue_id || !patch.description) return Response.json({ ok:false, error:'issue_id and description are required' }, { status:400, headers:corsHeaders });
      if (action === 'create') {
        const { data, error } = await supabase.from('material_issue_lines').insert(patch).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'update') {
        const { data, error } = await supabase.from('material_issue_lines').update(patch).eq('id', body.item_id).select('*').single();
        if (error) throw error;
        return Response.json({ ok:true, record:data }, { headers:corsHeaders });
      }
      if (action === 'delete') {
        const { error } = await supabase.from('material_issue_lines').delete().eq('id', body.item_id);
        if (error) throw error;
        return Response.json({ ok:true }, { headers:corsHeaders });
      }
    }

    return Response.json({ ok: false, error: 'Unsupported entity/action' }, { status: 400, headers: corsHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: String(error) }, { status: 500, headers: corsHeaders });
  }
});
