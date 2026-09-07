/* File: js/module-access-ui.js
   Build 233 People & Access workspace.
   Uses the dedicated Admin I.T. control endpoint so profile/module management does not depend
   on the large legacy admin-directory runtime. The manager now loads only when People & Access
   is actually opened, provides a searchable active-profile overview, and keeps Admin profiles
   immutable break-glass manage across every top-level module.
*/

'use strict';

(function () {
  const ADMIN_HUB_STORAGE = 'ywi_admin_hub_section_v1';
  const state = {
    payload:null,
    loading:false,
    selectedProfileId:'',
    saving:false,
    error:'',
    search:'',
    roleFilter:'all',
    overrideOnly:false
  };
  const MODULES = ['safety','finance','jobs','admin'];
  const LABELS = { safety:'Safety / OHSA', finance:'Finance', jobs:'Jobs', admin:'Admin' };
  const LEVELS = ['hidden','view','create','approve','manage'];
  const byId = (id) => document.getElementById(id);
  const esc = (value) => window.YWIAPI?.escHtml?.(value) || String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

  function auth() { return window.YWI_AUTH?.getState?.() || {}; }
  function isAdmin() { return String(auth().role || '').toLowerCase() === 'admin'; }
  function currentAdminHubSection() {
    try { return String(localStorage.getItem(ADMIN_HUB_STORAGE) || 'home').replace(/^"|"$/g,'').trim().toLowerCase() || 'home'; }
    catch { return 'home'; }
  }
  function peopleWorkspaceOpen() { return currentAdminHubSection() === 'people'; }

  function rows() { return Array.isArray(state.payload?.module_permission_profiles) ? state.payload.module_permission_profiles : []; }
  function overrides() { return Array.isArray(state.payload?.module_permission_overrides) ? state.payload.module_permission_overrides : []; }
  function defaults() { return Array.isArray(state.payload?.module_role_defaults) ? state.payload.module_role_defaults : []; }
  function integrity() { return Array.isArray(state.payload?.admin_module_access_integrity) ? state.payload.admin_module_access_integrity : []; }

  function profile() { return rows().find((row) => String(row.id) === String(state.selectedProfileId)) || rows()[0] || null; }
  function normalizedRole(role) { const clean=String(role||'employee').toLowerCase(); return ['worker','staff'].includes(clean)?'employee':clean; }
  function overrideFor(profileId,moduleKey) { return overrides().find((row)=>String(row.profile_id)===String(profileId)&&row.module_key===moduleKey) || null; }
  function defaultFor(role,moduleKey) { return defaults().find((row)=>normalizedRole(row.role)===normalizedRole(role)&&row.module_key===moduleKey)?.access_level || 'hidden'; }
  function integrityFor(profileId){ return integrity().find((row)=>String(row.profile_id)===String(profileId)) || null; }
  function hasOverride(profileId) { return overrides().some((row)=>String(row.profile_id)===String(profileId)); }
  function effectiveAccess(p,moduleKey) {
    if (!p) return 'hidden';
    if (normalizedRole(p.role)==='admin') return 'manage';
    return overrideFor(p.id,moduleKey)?.access_level || defaultFor(p.role,moduleKey);
  }

  function filteredProfiles() {
    const q=String(state.search||'').trim().toLowerCase();
    return rows().filter((p)=>{
      if (state.roleFilter !== 'all' && normalizedRole(p.role) !== state.roleFilter) return false;
      if (state.overrideOnly && !hasOverride(p.id)) return false;
      if (!q) return true;
      return [p.full_name,p.email,p.role,p.employment_status,p.id].some((value)=>String(value||'').toLowerCase().includes(q));
    });
  }

  function metrics() {
    const people=rows();
    const overrideProfiles=new Set(overrides().map((row)=>String(row.profile_id||'')).filter(Boolean));
    const admins=people.filter((p)=>normalizedRole(p.role)==='admin').length;
    const supervisors=people.filter((p)=>normalizedRole(p.role)==='supervisor').length;
    const integrityBlockers=integrity().filter((row)=>row?.all_modules_manage!==true).length;
    return { people:people.length, admins, supervisors, overrideProfiles:overrideProfiles.size, integrityBlockers };
  }

  function accessCard(p,moduleKey) {
    const isBreakGlass=normalizedRole(p.role)==='admin';
    const o = overrideFor(p.id,moduleKey);
    const d = defaultFor(p.role,moduleKey);
    const effective = isBreakGlass ? 'manage' : (o?.access_level || d);
    return `<label class="module-access-card"><span><strong>${esc(LABELS[moduleKey])}</strong><small>Role default: ${esc(d)} · Effective: ${esc(effective)}${isBreakGlass ? ' · admin break-glass' : (o ? ' · profile override' : '')}</small></span><select data-module-access="${moduleKey}" ${isBreakGlass ? 'disabled title="Admin always has manage access."' : ''}><option value="inherit"${o ? '' : ' selected'}>Use role default (${esc(d)})</option>${LEVELS.map((level)=>`<option value="${level}"${o?.access_level===level?' selected':''}>${level}</option>`).join('')}</select></label>`;
  }

  function profileAccessSummary(p) {
    return MODULES.map((moduleKey)=>`${LABELS[moduleKey]} ${effectiveAccess(p,moduleKey)}`).join(' · ');
  }

  function renderPeopleOverview() {
    const m=metrics();
    const people=filteredProfiles();
    const roles=[...new Set(rows().map((p)=>normalizedRole(p.role)).filter(Boolean))].sort();
    const shown=people.slice(0,60);
    return `<section class="module-access-overview" aria-labelledby="moduleAccessOverviewTitle">
      <div class="module-access-overview-head"><div><span class="module-kicker">People & Access overview</span><h3 id="moduleAccessOverviewTitle">Find a person, then manage the right control</h3><p>Search active profiles, review their effective top-level module access, then open only the staff, assignment, password, or permission control you need.</p></div></div>
      <div class="module-access-metrics" aria-label="People and access summary">
        <article><strong>${m.people}</strong><span>active profiles</span></article>
        <article><strong>${m.admins}</strong><span>admins</span></article>
        <article><strong>${m.supervisors}</strong><span>supervisors</span></article>
        <article><strong>${m.overrideProfiles}</strong><span>profiles with overrides</span></article>
        <article data-state="${m.integrityBlockers?'blocked':'ready'}"><strong>${m.integrityBlockers}</strong><span>admin integrity blockers</span></article>
      </div>
      <div class="module-access-quick-actions">
        <button type="button" class="secondary" data-people-panel="Staff Directory and Access">Staff directory</button>
        <button type="button" class="secondary" data-people-panel="Assignment Workbench">Assignments</button>
        <button type="button" class="secondary" data-people-panel="Admin Password Control">Password control</button>
      </div>
      <div class="module-access-finder">
        <label>Find person<input id="moduleAccessSearch" type="search" value="${esc(state.search)}" placeholder="Name, email, role, employment status…" autocomplete="off" /></label>
        <label>Role<select id="moduleAccessRoleFilter"><option value="all">All roles</option>${roles.map((role)=>`<option value="${esc(role)}"${state.roleFilter===role?' selected':''}>${esc(role)}</option>`).join('')}</select></label>
        <label class="module-access-filter-check"><input id="moduleAccessOverridesOnly" type="checkbox"${state.overrideOnly?' checked':''} /> Overrides only</label>
      </div>
      <div id="moduleAccessPeopleList" class="module-access-people-list">${shown.length?shown.map((p)=>`<button type="button" class="module-access-person" data-module-profile="${esc(p.id)}"${String(p.id)===String(state.selectedProfileId)?' aria-current="true"':''}><span><strong>${esc(p.full_name||p.email||p.id)}</strong><small>${esc(p.email||'No email')} · ${esc(normalizedRole(p.role))}${p.employment_status?` · ${esc(p.employment_status)}`:''}</small></span><small>${esc(profileAccessSummary(p))}${hasOverride(p.id)?' · profile override':''}</small></button>`).join(''):`<div class="module-access-note"><strong>No profiles match this filter.</strong><br>Clear the search or role/override filter.</div>`}</div>
      ${people.length>shown.length?`<small class="module-access-limit-note">Showing the first ${shown.length} of ${people.length} matching active profiles. Narrow the search to find a specific person.</small>`:''}
    </section>`;
  }

  function render() {
    const host=byId('moduleAccessManager');
    if (!host) return;
    if (!isAdmin()) { host.hidden=true; return; }
    host.hidden=false;
    if (state.loading) { host.innerHTML='<div class="module-access-loading">Loading People & Access module permissions…</div>'; return; }
    if (!state.payload) {
      host.innerHTML=`${state.error?`<div class="notice">${esc(state.error)}</div>`:''}<div class="module-access-note"><strong>Module access is loaded on demand.</strong><br>Open People & Access to retrieve the active profile/module matrix.</div><button id="moduleAccessLoad" type="button">Load People & Access</button>`;
      byId('moduleAccessLoad')?.addEventListener('click',()=>load(true)); return;
    }
    const people=rows();
    if (!state.selectedProfileId && people[0]?.id) state.selectedProfileId=String(people[0].id);
    if (state.selectedProfileId && !people.some((row)=>String(row.id)===String(state.selectedProfileId))) state.selectedProfileId=String(people[0]?.id||'');
    const p=profile();
    const breakGlass=p&&normalizedRole(p.role)==='admin';
    const accessIntegrity=p?integrityFor(p.id):null;
    const sourceErrors=Array.isArray(state.payload?.source_errors)?state.payload.source_errors:[];
    host.innerHTML=`${renderPeopleOverview()}
      <div id="moduleAccessEditor" class="module-access-heading"><div><span class="module-kicker">Admin access control</span><h3>Staff module access</h3><p>Choose exactly which top-level modules a person can see. Role still controls approval seniority inside an allowed module. Admin accounts are fixed at manage across every module.</p></div><div class="section-graphic-placeholder module-access-graphic"><span aria-hidden="true">⌘</span><strong>Access map placeholder</strong><small>Future visual: approved role/module matrix diagram.</small></div></div>
      ${sourceErrors.length?`<div class="notice">Runtime source warning: ${esc(sourceErrors.join(' · '))}</div>`:''}
      <div class="module-access-toolbar"><label>Selected profile<select id="moduleAccessProfile">${people.map((row)=>`<option value="${esc(row.id)}"${String(row.id)===String(state.selectedProfileId)?' selected':''}>${esc(row.full_name||row.username||row.email||row.id)} · ${esc(row.role||'employee')}</option>`).join('')}</select></label><button id="moduleAccessRefresh" type="button" class="secondary">Refresh</button></div>
      ${p?`<div class="module-access-grid">${MODULES.map((key)=>accessCard(p,key)).join('')}</div>
      ${breakGlass?`<div class="module-access-note"><strong>Admin break-glass:</strong> this profile has permanent manage access to Safety, Finance, Jobs, and Admin.${accessIntegrity?.all_modules_manage===true?' Database integrity check is green.':' Refresh I.T. Readiness if the database integrity check is not green.'}</div>`:`<label class="operations-span">Change reason<input id="moduleAccessReason" maxlength="300" placeholder="Example: Safety-only field account" /></label>
      <div class="module-access-actions"><button id="moduleAccessSave" type="button">Save module overrides</button><button id="moduleAccessSafetyOnly" type="button" class="secondary">Set Safety-only</button><button id="moduleAccessReset" type="button" class="secondary">Reset all to role defaults</button></div>
      <div class="module-access-note"><strong>Server enforcement:</strong> hidden modules are removed from navigation and protected APIs also deny access.</div>`}`:'<div class="finance-empty"><strong>No profiles were returned.</strong><br />The dedicated admin-it-control function requires the current module tables and release-authority schema. Use Admin → I.T. Readiness after deployment to diagnose runtime drift.</div>'}`;

    byId('moduleAccessSearch')?.addEventListener('input',(e)=>{state.search=e.target.value;render();byId('moduleAccessSearch')?.focus();});
    byId('moduleAccessRoleFilter')?.addEventListener('change',(e)=>{state.roleFilter=e.target.value||'all';render();});
    byId('moduleAccessOverridesOnly')?.addEventListener('change',(e)=>{state.overrideOnly=e.target.checked===true;render();});
    host.querySelectorAll('[data-module-profile]').forEach((button)=>button.addEventListener('click',()=>selectProfile(button.dataset.moduleProfile,true)));
    host.querySelectorAll('[data-people-panel]').forEach((button)=>button.addEventListener('click',()=>window.YWIAdminHub?.open?.('people',{panelTitle:button.dataset.peoplePanel})));
    byId('moduleAccessProfile')?.addEventListener('change',(e)=>{state.selectedProfileId=e.target.value;render();});
    byId('moduleAccessRefresh')?.addEventListener('click',()=>load(true));
    byId('moduleAccessSave')?.addEventListener('click',save);
    byId('moduleAccessSafetyOnly')?.addEventListener('click',()=>preset('safety_only'));
    byId('moduleAccessReset')?.addEventListener('click',()=>preset('reset_all'));
  }

  function selectProfile(profileId,scroll=false){
    if(!rows().some((row)=>String(row.id)===String(profileId)))return false;
    state.selectedProfileId=String(profileId);
    render();
    if(scroll) byId('moduleAccessEditor')?.scrollIntoView?.({behavior:'smooth',block:'start'});
    return true;
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
    const reason=byId('moduleAccessReason')?.value?.trim()||'Updated from Staff Module Access.';
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
      const payload=await callControl({action:'preset_module_permissions',profile_id:p.id,preset:name,permission_reason:`${label} preset from Staff Module Access.`});
      if(!payload?.module_permission_profiles)throw new Error(payload?.error||'Preset could not be applied.');
      state.payload=payload;
      document.dispatchEvent(new CustomEvent('ywi:module-access-admin-updated',{detail:{profile_id:p.id,preset:name}}));
    }
    catch(err){alert(err?.message||'Preset could not be applied.');}
    finally{state.saving=false;render();}
  }

  function inject(){
    const admin=byId('admin');if(!admin||byId('moduleAccessManager'))return;
    const heading=admin.querySelector('.section-heading')||admin.querySelector('h2');
    const shell=document.createElement('section');shell.id='moduleAccessManager';shell.className='module-access-manager admin-panel-block';shell.hidden=true;
    if(heading?.parentNode) heading.insertAdjacentElement('afterend',shell); else admin.prepend(shell);
    render();
  }

  function maybeLoadPeople(){
    inject();
    if(isAdmin()&&peopleWorkspaceOpen())load(false);
  }

  document.addEventListener('DOMContentLoaded',inject);
  document.addEventListener('ywi:auth-changed',()=>{inject();state.payload=null;state.error='';render();maybeLoadPeople();});
  document.addEventListener('ywi:route-shown',(e)=>{if(e?.detail?.allowed==='admin')maybeLoadPeople();});
  document.addEventListener('click',(event)=>{
    const target=event.target?.closest?.('[data-admin-hub-group="people"],[data-admin-hub-open="people"],#ad_hub_search_results [data-admin-search-type]');
    if(!target)return;
    setTimeout(()=>{if(peopleWorkspaceOpen())load(false);},0);
  });

  inject();
  window.YWIModuleAccess=Object.freeze({
    load,
    render,
    selectProfile,
    getSnapshot:()=>state.payload,
    getFilteredProfiles:()=>filteredProfiles().map((row)=>({...row})),
    isPeopleWorkspaceOpen:peopleWorkspaceOpen
  });
})();