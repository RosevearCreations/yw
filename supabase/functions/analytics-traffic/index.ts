// Edge Function: analytics-traffic
// Purpose:
// - accept page/route/API/error telemetry
// - write DB-backed traffic analytics events
// - write backend/frontend monitor incidents for admin review

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
  let profileId: string | null = null;
  let roleLabel: string | null = null;
  if (token) {
    try {
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user?.id) {
        profileId = userData.user.id;
        const { data: profile } = await supabase.from('profiles').select('id,role,staff_tier').eq('id', profileId).maybeSingle();
        roleLabel = profile?.role || profile?.staff_tier || null;
      }
    } catch {
      // allow anonymous traffic logging
    }
  }

  const body = await req.json().catch(() => ({}));
  const eventName = String(body.event_name || body.eventName || 'page_view');
  const trafficRow: Record<string, unknown> = {
    session_key: body.session_key ?? body.sessionKey ?? null,
    visitor_key: body.visitor_key ?? body.visitorKey ?? null,
    event_name: eventName,
    route_name: body.route_name ?? body.routeName ?? null,
    page_path: body.page_path ?? body.pagePath ?? null,
    page_title: body.page_title ?? body.pageTitle ?? null,
    referrer: body.referrer ?? null,
    source_medium: body.source_medium ?? body.sourceMedium ?? null,
    user_agent: req.headers.get('user-agent') || body.user_agent || null,
    profile_id: profileId,
    role_label: roleLabel || body.role_label || null,
    is_authenticated: !!profileId,
    request_method: body.request_method ?? body.requestMethod ?? null,
    endpoint_path: body.endpoint_path ?? body.endpointPath ?? null,
    http_status: body.http_status ?? body.httpStatus ?? null,
    duration_ms: body.duration_ms ?? body.durationMs ?? null,
    event_value: body.event_value ?? body.eventValue ?? null,
    details: body.details ?? {},
  };

  const { data: trafficRecord, error: trafficError } = await supabase.from('app_traffic_events').insert(trafficRow).select('id').single();
  if (trafficError) return Response.json({ ok:false, error: trafficError.message }, { status:500, headers:corsHeaders });

  const severity = String(body.severity || '');
  const shouldOpenMonitor = ['api_error','client_error','upload_failure'].includes(eventName) || ['warning','error','critical'].includes(severity);
  let monitorEventId = null;

  if (shouldOpenMonitor) {
    const monitorPayload: Record<string, unknown> = {
      monitor_scope: body.monitor_scope ?? body.monitorScope ?? (eventName === 'client_error' ? 'frontend' : 'backend'),
      event_name: eventName,
      severity: severity || (eventName === 'client_error' ? 'error' : 'warning'),
      lifecycle_status: body.lifecycle_status ?? body.lifecycleStatus ?? 'open',
      route_name: body.route_name ?? body.routeName ?? null,
      endpoint_path: body.endpoint_path ?? body.endpointPath ?? null,
      function_name: body.function_name ?? body.functionName ?? null,
      error_code: body.error_code ?? body.errorCode ?? null,
      http_status: body.http_status ?? body.httpStatus ?? null,
      title: body.title ?? null,
      message: body.message ?? body.error_message ?? body.errorMessage ?? null,
      linked_failure_id: body.linked_failure_id ?? body.linkedFailureId ?? null,
      details: {
        ...(body.details || {}),
        traffic_event_id: trafficRecord?.id || null,
      },
      occurrence_count: 1,
    };
    const { data } = await supabase.from('backend_monitor_events').insert(monitorPayload).select('id').single();
    monitorEventId = data?.id || null;
  }

  return Response.json({ ok:true, traffic_event_id: trafficRecord?.id || null, monitor_event_id: monitorEventId }, { headers:corsHeaders });
});
