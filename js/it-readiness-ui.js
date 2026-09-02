/* File: js/it-readiness-ui.js
   Admin I.T. readiness and release-authority cockpit.
   Consolidates schema/preflight/deployment/function/recovery/runtime/SEO readiness,
   exact source/CI evidence, and admin access-integrity evidence without turning I.T. into a fifth module.
*/

'use strict';

(function () {
  const state = { payload:null, loading:false, smoke:null, smokeLoading:false };
  const byId = (id) => document.getElementById(id);
  const esc = (value) => window.YWIAPI?.escHtml?.(value) || String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

  function auth() { return window.YWI_AUTH?.getState?.() || {}; }
  function isAdmin() { return String(auth().role || '').toLowerCase() === 'admin'; }

  function statusValue(row) {
    if (!row || typeof row !== 'object') return 'unknown';
    for (const key of ['status','check_status','readiness_status','gate_status','drift_status','assertion_status','health_status','result','state','release_authority_status','source_gate_status','repository_enforcement_status']) {
      if (row[key] !== undefined && row[key] !== null) return String(row[key]).trim().toLowerCase();
    }
    for (const key of ['ok','passed','ready','is_ready','is_current','healthy']) {
      if (typeof row[key] === 'boolean') return row[key] ? 'passed' : 'error';
    }
    return 'unknown';
  }

  function statusClass(value) {
    const status = String(value || 'unknown').toLowerCase();
    if (/green|passed|pass|current|ready|healthy|success|complete/.test(status)) return 'passed';
    if (/amber|warning|warn|review|pending|attention/.test(status)) return 'warning';
    if (/red|fail|error|critical|blocked|behind|missing|unhealthy|not_ready/.test(status)) return 'error';
    return 'unknown';
  }

  function statusChip(value) {
    const clean = String(value || 'unknown').replaceAll('_',' ');
    return `<span class="it-readiness-status ${statusClass(value)}">${esc(clean)}</span>`;
  }

  function rowTitle(row, fallback='Readiness check') {
    for (const key of ['check_title','title','label','name','check_name','gate_name','setting_name','assertion_key','check_key','task_title','page_path','function_name','scope_key','source_branch']) {
      if (row?.[key]) return String(row[key]);
    }
    return fallback;
  }

  function rowDetail(row) {
    for (const key of ['release_message','message','details','description','action_hint','failure_hint','readiness_message','next_action_hint','resolution_hint','notes','route_hint','evidence_note','source_sha']) {
      const value=row?.[key];
      if (value !== undefined && value !== null && String(value).trim()) {
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    }
    return '';
  }

  function renderRows(section, fallbackTitle) {
    if (!section) return '<div class="it-readiness-empty">No readiness source returned.</div>';
    if (section.error) return `<div class="it-readiness-error">${esc(section.error)}</div>`;
    const rows=Array.isArray(section.rows)?section.rows:[];
    if (!rows.length) return '<div class="it-readiness-empty">No current rows. This can be healthy for queues that only contain exceptions.</div>';
    return `<div class="it-readiness-list">${rows.slice(0,30).map((row)=>{
      const st=statusValue(row);
      return `<div class="it-readiness-row"><div><strong>${esc(rowTitle(row,fallbackTitle))}</strong>${rowDetail(row)?`<small>${esc(rowDetail(row))}</small>`:''}</div>${statusChip(st)}</div>`;
    }).join('')}</div>${rows.length>30?`<small>Showing 30 of ${rows.length} rows.</small>`:''}`;
  }

  function panel(key,title,subtitle) {
    const section=state.payload?.sections?.[key];
    const summary=section?.summary || {};
    return `<section class="it-readiness-panel"><span class="it-readiness-kicker">${esc(title)}</span><h3>${esc(subtitle)}</h3><p>${Number(summary.blocking||0)} blocking · ${Number(summary.warning||0)} warning · ${Number(summary.total||0)} row(s)</p>${renderRows(section,subtitle)}</section>`;
  }

  function renderAssertions() {
    const groups=state.payload?.security_assertions || {};
    const rows=[
      ...(Array.isArray(groups.module)?groups.module:[]),
      ...(Array.isArray(groups.it)?groups.it:[]),
      ...(Array.isArray(groups.release_authority)?groups.release_authority:[]),
    ];
    const errors=Array.isArray(groups.errors)?groups.errors:[];
    return `<section class="it-readiness-panel"><span class="it-readiness-kicker">Security proof</span><h3>Module, I.T., and release-authority assertions</h3>${errors.length?errors.map((e)=>`<div class="it-readiness-error">${esc(e)}</div>`).join(''):''}${rows.length?`<div class="it-readiness-list">${rows.map((row)=>`<div class="it-readiness-row"><div><strong>${esc(row.assertion_key||'assertion')}</strong><small>${esc(row.details||'')}</small></div>${statusChip(row.assertion_status)}</div>`).join('')}</div>`:'<div class="it-readiness-empty">No assertion rows returned.</div>'}</section>`;
  }

  function renderAdminIntegrity() {
    const rows=(state.payload?.sections?.admin_access_integrity?.rows || []).filter((row)=>String(row?.role||'').toLowerCase()==='admin');
    return `<section class="it-readiness-panel"><span class="it-readiness-kicker">Access integrity</span><h3>Admin break-glass access</h3><p>Every active admin must resolve to <strong>manage</strong> on Safety, Finance, Jobs, and Admin.</p>${rows.length?`<div class="it-readiness-list">${rows.map((row)=>{
      const ok=row.all_modules_manage===true;
      return `<div class="it-readiness-row"><div><strong>${esc(row.profile_label||row.profile_id||'Admin')}</strong><small>Safety ${esc(row.safety_access)} · Finance ${esc(row.finance_access)} · Jobs ${esc(row.jobs_access)} · Admin ${esc(row.admin_access)}</small></div>${statusChip(ok?'passed':'error')}</div>`;
    }).join('')}</div>`:'<div class="it-readiness-error">No active admin integrity rows were returned.</div>'}</section>`;
  }

  function renderSmoke() {
    if (state.smokeLoading) return '<div class="it-readiness-loading">Running authenticated browser smoke checks…</div>';
    if (!state.smoke) return '<div class="it-readiness-empty">Browser smoke has not been run in this session.</div>';
    const checks=Array.isArray(state.smoke.checks)?state.smoke.checks:[];
    return `<div class="it-readiness-list">${checks.map((row)=>`<div class="it-readiness-row"><div><strong>${esc(row.scope||'browser check')}</strong><small>${esc(row.message||'')}</small></div>${statusChip(row.ok?'passed':'error')}</div>`).join('')}</div>`;
  }

  function render() {
    const host=byId('itReadinessWorkspace');
    if(!host)return;
    if(!isAdmin()) { host.innerHTML='<div class="it-readiness-error">Admin manage access is required for I.T. Readiness.</div>'; return; }
    if(state.loading){host.innerHTML='<div class="it-readiness-loading">Loading I.T. readiness evidence…</div>';return;}
    if(!state.payload){host.innerHTML='<div class="it-readiness-empty"><button id="itReadinessLoad" type="button">Load I.T. readiness</button></div>';byId('itReadinessLoad')?.addEventListener('click',()=>load(true));return;}

    const s=state.payload.summary||{};
    const overall=String(s.overall_status||'unknown').toLowerCase();
    const schema=`${Number(s.latest_applied_schema_version||0)} / ${Number(s.expected_schema_version||0)}`;
    const sourceSha=s.source_sha?String(s.source_sha).slice(0,12):'not recorded';
    host.innerHTML=`<div class="it-readiness-shell">
      <div class="it-readiness-hero">
        <section class="it-readiness-summary">
          <span class="it-readiness-kicker">Release authority control plane</span>
          <h2>I.T. Readiness</h2>
          <p>Preflight, preparedness, deployment, recovery, runtime, access, exact source/CI evidence, and public-release checks in one Admin-only workspace.</p>
          ${statusChip(overall)}
          <div class="it-readiness-metrics">
            <div class="it-readiness-metric"><strong>${esc(schema)}</strong><span>DB schema applied / expected</span></div>
            <div class="it-readiness-metric"><strong>${esc(sourceSha)}</strong><span>recorded main source SHA</span></div>
            <div class="it-readiness-metric"><strong>${esc(s.source_gate_status||'unknown')}</strong><span>main source gate</span></div>
            <div class="it-readiness-metric"><strong>${esc(s.repository_enforcement_status||'unknown')}</strong><span>repository enforcement</span></div>
            <div class="it-readiness-metric"><strong>${Number(s.active_admin_count||0)}</strong><span>active admins checked</span></div>
            <div class="it-readiness-metric"><strong>${Number(s.admin_access_integrity_blockers||0)}</strong><span>admin access blockers</span></div>
            <div class="it-readiness-metric"><strong>${Number(s.readiness_blockers||0)+Number(s.assertion_blockers||0)}</strong><span>readiness/security blockers</span></div>
            <div class="it-readiness-metric"><strong>${esc(s.production_promotion_mode||'manual')}</strong><span>production promotion</span></div>
          </div>
          <div class="it-readiness-actions"><button id="itReadinessRefresh" type="button">Refresh readiness</button><button id="itReadinessSmoke" type="button" class="secondary">Run browser smoke check</button></div>
        </section>
        <aside class="it-readiness-visual" aria-label="I.T. readiness visual placeholder"><div class="it-visual-icon" aria-hidden="true">⌁</div><strong>I.T. readiness map placeholder</strong><small>Future approved visual: dependency map showing Source → Database → Functions → Client → Release gates.</small></aside>
      </div>
      <div class="it-readiness-grid">
        ${panel('release_authority','Release authority','Application release authority')}
        ${panel('release_source_evidence','Source evidence','Exact main SHA / CI evidence')}
        ${renderAdminIntegrity()}
        ${renderAssertions()}
        ${panel('schema_drift','Database','Schema drift')}
        ${panel('schema_preflight','Preflight','Schema preflight checks')}
        ${panel('deployment_checklist','Deployment','Deployment checklist')}
        ${panel('function_readiness','Functions','Edge Function readiness')}
        ${panel('production_readiness','Release','Production readiness')}
        ${panel('deployment_gate','Release gate','Deployment gate status')}
        ${panel('backup_restore','Recovery','Backup / restore preparedness')}
        ${panel('runtime_health','Runtime','Runtime and error health')}
        ${panel('admin_tasks','Operations','Admin task inbox')}
        ${panel('public_seo','SEO','Public SEO release checks')}
      </div>
      <section class="it-readiness-panel it-readiness-smoke"><span class="it-readiness-kicker">Client proof</span><h3>Authenticated browser smoke</h3><p>Runs the current browser-side config, API, session, and one-H1 checks without changing business data.</p>${renderSmoke()}</section>
    </div>`;

    byId('itReadinessRefresh')?.addEventListener('click',()=>load(true));
    byId('itReadinessSmoke')?.addEventListener('click',runSmoke);
  }

  async function load(force=false){
    if(!isAdmin()||state.loading)return;
    if(state.payload&&!force){render();return;}
    state.loading=true;render();
    try{
      const payload=await window.YWIAPI?.jsonFetch?.('admin-it-control',{method:'POST',body:{action:'it_readiness'},requireAuth:true,timeoutMs:45000});
      if(!payload)throw new Error('I.T. readiness endpoint returned no data.');
      state.payload=payload;
    }catch(err){
      state.payload={summary:{overall_status:'red',expected_schema_version:0,latest_applied_schema_version:0,release_authority_status:'unknown',source_gate_status:'unknown',repository_enforcement_status:'unknown',active_admin_count:0,admin_access_integrity_blockers:1,readiness_blockers:1,assertion_blockers:0},sections:{},security_assertions:{module:[],it:[],release_authority:[],errors:[err?.message||'Unable to load I.T. readiness.']}};
    }finally{state.loading=false;render();}
  }

  async function runSmoke(){
    if(state.smokeLoading)return;
    state.smokeLoading=true;render();
    try{state.smoke=await window.YWIAPI?.runSmokeCheck?.();}
    catch(err){state.smoke={ok:false,checks:[{scope:'browser-smoke',ok:false,message:err?.message||'Browser smoke failed.'}]};}
    finally{state.smokeLoading=false;render();}
  }

  function inject(){
    const main=document.querySelector('main.container');
    if(!main||byId('it'))return;
    const section=document.createElement('section');
    section.id='it';
    section.className='card';
    section.innerHTML='<div id="itReadinessWorkspace" class="it-readiness-loading">I.T. Readiness is available to Admin accounts.</div>';
    const admin=byId('admin');
    if(admin?.parentNode===main)admin.insertAdjacentElement('afterend',section);else main.appendChild(section);
    render();
  }

  function init(){inject();}
  document.addEventListener('DOMContentLoaded',init);
  document.addEventListener('ywi:auth-changed',()=>{inject();state.payload=null;state.smoke=null;render();});
  document.addEventListener('ywi:route-shown',(e)=>{if(e?.detail?.allowed==='it'&&isAdmin())load(false);});
  window.YWIITReadiness={load,render};
})();
