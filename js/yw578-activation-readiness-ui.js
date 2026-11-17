/* YW578 tenant-only read-only activation readiness. Never calls provider or bank.
 * The existing Finance server and RLS are the only sources of live authority. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const steps=[
 ['01','Provider settlement','Confirm original provider API settlement, refund/dispute checks, independent bank net and fee match.','Original provider and independent bank evidence, original source revision and review signature'],
 ['02','Payroll authorization','Review company-private approved timesheets, employee authority and separate payroll approver.','Private HR custody, independent approval and separate execution authorization'],
 ['03','HST / tax authorization','Verify jurisdiction and effective-date rates, invoice basis and separate remittance approval.','Official current rate evidence and company accountant approval; not a CRA submission'],
 ['04','Independent close','Require balanced GL, original reconciliation, second-person period lock and durable audit.','Independent accountant sign-off, period source lock and immutable review custody']
];
const allowed=()=>window.YWIFinanceCustody577?.allowed?.()===true&&
 document.documentElement.dataset.ywSurface!=='platform'&&location.hash!=='#sysop';
const el=(tag,txt)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;return n;};
function render(){
 const host=$('finance'),existing=$('yw578Readiness');
 if(!host||!allowed()){existing?.remove();return;}
 if(existing)return;
 const panel=el('section');panel.id='yw578Readiness';panel.className='yw578';
 panel.setAttribute('aria-label','Financial activation readiness');
 const head=el('header');head.className='yw578-head';
 head.append(el('p','YW578 / COMPANY FINANCE / ACTIVATION CONTROL'),
  el('h3','Financial operations activation readiness'),
  el('p','Four independently reviewed stages. Verification requires real original sources; this screen never activates posting, payments, payroll or tax filing.'));
 panel.append(head);
 const status=el('p','ACTIVATION: HOLD  /  LIVE PROVIDER & BANK: NOT VERIFIED  /  PAYROLL & TAX EXECUTION: OFF');
 status.className='yw578-hold';status.setAttribute('role','status');panel.append(status);
 const grid=el('div');grid.className='yw578-grid';
 for(const [num,title,desc,evidence] of steps){
  const card=el('article');card.className='yw578-card';
  card.append(el('span',num+'  /  REVIEW REQUIRED'),el('h4',title),el('p',desc));
  const proof=el('p','ORIGINAL EVIDENCE NEEDED: '+evidence);proof.className='yw578-proof';
  card.append(proof,el('strong','HOLD — independent evidence has not been connected'));
  grid.append(card);
 }
 panel.append(grid);
 const foot=el('p','Next safe action: use the existing company Finance, Reconciliation, HR/Payroll and Accounting workspaces. Obtain verified external receipts, an isolated staging review, owner/DBA approval and a separate activation release. The outer Yard Workers Sysop may not inspect tenant finance.');
 foot.className='yw578-foot';panel.append(foot);host.append(panel);
}
document.addEventListener('DOMContentLoaded',render);
for(const event of ['ywi:route-shown','ywi:auth-changed','ywi:module-permissions-changed','ywi:workspace-authority-changed'])
 document.addEventListener(event,render);
window.addEventListener('hashchange',render);
window.YWIFinancialActivation578=Object.freeze({render,allowed});
})();
