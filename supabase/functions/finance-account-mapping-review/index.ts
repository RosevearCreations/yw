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

const allowedMappingKeys = new Set(["accounts_receivable", "service_revenue", "sales_tax_payable"]);
const allowedReviewStatuses = new Set(["review", "approved", "rejected"]);
const forbiddenFields = new Set([
  "is_active", "is_required", "mapping_type", "source_key", "target_label", "reporting_group",
  "execution_enabled", "execution_release_enabled", "provider_mutation", "provider_mutation_enabled",
  "posting_authorized", "execution_status", "posting_status", "job_id", "work_order_id",
  "subtotal", "tax_total", "total_amount", "amount", "stripe", "paypal", "payment_status",
]);

function rejectedFields(body: Record<string, unknown>) {
  return Object.keys(body).filter((key) => forbiddenFields.has(key.toLowerCase()));
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

  const canView = await hasModuleAccess(supabase, actorProfile, "finance", "view");
  if (!canView) return reply({ ok: false, error: "Finance module view access is required." }, 403);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = cleanText(body.action || "list", 40).toLowerCase();
  const accessLevel = await effectiveModuleAccess(supabase, actorProfile, "finance");
  const canManage = await hasModuleAccess(supabase, actorProfile, "finance", "manage");

  if (action === "list") {
    const [mappingResult, statusResult, observabilityResult, observabilityStatusResult] = await Promise.all([
      supabase.from("v_finance_account_mapping_review_directory").select("*").order("mapping_key"),
      supabase.from("v_it_finance_account_mapping_review_status").select("*").limit(1),
      supabase.from("v_finance_account_mapping_observability").select("*").order("mapping_key"),
      supabase.from("v_it_finance_account_mapping_observability_status").select("*").limit(1),
    ]);
    if (mappingResult.error || statusResult.error || observabilityResult.error || observabilityStatusResult.error) {
      return reply({
        ok: false,
        error: mappingResult.error?.message || statusResult.error?.message || observabilityResult.error?.message
          || observabilityStatusResult.error?.message || "Finance mapping readiness could not load.",
      }, 500);
    }

    let accounts: unknown[] = [];
    if (canManage) {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id,account_number,account_name,account_type,system_code,normal_balance,is_control_account")
        .eq("is_active", true)
        .order("account_number")
        .limit(500);
      if (error) return reply({ ok: false, error: error.message || "Active chart accounts could not load." }, 500);
      accounts = data || [];
    }

    return reply({
      ok: true,
      scope: "finance_account_mapping_review",
      actor_profile_id: actorId,
      access_level: accessLevel,
      can_manage: canManage,
      mappings: mappingResult.data || [],
      readiness: statusResult.data?.[0] || {},
      observability: observabilityResult.data || [],
      observability_readiness: observabilityStatusResult.data?.[0] || {},
      accounts,
      boundary: {
        human_accounting_decision_required: true,
        migration_auto_approval: false,
        posting_execution_authorized: false,
        provider_mutation: false,
        jobs_writeback: false,
      },
    });
  }

  if (action !== "review_mapping") return reply({ ok: false, error: "Unsupported Finance mapping-review action." }, 400);
  if (!canManage) return reply({ ok: false, error: "Finance manage access is required for accountant mapping review." }, 403);

  const forbidden = rejectedFields(body);
  if (forbidden.length) {
    return reply({ ok: false, error: `Server-owned or out-of-scope fields are not accepted: ${forbidden.join(", ")}.`, code: "SERVER_OWNED_MAPPING_FIELDS" }, 400);
  }

  const mappingKey = cleanText(body.mapping_key, 80).toLowerCase();
  const reviewStatus = cleanText(body.review_status, 20).toLowerCase();
  const accountId = cleanText(body.account_id, 80) || null;
  const reason = cleanText(body.reason, 2000);

  if (!allowedMappingKeys.has(mappingKey)) return reply({ ok: false, error: "Unsupported Finance posting mapping key." }, 400);
  if (!allowedReviewStatuses.has(reviewStatus)) return reply({ ok: false, error: "review_status must be review, approved, or rejected." }, 400);
  if (reason.length < 5) return reply({ ok: false, error: "A mapping review reason of at least 5 characters is required." }, 400);
  if (accountId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId)) {
    return reply({ ok: false, error: "account_id must be a valid UUID when supplied." }, 400);
  }

  const { data, error } = await supabase.rpc("ywi_finance_review_account_mapping", {
    p_mapping_key: mappingKey,
    p_account_id: accountId,
    p_review_status: reviewStatus,
    p_reason: reason,
    p_actor_profile_id: actorId,
  });
  if (error) return reply({ ok: false, error: error.message || "Finance mapping review failed." }, 400);

  return reply({
    ok: true,
    action: "review_mapping",
    result: data?.[0] || null,
    boundary: {
      human_accounting_decision_recorded: true,
      posting_execution_authorized: false,
      provider_mutation: false,
      jobs_writeback: false,
    },
  });
});
