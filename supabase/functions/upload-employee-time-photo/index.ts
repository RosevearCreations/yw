// Edge Function: upload-employee-time-photo
// Purpose:
// - Accept employee clock-in/clock-out attendance photo uploads
// - Store binary objects in Supabase Storage
// - Update employee_time_entries with auditable photo metadata
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

  const { data: actorProfile } = await supabase.from('profiles').select('id,is_active,role,full_name,email').eq('id', userData.user.id).single();
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });

  const form = await req.formData();
  const timeEntryId = String(form.get('time_entry_id') || '');
  const stage = String(form.get('stage') || 'clock_in');
  const photoNote = String(form.get('photo_note') || '');
  const file = form.get('file') as File | null;
  if (!timeEntryId || !file) return Response.json({ ok:false, error:'time_entry_id and file are required' }, { status:400, headers:corsHeaders });
  if (!['clock_in','clock_out'].includes(stage)) return Response.json({ ok:false, error:'stage must be clock_in or clock_out' }, { status:400, headers:corsHeaders });

  const { data: entry, error: entryError } = await supabase
    .from('employee_time_entries')
    .select('id,profile_id,job_id,site_id')
    .eq('id', timeEntryId)
    .single();
  if (entryError || !entry) return Response.json({ ok:false, error:'Employee time entry not found' }, { status:404, headers:corsHeaders });
  if (actorProfile.role !== 'admin' && entry.profile_id !== actorProfile.id) {
    return Response.json({ ok:false, error:'You can only upload photos for your own time entry.' }, { status:403, headers:corsHeaders });
  }

  const ext = (file.name || 'upload.bin').split('.').pop() || 'bin';
  const bucket = 'submission-images';
  const path = `employee-time/${timeEntryId}/${stage}/${crypto.randomUUID()}-${stage}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file.stream(), { contentType: file.type, upsert: false });
  if (uploadError) {
    const failureId = await logUploadFailure(supabase, {
      failure_scope: 'employee_time_photo',
      linked_record_type: 'employee_time_entry',
      linked_record_id: timeEntryId,
      file_name: file.name,
      content_type: file.type || null,
      file_size_bytes: file.size || null,
      storage_bucket: bucket,
      storage_path: path,
      failure_stage: 'upload',
      failure_reason: uploadError.message,
      retry_status: 'pending',
      upload_attempts: 1,
      client_context: { stage, photo_note: photoNote || null },
      created_by_profile_id: actorProfile.id,
    });
    return Response.json({ ok:false, error:uploadError.message, failure_id: failureId }, { status:500, headers:corsHeaders });
  }

  const { data: signedUrlData } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  patch[`${stage}_photo_bucket`] = bucket;
  patch[`${stage}_photo_path`] = path;
  patch[`${stage}_photo_url`] = signedUrlData?.signedUrl || null;
  patch[`${stage}_photo_file_name`] = file.name || null;
  patch[`${stage}_photo_mime_type`] = file.type || null;
  patch[`${stage}_photo_uploaded_at`] = new Date().toISOString();
  if (photoNote) patch[`${stage}_photo_note`] = photoNote;

  const { data: record, error: updateError } = await supabase.from('employee_time_entries').update(patch).eq('id', timeEntryId).select('*').single();
  if (updateError) {
    await supabase.storage.from(bucket).remove([path]).catch(() => null);
    const failureId = await logUploadFailure(supabase, {
      failure_scope: 'employee_time_photo',
      linked_record_type: 'employee_time_entry',
      linked_record_id: timeEntryId,
      file_name: file.name,
      content_type: file.type || null,
      file_size_bytes: file.size || null,
      storage_bucket: bucket,
      storage_path: path,
      failure_stage: 'metadata_update',
      failure_reason: updateError.message,
      retry_status: 'pending',
      upload_attempts: 1,
      client_context: { stage, photo_note: photoNote || null },
      created_by_profile_id: actorProfile.id,
    });
    return Response.json({ ok:false, error:updateError.message, failure_id: failureId }, { status:500, headers:corsHeaders });
  }

  try {
    await supabase.from('site_activity_events').insert({
      event_type: stage === 'clock_in' ? 'employee_clock_in' : 'employee_clock_out',
      entity_type: 'employee_time_entry',
      entity_id: record.id,
      severity: 'info',
      title: stage === 'clock_in' ? 'Clock-in photo uploaded' : 'Clock-out photo uploaded',
      summary: `${actorProfile.full_name || actorProfile.email || 'Worker'} uploaded a ${stage.replace('_', ' ')} photo.`,
      metadata: { stage, photo_url: signedUrlData?.signedUrl || null, file_name: file.name || null },
      related_job_id: record.job_id || null,
      related_profile_id: record.profile_id || null,
      created_by_profile_id: actorProfile.id,
    });
  } catch {
    // ignore site activity failures
  }

  return Response.json({ ok:true, record }, { headers:corsHeaders });
});
