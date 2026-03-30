// assets/admin-page-init.js
//
// Shared admin/detailer page initializer.
//
// What this file does:
// - boots AdminShell for protected pages
// - renders AdminMenu automatically
// - gives each page one simple init call
// - reduces repeated auth/menu startup code across admin pages
//
// Expected dependencies:
// - /assets/admin-auth.js
// - /assets/admin-shell.js
// - /assets/admin-menu.js
//
// Typical page usage:
// <script src="/assets/admin-auth.js"></script>
// <script src="/assets/admin-shell.js"></script>
// <script src="/assets/admin-menu.js"></script>
// <script src="/assets/admin-page-init.js"></script>
// <script>
//   window.AdminPageInit.init({
//     pageKey: "admin-booking",
//     onReady: async ({ actor }) => { ... }
//   });
// </script>
//
// Optional page markup hook:
// - [data-admin-menu-mount]

(function attachAdminPageInit(globalScope) {
  function assertDependencies() {
    if (!globalScope.AdminShell) {
      throw new Error("AdminPageInit requires /assets/admin-shell.js.");
    }
    if (!globalScope.AdminMenu) {
      throw new Error("AdminPageInit requires /assets/admin-menu.js.");
    }
  }

  async function init(options = {}) {
    assertDependencies();

    const pageKey = String(options.pageKey || "").trim();
    const mount = options.menuMount || document.querySelector("[data-admin-menu-mount]");
    const menuTitle = options.menuTitle || "Internal Menu";

    const result = await globalScope.AdminShell.boot({
      pageKey,
      loginUrl: options.loginUrl || "/admin-login",
      logoutRedirect: options.logoutRedirect || "/admin-login",
      root: options.root || document,
      onReady: async ({ actor, auth }) => {
        if (mount) {
          globalScope.AdminMenu.render({
            currentPage: pageKey,
            mount,
            title: menuTitle
          });
        }

        if (typeof options.onReady === "function") {
          await options.onReady({ actor, auth });
        }
      },
      onError: options.onError
    });

    return result;
  }

  globalScope.AdminPageInit = {
    init
  };
})(window);
