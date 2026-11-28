/* YW602 property workspace: server-authorized original property/zone/job IDs.
 * A saved request or payer decision is NOT a posted invoice, crew release,
 * canonical scope application or payment. No public property data or keys.
 */
(()=>{'use strict';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const label=(name,input)=>{const l=el('label',name);l.append(input);return l;};
const input=(name,type='text',required=true)=>{const n=el('input');n.name=name;n.type=type;n.required=required;return n;};
const select=(name,items)=>{const n=el('select');n.name=name;n.required=true;n.append(new Option('Choose…',''));for(const [value,title] of items)n.append(new Option(title,value));return n;};
const button=(name,handler)=>{const n=el('button',name);n.type='button';n.addEventListener('click',handler);return n;};
const money=c=>Number.isSafeInteger(c)&&c>=0?new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(c/100):'Not available';
const states={requested:'Requested',awaiting_payer_approval:'Awaiting payer approval',customer_accepted:'Payer accepted · scope handoff pending',customer_declined:'Declined',quote_expired:'Quote expired'};
const validRect=z=>[z.x,z.y,z.w,z.h].every(Number.isInteger)&&z.x>=0&&z.y>=0&&z.w>0&&z.h>0&&z.x+z.w<=10000&&z.y+z.h<=10000;
function mount(host,{getClient,allowed=()=>true,companyOnly=false,companyId=()=>null}={}){
 let generation=0,actor='',roster=[],selected=null,data=null,busy=false,nonce=null;
 const message=el('p','Select Refresh authorized properties to begin.');message.setAttribute('role','status');
 const picker=select('property',[]),refresh=button('Refresh authorized properties',()=>load()),body=el('div');body.className='yw602-property-body';
 const h=el('h3','Private property maps & service extras');
 const secret=el('section');secret.hidden=true;secret.className='yw602-change';
 host.replaceChildren(h,el('p','View only authorized properties. Select an existing zone and work order to request a change. Pricing and approval never automatically release crew work or post an invoice.'),refresh,label('Property',picker),message,secret,body);
 const current=(g,id)=>generation===g&&allowed()&&actor===id;
 function reset(){generation++;actor='';roster=[];selected=null;data=null;busy=false;nonce=null;secret.replaceChildren();secret.hidden=true;body.replaceChildren();picker.replaceChildren(new Option('Choose…',''));message.textContent='Workspace changed. Refresh to verify access.';refresh.disabled=false;}
 async function call(action,payload,g,id){
  const sb=getClient();if(!allowed()||!sb?.auth?.getUser||!sb?.rpc)throw Error('Sign in to the authorized workspace');
  const auth=await sb.auth.getUser();
  if(auth.error||auth.data?.user?.id!==id||!current(g,id))throw Error('Session changed');
  const response=await sb.rpc('ywi_602_property_portal',{p_action:action,p_payload:payload});
  if(!current(g,id))throw Error('Session changed');
  if(response.error||!response.data)throw Error('Request withheld by property authority. Refresh access or check the selected record.');
  return response.data;
 }
 async function load(){
  if(!allowed()||busy)return;reset();const g=generation;busy=true;refresh.disabled=true;
  try{
   const sb=getClient(),a=await sb.auth.getUser();if(g!==generation||!allowed())return;
   if(a.error||!uuid(a.data?.user?.id))throw Error('Verified sign-in required');
   actor=a.data.user.id;
   const res=await call('list',{},g,actor);
   if(res.state!=='authorized_properties'||!Array.isArray(res.properties)||res.properties.length>100||res.properties.some(p=>!uuid(p.company_id)||!uuid(p.site_id)||typeof p.site_name!=='string'||!['owner','manager','payer','resident'].includes(p.access_role)))throw Error('Invalid property roster');
   roster=res.properties.filter(p=>companyOnly?p.access_role==='owner'&&p.company_id===companyId():p.access_role!=='owner');
   for(const p of roster)picker.append(new Option(p.company_name+' · '+p.site_name+' · '+p.access_role,p.company_id+':'+p.site_id));
   message.textContent=roster.length?'Choose a verified property.':'No authorized properties are available. No sample data has been substituted.';
  }catch(e){if(g===generation)message.textContent='HOLD · '+e.message;}
  finally{if(g===generation){busy=false;refresh.disabled=false;}}
 }
 async function overview(keepSecret=false){
  if(keepSecret!==true){secret.replaceChildren();secret.hidden=true;}
  const g=++generation,id=actor;busy=false;refresh.disabled=false;data=null;nonce=null;body.replaceChildren();selected=roster.find(p=>p.company_id+':'+p.site_id===picker.value)||null;
  if(!selected||!allowed()){message.textContent='Choose an authorized property.';return;}
  const p=selected;message.textContent='Checking current property and work records…';
  try{
   const res=await call('overview',{company_id:p.company_id,site_id:p.site_id},g,id);
   if(res.state!=='property_overview'||res.company_id!==p.company_id||res.site_id!==p.site_id||res.access_role!==p.access_role||res.billing_performed!==false||!['zones','work_orders','changes'].every(k=>Array.isArray(res[k])&&res[k].length<=100)||res.zones.some(z=>!uuid(z.id)||typeof z.zone_name!=='string')||res.work_orders.some(w=>!uuid(w.id))||res.changes.some(c=>!uuid(c.id)))throw Error('Property response did not match current authority');
   data=res;render();message.textContent='Verified property · '+p.site_name+' · '+p.access_role;
  }catch(e){if(g===generation)message.textContent='HOLD · '+e.message;}
 }
 function mutate(action,payload,control,expected,onResult){
  if(!selected||!data||busy||!allowed())return Promise.resolve(false);
  const g=generation,id=actor,p=selected;busy=true;control.disabled=true;message.textContent='Checking and saving…';
  return call(action,{company_id:p.company_id,site_id:p.site_id,...payload},g,id).then(r=>{
   if(r.state!==expected)throw Error('Server did not acknowledge the requested action');
   if(!current(g,id))return false;
   onResult?.(r);
   return true;
  }).catch(e=>{if(current(g,id))message.textContent='HOLD · '+e.message;return false;}).finally(()=>{if(current(g,id)){busy=false;control.disabled=false;}});
 }
 function render(){
  body.replaceChildren();if(!data||!selected)return;
  const {zones,work_orders:jobs,changes,access_role:role}=data;
  body.append(el('h4',selected.site_name),el('p','Property plan · schematic from saved zone placements, not a surveyed aerial image. Unplaced zones are available in the list.'));
  const zoneSelect=select('zone',zones.map(z=>[z.id,z.zone_name]));
  const map=el('div');map.className='yw602-zone-map';map.setAttribute('aria-label','Interactive property zone plan');
  for(const z of zones.filter(validRect)){
   const b=button(z.zone_name,()=>{zoneSelect.value=z.id;zoneSelect.dispatchEvent(new Event('change'));});
   const related=changes.filter(c=>c.zone_id===z.id);
   b.className='yw602-zone';b.style.left=z.x/100+'%';b.style.top=z.y/100+'%';b.style.width=z.w/100+'%';b.style.height=z.h/100+'%';
   b.setAttribute('aria-label',z.zone_name+' · '+related.length+' change request(s)');
   b.dataset.state=related.some(c=>c.state==='awaiting_payer_approval')?'approval':related.some(c=>c.state==='requested')?'issue':'neutral';
   map.append(b);
  }
  if(map.childElementCount)body.append(map);else body.append(el('p','No map geometry has been published for this property.'));
  body.append(label('Property zone',zoneSelect));
  if(role==='owner'){
   const customers=Array.isArray(data.customers)?data.customers.filter(c=>uuid(c.id)&&typeof c.label==='string').slice(0,100):[];
   const showCode=r=>{
    if(!/^[a-f0-9]{64}$/.test(r.access_code||''))throw Error('Private access code missing');
    const code=el('input');code.type='text';code.readOnly=true;code.value=r.access_code;code.autocomplete='off';
    secret.replaceChildren(el('strong','Private access code · shown once'),el('p','Share privately with the intended customer only. Expires in seven days; no email or SMS is sent.'),code,button('Hide access code',()=>{secret.replaceChildren();secret.hidden=true;}));secret.hidden=false;
   };
   const manage=el('details');manage.append(el('summary','Manage private customer access'),el('p','A customer credential is not a staff login. Create an identity, then explicitly grant a property role. Revocation affects the selected property; disabling a credential affects every granted property.'));
   const create=el('form');create.className='yw602-form';const name=input('customer_label');name.minLength=2;name.maxLength=120;
   const confirm=input('confirmed','checkbox');const submit=el('button','Create private access code');submit.type='submit';
   create.append(label('Customer label',name),label('I approve this private customer identity.',confirm),submit);
   create.addEventListener('submit',async e=>{e.preventDefault();if(!confirm.checked)return;if(await mutate('customer_create',{label:name.value,confirmed:true},submit,'customer_created',showCode))await overview(true);});
   manage.append(create);
   const grant=el('form');grant.className='yw602-form';
   const who=select('customer',customers.map(c=>[c.id,c.label+' · '+(c.access_role&&!c.property_revoked_at?c.access_role:'no active property role')]));
   const permission=select('access_role',[['manager','Property manager'],['payer','Authorized payer'],['resident','Resident']]);
   const consent=input('confirmed','checkbox');const grantSave=el('button','Grant selected property role');grantSave.type='submit';
   grant.append(label('Customer identity',who),label('Property permission',permission),label('I approve this customer’s selected property access for 30 days.',consent),grantSave);
   grant.addEventListener('submit',async e=>{e.preventDefault();if(!consent.checked||!uuid(who.value))return;if(await mutate('grant',{user_id:who.value,access_role:permission.value,confirmed:true,expires_at:new Date(Date.now()+30*86400000).toISOString()},grantSave,'granted'))await overview();});
   for(const [action,title,expected] of [['revoke','Revoke this property role','revoked'],['customer_rotate','Rotate private access code','customer_rotated'],['customer_disable','Disable customer credential','customer_disabled']]){
    const b=button(title,async()=>{if(!uuid(who.value)||!consent.checked){message.textContent='Select the customer and confirm the access change.';return;}
     if(await mutate(action,{user_id:who.value,confirmed:true},b,expected,action==='customer_rotate'?showCode:undefined))await overview(action==='customer_rotate');});
    grant.append(b);
   }
   manage.append(grant);body.append(manage);
   const layout=el('form');layout.className='yw602-form';
   const fields=['x','y','w','h'].map(name=>{const n=input(name,'number');n.min=name==='x'||name==='y'?'0':'1';n.max='10000';n.step='1';layout.append(label({x:'Left (0–10000)',y:'Top (0–10000)',w:'Width',h:'Height'}[name],n));return n;});
   const save=el('button','Save selected zone placement');save.type='submit';layout.append(save);
   zoneSelect.addEventListener('change',()=>{const z=zones.find(x=>x.id===zoneSelect.value);fields.forEach(n=>n.value=z&&validRect(z)?z[n.name]:'');});
   layout.addEventListener('submit',async e=>{e.preventDefault();const z=zones.find(x=>x.id===zoneSelect.value);if(!z)return;const p=Object.fromEntries(fields.map(n=>[n.name,Number(n.value)]));if(!validRect(p)){message.textContent='Zone must fit inside the schematic.';return;}if(await mutate('layout',{zone_id:z.id,expected_revision:z.revision??0,...p},save,'layout_saved'))await overview();});
   body.append(layout);
  }
  const form=el('form');form.className='yw602-form';
  const job=select('job',jobs.map(j=>[j.id,j.work_order_number+' · '+j.status])),desc=el('textarea');desc.required=true;desc.minLength=8;desc.maxLength=1500;desc.placeholder='Describe the service or change needed.';
  const send=el('button','Submit zone service request');send.type='submit';
  form.append(label('Existing work order',job),label('Requested work',desc),send);
  form.addEventListener('submit',async e=>{e.preventDefault();if(!uuid(zoneSelect.value)||!uuid(job.value)){message.textContent='Select both a zone and a work order.';return;}nonce=nonce||crypto.randomUUID();
   if(await mutate('request',{zone_id:zoneSelect.value,work_order_id:job.value,description:desc.value,nonce},send,'request_saved')){nonce=null;await overview();}
  });body.append(form,el('h4','Service request history'));
  for(const c of changes){
   const card=el('article');card.className='yw602-change';card.append(el('h5',zones.find(z=>z.id===c.zone_id)?.zone_name||'Property zone'),el('p',c.description),el('strong',states[c.state]||'Unknown state'));
   if(c.version){card.append(el('p','Quote version '+c.version+' · '+c.scope),el('p',String(c.quantity)+' '+String(c.unit)));if(role==='payer'||role==='owner')card.append(el('p','Total including applicable taxes: '+money(c.total_cents)));}
   if(role==='payer'&&c.state==='awaiting_payer_approval'&&Number.isSafeInteger(c.version)&&Number.isSafeInteger(c.total_cents)){
    const consent=input('accept','checkbox');const confirm=label('I have reviewed this exact version and total.',consent);card.append(confirm);
    for(const [decision,title] of [['accept','Accept this quote'],['decline','Decline this quote']]){
     const act=button(title,async()=>{if(!consent.checked){message.textContent='Confirm you reviewed the exact quote first.';return;}
      if(await mutate('decide',{request_id:c.id,version:c.version,decision,confirmed:true},act,'decision_saved'))await overview();
     });card.append(act);
    }
   }
   if(role==='owner'&&c.state==='customer_accepted'){
    if(uuid(c.canonical_change_order_id))card.append(el('p','Original change-order draft created · office pricing and tax reconciliation required.'));
    else{
     const handoff=button('Send accepted version to original change-order review',async()=>{
      if(!window.confirm('Create an original change-order draft for office review? No invoice, crew release or charge will be created.'))return;
      if(await mutate('handoff',{request_id:c.id,version:c.version,confirmed:true},handoff,'handoff_saved'))await overview();
     });
     card.append(handoff);
    }
   }
   if(role==='owner'&&c.state!=='customer_accepted'){
    const q=el('form');q.className='yw602-form';const scope=input('scope'),quantity=input('quantity','number'),unit=input('unit'),total=input('total','number');scope.minLength=8;scope.maxLength=1500;quantity.min='0.001';quantity.step='0.001';unit.maxLength=32;total.min='0';total.step='0.01';total.max='1000000';
    const submit=el('button','Issue new quote version');submit.type='submit';
    q.append(label('Proposed scope',scope),label('Quantity',quantity),label('Unit',unit),label('Total CAD including applicable taxes',total),submit);
    q.addEventListener('submit',async e=>{e.preventDefault();const cents=Math.round(Number(total.value)*100);if(!Number.isSafeInteger(cents))return;if(await mutate('quote',{request_id:c.id,expected_version:c.version??0,scope:scope.value,quantity:Number(quantity.value),unit:unit.value,total_cents:cents,expires_at:new Date(Date.now()+7*86400000).toISOString()},submit,'quote_issued'))await overview();});
    card.append(q);
   }
   body.append(card);
  }
  if(!changes.length)body.append(el('p','No service extras requested for this property.'));
 }
 picker.addEventListener('change',overview);
 return {reset,load};
}
window.YW602PropertyPortal=Object.freeze({mount});
})();
