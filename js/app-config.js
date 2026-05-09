/* File: js/app-config.js
   Brief description: Primary runtime config for the YWI HSE app shell.
   Set the Supabase project URL and anon/public key here for normal sign-in.
   The login-screen runtime key entry remains available only as an emergency fallback.
*/

'use strict';

window.YWI_RUNTIME_CONFIG = Object.assign({}, window.YWI_RUNTIME_CONFIG || {}, {
  SB_URL: 'https://jmqvkgiqlimdhcofwkxr.supabase.co',
  SB_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptcXZrZ2lxbGltZGhjb2Z3a3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDYzNDYsImV4cCI6MjA4NTU4MjM0Nn0.ULYqX2TL08_wfREPCIZjIbRf8nAc61ZWndm8UUJZ-D4',
  SUPABASE_URL: 'https://jmqvkgiqlimdhcofwkxr.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptcXZrZ2lxbGltZGhjb2Z3a3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDYzNDYsImV4cCI6MjA4NTU4MjM0Nn0.ULYqX2TL08_wfREPCIZjIbRf8nAc61ZWndm8UUJZ-D4',
  APP_ENV: 'production',
  APP_CONFIG_SOURCE: 'js/app-config.js',
  APP_CONFIG_UPDATED_AT: '2026-03-31'
});
