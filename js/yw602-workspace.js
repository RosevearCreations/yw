/* YW602 workspace identity and presentation. Shell remains an independently
 * verified control plane. Company and customer operations stay in their
 * original scoped authorities. No live statistics fabricated by artwork. */
(()=>{'use strict';
const $=id=>document.getElementById(id),root=document.documentElement;
const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const auth=()=>window.YWI_AUTH?.getState?.()||{};
const roster=()=>window.YWIDualWorkspace?.ownedRoster?.()||[];
const shell=()=>location.hash==='#sysop'&&window.YWIDualWorkspace?.isSysopVerified?.()===true;
const company=()=>roster().find(c=>c.id===window.YW579Navigation?.snapshot?.()?.companyId);
let portal=null,context='',selected='';
const field=[['Landscaping','landscaping','Mowing, gardens and seasonal grounds care'],['Snow services','snow','Snow clearing and plowing'],['Construction','construction','Site grading and project work'],['Arboriculture','arboriculture','Tree care and maintenance'],['Septic','septic','Inspection and service'],['Ponds and parks','parks','Aquatic and recreational facilities']];
const control=[['Tenant management','tenants','Company enrollment and subscription administration'],['System health','health','Verified technical observations and support'],['Release control','release','Protected deployments and exception tracking'],['Privacy & support','support','Scoped diagnostics, not private company records']];
function gallery(host,items,mode){
 const grid=make('div');grid.className='yw602-gallery';
 for(const [title,key,desc] of items){
  const article=make('article');article.className='yw602-gallery-card';
  const pic=make('img');pic.src='/images/yw602/'+key+'.svg';pic.alt='';pic.width=320;pic.height=180;pic.loading='lazy';
  article.append(pic,make('h4',title),make('p',desc));grid.append(article);
 }
 host.append(grid,make('small',mode==='shell'?'Illustrative control imagery · not live monitoring results.':'Illustrative service imagery · not completed jobs or a claim that every service is enabled.'));
}
function init(){
 const nav=$('workspace550Nav');if(nav&&!$('yw602Context')){
  const band=make('div');band.id='yw602Context';band.setAttribute('role','status');band.setAttribute('aria-live','polite');nav.after(band);
 }
 const ch=$('workspace550Company');
 if(ch&&!$('yw602CompanyHome')){
  const area=make('section');area.id='yw602CompanyHome';area.className='yw602-company-home';area.hidden=true;
  area.append(make('h3','Rosevear Landscaping · illustrative service overview'));gallery(area,field,'company');ch.after(area);
  const panel=make('section');panel.id='yw602OwnerPortal';panel.className='yw602-property-panel';panel.hidden=true;area.after(panel);
  portal=window.YW602PropertyPortal?.mount(panel,{getClient:()=>window.YWI_SB||window._sb,allowed:()=>auth().isAuthenticated===true&&!shell()&&location.hash==='#company'&&roster().length>0,companyOnly:true,companyId:()=>company()?.id||selected});
 }
 const sh=$('sysop');
 if(sh&&!$('yw602ShellGallery')){
  const area=make('section');area.id='yw602ShellGallery';area.hidden=true;area.className='yw602-control-home';
  area.append(make('h3','Yard Workers · platform control centre'));gallery(area,control,'shell');sh.prepend(area);
 }
 sync();
}
function sync(){
 const a=auth(),isShell=shell(),signed=a.isAuthenticated===true&&!!a.user?.id;
 const c=company()||roster().find(x=>x.id===selected)||(roster().length===1?roster()[0]:null);
 const identity=String(a.profile?.full_name||a.user?.email||'Signed-in account');
 const next=!signed?'guest':isShell?'shell:'+a.user.id:'company:'+a.user.id+':'+(c?.id||'');
 if(next!==context){portal?.reset();context=next;}
 const band=$('yw602Context');if(band){band.hidden=!signed;band.className=isShell?'yw602-context shell':'yw602-context company';band.replaceChildren(make('strong',isShell?'YARD WORKERS SHELL · SaaS provider':c?c.name+' · Company workspace':'COMPANY WORKSPACE · select an authorized company'),make('span',identity+' · '+(isShell?'Verified Sysop':String(a.roleLabel||a.role||'Account'))));}
 root.dataset.yw602Mode=!signed?'guest':isShell?'shell':'company';
 if($('workspace550CompanyLink'))$('workspace550CompanyLink').textContent='Company workspaces';
 if($('workspace550SysopLink'))$('workspace550SysopLink').textContent='Yard Workers Shell';
 if($('yw602CompanyHome'))$('yw602CompanyHome').hidden=!(signed&&!isShell&&location.hash==='#company'&&c?.name==='Rosevear Landscaping');
 if($('yw602OwnerPortal'))$('yw602OwnerPortal').hidden=!(signed&&!isShell&&location.hash==='#company'&&c);
 if($('yw602ShellGallery'))$('yw602ShellGallery').hidden=!isShell;
 if($('yw579ModuleTier'))$('yw579ModuleTier').inert=isShell;
}
document.addEventListener('ywi:602-enter-company',e=>{if(roster().some(c=>c.id===e.detail?.companyId)){selected=e.detail.companyId;portal?.reset();sync();}});
document.addEventListener('ywi:auth-changed',()=>{selected='';portal?.reset();sync();});
document.addEventListener('ywi:workspace-authority-changed',sync);
document.addEventListener('ywi:route-shown',()=>{portal?.reset();sync();});
document.addEventListener('change',e=>{if(e.target?.id==='yw579CompanySelect'){selected=e.target.value;portal?.reset();sync();}});
window.addEventListener('hashchange',sync);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
