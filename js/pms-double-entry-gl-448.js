/* PMS 448 — a company-private simulated double-entry GL and period close.
 * Every RPC remains source-bound. No canonical posting, money, taxes or bank feeds. */
(()=>{'use strict';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const accounts=Object.freeze({'1000':'Cash clearing (simulation)','1100':'Accounts receivable (simulation)',
 '2000':'Accounts payable liability','2100':'Payroll payable liability',
 '2200':'Sales tax payable liability','4000':'Service revenue (simulation)','5000':'Cost of services (simulation)'});
const reviewed=['reviewed_for_simulation','needs_correction','rejected'];
const month=x=>typeof x==='string'&&/^\d{4}-\d{2}-01$/.test(x)&&!Number.isNaN(Date.parse(x));
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x));
const fresh=(source,now)=>{const time=Date.parse(source?.captured_at);return Number.isFinite(time)&&time<=now+60000&&now-time<=300000};
const withheld=reason=>({state:'withheld',reason,enabled:false,periods:[],journals:[],accounts:[]});
const money=c=>Number.isSafeInteger(c)?'$'+(c/100).toFixed(2):'unverified';
function inspect(source,{companyId,now=Date.now(),allowed=false}={}){
 if(!uuid(companyId)||!allowed||source?.company_id!==companyId||!fresh(source,now)||
  source.owner_guard!=='ywi_448_assert_gl_owner'||typeof source.enabled!=='boolean'||
  source.test_mode!==true||source.posting_available!==false||source.bank_access!==false||
  source.tax_filing_available!==false||source.real_balance_changed!==false||
  !Array.isArray(source.periods)||source.periods.length>24||
  !Array.isArray(source.journals)||source.journals.length>100||
  !Array.isArray(source.accounts)||source.accounts.length>7||
  source.period_count!==source.periods.length||source.journal_count!==source.journals.length||
  !Number.isSafeInteger(source.total_debits_cents)||!Number.isSafeInteger(source.total_credits_cents)||
  (!source.enabled&&(source.periods.length||source.journals.length||source.accounts.length||
    source.total_debits_cents!==0||source.total_credits_cents!==0)))
  return withheld('Company, independent GL switch, source freshness or no-posting guarantee unverified');
 const ps=new Set(),ids=new Set(),reversed=new Set(),nets=new Map();let allDebit=0,allCredit=0;
 for(const p of source.periods){if(!month(p.period_start)||typeof p.locked!=='boolean'||ps.has(p.period_start))
  return withheld('Unknown or duplicated company accounting period');ps.add(p.period_start);}
 for(const j of source.journals){
  if(!uuid(j.id)||ids.has(j.id)||!month(j.period_start)||!ps.has(j.period_start)||!date(j.effective_on)||
   j.effective_on.slice(0,7)!==j.period_start.slice(0,7)||!j.source_reference||!j.narration||
   j.test_mode!==true||!Number.isFinite(Date.parse(j.created_at))||
   (j.reversal_of!==null&&!uuid(j.reversal_of))||
   (j.review_status!==null&&!reviewed.includes(j.review_status))||
   !Array.isArray(j.lines)||j.lines.length<2||j.lines.length>12)
   return withheld('Malformed, foreign or unbounded simulated journal');
  ids.add(j.id);let debit=0,credit=0;
  for(const l of j.lines){
   if(!accounts[l.account]||!['debit','credit'].includes(l.side)||
    !Number.isSafeInteger(l.cents)||l.cents<=0||l.cents>10000000000)
    return withheld('Unrecognized chart account, line side or cents');
   if(l.side==='debit'){debit+=l.cents;allDebit+=l.cents;}else{credit+=l.cents;allCredit+=l.cents;}
   nets.set(l.account,(nets.get(l.account)||0)+(l.side==='debit'?l.cents:-l.cents));
  }
  if(debit!==credit||!debit||!Number.isSafeInteger(debit))return withheld('Unbalanced double-entry simulation');
 }
 const lookup=new Map(source.journals.map(j=>[j.id,j]));
 for(const j of source.journals){if(!j.reversal_of)continue;
  const prior=lookup.get(j.reversal_of);
  if(!prior||prior.reversal_of||prior.period_start!==j.period_start||reversed.has(j.reversal_of)||
   prior.lines.length!==j.lines.length||j.lines.some((l,i)=>l.account!==prior.lines[i].account||
     l.cents!==prior.lines[i].cents||l.side===prior.lines[i].side))
   return withheld('Reversal lineage failed company/period/inversion checks');
  reversed.add(j.reversal_of);
 }
 if(allDebit!==allCredit||allDebit!==source.total_debits_cents||allCredit!==source.total_credits_cents||
  source.accounts.length!==nets.size||source.accounts.some(a=>!accounts[a.account]||
    nets.get(a.account)!==a.net_debit_cents||typeof a.liability_debit_warning!=='boolean'||
    a.liability_debit_warning!==(['2000','2100','2200'].includes(a.account)&&a.net_debit_cents>0)))
  return withheld('Account control, liability or debit/credit totals mismatch');
 return {state:'verified_test_gl',companyId,enabled:source.enabled,periods:source.periods,
  journals:source.journals,accounts:source.accounts,totalDebits:allDebit,totalCredits:allCredit,
  canPost:false,canPay:false,canFile:false};
}
window.YWI448=Object.freeze({inspect,accounts,reviewed,money});
const el=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value);return e};
function field(parent,tag,label,id,max){const box=el('label',label),input=el(tag);input.id=id;
 if(max)input.maxLength=max;box.append(input);parent.append(box);return input;}
