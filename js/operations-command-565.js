/* YW565 — visually unified Operations Command launcher for Yard Workers.
 * No privileged API call or Master acceptance. Reuses existing authenticated
 * navigation and the separately verified YW550 platform Sysop link. */
(()=>{
 'use strict';
 const root=document.documentElement;
 const $=id=>document.getElementById(id);
 const groups=[
  {name:'Company operations',tag:'OPERATIONS',links:[
   ['#company','Company workspace','Business workspaces and original records'],
   ['#today','Jobs & route','Today’s work and field execution'],
   ['#finance','Finance','Invoices, accounting and costs']]},
  {name:'Management',tag:'MANAGE',links:[
   ['#admin','Management','Team and business management'],
   ['#toolbox','Safety & tools','Shop and field readiness']]},
  {name:'System operations',tag:'SYSTEM',links:[
   ['#settings','System & settings','Existing settings and technical preferences'],
   ['#sysop','Platform Sysop','Only with separately verified platform authority']]}
 ];
 function isAuth(){return window.YWI_AUTH?.getState?.()?.isAuthenticated===true;}
 function isPlatform(){const a=$('workspace550SysopLink');return !!(a&&!a.hidden);}
 function visible(){return root.dataset.ywTheme==='futuristic'&&isAuth();}
 function labelFor(anchor){
  for(const group of groups)for(const link of group.links)
   if(link[0]===anchor)return link[1];
  return 'Yard Workers';
 }
 function build(){
  const main=document.querySelector('main.container')||document.querySelector('main');
  if(!main||$('yw565Command'))return;
  const section=document.createElement('section');
  section.id='yw565Command';section.className='yw565-command';
  section.setAttribute('aria-label','Yard Workers Operations Command');
  section.hidden=true;
  const top=document.createElement('div');top.className='yw565-command-top';
  const intro=document.createElement('div');
  const kicker=document.createElement('p');kicker.className='yw565-kicker';
  kicker.textContent='YARD WORKERS  /  OPERATIONS COMMAND';
  const h=document.createElement('h2');h.textContent='Your operations, in focus';
  const sub=document.createElement('p');sub.className='yw565-command-sub';
  sub.textContent='One consistent launch surface for company operations, management and verified technical oversight.';
  intro.append(kicker,h,sub);
  const status=document.createElement('div');status.className='yw565-command-meta';
  status.innerHTML='<span class="yw565-command-mode">FUTURISTIC · VIOLET</span><span id="yw565CommandLocation" aria-live="polite"></span>';
  top.append(intro,status);section.append(top);
  const tiles=document.createElement('div');tiles.className='yw565-command-grid';
  for(const group of groups){
   const card=document.createElement('section');card.className='yw565-command-card';
   const meta=document.createElement('span');meta.className='yw565-command-tag';meta.textContent=group.tag;
   const h3=document.createElement('h3');h3.textContent=group.name;card.append(meta,h3);
   const links=document.createElement('div');links.className='yw565-command-links';
   for(const [href,name,desc] of group.links){
    const link=document.createElement('a');link.href=href;link.className='yw565-command-link';
    link.dataset.route=href;
    const text=document.createElement('span');text.className='yw565-command-link-text';
    const title=document.createElement('strong');title.textContent=name;
    const detail=document.createElement('span');detail.textContent=desc;
    text.append(title,detail);
    const glyph=document.createElement('span');glyph.setAttribute('aria-hidden','true');glyph.textContent='↗';
    link.append(text,glyph);links.append(link);
   }
   card.append(links);tiles.append(card);
  }
  section.append(tiles);
  const foot=document.createElement('p');foot.className='yw565-command-foot';
  foot.textContent='Navigation only. Operational figures come from their source modules; theme selection does not grant Sysop access or verify Master connectivity.';
  section.append(foot);main.prepend(section);
  refresh();
 }
 function refresh(){
  const el=$('yw565Command');if(!el)return;
  el.hidden=!visible();if(el.hidden)return;
  const hash=location.hash||'#company';
  const loc=$('yw565CommandLocation');if(loc)loc.textContent='WORKSPACE: '+labelFor(hash).toUpperCase();
  for(const link of el.querySelectorAll('.yw565-command-link')){
   const dest=link.dataset.route;
   // Preserve separately curated Sysop authority; do not infer from auth or
   // URL choice. Never show a link to a protected workspace without the gate.
   link.hidden=dest==='#sysop'&&!isPlatform();
   if(dest===hash)link.setAttribute('aria-current','page');
   else link.removeAttribute('aria-current');
  }
 }
 function mount(){
  build();refresh();
  const sysop=$('workspace550SysopLink');
  if(sysop&&typeof MutationObserver==='function')
   new MutationObserver(refresh).observe(sysop,{attributes:true,attributeFilter:['hidden']});
 }
 document.addEventListener('yw:theme-changed',refresh);
 document.addEventListener('ywi:auth-changed',refresh);
 window.addEventListener('hashchange',refresh);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
