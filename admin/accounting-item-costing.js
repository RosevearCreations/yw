// File: /functions/api/admin/accounting-item-costing.js
import { getAdminUserFromRequest, getDb, jsonResponse } from '../_lib/adminAudit.js';
import { computeMonthlyItemCosting } from './_costing.js';

function monthRange(monthValue) {
  const raw = String(monthValue || '').trim();
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return null;
  const start = `${match[1]}-${match[2]}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`;
  return { raw, start, end };
}

export async function onRequestGet(context) {
  const db = getDb(context.env);
  if (!db) return jsonResponse({ ok: false, error: 'Database binding is not configured.' }, 500);

  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) return jsonResponse({ ok: false, error: 'Admin access required.' }, 401);

  const url = new URL(context.request.url);
  const range = monthRange(url.searchParams.get('month') || new Date().toISOString().slice(0, 7));
  if (!range) return jsonResponse({ ok: false, error: 'Please provide month in YYYY-MM format.' }, 400);

  try {
    const report = await computeMonthlyItemCosting(db, range);
    return jsonResponse({ ok: true, ...report });
  } catch (error) {
    return jsonResponse({ ok: false, error: error?.message || 'Failed to build monthly item costing.' }, 500);
  }
}