const cents=s=>{const m=/^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(String(s).trim());if(!m)throw Error('Use positive CAD with at most 2 decimals');
 return Number(m[1])*100+Number((m[2]||'').padEnd(2,'0'));};
const nonce=()=>{const x=window.crypto?.randomUUID?.();if(!uuid(x))throw Error('Secure operation ID required');return x;};
const options=(select,items,name,empty)=>{const prev=select.value;select.replaceChildren();const n=el('option',empty);n.value='';select.append(n);
 for(const r of items){const o=el('option',name(r));o.value=r.id;select.append(o);}
 if(items.some(x=>x.id===prev))select.value=prev;else if(items.length===1)select.value=items[0].id;};
async function session(){const s=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
 if(s?.isAuthenticated!==true||!uuid(s.user?.id)||!sb?.rpc||!sb?.auth?.getUser||!sb?.from||
  !window.YWISecurity?.canViewModule?.('admin',s.role,'manage')||
  !window.YWISecurity?.canViewModule?.('finance',s.role,'manage')||
  !window.YWISecurity?.canViewModule?.('jobs',s.role,'view'))throw Error('Independent Admin and Finance manage required');
 const u=await sb.auth.getUser();if(u.error||u.data?.user?.id!==s.user.id)throw Error('Owner identity mismatch');
 return {uid:s.user.id,sb};}
async function rpc(sb,name,args){const res=await sb.rpc(name,args);if(res.error||res.data===null||res.data===undefined)
 throw Error(res.error?.message||'Missing '+name+' evidence');return res.data;}
