// File: /functions/api/admin/accounting-summary.js
// Brief description: Returns the current lightweight accounting shadow records
// and summary totals so admin can review revenue/tax/order amounts before
// a fuller accounting backend is added. It now degrades more safely so phone
// and admin dashboards can still render partial fallback data when a query drifts.

import { captureRuntimeIncident, getAdminUserFromRequest, jsonResponse } from "../_lib/adminAudit.js";
import { ensureAccountingSchema, getDb } from "../_lib/accounting.js";

function normalizeResults(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function emptyResponse(adminUser, warnings = []) {
  return {
    ok: true,
    requested_by: { user_id: adminUser.user_id, email: adminUser.email, display_name: adminUser.display_name },
    warnings,
    summary: {
      records_count: 0,
      total_booked_cents: 0,
      total_paid_cents: 0,
      total_outstanding_cents: 0,
      total_tax_cents: 0,
      open_records_count: 0
    },
    records: []
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = getDb(env);
  const adminUser = await getAdminUserFromRequest(request, env);
  if (!adminUser) return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401);
  if (!db) return jsonResponse({ ok: false, error: 'Database binding is not configured.' }, 500);

  const warnings = [];

  try {
    await ensureAccountingSchema(db);
  } catch (error) {
    warnings.push('accounting_schema_guard_failed');
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_accounting',
      incident_code: 'accounting_summary_schema_guard_failed',
      severity: 'warning',
      message: 'Accounting summary could not confirm schema state. Returning safe empty fallback.',
      related_user_id: adminUser.user_id,
      details: { error: error?.message || 'Unknown schema error.' }
    });
    return jsonResponse(emptyResponse(adminUser, warnings));
  }

  let summaryRow = null;
  try {
    summaryRow = await db.prepare(`
      SELECT
        COUNT(*) AS records_count,
        COALESCE(SUM(total_cents),0) AS total_booked_cents,
        COALESCE(SUM(amount_paid_cents),0) AS total_paid_cents,
        COALESCE(SUM(amount_outstanding_cents),0) AS total_outstanding_cents,
        COALESCE(SUM(tax_liability_cents),0) AS total_tax_cents,
        SUM(CASE WHEN entry_status IN ('open','partially_paid') THEN 1 ELSE 0 END) AS open_records_count
      FROM accounting_order_records
    `).first();
  } catch (error) {
    warnings.push('accounting_summary_query_failed');
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_accounting',
      incident_code: 'accounting_summary_query_failed',
      severity: 'warning',
      message: 'Accounting summary totals query failed. Returning safe empty fallback.',
      related_user_id: adminUser.user_id,
      details: { error: error?.message || 'Unknown summary query error.' }
    });
    return jsonResponse(emptyResponse(adminUser, warnings));
  }

  let recent = [];
  try {
    recent = normalizeResults(await db.prepare(`
      SELECT
        accounting_order_record_id,
        order_id,
        order_number,
        entry_status,
        customer_name,
        customer_email,
        currency,
        total_cents,
        amount_paid_cents,
        amount_outstanding_cents,
        tax_liability_cents,
        source_order_status,
        source_payment_status,
        created_at,
        updated_at
      FROM accounting_order_records
      ORDER BY created_at DESC, accounting_order_record_id DESC
      LIMIT 25
    `).all());
  } catch (error) {
    warnings.push('accounting_recent_records_query_failed');
    await captureRuntimeIncident(env, request, {
      incident_scope: 'admin_accounting',
      incident_code: 'accounting_recent_records_query_failed',
      severity: 'warning',
      message: 'Accounting summary recent-record query failed. Returning totals without records.',
      related_user_id: adminUser.user_id,
      details: { error: error?.message || 'Unknown recent query error.' }
    });
  }

  return jsonResponse({
    ok: true,
    requested_by: { user_id: adminUser.user_id, email: adminUser.email, display_name: adminUser.display_name },
    warnings,
    summary: {
      records_count: Number(summaryRow?.records_count || 0),
      total_booked_cents: Number(summaryRow?.total_booked_cents || 0),
      total_paid_cents: Number(summaryRow?.total_paid_cents || 0),
      total_outstanding_cents: Number(summaryRow?.total_outstanding_cents || 0),
      total_tax_cents: Number(summaryRow?.total_tax_cents || 0),
      open_records_count: Number(summaryRow?.open_records_count || 0)
    },
    records: recent.map((row) => ({
      accounting_order_record_id: Number(row.accounting_order_record_id || 0),
      order_id: Number(row.order_id || 0),
      order_number: row.order_number || '',
      entry_status: row.entry_status || 'open',
      customer_name: row.customer_name || '',
      customer_email: row.customer_email || '',
      currency: row.currency || 'CAD',
      total_cents: Number(row.total_cents || 0),
      amount_paid_cents: Number(row.amount_paid_cents || 0),
      amount_outstanding_cents: Number(row.amount_outstanding_cents || 0),
      tax_liability_cents: Number(row.tax_liability_cents || 0),
      source_order_status: row.source_order_status || '',
      source_payment_status: row.source_payment_status || '',
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    }))
  });
}
