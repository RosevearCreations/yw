// File: /public/js/admin-tier-policy.js
// Brief description: Admin editor for Bronze, Silver, and Gold member-facing tier policy text.

document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("tierPolicyAdminMount");
  if (!mount || !window.DDAuth) return;

  mount.innerHTML = `
    <div class="card" style="margin-top:18px">
      <h3 style="margin-top:0">Tier Policy</h3>
      <p class="small">Control what Bronze, Silver, and Gold members see in their account area. Keep benefits simple now so the system can grow later.</p>
      <div class="small" id="tierPolicyMessage" style="display:none;margin-bottom:10px"></div>
      <div id="tierPolicyCards" class="tier-policy-grid"></div>
    </div>`;

  const cards = mount.querySelector('#tierPolicyCards');
  const message = mount.querySelector('#tierPolicyMessage');

  function setMessage(text, isError = false) {
    message.textContent = text || '';
    message.style.display = text ? 'block' : 'none';
    message.style.color = isError ? '#b00020' : '';
  }

  function esc(v) {
    return String(v ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizeBenefits(text) {
    return String(text || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
  }

  async function loadPolicies() {
    setMessage('');
    const response = await window.DDAuth.apiFetch('/api/admin/tier-policies');
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) throw new Error('Tier Policy endpoint is not available yet.');
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed loading tier policies.');
    const policies = Array.isArray(data.items) ? data.items : [];
    cards.innerHTML = '';
    policies.forEach((policy) => {
      const article = document.createElement('article');
      article.className = 'card';
      article.innerHTML = `
        <form class="grid" data-tier-policy-form style="gap:10px">
          <input type="hidden" name="tier_code" value="${esc(policy.tier_code || '')}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <h4 style="margin:0">${esc(policy.title || policy.tier_code || 'Tier')}</h4>
            <label class="small"><input type="checkbox" name="is_visible" ${policy.is_visible ? 'checked' : ''}> Visible</label>
          </div>
          <div class="grid cols-2" style="gap:10px">
            <div><label class="small">Public title</label><input name="title" type="text" value="${esc(policy.title || '')}"></div>
            <div><label class="small">Badge color</label><input name="badge_color" type="text" value="${esc(policy.badge_color || '')}" placeholder="#8f6b2f"></div>
          </div>
          <div class="grid cols-2" style="gap:10px">
            <div><label class="small">Sort order</label><input name="sort_order" type="number" value="${Number(policy.sort_order || 0)}"></div>
            <div></div>
          </div>
          <div><label class="small">Short description</label><textarea name="short_description" rows="3">${esc(policy.short_description || '')}</textarea></div>
          <div><label class="small">Benefits (one per line)</label><textarea name="benefits_text" rows="5">${esc((policy.benefits || []).join('\n'))}</textarea></div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button class="btn primary" type="submit">Save ${esc(policy.title || policy.tier_code || 'tier')}</button>
            <span class="small" data-tier-policy-status></span>
          </div>
        </form>`;
      const form = article.querySelector('[data-tier-policy-form]');
      const status = article.querySelector('[data-tier-policy-status]');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = 'Saving…';
        try {
          const payload = {
            tier_code: form.tier_code.value,
            title: form.title.value,
            short_description: form.short_description.value,
            benefits: normalizeBenefits(form.benefits_text.value),
            badge_color: form.badge_color.value,
            sort_order: Number(form.sort_order.value || 0),
            is_visible: !!form.is_visible.checked
          };
          const saveResponse = await window.DDAuth.apiFetch('/api/admin/tier-policies', { method: 'POST', body: JSON.stringify(payload) });
          const saveData = await saveResponse.json();
          if (!saveResponse.ok || !saveData?.ok) throw new Error(saveData?.error || 'Failed saving tier policy.');
          status.textContent = 'Saved.';
        } catch (error) {
          status.textContent = String(error?.message || error || 'Save failed.');
        }
      });
      cards.appendChild(article);
    });
  }

  loadPolicies().catch((error) => setMessage(String(error?.message || error || 'Failed loading tier policies.'), true));
});
