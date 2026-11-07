/* Build 541 — explicit owner-only local CI custody/renewal review.
 * Never makes network calls, saves secrets, stores browser state or closes an
 * original GitHub alert. The original Actions metadata is external authority.
 */
'use strict';
(function(){
  const core=window.YWICiCustodyCore541,prior=window.YWICiSloCore540;
  if(!core||!prior)return;
  function mount(){
    const owner=document.getElementById('ownerCommand350');
    const earlier=document.getElementById('owner540CiSlo');
    if(!owner||!earlier||document.getElementById('owner541Custody'))return;
    const section=document.createElement('section');section.id='owner541Custody';
    section.className='admin-panel-block yw541-custody';section.dataset.build='541';
    section.setAttribute('aria-labelledby','yw541Title');
    section.innerHTML=`<header class="yw541-head"><div>
      <span class="yw541-kicker">Yard Workers · Owner / Build 541</span>
      <h4 id="yw541Title">CI evidence custody &amp; renewal</h4>
      <p>Cross-check original release JSON bytes, review a separately held copy, and retain owner decisions without changing GitHub releases or alert history.</p>
      </div><span id="yw541Badge" class="yw541-pill">Awaiting source readback</span></header>
      <div class="yw541-files">
        <label>Original Actions audit <input type="file" id="yw541Audit" accept=".json" /></label>
        <label>Original owner archive <input type="file" id="yw541Archive" accept=".json" /></label>
        <label>Retention receipt <input type="file" id="yw541Receipt" accept=".json" /></label>
        <label>Build 541 CI checkpoint <input type="file" id="yw541Checkpoint" accept=".json" /></label>
      </div>
      <div class="yw541-actions"><button type="button" id="yw541Verify">Cross-check four original files</button>
        <a href="https://github.com/RosevearCreations/yw/actions/workflows/post-promotion-dev-reconciliation.yml" target="_blank" rel="noopener noreferrer">Open original post-promotion runs</a></div>
      <p id="yw541SourceStatus" class="yw541-status" role="status" aria-live="polite">No original evidence read. Import all four JSON files from the same exact-main Actions artifact.</p>
      <div class="yw541-copy"><label>Independently saved second archive copy
        <input type="file" id="yw541Second" accept=".json" aria-describedby="yw541CopyHint" /></label>
        <button type="button" id="yw541Compare" disabled>Read back second copy</button>
        <p id="yw541CopyHint">Choose the archive again from a different owner-controlled location or device. The file chooser does not prove separate custody.</p>
        <p id="yw541CopyStatus" role="status" aria-live="polite">Second copy has not been compared.</p></div>
      <div class="yw541-grid"><section><h5>Retention renewal</h5><p id="yw541Expiry">Actual GitHub artifact expiry must be checked in its artifact listing.</p>
        <label class="yw541-confirm"><input type="checkbox" id="yw541Confirm" /> We have separately saved and reviewed the second owner copy, know GitHub expiry is unchanged, and accept that this is a self-attested review.</label>
        <button type="button" id="yw541Renew" disabled>Download owner renewal review</button>
        <p id="yw541RenewStatus" role="status" aria-live="polite">No owner renewal decision recorded.</p>
        <label class="yw541-restore">Restore a previous owner review JSON
          <input type="file" id="yw541Previous" accept=".json" /></label>
        <button type="button" id="yw541Restore" disabled>Verify and restore alert follow-up</button>
      </section><section><h5>Alert lifecycle · last six imported releases</h5>
        <p>Repeated alerts are grouped; an owner decision never closes a GitHub failure. Missing releases remain unknown.</p>
        <div id="yw541Alerts" aria-live="polite">No verified alert history imported.</div></section></div>
      <p class="yw541-warning">Boundary: matching SHA-256 files verifies local byte consistency only. Independent source issuer authentication, external archive custody, and owner digital signatures are <strong>unverified</strong>. Renewing this owner review does not extend GitHub's 30-day retention period. No production, communications, device or release actions are enabled.</p>`;
    earlier.after(section);
    const $=id=>section.querySelector('#'+id);
    let bundle=null,secondCopy=false,records=[],decisions=new Map();
    const status=(id,message,error=false)=>{const el=$(id);el.textContent=message;el.dataset.error=error?'true':'false';};
    const selected=async id=>{
      const file=$(id).files?.[0];
      if(!file||!file.size||file.size>core.MAX)throw Error(`${id}: select a nonempty JSON file at most 1 MB.`);
      return file.text();
    };
    function render(){
      $('yw541Badge').textContent=bundle?'Original files matched · independent custody HOLD':'Awaiting source readback';
      $('yw541Compare').disabled=!bundle;
      $('yw541Renew').disabled=!(bundle&&secondCopy&&$('yw541Confirm').checked);
      $('yw541Restore').disabled=!bundle;
      const expiry=bundle?.checkpoint?.estimatedArtifactExpiryAt;
      $('yw541Expiry').textContent=expiry?
        `Original Actions audit suggests expiry around ${new Date(expiry).toLocaleString()}; check actual artifact expiry on GitHub. This review cannot extend that deadline.`:
        'Actual GitHub artifact expiry must be checked in its artifact listing.';
      const host=$('yw541Alerts');host.replaceChildren();
      const alerts=core.alertLifecycle(records,[...decisions].map(([code,action])=>({code,action})));
      if(!records.length){host.textContent='No verified alert history imported.';return;}
      if(!alerts.length){host.textContent='No alerts in the imported six-release window. Missing releases are not assumed clear.';return;}
      for(const alert of alerts){
        const row=document.createElement('div');row.className='yw541-alert';
        const body=document.createElement('p');body.textContent=
          `${alert.code.replaceAll('_',' ')} · ${alert.occurrences} imported release(s) · ${alert.observedState.replaceAll('_',' ').toLowerCase()}. No externally verified closure.`;
        const label=document.createElement('label');label.textContent='Owner follow-up ';
        const select=document.createElement('select');select.setAttribute('aria-label',`Owner follow-up for ${alert.code}`);
        for(const [value,title] of [['UNREVIEWED','Not reviewed'],['ACKNOWLEDGED','Acknowledged'],
          ['INVESTIGATING','Investigating'],['CLOSURE_REVIEW_REQUESTED','Request independent closure review']]){
          const option=document.createElement('option');option.value=value;option.textContent=title;select.append(option);
        }
        select.value=decisions.get(alert.code)??'UNREVIEWED';
        select.addEventListener('change',()=>{if(select.value==='UNREVIEWED')decisions.delete(alert.code);
          else decisions.set(alert.code,select.value);status('yw541RenewStatus','Owner alert follow-up changed locally. Download a review to preserve it.');});
        label.append(select);row.append(body,label);host.append(row);
      }
    }
    $('yw541Verify').addEventListener('click',async()=>{
      let candidate;
      try{candidate=await core.verifyBundle({auditRaw:await selected('yw541Audit'),
        archiveRaw:await selected('yw541Archive'),receiptRaw:await selected('yw541Receipt'),
        checkpointRaw:await selected('yw541Checkpoint')});
        records=prior.mergeRecords(records,[candidate.record]);
      }catch(error){status('yw541SourceStatus',`Readback refused; prior evidence preserved: ${error.message}`,true);return;}
      bundle=candidate;secondCopy=false;$('yw541Confirm').checked=false;
      status('yw541SourceStatus',`Four files matched for original Actions run #${bundle.record.runId}, SHA ${bundle.record.sha.slice(0,12)}. ${records.length} distinct imported release(s). Source authentication and external custody remain unverified.`);
      status('yw541CopyStatus','Select and read back a separately held second archive copy.');render();
    });
    $('yw541Compare').addEventListener('click',async()=>{
      try{await core.compareIndependentCopy(bundle,await selected('yw541Second'));secondCopy=true;
        status('yw541CopyStatus','SHA-256 and original records match in both owner-selected copies. Storage independence is owner-attested, not automatically verified.');
      }catch(error){secondCopy=false;status('yw541CopyStatus',`Second-copy readback refused: ${error.message}`,true);}
      render();
    });
    $('yw541Confirm').addEventListener('change',render);
    $('yw541Renew').addEventListener('click',async()=>{
      try{
        const review=await core.sealOwnerReview(bundle,{copyCompared:secondCopy,
          ownerAcknowledged:$('yw541Confirm').checked,records,
          alertDecisions:[...decisions].map(([code,action])=>({code,action}))});
        const source=JSON.stringify(review,null,2)+'\n';
        const url=URL.createObjectURL(new Blob([source],{type:'application/json'}));
        const link=document.createElement('a');link.href=url;
        link.download=`yard-workers-owner-custody-review-541-${bundle.record.runId}.json`;
        document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
        status('yw541RenewStatus','Owner review exported. Preserve its two source copies and original Actions evidence separately; this is not an external signature or GitHub retention extension.');
      }catch(error){status('yw541RenewStatus',`Owner review not exported: ${error.message}`,true);}
    });
    $('yw541Restore').addEventListener('click',async()=>{
      try{
        const previous=await core.openOwnerReview(JSON.parse(await selected('yw541Previous')),bundle);
        const current=new Set(core.alertLifecycle(records).map(alert=>alert.code));
        if(previous.originalAlertStates.some(a=>!current.has(a.code)))
          throw Error('Prior owner review contains an alert not present in these original release records.');
        decisions=new Map(previous.originalAlertStates.filter(a=>a.ownerAction!=='UNREVIEWED')
          .map(a=>[a.code,a.ownerAction]));
        render();
        status('yw541RenewStatus','Previous owner review digest and exact source identity verified; saved follow-up choices restored. This is not independent owner-signature proof.');
      }catch(error){status('yw541RenewStatus',`Prior owner review rejected: ${error.message}`,true);}
    });
    render();
  }
  const owner=window.YWIOwnerManagementCommandUI;
  if(owner?.mount){const original=owner.mount;
    owner.mount=function(...args){const result=original.apply(this,args);mount();return result;};}
  mount();window.YWIOwnerCiCustody541={mount};
})();
