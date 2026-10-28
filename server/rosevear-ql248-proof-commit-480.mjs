// Build 480: independent two-SHA transport verification for YW's QL-246 proof.
// This offline check cannot attest GitHub origin, real denials or live authorization.
import {createHash} from 'node:crypto';
import {verifyPublic} from './rosevear-ql246-source-proof-478.mjs';

const sha40 = x => typeof x === 'string' && /^[a-f0-9]{40}$/.test(x);
const sha64 = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const requireProof = (ok,reason) => {if(!ok) throw new Error('QL248_HOLD_'+reason);};
const exact = (value,keys) => value && typeof value==='object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const bundleKeys=['system','sourceRevisionSha','proofCommitSha','rawProofBase64'];
const pinKeys=['system','sourceRevisionSha','proofCommitSha','proofSha256','ciRunUrl',
 'publicKeySpkiSha256','businessId','tenantId'];

export function verifyYwProofCommit(bundle,pins,trust={}) {
 requireProof(exact(bundle,bundleKeys)&&exact(pins,pinKeys),'MANIFEST_FIELDS');
 requireProof(bundle.system==='yw'&&pins.system==='yw'&&pins.businessId==='yw','SOURCE');
 requireProof(sha40(bundle.sourceRevisionSha)&&sha40(bundle.proofCommitSha)
  &&bundle.sourceRevisionSha!==bundle.proofCommitSha,'DISTINCT_SHAS');
 requireProof(bundle.sourceRevisionSha===pins.sourceRevisionSha
  &&bundle.proofCommitSha===pins.proofCommitSha,'PINNED_SHAS');
 requireProof(sha64(pins.proofSha256)&&sha64(pins.publicKeySpkiSha256),'DIGEST_FORMAT');
 requireProof(typeof bundle.rawProofBase64==='string'&&bundle.rawProofBase64.length>0
  &&bundle.rawProofBase64.length<1000000&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(bundle.rawProofBase64),'RAW_ENCODING');
 const raw=Buffer.from(bundle.rawProofBase64,'base64');
 requireProof(raw.length>0&&raw.toString('base64')===bundle.rawProofBase64,'RAW_CANONICAL');
 const digest=createHash('sha256').update(raw).digest('hex');
 requireProof(digest===pins.proofSha256,'PROOF_DIGEST');
 let packet;
 try {packet=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}
 catch {throw new Error('QL248_HOLD_JSON')}
 requireProof(packet?.payload?.source_revision===bundle.sourceRevisionSha,'SIGNED_SOURCE_SHA');
 requireProof(packet?.payload?.ci_run_url===pins.ciRunUrl,'SOURCE_CI');
 requireProof(packet?.payload?.tenant_id===pins.tenantId,'TENANT');
 const signature=verifyPublic(packet,{sourceRevision:bundle.sourceRevisionSha,
  ciRunUrl:pins.ciRunUrl,pinSha256:pins.publicKeySpkiSha256,
  challengeId:trust.challengeId,challengeSha256:trust.challengeSha256,
  tenantId:pins.tenantId,now:trust.now});
 return {signature_matched:signature.signature_matched,source_revision:bundle.sourceRevisionSha,
  proof_commit_sha:bundle.proofCommitSha,raw_proof_sha256:digest,
  github_origin_independently_attested:false,real_gateway_denials_verified:false,
  consumer_amendment_accepted:false,connection_state:'DISCONNECTED',
  owner_pilot_authorized:false,result:'OFFLINE_SIGNATURE_MATCHED_REAL_PROOF_PENDING_HELD'};
}
