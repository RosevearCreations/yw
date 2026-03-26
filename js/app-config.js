/* File: js/app-config.js
   Brief description: Primary runtime config for the YWI HSE app shell.
   Set the Supabase project URL and anon/public key here for normal sign-in.
   The login-screen runtime key entry remains available only as an emergency fallback.
*/

'use strict';

window.YWI_RUNTIME_CONFIG = Object.assign({}, window.YWI_RUNTIME_CONFIG || {}, {
  SUPABASE_URL: 'https://jmqvkgiqlimdhcofwkxr.supabase.co',
  SUPABASE_ANON_KEY: '',
  APP_ENV: 'production',
  APP_CONFIG_SOURCE: 'js/app-config.js',
  APP_CONFIG_UPDATED_AT: '2026-03-25'
});
