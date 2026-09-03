from pathlib import Path
import json


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing replacement anchor: {label}')
    return text.replace(old, new, 1)

# Admin I.T. protected endpoint.
p=Path('supabase/functions/admin-it-control/index.ts'); s=p.read_text()
s=replace_once(s,
  '    scorecard_truth_status: ["v_it_scorecard_progress_truth_status", null, true, 10],\n',
  '    scorecard_truth_status: ["v_it_scorecard_progress_truth_status", null, true, 10],\n    open_rail_acceptance_readiness: ["v_it_open_rail_acceptance_readiness", "sort_order", true, 80],\n',
  'endpoint source')
s=replace_once(s,
  '    scorecardTruthAssertions,\n    consumerObservabilityAssertions,',
  '    scorecardTruthAssertions,\n    openRailReadinessAssertions,\n    consumerObservabilityAssertions,',
  'endpoint destructure')
s=replace_once(s,
  '    assertionRows(supabase, "ywi_it_scorecard_truth_assertions", "I.T. scorecard-truth assertions failed."),\n    assertionRows(supabase, "ywi_it_cross_module_consumer_observability_assertions",',
  '    assertionRows(supabase, "ywi_it_scorecard_truth_assertions", "I.T. scorecard-truth assertions failed."),\n    assertionRows(supabase, "ywi_open_rail_acceptance_readiness_assertions", "Open-rail acceptance-readiness assertions failed."),\n    assertionRows(supabase, "ywi_it_cross_module_consumer_observability_assertions",',
  'endpoint promise')
s=replace_once(s,
  '    ...scorecardTruthAssertions.rows,\n    ...consumerObservabilityAssertions.rows,',
  '    ...scorecardTruthAssertions.rows,\n    ...openRailReadinessAssertions.rows,\n    ...consumerObservabilityAssertions.rows,',
  'endpoint combined')
s=replace_once(s,
  '    scorecardTruthAssertions.error,\n    consumerObservabilityAssertions.error,',
  '    scorecardTruthAssertions.error,\n    openRailReadinessAssertions.error,\n    consumerObservabilityAssertions.error,',
  'endpoint errors')
s=replace_once(s,
  '  const overallStatus = criticalBlocking > 0\n',
  '  const openRailRows = data.open_rail_acceptance_readiness?.rows || [];\n  const openRailTechnicalReadyCount = openRailRows.filter((row:any) => String(row?.technical_readiness_status || "").toLowerCase() === "ready").length;\n  const openRailPendingCount = openRailRows.filter((row:any) => String(row?.technical_readiness_status || "").toLowerCase() === "pending").length;\n\n  const overallStatus = criticalBlocking > 0\n',
  'endpoint readiness counts')
s=replace_once(s,
  '      scorecard_external_pending_count: Number(scorecardTruthRow?.external_pending_count || 0),\n',
  '      scorecard_external_pending_count: Number(scorecardTruthRow?.external_pending_count || 0),\n      open_rail_acceptance_count: openRailRows.length,\n      open_rail_technical_ready_count: openRailTechnicalReadyCount,\n      open_rail_technical_pending_count: openRailPendingCount,\n',
  'endpoint summary')
s=replace_once(s,
  '      scorecard_truth: scorecardTruthAssertions.rows,\n      consumer_observability:',
  '      scorecard_truth: scorecardTruthAssertions.rows,\n      open_rail_acceptance_readiness: openRailReadinessAssertions.rows,\n      consumer_observability:',
  'endpoint assertions output')
p.write_text(s)

# Admin I.T. UI.
p=Path('js/it-readiness-ui.js'); s=p.read_text()
s=replace_once(s,
  "'mapping_decision_support_status','scorecard_truth_status','truth_status','resolution_status']",
  "'mapping_decision_support_status','scorecard_truth_status','truth_status','resolution_status','technical_readiness_status']",
  'ui status')
