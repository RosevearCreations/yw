import assert from 'node:assert/strict';
import {evaluate575,sessionStillValid575} from './yw575-identity-boundary.mjs';
const id=(n)=>n.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111';
const now=Date.parse('2026-11-16T19:00:00Z');
const base=()=>({action:'hr_review',actor:{id:id(1),company_id:id(3)},subject:{id:id(2),company_id:id(3)},
 company:{id:id(3),active:true},grant:{company_id:id(3),user_id:id(1),active:true,
 expires_at:'2026-11-17T00:00:00Z',roles:['company_owner'],capabilities:['company.hr.review','company.sessions.revoke']},
 session:{session_id:id(4),user_id:id(1),active:true,provider_verified:true,
 revoked_at:null,expires_at:'2026-11-16T20:00:00Z',aal:'aal2'},
 source:{kind:'server_verified',revision_trusted:true,tenant_isolation_verified:true,revocation_ledger_current:true}});
const positive=base();assert.equal(evaluate575(positive,now).status,'AUTHORIZED_REVIEW_ONLY');
const reject=(mutate)=>{const x=base();mutate(x);assert.equal(evaluate575(x,now).allowed,false);};
reject(x=>x.subject.company_id=id(5));reject(x=>x.grant.company_id=id(5));
reject(x=>x.actor.company_id=id(5));reject(x=>x.source.kind='client_claim');
reject(x=>x.source.revocation_ledger_current=false);reject(x=>x.grant.roles=[]);
reject(x=>x.grant.capabilities=[]);reject(x=>x.session.active=false);
reject(x=>x.session.revoked_at='2026-11-16T18:00:00Z');
reject(x=>x.session.provider_verified=false);reject(x=>x.session.expires_at='2026-11-16T18:00:00Z');
reject(x=>x.grant.expires_at='2026-11-16T18:00:00Z');
reject(x=>x.action='promote_to_sysop');
reject(x=>{x.action='session_revoke_request';});
const review=base();review.action='session_revoke_request';review.reviewer={
 id:id(5),company_id:id(3),independently_verified:true,approved:true,action:'session_revoke_request'};
assert.equal(evaluate575(review,now).status,'AUTHORIZED_REQUEST_ONLY');
assert.equal(evaluate575(review,now).executed,false);
reject(x=>{x.action='session_revoke_request';x.reviewer={...review.reviewer,id:id(1)}});
reject(x=>{x.action='session_revoke_request';x.session.aal='aal1';x.reviewer=review.reviewer});
reject(x=>{x.action='session_revoke_request';x.reviewer={...review.reviewer,company_id:id(6)}});
assert.equal(sessionStillValid575(positive.session,{id:id(4),user_id:id(1),active:true,revoked_at:null},now),true);
assert.equal(sessionStillValid575(positive.session,{id:id(4),user_id:id(1),active:false,revoked_at:null},now),false);
assert.equal(sessionStillValid575(positive.session,{id:id(6),user_id:id(1),active:true,revoked_at:null},now),false);
console.log('YW575 server-only HR role segregation and cross-device revocation negative tests passed');
