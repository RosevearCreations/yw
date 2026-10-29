import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessCompanyAssignment,assessProofBPublication,
  OWNER_EMAIL,PLATFORM_ADMIN_EMAIL,COMPANY_NAME,PRODUCTION_SUPABASE_REF}
 from '../server/rosevear-ql256-build489-gates.mjs';

const read=p=>readFileSync(p,'utf8');
const owner={id:'jordan-id',email:OWNER_EMAIL,role:'employee',staff_tier:'employee'};
const platform={id:'primary-id',email:PLATFORM_ADMIN_EMAIL,role:'admin',staff_tier:'admin'};
const companies=[{id:'company-id',name:COMPANY_NAME,owner_user_id:owner.id}];
assert.equal(assessCompanyAssignment({owner,platform,companies}).company_owner_verified,true);
assert.equal(assessCompanyAssignment({owner:{...owner,role:'admin'},platform,companies}).company_owner_verified,false);
assert.equal(assessCompanyAssignment({owner,platform,companies:[{...companies[0],owner_user_id:platform.id}]}).company_owner_verified,false);
assert.equal(assessCompanyAssignment({owner,platform,companies:[...companies,...companies]}).company_owner_verified,false);
const withheld=assessProofBPublication();
assert.equal(withheld.publication_review_ready,false);
assert.equal(withheld.gateway_execution_allowed,false);
assert.equal(withheld.blockers.length,6);
const genuine={
  signer:{provisioned:true,private_key_custody_verified:true},
  custodian:{authenticated_out_of_band:true,actor_id:'custodian-A'},
  witness:{authenticated_out_of_band:true,actor_id:'witness-B'},
  nonproduction:{verified:true,project_ref:'another-project-ref'},
  sourceB:{immutable_main_sha:'a'.repeat(40),ci_passed:true,descends_from_source_a:true},
  immutableProof:{http_200:true,valid_original_signature:true,pinned_key_matches:true}
};
assert.equal(assessProofBPublication(genuine).publication_review_ready,true);
assert.equal(assessProofBPublication(genuine).gateway_execution_allowed,false);
assert.equal(assessProofBPublication({...genuine,ownerTestAuthorized:true}).gateway_execution_allowed,false);
assert.equal(assessProofBPublication({...genuine,nonproduction:{verified:true,project_ref:PRODUCTION_SUPABASE_REF}}).publication_review_ready,false);
assert.equal(assessProofBPublication({...genuine,witness:{authenticated_out_of_band:true,actor_id:'custodian-A'}}).publication_review_ready,false);

const sql=read('sql/ql256_company_owner_platform_separation_489.sql');
for(const value of ['ywi_platform_administrators_489','ywi_profile_role_guard_489',
 'ywi_platform_company_directory_489','ywi_is_platform_administrator_489',
 'revoke all on public.ywi_platform_administrators_489',
 "lower(p.email)='veardev@live.ca'",'new.role is distinct from old.role',
 'new.staff_tier is distinct from old.staff_tier','set search_path ='])
 assert.ok(sql.includes(value),value);
assert.ok(!sql.includes('create policy') && !sql.includes('bypassrls'));
const ui=read('js/platform-company-overview-489.js');new Function(ui);
assert.ok(ui.includes("sb.rpc('ywi_platform_company_directory_489')"));
assert.ok(!ui.includes(".from('profiles')"));
const registry=read('js/company-service-registry-420.js');
assert.ok(registry.includes("const host=$('settings')"));
assert.ok(registry.includes("c.owner_user_id!==uid"));
assert.ok(read('index.html').includes('platform-company-overview-489.js'));
const pkg=JSON.parse(read('package.json'));
assert.ok(pkg.scripts['test:rosevear-ql256-company-owner-489']);
assert.ok(read('.github/workflows/staging-browser-integration.yml').includes('npm run test:rosevear-ql256-company-owner-489'));
const handoff=read('docs/integration/ql256-build489-REAL-STATUS.txt');
for(const term of ['NO ORIGINAL SIGNER OR WITNESS','PRODUCTION DATA IS NOT A NONPRODUCTION TENANT',
 'Proof-B publication gate: CLOSED','Primary Administrator','Rosevear Landscaping'])
 assert.ok(handoff.includes(term),term);
console.log('Build 489 owner/platform distinction, locked proof-B gate, and tenant tests PASS');
