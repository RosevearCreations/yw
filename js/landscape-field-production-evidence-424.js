/* Item 424 — field attestations about original Jobs/Production/QC sources only. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const make=(tag,label)=>{const e=document.createElement(tag);if(label!==undefined)e.textContent=String(label);return e;};
const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s));
function validate(data,company,order){
 if(!data||data.company_id!==company||data.work_order_id!==(order||null)||data.complete!==true||
  data.review_only!==true||data.source_limit!==80||!['choose_order','review_only','hold'].includes(data.state)||
  !Array.isArray(data.orders)||!Array.isArray(data.sources)||!Array.isArray(data.receipts)||
  data.orders.length>60||data.sources.length>80||data.receipts.length>80||
  data.orders.some(o=>!uuid(o.id)||!o.number)||
  data.sources.some(s=>!uuid(s.id)||!s.activity_type||typeof s.eligible!=='boolean'||
   typeof s.already_attested!=='boolean'||!Array.isArray(s.execution_proof_ids)||
   !Array.isArray(s.qc_run_ids)||s.execution_proof_ids.length>10||
   s.execution_proof_ids.some(id=>!uuid(id))||s.qc_run_ids.some(id=>!uuid(id)))||
  data.receipts.some(r=>!uuid(r.id)||!uuid(r.production_quantity_id)||
   !['recorded_unreviewed','hold'].includes(r.state))||
  new Set(data.sources.map(s=>s.id)).size!==data.sources.length||
  new Set(data.receipts.map(r=>r.production_quantity_id)).size!==data.receipts.length||
  (order&&!data.orders.some(o=>o.id===order)))throw Error('Incomplete, duplicate or foreign field-production evidence');
 if(!order&&(data.state!=='choose_order'||data.sources.length||data.receipts.length))throw Error('Unexpected unselected production disclosure');
 if(order&&data.state==='choose_order')throw Error('Work-order source verification withheld');
 if(order&&data.receipts.some(r=>!data.sources.some(s=>s.id===r.production_quantity_id&&s.already_attested)))
  throw Error('Field receipt is not linked to the returned canonical quantity');
 return data;
}
function mount(){
 const root=$('admin');if(!root||$('owner424'))return;
 const panel=make('details');panel.id='owner424';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Landscaping Field Production Evidence';
 panel.dataset.adminHubGroups='management operations jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.appendChild(make('summary','424 · Landscaping Field Production Evidence'));
 const body=make('div');body.className='admin-panel-block';
 body.appendChild(make('p','Review the original landscaping work session, property zone and measured production before signing a dated, unreviewed field observation. Optional existing Execution Proof and QC links are references, not approvals. No session completion, invoice or cost is posted.'));
 const help=make('a','ⓘ Help');help.href='/help.html#landscape-field-evidence-424';body.appendChild(help);
 const refresh=make('button','Refresh owned landscaping orders');refresh.id='owner424Refresh';refresh.type='button';refresh.className='secondary';body.appendChild(refresh);
 const status=make('p','Authenticate as an owner and refresh.');status.id='owner424Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.appendChild(status);
 const fields=make('div');fields.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;min-width:0';
 const selector=(id,label)=>{const l=make('label',label),s=make('select');s.id=id;s.style.cssText='width:100%;max-width:100%;min-width:0;box-sizing:border-box;display:block';l.appendChild(s);fields.appendChild(l);return s;};
 const company=selector('owner424Company','Company');const order=selector('owner424Order','Original landscaping work order');body.appendChild(fields);
 const read=make('button','Review site-zone and measured field sources');read.id='owner424Read';read.type='button';read.className='secondary';body.appendChild(read);
 const results=make('div');results.id='owner424Results';results.style.cssText='display:grid;gap:12px;min-width:0;overflow-wrap:anywhere';body.appendChild(results);
 panel.appendChild(body);root.appendChild(panel);
 let session=null,companies=[],orders=[],busy=false;
 const note=s=>status.textContent=s;
 const fill=(el,rows,label)=>{const prev=el.value;el.replaceChildren();const blank=make('option',label);blank.value='';el.appendChild(blank);for(const r of rows){const opt=make('option',r.label);opt.value=r.id;el.appendChild(opt);}el.value=rows.some(r=>r.id===prev)?prev:'';};
 const clear=()=>{session=null;companies=[];orders=[];company.replaceChildren();order.replaceChildren();results.replaceChildren();};
 async function owner(){const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(auth?.isAuthenticated!==true||!auth.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)throw Error('Authenticated company owner session required');
  const identity=await sb.auth.getUser();if(identity.error||identity.data?.user?.id!==auth.user.id)throw Error('Authentication identity mismatch');
  return {uid:auth.user.id,sb};}
 async function checked(){const current=await owner();if(!session||session.uid!==current.uid||!companies.some(c=>c.id===company.value))throw Error('Refresh your owned company first');return current;}
 async function rpc(sb,name,args){const r=await sb.rpc(name,args);if(r.error||r.data==null)throw Error(r.error?.message||'Canonical server evidence withheld');return r.data;}
 function display(data){results.replaceChildren();if(!data.work_order_id){results.appendChild(make('p','Choose one verified landscaping work order. No legacy or foreign property is inferred.'));return;}
  if(data.state==='hold'){const warn=make('p','HOLD: original measured work or zone has changed. Review Production and QC manually.');warn.dataset.owner424Hold='true';results.appendChild(warn);}
  if(!data.sources.length){results.appendChild(make('p','No measured Production session quantity recorded on this work order. Nothing to attest.'));return;}
  for(const src of data.sources){const card=make('article');card.className='notice';card.dataset.owner424Source=src.id;card.style.cssText='min-width:0;max-width:100%;overflow-wrap:anywhere';
   card.appendChild(make('strong',(src.zone_name||'Unverified zone')+' · '+(src.metric_label||src.activity_type)));
   card.appendChild(make('p','Session date: '+String(src.session_date||'unknown')+' · Original measured quantity: '+String(src.actual_quantity)+' '+String(src.unit_label||'unit not recorded')+' · '+src.activity_type));
   card.appendChild(make('p',src.already_attested?'Already attested: see review receipt below':src.eligible?'Eligible for owner field observation (unreviewed)':'WITHHELD: operator, zone, dated session or positive measured source unverified'));
   if(src.eligible&&!src.already_attested){const label=make('label','Field observation (20–1000 characters, factual and site-specific)');const entry=make('textarea');entry.rows=3;entry.maxLength=1000;entry.style.cssText='display:block;width:100%;max-width:100%;box-sizing:border-box';label.appendChild(entry);card.appendChild(label);
    const optional=(title,items)=>{const l=make('label',title),s=make('select');s.style.cssText='display:block;width:100%;max-width:100%;box-sizing:border-box';const none=make('option','No original link');none.value='';s.appendChild(none);for(const id of items){const opt=make('option',id);opt.value=id;s.appendChild(opt);}l.appendChild(s);card.appendChild(l);return s;};
    const proof=optional('Original execution proof (optional)',src.execution_proof_ids);const qc=optional('Original QC run (optional; not approval)',src.qc_run_ids);
    const save=make('button','Record dated field evidence');save.type='button';save.className='secondary';save.dataset.owner424Save=src.id;
    save.onclick=()=>run(async()=>{const current=await checked();if(!orders.some(o=>o.id===order.value))throw Error('Original work-order selection changed');
     const observation=entry.value.trim();if(observation.length<20||observation.length>1000)throw Error('Provide a 20–1000 character factual field observation');
     if(!window.confirm('Append an unreviewed field observation for this original measurement? This does NOT complete work, approve QC or invoice.'))return;
     const id=await rpc(current.sb,'ywi_rpc_record_landscape_field_evidence_424',{p_company_id:company.value,p_work_order_id:order.value,p_quantity_id:src.id,p_observation:observation,p_execution_proof_id:proof.value||null,p_qc_run_id:qc.value||null});
     if(!uuid(id))throw Error('No receipt ID returned; inspect the source before retrying');
     await load(current,true);note('Dated unreviewed evidence receipt '+id.slice(0,8)+' recorded. No completion, QC approval or Finance action.');
    });card.appendChild(save);}
   results.appendChild(card);
  }
  for(const receipt of data.receipts){const p=make('p','Field receipt '+receipt.id.slice(0,8)+' · source session '+receipt.source_session_date+' · signed '+receipt.attested_at+' · '+(receipt.state==='hold'?'HOLD: source changed':'Recorded; awaiting separate QC review')+' · '+receipt.field_observation);
   p.dataset.owner424Receipt=receipt.state;results.appendChild(p);}
 }
 async function load(current,keep){const id=company.value,selected=keep?order.value:null;
  const data=validate(await rpc(current.sb,'ywi_rpc_landscape_field_dashboard_424',{p_company_id:id,p_work_order_id:selected}),id,selected);
  orders=data.orders;fill(order,orders.map(o=>({id:o.id,label:o.number+' · '+o.status})),'Select a company landscaping order');if(selected)order.value=selected;display(data);
  note(orders.length+' owner-scoped landscaping order(s); only canonical measured field sources are eligible.');}
 async function run(fn){if(busy)return;busy=true;refresh.disabled=true;read.disabled=true;
  try{await fn();}catch(e){results.replaceChildren();note('WITHHELD: '+(e?.message||e));}
  finally{busy=false;refresh.disabled=false;read.disabled=false;}}
 refresh.onclick=()=>run(async()=>{clear();const current=await owner();const r=await current.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(r.error||!Array.isArray(r.data)||r.data.length>100||r.data.some(c=>!uuid(c.id)||!c.name||c.owner_user_id!==current.uid))throw Error('Verified owner company listing incomplete');
  session={uid:current.uid};companies=r.data;fill(company,companies.map(c=>({id:c.id,label:c.name})),'Choose owned company');if(companies.length===1){company.value=companies[0].id;await load(current,false);}else note('Choose an owned company.');});
 company.onchange=()=>run(async()=>{const current=await checked();await load(current,false);});
 order.onchange=()=>run(async()=>{const current=await checked();if(!orders.some(o=>o.id===order.value)){results.replaceChildren();return;}await load(current,true);});
 read.onclick=()=>run(async()=>{const current=await checked();if(!orders.some(o=>o.id===order.value))throw Error('Choose a landscaping work order first');await load(current,true);});
 document.addEventListener('ywi:auth-changed',()=>{clear();note('Session changed: refresh before reading field evidence.');});
}
window.YWI424=Object.freeze({validate});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
