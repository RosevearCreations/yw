// File: /functions/api/admin/_costing.js
function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

export async function tableExists(db, tableName) {
  try {
    const row = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1`).bind(tableName).first();
    return !!row;
  } catch {
    return false;
  }
}

async function getTableColumnSet(db, tableName) {
  try {
    const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
    return new Set(normalizeResults(result).map((row) => String(row?.name || '').trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function cents(value) {
  return Number(value || 0);
}

function dollarsToCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function safeDivide(numerator, denominator) {
  const bottom = Number(denominator || 0);
  return bottom > 0 ? numerator / bottom : 0;
}

function buildAllocationMap(totalCents, rows, weightFn) {
  const allocations = new Map();
  const amount = Math.max(0, Math.round(Number(totalCents || 0)));
  if (!amount || !Array.isArray(rows) || !rows.length) return allocations;

  const weighted = rows
    .map((row, index) => {
      const productId = Number(row.product_id || 0);
      const rawWeight = Number(weightFn(row) || 0);
      return {
        productId,
        index,
        weight: Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 0,
      };
    })
    .filter((row) => row.productId > 0);

  if (!weighted.length) return allocations;

  const totalWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
  const effectiveWeighted = totalWeight > 0 ? weighted : weighted.map((row) => ({ ...row, weight: 1 }));
  const effectiveTotalWeight = effectiveWeighted.reduce((sum, row) => sum + row.weight, 0);

  let allocated = 0;
  const provisional = effectiveWeighted.map((row) => {
    const exact = safeDivide(amount * row.weight, effectiveTotalWeight);
    const base = Math.floor(exact);
    allocated += base;
    return { ...row, exact, base, fraction: exact - base };
  });

  let remainder = amount - allocated;
  provisional
    .sort((a, b) => (b.fraction - a.fraction) || (a.index - b.index) || (a.productId - b.productId))
    .forEach((row) => {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      allocations.set(row.productId, row.base + extra);
    });

  return allocations;
}

function chooseAllocationRows(rows) {
  const activeRows = rows.filter((row) => String(row.status || '').toLowerCase() === 'active');
  if (activeRows.length) return activeRows;
  const pricedRows = rows.filter((row) => cents(row.price_cents) > 0);
  if (pricedRows.length) return pricedRows;
  return rows;
}

function describeWeighting(basis, candidateRows) {
  const normalized = String(basis || 'manual').trim().toLowerCase();
  if (normalized === 'orders') {
    const hasSales = candidateRows.some((row) => cents(row.sold_order_count_in_period) > 0);
    return {
      applied_basis: 'orders',
      weighting_mode: hasSales ? 'order-count-share' : 'equal-sku-fallback',
      weightFn: (row) => hasSales ? cents(row.sold_order_count_in_period) : 1,
    };
  }
  if (normalized === 'units') {
    const hasUnits = candidateRows.some((row) => cents(row.sold_quantity_in_period) > 0);
    return {
      applied_basis: 'units',
      weighting_mode: hasUnits ? 'sold-units-share' : 'equal-sku-fallback',
      weightFn: (row) => hasUnits ? cents(row.sold_quantity_in_period) : 1,
    };
  }
  if (normalized === 'revenue') {
    return {
      applied_basis: 'revenue',
      weighting_mode: 'price-share',
      weightFn: (row) => Math.max(1, cents(row.price_cents)),
    };
  }
  return {
    applied_basis: 'manual',
    weighting_mode: 'manual-price-share',
    weightFn: (row) => Math.max(1, cents(row.price_cents)),
  };
}

function coalesceSql(expressions, fallback = '0') {
  const usable = expressions.filter(Boolean);
  if (!usable.length) return fallback;
  if (usable.length === 1) return usable[0];
  return `COALESCE(${usable.join(', ')})`;
}

export async function computeMonthlyItemCosting(db, range) {
  const hasProducts = await tableExists(db, 'products');
  if (!hasProducts) {
    return {
      period: range.raw,
      items: [],
      summary: {
        active_product_count: 0,
        draft_product_count: 0,
        priced_product_count: 0,
        total_allocated_overhead_cents: 0,
        average_allocated_overhead_cents: 0,
        average_full_unit_cost_cents: 0,
        negative_margin_count: 0,
        missing_cost_link_count: 0,
        uncosted_product_count: 0,
        rough_costed_margin_cents_total: 0,
        sold_quantity_in_period: 0,
        sold_order_count_in_period: 0,
        products_sold_in_period: 0,
        estimated_recognized_base_cogs_cents: 0,
        estimated_recognized_overhead_cogs_cents: 0,
        estimated_recognized_full_cogs_cents: 0,
        overhead_pools: [],
      },
    };
  }

  const hasProductCosts = await tableExists(db, 'product_costs');
  const hasResourceLinks = await tableExists(db, 'product_resource_links');
  const hasInventory = await tableExists(db, 'site_item_inventory');
  const hasOverhead = await tableExists(db, 'accounting_overhead_allocations');
  const hasOrders = await tableExists(db, 'orders');
  const hasOrderItems = await tableExists(db, 'order_items');

  const productCostColumns = hasProductCosts ? await getTableColumnSet(db, 'product_costs') : new Set();
  const resourceColumnSet = hasResourceLinks ? await getTableColumnSet(db, 'product_resource_links') : new Set();
  const inventoryColumnSet = hasInventory ? await getTableColumnSet(db, 'site_item_inventory') : new Set();
  const orderColumns = hasOrders ? await getTableColumnSet(db, 'orders') : new Set();
  const orderItemColumns = hasOrderItems ? await getTableColumnSet(db, 'order_items') : new Set();

  const hasConsumptionMode = resourceColumnSet.has('consumption_mode');
  const hasLotSizeUnits = resourceColumnSet.has('lot_size_units');

  const usageUnitsExpr = inventoryColumnSet.size
    ? coalesceSql([
        inventoryColumnSet.has('usage_units_per_stock_unit') ? `NULLIF(sii.usage_units_per_stock_unit,0)` : ''
      ], '1')
    : '1';

  const inventoryUnitCostExpr = inventoryColumnSet.size
    ? coalesceSql([
        inventoryColumnSet.has('unit_cost_cents') ? 'sii.unit_cost_cents' : '',
        inventoryColumnSet.has('cost_cents') ? 'sii.cost_cents' : '',
        inventoryColumnSet.has('unit_cost') ? 'ROUND(COALESCE(sii.unit_cost,0) * 100)' : ''
      ], '0')
    : '0';

  const directCostExpr = productCostColumns.has('cost_per_unit')
    ? 'COALESCE(pc.cost_per_unit,0)'
    : productCostColumns.has('cost_per_unit_cents')
      ? '(COALESCE(pc.cost_per_unit_cents,0) / 100.0)'
      : '0';

  const productCostOrderExpr = coalesceSql([
    productCostColumns.has('effective_date') ? 'pc2.effective_date' : '',
    productCostColumns.has('created_at') ? 'pc2.created_at' : '',
  ], `'1970-01-01'`);

  const directCostDateExpr = productCostColumns.size
    ? coalesceSql([
        productCostColumns.has('effective_date') ? 'pc.effective_date' : '',
        productCostColumns.has('created_at') ? 'pc.created_at' : ''
      ], `''`)
    : `''`;

  const productCostIdCol = productCostColumns.has('product_cost_id') ? 'product_cost_id' : 'rowid';
  const productCostJoin = hasProductCosts && productCostColumns.has('product_number')
    ? `
      LEFT JOIN product_costs pc ON pc.${productCostIdCol} = (
        SELECT pc2.${productCostIdCol}
        FROM product_costs pc2
        WHERE CAST(pc2.product_number AS TEXT) = CAST(p.product_number AS TEXT)
        ORDER BY ${productCostOrderExpr} DESC, pc2.${productCostIdCol} DESC
        LIMIT 1
      )
    `
    : '';

  const resourceJoin = hasResourceLinks && hasInventory
    ? `
      LEFT JOIN (
        SELECT
          prl.product_id,
          COUNT(*) AS linked_resource_count,
          SUM(
            CASE
              WHEN sii.site_item_inventory_id IS NULL THEN 0
              WHEN ${hasConsumptionMode ? `COALESCE(prl.consumption_mode,'per_unit')` : `'per_unit'`} = 'story_only' THEN 0
              WHEN ${hasConsumptionMode ? `COALESCE(prl.consumption_mode,'per_unit')` : `'per_unit'`} = 'end_of_lot'
                THEN COALESCE(prl.quantity_used,0) * (${inventoryUnitCostExpr}) / (${usageUnitsExpr}) / COALESCE(NULLIF(${hasLotSizeUnits ? 'prl.lot_size_units' : '1'},0),1)
              ELSE COALESCE(prl.quantity_used,0) * (${inventoryUnitCostExpr}) / (${usageUnitsExpr})
            END
          ) AS linked_resource_cost_cents,
          SUM(CASE WHEN sii.site_item_inventory_id IS NULL OR COALESCE((${inventoryUnitCostExpr}),0) <= 0 THEN 1 ELSE 0 END) AS missing_cost_links
        FROM product_resource_links prl
        LEFT JOIN site_item_inventory sii
          ON sii.source_type = prl.resource_kind AND sii.external_key = prl.source_key
        GROUP BY prl.product_id
      ) resource_rollup ON resource_rollup.product_id = p.product_id
    `
    : '';

  const orderCreatedExpr = coalesceSql([
    orderColumns.has('created_at') ? 'o.created_at' : '',
    orderItemColumns.has('created_at') ? 'oi.created_at' : ''
  ], `datetime('now')`);

  const qtyExpr = orderItemColumns.has('quantity') ? 'COALESCE(oi.quantity,0)' : '0';
  const unitPriceExpr = orderItemColumns.has('unit_price_cents') ? 'COALESCE(oi.unit_price_cents,0)' : '0';
  const subtotalExpr = orderItemColumns.has('line_subtotal_cents')
    ? 'COALESCE(oi.line_subtotal_cents, COALESCE(oi.quantity,0) * COALESCE(oi.unit_price_cents,0))'
    : `(${qtyExpr} * ${unitPriceExpr})`;
  const paymentStatusExpr = orderColumns.has('payment_status') ? `LOWER(COALESCE(o.payment_status,''))` : `''`;
  const orderStatusExpr = orderColumns.has('order_status') ? `LOWER(COALESCE(o.order_status,''))` : `''`;

  const salesBindings =
    hasOrders &&
    hasOrderItems &&
    orderItemColumns.has('product_id') &&
    orderItemColumns.has('order_id')
      ? [range.start, range.end]
      : [];

  const salesJoin = salesBindings.length
    ? `
      LEFT JOIN (
        SELECT
          oi.product_id,
          COALESCE(SUM(${qtyExpr}),0) AS sold_quantity_in_period,
          COUNT(DISTINCT oi.order_id) AS sold_order_count_in_period,
          COALESCE(SUM(${subtotalExpr}),0) AS sold_revenue_cents_in_period
        FROM order_items oi
        INNER JOIN orders o ON o.order_id = oi.order_id
        WHERE substr(COALESCE(${orderCreatedExpr}),1,10) >= ?
          AND substr(COALESCE(${orderCreatedExpr}),1,10) < ?
          AND (
            ${paymentStatusExpr} IN ('paid','completed','captured','partially_refunded','refunded')
            OR ${orderStatusExpr} IN ('paid','fulfilled','refunded')
          )
        GROUP BY oi.product_id
      ) sales_rollup ON sales_rollup.product_id = p.product_id
    `
    : '';

  const rows = normalizeResults(await db.prepare(`
    SELECT
      p.product_id,
      p.product_number,
      p.name,
      p.slug,
      p.status,
      p.review_status,
      p.currency,
      COALESCE(p.price_cents,0) AS price_cents,
      ${productCostJoin ? directCostExpr : '0'} AS direct_unit_cost,
      ${resourceJoin ? 'COALESCE(resource_rollup.linked_resource_cost_cents,0)' : '0'} AS linked_resource_cost_cents,
      ${resourceJoin ? 'COALESCE(resource_rollup.linked_resource_count,0)' : '0'} AS linked_resource_count,
      ${resourceJoin ? 'COALESCE(resource_rollup.missing_cost_links,0)' : '0'} AS missing_cost_links,
      ${productCostJoin ? directCostDateExpr : `''`} AS direct_cost_effective_date,
      ${salesJoin ? 'COALESCE(sales_rollup.sold_quantity_in_period,0)' : '0'} AS sold_quantity_in_period,
      ${salesJoin ? 'COALESCE(sales_rollup.sold_order_count_in_period,0)' : '0'} AS sold_order_count_in_period,
      ${salesJoin ? 'COALESCE(sales_rollup.sold_revenue_cents_in_period,0)' : '0'} AS sold_revenue_cents_in_period
    FROM products p
    ${productCostJoin}
    ${resourceJoin}
    ${salesJoin}
    ORDER BY CASE WHEN LOWER(COALESCE(p.status,'draft'))='active' THEN 0 ELSE 1 END, LOWER(COALESCE(p.name,'')) ASC
  `).bind(...salesBindings).all().catch(() => ({ results: [] })));

  const overheadPools = hasOverhead ? normalizeResults(await db.prepare(`
    SELECT ledger_code, allocation_basis, COALESCE(SUM(COALESCE(amount_cents,0)),0) AS amount_cents
    FROM accounting_overhead_allocations
    WHERE period_month = ?
    GROUP BY ledger_code, allocation_basis
    ORDER BY ledger_code ASC, allocation_basis ASC
  `).bind(range.raw).all().catch(() => ({ results: [] }))) : [];

  const hasProductOverheadOverrides = await tableExists(db, 'accounting_overhead_product_allocations');
  const productOverheadOverrides = hasProductOverheadOverrides ? normalizeResults(await db.prepare(`
    SELECT period_month, ledger_code, product_id, amount_cents, notes
    FROM accounting_overhead_product_allocations
    WHERE period_month = ?
  `).bind(range.raw).all().catch(() => ({ results: [] }))) : [];

  const candidateRows = chooseAllocationRows(rows);
  const allocationDetailsByProduct = new Map();
  const overheadPoolSummaries = [];

  for (const poolRow of overheadPools) {
    const poolAmount = Math.max(0, cents(poolRow.amount_cents));
    if (!poolAmount) continue;

    const ledgerCode = String(poolRow.ledger_code || '').trim().toUpperCase();
    const explicitOverrides = productOverheadOverrides.filter((row) => String(row.ledger_code || '').trim().toUpperCase() === ledgerCode);
    const reservedOverrideCents = explicitOverrides.reduce((sum, row) => sum + Math.max(0, cents(row.amount_cents)), 0);

    for (const overrideRow of explicitOverrides) {
      const productId = Number(overrideRow.product_id || 0);
      if (!productId) continue;
      const product = rows.find((entry) => Number(entry.product_id || 0) === productId) || null;
      const soldUnits = Math.max(0, cents(product?.sold_quantity_in_period));
      const divisorUnits = soldUnits > 0 ? soldUnits : 1;
      const current = allocationDetailsByProduct.get(productId) || [];
      const overrideAmount = Math.max(0, cents(overrideRow.amount_cents));
      current.push({
        allocation_basis: 'product_override',
        weighting_mode: ledgerCode ? `explicit-${ledgerCode.toLowerCase()}` : 'explicit-product-override',
        allocated_pool_cents: overrideAmount,
        allocated_per_unit_cents: Math.round(overrideAmount / divisorUnits),
        divisor_units: divisorUnits,
        ledger_code: ledgerCode,
        notes: overrideRow.notes || '',
      });
      allocationDetailsByProduct.set(productId, current);
    }

    const distributableAmount = Math.max(0, poolAmount - reservedOverrideCents);
    const overriddenProductIds = new Set(explicitOverrides.map((row) => Number(row.product_id || 0)).filter((id) => id > 0));
    const allocationRows = candidateRows.filter((row) => !overriddenProductIds.has(Number(row.product_id || 0)));
    const weightMeta = describeWeighting(poolRow.allocation_basis, allocationRows);
    const poolAllocations = buildAllocationMap(distributableAmount, allocationRows, weightMeta.weightFn);

    for (const row of allocationRows) {
      const productId = Number(row.product_id || 0);
      if (!productId) continue;
      const productPoolShare = cents(poolAllocations.get(productId));
      if (!productPoolShare) continue;
      const soldUnits = Math.max(0, cents(row.sold_quantity_in_period));
      const divisorUnits = soldUnits > 0 ? soldUnits : 1;
      const current = allocationDetailsByProduct.get(productId) || [];
      current.push({
        allocation_basis: weightMeta.applied_basis,
        weighting_mode: weightMeta.weighting_mode,
        allocated_pool_cents: productPoolShare,
        allocated_per_unit_cents: Math.round(productPoolShare / divisorUnits),
        divisor_units: divisorUnits,
        ledger_code: ledgerCode,
      });
      allocationDetailsByProduct.set(productId, current);
    }

    overheadPoolSummaries.push({
      ledger_code: ledgerCode,
      allocation_basis: weightMeta.applied_basis,
      weighting_mode: weightMeta.weighting_mode,
      amount_cents: poolAmount,
      reserved_override_cents: reservedOverrideCents,
      distributed_pool_cents: distributableAmount,
      explicit_override_count: explicitOverrides.length,
      product_count: allocationRows.length,
    });
  }

  const items = rows.map((row) => {
    const direct = hasProductCosts ? dollarsToCents(row.direct_unit_cost) : 0;
    const resource = hasResourceLinks && hasInventory ? cents(row.linked_resource_cost_cents) : 0;
    const baseUnitCost = direct + resource;
    const allocationDetails = allocationDetailsByProduct.get(Number(row.product_id || 0)) || [];
    const allocatedOverheadPool = allocationDetails.reduce((sum, detail) => sum + cents(detail.allocated_pool_cents), 0);
    const allocatedOverheadPerUnit = allocationDetails.reduce((sum, detail) => sum + cents(detail.allocated_per_unit_cents), 0);
    const fullUnitCost = baseUnitCost + allocatedOverheadPerUnit;
    const basisSummary = allocationDetails.map((detail) => `${detail.allocation_basis}:${detail.weighting_mode}`).join(' • ') || 'none';

    return {
      product_id: Number(row.product_id || 0),
      product_number: Number(row.product_number || 0),
      name: row.name || '',
      slug: row.slug || '',
      status: row.status || 'draft',
      review_status: row.review_status || '',
      currency: row.currency || 'CAD',
      price_cents: cents(row.price_cents),
      direct_unit_cost_cents: direct,
      linked_resource_cost_cents: resource,
      base_unit_cost_cents: baseUnitCost,
      allocated_overhead_cents: allocatedOverheadPerUnit,
      allocated_overhead_pool_cents: allocatedOverheadPool,
      estimated_full_unit_cost_cents: fullUnitCost,
      rough_unit_margin_cents: cents(row.price_cents) - fullUnitCost,
      linked_resource_count: cents(row.linked_resource_count),
      missing_cost_links: cents(row.missing_cost_links),
      direct_cost_effective_date: row.direct_cost_effective_date || '',
      sold_quantity_in_period: cents(row.sold_quantity_in_period),
      sold_order_count_in_period: cents(row.sold_order_count_in_period),
      sold_revenue_cents_in_period: cents(row.sold_revenue_cents_in_period),
      allocation_basis: basisSummary,
      allocation_details: allocationDetails,
    };
  });

  const totalOverhead = overheadPoolSummaries.reduce((sum, row) => sum + cents(row.amount_cents), 0);
  const soldQuantityTotal = items.reduce((sum, row) => sum + cents(row.sold_quantity_in_period), 0);
  const soldOrderTotal = items.reduce((sum, row) => sum + cents(row.sold_order_count_in_period), 0);
  const recognizedBaseCogs = items.reduce((sum, row) => sum + cents(row.base_unit_cost_cents) * cents(row.sold_quantity_in_period), 0);
  const recognizedOverheadCogs = items.reduce((sum, row) => sum + cents(row.allocated_overhead_cents) * cents(row.sold_quantity_in_period), 0);

  return {
    period: range.raw,
    items,
    summary: {
      active_product_count: rows.filter((row) => String(row.status || '').toLowerCase() === 'active').length,
      draft_product_count: rows.filter((row) => String(row.status || '').toLowerCase() === 'draft').length,
      priced_product_count: rows.filter((row) => cents(row.price_cents) > 0).length,
      total_allocated_overhead_cents: totalOverhead,
      average_allocated_overhead_cents: items.length ? Math.round(items.reduce((sum, row) => sum + cents(row.allocated_overhead_cents), 0) / items.length) : 0,
      average_full_unit_cost_cents: items.length ? Math.round(items.reduce((sum, row) => sum + cents(row.estimated_full_unit_cost_cents), 0) / items.length) : 0,
      negative_margin_count: items.filter((row) => cents(row.rough_unit_margin_cents) < 0).length,
      missing_cost_link_count: items.filter((row) => cents(row.missing_cost_links) > 0).length,
      uncosted_product_count: items.filter((row) => cents(row.base_unit_cost_cents) <= 0).length,
      rough_costed_margin_cents_total: items.reduce((sum, row) => sum + cents(row.rough_unit_margin_cents), 0),
      sold_quantity_in_period: soldQuantityTotal,
      sold_order_count_in_period: soldOrderTotal,
      products_sold_in_period: items.filter((row) => cents(row.sold_quantity_in_period) > 0).length,
      estimated_recognized_base_cogs_cents: recognizedBaseCogs,
      estimated_recognized_overhead_cogs_cents: recognizedOverheadCogs,
      estimated_recognized_full_cogs_cents: recognizedBaseCogs + recognizedOverheadCogs,
      overhead_pools: overheadPoolSummaries,
      explicit_product_overrides_count: productOverheadOverrides.length,
    },
  };
}
