
// Detailed Edge Function: notify-admins
// Purpose:
// - Queue admin notifications when supervisor/site leader/HSE/job admin sign-off or review happens.
// - Can also be called directly by other functions after submissions/reviews.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok:false, error:'Unauthorized' }, { status:401, headers:corsHeaders });

  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });

  const body = await req.json();
  const eventType = body.event_type || 'submission_signed_off';
  const title = body.title || 'Supervisor sign-off submitted';
  const message = body.message || `${actorProfile.full_name || actorProfile.email} submitted a record that requires admin review.`;

  const { data: admins } = await supabase.from('profiles').select('id').eq('is_active', true).eq('role', 'admin');
  const rows = (admins || []).map((admin:any) => ({
    event_type: eventType,
    submission_id: body.submission_id ?? null,
    site_id: body.site_id ?? null,
    actor_profile_id: actorProfile.id,
    actor_name: actorProfile.full_name || actorProfile.email,
    actor_role: actorProfile.role,
    recipient_profile_id: admin.id,
    title,
    message,
    payload: body.payload ?? {}
  }));

  if (rows.length) {
    const { error } = await supabase.from('admin_notifications').insert(rows);
    if (error) return Response.json({ ok:false, error:error.message }, { status:500, headers:corsHeaders });
  }

  return Response.json({ ok:true, queued: rows.length }, { headers:corsHeaders });
});
