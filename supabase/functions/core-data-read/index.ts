// Schema 163: Shared Core Data read endpoint.
// Read-only directory access for canonical Core identities. Every request requires an
// authenticated active profile plus view access to the calling business module.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasModuleAccess } from "../_shared/module-permissions.ts";
import {
  CORE_DATA_CONTRACT_VERSION,
  CORE_ENTITY_KEYS,
  normalizeCoreEntityKeys,
  readCoreDataModels,
} from "../_shared/core-data-read-models.ts";

const BUILD = '2026-09-01e';
const SCHEMA = 163;
const MODULE_KEYS = new Set(['safety', 'finance', 'jobs', 'admin']);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST required.' }, 405);

  const supabaseUrl = (Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL') || '').trim();
  const serviceRoleKey = (Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'Shared Core service is not configured.' }, 503);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ ok: false, error: 'Unauthorized' }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ ok: false, error: 'Unauthorized' }, 401);

  const { data: actorProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id,role,is_active')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !actorProfile) return json({ ok: false, error: 'Profile not found.' }, 403);
  if (actorProfile.is_active !== true) return json({ ok: false, error: 'Inactive profile.' }, 403);

  const body = await req.json().catch(() => ({}));
  const moduleKey = String(body?.module_key || body?.moduleKey || '').trim().toLowerCase();
  if (!MODULE_KEYS.has(moduleKey)) {
    return json({ ok: false, error: 'A valid module_key is required.', allowed_modules: [...MODULE_KEYS] }, 400);
  }

  const permitted = await hasModuleAccess(supabase, actorProfile, moduleKey as 'safety'|'finance'|'jobs'|'admin', 'view');
  if (!permitted) {
    return json({
      ok: false,
      error: `${moduleKey} module view access is required.`,
      module_key: moduleKey,
      required_access: 'view',
    }, 403);
  }

  const requestedEntities = normalizeCoreEntityKeys(body?.entities);
  if (!requestedEntities.length) {
    return json({ ok: false, error: 'No valid Shared Core entities were requested.', allowed_entities: CORE_ENTITY_KEYS }, 400);
  }

  try {
    const result = await readCoreDataModels(supabase, requestedEntities, body?.limit);
    return json({
      ok: true,
      build: BUILD,
      schema: SCHEMA,
      contract_version: CORE_DATA_CONTRACT_VERSION,
      module_key: moduleKey,
      read_only: true,
      entities: result.entityKeys,
      limit: result.limit,
      counts: result.counts,
      data: result.data,
    });
  } catch (error) {
    console.error('Shared Core read failed', {
      module_key: moduleKey,
      actor_profile_id: actorProfile.id,
      message: String((error as any)?.message || error || 'unknown error'),
    });
    return json({
      ok: false,
      error: 'Shared Core data could not be loaded.',
      module_key: moduleKey,
      schema: SCHEMA,
    }, 500);
  }
});