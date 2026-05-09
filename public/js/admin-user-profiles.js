// File: /public/js/admin-user-profiles.js
// Brief description: Adds a full customer/employee profile manager for admins with
// contact details, verification flags, preferences, address fields, and employee info.

document.addEventListener("DOMContentLoaded", () => {
  if (!window.DDAuth || !window.DDAuth.isLoggedIn()) return;

  let modalEl = null;
  let currentUserId = null;

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement("div");
    modalEl.id = "adminUserProfileModal";
    modalEl.style.display = "none";
    modalEl.style.position = "fixed";
    modalEl.style.inset = "0";
    modalEl.style.background = "rgba(0,0,0,0.55)";
    modalEl.style.zIndex = "9999";
    modalEl.innerHTML = `
      <div style="max-width:1100px;margin:24px auto;padding:0 16px;">
        <div class="card" style="max-height:90vh;overflow:auto">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><h2 style="margin:0">User Profile</h2><button class="btn" type="button" id="closeAdminUserProfileModal">Close</button></div>
          <div id="adminUserProfileLabel" class="small" style="margin-top:10px"></div>
          <div id="adminUserProfileMessage" class="small" style="display:none;margin-top:12px"></div>
          <form id="adminUserProfileForm" class="grid" style="gap:14px;margin-top:14px">
            <div class="grid cols-3" style="gap:12px"><div><label class="small" for="aupProfileType">Profile Type</label><select id="aupProfileType"><option value="customer">Customer</option><option value="employee">Employee</option><option value="both">Both</option><option value="other">Other</option></select></div><div><label class="small" for="aupPreferredName">Preferred Name</label><input id="aupPreferredName" type="text" /></div><div><label class="small" for="aupCompanyName">Company</label><input id="aupCompanyName" type="text" /></div></div>
            <div class="grid cols-3" style="gap:12px"><div><label class="small" for="aupPhone">Phone</label><input id="aupPhone" type="text" /></div><div><label class="small" for="aupPreferredContactMethod">Preferred Contact</label><select id="aupPreferredContactMethod"><option value="email">Email</option><option value="phone">Phone</option><option value="text">Text</option><option value="mail">Mail</option><option value="none">Do Not Contact</option></select></div><div><label class="small" for="aupContactNotes">Contact Notes</label><input id="aupContactNotes" type="text" /></div></div>
            <div class="grid cols-4" style="gap:12px"><label class="small" style="display:flex;gap:8px;align-items:flex-start"><input id="aupPhoneVerified" type="checkbox" /><span>Phone Verified</span></label><label class="small" style="display:flex;gap:8px;align-items:flex-start"><input id="aupEmailVerified" type="checkbox" /><span>Email Verified</span></label><label class="small" style="display:flex;gap:8px;align-items:flex-start"><input id="aupMarketingOptIn" type="checkbox" /><span>Marketing Opt-In</span></label><label class="small" style="display:flex;gap:8px;align-items:flex-start"><input id="aupOrderUpdatesOptIn" type="checkbox" checked /><span>Order Updates Opt-In</span></label></div>
            <div class="card"><h3 style="margin-top:0">Address</h3><div class="grid" style="gap:12px"><div><label class="small" for="aupAddress1">Address 1</label><input id="aupAddress1" type="text" /></div><div><label class="small" for="aupAddress2">Address 2</label><input id="aupAddress2" type="text" /></div><div class="grid cols-4" style="gap:12px"><div><label class="small" for="aupCity">City</label><input id="aupCity" type="text" /></div><div><label class="small" for="aupProvince">Province/State</label><input id="aupProvince" type="text" /></div><div><label class="small" for="aupPostal">Postal Code</label><input id="aupPostal" type="text" /></div><div><label class="small" for="aupCountry">Country</label><input id="aupCountry" type="text" /></div></div></div></div>
            <div class="card"><h3 style="margin-top:0">Employee Details</h3><div class="grid cols-3" style="gap:12px"><div><label class="small" for="aupEmployeeCode">Employee Code</label><input id="aupEmployeeCode" type="text" /></div><div><label class="small" for="aupDepartment">Department</label><input id="aupDepartment" type="text" /></div><div><label class="small" for="aupJobTitle">Job Title</label><input id="aupJobTitle" type="text" /></div></div><div class="grid cols-2" style="gap:12px;margin-top:12px"><div><label class="small" for="aupEmergencyContactName">Emergency Contact Name</label><input id="aupEmergencyContactName" type="text" /></div><div><label class="small" for="aupEmergencyContactPhone">Emergency Contact Phone</label><input id="aupEmergencyContactPhone" type="text" /></div></div></div>
            <div class="card"><h3 style="margin-top:0">Assigned Tiers</h3><div id="aupTierCodes" class="small">—</div></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit" id="saveAdminUserProfileButton">Save Profile</button></div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(modalEl);
    modalEl.querySelector("#closeAdminUserProfileModal").addEventListener("click", () => { modalEl.style.display = "none"; });
    modalEl.addEventListener("click", (event) => { if (event.target === modalEl) modalEl.style.display = "none"; });
    modalEl.querySelector("#adminUserProfileForm").addEventListener("submit", onSubmit);
    return modalEl;
  }

  function setMessage(message, isError = false) {
    const el = document.getElementById("adminUserProfileMessage");
    if (!el) return;
    el.textContent = message;
    el.style.display = message ? "block" : "none";
    el.style.color = isError ? "#b00020" : "#0a7a2f";
  }

  function fill(profilePayload) {
    const user = profilePayload?.user || {};
    const profile = profilePayload?.profile || {};
    const label = document.getElementById("adminUserProfileLabel");
    if (label) label.textContent = `User: ${user.display_name || user.email || `#${user.user_id || currentUserId}`}`;
    const map = {
      aupProfileType: profile.profile_type || "customer",
      aupPreferredName: profile.preferred_name || "",
      aupCompanyName: profile.company_name || "",
      aupPhone: profile.phone || "",
      aupPreferredContactMethod: profile.preferred_contact_method || "email",
      aupContactNotes: profile.contact_notes || "",
      aupAddress1: profile.address_line1 || "",
      aupAddress2: profile.address_line2 || "",
      aupCity: profile.city || "",
      aupProvince: profile.province || "",
      aupPostal: profile.postal_code || "",
      aupCountry: profile.country || "",
      aupEmployeeCode: profile.employee_code || "",
      aupDepartment: profile.department || "",
      aupJobTitle: profile.job_title || "",
      aupEmergencyContactName: profile.emergency_contact_name || "",
      aupEmergencyContactPhone: profile.emergency_contact_phone || ""
    };
    Object.entries(map).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value; });
    [["aupPhoneVerified", profile.phone_verified], ["aupEmailVerified", profile.email_verified], ["aupMarketingOptIn", profile.marketing_opt_in], ["aupOrderUpdatesOptIn", profile.order_updates_opt_in]].forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.checked = Number(value || 0) === 1; });
    const tiers = document.getElementById("aupTierCodes");
    if (tiers) tiers.textContent = Array.isArray(profile.access_tier_codes) && profile.access_tier_codes.length ? profile.access_tier_codes.join(", ") : "No tiers assigned.";
  }

  async function loadProfile(userId) {
    const response = await window.DDAuth.apiFetch(`/api/admin/user-profile?user_id=${encodeURIComponent(userId)}`, { method: "GET" });
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to load profile.");
    return data;
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!currentUserId) return;
    const button = document.getElementById("saveAdminUserProfileButton");
    const originalText = button?.textContent || "Save Profile";
    const payload = {
      user_id: currentUserId,
      profile_type: document.getElementById("aupProfileType")?.value || "customer",
      preferred_name: document.getElementById("aupPreferredName")?.value || "",
      company_name: document.getElementById("aupCompanyName")?.value || "",
      phone: document.getElementById("aupPhone")?.value || "",
      phone_verified: !!document.getElementById("aupPhoneVerified")?.checked,
      email_verified: !!document.getElementById("aupEmailVerified")?.checked,
      preferred_contact_method: document.getElementById("aupPreferredContactMethod")?.value || "email",
      contact_notes: document.getElementById("aupContactNotes")?.value || "",
      marketing_opt_in: !!document.getElementById("aupMarketingOptIn")?.checked,
      order_updates_opt_in: !!document.getElementById("aupOrderUpdatesOptIn")?.checked,
      address_line1: document.getElementById("aupAddress1")?.value || "",
      address_line2: document.getElementById("aupAddress2")?.value || "",
      city: document.getElementById("aupCity")?.value || "",
      province: document.getElementById("aupProvince")?.value || "",
      postal_code: document.getElementById("aupPostal")?.value || "",
      country: document.getElementById("aupCountry")?.value || "",
      employee_code: document.getElementById("aupEmployeeCode")?.value || "",
      department: document.getElementById("aupDepartment")?.value || "",
      job_title: document.getElementById("aupJobTitle")?.value || "",
      emergency_contact_name: document.getElementById("aupEmergencyContactName")?.value || "",
      emergency_contact_phone: document.getElementById("aupEmergencyContactPhone")?.value || ""
    };
    try {
      setMessage("Saving profile...");
      if (button) { button.disabled = true; button.textContent = "Saving..."; }
      const response = await window.DDAuth.apiFetch("/api/admin/user-profile", { method: "POST", body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to save profile.");
      fill(data);
      setMessage("Profile saved successfully.");
      document.dispatchEvent(new CustomEvent("dd:user-updated", { detail: { action: "profile_updated", user: data.user || null } }));
    } catch (error) {
      setMessage(error.message || "Failed to save profile.", true);
    } finally {
      if (button) { button.disabled = false; button.textContent = originalText; }
    }
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-manage-profile-user-id]");
    if (!button) return;
    const userId = Number(button.getAttribute("data-manage-profile-user-id"));
    if (!userId) return;
    currentUserId = userId;
    ensureModal().style.display = "block";
    setMessage("Loading profile...");
    try {
      fill(await loadProfile(userId));
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Failed to load profile.", true);
    }
  });
});
