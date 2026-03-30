// assets/admin-menu.js
//
// Shared internal admin/detailer navigation.
//
// What this file does:
// - builds a session-aware internal menu for admin/detailer pages
// - shows only links the current actor should see
// - highlights the current page
// - gives the growing internal app a reusable nav instead of hard-coded page links
//
// Expected dependencies:
// - /assets/admin-auth.js
//
// Typical page usage:
// <script src="/assets/admin-auth.js"></script>
// <script src="/assets/admin-menu.js"></script>
// <script>
//   window.AdminMenu.render({
//     currentPage: "admin-booking",
//     mount: document.querySelector("[data-admin-menu-mount]")
//   });
// </script>

(function attachAdminMenu(globalScope) {
  function assertDependency() {
    if (!globalScope.AdminAuth) {
      throw new Error("AdminMenu requires /assets/admin-auth.js to be loaded first.");
    }
  }

  const MENU_ITEMS = [
    {
      key: "admin",
      label: "Dashboard",
      href: "/admin",
      description: "Internal home",
      visible: () => true
    },
    {
      key: "admin-booking",
      label: "Bookings",
      href: "/admin-booking",
      description: "Search and manage bookings",
      visible: () => globalScope.AdminAuth.canAccessPage("admin-booking")
    },
    {
      key: "admin-blocks",
      label: "Blocks",
      href: "/admin-blocks",
      description: "Day and slot capacity",
      visible: () => globalScope.AdminAuth.canAccessPage("admin-blocks")
    },
    {
      key: "admin-progress",
      label: "Progress",
      href: "/admin-progress",
      description: "Customer progress updates",
      visible: () => globalScope.AdminAuth.canAccessPage("admin-progress")
    },
    {
      key: "admin-jobsite",
      label: "Jobsite",
      href: "/admin-jobsite",
      description: "Live field workspace",
      visible: () => globalScope.AdminAuth.canAccessPage("admin-jobsite")
    },
    {
      key: "admin-live",
      label: "Live",
      href: "/admin-live",
      description: "Operational live view",
      visible: () => globalScope.AdminAuth.canAccessPage("admin-live")
    },
    {
      key: "admin-staff",
      label: "Staff",
      href: "/admin-staff",
      description: "Users and passwords",
      visible: () => globalScope.AdminAuth.canAccessPage("admin-staff")
    },

    {
      key: "admin-app",
      label: "App Management",
      href: "/admin-app",
      description: "Roles, screens, feature access",
      visible: () => globalScope.AdminAuth.canAccessPage("admin-app")
    },
    {
      key: "admin-catalog",
      label: "Catalog",
      href: "/admin-catalog",
      description: "Tools, systems, consumables",
      visible: () => globalScope.AdminAuth.canAccessPage("admin-catalog")
    },
    {
      key: "admin-customers",
      label: "Customers",
      href: "/admin-customers",
      description: "Profiles and tiers",
      visible: () => globalScope.AdminAuth.canAccessPage("admin-customers")
    },
    {
      key: "admin-notifications",
      label: "Notifications",
      href: "/admin-notifications",
      description: "Queued notices and hooks",
      visible: () => globalScope.AdminAuth.canAccessPage("admin-notifications")
    },
    {
      key: "admin-analytics",
      label: "Analytics",
      href: "/admin-analytics",
      description: "Visitors, referrers, abandoned checkouts",
      visible: () => globalScope.AdminAuth.canAccessPage("admin-analytics")
    },

    {
      key: "admin-promos",
      label: "Promos",
      href: "/admin-promos",
      description: "Promo code management",
      visible: () => globalScope.AdminAuth.canAccessPage("admin-promos")
    },
    {
      key: "account",
      label: "My Account",
      href: "/account",
      description: "My session and password",
      visible: () => globalScope.AdminAuth.isAuthenticated()
    }
  ];

  function render(options = {}) {
    assertDependency();

    const mount = options.mount || document.querySelector("[data-admin-menu-mount]");
    const currentPage = String(options.currentPage || "").trim();
    const title = options.title || "Internal Menu";

    if (!mount) return;

    const items = MENU_ITEMS.filter((item) => {
      try {
        return item.visible();
      } catch {
        return false;
      }
    });

    mount.innerHTML = "";
    mount.appendChild(buildMenuNode({ items, currentPage, title }));
  }

  function buildMenuNode({ items, currentPage, title }) {
    const wrapper = document.createElement("aside");
    wrapper.className = "admin-menu";

    const style = document.createElement("style");
    style.textContent = `
      .admin-menu {
        border-radius: 18px;
        padding: 16px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 14px 35px rgba(0,0,0,0.18);
      }

      .admin-menu__title {
        margin: 0 0 12px;
        font-size: 0.95rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #93c5fd;
      }

      .admin-menu__list {
        display: grid;
        gap: 10px;
      }

      .admin-menu__item {
        display: block;
        text-decoration: none;
        color: #f8fafc;
        border-radius: 12px;
        padding: 12px 14px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        transition: background 0.15s ease, transform 0.05s ease, border-color 0.15s ease;
      }

      .admin-menu__item:hover {
        background: rgba(255,255,255,0.08);
      }

      .admin-menu__item:active {
        transform: translateY(1px);
      }

      .admin-menu__item.is-active {
        background: rgba(37,99,235,0.22);
        border-color: rgba(96,165,250,0.42);
      }

      .admin-menu__label {
        display: block;
        font-weight: 700;
        margin-bottom: 4px;
      }

      .admin-menu__desc {
        display: block;
        color: #cbd5e1;
        font-size: 0.88rem;
        line-height: 1.35;
      }
    `;
    wrapper.appendChild(style);

    const heading = document.createElement("h2");
    heading.className = "admin-menu__title";
    heading.textContent = title;
    wrapper.appendChild(heading);

    const list = document.createElement("nav");
    list.className = "admin-menu__list";
    list.setAttribute("aria-label", title);

    items.forEach((item) => {
      const link = document.createElement("a");
      link.className = "admin-menu__item" + (item.key === currentPage ? " is-active" : "");
      link.href = item.href;

      const label = document.createElement("span");
      label.className = "admin-menu__label";
      label.textContent = item.label;

      const desc = document.createElement("span");
      desc.className = "admin-menu__desc";
      desc.textContent = item.description || "";

      link.appendChild(label);
      link.appendChild(desc);
      list.appendChild(link);
    });

    wrapper.appendChild(list);
    return wrapper;
  }

  globalScope.AdminMenu = {
    render,
    items: MENU_ITEMS.slice()
  };
})(window);
