import type { ModuleAccessLevel, ModuleKey } from './module-permissions.ts';

export type ModuleBoundaryMode = 'read' | 'write' | 'disabled';

export type ModuleWriteBoundary = Readonly<{
  action: string;
  ownerModule: ModuleKey;
  minimum: ModuleAccessLevel;
  mode: ModuleBoundaryMode;
  domain: string;
  eventKey: string | null;
  crossModule: boolean;
}>;

const contract = (
  action: string,
  ownerModule: ModuleKey,
  minimum: ModuleAccessLevel,
  mode: ModuleBoundaryMode,
  domain: string,
  eventKey: string | null = null,
  crossModule = false,
): ModuleWriteBoundary => Object.freeze({ action, ownerModule, minimum, mode, domain, eventKey, crossModule });

export const MODULE_WRITE_BOUNDARIES: Readonly<Record<string, ModuleWriteBoundary>> = Object.freeze({
  operations_queue_list: contract('operations_queue_list', 'admin', 'view', 'read', 'operations_control_plane'),

  payment_action_request: contract('payment_action_request', 'finance', 'create', 'write', 'payments', 'finance.payment_action.requested'),
  payment_action_decision: contract('payment_action_decision', 'finance', 'approve', 'write', 'payments', 'finance.payment_action.decided'),
  bank_csv_preview: contract('bank_csv_preview', 'finance', 'create', 'write', 'banking', 'finance.bank_import.previewed'),
  bank_csv_confirm_import: contract('bank_csv_confirm_import', 'finance', 'approve', 'write', 'banking', 'finance.bank_import.promoted'),
  reconciliation_suggest: contract('reconciliation_suggest', 'finance', 'view', 'read', 'reconciliation'),
  reconciliation_action: contract('reconciliation_action', 'finance', 'approve', 'write', 'reconciliation', 'finance.reconciliation.changed'),
  job_cost_refresh: contract('job_cost_refresh', 'finance', 'view', 'write', 'job_costing', 'finance.job_cost.refreshed', true),
  deposit_status_update: contract('deposit_status_update', 'finance', 'manage', 'disabled', 'payments', 'finance.deposit.manual_update_blocked'),

  equipment_scan_event: contract('equipment_scan_event', 'jobs', 'create', 'write', 'equipment_custody', 'jobs.equipment.scanned'),
  equipment_cost_recovery_decision: contract('equipment_cost_recovery_decision', 'jobs', 'approve', 'write', 'equipment_cost_recovery', 'jobs.equipment.cost_recovery_decided', true),
  quote_owner_assign: contract('quote_owner_assign', 'jobs', 'approve', 'write', 'quote_operations', 'jobs.quote.owner_assigned'),
  quote_followup_event: contract('quote_followup_event', 'jobs', 'approve', 'write', 'quote_operations', 'jobs.quote.followup_recorded'),
  dispatch_schedule: contract('dispatch_schedule', 'jobs', 'approve', 'write', 'dispatch', 'jobs.job_scheduled', true),
  work_order_live_update_create: contract('work_order_live_update_create', 'jobs', 'create', 'write', 'work_order_updates', 'jobs.work_order.update_created', true),
  work_order_live_update_retract: contract('work_order_live_update_retract', 'jobs', 'approve', 'write', 'work_order_updates', 'jobs.work_order.update_retracted', true),
  work_order_execution_proof_submit: contract('work_order_execution_proof_submit', 'jobs', 'create', 'write', 'execution_proof', 'jobs.execution_proof.submitted', true),
  work_order_execution_proof_decision: contract('work_order_execution_proof_decision', 'jobs', 'approve', 'write', 'execution_proof', 'jobs.execution_proof.decided', true),
  work_order_closeout_submit: contract('work_order_closeout_submit', 'jobs', 'approve', 'write', 'closeout', 'jobs.closeout.submitted', true),
  work_order_closeout_decision: contract('work_order_closeout_decision', 'jobs', 'approve', 'write', 'closeout', 'jobs.closeout.decided', true),
  customer_notification_retry: contract('customer_notification_retry', 'jobs', 'manage', 'write', 'customer_notifications', 'jobs.customer_notification.retried', true),

  visual_asset_register: contract('visual_asset_register', 'admin', 'manage', 'write', 'public_content', 'admin.visual_asset.registered'),
  visual_asset_decision: contract('visual_asset_decision', 'admin', 'manage', 'write', 'public_content', 'admin.visual_asset.decided'),
  public_route_register: contract('public_route_register', 'admin', 'manage', 'write', 'public_content', 'admin.public_route.registered'),
  public_route_decision: contract('public_route_decision', 'admin', 'manage', 'write', 'public_content', 'admin.public_route.decided'),
  public_route_publish: contract('public_route_publish', 'admin', 'manage', 'write', 'public_content', 'admin.public_route.published'),
  offline_conflict_card: contract('offline_conflict_card', 'admin', 'manage', 'write', 'offline_sync', 'admin.offline_conflict.recorded'),
  offline_conflict_resolve: contract('offline_conflict_resolve', 'admin', 'manage', 'write', 'offline_sync', 'admin.offline_conflict.resolved'),
  scorecard_update: contract('scorecard_update', 'admin', 'manage', 'write', 'scorecard', 'admin.scorecard.updated'),
  staging_fixture_create: contract('staging_fixture_create', 'admin', 'manage', 'write', 'staging_control', 'admin.staging_fixture.created'),
  staging_fixture_cleanup: contract('staging_fixture_cleanup', 'admin', 'manage', 'write', 'staging_control', 'admin.staging_fixture.cleaned'),
  content_signal_record: contract('content_signal_record', 'admin', 'manage', 'write', 'content_signals', 'admin.content_signal.recorded'),
  content_signal_decision: contract('content_signal_decision', 'admin', 'manage', 'write', 'content_signals', 'admin.content_signal.decided'),
  stripe_webhook_alert_decision: contract('stripe_webhook_alert_decision', 'admin', 'manage', 'write', 'payment_operations', 'admin.stripe_alert.decided'),
  release_readiness_capture: contract('release_readiness_capture', 'admin', 'manage', 'write', 'release_readiness', 'admin.release_readiness.captured'),
});

export const MODULE_WRITE_ACTIONS = Object.freeze(Object.keys(MODULE_WRITE_BOUNDARIES).sort());

export function resolveModuleWriteBoundary(action: unknown): ModuleWriteBoundary | null {
  const key = String(action || '').trim();
  return key ? MODULE_WRITE_BOUNDARIES[key] || null : null;
}

export function boundaryAuditFields(boundary: ModuleWriteBoundary | null | undefined) {
  return {
    boundary_owner_module: boundary?.ownerModule || null,
    boundary_minimum_access: boundary?.minimum || null,
    boundary_mode: boundary?.mode || null,
    boundary_event_key: boundary?.eventKey || null,
    cross_module_event: boundary?.crossModule === true,
  };
}
