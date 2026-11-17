/* YW577: company-only Finance source-evidence navigator.
 * Never fetches or mutates tenant financial originals, provider or bank data. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const steps=Object.freeze([
 ['QUOTE','Customer-accepted quote','Approved scope, acceptance evidence, company/recipient identity and signed changes'],
 ['INVOICE','Original posted invoice','Matching source amounts, one posted receivable and balanced accounting posting'],
 ['PAYMENT','Provider-confirmed payment','Provider-authenticated settlement event, refund/dispute state and exact CAD cents'],
 ['BANK','Independent bank reconciliation','Original bank record and captured payment net of verified provider fees'],
 ['PAYROLL','Confidential workforce review','Company owner/HR permissions, approved timesheets and private rate access'],
 ['TAX','Tax and remittance review','Approved tax rate by jurisdiction/date, original HST basis and remittance evidence'],
 ['CLOSE','Independent period closure','Balanced GL, documented reviewer and immutable approved period lock']
]);
const auth=()=>window.YWI_AUTH?.getState?.()||{};
const allowed=()=>auth().isAuthenticated===true&&
 window.YWISecurity?.canViewModule?.('finance',auth().role||'employee','view')===true&&
 (window.YWIDualWorkspace?.snapshot?.().ownedCompanies||0)>0&&
 document.documentElement.dataset.ywSurface!=='platform'&&location.hash!=='#sysop';
const el=(tag,t)=>{let x=document.createElement(tag);if(t!==undefined)x.textContent=t;return x};
function render(){
 const host=$('finance');if(!host)return;
 const prior=$('yw577Custody');
 if(!allowed()){prior?.remove();return}
 if(prior)return;
 const box=el('section');box.id='yw577Custody';box.className='yw577';
 box.setAttribute('aria-label','Company financial custody');
 const banner=el('div');banner.className='yw577-header';
 const lead=el('div');lead.append(el('p','YW577  /  LANDSCAPING COMPANY FINANCE'),
  el('h3','Quote → Invoice → Payment → Reconciliation'),
  el('p','Original ledger, private payroll and tax custody. Only actual server and provider receipts may verify a payment, reconciliation or filing.'));
 const motif=document.createElementNS('http://www.w3.org/2000/svg','svg');
 motif.setAttribute('role','img');motif.setAttribute('aria-label','Angular source-evidence flow pattern');
 motif.setAttribute('viewBox','0 0 290 130');
 motif.innerHTML='<path d="M15 108L55 27H98L145 83L213 22H278M15 108H278M50 9V125M115 9V125M180 9V125M245 9V125" fill="none" stroke="currentColor" stroke-width="2"/><path d="M22 110L55 27L98 27L145 83L213 22" fill="none" stroke="currentColor" stroke-width="12" stroke-opacity=".16"/><circle cx="55" cy="27" r="6" fill="currentColor"/><circle cx="145" cy="83" r="6" fill="currentColor"/>';
 banner.append(lead,motif);box.append(banner);
 const warning=el('p','LIVE EVIDENCE: UNKNOWN / HOLD · This guidance panel is not a provider settlement, bank match, payroll run, tax filing or finance authorization.');
 warning.className='yw577-warning';box.append(warning);
 const layout=el('div');layout.className='yw577-layout';
 const menu=el('div');menu.className='yw577-steps';menu.setAttribute('role','group');
 menu.setAttribute('aria-label','Financial verification stages');
 const detail=el('section');detail.className='yw577-detail';detail.setAttribute('aria-live','polite');
 let buttons=[];
 function show(i){
  if(!allowed()){box.remove();return}
  buttons.forEach((b,j)=>b.setAttribute('aria-pressed',i===j?'true':'false'));
  detail.replaceChildren();
  detail.append(el('p',steps[i][0]+'  /  ORIGINAL RECEIPT NEEDED'),
   el('h4',steps[i][1]),el('p',steps[i][2]));
  const status=el('p','STATUS: NOT VERIFIED · Review the existing Finance and company Accounting modules. Never infer success from this screen.');
  status.className='yw577-detail-state';detail.append(status);
 }
 steps.forEach((step,i)=>{
  const b=el('button',String(i+1).padStart(2,'0')+'  '+step[1]);
  b.type='button';b.className='yw577-stage';b.setAttribute('aria-pressed','false');
  b.addEventListener('click',()=>show(i));menu.append(b);buttons.push(b);
 });
 layout.append(menu,detail);box.append(layout);
 box.append(el('p','This financial view belongs to a verified landscaping company, not the Yard Workers SaaS Sysop control plane. Original source finance, provider, bank and employee data remain subject to server RLS and independent approvals.'));
 host.append(box);show(0);
}
document.addEventListener('DOMContentLoaded',render);
for(const event of ['ywi:route-shown','ywi:auth-changed','ywi:module-permissions-changed','ywi:workspace-authority-changed'])
 document.addEventListener(event,render);
window.addEventListener('hashchange',render);
window.YWIFinanceCustody577=Object.freeze({render,allowed});
})();
