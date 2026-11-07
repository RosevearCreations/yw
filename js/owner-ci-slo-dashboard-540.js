/* Build 540 — owner Management Command read-only CI SLO dashboard.
 * Imports owner-supplied original audit JSON. No tokens, background requests,
 * browser persistence or production mutations.
 */
'use strict';
(function(){
  const core=window.YWICiSloCore540;
  if(!core)return;
  const seconds=n=>Number.isInteger(n)?`${n}s`:'—';
  function mount(){
    const owner=document.getElementById('ownerCommand350');
    const anchor=document.getElementById('owner350Status');
    if(!owner||!anchor||document.getElementById('owner540CiSlo'))return;
    const section=document.createElement('section');
    section.id='owner540CiSlo';section.dataset.build='540';
    section.className='admin-panel-block yw540-ci';
    section.setAttribute('aria-labelledby','yw540Title');
    section.innerHTML=`
      <header class="yw540-header">
        <div><span class="yw540-kicker">Yard Workers · Management / Build 540</span>
          <h4 id="yw540Title">CI release SLOs &amp; evidence history</h4>
          <p>Review original GitHub Actions audit exports, runner handoff, source-step gaps and protected release throughput. Display only; no deployment actions.</p>
        </div><span id="yw540EvidenceBadge" class="yw540-badge">No evidence loaded</span>
      </header>
      <div class="yw540-toolbar">
        <label class="yw540-upload" for="yw540Import">Import audit or owner archive JSON
          <input id="yw540Import" type="file" accept=".json,application/json" multiple aria-describedby="yw540ImportHint" />
        </label>
        <button id="yw540Export" class="secondary" type="button" disabled>Download owner evidence archive</button>
        <button id="yw540Clear" class="secondary" type="button" disabled>Clear this session</button>
        <a href="https://github.com/RosevearCreations/yw/actions/workflows/staging-browser-integration.yml" target="_blank" rel="noopener noreferrer">Original CI runs</a>
      </div>
      <p id="yw540ImportHint" class="yw540-muted">Download <strong>ci-runtime-audit.json</strong> from the successful “Build 530–541” post-promotion Actions artifact, then import it here. Up to 16 JSON files per import, 1 MB each. Nothing is uploaded.</p>
      <p id="yw540Status" class="yw540-status" role="status" aria-live="polite" aria-atomic="true">No original audit imported. Current production health is not inferred.</p>
      <div class="yw540-metrics" id="yw540Metrics" aria-label="Latest imported CI metrics"></div>
      <div class="yw540-split">
        <section aria-labelledby="yw540TrendTitle"><h5 id="yw540TrendTitle">Rolling six-release performance</h5><div id="yw540Trend" class="yw540-info">Import verified source evidence to see the recent release window.</div></section>
        <section aria-labelledby="yw540AlertsTitle"><h5 id="yw540AlertsTitle">Repeated SLO alerts</h5><div id="yw540Alerts" class="yw540-info">No alert evidence loaded. This is not proof of zero alerts.</div></section>
      </div>
      <div class="yw540-history"><h5>Owner evidence archive</h5>
        <p id="yw540ArchiveCount" class="yw540-muted">No retained records in this session.</p>
        <div class="yw540-scroll"><table><thead><tr><th scope="col">Original Actions run</th><th scope="col">Handoff</th><th scope="col">Step gap</th><th scope="col">Release P95</th><th scope="col">Evidence state</th></tr></thead><tbody id="yw540Rows"></tbody></table></div>
      </div>
      <p class="yw540-boundary">Imported JSON is owner-supplied and schema-checked, not an independently authenticated live GitHub receipt. SHA-256 detects accidental archive changes but is not a signature. The CI artifact is time-limited; <strong>download and retain the owner archive</strong> for longer custody. Importing, exporting or clearing this view never changes protected gates, customer records or production.</p>`;
    anchor.after(section);
    const $=id=>section.querySelector('#'+id);
    let records=[];
    function metric(label,value,detail){
      const box=document.createElement('div');box.className='yw540-metric';
      const l=document.createElement('span');l.textContent=label;
      const n=document.createElement('strong');n.textContent=value;
      const d=document.createElement('small');d.textContent=detail;
      box.append(l,n,d);return box;
    }
    const status=(message,error=false)=>{
      $('yw540Status').textContent=message;$('yw540Status').dataset.state=error?'error':'information';
    };
    function render(){
      const latest=records[0];
      $('yw540Export').disabled=!records.length;
      $('yw540Clear').disabled=!records.length;
      $('yw540EvidenceBadge').textContent=latest?
        `${records.length} owner-imported release${records.length===1?'':'s'}`:'No evidence loaded';
      $('yw540Metrics').replaceChildren();
      if(latest){
        $('yw540Metrics').append(
          metric('Runner handoff',seconds(latest.runner.handoff),'Latest imported original Actions run'),
          metric('Runner setup',seconds(latest.runner.setup),'Latest imported source job'),
          metric('Source-step gaps',seconds(latest.runner.stepGap),'Latest observed intervals'),
          metric('Historical release P95',seconds(latest.p95.release),'Imported six-release window'));
        const trend=$('yw540Trend');trend.replaceChildren();
        const heading=document.createElement('p');heading.className='yw540-state';
        heading.textContent=latest.sloState.replaceAll('_',' ');trend.appendChild(heading);
        const sample=document.createElement('p');
        sample.textContent=`${latest.samples} distinct verified original releases · handoff P95 ${seconds(latest.p95.handoff)} · setup P95 ${seconds(latest.p95.setup)} · step-gap P95 ${seconds(latest.p95.stepGap)}.`;
        trend.appendChild(sample);
        const drift=document.createElement('p');
        drift.textContent=`Newest three vs preceding three, P95 change: source ${seconds(latest.drift.source)}, warm browser batches ${seconds(latest.drift.warm)}, full release ${seconds(latest.drift.release)}.`;
        trend.appendChild(drift);
      }else{
        $('yw540Metrics').append(metric('Evidence state','Not loaded','Import original Actions audit JSON'));
        $('yw540Trend').textContent='Import verified source evidence to see the recent release window.';
      }
      const alerts=core.dedupeAlerts(records,6),host=$('yw540Alerts');host.replaceChildren();
      const explain=document.createElement('p');
      explain.textContent=records.length?`Last ${Math.min(records.length,6)} imported releases; matching alert codes grouped, not dismissed.`:
        'No alert evidence loaded. This is not proof of zero alerts.';
      host.appendChild(explain);
      if(records.length&&!alerts.length){const p=document.createElement('p');
        p.textContent='No SLO alerts in the imported window. This does not establish the state of missing releases.';host.appendChild(p);}
      for(const alert of alerts){const row=document.createElement('p');row.className='yw540-alert';
        row.textContent=`${alert.code.replaceAll('_',' ')} · ${alert.occurrences} release(s) · maximum overage ${seconds(alert.maxOverSeconds)} · ${alert.repeatState==='REPEATED'?'Repeated: review original evidence':'First observed in this window'}`;
        host.appendChild(row);}
      $('yw540ArchiveCount').textContent=records.length?
        `${records.length} distinct imported release(s); at most ${core.MAX_RECORDS} per portable archive. SHA-256 covers exported records.`:
        'No retained records in this session.';
      const body=$('yw540Rows');body.replaceChildren();
      for(const item of records.slice(0,20)){
        const tr=document.createElement('tr'),link=document.createElement('a');
        link.href=`https://github.com/RosevearCreations/yw/actions/runs/${item.runId}`;
        link.target='_blank';link.rel='noopener noreferrer';link.textContent=`#${item.runId} · ${item.sha.slice(0,8)}`;
        const cell=document.createElement('td');cell.appendChild(link);tr.appendChild(cell);
        for(const value of [seconds(item.runner.handoff),seconds(item.runner.stepGap),
          seconds(item.p95.release),item.sloState.replaceAll('_',' ')]){
          const td=document.createElement('td');td.textContent=value;tr.appendChild(td);
        }body.appendChild(tr);
      }
    }
    $('yw540Import').addEventListener('change',async event=>{
      const files=[...(event.target.files??[])];event.target.value='';
      if(!files.length)return;
      if(files.length>16){status('Import refused: select no more than 16 files at once.',true);return;}
      let next=records;
      try{
        for(const file of files){
          if(!file.size||file.size>core.MAX_BYTES)throw Error('File is empty or exceeds the 1 MB evidence limit.');
          const raw=JSON.parse(await file.text());
          const incoming=raw?.schema===core.ARCHIVE?await core.openArchive(raw):[core.fromAudit(raw)];
          next=core.mergeRecords(next,incoming);
        }
      }catch(error){status(`Import refused, earlier records preserved: ${error.message}`,true);return;}
      records=next;render();
      status(`${files.length} evidence file(s) imported; ${records.length} distinct original release(s) in this session. Verify source links before relying on this view.`);
    });
    $('yw540Export').addEventListener('click',async()=>{
      try{
        const archive=await core.sealArchive(records);
        const data=JSON.stringify(archive,null,2)+'\n';
        if(new TextEncoder().encode(data).length>core.MAX_BYTES)throw Error('Archive exceeds 1 MB; preserve smaller review periods.');
        const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download='yard-workers-ci-slo-owner-archive-540.json';
        document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
        status('Portable SHA-256 integrity-checked archive downloaded. Keep a copy in long-term owner custody; source authenticity is not independently signed.');
      }catch(error){status(`Archive not exported: ${error.message}`,true);}
    });
    $('yw540Clear').addEventListener('click',()=>{records=[];render();
      status('Session review cleared. Files on disk and GitHub Actions evidence were not changed.');});
    render();
  }
  const owner=window.YWIOwnerManagementCommandUI;
  if(owner?.mount){const original=owner.mount;
    owner.mount=function(...args){const result=original.apply(this,args);mount();return result;};}
  mount();
  window.YWIOwnerCiSloDashboard540={mount};
})();
