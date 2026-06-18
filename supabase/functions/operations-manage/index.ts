import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function clean(value: unknown, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function money(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function parseAmount(row: Record<string, unknown>) {
  const raw = row.amount ?? row.Amount ?? row.debit ?? row.Debit ?? row.credit ?? row.Credit ?? 0;
  return money(String(raw).replace(/[$,]/g, ''));
}

function validateBankRows(rows: Record<string, unknown>[] = []) {
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const dateText = clean(row.date ?? row.Date ?? row.transaction_date ?? row['Transaction Date'], 40);
    const description = clean(row.description ?? row.Description ?? row.memo ?? row.Memo, 500);
    const reference = clean(row.reference ?? row.Reference ?? row.id ?? row.ID, 160);
    const amount = parseAmount(row);
    const key = `${dateText}|${description.toLowerCase()}|${amount}|${reference}`;
    const reasons: string[] = [];
    if (!dateText) reasons.push('Missing transaction date.');
    if (!description) reasons.push('Missing description.');
    if (!amount) reasons.push('Missing or zero amount.');
    const duplicate = seen.has(key);
    if (duplicate) reasons.push('Possible duplicate row.');
    seen.add(key);
    return { row, index: index + 1, dateText, description, reference, amount, duplicate, status: reasons.length ? 'rejected' : 'accepted', reasons };
  });
}