s=replace_once(s,
  "for (const key of ['release_message','truth_message','resolution_note','message','details','description','action_hint'",
  "for (const key of ['current_action','technical_readiness_detail','evidence_requirement','release_message','truth_message','resolution_note','message','details','description','action_hint'",
  'ui detail')
s=replace_once(s,
  "      ...(Array.isArray(groups.scorecard_truth)?groups.scorecard_truth:[]),\n      ...(Array.isArray(groups.consumer_observability)?groups.consumer_observability:[]),",
  "      ...(Array.isArray(groups.scorecard_truth)?groups.scorecard_truth:[]),\n      ...(Array.isArray(groups.open_rail_acceptance_readiness)?groups.open_rail_acceptance_readiness:[]),\n      ...(Array.isArray(groups.consumer_observability)?groups.consumer_observability:[]),",
  'ui assertion group')

anchor='  function renderAdminIntegrity() {'
if anchor not in s: raise SystemExit('missing UI acceptance function anchor')
acceptance_fn="""  function renderAcceptanceReadiness() {
    const section=state.payload?.sections?.open_rail_acceptance_readiness;
    if(!section) return '<section class="it-readiness-panel"><span class="it-readiness-kicker">Acceptance Readiness</span><h3>Current action for human-gated rails</h3><div class="it-readiness-empty">No open-rail readiness source returned.</div></section>';
    if(section.error) return `<section class="it-readiness-panel"><span class="it-readiness-kicker">Acceptance Readiness</span><h3>Current action for human-gated rails</h3><div class="it-readiness-error">${esc(section.error)}</div></section>`;
    const rows=Array.isArray(section.rows)?section.rows:[];
    return `<section class="it-readiness-panel"><span class="it-readiness-kicker">Acceptance Readiness</span><h3>Current action for human-gated rails</h3><p>Technical readiness is separate from human acceptance. Historical scorecard hints remain audit evidence; follow the current action below.</p>${rows.length?`<div class="it-readiness-list">${rows.map((row)=>{
      const qualifiers=[];
      if(row?.requires_human===true)qualifiers.push('human required');
      if(row?.requires_external===true)qualifiers.push('external evidence');
      if(row?.resolution_class)qualifiers.push(String(row.resolution_class).replaceAll('_',' '));
      return `<div class="it-readiness-row"><div><strong>${esc(row.rail_title||row.rail_key||'Acceptance rail')}</strong><small><b>Current action:</b> ${esc(row.current_action||'')}</small><small><b>Evidence:</b> ${esc(row.evidence_requirement||'')}</small><small><b>Technical truth:</b> ${esc(row.technical_readiness_detail||row.technical_readiness_code||'')}</small>${row.historical_hint_stale===true?'<small><b>Historical deploy hint is stale.</b> It is retained only for audit history.</small>':''}${qualifiers.length?`<small>${esc(qualifiers.join(' · '))}</small>`:''}</div>${statusChip(row.technical_readiness_status||'pending')}</div>`;
    }).join('')}</div>`:'<div class="it-readiness-empty">No open business acceptance rails are currently pending.</div>'}</section>`;
  }

"""
s=s.replace(anchor, acceptance_fn+anchor, 1)
s=replace_once(s,
  "        ${panel('scorecard_truth_status','Scorecard truth','Readiness-work classification integrity')}\n        ${panel('scorecard_truth','Outstanding work','Verified closures and classified pending rails')}",
  "        ${panel('scorecard_truth_status','Scorecard truth','Readiness-work classification integrity')}\n        ${renderAcceptanceReadiness()}\n        ${panel('scorecard_truth','Outstanding work','Verified closures and classified pending rails')}",
  'ui grid')
p.write_text(s)

# Browser acceptance: enrich existing I.T. phone/desktop proof.
p=Path('tests/browser/it-scorecard-truth.spec.mjs'); s=p.read_text()
s=replace_once(s,
  "      readiness_blockers:0,assertion_blockers:0,\n",
  "      readiness_blockers:0,assertion_blockers:0,open_rail_acceptance_count:11,open_rail_technical_ready_count:8,open_rail_technical_pending_count:3,\n",
  'browser summary')
