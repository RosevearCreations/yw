/* PMS 446: company-private, double-switched payroll readiness only.
 * All writes use owner-authorized RPCs. No payroll execution or tax calculations. */
(()=>{'use strict';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const statuses=['draft','reviewed_for_planning','disputed'];
const withheld=reason=>({state:'withheld',reason,lines:[],enabled:false,effective:false});
const fresh=(x,now)=>{const t=Date.parse(x?.captured_at);return Number.isFinite(t)&&t<=now+60000&&now-t<=300000};
const dollars=x=>Number.isSafeInteger(x)?'$'+(x/100).toFixed(2):'unverified';
function inspect(source,{companyId,now=Date.now(),allowed=false,employeeIds=null}={}){
 if(!uuid(companyId)||!allowed||source?.company_id!==companyId||!fresh(source,now)||
  source.owner_guard!=='ywi_446_assert_payroll_owner'||typeof source.enabled!=='boolean'||
  typeof source.effective!=='boolean'||(source.effective&&!source.enabled)||
  !Array.isArray(source.lines)||source.lines.length>200||source.line_count!==source.lines.length||
  source.payroll_executed!==false||source.direct_deposit_available!==false||
  source.tax_filing_available!==false||source.mutation_authorized!==false||
  source.rates_exposed!==source.effective||
  (!source.effective&&source.lines.length!==0))return withheld('Owner, payroll field access, freshness or data minimization unverified');
 const ids=new Set(source.lines.map(x=>x.id));
 if(ids.size!==source.lines.length||source.lines.some(x=>!uuid(x.id)||!uuid(x.employee_id)||
  (employeeIds&&typeof employeeIds.has==='function'&&!employeeIds.has(x.employee_id))||
  !/^\d{4}-\d{2}-\d{2}$/.test(x.pay_period_start)||
  !/^\d{4}-\d{2}-\d{2}$/.test(x.pay_period_end)||
  !Number.isInteger(x.reported_minutes)||x.reported_minutes<0||x.reported_minutes>60000||
  !Number.isInteger(x.rate_cents)||x.rate_cents<0||x.rate_cents>1000000||
  ![x.reported_deductions_cents,x.planned_benefits_cents,x.planned_vacation_cents]
   .every(v=>Number.isSafeInteger(v)&&v>=0&&v<=100000000)||
  x.gross_projection_cents!==Math.round(x.reported_minutes*x.rate_cents/60)||
  !statuses.includes(x.reported_status)||!x.time_approval_source_ref||
  (x.correction_of!==null&&!uuid(x.correction_of))||
  !Number.isFinite(Date.parse(x.created_at))))return withheld('Foreign, duplicate or malformed payroll source');
 if(source.lines.some(x=>x.correction_of!==null&&
  (!ids.has(x.correction_of)||source.lines.find(y=>y.id===x.correction_of)?.employee_id!==x.employee_id)))
  return withheld('Unverifiable company employee correction chain');
 return {state:'verified_payroll_readiness',companyId,enabled:source.enabled,
  effective:source.effective,lines:source.lines,canPay:false,canFile:false};
}
window.YWI446=Object.freeze({inspect,statuses,dollars});
const el=(tag,value)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);return x};
function formField(parent,tag,label,id,maxLength){const wrap=el('label',label),input=el(tag);input.id=id;
 if(maxLength)input.maxLength=maxLength;wrap.append(input);parent.append(wrap);return input;}
function choices(select,rows,label,empty='Choose'){const prev=select.value;select.replaceChildren();const first=el('option',empty);first.value='';select.append(first);
 for(const row of rows){const x=el('option',label(row));x.value=row.id;select.append(x);}
 if(rows.some(x=>x.id===prev))select.value=prev;else if(rows.length===1)select.value=rows[0].id;}
const cents=str=>{const m=/^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(String(str).trim());
 if(!m)throw Error('Enter nonnegative dollars with at most two decimals');return Number(m[1])*100+Number((m[2]||'').padEnd(2,'0'));};
async function session(){const s=window.YWI_AUTH?.getState?.(),sb=window.YWI_SB||window._sb;
 if(s?.isAuthenticated!==true||!uuid(s.user?.id)||!sb?.auth?.getUser||!sb?.rpc||!sb?.from||
  !window.YWISecurity?.canViewModule?.('admin',s.role,'manage')||
  !window.YWISecurity?.canViewModule?.('finance',s.role,'manage')||
  !window.YWISecurity?.canViewModule?.('jobs',s.role,'view'))throw Error('Active owner with independent Admin/Finance manage required');
 const a=await sb.auth.getUser();if(a.error||a.data?.user?.id!==s.user.id)throw Error('Owner identity mismatch');
 return {uid:s.user.id,sb};}
async function rpc(sb,name,args){const r=await sb.rpc(name,args);
 if(r.error||r.data===null||r.data===undefined)throw Error(r.error?.message||'Unverified '+name);return r.data;}
