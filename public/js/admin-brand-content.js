// File: /public/js/admin-brand-content.js
// Brief description: Adds a lightweight catalog-side helper for gallery/creations publishing,
// brand-image uploads, and visibility into the current public social profile links.

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('brandContentAdminMount');
  if (!mountEl || !window.DDAuth || !window.DDAuth.isLoggedIn()) return;

  let rendered = false;

  function setMessage(message, isError = false) {
    const el = document.getElementById('adminBrandContentMessage');
    if (!el) return;
    el.textContent = message || '';
    el.style.display = message ? 'block' : 'none';
    el.style.color = isError ? '#b00020' : '#0a7a2f';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(String(value || ''));
      setMessage('Copied the asset URL to the clipboard.');
    } catch {
      setMessage('Could not copy the asset URL automatically. Copy it manually from the text box instead.', true);
    }
  }

  function render() {
    if (rendered) return;
    rendered = true;
    mountEl.innerHTML = `
      <div class="card" style="margin-top:18px">
        <h2 style="margin-top:0">Brand, Socials &amp; Creations</h2>
        <p class="small" style="margin-top:0">Use this helper to see how gallery/creations are fed today, upload reusable brand images, and verify the current public social profile links without leaving catalog tools.</p>
        <div id="adminBrandContentMessage" class="small" style="display:none;margin-bottom:12px"></div>

        <div class="grid cols-2" style="gap:14px">
          <div class="card" style="margin:0">
            <h3 style="margin-top:0">Current gallery / creations interface</h3>
            <p class="small">There is still not a fully separate creations-only editor. Right now the public <strong>/gallery/</strong> and <strong>/creations/</strong> pages are fed through the finished-product plus catalog-sync path.</p>
            <ol class="small" style="padding-left:18px;margin:10px 0 0 0">
              <li>Create or continue a finished product draft.</li>
              <li>Attach images in Product Media or the phone workflow.</li>
              <li>Run catalog sync so the public creations feed stays aligned.</li>
              <li>Review the public gallery and creations pages.</li>
            </ol>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
              <a class="btn primary" href="/admin/mobile-product/">Phone capture</a>
              <a class="btn" href="/admin/products/">Product editor</a>
              <a class="btn" href="/gallery/">Open gallery</a>
              <a class="btn" href="/creations/">Open creations</a>
            </div>
          </div>

          <div class="card" style="margin:0">
            <h3 style="margin-top:0">Public social links</h3>
            <p class="small">These are the profile links currently exposed through <strong>/api/social-feed</strong> and the public social hub. The shared site nav/footer now links back to the social hub again.</p>
            <div id="adminBrandSocialLinks" class="site-footer-links small">Loading social profiles…</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
              <a class="btn" href="/socials/">Open social hub</a>
              <button class="btn" type="button" id="refreshBrandSocialLinksButton">Refresh links</button>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top:14px">
          <h3 style="margin-top:0">Reusable brand-image uploads</h3>
          <p class="small" style="margin-top:0">Upload logos, badges, hero art, watermark files, and other reusable brand graphics. These uploads are stored as standalone brand assets so they can be placed across the website or app later.</p>
          <form id="brandAssetUploadForm" class="grid" style="gap:12px">
            <div class="grid cols-3" style="gap:12px;align-items:end">
              <div>
                <label class="small" for="brandAssetFile">Image file</label>
                <input id="brandAssetFile" type="file" accept="image/*" required />
              </div>
              <div>
                <label class="small" for="brandAssetRole">Use</label>
                <select id="brandAssetRole">
                  <option value="brand-logo">Logo</option>
                  <option value="brand-badge">Badge / icon</option>
                  <option value="brand-hero">Hero / banner</option>
                  <option value="brand-watermark">Watermark</option>
                  <option value="brand-general">General brand art</option>
                </select>
              </div>
              <div>
                <label class="small" for="brandAssetLabel">Label</label>
                <input id="brandAssetLabel" type="text" maxlength="120" placeholder="Header logo, footer badge, homepage hero" />
              </div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn primary" type="submit">Upload brand image</button>
              <button class="btn" type="button" id="refreshBrandAssetsButton">Refresh brand assets</button>
            </div>
          </form>
          <div id="brandAssetList" class="grid cols-2" style="gap:12px;margin-top:14px"></div>
        </div>
      </div>`;

    document.getElementById('brandAssetUploadForm')?.addEventListener('submit', uploadBrandAsset);
    document.getElementById('refreshBrandAssetsButton')?.addEventListener('click', loadBrandAssets);
    document.getElementById('refreshBrandSocialLinksButton')?.addEventListener('click', loadSocials);
    mountEl.addEventListener('click', async (event) => {
      const copyButton = event.target.closest('[data-copy-asset-url]');
      if (copyButton) {
        await copyText(copyButton.getAttribute('data-copy-asset-url') || '');
      }
    });
  }

  async function loadSocials() {
    const wrap = document.getElementById('adminBrandSocialLinks');
    if (!wrap) return;
    wrap.textContent = 'Loading social profiles…';
    try {
      const response = await fetch('/api/social-feed', { headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not load social profile links.');
      const profiles = data && data.profiles && typeof data.profiles === 'object' ? data.profiles : {};
      const order = ['youtube', 'instagram', 'tiktok', 'facebook', 'x', 'patreon'];
      const rows = order.map((key) => profiles[key]).filter(Boolean);
      wrap.innerHTML = rows.length
        ? rows.map((row) => `<a href="${escapeHtml(row.url || '/socials/')}" rel="noopener" target="_blank">${escapeHtml(row.label || row.handle || 'Social')}</a>`).join('')
        : '<span class="small">No social profiles were returned right now.</span>';
    } catch (error) {
      wrap.innerHTML = '<span class="small">Social profile links are temporarily unavailable right now.</span>';
      setMessage(error.message || 'Could not load social profile links.', true);
    }
  }

  async function loadBrandAssets() {
    const listEl = document.getElementById('brandAssetList');
    if (!listEl) return;
    listEl.innerHTML = '<div class="small">Loading brand assets…</div>';
    try {
      const response = await window.DDAuth.apiFetch('/api/admin/media-assets?q=brand&limit=60');
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not load brand assets.');
      const rows = (Array.isArray(data.assets) ? data.assets : []).filter((row) => {
        const objectKey = String(row.object_key || '').toLowerCase();
        const notes = String(row.annotation_notes || '').toLowerCase();
        return objectKey.startsWith('brand/') || notes.includes('brand_asset');
      });
      if (!rows.length) {
        listEl.innerHTML = '<div class="small">No brand assets have been uploaded yet.</div>';
        return;
      }
      listEl.innerHTML = rows.map((row) => `
        <div class="card" style="margin:0">
          ${row.public_url ? `<div style="aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#f5f5f5;margin-bottom:10px"><img src="${escapeHtml(row.public_url)}" alt="${escapeHtml(row.original_filename || 'Brand asset')}" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy"></div>` : ''}
          <div><strong>${escapeHtml(row.original_filename || row.object_key || 'Brand asset')}</strong></div>
          <div class="small" style="margin-top:6px">${escapeHtml(row.object_key || '')}</div>
          <input class="input" type="text" readonly value="${escapeHtml(row.public_url || '')}" style="margin-top:10px" />
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
            ${row.public_url ? `<a class="btn" href="${escapeHtml(row.public_url)}" rel="noopener" target="_blank">Open image</a>` : ''}
            ${row.public_url ? `<button class="btn" type="button" data-copy-asset-url="${escapeHtml(row.public_url)}">Copy URL</button>` : ''}
          </div>
        </div>`).join('');
    } catch (error) {
      listEl.innerHTML = `<div class="small">${escapeHtml(error.message || 'Could not load brand assets.')}</div>`;
      setMessage(error.message || 'Could not load brand assets.', true);
    }
  }

  async function uploadBrandAsset(event) {
    event.preventDefault();
    const fileInput = document.getElementById('brandAssetFile');
    const roleInput = document.getElementById('brandAssetRole');
    const labelInput = document.getElementById('brandAssetLabel');
    const file = fileInput?.files?.[0];
    if (!file) return setMessage('Choose a brand image first.', true);
    try {
      setMessage('Uploading brand image…');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_scope', 'brand');
      formData.append('asset_tag', 'brand_asset');
      formData.append('variant_role', roleInput?.value || 'brand-general');
      formData.append('annotation_notes', ['brand_asset', labelInput?.value || '', roleInput?.value || ''].filter(Boolean).join(' | '));
      const response = await window.DDAuth.apiFetch('/api/admin/media-upload', { method: 'POST', body: formData, headers: {} });
      const data = await response.json();
      if (!response.ok || !data?.ok || !data?.asset?.public_url) throw new Error(data?.error || 'Could not upload the brand image.');
      if (fileInput) fileInput.value = '';
      if (labelInput) labelInput.value = '';
      setMessage('Brand image uploaded. The public URL is now ready to place around the site.');
      await loadBrandAssets();
    } catch (error) {
      setMessage(error.message || 'Could not upload the brand image.', true);
    }
  }

  document.addEventListener('dd:admin-ready', async (event) => {
    if (!event?.detail?.ok) return;
    render();
    await Promise.allSettled([loadBrandAssets(), loadSocials()]);
  });

  render();
});
