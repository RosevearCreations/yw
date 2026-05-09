
// Detailed Edge Function: upload-image
// Purpose:
// - Accept image upload metadata and binary file
// - Store the file in the submission-images bucket
// - Write metadata into submission_images

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

  const form = await req.formData();
  const submissionId = String(form.get('submission_id') || '');
  const imageType = String(form.get('image_type') || 'general');
  const caption = String(form.get('caption') || '');
  const file = form.get('file') as File | null;
  if (!submissionId || !file) return Response.json({ ok:false, error:'submission_id and file are required' }, { status:400, headers:corsHeaders });

  const path = `${submissionId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from('submission-images').upload(path, file.stream(), { contentType: file.type, upsert: false });
  if (uploadError) return Response.json({ ok:false, error:uploadError.message }, { status:500, headers:corsHeaders });

  const { data: imageRow, error: imageError } = await supabase.from('submission_images').insert({
    submission_id: submissionId,
    file_path: path,
    file_name: file.name,
    image_type: imageType,
    file_size_bytes: file.size,
    content_type: file.type,
    caption,
    uploaded_by: userData.user.id,
  }).select('*').single();
  if (imageError) return Response.json({ ok:false, error:imageError.message }, { status:500, headers:corsHeaders });

  return Response.json({ ok:true, record: imageRow }, { headers:corsHeaders });
});
