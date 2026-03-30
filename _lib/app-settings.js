// functions/api/_lib/app-settings.js
// Shared app-management settings loader with safe defaults.

export const DEFAULT_APP_SETTINGS = {
  visibility_matrix: {
    customer_detailer_notes: true,
    customer_admin_notes_admin_only: true,
    detailer_admin_notes_admin_only: true
  },
  manual_scheduling_rules: {
    manual_schedule_admin_only: true,
    blocking_admin_only: true,
    notes: ''
  },
  feature_flags: {
    live_updates_default: false,
    customer_chat_enabled: true,
    picture_first_observations: true,
    tier_discount_badges: true,
    image_annotations_enabled: true,
    annotation_lightbox_enabled: true,
    annotation_thread_replies_enabled: true,
    annotation_moderation_enabled: true,
    two_sided_thread_controls_enabled: true,
    notifications_retry_enabled: true,
    catalog_management_enabled: true,
    analytics_journeys_enabled: true,
    abandoned_recovery_enabled: true,
    seo_structured_data_enabled: true,
    analytics_tracking_enabled: true,
    public_catalog_db_enabled: true,
    recovery_templates_enabled: true,
    low_stock_alerts_enabled: true
  },
  recovery_templates: {
    abandoned_checkout_subject: 'Complete your Rosie Dazzlers booking',
    abandoned_checkout_body_text: 'We noticed you started a booking but did not complete checkout. Come back to finish your order when you are ready.',
    abandoned_checkout_body_html: ''
  },
  recovery_rules: {
    abandoned_recovery_enabled: true,
    minimum_page_events: 2,
    require_email: true,
    cooldown_hours: 24,
    default_recovery_channel: 'email'
  },
  recovery_provider_rules: {
    email: {
      enabled: true,
      provider_key: 'default_email',
      send_test_to: '',
      recovery_webhook_url: '',
      auth_token: ''
    },
    sms: {
      enabled: false,
      provider_key: 'default_sms',
      send_test_to: '',
      recovery_webhook_url: '',
      auth_token: ''
    }
  },
  moderation_rules: {
    annotation_customer_visibility_default: true,
    comment_customer_visibility_default: true,
    client_reply_depth_limit: 4,
    staff_reply_depth_limit: 8,
    allow_client_annotation_replies: true,
    allow_staff_hide_without_delete: true
  }
};

export async function loadAppSettings(env, keys = ['visibility_matrix','manual_scheduling_rules','feature_flags']) {
  if (!env?.SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) return structuredClone(DEFAULT_APP_SETTINGS);
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };
  const out = structuredClone(DEFAULT_APP_SETTINGS);
  for (const key of keys) {
    try {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/app_management_settings?select=key,value&key=eq.${encodeURIComponent(key)}&limit=1`, { headers });
      if (!res.ok) continue;
      const rows = await res.json().catch(() => []);
      const row = Array.isArray(rows) ? rows[0] || null : null;
      if (row && row.value && typeof row.value === 'object') out[key] = { ...(out[key] || {}), ...row.value };
    } catch {}
  }
  return out;
}

export async function loadRecoverySettings(env) {
  const settings = await loadAppSettings(env, ['recovery_templates','recovery_rules','recovery_provider_rules']);
  return {
    recovery_templates: settings.recovery_templates || structuredClone(DEFAULT_APP_SETTINGS.recovery_templates),
    recovery_rules: settings.recovery_rules || structuredClone(DEFAULT_APP_SETTINGS.recovery_rules),
    recovery_provider_rules: settings.recovery_provider_rules || structuredClone(DEFAULT_APP_SETTINGS.recovery_provider_rules)
  };
}

export async function loadFeatureFlags(env) {
  const settings = await loadAppSettings(env, ['feature_flags']);
  return settings.feature_flags || structuredClone(DEFAULT_APP_SETTINGS.feature_flags);
}
