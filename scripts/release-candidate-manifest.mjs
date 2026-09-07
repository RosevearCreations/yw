#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {discoverLatestSchema, EXPECTED_REPOSITORY, EXPECTED_WORKFLOW} from './release-source-evidence-bundle.mjs';

const SHA_RE=/^[0-9a-f]{40}$/i;
const clean=(value)=>String(value ?? '').trim();
const uniq=(values)=>[...new Set(values.filter(Boolean))].sort();
const positiveInteger=(value)=>{
  const parsed=Number.parseInt(clean(value),10);
  return Number.isInteger(parsed) && parsed>0 ? parsed : null;
};

export function classifyChangedFiles(files=[]){
  const normalized=uniq(files.map((file)=>clean(file).replaceAll('\\','/')).filter(Boolean));
  const surfaces=[];
  const riskTags=[];
  const migrations=[];

  for(const file of normalized){
    const lower=file.toLowerCase();
    const migration=file.match(/^sql\/(\d{3}[a-z]?)_.+\.sql$/i);
    if(migration){
      surfaces.push('database_schema');
      riskTags.push('schema_changing');
      migrations.push(migration[1].toLowerCase());
    }
    if(lower.startsWith('.github/workflows/')){
      surfaces.push('release_workflow');
      riskTags.push('deployment_sensitive','release_governance');
    }
    if(lower.startsWith('scripts/')){
      surfaces.push('automation_and_controls');
      if(/release|promotion|repository|staging|schema|migration/.test(lower))riskTags.push('release_governance');
    }
    if(lower.startsWith('tests/'))surfaces.push('tests');
    if(lower.startsWith('js/'))surfaces.push('application_runtime');
    if(lower.endsWith('.html'))surfaces.push(lower==='help.html'?'help':'public_or_application_html');
    if(lower.endsWith('.css'))surfaces.push('styling');
    if(/service[-_]?worker|sw\.js$/.test(lower)){
      surfaces.push('service_worker');
      riskTags.push('deployment_sensitive');
    }
    if(/finance|accounting|posting|journal|reconcil/.test(lower))riskTags.push('finance_sensitive');
    if(/auth|security|permission|rls|grant/.test(lower))riskTags.push('auth_or_security_sensitive');
    if(/stripe|paypal|provider|payment/.test(lower))riskTags.push('provider_sensitive');
    if(/staging/.test(lower))riskTags.push('staging_sensitive');
    if(/public|seo|sitemap|robots|help\.html/.test(lower))riskTags.push('public_content_sensitive');
  }

  if(!riskTags.length)riskTags.push('unclassified_source_change');
  return {
    changed_files:normalized,
    changed_file_count:normalized.length,
    changed_surfaces:uniq(surfaces),
    preliminary_risk_tags:uniq(riskTags),
    migration_change:migrations.length>0,
    changed_migrations:uniq(migrations),
  };
}

export function resolveCandidateKind(env={}){
  const eventName=clean(env.YWI_GITHUB_EVENT_NAME || env.GITHUB_EVENT_NAME);
  const ref=clean(env.YWI_GITHUB_REF || env.GITHUB_REF);
  const baseRef=clean(env.YWI_GITHUB_BASE_REF || env.GITHUB_BASE_REF);
  const headRef=clean(env.YWI_GITHUB_HEAD_REF || env.GITHUB_HEAD_REF);
  if(eventName==='pull_request' && baseRef==='dev' && headRef && headRef!=='main')return 'development_feature_candidate';
  if(eventName==='pull_request' && baseRef==='main' && headRef==='dev')return 'production_promotion_candidate';
  if(eventName==='push' && ref==='refs/heads/main')return 'exact_main_followup';
  if(eventName==='workflow_dispatch')return 'manual_source_check';
  return 'source_candidate';
}

function defaultGit(args){
  return execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}

function defaultLsRemote(){
  return defaultGit(['ls-remote','origin','refs/heads/dev','refs/heads/main']);
}

function parseLsRemote(text=''){
  const refs={};
  for(const line of String(text).split(/\r?\n/)){
    const [sha,ref]=line.trim().split(/\s+/);
    if(SHA_RE.test(sha||'') && ref)refs[ref]=sha.toLowerCase();
  }
  return refs;
}

function readEvent(env={},readFile=fs.readFileSync){
  const eventPath=clean(env.YWI_GITHUB_EVENT_PATH || env.GITHUB_EVENT_PATH);
  if(!eventPath)return {};
  try{return JSON.parse(readFile(eventPath,'utf8'));}catch{return {};}
}

function safeTreeSha(sha,git){
  if(!SHA_RE.test(clean(sha)))return null;
  try{
    const value=clean(git(['rev-parse',`${sha}^{tree}`])).toLowerCase();
    return SHA_RE.test(value)?value:null;
  }catch{return null;}
}