const nonce=()=>{const x=window.crypto?.randomUUID?.();if(!uuid(x))throw Error('Secure request ID required');return x};
function mount(){const host=document.getElementById('admin');if(!host||document.getElementById('owner446Payroll'))return;
 const panel=el('details');panel.id='owner446Payroll';panel.className='admin-hub-detail';
 panel.dataset.adminHubTitle='PMS · Confidential Payroll Readiness';panel.dataset.adminHubGroups='management people finance';
 panel.append(el('summary','446 · Property Maintenance System · Payroll Readiness'));
 const body=el('div');body.className='admin-panel-block';body.append(el('p',
  'Confidential reported time, rates, deduction/benefit/vacation planning and append-only corrections. No real pay run, direct deposit, CRA filing or bank access.'));
 const help=el('a','ⓘ Payroll Readiness Help');help.href='/help.html#pms-payroll-readiness-446';body.append(help);
 const grid=el('div');grid.className='pms-finance-grid';const company=formField(grid,'select','Verified owner company','pms446Company');body.append(grid);
 const actions=el('div');actions.className='pms-finance-actions';
 const btn=(parent,id,label)=>{const b=el('button',label);b.type='button';b.id=id;b.className='secondary';parent.append(b);return b;};
 const refresh=btn(actions,'pms446Refresh','Verify payroll access');
 const toggle=btn(actions,'pms446Toggle','Enable confidential payroll planning');body.append(actions);
 const message=el('p','Payroll is OFF until explicitly authorized.');message.id='pms446Status';message.setAttribute('role','status');body.append(message);
 const records=el('div');records.id='pms446Records';records.className='pms-finance-cards';body.append(records);
 const addPanel=el('details');addPanel.id='pms446NewPanel';addPanel.append(el('summary','Append payroll planning line or correction'));
 const fields=el('div');fields.className='pms-finance-grid';
 const person=formField(fields,'select','Verified HR employee','pms446Employee');
 const from=formField(fields,'input','Pay period start','pms446From');from.type='date';
 const to=formField(fields,'input','Pay period end (31 days maximum)','pms446To');to.type='date';
 const minutes=formField(fields,'input','Operator-reported approved minutes','pms446Minutes');minutes.type='number';minutes.min='0';minutes.max='60000';
 const rate=formField(fields,'input','Hourly rate CAD','pms446Rate');rate.inputMode='decimal';rate.placeholder='25.00';
 const deductions=formField(fields,'input','Reported deductions CAD (not tax computed)','pms446Deductions');deductions.placeholder='0.00';
 const benefits=formField(fields,'input','Planned employer benefits CAD','pms446Benefits');benefits.placeholder='0.00';
 const vacation=formField(fields,'input','Planned vacation CAD','pms446Vacation');vacation.placeholder='0.00';
 const source=formField(fields,'input','Private approval/time source reference','pms446Source',160);
 const status=formField(fields,'select','Review status','pms446Review');
 for(const v of statuses){const o=el('option',v.replaceAll('_',' '));o.value=v;status.append(o);}
 const correction=formField(fields,'select','Correct an earlier same-period line (optional)','pms446Correction');
 const notes=formField(fields,'textarea','Internal factual notes','pms446Notes',500);
 addPanel.append(fields);const append=btn(addPanel,'pms446Append','Append confidential draft');body.append(addPanel);
 panel.append(body);host.append(panel);
 let epoch=0,identity=null,owned=[],data=null,people=[],busy=false;
 const alive=(uid,e)=>epoch===e&&window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&window.YWI_AUTH.getState().user?.id===uid;
 const clear=()=>{data=null;people=[];records.replaceChildren();person.replaceChildren();correction.replaceChildren();};
 const eligible=()=>data?.state==='verified_payroll_readiness'&&identity===window.YWI_AUTH?.getState?.()?.user?.id&&owned.some(x=>x.id===company.value);
 function correctionOptions(){if(!eligible()||!data.effective)return;
  const children=new Set(data.lines.filter(x=>x.correction_of).map(x=>x.correction_of));
  choices(correction,data.lines.filter(x=>x.employee_id===person.value&&x.pay_period_start===from.value&&
    x.pay_period_end===to.value&&!children.has(x.id)),x=>x.reported_status+' · '+x.created_at,'New line (no correction)');}
 function render(){records.replaceChildren();if(!eligible())return;
  toggle.textContent=data.enabled?'Disable confidential payroll planning':'Enable confidential payroll planning';
  append.disabled=!data.effective;
  message.textContent=data.effective?'VERIFIED CONFIDENTIAL READINESS · '+data.lines.length+' lines. No pay run or CRA filing.':
   'WITHHELD PRIVATE RATES: enable Accounting, its Payroll field and this independent Payroll switch. Existing private records remain protected.';
  for(const x of data.lines){const c=el('article');c.className='notice';c.dataset.pms446Line=x.id;
   c.append(el('strong','Employee '+x.employee_id.slice(0,8)+' · '+x.reported_status),
    el('p',x.pay_period_start+' to '+x.pay_period_end+' · '+x.reported_minutes+' reported minutes'),
    el('p','Planning hourly rate '+dollars(x.rate_cents)+' · gross projection '+dollars(x.gross_projection_cents)),
    el('p','Reported deductions '+dollars(x.reported_deductions_cents)+
     ' · planned employer benefits '+dollars(x.planned_benefits_cents)+
     ' · vacation '+dollars(x.planned_vacation_cents)),
    el('p','Private approval reference: '+x.time_approval_source_ref+(x.correction_of?' · corrects '+x.correction_of.slice(0,8):'')));
   records.append(c);}
  choices(person,people,x=>x.display_name+' · '+x.job_title,'Choose company employee');correctionOptions();}
 async function load(e){const ctx=await session();if(!alive(ctx.uid,e))throw Error('Session changed');
  const r=await ctx.sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
  if(!alive(ctx.uid,e)||r.error||!Array.isArray(r.data)||r.data.length>100||
   new Set(r.data.map(x=>x.id)).size!==r.data.length||r.data.some(x=>!uuid(x.id)||x.owner_user_id!==ctx.uid||!x.name))
   throw Error('Company ownership roster withheld');
  identity=ctx.uid;owned=r.data;choices(company,owned,x=>x.name,'Choose owner company');
  if(!owned.some(x=>x.id===company.value)){clear();message.textContent='HOLD: no verified company. Yard Rosevear is synthetic only.';return;}
  const raw=await rpc(ctx.sb,'ywi_rpc_pms_payroll_snapshot_446',{p_company_id:company.value});
  if(!alive(ctx.uid,e)||raw.company_id!==company.value)throw Error('Payroll source crossed a company boundary');
  if(raw.effective){const hr=await rpc(ctx.sb,'ywi_rpc_pms_hr_snapshot_445',{p_company_id:company.value});
   if(!alive(ctx.uid,e)||hr.company_id!==company.value||hr.owner_guard!=='ywi_445_assert_hr_owner'||
    !fresh(hr,Date.now())||!Array.isArray(hr.people)||hr.people.length>100||
    hr.people.some(x=>!uuid(x.id)||!x.display_name))throw Error('Company HR roster not verified');
   people=hr.people;}
  else people=[];
  data=inspect(raw,{companyId:company.value,allowed:true,employeeIds:new Set(people.map(x=>x.id))});
  if(data.state!=='verified_payroll_readiness')throw Error(data.reason);render();}
 async function run(action){if(busy)return;busy=true;const e=epoch;refresh.disabled=toggle.disabled=true;
  try{await action(e)}catch(err){clear();message.textContent='WITHHELD: '+(err.message||String(err));}
  finally{refresh.disabled=toggle.disabled=false;busy=false;}}
 refresh.onclick=()=>run(load);company.onchange=()=>{epoch++;clear();run(load)};
 person.onchange=correctionOptions;from.onchange=to.onchange=correctionOptions;
 toggle.onclick=()=>run(async e=>{if(!eligible())throw Error('Reverify payroll company');const ctx=await session();
  const enabled=!data.enabled;if(!window.confirm((enabled?'ENABLE':'DISABLE')+' confidential payroll planning for this company?'))return;
  const out=await rpc(ctx.sb,'ywi_rpc_pms_payroll_switch_446',{p_company_id:company.value,p_enabled:enabled});
  if(!alive(ctx.uid,e)||out.company_id!==company.value||out.enabled!==enabled||
   out.payroll_executed!==false||out.bank_authorized!==false)throw Error('Payroll switch receipt invalid');
  await load(e);});
 append.onclick=()=>run(async e=>{if(!eligible()||!data.effective||!people.some(x=>x.id===person.value))throw Error('Payroll fields unavailable or employee foreign');
  const ctx=await session();const a={p_company_id:company.value,p_employee_id:person.value,p_request_id:nonce(),
   p_start:from.value,p_end:to.value,p_minutes:Number(minutes.value),p_rate_cents:cents(rate.value),
   p_deductions_cents:cents(deductions.value||'0'),p_benefits_cents:cents(benefits.value||'0'),
   p_vacation_cents:cents(vacation.value||'0'),p_source_ref:source.value.trim(),
   p_status:status.value,p_correction_of:correction.value||null,p_notes:notes.value.trim()||null};
  if(!minutes.value.trim()||!Number.isInteger(a.p_minutes))throw Error('Minutes must be a whole number');
  if(!window.confirm('Append a confidential, non-paying payroll planning entry? No bank, tax or payslip action.'))return;
  const id=await rpc(ctx.sb,'ywi_rpc_pms_payroll_append_446',a);
  if(!uuid(id)||!alive(ctx.uid,e))throw Error('Payroll append receipt invalid');
  await load(e);message.textContent='Confidential payroll planning evidence appended, with no pay run or CRA filing.';});
 const invalidate=()=>{epoch++;clear();company.replaceChildren();identity=null;owned=[];
  message.textContent='Session/permission changed; private payroll source withheld.';};
 document.addEventListener('ywi:auth-changed',invalidate);
 document.addEventListener('ywi:module-permissions-changed',invalidate);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
