import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture,company,companyId,foreignCompanyId,septicProfileId,treeId,originalReceiptId}
 from '../tests/fixtures/pms-septic-arboriculture-451.mjs';
const read=p=>readFileSync(p,'utf8');
const js=read('js/pms-septic-arboriculture-451.js');new Function(js);
const scope={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(js,scope);
const {inspect,keys,riskZones,tankKinds,riskLevels}=scope.window.YWI451;
const now=Date.now(),ctx={companyId,now,jobsAllowed:true};
const yes=inspect(fixture({now}),ctx);
assert.equal(yes.state,'verified_specialists');assert.equal(yes.septic_sites.length,1);
assert.equal(yes.septic_manifests.length,1);assert.equal(yes.arbor_trees.length,1);
assert.equal(yes.arbor_reviews.length,1);assert.equal(yes.canCertify,false);
assert.equal(yes.canPermit,false);assert.equal(yes.canDispatch,false);assert.equal(yes.canInvoice,false);
assert.deepEqual([...keys],['septic','arboriculture']);assert.equal(company.name,'Yard Rosevear');
assert.equal(riskZones.length,5);assert.equal(tankKinds.length,4);assert.equal(riskLevels.length,4);
assert.equal(inspect(fixture({now,septicEnabled:false}),ctx).state,'verified_specialists');
for(const [label,mutate] of [
 ['foreign root',x=>x.company_id=foreignCompanyId],
 ['foreign septic',x=>x.septic_sites[0].company_id=foreignCompanyId],
 ['foreign tree',x=>x.arbor_trees[0].company_id=foreignCompanyId],
 ['cross-company manifest',x=>x.septic_manifests[0].profile_id=treeId],
 ['foreign tree review',x=>x.arbor_reviews[0].tree_id=septicProfileId],
 ['fake regulatory certification',x=>x.regulatory_compliance_verified=true],
 ['fake permit',x=>x.permit_authorized=true],
 ['fake safety',x=>x.safety_cleared=true],
 ['fake dispatch',x=>x.dispatch_authorized=true],
 ['fake invoice',x=>x.invoice_posted=true],
 ['source-linked without receipt',x=>x.septic_manifests[0].original_receipt_428=null],
 ['receipt but no source link',x=>x.septic_manifests[0].disposal_review='operator_reference'],
 ['unsafe high-risk review',x=>x.arbor_reviews[0].safety_source=null],
 ['no original crew credential source',x=>x.arbor_reviews[0].crew_credential_source=null],
 ['invalid risk zone',x=>x.arbor_trees[0].risk_zone='none'],
 ['missing original source',x=>x.septic_sites[0].source_reference=''],
 ['wrong count',x=>x.arbor_review_count=12],
 ['missing entitlement',x=>x.services.pop()],
 ['stale evidence',x=>x.captured_at=new Date(now-6*60000).toISOString()],
 ['future evidence',x=>x.captured_at=new Date(now+120000).toISOString()]
]){const d=fixture({now});mutate(d);assert.equal(inspect(d,ctx).state,'withheld',label);}
assert.equal(inspect(fixture({now}),{...ctx,companyId:foreignCompanyId}).state,'withheld');
assert.equal(inspect(fixture({now}),{...ctx,jobsAllowed:false}).state,'withheld');
for(const term of ['owner451Septic','owner451Arbor','ywi_rpc_pms_specialist_snapshot_451',
 'ywi_rpc_pms_septic_site_451','ywi_rpc_pms_septic_manifest_451',
 'ywi_rpc_pms_arbor_tree_451','ywi_rpc_pms_arbor_review_451',
 'ywi_rpc_company_customers_422','ywi_rpc_customer_history_422',
 'auth.getUser','YWISecurity','pms-specialists-451','ywi:auth-changed','ywi:module-permissions-changed'])
 assert.ok(js.includes(term),term);
assert.ok(!/\.(insert|update|delete|upsert)\s*\(/.test(js),'No browser direct database writes');
const sql=read('sql/pms_septic_arboriculture_451.sql').toLowerCase();
for(const term of ['begin;','commit;','alter table public.ywi_company_service_modules drop constraint',
 'insert into public.ywi_company_service_modules','\'arboriculture\'','v_count<>7',
 'ywi_421_assert_company_new_work','ywi_422_assert_link','ywi_422_assert_owner',
 'ywi_septic_disposal_receipts_428','w.client_site_id=v_site.site_id',
 'foreign key(company_id,client_id,site_id)','foreign key(company_id,profile_id)',
 'foreign key(company_id,tree_id)','enable row level security',
 'revoke all on public.ywi_pms_septic_sites_451','revoke all on public.ywi_pms_arbor_trees_451',
 'pg_advisory_xact_lock','on conflict(company_id,request_id) do nothing',
 'grant execute on function public.ywi_rpc_pms_specialist_snapshot_451',
 'grant execute on function public.ywi_rpc_pms_arbor_review_451'])assert.ok(sql.includes(term),term);
assert.ok(sql.includes(originalReceiptId.split('-')[0])===false,'Synthetic IDs absent from migration');
assert.ok(read('index.html').includes('js/pms-septic-arboriculture-451.js'));
assert.ok(read('help.html').includes('id="pms-specialists-451"'));
assert.ok(read('style.css').includes('.pms451-grid'));
assert.ok(read('js/company-service-registry-420.js').includes("'arboriculture'"));
assert.ok(read('js/pms-module-navigation-443.js').includes("target:'owner451Septic'"));
assert.ok(read('js/pms-module-navigation-443.js').includes("target:'owner451Arbor'"));
assert.ok(read('docs/NEXT_STEPS_AND_SANITY_CHECK.md').includes('**Item 451 implementation'));
const scripts=JSON.parse(read('package.json')).scripts;
for(const name of ['test:pms-septic-arboriculture-451','test:browser:pms-septic-arboriculture-451']){
 assert.ok(scripts[name]);assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run '+name));}
console.log('YW Build 451 septic/arbor workspaces, original 428 chain, seventh company entitlement, source and owner guards: PASS');
