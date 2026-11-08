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

// Supervisor comparison is separate from crew access. Never reuse the crew's
// upload/review authorization for a supervisor-facing private-media view.
async function supervisorComparison(supabase:any,profile:any,closeoutId:string) {
  if (!isUuid(closeoutId)) throw new HttpError(400,'A valid closeout is required.');
  if (rank(profile.role)<30 || !(await hasModuleAccess(supabase,profile,'jobs','approve')))
    throw new HttpError(403,'Supervisor Jobs approval permission is required.');
  const {data:closeout,error:closeoutError}=await supabase.from('work_order_closeout_packages')
    .select('id,work_order_id,closeout_status,rejected_at,rejection_reason,submitted_at,customer_signoff_status,invoice_readiness_status')
    .eq('id',closeoutId).maybeSingle();
  if (closeoutError) throw closeoutError;
  if (!closeout) throw new HttpError(404,'Closeout not found.');
  const {data:order,error:orderError}=await supabase.from('work_orders')
    .select('id,supervisor_profile_id').eq('id',closeout.work_order_id).maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new HttpError(404,'Work order not found.');
  // Administrators can cover the entire company; other supervisors cannot
  // inspect a colleague's explicitly assigned private work order.
  if (rank(profile.role)<45 && order.supervisor_profile_id && order.supervisor_profile_id!==profile.id)
    throw new HttpError(403,'This work order is assigned to another supervisor.');

  const {data:proofs,error:proofError}=await supabase.from('work_order_execution_proofs')
    .select('id,title,proof_type,proof_status,staff_notes,customer_visible,created_at,metadata')
    .eq('work_order_id',order.id).in('proof_status',['submitted','approved','rejected'])
    .order('created_at',{ascending:false}).limit(60);
  if (proofError) throw proofError;
  const correctionProofs=(proofs||[]).filter((p:any)=>p.title==='Crew rework correction' && p.customer_visible===false && p.metadata?.closeout_id===closeout.id);
  const latestCorrection=correctionProofs[0]||null;
  const baselineProofs=(proofs||[]).filter((p:any)=>p.title!=='Crew rework correction');
  const selectedProofs=[...baselineProofs.slice(0,12),...(latestCorrection?[latestCorrection]:[])];
  const ids=selectedProofs.map((p:any)=>p.id);
  const {data:links,error:linkError}=ids.length?await supabase.from('work_order_execution_proof_media')
    .select('execution_proof_id,visual_asset_id,display_order').in('execution_proof_id',ids)
    .order('display_order').limit(120):{data:[],error:null};
  if (linkError) throw linkError;
  const assetIds=[...new Set((links||[]).map((l:any)=>l.visual_asset_id))];
  const {data:assets,error:assetError}=assetIds.length?await supabase.from('visual_asset_approval_items')
    .select('id,asset_status,review_storage_bucket,review_storage_path,original_file_name,public_url,metadata')
    .in('id',assetIds):{data:[],error:null};
  if (assetError) throw assetError;
  const assetMap=new Map((assets||[]).map((a:any)=>[a.id,a]));
  const makePhotos=async(proofRows:any[],max:number,correction:boolean)=>{
    const results:any[]=[];
    for (const proof of proofRows) {
      for (const link of (links||[]).filter((l:any)=>l.execution_proof_id===proof.id)) {
        if (results.length>=max) return results;
        const asset:any=assetMap.get(link.visual_asset_id);
        if (!asset) continue;
        let url='';
        if (correction) {
          if (asset.asset_status!=='review' || asset.public_url || asset.review_storage_bucket!==BUCKET ||
            asset.metadata?.source!=='mobile_rework_photo_547' || asset.metadata?.work_order_id!==order.id ||
            asset.metadata?.closeout_id!==closeout.id ||
            !asset.review_storage_path?.startsWith(`crew-rework/${order.id}/`)) continue;
        } else if (asset.asset_status==='approved' && /^https:\/\//i.test(asset.public_url||'')) {
          url=asset.public_url;
        } else if (asset.review_storage_bucket!==BUCKET || asset.public_url ||
          !/^[a-z0-9_/-]+\/[a-z0-9_./-]+$/i.test(asset.review_storage_path||'') ||
          String(asset.review_storage_path).includes('..')) continue;
        if (!url) {
          const {data:signed,error:signedError}=await supabase.storage.from(BUCKET).createSignedUrl(asset.review_storage_path,300);
          if (signedError) throw signedError;
          url=signed.signedUrl;
        }
        results.push({id:asset.id,url,name:String(asset.original_file_name||'Site photo').slice(0,150),
          proof_status:proof.proof_status,proof_title:proof.title,proof_created_at:proof.created_at});
      }
    }
    return results;
  };
  const baseline=await makePhotos(baselineProofs,6,false);
  const corrections=await makePhotos(latestCorrection?[latestCorrection]:[],4,true);
  // A crew resubmission is a staff-only update, never a closeout status change.
  const {data:updates,error:updateError}=latestCorrection?await supabase.from('work_order_live_updates')
    .select('created_at,metadata').eq('work_order_id',order.id).eq('visibility','staff')
    .eq('title','Crew rework corrections resubmitted')
    .gte('created_at',latestCorrection.created_at).order('created_at',{ascending:false}).limit(30):{data:[],error:null};
  if (updateError) throw updateError;
  const resubmission=(updates||[]).find((item:any)=>item.metadata?.source==='mobile_rework_resubmission' &&
    item.metadata?.closeout_id===closeout.id && item.metadata?.correction_proof_id===latestCorrection?.id);
  return {ok:true,closeout:{id:closeout.id,status:closeout.closeout_status,rejected_at:closeout.rejected_at,
      rejection_reason:closeout.rejection_reason,submitted_at:closeout.submitted_at,
      customer_signoff_status:closeout.customer_signoff_status,invoice_readiness_status:closeout.invoice_readiness_status},
    baseline,corrections,resubmission:resubmission?{at:resubmission.created_at}:null,correction_proof:latestCorrection?{
      id:latestCorrection.id,status:latestCorrection.proof_status,staff_notes:String(latestCorrection.staff_notes||'').slice(0,1000),
      created_at:latestCorrection.created_at}:null,expires_in:300,staff_only:true};
}

