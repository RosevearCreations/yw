// File: /public/js/cart-badge.js

document.addEventListener("DOMContentLoaded", () => {
  const navLinksContainers = document.querySelectorAll(".nav .links");

  function getOrCreateBadge() {
    const cartLinks = document.querySelectorAll('a[href="/cart/"]');
    const badges = [];

    cartLinks.forEach(link => {
      let badge = link.querySelector("[data-cart-count-badge]");

      if (!badge) {
        badge = document.createElement("span");
        badge.setAttribute("data-cart-count-badge", "true");
        badge.style.display = "none";
        badge.style.marginLeft = "6px";
        badge.style.padding = "1px 6px";
        badge.style.borderRadius = "999px";
        badge.style.fontSize = "0.75rem";
        badge.style.fontWeight = "700";
        badge.style.lineHeight = "1.4";
        badge.style.border = "1px solid currentColor";
        link.appendChild(badge);
      }

      badges.push(badge);
    });

    return badges;
  }

  function updateBadge() {
    if (!window.DDCart) return;

    const count = Number(window.DDCart.getCartCount() || 0);
    const badges = getOrCreateBadge();

    badges.forEach(badge => {
      if (count <= 0) {
        badge.textContent = "";
        badge.style.display = "none";
        return;
      }

      badge.textContent = String(count);
      badge.style.display = "inline-block";
    });
  }

  if (!navLinksContainers.length) return;

  document.addEventListener("dd:cart-changed", () => {
    updateBadge();
  });

  updateBadge();
});
