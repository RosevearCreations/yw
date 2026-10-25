/* YW 444 — company-owner-only Client & Property 360. Existing canonical 422
   records are the source of truth. Photo and contract entries are REFERENCES,
   consent entries are EVIDENCE (never automatic messaging authorization). */
(()=>{'use strict';
const kinds=Object.freeze(['contact','asset','contract','photo','consent']);
const labels=Object.freeze({contact:'Customer contacts',asset:'Property assets',contract:'Contract references',
 photo:'Private photo references',consent:'Consent evidence'});
const states=Object.freeze({contact:['primary','alternate'],asset:['good','monitor','repair','unknown'],
 contract:['draft','reported_active','expired','ended'],photo:['reference_only'],consent:['unknown','given','withdrawn']});
const serviceKeys=Object.freeze(['landscape','construction','water_parks','snow_removal','snow_plowing','septic']);
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const withheld=reason=>({state:'withheld',reason,properties:[],history:[],entries:[],currentConsent:[]});
function inspect(d,{companyId,clientId,now=Date.now(),jobsAllowed=false}={}){
 const history=d?.history,when=Date.parse(d?.captured_at);
 if(!uuid(companyId)||!uuid(clientId)||d?.company_id!==companyId||d?.client_id!==clientId||
  d.owner_guard!=='ywi_422_assert_owner'||d.canonical_source!=='422-original-crm'||
  d.legacy_unscoped_excluded!==true||d.privacy_minimized!==false||
  d.photo_upload_available!==false||d.contract_execution_verified!==false||
  d.consent_authorizes_messaging!==false||d.mutation_authorized!==false||
  !Number.isFinite(when)||!Number.isFinite(now)||when>now+60000||now-when>300000||
  history?.company_id!==companyId||history.client_id!==clientId||
  history.legacy_unscoped_excluded!==true||!history.customer_name||
  !Array.isArray(history.properties)||history.properties.length>100||
  !Array.isArray(history.estimates)||history.estimates.length>80||
  !Array.isArray(history.work_orders)||history.work_orders.length>80||
  !Array.isArray(d.entries)||d.max_entries!==200||!Number.isInteger(d.entries_count)||
  d.entries_count!==d.entries.length||d.entries.length>200||jobsAllowed!==true)
  return withheld('Canonical tenant source, fresh owner identity, complete bounded timeline or Jobs access unverified');
 const properties=new Set(history.properties.map(p=>p.id));
 if(properties.size!==history.properties.length||history.properties.some(p=>!uuid(p.id)||!p.name)||
  [...history.estimates,...history.work_orders].some(w=>!uuid(w.id)||!serviceKeys.includes(w.service)||
    !properties.has(w.property_id))||
  new Set(d.entries.map(e=>e.id)).size!==d.entries.length||
  d.entries.some(e=>!uuid(e.id)||!kinds.includes(e.entry_kind)||
   !states[e.entry_kind].includes(e.reported_status)||!e.title||
   (e.property_id!==null&&!properties.has(e.property_id))||
   (['asset','contract','photo'].includes(e.entry_kind)!==!!e.property_id)||
   (e.entry_kind==='consent'&&(!['email','sms','phone','postal'].includes(e.channel)||
     !['service_updates','marketing'].includes(e.consent_scope)))||
   (e.entry_kind!=='consent'&&(e.channel!==null||e.consent_scope!==null))||
   !Number.isFinite(Date.parse(e.created_at))||Date.parse(e.created_at)>now+60000))
  return withheld('A foreign property, service, duplicate entry, consent scope or chronology was rejected');
 const entries=d.entries.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 const latest=new Map();for(const e of entries)if(e.entry_kind==='consent'){
  const key=e.channel+':'+e.consent_scope;if(!latest.has(key))latest.set(key,e);
 }
 const historyRows=[...history.estimates.map(x=>({...x,kind:'Estimate'})),
  ...history.work_orders.map(x=>({...x,kind:'Job'}))]
  .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 return {state:'verified_360_read_only',companyId,clientId,customerName:history.customer_name,
  properties:history.properties,history:historyRows,entries,currentConsent:[...latest.values()],
  capturedAt:d.captured_at,photoUpload:false,contractExecuted:false,sendingAuthorized:false};
}
window.YWI444=Object.freeze({kinds,states,labels,inspect});
const el=(tag,txt)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=String(txt);return n;};
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('owner444'))return;
 const panel=el('details');panel.id='owner444';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · Client & Property 360';panel.dataset.adminHubGroups='management operations jobs';
 panel.append(el('summary','444 · Property Maintenance System · Client & Property 360'));
 const body=el('div');body.className='admin-panel-block';
 body.append(el('p','Company-owned clients, their canonical properties and original service history, plus append-only contacts, property assets, contract/photo references and consent evidence. No account is cloned, contact is sent, photo uploaded, contract executed or payment made here.'));
 const help=el('a','ⓘ Client & Property 360 Help');help.href='/help.html#pms-client-property-360-444';body.append(help);
 const controls=el('div');controls.className='pms444-fields';
 const field=(tag,id,title,limit)=>{const label=el('label',title);const n=el(tag);n.id=id;
  if(limit)n.maxLength=limit;label.append(n);controls.append(label);return n;};
 const company=field('select','owner444Company','Verified owner company');
 const customer=field('select','owner444Customer','Company-owned customer');
 const property=field('select','owner444Property','Verified property (required for assets, contract and photo references)');
 body.append(controls);
 const actions=el('div');actions.className='pms444-actions';
 const button=(id,txt)=>{const b=el('button',txt);b.id=id;b.type='button';b.className='secondary';actions.append(b);return b;};
 const refresh=button('owner444Refresh','Verify companies & customers');
 const read=button('owner444Read','Open customer 360°');body.append(actions);
 const status=el('p','Sign in as a verified company owner to open a customer dossier.');
 status.id='owner444Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const dossier=el('div');dossier.id='owner444Dossier';dossier.className='pms444-dossier';body.append(dossier);
 const create=el('details');create.id='owner444Create';create.append(el('summary','New canonical customer or property'));
 const addFields=el('div');addFields.className='pms444-fields';
 const clientName=(()=>{const wrap=el('label','Customer legal name');const x=el('input');x.id='owner444NewCustomer';x.maxLength=120;wrap.append(x);addFields.append(wrap);return x;})();
 const clientEmail=(()=>{const wrap=el('label','Billing email (optional)');const x=el('input');x.id='owner444Email';x.maxLength=254;wrap.append(x);addFields.append(wrap);return x;})();
 const siteName=(()=>{const wrap=el('label','New property name (selected customer)');const x=el('input');x.id='owner444NewProperty';x.maxLength=120;wrap.append(x);addFields.append(wrap);return x;})();
 const siteAddress=(()=>{const wrap=el('label','Service address (optional)');const x=el('input');x.id='owner444Address';x.maxLength=400;wrap.append(x);addFields.append(wrap);return x;})();
 create.append(addFields);const createActions=el('div');createActions.className='pms444-actions';
 const addClient=el('button','Create verified customer');addClient.id='owner444AddClient';addClient.type='button';addClient.className='secondary';
 const addSite=el('button','Add verified property');addSite.id='owner444AddSite';addSite.type='button';addSite.className='secondary';
 createActions.append(addClient,addSite);create.append(createActions);body.append(create);
 const entryPanel=el('details');entryPanel.id='owner444EntryPanel';entryPanel.append(el('summary','Record contact, asset, contract, photo reference or consent evidence'));
 const entryFields=el('div');entryFields.className='pms444-fields';
 const addField=(tag,id,title,limit)=>{const label=el('label',title);const n=el(tag);n.id=id;if(limit)n.maxLength=limit;label.append(n);entryFields.append(label);return n;};
 const kind=addField('select','owner444Kind','Record category');for(const k of kinds){const o=el('option',labels[k]);o.value=k;kind.append(o);}
 const title=addField('input','owner444Title','Name, subject or asset',120);
 const details=addField('textarea','owner444Details','Factual notes (up to 600 characters)',600);details.rows=2;
 const reference=addField('input','owner444Reference','Evidence / private photo / contract reference (no public URL)',250);
 const state=addField('select','owner444State','Reported status (not verified certification)');
 const channel=addField('select','owner444Channel','Consent channel');for(const k of ['email','sms','phone','postal']){const o=el('option',k);o.value=k;channel.append(o);}
 const scope=addField('select','owner444Scope','Consent purpose');for(const k of ['service_updates','marketing']){const o=el('option',k);o.value=k;scope.append(o);}
 const validFrom=addField('input','owner444Start','Reported contract start (optional)');validFrom.type='date';
 const validUntil=addField('input','owner444End','Reported contract end (optional)');validUntil.type='date';
 entryPanel.append(entryFields);
 const record=el('button','Append verified-company record');record.id='owner444Record';record.type='button';record.className='secondary';entryPanel.append(record);
 entryPanel.append(el('p','Consent entries record operator-reported evidence only; they do not authorize automatic emails, calls, texts or marketing. Photo entries store private reference labels only: upload is not yet supported.'));
 body.append(entryPanel);panel.append(body);host.append(panel);
 let epoch=0,identity=null,roster=[],customers=[],busy=false,review=null,pending=null;
 const controlsBusy=[refresh,read,addClient,addSite,record];
 const note=t=>status.textContent=t;
 function choices(select,rows,title,formatter){const prior=select.value;select.replaceChildren();const first=el('option',title);first.value='';select.append(first);
  for(const row of rows){const opt=el('option',formatter(row));opt.value=row.id;select.append(opt);}
  if(rows.some(r=>r.id===prior))select.value=prior;else if(rows.length===1)select.value=rows[0].id;}
 function clear(){identity=null;roster=[];customers=[];review=null;pending=null;
  company.replaceChildren();customer.replaceChildren();property.replaceChildren();dossier.replaceChildren();}
 function render(result){review=result;dossier.replaceChildren();
  if(result.state!=='verified_360_read_only'){note('WITHHELD: '+result.reason);property.replaceChildren();return;}
  note('Verified company dossier: '+result.customerName+'. Append-only notes do not send messages or approve contracts.');
  choices(property,result.properties,'Choose linked property',p=>p.name);
  dossier.append(el('h3',result.customerName+' · Client & Property 360'));
  dossier.append(el('p',result.properties.length+' linked properties · '+result.history.length+' original company-scoped Jobs/estimates · '+result.entries.length+' source-linked records. Original Job/estimate history is capped at 80 of each.'));
  const propArea=el('div');propArea.className='pms444-cards';
  for(const p of result.properties){const c=el('article');c.className='notice';c.dataset.pms444Property=p.id;
   c.append(el('h4',p.name),el('p',p.address||'Service address not recorded'));
   const local=result.entries.filter(e=>e.property_id===p.id);c.append(el('p',local.length+' property-specific reference/asset records'));propArea.append(c);}
  if(!result.properties.length)propArea.append(el('p','No company-linked properties yet. Add one using the canonical customer/property form.'));
  dossier.append(propArea);
  const consentTitle=el('h4','Latest reported contact consent per purpose');dossier.append(consentTitle);
  for(const c of result.currentConsent)dossier.append(el('p',c.channel+' · '+c.consent_scope+' · '+c.reported_status+' ('+c.created_at+') · EVIDENCE ONLY'));
  if(!result.currentConsent.length)dossier.append(el('p','No permission evidence is on file. Treat outreach as unverified.'));
  for(const key of kinds){const group=result.entries.filter(e=>e.entry_kind===key);dossier.append(el('h4',labels[key]+' ('+group.length+')'));
   for(const item of group){const card=el('article');card.className='notice';card.dataset.pms444Kind=key;
    card.append(el('strong',item.title+' · '+item.reported_status),el('p',item.details||'No additional notes'));
    if(item.source_reference)card.append(el('p','Source reference: '+item.source_reference));
    if(item.valid_from||item.valid_until)card.append(el('p','Reported coverage: '+(item.valid_from||'unspecified')+' to '+(item.valid_until||'open')));
    card.append(el('small',item.created_at));dossier.append(card);}
  }
  dossier.append(el('h4','Original cross-service Jobs and estimates'));
  for(const h of result.history){const p=el('p',h.kind+' · '+h.service+' · '+h.status+' · '+(h.number||h.id)+' · '+h.created_at);
   p.dataset.pms444History=h.service;dossier.append(p);}
 }
 function kindLayout(){const k=kind.value;state.replaceChildren();for(const st of states[k]){const o=el('option',st.replaceAll('_',' '));o.value=st;state.append(o);}
  const all=entryFields.querySelectorAll('label');for(const lbl of all){const input=lbl.querySelector('input,textarea,select');if(!input)continue;
   if([channel,scope].includes(input))lbl.hidden=k!=='consent';
   if([validFrom,validUntil].includes(input))lbl.hidden=k!=='contract';}
  pending=null;}
 kind.onchange=kindLayout;kindLayout();
 async function owner(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.auth?.getUser||!sb?.from||!sb?.rpc||
   !window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))throw Error('Verified company owner with Jobs view permission required');
  const response=await sb.auth.getUser();if(response.error||response.data?.user?.id!==a.user.id)throw Error('Authenticated owner session mismatch');
  return{uid:a.user.id,sb,role:a.role};}
 const alive=(uid,start)=>start===epoch&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&
   window.YWI_AUTH.getState().user?.id===uid;
 async function checked(start){const ctx=await owner();if(!alive(ctx.uid,start)||identity!==ctx.uid||
  !roster.some(c=>c.id===company.value))throw Error('Verify company again before editing this dossier');return ctx;}
 async function rpc(sb,name,args){const r=await sb.rpc(name,args);if(r.error||r.data===null||r.data===undefined)throw Error(r.error?.message||name+' returned no verified record');return r.data;}
 async function loadCustomers(ctx,start){const id=company.value;customers=[];review=null;customer.replaceChildren();property.replaceChildren();dossier.replaceChildren();
  if(!roster.some(c=>c.id===id))throw Error('Select your company before loading customers');
  const rows=await rpc(ctx.sb,'ywi_rpc_company_customers_422',{p_company_id:id});
  if(!alive(ctx.uid,start)||company.value!==id||!Array.isArray(rows)||rows.length>100||
   new Set(rows.map(r=>r.id)).size!==rows.length||rows.some(r=>!uuid(r.id)||!r.name||typeof r.is_active!=='boolean'))
   throw Error('Company-owned canonical customer roster unverified');
  customers=rows;choices(customer,rows,'Choose linked customer',r=>r.name+(r.is_active?'':' (inactive)'));
  note(rows.length+' canonical customers verified. Select one to view a tenant-bound 360° dossier.');}
 async function loadDossier(ctx,start){const id=company.value,cid=customer.value;
  if(!customers.some(x=>x.id===cid&&x.is_active))throw Error('Select an active, company-owned customer');
  const d=await rpc(ctx.sb,'ywi_rpc_client_property_360_444',{p_company_id:id,p_client_id:cid});
  if(!alive(ctx.uid,start)||company.value!==id||customer.value!==cid)throw Error('Company/customer/session changed during read');
  render(inspect(d,{companyId:id,clientId:cid,jobsAllowed:window.YWISecurity.canViewModule('jobs',ctx.role,'view')}));}
 async function run(action){if(busy)return;busy=true;controlsBusy.forEach(x=>x.disabled=true);const start=epoch;
  try{await action(start);}catch(e){render(withheld(e?.message||String(e)));}
  finally{busy=false;controlsBusy.forEach(x=>x.disabled=false);}}
 refresh.onclick=()=>run(async start=>{clear();const ctx=await owner();if(!alive(ctx.uid,start))throw Error('Owner session changed');
  const r=await ctx.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(!alive(ctx.uid,start)||r.error||!Array.isArray(r.data)||r.data.length>100||
   new Set(r.data.map(c=>c.id)).size!==r.data.length||
   r.data.some(c=>!uuid(c.id)||!c.name||c.owner_user_id!==ctx.uid))throw Error('Incomplete or foreign owner-company roster');
  identity=ctx.uid;roster=r.data;choices(company,roster,'Choose verified company',c=>c.name);
  if(!roster.length){note('HOLD: no real owner company; Yard Rosevear is test-only.');return;}
  if(company.value)await loadCustomers(ctx,start);});
 company.onchange=()=>{epoch++;pending=null;run(async start=>loadCustomers(await checked(start),start));};
 customer.onchange=()=>{epoch++;pending=null;run(async start=>loadDossier(await checked(start),start));};
 read.onclick=()=>run(async start=>loadDossier(await checked(start),start));
 addClient.onclick=()=>run(async start=>{const ctx=await checked(start),name=clientName.value.trim(),email=clientEmail.value.trim();
  if(name.length<2||name.length>120||email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw Error('Enter a valid customer name and optional email');
  if(!window.confirm('Create a NEW canonical customer for only this company? No existing legacy record will be claimed.'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_create_customer_422',{p_company_id:company.value,p_legal_name:name,p_email:email||null});
  if(!uuid(id)||!alive(ctx.uid,start))throw Error('New customer was not verified; refresh before retry');
  await loadCustomers(ctx,start);customer.value=id;clientName.value='';clientEmail.value='';
  await loadDossier(ctx,start);note('New canonical company-owned customer recorded.');});
 addSite.onclick=()=>run(async start=>{const ctx=await checked(start),name=siteName.value.trim();
  if(!customers.some(c=>c.id===customer.value&&c.is_active)||name.length<2||name.length>120||siteAddress.value.trim().length>400)
   throw Error('Choose active verified customer and a valid new property name');
  if(!window.confirm('Create a NEW canonical property under the selected company-owned customer?'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_create_property_422',{p_company_id:company.value,
   p_client_id:customer.value,p_name:name,p_address:siteAddress.value.trim()||null});
  if(!uuid(id)||!alive(ctx.uid,start))throw Error('New property was not verified; refresh before retry');
  await loadDossier(ctx,start);property.value=id;siteName.value='';siteAddress.value='';
  note('New canonical company-owned property recorded.');});
 record.onclick=()=>run(async start=>{const ctx=await checked(start),k=kind.value;
  if(review?.state!=='verified_360_read_only'||review.companyId!==company.value||review.clientId!==customer.value)
   throw Error('Read a fresh verified dossier before appending evidence');
  const needsSite=['asset','contract','photo'].includes(k),site=needsSite?property.value:null;
  if(needsSite&&!review.properties.some(p=>p.id===site))throw Error('This record requires an owned property');
  const args={p_company_id:company.value,p_client_id:customer.value,p_site_id:site,
   p_kind:k,p_title:title.value.trim(),p_details:details.value.trim()||null,
   p_reference:reference.value.trim()||null,p_reported_status:state.value,
   p_channel:k==='consent'?channel.value:null,p_scope:k==='consent'?scope.value:null,
   p_valid_from:k==='contract'?validFrom.value||null:null,
   p_valid_until:k==='contract'?validUntil.value||null:null};
  if(args.p_title.length<2||args.p_title.length>120||details.value.length>600||reference.value.length>250||
    ((k==='photo'||k==='contract'||(k==='consent'&&state.value!=='unknown'))&&!args.p_reference))
   throw Error('Record title and source references are required for this category');
  if(k==='photo'&&/(^https?:\/\/|\.\.|[?&#])/i.test(args.p_reference))throw Error('Use an internal private photo reference, not an external URL');
  const serial=JSON.stringify(args);if(!pending||pending.serial!==serial){if(!window.crypto?.randomUUID)
   throw Error('Secure browser UUID support is required for idempotent record entry');
   pending={serial,requestId:window.crypto.randomUUID()};}
  if(!uuid(pending.requestId))throw Error('Invalid idempotent request identifier');
  if(!window.confirm('Append one company-owned '+k+' record? Existing entries will not be overwritten.'))return;
  const res=await rpc(ctx.sb,'ywi_rpc_append_client_property_360_444',{
   ...args,p_request_id:pending.requestId});
  if(!uuid(res?.id)||res.company_id!==company.value||res.client_id!==customer.value||
    res.entry_kind!==k||res.recorded!==true||res.sending_authorized!==false||
    res.contract_execution_verified!==false||!alive(ctx.uid,start))
   throw Error('Server append receipt incomplete; inspect source before retry');
  pending=null;await loadDossier(ctx,start);title.value='';details.value='';reference.value='';
  note('Append-only '+k+' evidence confirmed. No outbound messaging, upload, approval or payment occurred.');});
 document.addEventListener('ywi:auth-changed',()=>{epoch++;clear();note('Owner session changed; 360° data cleared.');});
 document.addEventListener('ywi:module-permissions-changed',()=>{epoch++;review=null;dossier.replaceChildren();pending=null;note('Jobs permissions changed; reverify company dossier.');});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
