import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('js/admin-owner-management-command-ui.js','utf8');
const css=readFileSync('build494-command.css','utf8');
const html=readFileSync('index.html','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const workflow=readFileSync('.github/workflows/staging-browser-integration.yml','utf8');
const a=ui.indexOf('function renderDecisionReadiness518(){');
const b=ui.indexOf('function renderWorkabilityRecovery(){',a);
assert(a>0&&b>a,'Build 518 source-readiness panel must exist after Build 517');
const section=ui.slice(a,b);
for(const token of ['state.review516','visibility.jobs!==true','visibility.finance!==true',
'packet.cases.filter','packet.priorAt','packet.latestAt','r.trace','r.needed','r.state',
'INDEPENDENT REVIEW REQUIRED · NOT APPROVED','INDEPENDENT SOURCE RECHECK REQUIRED',
'no disposition','No matching change','source_required','permission_hidden']){
 assert(section.toLowerCase().includes(token.toLowerCase()),'Missing Build 518 safety contract: '+token);
}
assert(!/\b(localStorage|sessionStorage|fetch)\s*\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(section),
  'Build 518 review cannot persist, send or mutate source records');
for(const token of ['data-build="518"','data-style="field-command"',
'id="owner518Readiness"','id="owner518EconomicFilter"','id="owner518SeasonalFilter"',
'id="owner518ReceiptFilter"','renderDecisionReadiness518();',
"$('owner518ReceiptFilter').addEventListener('change',renderDecisionReadiness518)"])
 assert(ui.includes(token),'Missing Build 518 integration: '+token);
for(const token of ['.owner518-readiness .yw518-grid','.owner518-readiness :is(a,select,summary):focus-visible',
'.yw494-command .yw494-hero','@media(max-width:780px)', '.owner518-readiness .yw518-boundary'])
 assert(css.includes(token),'Missing Build 518 style: '+token);
assert((html.match(/b23=518/g)||[]).length===2,'Build 518 CSS/JS cache markers missing');
assert(pkg.scripts['test:build518']&&pkg.scripts['test:browser:build518'],'Build 518 test scripts missing');
assert(workflow.includes('npm run test:build518')&&workflow.includes('npm run test:browser:build518'),
 'Build 518 source/browser tests must be in protected CI');
console.log('Build 518 PASS: source-gated independent review, original-source evidence boundaries and management styling.');