// YW 549: read the original decision audit and staff-only correction events.
// This is deliberately a history projection, not a new closeout authority.
async function supervisorReworkHistory(supabase:any,profile:any,closeoutId:string) {
  if (!isUuid(closeoutId)) throw new HttpError(400,'A valid closeout is required.');
  if (rank(profile.role)<30 || !(await hasModuleAccess(supabase,profile,'jobs','approve')))
    throw new HttpError(403,'Supervisor Jobs approval permission is required.');
  const {data:closeout,error:closeoutError}=await supabase.from('work_order_closeout_packages')
    .select('id,work_order_id,closeout_status,rejected_at,rejection_reason,submitted_at,approved_at,customer_signoff_status,invoice_readiness_status')
    .eq('id',closeoutId).maybeSingle();
  if (closeoutError) throw closeoutError;
  if (!closeout) throw new HttpError(404,'Closeout not found.');
  const {data:order,error:orderError}=await supabase.from('work_orders')
    .select('id,supervisor_profile_id').eq('id',closeout.work_order_id).maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new HttpError(404,'Work order not found.');
  if (rank(profile.role)<45 && order.supervisor_profile_id && order.supervisor_profile_id!==profile.id)
    throw new HttpError(403,'This work order is assigned to another supervisor.');

  const [audits,proofs,updates]=await Promise.all([
    supabase.from('operation_write_audit_events')
      .select('id,operation_status,actor_profile_id,request_payload,created_at')
      .eq('entity_type','work_order_closeout_package').eq('entity_id',closeout.id)
      .eq('operation_action','work_order_closeout_decision').order('created_at',{ascending:false}).limit(60),
    supabase.from('work_order_execution_proofs')
      .select('id,title,proof_status,created_at,captured_by_profile_id,metadata')
      .eq('work_order_id',order.id).eq('title','Crew rework correction')
      .order('created_at',{ascending:false}).limit(60),
    supabase.from('work_order_live_updates')
      .select('id,title,author_profile_id,created_at,metadata')
      .eq('work_order_id',order.id).eq('visibility','staff')
      .in('title',['Crew rework corrections resubmitted','Crew acknowledged supervisor rework instructions'])
      .order('created_at',{ascending:false}).limit(100)
  ]);
  for (const response of [audits,proofs,updates]) if (response.error) throw response.error;
  const history:any[]=[];
  for (const record of audits.data||[]) {
    const decision=String(record.request_payload?.decision||record.operation_status||'').toLowerCase();
    if (!['approve','reject','rework','invoice_ready'].includes(decision)) continue;
    history.push({id:record.id,type:'supervisor_decision',at:record.created_at,actor_id:record.actor_profile_id,
      title:`Supervisor ${decision.replaceAll('_',' ')}`,detail:String(record.request_payload?.decision_note||'').slice(0,1000)});
  }
  for (const proof of proofs.data||[]) {
    if (proof.metadata?.closeout_id!==closeout.id) continue;
    history.push({id:proof.id,type:'correction_proof',at:proof.created_at,actor_id:proof.captured_by_profile_id,
      title:'Crew correction proof',detail:`Current recorded proof status: ${String(proof.proof_status||'unknown').slice(0,50)}`});
  }
  const currentAcknowledgements:any[]=[];
  for (const update of updates.data||[]) {
    if (update.metadata?.closeout_id!==closeout.id) continue;
    if (update.title==='Crew rework corrections resubmitted' && update.metadata?.source==='mobile_rework_resubmission') {
      history.push({id:update.id,type:'resubmission',at:update.created_at,actor_id:update.author_profile_id,
        title:'Corrections resubmitted',detail:'Staff-only request for supervisor review; not a closeout decision.'});
    } else if (update.title==='Crew acknowledged supervisor rework instructions' &&
      update.metadata?.source==='crew_rework_ack_549') {
      history.push({id:update.id,type:'acknowledgement',at:update.created_at,actor_id:update.author_profile_id,
        title:'Crew member acknowledged instructions',detail:'Acknowledged receipt only; not proof, approval or completion.'});
      if (closeout.rejected_at && update.metadata?.rejected_at===closeout.rejected_at)
        currentAcknowledgements.push({actor_id:update.author_profile_id,at:update.created_at});
    }
  }
  history.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  return {ok:true,staff_only:true,closeout:{id:closeout.id,status:closeout.closeout_status,
    rejected_at:closeout.rejected_at,rejection_reason:String(closeout.rejection_reason||'').slice(0,1500),
    customer_signoff_status:closeout.customer_signoff_status,invoice_readiness_status:closeout.invoice_readiness_status},
    events:history.slice(0,60),current_acknowledgements:currentAcknowledgements,
    history_limited:true,decision_authority:'work_order_closeout_decision'};
}

