(() => {
  'use strict';
  const mount = document.getElementById('pickupLiveMount');
  if (!mount) return;

  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function render(rows, warning = '') {
    const items = Array.isArray(rows) ? rows : [];
    mount.innerHTML = `
      <section class="card" style="margin-top:18px">
        <h2 style="margin-top:0">Live pickup profiles and handoff guidance</h2>
        <p class="small">This section now reads from the live community-content API so pickup guidance, appointment lead times, and local handoff notes can be updated from admin instead of living only in page text.${warning ? ` <strong>${esc(warning)}</strong>` : ''}</p>
        <div class="grid cols-3" style="gap:16px;margin-top:12px">
          ${items.length ? items.map((row) => `
            <article class="card">
              <h3 style="margin-top:0">${esc(row.label || 'Pickup profile')}</h3>
              <div class="small">${esc(row.pickup_mode || 'appointment')} • ${Number(row.appointment_only || 0) ? 'appointment only' : 'not appointment only'}</div>
              <div class="small" style="margin-top:6px">${esc([row.city, row.region_label].filter(Boolean).join(' • ') || 'Southern Ontario')}</div>
              <div class="small">Lead time: ${esc(String(row.lead_time_hours || 0))} hour(s)</div>
              ${row.public_note ? `<p class="small" style="margin-top:8px">${esc(row.public_note)}</p>` : ''}
              ${row.availability_note ? `<p class="small">${esc(row.availability_note)}</p>` : ''}
              ${row.contact_hint ? `<p class="small">${esc(row.contact_hint)}</p>` : ''}
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                <a class="btn" href="/contact/">Ask before pickup</a>
                ${row.map_url ? `<a class="btn" href="${esc(row.map_url)}" rel="noopener" target="_blank">Map</a>` : ''}
                <a class="btn" href="/marketplaces/">Marketplace guide</a>
              </div>
            </article>
          `).join('') : `
            <article class="card" style="grid-column:1/-1">
              <h3 style="margin-top:0">Pickup guidance is currently using the safe fallback</h3>
              <p class="small">Use Contact before checkout if an item is fragile, larger than a parcel shipment, hybrid-listed, external-only, or easier to hand off in person in Tillsonburg, Oxford County, Norfolk County, or elsewhere in Southern Ontario.</p>
              <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="/contact/">Ask about pickup</a><a class="btn" href="/events/">Events</a><a class="btn" href="/collections/">Collections</a></div>
            </article>
          `}
        </div>
      </section>`;
  }

  fetch('/api/community-content', { headers: { Accept: 'application/json' } })
    .then((response) => response.json().catch(() => null).then((data) => ({ response, data })))
    .then(({ response, data }) => {
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Pickup profile data could not be loaded.');
      render(data.pickup_profiles || [], data.warning || '');
    })
    .catch(() => render([], 'Fallback pickup messaging is showing right now.'));
})();
