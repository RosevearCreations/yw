import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUILD = '2026-07-17a';
const SCHEMA = 158;
// Review uploads are private until an approved staff decision copies them to public-assets.
const BUCKET = 'review-assets';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
class HttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
const clean = (v: unknown, max = 1000) => String(v ?? '').trim().slice(0, max);
const int = (v: unknown) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0;
const roleRank = (role: unknown) => ({ worker:10, employee:10, staff:10, supervisor:30, hse:40, job_admin:45, admin:50 }[clean(role, 80).toLowerCase()] || 0);
const slug = (v: unknown) => clean(v, 180).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'asset';

async function actor(supabase: any, req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data } = await supabase.auth.getUser(token);
  const user = data?.user;
  if (!user?.id) throw new HttpError(401, 'Sign in is required.');
  const { data: profile } = await supabase.from('profiles').select('id, role, is_active').eq('id', user.id).maybeSingle();
  if (!profile?.id || profile.is_active === false || roleRank(profile.role) < 45) throw new HttpError(403, 'Job Admin or Admin access is required.');
  return profile;
}
async function checksum(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function read24le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}
async function imageDimensions(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { format:'png', width:view.getUint32(16, false), height:view.getUint32(20, false) };
  }
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset, false);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        return { format:'jpeg', height:view.getUint16(offset + 3, false), width:view.getUint16(offset + 5, false) };
      }
      offset += length;
    }
  }
  if (bytes.length >= 30 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') {
    const chunk = String.fromCharCode(...bytes.slice(12,16));
    if (chunk === 'VP8X' && bytes.length >= 30) return { format:'webp', width:1 + read24le(bytes,24), height:1 + read24le(bytes,27) };
    if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return { format:'webp', width:(bits & 0x3fff) + 1, height:((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { format:'webp', width:view.getUint16(26, true) & 0x3fff, height:view.getUint16(28, true) & 0x3fff };
    }
  }
  throw new HttpError(415, 'The uploaded image encoding could not be verified. Use JPEG, PNG, or WebP.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return Response.json({ ok:false, error:'Use POST.' }, { status:405, headers:corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL') || Deno.env.get('SB_URL') || '';
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || '';
    if (!url || !key) throw new HttpError(500, 'Upload service is not configured.');
    const supabase = createClient(url, key, { auth: { persistSession:false } });
    const profile = await actor(supabase, req);
    const form = await req.formData();
    const file = form.get('file');
    const thumbnail = form.get('thumbnail');
    if (!(file instanceof File)) throw new HttpError(400, 'Optimized image file is required.');
    if (!(thumbnail instanceof File)) throw new HttpError(400, 'Thumbnail file is required.');
    if (!file.type.startsWith('image/') || !thumbnail.type.startsWith('image/')) throw new HttpError(415, 'Only image files are supported.');
    if (file.size > 8 * 1024 * 1024) throw new HttpError(413, 'Optimized image exceeds the 8 MB limit.');
    if (thumbnail.size > 2 * 1024 * 1024) throw new HttpError(413, 'Thumbnail exceeds the 2 MB limit.');
    const submittedWidth = int(form.get('pixel_width'));
    const submittedHeight = int(form.get('pixel_height'));
    const submittedThumbWidth = int(form.get('thumbnail_width'));
    const submittedThumbHeight = int(form.get('thumbnail_height'));
    const verified = await imageDimensions(file);
    const verifiedThumb = await imageDimensions(thumbnail);
    const width = verified.width;
    const height = verified.height;
    const thumbWidth = verifiedThumb.width;
    const thumbHeight = verifiedThumb.height;
    if (width < 800 || height < 450) throw new HttpError(409, 'Public images must be at least 800×450 pixels.');
    if (!thumbWidth || !thumbHeight) throw new HttpError(409, 'Thumbnail dimensions are required.');
    if (submittedWidth !== width || submittedHeight !== height || submittedThumbWidth !== thumbWidth || submittedThumbHeight !== thumbHeight) {
      throw new HttpError(409, 'Submitted image dimensions do not match the uploaded image files. Re-optimize and retry.');
    }
    const altText = clean(form.get('alt_text'), 280);
    if (altText.length < 12) throw new HttpError(409, 'Useful alt text of at least 12 characters is required.');
    const consent = clean(form.get('consent_status') || 'not_required', 80);
    if (!['approved','not_required','pending'].includes(consent)) throw new HttpError(400, 'Unsupported consent status.');
    const routeKey = clean(form.get('route_key'), 120);
    const imageRole = clean(form.get('image_role') || 'placeholder_replacement', 120);
    const base = `${slug(routeKey || 'general')}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${slug(file.name.replace(/\.[^.]+$/, ''))}`;
    const extension = file.type.includes('webp') ? 'webp' : file.type.includes('png') ? 'png' : 'jpg';
    const thumbExtension = thumbnail.type.includes('webp') ? 'webp' : thumbnail.type.includes('png') ? 'png' : 'jpg';
    const storagePath = `${base}.${extension}`;
    const thumbnailPath = `${base}-thumb.${thumbExtension}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, { contentType:file.type, cacheControl:'31536000', upsert:false });
    if (uploadError) throw uploadError;
    const { error: thumbError } = await supabase.storage.from(BUCKET).upload(thumbnailPath, thumbnail, { contentType:thumbnail.type, cacheControl:'31536000', upsert:false });
    if (thumbError) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw thumbError;
    }
    const hash = await checksum(file);
    const readiness = consent === 'pending' ? 80 : 100;
    const { data: record, error } = await supabase.from('visual_asset_approval_items').insert({
      asset_status: 'review', surface_area: clean(form.get('surface_area') || 'public', 120), image_role:imageRole,
      // A review asset has no public URL. operations-manage copies approved files to public-assets.
      source_url:null, public_url:null, thumbnail_url:null, alt_text:altText,
      consent_status:consent, compression_status:'optimized', route_key:routeKey || null,
      storage_bucket:BUCKET, storage_path:storagePath, thumbnail_path:thumbnailPath,
      review_storage_bucket:BUCKET, review_storage_path:storagePath, review_thumbnail_path:thumbnailPath,
      pixel_width:width, pixel_height:height, thumbnail_width:thumbWidth, thumbnail_height:thumbHeight,
      file_size_bytes:file.size, mime_type:file.type, original_file_name:clean(form.get('original_file_name') || file.name, 260),
      checksum_sha256:hash, placeholder_selector:clean(form.get('placeholder_selector'), 240) || null,
      replacement_status:'not_replaced', readiness_score:readiness, notes:clean(form.get('notes'), 1000) || null,
      metadata:{ build:BUILD, schema:SCHEMA, uploaded_by_profile_id:profile.id, thumbnail_size_bytes:thumbnail.size, verified_format:verified.format, verified_thumbnail_format:verifiedThumb.format }
    }).select('*').single();
    if (error) {
      await supabase.storage.from(BUCKET).remove([storagePath, thumbnailPath]);
      throw error;
    }
    return Response.json({ ok:true, record, upload:{ review_only:true, width, height, file_size_bytes:file.size, message:'Stored privately for review. Approve the asset to publish a public replacement.' } }, { headers:corsHeaders });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return Response.json({ ok:false, error:error instanceof Error ? error.message : 'Upload failed.' }, { status, headers:corsHeaders });
  }
});
