/* YW601 tenant-only predictive evidence assessment. No provider sends or recovery actions. */
(()=>{'use strict';
 const $=id=>document.getElementById(id), el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x};
 let epoch=0,busy=false,reviewerReady=false;
 const auth=()=>window.YWI_AUTH?.getState?.()||{},client=()=>window.YWI_SB||window._sb;
 const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 const labels={UNKNOWN_NO_ACTIVE_PILOT:'No approved pilot',UNKNOWN_NO_ACTIVE_WATCH:'No active health watch',UNKNOWN_NO_SIGNED_SAMPLES:'No signed observations',UNKNOWN_INSUFFICIENT_HISTORY:'Insufficient observation history',UNKNOWN_ORIGINAL_CHAIN_HOLD:'Original evidence chain unavailable',UNKNOWN_EVIDENCE_VERIFICATION_FAILED:'Evidence verification failed',UNKNOWN_UNBOUNDED_INPUT:'Observation limit exceeded',UNKNOWN_WATCH_LIMIT:'Watch limit exceeded',RISK_FRESHNESS_DEGRADING:'Signed evidence becoming stale',RISK_WIDENING_OBSERVATION_GAPS:'Observation gaps widening',STALE_SIGNED_EVIDENCE:'Signed evidence stale',RECENT_SIGNED_OBSERVATIONS:'Recent signed observations'};
 function reset(){epoch++;busy=false;reviewerReady=false;if($('yw601Review'))$('yw601Review').disabled=true;if($('yw601Alert'))$('yw601Alert').value='';if($('yw601Enrollment'))$('yw601Enrollment').value='';const out=$('yw601Result');if(out)out.replaceChildren();if($('yw601Status'))$('yw601Status').textContent='Private assessment cleared. Reload when signed in.';if($('yw601Load'))$('yw601Load').disabled=false;}
 async function load(review=false){
  if(busy)return;busy=true;const generation=epoch,button=$('yw601Load'),status=$('yw601Status'),out=$('yw601Result');button.disabled=true;$('yw601Review').disabled=true;out.replaceChildren();status.textContent='Checking authorized evidence…';
  try{
   const s=auth(),c=client(),company=$('yw601Company').value.trim()||$('yw597Company')?.value?.trim();
   if(s.isAuthenticated!==true||!uuid(s.user?.id)||!uuid(company)||!c?.auth?.getUser||!c?.functions?.invoke)throw Error('Sign in and select an authorized company');
   const live=await c.auth.getUser();if(live.error||live.data?.user?.id!==s.user.id||generation!==epoch)throw Error('Session changed');
   const body={action:'overview',companyId:company};
   if(review){if(!reviewerReady||!uuid($('yw601Alert').value.trim())||!uuid($('yw601Enrollment').value.trim()))throw Error('Select a real alert and enrollment after loading reviewer overview');Object.assign(body,{action:'review-resumed',alertId:$('yw601Alert').value.trim(),enrollmentId:$('yw601Enrollment').value.trim()});}
   const r=await c.functions.invoke('yw601-predictive-assurance',{body});
   if(generation!==epoch||auth().user?.id!==s.user.id)return;
   if(review){if(r.error||!r.data)throw Error('Independent readback unavailable');const verified=r.data.state==='RESUMED_SIGNED_OBSERVATIONS_INDEPENDENTLY_REVERIFIED'&&r.data.independentReadback===true;status.textContent=verified?'Resumed signed observations independently reverified; not physical recovery proof.':'HOLD · Resumed evidence insufficient or unverified.';return;}
   reviewerReady=false;
   if(r.error||!r.data||!Array.isArray(r.data.assessments)||r.data.assessments.length>8)throw Error('Authorized assessment unavailable');
   reviewerReady=r.data.reviewerReadbackAvailable===true;
   status.textContent=labels[r.data.state]||'Tenant evidence assessment loaded';
   for(const a of r.data.assessments){
    const section=el('section');section.className='yw601-assessment';
    section.append(el('h4',labels[a.state]||'Unknown evidence state'),el('p','Verified observations: '+(Number.isInteger(a.sampleCount)?a.sampleCount:'Unknown')),el('p','Last verified: '+(typeof a.lastVerifiedAt==='string'?a.lastVerifiedAt:'Unknown')),el('p','Evidence age: '+(Number.isFinite(a.ageMinutes)?a.ageMinutes+' minutes':'Unknown')),el('p','Evidence coverage: '+(a.confidence==='LIMITED_OBSERVATIONS'?'Limited observations':'Insufficient')));
    out.append(section);
   }
  }catch(e){if(generation===epoch)status.textContent='HOLD · '+e.message;}
  finally{if(generation===epoch){busy=false;button.disabled=false;$('yw601Review').disabled=!reviewerReady;}}
 }
 function mount(){const jobs=$('jobs');if(!jobs||$('yw601Panel'))return;const p=el('details');p.id='yw601Panel';p.className='yw597-panel';
  p.append(el('summary','YW601 · Predictive outage evidence and operational assurance'),el('p','Read-only signed ACK freshness and observation-gap warnings. Missing or stale observations are not proof of a Master outage. No automatic probes, notifications, recovery or key changes.'));
  const label=el('label','Authorized company UUID (or use selected YW597 company)');const input=el('input');input.id='yw601Company';input.autocomplete='off';label.append(input);p.append(label);
  const button=el('button','Refresh private predictive assessment');button.id='yw601Load';button.type='button';button.addEventListener('click',()=>load(false));p.append(button);
  for(const [id,title] of [['yw601Enrollment','Original health watch UUID'],['yw601Alert','Original freshness alert UUID']]){const l=el('label',title),v=el('input');v.id=id;v.autocomplete='off';l.append(v);p.append(l);}
  const review=el('button','Independent reviewer: reverify resumed signed observations');review.id='yw601Review';review.type='button';review.disabled=true;review.addEventListener('click',()=>load(true));p.append(review);
  const status=el('p','Not assessed');status.id='yw601Status';status.setAttribute('role','status');p.append(status);
  const out=el('div');out.id='yw601Result';p.append(out);jobs.append(p);
 }
 for(const event of ['ywi:auth-changed','ywi:workspace-authority-changed'])document.addEventListener(event,reset);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
