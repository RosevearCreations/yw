/* PMS 447 — owner-controlled, OFF-by-default Accounting Shell.
 * Review-only A/R, A/P, costs, GL/tax notes, reports and payroll field access.
 * No posting, invoice creation, payments, bank disclosure or tax filing. */
(()=>{'use strict';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const scopes=['receivables','payables','costs','reports','payroll_reference'];
const categories=Object.freeze({receivable:'receivables',payable:'payables',job_cost:'costs',ledger_note:'reports',tax_note:'reports'});
const labels=Object.freeze({receivables:'A/R · Receivables',payables:'A/P · Payables',costs:'Job Costs',
 reports:'GL, Tax & Reports',payroll_reference:'Private Payroll Readiness'});
const withheld=reason=>({state:'withheld',reason,drafts:[],enabled:false,access:{}});
function inspect(source,{companyId,allowed=false,now=Date.now()}={}){
 const t=Date.parse(source?.captured_at);const a=source?.access;
 if(!uuid(companyId)||!allowed||source?.company_id!==companyId||
  source.owner_guard!=='ywi_447_assert_accounting_owner'||!Number.isFinite(t)||t>now+60000||now-t>300000||
  typeof source.enabled!=='boolean'||!a||scopes.some(k=>typeof a[k]!=='boolean')||a.bank!==false||
  !Array.isArray(source.drafts)||source.draft_count!==source.drafts.length||source.drafts.length>200||
  source.ledger_posted!==false||source.payment_executed!==false||source.invoices_created!==false||
  source.tax_filing_available!==false||source.mutation_authorized!==false||
  (!source.enabled&&(source.drafts.length>0||scopes.some(k=>a[k]))))
  return withheld('Company accounting configuration, field access, RLS source or freshness unverified');
 const ids=new Set(source.drafts.map(x=>x.id));
 if(ids.size!==source.drafts.length||source.drafts.some(x=>!uuid(x.id)||!categories[x.category]||
  !a[categories[x.category]]||!x.title||!x.source_reference||
  !['manual_review','quote_reference','job_reference','external_reference'].includes(x.source_type)||
  !['draft','for_review','blocked'].includes(x.reported_status)||
  !Number.isSafeInteger(x.amount_cents)||x.amount_cents<0||x.amount_cents>10000000000||
  x.currency!=='CAD'||!Number.isFinite(Date.parse(x.created_at))||
  ((x.client_id===null)!==(x.site_id===null))||
  (x.client_id!==null&&(!uuid(x.client_id)||!uuid(x.site_id)))))
  return withheld('Foreign, unpermitted, duplicated or malformed Accounting review line');
 return {state:'verified_accounting_review_only',companyId,enabled:source.enabled,
  access:a,drafts:source.drafts,canPost:false,canPay:false,canFile:false};
}
window.YWI447=Object.freeze({inspect,scopes,categories});
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;};
const money=cents=>Number.isSafeInteger(cents)?'$'+(cents/100).toFixed(2):'unverified';
const parseCents=text=>{const m=/^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(String(text).trim());
 if(!m)throw Error('Enter CAD with at most two decimals');return Number(m[1])*100+Number((m[2]||'').padEnd(2,'0'));};
function field(parent,tag,label,id,len){const l=el('label',label),x=el(tag);x.id=id;if(len)x.maxLength=len;l.append(x);parent.append(l);return x;}
function options(select,rows,label,placeholder){const previous=select.value;select.replaceChildren();const empty=el('option',placeholder);empty.value='';select.append(empty);
 for(const row of rows){const x=el('option',label(row));x.value=row.id;select.append(x);}
 if(rows.some(x=>x.id===previous))select.value=previous;else if(rows.length===1)select.value=rows[0].id;}
async function session(){const a=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
 if(a?.isAuthenticated!==true||!uuid(a.user?.id)||!sb?.auth?.getUser||!sb?.rpc||!sb?.from||
  !window.YWISecurity?.canViewModule?.('admin',a.role,'manage')||
  !window.YWISecurity?.canViewModule?.('finance',a.role,'manage')||
  !window.YWISecurity?.canViewModule?.('jobs',a.role,'view'))
  throw Error('Company owner plus Admin/Finance manage required');
 const r=await sb.auth.getUser();if(r.error||r.data?.user?.id!==a.user.id)throw Error('Owner session mismatch');
 return {uid:a.user.id,sb};}
async function rpc(sb,name,args){const r=await sb.rpc(name,args);if(r.error||r.data===undefined||r.data===null)
 throw Error(r.error?.message||'Missing verified '+name);return r.data;}
const nonce=()=>{const v=window.crypto?.randomUUID?.();if(!uuid(v))throw Error('Secure idempotency key required');return v;};
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('owner447Accounting'))return;
 const panel=el('details');panel.id='owner447Accounting';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · Accounting Shell & Company Financial Access';
 panel.dataset.adminHubGroups='finance management';
 panel.append(el('summary','447 · Property Maintenance System · Accounting & Financial Access'));
 const body=el('div');body.className='admin-panel-block';body.append(el('p',
  'Company-controlled Accounting module and separate A/R, A/P, Job Costs, Reporting and Payroll reference permissions. All amounts are unposted drafts.'));
 const help=el('a','ⓘ Accounting Controls Help');help.href='/help.html#pms-accounting-access-447';body.append(help);
 const grid=el('div');grid.className='pms-finance-grid';const company=field(grid,'select','Verified owner company','pms447Company');body.append(grid);
 const btn=(parent,id,label)=>{const b=el('button',label);b.id=id;b.type='button';b.className='secondary';parent.append(b);return b;};
 const actions=el('div');actions.className='pms-finance-actions';
 const refresh=btn(actions,'pms447Refresh','Verify Accounting scope');
 const toggle=btn(actions,'pms447Toggle','Enable company Accounting');body.append(actions);
 const status=el('p','Accounting is OFF for every company until explicitly enabled.');status.id='pms447Status';status.setAttribute('role','status');body.append(status);
 const permissions=el('details');permissions.id='pms447Permissions';permissions.append(el('summary','Company Financial Access Matrix'));
 permissions.append(el('p','Each financial sub-section needs an explicit company permission. Bank transfers and live posting cannot be enabled here.'));
 const pg=el('div');pg.className='pms-finance-grid';const checkboxes=new Map();
 for(const k of scopes){const label=el('label',labels[k]),x=el('input');x.type='checkbox';x.id='pms447Allow-'+k;label.prepend(x);pg.append(label);checkboxes.set(k,x);}
 permissions.append(pg);const save=btn(permissions,'pms447Save','Save company field permissions');body.append(permissions);
 const overview=el('div');overview.id='pms447Overview';overview.className='pms-finance-cards';body.append(overview);
 const sections=el('div');sections.id='pms447Sections';sections.className='pms-finance-sections';
 const containers=new Map();
 for(const k of scopes){const p=el('details');p.id='pms447Section-'+k;p.append(el('summary',labels[k]));
  const area=el('div');area.className='pms-finance-cards';p.append(area);sections.append(p);containers.set(k,{panel:p,area});}
 body.append(sections);
 const addPanel=el('details');addPanel.id='pms447DraftPanel';addPanel.append(el('summary','Add a non-posting financial review entry'));
 const f=el('div');f.className='pms-finance-grid';
 const category=field(f,'select','Financial category','pms447Category');
 for(const [key,label] of [['receivable','A/R draft'],['payable','A/P draft'],['job_cost','Job cost draft'],
  ['ledger_note','GL reference note'],['tax_note','Tax reference note']]){const o=el('option',label);o.value=key;category.append(o);}
 const title=field(f,'input','Entry title','pms447Title',120);
 const sourceType=field(f,'select','Original evidence type','pms447SourceType');
 for(const key of ['manual_review','quote_reference','job_reference','external_reference']){const o=el('option',key.replaceAll('_',' '));o.value=key;sourceType.append(o);}
 const reference=field(f,'input','Private source reference','pms447Reference',160);
 const amount=field(f,'input','Unposted draft amount CAD','pms447Amount');amount.placeholder='0.00';
 const review=field(f,'select','Review state','pms447Review');
 for(const key of ['draft','for_review','blocked']){const o=el('option',key.replaceAll('_',' '));o.value=key;review.append(o);}
 const customer=field(f,'select','Verified client (optional)','pms447Customer');
 const site=field(f,'select','Verified property (required with client)','pms447Site');
 const notes=field(f,'textarea','Source notes','pms447Notes',500);addPanel.append(f);
 const append=btn(addPanel,'pms447Append','Append non-posting draft');body.append(addPanel);
 panel.append(body);host.append(panel);
 let epoch=0,identity=null,owned=[],clients=[],properties=[],data=null,busy=false;
 const alive=(uid,e)=>epoch===e&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===uid;
 const clear=()=>{data=null;clients=[];properties=[];overview.replaceChildren();customer.replaceChildren();site.replaceChildren();
  for(const entry of containers.values()){entry.panel.hidden=true;entry.area.replaceChildren();}append.disabled=true;};
 const valid=()=>data?.state==='verified_accounting_review_only'&&identity===window.YWI_AUTH?.getState?.()?.user?.id&&owned.some(x=>x.id===company.value);
 function render(){overview.replaceChildren();if(!valid())return;
  toggle.textContent=data.enabled?'Disable company Accounting':'Enable company Accounting';
  status.textContent=data.enabled?'VERIFIED NON-POSTING ACCOUNTING · '+data.drafts.length+' visible drafts; no live GL, bank or tax filing.':
   'Accounting OFF: financial drafts and payroll rates withheld. Enable before assigning independent field scopes.';
  for(const k of scopes)checkboxes.get(k).checked=Boolean(data.access[k]);
  append.disabled=!data.enabled||!data.access[categories[category.value]];
  for(const k of scopes){const {panel:p,area}=containers.get(k);p.hidden=!data.enabled||!data.access[k];area.replaceChildren();
   if(p.hidden)continue;
   if(k==='payroll_reference'){
    area.append(el('p','Payroll is additionally protected by the independent Payroll switch and Finance manage authorization.'));
    const link=btn(area,'pms447OpenPayroll','Open confidential Payroll Readiness');
    link.onclick=()=>{if(!valid()||!data.access.payroll_reference)return;
     const t=document.getElementById('owner446Payroll');if(t?.tagName==='DETAILS'){t.open=true;t.scrollIntoView?.({block:'start',behavior:'smooth'});} };
    continue;
   }
   const items=data.drafts.filter(x=>categories[x.category]===k);
   if(k==='reports'){
    const link=btn(area,'pms447OpenGL','Open double-entry GL, period locks & reconciliation (test mode)');
    link.onclick=()=>{if(!valid()||!data.enabled||!data.access.reports)return;
     const t=document.getElementById('owner448GL');if(t?.tagName==='DETAILS'){
      t.open=true;t.scrollIntoView?.({block:'start',behavior:'smooth'});} };
   }
   area.append(el('p',items.length+' operator-reported drafts. Amounts are not posted to any real ledger.'));
   for(const x of items){const card=el('article');card.className='notice';card.dataset.pms447Draft=x.id;
    card.append(el('strong',x.category+' · '+x.title),
     el('p',money(x.amount_cents)+' CAD · '+x.reported_status+' · non-posting'),
     el('p','Source: '+x.source_type+' · '+x.source_reference));area.append(card);}
  }
  const statusCard=el('article');statusCard.className='notice';statusCard.append(el('strong',data.enabled?'Company Accounting enabled':'Company Accounting disabled'),
   el('p',scopes.filter(k=>data.enabled&&data.access[k]).length+' explicitly enabled review scopes; bank access always denied.'));
  overview.append(statusCard);}
 async function customerSites(ctx,e){properties=[];site.replaceChildren();if(!clients.some(x=>x.id===customer.value))return;
  const history=await rpc(ctx.sb,'ywi_rpc_customer_history_422',{
   p_company_id:company.value,p_client_id:customer.value});
  if(!alive(ctx.uid,e)||history.company_id!==company.value||history.client_id!==customer.value||
   history.legacy_unscoped_excluded!==true||!Array.isArray(history.properties)||history.properties.length>100||
   history.properties.some(x=>!uuid(x.id)||!x.name))throw Error('Accounting property ownership unverified');
  properties=history.properties;options(site,properties,x=>x.name,'Choose linked property');}
 async function load(e){const ctx=await session();if(!alive(ctx.uid,e))throw Error('Owner session changed');
  const r=await ctx.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(!alive(ctx.uid,e)||r.error||!Array.isArray(r.data)||r.data.length>100||
   new Set(r.data.map(x=>x.id)).size!==r.data.length||
   r.data.some(x=>!uuid(x.id)||!x.name||x.owner_user_id!==ctx.uid))throw Error('Owner company roster denied');
  identity=ctx.uid;owned=r.data;options(company,owned,x=>x.name,'Choose owner company');
  if(!owned.some(x=>x.id===company.value)){clear();status.textContent='HOLD: no live company. Yard Rosevear remains synthetic.';return;}
  const snapshot=await rpc(ctx.sb,'ywi_rpc_pms_accounting_snapshot_447',{p_company_id:company.value});
  if(!alive(ctx.uid,e)||snapshot.company_id!==company.value)throw Error('Accounting company boundary changed');
  data=inspect(snapshot,{companyId:company.value,allowed:true});if(data.state!=='verified_accounting_review_only')throw Error(data.reason);
  if(data.enabled){const customers=await rpc(ctx.sb,'ywi_rpc_company_customers_422',{p_company_id:company.value});
   if(!alive(ctx.uid,e)||!Array.isArray(customers)||customers.length>100||
    customers.some(x=>!uuid(x.id)||!x.name))throw Error('Company customer source unverified');
   clients=customers;options(customer,clients,x=>x.name,'No customer link');await customerSites(ctx,e);}
  else {clients=[];properties=[];customer.replaceChildren();site.replaceChildren();}
  render();}
 async function run(action){if(busy)return;busy=true;const e=epoch;refresh.disabled=toggle.disabled=save.disabled=true;
  try{await action(e)}catch(ex){clear();status.textContent='WITHHELD: '+(ex.message||String(ex));}
  finally{busy=false;refresh.disabled=toggle.disabled=save.disabled=false;}}
 refresh.onclick=()=>run(load);company.onchange=()=>{epoch++;clear();run(load)};
 customer.onchange=()=>{epoch++;run(async e=>{const ctx=await session();await customerSites(ctx,e)})};
 async function configure(e,desired){if(!valid())throw Error('Verify company Accounting first');const ctx=await session();
  const enabled=Boolean(desired.enabled);
  if(!window.confirm('Save Accounting '+(enabled?'ON':'OFF')+' and company field access? No payments, ledger or bank authority is granted.'))return;
  const out=await rpc(ctx.sb,'ywi_rpc_pms_accounting_config_447',{
   p_company_id:company.value,p_enabled:enabled,p_receivables:!!desired.receivables,
   p_payables:!!desired.payables,p_costs:!!desired.costs,p_reports:!!desired.reports,
   p_payroll_reference:!!desired.payroll_reference});
  if(!alive(ctx.uid,e)||out.company_id!==company.value||out.enabled!==enabled||
   out.access?.bank!==false||out.payment_executed!==false||out.ledger_posted!==false)
   throw Error('Accounting company permission receipt not verified');await load(e);}
 toggle.onclick=()=>run(e=>configure(e,{...data?.access,enabled:!data?.enabled}));
 save.onclick=()=>run(e=>configure(e,{enabled:!!data?.enabled,
  ...Object.fromEntries(scopes.map(k=>[k,checkboxes.get(k).checked]))}));
 category.onchange=()=>{if(!valid())return;append.disabled=!data.enabled||!data.access[categories[category.value]];};
 append.onclick=()=>run(async e=>{if(!valid()||!data.enabled||!data.access[categories[category.value]])throw Error('Accounting category switch OFF');
  const ctx=await session();const client=customer.value||null,property=site.value||null;
  if((client||property)&&(!clients.some(x=>x.id===client)||!properties.some(x=>x.id===property)))
   throw Error('Optional customer/property link must be canonical and company-owned');
  const args={p_company_id:company.value,p_request_id:nonce(),p_category:category.value,
   p_title:title.value.trim(),p_source_type:sourceType.value,p_source_ref:reference.value.trim(),
   p_amount_cents:parseCents(amount.value),p_status:review.value,p_description:notes.value.trim()||null,
   p_client_id:client,p_site_id:property};
  if(!window.confirm('Append an unposted, non-paying financial review entry?'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_pms_accounting_append_447',args);
  if(!uuid(id)||!alive(ctx.uid,e))throw Error('Accounting draft receipt invalid');
  title.value='';reference.value='';notes.value='';await load(e);
  status.textContent='Company Accounting draft appended. No GL posting, invoice or payment occurred.';});
 const invalidate=()=>{epoch++;clear();company.replaceChildren();identity=null;owned=[];
  status.textContent='Session/permissions changed. Reverify private company Accounting.';};
 document.addEventListener('ywi:auth-changed',invalidate);
 document.addEventListener('ywi:module-permissions-changed',invalidate);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