function collectChangedFiles(env,event,git){
  const eventName=clean(env.YWI_GITHUB_EVENT_NAME || env.GITHUB_EVENT_NAME);
  const baseRef=clean(env.YWI_GITHUB_BASE_REF || env.GITHUB_BASE_REF);
  const headRef=clean(env.YWI_GITHUB_HEAD_REF || env.GITHUB_HEAD_REF);
  if(eventName==='pull_request' && baseRef && headRef){
    try{
      git(['fetch','--no-tags','--no-recurse-submodules','--depth=100','origin',
        `+refs/heads/${baseRef}:refs/remotes/origin/${baseRef}`,
        `+refs/heads/${headRef}:refs/remotes/origin/${headRef}`]);
      const output=git(['diff','--name-only',`refs/remotes/origin/${baseRef}...refs/remotes/origin/${headRef}`]);
      return String(output).split(/\r?\n/).map(clean).filter(Boolean);
    }catch{return [];}
  }
  if(eventName==='push'){
    const before=clean(event.before).toLowerCase();
    const after=clean(event.after || env.YWI_GITHUB_SHA || env.GITHUB_SHA).toLowerCase();
    if(SHA_RE.test(before) && SHA_RE.test(after) && !/^0+$/.test(before)){
      try{
        git(['fetch','--no-tags','--no-recurse-submodules','--depth=2','origin','main']);
        const output=git(['diff','--name-only',before,after]);
        return String(output).split(/\r?\n/).map(clean).filter(Boolean);
      }catch{return [];}
    }
  }
  return [];
}

export function collectReleaseCandidateContext(env={},deps={}){
  const git=deps.git || defaultGit;
  const lsRemote=deps.lsRemote || defaultLsRemote;
  const event=readEvent(env,deps.readFile || fs.readFileSync);
  const refs=parseLsRemote(lsRemote());
  const eventName=clean(env.YWI_GITHUB_EVENT_NAME || env.GITHUB_EVENT_NAME);
  const baseRef=clean(env.YWI_GITHUB_BASE_REF || env.GITHUB_BASE_REF);
  const headRef=clean(env.YWI_GITHUB_HEAD_REF || env.GITHUB_HEAD_REF);
  const workflowSha=clean(env.YWI_GITHUB_SHA || env.GITHUB_SHA).toLowerCase();
  const prHeadSha=clean(event?.pull_request?.head?.sha || env.YWI_GITHUB_PR_HEAD_SHA).toLowerCase();
  const prBaseSha=clean(event?.pull_request?.base?.sha || env.YWI_GITHUB_PR_BASE_SHA).toLowerCase();
  const candidateSha=(eventName==='pull_request' && SHA_RE.test(prHeadSha)) ? prHeadSha : workflowSha;
  const changedFiles=collectChangedFiles(env,event,git);
  return {
    event,
    event_name:eventName,
    ref:clean(env.YWI_GITHUB_REF || env.GITHUB_REF),
    base_ref:baseRef || null,
    head_ref:headRef || null,
    workflow_sha:SHA_RE.test(workflowSha)?workflowSha:null,
    feature_sha:SHA_RE.test(prHeadSha)?prHeadSha:null,
    pr_base_sha:SHA_RE.test(prBaseSha)?prBaseSha:null,
    dev_sha:refs['refs/heads/dev'] || null,
    main_sha:refs['refs/heads/main'] || null,
    tree_sha:safeTreeSha(candidateSha,git),
    changed_files:changedFiles,
  };
}

