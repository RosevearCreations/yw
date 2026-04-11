// Edge Function: upload-hse-packet-proof
// Purpose:
// - Accept HSE packet proof uploads
// - Store binary objects in Supabase Storage
// - Write auditable metadata rows into hse_packet_proofs
// - Leave failure trail rows in field_upload_failures on upload/metadata problems

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function logUploadFailure(supabase: any, payload: Record<string, unknown>) {
  try {
    const { data } = await supabase.from('field_upload_failures').insert(payload).select('id').single();
    return data?.id || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient((Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL'))!, (Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!);
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ ok:false, error:'Unauthorized' }, { status:401, headers:corsHeaders });

  const { data: actorProfile } = await supabase.from('profiles').select('id,is_active').eq('id', userData.user.id).single();
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });

  const form = await req.formData();
  const packetId = String(form.get('packet_id') || '');
  const proofKind = String(form.get('proof_kind') || 'photo');
  const proofStage = String(form.get('proof_stage') || 'field');
  const caption = String(form.get('caption') || '');
  const proofNotes = String(form.get('proof_notes') || '');
  const file = form.get('file') as File | null;
  if (!packetId || !file) return Response.json({ ok:false, error:'packet_id and file are required' }, { status:400, headers:corsHeaders });

  const { data: packet, error: packetError } = await supabase
    .from('linked_hse_packets')
    .select('id,packet_number,packet_type,packet_scope')
    .eq('id', packetId)
    .single();
  if (packetError || !packet) return Response.json({ ok:false, error:'HSE packet not found' }, { status:404, headers:corsHeaders });

  const ext = (file.name || 'upload.bin').split('.').pop() || 'bin';
  const bucket = 'submission-images';
  const path = `hse-packets/${packetId}/${proofStage}/${crypto.randomUUID()}-${proofKind}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file.stream(), { contentType: file.type, upsert: false });
  if (uploadError) {
    const failureId = await logUploadFailure(supabase, {
      failure_scope: 'hse_proof',
      linked_record_type: 'linked_hse_packet',
      linked_record_id: packetId,
      packet_id: packetId,
      file_name: file.name,
      content_type: file.type || null,
      file_size_bytes: file.size || null,
      storage_bucket: bucket,
      storage_path: path,
      failure_stage: 'upload',
      failure_reason: uploadError.message,
      retry_status: 'pending',
      upload_attempts: 1,
      client_context: { proof_kind: proofKind || 'photo', proof_stage: proofStage || 'field', caption, proof_notes: proofNotes, packet_number: packet.packet_number || null },
      created_by_profile_id: actorProfile.id,
    });
    return Response.json({ ok:false, error:uploadError.message, failure_id: failureId }, { status:500, headers:corsHeaders });
  }

  const { data: signedUrlData } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
  const { data: record, error: insertError } = await supabase.from('hse_packet_proofs').insert({
    packet_id: packetId,
    proof_kind: proofKind || 'photo',
    proof_stage: proofStage || 'field',
    storage_bucket: bucket,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    public_url: signedUrlData?.signedUrl || null,
    caption: caption || null,
    proof_notes: proofNotes || null,
    uploaded_by_profile_id: actorProfile.id,
  }).select('*').single();

  if (insertError) {
    await supabase.storage.from(bucket).remove([path]).catch(() => null);
    const failureId = await logUploadFailure(supabase, {
      failure_scope: 'hse_proof',
      linked_record_type: 'linked_hse_packet',
      linked_record_id: packetId,
      packet_id: packetId,
      file_name: file.name,
      content_type: file.type || null,
      file_size_bytes: file.size || null,
      storage_bucket: bucket,
      storage_path: path,
      failure_stage: 'metadata_insert',
      failure_reason: insertError.message,
      retry_status: 'pending',
      upload_attempts: 1,
      client_context: { proof_kind: proofKind || 'photo', proof_stage: proofStage || 'field', caption, proof_notes: proofNotes, packet_number: packet.packet_number || null },
      created_by_profile_id: actorProfile.id,
    });
    return Response.json({ ok:false, error:insertError.message, failure_id: failureId }, { status:500, headers:corsHeaders });
  }

  return Response.json({ ok:true, record }, { headers:corsHeaders });
});
