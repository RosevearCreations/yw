#!/usr/bin/env node
/** Build 255 — deterministic Stripe customer-portal provider-mode acceptance authority.
 * No Stripe network call, database mutation, provider mutation, or human rail closure occurs here.
 */
import fs from 'node:fs';
import {
  resolveStripeCheckoutPolicy,
  resolveStripeRuntimeMode,
  resolveStripeWebhookPolicy,
  publicStripePolicy
} from '../supabase/functions/_shared/stripe-runtime-policy.mjs';

const read = (path) => fs.readFileSync(path, 'utf8');
const hasAll = (text, values) => values.every((value) => text.includes(value));
const checks = [];
const add = (name, ok, detail = '') => checks.push({ name, ok:!!ok, detail });
const expectPolicy = (name, policy, expected) => {
  const ok = Object.entries(expected).every(([key,value]) => policy?.[key] === value);
  add(name, ok, `${policy?.code || 'no-code'} / ${policy?.mode || 'no-mode'} / allowed=${String(policy?.allowed)}`);
};

const shared = read('supabase/functions/_shared/stripe-runtime-policy.mjs');
const portalFn = read('supabase/functions/customer-portal/index.ts');
const webhookFn = read('supabase/functions/stripe-webhook/index.ts');
const portalUi = read('js/customer-portal.js');
const runbook = read('sql/188_open_rail_acceptance_readiness.sql');
const workflow = read('.github/workflows/staging-browser-integration.yml');
const pkg = JSON.parse(read('package.json'));

expectPolicy('default-test-checkout-allows-test-key', resolveStripeCheckoutPolicy({ secretKey:'sk_test_build255' }), {
  allowed:true, mode:'test', keyMode:'test', code:'stripe_test_mode'
});
expectPolicy('default-test-checkout-blocks-live-key', resolveStripeCheckoutPolicy({ secretKey:'sk_live_build255' }), {
  allowed:false, mode:'test', keyMode:'live', code:'stripe_key_mode_mismatch'
});
expectPolicy('missing-secret-fails-closed', resolveStripeCheckoutPolicy({ secretKey:'' }), {
  allowed:false, mode:'test', keyMode:'missing', code:'stripe_secret_missing'
});
expectPolicy('unrecognized-secret-fails-closed', resolveStripeCheckoutPolicy({ secretKey:'not-a-stripe-key' }), {
  allowed:false, mode:'test', keyMode:'unrecognized', code:'stripe_secret_unrecognized'
});
expectPolicy('invalid-provider-mode-fails-closed', resolveStripeRuntimeMode({ requestedMode:'sandbox' }), {
  allowed:false, mode:'sandbox', code:'stripe_mode_invalid'
});
expectPolicy('live-mode-blocked-outside-production', resolveStripeCheckoutPolicy({
  secretKey:'sk_live_build255', requestedMode:'live', environment:'staging', liveCheckoutEnabled:'true'
}), {
  allowed:false, mode:'live', code:'stripe_live_requires_production_environment'
});
expectPolicy('live-mode-blocked-without-explicit-enable', resolveStripeCheckoutPolicy({
  secretKey:'sk_live_build255', requestedMode:'live', environment:'production', liveCheckoutEnabled:'false'
}), {
  allowed:false, mode:'live', code:'stripe_live_requires_explicit_enable'
});
expectPolicy('live-mode-requires-three-explicit-facts', resolveStripeCheckoutPolicy({
  secretKey:'sk_live_build255', requestedMode:'live', environment:'production', liveCheckoutEnabled:'true'
}), {
  allowed:true, mode:'live', keyMode:'live', code:'stripe_live_explicitly_enabled'
});

expectPolicy('test-webhook-event-allowed-by-default', resolveStripeWebhookPolicy({ eventLivemode:false }), {
  allowed:true, mode:'test', eventLivemode:false, code:'stripe_test_mode'
});
expectPolicy('live-webhook-event-blocked-by-default', resolveStripeWebhookPolicy({ eventLivemode:true }), {
  allowed:false, mode:'test', eventLivemode:true, code:'stripe_event_mode_mismatch'
});
expectPolicy('missing-webhook-livemode-fails-closed', resolveStripeWebhookPolicy({}), {
  allowed:false, mode:'test', code:'stripe_event_mode_missing'
});
expectPolicy('live-webhook-requires-explicit-production-enable', resolveStripeWebhookPolicy({
  requestedMode:'live', environment:'production', liveCheckoutEnabled:'true', eventLivemode:true
}), {
  allowed:true, mode:'live', eventLivemode:true, code:'stripe_live_explicitly_enabled'
});
expectPolicy('test-event-blocked-in-explicit-live-mode', resolveStripeWebhookPolicy({
  requestedMode:'live', environment:'production', liveCheckoutEnabled:'true', eventLivemode:false
}), {
  allowed:false, mode:'live', eventLivemode:false, code:'stripe_event_mode_mismatch'
});

const publicPolicy = publicStripePolicy(resolveStripeCheckoutPolicy({ secretKey:'sk_test_BUILD255_SECRET_MUST_NOT_LEAK' }));
add('public-policy-is-secret-free',
  publicPolicy.allowed === true && publicPolicy.test_mode === true && publicPolicy.provider_mode === 'test'
  && !JSON.stringify(publicPolicy).includes('BUILD255_SECRET_MUST_NOT_LEAK')
  && !Object.prototype.hasOwnProperty.call(publicPolicy,'keyMode'),
  'Browser/observability policy exposes mode and decision only, never secret/key classification.');