async function getActor(supabase: any, req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return { user: null, profile: null };
  const { data } = await supabase.auth.getUser(token);
  const user = data?.user || null;
  if (!user?.id) return { user: null, profile: null };
  const { data: profile } = await supabase.from('profiles').select('id, role, full_name, email').eq('user_id', user.id).maybeSingle();
  return { user, profile };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return Response.json({ ok: false, error: 'Use POST.' }, { status: 405, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SB_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceKey) throw new Error('operations-manage is not configured.');
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const action = clean(body.action, 80);
    const { profile } = await getActor(supabase, req);
    const actorProfileId = profile?.id || null;

    if (action === 'payment_action_request') {
      const row = {
        action_type: clean(body.action_type || 'apply_payment', 80),
        action_status: clean(body.action_status || 'draft', 80),
        customer_or_vendor_name: clean(body.customer_or_vendor_name, 180) || null,
        invoice_reference: clean(body.invoice_reference, 160) || null,
        payment_reference: clean(body.payment_reference, 160) || null,
        amount: money(body.amount),
        currency_code: clean(body.currency_code || 'CAD', 8) || 'CAD',
        reason: clean(body.reason, 1000) || null,
        proof_required: body.proof_required !== false,
        proof_reference: clean(body.proof_reference, 240) || null,
        requested_by_profile_id: actorProfileId,
        rollback_hint: 'Use reversal request before period close if posted in error.',
        metadata: { build: '2026-06-14b', schema: 148, source: 'operations-manage' }
      };
      const { data, error } = await supabase.from('payment_action_requests').insert(row).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'bank_csv_preview') {
      const rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : [];
      const validated = validateBankRows(rows as Record<string, unknown>[]);
      const accepted = validated.filter((r) => r.status === 'accepted').length;
      const rejected = validated.length - accepted;
      const duplicates = validated.filter((r) => r.duplicate).length;
      const { data: batch, error: batchError } = await supabase.from('bank_csv_import_previews').insert({
        original_filename: clean(body.original_filename, 260) || null,
        bank_account_hint: clean(body.bank_account_hint, 180) || null,
        header_json: Array.isArray(body.headers) ? body.headers : [],
        total_rows: validated.length,
        accepted_rows: accepted,
        rejected_rows: rejected,
        duplicate_rows: duplicates,
        validation_summary: { accepted, rejected, duplicates },
        created_by_profile_id: actorProfileId,
        metadata: { build: '2026-06-14b', schema: 148, source: 'operations-manage' }
      }).select('*').single();
      if (batchError) throw batchError;
      if (validated.length) {
        const insertRows = validated.map((item) => ({
          import_id: batch.id,
          row_number: item.index,
          row_status: item.status,
          transaction_date: /^\d{4}-\d{2}-\d{2}$/.test(item.dateText) ? item.dateText : null,
          description: item.description || null,
          amount: item.amount,
          reference: item.reference || null,
          duplicate_key: item.duplicate ? `${item.dateText}|${item.description}|${item.amount}|${item.reference}` : null,
          rejection_reason: item.reasons.join('; ') || null,
          raw_row: item.row
        }));
        const { error: rowError } = await supabase.from('bank_csv_import_preview_rows').insert(insertRows);
        if (rowError) throw rowError;
      }
      return Response.json({ ok: true, batch, summary: { accepted, rejected, duplicates } }, { headers: corsHeaders });
    }

    if (action === 'reconciliation_action') {
      const { data, error } = await supabase.from('reconciliation_action_requests').insert({
        action_type: clean(body.action_type || 'match', 80),
        action_status: clean(body.action_status || 'draft', 80),
        import_id: clean(body.import_id, 80) || null,
        bank_row_id: clean(body.bank_row_id, 80) || null,
        target_reference: clean(body.target_reference, 240) || null,
        split_json: Array.isArray(body.split_rows) ? body.split_rows : [],
        signoff_note: clean(body.signoff_note, 1000) || null,
        undo_of_action_id: clean(body.undo_of_action_id, 80) || null,
        requested_by_profile_id: actorProfileId,
        metadata: { build: '2026-06-14b', schema: 148, source: 'operations-manage' }
      }).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'equipment_scan_event') {
      const { data: scan, error: scanError } = await supabase.from('equipment_scan_events').insert({
        scan_code: clean(body.scan_code || body.equipment_reference, 180) || 'manual',
        scan_source: clean(body.scan_source || 'manual', 80),
        scan_stage: clean(body.scan_stage || 'field_check', 80),
        scan_status: clean(body.scan_status || 'captured', 80),
        equipment_reference: clean(body.equipment_reference, 180) || null,
        job_reference: clean(body.job_reference, 180) || null,
        actor_profile_id: actorProfileId,
        location_hint: clean(body.location_hint, 240) || null,
        notes: clean(body.notes, 1000) || null,
        metadata: { build: '2026-06-14b', schema: 148, source: 'operations-manage' }
      }).select('*').single();
      if (scanError) throw scanError;
      const { data: custody, error: custodyError } = await supabase.from('equipment_custody_timeline_events').insert({
        equipment_reference: clean(body.equipment_reference || body.scan_code, 180) || 'unknown',
        custody_stage: clean(body.custody_stage || body.scan_stage || 'field_check', 80),
        custody_status: clean(body.custody_status || 'captured', 80),
        job_reference: clean(body.job_reference, 180) || null,
        condition_summary: clean(body.condition_summary, 500) || null,
        accessory_summary: clean(body.accessory_summary, 500) || null,
        signer_name: clean(body.signer_name, 180) || null,
        actor_profile_id: actorProfileId,
        scan_event_id: scan.id,
        service_required: !!body.service_required,
        cost_recovery_required: !!body.cost_recovery_required,
        notes: clean(body.notes, 1000) || null,
        metadata: { build: '2026-06-14b', schema: 148, source: 'operations-manage' }
      }).select('*').single();
      if (custodyError) throw custodyError;
      return Response.json({ ok: true, scan, custody }, { headers: corsHeaders });
    }

    if (action === 'visual_asset_register') {
      const { data, error } = await supabase.from('visual_asset_approval_items').insert({
        asset_status: clean(body.asset_status || 'draft', 80),
        surface_area: clean(body.surface_area || 'public', 120),
        image_role: clean(body.image_role || 'placeholder_replacement', 120),
        source_url: clean(body.source_url, 600) || null,
        alt_text: clean(body.alt_text, 280) || null,
        consent_status: clean(body.consent_status || 'not_required', 80),
        compression_status: clean(body.compression_status || 'pending', 80),
        route_key: clean(body.route_key, 120) || null,
        notes: clean(body.notes, 1000) || null,
        metadata: { build: '2026-06-14b', schema: 148, source: 'operations-manage' }
      }).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'public_route_register') {
      const routeKey = clean(body.route_key, 120) || clean(body.route_path, 120).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
      const { data, error } = await supabase.from('public_route_approval_items').upsert({
        route_key: routeKey || `route_${Date.now()}`,
        route_status: clean(body.route_status || 'draft', 80),
        route_path: clean(body.route_path || '/', 240),
        page_title: clean(body.page_title, 180) || 'Page title required',
        h1_text: clean(body.h1_text, 180) || 'Main heading required',
        meta_description: clean(body.meta_description, 320) || null,
        local_proof_hint: clean(body.local_proof_hint, 1000) || null,
        primary_cta_path: clean(body.primary_cta_path, 240) || null,
        visual_asset_key: clean(body.visual_asset_key, 160) || null,
        sitemap_ready: !!body.sitemap_ready,
        metadata: { build: '2026-06-14b', schema: 148, source: 'operations-manage' }
      }, { onConflict: 'route_key' }).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'offline_conflict_card') {
      const { data, error } = await supabase.from('mobile_offline_conflict_cards').insert({
        entity_type: clean(body.entity_type || 'draft', 120),
        entity_reference: clean(body.entity_reference, 180) || null,
        conflict_status: clean(body.conflict_status || 'open', 80),
        local_payload: body.local_payload && typeof body.local_payload === 'object' ? body.local_payload : {},
        server_payload: body.server_payload && typeof body.server_payload === 'object' ? body.server_payload : {},
        recommended_action: clean(body.recommended_action || 'review', 80),
        metadata: { build: '2026-06-14b', schema: 148, source: 'operations-manage' }
      }).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    if (action === 'scorecard_update') {
      const railKey = clean(body.rail_key, 120);
      if (!railKey) return Response.json({ ok: false, error: 'rail_key is required.' }, { status: 400, headers: corsHeaders });
      const { data, error } = await supabase.from('admin_scorecard_progress_rails').upsert({
        rail_key: railKey,
        rail_area: clean(body.rail_area || 'admin', 120),
        rail_title: clean(body.rail_title || 'Progress rail', 180),
        rail_status: clean(body.rail_status || 'active', 80),
        progress_percent: Math.max(0, Math.min(100, Number(body.progress_percent || 0))),
        current_value: body.current_value === undefined ? null : money(body.current_value),
        target_value: body.target_value === undefined ? null : money(body.target_value),
        next_action_hint: clean(body.next_action_hint, 1000) || null,
        owner_hint: clean(body.owner_hint, 180) || null,
        sort_order: Number(body.sort_order || 100),
        metadata: { build: '2026-06-14b', schema: 148, source: 'operations-manage' },
        updated_at: new Date().toISOString()
      }, { onConflict: 'rail_key' }).select('*').single();
      if (error) throw error;
      return Response.json({ ok: true, record: data }, { headers: corsHeaders });
    }

    return Response.json({ ok: false, error: `Unsupported operations-manage action: ${action}` }, { status: 400, headers: corsHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'operations-manage failed.' }, { status: 500, headers: corsHeaders });
  }
});
