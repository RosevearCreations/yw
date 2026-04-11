// Edge Function: upload-job-comment-attachment
// Purpose:
// - Accept job activity photo/file uploads
// - Store binary objects in Supabase Storage
// - Write auditable metadata rows into job_comment_attachments

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
  const commentId = String(form.get('job_comment_id') || '');
  const attachmentKind = String(form.get('attachment_kind') || 'photo');
  const caption = String(form.get('caption') || '');
  const file = form.get('file') as File | null;
  if (!commentId || !file) return Response.json({ ok:false, error:'job_comment_id and file are required' }, { status:400, headers:corsHeaders });

  const { data: comment, error: commentError } = await supabase
    .from('job_comments')
    .select('id,job_id')
    .eq('id', commentId)
    .single();
  if (commentError || !comment) return Response.json({ ok:false, error:'Job comment not found' }, { status:404, headers:corsHeaders });

  const ext = (file.name || 'upload.bin').split('.').pop() || 'bin';
  const bucket = 'submission-images';
  const path = `job-comments/${comment.job_id}/${commentId}/${crypto.randomUUID()}-${attachmentKind}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file.stream(), { contentType: file.type, upsert: false });
  if (uploadError) return Response.json({ ok:false, error:uploadError.message }, { status:500, headers:corsHeaders });

  const { data: signedUrlData } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);

  const { data: record, error: insertError } = await supabase.from('job_comment_attachments').insert({
    comment_id: commentId,
    storage_bucket: bucket,
    storage_path: path,
    preview_url: signedUrlData?.signedUrl || null,
    file_name: file.name,
    content_type: file.type || null,
    file_size_bytes: file.size || null,
    attachment_kind: attachmentKind || 'photo',
    uploaded_by_profile_id: actorProfile.id,
  }).select('*').single();
  if (insertError) return Response.json({ ok:false, error:insertError.message }, { status:500, headers:corsHeaders });

  return Response.json({ ok:true, record }, { headers:corsHeaders });
});
