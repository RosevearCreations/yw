document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('memberReviewsMount');
  if (!mountEl || !window.DDAuth) return;

  let rendered = false;

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function fmtDate(value) {
    if (!value) return '—';
    const raw = String(value);
    const date = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? raw : date.toLocaleString();
  }

  function setMessage(message, isError = false) {
    const el = document.getElementById('memberReviewsMessage');
    if (!el) return;
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
    el.style.color = isError ? '#b00020' : '#0a7a2f';
  }

  function renderReviewHistory(reviews) {
    const history = document.getElementById('memberReviewHistory');
    if (!history) return;

    const rows = Array.isArray(reviews) ? reviews : [];
    if (!rows.length) {
      history.innerHTML = '<div class="small">No feedback submitted yet.</div>';
      return;
    }

    history.innerHTML = `
      <h3 style="margin:0 0 10px 0">Your submitted feedback</h3>
      ${rows.map((row) => `
        <div class="card" style="margin-bottom:10px">
          <strong>${esc(row.product_name || 'General testimonial')}</strong>
          <div class="small">
            ${esc(row.status || 'pending_review')} • ${esc(fmtDate(row.created_at))} • ${'★'.repeat(Math.max(1, Number(row.rating || 0)))}
          </div>
          <div style="margin-top:8px">${esc(row.review_text || '')}</div>
          ${row.admin_notes ? `<div class="small" style="margin-top:6px">Admin note: ${esc(row.admin_notes)}</div>` : ''}
        </div>
      `).join('')}
    `;
  }

  function render() {
    if (rendered) return;
    rendered = true;
    mountEl.innerHTML = `
      <div class="card">
        <h2 style="margin-top:0">Reviews & testimonials</h2>
        <p class="small" style="margin-top:0">Send quick product feedback or a general testimonial. Reviews are saved for review before they show on the storefront.</p>
        <div id="memberReviewsMessage" class="small" style="display:none;margin-bottom:12px"></div>
        <form id="memberReviewForm" class="grid" style="gap:12px">
          <div class="grid cols-3" style="gap:12px">
            <div><label class="small" for="memberReviewProduct">Product</label><select id="memberReviewProduct"><option value="">General testimonial</option></select></div>
            <div><label class="small" for="memberReviewRating">Rating</label><select id="memberReviewRating"><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option></select></div>
            <div><label class="small" for="memberReviewKind">Type</label><select id="memberReviewKind"><option value="review">Product review</option><option value="testimonial">General testimonial</option></select></div>
          </div>
          <div><label class="small" for="memberReviewText">Your feedback</label><textarea id="memberReviewText" rows="5" placeholder="Tell us what stood out, what you liked, or how the piece felt in person."></textarea></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit">Save Feedback</button></div>
        </form>
        <div id="memberReviewHistory" style="margin-top:16px"></div>
      </div>`;
    document.getElementById('memberReviewForm')?.addEventListener('submit', onSubmit);
  }

  async function load() {
    try {
      setMessage('Loading your feedback options...');
      const response = await window.DDAuth.apiFetch('/api/member/reviews');
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to load review tools.');

      const select = document.getElementById('memberReviewProduct');
      if (select) {
        const rows = Array.isArray(data.purchased_products) ? data.purchased_products : [];
        select.innerHTML = `<option value="">General testimonial</option>${rows.map((row) => `<option value="${row.product_id}" data-order-id="${row.last_order_id}">${esc(row.product_name || '')}</option>`).join('')}`;
      }

      renderReviewHistory(Array.isArray(data.reviews) ? data.reviews : []);
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'Failed to load review tools.', true);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    try {
      const select = document.getElementById('memberReviewProduct');
      const option = select?.selectedOptions?.[0] || null;
      const productId = Number(select?.value || 0) || null;
      const orderId = Number(option?.getAttribute('data-order-id') || 0) || null;
      const rating = Number(document.getElementById('memberReviewRating')?.value || 5);
      const reviewKind = String(document.getElementById('memberReviewKind')?.value || 'review');
      const reviewText = String(document.getElementById('memberReviewText')?.value || '').trim();
      if (!reviewText) {
        setMessage('Please enter some feedback first.', true);
        return;
      }

      const response = await window.DDAuth.apiFetch('/api/member/reviews', {
        method: 'POST',
        body: JSON.stringify({
          product_id: productId,
          order_id: orderId,
          rating,
          review_kind: reviewKind,
          review_text: reviewText
        })
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to save feedback.');

      document.getElementById('memberReviewForm')?.reset();
      setMessage(data.message || 'Feedback saved.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Failed to save feedback.', true);
    }
  }

  document.addEventListener('dd:members-ready', async (event) => {
    if (!event?.detail?.ok) return;
    render();
    await load();
  });

  render();
});
