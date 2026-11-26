/* YW599 private owner/reviewer controls; server is the authority. */
(()=>{'use strict';
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x};
 const session=()=>window.YWI_AUTH?.getState?.()||{};
 const sb=()=>window.YWI_SB||window._sb;
 function mount(){
  const jobs=document.getElementById('jobs');
  if(!jobs||document.getElementById('yw599Panel'))return;
  const p=el('details');p.id='yw599Panel';p.className='yw598-panel';
  p.append(el('summary','YW599 · Independent Master outage notification custody'),el('p','Recorded ACK freshness alerts are not direct uptime measurements. Delivery requires genuine independent provider enrollment, two authorized people and explicit owner confirmation. Unknown delivery never triggers automatic retry. No key change or customer messages.'));
  const form=el('div');form.className='yw598-grid';p.append(form);
  function input(label){const l=el('label',label),i=el('input');i.autocomplete='off';i.spellcheck=false;l.append(i);form.append(l);return i}
  const company=input('Original company UUID'),enrollment=input('Provider enrollment UUID'),alert=input('Original health alert UUID');
  const check=el('input');check.type='checkbox';const label=el('label');label.append(check,document.createTextNode(' I explicitly authorize the selected action using the displayed provider and approved recipient reference.'));p.append(label);
  const controls=el('div');controls.className='yw598-actions';p.append(controls);
  const status=el('p','HOLD · Load authenticated private overview first.');status.setAttribute('role','status');status.setAttribute('aria-live','polite');p.append(status);
  const output=el('div');p.append(output);
  let view=null,busy=false,epoch=0,lastUser=null;
  const buttons=[];
  function reset(){epoch++;view=null;check.checked=false;output.replaceChildren();status.textContent='HOLD · Reload private overview.';buttons.forEach(b=>b.disabled=false);busy=false}
  company.addEventListener('input',reset);
  function valid(i){const v=i.value.trim();if(!uuid.test(v))throw Error('Original UUID required');return v}
  async function invoke(body){
   const start=epoch,s=session(),client=sb();
   if(s.isAuthenticated!==true||!uuid.test(s.user?.id)||!client?.auth?.getUser||!client?.functions?.invoke)throw Error('Sign into the original authorized account.');
   const u=await client.auth.getUser();
   if(u.error||u.data?.user?.id!==s.user.id||epoch!==start||session().user?.id!==s.user.id)throw Error('Session changed');
   const r=await client.functions.invoke('yw599-independent-recovery',{body});
   if(epoch!==start||session().user?.id!==s.user.id)throw Error('Session changed');
   if(r.error||!r.data)throw Error('Server HOLD · No verified result returned');
   return r.data;
  }
  function show(d){output.replaceChildren();
   const add=(text)=>output.append(el('p',text));
   if(d.state==='PRIVATE_OVERVIEW'){
    add('Role: '+d.role+' | Provider: '+d.providerId+' | Recipient reference: '+d.recipientRef+' | Delivery enabled: '+String(d.deliveryEnabled));
    for(const r of d.enrollments||[])add('Enrollment '+r.id+' | Approval recorded: '+String(r.approved)+' | Revoked: '+String(r.revoked)+' | Current configuration: '+String(r.configCurrent)+' | Expires: '+r.expiresAt);
    for(const r of d.alerts||[])add('Alert '+r.id+' | '+r.issue_code+' | '+r.detected_at);
   }else if(d.enrollmentId)add('Enrollment UUID: '+d.enrollmentId);
   else if(d.claimId)add('Claim UUID: '+d.claimId);
  }
  function button(text,action){
   const b=el('button',text);b.type='button';controls.append(b);buttons.push(b);
   b.addEventListener('click',async()=>{
    if(busy)return;busy=true;const start=epoch;buttons.forEach(x=>x.disabled=true);
    try{
     const companyId=valid(company);let body={action,companyId};
     if(action!=='overview'){
      if(!view||view.companyId!==companyId||view.user!==session().user?.id||!check.checked)throw Error('Reload private overview and explicitly confirm this action.');
      body.confirmed=true;check.checked=false;
      if(action!=='enroll')body.enrollmentId=valid(enrollment);
      if(action==='deliver')body.alertId=valid(alert);else body.configSha=view.configSha;
     }
     const d=await invoke(body);
     if(start!==epoch)return;
     if(action==='overview'&&d.state==='PRIVATE_OVERVIEW')view={companyId,user:session().user.id,configSha:d.configSha};
     else view=null;
     show(d);status.textContent=String(d.state||'HOLD');
    }catch(e){if(start===epoch){view=null;output.replaceChildren();status.textContent='HOLD · '+e.message}}
    finally{if(start===epoch){busy=false;buttons.forEach(x=>x.disabled=false)}}
   });
  }
  button('Load private provider and alerts','overview');
  button('Owner: record provider consent','enroll');
  button('Separate reviewer: approve enrollment','approve');
  button('Owner/reviewer: revoke enrollment','revoke');
  button('Owner: send one selected original alert','deliver');
  lastUser=session().user?.id;
  sb()?.auth?.onAuthStateChange?.(()=>{queueMicrotask(()=>{const u=session().user?.id;if(u!==lastUser){lastUser=u;reset();company.value='';enrollment.value='';alert.value=''}})});
  jobs.append(p);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
 new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
})();
