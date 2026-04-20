// File: /public/js/cart.js

(function () {
  const CART_KEY = "dd_cart";

  function readCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent("dd:cart-changed", {
      detail: {
        count: getCartCount(),
        items: getCartItems()
      }
    }));
  }

  function getCartItems() {
    return readCart();
  }

  function getCartCount() {
    return readCart().reduce((sum, item) => {
      return sum + Number(item.quantity || 0);
    }, 0);
  }

  function clearCart() {
    writeCart([]);
  }

  function removeFromCart(productId) {
    const nextItems = readCart().filter(item => {
      return Number(item.product_id) !== Number(productId);
    });

    writeCart(nextItems);
  }

  function setQuantity(productId, quantity) {
    const qty = Number(quantity);

    if (!Number.isInteger(qty) || qty <= 0) {
      removeFromCart(productId);
      return;
    }

    const items = readCart();
    const nextItems = items.map(item => {
      if (Number(item.product_id) !== Number(productId)) {
        return item;
      }

      return {
        ...item,
        quantity: qty
      };
    });

    writeCart(nextItems);
  }

  function addToCart(product, quantity = 1) {
    const qty = Number(quantity);

    if (!product || !Number.isInteger(qty) || qty <= 0) {
      throw new Error("A valid product and quantity are required.");
    }

    const productId = Number(product.product_id);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new Error("A valid product_id is required.");
    }

    const items = readCart();
    const existingIndex = items.findIndex(item => Number(item.product_id) === productId);

    if (existingIndex >= 0) {
      items[existingIndex] = {
        ...items[existingIndex],
        quantity: Number(items[existingIndex].quantity || 0) + qty
      };
      writeCart(items);
      return items[existingIndex];
    }

    const newItem = {
      product_id: productId,
      slug: String(product.slug || "").trim(),
      sku: String(product.sku || "").trim(),
      name: String(product.name || "").trim(),
      product_type: String(product.product_type || "").trim(),
      price_cents: Number(product.price_cents || 0),
      currency: String(product.currency || "CAD").trim().toUpperCase(),
      featured_image_url: String(product.featured_image_url || "").trim(),
      requires_shipping: Number(product.requires_shipping) === 1 ? 1 : 0,
      quantity: qty
    };

    items.push(newItem);
    writeCart(items);
    return newItem;
  }

  window.DDCart = {
    getCartItems,
    getCartCount,
    clearCart,
    removeFromCart,
    setQuantity,
    addToCart
  };
})();
