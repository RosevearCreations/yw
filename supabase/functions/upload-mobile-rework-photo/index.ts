// YW 547: assignment-scoped, staff-only correction photo intake and review.
// The private review-assets bucket is never published or exposed through a public URL.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hasModuleAccess } from '../_shared/module-permissions.ts';

const BUCKET = 'review-assets';
const MAX_BYTES = 5 * 1024 * 1024;
const isUuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ''));
const corsHeaders = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
class HttpError extends Error { status: number; constructor(status:number,message:string){super(message);this.status=status;} }
const rank = (role: unknown) => ({site_leader:20, supervisor:30, hse:40, job_admin:45, admin:50}[String(role||'').toLowerCase()] || 0);

async function assignedRework(supabase:any, profile:any, workOrderId:string) {
  if (!isUuid(workOrderId)) throw new HttpError(400,'A valid work order is required.');
  if (rank(profile.role)<20 || !(await hasModuleAccess(supabase,profile,'jobs','create')))
    throw new HttpError(403,'Jobs create permission is required for correction photos.');
  const {data:closeout,error:closeoutError}=await supabase.from('work_order_closeout_packages')
    .select('id,closeout_status,rejected_at').eq('work_order_id',workOrderId).maybeSingle();
  if (closeoutError) throw closeoutError;
  if (!closeout?.rejected_at || !['rework_required','rejected'].includes(closeout.closeout_status))
    throw new HttpError(409,'The current supervisor rework request is no longer active. Refresh the job.');
  const {data:members,error:memberError}=await supabase.from('crew_members').select('crew_id').eq('profile_id',profile.id);
  if (memberError) throw memberError;
  const crewIds=new Set((members||[]).map((member:any)=>String(member.crew_id)));
  const {data:dispatch,error:dispatchError}=await supabase.from('dispatch_schedule_items')
    .select('crew_id,lead_profile_id,assigned_supervisor_profile_id,assigned_crew_profile_ids,schedule_status')
    .eq('work_order_id',workOrderId).limit(100);
  if (dispatchError) throw dispatchError;
  const assigned=(dispatch||[]).some((item:any)=>{
    if (['cancelled','superseded'].includes(item.schedule_status)) return false;
    let people:any[]=[];
    try {people=Array.isArray(item.assigned_crew_profile_ids)?item.assigned_crew_profile_ids:JSON.parse(item.assigned_crew_profile_ids||'[]');}catch{people=[];}
    return item.lead_profile_id===profile.id || item.assigned_supervisor_profile_id===profile.id ||
      crewIds.has(String(item.crew_id||'')) || people.some((p:any)=>String(typeof p==='object'?(p?.profile_id||p?.id):p)===profile.id);
  });
  if (!assigned) throw new HttpError(403,'Only assigned crew can access this correction evidence.');
  return closeout;
}