function mount(){const root=document.getElementById('admin');if(!root||document.getElementById('owner448GL'))return;
 const panel=el('details');panel.id='owner448GL';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · Simulated Double-Entry Ledger & Period Close';
 panel.dataset.adminHubGroups='finance management';panel.append(el('summary','448 · Accounting · Double-Entry GL & Reconciliation (Test Mode)'));
 const body=el('div');body.className='admin-panel-block';body.append(el('p',
  'Balance debits/credits, preview liability controls, review/reverse simulated journals and lock test periods. NO live postings, bank connections, customer balance changes or tax filings.'));
 const help=el('a','ⓘ Double-Entry GL Help');help.href='/help.html#pms-double-entry-gl-448';body.append(help);
 const grid=el('div');grid.className='pms-finance-grid';const company=field(grid,'select','Owner company','pms448Company');body.append(grid);
 const actions=el('div');actions.className='pms-finance-actions';
 const button=(host,id,label)=>{const b=el('button',label);b.id=id;b.type='button';b.className='secondary';host.append(b);return b;};
 const refresh=button(actions,'pms448Refresh','Verify GL access');const toggle=button(actions,'pms448Toggle','Enable GL test mode');body.append(actions);
 const status=el('p','GL test mode OFF until independently authorized.');status.id='pms448Status';status.setAttribute('role','status');body.append(status);
 const totals=el('div');totals.id='pms448Totals';totals.className='pms-finance-cards';body.append(totals);
 const journals=el('div');journals.id='pms448Journals';journals.className='pms-finance-cards';body.append(journals);
 const periodPanel=el('details');periodPanel.id='pms448PeriodPanel';periodPanel.append(el('summary','Lock / unlock a simulated accounting period'));
 const pg=el('div');pg.className='pms-finance-grid';const period=field(pg,'input','Month','pms448Period');period.type='month';
 const lockRef=field(pg,'input','Owner close / reopen source reference','pms448LockRef',160);periodPanel.append(pg);
 const lockActions=el('div');lockActions.className='pms-finance-actions';const lock=button(lockActions,'pms448Lock','Lock test period');
 const unlock=button(lockActions,'pms448Unlock','Reopen test period');periodPanel.append(lockActions);body.append(periodPanel);
 const entryPanel=el('details');entryPanel.id='pms448EntryPanel';entryPanel.append(el('summary','New balanced journal or exact reversal (test-only)'));
 const ef=el('div');ef.className='pms-finance-grid';const effective=field(ef,'input','Effective date','pms448Date');effective.type='date';
 const title=field(ef,'input','Factual simulation narration','pms448Narration',240);
 const source=field(ef,'input','Original source/reference','pms448Source',160);
 const reverse=field(ef,'select','Exact reversal of existing simulated entry (optional)','pms448Reversal');
 entryPanel.append(ef);const entryRows=el('div');entryRows.id='pms448Rows';entryRows.className='pms-finance-cards';entryPanel.append(entryRows);
 const ea=el('div');ea.className='pms-finance-actions';const add=button(ea,'pms448AddLine','Add debit/credit split line');
 const append=button(ea,'pms448Append','Save balanced test journal');entryPanel.append(ea);body.append(entryPanel);
 const reconPanel=el('details');reconPanel.id='pms448ReconPanel';reconPanel.append(el('summary','Unposted reconciliation comparison'));
 const rf=el('div');rf.className='pms-finance-grid';const rperiod=field(rf,'input','Test month','pms448ReconPeriod');rperiod.type='month';
 const racct=field(rf,'select','Account','pms448ReconAccount');for(const [code,name] of Object.entries(accounts)){
  const op=el('option',code+' · '+name);op.value=code;racct.append(op);}
 const expected=field(rf,'input','Expected net debit (CAD, negative for net credit)','pms448Expected');
 expected.placeholder='125.00 or -125.00';const rref=field(rf,'input','Source reference for manual comparison','pms448ReconRef',160);
 reconPanel.append(rf);const reconcile=button(reconPanel,'pms448Reconcile','Compare only — do not post');
 const result=el('p');result.id='pms448ReconcileResult';reconPanel.append(result);body.append(reconPanel);
 panel.append(body);root.append(panel);
 let epoch=0,identity=null,owned=[],data=null,busy=false;
 const alive=(id,e)=>epoch===e&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===id;
 const clear=()=>{data=null;totals.replaceChildren();journals.replaceChildren();result.textContent='';};
 const verified=()=>data?.state==='verified_test_gl'&&identity===window.YWI_AUTH?.getState?.()?.user?.id&&owned.some(x=>x.id===company.value);
 const rows=[];
 function row(account='1000',side='debit',value=''){const host=el('div');host.className='pms-finance-grid';
  const c=field(host,'select','Chart account','');for(const [code,name] of Object.entries(accounts)){
   const o=el('option',code+' · '+name);o.value=code;c.append(o);}c.value=account;
  const s=field(host,'select','Side','');for(const v of ['debit','credit']){const o=el('option',v);o.value=v;s.append(o);}s.value=side;
  const a=field(host,'input','Amount CAD','');a.value=value;a.placeholder='100.00';
  const remove=button(host,'','Remove line');remove.onclick=()=>{if(rows.length<=2)return;host.remove();rows.splice(rows.findIndex(r=>r.host===host),1);};
  rows.push({host,account:c,side:s,cents:a});entryRows.append(host);}
 row('5000','debit');row('2000','credit');
 add.onclick=()=>{if(rows.length>=12){status.textContent='At most 12 journal lines';return;}row('5000','debit');};
 const buildLines=()=>{if(!verified()||!data.enabled)throw Error('GL test switch/owner not enabled');
  return rows.map(r=>({account:r.account.value,side:r.side.value,cents:cents(r.cents.value)}));};
 function render(){totals.replaceChildren();journals.replaceChildren();if(!verified())return;
  toggle.textContent=data.enabled?'Disable GL test mode':'Enable GL test mode';
  append.disabled=lock.disabled=unlock.disabled=reconcile.disabled=!data.enabled;
  add.disabled=!data.enabled;
  status.textContent=data.enabled?'VERIFIED TEST-ONLY GL · '+data.journals.length+' balanced simulated entries; no live posting.':
   'GL simulation OFF. Enable Accounting, Reporting and this independent GL switch to see private test records.';
  if(!data.enabled)return;
  totals.append(el('p','Double-entry totals: debits '+money(data.totalDebits)+' / credits '+money(data.totalCredits)+
   ' · balanced preview only. No real account balances.'));
  for(const a of data.accounts)totals.append(el('p',a.account+' '+accounts[a.account]+' · net debit '+money(a.net_debit_cents)+
   (a.liability_debit_warning?' · LIABILITIES NEED REVIEW':'')));
  for(const p of data.periods)totals.append(el('p',p.period_start.slice(0,7)+' · '+(p.locked?'LOCKED — no new entries':'OPEN TEST PERIOD')));
  options(reverse,data.journals.filter(x=>!x.reversal_of&&!data.journals.some(y=>y.reversal_of===x.id)),
   x=>x.effective_on+' · '+x.narration,'New journal (no reversal)');
  reverse.value=''; // Reversal is never inferred from a singleton candidate.
  for(const j of data.journals){const card=el('article');card.className='notice';card.dataset.pms448Journal=j.id;
   card.append(el('strong',j.effective_on+' · '+j.narration+(j.reversal_of?' · REVERSAL':'')),
    el('p','Source '+j.source_reference+' · '+(j.review_status||'awaiting review')+' · TEST MODE'));
   for(const l of j.lines)card.append(el('p',l.account+' '+l.side+' '+money(l.cents)));
   for(const [name,label] of [['reviewed_for_simulation','Review for simulation'],['needs_correction','Needs correction'],['rejected','Reject test journal']]){
    const b=button(card,'',''+label);b.onclick=()=>run(async e=>{const ctx=await session();const ref=window.prompt('Private review source reference (at least 3 characters):','');
     if(!ref||!window.confirm('Append a review flag only? This does not post any GL entries.'))return;
     const id=await rpc(ctx.sb,'ywi_rpc_pms_gl_review_448',{p_company_id:company.value,p_journal_id:j.id,
      p_request_id:nonce(),p_status:name,p_source_ref:ref.trim()});
     if(!uuid(id)||!alive(ctx.uid,e))throw Error('Review receipt denied');await load(e);
     status.textContent='Append-only test journal review saved; no payment or GL posting.';});}
   journals.append(card);}
 }
 async function load(e){const ctx=await session();if(!alive(ctx.uid,e))throw Error('Owner session changed');
  const out=await ctx.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(!alive(ctx.uid,e)||out.error||!Array.isArray(out.data)||out.data.length>100||
   new Set(out.data.map(x=>x.id)).size!==out.data.length||
   out.data.some(x=>!uuid(x.id)||!x.name||x.owner_user_id!==ctx.uid))throw Error('Company ownership unavailable');
  owned=out.data;identity=ctx.uid;options(company,owned,x=>x.name,'Choose verified owner company');
  if(!owned.some(x=>x.id===company.value)){clear();status.textContent='HOLD: no live owner company. Yard Rosevear is synthetic only.';return;}
  const s=await rpc(ctx.sb,'ywi_rpc_pms_gl_snapshot_448',{p_company_id:company.value});
  if(!alive(ctx.uid,e)||s.company_id!==company.value)throw Error('GL company source mismatch');
  data=inspect(s,{companyId:company.value,allowed:true});if(data.state!=='verified_test_gl')throw Error(data.reason);
  render();}
 async function run(task){if(busy)return;busy=true;const e=epoch;refresh.disabled=toggle.disabled=true;
  try{await task(e)}catch(err){clear();status.textContent='WITHHELD: '+(err.message||String(err));}
  finally{busy=false;refresh.disabled=toggle.disabled=false;}}
 refresh.onclick=()=>run(load);company.onchange=()=>{epoch++;clear();run(load);};
 reverse.onchange=()=>{if(!verified()||!data.enabled)return;
  const old=data.journals.find(j=>j.id===reverse.value);if(!old)return;
  rows.length=0;entryRows.replaceChildren();for(const l of old.lines)
   row(l.account,l.side==='debit'?'credit':'debit',(l.cents/100).toFixed(2));
  effective.value=old.effective_on;title.value='Simulated reversal: '+old.narration;
  source.value='REV-'+old.source_reference.slice(0,156);
 };
 toggle.onclick=()=>run(async e=>{if(!verified())throw Error('Verify company GL owner');const ctx=await session();
  const enabled=!data.enabled,ref=window.prompt('Owner source reference for GL simulation switch:','');
  if(!ref||!window.confirm((enabled?'ENABLE':'DISABLE')+' TEST-ONLY GL for this company?'))return;
  const out=await rpc(ctx.sb,'ywi_rpc_pms_gl_toggle_448',{p_company_id:company.value,p_enabled:enabled,p_reference:ref.trim()});
  if(!alive(ctx.uid,e)||out.company_id!==company.value||out.enabled!==enabled||out.posting_available!==false||
   out.bank_access!==false)throw Error('GL toggle receipt invalid');await load(e);});
 async function setLock(e,value){if(!verified()||!data.enabled)throw Error('Test GL disabled');const ctx=await session();
  const periodStart=period.value+'-01';if(!month(periodStart))throw Error('Choose a valid month');
  if(!window.confirm((value?'LOCK':'REOPEN')+' '+period.value+' simulation period? Manual source required.'))return;
  const out=await rpc(ctx.sb,'ywi_rpc_pms_gl_lock_448',{p_company_id:company.value,
   p_period_start:periodStart,p_locked:value,p_reference:lockRef.value.trim()});
  if(!alive(ctx.uid,e)||out.company_id!==company.value||out.period_start!==periodStart||
   out.locked!==value||out.test_mode!==true)throw Error('Period lock receipt invalid');await load(e);}
 lock.onclick=()=>run(e=>setLock(e,true));unlock.onclick=()=>run(e=>setLock(e,false));
 append.onclick=()=>run(async e=>{const lines=buildLines(),ctx=await session();
  const debit=lines.filter(x=>x.side==='debit').reduce((a,x)=>a+x.cents,0);
  const credit=lines.filter(x=>x.side==='credit').reduce((a,x)=>a+x.cents,0);
  if(!debit||debit!==credit)throw Error('Every simulated journal must have exactly equal debits and credits');
  const prior=reverse.value||null;
  if(prior){const orig=data.journals.find(x=>x.id===prior);
   if(!orig||orig.lines.length!==lines.length||lines.some((l,i)=>l.account!==orig.lines[i].account||
    l.cents!==orig.lines[i].cents||l.side===orig.lines[i].side))throw Error('Reversal must exactly invert same-period original lines');}
  if(!window.confirm('Save balanced TEST journal? No posted ledger, bank transfer or invoice is created.'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_pms_gl_append_448',{p_company_id:company.value,
   p_request_id:nonce(),p_effective_on:effective.value,p_source_ref:source.value.trim(),
   p_narration:title.value.trim(),p_lines:lines,p_reversal_of:prior});
  if(!uuid(id)||!alive(ctx.uid,e))throw Error('Test GL append receipt invalid');await load(e);
  status.textContent='Balanced double-entry SIMULATION saved without posting to real balances.';});
 reconcile.onclick=()=>run(async e=>{if(!verified()||!data.enabled)throw Error('GL test mode OFF');const ctx=await session();
  const value=String(expected.value).trim(),negative=value.startsWith('-');
  const amount=cents(negative?value.slice(1):value)*(negative?-1:1);
  const out=await rpc(ctx.sb,'ywi_rpc_pms_gl_reconcile_448',{p_company_id:company.value,
   p_period_start:rperiod.value+'-01',p_account:racct.value,p_expected_net_debit_cents:amount,
   p_source_ref:rref.value.trim()});
  if(!alive(ctx.uid,e)||out.company_id!==company.value||out.test_mode!==true||
   out.reconciliation_saved!==false||out.bank_verified!==false||out.posting_available!==false||
   !Number.isSafeInteger(out.variance_cents))throw Error('Unsourced reconciliation result');
  result.textContent=(out.matched?'MATCH':'VARIANCE')+' · simulated balance '+money(out.simulated_actual_net_debit_cents)+
   ', reported expected '+money(out.reported_expected_net_debit_cents)+', difference '+money(out.variance_cents)+
   '. Comparison not saved; no bank statement verified.';});
 const invalidate=()=>{epoch++;clear();company.replaceChildren();owned=[];identity=null;
  title.value=source.value=lockRef.value=rref.value=expected.value=effective.value=period.value=rperiod.value='';
  reverse.replaceChildren();for(const r of rows)r.cents.value='';
  status.textContent='Session or permission changed; private GL simulation withheld.';};
 document.addEventListener('ywi:auth-changed',invalidate);
 document.addEventListener('ywi:module-permissions-changed',invalidate);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
