/* YW 552 — explicit company-linked request wizard; owner-only intake readback.
   Client estimates are never authoritative. The Edge Function recalculates and
   compares the server digest before creating an owner-review REQUEST. */
(() => {'use strict';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const $ = id => document.getElementById(id);
const el = (tag, value) => { const node = document.createElement(tag); if(value !== undefined) node.textContent=String(value); return node; };
const cad = cents => new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(cents / 100);
const api = payload => { if (!window.YWIAPI?.landscapeBooking552) throw Error('Booking service is not loaded.'); return window.YWIAPI.landscapeBooking552(payload); };
const newKey = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
};

function mountPublic(){
 const root=$('landscaping-quote-552');if(!root)return;
 const companyId=new URLSearchParams(location.search).get('booking_company')||'';
 if(!uuid.test(companyId))return; // Never enumerate tenants from the public homepage.
 root.hidden=false;
 if(location.hash==='#landscaping-quote-552')requestAnimationFrame(()=>root.scrollIntoView({block:'start'}));
 root.innerHTML=`<div class="public-intake-card"><div class="public-intake-copy">
  <span class="surface-execution-eyebrow">Landscaping · Company quote request</span>
  <h2>Choose landscaping services and request a quote</h2>
  <p id="booking552Company">Verifying this company's public catalogue…</p>
  <p>Prices are illustrative CAD before tax. Requested dates and service availability require company confirmation. This does not reserve a crew, create a job or collect payment.</p></div>
  <form id="booking552Form" class="public-intake-form" aria-label="Landscaping quote and booking request">
    <label>Preferred service date (optional)<input id="booking552Date" type="date" /></label>
    <fieldset><legend>Step 1 — Services and add-ons</legend><div id="booking552Items"></div></fieldset>
    <button id="booking552Preview" type="button" class="secondary">Step 2 — Review estimate</button>
    <div id="booking552Estimate" role="status" aria-live="polite">Select a service to preview the current company estimate.</div>
    <fieldset><legend>Step 3 — Your request and contact details</legend>
      <label>Name<input name="full_name" autocomplete="name" maxlength="140" required /></label>
      <label>Email or phone<input name="contact_value" autocomplete="email" maxlength="180" required /></label>
      <label>Preferred reply<select name="preferred_contact_method"><option value="email">Email</option><option value="phone">Phone</option></select></label>
      <label>Service area / property location<input name="service_area" maxlength="160" placeholder="Town and property area" required /></label>
      <label>Details (optional)<textarea name="customer_message" maxlength="2000" rows="3" placeholder="Tell us about the work"></textarea></label>
      <label><input type="checkbox" name="privacy_consent" required /> I agree to be contacted about this quote request.</label>
      <label><input type="checkbox" name="notification_opt_in" /> I would also like optional service updates, if offered.</label>
      <label class="booking552-honeypot" aria-hidden="true" style="display:none">Website<input name="website" tabindex="-1" autocomplete="off" /></label>
    </fieldset>
    <button id="booking552Submit" class="primary" type="submit" disabled>Send request for owner review</button>
    <p id="booking552Status" role="status" aria-live="polite">Review a server-calculated estimate before sending.</p>
  </form></div>`;
 const form=$('booking552Form'), date=$('booking552Date'), items=$('booking552Items'), status=$('booking552Status');
 const estimate=$('booking552Estimate'), send=$('booking552Submit'), preview=$('booking552Preview');
 const today=new Date().toISOString().slice(0,10),max=new Date(Date.now()+366*86400000).toISOString().slice(0,10);
 date.min=today;date.max=max;
 let rows=[],ready=false,digest=null,key=newKey(),epoch=0,revision=0,busy=false;
 function invalidate(){revision++;digest=null;send.disabled=true;estimate.textContent='Estimate needs reviewing. Select Step 2 again before sending.';status.textContent='Changes are not submitted until the estimate is reviewed.';}
 function selections(){return [...items.querySelectorAll('[data-booking552-code]')]
  .filter(input=>Number(input.value)>0).map(input=>({code:input.dataset.booking552Code,quantity:Number(input.value)}));}
 function renderRows(){items.replaceChildren();
  for(const row of rows){const label=el('label');label.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap';
   const price=el('span',`${row.name} · ${row.item_type} · ${cad(row.price_cents)} / ${row.unit}`);
   const qty=el('input');qty.type='number';qty.min='0';qty.max='100';qty.step='1';qty.value='0';qty.dataset.booking552Code=row.code;
   qty.setAttribute('aria-label',`Quantity for ${row.name}`);qty.style.cssText='width:85px;max-width:100%';
   label.append(price,qty);items.appendChild(label);
  }
  if(!rows.length)items.appendChild(el('p','No active landscaping services are available for requests.'));
 }
 async function readCatalogue(){const run=++epoch;revision++;ready=false;digest=null;send.disabled=true;preview.disabled=true;
  items.replaceChildren();estimate.textContent='Checking current prices…';status.textContent='Loading public company services…';
  try{const resp=await api({action:'catalogue',company_id:companyId,requested_date:date.value||null});
   if(run!==epoch)return;if(!resp?.ok||resp.company_id!==companyId||!Array.isArray(resp.items)||resp.items.length>100)
    throw Error(resp?.error||'Company catalogue response was incomplete.');
   if(resp.items.some(row=>!row.code||!['service','addon','disposal'].includes(row.item_type)||!Number.isSafeInteger(row.price_cents)||row.price_cents<0))
    throw Error('Invalid catalogue pricing.');
   rows=resp.items;ready=rows.some(row=>row.item_type==='service');$('booking552Company').textContent=resp.company_name+' — '+resp.season+' company catalogue';
   renderRows();estimate.textContent=ready?'Select a service, then review an estimate.':'No available services for this company.';
   status.textContent=ready?'Request a date if desired; the company must still confirm availability.':'Booking requests are unavailable for this company.';
  }catch(e){if(run===epoch){rows=[];renderRows();estimate.textContent='Estimate withheld.';status.textContent='UNAVAILABLE: '+(e?.message||e);}}
  finally{if(run===epoch)preview.disabled=!ready;}
 }
 date.addEventListener('change',()=>{invalidate();readCatalogue();});
 items.addEventListener('input',invalidate);
 preview.addEventListener('click',async()=>{if(!ready||busy)return;busy=true;preview.disabled=true;send.disabled=true;digest=null;
  const run=revision;
  try{const selected=selections();if(!selected.some(s=>rows.find(r=>r.code===s.code)?.item_type==='service'))throw Error('Choose at least one landscaping service.');
   if(selected.some(s=>!Number.isSafeInteger(s.quantity)||s.quantity<1||s.quantity>100))throw Error('Use whole quantities from 1 to 100.');
   const resp=await api({action:'preview',company_id:companyId,requested_date:date.value||null,selections:selected});
   if(run!==revision)throw Error('Selection changed during estimate. Review again.');
   if(!resp?.ok||!resp.quote_digest||resp.quote?.availability_confirmed!==false)throw Error(resp?.error||'Unverified estimate.');
   estimate.replaceChildren(el('strong','Estimated subtotal: '+cad(resp.quote.subtotal_cents)));
   estimate.appendChild(el('p','Estimated disposal/dump fees included: '+cad(resp.quote.disposal_estimate_cents)+'. Tax, final scope and availability are excluded.'));
   const list=el('ul');for(const line of resp.quote.lines)list.appendChild(el('li',`${line.name}: ${line.quantity} × ${cad(line.unit_price_cents)} = ${cad(line.line_total_cents)}`));estimate.appendChild(list);
   digest=resp.quote_digest;send.disabled=false;status.textContent='Estimate checked by the company server. Please review your details and consent before sending.';
  }catch(e){estimate.textContent='Estimate withheld: '+(e?.message||e);status.textContent='No request was sent.';}
  finally{busy=false;preview.disabled=false;}
 });
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!digest||!ready)return;
  if(!form.reportValidity())return;
  busy=true;send.disabled=true;const formData=new FormData(form);
  try{const resp=await api({action:'submit',company_id:companyId,requested_date:date.value||null,
   selections:selections(),quote_digest:digest,idempotency_key:key,
   full_name:formData.get('full_name'),contact_value:formData.get('contact_value'),
   preferred_contact_method:formData.get('preferred_contact_method'),service_area:formData.get('service_area'),
   customer_message:formData.get('customer_message'),privacy_consent:formData.get('privacy_consent')==='on',
   notification_opt_in:formData.get('notification_opt_in')==='on',website:formData.get('website')});
   if(!resp?.ok)throw Error(resp?.error||'Request was not confirmed.');
   status.textContent=resp.message||'Your request is awaiting company-owner review. No booking or payment was made.';
   digest=null;key=newKey();form.reset();items.querySelectorAll('[data-booking552-code]').forEach(input=>input.value='0');
   estimate.textContent='Request received. The company must review the request before scheduling.';
  }catch(e){status.textContent='NOT SENT: '+(e?.message||e)+'. Review pricing again if it changed.';}
  finally{busy=false;send.disabled=!digest;}
 });
 readCatalogue();
}

