// Edge Function: upload-equipment-evidence
// Purpose:
// - Accept equipment checkout/return evidence photos and signature images
// - Store the binary objects in Supabase Storage
// - Write auditable metadata rows into equipment_evidence_assets

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
  if (userError || !userData.user) return Response.json({ ok:false, error:'Unauthorized' }, { status:401, headers:corsHeaders });

  const { data: actorProfile } = await supabase.from('profiles').select('id,is_active').eq('id', userData.user.id).single();
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });

  const form = await req.formData();
  const signoutId = Number(form.get('signout_id') || 0);
  const stage = String(form.get('stage') || 'checkout');
  const evidenceKind = String(form.get('evidence_kind') || 'photo');
  const signerRole = String(form.get('signer_role') || '');
  const caption = String(form.get('caption') || '');
  const file = form.get('file') as File | null;
  if (!signoutId || !file) return Response.json({ ok:false, error:'signout_id and file are required' }, { status:400, headers:corsHeaders });

  const { data: signout, error: signoutError } = await supabase
    .from('equipment_signouts')
    .select('id,equipment_item_id,job_id')
    .eq('id', signoutId)
    .single();
  if (signoutError || !signout) return Response.json({ ok:false, error:'Equipment signout not found' }, { status:404, headers:corsHeaders });

  const ext = (file.name || 'upload.bin').split('.').pop() || 'bin';
  const bucket = 'equipment-evidence';
  const path = `${signoutId}/${stage}/${crypto.randomUUID()}-${evidenceKind}${signerRole ? `-${signerRole}` : ''}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file.stream(), { contentType: file.type, upsert: false });
  if (uploadError) return Response.json({ ok:false, error:uploadError.message }, { status:500, headers:corsHeaders });

  const { data: signedUrlData } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);

  const { data: record, error: insertError } = await supabase.from('equipment_evidence_assets').insert({
    signout_id: signoutId,
    equipment_item_id: signout.equipment_item_id,
    job_id: signout.job_id,
    stage,
    evidence_kind: evidenceKind,
    signer_role: signerRole || null,
    storage_bucket: bucket,
    storage_path: path,
    file_name: file.name,
    content_type: file.type || null,
    file_size_bytes: file.size || null,
    caption: caption || null,
    preview_url: signedUrlData?.signedUrl || null,
    uploaded_by_profile_id: actorProfile.id,
  }).select('*').single();
  if (insertError) return Response.json({ ok:false, error:insertError.message }, { status:500, headers:corsHeaders });

  return Response.json({ ok:true, record }, { headers:corsHeaders });
});