export function buildReleaseCandidateManifest(env={},options={}){
  const context=options.context || collectReleaseCandidateContext(env,options.deps || {});
  const latestSchema=Number.isInteger(options.latestSchema) ? options.latestSchema : discoverLatestSchema(options.root);
  const classification=classifyChangedFiles(context.changed_files || []);
  const repository=clean(env.YWI_GITHUB_REPOSITORY || env.GITHUB_REPOSITORY);
  const mainProtectedRaw=clean(env.YWI_GITHUB_MAIN_PROTECTED).toLowerCase();
  const sourceSuiteComplete=clean(env.YWI_SOURCE_SUITE_COMPLETED).toLowerCase()==='true';
  const blockers=[];
  if(mainProtectedRaw==='false')blockers.push({code:'main_unprotected',authority:'GitHub repository administrator',source:'GitHub REST branches/main protected field'});
  if(!context.dev_sha)blockers.push({code:'dev_tip_unverified',authority:'GitHub remote refs'});
  if(!context.main_sha)blockers.push({code:'main_tip_unverified',authority:'GitHub remote refs'});
  if(!context.tree_sha)blockers.push({code:'candidate_tree_unverified',authority:'Git repository'});
  if(!classification.changed_file_count)blockers.push({code:'changed_files_unverified',authority:'Git comparison evidence'});

  const manifest={
    manifest_format_version:1,
    manifest_kind:'ywi_release_candidate',
    repository:repository || null,
    candidate_kind:resolveCandidateKind(env),
    generated_at:clean(options.generatedAt || env.YWI_MANIFEST_GENERATED_AT) || new Date().toISOString(),
    source:{
      event_name:context.event_name || null,
      ref:context.ref || null,
      base_ref:context.base_ref || null,
      head_ref:context.head_ref || null,
      workflow_sha:context.workflow_sha || null,
      feature_sha:context.feature_sha || null,
      pr_base_sha:context.pr_base_sha || null,
      dev_sha:context.dev_sha || null,
      main_sha:context.main_sha || null,
      candidate_tree_sha:context.tree_sha || null,
    },
    schema:{
      repository_latest_version:Number.isInteger(latestSchema)?latestSchema:null,
      migration_change:classification.migration_change,
      changed_migrations:classification.changed_migrations,
    },
    change:{
      changed_file_count:classification.changed_file_count,
      changed_files:classification.changed_files,
      changed_surfaces:classification.changed_surfaces,
      preliminary_risk_tags:classification.preliminary_risk_tags,
      classification_authority:'descriptive_only_build_244',
    },
    gate_evidence:{
      workflow_name:clean(env.YWI_GITHUB_WORKFLOW_NAME || env.GITHUB_WORKFLOW) || null,
      workflow_run_id:positiveInteger(env.YWI_GITHUB_RUN_ID || env.GITHUB_RUN_ID),
      workflow_run_attempt:positiveInteger(env.YWI_GITHUB_RUN_ATTEMPT || env.GITHUB_RUN_ATTEMPT),
      source_suite_completed_before_manifest:sourceSuiteComplete,
      promotion_shape_gate_present:true,
      repository_enforcement_separate:true,
      release_source_evidence_separate:true,
    },
    external_blockers:blockers,
    boundaries:{
      descriptive_evidence_only:true,
      release_authorization_performed:false,
      production_promotion_performed:false,
      database_mutation_performed:false,
      provider_mutation_performed:false,
      finance_posting_enabled:false,
      build_246_policy_classifier_not_replaced:true,
    },
  };

  const errors=[];
  if(repository && repository!==EXPECTED_REPOSITORY)errors.push(`Manifest repository must be ${EXPECTED_REPOSITORY}.`);
  if(!Number.isInteger(latestSchema) || latestSchema<201)errors.push('Repository schema discovery must resolve to Schema 201 or newer.');
  if(context.workflow_sha && !SHA_RE.test(context.workflow_sha))errors.push('Workflow SHA must be a full 40-character SHA when supplied.');
  if(context.feature_sha && !SHA_RE.test(context.feature_sha))errors.push('Feature SHA must be a full 40-character SHA when supplied.');
  if(context.dev_sha && !SHA_RE.test(context.dev_sha))errors.push('Development SHA must be a full 40-character SHA when supplied.');
  if(context.main_sha && !SHA_RE.test(context.main_sha))errors.push('Main SHA must be a full 40-character SHA when supplied.');
  if(context.tree_sha && !SHA_RE.test(context.tree_sha))errors.push('Candidate tree SHA must be a full 40-character SHA when supplied.');
  return {ok:errors.length===0,errors,manifest};
}

export function writeReleaseCandidateManifest(env={},options={}){
  const outputPath=path.resolve(options.outputPath || env.YWI_RELEASE_MANIFEST_PATH || 'release-candidate-manifest.json');
  const result=buildReleaseCandidateManifest(env,options);
  if(!result.ok){
    try{if(fs.existsSync(outputPath))fs.rmSync(outputPath,{force:true});}catch{}
    return {...result,output_path:outputPath};
  }
  fs.writeFileSync(outputPath,`${JSON.stringify(result.manifest,null,2)}\n`,'utf8');
  return {...result,output_path:outputPath};
}

function printResult(result){
  console.log(JSON.stringify({
    ok:result.ok,
    candidate_kind:result.manifest.candidate_kind,
    feature_sha:result.manifest.source.feature_sha,
    dev_sha:result.manifest.source.dev_sha,
    main_sha:result.manifest.source.main_sha,
    tree_sha:result.manifest.source.candidate_tree_sha,
    schema_version:result.manifest.schema.repository_latest_version,
    changed_file_count:result.manifest.change.changed_file_count,
    risk_tags:result.manifest.change.preliminary_risk_tags,
    external_blockers:result.manifest.external_blockers.map((item)=>item.code),
    output_path:result.output_path,
    errors:result.errors,
  },null,2));
  if(!result.ok){
    console.error('\nRELEASE CANDIDATE MANIFEST: LOCKED');
    process.exitCode=1;
    return;
  }
  console.log('\nRELEASE CANDIDATE MANIFEST: WRITTEN');
  console.log(`Workflow authority remains ${EXPECTED_WORKFLOW}; this manifest is descriptive evidence only.`);
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked)printResult(writeReleaseCandidateManifest(process.env));
