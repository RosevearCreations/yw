/* YW 551 — company-owned pricing catalogue, not a booking, payment or disposal receipt.
   Supabase RLS is authoritative; the browser fails closed on identity/tenant mismatches. */
(()=>{'use strict';
const TABLE='ywi_company_booking_catalogue_551';
const types=['service','addon','disposal'], seasons=['spring','summer','fall','winter'];
const units=['visit','hour','square_metre','cubic_yard','bag','load','item'];
const columns=['id','company_id','code','item_type','name','description','unit','base_price_cents',
 ...seasons.map(s=>s+'_price_cents'),'active','created_at','updated_at'];
const $=id=>document.getElementById(id);
const element=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;};
function cents(value,optional=false){
 const s=String(value??'').trim();if(optional&&s==='')return null;
 if(!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(s))throw Error('Enter a CAD price from 0 to 1,000,000 with at most two decimals');
 const [whole,fraction='']=s.split('.');const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(result)||result>100000000)throw Error('Price exceeds the allowed range');
 return result;
}
const dollars=c=>c==null?'':(c/100).toFixed(2);
const money=c=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(c/100);
function priceFor(row,season){const seasonal=row[season+'_price_cents'];return seasonal==null?row.base_price_cents:seasonal;}
function verifiedRows(rows,companyId){
 if(!Array.isArray(rows)||rows.length>100)throw Error('Catalogue read incomplete');
 const seen=new Set();
 for(const r of rows){
  if(r.company_id!==companyId||!r.id||!r.code||seen.has(r.code)||!types.includes(r.item_type)||
    !units.includes(r.unit)||typeof r.active!=='boolean'||!Number.isInteger(r.base_price_cents)||
    r.base_price_cents<0||r.base_price_cents>100000000||seasons.some(s=>
     r[s+'_price_cents']!==null&&r[s+'_price_cents']!==undefined&&
     (!Number.isInteger(r[s+'_price_cents'])||r[s+'_price_cents']<0||r[s+'_price_cents']>100000000)))
   throw Error('Catalogue tenant or pricing evidence invalid');
  seen.add(r.code);
 }
 return rows;
}
async function owner(){
 const sb=window.YWI_SB||window._sb;const auth=window.YWI_AUTH?.getState?.();
 if(auth?.isAuthenticated!==true||!auth.user?.id||!sb?.from||!sb.auth?.getUser)throw Error('Owner sign-in required');
 const r=await sb.auth.getUser();
 if(r.error||r.data?.user?.id!==auth.user.id)throw Error('Verified owner identity unavailable');
 return {sb,uid:auth.user.id};
}
function mount(){
 const host=$('settings');if(!host||$('owner551'))return;
 const panel=element('details');panel.id='owner551';panel.className='admin-hub-detail';
 panel.style.cssText='min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere';
 panel.appendChild(element('summary','Landscaping · Services, Add-Ons & Seasonal Pricing'));
 const body=element('div');body.className='admin-panel-block';
 body.appendChild(element('p','Company-owner pricing catalogue. Disposal and dump fees are estimates only, not proof of disposal. A price preview does not create a booking, invoice or payment. All prices are CAD before tax.'));
 const row=element('div');row.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap';
 const company=element('select');company.id='owner551Company';company.setAttribute('aria-label','Company');
 const refresh=element('button','Refresh catalogue');refresh.type='button';refresh.id='owner551Refresh';
 const status=element('p','Sign in to load owner companies.');status.id='owner551Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 row.append(company,refresh);body.append(row,status);
 const form=element('form');form.id='owner551Form';form.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;max-width:100%';
 function field(label,type='text',opts={}){
  const wrap=element('label');wrap.style.cssText='display:grid;gap:4px;min-width:0';wrap.appendChild(element('span',label));
  const input=element(type==='select'?'select':'input');input.id='owner551'+opts.id;
  if(type==='select'){for(const v of opts.options){const o=element('option',v.replaceAll('_',' '));o.value=v;input.appendChild(o);}}
  else {input.type=type;input.placeholder=opts.placeholder||'';if(opts.maxLength)input.maxLength=opts.maxLength;}
  input.style.cssText='min-width:0;max-width:100%;box-sizing:border-box';wrap.appendChild(input);form.appendChild(wrap);return input;
 }
 const code=field('Item code (fixed after creation)','text',{id:'Code',maxLength:40,placeholder:'lawn-mow'});
 const name=field('Service or add-on name','text',{id:'Name',maxLength:120});
 const type=field('Kind','select',{id:'Type',options:types});
 const unit=field('Price per','select',{id:'Unit',options:units});
 const desc=field('Short description','text',{id:'Description',maxLength:500});
 const base=field('Base price (CAD)','text',{id:'Base',placeholder:'75.00'});
 const seasonal={};for(const s of seasons)seasonal[s]=field(s+' override (CAD, optional)','text',{id:s,placeholder:'Uses base price'});
 const activeWrap=element('label');activeWrap.style.cssText='display:flex;gap:8px;align-items:center';
 const active=element('input');active.type='checkbox';active.id='owner551Active';activeWrap.append(active,element('span','Active in company catalogue'));form.appendChild(activeWrap);
 const save=element('button','Save item');save.type='submit';save.id='owner551Save';form.appendChild(save);
 const clear=element('button','New item');clear.type='button';clear.id='owner551New';form.appendChild(clear);
 body.appendChild(form);
 const listing=element('div');listing.id='owner551Listing';body.appendChild(listing);
 const preview=element('section');preview.id='owner551Preview';preview.appendChild(element('h3','Illustrative booking price preview'));
 const seasonSelect=element('select');seasonSelect.id='owner551Season';seasonSelect.setAttribute('aria-label','Pricing season');
 for(const s of seasons){const option=element('option',s);option.value=s;seasonSelect.appendChild(option);}
 const previewRows=element('div');previewRows.id='owner551PreviewItems';
 const total=element('p','No items selected.');total.id='owner551Total';total.setAttribute('aria-live','polite');
 preview.append(seasonSelect,previewRows,total);body.appendChild(preview);panel.appendChild(body);host.appendChild(panel);
 let epoch=0,ctx=null,items=[],selected=null,busy=false,landscapeOn=false;
 const notice=msg=>{status.textContent=msg;};
 const resetForm=()=>{form.reset();selected=null;code.disabled=false;type.disabled=false;save.textContent='Save item';};
 const current=(run,uid)=>{const a=window.YWI_AUTH?.getState?.();
  if(run!==epoch||a?.isAuthenticated!==true||a.user?.id!==uid)throw Error('Owner session changed');};
 const option=(value,text)=>{const o=element('option',text);o.value=value;return o;};
 function render(){
  const priorQuantities=new Map([...previewRows.querySelectorAll('[data-owner551-quantity]')]
   .map(input=>[input.dataset.owner551Quantity,input.value]));
  listing.replaceChildren();previewRows.replaceChildren();
  listing.appendChild(element('h3','Saved catalogue ('+items.length+')'));
  if(!items.length)listing.appendChild(element('p','No items configured for this company.'));
  const list=element('ul');list.style.cssText='display:grid;gap:8px;padding-left:24px';
  for(const item of items){
   const li=element('li');li.appendChild(element('strong',item.name+' — '+money(item.base_price_cents)+' / '+item.unit));
   li.appendChild(element('span',' · '+item.item_type+' · '+(item.active?'active':'inactive')));
   const edit=element('button','Edit');edit.type='button';edit.className='secondary';edit.dataset.owner551Edit=item.code;
   edit.addEventListener('click',()=>{selected=item;code.value=item.code;code.disabled=true;name.value=item.name;
    type.value=item.item_type;type.disabled=true;unit.value=item.unit;desc.value=item.description||'';
    base.value=dollars(item.base_price_cents);for(const s of seasons)seasonal[s].value=dollars(item[s+'_price_cents']);
    active.checked=item.active;save.textContent='Update item';});
   li.append(' ',edit);list.appendChild(li);
  }
  listing.appendChild(list);
  if(!landscapeOn){previewRows.appendChild(element('p','Landscaping is DISABLED for this company. The catalogue remains an owner draft; booking previews are withheld.'));total.textContent='No bookable items.';return;}
  const allowed=items.filter(i=>i.active);
  if(!allowed.length){previewRows.appendChild(element('p','No active catalogue items.'));total.textContent='No items selected.';return;}
  for(const item of allowed){
   const label=element('label');label.style.cssText='display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:7px 0';
   label.appendChild(element('span',item.name+' ('+item.item_type+', '+money(priceFor(item,seasonSelect.value))+' / '+item.unit+')'));
   const qty=element('input');qty.type='number';qty.min='0';qty.max='1000';qty.step='1';qty.value=priorQuantities.get(item.code)??'0';qty.dataset.owner551Quantity=item.code;qty.setAttribute('aria-label','Quantity for '+item.name);
   qty.style.cssText='width:90px;max-width:100%';qty.addEventListener('input',calculate);label.appendChild(qty);previewRows.appendChild(label);
  }
  calculate();
 }
 function calculate(){
  let sum=0,disposal=0,selectedCount=0;
  for(const input of previewRows.querySelectorAll('[data-owner551-quantity]')){
   const item=items.find(i=>i.code===input.dataset.owner551Quantity);
   if(!item||!item.active)continue;
   const qty=Number(input.value);if(!Number.isSafeInteger(qty)||qty<0||qty>1000){total.textContent='Enter whole quantities between 0 and 1,000.';return;}
   const amount=priceFor(item,seasonSelect.value)*qty;sum+=amount;if(item.item_type==='disposal')disposal+=amount;
   if(qty)selectedCount++;
  }
  total.textContent=selectedCount?('Illustrative subtotal: '+money(sum)+' (including estimated disposal/dump fees: '+money(disposal)+'). Tax, availability and final scope are not included. No booking or payment created.'):'No items selected. No booking or payment created.';
 }
 async function refreshAll(){
  if(busy)return;busy=true;refresh.disabled=true;save.disabled=true;const run=++epoch;
  ctx=null;items=[];selected=null;listing.replaceChildren();previewRows.replaceChildren();total.textContent='No items selected.';
  notice('Verifying company owner and pricing catalogue…');
  try{
   const {sb,uid}=await owner();current(run,uid);
   const r=await sb.from('ywi_companies').select('id,name,owner_user_id').order('name',{ascending:true}).limit(101);
   current(run,uid);if(r.error||!Array.isArray(r.data)||r.data.length>100||r.data.some(c=>c.owner_user_id!==uid||!c.id))throw Error('Company ownership could not be confirmed');
   const prior=company.value;company.replaceChildren(option('','Select a company'));
   for(const c of r.data)company.appendChild(option(c.id,c.name));
   if(r.data.some(c=>c.id===prior))company.value=prior;
   else if(r.data.length===1)company.value=r.data[0].id;
   ctx={sb,uid,companies:r.data};resetForm();
   if(company.value)await readCompany(run,ctx);
   else notice(r.data.length?'Select an owner-owned company.':'No owner-owned companies. Create one in My Companies first.');
  }catch(e){if(run===epoch){company.replaceChildren();listing.replaceChildren();ctx=null;notice('WITHHELD: '+(e?.message||e));}}
  finally{if(run===epoch){busy=false;refresh.disabled=false;save.disabled=false;}}
 }
 async function readCompany(run,auth){
  const id=company.value;if(!auth.companies.some(c=>c.id===id))throw Error('Unverified company selection');
  const module=await auth.sb.from('ywi_company_service_modules').select('company_id,module_key,enabled').eq('company_id',id).eq('module_key','landscape').limit(2);
  current(run,auth.uid);if(company.value!==id)throw Error('Company selection changed during read');
  if(module.error||module.data?.length!==1||module.data[0].company_id!==id||module.data[0].module_key!=='landscape'||typeof module.data[0].enabled!=='boolean')throw Error('Landscape offering authority unavailable');
  landscapeOn=module.data[0].enabled;
  const r=await auth.sb.from(TABLE).select(columns.join(',')).eq('company_id',id).order('name',{ascending:true}).limit(101);
  current(run,auth.uid);if(company.value!==id)throw Error('Company selection changed during read');
  if(r.error)throw Error('Catalogue schema missing or owner read denied');
  items=verifiedRows(r.data,id);resetForm();render();
  notice(items.length+' owner-scoped entries loaded. '+(landscapeOn?'Landscaping enabled for this company.':'Landscaping disabled: configuration is draft-only.'));
 }
 async function changeCompany(){if(busy||!ctx)return;busy=true;save.disabled=true;const run=++epoch;
  try{const verified=await owner();if(verified.uid!==ctx.uid)throw Error('Owner identity changed');
   current(run,ctx.uid);await readCompany(run,ctx);
  }catch(e){if(run===epoch){items=[];render();notice('WITHHELD: '+(e?.message||e));}}
  finally{if(run===epoch){busy=false;save.disabled=false;}}
 }
 async function saveItem(event){event.preventDefault();if(busy)return;
  const id=company.value;if(!ctx?.companies.some(c=>c.id===id)){notice('WITHHELD: Choose a verified owner company.');return;}
  let payload;
  try{
   if(!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(code.value))throw Error('Code must have 2–40 lowercase letters, numbers, - or _');
   if(name.value.trim().length<2||name.value.trim().length>120)throw Error('Name must have 2–120 characters');
   if(!types.includes(type.value)||!units.includes(unit.value))throw Error('Invalid type or price unit');
   payload={name:name.value.trim(),description:desc.value.trim(),unit:unit.value,base_price_cents:cents(base.value),active:active.checked};
   for(const s of seasons)payload[s+'_price_cents']=cents(seasonal[s].value,true);
   if(!selected){if(items.some(i=>i.code===code.value))throw Error('Item code already exists');
    Object.assign(payload,{company_id:id,code:code.value,item_type:type.value});}
  }catch(e){notice('WITHHELD: '+e.message);return;}
  busy=true;save.disabled=true;refresh.disabled=true;const run=epoch;
  try{
   const auth=await owner();current(run,auth.uid);if(ctx.uid!==auth.uid)throw Error('Owner identity changed');
   const q=selected?auth.sb.from(TABLE).update(payload).eq('company_id',id).eq('id',selected.id)
    .eq('updated_at',selected.updated_at).select(columns.join(',')):
    auth.sb.from(TABLE).insert(payload).select(columns.join(','));
   const result=await q;current(run,auth.uid);
   if(result.error||result.data?.length!==1||result.data[0].company_id!==id||result.data[0].code!==code.value)throw Error('Save was not confirmed by the company database; refresh to reconcile');
   busy=false;notice('Owner item saved. Reading authoritative catalogue…');
   await changeCompany();
  }catch(e){if(run===epoch){notice('WITHHELD: '+(e?.message||e));save.disabled=false;refresh.disabled=false;}}
  finally{if(run===epoch){busy=false;save.disabled=false;refresh.disabled=false;}}
 }
 refresh.addEventListener('click',refreshAll);company.addEventListener('change',changeCompany);
 form.addEventListener('submit',saveItem);clear.addEventListener('click',resetForm);
 seasonSelect.addEventListener('change',render);
 document.addEventListener('ywi:auth-changed',()=>{epoch++;busy=false;ctx=null;items=[];company.replaceChildren();listing.replaceChildren();previewRows.replaceChildren();resetForm();notice('Session changed. Refresh under verified owner identity.');});
 document.addEventListener('ywi:company-service-offering-changed',()=>{if(ctx&&!busy)changeCompany();});
}
window.YWI551=Object.freeze({cents,priceFor,verifiedRows});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
