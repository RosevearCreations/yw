// Edge Function: account-maintenance
// Purpose:
// - Account validation workflows for authenticated users
// - Currently supports phone verification requests routed to admins

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

  const actorId = userData.user.id;
  const { data: actorProfile } = await supabase.from('profiles').select('*').eq('id', actorId).single();
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });

  const body = await req.json().catch(() => ({}));
  if (body.action === 'request_phone_verification') {
    const phone = String(body.phone || actorProfile.phone || '').trim();
    if (!phone) return Response.json({ ok:false, error:'Phone number required' }, { status:400, headers:corsHeaders });

    const { data, error } = await supabase.from('admin_notifications').insert({
      notification_type: 'phone_verification_request',
      target_table: 'profiles',
      target_id: actorId,
      recipient_role: 'admin',
      subject: `Phone verification requested for ${actorProfile.full_name || actorProfile.email}`,
      body: JSON.stringify({ profile_id: actorId, email: actorProfile.email, phone }),
      status: 'queued',
      created_by_profile_id: actorId,
    }).select('*').single();
    if (error) return Response.json({ ok:false, error:String(error.message || error) }, { status:500, headers:corsHeaders });
    return Response.json({ ok:true, record: data }, { headers:corsHeaders });
  }

  return Response.json({ ok:false, error:'Unsupported action' }, { status:400, headers:corsHeaders });
});
