/* YW Item 423 — explicit, append-only source attribution; never posts stock or cost. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const make=(tag,label)=>{const e=document.createElement(tag);if(label!==undefined)e.textContent=String(label);return e;};
const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s));
const kinds=['material','equipment'];
function validate(data,company,order){
 if(!data||data.company_id!==company||data.work_order_id!==(order||null)||
   data.complete!==true||data.no_stock_or_cost_posting!==true||data.source_limit!==80||
   !['choose_order','no_record','recorded','hold'].includes(data.state)||
   !Array.isArray(data.orders)||!Array.isArray(data.sources)||!Array.isArray(data.proofs)||
   data.orders.length>60||data.sources.length>80||data.proofs.length>80||
   new Set(data.orders.map(o=>o.id)).size!==data.orders.length||
   new Set(data.sources.map(s=>s.source_kind+':'+s.source_id)).size!==data.sources.length||
   data.orders.some(o=>!uuid(o.id)||!o.number||!o.service)||
   data.sources.some(s=>!kinds.includes(s.source_kind)||!s.source_id||!s.source_name||
     typeof s.eligible!=='boolean'||typeof s.already_proven!=='boolean')||
   data.proofs.some(p=>!uuid(p.id)||!kinds.includes(p.source_kind)||!p.source_id||
     !['verified','hold'].includes(p.state))||
   (order&&!data.orders.some(o=>o.id===order)))
  throw Error('Incomplete, duplicate or cross-company allocation proof');
 if(order&&data.state==='choose_order')throw Error('Work order proof was not returned');
 if(!order&&(data.sources.length||data.proofs.length||data.state!=='choose_order'))throw Error('Unexpected work order disclosure');
 if(order&&data.proofs.some(p=>!data.sources.some(s=>
    s.source_kind===p.source_kind&&s.source_id===p.source_id&&s.already_proven)))
  throw Error('Allocation proof has no canonical source');
 return data;
}
function mount(){
 const host=$('admin');if(!host||$('owner423'))return;
 const panel=make('details');panel.id='owner423';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='Shared Equipment & Materials Allocation Proof';
 panel.dataset.adminHubGroups='management operations jobs';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.appendChild(make('summary','423 · Shared Equipment & Materials Allocation Proof'));
 const body=make('div');body.className='admin-panel-block';
 body.appendChild(make('p','Verify the original material issue or equipment checkout against an owned work order. A receipt is appended once per source ID; no stock movement, job-cost entry, equipment-hour charge, lockout release, or invoice occurs here.'));
 const help=make('a','ⓘ Help');help.href='/help.html#shared-allocation-proof-423';body.appendChild(help);
 const refresh=make('button','Refresh company work orders');refresh.id='owner423Refresh';refresh.className='secondary';refresh.type='button';body.appendChild(refresh);
 const status=make('p','Authenticate as a company owner to begin.');status.id='owner423Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.appendChild(status);
 const fields=make('div');fields.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;min-width:0';
 function selector(id,title){const label=make('label',title),select=make('select');label.style.minWidth='0';select.id=id;select.style.cssText='display:block;max-width:100%;min-width:0;width:100%;box-sizing:border-box';label.appendChild(select);fields.appendChild(label);return select;}
 const company=selector('owner423Company','Owner company');const order=selector('owner423Order','Authorized work order');body.appendChild(fields);
 const read=make('button','Check original issue and checkout proofs');read.id='owner423Read';read.className='secondary';read.type='button';body.appendChild(read);
 const results=make('div');results.id='owner423Results';results.style.cssText='display:grid;gap:10px;min-width:0;overflow-wrap:anywhere;margin-top:10px';body.appendChild(results);
 panel.appendChild(body);host.appendChild(panel);
 let session=null,companies=[],orders=[],busy=false;
 const note=x=>status.textContent=x;
 const clear=()=>{session=null;companies=[];orders=[];company.replaceChildren();order.replaceChildren();results.replaceChildren();};
 const fill=(el,rows,label)=>{const prev=el.value;el.replaceChildren();const blank=make('option',label);blank.value='';el.appendChild(blank);for(const r of rows){const option=make('option',r.label);option.value=r.id;el.appendChild(option);}el.value=rows.some(r=>r.id===prev)?prev:'';};
 async function owner(){const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(auth?.isAuthenticated!==true||!auth.user?.id||!sb?.auth?.getUser||!sb?.from||!sb?.rpc)throw Error('Authenticated owner session required');
  const identity=await sb.auth.getUser();if(identity.error||identity.data?.user?.id!==auth.user.id)throw Error('Session mismatch');
  return {uid:auth.user.id,sb};
 }
 async function checked(){const who=await owner();if(!session||session.uid!==who.uid||!companies.some(c=>c.id===company.value))throw Error('Refresh and choose an owned company');return who;}
 async function rpc(sb,method,args){const r=await sb.rpc(method,args);if(r.error||r.data==null)throw Error(r.error?.message||'Server proof withheld');return r.data;}
 function display(data){results.replaceChildren();
  if(!data.work_order_id){results.appendChild(make('p','Select one scoped work order. Legacy and foreign company records are not listed.'));return;}
  if(!data.sources.length){results.appendChild(make('p','No original material issue or equipment checkout is linked to this work order. No allocation inferred.'));return;}
  const found=make('p');found.textContent=data.proofs.length+' append-only proof(s) · '+data.sources.length+' original source(s) · '+(data.state==='hold'?'HOLD: source evidence changed':'No double allocation detected');results.appendChild(found);
  if(data.state==='hold'){const warning=make('p','HOLD: a recorded source has changed. Review original ledger and equipment safety authority before further action.');warning.dataset.owner423Hold='true';results.appendChild(warning);}
  for(const src of data.sources){const box=make('article');box.className='notice';box.style.cssText='min-width:0;max-width:100%;overflow-wrap:anywhere';box.dataset.owner423Kind=src.source_kind;
   box.appendChild(make('strong',src.source_kind==='material'?'Material issue':'Equipment checkout'));
   box.appendChild(make('p',(src.source_name||'Unnamed')+' · '+(src.source_number||src.source_id)));
   box.appendChild(make('p',src.source_kind==='material'?'Original issued quantity: '+String(src.quantity)+' · issue-line amount (not a new job-cost posting): '+String(src.source_amount):'One original asset checkout; no equipment time or cost inferred.'));
   const state=src.already_proven?'Source already recorded (unique)':src.eligible?'Source is eligible for owner evidence receipt':'HOLD: original source, safety or assignment not verified';box.appendChild(make('p',state));
   if(!src.already_proven&&src.eligible){const btn=make('button','Record proof for this source');btn.type='button';btn.className='secondary';btn.dataset.sourceId=src.source_id;
    btn.addEventListener('click',()=>run(async()=>{const current=await checked();if(!order.value||!orders.some(o=>o.id===order.value))throw Error('Choose a verified work order');
     if(!window.confirm('Record one immutable source proof for this work order? This does NOT deduct stock, post any costs, or override safety lockout.'))return;
     const id=await rpc(current.sb,'ywi_rpc_record_allocation_proof_423',{
      p_company_id:company.value,p_work_order_id:order.value,p_kind:src.source_kind,p_source_id:src.source_id});
     if(!uuid(id))throw Error('Server did not return an evidence ID; inspect before retrying');
     await load(current,true);note('Original source receipt '+String(id).slice(0,8)+' recorded once; no inventory or financial change.');
    }));box.appendChild(btn);}
   results.appendChild(box);
  }
  for(const proof of data.proofs){const p=make('p','Receipt '+String(proof.id).slice(0,8)+' · '+proof.source_kind+' '+proof.source_id+' · '+(proof.state==='verified'?'Original source unchanged':'HOLD: changed source'));
   p.dataset.owner423Proof=proof.state;results.appendChild(p);}
 }
 async function load(current,keepOrder){const c=company.value,selected=keepOrder?order.value:null;
  const data=validate(await rpc(current.sb,'ywi_rpc_allocation_dashboard_423',{
   p_company_id:c,p_work_order_id:selected}),c,selected);
  orders=data.orders;fill(order,orders.map(o=>({id:o.id,label:o.number+' · '+o.service+' · '+o.status})),'Choose an authorized company work order');
  if(selected)order.value=selected;display(data);
  note(orders.length+' company-scoped work order(s). Original asset/material source is authoritative.');
 }
 async function run(callback){if(busy)return;busy=true;refresh.disabled=true;read.disabled=true;
  try{await callback();}catch(e){results.replaceChildren();note('WITHHELD: '+(e?.message||e));}
  finally{busy=false;refresh.disabled=false;read.disabled=false;}
 }
 refresh.onclick=()=>run(async()=>{clear();const current=await owner();
  const r=await current.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(r.error||!Array.isArray(r.data)||r.data.length>100||r.data.some(c=>!uuid(c.id)||!c.name||c.owner_user_id!==current.uid))throw Error('Company ownership readback incomplete');
  session={uid:current.uid};companies=r.data;fill(company,companies.map(c=>({id:c.id,label:c.name})),'Choose verified company');
  if(companies.length===1){company.value=companies[0].id;await load(current,false);}else note('Choose one of '+companies.length+' owned companies.');
 });
 company.onchange=()=>run(async()=>{const current=await checked();await load(current,false);});
 order.onchange=()=>run(async()=>{const current=await checked();if(!orders.some(o=>o.id===order.value)){results.replaceChildren();return;}await load(current,true);});
 read.onclick=()=>run(async()=>{const current=await checked();if(!orders.some(o=>o.id===order.value))throw Error('Choose a company work order first');await load(current,true);});
 document.addEventListener('ywi:auth-changed',()=>{clear();note('Session changed: refresh before reading any company allocation.');});
}
window.YWI423=Object.freeze({validate});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
