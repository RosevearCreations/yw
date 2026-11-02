import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const start=ui.indexOf('function renderEvidenceAging515(){'),end=ui.indexOf('function renderWorkabilityRecovery(){');
assert(start>0&&end>start&&end-start>8000,'Build 515 must reconcile economic, seasonal and receipt source evidence');
const impl=ui.slice(start,end);
for(const marker of [
  'permission.jobs!==true','permission.finance!==true','advanced(current.economics.at,prior.economics.at)',
  'prior.economics.members','current.economics.members','SOURCE RECONCILIATION · NO FINANCIAL DISPOSITION',
  'ORIGINAL SOURCE LINEAGE GAP','PAIRED DATED SOURCE · DECISION UNSIGNED',
  'advanced(current.capacity.at,prior.capacity.at)','advanced(current.capacity.jobsAt,prior.capacity.jobsAt)',
  'SCENARIO IDENTITY CONFLICT','MISSING / CONTRADICTORY CLOSURE SOURCE',
  'FIELD NO LONGER FLAGGED · OWNER CLOSURE UNSIGNED','OWNER CLOSURE EVIDENCE · NOT APPROVED',
  "['workability','dispatch','production']",'p.workOrderId!==n.workOrderId','p.dispatchId!==n.dispatchId',
  'n.recovery_days==null','ageOf=day=>','days>=0?days:null','age<=7','age<=30',
  'RECEIPT EXCEPTION SERVICE AGE · UNSIGNED','No receipt creation timestamp, receipt deadline, SLA breach',
  "$('owner515AgeFilter')","$('owner515ReceiptFilter')","$('owner515ClosureFilter')","$('owner515EconomicFilter')"
])assert(impl.includes(marker),`Missing Build 515 source boundary: ${marker}`);
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(impl),
  'Build 515 is in-memory and cannot write decisions, create receipts or contact owners');
for(const marker of ['id="owner515Reconcile"','id="owner515EconomicFilter"','id="owner515ClosureFilter"',
  'id="owner515ReceiptFilter"','id="owner515AgeFilter"','renderEvidenceAging515();',
  'QL-269 remains <strong>UNDER REVIEW</strong>'])assert(ui.includes(marker),`Missing Build 515 accessibility or authority hook: ${marker}`);
for(const marker of ['.yw515-grid','.yw515-queue summary','.owner515-reconcile :is(select,summary,a):focus-visible',
  '@media(max-width:850px){.yw515-grid'])assert(css.includes(marker),`Missing responsive/high-contrast Build 515 styles: ${marker}`);
assert(html.match(/b20=515/g)?.length===2,'Build 515 script and stylesheet cache bust required');
assert(pkg.scripts['test:build515']&&pkg.scripts['test:browser:build515'],'Build 515 source/browser scripts required');
assert(workflow.includes('npm run test:build515')&&workflow.includes('npm run test:browser:build515'),
  'Build 515 must run in protected CI');
console.log('Build 515 PASS: read-only economic source reconciliation, unsigned seasonal closure review and service-date receipt aging.');
