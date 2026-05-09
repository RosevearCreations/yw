// File: /public/js/cart-page.js

document.addEventListener("DOMContentLoaded", () => {
  const cartEmptyEl = document.getElementById("cartEmpty");
  const cartContentEl = document.getElementById("cartContent");
  const cartItemsEl = document.getElementById("cartItems");
  const cartItemCountEl = document.getElementById("cartItemCount");
  const cartSubtotalEl = document.getElementById("cartSubtotal");
  const clearCartButton = document.getElementById("clearCartButton");
  const cartPolicyTrustMount = document.getElementById("cartPolicyTrustMount");

  function show(el) {
    if (el) el.style.display = "";
  }

  function hide(el) {
    if (el) el.style.display = "none";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatMoney(cents, currency = "CAD") {
    const amount = Number(cents || 0) / 100;

    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "CAD"
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency || "CAD"}`;
    }
  }


  function renderCartTrust() {
    if (!cartPolicyTrustMount) return;
    cartPolicyTrustMount.innerHTML = `
      <h2 style="margin-top:0">Shipping, timing, and support before checkout</h2>
      <div class="small">We keep a few trust reminders near the cart so buyers do not have to backtrack across product pages to remember the basics.</div>
      <ul class="small" style="margin-top:12px;padding-left:18px">
        <li>Shipping-required items will need address details during checkout, while no-shipping or digital-style items are identified earlier in the browse flow.</li>
        <li>Custom, personalized, or made-to-order timing should be confirmed before payment so one-off craft work is not confused with ready-to-ship stock.</li>
        <li>Questions about delivery, pickup, fit, finish, or a specific item can be sent through the contact page before checkout if anything needs clarifying.</li>
        <li>Gallery, About, and Creations pages provide more workshop context for shoppers who want process and trust details before placing an order.</li>
      </ul>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        <a class="btn" href="/contact/">Contact</a>
        <a class="btn" href="/about/">About</a>
        <a class="btn" href="/gallery/">Gallery</a>
      </div>
    `;
  }

  function getCartItemsSafe() {
    if (!window.DDCart) return [];
    return window.DDCart.getCartItems();
  }

  function renderCart() {
    const items = getCartItemsSafe();

    if (!items.length) {
      hide(cartContentEl);
      show(cartEmptyEl);
      if (cartItemsEl) cartItemsEl.innerHTML = "";
      if (cartItemCountEl) cartItemCountEl.textContent = "0";
      if (cartSubtotalEl) cartSubtotalEl.textContent = formatMoney(0, "CAD");
      return;
    }

    hide(cartEmptyEl);
    show(cartContentEl);

    const subtotalCents = items.reduce((sum, item) => {
      return sum + (Number(item.price_cents || 0) * Number(item.quantity || 0));
    }, 0);

    const totalItems = items.reduce((sum, item) => {
      return sum + Number(item.quantity || 0);
    }, 0);

    if (cartItemCountEl) {
      cartItemCountEl.textContent = String(totalItems);
    }

    if (cartSubtotalEl) {
      const firstCurrency = items[0]?.currency || "CAD";
      cartSubtotalEl.textContent = formatMoney(subtotalCents, firstCurrency);
    }

    if (!cartItemsEl) return;

    cartItemsEl.innerHTML = items.map(item => {
      const productId = Number(item.product_id);
      const name = escapeHtml(item.name || "");
      const slug = encodeURIComponent(item.slug || "");
      const imageUrl = String(item.featured_image_url || "").trim();
      const price = formatMoney(item.price_cents, item.currency);
      const quantity = Number(item.quantity || 0);

      const imageMarkup = imageUrl
        ? `<img
             src="${escapeHtml(imageUrl)}"
             alt="${name}"
             style="width:90px;height:90px;object-fit:cover;border-radius:10px"
           />`
        : `<div
             style="width:90px;height:90px;display:flex;align-items:center;justify-content:center;border:1px solid #ddd;border-radius:10px"
             class="small"
           >
             No Image
           </div>`;

      return `
        <div class="card" style="margin-bottom:12px">
          <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
            <div>${imageMarkup}</div>

            <div style="flex:1;min-width:220px">
              <h3 style="margin:0 0 8px 0">
                <a href="/shop/product/?slug=${slug}">${name}</a>
              </h3>

              <div class="small" style="margin-bottom:8px">
                ${escapeHtml(item.product_type || "")}
              </div>

              <div style="font-weight:700;margin-bottom:10px">${escapeHtml(price)}</div>

              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                <label class="small" for="cart_qty_${productId}">Quantity</label>
                <input
                  id="cart_qty_${productId}"
                  type="number"
                  min="1"
                  value="${quantity}"
                  data-cart-qty-id="${productId}"
                  style="max-width:90px"
                />

                <button
                  class="btn"
                  type="button"
                  data-remove-cart-id="${productId}"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  document.addEventListener("change", (event) => {
    const qtyInput = event.target.closest("[data-cart-qty-id]");
    if (!qtyInput || !window.DDCart) return;

    const productId = Number(qtyInput.getAttribute("data-cart-qty-id"));
    const quantity = Number(qtyInput.value);

    if (!Number.isInteger(productId) || productId <= 0) return;

    window.DDCart.setQuantity(productId, quantity);
    renderCart();
  });

  document.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-cart-id]");
    if (!removeButton || !window.DDCart) return;

    const productId = Number(removeButton.getAttribute("data-remove-cart-id"));
    if (!Number.isInteger(productId) || productId <= 0) return;

    window.DDCart.removeFromCart(productId);
    renderCart();
  });

  if (clearCartButton) {
    clearCartButton.addEventListener("click", () => {
      if (!window.DDCart) return;

      const confirmed = window.confirm("Are you sure you want to clear your cart?");
      if (!confirmed) return;

      window.DDCart.clearCart();
      renderCart();
    });
  }

  document.addEventListener("dd:cart-changed", () => {
    renderCart();
  });

  renderCartTrust();
  renderCart();
});
