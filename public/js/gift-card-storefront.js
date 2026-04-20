(function () {
  const STORAGE_KEY = 'dd_storefront_gift_card_purchase_v1';
  const AMOUNTS = [25, 50, 75, 100, 150, 200];

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function readGiftCardPurchase() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw || 'null');
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveGiftCardPurchase(payload) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload || {}));
      document.dispatchEvent(new CustomEvent('dd:gift-card-purchase-changed', { detail: payload || null }));
    } catch {}
  }

  function clearGiftCardPurchase() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      document.dispatchEvent(new CustomEvent('dd:gift-card-purchase-changed', { detail: null }));
    } catch {}
  }

  function dollarsToCents(value) {
    return Math.max(0, Math.round((Number(value || 0) || 0) * 100));
  }

  function centsToMoney(value, currency = 'CAD') {
    const amount = Number(value || 0) / 100;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  }

  function renderShopGiftCard() {
    const mount = document.getElementById('shopGiftCardStorefrontMount');
    if (!mount) return;
    const saved = readGiftCardPurchase();
    mount.innerHTML = `
      <section class="card storefront-gift-card-card">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <h2 style="margin:0">Gift cards for handmade picks</h2>
            <p class="small" style="margin:6px 0 0 0">Buy a Devil n Dove gift card right from the storefront. The purchaser and the recipient can be different people.</p>
          </div>
          ${saved ? `<div class="small">Saved draft: ${escapeHtml(centsToMoney(saved.amount_cents || 0, saved.currency || 'CAD'))} for ${escapeHtml(saved.recipient_name || saved.recipient_email || 'recipient')}</div>` : ''}
        </div>
        <form id="storefrontGiftCardForm" class="grid" style="gap:12px;margin-top:12px">
          <div>
            <div class="small" style="margin-bottom:6px">Choose an amount</div>
            <div class="gift-card-amount-grid">
              ${AMOUNTS.map((amount) => `<button class="btn" type="button" data-gift-card-amount="${amount}">${escapeHtml(centsToMoney(amount * 100))}</button>`).join('')}
            </div>
          </div>
          <div class="grid cols-4" style="gap:12px">
            <div><label class="small" for="storeGiftCardAmount">Amount</label><input id="storeGiftCardAmount" type="number" min="1" step="0.01" value="${escapeHtml(saved ? String((Number(saved.amount_cents || 0) / 100).toFixed(2)) : '50.00')}" /></div>
            <div><label class="small" for="storeGiftCardRecipientName">Recipient name</label><input id="storeGiftCardRecipientName" type="text" value="${escapeHtml(saved?.recipient_name || '')}" /></div>
            <div><label class="small" for="storeGiftCardRecipientEmail">Recipient email</label><input id="storeGiftCardRecipientEmail" type="email" value="${escapeHtml(saved?.recipient_email || '')}" /></div>
            <div><label class="small" for="storeGiftCardExpires">Expiry</label><input id="storeGiftCardExpires" type="date" value="${escapeHtml(saved?.expires_at || '')}" /></div>
          </div>
          <div class="grid cols-3" style="gap:12px">
            <div><label class="small" for="storeGiftCardPurchaserName">Purchaser name</label><input id="storeGiftCardPurchaserName" type="text" value="${escapeHtml(saved?.purchaser_name || '')}" /></div>
            <div><label class="small" for="storeGiftCardPurchaserEmail">Purchaser email</label><input id="storeGiftCardPurchaserEmail" type="email" value="${escapeHtml(saved?.purchaser_email || '')}" /></div>
            <div><label class="small" for="storeGiftCardMessage">Message</label><input id="storeGiftCardMessage" type="text" value="${escapeHtml(saved?.recipient_note || '')}" placeholder="Optional note for the recipient" /></div>
          </div>
          <div id="storefrontGiftCardMessage" class="small" style="display:none"></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn" type="submit">Save and continue to checkout</button>
            <button class="btn" type="button" id="clearStorefrontGiftCardButton">Clear gift card draft</button>
          </div>
        </form>
      </section>`;

    const messageEl = document.getElementById('storefrontGiftCardMessage');
    const setMessage = (message, isError = false) => {
      if (!messageEl) return;
      messageEl.textContent = message || '';
      messageEl.style.display = message ? '' : 'none';
      messageEl.style.color = isError ? '#b00020' : '#0a7a2f';
    };

    document.querySelectorAll('[data-gift-card-amount]').forEach((button) => {
      button.addEventListener('click', () => {
        const amount = Number(button.getAttribute('data-gift-card-amount') || 0);
        const field = document.getElementById('storeGiftCardAmount');
        if (field && amount > 0) field.value = amount.toFixed(2);
      });
    });

    document.getElementById('clearStorefrontGiftCardButton')?.addEventListener('click', () => {
      clearGiftCardPurchase();
      renderShopGiftCard();
      setMessage('Gift card draft cleared.');
    });

    document.getElementById('storefrontGiftCardForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const amountCents = dollarsToCents(document.getElementById('storeGiftCardAmount')?.value || 0);
      const recipientEmail = String(document.getElementById('storeGiftCardRecipientEmail')?.value || '').trim();
      if (amountCents <= 0 || !recipientEmail) {
        setMessage('Amount and recipient email are required.', true);
        return;
      }
      const payload = {
        amount_cents: amountCents,
        currency: 'CAD',
        recipient_name: String(document.getElementById('storeGiftCardRecipientName')?.value || '').trim(),
        recipient_email: recipientEmail,
        purchaser_name: String(document.getElementById('storeGiftCardPurchaserName')?.value || '').trim(),
        purchaser_email: String(document.getElementById('storeGiftCardPurchaserEmail')?.value || '').trim(),
        recipient_note: String(document.getElementById('storeGiftCardMessage')?.value || '').trim(),
        expires_at: String(document.getElementById('storeGiftCardExpires')?.value || '').trim(),
        purchase_label: 'Storefront gift card'
      };
      saveGiftCardPurchase(payload);
      window.location.href = '/checkout/';
    });
  }

  function renderCheckoutGiftCard() {
    const mount = document.getElementById('checkoutGiftCardPurchaseMount');
    if (!mount) return;
    const saved = readGiftCardPurchase();
    if (!saved) {
      mount.innerHTML = `<h3 style="margin-top:0">Buying a gift card?</h3><p class="small" style="margin-bottom:0">You can start a gift-card purchase from the shop page. If you already saved one, it will appear here automatically during checkout.</p>`;
      return;
    }
    mount.innerHTML = `
      <h3 style="margin-top:0">Gift card purchase</h3>
      <p class="small">This checkout includes a gift card for ${escapeHtml(saved.recipient_name || saved.recipient_email || 'your recipient')}. The gift card will stay <strong>pending activation</strong> until payment is confirmed.</p>
      <div class="grid cols-3" style="gap:12px">
        <div class="card"><div class="small">Amount</div><strong>${escapeHtml(centsToMoney(saved.amount_cents || 0, saved.currency || 'CAD'))}</strong></div>
        <div class="card"><div class="small">Recipient</div><strong>${escapeHtml(saved.recipient_name || saved.recipient_email || '')}</strong></div>
        <div class="card"><div class="small">Purchaser</div><strong>${escapeHtml(saved.purchaser_name || saved.purchaser_email || 'Checkout customer')}</strong></div>
      </div>
      ${saved.recipient_note ? `<div class="small" style="margin-top:10px">Message: ${escapeHtml(saved.recipient_note)}</div>` : ''}
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px"><button class="btn" type="button" id="removeCheckoutGiftCardButton">Remove gift card purchase</button></div>`;
    document.getElementById('removeCheckoutGiftCardButton')?.addEventListener('click', () => {
      clearGiftCardPurchase();
      renderCheckoutGiftCard();
      document.dispatchEvent(new CustomEvent('dd:gift-card-purchase-changed', { detail: null }));
    });
  }

  window.DDGiftCardPurchase = {
    read: readGiftCardPurchase,
    save: saveGiftCardPurchase,
    clear: clearGiftCardPurchase,
    renderShopGiftCard,
    renderCheckoutGiftCard
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderShopGiftCard();
    renderCheckoutGiftCard();
  });
})();
