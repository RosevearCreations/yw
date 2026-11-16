/* YW575: source-only authorization verifier. Inputs MUST be supplied by trusted
 * server-side SQL / IdP lookups, NEVER from user_metadata or browser state.
 * This module never performs session revocation or grants roles. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS=new Set(['hr_review','role_review','session_revoke_request']);
const hold=(reason)=>Object.freeze({allowed:false,status:'HOLD',reason,executed:false,master_connected:false});
export function evaluate575(input={},now=Date.now()){
  const {actor,subject,company,grant,session,reviewer,action,source}=input;
  if(!ACTIONS.has(action))return hold('Unknown action');
  if(!source||source.kind!=='server_verified'||source.revision_trusted!==true||
     source.tenant_isolation_verified!==true||source.revocation_ledger_current!==true)
    return hold('Trusted live source missing');
  if(!actor||!subject||!company||!grant||!session||!UUID.test(actor.id||'')||
     !UUID.test(subject.id||'')||!UUID.test(company.id||''))
    return hold('Missing server-authorized actor, subject or company');
  if(company.active!==true||actor.company_id!==company.id||subject.company_id!==company.id||
     grant.company_id!==company.id||grant.user_id!==actor.id||grant.active!==true)
    return hold('Foreign or inactive company grant');
  if(!Number.isFinite(now)||typeof grant.expires_at!=='string'||Date.parse(grant.expires_at)<=now)
    return hold('Expired company grant');
  const roles=Array.isArray(grant.roles)?grant.roles:[];
  const capabilities=Array.isArray(grant.capabilities)?grant.capabilities:[];
  if(!(roles.includes('company_owner')||roles.includes('company_hr_admin'))||
     !capabilities.includes('company.hr.review'))
    return hold('Missing company-specific HR authority');
  if(session.user_id!==actor.id||!UUID.test(session.session_id||'')||
     session.active!==true||session.provider_verified!==true||
     session.revoked_at||Date.parse(session.expires_at)<=now)
    return hold('Session expired, revoked or not verified against active provider record');
  if(action==='session_revoke_request'){
    if(!capabilities.includes('company.sessions.revoke')||
       session.aal!=='aal2'||!reviewer||!UUID.test(reviewer.id||'')||
       reviewer.id===actor.id||reviewer.id===subject.id||
       reviewer.company_id!==company.id||reviewer.independently_verified!==true||
       reviewer.approved!==true||reviewer.action!=='session_revoke_request')
      return hold('Missing MFA or independent same-company reviewer');
    return Object.freeze({allowed:true,status:'AUTHORIZED_REQUEST_ONLY',reason:'Server-side provider revocation, session_id DB recheck and audit required',executed:false,master_connected:false});
  }
  return Object.freeze({allowed:true,status:'AUTHORIZED_REVIEW_ONLY',reason:'Read only; no HR or identity mutation granted',executed:false,master_connected:false});
}
export function sessionStillValid575(session,liveProviderRow,now=Date.now()){
  return !!session&&!!liveProviderRow&&UUID.test(session.session_id||'')&&
    session.session_id===liveProviderRow.id&&session.user_id===liveProviderRow.user_id&&
    liveProviderRow.revoked_at==null&&liveProviderRow.active===true&&
    Number.isFinite(now)&&Date.parse(session.expires_at)>now;
}
