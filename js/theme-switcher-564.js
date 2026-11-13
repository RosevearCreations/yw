/* YW564 — two non-destructive visual themes and platform-aware shell rail.
 * Standard retains the original blue CSS; Futuristic adds scoped design tokens.
 * Theme preference is local UI state, NOT a privileged system setting. */
(() => {
 'use strict';
 const KEY='yw-theme-v1';
 const THEMES=Object.freeze({standard:'Standard · Blue',futuristic:'Futuristic · Violet'});
 const ROUTES=Object.freeze([
  ['#company','Company','▦'],['#sysop','Platform','◈'],
  ['#today','Jobs','▤'],['#finance','Finance','◫'],
  ['#admin','Admin','◇'],['#it','I.T.','⌘'],
  ['#toolbox','Safety','✚'],['#settings','Settings','⚙']
 ]);
 const root=document.documentElement;
 function load(){
  try{return localStorage.getItem(KEY)==='futuristic'?'futuristic':'standard';}
  catch{return 'standard';}
 }
 function setTheme(name,persist=true){
  const theme=Object.hasOwn(THEMES,name)?name:'standard';
  root.dataset.ywTheme=theme;
  if(persist){try{localStorage.setItem(KEY,theme);}catch{}}
  const control=document.getElementById('yw564ThemeChoice');
  if(control)control.value=theme;
  const badge=document.getElementById('yw564ThemeStatus');
  if(badge)badge.textContent='Theme: '+THEMES[theme];
  document.dispatchEvent(new CustomEvent('yw:theme-changed',{detail:{theme}}));
 }
 // Source-of-truth default: if no saved preference, use the original blue theme.
 setTheme(load(),false);
 const create=(tag,cl,text)=>{
  const el=document.createElement(tag);if(cl)el.className=cl;
  if(text!==undefined)el.textContent=text;
  return el;
 };
 function authorized(){
  return window.YWI_AUTH?.getState?.()?.isAuthenticated===true;
 }
 function currentHash(){
  return '#'+(location.hash||'#toolbox').replace(/^#/,'');
 }
 function refreshRail(){
  const rail=document.getElementById('yw564Rail');
  if(!rail)return;
  const shown=authorized()&&root.dataset.ywTheme==='futuristic';
  rail.hidden=!shown;
  const sysop=document.getElementById('workspace550SysopLink');
  for(const a of rail.querySelectorAll('a')){
   if(a.getAttribute('href')==='#sysop')a.hidden=!sysop||sysop.hidden;
   if(a.getAttribute('href')===currentHash())a.setAttribute('aria-current','page');
   else a.removeAttribute('aria-current');
  }
 }
 function mount(){
  const header=document.querySelector('.app-header .header-top');
  if(!header||document.getElementById('yw564ThemeChoice'))return;
  const outer=create('div','yw564-theme-control');
  const label=create('label','yw564-theme-label','Appearance');
  label.htmlFor='yw564ThemeChoice';
  const select=create('select','yw564-theme-select');
  select.id='yw564ThemeChoice';select.setAttribute('aria-label','Choose Yard Workers appearance');
  for(const [value,name] of Object.entries(THEMES)){
   const option=create('option','',name);option.value=value;select.append(option);
  }
  outer.append(label,select);
  const status=create('span','yw564-theme-status');status.id='yw564ThemeStatus';
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  outer.append(status);
  const sessionActions=header.querySelector('.header-session-actions');
  header.insertBefore(outer,sessionActions||header.lastElementChild);
  select.addEventListener('change',()=>{
   if(!Object.hasOwn(THEMES,select.value))return;
   setTheme(select.value);refreshRail();
  });
  setTheme(load(),false);

  const rail=create('nav','yw564-side-rail');
  rail.id='yw564Rail';rail.setAttribute('aria-label','Futuristic workspace shortcuts');
  rail.hidden=true;
  const branding=create('div','yw564-rail-brand','YW');
  branding.setAttribute('aria-hidden','true');
  rail.append(branding);
  for(const [route,title,glyph] of ROUTES){
   const a=create('a','yw564-rail-link');
   a.href=route;
   const icon=create('span','yw564-rail-glyph',glyph);
   icon.setAttribute('aria-hidden','true');
   a.append(icon,create('span','yw564-rail-text',title));
   a.setAttribute('aria-label',title);
   rail.append(a);
  }
  document.body.append(rail);
  refreshRail();
  window.addEventListener('hashchange',refreshRail);
  document.addEventListener('ywi:auth-changed',refreshRail);
  // Asynchronously issued Sysop shell confirmation controls a separate link.
  // Watch only navigation attributes, without making data or privilege requests.
  const sysop=document.getElementById('workspace550SysopLink');
  if(sysop&&typeof MutationObserver==='function'){
   new MutationObserver(refreshRail).observe(sysop,{attributes:true,attributeFilter:['hidden']});
  }
  const session=document.getElementById('headerSession');
  if(session&&typeof MutationObserver==='function'){
   new MutationObserver(refreshRail).observe(session,{attributes:true,attributeFilter:['class']});
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
 window.YWTheme564=Object.freeze({get:()=>root.dataset.ywTheme||'standard',set:setTheme});
})();
