/* Build 255 — shared Stripe runtime policy.
   Default provider mode is TEST. Live Checkout/webhook processing requires three explicit facts:
   STRIPE_CHECKOUT_MODE=live, YWI_ENVIRONMENT=production, and STRIPE_LIVE_CHECKOUT_ENABLED=true.
   No secret values are returned from this module. */

const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);

export function stripeKeyMode(secretKey) {
  const value = clean(secretKey, 600);
  if (!value) return 'missing';
  if (value.startsWith('sk_test_')) return 'test';
  if (value.startsWith('sk_live_')) return 'live';
  return 'unrecognized';
}

function requestedMode(value) {
  const mode = clean(value || 'test', 20).toLowerCase();
  return mode || 'test';
}

function environmentName(value) {
  const env = clean(value || 'unknown', 40).toLowerCase();
  return env || 'unknown';
}

function explicitlyEnabled(value) {
  return clean(value, 12).toLowerCase() === 'true';
}

export function resolveStripeRuntimeMode(input = {}) {
  const mode = requestedMode(input.requestedMode);
  const environment = environmentName(input.environment);
  const liveCheckoutEnabled = explicitlyEnabled(input.liveCheckoutEnabled);

  if (!['test', 'live'].includes(mode)) {
    return {
      allowed:false,
      mode,
      environment,
      liveCheckoutEnabled,
      code:'stripe_mode_invalid',
      message:'STRIPE_CHECKOUT_MODE must be either test or live.'
    };
  }

  if (mode === 'test') {
    return {
      allowed:true,
      mode:'test',
      environment,
      liveCheckoutEnabled:false,
      code:'stripe_test_mode',
      message:'Stripe test mode is active.'
    };
  }

  if (environment !== 'production') {
    return {
      allowed:false,
      mode:'live',
      environment,
      liveCheckoutEnabled,
      code:'stripe_live_requires_production_environment',
      message:'Live Stripe mode is blocked unless YWI_ENVIRONMENT=production.'
    };
  }

  if (!liveCheckoutEnabled) {
    return {
      allowed:false,
      mode:'live',
      environment,
      liveCheckoutEnabled:false,
      code:'stripe_live_requires_explicit_enable',
      message:'Live Stripe mode is blocked unless STRIPE_LIVE_CHECKOUT_ENABLED=true.'
    };
  }

  return {
    allowed:true,
    mode:'live',
    environment:'production',
    liveCheckoutEnabled:true,
    code:'stripe_live_explicitly_enabled',
    message:'Live Stripe mode is explicitly enabled for Production.'
  };
}

export function resolveStripeCheckoutPolicy(input = {}) {
  const runtime = resolveStripeRuntimeMode(input);
  if (!runtime.allowed) return { ...runtime, keyMode:stripeKeyMode(input.secretKey) };

  const keyMode = stripeKeyMode(input.secretKey);
  if (keyMode === 'missing') {
    return {
      ...runtime,
      allowed:false,
      keyMode,
      code:'stripe_secret_missing',
      message:'STRIPE_SECRET_KEY is not configured.'
    };
  }
  if (keyMode === 'unrecognized') {
    return {
      ...runtime,
      allowed:false,
      keyMode,
      code:'stripe_secret_unrecognized',
      message:'STRIPE_SECRET_KEY is not a recognized Stripe secret key.'
    };
  }
  if (keyMode !== runtime.mode) {
    return {
      ...runtime,
      allowed:false,
      keyMode,
      code:'stripe_key_mode_mismatch',
      message:`Stripe ${keyMode} key cannot be used while STRIPE_CHECKOUT_MODE=${runtime.mode}.`
    };
  }
  return { ...runtime, allowed:true, keyMode };
}

export function resolveStripeWebhookPolicy(input = {}) {
  const runtime = resolveStripeRuntimeMode(input);
  if (!runtime.allowed) return { ...runtime, eventLivemode:input.eventLivemode };
  if (typeof input.eventLivemode !== 'boolean') {
    return {
      ...runtime,
      allowed:false,
      eventLivemode:input.eventLivemode,
      code:'stripe_event_mode_missing',
      message:'Stripe event livemode evidence is missing.'
    };
  }
  const expectedLivemode = runtime.mode === 'live';
  if (input.eventLivemode !== expectedLivemode) {
    return {
      ...runtime,
      allowed:false,
      eventLivemode:input.eventLivemode,
      code:'stripe_event_mode_mismatch',
      message:`Stripe ${input.eventLivemode ? 'live' : 'test'} event cannot be processed while STRIPE_CHECKOUT_MODE=${runtime.mode}.`
    };
  }
  return { ...runtime, allowed:true, eventLivemode:input.eventLivemode };
}

export function publicStripePolicy(policy = {}) {
  return {
    allowed:policy.allowed === true,
    provider_mode:clean(policy.mode, 20) || 'unknown',
    environment:clean(policy.environment, 40) || 'unknown',
    code:clean(policy.code, 100) || 'stripe_policy_unknown',
    test_mode:policy.mode === 'test'
  };
}
