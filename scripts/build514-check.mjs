import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const start=ui.indexOf('function renderResolutionProof514(){');
const end=ui.indexOf('function renderWorkabilityRecovery(){');
assert(start>0&&end>start&&end-start>7500,'Build 514 must implement all three evidence-condition lanes');
const impl=ui.slice(start,end);
for(const marker of [
  'permissions.jobs!==true','permissions.finance!==true','advanced(newer.economics.at,older.economics.at)',
  'newer.economics.members','ECONOMIC EXCEPTION RESOLUTION PROOF · UNSIGNED',
  'SOURCE EVIDENCE GAP','DATED TRACE ONLY','independent Finance disposition',
  'advanced(newer.capacity.at,older.capacity.at)','advanced(newer.capacity.jobsAt,older.capacity.jobsAt)',
  'SEASONAL CLOSURE CONDITIONS · UNAPPROVED','SCENARIO SOURCE MISSING','FIELD RETURNED / CLOSURE UNSIGNED',
  'independent closure review','advanced(newer.reliability.sources?.[k],older.reliability.sources?.[k])',
  'p.workOrderId!==n.workOrderId','p.dispatchId!==n.dispatchId','OWNER RECEIPT PROVENANCE · UNSIGNED',
  'Independent signed owner receipt','source snapshots nor this workbench supply a signed owner decision',
  "$('owner514EconomicsFilter')","$('owner514CapacityFilter')","$('owner514ReceiptFilter')"
])assert(impl.includes(marker),`Missing Build 514 guard: ${marker}`);
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(impl),
  'Build 514 cannot persist or mutate sources, assign work or create signed receipts');
for(const marker of ['id="owner514Proof"','id="owner514EconomicsFilter"','id="owner514CapacityFilter"',
  'id="owner514ReceiptFilter"','renderResolutionProof514();','QL-269 remains <strong>UNDER REVIEW</strong>'])
  assert(ui.includes(marker),`Missing Build 514 accessible or authority hook: ${marker}`);
for(const marker of ['.yw514-grid','.yw514-list summary','.owner514-proof :is(select,summary,a):focus-visible',
  '@media(max-width:850px){.yw514-grid'])assert(css.includes(marker),`Missing Build 514 responsive/focus CSS: ${marker}`);
assert(html.match(/b19=514/g)?.length===2,'Build 514 JS/CSS cache markers required');
assert(pkg.scripts['test:build514']&&pkg.scripts['test:browser:build514'],'Build 514 source/browser scripts required');
assert(workflow.includes('npm run test:build514')&&workflow.includes('npm run test:browser:build514'),
  'Protected Build 514 source and Playwright gates required');
console.log('Build 514 PASS: original-field economic proof, gap closure conditions and owner receipt provenance remain read-only and unsigned.');
