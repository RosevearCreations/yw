/* YW584 private company maintenance/support drafts + separate SaaS Sysop aggregate.
 * NO cross-tenant reads, public publication, billing, tenant provisioning or action
 * execution. Supabase RLS / original 489/550/579 server authority is mandatory.
 * If staged tables are absent, every write remains disabled (NOT ENROLLED).
 */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e};
 const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 const themes=new Set(['standard','futuristic','angular','forest','gilded']);
 const kinds=new Set(['addon','rental','event']);
 const cases=new Set(['complaint','platform_lockout','performance','traffic','local_maintenance','other']);
 const rowFields={
  site:'company_id,site_slug,display_name,headline,public_description,theme_name,publication_state,updated_at',
  offers:'id,company_id,kind,title,description,begins_at,ends_at,state,created_at',
  cases:'id,company_id,case_kind,summary,detail,priority,status,created_at'
 };
 const safeText=(s,min,max)=>typeof s==='string'&&s.trim().length>=min&&s.trim().length<=max;
 const freshDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
 function inspectSite(row,id){
  return row&&row.company_id===id&&row.publication_state==='draft'&&
   /^[a-z0-9][a-z0-9-]{2,49}$/.test(row.site_slug||'')&&
   safeText(row.display_name,2,110)&&safeText(row.headline,8,180)&&
   safeText(row.public_description,20,1200)&&themes.has(row.theme_name)&&freshDate(row.updated_at)
   ?Object.freeze({state:'COMPANY_DRAFT_ONLY',row}):Object.freeze({state:'HOLD',row:null});
 }
 function inspectOfferings(rows,id){
  if(!Array.isArray(rows)||rows.length>100||new Set(rows.map(r=>r.id)).size!==rows.length||
   rows.some(r=>!uuid(r.id)||r.company_id!==id||!kinds.has(r.kind)||
    !safeText(r.title,3,110)||!safeText(r.description,8,800)||
    !['draft','archived'].includes(r.state)||!freshDate(r.created_at)||
    (r.kind==='event'?(!freshDate(r.begins_at)||!freshDate(r.ends_at)||
      Date.parse(r.ends_at)<=Date.parse(r.begins_at)):(r.begins_at!==null||r.ends_at!==null))))
   return Object.freeze({state:'HOLD',rows:[]});
  return Object.freeze({state:'COMPANY_DRAFTS_ONLY',rows});
 }
 function inspectCases(rows,id){
  if(!Array.isArray(rows)||rows.length>100||new Set(rows.map(r=>r.id)).size!==rows.length||
   rows.some(r=>!uuid(r.id)||r.company_id!==id||!cases.has(r.case_kind)||
    !safeText(r.summary,5,160)||!safeText(r.detail,10,2000)||
    !['normal','high'].includes(r.priority)||r.status!=='open'||!freshDate(r.created_at)))
   return Object.freeze({state:'HOLD',rows:[]});
  return Object.freeze({state:'COMPANY_CASES_ONLY',rows});
 }
 function inspectPlatform(r){
  if(!r||r.scope!=='aggregate_only'||r.source!=='ywi_584_company_support_cases'||
   r.private_case_details_exposed!==false||r.runtime_telemetry_verified!==false||
   r.sysop_action_authorized!==false||!freshDate(r.captured_at)||
   !['total_cases','high_priority','lockout_cases','performance_or_traffic_cases'].every(
    k=>Number.isSafeInteger(r[k])&&r[k]>=0&&r[k]<=r.total_cases))
    return Object.freeze({state:'HOLD',data:null});
  return Object.freeze({state:'SYSOP_AGGREGATE_ONLY',data:r});
 }
 const state={epoch:0,busy:false,company:'',actor:'',enrolled:false,site:null,offers:[],cases:[]};
 const a=()=>window.YWI_AUTH?.getState?.()||{},nav=()=>window.YW579Navigation?.snapshot?.()||{};
 const platform=()=>location.hash==='#sysop'||document.documentElement.dataset.ywSurface==='platform';
 const tenant=()=>a().isAuthenticated===true&&uuid(a().user?.id)&&!platform()&&
  window.YWIDualWorkspace?.snapshot?.()?.ownedCompanies>0&&nav().verified===true&&uuid(nav().companyId)&&
  window.YWISecurity?.canViewSection?.('settings',a().role||'employee')===true;
 const sysop=()=>a().isAuthenticated===true&&uuid(a().user?.id)&&platform()&&
  window.YWIDualWorkspace?.isSysopVerified?.()===true;
 const client=()=>window.YWI_SB||window._sb;
 const notice=(id,msg)=>{const n=$(id);if(n)n.textContent=msg;};
 function secureCtx(){
  const sb=client(),x=a(),n=nav();
  if(!tenant()||!sb?.auth?.getUser||!sb?.from)throw Error('Verified landscaping company owner required');
  return {sb,id:x.user.id,company:n.companyId,epoch:state.epoch};
 }
 function current(ctx){return ctx.epoch===state.epoch&&tenant()&&
   a().user?.id===ctx.id&&nav().companyId===ctx.company;}
 async function requireOwner(){
  const ctx=secureCtx();const user=await ctx.sb.auth.getUser();
  if(user.error||user.data?.user?.id!==ctx.id||!current(ctx))
   throw Error('Owner authentication changed or is no longer available');
  const owned=await ctx.sb.from('ywi_companies').select('id,owner_user_id').eq('id',ctx.company).limit(2);
  if(!current(ctx)||owned.error||owned.data?.length!==1||owned.data[0].owner_user_id!==ctx.id)
   throw Error('Company ownership was not independently verified');
  return ctx;
 }
 function reset(reason='Verify a company owner session and select an owned company.'){
  state.epoch++;state.company='';state.actor='';state.enrolled=false;
  state.site=null;state.offers=[];state.cases=[];
  const pane=$('yw584Tenant');if(pane)pane.hidden=!tenant();
  const sys=$('yw584Sysop');if(sys)sys.hidden=!sysop();
  for(const name of ['yw584SiteSave','yw584OfferSave','yw584CaseSave']){
   const btn=$(name);if(btn)btn.disabled=true;
  }
  for(const id of ['yw584SiteRecords','yw584OfferRecords','yw584CaseRecords','yw584PlatformMetrics']){
   $(id)?.replaceChildren();
  }
  notice('yw584TenantStatus','NOT ENROLLED · '+reason);
  notice('yw584PlatformStatus','Read-only aggregate support requires current verified Sysop and deployed RLS-backed source.');
 }
 const appendP=(host,txt)=>host?.append(node('p',txt));
 function renderTenant(){
  const rows=[['yw584SiteRecords',state.site?[state.site]:[]],
   ['yw584OfferRecords',state.offers],['yw584CaseRecords',state.cases]];
  for(const [id,list] of rows){
   const host=$(id);if(!host)continue;host.replaceChildren();
   if(!list.length){appendP(host,'No verified records in this company.');continue;}
   const ul=node('ul');
   for(const record of list.slice(0,30)){
    const li=node('li');
    li.textContent=id==='yw584SiteRecords'?
      record.display_name+' · '+record.site_slug+' · PRIVATE DRAFT':
      id==='yw584OfferRecords'?
      record.kind.toUpperCase()+' · '+record.title+' · '+record.state.toUpperCase():
      record.case_kind.replaceAll('_',' ')+' · '+record.summary+' · OPEN';
    ul.append(li);
   }
   host.append(ul);
  }
  if(state.site){
   for(const [id,key] of [
    ['yw584Slug','site_slug'],['yw584Name','display_name'],['yw584Headline','headline'],
    ['yw584Description','public_description'],['yw584Theme','theme_name']]){
    const e=$(id);if(e)e.value=state.site[key];
   }
  }
 }
 async function refresh(){
  if(state.busy)return;
  state.busy=true;const run=++state.epoch;
  notice('yw584TenantStatus','Checking original company ownership and staged site/support registry…');
  try{
   const ctx=await requireOwner();
   const [s,o,c]=await Promise.all([
    ctx.sb.from('ywi_584_company_site_drafts').select(rowFields.site).eq('company_id',ctx.company).limit(2),
    ctx.sb.from('ywi_584_company_offering_drafts').select(rowFields.offers).eq('company_id',ctx.company).order('created_at',{ascending:false}).limit(101),
    ctx.sb.from('ywi_584_company_support_cases').select(rowFields.cases).eq('company_id',ctx.company).order('created_at',{ascending:false}).limit(101)
   ]);
   if(!current(ctx)||run!==state.epoch)return;
   if(s.error||o.error||c.error||!Array.isArray(s.data)||s.data.length>1)
    throw Error('YW584 owner-scoped database not enrolled: private company drafts and support are unavailable');
   const v=s.data.length?inspectSite(s.data[0],ctx.company):{state:'EMPTY',row:null};
   const w=inspectOfferings(o.data,ctx.company),t=inspectCases(c.data,ctx.company);
   if(v.state==='HOLD'||w.state==='HOLD'||t.state==='HOLD')
    throw Error('Unexpected company record or foreign tenant data; access withheld');
   state.actor=ctx.id;state.company=ctx.company;state.site=v.row;
   state.offers=w.rows;state.cases=t.rows;state.enrolled=true;
   renderTenant();
   for(const id of ['yw584SiteSave','yw584OfferSave','yw584CaseSave']){
    if($(id))$(id).disabled=false;
   }
   notice('yw584TenantStatus',
    'PRIVATE COMPANY DRAFTS ENABLED · Owner verified. Save does not publish a website, enable rentals, create public events or charge customers.');
  }catch(err){
   if(run===state.epoch){reset(err?.message||'Site/support source unavailable');}
  }finally{state.busy=false;}
 }
 const str=id=>String($(id)?.value??'').trim();
 async function write(kind,payload,table,cols,check){
  if(state.busy||!state.enrolled)return;
  state.busy=true;const run=state.epoch;
  try{
   const ctx=await requireOwner();
   if(!current(ctx)||ctx.id!==state.actor||ctx.company!==state.company||run!==state.epoch)
    throw Error('Company switched before save');
   let q;
   if(kind==='site'&&state.site){
    q=ctx.sb.from(table).update(payload).eq('company_id',ctx.company);
   }else{
    q=ctx.sb.from(table).insert({...payload,company_id:ctx.company});
   }
   const result=await q.select(cols).limit(2);
   if(!current(ctx)||run!==state.epoch)return;
   if(result.error||result.data?.length!==1||!check(result.data[0],ctx.company))
    throw Error('Database rejected or failed to confirm this private draft');
   notice('yw584TenantStatus','Saved and confirmed in owner-scoped database as PRIVATE DRAFT. Refresh to reconcile.');
  }catch(e){if(run===state.epoch)notice('yw584TenantStatus',
   'HOLD: '+(e?.message||'Private draft save failed'));}
  finally{state.busy=false;if(run===state.epoch)await refresh();}
 }
 function saveSite(e){
  e.preventDefault();const slug=str('yw584Slug').toLowerCase();
  const payload={site_slug:slug,display_name:str('yw584Name'),
   headline:str('yw584Headline'),public_description:str('yw584Description'),
   theme_name:str('yw584Theme')};
  if(!/^[a-z0-9][a-z0-9-]{2,49}$/.test(slug)||!safeText(payload.display_name,2,110)||
    !safeText(payload.headline,8,180)||!safeText(payload.public_description,20,1200)||
    !themes.has(payload.theme_name)){notice('yw584TenantStatus','HOLD: validate site slug, description, and theme');return;}
  write('site',payload,'ywi_584_company_site_drafts',rowFields.site,
    (row,id)=>inspectSite(row,id).state==='COMPANY_DRAFT_ONLY');
 }
 function saveOffer(e){
  e.preventDefault();const kind=str('yw584OfferKind');
  const payload={kind,title:str('yw584OfferTitle'),description:str('yw584OfferDescription'),
   begins_at:null,ends_at:null};
  if(!kinds.has(kind)||!safeText(payload.title,3,110)||!safeText(payload.description,8,800)){
   notice('yw584TenantStatus','HOLD: valid offering title and description required');return;}
  if(kind==='event'){
   const s=str('yw584OfferStart'),t=str('yw584OfferEnd');
   if(!s||!t||!Number.isFinite(Date.parse(s))||!Number.isFinite(Date.parse(t))||
     Date.parse(t)<=Date.parse(s)){notice('yw584TenantStatus','HOLD: event needs a valid start and later end');return;}
   payload.begins_at=new Date(s).toISOString();payload.ends_at=new Date(t).toISOString();
  }
  write('offer',payload,'ywi_584_company_offering_drafts',rowFields.offers,
    (row,id)=>inspectOfferings([row],id).state==='COMPANY_DRAFTS_ONLY');
 }
 function saveCase(e){
  e.preventDefault();
  const payload={case_kind:str('yw584CaseKind'),summary:str('yw584CaseSummary'),
   detail:str('yw584CaseDetail'),priority:str('yw584CasePriority')};
  if(!cases.has(payload.case_kind)||!safeText(payload.summary,5,160)||
    !safeText(payload.detail,10,2000)||!['normal','high'].includes(payload.priority)){
   notice('yw584TenantStatus','HOLD: support case type, summary or detail invalid');return;}
  write('case',payload,'ywi_584_company_support_cases',rowFields.cases,
    (row,id)=>inspectCases([row],id).state==='COMPANY_CASES_ONLY');
 }
 async function refreshSysop(){
  const host=$('yw584PlatformMetrics');host?.replaceChildren();
  if(!sysop()){notice('yw584PlatformStatus','HOLD: verified Sysop required');return;}
  const run=++state.epoch,ctx={id:a().user.id,sb:client()};
  try{
   if(!ctx.sb?.rpc||!ctx.sb?.auth?.getUser)throw Error('No authenticated platform service');
   const user=await ctx.sb.auth.getUser();
   if(user.error||user.data?.user?.id!==ctx.id||!sysop())throw Error('Sysop session changed');
   const check=await ctx.sb.rpc('ywi_is_platform_administrator_489');
   if(check.error||check.data!==true)throw Error('Independent platform membership denied');
   const r=await ctx.sb.rpc('ywi_584_platform_support_overview');
   if(run!==state.epoch||!sysop()||a().user?.id!==ctx.id)return;
   const proof=inspectPlatform(r.data);
   if(r.error||proof.state!=='SYSOP_AGGREGATE_ONLY')
    throw Error('Staged support metrics not enrolled, verified or currently readable');
   const list=node('dl');
   for(const [tag,val] of [
     ['Open tenant support cases',proof.data.total_cases],
     ['High priority',proof.data.high_priority],
     ['Lockout reports',proof.data.lockout_cases],
     ['Traffic/performance reports',proof.data.performance_or_traffic_cases]]){
    list.append(node('dt',tag),node('dd',String(val)));
   }
   host?.append(list);
   notice('yw584PlatformStatus','Verified Sysop · private tenant support AGGREGATES only. Host reboot, request traffic, uptime and real incident resolution are still UNKNOWN until separately signed.');
  }catch(e){if(run===state.epoch)
    notice('yw584PlatformStatus','HOLD: '+(e?.message||'Independent Sysop support unavailable'));}
 }
 function addLabel(form,title,id,type,max=120){
  const label=node('label',title),field=type==='select'?node('select'):node(type==='textarea'?'textarea':'input');
  field.id=id;if(type!=='textarea'&&type!=='select')field.type=type||'text';
  if(type!=='select')field.maxLength=max;
  label.append(field);form.append(label);return field;
 }
 function options(select,items){for(const [value,text] of items){
  const option=node('option',text);option.value=value;select.append(option);}}
 function form(title,buttonText,id,submit){
  const f=node('form');f.className='yw584-form';f.append(node('h4',title));
  const b=node('button',buttonText);b.id=id;b.type='submit';b.disabled=true;
  f.addEventListener('submit',submit);return [f,b];
 }
 function build(){
  const host=$('settings');
  if(host&&!$('yw584Tenant')){
   const p=node('details');p.id='yw584Tenant';p.className='admin-hub-detail yw584-surface';
   const sum=node('summary','Landscaping Company · Site Maintenance, Rentals, Events & Support');
   p.append(sum);
   const body=node('div');body.className='yw584-body';
   body.append(node('p','Company owner workspace · PRIVATE DRAFTS only. Customer-facing portal and public publishing require independent launch approval.'));
   const refreshButton=node('button','Verify owner and refresh private company records');refreshButton.type='button';
   refreshButton.addEventListener('click',refresh);body.append(refreshButton);
   const status=node('p','NOT ENROLLED');status.id='yw584TenantStatus';
   status.setAttribute('role','status');body.append(status);
   const [sf,sb]=form('Customize our landscaping company website draft','Save private site draft','yw584SiteSave',saveSite);
   addLabel(sf,'Public site slug','yw584Slug','text',50);
   addLabel(sf,'Company display name','yw584Name','text',110);
   addLabel(sf,'Homepage headline','yw584Headline','text',180);
   addLabel(sf,'About / service description','yw584Description','textarea',1200);
   const st=addLabel(sf,'Site appearance','yw584Theme','select');
   options(st,[['standard','Standard Blue'],['futuristic','Futuristic'],
    ['angular','Angular'],['forest','Forest'],['gilded','Gilded']]);sf.append(sb);
   const site=node('div');site.id='yw584SiteRecords';body.append(sf,site);
   const [of,ob]=form('Draft rental, service add-on or event','Save private offering draft','yw584OfferSave',saveOffer);
   const ok=addLabel(of,'Offering type','yw584OfferKind','select');
   options(ok,[['addon','Service add-on'],['rental','Equipment / amenity rental'],['event','Customer-facing event']]);
   addLabel(of,'Offering title','yw584OfferTitle','text',110);
   addLabel(of,'Description / operating conditions','yw584OfferDescription','textarea',800);
   addLabel(of,'Event begins (only for events)','yw584OfferStart','datetime-local');
   addLabel(of,'Event ends (only for events)','yw584OfferEnd','datetime-local');
   of.append(ob);const offers=node('div');offers.id='yw584OfferRecords';body.append(of,offers);
   const [cf,cb]=form('Report a complaint, lockout or company maintenance issue','Create private support case','yw584CaseSave',saveCase);
   const ck=addLabel(cf,'Issue category','yw584CaseKind','select');
   options(ck,[['complaint','Complaint'],['platform_lockout','Locked out / access'],
    ['performance','Slow / unresponsive'],['traffic','Traffic / analytics question'],
    ['local_maintenance','Company site maintenance'],['other','Other']]);
   addLabel(cf,'Short issue summary','yw584CaseSummary','text',160);
   addLabel(cf,'What happened / what we need','yw584CaseDetail','textarea',2000);
   const cp=addLabel(cf,'Priority','yw584CasePriority','select');
   options(cp,[['normal','Normal'],['high','High']]);cf.append(cb);
   const caseHost=node('div');caseHost.id='yw584CaseRecords';body.append(cf,caseHost);
   body.append(node('p','This does not enable a public customer interface, ticket email/SLA, live rental inventory or event payments. Those require separate verified applications and owner approval.'));
   p.append(body);host.append(p);
  }
  const platformHost=$('yw576Platform');
  if(platformHost&&!$('yw584Sysop')){
   const panel=node('section');panel.id='yw584Sysop';panel.className='yw584-platform';
   panel.append(node('h3','Platform IT · Lockouts, Performance, Traffic & Tenant Complaints'));
   panel.append(node('p','Platform-wide maintenance is different from company site editing. This area may read only independently authorized aggregate support data.'));
   const refresh=node('button','Verify Sysop and read support aggregates');refresh.type='button';
   refresh.addEventListener('click',refreshSysop);panel.append(refresh);
   const status=node('p','Platform support requires independent enrollment.');status.id='yw584PlatformStatus';status.setAttribute('role','status');
   const data=node('div');data.id='yw584PlatformMetrics';panel.append(status,data);
   panel.append(node('p','Reboot, availability, locking, latency, live traffic, original-server restart and SaaS tenant onboarding must have source-derived metrics and separately authorized remediation. UNKNOWN is not GREEN.'));
   platformHost.append(panel);
  }
  reset();
 }
 function onContextChange(){
  reset('Authentication or company/platform context changed; private data cleared.');
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true});
 else build();
 for(const event of ['ywi:auth-changed','ywi:workspace-authority-changed',
 'ywi:module-permissions-changed','ywi:company-service-offering-changed']){
  document.addEventListener(event,onContextChange);
 }
 $('yw579CompanySelect')?.addEventListener('change',onContextChange);
 window.addEventListener('hashchange',onContextChange);
 window.YW584CompanySupport=Object.freeze({inspectSite,inspectOfferings,inspectCases,inspectPlatform,reset,
  snapshot:()=>({state:state.enrolled?'OWNER_STAGED_PRIVATE_DRAFTS':'HOLD',
   source:state.enrolled?'private_tenant':null,companyId:state.company||null,
   publicSitePublished:false,financeAuthorized:false,platformRemediationAuthorized:false})});
})();
