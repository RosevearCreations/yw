// File: /public/js/admin-users.js
// Brief description: Renders the admin user directory with profile/contact summary fields
// and action buttons for managing profiles and access tiers.

document.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("usersAdminMount");
  if (!mountEl || !window.DDAuth || !window.DDAuth.isLoggedIn()) return;

  let hasRendered = false;
  let isLoading = false;
  let allUsers = [];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('\"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function titleCase(value) {
    const text = String(value || "").trim();
    if (!text) return "—";
    return text.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  function setMessage(message, isError = false) {
    const el = document.getElementById("adminUsersMessage");
    if (!el) return;
    el.textContent = message;
    el.style.display = message ? "block" : "none";
    el.style.color = isError ? "#b00020" : "";
  }

  function getRoleFilter() { return String(document.getElementById("adminUsersRoleFilter")?.value || "").trim().toLowerCase(); }
  function getActiveFilter() { return String(document.getElementById("adminUsersActiveFilter")?.value || "").trim().toLowerCase(); }
  function getSearchValue() { return String(document.getElementById("adminUsersSearchInput")?.value || "").trim().toLowerCase(); }

  function matchesFilters(user) {
    const roleFilter = getRoleFilter();
    const activeFilter = getActiveFilter();
    const search = getSearchValue();
    if (roleFilter && String(user.role || "").toLowerCase() !== roleFilter) return false;
    if (activeFilter) {
      const isActive = Number(user.is_active || 0) === 1;
      if (activeFilter === "active" && !isActive) return false;
      if (activeFilter === "inactive" && isActive) return false;
    }
    if (search) {
      const haystack = [user.user_id, user.email, user.display_name, user.preferred_name, user.phone, user.company_name, user.access_tier_codes, user.department, user.job_title, user.role]
        .map((value) => String(value || "").toLowerCase()).join(" " );
      if (!haystack.includes(search)) return false;
    }
    return true;
  }

  function updateSummary(users) {
    const el = document.getElementById("adminUsersSummary");
    if (!el) return;
    const safeUsers = Array.isArray(users) ? users : [];
    const activeCount = safeUsers.filter((user) => Number(user.is_active || 0) === 1).length;
    const adminCount = safeUsers.filter((user) => String(user.role || "").toLowerCase() === "admin").length;
    const employeeCount = safeUsers.filter((user) => ["employee", "both"].includes(String(user.profile_type || "").toLowerCase())).length;
    const customerCount = safeUsers.filter((user) => String(user.profile_type || "customer").toLowerCase() !== "employee").length;
    el.textContent = `${safeUsers.length} users • ${activeCount} active • ${adminCount} admin • ${customerCount} customer-facing • ${employeeCount} employee`;
  }

  function verificationLabel(user) {
    return `${Number(user.email_verified || 0) === 1 ? "Email ✓" : "Email ✕"} • ${Number(user.phone_verified || 0) === 1 ? "Phone ✓" : "Phone ✕"}`;
  }

  function renderTable(users) {
    const tableBody = document.getElementById("adminUsersTableBody");
    const emptyEl = document.getElementById("adminUsersEmpty");
    if (!tableBody) return;
    const safeUsers = Array.isArray(users) ? users : [];
    if (emptyEl) emptyEl.style.display = safeUsers.length ? "none" : "block";
    updateSummary(safeUsers);
    if (!safeUsers.length) {
      tableBody.innerHTML = `<tr><td colspan="10" style="padding:12px">No users found.</td></tr>`;
      return;
    }
    tableBody.innerHTML = safeUsers.map((user) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(String(user.user_id || "—"))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd"><div>${escapeHtml(user.email || "—")}</div><div class="small">${escapeHtml(user.display_name || user.preferred_name || "—")}</div></td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(titleCase(user.role || "member"))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(titleCase(user.profile_type || "customer"))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd"><div>${escapeHtml(user.phone || "—")}</div><div class="small">${escapeHtml(user.preferred_contact_method || "—")}</div></td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(verificationLabel(user))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(user.access_tier_codes || "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${Number(user.is_active || 0) === 1 ? "Active" : "Inactive"}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(String(user.active_sessions || 0))}/${escapeHtml(String(user.total_sessions || 0))}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd"><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" type="button" data-manage-profile-user-id="${escapeHtml(String(user.user_id || ""))}">Profile</button><button class="btn" type="button" data-manage-access-tiers-user-id="${escapeHtml(String(user.user_id || ""))}">Tiers</button></div></td>
      </tr>`).join("");
  }

  function renderUi() {
    if (hasRendered) return;
    hasRendered = true;
    mountEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><h3 style="margin:0">User Directory</h3><p class="small" style="margin:8px 0 0 0">Review users, profile state, verification flags, tiers, and sessions.</p></div><button class="btn" type="button" id="refreshAdminUsersButton">Refresh Users</button></div>
      <div class="grid cols-3" style="gap:12px;margin-top:14px"><div><label class="small" for="adminUsersRoleFilter">Role</label><select id="adminUsersRoleFilter"><option value="">All</option><option value="member">Member</option><option value="admin">Admin</option></select></div><div><label class="small" for="adminUsersActiveFilter">Status</label><select id="adminUsersActiveFilter"><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div><div><label class="small" for="adminUsersSearchInput">Search</label><input id="adminUsersSearchInput" type="text" placeholder="User ID, name, email, phone, tier..." autocomplete="off" /></div></div>
      <div id="adminUsersMessage" class="small" style="display:none;margin-top:12px"></div><div id="adminUsersSummary" class="small" style="margin-top:10px"></div><div id="adminUsersEmpty" class="small" style="display:none;margin-top:10px">No users available.</div>
      <div style="overflow:auto;margin-top:14px"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">ID</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">User</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Role</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Profile</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Contact</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Verified</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Tiers</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Status</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Sessions</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">Action</th></tr></thead><tbody id="adminUsersTableBody"><tr><td colspan="10" style="padding:12px">Loading users...</td></tr></tbody></table></div>`;
    const refreshButton = document.getElementById("refreshAdminUsersButton");
    const roleFilter = document.getElementById("adminUsersRoleFilter");
    const activeFilter = document.getElementById("adminUsersActiveFilter");
    const searchInput = document.getElementById("adminUsersSearchInput");
    if (refreshButton) refreshButton.addEventListener("click", async () => { await loadUsers(); });
    [roleFilter, activeFilter].forEach((el) => el && el.addEventListener("change", () => renderTable(allUsers.filter(matchesFilters))));
    if (searchInput) searchInput.addEventListener("input", () => renderTable(allUsers.filter(matchesFilters)));
  }

  async function fetchUsers() {
    const response = await window.DDAuth.apiFetch("/api/admin/users", { method: "GET" });
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to load users.");
    return Array.isArray(data.users) ? data.users : [];
  }

  async function loadUsers() {
    if (isLoading) return;
    const refreshButton = document.getElementById("refreshAdminUsersButton");
    const originalText = refreshButton?.textContent || "Refresh Users";
    isLoading = true;
    try {
      setMessage("Loading users...");
      if (refreshButton) { refreshButton.disabled = true; refreshButton.textContent = "Loading..."; }
      allUsers = await fetchUsers();
      renderTable(allUsers.filter(matchesFilters));
      setMessage(`Loaded ${allUsers.length} user${allUsers.length === 1 ? "" : "s"}.`);
    } catch (error) {
      allUsers = [];
      renderTable([]);
      setMessage(error.message || "Failed to load users.", true);
    } finally {
      isLoading = false;
      if (refreshButton) { refreshButton.disabled = false; refreshButton.textContent = originalText; }
    }
  }

  document.addEventListener("dd:admin-ready", async (event) => { if (!event?.detail?.ok) return; renderUi(); await loadUsers(); });
  document.addEventListener("dd:user-updated", async () => { await loadUsers(); });
  renderUi();
  loadUsers();
});
