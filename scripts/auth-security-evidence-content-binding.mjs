#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const AUTH_EVIDENCE_CONTENT_BINDING_VERSION=1;
export const AUTH_EVIDENCE_CONTENT_BINDING_NONCE_BYTES=32;
export const AUTH_EVIDENCE_BINDING_ARTIFACT_PREFIX='ywi-auth-security-binding';

const clean=(value)=>String(value ?? '').trim();
const isObject=(value)=>Boolean(value && typeof value==='object' && !Array.isArray(value));
const isSha256=(value)=>/^[0-9a-f]{64}$/i.test(clean(value));
const isNonce=(value)=>/^[0-9a-f]{64}$/i.test(clean(value));

function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(isObject(value)){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=stableValue(value[key]);
    return out;
  }
  return value;
}

export function stableJson(value){
  return JSON.stringify(stableValue(value));
}

export function stripWorkflowContentBinding(candidate){
  if(!isObject(candidate))throw new Error('Auth evidence candidate must be a JSON object.');
  const copy=structuredClone(candidate);
  delete copy.workflow_content_binding;
  return copy;
}

export function calculateWorkflowCandidateCommitment(candidate,nonce){
  const normalizedNonce=clean(nonce).toLowerCase();
  if(!isNonce(normalizedNonce))throw new Error('Workflow content-binding nonce must be 32 bytes encoded as 64 hexadecimal characters.');
  const payload={
    binding_version:AUTH_EVIDENCE_CONTENT_BINDING_VERSION,
    nonce:normalizedNonce,
    candidate:stripWorkflowContentBinding(candidate),
  };
  return crypto.createHash('sha256').update(stableJson(payload),'utf8').digest('hex');
}

export function attachWorkflowCandidateContentBinding(candidate,options={}){
  const copy=stripWorkflowContentBinding(candidate);
  const nonce=clean(options.nonce || crypto.randomBytes(AUTH_EVIDENCE_CONTENT_BINDING_NONCE_BYTES).toString('hex')).toLowerCase();
  const commitment=calculateWorkflowCandidateCommitment(copy,nonce);
  copy.workflow_content_binding={
    version:AUTH_EVIDENCE_CONTENT_BINDING_VERSION,
    nonce,
    commitment_sha256:commitment,
  };
  return copy;
}

export function verifyWorkflowCandidateContentBinding(candidate){
  if(!isObject(candidate))throw new Error('Workflow-bound Auth evidence candidate must be a JSON object.');
  const binding=candidate.workflow_content_binding;
  if(!isObject(binding))throw new Error('Workflow-bound Auth evidence candidate requires workflow_content_binding.');
  if(Number(binding.version)!==AUTH_EVIDENCE_CONTENT_BINDING_VERSION)throw new Error(`Workflow content-binding version must equal ${AUTH_EVIDENCE_CONTENT_BINDING_VERSION}.`);
  const nonce=clean(binding.nonce).toLowerCase();
  const commitment=clean(binding.commitment_sha256).toLowerCase();
  if(!isNonce(nonce))throw new Error('Workflow content-binding nonce is invalid.');
  if(!isSha256(commitment))throw new Error('Workflow content-binding commitment_sha256 is invalid.');
  const recomputed=calculateWorkflowCandidateCommitment(candidate,nonce);
  if(recomputed!==commitment)throw new Error('Workflow content-binding commitment does not match the supplied Auth evidence candidate.');
  return {
    verified:true,
    version:AUTH_EVIDENCE_CONTENT_BINDING_VERSION,
    commitment_sha256:commitment,
    algorithm:'sha256',
    canonicalization:'stable-json-v1',
    nonce_bytes:AUTH_EVIDENCE_CONTENT_BINDING_NONCE_BYTES,
  };
}

export function authControlSlug(controlKey){
  const value=clean(controlKey).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  if(!value)throw new Error('Auth evidence control key is required for the content-binding artifact name.');
  return value;
}

export function expectedContentBindingArtifactName(runId,runAttempt,controlKey,commitmentSha256){
  const id=clean(runId);
  const attempt=clean(runAttempt);
  const commitment=clean(commitmentSha256).toLowerCase();
  if(!/^[1-9]\d*$/.test(id))throw new Error('Content-binding artifact run id must be a positive integer.');
  if(!/^[1-9]\d*$/.test(attempt))throw new Error('Content-binding artifact run attempt must be a positive integer.');
  if(!isSha256(commitment))throw new Error('Content-binding artifact commitment must be a SHA-256 hex digest.');
  return `${AUTH_EVIDENCE_BINDING_ARTIFACT_PREFIX}-${id}-${attempt}-${authControlSlug(controlKey)}-${commitment}`;
}

export function buildContentBindingMarkerNames(candidateSet){
  if(!isObject(candidateSet))throw new Error('Prepared Auth evidence candidate set must be a JSON object.');
  const provenance=candidateSet.workflow_provenance;
  if(!isObject(provenance))throw new Error('Prepared workflow-bound candidate set requires workflow_provenance.');
  const controls=Array.isArray(candidateSet.candidate_controls) ? candidateSet.candidate_controls : [];
  const candidates=isObject(candidateSet.candidates) ? candidateSet.candidates : {};
  const markers={};
  for(const controlKey of controls){
    const candidate=candidates[controlKey];
    const verified=verifyWorkflowCandidateContentBinding(candidate);
    markers[controlKey]={
      commitment_sha256:verified.commitment_sha256,
      artifact_name:expectedContentBindingArtifactName(
        provenance.run_id,
        provenance.run_attempt,
        controlKey,
        verified.commitment_sha256,
      ),
    };
  }
  return markers;
}

export function writeGithubOutputMarkerNames(candidateSet,githubOutputPath){
  const outputPath=path.resolve(clean(githubOutputPath));
  if(!clean(githubOutputPath))throw new Error('GitHub output path is required.');
  const markers=buildContentBindingMarkerNames(candidateSet);
  const leaked=markers.leaked_password_protection?.artifact_name;
  const mfa=markers.mfa_options?.artifact_name;
  if(!leaked || !mfa)throw new Error('Both Auth content-binding marker artifact names are required.');
  fs.appendFileSync(outputPath,`leaked_password_protection_artifact_name=${leaked}\n`,'utf8');
  fs.appendFileSync(outputPath,`mfa_options_artifact_name=${mfa}\n`,'utf8');
  return {ok:true,markers};
}

function parseCli(){
  const args=process.argv.slice(2);
  const outputFlag=args.indexOf('--github-output');
  if(outputFlag<0)return null;
  const githubOutputPath=args[outputFlag+1];
  const candidateSetPath=args[outputFlag+2];
  if(!githubOutputPath || !candidateSetPath)throw new Error('Usage: auth-security-evidence-content-binding.mjs --github-output <path> <candidate-set.json>');
  return {githubOutputPath,candidateSetPath:path.resolve(candidateSetPath)};
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked){
  try{
    const cli=parseCli();
    if(!cli)throw new Error('No supported content-binding command was supplied.');
    const candidateSet=JSON.parse(fs.readFileSync(cli.candidateSetPath,'utf8'));
    writeGithubOutputMarkerNames(candidateSet,cli.githubOutputPath);
    console.log('AUTH EVIDENCE CONTENT BINDING: VERIFIED MARKER NAMES WRITTEN');
    console.log('Only salted commitments are exposed in marker artifact names; candidate nonces and Auth security state remain inside the encrypted evidence package.');
  }catch(error){
    console.error(`AUTH EVIDENCE CONTENT BINDING: LOCKED\n- ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode=1;
  }
}
