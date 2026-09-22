// Build 338 — Performance & Development write boundary.
// Deliberately separate from Safety incident/near-miss authority.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasModuleAccess } from "../_shared/module-permissions.ts";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
};

const textOrNull=(v:unknown)=>{const s=String(v??'').trim();return s||null;};
const dateOrNull=(v:unknown)=>{const s=String(v??'').trim();return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null;};
const num=(v:unknown,f=0)=>{const n=Number(v);return Number.isFinite(n)?n:f;};

serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return Response.json({ok:false,error:'POST required'},{status:405,headers:corsHeaders});

  const supabase=createClient(
    (Deno.env.get('SB_URL')||Deno.env.get('SUPABASE_URL'))!,
    (Deno.env.get('SB_SERVICE_ROLE_KEY')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!
  );
  const token=(req.headers.get('Authorization')??'').replace('Bearer ','');
  const {data:userData,error:userError}=await supabase.auth.getUser(token);
  if(userError||!userData.user) return Response.json({ok:false,error:'Unauthorized'},{status:401,headers:corsHeaders});

  const actorId=userData.user.id;
  const {data:actorProfile,error:profileError}=await supabase.from('profiles').select('*').eq('id',actorId).single();
  if(profileError||!actorProfile?.is_active) return Response.json({ok:false,error:'Inactive profile'},{status:403,headers:corsHeaders});
  if(!(await hasModuleAccess(supabase,actorProfile,'admin','manage'))){
    return Response.json({ok:false,error:'Admin module manage access is required.'},{status:403,headers:corsHeaders});
  }

  const body=await req.json().catch(()=>({}));
  const entity=String(body.entity||'').trim().toLowerCase();
  const action=String(body.action||'').trim().toLowerCase();
  const nowIso=new Date().toISOString();

  try{
    if(entity==='performance_expectation'){
      const itemId=String(body.item_id||'').trim();
      const patch={
        role_key:String(body.role_key||'employee').trim().toLowerCase()||'employee',
        expectation_title:String(body.expectation_title||'').trim(),
        expectation_area:String(body.expectation_area||'role').trim().toLowerCase()||'role',
        expectation_text:String(body.expectation_text||'').trim(),
        evidence_guidance:textOrNull(body.evidence_guidance),
        is_active:body.is_active!==false,
        sort_order:Math.round(num(body.sort_order,100)),
        updated_by_profile_id:actorId,
        updated_at:nowIso
      };
      if(action==='create'){
        if(!patch.expectation_title||!patch.expectation_text) return Response.json({ok:false,error:'Expectation title and text are required.'},{status:400,headers:corsHeaders});
        const {data,error}=await supabase.from('workforce_role_expectations').insert({...patch,created_by_profile_id:actorId,created_at:nowIso}).select('*').single();
        if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
      }
      if(!itemId) return Response.json({ok:false,error:'Expectation id is required.'},{status:400,headers:corsHeaders});
      if(action==='archive'){
        const {data,error}=await supabase.from('workforce_role_expectations').update({is_active:false,updated_by_profile_id:actorId,updated_at:nowIso}).eq('id',itemId).select('*').single();
        if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
      }
      if(action==='update'){
        const {data,error}=await supabase.from('workforce_role_expectations').update(patch).eq('id',itemId).select('*').single();
        if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
      }
    }

    if(entity==='performance_coaching'){
      const itemId=String(body.item_id||'').trim();
      if(action==='create'){
        const profileId=String(body.profile_id||'').trim(), topic=String(body.topic||'').trim(), summary=String(body.summary||'').trim();
        if(!profileId||!topic||!summary) return Response.json({ok:false,error:'Profile, topic and summary are required.'},{status:400,headers:corsHeaders});
        const {data,error}=await supabase.from('workforce_coaching_records').insert({
          profile_id:profileId,coach_profile_id:actorId,expectation_id:textOrNull(body.expectation_id),
          record_type:String(body.record_type||'coaching').trim().toLowerCase(),topic,summary,
          observed_on:dateOrNull(body.observed_on)||nowIso.slice(0,10),follow_up_date:dateOrNull(body.follow_up_date),
          record_status:'open',created_by_profile_id:actorId,updated_by_profile_id:actorId,created_at:nowIso,updated_at:nowIso
        }).select('*').single();
        if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
      }
      if(!itemId) return Response.json({ok:false,error:'Coaching record id is required.'},{status:400,headers:corsHeaders});
      const patch:Record<string,unknown>={updated_by_profile_id:actorId,updated_at:nowIso};
      if(body.topic!==undefined) patch.topic=String(body.topic||'').trim();
      if(body.summary!==undefined) patch.summary=String(body.summary||'').trim();
      if(body.follow_up_date!==undefined) patch.follow_up_date=dateOrNull(body.follow_up_date);
      if(action==='close'){patch.record_status='closed';patch.closed_at=nowIso;}
      const {data,error}=await supabase.from('workforce_coaching_records').update(patch).eq('id',itemId).select('*').single();
      if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
    }

    if(entity==='performance_development_plan'){
      const itemId=String(body.item_id||'').trim();
      if(action==='create'){
        const profileId=String(body.profile_id||'').trim(), title=String(body.plan_title||'').trim(), goal=String(body.goal_text||'').trim();
        if(!profileId||!title||!goal) return Response.json({ok:false,error:'Profile, plan title and goal are required.'},{status:400,headers:corsHeaders});
        const {data,error}=await supabase.from('workforce_development_plans').insert({
          profile_id:profileId,plan_title:title,goal_text:goal,skill_id:textOrNull(body.skill_id),
          training_requirement_code:textOrNull(body.training_requirement_code),started_on:dateOrNull(body.started_on)||nowIso.slice(0,10),
          target_date:dateOrNull(body.target_date),plan_status:'active',progress_note:textOrNull(body.progress_note),
          created_by_profile_id:actorId,updated_by_profile_id:actorId,created_at:nowIso,updated_at:nowIso
        }).select('*').single();
        if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
      }
      if(!itemId) return Response.json({ok:false,error:'Development plan id is required.'},{status:400,headers:corsHeaders});
      const patch:Record<string,unknown>={updated_by_profile_id:actorId,updated_at:nowIso};
      if(body.plan_title!==undefined) patch.plan_title=String(body.plan_title||'').trim();
      if(body.goal_text!==undefined) patch.goal_text=String(body.goal_text||'').trim();
      if(body.target_date!==undefined) patch.target_date=dateOrNull(body.target_date);
      if(body.progress_note!==undefined) patch.progress_note=textOrNull(body.progress_note);
      if(body.plan_status!==undefined) patch.plan_status=String(body.plan_status||'active').trim().toLowerCase();
      if(action==='complete'){patch.plan_status='completed';patch.completed_at=nowIso;}
      const {data,error}=await supabase.from('workforce_development_plans').update(patch).eq('id',itemId).select('*').single();
      if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
    }

    if(entity==='performance_review'){
      const itemId=String(body.item_id||'').trim();
      if(action==='create'){
        const profileId=String(body.profile_id||'').trim(), summary=String(body.summary||'').trim();
        if(!profileId||!summary) return Response.json({ok:false,error:'Profile and review summary are required.'},{status:400,headers:corsHeaders});
        const {data,error}=await supabase.from('workforce_performance_reviews').insert({
          profile_id:profileId,reviewer_profile_id:actorId,review_period_start:dateOrNull(body.review_period_start),
          review_period_end:dateOrNull(body.review_period_end),review_status:'draft',summary,
          strengths:textOrNull(body.strengths),development_focus:textOrNull(body.development_focus),
          employee_comment:textOrNull(body.employee_comment),follow_up_date:dateOrNull(body.follow_up_date),
          created_by_profile_id:actorId,updated_by_profile_id:actorId,created_at:nowIso,updated_at:nowIso
        }).select('*').single();
        if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
      }
      if(!itemId) return Response.json({ok:false,error:'Performance review id is required.'},{status:400,headers:corsHeaders});
      const patch:Record<string,unknown>={updated_by_profile_id:actorId,updated_at:nowIso};
      if(body.summary!==undefined) patch.summary=String(body.summary||'').trim();
      if(body.strengths!==undefined) patch.strengths=textOrNull(body.strengths);
      if(body.development_focus!==undefined) patch.development_focus=textOrNull(body.development_focus);
      if(body.employee_comment!==undefined) patch.employee_comment=textOrNull(body.employee_comment);
      if(body.follow_up_date!==undefined) patch.follow_up_date=dateOrNull(body.follow_up_date);
      if(action==='complete'){patch.review_status='completed';patch.completed_at=nowIso;patch.reviewer_profile_id=actorId;}
      if(action==='acknowledge'){patch.review_status='acknowledged';patch.acknowledged_at=nowIso;}
      const {data,error}=await supabase.from('workforce_performance_reviews').update(patch).eq('id',itemId).select('*').single();
      if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
    }

    if(entity==='performance_improvement_action'){
      const itemId=String(body.item_id||'').trim();
      if(action==='create'){
        const profileId=String(body.profile_id||'').trim(), actionText=String(body.action_text||'').trim();
        if(!profileId||!actionText) return Response.json({ok:false,error:'Profile and improvement action are required.'},{status:400,headers:corsHeaders});
        const {data,error}=await supabase.from('workforce_improvement_actions').insert({
          profile_id:profileId,review_id:textOrNull(body.review_id),action_text:actionText,success_measure:textOrNull(body.success_measure),
          owner_profile_id:textOrNull(body.owner_profile_id)||actorId,due_date:dateOrNull(body.due_date),follow_up_date:dateOrNull(body.follow_up_date),
          action_status:'open',outcome_note:textOrNull(body.outcome_note),created_by_profile_id:actorId,updated_by_profile_id:actorId,
          created_at:nowIso,updated_at:nowIso
        }).select('*').single();
        if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
      }
      if(!itemId) return Response.json({ok:false,error:'Improvement action id is required.'},{status:400,headers:corsHeaders});
      const patch:Record<string,unknown>={updated_by_profile_id:actorId,updated_at:nowIso};
      if(body.action_text!==undefined) patch.action_text=String(body.action_text||'').trim();
      if(body.success_measure!==undefined) patch.success_measure=textOrNull(body.success_measure);
      if(body.due_date!==undefined) patch.due_date=dateOrNull(body.due_date);
      if(body.follow_up_date!==undefined) patch.follow_up_date=dateOrNull(body.follow_up_date);
      if(body.outcome_note!==undefined) patch.outcome_note=textOrNull(body.outcome_note);
      if(body.action_status!==undefined) patch.action_status=String(body.action_status||'open').trim().toLowerCase();
      if(action==='complete'){patch.action_status='completed';patch.completed_at=nowIso;}
      const {data,error}=await supabase.from('workforce_improvement_actions').update(patch).eq('id',itemId).select('*').single();
      if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
    }

    return Response.json({ok:false,error:'Unsupported performance entity/action'},{status:400,headers:corsHeaders});
  }catch(error){
    return Response.json({ok:false,error:String((error as any)?.message||error)},{status:500,headers:corsHeaders});
  }
});
