/* Customer portal - build 2026-06-17b / schema 150
   Public token-based quote review, acceptance, hosted deposits, dispatch status,
   and follow-up requests. The protected staff shell is hidden in portal mode. */
'use strict';

(function () {
  const params = new URLSearchParams(window.location.search);
  const token = String(params.get('portal') || '').trim();
  if (!token) return;

  document.body.classList.add('customer-portal-mode');
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  const money = (value) => Number(value || 0).toLocaleString('en-CA', { style:'currency', currency:'CAD' });
  const dateTime = (value) => value ? new Date(value).toLocaleString('en-CA', { dateStyle:'medium', timeStyle:'short' }) : 'To be scheduled';
  const byId = (id) => document.getElementById(id);
  const safeUrl = (value) => { try { const parsed = new URL(String(value || ''), window.location.origin); return ['http:','https:'].includes(parsed.protocol) ? parsed.href : ''; } catch { return ''; } };
  let portal = null;

  function ensureShell() {
    let shell = byId('customerPortalView');
    if (shell) return shell;
    shell = document.createElement('main');
    shell.id = 'customerPortalView';
    shell.className = 'customer-portal-shell';
    shell.innerHTML = `
      <header class="customer-portal-header">
        <a class="customer-portal-brand" href="/" aria-label="YWI home">
          <span class="customer-portal-mark" aria-hidden="true">YWI</span>
          <span><strong>Yard Weasels Inc.</strong><small>Secure customer quote portal</small></span>
        </a>
        <span class="customer-portal-security">Token-protected link</span>
      </header>
      <section id="customerPortalStatus" class="customer-portal-status" aria-live="polite">Loading your quote…</section>
      <div id="customerPortalContent"></div>
      <footer class="customer-portal-footer">
        <strong>Need help?</strong>
        <span>Use the follow-up form on this page. Do not send payment-card details in a message.</span>
      </footer>`;
    document.body.prepend(shell);
    return shell;
  }

  function sanitizeHtml(raw) {
    if (!raw) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(raw), 'text/html');
    const allowed = new Set(['P','BR','STRONG','B','EM','I','UL','OL','LI','H2','H3','H4','BLOCKQUOTE','HR','TABLE','THEAD','TBODY','TR','TH','TD','A','SMALL']);
    [...doc.body.querySelectorAll('*')].forEach((node) => {
      if (!allowed.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        return;
      }
      const href = node.tagName === 'A' ? (node.getAttribute('href') || '') : '';
      [...node.attributes].forEach((attr) => node.removeAttribute(attr.name));
      if (node.tagName === 'A') {
        if (/^(https?:|mailto:|tel:)/i.test(href)) {
          node.setAttribute('href', href);
          node.setAttribute('rel', 'noopener noreferrer');
        }
      }
    });
    return doc.body.innerHTML;
  }

  function markdownToHtml(markdown) {
    const lines = String(markdown || '').split(/\r?\n/);
    const out = [];
    let list = null;
    const inline = (value) => esc(value)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    lines.forEach((line) => {
      const value = line.trim();
      if (!value) { closeList(); return; }
      const heading = value.match(/^(#{2,4})\s+(.+)$/);
      if (heading) { closeList(); const level = Math.min(4, heading[1].length); out.push(`<h${level}>${inline(heading[2])}</h${level}>`); return; }
      const bullet = value.match(/^[-*]\s+(.+)$/);
      const numbered = value.match(/^\d+\.\s+(.+)$/);
      if (bullet || numbered) {
        const next = bullet ? 'ul' : 'ol';
        if (list !== next) { closeList(); list = next; out.push(`<${list}>`); }
        out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
        return;
      }
      closeList();
      out.push(`<p>${inline(value)}</p>`);
    });
    closeList();
    return out.join('');
  }

  function quoteBody(row) {
    const html = sanitizeHtml(row.rendered_html || '');
    return html || markdownToHtml(row.rendered_markdown || '') || '<p>The detailed quote document is being prepared. The totals and acceptance controls below remain current.</p>';
  }

  function portalNotice(message, type = 'info') {
    const el = byId('customerPortalStatus');
    if (!el) return;
    el.className = `customer-portal-status customer-portal-status-${type}`;
    el.textContent = message;
  }

  function render(row) {
    portal = row;
    const content = byId('customerPortalContent');
    if (!content) return;
    const accepted = !!row.accepted_at;
    const deposit = row.deposit || null;
    const workOrder = row.work_order || null;
    const due = Number(row.deposit_required_amount || deposit?.requested_amount || 0);
    const receiptUrl = safeUrl(deposit?.receipt_url);
    const depositPaid = ['paid','complete','completed'].includes(String(deposit?.status || row.deposit_status || '').toLowerCase());
    document.title = `${row.rendered_title || row.estimate?.number || 'Customer quote'} | Yard Weasels Inc.`;

    content.innerHTML = `
      <section class="customer-portal-hero">
        <div>
          <span class="customer-portal-kicker">Quote ${esc(row.estimate?.number || '')}</span>
          <h1>${esc(row.rendered_title || 'Your service quote')}</h1>
          <p>Review the scope, confirm the totals, accept securely, and follow deposit or scheduling progress from one page.</p>
        </div>
        <div class="customer-portal-hero-visual" role="img" aria-label="Approved service visual placeholder">
          <span aria-hidden="true">◇</span>
          <strong>Service plan visual</strong>
          <small>An approved job, crew, equipment, or finished-work image can replace this placeholder.</small>
        </div>
      </section>

      <section class="customer-portal-summary" aria-label="Quote summary">
        <article><small>Subtotal</small><strong>${money(row.estimate?.subtotal)}</strong></article>
        <article><small>Tax</small><strong>${money(row.estimate?.tax_total)}</strong></article>
        <article class="customer-portal-total"><small>Total</small><strong>${money(row.estimate?.total)}</strong></article>
        <article><small>Valid until</small><strong>${esc(row.estimate?.valid_until || 'Contact us')}</strong></article>
      </section>

      <div class="customer-portal-layout">
        <article class="customer-portal-document">
          <div class="customer-portal-section-heading"><span>Quote details</span><small>Status: ${esc(row.package_status || row.estimate?.status || 'review')}</small></div>
          <div class="customer-portal-document-body">${quoteBody(row)}</div>
        </article>

        <aside class="customer-portal-actions-panel">
          <section class="customer-portal-progress">
            <h2>Progress</h2>
            <ol>
              <li class="is-complete"><span>1</span><div><strong>Quote available</strong><small>Ready for review</small></div></li>
              <li class="${accepted ? 'is-complete' : 'is-current'}"><span>2</span><div><strong>Quote acceptance</strong><small>${accepted ? `Accepted ${dateTime(row.accepted_at)}` : 'Your confirmation is needed'}</small></div></li>
              <li class="${depositPaid ? 'is-complete' : (accepted && due > 0 ? 'is-current' : '')}"><span>3</span><div><strong>Deposit</strong><small>${due > 0 ? `${money(deposit?.paid_amount || 0)} of ${money(due)} paid` : 'No deposit currently required'}</small></div></li>
              <li class="${workOrder?.scheduled_start ? 'is-complete' : ''}"><span>4</span><div><strong>Scheduling</strong><small>${workOrder?.scheduled_start ? dateTime(workOrder.scheduled_start) : 'Scheduled after acceptance and deposit review'}</small></div></li>
            </ol>
          </section>

          ${!accepted ? `
          <form id="customerPortalAcceptForm" class="customer-portal-form">
            <h2>Accept this quote</h2>
            <label>Your name<input type="text" name="customer_name" autocomplete="name" required minlength="2"></label>
            <label>Email<input type="email" name="customer_email" autocomplete="email" required></label>
            <label>Optional note<textarea name="acceptance_notes" rows="3" maxlength="1000" placeholder="Scheduling, access, or service notes"></textarea></label>
            <label class="customer-portal-check"><input type="checkbox" name="accept_terms" required> <span>I accept the quoted scope, pricing, and terms shown on this page.</span></label>
            <button type="submit" class="primary">Accept quote</button>
          </form>` : `
          <section class="customer-portal-confirmed">
            <span aria-hidden="true">✓</span><div><h2>Quote accepted</h2><p>Accepted by ${esc(row.accepted_by_name || 'customer')} on ${dateTime(row.accepted_at)}.</p></div>
          </section>`}

          ${accepted && due > 0 && !depositPaid ? `
          <section class="customer-portal-deposit">
            <h2>Deposit</h2>
            <p>A deposit of <strong>${money(due)}</strong> is required to continue.</p>
            <button id="customerPortalDepositBtn" type="button" class="primary">Pay deposit securely</button>
            <small>Payment is completed on Stripe Checkout. Card details are not entered into this application.</small>
          </section>` : ''}

          ${depositPaid ? `<section class="customer-portal-confirmed"><span aria-hidden="true">✓</span><div><h2>Deposit received</h2><p>${money(deposit?.paid_amount || due)} recorded.${receiptUrl ? ` <a href="${esc(receiptUrl)}" rel="noopener noreferrer">View receipt</a>` : ''}</p></div></section>` : ''}

          <section class="customer-portal-schedule">
            <h2>Dispatch and schedule</h2>
            <dl>
              <div><dt>Work order</dt><dd>${esc(workOrder?.number || 'Created after acceptance')}</dd></div>
              <div><dt>Status</dt><dd>${esc(workOrder?.schedule_status || workOrder?.status || 'Pending')}</dd></div>
              <div><dt>Start</dt><dd>${dateTime(workOrder?.scheduled_start)}</dd></div>
              <div><dt>End</dt><dd>${dateTime(workOrder?.scheduled_end)}</dd></div>
            </dl>
          </section>

          <form id="customerPortalRequestForm" class="customer-portal-form customer-portal-followup">
            <h2>Ask a question or request a change</h2>
            <label>Name<input type="text" name="customer_name" autocomplete="name" value="${esc(row.accepted_by_name || '')}"></label>
            <label>Email<input type="email" name="customer_email" autocomplete="email"></label>
            <label>Message<textarea name="message" rows="4" maxlength="2000" required placeholder="Tell us what needs attention"></textarea></label>
            <button type="submit" class="secondary">Send follow-up</button>
          </form>
        </aside>
      </div>`;
    bindActions();
    portalNotice(accepted ? 'Your secure quote and current service status are shown below.' : 'Review the quote and use the acceptance form when ready.', 'success');
  }

  async function call(payload) {
    if (!window.YWIAPI?.customerPortal) throw new Error('Customer portal service is not available. Refresh and try again.');
    return window.YWIAPI.customerPortal({ token, ...payload });
  }

  function setButtonBusy(button, busy, label) {
    if (!button) return;
    if (busy) { button.dataset.originalLabel = button.textContent; button.textContent = label; button.disabled = true; }
    else { button.textContent = button.dataset.originalLabel || button.textContent; button.disabled = false; }
  }

  function bindActions() {
    const accept = byId('customerPortalAcceptForm');
    accept?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = accept.querySelector('button[type="submit"]');
      setButtonBusy(button, true, 'Accepting…');
      portalNotice('Recording your acceptance…');
      try {
        const data = Object.fromEntries(new FormData(accept).entries());
        const response = await call({ action:'accept_quote', customer_name:data.customer_name, customer_email:data.customer_email, acceptance_notes:data.acceptance_notes, accept_terms:true, terms_version:'2026-06-17' });
        if (!response?.ok) throw new Error(response?.error || 'Quote acceptance failed.');
        render(response.portal);
        portalNotice('Quote accepted. Your work order has been created or linked.', 'success');
      } catch (error) { portalNotice(error?.message || 'Quote acceptance failed.', 'error'); setButtonBusy(button, false); }
    });

    const depositButton = byId('customerPortalDepositBtn');
    depositButton?.addEventListener('click', async () => {
      setButtonBusy(depositButton, true, 'Opening secure checkout…');
      portalNotice('Creating a secure deposit checkout…');
      try {
        const response = await call({ action:'create_deposit_checkout' });
        if (!response?.ok) throw new Error(response?.error || 'Deposit checkout could not be created.');
        if (response.checkout_url) { window.location.assign(response.checkout_url); return; }
        portalNotice(response.message || 'Deposit request was saved, but online checkout still needs configuration.', 'error');
      } catch (error) { portalNotice(error?.message || 'Deposit checkout failed.', 'error'); setButtonBusy(depositButton, false); }
    });

    const followup = byId('customerPortalRequestForm');
    followup?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = followup.querySelector('button[type="submit"]');
      setButtonBusy(button, true, 'Sending…');
      try {
        const data = Object.fromEntries(new FormData(followup).entries());
        const response = await call({ action:'request_service', customer_name:data.customer_name, customer_email:data.customer_email, message:data.message, service_type:'Existing quote follow-up' });
        if (!response?.ok) throw new Error(response?.error || 'Follow-up could not be sent.');
        followup.reset();
        portalNotice('Your follow-up was sent and added to the staff queue.', 'success');
      } catch (error) { portalNotice(error?.message || 'Follow-up could not be sent.', 'error'); }
      finally { setButtonBusy(button, false); }
    });
  }

  async function load() {
    ensureShell();
    portalNotice(params.get('deposit') === 'success' ? 'Payment returned successfully. Refreshing deposit status…' : 'Loading your quote…');
    try {
      const response = await call({ action:'load' });
      if (!response?.ok) throw new Error(response?.error || 'Quote portal could not be loaded.');
      render(response.portal);
      if (params.get('deposit') === 'success') portalNotice('Payment was submitted. The confirmed deposit status appears below when the payment webhook has finished.', 'success');
      if (params.get('deposit') === 'cancelled') portalNotice('Deposit checkout was cancelled. No new payment was recorded.', 'info');
    } catch (error) {
      portalNotice(error?.message || 'This portal link is unavailable.', 'error');
      const content = byId('customerPortalContent');
      if (content) content.innerHTML = '<section class="customer-portal-error"><span aria-hidden="true">!</span><h1>Portal link unavailable</h1><p>The link may be expired, disabled, or incomplete. Use a recent quote email or contact Yard Weasels Inc. for a replacement link.</p></section>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once:true });
  else load();
})();
