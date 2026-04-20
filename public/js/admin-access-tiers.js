// File: /public/js/admin-access-tiers.js
// Brief description: Standalone access-tier manager for the Members department.

document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("accessTiersAdminMount");
  if (!mount || !window.DDAuth || !window.DDAuth.isLoggedIn()) return;

  let users = [];
  let tiers = [];
  let assignmentsByUser = new Map();

  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function msg(text, isError = false) {
    const el = document.getElementById("accessTierDepartmentMessage");
    if (!el) return;
    el.textContent = text || "";
    el.style.display = text ? "block" : "none";
    el.style.color = isError ? "#b00020" : "";
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(String(value).replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }

  function selectedUserId() {
    return Number(document.getElementById("accessTierUserSelect")?.value || 0);
  }

  function benefitsLabel(code) {
    if (!code) return "—";
    const map = { bronze: "Bronze", silver: "Silver", gold: "Gold" };
    return map[String(code).toLowerCase()] || code;
  }

  function renderUserSelect() {
    const select = document.getElementById("accessTierUserSelect");
    if (!select) return;
    const options = users.map((u) => `<option value="${u.user_id}">${esc(u.email || "")} — ${esc(u.display_name || "—")} (#${u.user_id})</option>`).join("");
    select.innerHTML = `<option value="">Select member/admin user</option>${options}`;
  }

  function renderTierOptions() {
    const select = document.getElementById("assignAccessTierSelect");
    if (!select) return;
    select.innerHTML = `<option value="">Select access tier</option>${tiers.map((tier) => `<option value="${tier.access_tier_id}">${esc(tier.name)} (${esc(tier.code)})</option>`).join("")}`;
  }

  function renderAssignments() {
    const body = document.getElementById("accessTierTableBody");
    const empty = document.getElementById("accessTierEmpty");
    if (!body) return;
    const rows = assignmentsByUser.get(selectedUserId()) || [];
    if (!rows.length) {
      body.innerHTML = "";
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";
    body.innerHTML = rows.map((row) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">${esc(row.name || benefitsLabel(row.code))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${esc(row.code || "")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${formatDate(row.granted_at)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${formatDate(row.expires_at)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${esc(row.notes || "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd"><button class="btn" type="button" data-remove-tier-id="${row.user_access_tier_id}">Remove</button></td>
      </tr>
    `).join("");
  }

  async function fetchUsers() {
    const response = await window.DDAuth.apiFetch("/api/admin/users");
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed loading users.");
    users = Array.isArray(data.users) ? data.users : [];
    renderUserSelect();
  }

  async function fetchTiers() {
    const response = await window.DDAuth.apiFetch("/api/admin/access-tiers");
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed loading access tiers.");
    tiers = Array.isArray(data.access_tiers) ? data.access_tiers : [];
    renderTierOptions();
  }

  async function fetchAssignments(userId) {
    if (!userId) return renderAssignments();
    const response = await window.DDAuth.apiFetch(`/api/admin/user-access-tiers?user_id=${encodeURIComponent(userId)}`);
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed loading assigned tiers.");
    assignmentsByUser.set(Number(userId), Array.isArray(data.access_tiers) ? data.access_tiers : []);
    renderAssignments();
  }

  async function assignTier() {
    const userId = selectedUserId();
    const accessTierId = Number(document.getElementById("assignAccessTierSelect")?.value || 0);
    const expiresAt = String(document.getElementById("assignAccessTierExpiresAt")?.value || "").trim();
    const notes = String(document.getElementById("assignAccessTierNotes")?.value || "").trim();
    if (!userId || !accessTierId) return msg("Choose a user and access tier first.", true);
    const response = await window.DDAuth.apiFetch("/api/admin/assign-user-access-tier", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, access_tier_id: accessTierId, expires_at: expiresAt || null, notes: notes || null })
    });
    const data = await response.json();
    if (!response.ok || !data?.ok) return msg(data?.error || "Failed assigning access tier.", true);
    msg("Access tier assigned.");
    await fetchAssignments(userId);
  }

  async function removeTier(userAccessTierId) {
    const response = await window.DDAuth.apiFetch("/api/admin/remove-user-access-tier", {
      method: "POST",
      body: JSON.stringify({ user_access_tier_id: Number(userAccessTierId || 0) })
    });
    const data = await response.json();
    if (!response.ok || !data?.ok) return msg(data?.error || "Failed removing access tier.", true);
    msg("Access tier removed.");
    await fetchAssignments(selectedUserId());
  }

  mount.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <h3 style="margin:0">Access Tiers</h3>
          <p class="small" style="margin:8px 0 0 0">Assign Bronze, Silver, and Gold access tiers separately from admin/member roles.</p>
        </div>
        <button class="btn" type="button" id="refreshAccessTierDepartmentButton">Refresh</button>
      </div>
      <div id="accessTierDepartmentMessage" class="small" style="display:none;margin-top:10px"></div>
      <div class="grid cols-3" style="gap:12px;margin-top:14px">
        <div>
          <label class="small" for="accessTierUserSelect">User</label>
          <select id="accessTierUserSelect"></select>
        </div>
        <div>
          <label class="small" for="assignAccessTierSelect">Tier</label>
          <select id="assignAccessTierSelect"></select>
        </div>
        <div>
          <label class="small" for="assignAccessTierExpiresAt">Expires At (optional)</label>
          <input id="assignAccessTierExpiresAt" type="date" />
        </div>
      </div>
      <div style="margin-top:12px">
        <label class="small" for="assignAccessTierNotes">Notes (optional)</label>
        <input id="assignAccessTierNotes" type="text" placeholder="Why this tier was assigned" />
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        <button class="btn primary" type="button" id="assignAccessTierButton">Assign Tier</button>
        <button class="btn" type="button" data-quick-tier="bronze">Quick Bronze</button>
        <button class="btn" type="button" data-quick-tier="silver">Quick Silver</button>
        <button class="btn" type="button" data-quick-tier="gold">Quick Gold</button>
      </div>
      <div class="small" id="accessTierEmpty" style="display:none;margin-top:14px">No access tiers assigned.</div>
      <div style="overflow:auto;margin-top:14px">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Tier</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Code</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Granted</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Expires</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Notes</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Action</th>
            </tr>
          </thead>
          <tbody id="accessTierTableBody"></tbody>
        </table>
      </div>
    </div>`;

  mount.addEventListener("click", async (event) => {
    const removeButton = event.target.closest("[data-remove-tier-id]");
    if (removeButton) {
      if (!window.confirm("Remove this access tier from the user?")) return;
      await removeTier(removeButton.getAttribute("data-remove-tier-id"));
      return;
    }
    const quick = event.target.closest("[data-quick-tier]");
    if (quick) {
      const code = String(quick.getAttribute("data-quick-tier") || "").toLowerCase();
      const match = tiers.find((tier) => String(tier.code || "").toLowerCase() === code);
      if (!match) return msg(`Tier ${code} is not available.`, true);
      document.getElementById("assignAccessTierSelect").value = String(match.access_tier_id || "");
      await assignTier();
    }
  });

  document.getElementById("refreshAccessTierDepartmentButton")?.addEventListener("click", async () => {
    msg("Refreshing access tiers…");
    try {
      await Promise.all([fetchUsers(), fetchTiers()]);
      await fetchAssignments(selectedUserId());
      msg("Access tiers refreshed.");
    } catch (error) {
      msg(String(error?.message || error || "Failed loading access tiers."), true);
    }
  });
  document.getElementById("accessTierUserSelect")?.addEventListener("change", async () => {
    try { await fetchAssignments(selectedUserId()); } catch (error) { msg(String(error?.message || error), true); }
  });
  document.getElementById("assignAccessTierButton")?.addEventListener("click", assignTier);

  (async () => {
    try {
      msg("Loading access tiers…");
      await Promise.all([fetchUsers(), fetchTiers()]);
      msg("");
    } catch (error) {
      msg(String(error?.message || error || "Failed loading access tiers."), true);
    }
  })();
});
