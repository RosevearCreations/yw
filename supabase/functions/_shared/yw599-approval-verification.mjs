import {digest,verify} from './yw599-independent-recovery.mjs';
// Server-only. All records must originate from private database reads, never request bodies.
export async function verifyEnrollment({enrollment:e,approval:a,company,pilot,profiles,revoked,config,ownerKey,reviewerKey,now=Date.now()}){
 const hold=()=>{throw new Error('YW599_ENROLLMENT_AUTHORITY_HOLD')};
 if(!e||!a||!company||!pilot||revoked||!Number.isFinite(now)||ownerKey===reviewerKey||e.company_id!==company.id||e.owner_id!==company.owner_user_id||e.owner_id===e.reviewer_id||a.enrollment_id!==e.id||a.reviewer_id!==e.reviewer_id||pilot.company_id!==company.id||pilot.owner_user_id!==e.owner_id||pilot.reviewer_user_id!==e.reviewer_id||pilot.state!=='APPROVED'||!(Date.parse(pilot.expires_at)>now)||!(Date.parse(e.expires_at)>now)||!(Date.parse(e.created_at)<=Date.parse(a.approved_at)&&Date.parse(a.approved_at)<=now)||!Array.isArray(profiles)||![e.owner_id,e.reviewer_id].every(id=>profiles.filter(p=>p.id===id&&p.is_active===true).length===1))hold();
 if(!config||config.providerId!==e.provider_id||config.recipientRef!==e.recipient_ref||config.noPaidProvider!==true||config.approvedRecipient!==true||config.providerEnrolled!==true)hold();
 const u=new URL(config.url),h=config.host,m=config.masterHost;
 if(typeof h!=='string'||typeof m!=='string'||h!==h.toLowerCase()||m!==m.toLowerCase()||!h.includes('.')||!m.includes('.')||u.protocol!=='https:'||u.hostname!==h||h===m||h.endsWith('.'+m)||m.endsWith('.'+h)||u.port||u.username||u.password||u.search||u.hash||h.endsWith('.local')||h.endsWith('.internal')||/^[\d.]+$/.test(h))hold();
 const configDigest=await digest(config);
 if(configDigest!==e.config_sha256)hold();
 const payload={schema:'rosevear.yw.provider-consent.v1',enrollmentId:e.id,companyId:e.company_id,ownerId:e.owner_id,reviewerId:e.reviewer_id,providerId:e.provider_id,recipientRef:e.recipient_ref,configSha256:configDigest,createdAt:new Date(e.created_at).toISOString(),expiresAt:new Date(e.expires_at).toISOString()};
 if(!await verify(ownerKey,'YW599-OWNER-CONSENT',payload,e.owner_signature))hold();
 const review={...payload,ownerSignature:e.owner_signature,approvedAt:new Date(a.approved_at).toISOString()};
 if(!await verify(reviewerKey,'YW599-REVIEWER-APPROVAL',review,a.reviewer_signature))hold();
 return {id:e.id,companyId:e.company_id,ownerId:e.owner_id,reviewerId:e.reviewer_id,providerId:e.provider_id,recipientRef:e.recipient_ref,expiresAt:payload.expiresAt,active:true,approvedRecipient:true,providerEnrolled:true,noPaidProvider:true};
}
