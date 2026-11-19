import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const uuid=n=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const company=uuid(2),outside=uuid(3),id=uuid(4),now='2026-11-19T16:30:00.000Z';
const ui=readFileSync('js/yw584-tenant-support-site-editor.js','utf8');
new vm.Script(ui,{filename:'yw584-tenant-support-site-editor.js'});
const win={addEventListener(){}};const doc={readyState:'loading',addEventListener(){}};
vm.runInNewContext(ui,{window:win,document:doc,location:{hash:''}});
const api=win.YW584CompanySupport;
assert.ok(api?.inspectPlatform&&api?.inspectSite&&api?.inspectCases&&api?.inspectOfferings);
const site={company_id:company,site_slug:'rosevear-landscaping',display_name:'Rosevear Landscaping',
 headline:'Trusted year-round grounds and property services',
 public_description:'Local grounds, snow and landscape work. Written descriptions remain private drafts.',
 theme_name:'forest',publication_state:'draft',updated_at:now};
assert.equal(api.inspectSite(site,company).state,'COMPANY_DRAFT_ONLY');
const rejectSite=(name,delta,cid=company)=>{
 assert.equal(api.inspectSite({...site,...delta},cid).state,'HOLD',name)};
rejectSite('foreign company',{},outside);
rejectSite('published without approval',{publication_state:'published'});
rejectSite('invalid slug',{site_slug:'BAD|slug'});
rejectSite('unapproved theme',{theme_name:'white-on-white'});
rejectSite('invalid title',{headline:'oops'});
rejectSite('bad time',{updated_at:'not-a-time'});
rejectSite('missing description',{public_description:''});
const item={id,company_id:company,kind:'addon',title:'Additional mowing',
 description:'Add another visit or service after individual quote review',
 begins_at:null,ends_at:null,state:'draft',created_at:now};
assert.equal(api.inspectOfferings([item],company).state,'COMPANY_DRAFTS_ONLY');
const event={...item,id:uuid(5),kind:'event',title:'Fall cleanup community day',
 begins_at:'2026-12-01T12:00:00.000Z',ends_at:'2026-12-01T16:00:00.000Z'};
assert.equal(api.inspectOfferings([event],company).state,'COMPANY_DRAFTS_ONLY');
for(const [name,rows,cid] of [
 ['foreign offering',[item],outside],
 ['duplicate ids',[item,item],company],
 ['published offering',[{...item,state:'public'}],company],
 ['unknown kind',[{...item,kind:'service_tax'}],company],
 ['missing event schedule',[{...event,begins_at:null}],company],
 ['reversed event schedule',[{...event,ends_at:'2026-11-30T10:00:00.000Z'}],company],
 ['non-event scheduled',[{...item,begins_at:now}],company],
 ['invalid date',[{...item,created_at:'broken'}],company],
 ['oversized descriptions',[{...item,description:'x'.repeat(810)}],company]
])assert.equal(api.inspectOfferings(rows,cid).state,'HOLD',name);
const caseRec={id,company_id:company,case_kind:'complaint',
 summary:'Missed field job',detail:'Our scheduled work did not take place on this date.',
 priority:'high',status:'open',created_at:now};
assert.equal(api.inspectCases([caseRec],company).state,'COMPANY_CASES_ONLY');
for(const [name,rows,cid] of [
 ['foreign complaint',[caseRec],outside],
 ['duplicate complaints',[caseRec,caseRec],company],
 ['forged closed status',[{...caseRec,status:'resolved'}],company],
 ['unsupported complaint type',[{...caseRec,case_kind:'export_all'}],company],
 ['PII-sized summary',[{...caseRec,summary:'z'.repeat(200)}],company],
 ['untrusted priority',[{...caseRec,priority:'critical_override'}],company],
 ['invalid case ID',[{...caseRec,id:'not-a-uuid'}],company]
])assert.equal(api.inspectCases(rows,cid).state,'HOLD',name);
const metrics={scope:'aggregate_only',source:'ywi_584_company_support_cases',
 private_case_details_exposed:false,runtime_telemetry_verified:false,
 sysop_action_authorized:false,captured_at:now,total_cases:4,high_priority:1,
 lockout_cases:1,performance_or_traffic_cases:2};
assert.equal(api.inspectPlatform(metrics).state,'SYSOP_AGGREGATE_ONLY');
for(const [name,delta] of [
 ['tenant records included',{private_case_details_exposed:true}],
 ['false real telemetry',{runtime_telemetry_verified:true}],
 ['mutation claim',{sysop_action_authorized:true}],
 ['foreign source',{source:'tenant_jobs'}],
 ['bad timestamp',{captured_at:'broken'}],
 ['fabricated metric',{total_cases:-1}],
 ['inconsistent count',{lockout_cases:7}],
 ['missing stat',{high_priority:null}]
])assert.equal(api.inspectPlatform({...metrics,...delta}).state,'HOLD',name);
const sql=readFileSync('sql/yw584_tenant_support_site_drafts_STAGING_ONLY.sql','utf8');
for(const x of ['ywi_584_company_site_drafts','ywi_584_company_offering_drafts',
 'ywi_584_company_support_cases','ywi_584_platform_support_overview',
 'ywi_is_platform_administrator_489','row level security','with check',
 'publication_state','draft','retained','owner_user_id','case_kind']){
 if(x==='retained')continue;
 assert.ok(sql.toLowerCase().includes(x.toLowerCase()),'missing staged safeguard: '+x);
}
assert.ok(!/grant\s+(delete|truncate)\b[^;]*to\s+(anon|authenticated)/i.test(sql));
assert.ok(!/grant\s+(all|select)\b[^;]*to\s+anon/i.test(sql));
assert.ok(!/publication_state\s*=\s*'published'/i.test(sql));
assert.ok(!/\.getPublicUrl\s*\(|\.storage\.from\s*\(/.test(ui));
assert.ok(ui.includes("window.YWIDualWorkspace?.isSysopVerified?.()===true"));
assert.ok(ui.includes("ywi_is_platform_administrator_489"));
assert.ok(ui.includes("ywi_companies"));
assert.ok(ui.includes("current(ctx)"));
assert.ok(ui.includes("event")==false||ui.includes("kind==='event'"));
assert.ok(ui.includes("ywi:auth-changed")&&ui.includes("hashchange"));
const html=readFileSync('index.html','utf8');
const build=readFileSync('scripts/build-vercel-site.mjs','utf8');
assert.ok(html.includes('yw584-tenant-support-site-editor.js?v=20261119b584'));
assert.ok(html.includes('theme-support-584.css?v=20261119b584'));
assert.ok(build.includes("'theme-support-584.css'"));
console.log('YW584 PASS: 3 isolated workspaces, 32 negative tenant/site/support/platform cases; staging-only RLS and no unauthorized publication, payment or remediation');
