document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('customerEngagementAdminMount');
  if (!mountEl || !window.DDAuth || !window.DDAuth.isLoggedIn()) return;

  let rendered = false;
  let latestBoardData = null;
  const filterState = { search: '', openOnly: false, giftCardSearch: '', giftCardStatus: 'all', notificationStatus: 'all', giftCardAudience: 'all' };

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
  function money(cents, currency = 'CAD') { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(cents || 0) / 100); }
  function fmtDate(value) { if (!value) return '—'; const d = new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T')); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString(); }
  function setMessage(message, isError = false) { const el = document.getElementById('customerEngagementMessage'); if (!el) return; el.textContent = message; el.style.display = message ? 'block' : 'none'; el.style.color = isError ? '#b00020' : '#0a7a2f'; }
  async function readJson(response, fallback) { const data = await response.json().catch(() => null); if (!response.ok || !data?.ok) throw new Error(data?.error || fallback); return data; }
  function getCheckedValues(name) { return Array.from(mountEl.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => Number(el.value || 0)).filter((value) => value > 0); }
  function matchesSearch(parts) { const needle = String(filterState.search || '').trim().toLowerCase(); if (!needle) return true; return parts.some((part) => String(part || '').toLowerCase().includes(needle)); }
  function wantsOpen(statusValue) { if (!filterState.openOnly) return true; const status = String(statusValue || '').toLowerCase(); return ['open', 'pending_review', 'queued', 'retry', 'active', 'emailed'].includes(status); }

  function render() {
    if (rendered) return;
    rendered = true;
    mountEl.innerHTML = `
      <div class="card" style="margin-top:18px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <h3 style="margin:0">Customer engagement review board</h3>
            <p class="small" style="margin:6px 0 0 0">Review wishlist demand, back-in-stock requests, checkout recovery, gift cards, review requests, testimonials, and queued notifications in one place.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" id="refreshCustomerEngagementButton">Refresh Board</button><button class="btn" type="button" id="runCustomerAutomationButton">Run automation</button></div>
        </div>

        <div class="grid cols-3" style="gap:12px;margin-top:12px">
          <div><label class="small" for="ceSearch">Search the board</label><input id="ceSearch" type="search" placeholder="email, product, order, code..." /></div>
          <div><label class="small" for="ceOpenOnly">Workflow filter</label><label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input id="ceOpenOnly" type="checkbox" /> <span class="small">Show open / pending items first</span></label></div>
          <div><label class="small">Quick actions</label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn" type="button" id="retrySelectedNotificationsButton">Retry selected notifications</button><button class="btn" type="button" id="cancelSelectedNotificationsButton">Cancel selected notifications</button><button class="btn" type="button" id="resendSelectedGiftCardsButton">Resend selected gift cards</button></div></div>
        </div>

        <div id="customerEngagementMessage" class="small" style="display:none;margin:12px 0"></div>
        <div class="grid cols-6" id="customerEngagementSummary" style="gap:12px;margin-bottom:12px"></div>

        <div class="card" style="margin-top:12px">
          <h4 style="margin-top:0">Gift cards</h4>
          <p class="small">Purchaser and recipient can be different people. Issue the card to the recipient while still tracking who bought it and when emails were sent.</p>
          <form id="giftCardIssueForm" class="grid" style="gap:10px;margin-bottom:12px">
            <div class="grid cols-2" style="gap:10px"><input id="giftCardPurchaserEmail" type="email" placeholder="Purchaser email"/><input id="giftCardPurchaserName" type="text" placeholder="Purchaser name"/></div>
            <div class="grid cols-2" style="gap:10px"><input id="giftCardRecipientEmail" type="email" placeholder="Recipient email"/><input id="giftCardRecipientName" type="text" placeholder="Recipient name"/></div>
            <div class="grid cols-4" style="gap:10px"><input id="giftCardAmount" type="number" min="1" step="0.01" placeholder="Amount"/><input id="giftCardExpires" type="date"/><input id="giftCardNote" type="text" placeholder="Internal note"/><input id="giftCardRecipientNote" type="text" placeholder="Message for recipient"/></div>
            <button class="btn" type="submit">Issue Gift Card</button>
          </form>
          <div class="grid cols-4" style="gap:10px;margin-bottom:10px"><input id="giftCardBoardSearch" type="search" placeholder="Search purchaser, recipient, email, code" /><select id="giftCardBoardStatus"><option value="all">All gift cards</option><option value="active">Active only</option><option value="inactive">Inactive only</option><option value="expired">Expired only</option><option value="pending_activation">Pending activation</option></select><select id="giftCardBoardAudience"><option value="all">All delivery history</option><option value="recipient">Recipient history</option><option value="purchaser">Purchaser history</option></select><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" id="activateSelectedGiftCardsButton">Activate selected</button><button class="btn" type="button" id="deactivateSelectedGiftCardsButton">Deactivate selected</button></div></div>
          <div id="customerEngagementGiftCards" class="small">Loading…</div>
        </div>

        <div class="grid cols-2" style="gap:18px;margin-top:18px">
          <div class="card"><h4 style="margin-top:0">Wishlist demand</h4><div id="customerEngagementWishlist" class="small">Loading…</div></div>
          <div class="card"><h4 style="margin-top:0">Back-in-stock requests</h4><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn" type="button" data-bulk-interest-status="reviewed">Mark reviewed</button><button class="btn" type="button" data-bulk-interest-status="done">Close selected</button></div><div id="customerEngagementInterest" class="small">Loading…</div></div>
          <div class="card"><h4 style="margin-top:0">Abandoned checkout recovery</h4><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn" type="button" data-bulk-recovery-email="1">Queue email for selected</button><button class="btn" type="button" data-bulk-recovery-status="closed">Close selected</button></div><div id="customerEngagementRecovery" class="small">Loading…</div></div>
          <div class="card"><h4 style="margin-top:0">Testimonials & reviews</h4><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn" type="button" data-bulk-review-status="approved">Approve selected</button><button class="btn" type="button" data-bulk-review-status="rejected">Reject selected</button><button class="btn" type="button" data-bulk-review-featured="1">Approve + feature</button></div><div id="customerEngagementReviews" class="small">Loading…</div></div>
        </div>

        <div class="grid cols-2" style="gap:18px;margin-top:18px">
          <div class="card"><h4 style="margin-top:0">Recent orders ready for review-request emails</h4><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn" type="button" id="queueSelectedReviewOrdersButton">Queue review email for selected</button></div><div id="customerEngagementReviewOrders" class="small">Loading…</div></div>
          <div class="card"><h4 style="margin-top:0">Notification queue</h4><div class="grid cols-2" style="gap:10px;margin-bottom:10px"><select id="notificationQueueStatus"><option value="all">All statuses</option><option value="queued">Queued</option><option value="retry">Retry</option><option value="failed">Failed</option><option value="sent">Sent</option><option value="suppressed">Suppressed</option><option value="cancelled">Cancelled</option></select><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" id="retrySelectedNotificationsInlineButton">Retry selected</button><button class="btn" type="button" id="cancelSelectedNotificationsInlineButton">Cancel selected</button></div></div><div id="customerEngagementNotifications" class="small">Loading…</div></div>
        </div>

        <div class="grid cols-2" style="gap:18px;margin-top:18px">
          <div class="card">
            <h4 style="margin-top:0">Automation cooldowns & exclusions</h4>
            <form id="engagementCooldownForm" class="grid" style="gap:10px;margin-bottom:10px"><div class="grid cols-3" style="gap:10px"><select id="engagementCooldownKind"><option value="checkout_recovery">Checkout recovery</option><option value="review_request">Review request</option><option value="back_in_stock">Back in stock</option><option value="gift_card_issued">Gift card issued</option><option value="gift_card_purchase_confirmation">Gift card purchase confirmation</option></select><input id="engagementCooldownHours" type="number" min="0" step="1" value="24" placeholder="Cooldown hours"/><label style="display:flex;gap:8px;align-items:center"><input id="engagementCooldownEnabled" type="checkbox" checked/> <span class="small">Enabled</span></label></div><button class="btn" type="submit">Save cooldown rule</button></form>
            <form id="engagementExclusionForm" class="grid" style="gap:10px;margin-bottom:10px"><div class="grid cols-4" style="gap:10px"><select id="engagementExclusionKind"><option value="checkout_recovery">Checkout recovery</option><option value="review_request">Review request</option><option value="back_in_stock">Back in stock</option><option value="gift_card_issued">Gift card issued</option><option value="gift_card_purchase_confirmation">Gift card purchase confirmation</option></select><input id="engagementExclusionDestination" type="email" placeholder="Email exclusion (optional)"/><input id="engagementExclusionProductId" type="number" min="0" step="1" placeholder="Product ID (optional)"/><input id="engagementExclusionOrderId" type="number" min="0" step="1" placeholder="Order ID (optional)"/></div><input id="engagementExclusionReason" type="text" placeholder="Reason"/><button class="btn" type="submit">Add exclusion</button></form>
            <div id="customerEngagementAutomation" class="small">Loading…</div>
          </div>
          <div class="card"><h4 style="margin-top:0">Automation runs & dispatch history</h4><div id="customerEngagementRunLog" class="small">Loading…</div></div>
        </div>
      </div>`;

    document.getElementById('refreshCustomerEngagementButton')?.addEventListener('click', load);
    document.getElementById('runCustomerAutomationButton')?.addEventListener('click', onRunAutomation);
    document.getElementById('giftCardIssueForm')?.addEventListener('submit', onIssueGiftCard);
    document.getElementById('queueSelectedReviewOrdersButton')?.addEventListener('click', onBulkQueueReviewRequests);
    document.getElementById('retrySelectedNotificationsButton')?.addEventListener('click', onBulkRetryNotifications);
    document.getElementById('retrySelectedNotificationsInlineButton')?.addEventListener('click', onBulkRetryNotifications);
    document.getElementById('cancelSelectedNotificationsButton')?.addEventListener('click', onBulkCancelNotifications);
    document.getElementById('cancelSelectedNotificationsInlineButton')?.addEventListener('click', onBulkCancelNotifications);
    document.getElementById('resendSelectedGiftCardsButton')?.addEventListener('click', onBulkResendGiftCards);
    document.getElementById('activateSelectedGiftCardsButton')?.addEventListener('click', () => onBulkSetGiftCardStatus('active'));
    document.getElementById('deactivateSelectedGiftCardsButton')?.addEventListener('click', () => onBulkSetGiftCardStatus('inactive'));
    document.getElementById('engagementCooldownForm')?.addEventListener('submit', onSaveCooldown);
    document.getElementById('engagementExclusionForm')?.addEventListener('submit', onAddExclusion);
    document.getElementById('ceSearch')?.addEventListener('input', (event) => { filterState.search = String(event.target.value || '').trim(); load(); });
    document.getElementById('ceOpenOnly')?.addEventListener('change', (event) => { filterState.openOnly = !!event.target.checked; load(); });
    document.getElementById('giftCardBoardSearch')?.addEventListener('input', (event) => { filterState.giftCardSearch = String(event.target.value || '').trim(); load(); });
    document.getElementById('giftCardBoardStatus')?.addEventListener('change', (event) => { filterState.giftCardStatus = String(event.target.value || 'all'); load(); });
    document.getElementById('giftCardBoardAudience')?.addEventListener('change', (event) => { filterState.giftCardAudience = String(event.target.value || 'all'); load(); });
    document.getElementById('notificationQueueStatus')?.addEventListener('change', (event) => { filterState.notificationStatus = String(event.target.value || 'all'); load(); });
    mountEl.addEventListener('click', onClick);
  }

  function renderList(id, html, emptyText) {
    const el = document.getElementById(id); if (!el) return; el.innerHTML = html || `<div class="small">${esc(emptyText || 'Nothing to show.')}</div>`;
  }

  function renderSummary(summary = {}) {
    const el = document.getElementById('customerEngagementSummary'); if (!el) return;
    const cards = [
      ['Wishlists', summary.wishlist_products_count || 0],
      ['Back in stock', summary.back_in_stock_open_count || 0],
      ['Recovery', summary.checkout_recovery_open_count || 0],
      ['Gift cards', summary.gift_card_active_count || 0],
      ['Pending reviews', summary.pending_review_count || 0],
      ['Queued notices', summary.notification_queue_count || 0]
    ];
    el.innerHTML = cards.map(([label, value]) => `<div class="card"><div class="small">${esc(label)}</div><strong>${esc(String(value))}</strong></div>`).join('');
  }

  function filterGiftCards(rows) {
    const statusNeedle = String(filterState.giftCardStatus || 'all');
    const searchNeedle = String(filterState.giftCardSearch || '').trim().toLowerCase();
    return (rows || []).filter((row) => {
      if (statusNeedle !== 'all' && String(row.status || '').toLowerCase() !== statusNeedle) return false;
      if (!matchesSearch([row.code, row.recipient_email, row.recipient_name, row.purchaser_email, row.purchaser_name])) return false;
      if (searchNeedle && ![row.code, row.recipient_email, row.recipient_name, row.purchaser_email, row.purchaser_name].some((part) => String(part || '').toLowerCase().includes(searchNeedle))) return false;
      return true;
    });
  }

  function filterNotifications(rows) {
    return (rows || []).filter((row) => {
      if (!matchesSearch([row.destination, row.notification_kind, row.error_text])) return false;
      if (!wantsOpen(row.status)) return false;
      const statusNeedle = String(filterState.notificationStatus || 'all');
      if (statusNeedle !== 'all' && String(row.status || '').toLowerCase() !== statusNeedle) return false;
      return true;
    });
  }

  function renderLists(data) {
    renderSummary(data.summary || {});
    renderList('customerEngagementWishlist', (data.wishlist_products || []).filter((row) => matchesSearch([row.name, row.slug])).map((row) => `<div class="card" style="margin-bottom:10px"><strong>${esc(row.name || 'Wishlist product')}</strong><div class="small">${esc(String(row.saved_count || 0))} saves • ${esc(fmtDate(row.last_saved_at))}</div></div>`).join(''), 'No wishlist demand yet.');
    renderList('customerEngagementInterest', (data.interest_requests || []).filter((row) => matchesSearch([row.product_name, row.email, row.notes]) && wantsOpen(row.status)).map((row) => `<div class="card" style="margin-bottom:10px"><label style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="interest-select" value="${esc(row.product_interest_request_id)}"/><span><strong>${esc(row.product_name || 'Product')}</strong><div class="small">${esc(row.email || '')} • ${esc(row.status || 'open')}</div><div class="small">${esc(fmtDate(row.created_at))}</div>${row.notes ? `<div class="small">${esc(row.notes)}</div>` : ''}</span></label></div>`).join(''), 'No interest requests yet.');
    renderList('customerEngagementRecovery', (data.checkout_recovery_leads || []).filter((row) => matchesSearch([row.customer_email, row.customer_name]) && wantsOpen(row.status)).map((row) => `<div class="card" style="margin-bottom:10px"><label style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="recovery-select" value="${esc(row.checkout_recovery_lead_id)}"/><span><strong>${esc(row.customer_name || row.customer_email || 'Recovery lead')}</strong><div class="small">${esc(row.customer_email || '')} • ${esc(money(row.cart_value_cents || 0, row.currency || 'CAD'))} • ${esc(row.status || 'open')}</div><div class="small">${esc(fmtDate(row.created_at))}</div></span></label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn" type="button" data-recovery-email="${esc(row.checkout_recovery_lead_id)}">Queue Email</button></div></div>`).join(''), 'No checkout recovery leads yet.');
    renderList('customerEngagementGiftCards', filterGiftCards(data.gift_cards || []).map((row) => { const auditRows = (Array.isArray(row.delivery_audit_history) ? row.delivery_audit_history : []).filter((entry) => filterState.giftCardAudience === 'all' || String(entry.audience || '').toLowerCase() === filterState.giftCardAudience); return `<div class="card" style="margin-bottom:10px"><label style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="gift-card-select" value="${esc(row.gift_card_id)}"/><span><strong>${esc(row.code || 'Gift card')}</strong><div class="small">${esc(money(row.remaining_amount_cents || 0, row.currency || 'CAD'))} remaining • ${esc(row.status || 'active')} • ${esc(row.purchase_source || 'manual')}</div><div class="small">Purchaser: ${esc(row.purchaser_name || row.purchaser_email || '—')}</div><div class="small">Recipient: ${esc(row.recipient_name || row.recipient_email || '—')}</div><div class="small">Recipient sends ${esc(String(row.recipient_send_count || 0))}${row.recipient_last_sent_at ? ` • last ${esc(fmtDate(row.recipient_last_sent_at))}` : ''}</div><div class="small">Purchaser confirmations ${esc(String(row.purchaser_send_count || 0))}${row.purchaser_last_sent_at ? ` • last ${esc(fmtDate(row.purchaser_last_sent_at))}` : ''}</div>${row.recipient_note ? `<div class="small">Message: ${esc(row.recipient_note)}</div>` : ''}${auditRows.length ? `<div class="small" style="margin-top:6px"><strong>Delivery audit</strong>${auditRows.slice(0, 6).map((entry) => `<div>${esc(entry.audience || 'recipient')} • ${esc(entry.notification_kind || '')} • ${esc(entry.action_type || '')} • ${esc(fmtDate(entry.created_at))}${entry.destination ? ` • ${esc(entry.destination)}` : ''}</div>`).join('')}</div>` : ''}</span></label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn" type="button" data-copy-gift-card-code="${esc(row.code)}">Copy code</button><button class="btn" type="button" data-resend-gift-card-recipient="${esc(row.gift_card_id)}">Resend recipient</button><button class="btn" type="button" data-resend-gift-card-purchaser="${esc(row.gift_card_id)}">Resend purchaser</button><button class="btn" type="button" data-resend-gift-card="${esc(row.gift_card_id)}">Resend both</button><button class="btn" type="button" data-gift-card-status="${esc(row.gift_card_id)}" data-status-value="active">Activate</button><button class="btn" type="button" data-gift-card-status="${esc(row.gift_card_id)}" data-status-value="inactive">Deactivate</button></div></div>`; }).join(''), 'No gift cards issued yet.');
    renderList('customerEngagementReviews', (data.reviews || []).filter((row) => matchesSearch([row.product_name, row.reviewer_name, row.reviewer_email, row.review_text]) && wantsOpen(row.status)).map((row) => `<div class="card" style="margin-bottom:10px"><label style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="review-select" value="${esc(row.product_review_id)}"/><span><strong>${esc(row.product_name || 'Store review')}</strong><div class="small">${esc(row.reviewer_name || 'Customer')} • ${esc(String(row.rating || 0))}/5 • ${esc(row.review_kind || 'testimonial')}</div><div class="small">${esc(fmtDate(row.created_at))} • status ${esc(row.status || 'pending_review')}${Number(row.is_featured || 0) === 1 ? ' • featured' : ''}</div><div style="margin-top:6px">${esc(row.review_text || '')}</div></span></label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn" type="button" data-review-status="${esc(row.product_review_id)}" data-status-value="approved" data-review-featured="0">Approve</button><button class="btn" type="button" data-review-status="${esc(row.product_review_id)}" data-status-value="approved" data-review-featured="1">Feature</button><button class="btn" type="button" data-review-status="${esc(row.product_review_id)}" data-status-value="rejected" data-review-featured="0">Reject</button></div></div>`).join(''), 'No testimonials or reviews yet.');
    renderList('customerEngagementReviewOrders', (data.recent_review_orders || []).filter((row) => matchesSearch([row.order_number, row.customer_name, row.customer_email, row.product_names])).map((row) => `<div class="card" style="margin-bottom:10px"><label style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="review-order-select" value="${esc(row.order_id)}"/><span><strong>${esc(row.order_number || '')}</strong><div class="small">${esc(row.customer_name || row.customer_email || '')} • ${esc(money(row.total_cents || 0, row.currency || 'CAD'))}</div><div class="small">${esc(fmtDate(row.created_at))}</div><div class="small">${esc(row.product_names || '')}</div></span></label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn" type="button" data-review-order-id="${esc(row.order_id)}">Queue Review Email</button></div></div>`).join(''), 'No recent fulfilled orders found.');
    renderList('customerEngagementNotifications', filterNotifications(data.notification_queue || []).map((row) => `<div class="card" style="margin-bottom:10px"><label style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" name="notification-select" value="${esc(row.notification_outbox_id)}"/><span><strong>${esc(row.notification_kind || '')}</strong><div class="small">${esc(row.destination || '')}</div><div class="small">${esc(row.status || '')} • attempts ${esc(String(row.attempt_count || 0))} • created ${esc(fmtDate(row.created_at))}${row.last_attempt_at ? ` • last ${esc(fmtDate(row.last_attempt_at))}` : ''}</div>${row.error_text ? `<div class="small">${esc(row.error_text)}</div>` : ''}</span></label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn" type="button" data-retry-notification="${esc(row.notification_outbox_id)}">Retry</button><button class="btn" type="button" data-cancel-notification="${esc(row.notification_outbox_id)}">Cancel</button></div></div>`).join(''), 'No queued customer notifications right now.');
  }

  function syncAutomationInputs(kind) {
    const currentKind = String(kind || document.getElementById('engagementAutomationKind')?.value || 'review_request').trim();
    const settings = (latestBoardData?.automation_settings || []).find((row) => String(row.notification_kind || '') === currentKind) || null;
    const delayEl = document.getElementById('engagementAutomationDelay');
    const ageEl = document.getElementById('engagementAutomationMaxAge');
    const orderEl = document.getElementById('engagementAutomationOrderStatuses');
    const paymentEl = document.getElementById('engagementAutomationPaymentStatuses');
    const enabledEl = document.getElementById('engagementAutomationEnabled');
    const notesEl = document.getElementById('engagementAutomationNotes');
    if (delayEl) delayEl.value = String(settings?.send_after_hours ?? (currentKind === 'review_request' ? 72 : 1));
    if (ageEl) ageEl.value = String(settings?.max_age_days ?? (currentKind === 'review_request' ? 45 : 7));
    if (orderEl) orderEl.value = Array.isArray(settings?.order_statuses) ? settings.order_statuses.join(', ') : '';
    if (paymentEl) paymentEl.value = Array.isArray(settings?.payment_statuses) ? settings.payment_statuses.join(', ') : '';
    if (enabledEl) enabledEl.checked = Number(settings?.is_enabled ?? 1) === 1;
    if (notesEl) notesEl.value = settings?.notes || '';
  }

  function renderAutomation(data) {
    latestBoardData = data || null;
    renderList('customerEngagementAutomation', `
      <div><strong>Cooldown rules</strong></div>
      ${(data.automation_rules || []).map((row) => `<div class="card" style="margin:8px 0;padding:10px"><strong>${esc(row.notification_kind)}</strong><div class="small">${esc(String(row.cooldown_hours))} hour cooldown • ${Number(row.is_enabled || 0) === 1 ? 'enabled' : 'disabled'}</div></div>`).join('') || '<div class="small">No cooldown rules yet.</div>'}
      <div style="margin-top:12px"><strong>Automation timing rules</strong></div>
      ${(data.automation_settings || []).map((row) => `<div class="card" style="margin:8px 0;padding:10px"><strong>${esc(row.notification_kind)}</strong><div class="small">${Number(row.is_enabled || 0) === 1 ? 'enabled' : 'disabled'} • send after ${esc(String(row.send_after_hours || 0))} hour(s) • max age ${esc(String(row.max_age_days || 0))} day(s)</div>${Array.isArray(row.order_statuses) && row.order_statuses.length ? `<div class="small">order statuses: ${esc(row.order_statuses.join(', '))}</div>` : ''}${Array.isArray(row.payment_statuses) && row.payment_statuses.length ? `<div class="small">payment statuses: ${esc(row.payment_statuses.join(', '))}</div>` : ''}${row.notes ? `<div class="small">${esc(row.notes)}</div>` : ''}</div>`).join('') || '<div class="small">No automation timing rules yet.</div>'}
      <div style="margin-top:12px"><strong>Active exclusions</strong></div>
      ${(data.exclusions || []).map((row) => `<div class="card" style="margin:8px 0;padding:10px"><strong>${esc(row.notification_kind)}</strong><div class="small">${esc(row.destination || 'Any email')}${row.product_id ? ` • Product ${esc(String(row.product_id))}` : ''}${row.order_id ? ` • Order ${esc(String(row.order_id))}` : ''}${row.reason ? ` • ${esc(row.reason)}` : ''}</div><div style="margin-top:8px"><button class="btn" type="button" data-remove-exclusion="${esc(row.notification_exclusion_id)}">Remove</button></div></div>`).join('') || '<div class="small">No exclusions yet.</div>'}
    `, 'No automation controls available yet.');
    syncAutomationInputs();

    const runHtml = [
      ...(data.automation_runs || []).map((row) => {
        let summary = {}; try { summary = JSON.parse(row.summary_json || '{}'); } catch {}
        return `<div class="card" style="margin-bottom:10px"><strong>${esc(row.run_type || 'automation')}</strong><div class="small">${esc(fmtDate(row.created_at))}</div><div class="small" style="margin-top:6px">${Object.entries(summary).map(([k,v]) => `${esc(k)}: ${esc(String(v))}`).join(' • ') || 'No summary recorded.'}</div></div>`;
      }),
      ...(data.notification_dispatch_log || []).slice(0, 20).map((row) => `<div class="card" style="margin-bottom:10px"><strong>${esc(row.notification_kind || 'notification')}</strong><div class="small">${esc(row.destination || '')}</div><div class="small">${esc(row.status || '')} • ${esc(fmtDate(row.created_at))}${row.provider_message_id ? ` • provider ${esc(row.provider_message_id)}` : ''}</div>${row.error_text ? `<div class="small">${esc(row.error_text)}</div>` : ''}</div>`)
    ].join('');
    renderList('customerEngagementRunLog', runHtml, 'No automation runs or dispatch history recorded yet.');
  }

  async function postAction(payload, successMessage) { const response = await window.DDAuth.apiFetch('/api/admin/customer-engagement', { method: 'POST', body: JSON.stringify(payload) }); await readJson(response, 'Customer engagement action failed.'); setMessage(successMessage || 'Saved.'); await load(); }
  async function onSaveCooldown(event) { event.preventDefault(); await postAction({ action: 'set_notification_cooldown', notification_kind: String(document.getElementById('engagementCooldownKind')?.value || '').trim(), cooldown_hours: Number(document.getElementById('engagementCooldownHours')?.value || 0), is_enabled: document.getElementById('engagementCooldownEnabled')?.checked ? 1 : 0 }, 'Cooldown rule saved.'); }
  async function onSaveAutomation(event) { event.preventDefault(); await postAction({ action: 'set_notification_automation', notification_kind: String(document.getElementById('engagementAutomationKind')?.value || '').trim(), send_after_hours: Number(document.getElementById('engagementAutomationDelay')?.value || 0), max_age_days: Number(document.getElementById('engagementAutomationMaxAge')?.value || 1), order_statuses: String(document.getElementById('engagementAutomationOrderStatuses')?.value || '').trim(), payment_statuses: String(document.getElementById('engagementAutomationPaymentStatuses')?.value || '').trim(), notes: String(document.getElementById('engagementAutomationNotes')?.value || '').trim(), is_enabled: document.getElementById('engagementAutomationEnabled')?.checked ? 1 : 0 }, 'Automation rule saved.'); }
  async function onAddExclusion(event) { event.preventDefault(); await postAction({ action: 'add_notification_exclusion', notification_kind: String(document.getElementById('engagementExclusionKind')?.value || '').trim(), destination: String(document.getElementById('engagementExclusionDestination')?.value || '').trim(), product_id: Number(document.getElementById('engagementExclusionProductId')?.value || 0) || null, order_id: Number(document.getElementById('engagementExclusionOrderId')?.value || 0) || null, reason: String(document.getElementById('engagementExclusionReason')?.value || '').trim() }, 'Exclusion added.'); event.target.reset(); }
  async function onIssueGiftCard(event) { event.preventDefault(); const purchaser_email = String(document.getElementById('giftCardPurchaserEmail')?.value || '').trim(); const purchaser_name = String(document.getElementById('giftCardPurchaserName')?.value || '').trim(); const recipient_email = String(document.getElementById('giftCardRecipientEmail')?.value || '').trim(); const recipient_name = String(document.getElementById('giftCardRecipientName')?.value || '').trim(); const amount = Number(document.getElementById('giftCardAmount')?.value || 0); const expires_at = String(document.getElementById('giftCardExpires')?.value || '').trim(); const note = String(document.getElementById('giftCardNote')?.value || '').trim(); const recipient_note = String(document.getElementById('giftCardRecipientNote')?.value || '').trim(); if (!recipient_email || !amount) return setMessage('Recipient email and amount are required.', true); await postAction({ action: 'issue_gift_card', purchaser_email, purchaser_name, recipient_email, recipient_name, amount_cents: Math.round(amount * 100), expires_at, note, recipient_note }, 'Gift card issued and email(s) queued.'); event.target.reset(); }
  async function onBulkQueueReviewRequests() { const orderIds = getCheckedValues('review-order-select'); if (!orderIds.length) return setMessage('Select one or more orders first.', true); await postAction({ action: 'bulk_queue_review_requests', order_ids: orderIds }, `Queued ${orderIds.length} review request email(s).`); }
  async function onBulkRetryNotifications() { const ids = getCheckedValues('notification-select'); if (!ids.length) return setMessage('Select one or more notifications first.', true); await postAction({ action: 'bulk_retry_notifications', notification_outbox_ids: ids }, `Re-queued ${ids.length} notification(s).`); }
  async function onBulkCancelNotifications() { const ids = getCheckedValues('notification-select'); if (!ids.length) return setMessage('Select one or more notifications first.', true); await postAction({ action: 'bulk_cancel_notifications', notification_outbox_ids: ids }, `Cancelled ${ids.length} notification(s).`); }
  async function onBulkResendGiftCards() { const ids = getCheckedValues('gift-card-select'); if (!ids.length) return setMessage('Select one or more gift cards first.', true); await postAction({ action: 'bulk_resend_gift_cards', gift_card_ids: ids }, `Queued resend flow for ${ids.length} gift card(s).`); }
  async function onBulkSetGiftCardStatus(status) { const ids = getCheckedValues('gift-card-select'); if (!ids.length) return setMessage('Select one or more gift cards first.', true); await postAction({ action: 'bulk_set_gift_card_status', gift_card_ids: ids, status }, `${ids.length} gift card(s) updated.`); }
  async function onRunAutomation() { await postAction({ action: 'auto_process_engagement' }, 'Automated engagement cycle finished.'); }

  async function onClick(event) {
    const actionMap = [
      ['[data-bulk-interest-status]', async (el) => { const ids = getCheckedValues('interest-select'); if (!ids.length) return setMessage('Select one or more interest requests first.', true); await postAction({ action: 'bulk_set_interest_status', product_interest_request_ids: ids, status: el.getAttribute('data-bulk-interest-status') || 'reviewed' }, `${ids.length} interest request(s) updated.`); }],
      ['[data-bulk-recovery-email]', async () => { const ids = getCheckedValues('recovery-select'); if (!ids.length) return setMessage('Select one or more recovery leads first.', true); await postAction({ action: 'bulk_queue_recovery_emails', checkout_recovery_lead_ids: ids }, `Queued ${ids.length} recovery email(s).`); }],
      ['[data-bulk-recovery-status]', async (el) => { const ids = getCheckedValues('recovery-select'); if (!ids.length) return setMessage('Select one or more recovery leads first.', true); await postAction({ action: 'set_recovery_status', checkout_recovery_lead_ids: ids, status: el.getAttribute('data-bulk-recovery-status') || 'closed' }, `${ids.length} recovery lead(s) updated.`); }],
      ['[data-bulk-review-status]', async (el) => { const ids = getCheckedValues('review-select'); if (!ids.length) return setMessage('Select one or more reviews first.', true); await postAction({ action: 'bulk_set_review_status', product_review_ids: ids, status: el.getAttribute('data-bulk-review-status') || 'approved', is_featured: 0 }, `${ids.length} review(s) updated.`); }],
      ['[data-bulk-review-featured]', async () => { const ids = getCheckedValues('review-select'); if (!ids.length) return setMessage('Select one or more reviews first.', true); await postAction({ action: 'bulk_set_review_status', product_review_ids: ids, status: 'approved', is_featured: 1 }, `${ids.length} review(s) approved and featured.`); }],
      ['[data-resend-gift-card]', async (el) => postAction({ action: 'resend_gift_card', gift_card_id: Number(el.getAttribute('data-resend-gift-card') || 0) }, 'Gift card email queued again.')],
      ['[data-resend-gift-card-recipient]', async (el) => postAction({ action: 'resend_gift_card_recipient', gift_card_id: Number(el.getAttribute('data-resend-gift-card-recipient') || 0) }, 'Recipient gift card email queued again.')],
      ['[data-resend-gift-card-purchaser]', async (el) => postAction({ action: 'resend_gift_card_purchaser', gift_card_id: Number(el.getAttribute('data-resend-gift-card-purchaser') || 0) }, 'Purchaser confirmation email queued again.')],
      ['[data-gift-card-status]', async (el) => postAction({ action: 'set_gift_card_status', gift_card_id: Number(el.getAttribute('data-gift-card-status') || 0), status: el.getAttribute('data-status-value') || 'inactive' }, 'Gift card status updated.')],
      ['[data-recovery-email]', async (el) => postAction({ action: 'queue_recovery_email', checkout_recovery_lead_id: Number(el.getAttribute('data-recovery-email') || 0) }, 'Recovery email queued.')],
      ['[data-review-status]', async (el) => postAction({ action: 'set_review_status', product_review_id: Number(el.getAttribute('data-review-status') || 0), status: el.getAttribute('data-status-value') || 'approved', is_featured: Number(el.getAttribute('data-review-featured') || 0) }, 'Review updated.')],
      ['[data-review-order-id]', async (el) => postAction({ action: 'queue_review_request', order_id: Number(el.getAttribute('data-review-order-id') || 0) }, 'Review request email queued.')],
      ['[data-retry-notification]', async (el) => postAction({ action: 'retry_notification', notification_outbox_id: Number(el.getAttribute('data-retry-notification') || 0) }, 'Notification re-queued.')],
      ['[data-cancel-notification]', async (el) => postAction({ action: 'cancel_notification', notification_outbox_id: Number(el.getAttribute('data-cancel-notification') || 0) }, 'Notification cancelled.')],
      ['[data-remove-exclusion]', async (el) => postAction({ action: 'remove_notification_exclusion', notification_exclusion_id: Number(el.getAttribute('data-remove-exclusion') || 0) }, 'Exclusion removed.')],
      ['[data-copy-gift-card-code]', async (el) => { const code = String(el.getAttribute('data-copy-gift-card-code') || ''); if (!code) return; try { await navigator.clipboard.writeText(code); setMessage(`Copied gift card code ${code}.`); } catch { setMessage('Could not copy the gift card code on this device.', true); } }]
    ];
    for (const [selector, handler] of actionMap) {
      const hit = event.target.closest(selector);
      if (hit) return handler(hit);
    }
  }

  async function load() {
    try {
      setMessage('Loading customer engagement board...');
      const response = await window.DDAuth.apiFetch('/api/admin/customer-engagement', { method: 'GET' });
      const data = await readJson(response, 'Failed to load customer engagement board.');
      renderLists(data); renderAutomation(data); setMessage('Customer engagement board updated.');
    } catch (error) { setMessage(error.message || 'Failed to load customer engagement board.', true); }
  }

  mountEl.addEventListener('change', (event) => {
    if (event.target?.id === 'engagementAutomationKind') syncAutomationInputs(event.target.value);
  });
  mountEl.addEventListener('submit', (event) => {
    if (event.target?.id === 'engagementAutomationForm') return onSaveAutomation(event);
  });
  document.addEventListener('dd:admin-ready', (event) => { if (!event?.detail?.ok) return; render(); load(); });
  render(); load();
});
