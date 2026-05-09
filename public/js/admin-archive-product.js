// File: /public/js/admin-archive-product.js

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("productsTableBody");

  if (!tableBody) return;

  function getRowProductId(button) {
    return Number(button.getAttribute("data-archive-product-id"));
  }

  async function archiveProduct(productId, button) {
    const originalText = button.textContent;

    try {
      button.disabled = true;
      button.textContent = "Archiving...";

      const response = await window.DDAuth.apiFetch("/api/admin/archive-product", {
        method: "POST",
        body: JSON.stringify({
          product_id: productId
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Archive failed.");
      }

      alert(data.message || "Product archived successfully.");

      document.dispatchEvent(new CustomEvent("dd:product-archived", {
        detail: {
          product: data.product || null,
          product_id: productId
        }
      }));
    } catch (error) {
      alert(error.message || "Archive failed.");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-archive-product-id]");
    if (!button) return;

    const productId = getRowProductId(button);
    if (!productId) {
      alert("Invalid product.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to archive this product? Archived products stay in the system but are no longer active."
    );

    if (!confirmed) return;

    await archiveProduct(productId, button);
  });
});