async function crewReworkAcknowledgement(supabase:any,profile:any,body:any) {
  const workOrderId=String(body.work_order_id||'');
  const closeout=await assignedRework(supabase,profile,workOrderId);
  if (!isUuid(body.closeout_package_id) || body.closeout_package_id!==closeout.id ||
      body.rejected_at!==closeout.rejected_at)
    throw new HttpError(409,'The supervisor instructions have changed. Refresh before acknowledging.');
  const {data:current,error:currentError}=await supabase.from('work_order_closeout_packages')
    .select('id,rejection_reason,closeout_status,rejected_at').eq('id',closeout.id).maybeSingle();
  if (currentError) throw currentError;
  if (!current?.rejection_reason || !['rework_required','rejected'].includes(current.closeout_status) ||
    current.rejected_at!==closeout.rejected_at)
    throw new HttpError(409,'Current supervisor instructions are unavailable. Refresh before acknowledging.');
  const title='Crew acknowledged supervisor rework instructions';
  const {data:previous,error:previousError}=await supabase.from('work_order_live_updates')
    .select('id,created_at,metadata').eq('work_order_id',workOrderId)
    .eq('visibility','staff').eq('author_profile_id',profile.id).eq('title',title)
    .gte('created_at',closeout.rejected_at).order('created_at',{ascending:false}).limit(20);
  if (previousError) throw previousError;
  const ack=(previous||[]).find((item:any)=>item.metadata?.source==='crew_rework_ack_549' &&
    item.metadata?.closeout_id===closeout.id && item.metadata?.rejected_at===closeout.rejected_at);
  if (body.action==='crew_history')
    return {ok:true,staff_only:true,closeout_id:closeout.id,rejected_at:closeout.rejected_at,
      instructions:String(current.rejection_reason).slice(0,1500),acknowledgement:ack?{at:ack.created_at,id:ack.id}:null,
      status:current.closeout_status};
  if (body.action!=='crew_acknowledge') throw new HttpError(400,'Unsupported acknowledgement request.');
  if (ack) return {ok:true,staff_only:true,replayed:true,closeout_id:closeout.id,
    acknowledgement:{at:ack.created_at,id:ack.id},status:current.closeout_status};
  if (body.confirmed!==true) throw new HttpError(400,'Review and explicitly confirm the current supervisor instructions.');
  const {data:result,error:saveError}=await supabase.rpc('ywi_rpc_create_work_order_live_update',{
    p_work_order_id:workOrderId,p_actor_profile_id:profile.id,p_visibility:'staff',p_update_type:'note',
    p_title:title,p_message:'I have read the current supervisor rework instructions.',p_asset_ids:[],
    p_customer_notification_requested:false,
    p_metadata:{build:549,source:'crew_rework_ack_549',closeout_id:closeout.id,rejected_at:closeout.rejected_at}
  });
  if (saveError) throw saveError;
  if (!isUuid(result?.live_update_id)) throw new HttpError(500,'Acknowledgement was not confirmed by the server.');
  return {ok:true,staff_only:true,closeout_id:closeout.id,acknowledgement:{id:result.live_update_id,at:new Date().toISOString()},
    status:current.closeout_status};
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
      if (body.action==='supervisor_review') {
        return Response.json(await supervisorComparison(supabase,profile,body.closeout_package_id),{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }
      if (body.action==='supervisor_history') {
        return Response.json(await supervisorReworkHistory(supabase,profile,body.closeout_package_id),{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }
      if (body.action==='crew_history' || body.action==='crew_acknowledge') {
        return Response.json(await crewReworkAcknowledgement(supabase,profile,body),{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }
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
