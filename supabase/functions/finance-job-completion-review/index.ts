import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { effectiveModuleAccess, hasModuleAccess } from "../_shared/module-permissions.ts";

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
  "candidate_status", "posting_authorized", "provider_mutation", "post", "posted",
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
    const [{ data: queue, error: queueError }, { data: status, error: statusError }] = await Promise.all([
      supabase.from("v_finance_job_completion_review_queue").select("*").limit(100),
      supabase.from("v_finance_job_completion_review_status").select("*").limit(1),
    ]);
    if (queueError || statusError) {
      return reply({ ok: false, error: queueError?.message || statusError?.message || "Finance completion review queue could not load." }, 500);
    }
    return reply({
      ok: true,
      scope: "finance_job_completion_review",
      actor_profile_id: actorId,
      access_level: await effectiveModuleAccess(supabase, actorProfile, "finance"),
      can_create: await hasModuleAccess(supabase, actorProfile, "finance", "create"),
      can_approve: await hasModuleAccess(supabase, actorProfile, "finance", "approve"),
      can_manage: await hasModuleAccess(supabase, actorProfile, "finance", "manage"),
      queue: queue || [],
      status: status?.[0] || {},
      boundary: {
        human_disposition_required: true,
        canonical_amounts_only: true,
        draft_candidates_only: true,
        posting_authorized: false,
        provider_mutation: false,
      },
    });
  }

  const canApprove = await hasModuleAccess(supabase, actorProfile, "finance", "approve");
  if (!canApprove) return reply({ ok: false, error: "Finance approve access is required." }, 403);

  const forbidden = forbiddenFields(body);
  if (forbidden.length) {
    return reply({
      ok: false,
      error: `Financial truth fields are server-owned for this workflow: ${forbidden.join(", ")}.`,
      code: "SERVER_OWNED_FINANCIAL_FIELDS",
    }, 400);
  }

  const intakeId = cleanText(body.intake_id, 80);
  if (!intakeId) return reply({ ok: false, error: "intake_id is required." }, 400);

  if (action === "dispose") {
    const disposition = cleanText(body.disposition, 20).toLowerCase();
    const reason = cleanText(body.reason, 2000);
    if (!['approved','rejected'].includes(disposition)) {
      return reply({ ok: false, error: "disposition must be approved or rejected." }, 400);
    }
    if (reason.length < 3) return reply({ ok: false, error: "A Finance disposition reason is required." }, 400);

    const { data, error } = await supabase.rpc("ywi_finance_dispose_job_completion_review", {
      p_intake_id: intakeId,
      p_disposition: disposition,
      p_reason: reason,
      p_actor_profile_id: actorId,
    });
    if (error) return reply({ ok: false, error: error.message || "Finance disposition failed." }, 400);
    return reply({ ok: true, action: "dispose", result: data?.[0] || null });
  }

  if (action === "generate_candidates") {
    const { data, error } = await supabase.rpc("ywi_finance_generate_job_completion_candidates", {
      p_intake_id: intakeId,
      p_actor_profile_id: actorId,
    });
    if (error) return reply({ ok: false, error: error.message || "Finance candidate generation failed." }, 400);
    return reply({
      ok: true,
      action: "generate_candidates",
      result: data?.[0] || null,
      boundary: { candidate_status: "draft", posting_authorized: false, provider_mutation: false },
    });
  }

  return reply({ ok: false, error: "Unsupported Finance completion-review action." }, 400);
});
