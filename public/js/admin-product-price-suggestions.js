document.addEventListener('DOMContentLoaded', () => {
  const mounts = [document.getElementById('productPriceSuggestionMount')].filter(Boolean);
  if (!mounts.length) return;
  let rendered = false;
  let lastRows = [];

  function money(cents, currency = 'CAD') {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(cents || 0) / 100);
  }
  function escapeHtml(v) {
    return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }
  function setMessage(message, isError = false) {
    const el = document.getElementById('productPriceSuggestionMessage');
    if (!el) return;
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
    el.style.color = isError ? '#b00020' : '#0a7a2f';
  }
  function getAssumptions() {
    return {
      packaging_cents: Math.round(Number(document.getElementById('ppsPackaging')?.value || 0) * 100),
      shipping_pressure_cents: Math.round(Number(document.getElementById('ppsShipping')?.value || 0) * 100),
      overhead_percent: Number(document.getElementById('ppsOverhead')?.value || 0),
      target_margin_percent: Number(document.getElementById('ppsMargin')?.value || 65)
    };
  }
  function render() {
    if (rendered) return; rendered = true;
    mounts.forEach((mountEl) => {
      mountEl.innerHTML = `
        <div class="card" style="margin-top:18px">
          <h3 style="margin-top:0">Recommended price suggestions</h3>
          <p class="small" style="margin-top:0">Turn linked resource cost, manual unit cost, packaging, shipping pressure, and overhead into a working selling-price target. You can now load or apply the suggestion directly into the product editor.</p>
          <div id="productPriceSuggestionMessage" class="small" style="display:none;margin-bottom:12px"></div>
          <div class="grid cols-5" style="gap:12px">
            <div><label class="small" for="ppsProductId">Product ID</label><input id="ppsProductId" type="number" min="0" step="1" placeholder="0 = all" /></div>
            <div><label class="small" for="ppsSearch">Search</label><input id="ppsSearch" type="text" placeholder="name or slug" /></div>
            <div><label class="small" for="ppsPackaging">Packaging ($)</label><input id="ppsPackaging" type="number" min="0" step="0.01" value="0.75" /></div>
            <div><label class="small" for="ppsShipping">Shipping pressure ($)</label><input id="ppsShipping" type="number" min="0" step="0.01" value="1.50" /></div>
            <div><label class="small" for="ppsOverhead">Overhead %</label><input id="ppsOverhead" type="number" min="0" step="0.1" value="12" /></div>
          </div>
          <div class="grid cols-3" style="gap:12px;margin-top:12px;align-items:end">
            <div><label class="small" for="ppsMargin">Target margin %</label><input id="ppsMargin" type="number" min="5" max="95" step="1" value="65" /></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="button" id="ppsLoadButton">Load Suggestions</button></div>
          </div>
          <div class="admin-table-wrap" style="margin-top:12px"><table><thead><tr><th>Product</th><th>Current</th><th>Known Cost</th><th>Landed Cost</th><th>Suggested</th><th>Range</th><th>Notes</th><th>Apply</th></tr></thead><tbody id="ppsList"><tr><td colspan="8" style="padding:8px">Load suggestions to begin.</td></tr></tbody></table></div>
        </div>`;
    });
    document.getElementById('ppsLoadButton')?.addEventListener('click', loadSuggestions);
    mounts[0]?.addEventListener('click', onClick);
  }
  async function loadCurrentProduct(productId) {
    const response = await window.DDAuth.apiFetch(`/api/admin/product-detail?product_id=${encodeURIComponent(productId)}`);
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to load product details.');
    return data;
  }
  async function saveSuggestion(productId, suggestedPriceCents, suggestedCompareAtCents) {
    const current = await loadCurrentProduct(productId);
    const product = current.product || {};
    const images = Array.isArray(current.images) ? current.images : [];
    const payload = {
      product_id: Number(product.product_id || productId),
      product_number: product.product_number == null ? null : Number(product.product_number),
      name: product.name || '',
      slug: product.slug || '',
      sku: product.sku || '',
      product_category: product.product_category || '',
      color_name: product.color_name || '',
      shipping_code: product.shipping_code || '',
      review_status: product.review_status || 'pending_review',
      short_description: product.short_description || '',
      description: product.description || '',
      product_type: product.product_type || 'physical',
      status: product.status || 'draft',
      price_cents: suggestedPriceCents,
      compare_at_price_cents: suggestedCompareAtCents,
      currency: product.currency || 'CAD',
      taxable: Number(product.taxable || 0),
      tax_class_id: product.tax_class_id == null ? null : Number(product.tax_class_id),
      requires_shipping: Number(product.requires_shipping || 0),
      weight_grams: product.weight_grams == null ? null : Number(product.weight_grams),
      inventory_tracking: Number(product.inventory_tracking || 0),
      inventory_quantity: Number(product.inventory_quantity || 0),
      digital_file_url: product.digital_file_url || '',
      featured_image_url: product.featured_image_url || '',
      sort_order: Number(product.sort_order || 0),
      image_urls: images.map((row) => row.image_url).filter(Boolean).slice(0, 5),
      meta_title: product.meta_title || '',
      meta_description: product.meta_description || '',
      keywords: product.keywords || '',
      h1_override: product.h1_override || '',
      canonical_url: product.canonical_url || '',
      og_title: product.og_title || '',
      og_description: product.og_description || '',
      og_image_url: product.og_image_url || ''
    };
    const response = await window.DDAuth.apiFetch('/api/admin/update-product', { method: 'POST', body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to apply price suggestion.');
    return data;
  }
  function dispatchLoadSuggestion(row) {
    document.dispatchEvent(new CustomEvent('dd:product-price-suggestion-load', { detail: row }));
  }
  async function loadSuggestions() {
    try {
      setMessage('Loading price suggestions...');
      const params = new URLSearchParams({
        product_id: String(Number(document.getElementById('ppsProductId')?.value || 0) || 0),
        q: String(document.getElementById('ppsSearch')?.value || '').trim(),
        packaging_cents: String(Math.round(Number(document.getElementById('ppsPackaging')?.value || 0) * 100)),
        shipping_pressure_cents: String(Math.round(Number(document.getElementById('ppsShipping')?.value || 0) * 100)),
        overhead_percent: String(Number(document.getElementById('ppsOverhead')?.value || 0)),
        target_margin_percent: String(Number(document.getElementById('ppsMargin')?.value || 65))
      });
      const response = await window.DDAuth.apiFetch(`/api/admin/product-price-suggestions?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to load price suggestions.');
      const rows = Array.isArray(data.items) ? data.items : [];
      lastRows = rows;
      const body = document.getElementById('ppsList');
      if (!body) return;
      if (!rows.length) {
        body.innerHTML = '<tr><td colspan="8" style="padding:8px">No products matched these assumptions.</td></tr>';
      } else {
        body.innerHTML = rows.map((row) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #ddd"><strong>${escapeHtml(row.name || '')}</strong><div class="small">#${escapeHtml(row.product_id)} · ${escapeHtml(row.status || '')} · Review ${escapeHtml(row.review_status || '')}</div></td>
            <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(money(row.price_cents, row.currency))}<div class="small">Margin now ${(Number(row.current_margin_ratio || 0) * 100).toFixed(1)}%</div></td>
            <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(money(row.base_known_cost_cents, row.currency))}<div class="small">Resources ${escapeHtml(money(row.resource_cost_cents, row.currency))} · Manual ${escapeHtml(money(row.manual_cost_cents, row.currency))}</div></td>
            <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(money(row.landed_cost_cents, row.currency))}<div class="small">Packaging ${escapeHtml(money(row.packaging_cents, row.currency))} · Shipping ${escapeHtml(money(row.shipping_pressure_cents, row.currency))} · Overhead ${escapeHtml(money(row.overhead_cents, row.currency))}</div></td>
            <td style="padding:8px;border-bottom:1px solid #ddd"><strong>${escapeHtml(money(row.suggested_price_cents, row.currency))}</strong><div class="small">Compare-at ${escapeHtml(money(row.suggested_compare_at_cents, row.currency))}</div></td>
            <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(money(row.conservative_price_cents, row.currency))} → ${escapeHtml(money(row.stretch_price_cents, row.currency))}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd">${row.notes.map((note) => `<div class="small">${escapeHtml(note)}</div>`).join('') || '<div class="small">—</div>'}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd"><div style="display:grid;gap:8px"><button class="btn" type="button" data-load-suggestion="${escapeHtml(row.product_id)}">Load to Editor</button><button class="btn" type="button" data-apply-suggestion="${escapeHtml(row.product_id)}">Apply Live</button></div></td>
          </tr>`).join('');
      }
      setMessage(`Loaded ${rows.length} price suggestion row(s).`);
    } catch (error) {
      setMessage(error.message || 'Failed to load price suggestions.', true);
    }
  }
  async function onClick(event) {
    const loadBtn = event.target.closest('[data-load-suggestion]');
    const applyBtn = event.target.closest('[data-apply-suggestion]');
    if (loadBtn) {
      const row = lastRows.find((item) => Number(item.product_id) === Number(loadBtn.getAttribute('data-load-suggestion') || 0));
      if (!row) return;
      dispatchLoadSuggestion({ ...row, assumptions: getAssumptions() });
      setMessage('Suggestion loaded into the product editor. Review it and save when ready.');
      return;
    }
    if (applyBtn) {
      const row = lastRows.find((item) => Number(item.product_id) === Number(applyBtn.getAttribute('data-apply-suggestion') || 0));
      if (!row) return;
      try {
        setMessage(`Applying live price suggestion for ${row.name || `#${row.product_id}`}...`);
        await saveSuggestion(Number(row.product_id || 0), Number(row.suggested_price_cents || 0), Number(row.suggested_compare_at_cents || 0));
        dispatchLoadSuggestion({ ...row, assumptions: getAssumptions(), live_applied: true });
        document.dispatchEvent(new CustomEvent('dd:product-created', { detail: { product: { product_id: row.product_id } } }));
        setMessage('Price suggestion applied live and loaded into the editor.');
      } catch (error) {
        setMessage(error.message || 'Failed to apply price suggestion.', true);
      }
    }
  }
  document.addEventListener('dd:admin-ready', (event) => { if (!event?.detail?.ok) return; render(); });
  render();
});
