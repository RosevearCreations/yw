/* YW 453: company-private source-labelled cost planning and same-owner comparisons.
 * No raw wages/rates, ledger posting, invoice issue or canonical Jobs mutations. */
(()=>{'use strict';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const categories=Object.freeze(['revenue_plan','workforce_burden','material','equipment','subcontract','overhead']);
const statuses=Object.freeze(['draft','for_review','disputed']);
const money=n=>Number.isSafeInteger(n)?new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n/100):'unverified';
const withheld=reason=>({state:'withheld',reason,orders:[],lines:[]});
const source=x=>typeof x==='string'&&x.trim().length>=3&&x.length<=160;
function projection(lines){
 const replaced=new Set(lines.filter(x=>x.correction_of).map(x=>x.correction_of));
 const included=lines.filter(x=>x.report_status==='for_review'&&!replaced.has(x.id));
 const revenue=included.filter(x=>x.category==='revenue_plan').reduce((n,x)=>n+x.amount_cents,0);
 const cost=included.filter(x=>x.category!=='revenue_plan').reduce((n,x)=>n+x.amount_cents,0);
 return{currency:'CAD',revenue_cents:revenue,cost_cents:cost,difference_cents:revenue-cost,included_count:included.length};
}
function inspect(s,{companyId,now=Date.now(),allowed=false}={}){
 const t=Date.parse(s?.captured_at);
 if(!uuid(companyId)||!allowed||s?.company_id!==companyId||
  s.owner_guard!=='ywi_453_assert_cost_scope'||
  JSON.stringify(s.accounting_fields)!==JSON.stringify(['costs','reports'])||
  !Number.isFinite(t)||t>now+60000||now-t>300000||
  !Array.isArray(s.orders)||!Array.isArray(s.lines)||
  s.orders.length!==s.order_count||s.lines.length!==s.line_count||
  s.orders.length>60||s.lines.length>200||
  s.source_kind!=='operator_plan_only'||s.original_438_costs_not_duplicated!==true||
  s.wages_exposed!==false||s.individual_rates_exposed!==false||
  s.payroll_executed!==false||s.ledger_posted!==false||s.verified_profit!==false||
  s.invoice_created!==false||s.cross_company_grant!==false||s.mutation_authorized!==false)
  return withheld('Private finance permissions, complete fresh company records or redaction unverified');
 const orders=new Map(s.orders.map(x=>[x.id,x]));
 const lines=new Map(s.lines.map(x=>[x.id,x]));
 if(orders.size!==s.orders.length||lines.size!==s.lines.length||
  s.orders.some(x=>!uuid(x.id)||x.company_id!==companyId||!uuid(x.client_id)||
   !uuid(x.site_id)||!x.number||typeof x.service!=='string'||!x.status)||
  s.lines.some(x=>!uuid(x.id)||x.company_id!==companyId||!orders.has(x.work_order_id)||
   !categories.includes(x.category)||!statuses.includes(x.report_status)||
   !Number.isSafeInteger(x.amount_cents)||x.amount_cents<0||x.amount_cents>10000000000||
   !source(x.source_reference)||
   (x.correction_of!==null&&(!uuid(x.correction_of)||!lines.has(x.correction_of)||
    lines.get(x.correction_of).work_order_id!==x.work_order_id||
    lines.get(x.correction_of).category!==x.category))||
   !Number.isFinite(Date.parse(x.recorded_at)))||
  new Set(s.lines.filter(x=>x.correction_of).map(x=>x.correction_of)).size!==
   s.lines.filter(x=>x.correction_of).length)
  return withheld('Foreign, duplicate, overlapping or invalid company cost sources');
 const expected=projection(s.lines);
 if(!Number.isSafeInteger(expected.revenue_cents)||!Number.isSafeInteger(expected.cost_cents)||
  !Number.isSafeInteger(expected.difference_cents)||
  Object.keys(expected).some(k=>expected[k]!==s.report?.[k]))
  return withheld('Server report does not reconcile to company-only planning lines');
 return{state:'verified_planning_only',companyId,orders:s.orders,lines:s.lines,report:expected,
  canPay:false,canPost:false,canInvoice:false,wagesVisible:false};
}
function compare(reviews){
 if(!Array.isArray(reviews)||!reviews.length||reviews.length>10||
  reviews.some(x=>x.state!=='verified_planning_only')||
  new Set(reviews.map(x=>x.companyId)).size!==reviews.length)return null;
 const totals=reviews.reduce((a,x)=>({revenue_cents:a.revenue_cents+x.report.revenue_cents,
  cost_cents:a.cost_cents+x.report.cost_cents,
  difference_cents:a.difference_cents+x.report.difference_cents}),
 {revenue_cents:0,cost_cents:0,difference_cents:0});
 return Object.values(totals).every(Number.isSafeInteger)?totals:null;
}
window.YWI453=Object.freeze({categories,statuses,inspect,compare,projection,money});
const el=(tag,value)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);return x};
const field=(parent,tag,label,id,max)=>{const l=el('label',label),f=el(tag);f.id=id;if(max)f.maxLength=max;l.append(f);parent.append(l);return f};
const button=(parent,id,label)=>{const b=el('button',label);b.id=id;b.type='button';b.className='secondary';parent.append(b);return b};
const options=(node,items,label,empty)=>{const old=node.value;node.replaceChildren();const first=el('option',empty);first.value='';node.append(first);
 for(const x of items){const o=el('option',label(x));o.value=x.id;node.append(o)}
 node.value=items.some(x=>x.id===old)?old:'';};
