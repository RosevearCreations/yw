(() => {
  'use strict';

  const mount = document.getElementById('adminCommunityMount');
  if (!mount) return;

  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  let latest = { events: [], pickup_profiles: [], vendor_applications: [], summary: {} };

  function cardWrap(title, inner) {
    return `<section class="card" style="margin-top:18px"><h2 style="margin-top:0">${esc(title)}</h2>${inner}</section>`;
  }

  function recurrenceLabel(row) {
    if (row?.recurrence_label) return row.recurrence_label;
    if (row?.recurrence_rule === 'weekly') return 'Weekly';
    if (row?.recurrence_rule === 'biweekly') return 'Biweekly';
    if (row?.recurrence_rule === 'monthly') return 'Monthly';
    return 'One-time';
  }

  function eventRowsMarkup() {
    return (latest.events || []).map((row) => `
      <tr>
        <td>${esc(row.title)}</td>
        <td>${esc(row.event_type)}</td>
        <td>${esc(row.event_status)}</td>
        <td>${esc(recurrenceLabel(row))}</td>
        <td>${esc(row.city || row.region_label || '—')}</td>
        <td>${esc(row.starts_at || '—')}</td>
        <td>${esc(row.application_mode || 'closed')}</td>
        <td><button class="btn" type="button" data-edit-event="${Number(row.community_event_id || 0)}">Edit</button> <button class="btn" type="button" data-delete-event="${Number(row.community_event_id || 0)}">Delete</button></td>
      </tr>
    `).join('') || '<tr><td colspan="8" class="small">No event rows yet.</td></tr>';
  }

  function pickupRowsMarkup() {
    return (latest.pickup_profiles || []).map((row) => `
      <tr>
        <td>${esc(row.label)}</td>
        <td>${esc(row.pickup_mode)}</td>
        <td>${esc(row.city || row.region_label || '—')}</td>
        <td>${Number(row.appointment_only || 0) ? 'Yes' : 'No'}</td>
        <td>${esc(String(row.lead_time_hours || 0))}</td>
        <td><button class="btn" type="button" data-edit-pickup="${Number(row.pickup_profile_id || 0)}">Edit</button> <button class="btn" type="button" data-delete-pickup="${Number(row.pickup_profile_id || 0)}">Delete</button></td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="small">No pickup rows yet.</td></tr>';
  }

  function vendorRowsMarkup() {
    return (latest.vendor_applications || []).map((row) => `
      <tr>
        <td>${esc(row.event_title_snapshot || 'Event')}</td>
        <td>${esc(row.vendor_name)}</td>
        <td>${esc(row.contact_name || row.contact_email)}</td>
        <td>${esc(row.city || '—')}</td>
        <td>${esc(row.application_status)}</td>
        <td><button class="btn" type="button" data-edit-application="${Number(row.event_vendor_application_id || 0)}">Review</button></td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="small">No vendor applications yet.</td></tr>';
  }

  function render(message = '') {
    mount.innerHTML = [
      cardWrap('Community events, pickup, and market visibility', `<p class="small">Move the public Events and Pickup pages away from hard-coded placeholder text and into admin-managed rows that can support local SEO, marketplace timing, recurring market schedules, vendor applications, and safer public guidance. ${message ? `<br><strong>${esc(message)}</strong>` : ''}</p><div class="small">Events: ${esc(latest.summary?.event_count || 0)} • Recurring: ${esc(latest.summary?.recurring_event_count || 0)} • Vendor applications: ${esc(latest.summary?.vendor_application_count || 0)}</div>`),
      cardWrap('Upcoming events / markets', `
        <form id="communityEventForm" class="admin-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
          <input type="hidden" name="community_event_id" value="">
          <div><label class="small">Title</label><input name="title" required placeholder="Tillsonburg market table"></div>
          <div><label class="small">Type</label><select name="event_type"><option value="market">market</option><option value="popup">popup</option><option value="show">show</option><option value="pickup_window">pickup_window</option><option value="meetup">meetup</option><option value="fair">fair</option><option value="festival">festival</option></select></div>
          <div><label class="small">Status</label><select name="event_status"><option value="planned">planned</option><option value="live">live</option><option value="completed">completed</option><option value="cancelled">cancelled</option></select></div>
          <div><label class="small">Starts at</label><input name="starts_at" placeholder="2026-05-15 10:00"></div>
          <div><label class="small">Ends at</label><input name="ends_at" placeholder="2026-05-15 16:00"></div>
          <div><label class="small">Venue</label><input name="venue_name" placeholder="Community market"></div>
          <div><label class="small">City</label><input name="city" placeholder="Tillsonburg"></div>
          <div><label class="small">Region label</label><input name="region_label" placeholder="Oxford County"></div>
          <div><label class="small">Event URL</label><input name="event_url" placeholder="https://..."></div>
          <div><label class="small">Sort order</label><input name="sort_order" type="number" value="0"></div>
          <div><label class="small">Recurrence rule</label><select name="recurrence_rule"><option value="none">none</option><option value="weekly">weekly</option><option value="biweekly">biweekly</option><option value="monthly">monthly</option></select></div>
          <div><label class="small">Recurrence interval</label><input name="recurrence_interval" type="number" value="1"></div>
          <div><label class="small">Recurrence count</label><input name="recurrence_count" type="number" placeholder="leave blank for open-ended"></div>
          <div><label class="small">Recurrence until</label><input name="recurrence_until" placeholder="2026-12-31 16:00"></div>
          <div style="grid-column:1/-1"><label class="small">Recurrence label</label><input name="recurrence_label" placeholder="Every first Saturday from May through September"></div>
          <div><label class="small">Application mode</label><select name="application_mode"><option value="closed">closed</option><option value="internal">internal</option><option value="external">external</option><option value="info_only">info_only</option></select></div>
          <div><label class="small">Application URL</label><input name="application_url" placeholder="https://... (for external applications)"></div>
          <div><label class="small">Vendor capacity</label><input name="vendor_capacity" type="number" value="0"></div>
          <div><label class="small"><input name="pickup_supported" type="checkbox"> Pickup supported</label><br><label class="small"><input name="is_featured" type="checkbox"> Featured</label><br><label class="small"><input name="is_active" type="checkbox" checked> Active</label></div>
          <div style="grid-column:1/-1"><label class="small">Event image URL</label><input name="image_url" placeholder="https://assets... or upload below"></div>
          <div><label class="small">Image alt</label><input name="image_alt" placeholder="Describe the event image"></div>
          <div><label class="small">Upload image</label><input id="communityEventImageFile" type="file" accept="image/*"></div>
          <div style="align-self:end"><button class="btn" id="communityEventUpload" type="button">Upload event image</button></div>
          <div style="grid-column:1/-1"><label class="small">Vendor note</label><textarea name="vendor_note" rows="2" placeholder="What prospective vendors should know about setup, categories, or availability."></textarea></div>
          <div style="grid-column:1/-1"><label class="small">Public note</label><textarea name="public_note" rows="2" placeholder="What buyers should know before attending or asking about this event."></textarea></div>
          <div style="grid-column:1/-1"><label class="small">Sale channel note</label><textarea name="sale_channel_note" rows="2" placeholder="Explain handmade vs vintage/collectible mix, marketplace tie-ins, or pickup conditions."></textarea></div>
          <div style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="submit">Save event</button><button class="btn" id="communityEventReset" type="button">Clear</button></div>
        </form>
        <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Recurs</th><th>Location</th><th>Starts</th><th>Applications</th><th>Actions</th></tr></thead><tbody>${eventRowsMarkup()}</tbody></table></div>
      `),
      cardWrap('Pickup profiles', `
        <form id="pickupProfileForm" class="admin-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
          <input type="hidden" name="pickup_profile_id" value="">
          <div><label class="small">Label</label><input name="label" required placeholder="Tillsonburg appointment pickup"></div>
          <div><label class="small">Mode</label><select name="pickup_mode"><option value="appointment">appointment</option><option value="event">event</option><option value="market">market</option><option value="porch">porch</option><option value="hybrid">hybrid</option></select></div>
          <div><label class="small">City</label><input name="city" placeholder="Tillsonburg"></div>
          <div><label class="small">Region label</label><input name="region_label" placeholder="Oxford County"></div>
          <div><label class="small">Lead time hours</label><input name="lead_time_hours" type="number" value="24"></div>
          <div><label class="small">Map URL</label><input name="map_url" placeholder="https://..."></div>
          <div><label class="small">Sort order</label><input name="sort_order" type="number" value="0"></div>
          <div><label class="small"><input name="appointment_only" type="checkbox" checked> Appointment only</label><br><label class="small"><input name="is_active" type="checkbox" checked> Active</label></div>
          <div style="grid-column:1/-1"><label class="small">Public note</label><textarea name="public_note" rows="2" placeholder="General pickup guidance for this location/profile."></textarea></div>
          <div style="grid-column:1/-1"><label class="small">Availability note</label><textarea name="availability_note" rows="2" placeholder="Handmade timelines, hybrid listings, external-only reminders, etc."></textarea></div>
          <div style="grid-column:1/-1"><label class="small">Contact hint</label><input name="contact_hint" placeholder="Please confirm item availability before travelling."></div>
          <div style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="submit">Save pickup profile</button><button class="btn" id="pickupProfileReset" type="button">Clear</button></div>
        </form>
        <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Label</th><th>Mode</th><th>Location</th><th>Appointment</th><th>Lead hrs</th><th>Actions</th></tr></thead><tbody>${pickupRowsMarkup()}</tbody></table></div>
      `),
      cardWrap('Vendor applications', `
        <p class="small">Internal vendor applications from the public Events page land here for review. Use external mode on an event when the application should go to another system instead.</p>
        <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Event</th><th>Vendor</th><th>Contact</th><th>City</th><th>Status</th><th>Actions</th></tr></thead><tbody>${vendorRowsMarkup()}</tbody></table></div>
        <form id="vendorApplicationReviewForm" class="admin-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px">
          <input type="hidden" name="event_vendor_application_id" value="">
          <div><label class="small">Status</label><select name="application_status"><option value="submitted">submitted</option><option value="reviewing">reviewing</option><option value="approved">approved</option><option value="waitlisted">waitlisted</option><option value="declined">declined</option><option value="closed">closed</option></select></div>
          <div style="grid-column:1/-1"><label class="small">Internal note</label><textarea name="internal_note" rows="3" placeholder="Review note, table size questions, follow-up timing, or why the vendor was approved/waitlisted."></textarea></div>
          <div style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="submit">Save vendor review</button><button class="btn" id="vendorApplicationReset" type="button">Clear</button></div>
        </form>
      `)
    ].join('');
    wire();
  }

  function fillForm(form, row) {
    Object.entries(row).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (!field) return;
      if (field.type === 'checkbox') field.checked = Number(value || 0) === 1;
      else field.value = value == null ? '' : String(value);
    });
  }

  async function request(payload) {
    const response = await fetch('/api/admin/community-content', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Save failed.');
    return data;
  }

  async function uploadEventImage(eventForm) {
    const fileInput = document.getElementById('communityEventImageFile');
    const file = fileInput?.files?.[0];
    if (!file) throw new Error('Choose an image first.');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_scope', 'general');
    formData.append('asset_tag', 'community_event_asset');
    formData.append('variant_role', 'event-card');
    formData.append('annotation_notes', 'community_event_asset');
    const fetcher = window.DDAuth?.apiFetch ? window.DDAuth.apiFetch.bind(window.DDAuth) : window.fetch.bind(window);
    const response = await fetcher('/api/admin/media-upload', { method: 'POST', body: formData, headers: {} });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || !data?.asset?.public_url) throw new Error(data?.error || 'Upload failed.');
    if (eventForm?.elements?.image_url) eventForm.elements.image_url.value = String(data.asset.public_url || '');
    if (eventForm?.elements?.image_alt && !eventForm.elements.image_alt.value) eventForm.elements.image_alt.value = file.name.replace(/\.[a-z0-9]+$/i, '');
    if (fileInput) fileInput.value = '';
    return data.asset.public_url;
  }

  function wire() {
    const eventForm = document.getElementById('communityEventForm');
    const pickupForm = document.getElementById('pickupProfileForm');
    const reviewForm = document.getElementById('vendorApplicationReviewForm');
    const eventReset = document.getElementById('communityEventReset');
    const pickupReset = document.getElementById('pickupProfileReset');
    const reviewReset = document.getElementById('vendorApplicationReset');
    const uploadButton = document.getElementById('communityEventUpload');

    eventForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(eventForm);
      const payload = Object.fromEntries(fd.entries());
      payload.action = 'save_event';
      payload.pickup_supported = eventForm.elements.pickup_supported.checked;
      payload.is_featured = eventForm.elements.is_featured.checked;
      payload.is_active = eventForm.elements.is_active.checked;
      try {
        await request(payload);
        await load('Event saved.');
      } catch (error) {
        render(error.message || 'Event save failed.');
      }
    });

    uploadButton?.addEventListener('click', async () => {
      try {
        await uploadEventImage(eventForm);
        render('Event image uploaded. Save the event to keep the URL.');
      } catch (error) {
        render(error.message || 'Event image upload failed.');
      }
    });

    pickupForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(pickupForm);
      const payload = Object.fromEntries(fd.entries());
      payload.action = 'save_pickup_profile';
      payload.appointment_only = pickupForm.elements.appointment_only.checked;
      payload.is_active = pickupForm.elements.is_active.checked;
      try {
        await request(payload);
        await load('Pickup profile saved.');
      } catch (error) {
        render(error.message || 'Pickup profile save failed.');
      }
    });

    reviewForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(reviewForm);
      const payload = Object.fromEntries(fd.entries());
      payload.action = 'save_vendor_application_review';
      try {
        await request(payload);
        await load('Vendor application review saved.');
      } catch (error) {
        render(error.message || 'Vendor application review failed.');
      }
    });

    eventReset?.addEventListener('click', () => eventForm?.reset());
    pickupReset?.addEventListener('click', () => pickupForm?.reset());
    reviewReset?.addEventListener('click', () => reviewForm?.reset());

    mount.querySelectorAll('[data-edit-event]').forEach((button) => button.addEventListener('click', () => {
      const row = (latest.events || []).find((item) => Number(item.community_event_id || 0) === Number(button.getAttribute('data-edit-event') || 0));
      if (row && eventForm) fillForm(eventForm, row);
    }));
    mount.querySelectorAll('[data-delete-event]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await request({ action: 'delete_event', community_event_id: Number(button.getAttribute('data-delete-event') || 0) });
        await load('Event deleted.');
      } catch (error) {
        render(error.message || 'Event delete failed.');
      }
    }));
    mount.querySelectorAll('[data-edit-pickup]').forEach((button) => button.addEventListener('click', () => {
      const row = (latest.pickup_profiles || []).find((item) => Number(item.pickup_profile_id || 0) === Number(button.getAttribute('data-edit-pickup') || 0));
      if (row && pickupForm) fillForm(pickupForm, row);
    }));
    mount.querySelectorAll('[data-delete-pickup]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await request({ action: 'delete_pickup_profile', pickup_profile_id: Number(button.getAttribute('data-delete-pickup') || 0) });
        await load('Pickup profile deleted.');
      } catch (error) {
        render(error.message || 'Pickup profile delete failed.');
      }
    }));
    mount.querySelectorAll('[data-edit-application]').forEach((button) => button.addEventListener('click', () => {
      const row = (latest.vendor_applications || []).find((item) => Number(item.event_vendor_application_id || 0) === Number(button.getAttribute('data-edit-application') || 0));
      if (row && reviewForm) fillForm(reviewForm, row);
    }));
  }

  async function load(message = '') {
    try {
      const response = await fetch('/api/admin/community-content', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Community content could not be loaded.');
      latest = {
        events: Array.isArray(data.events) ? data.events : [],
        pickup_profiles: Array.isArray(data.pickup_profiles) ? data.pickup_profiles : [],
        vendor_applications: Array.isArray(data.vendor_applications) ? data.vendor_applications : [],
        summary: data.summary || {}
      };
      render(message);
    } catch (error) {
      render(error.message || 'Community content could not be loaded.');
    }
  }

  load();
})();
