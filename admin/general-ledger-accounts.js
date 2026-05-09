import { getAdminUserFromRequest, getDb, jsonResponse, auditAdminAction, normalizeText } from "../_lib/adminAudit.js";

function normResults(result){ return Array.isArray(result?.results) ? result.results : []; }
function cleanCategory(value){ const v=normalizeText(value).toLowerCase(); return ["income","expense","asset","liability","equity"].includes(v) ? v : "expense"; }

async function ensureTable(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS general_ledger_accounts (
    gl_account_id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'expense',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function onRequestGet(context){
  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) return jsonResponse({ ok:false, error:"Admin access required." }, 401);
  const db = getDb(context.env); if(!db) return jsonResponse({ok:false,error:"Database binding is not configured."},500);
  await ensureTable(db);
  const result = await db.prepare(`SELECT gl_account_id, code, name, category, is_active, created_at, updated_at FROM general_ledger_accounts ORDER BY category ASC, code ASC`).all();
  return jsonResponse({ ok:true, accounts:normResults(result) });
}

export async function onRequestPost(context){
  const adminUser = await getAdminUserFromRequest(context.request, context.env);
  if (!adminUser) return jsonResponse({ ok:false, error:"Admin access required." }, 401);
  const db = getDb(context.env); if(!db) return jsonResponse({ok:false,error:"Database binding is not configured."},500);
  await ensureTable(db);
  let body={}; try{ body=await context.request.json(); }catch{}
  const code = normalizeText(body.code).toUpperCase();
  const name = normalizeText(body.name);
  const category = cleanCategory(body.category);
  if(!code || !name) return jsonResponse({ok:false,error:"Code and name are required."},400);
  await db.prepare(`INSERT INTO general_ledger_accounts (code,name,category,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(code) DO UPDATE SET name=excluded.name, category=excluded.category, updated_at=CURRENT_TIMESTAMP`).bind(code,name,category).run();
  await auditAdminAction(context.env, context.request, adminUser, { action_type:"save_gl_account", target_type:"general_ledger_account", target_key:code, details:{ name, category } });
  return jsonResponse({ ok:true });
}