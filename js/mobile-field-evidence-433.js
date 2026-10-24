/* YW 433 — device-local capture and fail-closed canonical replay acceptance.
   The current legacy upload routes generate a new media row per request. They are
   deliberately NOT replay targets: a dropped response could duplicate evidence.
   No server-side delivery is offered until an idempotent proof-media adapter exists. */
(()=>{'use strict';
  const DB='ywi_field_evidence_433', STORE='captures', LIMIT=8, MAX_BYTES=8*1024*1024, TOTAL_BYTES=20*1024*1024;
  const TYPES=new Set(['image/jpeg','image/png','image/webp','application/pdf']);
  const uuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(x||''));
  const make=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);return node;};
  let selected='',assignments=[],busy=false,verifiedAt=0,verifiedOwner='';

  function owner(){
    const auth=window.YWI_AUTH?.getState?.()||{};
    const id=auth.profile?.id||auth.user?.id;
    return auth.isAuthenticated===true&&uuid(id)?String(id):'';
  }
  function validateFile(file){
    if(!file||!TYPES.has(file.type)||!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX_BYTES)
      throw Error('Choose a JPEG, PNG, WebP or PDF file up to 8 MiB.');
    return file;
  }
  function dbOpen(){
    if(!globalThis.indexedDB)throw Error('This browser does not support secure offline file storage.');
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB,1);
      request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||Error('Offline storage unavailable'));
      request.onblocked=()=>reject(Error('Offline storage locked by another tab'));
    });
  }
  async function transaction(mode,fn){
    const db=await dbOpen();
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode),request=fn(tx.objectStore(STORE));
      let data;
      request.onsuccess=()=>{data=request.result;};
      request.onerror=()=>{reject(request.error||Error('Evidence store operation failed'));};
      tx.oncomplete=()=>resolve(data);
      tx.onerror=()=>reject(tx.error||Error('Evidence transaction failed'));
      tx.onabort=()=>reject(tx.error||Error('Evidence transaction aborted'));
    });}finally{db.close();}
  }
  const all=()=>transaction('readonly',s=>s.getAll());
  const get=id=>transaction('readonly',s=>s.get(id));
  const put=row=>transaction('readwrite',s=>s.put(row));
  const del=id=>transaction('readwrite',s=>s.delete(id));
  async function owned(){const id=owner();if(!id)throw Error('Sign in as the original assigned field worker.');return (await all()).filter(row=>row.owner_id===id);}
  async function digest(file){
    if(!crypto?.subtle?.digest)throw Error('Secure hashing is unavailable on this device.');
    const bytes=await file.arrayBuffer();
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  }
  function checkOriginalAssignment(source,profile){
    if(!source||source.ok!==true||!source.profile||source.profile.id!==profile||!Array.isArray(source.my_route)||source.my_route.length>100||source.meta?.assignment_filtered!==true)
      throw Error('Original server-filtered mobile assignment source missing or changed.');
    const routes=source.my_route.map(row=>({
      id:row?.work_order?.id,number:String(row?.work_order?.work_order_number||''),dispatch:row?.dispatch?.id,
      status:String(row?.dispatch?.schedule_status||'')
    }));
    if(routes.some(row=>!uuid(row.id)||!uuid(row.dispatch)||!row.number)||new Set(routes.map(row=>row.dispatch)).size!==routes.length)
      throw Error('Ambiguous or malformed original work order assignment.');
    return routes.filter(row=>!['cancelled','archived'].includes(row.status));
  }
  function receiptStatus(row,response){
    if(!response||response.ok!==true||response.canonical_source!=='work_order_execution_proof_media'||
      !uuid(response.receipt_id)||!uuid(response.execution_proof_id)||!uuid(response.visual_asset_id)||
      response.owner_profile_id!==row.owner_id||response.work_order_id!==row.work_order_id||
      response.intent_key!==row.id||response.content_sha256!==row.sha256||response.verified!==true)
      return 'withheld';
    return 'confirmed';
  }
  async function stage(file,workOrderId,number,dispatchId){
    const profile=owner();if(!profile||!uuid(workOrderId)||!uuid(dispatchId)||!assignments.some(a=>a.id===workOrderId&&a.dispatch===dispatchId)||verifiedOwner!==profile)
      throw Error('Refresh and select your original assigned work order first.');
    validateFile(file);
    const sha256=await digest(file),records=await owned();
    if(owner()!==profile||verifiedOwner!==profile)throw Error('Session changed while capturing; file was not saved.');
    const prior=records.find(r=>r.work_order_id===workOrderId&&r.sha256===sha256);
    if(prior)return {duplicate:true,row:prior};
    if(records.length>=LIMIT||records.reduce((sum,r)=>sum+(r.size||0),0)+file.size>TOTAL_BYTES)
      throw Error('Device capture limit reached: at most 8 files and 20 MiB per signed-in profile.');
    const row={id:crypto.randomUUID(),owner_id:profile,work_order_id:workOrderId,work_order_number:number,
      dispatch_id:dispatchId,sha256,filename:String(file.name||'photo').slice(0,120),mime_type:file.type,
      size:file.size,file,created_at:new Date().toISOString(),state:'local_only',attempts:0,
      receipt_id:null,error:''};
    await put(row);
    return {duplicate:false,row};
  }
  async function acceptServerReceipt(id,response){
    const row=await get(id);
    if(!row||!owner()||row.owner_id!==owner())throw Error('Queued evidence belongs to another session or was removed.');
    if(receiptStatus(row,response)!=='confirmed')throw Error('Canonical server proof-media receipt was not verified. Local evidence retained.');
    await put({...row,file:null,state:'confirmed',receipt_id:response.receipt_id,error:'',confirmed_at:new Date().toISOString()});
    return response.receipt_id;
  }
  async function replay(id,adapter=window.YWIAPI){
    const row=await get(id),profile=owner();
    if(!row||!profile||row.owner_id!==profile)throw Error('This evidence does not belong to the current profile.');
    if(row.state==='confirmed')return {status:'confirmed',receipt_id:row.receipt_id};
    if(navigator.onLine===false)throw Error('Offline: evidence is saved only on this device.');
    if(typeof adapter?.lookupFieldEvidenceIntent433!=='function'||typeof adapter?.uploadFieldEvidenceIdempotent433!=='function')
      throw Error('HOLD: verified, idempotent canonical proof-media upload endpoint is not available. No retry sent.');
    if(!verifiedAt||verifiedOwner!==profile||Date.now()-verifiedAt>300000||!assignments.some(a=>a.id===row.work_order_id&&a.dispatch===row.dispatch_id))
      throw Error('Refresh this worker’s original assignment before replay.');
    // Always resolve an uncertain prior attempt BEFORE transmitting the same payload again.
    const prior=await adapter.lookupFieldEvidenceIntent433({intent_key:row.id,work_order_id:row.work_order_id,content_sha256:row.sha256});
    if(prior?.found===true){const receipt=await acceptServerReceipt(id,prior);return {status:'confirmed',receipt_id:receipt,reconciled:true};}
    if(prior?.found!==false||prior?.verified_not_found!==true||prior.owner_profile_id!==profile||prior.work_order_id!==row.work_order_id||prior.intent_key!==row.id)
      throw Error('HOLD: canonical upload receipt absence cannot be verified. No duplicate replay sent.');
    await put({...row,state:'uncertain',attempts:row.attempts+1,error:'Awaiting canonical server receipt; do not retry without reconciliation.'});
    try{
      const response=await adapter.uploadFieldEvidenceIdempotent433({intent_key:row.id,work_order_id:row.work_order_id,
        dispatch_id:row.dispatch_id,content_sha256:row.sha256,file:row.file,mime_type:row.mime_type});
      const receipt=await acceptServerReceipt(id,response);
      return {status:'confirmed',receipt_id:receipt};
    }catch(err){throw Error('Not confirmed: '+String(err?.message||err)+'; capture remains local until a verified server receipt.');}
  }
  function resetSession(){selected='';assignments=[];verifiedAt=0;verifiedOwner='';}
  function mount(){
    const host=document.getElementById('today');if(!host||document.getElementById('field433'))return;
    const panel=make('details');panel.id='field433';panel.style.cssText='margin-top:12px;min-width:0;max-width:100%;overflow-wrap:anywhere';
    panel.append(make('summary','433 · Field Photo & Document Capture / Offline Replay'));
    const body=make('div');body.className='admin-panel-block';
    body.append(make('p','Capture and retain a job photo or PDF on this phone, even without connection. LOCAL ONLY is not uploaded or part of the Jobs proof-media record. Server replay is blocked unless a verified idempotent receipt endpoint is available.'));
    const help=make('a','ⓘ Field capture and replay help');help.href='/help.html#mobile-field-evidence-433';body.append(help);
    const refresh=make('button','Refresh my server-assigned jobs');refresh.type='button';refresh.className='secondary';refresh.id='field433Refresh';body.append(refresh);
    const jobLabel=make('label','Original assigned work order'),jobs=make('select');jobs.id='field433Order';jobs.style.cssText='display:block;max-width:100%;width:100%;min-width:0';jobLabel.append(jobs);body.append(jobLabel);
    const label=make('label','Photo / PDF evidence (8 MiB maximum)'),file=make('input');file.id='field433File';file.type='file';file.accept='image/jpeg,image/png,image/webp,application/pdf';file.style.cssText='display:block;max-width:100%;width:100%';label.append(file);body.append(label);
    const save=make('button','Save file to this device');save.type='button';save.id='field433Save';body.append(save);
    const status=make('p','Sign in, then refresh your original server-assigned jobs.');status.id='field433Status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(status);
    const items=make('div');items.id='field433Items';items.style.cssText='display:grid;gap:10px;min-width:0;overflow-wrap:anywhere';body.append(items);panel.append(body);host.append(panel);
    function note(message){status.textContent=message;}
    function fill(){jobs.replaceChildren();const empty=make('option','Choose an assigned job');empty.value='';jobs.append(empty);assignments.forEach(a=>{const opt=make('option',a.number+' · '+a.id.slice(0,8));opt.value=a.dispatch;jobs.append(opt);});}
    async function render(){items.replaceChildren();const currentOwner=owner();if(!currentOwner){note('Signed out. Local files cannot be listed or replayed.');return;}
      try{const rows=await owned();if(owner()!==currentOwner)return;if(!rows.length){items.append(make('p','No local field captures for this signed-in profile.'));return;}
        for(const row of rows){const card=make('article');card.className='notice';card.dataset.field433State=row.state;
          card.style.cssText='min-width:0;max-width:100%;overflow-wrap:anywhere';
          card.append(make('strong',row.work_order_number+' · '+row.filename));
          card.append(make('p',row.state==='confirmed'?'SERVER VERIFIED · original proof-media receipt '+row.receipt_id:
            'LOCAL ONLY · '+row.state+' · '+(row.size/1024/1024).toFixed(2)+' MiB · upload is not confirmed'));
          if(row.state!=='confirmed'){
            const retry=make('button','Verify receipt / replay safely');retry.type='button';retry.className='secondary';retry.disabled=!window.YWIAPI?.lookupFieldEvidenceIntent433||!window.YWIAPI?.uploadFieldEvidenceIdempotent433;
            retry.onclick=()=>run(async()=>{const result=await replay(row.id);note('Canonical server receipt verified: '+result.receipt_id);await render();});card.append(retry);
          }
          const remove=make('button',row.state==='confirmed'?'Remove local receipt':'Discard this device-only copy');remove.type='button';remove.className='secondary';
          remove.onclick=()=>run(async()=>{if(!window.confirm('Remove this local '+(row.state==='confirmed'?'receipt':'unuploaded evidence file')+'? This cannot be undone.'))return;
            await del(row.id);note('Local record removed; no server-side proof changed.');await render();});card.append(remove);items.append(card);
        }
      }catch(e){items.replaceChildren();note('WITHHELD: '+String(e?.message||e));}}
    async function run(fn){if(busy)return;busy=true;refresh.disabled=true;save.disabled=true;
      try{await fn();}catch(e){note('WITHHELD: '+String(e?.message||e));}finally{busy=false;refresh.disabled=false;save.disabled=false;}}
    refresh.onclick=()=>run(async()=>{resetSession();fill();const profile=owner();if(!profile)throw Error('Please sign in first');
      if(navigator.onLine===false)throw Error('Offline. Existing local evidence is still available, but original assignments cannot be refreshed.');
      const payload=await window.YWIAPI?.fetchMobileCrewContext?.({days:7});
      assignments=checkOriginalAssignment(payload,profile);verifiedAt=Date.now();verifiedOwner=profile;fill();
      note(assignments.length+' original active route assignments. Device capture never creates a server receipt.');await render();});
    jobs.onchange=()=>{selected=jobs.value;};
    save.onclick=()=>run(async()=>{const assignment=assignments.find(x=>x.dispatch===selected);
      if(!assignment||!file.files?.[0])throw Error('Select one original assigned job and one supported photo or document.');
      const result=await stage(file.files[0],assignment.id,assignment.number,assignment.dispatch);
      note(result.duplicate?'File already stored for this work order. Existing intent retained.':'LOCAL ONLY: captured in device storage. No server upload or proof-media receipt.');
      file.value='';await render();});
    document.addEventListener('ywi:auth-changed',()=>{resetSession();fill();render();});
    render();
  }
  window.YWI433=Object.freeze({validateFile,checkOriginalAssignment,receiptStatus,stage,replay,acceptServerReceipt,owned});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