// Verify actual bytes, not just a browser-provided MIME type or filename.
async function imageKind(file:File) {
  const bytes=new Uint8Array(await file.slice(0,32).arrayBuffer());
  if (file.type==='image/jpeg' && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) return 'jpg';
  if (file.type==='image/png' && bytes[0]===0x89 && bytes[1]===0x50 && bytes[2]===0x4e && bytes[3]===0x47 && bytes[4]===0x0d && bytes[5]===0x0a) return 'png';
  if (file.type==='image/webp' && String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP') return 'webp';
  throw new HttpError(415,'Only verified JPEG, PNG or WebP photos are accepted.');
}

serve(async(req)=>{
  if (req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if (req.method!=='POST') return Response.json({ok:false,error:'Use POST.'},{status:405,headers:corsHeaders});
  try {
    const url=Deno.env.get('SUPABASE_URL')||Deno.env.get('SB_URL')||'';
    const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('SB_SERVICE_ROLE_KEY')||'';
    if (!url || !key) throw new HttpError(503,'Private photo storage is unavailable.');
    const supabase=createClient(url,key,{auth:{persistSession:false}});
    const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
    const {data:identity,error:identityError}=await supabase.auth.getUser(token);
    if (identityError || !identity?.user?.id) throw new HttpError(401,'Sign in is required.');
    const {data:profile,error:profileError}=await supabase.from('profiles').select('id,role,is_active').eq('id',identity.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.id || profile.is_active===false) throw new HttpError(403,'An active crew profile is required.');

    if ((req.headers.get('content-type')||'').includes('application/json')) {
      const body=await req.json();
      if (body.action!=='review' || !isUuid(body.work_order_id) || !isUuid(body.proof_id)) throw new HttpError(400,'Valid review identifiers are required.');
      await assignedRework(supabase,profile,body.work_order_id);
      const {data:proof,error:proofError}=await supabase.from('work_order_execution_proofs')
        .select('id,title,customer_visible,created_at').eq('id',body.proof_id).eq('work_order_id',body.work_order_id).maybeSingle();
      if (proofError) throw proofError;
      if (!proof || proof.title!=='Crew rework correction' || proof.customer_visible) throw new HttpError(404,'Private correction proof not found.');
      const {data:media,error:mediaError}=await supabase.from('work_order_execution_proof_media')
        .select('visual_asset_id,display_order').eq('execution_proof_id',proof.id).order('display_order').limit(8);
      if (mediaError) throw mediaError;
      const ids=(media||[]).map((item:any)=>item.visual_asset_id);
      if (!ids.length) return Response.json({ok:true,photos:[],expires_in:300},{headers:corsHeaders});
      const {data:assets,error:assetError}=await supabase.from('visual_asset_approval_items')
        .select('id,review_storage_bucket,review_storage_path,metadata,original_file_name,public_url').in('id',ids);
      if (assetError) throw assetError;
      const photos=[];
      for (const id of ids) {
        const asset=(assets||[]).find((item:any)=>item.id===id);
        if (!asset || asset.review_storage_bucket!==BUCKET || asset.public_url ||
            asset.metadata?.source!=='mobile_rework_photo_547' || asset.metadata?.work_order_id!==body.work_order_id ||
            !asset.review_storage_path?.startsWith(`crew-rework/${body.work_order_id}/`)) continue;
        const {data:signed,error:signedError}=await supabase.storage.from(BUCKET).createSignedUrl(asset.review_storage_path,300);
        if (signedError) throw signedError;
        photos.push({id,url:signed.signedUrl,name:asset.original_file_name||'Correction photo'});
      }
      return Response.json({ok:true,photos,expires_in:300},{headers:corsHeaders});
    }

    const length=Number(req.headers.get('content-length')||0);
    if (length>MAX_BYTES+65536) throw new HttpError(413,'Photo upload exceeds the 5 MB limit.');
    if (!(req.headers.get('content-type')||'').includes('multipart/form-data')) throw new HttpError(415,'Use a photo upload form.');
    const form=await req.formData();
    const workOrderId=String(form.get('work_order_id')||'');
    const closeout=await assignedRework(supabase,profile,workOrderId);
    const file=form.get('file');
    if (!(file instanceof File) || !file.size) throw new HttpError(400,'Choose a photo before uploading.');
    if (file.size>MAX_BYTES) throw new HttpError(413,'Each correction photo must be at most 5 MB.');
    const extension=await imageKind(file);
    const path=`crew-rework/${workOrderId}/${profile.id}/${crypto.randomUUID()}.${extension}`;
    const {error:uploadError}=await supabase.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false,cacheControl:'0'});
    if (uploadError) throw uploadError;
    const {data:asset,error:insertError}=await supabase.from('visual_asset_approval_items').insert({
      asset_key:`crew_rework_547_${crypto.randomUUID()}`,asset_status:'review',surface_area:'internal',image_role:'crew_rework',
      consent_status:'pending',compression_status:'pending',storage_bucket:BUCKET,storage_path:path,
      review_storage_bucket:BUCKET,review_storage_path:path,original_file_name:String(file.name||'Correction photo').slice(0,260),
      mime_type:file.type,file_size_bytes:file.size,metadata:{build:547,source:'mobile_rework_photo_547',work_order_id:workOrderId,
        closeout_id:closeout.id,rejected_at:closeout.rejected_at,uploaded_by_profile_id:profile.id}
    }).select('id').single();
    if (insertError) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw insertError;
    }
    return Response.json({ok:true,asset_id:asset.id,review_only:true,customer_visible:false},{headers:corsHeaders});
  } catch(error) {
    const status=error instanceof HttpError?error.status:500;
    return Response.json({ok:false,error:status===500?'Private photo upload failed. Please retry.':(error as Error).message},{status,headers:corsHeaders});
  }
});
