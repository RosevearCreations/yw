// Build 396 — authenticated mobile production transition endpoint.
// Writes go exclusively through the Schema 237 atomic, immutable-intent RPC.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const rank:Record<string,number>={employee:10,worker:10,onsite_admin:18,site_leader:20,supervisor:30,hse:40,job_admin:45,admin:50};
const accessRank:Record<string,number>={hidden:0,view:1,create:2,approve:3,manage:4};
const clean=(v:unknown)=>String(v??"").trim();
function assignmentIncludes(value:unknown, profile:string):boolean{
  if(!Array.isArray(value))return false;
  return value.some(x=>typeof x==="string"?x===profile:
    x&&typeof x==="object"&&(x.profile_id===profile||x.id===profile));
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({ok:false,error:"POST required"},405);
  try{
    const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
    if(!token)return json({ok:false,error:"Sign in is required."},401);
    const url=Deno.env.get("SUPABASE_URL")||"";
    const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
    if(!url||!secret)return json({ok:false,error:"Mobile production service is not configured."},503);
    const sb=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:auth,error:authError}=await sb.auth.getUser(token);
    if(authError||!auth?.user?.id)return json({ok:false,error:"Authentication expired. Sign in again."},401);
    const actor=auth.user.id;
    const {data:profile,error:profileError}=await sb.from("profiles")
      .select("id,role,is_active").eq("id",actor).maybeSingle();
    if(profileError||!profile?.is_active)return json({ok:false,error:"Active staff profile required."},403);
    if((rank[clean(profile.role).toLowerCase()]||0)<20)
      return json({ok:false,error:"Site leader or higher role is required."},403);
    const {data:jobsAccess,error:accessError}=await sb.rpc("ywi_effective_module_access",
      {p_profile_id:actor,p_module_key:"jobs"});
    if(accessError||(accessRank[clean(jobsAccess).toLowerCase()]||0)<2)
      return json({ok:false,error:"Jobs create permission is required."},403);

    const body=await req.json().catch(()=>({}));
    const action=clean(body.transition);
    const key=clean(body.intent_key);
    const workOrder=clean(body.work_order_id);
    const dispatchId=clean(body.dispatch_schedule_item_id);
    const session=clean(body.session_id);
    if(!["start","finish"].includes(action)||!uuid.test(key)||!uuid.test(workOrder)||!uuid.test(dispatchId)
       ||(action==="finish"&&!uuid.test(session)))
      return json({ok:false,error:"Valid action key, work order, dispatch, and existing session for finish are required."},400);
    const {data:dispatch,error:dispatchError}=await sb.from("dispatch_schedule_items")
      .select("id,work_order_id,lead_profile_id,assigned_supervisor_profile_id,assigned_crew_profile_ids,crew_id")
      .eq("id",dispatchId).eq("work_order_id",workOrder).maybeSingle();
    if(dispatchError||!dispatch)return json({ok:false,error:"Assigned dispatch was not found."},403);
    let assigned=dispatch.lead_profile_id===actor||dispatch.assigned_supervisor_profile_id===actor||
      assignmentIncludes(dispatch.assigned_crew_profile_ids,actor);
    if(!assigned&&dispatch.crew_id){
      const {data:membership,error:memberError}=await sb.from("crew_members")
        .select("crew_id").eq("crew_id",dispatch.crew_id).eq("profile_id",actor).limit(1);
      if(memberError)return json({ok:false,error:"Could not verify crew assignment."},503);
      assigned=Array.isArray(membership)&&membership.length>0;
    }
    if(!assigned)return json({ok:false,error:"Current user is not assigned to this dispatch."},403);

    const {data,error}=await sb.rpc("ywi_rpc_mobile_production_transition",{
      p_intent_key:key,p_actor_profile_id:actor,p_work_order_id:workOrder,p_dispatch_id:dispatchId,
      p_transition:action,p_session_id:session||null,
      p_completion_note:action==="finish"?clean(body.completion_note).slice(0,3000):null
    });
    if(error){
      const conflict=error.code==="23505"||error.code==="23514"||error.code==="23503";
      return json({ok:false,error:error.message||"Production session was not recorded.",
        retry_safe:!conflict,intent_key:key},conflict?409:503);
    }
    if(data?.ok!==true||!uuid.test(clean(data.session_id))||
       data.session_status!==(action==="start"?"in_progress":"completed"))
      return json({ok:false,error:"Server response did not acknowledge a canonical session.",
        retry_safe:true,intent_key:key},503);
    return json({...data,build:396});
  }catch(error){
    return json({ok:false,error:"Mobile production request could not be verified. Retry with the same action key.",retry_safe:true},503);
  }
});
