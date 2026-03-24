// Detailed Edge Function: notify-admins
// Purpose:
// - Queue admin notifications when supervisor/site leader/HSE/job admin sign-off or review happens.
// - Can also be called directly by other functions after submissions/reviews.
// - Attempts outbound email when Resend is configured.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmailIfConfigured(row: any) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM');
  const to = row?.email_to || Deno.env.get('ADMIN_NOTIFICATION_TO');
  if (!apiKey || !from || !to) return { attempted: false, status: 'pending' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: String(to).split(/[;,]/).map((v) => v.trim()).filter(Boolean),
      subject: row.email_subject || row.title || 'YWI HSE notification',
      text: row.body || row.message || JSON.stringify(row.payload || {})
    })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return { attempted: true, status: 'sent' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok:false, error:'Unauthorized' }, { status:401, headers:corsHeaders });

  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });

  const body = await req.json();
  const notificationType = body.notification_type || 'submission_signed_off';
  const title = body.title || 'Supervisor sign-off submitted';
  const message = body.message || body.body || `${actorProfile.full_name || actorProfile.email} submitted a record that requires admin review.`;

  const { data: admins } = await supabase.from('profiles').select('id').eq('is_active', true).eq('role', 'admin');
  const rows = (admins || []).map((admin:any) => ({
    notification_type: notificationType,
    recipient_role: 'admin',
    target_profile_id: admin.id,
    target_table: body.target_table || null,
    target_id: body.target_id != null ? String(body.target_id) : null,
    title,
    subject: title,
    body: message,
    message,
    payload: body.payload ?? {},
    status: 'queued',
    email_subject: title,
    created_by_profile_id: actorProfile.id,
  }));

  if (rows.length) {
    const { data, error } = await supabase.from('admin_notifications').insert(rows).select('*');
    if (error) return Response.json({ ok:false, error:error.message }, { status:500, headers:corsHeaders });
    for (const row of data || []) {
      try {
        const sent = await sendEmailIfConfigured(row);
        if (sent.attempted) await supabase.from('admin_notifications').update({ email_status: sent.status, status: 'sent', sent_at: new Date().toISOString() }).eq('id', row.id);
      } catch (err) {
        await supabase.from('admin_notifications').update({ email_status: 'failed', email_error: String(err), status: 'failed' }).eq('id', row.id);
      }
    }
  }

  return Response.json({ ok:true, queued: rows.length }, { headers:corsHeaders });
});
