// Edge Function: bootstrap-admin
// Purpose:
// - Provides a small authenticated bootstrap payload for cached or legacy frontend callers
// - Prevents stale builds from hard-failing on a missing endpoint while the app migrates to local bootstrap/auth logic

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient((Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL'))!, (Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).maybeSingle();
  return Response.json({ ok: true, user: userData.user, profile: profile || null, role: profile?.role || 'employee', isAuthenticated: true }, { headers: corsHeaders });
});
