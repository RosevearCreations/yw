// Build 489: release readiness and the distinct owner-vs-platform roles.
// This module never treats a software deployment as a custody witness.
export const OWNER_EMAIL='jfrosevear@outlook.com';
export const PLATFORM_ADMIN_EMAIL='veardev@live.ca';
export const COMPANY_NAME='Rosevear Landscaping';
export const PRODUCTION_SUPABASE_REF='jmqvkgiqlimdhcofwkxr';

export function assessCompanyAssignment({owner,platform,companies=[]}={}) {
  if (owner?.email?.toLowerCase()!==OWNER_EMAIL || platform?.email?.toLowerCase()!==PLATFORM_ADMIN_EMAIL ||
      !owner.id || !platform.id || owner.id===platform.id)
    return {status:'AUTHENTICATED_ACCOUNTS_NOT_CONFIRMED',company_owner_verified:false};
  if (owner.role==='admin' || owner.staff_tier==='admin')
    return {status:'COMPANY_OWNER_HAS_GLOBAL_ADMIN_PRIVILEGE',company_owner_verified:false};
  if (platform.role!=='admin' || platform.staff_tier!=='admin')
    return {status:'PLATFORM_ADMIN_ROLE_MISSING',company_owner_verified:false};
  const rows=companies.filter(c=>c.name?.trim().toLowerCase()===COMPANY_NAME.toLowerCase());
  if (rows.length!==1 || rows[0].owner_user_id!==owner.id)
    return {status:'COMPANY_OWNERSHIP_UNVERIFIED',company_owner_verified:false};
  return {status:'COMPANY_OWNER_SEPARATED_FROM_PLATFORM_ADMIN',company_owner_verified:true,
    test_company_in_production:true,nonproduction_tenant_verified:false};
}

export function assessProofBPublication({custodian,witness,signer,nonproduction,sourceB,immutableProof,
  ownerTestAuthorized=false}={}) {
  const blockers=[];
  if (!signer?.provisioned || !signer?.private_key_custody_verified) blockers.push('ORIGINAL_SIGNER_NOT_VERIFIED');
  if (!custodian?.authenticated_out_of_band) blockers.push('CUSTODIAN_NOT_AUTHENTICATED');
  if (!witness?.authenticated_out_of_band || witness?.actor_id===custodian?.actor_id)
    blockers.push('INDEPENDENT_WITNESS_NOT_VERIFIED');
  if (!nonproduction?.verified || nonproduction.project_ref===PRODUCTION_SUPABASE_REF)
    blockers.push('NONPRODUCTION_TENANT_ISOLATION_NOT_VERIFIED');
  if (!sourceB?.immutable_main_sha || !sourceB?.ci_passed || !sourceB?.descends_from_source_a)
    blockers.push('SOURCE_B_AND_CI_ANCESTRY_NOT_VERIFIED');
  if (!immutableProof?.http_200 || !immutableProof?.valid_original_signature || !immutableProof?.pinned_key_matches)
    blockers.push('GENUINE_SIGNED_PROOF_NOT_PUBLISHED');
  // This untrusted readiness shape is NOT an execution authority: independent
  // human authentication and an actual signed proof must be verified out of band.
  return {publication_review_ready:blockers.length===0,blockers,
    owner_test_authorized:ownerTestAuthorized===true,
    gateway_execution_allowed:false};
}
