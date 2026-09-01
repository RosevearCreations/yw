/* File: js/module-access-ui.js
   Schema 159 Admin module permission editor.
   Admins can assign per-profile module overrides or reset to role defaults. A Safety-only
   preset is provided because this is the primary modularization use case.
*/

'use strict';

(function () {
  const state = { payload:null, loading:false, selectedProfileId:'', saving:false };
  const MODULES = ['safety','finance','jobs','admin'];
  const LABELS = { safety:'Safety / OHSA', finance:'Finance', jobs:'Jobs', admin:'Admin' };
  const LEVELS = ['hidden','view','create','approve','manage'];
  const byId = (id) => document.getElementById(id);
  const esc = (value) => window.YWIAPI?.escHtml?.(value) || String(value ?? '');
  function auth() { return window.YWI_AUTH?.getState?.() || {}; }
  function isAdmin() { return String(auth().role || '').toLowerCase() === 'admin'; }

  function rows() { return Array.isArray(state.payload?.module_permission_profiles) ? state.payload.module_permission_profiles : []; }
  function overrides() { return Array.isArray(state.payload?.module_permission_overrides) ? state.payload.module_permission_overrides : []; }
  function defaults() { return Array.isArray(state.payload?.module_role_defaults) ? state.payload.module_role_defaults : []; }

  function profile() { return rows().find((row) => String(row.id) === String(state.selectedProfileId)) || rows()[0] || null; }
  function normalizedRole(role) { const clean=String(role||'employee').toLowerCase(); return ['worker','staff'].includes(clean)?'employee':clean; }
  function overrideFor(profileId,moduleKey) { return overrides().find((row)=>String(row.profile_id)===String(profileId)&&row.module_key===moduleKey) || null; }
  function defaultFor(role,moduleKey) { return defaults().find((row)=>normalizedRole(row.role)===normalizedRole(role)&&row.module_key===moduleKey)?.access_level || 'hidden'; }

  function accessCard(p,moduleKey) {
    const o = overrideFor(p.id,moduleKey);
    const d = defaultFor(p.role,moduleKey);
    const effective = normalizedRole(p.role)==='admin' ? 'manage' : (o?.access_level || d);
    return `<label class="module-access-card"><span><strong>${esc(LABELS[moduleKey])}</strong><small>Role default: ${esc(d)} · Effective: ${esc(effective)}${o ? ' · profile override' : ''}</small></span><select data-module-access="${moduleKey}" ${normalizedRole(p.role)==='admin' ? 'disabled title="Admin always has manage access."' : ''}><option value="inherit"${o ? '' : ' selected'}>Use role default (${esc(d)})</option>${LEVELS.map((level)=>`<option value="${level}"${o?.access_level===level?' selected':''}>${level}</option>`).join('')}</select></label>`;
  }

  function render() {
    const host=byId('moduleAccessManager');
    if (!host) return;
    if (!isAdmin()) { host.hidden=true; return; }
    host.hidden=false;
    if (state.loading) { host.innerHTML='<div class="module-access-loading">Loading module permissions…</div>'; return; }
    if (!state.payload) { host.innerHTML='<button id="moduleAccessLoad" type="button">Load module access manager</button>'; byId('moduleAccessLoad')?.addEventListener('click',()=>load(true)); return; }
    const people=rows();
    if (!state.selectedProfileId && people[0]?.id) state.selectedProfileId=String(people[0].id);
    const p=profile();
    host.innerHTML=`<div class="module-access-heading"><div><span class="module-kicker">Schema 159 access control</span><h3>Module permissions</h3><p>Choose exactly which top-level modules a person can see. Role still controls approval seniority inside an allowed module.</p></div><div class="section-graphic-placeholder module-access-graphic"><span aria-hidden="true">⌘</span><strong>Access map placeholder</strong><small>Future visual: approved role/module matrix diagram.</small></div></div>
      <div class="module-access-toolbar"><label>Profile<select id="moduleAccessProfile">${people.map((row)=>`<option value="${esc(row.id)}"${String(row.id)===String(state.selectedProfileId)?' selected':''}>${esc(row.full_name||row.email||row.id)} · ${esc(row.role||'employee')}</option>`).join('')}</select></label><button id="moduleAccessRefresh" type="button" class="secondary">Refresh</button></div>
      ${p?`<div class="module-access-grid">${MODULES.map((key)=>accessCard(p,key)).join('')}</div>
      <label class="operations-span">Change reason<input id="moduleAccessReason" maxlength="300" placeholder="Example: Safety-only field account" /></label>
      <div class="module-access-actions"><button id="moduleAccessSave" type="button">Save module overrides</button><button id="moduleAccessSafetyOnly" type="button" class="secondary">Set Safety-only</button><button id="moduleAccessReset" type="button" class="secondary">Reset all to role defaults</button></div>
      <div class="module-access-note"><strong>Server enforcement:</strong> hidden modules are removed from navigation and protected Edge Functions also deny access. Admin profiles always retain manage access to prevent lockout.</div>`:'<div class="finance-empty">No profiles were returned.</div>'}`;
    byId('moduleAccessProfile')?.addEventListener('change',(e)=>{state.selectedProfileId=e.target.value;render();});
    byId('moduleAccessRefresh')?.addEventListener('click',()=>load(true));
    byId('moduleAccessSave')?.addEventListener('click',save);
    byId('moduleAccessSafetyOnly')?.addEventListener('click',()=>preset('safety_only'));
    byId('moduleAccessReset')?.addEventListener('click',()=>preset('reset_all'));
  }

  async function load(force=false){
    if(!isAdmin()||state.loading)return;
    if(state.payload&&!force){render();return;}
    state.loading=true;render();
    try{state.payload=await window.YWIAPI?.loadAdminDirectory?.({scope:'module_permissions',limit:250,timeoutMs:30000});if(!state.payload?.ok)throw new Error(state.payload?.error||'Module permission scope failed.');}
    catch(err){state.payload=null;alert(err?.message||'Unable to load module permissions.');}
    finally{state.loading=false;render();}
  }

  async function save(){
    const p=profile();if(!p||state.saving)return;
    state.saving=true;
    const reason=byId('moduleAccessReason')?.value?.trim()||'Updated from Module Permissions.';
    try{
      for(const moduleKey of MODULES){
        const value=document.querySelector(`[data-module-access="${moduleKey}"]`)?.value||'inherit';
        await window.YWIAPI?.manageAdminEntity?.({entity:'module_permission',action:value==='inherit'?'reset':'set',profile_id:p.id,module_key:moduleKey,access_level:value==='inherit'?null:value,permission_reason:reason});
      }
      await load(true); document.dispatchEvent(new CustomEvent('ywi:module-access-admin-updated',{detail:{profile_id:p.id}}));
    }catch(err){alert(err?.message||'Module permissions could not be saved.');}
    finally{state.saving=false;}
  }

  async function preset(name){
    const p=profile();if(!p||state.saving)return;
    const label=name==='safety_only'?'Safety-only':'role defaults';
    if(!confirm(`Set ${p.full_name||p.email||'this profile'} to ${label}?`))return;
    state.saving=true;
    try{await window.YWIAPI?.manageAdminEntity?.({entity:'module_permission',action:'preset',profile_id:p.id,preset:name,permission_reason:`${label} preset from Module Permissions.`});await load(true);document.dispatchEvent(new CustomEvent('ywi:module-access-admin-updated',{detail:{profile_id:p.id,preset:name}}));}
    catch(err){alert(err?.message||'Preset could not be applied.');}
    finally{state.saving=false;}
  }

  function inject(){
    const admin=byId('admin');if(!admin||byId('moduleAccessManager'))return;
    const heading=admin.querySelector('.section-heading')||admin.querySelector('h2');
    const shell=document.createElement('section');shell.id='moduleAccessManager';shell.className='module-access-manager admin-panel-block';shell.hidden=true;
    if(heading?.parentNode) heading.insertAdjacentElement('afterend',shell); else admin.prepend(shell);
    render();
  }

  document.addEventListener('DOMContentLoaded',inject);
  document.addEventListener('ywi:auth-changed',()=>{inject();state.payload=null;render();if(document.getElementById('admin')?.classList.contains('active')&&isAdmin())load(false);});
  document.addEventListener('ywi:route-shown',(e)=>{if(e?.detail?.allowed==='admin'&&isAdmin())load(false);});
})();
