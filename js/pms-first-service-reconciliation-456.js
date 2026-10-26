/* YW Item 456: original Jobs receipt ↔ first-use observation reconciliation.
 * Independent reviewer handoff is only a recommendation. No signoff or dispatch. */
(()=>{'use strict';
const keys=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic','arboriculture']);
const outcomes=Object.freeze(['blocked','needs_follow_up','ready_for_independent_review']);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const node=(tag,value)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=value;return x;};
function secureRequestId(){const api=globalThis.crypto;
 if(api?.randomUUID)return api.randomUUID();if(!api?.getRandomValues)throw Error('Secure randomness unavailable');
 const b=api.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const s=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
 return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);
}
function inspect(source,{companyId,nav,registry,now=Date.now()}={}){
 const captured=Date.parse(source?.captured_at),serviceRows=source?.services;
 const int=x=>Number.isSafeInteger(x)&&x>=0;
 if(!uuid(companyId)||source?.company_id!==companyId||source?.owner_guard!=='ywi_422_assert_owner'||
  source?.independent_approval_granted!==false||source?.real_field_accepted!==false||
  source?.release_green!==false||source?.outbound_actions!==false||
  source?.synthetic!==false||source?.mutation_authorized!==false||
  !Number.isFinite(captured)||captured>now+60000||now-captured>300000||
  !Array.isArray(serviceRows)||serviceRows.length!==7||!Array.isArray(nav)||nav.length!==7||
  !Array.isArray(registry)||registry.length!==7||
  !Array.isArray(source.receipts)||!Array.isArray(source.owner_entries)||!Array.isArray(source.reviews)||
  ![source.receipt_total,source.owner_entry_total,source.review_total].every(int)||
  ![source.receipt_sample_capped,source.owner_entry_sample_capped,source.review_sample_capped].every(x=>typeof x==='boolean'))
   return {state:'withheld',reason:'Incomplete or stale independently sourced owner review'};
 for(const list of [serviceRows,nav,registry]){
  const seen=new Set();for(const s of list){if(s.company_id!==companyId||!keys.includes(s.module_key)||
   typeof s.enabled!=='boolean'||seen.has(s.module_key))return {state:'withheld',reason:'Foreign, missing or duplicate module'};
   seen.add(s.module_key);}
 }
 const enabled=keys.filter(k=>serviceRows.find(x=>x.module_key===k)?.enabled===true);
 for(const row of [...nav,...registry])if(row.enabled!==enabled.includes(row.module_key))
  return {state:'withheld',reason:'420, 443 and 456 switches disagree'};
 const validate=(items,total,capped,kind)=>{
  if(items.length>60||total<items.length||capped!==(total>60))return false;
  const seen=new Set();for(const item of items){
   const id=kind==='receipts'?item.target_table+':'+item.target_id:item.id;
   if(seen.has(id)||item.company_id!==companyId)return false;
   seen.add(id);
   if(kind==='receipts'&&(!uuid(item.target_id)||!['estimates','work_orders'].includes(item.target_table)||
    !keys.includes(item.service_module_key)||!Number.isFinite(Date.parse(item.checked_at))))return false;
   if(kind==='evidence'&&(!uuid(item.id)||(item.module_key!==null&&!keys.includes(item.module_key))||
    !['company_verified','module_rechecked','customer_property_reviewed',
    'jobs_draft_reviewed','field_observation'].includes(item.checkpoint)||
    !['observed','needs_follow_up','blocked'].includes(item.disposition)||
    !Number.isFinite(Date.parse(item.created_at))))return false;
   if(kind==='reviews'&&(!uuid(item.id)||!uuid(item.target_id)||
    !outcomes.includes(item.review_outcome)||!keys.includes(item.service_module_key)||
    !['estimates','work_orders'].includes(item.target_table)||
    !Number.isFinite(Date.parse(item.recorded_at))||
    typeof item.switch_enabled_at_review!=='boolean'||
    typeof item.canonical_site_verified!=='boolean'||
    !source.receipts.some(r=>r.target_table===item.target_table&&r.target_id===item.target_id&&
      r.service_module_key===item.service_module_key)||
    (item.evidence_id!==null&&!source.owner_entries.some(e=>e.id===item.evidence_id))))return false;
  }return true;
 };
 if(!validate(source.receipts,source.receipt_total,source.receipt_sample_capped,'receipts')||
  !validate(source.owner_entries,source.owner_entry_total,source.owner_entry_sample_capped,'evidence')||
  !validate(source.reviews,source.review_total,source.review_sample_capped,'reviews'))
  return {state:'withheld',reason:'Missing, foreign, duplicate or capped-invalid evidence'};
 const capped=source.receipt_sample_capped||source.owner_entry_sample_capped||source.review_sample_capped;
 return {state:capped?'withheld':'source_verified',reason:capped?'Evidence sample truncated; pagination needed':null,
  companyId,enabled,receipts:source.receipts,evidence:source.owner_entries,reviews:source.reviews,
  reviewCount:source.review_total,sourceReceiptCount:source.receipt_total,
  fieldAccepted:false,independentApproval:false,releaseGreen:false};
}
window.YWI456=Object.freeze({keys,outcomes,inspect});
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('owner456'))return;
 const panel=node('details');panel.id='owner456';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · First-Service Reconciliation';panel.dataset.adminHubGroups='management operations';
 panel.append(node('summary','456 · First-Service Evidence & Permission-Safe Approval Review'));
 const body=node('div');body.className='admin-panel-block pms456';
 body.append(node('p','Reconcile an original 421 Jobs/estimate gate receipt with an actual 455 owner observation. All review decisions stay append-only, owner-scoped and advisory. The strongest status is a request for independent review—not actual service, Safety, customer or Production approval.'));
 const help=node('a','ⓘ First-service reconciliation and permission-safe review Help');help.href='/help.html#pms-first-service-reconciliation-456';body.append(help);
 const bar=node('div');bar.className='pms456-controls';const companyLabel=node('label','Verified owner company');const company=node('select');
 company.id='pms456Company';companyLabel.append(company);const refresh=node('button','Reconcile source evidence');refresh.type='button';refresh.id='pms456Refresh';refresh.className='secondary';
 bar.append(companyLabel,refresh);body.append(bar);
 const status=node('p','HOLD: sign in as the real company owner; record first-use evidence in 455 before review.');
 status.id='pms456Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const matrix=node('section');matrix.id='pms456Matrix';matrix.setAttribute('aria-label','Original receipt and owner observation readiness');body.append(matrix);
 const timeline=node('section');timeline.id='pms456Timeline';timeline.setAttribute('aria-label','Previous advisory review entries');body.append(timeline);
 const form=node('fieldset');form.id='pms456Intake';form.disabled=true;form.append(node('legend','Append permission-safe owner reconciliation (no acceptance granted)'));
 const field=(id,title,tag,max)=>{const label=node('label',title),el=node(tag);el.id=id;if(max)el.maxLength=max;label.append(el);form.append(label);return el;};
 const receipt=field('pms456Receipt','Original same-company Jobs/estimate receipt','select');
 const evidence=field('pms456Evidence','First-use owner observation (optional for follow-up/HOLD)','select');
 const outcome=field('pms456Outcome','Review recommendation','select');
 for(const val of outcomes){const opt=node('option',val.replaceAll('_',' '));opt.value=val;outcome.append(opt);}
 const source=field('pms456Reference','Private source reference (4–250 characters)','input',250);
 const notes=field('pms456Notes','Review notes (optional; max 500 characters)','textarea',500);
 const submit=node('button','Append owner review recommendation');submit.type='button';submit.id='pms456Append';submit.className='secondary';form.append(submit);
 form.append(node('p','Ready for independent review needs a currently enabled module, canonical source property, a recorded field observation and server-verified Jobs approve/manage permission. This does not approve or dispatch anything.'));
 body.append(form);
 const release=node('p','REAL FIELD ACCEPTANCE: HOLD. Independent review, Safety, customer consent, regulatory authority and exact-main Production GREEN are separate decisions. An advisory owner review cannot approve any of these.');
 release.className='notice';release.id='pms456Release';body.append(release);panel.append(body);host.append(panel);
 let epoch=0,roster=[],owner=null,verified=null,busy=false;
 const info=x=>{status.textContent=x;};
 function invalidate(message){epoch++;roster=[];owner=null;verified=null;company.replaceChildren();const opt=node('option','Load owned companies');opt.value='';company.append(opt);
  matrix.replaceChildren();timeline.replaceChildren();form.disabled=true;info(message);}
 function selectOptions(el,rows,initial,render,value){el.replaceChildren();const blank=node('option',initial);blank.value='';el.append(blank);
  for(const r of rows){const opt=node('option',render(r));opt.value=value(r);el.append(opt);}}
 const receiptKey=r=>r.target_table+':'+r.target_id;
 function render(data){verified=data;matrix.replaceChildren();timeline.replaceChildren();form.disabled=data.state!=='source_verified'||!data.receipts?.length;
  if(data.state!=='source_verified'){info('WITHHELD: '+data.reason);return;}
  info('SOURCE VERIFIED: '+data.receipts.length+' original Jobs/estimate receipts, '+data.evidence.length+' owner observations, '+data.reviewCount+' review recommendations. Field acceptance HOLD.');
  for(const message of [
   'Seven owner switches: '+data.enabled.length+' ON / '+(7-data.enabled.length)+' OFF',
   'Original 421 gate receipts: '+data.sourceReceiptCount,
   '455 first-use owner observations: '+data.evidence.length,
   '456 append-only recommendations: '+data.reviewCount])matrix.append(node('p',message));
  if(!data.receipts.length)matrix.append(node('p','HOLD: no original company-linked Jobs/estimate receipt exists. Create real first-use data in the original workflow; none is seeded here.'));
  selectOptions(receipt,data.receipts,'Choose verified Jobs/estimate receipt',r=>r.service_module_key+' · '+r.target_table+' · '+r.target_id,receiptKey);
  selectOptions(evidence,data.evidence.filter(e=>['jobs_draft_reviewed','field_observation'].includes(e.checkpoint)),
   'No linked observation — HOLD / follow-up only',e=>e.checkpoint+' · '+e.disposition+' · '+e.source_reference,e=>e.id);
  timeline.append(node('h3','Latest owner review recommendations'));
  for(const r of data.reviews){const article=node('article');article.className='pms456-review';
   article.append(node('strong',r.service_module_key+' · '+r.review_outcome),
    node('p',r.target_table+' · '+r.target_id+' · '+r.source_reference+' · '+r.recorded_at));
   if(r.notes)article.append(node('p',r.notes));timeline.append(article);}
  if(!data.reviews.length)timeline.append(node('p','No review entries yet; absence is HOLD, not approval.'));
 }
 async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc||
   !window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Verified owner with Jobs view required');
  const r=await sb.auth.getUser();if(r.error||r.data?.user?.id!==a.user.id)throw Error('Authenticated owner changed');
  return {sb,uid:a.user.id,role:a.role};}
 const alive=(ctx,start,id)=>epoch===start&&company.value===id&&
  window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===ctx.uid;
 async function reconcile(){const start=epoch,ctx=await session();
  const list=await ctx.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(epoch!==start||list.error||!window.YWI454?.rosterOwned?.(list.data,ctx.uid))throw Error('Owned company roster denied, foreign or capped');
  owner=ctx.uid;roster=list.data;const previous=company.value;company.replaceChildren();const placeholder=node('option','Select owner company');placeholder.value='';company.append(placeholder);
  for(const c of roster){const o=node('option',c.name);o.value=c.id;company.append(o);}
  if(roster.some(c=>c.id===previous))company.value=previous;else if(roster.length===1)company.value=roster[0].id;
  if(!roster.length){info('HOLD: no real owner company. Use 420 explicitly; Yard Rosevear is only a test fixture.');return;}
  const id=company.value;if(!roster.some(c=>c.id===id)){info('HOLD: choose a verified owner company and rerun.');return;}
  const guard=()=>alive(ctx,start,id);
  const first=await ctx.sb.rpc('ywi_rpc_pms_navigation_443',{p_company_id:id});if(!guard()||first.error)throw Error('443 owner navigation read denied');
  const reg=await ctx.sb.from('ywi_company_service_modules').select('company_id,module_key,enabled,created_at,updated_at').eq('company_id',id).limit(8);
  if(!guard()||reg.error)throw Error('420 owner service switches denied');
  const rec=await ctx.sb.rpc('ywi_rpc_first_service_review_456',{p_company_id:id});if(!guard()||rec.error||!rec.data)throw Error('456 owner evidence RPC denied');
  const second=await ctx.sb.rpc('ywi_rpc_pms_navigation_443',{p_company_id:id});
  if(!guard()||second.error||JSON.stringify(first.data?.services)!==JSON.stringify(second.data?.services))throw Error('Service switches changed during review');
  const inspected=inspect(rec.data,{companyId:id,nav:second.data?.services,registry:reg.data});
  if(!guard())throw Error('Identity changed during reconciliation');render(inspected);
 }
 refresh.addEventListener('click',async()=>{if(busy)return;busy=true;refresh.disabled=company.disabled=true;verified=null;form.disabled=true;
  info('Verifying original service receipts, 455 first-use evidence and 420/443 owner-switch parity…');
  try{await reconcile();}catch(err){render({state:'withheld',reason:err?.message||String(err)});}
  finally{busy=false;refresh.disabled=company.disabled=false;}});
 submit.addEventListener('click',async()=>{if(busy||verified?.state!=='source_verified'||!verified.receipts.length)return;
  const id=company.value,start=epoch,chosen=verified.receipts.find(r=>receiptKey(r)===receipt.value),
   event=verified.evidence.find(e=>e.id===evidence.value),decision=outcome.value,ref=source.value.trim(),memo=notes.value.trim();
  if(!chosen||!outcomes.includes(decision)||ref.length<4||ref.length>250||memo.length>500||
   (evidence.value&&!event))return info('WITHHELD: choose a verified receipt/evidence and valid source reference');
  if(decision==='ready_for_independent_review'&&(!verified.enabled.includes(chosen.service_module_key)||
    event?.checkpoint!=='field_observation'||event.disposition!=='observed'))
   return info('WITHHELD: readiness requires ON service and an observed field report, then server Jobs approval permission.');
  if(!window.confirm('Append '+decision.replaceAll('_',' ')+' for the selected original source? This is NOT an operational approval.'))return;
  busy=true;submit.disabled=refresh.disabled=true;
  try{const ctx=await session();if(owner!==ctx.uid||!alive(ctx,start,id))throw Error('Owner or company changed');
   const fresh=await ctx.sb.rpc('ywi_rpc_pms_navigation_443',{p_company_id:id});
   if(!alive(ctx,start,id)||fresh.error||fresh.data?.services?.length!==7||
    fresh.data.services.some(s=>s.enabled!==verified.enabled.includes(s.module_key)))
    throw Error('Service toggle changed; no recommendation saved');
   const requestId=secureRequestId();if(!uuid(requestId))throw Error('Secure request ID unavailable');
   const result=await ctx.sb.rpc('ywi_rpc_append_first_service_review_456',{
    p_company_id:id,p_request_id:requestId,p_service_module_key:chosen.service_module_key,
    p_target_table:chosen.target_table,p_target_id:chosen.target_id,p_evidence_id:event?.id||null,
    p_review_outcome:decision,p_source_reference:ref,p_notes:memo||null});
   if(!alive(ctx,start,id)||result.error||result.data?.company_id!==id||result.data?.recorded!==true||
    result.data?.independent_approval_granted!==false||result.data?.real_field_accepted!==false)
    throw Error('Server receipt unverifiable; review journal before retry');
   source.value='';notes.value='';info('Append-only owner review recorded. Refreshing independent source snapshot…');await reconcile();
  }catch(err){verified=null;form.disabled=true;info('WITHHELD: '+(err?.message||err)+'. Reconcile before retry; no automatic duplicate write.');}
  finally{busy=false;submit.disabled=refresh.disabled=false;}});
 company.addEventListener('change',()=>{epoch++;verified=null;form.disabled=true;matrix.replaceChildren();timeline.replaceChildren();info('HOLD: company changed. Reconcile again.');});
 for(const e of ['ywi:auth-changed','ywi:module-permissions-changed','ywi:company-service-offering-changed'])
  document.addEventListener(e,()=>invalidate('HOLD: identity, permissions or owner service toggle changed. Reconcile sources again.'));
 invalidate(status.textContent);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
