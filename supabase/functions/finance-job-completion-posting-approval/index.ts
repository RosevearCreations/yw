import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasModuleAccess } from "../_shared/module-permissions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

const forbiddenFinancialFields = new Set([
  "subtotal", "tax_total", "total_amount", "amount", "ledger_summary",
  "debit", "credit", "debit_account_id", "credit_account_id", "gl_account_id",
  "candidate_status", "posting_status", "posting_authorized", "execution_status",
  "ar_invoice_id", "gl_batch_id", "journal_entry_number", "batch_number",
  "posting_approval_id", "execution_run_id", "reversal_id", "reversal_gl_batch_id",
  "provider_mutation", "post", "posted", "void", "reverse",
  "stripe", "stripe_payment_intent_id", "paypal", "paypal_order_id", "payment_status",
]);

function forbiddenFields(body: Record<string, unknown>) {
  return Object.keys(body).filter((key) => forbiddenFinancialFields.has(key.toLowerCase()));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ ok: false, error: "POST required." }, 405);

  const url = Deno.env.get("SB_URL") || Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SB_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return reply({ ok: false, error: "Server Supabase configuration is missing." }, 503);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = String(req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply({ ok: false, error: "Unauthorized." }, 401);

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user?.id) return reply({ ok: false, error: "Unauthorized." }, 401);

  const actorId = userData.user.id;
  const { data: actorProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,is_active,full_name,email")
    .eq("id", actorId)
    .maybeSingle();
  if (profileError || !actorProfile || actorProfile.is_active === false) {
    return reply({ ok: false, error: "Active Finance profile is required." }, 403);
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = cleanText(body.action || "list", 40).toLowerCase();

  const canView = await hasModuleAccess(supabase, actorProfile, "finance", "view");
  if (!canView) return reply({ ok: false, error: "Finance module view access is required." }, 403);

  if (action === "list") {
    const [
      approvalQueueResult,
      preflightQueueResult,
      executionQueueResult,
      lifecycleResult,
      operationalSummaryResult,
      reconciliationResult,
      safetyResult,
      preflightStatusResult,
      executionStatusResult,
    ] = await Promise.all([
      supabase.from("v_finance_job_completion_posting_approval_queue").select("intake_id").limit(100),
      supabase.from("v_finance_job_completion_posting_preflight_queue").select("*").limit(100),
      supabase.from("v_finance_job_completion_posting_execution_queue").select("*").limit(100),
      supabase.from("v_finance_job_completion_operational_lifecycle").select("*").order("queued_at", { ascending: false }).limit(100),
      supabase.from("v_finance_job_completion_operational_summary").select("*").limit(1),
      supabase.from("v_finance_job_completion_reconciliation_issues").select("*").limit(100),
      supabase.from("v_it_finance_posting_safety_status").select("*").limit(1),
      supabase.from("v_it_finance_posting_preflight_status").select("*").limit(1),
      supabase.from("v_it_finance_posting_execution_status").select("*").limit(1),
    ]);
    const loadError = approvalQueueResult.error || preflightQueueResult.error || executionQueueResult.error
      || lifecycleResult.error || operationalSummaryResult.error || reconciliationResult.error
      || safetyResult.error || preflightStatusResult.error || executionStatusResult.error;
    if (loadError) {
      return reply({ ok: false, error: loadError.message || "Finance operational control plane could not load." }, 500);
    }
    return reply({
      ok: true,
      scope: "finance_job_completion_operational_control_plane",
      actor_profile_id: actorId,
      can_approve: await hasModuleAccess(supabase, actorProfile, "finance", "approve"),
      can_manage: await hasModuleAccess(supabase, actorProfile, "finance", "manage"),
      queue: executionQueueResult.data || [],
      preflight_queue: preflightQueueResult.data || [],
      approval_queue_count: approvalQueueResult.data?.length || 0,
      operational_lifecycle: lifecycleResult.data || [],
      operational_summary: operationalSummaryResult.data?.[0] || {},
      reconciliation_issues: reconciliationResult.data || [],
      safety: safetyResult.data?.[0] || {},
      preflight: preflightStatusResult.data?.[0] || {},
      execution: executionStatusResult.data?.[0] || {},
      boundary: {
        separate_posting_approval_required: true,
        approval_queue_authority_retained: true,
        idempotency_server_owned: true,
        immutable_provenance: true,
        accountant_mapping_approval_required: true,
        posting_execution_authorized: false,
        provider_mutation: false,
        execution_release_server_owned: true,
        reversal_manage_only: true,
        operational_control_plane_read_only: true,
      },
    });
  }

  if (action === "preflight") {
    const intakeId = cleanText(body.intake_id, 80);
    if (!intakeId) return reply({ ok: false, error: "intake_id is required." }, 400);
    const forbidden = forbiddenFields(body);
    if (forbidden.length) {
      return reply({ ok: false, error: `Financial execution fields are server-owned for preflight: ${forbidden.join(", ")}.`, code: "SERVER_OWNED_POSTING_FIELDS" }, 400);
    }
    const { data, error } = await supabase.rpc("ywi_finance_job_completion_posting_preflight", { p_intake_id: intakeId });
    if (error) return reply({ ok: false, error: error.message || "Finance posting preflight failed." }, 400);
    return reply({
      ok: true,
      action: "preflight",
      result: data?.[0] || null,
      boundary: {
        read_only: true,
        posting_execution_authorized: false,
        provider_mutation: false,
      },
    });
  }

  const forbidden = forbiddenFields(body);
  if (forbidden.length) {
    return reply({
      ok: false,
      error: `Financial execution fields are server-owned for this workflow: ${forbidden.join(", ")}.`,
      code: "SERVER_OWNED_POSTING_FIELDS",
    }, 400);
  }

  if (action === "approve_posting") {
    const canApprove = await hasModuleAccess(supabase, actorProfile, "finance", "approve");
    if (!canApprove) return reply({ ok: false, error: "Finance approve access is required." }, 403);
    const intakeId = cleanText(body.intake_id, 80);
    const reason = cleanText(body.reason, 2000);
    if (!intakeId) return reply({ ok: false, error: "intake_id is required." }, 400);
    if (reason.length < 3) return reply({ ok: false, error: "A Finance posting-approval reason is required." }, 400);

    const { data, error } = await supabase.rpc("ywi_finance_approve_job_completion_posting", {
      p_intake_id: intakeId,
      p_reason: reason,
      p_actor_profile_id: actorId,
    });
    if (error) return reply({ ok: false, error: error.message || "Finance posting approval failed." }, 400);

    return reply({
      ok: true,
      action: "approve_posting",
      result: data?.[0] || null,
      boundary: {
        posting_approved: true,
        posting_execution_authorized: false,
        provider_mutation: false,
      },
    });
  }

  if (action === "execute_posting") {
    const canApprove = await hasModuleAccess(supabase, actorProfile, "finance", "approve");
    if (!canApprove) return reply({ ok: false, error: "Finance approve access is required for controlled posting execution." }, 403);
    const intakeId = cleanText(body.intake_id, 80);
    const reason = cleanText(body.reason, 2000);
    if (!intakeId) return reply({ ok: false, error: "intake_id is required." }, 400);
    if (reason.length < 3) return reply({ ok: false, error: "A Finance posting-execution reason is required." }, 400);

    const { data, error } = await supabase.rpc("ywi_finance_execute_job_completion_posting", {
      p_intake_id: intakeId,
      p_reason: reason,
      p_actor_profile_id: actorId,
    });
    if (error) return reply({ ok: false, error: error.message || "Controlled Finance posting execution failed." }, 400);

    return reply({
      ok: true,
      action: "execute_posting",
      result: data?.[0] || null,
      boundary: {
        execution_release_server_owned: true,
        posting_execution_authorized: false,
        browser_cannot_enable_execution: true,
        provider_mutation: false,
      },
    });
  }

  if (action === "reverse_posting") {
    const canManage = await hasModuleAccess(supabase, actorProfile, "finance", "manage");
    if (!canManage) return reply({ ok: false, error: "Finance manage access is required for posting reversal." }, 403);
    const intakeId = cleanText(body.intake_id, 80);
    const reason = cleanText(body.reason, 2000);
    if (!intakeId) return reply({ ok: false, error: "intake_id is required." }, 400);
    if (reason.length < 3) return reply({ ok: false, error: "A reversal/void reason is required." }, 400);

    const { data, error } = await supabase.rpc("ywi_finance_reverse_job_completion_posting", {
      p_intake_id: intakeId,
      p_reason: reason,
      p_actor_profile_id: actorId,
    });
    if (error) return reply({ ok: false, error: error.message || "Finance posting reversal failed." }, 400);

    return reply({
      ok: true,
      action: "reverse_posting",
      result: data?.[0] || null,
      boundary: {
        manage_authority_required: true,
        original_gl_history_preserved: true,
        provider_mutation: false,
      },
    });
  }

  return reply({ ok: false, error: "Unsupported Finance posting approval/preflight/execution/recovery action." }, 400);
});
