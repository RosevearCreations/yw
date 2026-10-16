// Build 404 — read-only, fail-closed first operational cohort measurement.
// Caller supplies canonical, permission-authorized source snapshots. No fetching or writes.
export const STAGES = Object.freeze(['intake','dispatch','production','qc','invoice']);
const validDate = value => Number.isFinite(Date.parse(value || ''));
const distinct = rows => new Set(rows.map(row => row?.job_id).filter(Boolean));
export function measureFirstOperationalCohort(input, now = new Date().toISOString()) {
  const minimum = Math.max(10, Number.isInteger(input?.minimum_sample) ? input.minimum_sample : 10);
  const maxAgeMs = 15 * 60 * 1000;
  const nowMs = Date.parse(now);
  const snapshots = input?.sources || {};
  const result = {status:'withheld', reason:null, minimum_sample:minimum, stages:[], conversions:[]};
  if (!Number.isFinite(nowMs)) return {...result,reason:'Invalid reference time'};
  for (const name of STAGES) {
    const src = snapshots[name];
    const readAt = Date.parse(src?.retrieved_at || '');
    const complete = src?.authorized === true && src?.query_ok === true &&
      src?.coverage === 'complete' && src?.capped === false &&
      Number.isFinite(readAt) && readAt <= nowMs &&
      nowMs - readAt <= maxAgeMs && Array.isArray(src?.rows);
    if (!complete) {
      result.stages.push({name,status:'withheld',count:null,reason:'Missing, unauthorized, stale or incomplete source'});
      continue;
    }
    const rows = src.rows;
    if (rows.some(r => !r || !r.job_id || !validDate(r.occurred_at) ||
        Date.parse(r.occurred_at) > nowMs)) {
      result.stages.push({name,status:'withheld',count:null,reason:'Missing or invalid canonical provenance'});
      continue;
    }
    const ids=distinct(rows);
    result.stages.push({name,status:'measured',count:ids.size,ids:[...ids]});
  }
  if (result.stages.some(s=>s.status==='withheld')) {
    result.reason='One or more canonical sources cannot be measured safely';
    return result;
  }
  const [intake,...rest]=result.stages;
  if (intake.count < minimum) {
    result.reason='Cohort below minimum sample; conversion rates withheld';
    result.stages.forEach(s=>delete s.ids);
    return result;
  }
  let prior=new Set(intake.ids);
  for (const stage of rest) {
    const current=new Set(stage.ids.filter(id=>prior.has(id)));
    result.conversions.push({from:STAGES[result.conversions.length],to:stage.name,
      denominator:prior.size,numerator:current.size,
      rate:prior.size >= minimum ? current.size/prior.size : null,
      status:prior.size >= minimum ? 'measured':'withheld'});
    prior=current;
  }
  result.stages.forEach(s=>delete s.ids);
  result.status='measured';
  return result;
}
