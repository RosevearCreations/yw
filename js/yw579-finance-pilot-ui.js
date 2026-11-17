/* YW579 Finance pilot guide — company Finance only, non-transactional. */
(()=>{'use strict';
const $=id=>document.getElementById(id),n=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
const allowed=()=>window.YWIFinancialActivation578?.allowed?.()===true&&
 document.documentElement.dataset.ywSurface!=='platform'&&location.hash!=='#sysop';
function render(){
 const host=$('finance'),prior=$('yw579FinancialPilot');
 if(!host||!allowed()){prior?.remove();return;}
 if(prior)return;
 const section=n('section','');section.id='yw579FinancialPilot';section.className='yw579-finance-pilot';
 section.setAttribute('aria-label','Original provider and staging activation pilot readiness');
 section.append(n('p','YW579  /  COMPANY FINANCE  /  SANDBOX PILOT'),
  n('h3','Financial activation: independent evidence gates'),
  n('p','Read-only preparation. A web release or signed test packet is not a real provider enrollment, bank match, payroll run or CRA filing.'));
 const grid=n('div','');grid.className='yw579-pilot-grid';
 for(const [title,detail] of [
  ['Provider enrollment','Original sandbox provider account and approved company ownership; production capture OFF'],
  ['Settlement reconciliation','Original provider API receipt and independent bank net/fee/refund/dispute evidence'],
  ['Isolated staging acceptance','Separate staging project, exact schema parity and tested backup/restore receipt'],
  ['Independent activation approvals','Company owner, staging DBA and accountant signed reviews; production execution OFF']
 ]){
  const card=n('article','');card.append(n('strong',title),n('p',detail),n('span','HOLD / independent source not connected'));
  grid.append(card);
 }
 section.append(grid);
 const foot=n('p','Original provider/bank enrollment, real staging acceptance, finance posting and live movement remain independently gated. Use existing company Finance, Payroll, Accounting and original provider review workspaces; no duplicate ledger is created.');
 foot.className='yw579-pilot-note';section.append(foot);
 host.append(section);
}
document.addEventListener('DOMContentLoaded',render);
for(const type of ['ywi:auth-changed','ywi:route-shown','ywi:module-permissions-changed','ywi:workspace-authority-changed'])
 document.addEventListener(type,render);
window.addEventListener('hashchange',render);
window.YW579FinancePilot=Object.freeze({render,allowed});
})();
