#!/usr/bin/env node
/**
 * Build 256 — fail-closed customer portal Stripe TEST acceptance preflight.
 *
 * This validates configuration only. It performs no network calls, does not
 * create a Checkout Session, does not process a webhook, does not mutate
 * Supabase, and never prints secret values or the customer portal token.
 */
import { pathToFileURL } from 'node:url';
import { resolveStripeCheckoutPolicy } from '../supabase/functions/_shared/stripe-runtime-policy.mjs';

export const STRIPE_ACCEPTANCE_RAIL='customer_portal_live';
export const STRIPE_ACCEPTANCE_CONFIRM='I_CONFIRM_STRIPE_TEST_ONLY';
export const STRIPE_ACCEPTANCE_DATA_SCOPE='disposable_test_only';

const clean=(value,max=800)=>String(value ?? '').trim().slice(0,max);
const exactOne=(value)=>clean(value,12)==='1';
const explicitTrue=(value)=>clean(value,16).toLowerCase()==='true';

function safeHttpsUrl(value){
  try{
    const url=new URL(clean(value,2000));
    if(url.protocol!=='https:')return null;
    return url;
  }catch{return null;}
}

function testEmail(value){
  const email=clean(value,320).toLowerCase();
  return Boolean(email && /^[^@\s]+@example\.invalid$/.test(email));
}

function testLabel(value){
  const label=clean(value,160);
  return /^(TEST|STAGING)-[A-Z0-9][A-Z0-9._-]{2,}$/i.test(label);
}

