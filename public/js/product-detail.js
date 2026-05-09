// File: /public/js/product-detail.js
// Brief description: Renders one storefront product with SEO-aware media handling,
// richer maker-story output, cart support, wishlist saving, and back-in-stock requests.

document.addEventListener("DOMContentLoaded", async () => {
  const loadingEl = document.getElementById("productLoading");
  const errorEl = document.getElementById("productError");
  const detailEl = document.getElementById("productDetail");
  const productTypeEl = document.getElementById("productType");
  const productNameEl = document.getElementById("productName");
  const productPriceEl = document.getElementById("productPrice");
  const productShortDescriptionEl = document.getElementById("productShortDescription");
  const productKeywordTagsEl = document.getElementById("productKeywordTags");
  const pageH1El = document.getElementById("pageH1");
  const pageIntroEl = document.getElementById("pageIntro");
  const productSkuEl = document.getElementById("productSku");
  const productShippingEl = document.getElementById("productShipping");
  const productTaxClassEl = document.getElementById("productTaxClass");
  const productInventoryEl = document.getElementById("productInventory");
  const productDescriptionEl = document.getElementById("productDescription");
  const productStoryCardEl = document.getElementById("productStoryCard");
  const productStorySummaryEl = document.getElementById("productStorySummary");
  const productResourcesStoryEl = document.getElementById("productResourcesStory");
  const productMainImageWrapEl = document.getElementById("productMainImageWrap");
  const productGalleryEl = document.getElementById("productGallery");
  const productQuantityEl = document.getElementById("productQuantity");
  const addToCartButton = document.getElementById("addToCartButton");
  const addToCartMessageEl = document.getElementById("addToCartMessage");
  const productWishlistButton = document.getElementById("productWishlistButton");
  const productBackInStockButton = document.getElementById("productBackInStockButton");
  const productInterestGuestWrap = document.getElementById("productInterestGuestWrap");
  const productInterestEmail = document.getElementById("productInterestEmail");
  const productInterestMessageEl = document.getElementById("productInterestMessage");
  const productTrustListEl = document.getElementById("productTrustList");
  const productTrustSummaryEl = document.getElementById("productTrustSummary");
  const productPolicySummaryEl = document.getElementById("productPolicySummary");
  const productPolicyListEl = document.getElementById("productPolicyList");
  const productMarketplaceCardEl = document.getElementById("productMarketplaceCard");
  const productMarketplaceSummaryEl = document.getElementById("productMarketplaceSummary");
  const productMarketplaceLinksEl = document.getElementById("productMarketplaceLinks");
  const productProcessSummaryEl = document.getElementById("productProcessSummary");
  const productProcessLinksEl = document.getElementById("productProcessLinks");
  const productReviewsCardEl = document.getElementById("productReviewsCard");
  const productReviewsSummaryEl = document.getElementById("productReviewsSummary");
  const productReviewsListEl = document.getElementById("productReviewsList");
  let currentProduct = null;
  let currentTrustSummary = null;

  function show(el) { if (el) el.style.display = ""; }
  function hide(el) { if (el) el.style.display = "none"; }
  function setCartMessage(message, isError = false) {
    if (!addToCartMessageEl) return;
    addToCartMessageEl.textContent = message;
    addToCartMessageEl.style.display = "block";
    addToCartMessageEl.style.color = isError ? "#b00020" : "#0a7a2f";
  }
  function clearCartMessage() { if (addToCartMessageEl) { addToCartMessageEl.textContent = ""; addToCartMessageEl.style.display = "none"; } }
  function setInterestMessage(message, isError = false) {
    if (!productInterestMessageEl) return;
    productInterestMessageEl.textContent = message;
    productInterestMessageEl.style.display = message ? "block" : "none";
    productInterestMessageEl.style.color = isError ? "#b00020" : "#0a7a2f";
  }
  function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function formatMoney(cents, currency = "CAD") { const amount = Number(cents || 0) / 100; try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "CAD" }).format(amount); } catch { return `${amount.toFixed(2)} ${currency || "CAD"}`; } }
  function yesNo(value) { return Number(value) === 1 ? "Yes" : "No"; }

  function renderMainImage(product, images) {
    if (!productMainImageWrapEl) return;
    const featured = String(product.featured_image_url || "").trim();
    const featuredRow = Array.isArray(images) ? images.find((row) => String(row.image_url || '').trim() === featured) : null;
    const mainRow = featuredRow || (Array.isArray(images) && images.length ? images[0] : null);
    const mainImageUrl = String(mainRow?.image_url || featured || "").trim();
    const caption = String(mainRow?.caption || '').trim();
    if (!mainImageUrl) {
      productMainImageWrapEl.innerHTML = `<div class="card" style="width:100%;aspect-ratio:1 / 1;display:flex;align-items:center;justify-content:center"><span class="small">No Image</span></div>`;
      return;
    }
    productMainImageWrapEl.innerHTML = `
      <div>
        <img src="${escapeHtml(mainImageUrl)}" alt="${escapeHtml(mainRow?.alt_text || product.name || 'Product image')}" style="width:100%;aspect-ratio:1 / 1;object-fit:cover;border-radius:12px" />
        ${caption ? `<div class="small" style="margin-top:8px">${escapeHtml(caption)}</div>` : ''}
      </div>`;
  }

  function renderGallery(images, productName) {
    if (!productGalleryEl) return;
    const safeImages = Array.isArray(images) ? images : [];
    if (!safeImages.length) { productGalleryEl.innerHTML = ""; return; }
    productGalleryEl.innerHTML = safeImages.map((image, index) => `
      <figure style="margin:0">
        <img src="${escapeHtml(image.image_url || "")}" alt="${escapeHtml(image.alt_text || `${productName} image ${index + 1}`)}" title="${escapeHtml(image.image_title || image.caption || '')}" style="width:100%;aspect-ratio:1 / 1;object-fit:cover;border-radius:10px" />
        ${image.caption ? `<figcaption class="small" style="margin-top:6px">${escapeHtml(image.caption)}</figcaption>` : ''}
      </figure>`).join("");
  }

  function renderResourceStory(resourceLinks, resourceSummary) {
    if (!productStoryCardEl || !productResourcesStoryEl || !productStorySummaryEl) return;
    const links = Array.isArray(resourceLinks) ? resourceLinks : [];
    if (!links.length) {
      hide(productStoryCardEl);
      productResourcesStoryEl.innerHTML = '';
      productStorySummaryEl.textContent = '';
      return;
    }
    show(productStoryCardEl);
    const summary = resourceSummary || {};
    productStorySummaryEl.textContent = `${Number(summary.linked_tools || 0)} tools • ${Number(summary.linked_supplies || 0)} supplies • Estimated materials per product ${formatMoney(Number(summary.estimated_cost_per_product_cents || 0), currentProduct?.currency || 'CAD')}${Number(summary.low_stock_items || 0) ? ` • ${Number(summary.low_stock_items)} linked items are low in stock` : ''}`;
    productResourcesStoryEl.innerHTML = links.map((link) => {
      const inv = link.inventory || null;
      const lowStock = !!(inv && ((Number(inv.on_hand_quantity || 0) - Number(inv.reserved_quantity || 0) + Number(inv.incoming_quantity || 0)) <= Number(inv.reorder_level || 0)));
      const modeLabel = link.consumption_mode === 'end_of_lot' ? 'end of lot' : (link.consumption_mode === 'story_only' ? 'story only' : 'per product');
      return `
        <article class="resource-story-card">
          <div class="resource-story-media">${link.resource_image_url ? `<img src="${escapeHtml(link.resource_image_url)}" alt="${escapeHtml(link.resource_name || link.source_key)}" loading="lazy"/>` : `<div class="resource-story-placeholder">${escapeHtml(link.resource_kind || 'item')}</div>`}</div>
          <div class="resource-story-body">
            <div class="small resource-kind-pill">${escapeHtml(link.resource_kind || 'resource')}</div>
            <h4>${escapeHtml(link.resource_name || link.source_key || 'Workshop item')}</h4>
            <div class="small">Use mode: ${escapeHtml(modeLabel)} • Quantity: ${Number(link.quantity_used || 0) || 1}</div>
            ${link.resource_category ? `<div class="small">${escapeHtml(link.resource_category)}${link.resource_subcategory ? ` • ${escapeHtml(link.resource_subcategory)}` : ''}</div>` : ''}
            ${link.usage_notes ? `<div class="small">${escapeHtml(link.usage_notes)}</div>` : ''}
            ${inv ? `<div class="small">Inventory: on hand ${Number(inv.on_hand_quantity || 0)} ${escapeHtml(inv.stock_unit_label || 'unit')} • 1 ${escapeHtml(inv.stock_unit_label || 'unit')} = ${Number(inv.usage_units_per_stock_unit || 1)} ${escapeHtml(inv.usage_unit_label || 'unit')}</div><div class="small">Estimated materials from this item per finished product: ${escapeHtml(formatMoney(inv.estimated_cost_per_product_cents || 0, currentProduct?.currency || 'CAD'))}${Number(inv.buildable_products || 0) ? ` • buildable from stock ≈ ${Number(inv.buildable_products || 0)}` : ''}${lowStock ? ' • low stock' : ''}</div>` : ''}
          </div>
        </article>`;
    }).join('');
  }

  function renderPolicySupport(product, trustSummary, resourceLinks) {
    if (!productPolicySummaryEl || !productPolicyListEl) return;
    const requiresShipping = Number(product?.requires_shipping || 0) === 1;
    const inventoryQty = Number(product?.inventory_quantity || 0);
    const reviewCount = Number(trustSummary?.review_count || 0);
    const points = [];
    points.push(requiresShipping
      ? 'Shipping-required pieces show shipping status before checkout so buyers can compare physical items against no-shipping listings sooner.'
      : 'This listing is marked as a no-shipping or digital-style item so buyers do not have to wait until checkout to understand fulfillment style.');
    points.push(inventoryQty > 0
      ? `Current tracked stock shows ${inventoryQty} available right now, which helps set expectation before checkout.`
      : 'If stock is low or unavailable, buyers can use wishlist and back-in-stock tools instead of guessing.');
    points.push('Custom, personalized, or made-to-order timing should be confirmed before payment so one-off workshop projects are not mistaken for ready-to-ship stock.');
    if (String(product?.merchandise_origin || 'handmade').toLowerCase() !== 'handmade') points.push('Vintage, collectible, antique, or found items should be described with plain condition notes so wear, patina, or age are visible before purchase.');
    if (String(product?.sale_channel || 'onsite').toLowerCase() === 'external_only') points.push('This item is routed to an external listing instead of direct on-site checkout.');
    points.push('Questions about fit, finish, delivery, pickup, or workshop-specific details can be routed through Contact quickly if a listing needs clarification.');
    if (reviewCount > 0) points.push(`This item also has buyer feedback on the page, which gives shoppers another trust signal before they commit.`);
    if ((resourceLinks?.length || 0) > 0) points.push('The making-story section shows workshop context, tools, and supplies instead of presenting the product as a faceless catalog item.');
    productPolicySummaryEl.textContent = requiresShipping
      ? 'Key policy notes stay closer to the product so shipped pieces, custom timing, and support expectations are clearer before checkout.'
      : 'Key policy notes stay closer to the product so delivery style, custom timing, and support expectations are clearer before checkout.';
    productPolicyListEl.innerHTML = points.map((point) => `<li>${escapeHtml(point)}</li>`).join('');
  }

  function renderProcessLinks(product, resourceLinks) {
    if (!productProcessSummaryEl || !productProcessLinksEl) return;
    const hasStory = (resourceLinks?.length || 0) > 0;
    productProcessSummaryEl.textContent = hasStory
      ? 'This listing already includes workshop-story details. These links help shoppers move from a single product into the wider maker/process story.'
      : 'Not every listing has full process links yet, so these shortcuts help buyers see the broader workshop story, gallery, and maker pages.';
    const links = [
      { href: '/gallery/', label: 'Gallery & media' },
      { href: '/about/', label: 'About the workshop' },
      { href: '/creations/', label: 'Creations overview' },
      { href: '/events/', label: 'Events & markets' },
      { href: '/pickup/', label: 'Local pickup' },
      { href: '/contact/', label: 'Ask about custom timing' },
    ];
    productProcessLinksEl.innerHTML = links.map((link) => `<a class="btn" href="${link.href}">${escapeHtml(link.label)}</a>`).join('');
  }

  function renderMarketplaceSupport(product) {
    if (!productMarketplaceCardEl || !productMarketplaceSummaryEl || !productMarketplaceLinksEl) return;
    const origin = String(product?.merchandise_origin || 'handmade').trim().toLowerCase();
    const saleChannel = String(product?.sale_channel || 'onsite').trim().toLowerCase();
    const externalUrl = String(product?.external_listing_url || '').trim();
    const externalLabel = String(product?.external_listing_label || 'External listing').trim() || 'External listing';
    const notes = [];
    if (origin && origin !== 'handmade') notes.push(`This is listed as a ${origin} or pre-built item rather than a workshop-made piece.`);
    if (product?.era_label) notes.push(`Era / period: ${product.era_label}.`);
    if (product?.condition_summary) notes.push(`Condition: ${product.condition_summary}.`);
    if (product?.sourcing_notes) notes.push(product.sourcing_notes);
    if (saleChannel === 'external_only') notes.push('This item is currently being sold through an external listing channel instead of direct Devil n Dove checkout.');
    if (saleChannel === 'hybrid') notes.push('This item can stay visible on Devil n Dove while also linking out to an external marketplace listing.');
    if (!notes.length && !externalUrl) {
      hide(productMarketplaceCardEl);
      productMarketplaceLinksEl.innerHTML = '';
      productMarketplaceSummaryEl.textContent = '';
      return;
    }
    show(productMarketplaceCardEl);
    productMarketplaceSummaryEl.textContent = notes.join(' ');
    const links = [];
    if (externalUrl) links.push(`<a class="btn" href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(externalLabel)}</a>`);
    if (saleChannel !== 'external_only') links.push(`<a class="btn" href="/contact/">Ask about pickup / availability</a>`);
    links.push(`<a class="btn" href="/collections/">Collections guide</a>`);
    links.push(`<a class="btn" href="/pickup/">Local pickup</a>`);
    if (origin !== 'handmade' || saleChannel !== 'onsite') links.push(`<a class="btn" href="/marketplaces/">Marketplace guide</a>`);
    if (origin !== 'handmade' || saleChannel !== 'onsite') links.push(`<a class="btn" href="/events/">Events & markets</a>`);
    productMarketplaceLinksEl.innerHTML = links.join('');
  }

  function renderTrustSummary(product, trustSummary, images, resourceLinks) {
    currentTrustSummary = trustSummary || null;
    if (!productTrustListEl || !productTrustSummaryEl) return;
    const points = [];
    if ((trustSummary?.image_count || 0) > 1) points.push(`Multiple product photos are shown for this listing.`);
    else if ((trustSummary?.image_count || 0) === 1) points.push(`At least one real product photo is shown for this listing.`);
    if (resourceLinks?.length) points.push(`This item includes a maker-story block with the tools and supplies used.`);
    if (Number(product.inventory_tracking || 0) === 1) points.push(`Inventory is tracked for this product so stock status is clearer.`);
    if (Number(product.compare_at_price_cents || 0) > Number(product.price_cents || 0)) points.push(`A compare-at price is available for context.`);
    const origin = String(product?.merchandise_origin || 'handmade').toLowerCase();
    productTrustSummaryEl.textContent = `Product trust signals: ${(trustSummary?.image_count || 0)} image(s), ${resourceLinks?.length || 0} linked making-story item(s), and ${trustSummary?.in_stock ? 'current stock available' : 'stock can be followed with alerts'}${origin !== 'handmade' ? ' with provenance-style notes for a non-handmade item' : ''}.`;
    productTrustListEl.innerHTML = points.map((point) => `<li>${escapeHtml(point)}</li>`).join('');
  }

  function renderReviews(reviews, reviewSummary) {
    if (!productReviewsCardEl || !productReviewsSummaryEl || !productReviewsListEl) return;
    const rows = Array.isArray(reviews) ? reviews : [];
    if (!rows.length) {
      hide(productReviewsCardEl);
      productReviewsListEl.innerHTML = '';
      productReviewsSummaryEl.textContent = '';
      return;
    }
    show(productReviewsCardEl);
    productReviewsSummaryEl.textContent = `${Number(reviewSummary?.review_count || rows.length)} approved review(s) • average rating ${Number(reviewSummary?.average_rating || 0).toFixed(2)} / 5`;
    productReviewsListEl.innerHTML = rows.map((row) => `
      <article class="card" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
          <strong>${escapeHtml(row.reviewer_name || 'Devil n Dove customer')}</strong>
          <span class="small">${'★'.repeat(Math.max(1, Number(row.rating || 0)))}${Number(row.is_featured || 0) === 1 ? ' • Featured' : ''}</span>
        </div>
        <div class="small" style="margin-top:4px">${escapeHtml(row.review_kind || 'testimonial')} • ${escapeHtml(row.created_at || '')}</div>
        <div style="margin-top:8px">${escapeHtml(row.review_text || '')}</div>
      </article>`).join('');
  }

  function renderProduct(product, images, resourceLinks, resourceSummary, trustSummary, reviews, reviewSummary) {
    currentProduct = product || null;
    if (productTypeEl) {
      const badges = [product.product_type || ''];
      if (product.merchandise_origin) badges.push(product.merchandise_origin);
      if (product.sale_channel && product.sale_channel !== 'onsite') badges.push(product.sale_channel.replace('_', ' '));
      if (Array.isArray(product.color_names) && product.color_names.length) badges.push(`Colours: ${product.color_names.join(', ')}`);
      productTypeEl.textContent = badges.filter(Boolean).join(' • ');
    }
    if (productNameEl) productNameEl.textContent = product.name || "";
    if (pageH1El) pageH1El.textContent = product.h1_override || product.name || 'Product Details';
    if (pageIntroEl) pageIntroEl.textContent = product.meta_description || product.short_description || 'View the full details for this Devil n Dove item.';
    if (productPriceEl) productPriceEl.textContent = formatMoney(product.price_cents, product.currency);
    if (productShortDescriptionEl) productShortDescriptionEl.textContent = product.short_description || product.meta_description || "No short description available.";
    if (productKeywordTagsEl) productKeywordTagsEl.textContent = product.keywords ? `Keywords: ${product.keywords}` : '';
    if (productSkuEl) productSkuEl.textContent = product.sku || "—";
    if (productShippingEl) productShippingEl.textContent = yesNo(product.requires_shipping);
    if (productTaxClassEl) productTaxClassEl.textContent = product.tax_class_name || product.tax_class_code || "—";
    if (productInventoryEl) {
      const tracking = Number(product.inventory_tracking) === 1;
      const quantity = Number(product.inventory_quantity || 0);
      productInventoryEl.textContent = tracking ? String(quantity) : "Not tracked";
    }
    if (productDescriptionEl) {
      const description = String(product.description || "").trim();
      productDescriptionEl.innerHTML = description ? `<p>${escapeHtml(description).replaceAll("\n", "<br>")}</p>` : `<p class="small">No full description available.</p>`;
    }
    renderMainImage(product, images);
    renderGallery(images, product.name || "Product");
    renderResourceStory(resourceLinks, resourceSummary);
    renderReviews(reviews, reviewSummary);
    renderTrustSummary(product, trustSummary, images, resourceLinks);
    renderPolicySupport(product, trustSummary, resourceLinks);
    renderMarketplaceSupport(product);
    renderProcessLinks(product, resourceLinks);
    if (addToCartButton) {
      const externalOnly = String(product.sale_channel || 'onsite').toLowerCase() === 'external_only';
      addToCartButton.style.display = externalOnly ? 'none' : '';
    }
    if (productQuantityEl) {
      productQuantityEl.style.display = String(product.sale_channel || 'onsite').toLowerCase() === 'external_only' ? 'none' : '';
    }
    if (productInterestGuestWrap) productInterestGuestWrap.style.display = Number(product.inventory_quantity || 0) > 0 ? 'none' : 'block';
  }

  async function loadProduct() {
    hide(errorEl);
    hide(detailEl);
    show(loadingEl);
    try {
      const url = new URL(window.location.href);
      const slug = String(url.searchParams.get("slug") || "").trim();
      if (!slug) throw new Error("No product slug was provided.");
      const response = await fetch(`/api/product-detail?slug=${encodeURIComponent(slug)}`, { method: "GET" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to load product.");
      renderProduct(data.product || {}, data.images || [], data.resource_links || [], data.resource_summary || {}, data.trust_summary || {}, data.reviews || [], data.review_summary || {});
      document.title = `${data.product?.meta_title || data.product?.name || "Product"} — Devil n Dove`;
      const resolvedDescription = data.product?.meta_description || data.product?.short_description || 'View product details from Devil n Dove.';
      const resolvedCanonical = data.product?.canonical_url || window.location.href;
      const resolvedImage = (data.images || []).map((row) => row.image_url).find(Boolean) || data.product?.featured_image_url || 'https://devilndove.com/assets/logo-clear.png';
      const desc = document.querySelector('meta[name="description"]'); if (desc) desc.setAttribute('content', resolvedDescription);
      const canon = document.querySelector('link[rel="canonical"]'); if (canon) canon.setAttribute('href', resolvedCanonical);
      [['meta[property="og:title"]', document.title], ['meta[property="og:description"]', resolvedDescription], ['meta[property="og:url"]', resolvedCanonical], ['meta[property="og:image"]', resolvedImage], ['meta[name="twitter:title"]', document.title], ['meta[name="twitter:description"]', resolvedDescription], ['meta[name="twitter:image"]', resolvedImage]].forEach(([selector, value]) => {
        const el = document.querySelector(selector);
        if (el && value) el.setAttribute('content', value);
      });
      if (data.product) {
        const schema = {
          '@context': 'https://schema.org',
          '@type': data.product.schema_type || 'Product',
          name: data.product.name,
          description: data.product.meta_description || data.product.short_description || data.product.description || '',
          sku: data.product.sku || undefined,
          image: (data.images || []).map((row) => row.image_url).filter(Boolean),
          offers: { '@type': 'Offer', priceCurrency: data.product.currency || 'CAD', price: (Number(data.product.price_cents || 0) / 100).toFixed(2), availability: Number(data.product.inventory_quantity || 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: String(data.product.sale_channel || 'onsite').toLowerCase() === 'external_only' && data.product.external_listing_url ? data.product.external_listing_url : resolvedCanonical }
        };
        let script = document.getElementById('productStructuredData');
        if (!script) { script = document.createElement('script'); script.type = 'application/ld+json'; script.id = 'productStructuredData'; document.head.appendChild(script); }
        script.textContent = JSON.stringify(schema);
      }
      show(detailEl);
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message || 'Failed to load product.';
      show(errorEl);
    } finally {
      hide(loadingEl);
    }
  }

  async function saveWishlist() {
    if (!window.DDAuth?.isLoggedIn()) {
      setInterestMessage('Please log in to save wishlist items.', true);
      return;
    }
    if (!currentProduct?.product_id) return;
    try {
      const response = await window.DDAuth.apiFetch('/api/member/wishlist', { method: 'POST', body: JSON.stringify({ product_id: currentProduct.product_id }) });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to save wishlist item.');
      setInterestMessage(data.message || 'Saved to wishlist.');
    } catch (error) {
      setInterestMessage(error.message || 'Failed to save wishlist item.', true);
    }
  }

  async function requestBackInStock() {
    if (!currentProduct?.product_id) return;
    const email = String(productInterestEmail?.value || '').trim();
    if (!window.DDAuth?.isLoggedIn() && !email) {
      setInterestMessage('Please enter an email address for stock alerts.', true);
      return;
    }
    try {
      const response = await window.DDAuth.apiFetch('/api/product-interest', { method: 'POST', body: JSON.stringify({ product_id: currentProduct.product_id, request_type: 'back_in_stock', email }) });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to save stock alert.');
      setInterestMessage(data.message || 'Back-in-stock request saved.');
    } catch (error) {
      setInterestMessage(error.message || 'Failed to save stock alert.', true);
    }
  }

  if (addToCartButton) {
    addToCartButton.addEventListener("click", () => {
      clearCartMessage();
      if (!window.DDCart) return setCartMessage("Cart is not available right now.", true);
      if (!currentProduct || !currentProduct.product_id) return setCartMessage("Product is not ready to add to cart.", true);
      if (String(currentProduct.sale_channel || 'onsite').toLowerCase() === 'external_only') {
        return setCartMessage('This item currently routes to an external listing instead of on-site checkout.', true);
      }
      const quantity = Number(productQuantityEl?.value || 1);
      if (!Number.isInteger(quantity) || quantity <= 0) return setCartMessage("Please enter a valid quantity.", true);
      try {
        window.DDCart.addToCart(currentProduct, quantity);
        setCartMessage("Added to cart successfully.");
        if (productQuantityEl) productQuantityEl.value = "1";
      } catch (error) {
        setCartMessage(error.message || "Failed to add item to cart.", true);
      }
    });
  }
  productWishlistButton?.addEventListener('click', saveWishlist);
  productBackInStockButton?.addEventListener('click', requestBackInStock);

  await loadProduct();
});
