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
  operations_attention_defer: contract('operations_attention_defer', 'admin', 'manage', 'write', 'operations_attention', 'admin.operations_attention.deferred'),
  operations_attention_resolve: contract('operations_attention_resolve', 'admin', 'manage', 'write', 'operations_attention', 'admin.operations_attention.resolved'),
  job_hazard_template_save: contract('job_hazard_template_save', 'safety', 'approve', 'write', 'job_hazard_plans', 'safety.job_hazard_template.saved'),
  job_hazard_plan_save: contract('job_hazard_plan_save', 'safety', 'create', 'write', 'job_hazard_plans', 'safety.job_hazard_plan.saved'),
  job_hazard_plan_review: contract('job_hazard_plan_review', 'safety', 'approve', 'write', 'job_hazard_plans', 'safety.job_hazard_plan.reviewed'),
  incident_investigation_save: contract('incident_investigation_save', 'safety', 'approve', 'write', 'incident_investigation', 'safety.incident_investigation.saved'),
  incident_investigation_review: contract('incident_investigation_review', 'safety', 'approve', 'write', 'incident_investigation', 'safety.incident_investigation.reviewed'),
  incident_investigation_close: contract('incident_investigation_close', 'safety', 'approve', 'write', 'incident_investigation', 'safety.incident_investigation.closed'),
  training_requirement_save: contract('training_requirement_save', 'safety', 'approve', 'write', 'training_matrix', 'safety.training_requirement.saved'),
  training_assignment_save: contract('training_assignment_save', 'safety', 'approve', 'write', 'training_matrix', 'safety.training_assignment.saved'),
  training_record_save: contract('training_record_save', 'safety', 'approve', 'write', 'training_matrix', 'safety.training_record.saved'),
  training_internal_authorization_decision: contract('training_internal_authorization_decision', 'safety', 'approve', 'write', 'training_matrix', 'safety.training_internal_authorization.decided'),




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
  crm_client_save: contract('crm_client_save', 'jobs', 'approve', 'write', 'customer_property_crm', 'jobs.crm.customer_saved'),
  crm_interaction_save: contract('crm_interaction_save', 'jobs', 'approve', 'write', 'customer_property_crm', 'jobs.crm.interaction_saved'),
  crm_followup_save: contract('crm_followup_save', 'jobs', 'approve', 'write', 'customer_property_crm', 'jobs.crm.followup_saved'),
  crm_opportunity_save: contract('crm_opportunity_save', 'jobs', 'approve', 'write', 'customer_property_crm', 'jobs.crm.opportunity_saved'),
  route_territory_save: contract('route_territory_save', 'jobs', 'approve', 'write', 'route_optimization', 'jobs.route.territory_saved'),
  route_territory_site_save: contract('route_territory_site_save', 'jobs', 'approve', 'write', 'route_optimization', 'jobs.route.territory_site_saved'),
  route_optimization_generate: contract('route_optimization_generate', 'jobs', 'approve', 'write', 'route_optimization', 'jobs.route.optimization_generated'),
  route_optimization_decision: contract('route_optimization_decision', 'jobs', 'approve', 'write', 'route_optimization', 'jobs.route.optimization_decided'),
  workability_rule_save: contract('workability_rule_save', 'jobs', 'approve', 'write', 'weather_workability', 'jobs.workability.rule_saved'),
  workability_observation_save: contract('workability_observation_save', 'jobs', 'approve', 'write', 'weather_workability', 'jobs.workability.observation_saved'),
  workability_decision_save: contract('workability_decision_save', 'jobs', 'approve', 'write', 'weather_workability', 'jobs.workability.decision_saved'),
  workability_notification_readiness_save: contract('workability_notification_readiness_save', 'jobs', 'approve', 'write', 'weather_workability', 'jobs.workability.notification_readiness_saved'),
  landscape_material_estimate_save: contract('landscape_material_estimate_save', 'jobs', 'approve', 'write', 'landscape_material_estimator', 'jobs.material_estimator.plan_saved'),
  landscape_material_actual_use_save: contract('landscape_material_actual_use_save', 'jobs', 'approve', 'write', 'landscape_material_estimator', 'jobs.material_estimator.actual_use_saved'),
  quote_owner_assign: contract('quote_owner_assign', 'jobs', 'approve', 'write', 'quote_operations', 'jobs.quote.owner_assigned'),
  quote_followup_event: contract('quote_followup_event', 'jobs', 'approve', 'write', 'quote_operations', 'jobs.quote.followup_recorded'),
  dispatch_schedule: contract('dispatch_schedule', 'jobs', 'approve', 'write', 'dispatch', 'jobs.job_scheduled', true),
  recurring_service_program_save: contract('recurring_service_program_save', 'jobs', 'approve', 'write', 'recurring_service', 'jobs.recurring_service.program_saved'),
  recurring_service_visit_event: contract('recurring_service_visit_event', 'jobs', 'approve', 'write', 'recurring_service', 'jobs.recurring_service.visit_event_recorded'),
  property_site_save: contract('property_site_save', 'jobs', 'approve', 'write', 'property_site', 'jobs.property_site.saved'),
  property_zone_save: contract('property_zone_save', 'jobs', 'approve', 'write', 'property_site', 'jobs.property_site.zone_saved'),
  property_photo_register: contract('property_photo_register', 'jobs', 'approve', 'write', 'property_site', 'jobs.property_site.photo_registered'),
  estimate_workflow_save: contract('estimate_workflow_save', 'jobs', 'approve', 'write', 'commercial_workflow', 'jobs.estimate.saved'),
  estimate_approval_decision: contract('estimate_approval_decision', 'jobs', 'approve', 'write', 'commercial_workflow', 'jobs.estimate.approval_decided'),
  estimate_convert_work_order: contract('estimate_convert_work_order', 'jobs', 'approve', 'write', 'commercial_workflow', 'jobs.estimate.converted', true),
  change_order_save: contract('change_order_save', 'jobs', 'approve', 'write', 'commercial_workflow', 'jobs.change_order.saved'),
  change_order_discovery_save: contract('change_order_discovery_save', 'jobs', 'create', 'write', 'change_orders_extras', 'jobs.change_order.discovery_saved'),
  change_order_evidence_save: contract('change_order_evidence_save', 'jobs', 'create', 'write', 'change_orders_extras', 'jobs.change_order.evidence_saved'),
  change_order_review_price: contract('change_order_review_price', 'jobs', 'approve', 'write', 'change_orders_extras', 'jobs.change_order.review_priced'),
  change_order_customer_authorization: contract('change_order_customer_authorization', 'jobs', 'approve', 'write', 'change_orders_extras', 'jobs.change_order.customer_authorized'),
  change_order_apply: contract('change_order_apply', 'jobs', 'approve', 'write', 'change_orders_extras', 'jobs.change_order.applied', true),
  change_order_invoice_evidence_save: contract('change_order_invoice_evidence_save', 'jobs', 'approve', 'write', 'change_orders_extras', 'jobs.change_order.invoice_evidence_saved', true),
  landscape_production_session_save: contract('landscape_production_session_save', 'jobs', 'create', 'write', 'landscape_production', 'jobs.production.session_saved', true),
  landscape_production_quantity_save: contract('landscape_production_quantity_save', 'jobs', 'create', 'write', 'landscape_production', 'jobs.production.quantity_saved'),
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
