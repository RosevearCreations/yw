/* YW576 tenant-scoped original journey navigation.
 * Source-handoff panel is a guide, NEVER original transaction or cross-app ACK. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const auth=()=>window.YWI_AUTH?.getState?.()||{};
function render(){
 const host=$('workspace550Company');if(!host)return;
 let panel=$('yw576CompanyJourney');if(panel)panel.remove();
 const snapshot=window.YWIDualWorkspace?.snapshot?.()||{};
 if(auth().isAuthenticated!==true||!(snapshot.ownedCompanies>0))return;
 panel=document.createElement('section');panel.id='yw576CompanyJourney';panel.className='yw576-company-journey';
 const h=document.createElement('h3');h.textContent='Original Booking → Quote → Job → Crew → Route';panel.append(h);
 const p=document.createElement('p');p.textContent=
  'Tenant company workflow. An approved booking alone is not customer quote acceptance; the original Jobs and Dispatch systems independently create and verify work. Nothing here sends iCamp/Comms traffic or charges an account.';panel.append(p);
 const ol=document.createElement('ol');
 for(const item of ['Approved company booking and service capacity','Original customer-accepted estimate, terms and required deposit',
 'Canonical Job created through original Jobs authority','Original assigned Crew/Dispatch receipt and workability release',
 'Route safety and capacity recheck; Comms and iCamp signed ACKs held until separately proven']){
  let li=document.createElement('li');li.textContent=item;ol.append(li);
 }
 panel.append(ol);const link=document.createElement('a');link.href='#settings';
 link.className='secondary';link.textContent='Open original company booking and handoff reviews';
 panel.append(link);host.append(panel);
}
document.addEventListener('DOMContentLoaded',render);
document.addEventListener('ywi:workspace-authority-changed',render);
document.addEventListener('ywi:auth-changed',render);
window.YWICompanyJourney576=Object.freeze({render});
})();
