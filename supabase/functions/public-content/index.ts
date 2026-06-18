import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders={ 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Cache-Control':'public, max-age=300, stale-while-revalidate=3600' };
const clean=(v:unknown,max=1000)=>String(v ?? '').trim().slice(0,max);
serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return Response.json({ok:false,error:'Use POST.'},{status:405,headers:corsHeaders});
  try{
    const url=Deno.env.get('SUPABASE_URL')||Deno.env.get('SB_URL')||'';
    const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('SB_SERVICE_ROLE_KEY')||'';
    if(!url||!key) throw new Error('Public content service is not configured.');
    const supabase=createClient(url,key,{auth:{persistSession:false}});
    const body=await req.json().catch(()=>({}));
    const action=clean(body.action||'route',40);
    if(action==='sitemap'){
      const {data,error}=await supabase.from('public_sitemap_entries').select('route_path, canonical_url, last_modified, change_frequency, priority').eq('entry_status','active').order('route_path');
      if(error) throw error;
      return Response.json({ok:true,entries:data||[]},{headers:corsHeaders});
    }
    const path=`/${clean(body.route_path||'/',240).replace(/^\/+|\/+$/g,'')}`.replace(/^\/$/,'/');
    const {data:route,error}=await supabase.from('public_route_approval_items').select('*').eq('route_path',path).eq('route_status','approved').not('published_at','is',null).maybeSingle();
    if(error) throw error;
    if(!route) return Response.json({ok:false,error:'Published route not found.'},{status:404,headers:corsHeaders});
    let visual=null;
    if(route.visual_asset_key){
      const {data}=await supabase.from('visual_asset_approval_items').select('asset_key, public_url, source_url, thumbnail_url, alt_text, pixel_width, pixel_height').eq('asset_key',route.visual_asset_key).eq('asset_status','approved').maybeSingle();
      visual=data||null;
    }
    return Response.json({ok:true,route:{ id:route.id, route_key:route.route_key, route_type:route.route_type, route_path:route.route_path, service_name:route.service_name, location_name:route.location_name, page_title:route.page_title, h1_text:route.h1_text, meta_description:route.meta_description, page_intro:route.page_intro, page_body_markdown:route.page_body_markdown, page_body_html:route.page_body_html, local_proof_hint:route.local_proof_hint, primary_cta_path:route.primary_cta_path, canonical_url:route.canonical_url, published_at:route.published_at },visual},{headers:corsHeaders});
  }catch(error){ return Response.json({ok:false,error:error instanceof Error?error.message:'Public content request failed.'},{status:500,headers:corsHeaders}); }
});
