(() => {
  'use strict';
  const mount = document.getElementById('eventsLiveMount');
  if (!mount) return;

  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  let latest = { events: [], upcoming_occurrences: [], vendor_application_options: [], warning: '' };

  function formatWhen(row) {
    const start = row?.occurrence_starts_at || row?.starts_at || '';
    const end = row?.occurrence_ends_at || row?.ends_at || '';
    if (!start) return 'Date to be announced';
    return end ? `${esc(start)} → ${esc(end)}` : esc(start);
  }

  function recurrenceText(row) {
    return row?.recurrence_summary ? `<div class="small" style="margin-top:4px"><strong>${esc(row.recurrence_summary)}</strong></div>` : '';
  }

  function applicationButtons(row) {
    const mode = String(row?.application_mode || 'closed');
    if (mode === 'internal') return `<a class="btn" href="#vendorApplicationMount">Apply as vendor</a>`;
    if (mode === 'external' && row?.application_url) return `<a class="btn" href="${esc(row.application_url)}" rel="noopener" target="_blank">Vendor application</a>`;
    if (mode === 'info_only') return `<a class="btn" href="/contact/">Ask about vending</a>`;
    return '';
  }

  function imageBlock(row) {
    if (!row?.image_url) return '';
    return `<div style="aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#f5f5f5;margin-bottom:12px"><img src="${esc(row.image_url)}" alt="${esc(row.image_alt || row.title || 'Event image')}" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy"></div>`;
  }

  function renderApplicationForm() {
    const options = Array.isArray(latest.vendor_application_options) ? latest.vendor_application_options : [];
    if (!options.length) return '';
    return `
      <section class="card" id="vendorApplicationMount" style="margin-top:18px">
        <h2 style="margin-top:0">Vendor application interest</h2>
        <p class="small">Some events use an internal vendor-interest form before table space is confirmed. Share what you sell, where you are based, and how you normally vend.</p>
        <form id="vendorApplicationForm" class="admin-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
          <div><label class="small">Event</label><select name="community_event_id" required>${options.map((row) => `<option value="${Number(row.community_event_id || 0)}">${esc(row.title)}${row.city ? ` — ${esc(row.city)}` : ''}</option>`).join('')}</select></div>
          <div><label class="small">Vendor or shop name</label><input name="vendor_name" required placeholder="Shop name"></div>
          <div><label class="small">Contact name</label><input name="contact_name" placeholder="Your name"></div>
          <div><label class="small">Email</label><input name="contact_email" type="email" required placeholder="name@example.com"></div>
          <div><label class="small">Phone</label><input name="contact_phone" placeholder="Optional"></div>
          <div><label class="small">City</label><input name="city" placeholder="Tillsonburg"></div>
          <div style="grid-column:1/-1"><label class="small">What do you sell?</label><textarea name="offered_items" rows="3" placeholder="Handmade jewelry, vintage decor, old tools, upcycled pieces, etc."></textarea></div>
          <div><label class="small">Website</label><input name="website_url" placeholder="https://..."></div>
          <div><label class="small">Marketplace link</label><input name="marketplace_url" placeholder="Facebook Marketplace or Etsy"></div>
          <div><label class="small">Instagram</label><input name="instagram_url" placeholder="https://instagram.com/... or @handle"></div>
          <div style="grid-column:1/-1"><label class="small">Setup or table notes</label><textarea name="setup_notes" rows="3" placeholder="Tell us about table size, power needs, display style, or special requirements."></textarea></div>
          <div style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="submit">Submit vendor application</button><span id="vendorApplicationMessage" class="small"></span></div>
        </form>
      </section>`;
  }

  function render(events, warning = '') {
    const items = Array.isArray(events) ? events : [];
    mount.innerHTML = `
      <section class="card" style="margin-top:18px">
        <h2 style="margin-top:0">Upcoming markets, recurring dates, and local event notes</h2>
        <p class="small">This section now reads from the live community-content API so market dates, recurring market schedules, vendor application notes, pickup windows, and in-person selling guidance can be updated from admin instead of hiding in page-only text.${warning ? ` <strong>${esc(warning)}</strong>` : ''}</p>
        <div class="grid cols-3" style="gap:16px;margin-top:12px">
          ${items.length ? items.map((row) => `
            <article class="card">
              ${imageBlock(row)}
              <h3 style="margin-top:0">${esc(row.title || 'Community event')}</h3>
              <div class="small">${esc(row.event_type || 'market')} • ${esc(row.event_status || 'planned')}</div>
              ${recurrenceText(row)}
              <div class="small" style="margin-top:6px">${formatWhen(row)}</div>
              <div class="small">${esc([row.venue_name, row.city, row.region_label].filter(Boolean).join(' • ') || 'Southern Ontario')}</div>
              ${row.public_note ? `<p class="small" style="margin-top:8px">${esc(row.public_note)}</p>` : ''}
              ${row.sale_channel_note ? `<p class="small">${esc(row.sale_channel_note)}</p>` : ''}
              ${row.vendor_note ? `<p class="small"><strong>Vendor note:</strong> ${esc(row.vendor_note)}</p>` : ''}
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                ${row.event_url ? `<a class="btn" href="${esc(row.event_url)}" rel="noopener" target="_blank">Event link</a>` : ''}
                ${Number(row.pickup_supported || 0) ? `<a class="btn" href="/pickup/">Pickup details</a>` : ''}
                ${applicationButtons(row)}
                <a class="btn" href="/contact/">Ask about availability</a>
              </div>
            </article>
          `).join('') : `
            <article class="card" style="grid-column:1/-1">
              <h3 style="margin-top:0">No live market dates are posted yet</h3>
              <p class="small">The page is ready for Tillsonburg, Oxford County, Norfolk County, and other Southern Ontario market dates, including recurring schedules and vendor-interest notes, but until rows are published you can still use Contact to ask whether a piece is available for pickup, viewing, or a local handoff.</p>
              <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="/contact/">Ask about events</a><a class="btn" href="/pickup/">Pickup guide</a><a class="btn" href="/marketplaces/">Marketplace guide</a></div>
            </article>
          `}
        </div>
      </section>
      ${renderApplicationForm()}`;
    wireApplicationForm();
  }

  function wireApplicationForm() {
    const form = document.getElementById('vendorApplicationForm');
    const message = document.getElementById('vendorApplicationMessage');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.action = 'submit_vendor_application';
      message.textContent = 'Sending…';
      try {
        const response = await fetch('/api/community-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Vendor application could not be saved.');
        form.reset();
        message.textContent = data?.message || 'Vendor application saved for review.';
      } catch (error) {
        message.textContent = error.message || 'Vendor application could not be saved.';
      }
    });
  }

  fetch('/api/community-content', { headers: { Accept: 'application/json' } })
    .then((response) => response.json().catch(() => null).then((data) => ({ response, data })))
    .then(({ response, data }) => {
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Community event data could not be loaded.');
      latest = {
        events: Array.isArray(data.events) ? data.events : [],
        upcoming_occurrences: Array.isArray(data.upcoming_occurrences) ? data.upcoming_occurrences : [],
        vendor_application_options: Array.isArray(data.vendor_application_options) ? data.vendor_application_options : [],
        warning: data.warning || ''
      };
      render(latest.upcoming_occurrences.length ? latest.upcoming_occurrences : latest.events, latest.warning || '');
    })
    .catch(() => render([], 'Fallback event messaging is showing right now.'));
})();
