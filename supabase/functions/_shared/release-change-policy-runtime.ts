export const RUNTIME_POLICY_SOURCE_AUTHORITY = "build_246_release_change_policy";
export const RUNTIME_POLICY_MODE = "read_only_advisory_mirror";

const BASELINE_GATES = [
  "test:promotion-shape",
  "test:repository-protection-preflight",
  "test:release-source-evidence-verify",
  "test:release-source-evidence-record",
  "test:runtime",
  "test:boundaries",
  "test:acceptance",
  "test:release-authority",
  "test:repo",
  "test:browser",
];

const GATE_PROFILES: Record<string, string[]> = {
  schema_changing: [
    "test:staging-acceptance",
    "test:staging-runtime-schema",
    "test:current-schema-staging-runbook",
    "test:finance-schema-dependencies",
  ],
  auth_or_security_sensitive: [
    "test:submission-security",
    "test:security-advisor-truth",
    "test:admin-account-security",
    "test:auth-security-evidence",
    "test:browser:admin-account-security",
  ],
  finance_sensitive: [
    "test:finance-schema-dependencies",
    "test:finance-posting-safety",
    "test:finance-posting-preflight",
    "test:finance-release-hardening",
    "test:browser:finance",
  ],
  provider_sensitive: [
    "test:finance-posting-safety",
    "test:finance-posting-preflight",
    "test:finance-release-hardening",
    "test:staging-acceptance",
  ],
  deployment_sensitive: [
    "test:promotion-shape",
    "test:repository-protection-preflight",
    "test:release-source-evidence-verify",
    "test:release-source-evidence-record",
    "test:performance-budgets",
    "test:browser:performance-budgets",
  ],
  staging_sensitive: [
    "test:staging-acceptance",
    "test:staging-scenarios",
    "test:staging-environment-guard",
    "test:staging-target-preflight",
    "test:staging-runtime-schema",
    "test:browser:staging-acceptance",
  ],
  public_content_sensitive: [
    "test:help-seo",
    "test:search-discovery",
    "test:public-route-publication",
    "test:browser:public-route-publication",
    "test:browser:help-seo",
  ],
  release_governance: [
    "test:promotion-shape",
    "test:repository-protection-preflight",
    "test:release-source-evidence-verify",
    "test:release-source-evidence-record",
    "test:performance-budgets",
  ],
  unclassified_source_change: [
    "test:runtime",
    "test:boundaries",
    "test:acceptance",
    "test:repo",
    "test:browser",
  ],
};

const CLASS_PRIORITY = [
  "schema_changing",
  "auth_or_security_sensitive",
  "provider_sensitive",
  "finance_sensitive",
  "deployment_sensitive",
  "staging_sensitive",
  "release_governance",
  "public_content_sensitive",
  "unclassified_source_change",
];
const CRITICAL = new Set(["schema_changing", "auth_or_security_sensitive", "provider_sensitive", "finance_sensitive"]);
const HIGH = new Set(["deployment_sensitive", "staging_sensitive", "release_governance"]);

const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort();

function classifyChangedFiles(files: string[]) {
  const normalized = uniq(files.map((file) => String(file || "").trim().replaceAll("\\", "/")).filter(Boolean));
  const riskTags: string[] = [];
  const migrations: string[] = [];
  for (const file of normalized) {
    const lower = file.toLowerCase();
    const migration = file.match(/^sql\/(\d{3}[a-z]?)_.+\.sql$/i);
    if (migration) {
      riskTags.push("schema_changing");
      migrations.push(migration[1].toLowerCase());
    }
    if (lower.startsWith(".github/workflows/")) riskTags.push("deployment_sensitive", "release_governance");
    if (lower.startsWith("scripts/") && /release|promotion|repository|staging|schema|migration/.test(lower)) riskTags.push("release_governance");
    if (/service[-_]?worker|sw\.js$/.test(lower)) riskTags.push("deployment_sensitive");
    if (/finance|accounting|posting|journal|reconcil/.test(lower)) riskTags.push("finance_sensitive");
    if (/auth|security|permission|rls|grant/.test(lower)) riskTags.push("auth_or_security_sensitive");
    if (/stripe|paypal|provider|payment/.test(lower)) riskTags.push("provider_sensitive");
    if (/staging/.test(lower)) riskTags.push("staging_sensitive");
    if (/public|seo|sitemap|robots|help\.html/.test(lower)) riskTags.push("public_content_sensitive");
  }
  if (!riskTags.length) riskTags.push("unclassified_source_change");
  return { changed_files: normalized, risk_tags: uniq(riskTags), changed_migrations: uniq(migrations) };
}

function evidenceProfile(primaryClass: string) {
  if (primaryClass === "schema_changing") return "schema_migration_and_dependent_runtime";
  if (primaryClass === "auth_or_security_sensitive") return "security_and_admin_access";
  if (primaryClass === "provider_sensitive") return "provider_and_finance_safety";
  if (primaryClass === "finance_sensitive") return "finance_schema_posting_and_recovery";
  if (primaryClass === "deployment_sensitive") return "deployment_release_governance";
  if (primaryClass === "staging_sensitive") return "staging_acceptance_and_runtime_schema";
  if (primaryClass === "release_governance") return "release_governance_and_performance";
  if (primaryClass === "public_content_sensitive") return "public_route_search_and_seo";
  return "standard_source_acceptance";
}

export function buildRuntimeReleaseChangePolicy(files: string[]) {
  const change = classifyChangedFiles(files);
  const tagSet = new Set(change.risk_tags);
  const classes = CLASS_PRIORITY.filter((name) => tagSet.has(name));
  if (!classes.length) classes.push("unclassified_source_change");
  const primaryClass = classes[0];
  const requiredGates = uniq([
    ...BASELINE_GATES,
    ...classes.flatMap((name) => GATE_PROFILES[name] || GATE_PROFILES.unclassified_source_change),
  ]);
  const riskLevel = classes.some((name) => CRITICAL.has(name)) ? "critical"
    : classes.some((name) => HIGH.has(name)) ? "high"
    : "medium";
  return {
    source_authority: RUNTIME_POLICY_SOURCE_AUTHORITY,
    runtime_mode: RUNTIME_POLICY_MODE,
    primary_class: primaryClass,
    classes,
    risk_level: riskLevel,
    evidence_profile: evidenceProfile(primaryClass),
    manual_review_required: riskLevel === "critical" || riskLevel === "high",
    required_gate_scripts: requiredGates,
    changed_file_count: change.changed_files.length,
    changed_files: change.changed_files,
    changed_migrations: change.changed_migrations,
    boundaries: {
      release_authorization_performed: false,
      production_promotion_performed: false,
      database_mutation_performed: false,
      auth_or_permission_mutation_performed: false,
      finance_posting_enabled: false,
      provider_mutation_performed: false,
    },
  };
}
