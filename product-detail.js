// File: /functions/api/product-detail.js
// Brief description: Returns one active storefront product with images, SEO fields,
// linked making-story resources, and stock/trust summaries for the product detail page.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function getTableColumnSet(db, tableName) {
  try {
    const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    return new Set(rows.map((row) => String(row?.name || '').trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB || env.DD_DB;
  const url = new URL(request.url);
  const slug = String(url.searchParams.get('slug') || '').trim().toLowerCase();

  if (!slug) return json({ ok: false, error: 'A valid slug is required.' }, 400);
  if (!db) return json({ ok: false, error: 'Database binding is not configured.' }, 500);

  const product = await db.prepare(`
    SELECT
      p.product_id, p.slug, p.sku, p.name, p.short_description, p.description, p.product_type, p.status,
      p.price_cents, p.compare_at_price_cents, p.currency, p.taxable, p.tax_class_id, p.requires_shipping,
      p.weight_grams, p.inventory_tracking, COALESCE(p.inventory_quantity, p.on_hand_quantity, 0) AS inventory_quantity,
      p.digital_file_url, p.featured_image_url, p.sort_order, p.created_at, p.updated_at,
      tc.code AS tax_class_code, tc.name AS tax_class_name, COALESCE(tc.rate_percent, tc.tax_rate, 0) AS tax_rate,
      ps.meta_title, ps.meta_description, ps.keywords, ps.h1_override, ps.canonical_url, ps.schema_type,
      ps.og_title, ps.og_description, ps.og_image_url
    FROM products p
    LEFT JOIN tax_classes tc ON p.tax_class_id = tc.tax_class_id
    LEFT JOIN product_seo ps ON ps.product_id = p.product_id
    WHERE p.slug = ? AND p.status = 'active'
    LIMIT 1
  `).bind(slug).first();

  if (!product) return json({ ok: false, error: 'Product not found.' }, 404);

  const resourceLinkColumns = await getTableColumnSet(db, 'product_resource_links');
  const inventoryColumns = await getTableColumnSet(db, 'site_item_inventory');
  const hasConsumptionMode = resourceLinkColumns.has('consumption_mode');
  const hasLotSizeUnits = resourceLinkColumns.has('lot_size_units');
  const usageUnitsExpr = inventoryColumns.has('usage_units_per_stock_unit') ? `COALESCE(NULLIF(sii.usage_units_per_stock_unit,0),1)` : `1`;
  const usageUnitLabelExpr = inventoryColumns.has('usage_unit_label') ? `COALESCE(NULLIF(sii.usage_unit_label,''),'unit')` : `'unit'`;
  const stockUnitLabelExpr = inventoryColumns.has('stock_unit_label') ? `COALESCE(NULLIF(sii.stock_unit_label,''),'unit')` : `'unit'`;
  const unitCostExpr = inventoryColumns.has('unit_cost_cents') ? `COALESCE(sii.unit_cost_cents,0)` : (inventoryColumns.has('cost_cents') ? `COALESCE(sii.cost_cents,0)` : `0`);

  const images = normalizeResults(await db.prepare(`
    SELECT pi.product_image_id, pi.product_id, pi.image_url,
           COALESCE(pia.alt_text, pi.alt_text, p.name) AS alt_text,
           pi.sort_order, pi.created_at,
           pia.image_title, pia.caption, pia.focal_point_x, pia.focal_point_y, pia.annotation_notes,
           ma.variant_role
    FROM product_images pi
    LEFT JOIN product_image_annotations pia ON pia.product_image_id = pi.product_image_id
    LEFT JOIN products p ON p.product_id = pi.product_id
    LEFT JOIN media_assets ma ON ma.product_id = pi.product_id AND ma.public_url = pi.image_url AND ma.deleted_at IS NULL
    WHERE pi.product_id = ?
    ORDER BY pi.sort_order ASC, pi.product_image_id ASC
    LIMIT 20
  `).bind(product.product_id).all());

  const image_annotations = normalizeResults(await db.prepare(`
    SELECT product_image_annotation_id, product_id, product_image_id, image_url, alt_text, image_title, caption,
           focal_point_x, focal_point_y, annotation_notes, updated_at
    FROM product_image_annotations
    WHERE product_id = ?
    ORDER BY product_image_annotation_id ASC
  `).bind(product.product_id).all());

  const resource_links = normalizeResults(await db.prepare(`
    SELECT prl.product_resource_link_id, prl.product_id, prl.resource_kind, prl.source_key, prl.quantity_used,
           prl.usage_notes, prl.sort_order,
           ${hasConsumptionMode ? `COALESCE(prl.consumption_mode,'per_unit')` : `'per_unit'`} AS consumption_mode,
           ${hasLotSizeUnits ? `COALESCE(prl.lot_size_units,1)` : `1`} AS lot_size_units,
           ci.name AS resource_name, ci.image_url AS resource_image_url, ci.category AS resource_category,
           ci.subcategory AS resource_subcategory, ci.short_description AS resource_short_description,
           sii.site_item_inventory_id, sii.on_hand_quantity, sii.reserved_quantity, sii.incoming_quantity,
           sii.reorder_level, sii.is_on_reorder_list, sii.do_not_reorder, sii.do_not_reuse, sii.reuse_status,
           ${usageUnitLabelExpr} AS usage_unit_label,
           ${stockUnitLabelExpr} AS stock_unit_label,
           ${usageUnitsExpr} AS usage_units_per_stock_unit,
           ${unitCostExpr} AS unit_cost_cents
    FROM product_resource_links prl
    LEFT JOIN catalog_items ci ON ci.item_kind = prl.resource_kind AND ci.source_key = prl.source_key
    LEFT JOIN site_item_inventory sii ON sii.source_type = prl.resource_kind AND sii.external_key = prl.source_key
    WHERE prl.product_id = ?
    ORDER BY prl.sort_order ASC, prl.product_resource_link_id ASC
  `).bind(product.product_id).all()).map((row) => {
    const usageUnitsPerStockUnit = Math.max(1, Number(row.usage_units_per_stock_unit || 1) || 1);
    const onHand = Number(row.on_hand_quantity || 0);
    const reserved = Number(row.reserved_quantity || 0);
    const incoming = Number(row.incoming_quantity || 0);
    const quantityUsed = Math.max(0, Number(row.quantity_used || 0));
    const lotSizeUnits = Math.max(1, Number(row.lot_size_units || 1) || 1);
    const mode = String(row.consumption_mode || 'per_unit').toLowerCase();
    const totalUsageUnits = onHand * usageUnitsPerStockUnit;
    const estimatedCostPerProductCents = mode === 'story_only'
      ? 0
      : mode === 'end_of_lot'
        ? Math.round(Number(row.unit_cost_cents || 0) / lotSizeUnits)
        : Math.round((Number(row.unit_cost_cents || 0) / usageUnitsPerStockUnit) * Math.max(1, quantityUsed || 1));
    const buildableProducts = mode === 'story_only'
      ? 0
      : mode === 'end_of_lot'
        ? Math.floor(onHand * lotSizeUnits)
        : (quantityUsed > 0 ? Math.floor(totalUsageUnits / quantityUsed) : 0);
    return {
      product_resource_link_id: Number(row.product_resource_link_id || 0),
      product_id: Number(row.product_id || 0),
      resource_kind: row.resource_kind || '',
      source_key: row.source_key || '',
      quantity_used: quantityUsed,
      usage_notes: row.usage_notes || '',
      sort_order: Number(row.sort_order || 0),
      consumption_mode: mode,
      lot_size_units: lotSizeUnits,
      resource_name: row.resource_name || row.source_key || '',
      resource_image_url: row.resource_image_url || '',
      resource_category: row.resource_category || '',
      resource_subcategory: row.resource_subcategory || '',
      resource_short_description: row.resource_short_description || '',
      inventory: row.site_item_inventory_id ? {
        site_item_inventory_id: Number(row.site_item_inventory_id || 0),
        on_hand_quantity: onHand,
        reserved_quantity: reserved,
        incoming_quantity: incoming,
        reorder_level: Number(row.reorder_level || 0),
        is_on_reorder_list: Number(row.is_on_reorder_list || 0),
        do_not_reorder: Number(row.do_not_reorder || 0),
        do_not_reuse: Number(row.do_not_reuse || 0),
        reuse_status: row.reuse_status || '',
        usage_unit_label: row.usage_unit_label || 'unit',
        stock_unit_label: row.stock_unit_label || 'unit',
        usage_units_per_stock_unit: usageUnitsPerStockUnit,
        unit_cost_cents: Number(row.unit_cost_cents || 0),
        total_usage_units_available: totalUsageUnits,
        estimated_cost_per_product_cents: estimatedCostPerProductCents,
        buildable_products: buildableProducts
      } : null
    };
  });

  const resource_summary = {
    total_linked_items: resource_links.length,
    linked_tools: resource_links.filter((row) => row.resource_kind === 'tool').length,
    linked_supplies: resource_links.filter((row) => row.resource_kind === 'supply').length,
    low_stock_items: resource_links.filter((row) => row.inventory && ((Number(row.inventory.on_hand_quantity || 0) - Number(row.inventory.reserved_quantity || 0) + Number(row.inventory.incoming_quantity || 0)) <= Number(row.inventory.reorder_level || 0))).length,
    estimated_cost_per_product_cents: resource_links.reduce((sum, row) => sum + Number(row.inventory?.estimated_cost_per_product_cents || 0), 0)
  };

  const storefront_images = images.map((row) => {
    const imageUrl = row.image_url || '';
    return {
      product_image_id: Number(row.product_image_id || 0),
      image_url: imageUrl,
      alt_text: row.alt_text || product.name || '',
      image_title: row.image_title || '',
      caption: row.caption || '',
      variant_role: row.variant_role || '',
      annotation_notes: row.annotation_notes || '',
      sort_order: Number(row.sort_order || 0),
      variant_urls: imageUrl ? {
        original: imageUrl,
        thumb: imageUrl,
        medium: imageUrl,
        large: imageUrl,
        webp: imageUrl
      } : null
    };
  });

  const image_groups = {
    featured: storefront_images.find((row) => row.image_url === product.featured_image_url) || storefront_images[0] || null,
    detail: storefront_images.filter((row) => ['detail', 'hero', 'featured'].includes(String(row.variant_role || '').toLowerCase())),
    gallery: storefront_images.filter((row) => !['detail', 'hero', 'featured'].includes(String(row.variant_role || '').toLowerCase())),
    annotated: storefront_images.filter((row) => row.caption || row.annotation_notes || row.image_title)
  };

  const build_summary = {
    buildable_units_from_resources: resource_links.length
      ? resource_links.reduce((minUnits, row) => {
          const possibleUnits = row.inventory?.buildable_products;
          if (possibleUnits == null || possibleUnits < 0) return minUnits;
          return minUnits == null ? possibleUnits : Math.min(minUnits, possibleUnits);
        }, null)
      : null,
    resource_shortage_links: resource_links.filter((row) => row.inventory && Number(row.inventory.buildable_products || 0) < 1 && row.consumption_mode !== 'story_only').length
  };

  const trust_summary = {
    has_multiple_images: storefront_images.length > 1,
    has_maker_story: resource_links.length > 0,
    can_request_back_in_stock: Number(product.inventory_tracking || 0) === 1,
    in_stock: Number(product.inventory_quantity || 0) > 0,
    image_count: storefront_images.length
  };

  let reviews = [];
  let review_summary = { review_count: 0, average_rating: 0 };
  try {
    const reviewsTable = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='product_reviews' LIMIT 1`).first();
    if (reviewsTable) {
      const reviewRows = normalizeResults(await db.prepare(`
        SELECT product_review_id, product_id, reviewer_name, rating, review_text, review_kind, is_featured, created_at
        FROM product_reviews
        WHERE status = 'approved' AND product_id = ?
        ORDER BY is_featured DESC, created_at DESC, product_review_id DESC
        LIMIT 12
      `).bind(product.product_id).all());
      reviews = reviewRows.map((row) => ({
        product_review_id: Number(row.product_review_id || 0),
        product_id: Number(row.product_id || 0),
        reviewer_name: row.reviewer_name || 'Devil n Dove customer',
        rating: Number(row.rating || 0),
        review_text: row.review_text || '',
        review_kind: row.review_kind || 'testimonial',
        is_featured: Number(row.is_featured || 0),
        created_at: row.created_at || null
      }));
      review_summary = {
        review_count: reviews.length,
        average_rating: reviews.length ? Number((reviews.reduce((sum, row) => sum + Number(row.rating || 0), 0) / reviews.length).toFixed(2)) : 0
      };
    }
  } catch {}

  return json({ ok: true, product, images, image_annotations, storefront_images, image_groups, resource_links, resource_summary, build_summary, trust_summary, reviews, review_summary });
}