function mountOwner(){const host=$('settings');if(!host||$('owner552'))return;
 const panel=el('details');panel.id='owner552';panel.className='admin-hub-detail';
 panel.innerHTML='<summary>Landscaping · Incoming quote requests (owner only)</summary><div class="admin-panel-block"><p>Company-owner review only. Requests do not book crews, create work orders, send messages or charge cards. Public requests are OFF until this company owner explicitly enables them.</p><select id="owner552Company" aria-label="Owner company"></select> <button id="owner552Refresh" type="button">Refresh requests</button> <button id="owner552Access" type="button">Enable public requests</button> <button id="owner552Link" type="button">Show customer request link</button><p id="owner552Status" role="status" aria-live="polite">Sign in and refresh to verify company ownership.</p><div id="owner552LinkText"></div><div id="owner552Requests"></div></div>';
 host.appendChild(panel);
 const select=$('owner552Company'), status=$('owner552Status'), list=$('owner552Requests');
 let companies=[],currentUser='',publicEnabled=false,publishingRowExists=false,loading=false,epoch=0;
 const option=(value,label)=>{const o=el('option',label);o.value=value;return o;};
 async function identity(){const auth=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
  if(auth?.isAuthenticated!==true||!auth.user?.id||!sb?.auth?.getUser||!sb?.from)throw Error('Company owner sign-in required.');
  const verify=await sb.auth.getUser();if(verify.error||verify.data?.user?.id!==auth.user.id)throw Error('Owner session not verified.');
  return {sb,id:auth.user.id};
 }
 async function refresh(){if(loading)return;loading=true;const run=++epoch;$('owner552Refresh').disabled=true;
  list.replaceChildren();status.textContent='Verifying owner and company-scoped requests…';
  try{const {sb,id}=await identity();const ownerCompanies=await sb.from('ywi_companies').select('id,name,owner_user_id').order('name').limit(101);
   if(run!==epoch)return;
   if(ownerCompanies.error||!Array.isArray(ownerCompanies.data)||ownerCompanies.data.length>100||
     ownerCompanies.data.some(row=>row.owner_user_id!==id))throw Error('Company ownership was not established.');
   companies=ownerCompanies.data;currentUser=id;const previous=select.value;select.replaceChildren(option('','Select your company'));
   companies.forEach(c=>select.appendChild(option(c.id,c.name)));
   if(companies.some(c=>c.id===previous))select.value=previous;else if(companies.length===1)select.value=companies[0].id;
   const companyId=select.value;
   if(!companies.some(c=>c.id===companyId)){status.textContent='Select an owner-owned company, then refresh.';return;}
   const publishing=await sb.from('ywi_company_booking_public_settings_552').select('company_id,public_enabled')
    .eq('company_id',companyId).limit(1);
   if(publishing.error||!Array.isArray(publishing.data)||publishing.data.length>1||
     publishing.data.some(row=>row.company_id!==companyId))throw Error('Public publishing state could not be verified.');
   publishingRowExists=publishing.data.length===1;
   publicEnabled=publishing.data[0]?.public_enabled===true;
   $('owner552Access').textContent=publicEnabled?'Disable public requests':'Enable public requests';
   const rows=await sb.from('ywi_landscape_booking_requests_552').select('id,company_id,request_status,full_name,contact_value,preferred_contact_method,service_area,requested_date,estimated_subtotal_cents,estimated_disposal_cents,quotation_snapshot,created_at')
    .eq('company_id',companyId).order('created_at',{ascending:false}).limit(40);
   const now=window.YWI_AUTH?.getState?.();if(run!==epoch||now?.user?.id!==id||now?.isAuthenticated!==true||select.value!==companyId)throw Error('Owner session or company changed.');
   if(rows.error||!Array.isArray(rows.data)||rows.data.length>40||rows.data.some(row=>row.company_id!==companyId))throw Error('Private request table unavailable or denied.');
   status.textContent=rows.data.length+' company-scoped requests loaded (newest 40 maximum). Public intake: '+(publicEnabled?'ENABLED':'OFF')+'.';
   if(!rows.data.length)list.appendChild(el('p','No requests returned for this verified company.'));
   for(const row of rows.data){const card=el('article');card.className='notice';card.style.cssText='margin:8px 0;overflow-wrap:anywhere';
    card.appendChild(el('strong',row.full_name+' · '+row.request_status));
    card.appendChild(el('p',`Contact: ${row.contact_value} (${row.preferred_contact_method}) · Area: ${row.service_area}`));
    card.appendChild(el('p',`Requested date: ${row.requested_date||'not specified'} · Estimated CAD pre-tax: ${cad(row.estimated_subtotal_cents)} · Disposal estimate: ${cad(row.estimated_disposal_cents)}`));
    const lines=el('ul');for(const item of (row.quotation_snapshot?.lines||[]).slice(0,15))lines.appendChild(el('li',`${item.name} · ${item.quantity} × ${cad(item.unit_price_cents)}`));
    card.appendChild(lines);list.appendChild(card);
   }
  }catch(e){if(run===epoch){list.replaceChildren();status.textContent='WITHHELD: '+(e?.message||e);}}
  finally{if(run===epoch){loading=false;$('owner552Refresh').disabled=false;}}
 }
 $('owner552Refresh').addEventListener('click',refresh);
 select.addEventListener('change',()=>{list.replaceChildren();publicEnabled=false;publishingRowExists=false;currentUser='';
  status.textContent='Company changed. Refresh to verify and load requests.';$('owner552LinkText').replaceChildren();});
 $('owner552Access').addEventListener('click',async()=>{try{const {id,sb}=await identity();
  if(id!==currentUser||!companies.some(c=>c.id===select.value))throw Error('Refresh and verify owner companies first.');
  const enable=!publicEnabled;
  if(!window.confirm('Do you want to '+(enable?'ENABLE public service prices and quote requests':'DISABLE new public quote requests')+' for this company?'))return;
  const companyId=select.value;
  // RLS grants INSERT(company_id,public_enabled) and UPDATE(public_enabled) only.
  // A generic upsert may require UPDATE(company_id), which we intentionally withhold.
  const result=enable&&!publishingRowExists?
   await sb.from('ywi_company_booking_public_settings_552').insert({company_id:companyId,public_enabled:true}).select('company_id,public_enabled'):
   await sb.from('ywi_company_booking_public_settings_552').update({public_enabled:enable}).eq('company_id',companyId).select('company_id,public_enabled');
  const now=window.YWI_AUTH?.getState?.();if(now?.isAuthenticated!==true||now.user?.id!==id||select.value!==companyId)throw Error('Owner session changed during publishing.');
  if(result.error||result.data?.length!==1||result.data[0].company_id!==companyId||result.data[0].public_enabled!==enable)throw Error('Publishing change was not verified by the database.');
  publicEnabled=enable;publishingRowExists=true;$('owner552Access').textContent=enable?'Disable public requests':'Enable public requests';
  $('owner552LinkText').replaceChildren();status.textContent='Public quote requests '+(enable?'ENABLED':'DISABLED')+' for this verified company. No booking or payment was created.';
 }catch(e){status.textContent='WITHHELD: '+(e?.message||e);}});
 $('owner552Link').addEventListener('click',async()=>{try{const {id}=await identity();
  if(id!==currentUser||!companies.some(c=>c.id===select.value))throw Error('Refresh owner companies first.');
  if(!publicEnabled)throw Error('Enable public requests explicitly before sharing a company link.');
  const url=new URL(location.origin+location.pathname);url.searchParams.set('booking_company',select.value);url.hash='landscaping-quote-552';
  $('owner552LinkText').replaceChildren(el('p','Share this company-specific public request link: '),el('code',url.toString()));
 }catch(e){status.textContent='WITHHELD: '+(e?.message||e);}});
 document.addEventListener('ywi:auth-changed',()=>{epoch++;companies=[];currentUser='';publicEnabled=false;publishingRowExists=false;list.replaceChildren();select.replaceChildren();$('owner552LinkText').replaceChildren();status.textContent='Session changed. Refresh to reverify company ownership.';});
}
function mount(){mountPublic();mountOwner();}
window.YWI552=Object.freeze({mountPublic,mountOwner});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