export function evaluateStripeAcceptancePreflight(env={}){
  const errors=[];
  const mode=clean(env.STRIPE_CHECKOUT_MODE,24).toLowerCase();
  const checkoutPolicy=resolveStripeCheckoutPolicy({
    secretKey:env.STRIPE_SECRET_KEY,
    requestedMode:mode,
    environment:env.YWI_ENVIRONMENT,
    liveCheckoutEnabled:env.STRIPE_LIVE_CHECKOUT_ENABLED,
  });
  const webhookSecret=clean(env.STRIPE_WEBHOOK_SIGNING_SECRET,900);
  const portalUrl=safeHttpsUrl(env.YWI_STRIPE_ACCEPTANCE_PORTAL_URL);
  const webhookUrl=safeHttpsUrl(env.YWI_STRIPE_ACCEPTANCE_WEBHOOK_URL);
  const portalTokenPresent=Boolean(portalUrl?.searchParams.get('portal'));
  const emailIsDisposable=testEmail(env.YWI_STRIPE_ACCEPTANCE_TEST_EMAIL);
  const labelIsDisposable=testLabel(env.YWI_STRIPE_ACCEPTANCE_DATA_LABEL);
  const dataScopeConfirmed=clean(env.YWI_STRIPE_ACCEPTANCE_DATA_SCOPE,80)===STRIPE_ACCEPTANCE_DATA_SCOPE;
  const explicitRun=exactOne(env.YWI_RUN_STRIPE_TEST_ACCEPTANCE);
  const confirmation=clean(env.YWI_STRIPE_ACCEPTANCE_CONFIRM,80)===STRIPE_ACCEPTANCE_CONFIRM;
  const liveEnableOff=!explicitTrue(env.STRIPE_LIVE_CHECKOUT_ENABLED);
  const webhookPathValid=Boolean(webhookUrl && /(?:^|\/)stripe-webhook(?:\/|$)/i.test(webhookUrl.pathname));

  if(!explicitRun)errors.push('YWI_RUN_STRIPE_TEST_ACCEPTANCE must be exactly 1.');
  if(!confirmation)errors.push(`YWI_STRIPE_ACCEPTANCE_CONFIRM must be exactly ${STRIPE_ACCEPTANCE_CONFIRM}.`);
  if(mode!=='test')errors.push('STRIPE_CHECKOUT_MODE must be explicitly set to test for customer portal acceptance.');
  if(!liveEnableOff)errors.push('STRIPE_LIVE_CHECKOUT_ENABLED must not be true during Stripe test acceptance.');
  if(!checkoutPolicy.allowed || checkoutPolicy.mode!=='test' || checkoutPolicy.keyMode!=='test'){
    errors.push(`Stripe checkout policy must resolve to an allowed test key/mode (${checkoutPolicy.code || 'unknown'}).`);
  }
  if(!webhookSecret)errors.push('STRIPE_WEBHOOK_SIGNING_SECRET is required.');
  else if(!webhookSecret.startsWith('whsec_'))errors.push('STRIPE_WEBHOOK_SIGNING_SECRET must use the expected whsec_ secret shape.');
  if(!portalUrl)errors.push('YWI_STRIPE_ACCEPTANCE_PORTAL_URL must be a valid HTTPS customer portal URL.');
  else if(!portalTokenPresent)errors.push('YWI_STRIPE_ACCEPTANCE_PORTAL_URL must include the disposable portal token query parameter.');
  if(!webhookUrl)errors.push('YWI_STRIPE_ACCEPTANCE_WEBHOOK_URL must be a valid HTTPS Stripe webhook URL.');
  else if(!webhookPathValid)errors.push('YWI_STRIPE_ACCEPTANCE_WEBHOOK_URL must target the stripe-webhook endpoint.');
  if(!emailIsDisposable)errors.push('YWI_STRIPE_ACCEPTANCE_TEST_EMAIL must use an @example.invalid disposable address.');
  if(!labelIsDisposable)errors.push('YWI_STRIPE_ACCEPTANCE_DATA_LABEL must begin with TEST- or STAGING-.');
  if(!dataScopeConfirmed)errors.push(`YWI_STRIPE_ACCEPTANCE_DATA_SCOPE must be exactly ${STRIPE_ACCEPTANCE_DATA_SCOPE}.`);

  const result={
    ok:errors.length===0,
    rail:STRIPE_ACCEPTANCE_RAIL,
    provider_mode:checkoutPolicy.mode || mode || 'unknown',
    checkout_policy_code:checkoutPolicy.code || 'stripe_policy_unknown',
    test_key_confirmed:checkoutPolicy.keyMode==='test',
    live_checkout_enable_off:liveEnableOff,
    webhook_signing_secret_present:Boolean(webhookSecret),
    webhook_signing_secret_shape_valid:Boolean(webhookSecret && webhookSecret.startsWith('whsec_')),
    portal_url_valid:Boolean(portalUrl),
    portal_origin:portalUrl?.origin || null,
    portal_path:portalUrl?.pathname || null,
    portal_token_present:portalTokenPresent,
    webhook_url_valid:Boolean(webhookUrl),
    webhook_origin:webhookUrl?.origin || null,
    webhook_path:webhookUrl?.pathname || null,
    webhook_path_valid:webhookPathValid,
    disposable_test_email_confirmed:emailIsDisposable,
    disposable_data_label_confirmed:labelIsDisposable,
    disposable_data_scope_confirmed:dataScopeConfirmed,
    explicit_run_confirmed:explicitRun,
    test_only_confirmation:confirmation,
    required_manual_evidence:[
      'hosted_test_checkout_completed',
      'matching_test_webhook_validated',
      'deposit_and_customer_status_transition_verified',
      'human_review_no_production_payment_or_live_provider_mutation',
    ],
    network_calls_performed:false,
    mutations_performed:false,
    errors,
  };

  return result;
}

function printResult(result){
  console.log(JSON.stringify(result,null,2));
  if(!result.ok){
    console.error('\nSTRIPE CUSTOMER PORTAL ACCEPTANCE PREFLIGHT: LOCKED');
    for(const error of result.errors)console.error(`- ${error}`);
    process.exitCode=1;
    return;
  }
  console.log('\nSTRIPE CUSTOMER PORTAL ACCEPTANCE PREFLIGHT: READY FOR MANUAL TEST-MODE EVIDENCE');
  console.log('No provider call, database mutation, or human acceptance evidence was performed by this preflight.');
}

const invoked=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if(invoked)printResult(evaluateStripeAcceptancePreflight(process.env));