add('shared-policy-defaults-test', hasAll(shared, [
  "requestedMode(value)", "value || 'test'", "mode:'test'", "stripe_key_mode_mismatch",
  "stripe_live_requires_production_environment", "stripe_live_requires_explicit_enable", "stripe_event_mode_mismatch"
]), 'Shared policy defaults fail-closed to Stripe test mode and requires explicit Production live enable.');

add('checkout-function-uses-shared-policy', hasAll(portalFn, [
  "resolveStripeCheckoutPolicy", "STRIPE_CHECKOUT_MODE", "STRIPE_LIVE_CHECKOUT_ENABLED", "YWI_ENVIRONMENT",
  "if (!stripePolicy.allowed) throw new HttpError(409", "metadata[ywi_stripe_mode]", "metadata[ywi_environment]",
  "session?.livemode", "'cs_live_'", "'cs_test_'", "stripe_policy:safeStripePolicy"
]), 'Hosted checkout cannot call/attach Stripe unless configured mode, secret prefix, returned livemode and session prefix agree.');

const checkoutPolicyIndex = portalFn.indexOf('const stripePolicy=resolveStripeCheckoutPolicy');
const checkoutNetworkIndex = portalFn.indexOf('const session=await stripeCheckout');
add('checkout-policy-precedes-stripe-network', checkoutPolicyIndex >= 0 && checkoutNetworkIndex > checkoutPolicyIndex && portalFn.slice(checkoutPolicyIndex, checkoutNetworkIndex).includes('if (!stripePolicy.allowed)'), 'Provider-mode policy is evaluated before the Stripe Checkout network call.');

add('webhook-function-uses-shared-policy', hasAll(webhookFn, [
  "resolveStripeWebhookPolicy", "STRIPE_CHECKOUT_MODE", "STRIPE_LIVE_CHECKOUT_ENABLED", "eventLivemode:event?.livemode",
  "reason:'stripe_mode'", "validation_status:'failed'", "provider_mode:stripePolicy.mode", "event_livemode:event.livemode"
]), 'Webhook verifies provider mode and records secret-free mode evidence.');

const webhookPolicyIndex = webhookFn.indexOf('stripePolicy=resolveStripeWebhookPolicy');
const webhookDepositIndex = webhookFn.indexOf("depositId=clean(session?.metadata?.deposit_request_id");
const webhookPaidRpcIndex = webhookFn.indexOf("ywi_rpc_record_portal_deposit_paid");
add('webhook-policy-precedes-deposit-mutation', webhookPolicyIndex >= 0 && webhookDepositIndex > webhookPolicyIndex && webhookPaidRpcIndex > webhookDepositIndex, 'Provider-mode decision happens before deposit lookup and paid-state mutation.');
add('webhook-mode-mismatch-acknowledged-without-processing', hasAll(webhookFn, [
  "if(!stripePolicy.allowed)", "delivery_status:'failed'", "return new Response(JSON.stringify({ok:true,ignored:true,reason:'stripe_mode'"
]), 'Forbidden live/test deliveries are acknowledged to stop retries while deposit state remains untouched.');

add('customer-ui-remains-hosted-no-card-entry', hasAll(portalUi, [
  "action:'create_deposit_checkout'", "window.location.assign(response.checkout_url)",
  'Payment is completed on Stripe Checkout. Card details are not entered into this application.',
  "params.get('deposit') === 'success'", 'confirmed deposit status appears below when the payment webhook has finished.'
]) && !/(card_number|card-number|cvc|cvv|expiry|expiration)/i.test(portalUi), 'YW never renders or collects card details and waits for webhook-confirmed deposit state.');

add('customer-portal-rail-remains-test-mode-human-external', hasAll(runbook, [
  "('customer_portal_live','Run Stripe test-mode customer portal acceptance'",
  'Use Stripe test mode and a disposable/test customer flow',
  'Do not use a Production payment or enable provider mutation as a shortcut.',
  'matching validated webhook delivery',
  'human review that no Production payment/provider mutation was used.',
  '"production_payment":"forbidden"'
]), 'Build 255 strengthens the technical boundary but does not substitute for required Stripe test-mode/human evidence.');

add('no-live-enable-hardcoded', !/STRIPE_LIVE_CHECKOUT_ENABLED\s*[=:]\s*["']?true/i.test(shared + '\n' + portalFn + '\n' + webhookFn), 'Source never hardcodes the live provider switch on.');
add('no-business-rail-auto-close', !/update\s+public\.admin_scorecard_progress_rails[\s\S]{0,500}customer_portal_live/i.test(shared + '\n' + portalFn + '\n' + webhookFn), 'Runtime policy cannot close the customer portal rail.');
add('dedicated-source-command-wired', pkg.scripts?.['test:stripe-portal-acceptance'] === 'node scripts/stripe-customer-portal-acceptance-check.mjs');
add('dedicated-browser-command-wired', pkg.scripts?.['test:browser:stripe-portal-acceptance'] === 'playwright test --config=playwright.config.mjs tests/browser/stripe-customer-portal-acceptance.spec.mjs');
add('workflow-source-gate-mandatory', workflow.includes('npm run test:stripe-portal-acceptance'));
add('workflow-browser-gate-mandatory', workflow.includes('npm run test:browser:stripe-portal-acceptance'));
add('provider-rail-not-added-to-staging-catalog-runner', !/target_rail:[\s\S]{0,1400}customer_portal_live/.test(workflow), 'Stripe provider acceptance stays distinct from the six dedicated-staging catalog rails.');

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
if (failed.length) {
  console.error(`\nBuild 255 Stripe customer-portal acceptance authority FAILED (${checks.length - failed.length}/${checks.length}).`);
  process.exit(1);
}
console.log(`\nBuild 255 Stripe customer-portal acceptance authority passed (${checks.length}/${checks.length}).`);
