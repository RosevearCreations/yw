// File: /public/js/admin-delete-user.js

document.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("usersAdminMount");

  if (!mountEl || !window.DDAuth || !window.DDAuth.isLoggedIn()) return;

  let hasRendered = false;

  function setMessage(message, isError = false) {
    const el = document.getElementById("adminDeleteUserMessage");
    if (!el) return;

    el.textContent = message;
    el.style.display = message ? "block" : "none";
    el.style.color = isError ? "#b00020" : "#0a7a2f";
  }

  function togglePermanentWarning() {
    const actionEl = document.getElementById("adminDeleteUserAction");
    const warningEl = document.getElementById("adminDeleteUserWarning");
    const confirmWrapEl = document.getElementById("adminDeleteUserPermanentWrap");

    const action = String(actionEl?.value || "deactivate").trim().toLowerCase();
    const isPermanent = action === "delete";

    if (warningEl) {
      warningEl.style.display = isPermanent ? "block" : "none";
    }

    if (confirmWrapEl) {
      confirmWrapEl.style.display = isPermanent ? "flex" : "none";
    }
  }

  function renderUi() {
    if (hasRendered) return;
    hasRendered = true;

    const card = document.createElement("div");
    card.className = "card";
    card.style.marginTop = "18px";
    card.innerHTML = `
      <h3 style="margin-top:0">Deactivate or Delete User</h3>
      <p class="small" style="margin-top:0">
        Deactivate a user for safer access removal, or permanently delete a user when appropriate.
      </p>

      <form id="adminDeleteUserForm" class="grid" style="gap:12px">
        <div class="grid cols-2" style="gap:12px">
          <div>
            <label class="small" for="adminDeleteUserId">User ID</label>
            <input
              id="adminDeleteUserId"
              name="user_id"
              type="number"
              min="1"
              step="1"
              required
            />
          </div>

          <div>
            <label class="small" for="adminDeleteUserAction">Action</label>
            <select id="adminDeleteUserAction" name="action">
              <option value="deactivate" selected>Deactivate User</option>
              <option value="delete">Permanently Delete User</option>
            </select>
          </div>
        </div>

        <label class="small" style="display:flex;gap:8px;align-items:flex-start">
          <input id="adminDeleteUserClearSessions" name="clear_sessions" type="checkbox" checked />
          <span>Clear the user’s sessions as part of this action</span>
        </label>

        <div
          id="adminDeleteUserWarning"
          class="card"
          style="display:none;padding:12px"
        >
          <strong>Warning:</strong>
          <div class="small" style="margin-top:6px">
            Permanent deletion should only be used when you are sure the account and related access can be safely removed.
          </div>
        </div>

        <label
          id="adminDeleteUserPermanentWrap"
          class="small"
          style="display:none;gap:8px;align-items:flex-start"
        >
          <input id="adminDeleteUserPermanentConfirm" name="permanent_confirm" type="checkbox" />
          <span>I understand this is a permanent delete action</span>
        </label>

        <div id="adminDeleteUserMessage" class="small" style="display:none"></div>

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn" type="submit" id="adminDeleteUserSubmitButton">
            Run User Action
          </button>
        </div>
      </form>
    `;

    mountEl.appendChild(card);

    const form = document.getElementById("adminDeleteUserForm");
    const actionEl = document.getElementById("adminDeleteUserAction");

    if (form) {
      form.addEventListener("submit", handleSubmit);
    }

    if (actionEl) {
      actionEl.addEventListener("change", togglePermanentWarning);
    }

    togglePermanentWarning();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const userIdEl = document.getElementById("adminDeleteUserId");
    const actionEl = document.getElementById("adminDeleteUserAction");
    const clearSessionsEl = document.getElementById("adminDeleteUserClearSessions");
    const permanentConfirmEl = document.getElementById("adminDeleteUserPermanentConfirm");
    const submitButton = document.getElementById("adminDeleteUserSubmitButton");
    const form = document.getElementById("adminDeleteUserForm");

    const user_id = Number(userIdEl?.value || 0);
    const action = String(actionEl?.value || "deactivate").trim().toLowerCase();
    const clear_sessions = !!clearSessionsEl?.checked;
    const permanent_confirm = !!permanentConfirmEl?.checked;

    if (!Number.isInteger(user_id) || user_id <= 0) {
      setMessage("A valid user ID is required.", true);
      return;
    }

    if (!["deactivate", "delete"].includes(action)) {
      setMessage("Action must be deactivate or delete.", true);
      return;
    }

    if (action === "delete" && !permanent_confirm) {
      setMessage("You must confirm permanent deletion before continuing.", true);
      return;
    }

    const originalText = submitButton?.textContent || "Run User Action";

    try {
      setMessage(action === "delete" ? "Deleting user..." : "Deactivating user...");

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = action === "delete" ? "Deleting..." : "Deactivating...";
      }

      const response = await window.DDAuth.apiFetch("/api/admin/delete-user", {
        method: "POST",
        body: JSON.stringify({
          user_id,
          action,
          clear_sessions,
          permanent_confirm
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to process user action.");
      }

      if (form) {
        form.reset();
      }

      const clearBox = document.getElementById("adminDeleteUserClearSessions");
      if (clearBox) {
        clearBox.checked = true;
      }

      setMessage(
        action === "delete"
          ? `User deleted successfully: ${data?.user?.email || `user #${user_id}`}`
          : `User deactivated successfully: ${data?.user?.email || `user #${user_id}`}`
      );

      togglePermanentWarning();

      document.dispatchEvent(new CustomEvent("dd:user-updated", {
        detail: {
          action: action === "delete" ? "deleted" : "deactivated",
          user: data?.user || null
        }
      }));
    } catch (error) {
      setMessage(error.message || "Failed to process user action.", true);
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
