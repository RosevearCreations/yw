document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('memberWishlistMount');
  if (!mountEl || !window.DDAuth) return;
  let rendered = false;
  function money(cents, currency = 'CAD') { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(cents || 0) / 100); }
  function escapeHtml(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
  function setMessage(message, isError = false) { const el = document.getElementById('memberWishlistMessage'); if (!el) return; el.textContent = message; el.style.display = message ? 'block' : 'none'; el.style.color = isError ? '#b00020' : '#0a7a2f'; }
  function render() {
    if (rendered) return; rendered = true;
    mountEl.innerHTML = `
      <div class="card">
        <h2 style="margin-top:0">Wishlist</h2>
        <p class="small" style="margin-top:0">Save favourite products here and come back to them later.</p>
        <div id="memberWishlistMessage" class="small" style="display:none;margin-bottom:12px"></div>
        <div class="admin-table-wrap"><table><thead><tr><th>Product</th><th>Price</th><th>Saved</th><th>Action</th></tr></thead><tbody id="memberWishlistList"><tr><td colspan="4" style="padding:8px">Loading wishlist...</td></tr></tbody></table></div>
      </div>`;
    mountEl.addEventListener('click', onClick);
  }
  async function loadWishlist() {
    try {
      setMessage('Loading wishlist...');
      const response = await window.DDAuth.apiFetch('/api/member/wishlist');
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to load wishlist.');
      const rows = Array.isArray(data.items) ? data.items : [];
      const body = document.getElementById('memberWishlistList');
      if (!body) return;
      if (!rows.length) body.innerHTML = '<tr><td colspan="4" style="padding:8px">No wishlist items saved yet.</td></tr>';
      else body.innerHTML = rows.map((row) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #ddd">${row.featured_image_url ? `<img src="${escapeHtml(row.featured_image_url)}" alt="${escapeHtml(row.name || '')}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;display:block;margin-bottom:6px"/>` : ''}<strong>${escapeHtml(row.name || '')}</strong><div class="small">${escapeHtml(row.short_description || '')}</div></td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(money(row.price_cents, row.currency))}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(row.created_at || '')}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd"><a class="btn" href="/shop/product/?slug=${encodeURIComponent(row.slug || '')}">View</a> <button class="btn" type="button" data-remove-wishlist="${row.product_id}">Remove</button></td>
        </tr>`).join('');
      setMessage(`Loaded ${rows.length} wishlist item(s).`);
    } catch (error) { setMessage(error.message || 'Failed to load wishlist.', true); }
  }
  async function onClick(event) {
    const removeBtn = event.target.closest('[data-remove-wishlist]');
    if (!removeBtn) return;
    const productId = Number(removeBtn.getAttribute('data-remove-wishlist') || 0);
    if (!productId) return;
    try {
      const response = await window.DDAuth.apiFetch(`/api/member/wishlist?product_id=${encodeURIComponent(productId)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to remove wishlist item.');
      await loadWishlist();
    } catch (error) { setMessage(error.message || 'Failed to remove wishlist item.', true); }
  }
  document.addEventListener('dd:members-ready', async (event) => { if (!event?.detail?.ok) return; render(); await loadWishlist(); });
  render();
});
