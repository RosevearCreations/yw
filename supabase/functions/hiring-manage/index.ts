// Build 339 — Hiring & Onboarding write boundary.
// Candidate/onboarding evidence only. Canonical profiles, crew membership, training,
// Safety truth and internal equipment/task authorization remain in their existing authorities.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasModuleAccess } from "../_shared/module-permissions.ts";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
};
const textOrNull=(v:unknown)=>{const s=String(v??'').trim();return s||null;};
const dateOrNull=(v:unknown)=>{const s=String(v??'').trim();return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null;};
const allowedStages=['applicant','interview','offer','hired','documents','orientation','training','equipment_authorization','crew_assignment','ready','withdrawn','not_selected'];
const allowedSeasons=['four_season','spring_summer','fall','fall_winter','winter','seasonal_flexible'];
const allowedEmployment=['full_time','part_time','seasonal','casual','contract'];

function defaultItems(season:string){
  const rows=[
    ['EMPLOYMENT_DOCUMENTS','Employment documents','documents'],
    ['COMPANY_ORIENTATION','Company orientation','orientation'],
    ['ONTARIO_FIELD_SAFETY_ORIENTATION','Ontario field and workplace orientation','orientation']
  ];
  const spring=['four_season','spring_summer','seasonal_flexible'].includes(season);
  const fall=['four_season','fall','fall_winter','seasonal_flexible'].includes(season);
  const winter=['four_season','fall_winter','winter','seasonal_flexible'].includes(season);
  if(spring) rows.push(['SPRING_SUMMER_LANDSCAPING_ORIENTATION','Spring/summer mowing and landscaping orientation','seasonal_service']);
  if(fall) rows.push(['FALL_CLEANUP_ORIENTATION','Fall cleanup and leaf collection orientation','seasonal_service']);
  if(winter) rows.push(['WINTER_SNOW_OPERATIONS_ORIENTATION','Winter snow clearing and snow removal orientation','seasonal_service']);
  return rows;
}

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
    if(entity==='hiring_candidate' && action==='create'){
      const fullName=String(body.full_name||'').trim();
      const employmentType=String(body.employment_type||'full_time').trim().toLowerCase();
      const seasonProfile=String(body.season_profile||'four_season').trim().toLowerCase();
      if(!fullName) return Response.json({ok:false,error:'Candidate name is required.'},{status:400,headers:corsHeaders});
      if(!allowedEmployment.includes(employmentType)) return Response.json({ok:false,error:'Unsupported employment type.'},{status:400,headers:corsHeaders});
      if(!allowedSeasons.includes(seasonProfile)) return Response.json({ok:false,error:'Unsupported season profile.'},{status:400,headers:corsHeaders});
      const {data,error}=await supabase.from('workforce_hiring_candidates').insert({
        full_name:fullName,preferred_name:textOrNull(body.preferred_name),email:textOrNull(body.email),phone:textOrNull(body.phone),
        source:textOrNull(body.source),target_position:textOrNull(body.target_position),employment_type:employmentType,
        season_profile:seasonProfile,stage:'applicant',planned_crew_id:textOrNull(body.planned_crew_id),
        available_from:dateOrNull(body.available_from),notes:textOrNull(body.notes),created_by_profile_id:actorId,
        updated_by_profile_id:actorId,created_at:nowIso,updated_at:nowIso
      }).select('*').single();
      if(error) throw error;
      const items=defaultItems(seasonProfile).map(([item_code,item_name,item_category])=>({
        candidate_id:data.id,item_code,item_name,item_category,is_required:true,item_status:'pending',
        created_by_profile_id:actorId,updated_by_profile_id:actorId,created_at:nowIso,updated_at:nowIso
      }));
      const {error:itemError}=await supabase.from('workforce_candidate_onboarding_items').insert(items);
      if(itemError) throw itemError;
      await supabase.from('workforce_candidate_stage_events').insert({
        candidate_id:data.id,from_stage:null,to_stage:'applicant',transition_note:'Candidate created.',
        changed_by_profile_id:actorId,changed_at:nowIso
      });
      return Response.json({ok:true,record:data},{headers:corsHeaders});
    }

    if(entity==='hiring_candidate'){
      const itemId=String(body.item_id||'').trim();
      if(!itemId) return Response.json({ok:false,error:'Candidate id is required.'},{status:400,headers:corsHeaders});
      const {data:before,error:beforeError}=await supabase.from('workforce_hiring_candidates').select('*').eq('id',itemId).single();
      if(beforeError||!before) return Response.json({ok:false,error:'Candidate not found.'},{status:404,headers:corsHeaders});

      if(action==='set_stage'){
        const toStage=String(body.stage||'').trim().toLowerCase();
        if(!allowedStages.includes(toStage)) return Response.json({ok:false,error:'Unsupported hiring stage.'},{status:400,headers:corsHeaders});
        if(toStage==='ready'){
          const {data:readiness}=await supabase.from('v_workforce_hiring_onboarding_overview').select('pre_field_ready,next_readiness_gate').eq('candidate_id',itemId).single();
          if(!readiness?.pre_field_ready) return Response.json({ok:false,error:'Pre-field readiness is incomplete. Resolve '+String(readiness?.next_readiness_gate||'the remaining gate')+' before Ready.'},{status:409,headers:corsHeaders});
        }
        const patch:any={stage:toStage,updated_by_profile_id:actorId,updated_at:nowIso};
        if(toStage==='offer'&&!before.offer_date) patch.offer_date=nowIso.slice(0,10);
        if(toStage==='hired'&&!before.hire_date) patch.hire_date=nowIso.slice(0,10);
        const {data,error}=await supabase.from('workforce_hiring_candidates').update(patch).eq('id',itemId).select('*').single();
        if(error) throw error;
        await supabase.from('workforce_candidate_stage_events').insert({
          candidate_id:itemId,from_stage:before.stage,to_stage:toStage,transition_note:textOrNull(body.transition_note),
          changed_by_profile_id:actorId,changed_at:nowIso
        });
        return Response.json({ok:true,record:data},{headers:corsHeaders});
      }

      if(action==='link_profile'){
        const profileId=textOrNull(body.profile_id);
        if(!profileId) return Response.json({ok:false,error:'Existing employee profile is required.'},{status:400,headers:corsHeaders});
        const {data,error}=await supabase.from('workforce_hiring_candidates').update({profile_id:profileId,updated_by_profile_id:actorId,updated_at:nowIso}).eq('id',itemId).select('*').single();
        if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
      }

      if(action==='update'){
        const patch:any={updated_by_profile_id:actorId,updated_at:nowIso};
        for(const key of ['preferred_name','email','phone','source','target_position','notes']) if(body[key]!==undefined) patch[key]=textOrNull(body[key]);
        if(body.planned_crew_id!==undefined) patch.planned_crew_id=textOrNull(body.planned_crew_id);
        if(body.available_from!==undefined) patch.available_from=dateOrNull(body.available_from);
        if(body.employment_type!==undefined){
          const v=String(body.employment_type||'').trim().toLowerCase();
          if(!allowedEmployment.includes(v)) return Response.json({ok:false,error:'Unsupported employment type.'},{status:400,headers:corsHeaders});
          patch.employment_type=v;
        }
        if(body.season_profile!==undefined){
          const v=String(body.season_profile||'').trim().toLowerCase();
          if(!allowedSeasons.includes(v)) return Response.json({ok:false,error:'Unsupported season profile.'},{status:400,headers:corsHeaders});
          patch.season_profile=v;
        }
        const {data,error}=await supabase.from('workforce_hiring_candidates').update(patch).eq('id',itemId).select('*').single();
        if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
      }

      if(action==='archive'){
        const {data,error}=await supabase.from('workforce_hiring_candidates').update({is_archived:true,updated_by_profile_id:actorId,updated_at:nowIso}).eq('id',itemId).select('*').single();
        if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
      }
    }

    if(entity==='hiring_onboarding_item' && action==='update'){
      const itemId=String(body.item_id||'').trim();
      const status=String(body.item_status||'').trim().toLowerCase();
      if(!itemId) return Response.json({ok:false,error:'Onboarding item id is required.'},{status:400,headers:corsHeaders});
      if(!['pending','in_progress','completed','waived','not_applicable'].includes(status)) return Response.json({ok:false,error:'Unsupported onboarding item status.'},{status:400,headers:corsHeaders});
      const patch:any={
        item_status:status,evidence_reference:textOrNull(body.evidence_reference),note:textOrNull(body.note),
        updated_by_profile_id:actorId,updated_at:nowIso
      };
      patch.completed_at=['completed','waived','not_applicable'].includes(status)?nowIso:null;
      const {data,error}=await supabase.from('workforce_candidate_onboarding_items').update(patch).eq('id',itemId).select('*').single();
      if(error) throw error; return Response.json({ok:true,record:data},{headers:corsHeaders});
    }

    return Response.json({ok:false,error:'Unsupported hiring/onboarding entity/action'},{status:400,headers:corsHeaders});
  }catch(error){
    return Response.json({ok:false,error:String((error as any)?.message||error)},{status:500,headers:corsHeaders});
  }
});
