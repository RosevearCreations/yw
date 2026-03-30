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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
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

    if (entity === 'profile' && action === 'update') {
      const patch = {
        full_name: body.full_name ?? null,
        role: body.role ?? undefined,
        is_active: body.is_active ?? true,
        phone: body.phone ?? null,
        phone_verified: !!body.phone_verified,
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
        previous_employee: !!body.previous_employee,
        trade_specialty: body.trade_specialty ?? null,
        strengths: body.strengths ?? null,
        certifications: body.certifications ?? null,
        feature_preferences: body.feature_preferences ?? null,
        notes: body.notes ?? null,
        default_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.default_supervisor_name),
        override_supervisor_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.override_supervisor_name),
        default_admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.default_admin_name),
        override_admin_profile_id: await resolveProfileIdByNameOrEmail(supabase, body.override_admin_name),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', body.profile_id).select('*').single();
      if (error) throw error;
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

    if (entity === 'assignment' && action === 'delete') {
      const { error } = await supabase.from('site_assignments').delete().eq('id', body.assignment_id);
      if (error) throw error;
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    return Response.json({ ok: false, error: 'Unsupported entity/action' }, { status: 400, headers: corsHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: String(error) }, { status: 500, headers: corsHeaders });
  }
});
