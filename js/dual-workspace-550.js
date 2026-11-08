/* YW 550 — Two workspaces, two distinct server authorities.
 * Platform Sysop: curated membership RPC, aggregate-only company monitoring.
 * Landscaping: the authenticated owner's own RLS-scoped company roster.
 * Neither surface grants roles, impersonates a tenant or changes business data.
 */
(()=>{'use strict';
  const state={generation:0,userId:'',checking:false,sysopVerified:false,companyRows:[],platformRows:[],
    companyStatus:'Sign in to view companies you own.',sysopStatus:'Verified Sysop enrollment required.'};
  const byId=id=>document.getElementById(id);
  const auth=()=>window.YWI_AUTH?.getState?.()||{};
  const client=()=>window.YWI_SB||window._sb||null;
  const element=(name,content)=>{const node=document.createElement(name);if(content!==undefined)node.textContent=String(content);return node;};
  const button=(label,route)=>{const b=element('button',label);b.type='button';b.className='secondary';
    b.addEventListener('click',()=>window.YWIRouter?.showSection?.(route));return b;};
  const current=(generation,userId)=>generation===state.generation&&auth().isAuthenticated===true&&auth().user?.id===userId;
  const clear=()=>{state.sysopVerified=false;state.companyRows=[];state.platformRows=[];
    state.companyStatus='Sign in to view companies you own.';state.sysopStatus='Verified Sysop enrollment required.';};

  function setNav(){
    const nav=byId('workspace550Nav');if(!nav)return;
    const signedIn=auth().isAuthenticated===true;
    nav.hidden=!signedIn;
    const sysop=byId('workspace550SysopLink');if(sysop)sysop.hidden=!state.sysopVerified;
    const currentHash=String(location.hash||'').replace(/^#/,'');
    nav.querySelectorAll('a').forEach(a=>{
      const active=a.getAttribute('href')==='#'+currentHash;
      if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
    });
    window.YWIRouter?.bindNav?.();window.YWIRouter?.updateNav?.(currentHash);
  }

  function renderCompany(){
    const host=byId('workspace550Company');if(!host)return;host.replaceChildren();
    host.appendChild(element('p','Landscaping company operations are separate from platform Sysop monitoring. Only businesses owned by this signed-in identity are listed.'));
    const status=element('p',state.companyStatus);status.setAttribute('role','status');host.appendChild(status);
    if(!state.companyRows.length)return;
    const grid=element('div');grid.className='yw550-workspace-grid';
    for(const c of state.companyRows){
      const card=element('article');card.className='yw550-workspace-card';card.dataset.companyId=c.id;
      card.append(element('h3',c.name),element('p','Verified owner workspace. Customer jobs, pricing, crews and contracts stay in this company’s existing permission-controlled modules.'));
      const actions=element('div');actions.className='yw550-workspace-actions';
      actions.append(button('Open jobs','today'),button('Company service settings','settings'));
      card.appendChild(actions);grid.appendChild(card);
    }
    host.appendChild(grid);
  }

  function renderSysop(){
    const host=byId('workspace550Sysop');if(!host)return;host.replaceChildren();
    const status=element('p',state.sysopStatus);status.setAttribute('role','status');host.appendChild(status);
    if(!state.sysopVerified){
      host.appendChild(element('p','Ree and Jack use their individual verified sign-ins. A confirmed email, Admin label or company ownership does not by itself activate Sysop membership. Enrollment must be separately approved in the curated platform administrator registry.'));
      return;
    }
    const companies=state.platformRows;
    const registered=companies.reduce((n,c)=>n+Number(c.registered_services),0);
    const enabled=companies.reduce((n,c)=>n+Number(c.enabled_services),0);
    const metrics=element('div');metrics.className='yw550-metrics';
    for(const [label,value] of [['Registered landscaping companies',companies.length],['Enabled service modules',enabled],['Available service modules',registered]]){
      const item=element('article');item.append(element('span',label),element('strong',value));metrics.appendChild(item);
    }
    host.appendChild(metrics);
    host.appendChild(element('p','Platform statistics only. This workspace cannot open another company’s customer records, crew jobs, invoices or property details. Contract statistics require separately verified company-scoped aggregation; none are inferred from service counts.'));
    const controls=element('div');controls.className='yw550-workspace-actions';
    controls.append(button('Open I.T. diagnostics','it'),button('Open elevated help','settings'));
    host.appendChild(controls);
    if(!companies.length){host.appendChild(element('p','No registered companies returned.'));return;}
    const table=element('table');table.className='yw550-company-stats';
    const caption=element('caption','Company registration and service-module statistics — read only');table.appendChild(caption);
    const head=element('thead');const hr=element('tr');
    for(const title of ['Landscaping company','Enabled services','Registered services'])hr.appendChild(element('th',title));
    head.appendChild(hr);table.appendChild(head);
    const body=element('tbody');
    for(const c of companies){const tr=element('tr');
      for(const value of [c.company_name,c.enabled_services,c.registered_services])tr.appendChild(element('td',value));
      body.appendChild(tr);
    }
    table.appendChild(body);const scroll=element('div');scroll.className='yw550-table-scroll';scroll.appendChild(table);host.appendChild(scroll);
  }

  async function refresh(){
    const generation=++state.generation,actor=auth(),id=actor.user?.id||'';
    clear();state.userId=id;state.checking=true;
    if(actor.isAuthenticated!==true||!id){state.checking=false;setNav();renderCompany();renderSysop();return;}
    state.companyStatus='Verifying authenticated company ownership…';
    state.sysopStatus='Checking curated platform Sysop membership…';
    renderCompany();renderSysop();setNav();
    try{
      const sb=client();if(!sb?.auth?.getUser||!sb?.rpc||!sb?.from)throw Error('Authentication service unavailable.');
      const verified=await sb.auth.getUser();
      if(!current(generation,id))return;
      if(verified.error||verified.data?.user?.id!==id)throw Error('Authenticated identity could not be verified.');
      // Authenticated RPC checks the curated registry and active admin profile on the server.
      const gate=await sb.rpc('ywi_is_platform_administrator_489');
      if(!current(generation,id))return;
      state.sysopVerified=!gate.error&&gate.data===true;
      state.sysopStatus=gate.error?'Platform authority check unavailable; access withheld.':
        state.sysopVerified?'Verified platform Sysop session · read-only monitoring.':'Sysop enrollment not active for this account.';
      // Company ownership is an independent RLS read; Sysop does not bypass tenant access.
      const list=await sb.from('ywi_companies').select('id,name,owner_user_id').order('created_at',{ascending:true}).limit(101);
      if(!current(generation,id))return;
      if(list.error||!Array.isArray(list.data)||list.data.length>100||list.data.some(c=>
        typeof c.id!=='string'||!c.id||typeof c.name!=='string'||!c.name||c.owner_user_id!==id))
        throw Error('Company ownership verification unavailable or returned foreign data.');
      state.companyRows=list.data.map(c=>({id:c.id,name:c.name}));
      state.companyStatus=state.companyRows.length?`${state.companyRows.length} owned company workspace(s) verified.`:
        'No company ownership assigned to this sign-in.';
      if(state.sysopVerified){
        const summary=await sb.rpc('ywi_platform_company_directory_489');
        if(!current(generation,id))return;
        if(summary.error||!Array.isArray(summary.data)||summary.data.length>1000||summary.data.some(c=>
          !c.company_id||!c.company_name||!Number.isSafeInteger(Number(c.enabled_services))||
          !Number.isSafeInteger(Number(c.registered_services))||Number(c.enabled_services)<0||
          Number(c.registered_services)<Number(c.enabled_services))) {
          state.platformRows=[];state.sysopStatus='Platform statistics unavailable; no company data displayed.';
        }else{
          // Never retain owner email or business data even though the legacy RPC supplies it.
          state.platformRows=summary.data.map(c=>({company_name:String(c.company_name),
            enabled_services:Number(c.enabled_services),registered_services:Number(c.registered_services)}));
        }
      }
    }catch(err){if(!current(generation,id))return;
      state.sysopVerified=false;state.companyRows=[];state.platformRows=[];
      state.companyStatus='ACCESS WITHHELD: '+(err?.message||'Verification failed.');
      state.sysopStatus='ACCESS WITHHELD: verification incomplete.';
    }finally{if(current(generation,id)){state.checking=false;setNav();renderCompany();renderSysop();
      document.dispatchEvent(new CustomEvent('ywi:workspace-authority-changed',{detail:{sysopVerified:state.sysopVerified}}));}}
  }

  function start(){renderCompany();renderSysop();setNav();refresh();}
  document.addEventListener('DOMContentLoaded',start,{once:true});
  document.addEventListener('ywi:auth-changed',refresh);
  document.addEventListener('ywi:route-shown',e=>{
    setNav();if(e?.detail?.allowed==='sysop'&&state.sysopVerified)renderSysop();
  });
  window.YWIDualWorkspace={refresh,isSysopVerified:()=>state.sysopVerified&&auth().isAuthenticated===true&&auth().user?.id===state.userId,
    snapshot:()=>({checking:state.checking,sysopVerified:state.sysopVerified,ownedCompanies:state.companyRows.length})};
})();
