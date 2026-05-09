// File: /public/js/admin-user-update.js

document.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("usersAdminMount");

  if (!mountEl || !window.DDAuth || !window.DDAuth.isLoggedIn()) return;

  let hasRendered = false;

  function setMessage(message, isError = false) {
    const el = document.getElementById("adminUserUpdateMessage");
    if (!el) return;

    el.textContent = message;
    el.style.display = message ? "block" : "none";
    el.style.color = isError ? "#b00020" : "#0a7a2f";
  }

  function renderUi() {
    if (hasRendered) return;
    hasRendered = true;

    const card = document.createElement("div");
    card.className = "card";
    card.style.marginTop = "18px";
    card.innerHTML = `
      <h3 style="margin-top:0">Update User</h3>
      <p class="small" style="margin-top:0">
        Update display name, role, and active state for a user by user ID.
      </p>

      <form id="adminUserUpdateForm" class="grid" style="gap:12px">
        <div class="grid cols-2" style="gap:12px">
          <div>
            <label class="small" for="adminUserUpdateUserId">User ID</label>
            <input
              id="adminUserUpdateUserId"
              name="user_id"
              type="number"
              min="1"
              step="1"
              required
            />
          </div>

          <div>
            <label class="small" for="adminUserUpdateDisplayName">Display Name</label>
            <input
              id="adminUserUpdateDisplayName"
              name="display_name"
              type="text"
              autocomplete="name"
            />
          </div>
        </div>

        <div class="grid cols-2" style="gap:12px">
          <div>
            <label class="small" for="adminUserUpdateRole">Role</label>
            <select id="adminUserUpdateRole" name="role">
              <option value="">No Change</option>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label class="small" for="adminUserUpdateActiveState">Active State</label>
            <select id="adminUserUpdateActiveState" name="is_active">
              <option value="">No Change</option>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </div>
        </div>

        <div id="adminUserUpdateMessage" class="small" style="display:none"></div>

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn" type="submit" id="adminUserUpdateSubmitButton">
            Update User
          </button>
        </div>
      </form>
    `;

    mountEl.appendChild(card);

    const form = document.getElementById("adminUserUpdateForm");
    if (form) {
      form.addEventListener("submit", handleSubmit);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const userIdEl = document.getElementById("adminUserUpdateUserId");
    const displayNameEl = document.getElementById("adminUserUpdateDisplayName");
    const roleEl = document.getElementById("adminUserUpdateRole");
    const activeEl = document.getElementById("adminUserUpdateActiveState");
    const submitButton = document.getElementById("adminUserUpdateSubmitButton");
    const form = document.getElementById("adminUserUpdateForm");

    const user_id = Number(userIdEl?.value || 0);
    const display_name = String(displayNameEl?.value || "").trim();
    const role = String(roleEl?.value || "").trim().toLowerCase();
    const activeRaw = String(activeEl?.value || "").trim();

    if (!Number.isInteger(user_id) || user_id <= 0) {
      setMessage("A valid user ID is required.", true);
      return;
    }

    if (!display_name && !role && activeRaw === "") {
      setMessage("Provide at least one field to update.", true);
      return;
    }

    if (role && !["member", "admin"].includes(role)) {
      setMessage("Role must be member or admin.", true);
      return;
    }

    const payload = { user_id };

    if (display_name) {
      payload.display_name = display_name;
    }

    if (role) {
      payload.role = role;
    }

    if (activeRaw !== "") {
      payload.is_active = Number(activeRaw);
    }

    const originalText = submitButton?.textContent || "Update User";

    try {
      setMessage("Updating user...");

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Updating...";
      }

      const response = await window.DDAuth.apiFetch("/api/admin/user-update", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to update user.");
      }

      if (form) {
        form.reset();
      }

      setMessage(`User updated successfully: ${data?.user?.email || `user #${user_id}`}`);

      document.dispatchEvent(new CustomEvent("dd:user-updated", {
        detail: {
          action: "updated",
          user: data?.user || null
        }
      }));
    } catch (error) {
      setMessage(error.message || "Failed to update user.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  }

  document.addEventListener("dd:admin-ready", (event) => {
    if (!event?.detail?.ok) return;
    renderUi();
  });

  renderUi();
});
