/* File: js/auth-callback-guard.js
   Build 230 auth callback lifecycle guard.
   Supabase recommends avoiding awaited client work inside onAuthStateChange callbacks. This
   wrapper preserves the client/subscription contract but schedules application callbacks in
   a microtask so the Supabase auth callback can return synchronously first.
*/

'use strict';

(function () {
  const supabase = window.supabase;
  if (!supabase?.createClient || supabase.createClient.__ywiAuthCallbackGuarded) return;

  const originalCreateClient = supabase.createClient.bind(supabase);

  function reportCallbackFailure(error) {
    const message = error?.message || 'Deferred authentication callback failed.';
    console.error('Deferred authentication callback failed.', error || message);
    try {
      window.dispatchEvent(new CustomEvent('ywi:app-error', { detail:{ scope:'auth-callback', message } }));
    } catch {}
  }

  function defer(callback, event, session) {
    const run = () => {
      try {
        Promise.resolve(callback(event, session)).catch(reportCallbackFailure);
      } catch (error) {
        reportCallbackFailure(error);
      }
    };
    if (typeof queueMicrotask === 'function') queueMicrotask(run);
    else Promise.resolve().then(run);
  }

  function createClientWithGuard(...args) {
    const client = originalCreateClient(...args);
    const auth = client?.auth;
    if (!auth?.onAuthStateChange || auth.onAuthStateChange.__ywiAuthCallbackGuarded) return client;

    const originalOnAuthStateChange = auth.onAuthStateChange.bind(auth);
    const guardedOnAuthStateChange = function onAuthStateChangeGuarded(callback) {
      if (typeof callback !== 'function') return originalOnAuthStateChange(callback);
      return originalOnAuthStateChange((event, session) => {
        defer(callback, event, session);
      });
    };
    guardedOnAuthStateChange.__ywiAuthCallbackGuarded = true;
    auth.onAuthStateChange = guardedOnAuthStateChange;
    return client;
  }

  createClientWithGuard.__ywiAuthCallbackGuarded = true;
  createClientWithGuard.__ywiOriginalCreateClient = originalCreateClient;
  supabase.createClient = createClientWithGuard;
})();
