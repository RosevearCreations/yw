/* YW593: session-bound original device witness windows, expiry reviews and receiver contract. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
 const el=(tag,body)=>{const e=document.createElement(tag);if(body!==undefined)e.textContent=String(body);return e;};
 const state=()=>window.YWI_AUTH?.getState?.()||{};
 const client=()=>window.YWI_SB||window._sb;
 let epoch=0,busy=false;
 const value=id=>$(id)?.value.trim()||'';
 function status(msg){if($('yw593Status'))$('yw593Status').textContent=msg;}
 function line(parent,text){parent.append(el('p',text));}
 function field(parent,id,label,type='text'){
  const holder=el('label',label),input=el('input');input.id=id;input.type=type;
  input.autocomplete='off';holder.append(input);parent.append(holder);return input;
 }
 function select(parent,id,label,items){
  const holder=el('label',label),s=el('select');s.id=id;
  for(const [v,t] of items){const option=el('option',t);option.value=v;s.append(option);}
  holder.append(s);parent.append(holder);
 }
 function button(parent,label,fn){
  const b=el('button',label);b.type='button';b.addEventListener('click',()=>run(fn));parent.append(b);
 }
 function company(){const id=value('yw593Company')||value('yw592Company')||value('yw591Company');
  if(!uuid(id))throw Error('Choose an existing authorized company UUID');return id;}
 function requiredId(id){const v=value(id);if(!uuid(v))throw Error('Valid original UUID required: '+id);return v;}
 async function auth(){
  const current=epoch,s=state(),c=client();
  if(s.isAuthenticated!==true||!uuid(s.user?.id)||!c?.auth?.getUser||!c?.functions?.invoke)
   throw Error('Original active account login required');
  const live=await c.auth.getUser();
  if(live.error||live.data?.user?.id!==s.user.id||epoch!==current||
   state().user?.id!==s.user.id)throw Error('Original session or workspace changed');
  return {c,current,actor:s.user.id};
 }
 async function call(ctx,body){
  if(navigator.onLine===false)throw Error('Online original authentication required');
  const r=await ctx.c.functions.invoke('yw593-field-recovery-contract',{body});
  if(ctx.current!==epoch||state().user?.id!==ctx.actor)
   throw Error('Original session changed; results withheld');
  if(r.error||!r.data||r.data.state==='HOLD')
   throw Error(r.data?.code||'Source, reviewer or receiver authorization HOLD');
  return r.data;
 }
 async function run(fn){
  if(busy)return;busy=true;const current=epoch;
  document.querySelectorAll('#yw593Panel button').forEach(b=>b.disabled=true);
  try{const ctx=await auth();await fn(ctx);}
  catch(e){if(current===epoch)status('HOLD · '+(e?.message||'Source unavailable'));}
  finally{if(current===epoch){busy=false;
   document.querySelectorAll('#yw593Panel button').forEach(b=>b.disabled=false);}}
 }
 function summary(data){
  const target=$('yw593Result');if(!target)return;target.replaceChildren();
  for(const name of ['state','slotId','attemptId','contractRecordId','physicalFieldWitnessCertified',
   'notOriginalMasterSourceAck','noAutomaticDeletion','noCustomerNotice']){
   if(!Object.hasOwn(data,name))continue;
   const p=el('p');p.append(el('strong',name+': '),document.createTextNode(String(data[name])));
   target.append(p);
  }
 }
 function render(data){
  const out=$('yw593Result');if(!out)return;out.replaceChildren();
  function section(title,items,columns){
   out.append(el('h4',title));
   const table=el('table');table.className='yw593-table';
   const head=el('tr');for(const [_,caption]of columns)head.append(el('th',caption));
   const h=el('thead');h.append(head);table.append(h);
   const body=el('tbody');for(const obj of items){
    const r=el('tr');for(const [key]of columns)r.append(el('td',obj[key]??'—'));
    if(uuid(obj.slotId))r.addEventListener('click',()=>{$('yw593Slot').value=obj.slotId;
     if(uuid(obj.attemptId))$('yw593Attempt').value=obj.attemptId;});
    if(uuid(obj.attemptId))r.addEventListener('click',()=>{$('yw593Attempt').value=obj.attemptId;});
    body.append(r);
   }
   table.append(body);out.append(table);
   if(!items.length)line(out,'No enrolled original records. No demonstration witness or receiver is created.');
  }
  section('Original device witness windows',data.witnesses||[],
   [['slotId','Window ID'],['startsAt','Start UTC'],['endsAt','End UTC'],
    ['independentReviewerVerified','Signed approval'],['physicalFieldWitnessCertified','Observed']]);
  section('Expiry escalations (review only)',data.escalations||[],
   [['attemptId','Attempt'],['reasonCode','Reason'],['escalatedAt','Escalated UTC']]);
  section('Master receiver contracts (not delivery ACK)',data.receiverContracts||[],
   [['contractId','Receiver contract ID'],['expiresAt','Expires UTC']]);
 }
 function mount(){
  const root=$('jobs');if(!root||$('yw593Panel'))return;
  const panel=el('details');panel.id='yw593Panel';panel.className='yw593-panel';
  panel.append(el('summary','YW593 · Device Witness Scheduling / Expiry Escalation / Master Contract'));
  line(panel,'Owner proposes an original uploader witness window. A distinct reviewer approves. '+
   'A scheduled or approved window is NOT proof that a device was observed.');
  const grid=el('div');grid.className='yw593-grid';panel.append(grid);
  field(grid,'yw593Company','Original company UUID');
  field(grid,'yw593Attempt','Original photo attempt UUID');
  field(grid,'yw593Crew','Original uploader / enrolled crew UUID');
  field(grid,'yw593Slot','Original witness slot UUID');
  field(grid,'yw593Proposal','Existing YW592 signed proposal UUID');
  field(grid,'yw593Start','Witness start (local time)','datetime-local');
  field(grid,'yw593End','Witness end (local time)','datetime-local');
  select(grid,'yw593Reason','Due escalation reason',[
   ['LEASE_EXPIRED','Expired original photo lease'],
   ['RETENTION_DUE','Bounded retention date reached'],
   ['LEGAL_HOLD_REVIEW','Review existing signed legal hold']]);
  const actions=el('div');actions.className='yw593-actions';panel.append(actions);
  button(actions,'Load original tenant witness and escalation queue',async a=>{
   render(await call(a,{action:'overview',companyId:company()}));
   status('Tenant-isolated queue loaded; no hardware witness inferred.');});
  button(actions,'Owner: propose original device field witness',async a=>{
   if(!$('yw593OwnerConsent').checked)throw Error('Explicit original owner consent required');
   const starts=new Date(value('yw593Start')),ends=new Date(value('yw593End'));
   if(!Number.isFinite(starts.getTime())||!Number.isFinite(ends.getTime()))
    throw Error('Enter valid local start and end times');
   const data=await call(a,{action:'schedule',companyId:company(),
    attemptId:requiredId('yw593Attempt'),crewUserId:requiredId('yw593Crew'),
    startsAt:starts.toISOString(),endsAt:ends.toISOString()});
   if(uuid(data.slotId))$('yw593Slot').value=data.slotId;summary(data);
   status('Window proposed; requires distinct live reviewer approval.');});
  button(actions,'Independent reviewer: sign scheduled witness window',async a=>{
   if(!$('yw593ReviewerConsent').checked)throw Error('Independent reviewer confirmation required');
   summary(await call(a,{action:'approve-witness',companyId:company(),
    slotId:requiredId('yw593Slot')}));
   status('Window reviewed and approved; physical observation NOT certified.');});
  button(actions,'Independent reviewer: escalate due expiry (never delete)',async a=>{
   if(!$('yw593ReviewerConsent').checked)throw Error('Independent reviewer confirmation required');
   summary(await call(a,{action:'escalate-expiry',companyId:company(),
    attemptId:requiredId('yw593Attempt'),proposalId:requiredId('yw593Proposal'),
    reasonCode:value('yw593Reason')}));
   status('Original due case escalated for human follow-up; no object deleted.');});
  button(actions,'Owner: verify pinned Master receiver contract',async a=>{
   if(!$('yw593OwnerConsent').checked)throw Error('Original owner consent required');
   summary(await call(a,{action:'probe-receiver-contract',companyId:company()}));
   status('Receiver contract verified; this is NOT a source telemetry ACK.');});
  for(const [id,msg]of [
   ['yw593OwnerConsent','I am the existing real owner, and I authorize this company-scoped action'],
   ['yw593ReviewerConsent','I am the existing distinct reviewer; I approve only source-backed evidence']]){
   const l=el('label'),c=el('input');c.type='checkbox';c.id=id;
   l.append(c,document.createTextNode(' '+msg));panel.append(l);
  }
  const st=el('p','HOLD · original owner/reviewer and source records required');
  st.id='yw593Status';st.setAttribute('role','status');panel.append(st);
  const out=el('div');out.id='yw593Result';panel.append(out);
  root.append(panel);
 }
 function clear(){
  epoch++;$('yw593Result')?.replaceChildren();
  for(const id of ['yw593Company','yw593Attempt','yw593Crew','yw593Slot','yw593Proposal',
   'yw593Start','yw593End'])if($(id))$(id).value='';
  for(const id of ['yw593OwnerConsent','yw593ReviewerConsent'])if($(id))$(id).checked=false;
  status('HOLD · session/workspace changed; all private evidence cleared.');
 }
 for(const event of ['ywi:auth-changed','ywi:workspace-authority-changed'])
  document.addEventListener(event,clear);
 window.YW593Recovery=Object.freeze({build:'YW593',defaultAuthority:'HOLD',clear});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
