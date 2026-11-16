/* YW576 — Yard Workers SaaS Sysop control plane, separate from tenant operations.
 * Presentation is NOT a permission grant. The real Sysop membership is the
 * independently checked YW550 server RPC; only bounded aggregate data exists.
 * New-company requests are in-memory drafts, not completed provisioning. */
(()=>{'use strict';
const $=id=>document.getElementById(id),root=document.documentElement;
const esc=s=>String(s??'').trim();
const auth=()=>window.YWI_AUTH?.getState?.()||{};
const verified=()=>auth().isAuthenticated===true&&window.YWIDualWorkspace?.isSysopVerified?.()===true;
const active=()=>location.hash==='#sysop'&&verified();
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function sync(){
 const signed=auth().isAuthenticated===true;
 const platform=active();
 root.dataset.ywSurface=platform?'platform':signed?'tenant':'guest';
 const region=$('yw576Platform');if(region)region.hidden=!platform;
 const band=document.querySelector('.slave-shell-banner');
 if(band){band.dataset.controlPlane=platform?'sysop':'tenant';}
 const surface=$('yw576SurfaceMode');if(surface)surface.textContent=platform?'PLATFORM CONTROL PLANE':'TENANT APPLICATION';
 // Existing sensitive modules remain subject to their own original RLS / auth.
 // Only navigation/visible DOM changes here. No access level is modified.
}
function build(){
 const section=$('sysop'),host=$('workspace550Sysop');if(!section||!host||$('yw576Platform'))return;
 const panel=node('section');panel.id='yw576Platform';panel.className='yw576-platform';
 panel.hidden=true;panel.setAttribute('aria-label','Yard Workers platform management');
 const header=node('div');header.className='yw576-platform-hero';
 const lead=node('div');lead.append(node('p','YARD WORKERS / SaaS CONTROL PLANE'),node('h2','Platform Operations'),node('p','Company provisioning, subscriptions and system readiness. Individual customers, jobs, crews and financial records remain inside their own tenant.'));
 const logo=document.createElementNS('http://www.w3.org/2000/svg','svg');logo.setAttribute('viewBox','0 0 240 142');
 logo.setAttribute('role','img');logo.setAttribute('aria-label','Angular technical circuit illustration');
 logo.innerHTML='<polygon points="18,128 86,14 134,14 202,128" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="60,126 120,34 180,126" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 128H226 M28 42H214 M120 0V141 M52 87H189" stroke="currentColor" stroke-opacity=".5" fill="none"/><path d="M119 33L143 75L121 111L100 75Z" fill="currentColor" opacity=".27"/><circle cx="119" cy="74" r="8" fill="currentColor"/>';
 header.append(lead,logo);panel.append(header);
 const mode=node('p','PLATFORM · AUTHORIZATION VERIFIED BY CURATED SERVER REGISTRY');
 mode.className='yw576-mode';mode.id='yw576SurfaceMode';panel.append(mode);
 const grid=node('div');grid.className='yw576-overview-grid';
 const items=[
 ['TENANTS','Registered landscaping companies','Live aggregate source is the verified platform RPC below. Tenant records stay private.'],
 ['SUBSCRIPTIONS','Monthly SaaS service','No billing status is inferred. Provider-confirmed subscription activation is required.'],
 ['PROVISIONING','New landscaping company site','Company creation requires trusted server-side provisioning, tenant RLS and a new owner approval.'],
 ['SYSTEM HEALTH','Errors, uptime & support','No synthetic numbers. Until signed telemetry is enrolled, source status remains UNKNOWN / HOLD.']
 ];
 for(const [tag,title,desc] of items){const card=node('article');card.className='yw576-overview-card';card.append(node('span',tag),node('strong',title),node('p',desc));grid.append(card);}
 panel.append(grid);
 const form=node('form');form.className='yw576-provision-draft';form.id='yw576DraftForm';
 form.append(node('h3','New company site · provisioning request'),node('p','Prepare a proposed tenant enrollment. This does not create a company, bill a customer or provision a website.'));
 const fields=node('div');fields.className='yw576-form-grid';
 const name=node('label','Landscaping company name');const ni=node('input');ni.type='text';ni.required=true;ni.maxLength=110;ni.name='company_name';ni.placeholder='Example: Rosevear Landscaping';name.append(ni);
 const email=node('label','Proposed company owner email');const ei=node('input');ei.type='email';ei.required=true;ei.name='owner_email';ei.maxLength=160;ei.placeholder='owner@example.ca';email.append(ei);
 const plan=node('label','Plan for approval');const ps=node('select');ps.name='plan';for(const [value,label] of [['evaluation','Evaluation / sample'],['monthly','Monthly subscription — price unconfirmed']]){let o=node('option',label);o.value=value;ps.append(o);}plan.append(ps);
 fields.append(name,email,plan);form.append(fields);
 const review=node('button','Review provisioning request (no submission)');review.type='submit';review.className='secondary';form.append(review);
 const result=node('p','A verified backend provisioning flow is not yet connected.');result.className='yw576-provision-result';result.setAttribute('role','status');result.setAttribute('aria-live','polite');form.append(result);
 form.addEventListener('submit',e=>{
  e.preventDefault();if(!active()){result.textContent='WITHHELD: current verified Sysop authority required.';return;}
  if(!form.reportValidity())return;
  const proposed=esc(ni.value),mail=esc(ei.value),selected=ps.value;
  if(proposed.length<2||!['monthly','evaluation'].includes(selected)){result.textContent='Invalid proposed company details.';return;}
  // Do not persist or contact billing/tenant/identity providers from this UI.
  result.textContent='PROVISIONING HOLD · '+proposed+' · '+mail+' · '+selected+
   '. Owner/DBA must approve a genuine new tenant, secure owner invitation, site domain and provider-confirmed plan. No changes submitted.';
 });
 panel.append(form);
 const footer=node('p','Platform management is not a tenant workspace. To open an owned company’s Jobs, Crew or Finance, explicitly switch to Company workspace after ownership verification.');
 footer.className='yw576-platform-foot';panel.append(footer);
 section.insertBefore(panel,host);
}
function init(){build();sync();}
document.addEventListener('DOMContentLoaded',init);
document.addEventListener('ywi:auth-changed',sync);
document.addEventListener('ywi:workspace-authority-changed',sync);
document.addEventListener('ywi:route-shown',sync);
window.addEventListener('hashchange',sync);
window.YWIPlatform576=Object.freeze({isPlatform:active,sync});
})();
