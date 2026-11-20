/* YW586 · owner-only PRIVATE tenant website preview and local publication checklist.
 * No public publishing, no DNS, no Supabase mutations, no unsafe HTML injection.
 * Original company owner + YW584 private draft RLS remain mandatory.
 */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const themes=new Set(['standard','futuristic','angular','forest','gilded']);
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
 const check=s=>typeof s==='string'&&s.trim().length>=2&&s.trim().length<=1200&&
    !/[\u0000-\u001f\u007f]/.test(s);
 const hold=reason=>Object.freeze({state:'HOLD',reason,previewAllowed:false,
  published:false,reviewApproved:false,customerAccess:false});
 function inspectDraft(row,{companyId,actorId,ownerId,privateRecordsVerified}={}){
  if(!uuid(companyId)||!uuid(actorId)||actorId!==ownerId||
     privateRecordsVerified!==true||row?.company_id!==companyId||
     row?.publication_state!=='draft'||
     !/^[a-z0-9][a-z0-9-]{2,49}$/.test(row.site_slug||'')||
     !check(row.display_name)||row.display_name.trim().length<2||row.display_name.length>110||
     !check(row.headline)||row.headline.trim().length<8||row.headline.length>180||
     !check(row.public_description)||row.public_description.trim().length<20||
     row.public_description.length>1200||!themes.has(row.theme_name)||
     !Number.isFinite(Date.parse(row.updated_at)))
     return hold('Original company owner and private website draft required');
  const copy={company_id:row.company_id,site_slug:row.site_slug,
   display_name:row.display_name,headline:row.headline,
   public_description:row.public_description,theme_name:row.theme_name,
   updated_at:row.updated_at,publication_state:'draft'};
  return Object.freeze({state:'OWNER_PRIVATE_DRAFT_PREVIEW',draft:Object.freeze(copy),
   previewAllowed:true,published:false,reviewApproved:false,customerAccess:false});
 }
 function inspectReview({draft,items,hash}={}){
  if(draft?.state!=='OWNER_PRIVATE_DRAFT_PREVIEW'||!Array.isArray(items)||
    items.length!==4||items.some(x=>x!==true)||
    typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))
   return hold('Local checklist and content digest incomplete');
  return Object.freeze({state:'LOCAL_REVIEW_NOT_APPROVAL',
   digest:hash,requiresIndependentReviewer:true,
   previewAllowed:true,published:false,reviewApproved:false,customerAccess:false});
 }
 const state={epoch:0,run:0,preview:null,digest:null,busy:false};
 const a=()=>window.YWI_AUTH?.getState?.()||{},nav=()=>window.YW579Navigation?.snapshot?.()||{};
 const scoped=()=>a().isAuthenticated===true&&uuid(a().user?.id)&&
   window.YW584CompanySupport?.snapshot?.().state==='OWNER_STAGED_PRIVATE_DRAFTS'&&
   nav().verified===true&&uuid(nav().companyId)&&
   nav().companyId===window.YW584CompanySupport.snapshot().companyId&&
   window.YWIDualWorkspace?.snapshot?.()?.ownedCompanies>0&&location.hash!=='#sysop'&&
   document.documentElement.dataset.ywSurface!=='platform';
 const say=msg=>{const n=$('yw586PreviewStatus');if(n)n.textContent=msg};
 const el=(tag,txt)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;return e};
 function clear(msg='HOLD: verify original company ownership and refresh its private website draft.'){
  state.epoch++;state.preview=null;state.digest=null;
  $('yw586PreviewBody')?.replaceChildren();
  for(const n of document.querySelectorAll?.('[data-yw586-check]')||[])n.checked=false;
  say(msg);
 }
 function isCurrent(run,actor,company){
  return run===state.epoch&&scoped()&&a().user.id===actor&&nav().companyId===company;
 }
 async function hashDraft(row){
  if(!window.crypto?.subtle?.digest||!window.TextEncoder)return null;
  const serialized=JSON.stringify(Object.fromEntries(
   Object.entries({
    site_slug:row.site_slug,display_name:row.display_name,
    headline:row.headline,public_description:row.public_description,
    theme_name:row.theme_name
   }).sort(([x],[y])=>x.localeCompare(y))));
  const bytes=new TextEncoder().encode(serialized);
  const hashed=await window.crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hashed)).map(x=>x.toString(16).padStart(2,'0')).join('');
 }
 async function load(){
  if(state.busy)return;
  clear();state.busy=true;
  const run=state.epoch,actor=a().user?.id,company=nav().companyId,host=$('yw586PreviewBody');
  try{
   if(!scoped())throw Error('Verified company owner and original YW584 source required');
   const sb=window.YWI_SB||window._sb;
   if(!sb?.auth?.getUser||!sb?.from)throw Error('Original owner authentication unavailable');
   const user=await sb.auth.getUser();
   if(!isCurrent(run,actor,company)||user.error||user.data?.user?.id!==actor)
    throw Error('Original owner session changed');
   const owned=await sb.from('ywi_companies').select('id,owner_user_id').eq('id',company).limit(2);
   if(!isCurrent(run,actor,company)||owned.error||owned.data?.length!==1||
      owned.data[0]?.owner_user_id!==actor)
    throw Error('Original company ownership not independently verified');
   const site=await sb.from('ywi_584_company_site_drafts')
    .select('company_id,site_slug,display_name,headline,public_description,theme_name,publication_state,updated_at')
    .eq('company_id',company).limit(2);
   if(!isCurrent(run,actor,company)||site.error||site.data?.length!==1)
    throw Error('Independent staging site-draft table unavailable');
   const p=inspectDraft(site.data[0],{companyId:company,actorId:actor,ownerId:owned.data[0].owner_user_id,
    privateRecordsVerified:true});
   if(p.state!=='OWNER_PRIVATE_DRAFT_PREVIEW')throw Error(p.reason);
   const digest=await hashDraft(p.draft);
   if(!isCurrent(run,actor,company)||!digest)throw Error('SHA-256 digest unavailable; cannot review');
   state.preview=p;state.digest=digest;
   host?.replaceChildren();
   const display=el('section');display.className='yw586-private-preview';
   display.dataset.theme=p.draft.theme_name;
   const tag=el('strong','PRIVATE OWNER PREVIEW · NOT PUBLISHED');
   const h=el('h3',p.draft.display_name),hero=el('h4',p.draft.headline);
   const desc=el('p',p.draft.public_description);
   const footer=el('p','Draft URL path: /'+p.draft.site_slug+' · Theme: '+p.draft.theme_name);
   display.append(tag,h,hero,desc,footer);
   const line=el('p','SHA-256 review digest: '+digest);
   line.className='yw586-digest';host?.append(display,line);
   say('Owner-only draft preview loaded. Verify independent publication checklist; no public website changed.');
  }catch(_){
   if(run===state.epoch)clear('HOLD: independent original company site preview unavailable. No customer content published.');
  }finally{state.busy=false;}
 }
 function review(){
  const states=Array.from(document.querySelectorAll?.('[data-yw586-check]')||[]).map(x=>x.checked);
  const result=inspectReview({draft:state.preview,items:states,hash:state.digest});
  if(result.state==='LOCAL_REVIEW_NOT_APPROVAL')
   say('Local checklist complete · digest '+result.digest.slice(0,16)+'… · STILL PRIVATE. Separate owner/independent witness and approved deployment required.');
  else say('HOLD: '+result.reason+' · No public publication authority.');
 }
 function mount(){
  const host=$('yw584SiteRecords');
  if(!host||$('yw586SiteReview'))return;
  const detail=el('details');detail.id='yw586SiteReview';detail.className='yw586-review';
  const summary=el('summary','YW586 · Owner Website Preview & Independent Publication Review');
  const notice=el('p','Preview only: no public URL, booking, customer identity or search indexing. Refresh original company owner drafts first.');
  const b=el('button','Load verified private site preview');b.type='button';b.addEventListener('click',load);
  const body=el('div');body.id='yw586PreviewBody';body.setAttribute('aria-live','polite');
  const labels=[
   'Domain ownership and public URL were independently verified',
   'Company privacy notice and customer contact consent were reviewed',
   'All service claims and rental/event wording were confirmed',
   'A separate reviewer approves this exact digest before publication'
  ];
  const list=el('div');list.className='yw586-checklist';
  for(let i=0;i<labels.length;i++){
   const label=el('label'),input=el('input');input.type='checkbox';input.dataset.yw586Check=String(i);
   label.append(input,document.createTextNode(labels[i]));list.append(label);
  }
  const complete=el('button','Check local review readiness');complete.type='button';complete.addEventListener('click',review);
  const status=el('p','HOLD: original company source not verified');status.id='yw586PreviewStatus';
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  detail.append(summary,notice,b,body,list,complete,status);
  host.after(detail);clear();
 }
 for(const event of ['ywi:auth-changed','ywi:workspace-authority-changed',
  'ywi:module-permissions-changed','ywi:company-service-offering-changed'])
   document.addEventListener(event,()=>clear());
  window.addEventListener('hashchange',()=>{if(location.hash==='#sysop')clear();});
  document.addEventListener('change',e=>{if(e?.target?.id==='yw579CompanySelect')clear();});
  window.YW586SiteReview=Object.freeze({inspectDraft,inspectReview,clear,
   snapshot:()=>({state:state.preview?.state||'HOLD',
    digest:state.digest,publicSitePublished:false,reviewApproved:false})});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
