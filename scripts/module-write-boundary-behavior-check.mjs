#!/usr/bin/env node
/** Schema 164 executable contract proof for fail-closed action ownership. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const source = fs.readFileSync(path.join(process.cwd(), 'supabase/functions/_shared/module-write-boundaries.ts'), 'utf8');
const require = createRequire(import.meta.url);
const ts = require('typescript');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
  },
  reportDiagnostics: true,
  fileName: 'supabase/functions/_shared/module-write-boundaries.ts'
});
const errors = (transpiled.diagnostics || []).filter((diag) => diag.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((diag) => ts.flattenDiagnosticMessageText(diag.messageText, '\n')).join(' | '));

const module = { exports: {} };
const sandbox = {
  module,
  exports: module.exports,
  require() { throw new Error('Schema 164 boundary helper must not have runtime imports.'); },
  Object,
  String,
  Array,
  Set,
  Map,
  console,
};
vm.createContext(sandbox);
vm.runInContext(transpiled.outputText, sandbox, { filename: 'module-write-boundaries.js' });

const {
  MODULE_WRITE_ACTIONS,
  MODULE_WRITE_BOUNDARIES,
  resolveModuleWriteBoundary,
  boundaryAuditFields,
} = module.exports;

assert.equal(Array.from(MODULE_WRITE_ACTIONS).length, 90, 'Exactly 90 operations actions must be contracted through Schema 234.');
assert.equal(Object.keys(MODULE_WRITE_BOUNDARIES).length, 90);

const financeCreate = resolveModuleWriteBoundary('payment_action_request');
assert.equal(financeCreate.ownerModule, 'finance');
assert.equal(financeCreate.minimum, 'create');
assert.equal(financeCreate.mode, 'write');

const financeRead = resolveModuleWriteBoundary('reconciliation_suggest');
assert.equal(financeRead.ownerModule, 'finance');
assert.equal(financeRead.minimum, 'view');
assert.equal(financeRead.mode, 'read');
assert.equal(financeRead.eventKey, null);

const jobsWrite = resolveModuleWriteBoundary('work_order_execution_proof_submit');
assert.equal(jobsWrite.ownerModule, 'jobs');
assert.equal(jobsWrite.minimum, 'create');
assert.equal(jobsWrite.mode, 'write');
assert.equal(jobsWrite.crossModule, true);
assert.equal(jobsWrite.eventKey, 'jobs.execution_proof.submitted');

const adminWrite = resolveModuleWriteBoundary('public_route_publish');
assert.equal(adminWrite.ownerModule, 'admin');
assert.equal(adminWrite.minimum, 'manage');
assert.equal(adminWrite.mode, 'write');

const attentionDefer = resolveModuleWriteBoundary('operations_attention_defer');
assert.equal(attentionDefer.ownerModule, 'admin');
assert.equal(attentionDefer.minimum, 'manage');
assert.equal(attentionDefer.mode, 'write');
assert.equal(attentionDefer.eventKey, 'admin.operations_attention.deferred');

const attentionResolve = resolveModuleWriteBoundary('operations_attention_resolve');
assert.equal(attentionResolve.ownerModule, 'admin');
assert.equal(attentionResolve.minimum, 'manage');
assert.equal(attentionResolve.mode, 'write');
assert.equal(attentionResolve.eventKey, 'admin.operations_attention.resolved');

const hazardTemplate = resolveModuleWriteBoundary('job_hazard_template_save');
assert.equal(hazardTemplate.ownerModule, 'safety');
assert.equal(hazardTemplate.minimum, 'approve');
assert.equal(hazardTemplate.mode, 'write');
assert.equal(hazardTemplate.eventKey, 'safety.job_hazard_template.saved');

const hazardPlan = resolveModuleWriteBoundary('job_hazard_plan_save');
assert.equal(hazardPlan.ownerModule, 'safety');
assert.equal(hazardPlan.minimum, 'create');
assert.equal(hazardPlan.mode, 'write');
assert.equal(hazardPlan.eventKey, 'safety.job_hazard_plan.saved');

const hazardReview = resolveModuleWriteBoundary('job_hazard_plan_review');
assert.equal(hazardReview.ownerModule, 'safety');
assert.equal(hazardReview.minimum, 'approve');
assert.equal(hazardReview.mode, 'write');
assert.equal(hazardReview.eventKey, 'safety.job_hazard_plan.reviewed');

const incidentInvestigationSave = resolveModuleWriteBoundary('incident_investigation_save');
assert.equal(incidentInvestigationSave.ownerModule, 'safety');
assert.equal(incidentInvestigationSave.minimum, 'approve');
assert.equal(incidentInvestigationSave.mode, 'write');
assert.equal(incidentInvestigationSave.eventKey, 'safety.incident_investigation.saved');

const incidentInvestigationReview = resolveModuleWriteBoundary('incident_investigation_review');
assert.equal(incidentInvestigationReview.ownerModule, 'safety');
assert.equal(incidentInvestigationReview.minimum, 'approve');
assert.equal(incidentInvestigationReview.mode, 'write');
assert.equal(incidentInvestigationReview.eventKey, 'safety.incident_investigation.reviewed');

const incidentInvestigationClose = resolveModuleWriteBoundary('incident_investigation_close');
assert.equal(incidentInvestigationClose.ownerModule, 'safety');
assert.equal(incidentInvestigationClose.minimum, 'approve');
assert.equal(incidentInvestigationClose.mode, 'write');
assert.equal(incidentInvestigationClose.eventKey, 'safety.incident_investigation.closed');

const trainingRequirement = resolveModuleWriteBoundary('training_requirement_save');
assert.equal(trainingRequirement.ownerModule, 'safety');
assert.equal(trainingRequirement.minimum, 'approve');
assert.equal(trainingRequirement.eventKey, 'safety.training_requirement.saved');

const trainingAssignment = resolveModuleWriteBoundary('training_assignment_save');
assert.equal(trainingAssignment.ownerModule, 'safety');
assert.equal(trainingAssignment.minimum, 'approve');
assert.equal(trainingAssignment.eventKey, 'safety.training_assignment.saved');

const trainingRecord = resolveModuleWriteBoundary('training_record_save');
assert.equal(trainingRecord.ownerModule, 'safety');
assert.equal(trainingRecord.minimum, 'approve');
assert.equal(trainingRecord.eventKey, 'safety.training_record.saved');

const trainingAuthorization = resolveModuleWriteBoundary('training_internal_authorization_decision');
assert.equal(trainingAuthorization.ownerModule, 'safety');
assert.equal(trainingAuthorization.minimum, 'approve');
assert.equal(trainingAuthorization.eventKey, 'safety.training_internal_authorization.decided');

const recurringProgram = resolveModuleWriteBoundary('recurring_service_program_save');
assert.equal(recurringProgram.ownerModule, 'jobs');
assert.equal(recurringProgram.minimum, 'approve');
assert.equal(recurringProgram.mode, 'write');
assert.equal(recurringProgram.eventKey, 'jobs.recurring_service.program_saved');

const recurringVisit = resolveModuleWriteBoundary('recurring_service_visit_event');
assert.equal(recurringVisit.ownerModule, 'jobs');
assert.equal(recurringVisit.minimum, 'approve');
assert.equal(recurringVisit.mode, 'write');
assert.equal(recurringVisit.eventKey, 'jobs.recurring_service.visit_event_recorded');

const propertySite = resolveModuleWriteBoundary('property_site_save');
assert.equal(propertySite.ownerModule, 'jobs');
assert.equal(propertySite.minimum, 'approve');
assert.equal(propertySite.mode, 'write');
assert.equal(propertySite.eventKey, 'jobs.property_site.saved');

const propertyZone = resolveModuleWriteBoundary('property_zone_save');
assert.equal(propertyZone.ownerModule, 'jobs');
assert.equal(propertyZone.minimum, 'approve');
assert.equal(propertyZone.mode, 'write');
assert.equal(propertyZone.eventKey, 'jobs.property_site.zone_saved');

const propertyPhoto = resolveModuleWriteBoundary('property_photo_register');
assert.equal(propertyPhoto.ownerModule, 'jobs');
assert.equal(propertyPhoto.minimum, 'approve');
assert.equal(propertyPhoto.mode, 'write');
assert.equal(propertyPhoto.eventKey, 'jobs.property_site.photo_registered');

const estimateSave = resolveModuleWriteBoundary('estimate_workflow_save');
assert.equal(estimateSave.ownerModule, 'jobs');
assert.equal(estimateSave.minimum, 'approve');
assert.equal(estimateSave.mode, 'write');
assert.equal(estimateSave.eventKey, 'jobs.estimate.saved');

const estimateApproval = resolveModuleWriteBoundary('estimate_approval_decision');
assert.equal(estimateApproval.ownerModule, 'jobs');
assert.equal(estimateApproval.minimum, 'approve');
assert.equal(estimateApproval.mode, 'write');
assert.equal(estimateApproval.eventKey, 'jobs.estimate.approval_decided');

const estimateConvert = resolveModuleWriteBoundary('estimate_convert_work_order');
assert.equal(estimateConvert.ownerModule, 'jobs');
assert.equal(estimateConvert.minimum, 'approve');
assert.equal(estimateConvert.mode, 'write');
assert.equal(estimateConvert.crossModule, true);
assert.equal(estimateConvert.eventKey, 'jobs.estimate.converted');

const changeOrder = resolveModuleWriteBoundary('change_order_save');
assert.equal(changeOrder.ownerModule, 'jobs');
assert.equal(changeOrder.minimum, 'approve');
assert.equal(changeOrder.mode, 'write');
assert.equal(changeOrder.eventKey, 'jobs.change_order.saved');

const productionSession = resolveModuleWriteBoundary('landscape_production_session_save');
assert.equal(productionSession.ownerModule, 'jobs');
assert.equal(productionSession.minimum, 'create');
assert.equal(productionSession.mode, 'write');
assert.equal(productionSession.crossModule, true);
assert.equal(productionSession.eventKey, 'jobs.production.session_saved');

const productionQuantity = resolveModuleWriteBoundary('landscape_production_quantity_save');
assert.equal(productionQuantity.ownerModule, 'jobs');
assert.equal(productionQuantity.minimum, 'create');
assert.equal(productionQuantity.mode, 'write');
assert.equal(productionQuantity.eventKey, 'jobs.production.quantity_saved');

const crmClient = resolveModuleWriteBoundary('crm_client_save');
assert.equal(crmClient.ownerModule, 'jobs');
assert.equal(crmClient.minimum, 'approve');
assert.equal(crmClient.mode, 'write');
assert.equal(crmClient.eventKey, 'jobs.crm.customer_saved');

const crmInteraction = resolveModuleWriteBoundary('crm_interaction_save');
assert.equal(crmInteraction.ownerModule, 'jobs');
assert.equal(crmInteraction.minimum, 'approve');
assert.equal(crmInteraction.eventKey, 'jobs.crm.interaction_saved');

const crmFollowup = resolveModuleWriteBoundary('crm_followup_save');
assert.equal(crmFollowup.ownerModule, 'jobs');
assert.equal(crmFollowup.minimum, 'approve');
assert.equal(crmFollowup.eventKey, 'jobs.crm.followup_saved');

const crmOpportunity = resolveModuleWriteBoundary('crm_opportunity_save');
assert.equal(crmOpportunity.ownerModule, 'jobs');
assert.equal(crmOpportunity.minimum, 'approve');
assert.equal(crmOpportunity.eventKey, 'jobs.crm.opportunity_saved');

const routeTerritory = resolveModuleWriteBoundary('route_territory_save');
assert.equal(routeTerritory.ownerModule, 'jobs');
assert.equal(routeTerritory.minimum, 'approve');
assert.equal(routeTerritory.mode, 'write');
assert.equal(routeTerritory.eventKey, 'jobs.route.territory_saved');

const routeSite = resolveModuleWriteBoundary('route_territory_site_save');
assert.equal(routeSite.ownerModule, 'jobs');
assert.equal(routeSite.minimum, 'approve');
assert.equal(routeSite.eventKey, 'jobs.route.territory_site_saved');

const routeGenerate = resolveModuleWriteBoundary('route_optimization_generate');
assert.equal(routeGenerate.ownerModule, 'jobs');
assert.equal(routeGenerate.minimum, 'approve');
assert.equal(routeGenerate.eventKey, 'jobs.route.optimization_generated');

const routeDecision = resolveModuleWriteBoundary('route_optimization_decision');
assert.equal(routeDecision.ownerModule, 'jobs');
assert.equal(routeDecision.minimum, 'approve');
assert.equal(routeDecision.eventKey, 'jobs.route.optimization_decided');

const workabilityRule = resolveModuleWriteBoundary('workability_rule_save');
assert.equal(workabilityRule.ownerModule, 'jobs');
assert.equal(workabilityRule.minimum, 'approve');
assert.equal(workabilityRule.mode, 'write');
assert.equal(workabilityRule.eventKey, 'jobs.workability.rule_saved');

const workabilityObservation = resolveModuleWriteBoundary('workability_observation_save');
assert.equal(workabilityObservation.ownerModule, 'jobs');
assert.equal(workabilityObservation.minimum, 'approve');
assert.equal(workabilityObservation.eventKey, 'jobs.workability.observation_saved');

const workabilityDecision = resolveModuleWriteBoundary('workability_decision_save');
assert.equal(workabilityDecision.ownerModule, 'jobs');
assert.equal(workabilityDecision.minimum, 'approve');
assert.equal(workabilityDecision.eventKey, 'jobs.workability.decision_saved');

const workabilityNotification = resolveModuleWriteBoundary('workability_notification_readiness_save');
assert.equal(workabilityNotification.ownerModule, 'jobs');
assert.equal(workabilityNotification.minimum, 'approve');
assert.equal(workabilityNotification.eventKey, 'jobs.workability.notification_readiness_saved');

const materialEstimator = resolveModuleWriteBoundary('landscape_material_estimate_save');
assert.equal(materialEstimator.ownerModule, 'jobs');
assert.equal(materialEstimator.minimum, 'approve');
assert.equal(materialEstimator.mode, 'write');
assert.equal(materialEstimator.eventKey, 'jobs.material_estimator.plan_saved');

const materialActual = resolveModuleWriteBoundary('landscape_material_actual_use_save');
assert.equal(materialActual.ownerModule, 'jobs');
assert.equal(materialActual.minimum, 'approve');
assert.equal(materialActual.mode, 'write');
assert.equal(materialActual.eventKey, 'jobs.material_estimator.actual_use_saved');

const qcTemplate = resolveModuleWriteBoundary('quality_control_template_save');
const qcRun = resolveModuleWriteBoundary('quality_control_run_save');
const qcEvidence = resolveModuleWriteBoundary('quality_control_evidence_link');
const qcDeficiency = resolveModuleWriteBoundary('quality_control_deficiency_save');
const qcRework = resolveModuleWriteBoundary('quality_control_rework_save');
const qcReview = resolveModuleWriteBoundary('quality_control_review');
assert.equal(qcTemplate.ownerModule,'jobs'); assert.equal(qcTemplate.minimum,'approve');
for (const boundary of [qcRun,qcEvidence,qcDeficiency,qcRework]) { assert.equal(boundary.ownerModule,'jobs'); assert.equal(boundary.minimum,'create'); }
assert.equal(qcReview.ownerModule,'jobs'); assert.equal(qcReview.minimum,'approve'); assert.equal(qcReview.crossModule,true);

const seasonalCycle = resolveModuleWriteBoundary('seasonal_cycle_save');
const seasonalChecklist = resolveModuleWriteBoundary('seasonal_checklist_save');
const seasonalReadiness = resolveModuleWriteBoundary('seasonal_readiness_save');
const seasonalRollover = resolveModuleWriteBoundary('seasonal_rollover_save');
const seasonalStorm = resolveModuleWriteBoundary('seasonal_storm_event_save');
const seasonalStormRoute = resolveModuleWriteBoundary('seasonal_storm_route_activation_save');
for (const boundary of [seasonalCycle,seasonalChecklist,seasonalReadiness,seasonalRollover,seasonalStorm,seasonalStormRoute]) {
  assert.equal(boundary.ownerModule,'jobs'); assert.equal(boundary.minimum,'approve'); assert.equal(boundary.mode,'write');
}
for (const boundary of [seasonalCycle,seasonalReadiness,seasonalRollover,seasonalStorm,seasonalStormRoute]) assert.equal(boundary.crossModule,true);
assert.equal(seasonalChecklist.crossModule,false);

const disabled = resolveModuleWriteBoundary('deposit_status_update');
assert.equal(disabled.ownerModule, 'finance');
assert.equal(disabled.minimum, 'manage');
assert.equal(disabled.mode, 'disabled');

assert.equal(resolveModuleWriteBoundary('not_a_real_action'), null, 'Unknown actions must resolve to null, never Admin/manage.');
assert.equal(resolveModuleWriteBoundary(''), null);
assert.equal(resolveModuleWriteBoundary(null), null);

const audit = boundaryAuditFields(jobsWrite);
assert.deepEqual({ ...audit }, {
  boundary_owner_module: 'jobs',
  boundary_minimum_access: 'create',
  boundary_mode: 'write',
  boundary_event_key: 'jobs.execution_proof.submitted',
  cross_module_event: true,
});

const unknownAudit = boundaryAuditFields(null);
assert.deepEqual({ ...unknownAudit }, {
  boundary_owner_module: null,
  boundary_minimum_access: null,
  boundary_mode: null,
  boundary_event_key: null,
  cross_module_event: false,
});

for (const action of Array.from(MODULE_WRITE_ACTIONS)) {
  const boundary = resolveModuleWriteBoundary(action);
  assert.ok(boundary, `Contract should resolve: ${action}`);
  assert.equal(boundary.action, action, `Contract key/action must agree: ${action}`);
  assert.ok(['safety','finance','jobs','admin'].includes(boundary.ownerModule));
  assert.ok(['view','create','approve','manage'].includes(boundary.minimum));
  assert.ok(['read','write','disabled'].includes(boundary.mode));
  if (boundary.crossModule) assert.ok(boundary.eventKey, `Cross-module contract needs event key: ${action}`);
}

const coDiscovery = resolveModuleWriteBoundary('change_order_discovery_save');
const coEvidence = resolveModuleWriteBoundary('change_order_evidence_save');
const coReview = resolveModuleWriteBoundary('change_order_review_price');
const coAuth = resolveModuleWriteBoundary('change_order_customer_authorization');
const coApply = resolveModuleWriteBoundary('change_order_apply');
const coInvoice = resolveModuleWriteBoundary('change_order_invoice_evidence_save');
assert.equal(coDiscovery.ownerModule, 'jobs'); assert.equal(coDiscovery.minimum, 'create');
assert.equal(coEvidence.ownerModule, 'jobs'); assert.equal(coEvidence.minimum, 'create');
for (const boundary of [coReview,coAuth,coApply,coInvoice]) { assert.equal(boundary.ownerModule,'jobs'); assert.equal(boundary.minimum,'approve'); }
assert.equal(coApply.crossModule,true); assert.equal(coInvoice.crossModule,true);
console.log('PASS boundary-build346-seasonal-operations-centre');
console.log('PASS boundary-exact-90-actions');
console.log('PASS boundary-build345-quality-control-customer-signoff');
console.log('PASS boundary-build344-change-orders-extras');
console.log('PASS boundary-build343-landscape-material-estimator');
console.log('PASS boundary-build342-weather-workability');
console.log('PASS boundary-build341-route-optimization');
console.log('PASS boundary-build340-customer-property-crm');
console.log('PASS boundary-build320-attention-management');
console.log('PASS boundary-build322-recurring-service-management');
console.log('PASS boundary-build323-property-site-management');
console.log('PASS boundary-build324-estimate-job-invoice-management');
console.log('PASS boundary-build325-landscape-production-management');
console.log('PASS boundary-build328-job-hazard-plans');
console.log('PASS boundary-build329-incident-investigation');
console.log('PASS boundary-build330-training-certification-matrix');
console.log('PASS boundary-finance-read-write-ownership');
console.log('PASS boundary-jobs-cross-module-event');
console.log('PASS boundary-admin-write-ownership');
console.log('PASS boundary-disabled-payment-mutation');
console.log('PASS boundary-unknown-action-fails-closed');
console.log('PASS boundary-audit-metadata');
console.log('PASS boundary-all-contracts-valid');
console.log('\nSchema 234 module write-boundary behavior gate passed: 18/18 checks.');