const cents=value=>{const m=/^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(String(value).trim());
 if(!m)throw Error('Enter CAD dollars with no more than two decimal places');
 const n=Number(m[1])*100+Number((m[2]||'').padEnd(2,'0'));
 if(!Number.isSafeInteger(n)||n>10000000000)throw Error('Cost amount exceeds limit');return n;};
async function session(){const s=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
 if(s?.isAuthenticated!==true||!uuid(s.user?.id)||!sb?.auth?.getUser||!sb?.rpc||!sb?.from||
  !window.YWISecurity?.canViewModule?.('admin',s.role,'manage')||
  !window.YWISecurity?.canViewModule?.('finance',s.role,'manage')||
  !window.YWISecurity?.canViewModule?.('jobs',s.role,'view'))
  throw Error('Company ownership and independent Admin/Finance manage + Jobs view required');
 const identity=await sb.auth.getUser();if(identity.error||identity.data?.user?.id!==s.user.id)
  throw Error('Owner identity mismatch');return{sb,uid:s.user.id};}
async function rpc(sb,name,args){const r=await sb.rpc(name,args);if(r.error||r.data==null)
 throw Error(r.error?.message||'Private report denied');return r.data;}
function mount(){const root=document.getElementById('admin');if(!root||document.getElementById('owner453JobCost'))return;
 const panel=el('details');panel.id='owner453JobCost';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · Company Job Cost & Profitability';panel.dataset.adminHubGroups='management finance jobs';
 panel.append(el('summary','453 · Multi-Company Job Cost & Profitability Planning'));
 const body=el('div');body.className='admin-panel-block';body.append(el('p',
  'Owner-only CAD planning sources for original Jobs. Workforce burden is an aggregate only; no employee wage/rate records. All figures are UNVERIFIED and exclude the independent original 438 cost proof to prevent double counting.'));
 const help=el('a','ⓘ Company job-cost help');help.href='/help.html#pms-company-job-cost-453';body.append(help);
 const grid=el('div');grid.className='pms-finance-grid';const company=field(grid,'select','Verified owner company','pms453Company');body.append(grid);
 const actions=el('div');actions.className='pms-finance-actions';
 const refresh=button(actions,'pms453Refresh','Verify company / comparison');body.append(actions);
 const status=el('p','Sign in as a company owner with Accounting Costs + Reports enabled.');status.id='pms453Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
 const summary=el('div');summary.id='pms453Summary';summary.className='pms-finance-cards';body.append(summary);
 const portfolio=el('div');portfolio.id='pms453Portfolio';portfolio.className='pms-finance-cards';body.append(portfolio);
 const history=el('div');history.id='pms453History';history.className='pms-finance-cards';body.append(history);
 const form=el('details');form.id='pms453EntryPanel';form.append(el('summary','Append source-backed planning amount / correction'));
 const fg=el('div');fg.className='pms-finance-grid';
 const order=field(fg,'select','Original company Jobs work order','pms453Order');
 const category=field(fg,'select','Reported cost or projected revenue category','pms453Category');
 for(const key of categories){const o=el('option',key.replaceAll('_',' '));o.value=key;category.append(o)}
 const amount=field(fg,'input','CAD amount (source-labelled, not paid)','pms453Amount');amount.inputMode='decimal';amount.placeholder='125.00';
 const state=field(fg,'select','Review state','pms453State');for(const key of statuses){const o=el('option',key.replaceAll('_',' '));o.value=key;state.append(o)}
 const correction=field(fg,'select','Replace earlier same-company/order/category entry (optional)','pms453Correction');
 const sourceRef=field(fg,'input','Original evidence/source reference','pms453Source',160);
 const note=field(fg,'textarea','Notes (no names, wages, SINs or banking data)','pms453Notes',500);
 form.append(fg);const append=button(form,'pms453Append','Save UNPOSTED planning entry');body.append(form);
 panel.append(body);root.append(panel);
 let identity=null,epoch=0,busy=false,companies=[],reviews=new Map();
 const alive=(uid,e)=>e===epoch&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===uid;
 const clear=()=>{reviews.clear();summary.replaceChildren();portfolio.replaceChildren();history.replaceChildren();order.replaceChildren();correction.replaceChildren();};
 const valid=()=>reviews.get(company.value)?.state==='verified_planning_only'&&companies.some(x=>x.id===company.value)&&identity===window.YWI_AUTH?.getState?.()?.user?.id;
 function render(){summary.replaceChildren();portfolio.replaceChildren();history.replaceChildren();
  const current=reviews.get(company.value);
  if(!valid()){status.textContent='WITHHELD: original company reporting scope not verified';return;}
  const r=current.report;status.textContent='VERIFIED OWNERSHIP · unposted planning only · '+current.orders.length+' original Jobs / '+current.lines.length+' source records';
  summary.append(el('p','Selected company · projected revenue '+money(r.revenue_cents)+' / allocated cost '+money(r.cost_cents)+
   ' / unverified difference '+money(r.difference_cents)+' · '+r.included_count+' reviewed planning entries'));
  const all=[...reviews.values()];const totals=all.length===companies.length?compare(all):null;
  if(totals){portfolio.append(el('strong','Same-owner company comparison · '+companies.length+' verified companies (not consolidated books)'));
   for(const x of companies){const rec=reviews.get(x.id);portfolio.append(el('p',x.name+' · revenue '+money(rec.report.revenue_cents)+
    ' · cost '+money(rec.report.cost_cents)+' · difference '+money(rec.report.difference_cents)));}
   portfolio.append(el('p','Combined planning totals · '+money(totals.revenue_cents)+' revenue / '+
    money(totals.cost_cents)+' cost / '+money(totals.difference_cents)+' difference'));}
  else portfolio.append(el('p','Cross-company comparison HOLD: not every original company verified Accounting Costs + Reports.'));
  options(order,current.orders,x=>x.number+' · '+x.service,'Choose original work order');
  const active=new Set(current.lines.filter(x=>x.correction_of).map(x=>x.correction_of));
  options(correction,current.lines.filter(x=>!active.has(x.id)&&x.work_order_id===order.value&&x.category===category.value),
   x=>x.category+' · '+money(x.amount_cents)+' · '+x.source_reference,'New entry, not correction');
  for(const x of current.lines){const row=el('article');row.className='notice';row.dataset.pms453Line=x.id;
   const wo=current.orders.find(w=>w.id===x.work_order_id);
   row.append(el('strong',wo.number+' · '+x.category.replaceAll('_',' ')+' · '+money(x.amount_cents)));
   row.append(el('p',x.report_status+' · '+x.source_reference+(x.correction_of?' · correction of '+x.correction_of:'')));
   history.append(row)}
  if(!current.lines.length)history.append(el('p','No company planning entries. Nothing is posted or verified as profit.'));
 }
 async function load(){const e=epoch,ctx=await session();if(!alive(ctx.uid,e))throw Error('Owner session changed');
  const result=await ctx.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(11);
  const list=result.data;if(result.error||!Array.isArray(list)||list.length>10||
   new Set(list.map(x=>x.id)).size!==list.length||list.some(x=>!uuid(x.id)||!x.name||x.owner_user_id!==ctx.uid)||
   !alive(ctx.uid,e))throw Error('Original owner company roster denied or exceeds bounded comparison');
  identity=ctx.uid;companies=list;options(company,list,x=>x.name,'Choose verified owner company');
  if(!company.value&&list.length)company.value=list[0].id;
  clear();
  if(!list.length){status.textContent='HOLD: no registered real owner company; Yard Rosevear is a test fixture only.';return;}
  for(const x of list){try{const raw=await rpc(ctx.sb,'ywi_rpc_pms_job_cost_snapshot_453',{p_company_id:x.id});
    if(!alive(ctx.uid,e))throw Error('Owner session changed');
    reviews.set(x.id,inspect(raw,{companyId:x.id,allowed:true}));}
   catch(err){reviews.set(x.id,withheld(err?.message||String(err)));}}
  render();}
 async function run(fn){if(busy)return;busy=true;refresh.disabled=append.disabled=true;
  try{await fn()}catch(e){clear();status.textContent='WITHHELD: '+(e?.message||String(e));}
  finally{busy=false;refresh.disabled=append.disabled=false;}}
 refresh.onclick=()=>run(load);
 company.onchange=()=>{render();};
 order.onchange=()=>render();category.onchange=()=>render();
 append.onclick=()=>run(async()=>{if(!valid())throw Error('Company report or Account Costs/Reports not verified');
  const current=reviews.get(company.value),wo=current.orders.find(x=>x.id===order.value);
  if(!wo||!categories.includes(category.value)||!statuses.includes(state.value)||!source(sourceRef.value))
   throw Error('Choose original order, category, review state and source label');
  const amountCents=cents(amount.value);const old=correction.value;
  if(old&&!current.lines.some(x=>x.id===old&&x.work_order_id===wo.id&&x.category===category.value))
   throw Error('Correction source changed');
  const ctx=await session();if(identity!==ctx.uid)throw Error('Owner changed');
  if(!window.confirm('Append an unposted cost/revenue PLANNING claim? It will not change the original Job, payroll, invoices or GL.'))return;
  const nonce=window.crypto?.randomUUID?.();if(!uuid(nonce))throw Error('Secure request ID required');
  await rpc(ctx.sb,'ywi_rpc_pms_job_cost_append_453',{p_company_id:company.value,
   p_work_order_id:wo.id,p_request_id:nonce,p_category:category.value,p_amount_cents:amountCents,
   p_source_reference:sourceRef.value.trim(),p_status:state.value,p_correction_of:old||null,
   p_notes:note.value.trim()||null});
  await load();status.textContent='Append-only planning source recorded; it is NOT posted or verified profit.';});
 document.addEventListener('ywi:auth-changed',()=>{epoch++;identity=null;companies=[];clear();status.textContent='Identity changed; all private financial comparisons cleared.'});
 document.addEventListener('ywi:module-permissions-changed',()=>{epoch++;identity=null;companies=[];clear();status.textContent='Permissions changed; financial reports need re-verification.'});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
