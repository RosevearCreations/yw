// File: /public/js/admin-create-user.js

document.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("usersAdminMount");

  if (!mountEl || !window.DDAuth || !window.DDAuth.isLoggedIn()) return;

  let hasRendered = false;

  function setMessage(message, isError = false) {
    const el = document.getElementById("adminCreateUserMessage");
    if (!el) return;

    el.textContent = message;
    el.style.display = message ? "block" : "none";
    el.style.color = isError ? "#b00020" : "#0a7a2f";
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  function renderUi() {
    if (hasRendered) return;
    hasRendered = true;

    const card = document.createElement("div");
    card.className = "card";
    card.style.marginTop = "18px";
    card.innerHTML = `
      <h3 style="margin-top:0">Create User</h3>
      <p class="small" style="margin-top:0">
        Create a new member or admin account from the dashboard.
      </p>

      <form id="adminCreateUserForm" class="grid" style="gap:12px">
        <div class="grid cols-2" style="gap:12px">
          <div>
            <label class="small" for="adminCreateUserEmail">Email</label>
            <input
              id="adminCreateUserEmail"
              name="email"
              type="email"
              autocomplete="email"
              required
            />
          </div>

          <div>
            <label class="small" for="adminCreateUserDisplayName">Display Name</label>
            <input
              id="adminCreateUserDisplayName"
              name="display_name"
              type="text"
              autocomplete="name"
            />
          </div>
        </div>

        <div class="grid cols-3" style="gap:12px">
          <div>
            <label class="small" for="adminCreateUserPassword">Temporary Password</label>
            <input
              id="adminCreateUserPassword"
              name="password"
              type="password"
              autocomplete="new-password"
              required
            />
          </div>

          <div>
            <label class="small" for="adminCreateUserConfirmPassword">Confirm Password</label>
            <input
              id="adminCreateUserConfirmPassword"
              name="confirm_password"
              type="password"
              autocomplete="new-password"
              required
            />
          </div>

          <div>
            <label class="small" for="adminCreateUserRole">Role</label>
            <select id="adminCreateUserRole" name="role">
              <option value="member" selected>Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <label class="small" style="display:flex;gap:8px;align-items:flex-start">
          <input id="adminCreateUserIsActive" name="is_active" type="checkbox" checked />
          <span>Create this account as active</span>
        </label>

        <div id="adminCreateUserMessage" class="small" style="display:none"></div>

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn" type="submit" id="adminCreateUserSubmitButton">
            Create User
          </button>
        </div>
      </form>
    `;

    mountEl.appendChild(card);

    const form = document.getElementById("adminCreateUserForm");
    if (form) {
      form.addEventListener("submit", handleSubmit);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const emailEl = document.getElementById("adminCreateUserEmail");
    const displayNameEl = document.getElementById("adminCreateUserDisplayName");
    const passwordEl = document.getElementById("adminCreateUserPassword");
    const confirmPasswordEl = document.getElementById("adminCreateUserConfirmPassword");
    const roleEl = document.getElementById("adminCreateUserRole");
    const isActiveEl = document.getElementById("adminCreateUserIsActive");
    const submitButton = document.getElementById("adminCreateUserSubmitButton");
    const form = document.getElementById("adminCreateUserForm");

    const email = String(emailEl?.value || "").trim().toLowerCase();
    const display_name = String(displayNameEl?.value || "").trim();
    const password = String(passwordEl?.value || "");
    const confirm_password = String(confirmPasswordEl?.value || "");
    const role = String(roleEl?.value || "member").trim().toLowerCase();
    const is_active = isActiveEl?.checked ? 1 : 0;

    if (!email) {
      setMessage("Email is required.", true);
      return;
    }

    if (!isValidEmail(email)) {
      setMessage("Please enter a valid email address.", true);
      return;
    }

    if (!password) {
      setMessage("Password is required.", true);
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.", true);
      return;
    }

    if (password !== confirm_password) {
      setMessage("Passwords do not match.", true);
      return;
    }

    if (!["member", "admin"].includes(role)) {
      setMessage("Role must be member or admin.", true);
      return;
    }

    const originalText = submitButton?.textContent || "Create User";

    try {
      setMessage("Creating user...");

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Creating...";
      }

      const response = await window.DDAuth.apiFetch("/api/admin/create-user", {
        method: "POST",
        body: JSON.stringify({
          email,
          display_name,
          password,
          confirm_password,
          role,
          is_active
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to create user.");
      }

      if (form) {
        form.reset();
      }

      const activeCheckbox = document.getElementById("adminCreateUserIsActive");
      if (activeCheckbox) {
        activeCheckbox.checked = true;
      }

      const roleSelect = document.getElementById("adminCreateUserRole");
      if (roleSelect) {
        roleSelect.value = "member";
      }

      setMessage(`User created successfully: ${data?.user?.email || email}`);

      document.dispatchEvent(new CustomEvent("dd:user-updated", {
        detail: {
          action: "created",
          user: data?.user || null
        }
      }));
    } catch (error) {
      setMessage(error.message || "Failed to create user.", true);
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
