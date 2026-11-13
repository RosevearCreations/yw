/* YW566: runtime command navigation acceptance against real Yard Workers
 * modules and independently curated YW550 source links. No API writes,
 * entitlement grants or Master connection claims. */
(()=>{
 'use strict';
 const root=document.documentElement;
 const recognized=new Set(['#company','#today','#finance','#admin','#toolbox','#settings','#sysop']);
 const sources={
  '#company':['workspace550CompanyLink'],
  '#sysop':['workspace550SysopLink']
 };
 const $=id=>document.getElementById(id);
 function auth(){return window.YWI_AUTH?.getState?.()?.isAuthenticated===true;}
 function originalSource(route){
  const expected=sources[route];
  if(expected)return $(expected[0]);
  return [...document.querySelectorAll('a[href^="#"]')].find(a=>
   a.getAttribute('href')===route&&!a.closest('#yw565Command')&&
   !a.closest('#yw564Rail')&&
   (a.matches('.app-header nav a, #headerSettingsLink')||
    a.matches('a[data-module],a[data-mobile-quick],a[data-mobile-module]')||
    (route==='#settings'&&a.textContent?.toLowerCase().includes('settings'))));
 }
 function offered(a){
  return !!(a&&a.getAttribute('aria-disabled')!=='true'&&!a.hidden&&
   a.style.display!=='none'&&a.getAttribute('data-disabled')!=='true');
 }
 function accepted(route){
  if(!auth()||!recognized.has(route))return false;
  const section=$(route.slice(1));
  if(!section||!section.matches('section'))return false;
  const orig=originalSource(route);
  // This is NAVIGATION acceptance, not an authorization decision:
  // the original modules and YW550 shell still enforce real access.
  return offered(orig);
 }
 function elements(){
  return [...document.querySelectorAll('#yw565Command a[data-route],#yw564Rail a[href^="#"]')];
 }
 function refresh(){
  let allowed=0,total=0;
  for(const link of elements()){
   const route=link.getAttribute('href');
   const yes=accepted(route);
   total++;
   link.hidden=!yes;
   if(yes)allowed++;
   if(yes&&route===location.hash)link.setAttribute('aria-current','page');
   else link.removeAttribute('aria-current');
   if(!yes)link.removeAttribute('title');
  }
  const command=$('yw565Command');
  if(command&&root.dataset.ywTheme==='futuristic'&&auth()){
   let line=$('yw566NavigationStatus');
   if(!line){
    line=document.createElement('p');
    line.id='yw566NavigationStatus';line.className='yw566-navigation-status';
    line.setAttribute('role','status');
    line.setAttribute('aria-live','polite');
    const foot=command.querySelector('.yw565-command-foot');
    if(foot)foot.before(line);else command.append(line);
   }
   line.textContent='Module navigation: '+allowed+' of '+total+
    ' destinations present and offered by original Yard Workers navigation. '+
    'Routes do not confer permissions or verify Master connectivity.';
  }
 }
 function mount(){
  refresh();
  const sysop=$('workspace550SysopLink');
  const company=$('workspace550CompanyLink');
  if(typeof MutationObserver==='function'){
   const obs=new MutationObserver(refresh);
   for(const el of [sysop,company])if(el)obs.observe(el,{
    attributes:true,attributeFilter:['hidden','aria-disabled','style','data-disabled']});
   const head=document.querySelector('.app-header nav');
   if(head)obs.observe(head,{subtree:true,attributes:true,
    attributeFilter:['hidden','aria-disabled','style','data-disabled']});
  }
  document.addEventListener('click',e=>{
   const node=e.target?.closest?.('#yw565Command a[data-route],#yw564Rail a[href^="#"]');
   if(!node)return;
   if(!accepted(node.getAttribute('href'))){
    e.preventDefault();e.stopImmediatePropagation();refresh();
   }
  },true);
 }
 document.addEventListener('yw:theme-changed',refresh);
 document.addEventListener('ywi:auth-changed',refresh);
 window.addEventListener('hashchange',refresh);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
 window.YWNavigationAcceptance566=Object.freeze({isOffered:accepted,refresh});
})();
