/* File: js/module-access-ui.js
   Admin module permission editor.
   Uses the dedicated Admin I.T. control endpoint so profile/module management does not depend
   on the large legacy admin-directory runtime. Admin profiles are immutable break-glass manage.
*/

'use strict';

(function () {
  const state = { payload:null, loading:false, selectedProfileId:'', saving:false, error:'' };
  const MODULES = ['safety','finance','jobs','admin'];
  const LABELS = { safety:'Safety / OHSA', finance:'Finance', jobs:'Jobs', admin:'Admin' };
  const LEVELS = ['hidden','view','create','approve','manage'];
  const byId = (id) => document.getElementById(id);
  const esc = (value) => window.YWIAPI?.escHtml?.(value) || String(value ?? '');
  function auth() { return window.YWI_AUTH?.getState?.() || {}; }
  function isAdmin() { return String(auth().role || '').toLowerCase() === 'admin'; }

  function ensureItAssets(){
    if(!document.querySelector('link[data-ywi-it-readiness]')){
      const link=document.createElement('link');
      link.rel='stylesheet'; link.href='/it-readiness.css?v=2026-09-01h'; link.dataset.ywiItReadiness='1';
      document.head.appendChild(link);
    }
    if(!document.querySelector('script[data-ywi-it-readiness]')){
      const script=document.createElement('script');
      script.src='/js/it-readiness-ui.js?v=2026-09-01h'; script.async=false; script.dataset.ywiItReadiness='1';
      document.head.appendChild(script);
    }
  }

  function rows() { return Array.isArray(state.payload?.module_permission_profiles) ? state.payload.module_permission_profiles : []; }
  function overrides() { return Array.isArray(state.payload?.module_permission_overrides) ? state.payload.module_permission_overrides : []; }
  function defaults() { return Array.isArray(state.payload?.module_role_defaults) ? state.payload.module_role_defaults : []; }
  function integrity() { return Array.isArray(state.payload?.admin_module_access_integrity) ? state.payload.admin_module_access_integrity : []; }

  function profile() { return rows().find((row) => String(row.id) === String(state.selectedProfileId)) || rows()[0] || null; }
  function normalizedRole(role) { const clean=String(role||'employee').toLowerCase(); return ['worker','staff'].includes(clean)?'employee':clean; }
  function overrideFor(profileId,moduleKey) { return overrides().find((row)=>String(row.profile_id)===String(profileId)&&row.module_key===moduleKey) || null; }
  function defaultFor(role,moduleKey) { return defaults().find((row)=>normalizedRole(row.role)===normalizedRole(role)&&row.module_key===moduleKey)?.access_level || 'hidden'; }
  function integrityFor(profileId){ return integrity().find((row)=>String(row.profile_id)===String(profileId)) || null; }

  function accessCard(p,moduleKey) {
    const isBreakGlass=normalizedRole(p.role)==='admin';
    const o = overrideFor(p.id,moduleKey);
    const d = defaultFor(p.role,moduleKey);
    const effective = isBreakGlass ? 'manage' : (o?.access_level || d);
    return `<label class="module-access-card"><span><strong>${esc(LABELS[moduleKey])}</strong><small>Role default: ${esc(d)} · Effective: ${esc(effective)}${isBreakGlass ? ' · admin break-glass' : (o ? ' · profile override' : '')}</small></span><select data-module-access="${moduleKey}" ${isBreakGlass ? 'disabled title="Admin always has manage access."' : ''}><option value="inherit"${o ? '' : ' selected'}>Use role default (${esc(d)})</option>${LEVELS.map((level)=>`<option value="${level}"${o?.access_level===level?' selected':''}>${level}</option>`).join('')}</select></label>`;
  }

  function render() {
    const host=byId('moduleAccessManager');
    if (!host) return;
    if (!isAdmin()) { host.hidden=true; return; }
    host.hidden=false;
    if (state.loading) { host.innerHTML='<div class="module-access-loading">Loading module permissions and active profiles…</div>'; return; }
    if (!state.payload) {
      host.innerHTML=`${state.error?`<div class="notice">${esc(state.error)}</div>`:''}<button id="moduleAccessLoad" type="button">Load module access manager</button>`;
      byId('moduleAccessLoad')?.addEventListener('click',()=>load(true)); return;
    }
    const people=rows();
    if (!state.selectedProfileId && people[0]?.id) state.selectedProfileId=String(people[0].id);
    if (state.selectedProfileId && !people.some((row)=>String(row.id)===String(state.selectedProfileId))) state.selectedProfileId=String(people[0]?.id||'');
    const p=profile();
    const breakGlass=p&&normalizedRole(p.role)==='admin';
    const accessIntegrity=p?integrityFor(p.id):null;
    const sourceErrors=Array.isArray(state.payload?.source_errors)?state.payload.source_errors:[];
    host.innerHTML=`<div class="module-access-heading"><div><span class="module-kicker">Admin access control</span><h3>Module permissions</h3><p>Choose exactly which top-level modules a person can see. Role still controls approval seniority inside an allowed module. Admin accounts are fixed at manage across every module.</p></div><div class="section-graphic-placeholder module-access-graphic"><span aria-hidden="true">⌘</span><strong>Access map placeholder</strong><small>Future visual: approved role/module matrix diagram.</small></div></div>
      ${sourceErrors.length?`<div class="notice">Runtime source warning: ${esc(sourceErrors.join(' · '))}</div>`:''}
      <div class="module-access-toolbar"><label>Profile<select id="moduleAccessProfile">${people.map((row)=>`<option value="${esc(row.id)}"${String(row.id)===String(state.selectedProfileId)?' selected':''}>${esc(row.full_name||row.username||row.email||row.id)} · ${esc(row.role||'employee')}</option>`).join('')}</select></label><button id="moduleAccessRefresh" type="button" class="secondary">Refresh</button></div>
      ${p?`<div class="module-access-grid">${MODULES.map((key)=>accessCard(p,key)).join('')}</div>
      ${breakGlass?`<div class="module-access-note"><strong>Admin break-glass:</strong> this profile has permanent manage access to Safety, Finance, Jobs, and Admin.${accessIntegrity?.all_modules_manage===true?' Database integrity check is green.':' Refresh I.T. Readiness if the database integrity check is not green.'}</div>`:`<label class="operations-span">Change reason<input id="moduleAccessReason" maxlength="300" placeholder="Example: Safety-only field account" /></label>
      <div class="module-access-actions"><button id="moduleAccessSave" type="button">Save module overrides</button><button id="moduleAccessSafetyOnly" type="button" class="secondary">Set Safety-only</button><button id="moduleAccessReset" type="button" class="secondary">Reset all to role defaults</button></div>
      <div class="module-access-note"><strong>Server enforcement:</strong> hidden modules are removed from navigation and protected APIs also deny access.</div>`}`:'<div class="finance-empty"><strong>No profiles were returned.</strong><br />The dedicated admin-it-control function requires the current module tables and release-authority schema. Use Admin → I.T. Readiness after deployment to diagnose runtime drift.</div>'}`;
    byId('moduleAccessProfile')?.addEventListener('change',(e)=>{state.selectedProfileId=e.target.value;render();});
    byId('moduleAccessRefresh')?.addEventListener('click',()=>load(true));
    byId('moduleAccessSave')?.addEventListener('click',save);
    byId('moduleAccessSafetyOnly')?.addEventListener('click',()=>preset('safety_only'));
    byId('moduleAccessReset')?.addEventListener('click',()=>preset('reset_all'));
  }

  async function callControl(body,timeoutMs=30000){
    return window.YWIAPI?.jsonFetch?.('admin-it-control',{method:'POST',body,requireAuth:true,timeoutMs});
  }

  async function load(force=false){
    if(!isAdmin()||state.loading)return;
    if(state.payload&&!force){render();return;}
    state.loading=true;state.error='';render();
    try{
      const payload=await callControl({action:'module_permissions'},30000);
      if(!payload?.ok && !Array.isArray(payload?.module_permission_profiles)) throw new Error(payload?.error||'Module permission endpoint failed.');
      state.payload=payload;
    }
    catch(err){state.payload=null;state.error=err?.message||'Unable to load module permissions.';}
    finally{state.loading=false;render();}
  }

  async function save(){
    const p=profile();if(!p||state.saving||normalizedRole(p.role)==='admin')return;
    state.saving=true;
    const reason=byId('moduleAccessReason')?.value?.trim()||'Updated from Module Permissions.';
    const changes=MODULES.map((moduleKey)=>({module_key:moduleKey,access_level:document.querySelector(`[data-module-access="${moduleKey}"]`)?.value||'inherit'}));
    try{
      const payload=await callControl({action:'save_module_permissions',profile_id:p.id,changes,permission_reason:reason});
      if(!payload?.module_permission_profiles)throw new Error(payload?.error||'Module permissions could not be saved.');
      state.payload=payload;
      document.dispatchEvent(new CustomEvent('ywi:module-access-admin-updated',{detail:{profile_id:p.id}}));
    }catch(err){alert(err?.message||'Module permissions could not be saved.');}
    finally{state.saving=false;render();}
  }

  async function preset(name){
    const p=profile();if(!p||state.saving||normalizedRole(p.role)==='admin')return;
    const label=name==='safety_only'?'Safety-only':'role defaults';
    if(!confirm(`Set ${p.full_name||p.username||p.email||'this profile'} to ${label}?`))return;
    state.saving=true;
    try{
      const payload=await callControl({action:'preset_module_permissions',profile_id:p.id,preset:name,permission_reason:`${label} preset from Module Permissions.`});
      if(!payload?.module_permission_profiles)throw new Error(payload?.error||'Preset could not be applied.');
      state.payload=payload;
      document.dispatchEvent(new CustomEvent('ywi:module-access-admin-updated',{detail:{profile_id:p.id,preset:name}}));
    }
    catch(err){alert(err?.message||'Preset could not be applied.');}
    finally{state.saving=false;render();}
  }

  function inject(){
    ensureItAssets();
    const admin=byId('admin');if(!admin||byId('moduleAccessManager'))return;
    const heading=admin.querySelector('.section-heading')||admin.querySelector('h2');
    const shell=document.createElement('section');shell.id='moduleAccessManager';shell.className='module-access-manager admin-panel-block';shell.hidden=true;
    if(heading?.parentNode) heading.insertAdjacentElement('afterend',shell); else admin.prepend(shell);
    render();
  }

  ensureItAssets();
  document.addEventListener('DOMContentLoaded',inject);
  document.addEventListener('ywi:auth-changed',()=>{inject();state.payload=null;state.error='';render();if(document.getElementById('admin')?.classList.contains('active')&&isAdmin())load(false);});
  document.addEventListener('ywi:route-shown',(e)=>{if(e?.detail?.allowed==='admin'&&isAdmin())load(false);});
})();
