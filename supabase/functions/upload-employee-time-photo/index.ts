import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function logFailure(supabase: any, payload: Record<string, unknown>) {
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
  const { data: actorProfile } = await supabase.from('profiles').select('id,is_active,full_name').eq('id', userData.user.id).single();
  if (!actorProfile?.is_active) return Response.json({ ok:false, error:'Inactive profile' }, { status:403, headers:corsHeaders });

  const form = await req.formData();
  const timeEntryId = String(form.get('time_entry_id') || '').trim();
  const stage = String(form.get('stage') || 'clock_in').trim().toLowerCase();
  const caption = String(form.get('caption') || '').trim();
  const file = form.get('file') as File | null;
  if (!timeEntryId || !file) return Response.json({ ok:false, error:'time_entry_id and file are required' }, { status:400, headers:corsHeaders });
  if (!['clock_in','clock_out'].includes(stage)) return Response.json({ ok:false, error:'stage must be clock_in or clock_out' }, { status:400, headers:corsHeaders });

  const { data: entry, error: entryErr } = await supabase.from('employee_time_entries').select('id,profile_id,job_id,site_id').eq('id', timeEntryId).single();
  if (entryErr || !entry) return Response.json({ ok:false, error:'Employee time entry not found' }, { status:404, headers:corsHeaders });
  if (String(entry.profile_id) !== String(actorProfile.id)) {
    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', actorProfile.id).maybeSingle();
    if (!['admin','supervisor'].includes(String(adminProfile?.role || '').toLowerCase())) {
      return Response.json({ ok:false, error:'You cannot upload a photo for another employee time entry.' }, { status:403, headers:corsHeaders });
    }
  }

  const ext = (file.name || 'upload.bin').split('.').pop() || 'bin';
  const bucket = 'submission-images';
  const path = `employee-time/${timeEntryId}/${crypto.randomUUID()}-${stage}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file.stream(), { contentType: file.type || 'application/octet-stream', upsert: false });
  if (uploadError) {
    const failureId = await logFailure(supabase, {
      failure_scope: 'employee_time_photo', linked_record_type: 'employee_time_entry', linked_record_id: timeEntryId,
      file_name: file.name, content_type: file.type || null, file_size_bytes: file.size || null,
      storage_bucket: bucket, storage_path: path, failure_stage: 'upload', failure_reason: uploadError.message,
      retry_status: 'pending', upload_attempts: 1, client_context: { stage, caption, job_id: entry.job_id || null, site_id: entry.site_id || null }, created_by_profile_id: actorProfile.id,
    });
    return Response.json({ ok:false, error:uploadError.message, failure_id: failureId }, { status:500, headers:corsHeaders });
  }

  const { data: signedUrl } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
  const patch: Record<string, unknown> = {
    [`${stage}_photo_bucket`]: bucket,
    [`${stage}_photo_path`]: path,
    [`${stage}_photo_url`]: signedUrl?.signedUrl || null,
    [`${stage}_photo_uploaded_at`]: new Date().toISOString(),
    [`${stage}_photo_note`]: caption || null,
    updated_at: new Date().toISOString(),
  };
  const { data: updated, error: updateErr } = await supabase.from('employee_time_entries').update(patch).eq('id', timeEntryId).select('*').single();
  if (updateErr) {
    await supabase.storage.from(bucket).remove([path]).catch(() => null);
    const failureId = await logFailure(supabase, {
      failure_scope: 'employee_time_photo', linked_record_type: 'employee_time_entry', linked_record_id: timeEntryId,
      file_name: file.name, content_type: file.type || null, file_size_bytes: file.size || null,
      storage_bucket: bucket, storage_path: path, failure_stage: 'metadata_update', failure_reason: updateErr.message,
      retry_status: 'pending', upload_attempts: 1, client_context: { stage, caption, job_id: entry.job_id || null, site_id: entry.site_id || null }, created_by_profile_id: actorProfile.id,
    });
    return Response.json({ ok:false, error:updateErr.message, failure_id: failureId }, { status:500, headers:corsHeaders });
  }

  await supabase.from('site_activity_events').insert({
    event_type: 'employee_time_photo_uploaded', entity_type: 'employee_time_entry', entity_id: updated.id, severity: 'info',
    title: 'Attendance photo uploaded', summary: `${actorProfile.full_name || 'Worker'} uploaded a ${stage.replace('_', ' ')} attendance photo.`,
    related_job_id: updated.job_id || null, related_profile_id: updated.profile_id || null, created_by_profile_id: actorProfile.id,
    metadata: { stage, storage_bucket: bucket, storage_path: path }, occurred_at: new Date().toISOString(),
  }).catch(() => null);

  return Response.json({ ok:true, record: updated }, { headers: corsHeaders });
});
