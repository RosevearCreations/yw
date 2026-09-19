export const MONTH_END_CLOSE_BUILD = 316;

type GateState = 'pass' | 'blocked' | 'review' | 'unavailable';

type Gate = {
  key: string;
  label: string;
  state: GateState;
  required: boolean;
  blocker_count: number;
  detail: string;
  action_hint: string;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseReviewNotes(value: unknown) {
  const raw = text(value);
  if (!raw) return {};
  try {
    return objectValue(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function queryRows(query: any, source: string) {
  try {
    const { data, error } = await query;
    if (error) return { ok: false, rows: [] as any[], source, error: String(error.message || error) };
    return { ok: true, rows: Array.isArray(data) ? data : [], source, error: null };
  } catch (error) {
    return { ok: false, rows: [] as any[], source, error: String(error) };
  }
}

function gate(
  key: string,
  label: string,
  required: boolean,
  state: GateState,
  blockerCount: number,
  detail: string,
  actionHint: string,
): Gate {
  return {
    key,
    label,
    required,
    state,
    blocker_count: Math.max(0, Math.floor(blockerCount || 0)),
    detail,
    action_hint: actionHint,
  };
}

export async function evaluateMonthEndCloseCockpit(supabase: any, periodId: string) {
  const periodRead = await queryRows(
    supabase.from('accounting_period_closes')
      .select('id,period_code,period_start,period_end,close_scope,close_status,period_lock_status,ar_locked,ap_locked,gl_locked,payroll_locked,tax_locked,accountant_package_export_id,reopen_reason')
      .eq('id', periodId)
      .limit(1),
    'accounting_period_closes',
  );
  const period = periodRead.rows[0] || null;
  if (!periodRead.ok || !period?.id) {
    const unavailableGate = gate(
      'period_identity',
      'Accounting period identity',
      true,
      'unavailable',
      1,
      periodRead.ok ? 'The requested accounting period was not found.' : 'The accounting period could not be read.',
      'Reload the current accounting period before attempting a close decision.',
    );
    return {
      build: MONTH_END_CLOSE_BUILD,
      mode: 'month_end_close_cockpit',
      period: null,
      ready_for_hard_lock: false,
      required_gate_count: 1,
      blocking_gate_count: 1,
      gates: [unavailableGate],
      source_errors: periodRead.error ? [{ source: periodRead.source, error: periodRead.error }] : [],
      posting_execution_authorized: false,
      provider_mutation: false,
    };
  }

  const start = text(period.period_start);
  const end = text(period.period_end);

  const [
    closeControlRead,
    mappingRead,
    arApplicationsRead,
    apApplicationsRead,
    journalRead,
    reconciliationRead,
    packageRead,
    arRead,
    apRead,
  ] = await Promise.all([
    queryRows(
      supabase.from('v_accounting_close_admin_control_dashboard').select('*').eq('id', period.id).limit(1),
      'v_accounting_close_admin_control_dashboard',
    ),
    queryRows(
      supabase.from('v_it_finance_account_mapping_review_status').select('*').limit(1),
      'v_it_finance_account_mapping_review_status',
    ),
    queryRows(
      supabase.from('ar_payment_applications')
        .select('id,application_date,application_status,review_status')
        .gte('application_date', start).lte('application_date', end),
      'ar_payment_applications',
    ),
    queryRows(
      supabase.from('ap_payment_applications')
        .select('id,application_date,application_status,review_status')
        .gte('application_date', start).lte('application_date', end),
      'ap_payment_applications',
    ),
    queryRows(
      supabase.from('gl_journal_batches')
        .select('id,batch_date,batch_status')
        .gte('batch_date', start).lte('batch_date', end),
      'gl_journal_batches',
    ),
    queryRows(
      supabase.from('bank_reconciliation_items')
        .select('id,item_date,amount,match_status,clearing_status,manual_review_status,review_notes,difference_reason')
        .gte('item_date', start).lte('item_date', end),
      'bank_reconciliation_items',
    ),
    queryRows(
      supabase.from('accountant_handoff_exports')
        .select('id,source_period_close_id,entity_scope,entity_id,package_status,delivery_status,export_status,updated_at')
        .eq('source_period_close_id', period.id)
        .limit(25),
      'accountant_handoff_exports',
    ),
    queryRows(
      supabase.from('ar_invoices')
        .select('id,invoice_date,invoice_status,balance_due')
        .gte('invoice_date', start).lte('invoice_date', end)
        .gt('balance_due', 0),
      'ar_invoices',
    ),
    queryRows(
      supabase.from('ap_bills')
        .select('id,bill_date,bill_status,balance_due')
        .gte('bill_date', start).lte('bill_date', end)
        .gt('balance_due', 0),
      'ap_bills',
    ),
  ]);

  const sourceReads = [
    closeControlRead,
    mappingRead,
    arApplicationsRead,
    apApplicationsRead,
    journalRead,
    reconciliationRead,
    packageRead,
  ];
  const sourceErrors = sourceReads
    .filter((read) => !read.ok)
    .map((read) => ({ source: read.source, error: read.error || 'unavailable' }));

  const closeControl = closeControlRead.rows[0] || {};
  const mapping = mappingRead.rows[0] || {};

  const paymentAttention = [...arApplicationsRead.rows, ...apApplicationsRead.rows].filter((row: any) => {
    const status = text(row.application_status).toLowerCase();
    const review = text(row.review_status).toLowerCase();
    return ['draft', 'review', 'exception', 'pending', 'needs_review'].includes(status)
      || ['draft', 'review', 'exception', 'pending', 'needs_review', 'rejected'].includes(review);
  });

  const journalAttention = journalRead.rows.filter((row: any) =>
    ['draft', 'review', 'exception', 'generated', 'pending'].includes(text(row.batch_status).toLowerCase())
  );

  const unresolvedReconciliation = reconciliationRead.rows.filter((row: any) => {
    const match = text(row.match_status).toLowerCase();
    const review = text(row.manual_review_status).toLowerCase();
    const clearing = text(row.clearing_status).toLowerCase();
    return ['unmatched', 'partial', 'exception'].includes(match)
      || ['exception', 'needs_review', 'pending', 'review'].includes(review)
      || clearing === 'open';
  });

  const materialExceptions = unresolvedReconciliation.filter((row: any) => {
    const note = parseReviewNotes(row.review_notes);
    const severity = text(note.severity).toLowerCase();
    const resolved = text(note.resolution_status).toLowerCase() === 'resolved' || text(row.manual_review_status).toLowerCase() === 'approved';
    const explicitMaterial = note.material === true || note.month_end_close_blocker === true;
    const inferredMaterial = ['high', 'critical'].includes(severity) || Math.abs(number(row.amount)) >= 1000;
    return !resolved && (explicitMaterial || inferredMaterial);
  });

  const providerSettlementExceptions = unresolvedReconciliation.filter((row: any) => {
    const note = parseReviewNotes(row.review_notes);
    const category = text(note.category).toLowerCase();
    const detail = `${text(row.difference_reason)} ${text(row.review_notes)}`.toLowerCase();
    return category === 'provider_settlement' || /stripe|paypal|provider|settlement/.test(detail);
  });

  const openReconciliationCount = number(closeControl.open_reconciliation_count);
  const reconciliationDifference = Math.abs(number(closeControl.open_reconciliation_difference_total));
  const openTaxCount = number(closeControl.open_tax_filing_count);
  const openPayrollCount = number(closeControl.open_payroll_remittance_count);
  const mappingStatus = text(mapping.mapping_readiness_status).toLowerCase();
  const packageCount = Math.max(
    number(closeControl.package_count),
    packageRead.rows.length,
    period.accountant_package_export_id ? 1 : 0,
  );

  const gates: Gate[] = [];

  if (!closeControlRead.ok || !closeControl?.id) {
    gates.push(gate(
      'close_control',
      'Period-scoped close evidence',
      true,
      'unavailable',
      1,
      'The period-scoped close-control dashboard is unavailable.',
      'Restore the current close-control view before a hard lock.',
    ));
  } else {
    gates.push(gate(
      'bank_reconciliation',
      'Bank reconciliation',
      true,
      openReconciliationCount === 0 && reconciliationDifference === 0 ? 'pass' : 'blocked',
      openReconciliationCount + (reconciliationDifference === 0 ? 0 : 1),
      openReconciliationCount === 0 && reconciliationDifference === 0
        ? 'No open reconciliation session or unresolved period difference is recorded.'
        : `${openReconciliationCount} open reconciliation session(s); difference ${reconciliationDifference.toFixed(2)}.`,
      'Resolve and sign off the period reconciliation before hard lock.',
    ));
    gates.push(gate(
      'remittances',
      'Tax & payroll remittances',
      true,
      openTaxCount === 0 && openPayrollCount === 0 ? 'pass' : 'blocked',
      openTaxCount + openPayrollCount,
      `${openTaxCount} tax filing(s) and ${openPayrollCount} payroll remittance(s) remain open for the period.`,
      'Complete required filing/remittance review and proof before hard lock.',
    ));
  }

  gates.push(gate(
    'payment_exceptions',
    'Payment application exceptions',
    true,
    arApplicationsRead.ok && apApplicationsRead.ok
      ? (paymentAttention.length ? 'blocked' : 'pass')
      : 'unavailable',
    arApplicationsRead.ok && apApplicationsRead.ok ? paymentAttention.length : 1,
    arApplicationsRead.ok && apApplicationsRead.ok
      ? `${paymentAttention.length} AR/AP application row(s) still need review.`
      : 'AR/AP payment application evidence is unavailable.',
    'Resolve unapplied, partial, rejected, write-off, credit, refund or exception decisions before hard lock.',
  ));

  gates.push(gate(
    'account_mappings',
    'Account mappings',
    true,
    mappingRead.ok && mappingRead.rows.length
      ? (mappingStatus === 'green' ? 'pass' : 'blocked')
      : 'unavailable',
    mappingRead.ok && mappingRead.rows.length ? number(mapping.pending_count) + number(mapping.rejected_count) + number(mapping.inactive_account_count) : 1,
    mappingRead.ok && mappingRead.rows.length
      ? text(mapping.readiness_message) || `Mapping readiness is ${mappingStatus || 'unknown'}.`
      : 'Current Finance account-mapping readiness is unavailable.',
    'Complete the human chart-of-accounts mapping decisions before hard lock.',
  ));

  gates.push(gate(
    'journal_review',
    'Journal review',
    true,
    journalRead.ok ? (journalAttention.length ? 'blocked' : 'pass') : 'unavailable',
    journalRead.ok ? journalAttention.length : 1,
    journalRead.ok
      ? `${journalAttention.length} draft/review/exception/generated journal batch(es) remain in the period.`
      : 'Journal review evidence is unavailable.',
    'Resolve journal candidates and exceptions before hard lock.',
  ));

  gates.push(gate(
    'material_reconciliation_exceptions',
    'Material reconciliation exceptions',
    true,
    reconciliationRead.ok ? (materialExceptions.length ? 'blocked' : 'pass') : 'unavailable',
    reconciliationRead.ok ? materialExceptions.length : 1,
    reconciliationRead.ok
      ? `${materialExceptions.length} unresolved material exception(s) block Finance readiness and month-end close.`
      : 'Material reconciliation exception evidence is unavailable.',
    'Assign, evidence and explicitly resolve every material reconciliation exception before hard lock.',
  ));

  gates.push(gate(
    'provider_settlement_exceptions',
    'Provider settlement exceptions',
    true,
    reconciliationRead.ok ? (providerSettlementExceptions.length ? 'blocked' : 'pass') : 'unavailable',
    reconciliationRead.ok ? providerSettlementExceptions.length : 1,
    reconciliationRead.ok
      ? `${providerSettlementExceptions.length} unresolved provider-settlement reconciliation exception(s) remain.`
      : 'Provider settlement exception evidence is unavailable.',
    'Resolve provider settlement reconciliation evidence without enabling provider mutation.',
  ));

  gates.push(gate(
    'accountant_export',
    'Accountant export package identified',
    true,
    packageRead.ok ? (packageCount > 0 ? 'pass' : 'blocked') : 'unavailable',
    packageRead.ok ? (packageCount > 0 ? 0 : 1) : 1,
    packageRead.ok
      ? (packageCount > 0 ? `${packageCount} close-package reference(s) are linked to this period.` : 'No accountant close package is linked to this period.')
      : 'Accountant export readiness evidence is unavailable.',
    'Prepare and link the current accountant close package before hard lock. Build 317 will deepen the package contents.',
  ));

  gates.push(gate(
    'open_ar',
    'Open A/R balance context',
    false,
    arRead.ok ? (arRead.rows.length ? 'review' : 'pass') : 'unavailable',
    arRead.ok ? arRead.rows.length : 0,
    arRead.ok ? `${arRead.rows.length} invoice(s) created in the period still have a balance due.` : 'A/R balance context is unavailable.',
    'Review open receivables for collectability and classification; an ordinary open balance does not automatically block close.',
  ));

  gates.push(gate(
    'open_ap',
    'Open A/P balance context',
    false,
    apRead.ok ? (apRead.rows.length ? 'review' : 'pass') : 'unavailable',
    apRead.ok ? apRead.rows.length : 0,
    apRead.ok ? `${apRead.rows.length} bill(s) created in the period still have a balance due.` : 'A/P balance context is unavailable.',
    'Review open payables and accrual/classification needs; an ordinary open balance does not automatically block close.',
  ));

  const requiredGates = gates.filter((item) => item.required);
  const blockingGates = requiredGates.filter((item) => item.state !== 'pass');

  return {
    build: MONTH_END_CLOSE_BUILD,
    mode: 'month_end_close_cockpit',
    period: {
      id: period.id,
      period_code: period.period_code,
      period_start: period.period_start,
      period_end: period.period_end,
      close_status: period.close_status,
      period_lock_status: period.period_lock_status,
    },
    ready_for_hard_lock: blockingGates.length === 0,
    required_gate_count: requiredGates.length,
    blocking_gate_count: blockingGates.length,
    gates,
    source_errors: sourceErrors,
    posting_execution_authorized: false,
    provider_mutation: false,
  };
}
