/* YW567: accessible, permission-respecting Operations Command drilldowns.
 * Only a navigation aid. All source routing and platform authority remain
 * enforced by original modules and curated YW550 Sysop link. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const routeGate=route=>window.YWNavigationAcceptance566?.isOffered?.(route)===true;
 let focusRoute=null;
 function populate(card,i){
  if(card.querySelector('.yw567-drilldown'))return;
  const links=[...card.querySelectorAll('a[data-route]')];
  const details=document.createElement('details');
  details.className='yw567-drilldown';
  const id='yw567Drilldown'+i;details.id=id;
  const summary=document.createElement('summary');
  const heading=card.querySelector('h3')?.textContent||'Module';
  summary.textContent='Explore '+heading.toLowerCase();
  summary.setAttribute('aria-label','Explore '+heading+' module destinations');
  const desc=document.createElement('p');desc.className='yw567-drilldown-desc';
  desc.textContent='Jump to an existing workspace section. Original access rules still apply.';
  const list=document.createElement('ul');list.className='yw567-drilldown-list';
  for(const link of links){
   const target=link.getAttribute('href');
   const label=link.querySelector('strong')?.textContent||target;
   const item=document.createElement('li'),a=document.createElement('a');
   a.href=target;a.dataset.yw567Route=target;
   a.textContent=label;
   item.append(a);list.append(item);
  }
  details.append(summary,desc,list);
  details.addEventListener('toggle',()=>{
   // A collapsed section never publishes stale privilege-changing links.
   if(details.open)refresh();
  });
  card.append(details);
 }
 function refresh(){
  const command=$('yw565Command');
  if(!command)return;
  const enabled=document.documentElement.dataset.ywTheme==='futuristic'&&
   window.YWI_AUTH?.getState?.()?.isAuthenticated===true&&!command.hidden;
  for(const d of command.querySelectorAll('.yw567-drilldown')){
   if(!enabled){d.open=false;d.hidden=true;continue;}
   let offered=0;
   for(const a of d.querySelectorAll('a[data-yw567-route]')){
    const route=a.dataset.yw567Route,ok=routeGate(route);
    a.closest('li').hidden=!ok;
    if(ok)offered++;
    if(ok&&route===location.hash)a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
   }
   d.hidden=offered===0;
   if(!offered)d.open=false;
  }
 }
 function mount(){
  const command=$('yw565Command');if(!command)return;
  [...command.querySelectorAll('.yw565-command-card')].forEach(populate);
  refresh();
  command.addEventListener('click',e=>{
   const link=e.target?.closest?.('a[data-yw567-route]');
   if(!link)return;
   const href=link.dataset.yw567Route;
   if(!routeGate(href)){
    e.preventDefault();e.stopImmediatePropagation();refresh();return;
   }
   focusRoute=href;
  },true);
 }
 window.addEventListener('hashchange',()=>{
  refresh();
  if(focusRoute!==location.hash)return;
  const destination=$(location.hash.slice(1));
  const heading=destination?.querySelector('h2,h3');
  if(heading){
   if(!heading.hasAttribute('tabindex'))heading.setAttribute('tabindex','-1');
   heading.focus({preventScroll:true});
  }
  focusRoute=null;
 });
 document.addEventListener('yw:theme-changed',refresh);
 document.addEventListener('ywi:auth-changed',refresh);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
