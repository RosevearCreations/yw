// File: /public/js/admin-delete-product.js

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("productsTableBody");

  if (!tableBody) return;

  function getRowProductId(button) {
    return Number(button.getAttribute("data-delete-product-id"));
  }

  async function deleteProduct(productId, button) {
    const originalText = button.textContent;

    try {
      button.disabled = true;
      button.textContent = "Deleting...";

      const response = await window.DDAuth.apiFetch("/api/admin/delete-product", {
        method: "POST",
        body: JSON.stringify({
          product_id: productId
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Delete failed.");
      }

      alert(data.message || "Product deleted successfully.");

      document.dispatchEvent(new CustomEvent("dd:product-deleted", {
        detail: {
          product: data.product || null,
          product_id: productId
        }
      }));
    } catch (error) {
      alert(error.message || "Delete failed.");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-product-id]");
    if (!button) return;

    const productId = getRowProductId(button);
    if (!productId) {
      alert("Invalid product.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this product? This cannot be undone."
    );

    if (!confirmed) return;

    await deleteProduct(productId, button);
  });
});