s=replace_once(s,
  "      scorecard_truth:[{assertion_key:'it_scorecard_truth_open_rails_classified',assertion_status:'passed',details:'Every open scorecard rail has an explicit current resolution class.'}],\n",
  "      scorecard_truth:[{assertion_key:'it_scorecard_truth_open_rails_classified',assertion_status:'passed',details:'Every open scorecard rail has an explicit current resolution class.'}],\n      open_rail_acceptance_readiness:[{assertion_key:'open_rail_stale_hints_overridden',assertion_status:'passed',details:'Known stale deploy instructions are overridden by current actions.'}],\n",
  'browser assertions')
s=replace_once(s,
  "      scorecard_truth:{...empty,rows:[\n",
  "      open_rail_acceptance_readiness:{...empty,rows:[\n        {rail_key:'quote_intake_live',rail_title:'Public quote and contact intake',resolution_class:'staging_acceptance',requires_human:true,requires_external:false,technical_readiness_status:'ready',technical_readiness_code:'ready_for_dedicated_staging_evidence',technical_readiness_detail:'Schema 188/188 current; catalog controls green.',current_action:'Do not redeploy Production or reapply an old schema. Confirm quote-contact-submit is present in the dedicated staging project, then execute the invalid-payload, valid STAGING request, event-history, and fixture-cleanup cases from the acceptance catalog.',evidence_requirement:'Evidence must include rejection, exactly one staging request, matching event, cleanup and signoff.',historical_hint_stale:true},\n        {rail_key:'live_job_updates',rail_title:'Live job updates',resolution_class:'staging_acceptance',requires_human:true,requires_external:false,technical_readiness_status:'ready',technical_readiness_code:'ready_for_dedicated_staging_evidence',technical_readiness_detail:'Schema 188/188 current; catalog controls green.',current_action:'Schema 188 already includes the historical live-update schema work; do not reapply Schema 155. In dedicated staging, test staff-only visibility, customer-visible updates, approved public media, and retraction.',evidence_requirement:'Evidence must prove privacy, customer visibility, approved media, retraction and signoff.',historical_hint_stale:true}\n      ],summary:{status:'warning',total:2,blocking:0,warning:0,error:null}},\n      scorecard_truth:{...empty,rows:[\n",
  'browser readiness rows')
s=replace_once(s,
  "    await expect(workspace).toContainText('Readiness-work classification integrity');\n",
  "    await expect(workspace).toContainText('Readiness-work classification integrity');\n    await expect(workspace).toContainText('Acceptance Readiness');\n    await expect(workspace).toContainText('Current action for human-gated rails');\n    await expect(workspace).toContainText('quote-contact-submit is present in the dedicated staging project');\n    await expect(workspace).toContainText('Schema 188 already includes the historical live-update schema work');\n    await expect(workspace).toContainText(/historical deploy hint is stale/i);\n",
  'browser expectations')
p.write_text(s)

# Package source gate.
p=Path('package.json'); data=json.loads(p.read_text(), object_pairs_hook=dict)
scripts=data['scripts']; rebuilt={}; inserted=False
for k,v in scripts.items():
    rebuilt[k]=v
    if k=='test:it-scorecard-truth':
        rebuilt['test:open-rail-readiness']='node scripts/open-rail-acceptance-readiness-check.mjs'
        inserted=True
if not inserted: raise SystemExit('missing package insertion anchor')
data['scripts']=rebuilt
p.write_text(json.dumps(data,indent=2)+"\n")

# Full CI source gate.
p=Path('.github/workflows/staging-browser-integration.yml'); s=p.read_text()
s=replace_once(s,
  '      - run: npm run test:it-scorecard-truth\n',
  '      - run: npm run test:it-scorecard-truth\n      - run: npm run test:open-rail-readiness\n',
  'workflow gate')
p.write_text(s)
