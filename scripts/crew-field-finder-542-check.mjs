import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('js/mobile-today.js', 'utf8');
let serviceCalls = 0;
const browser = {
  YWIAPI: {
    fetchMobileCrewContext() { serviceCalls++; throw new Error('A display filter must not fetch data'); },
    manageOperations() { serviceCalls++; throw new Error('A display filter must not write data'); }
  }
};
vm.runInNewContext(source, {
  window: browser,
  document: { addEventListener() {} },
  navigator: { onLine: true },
  console
}, { filename:'mobile-today.js' });

const route = [
  {
    dispatch:{id:'alpha',route_order:1},
    job:{job_name:'Maple mowing',job_code:'MAP-1'},
    work_order:{work_order_number:'WO-1'},
    site:{site_name:'Maple Lawn',service_address:'10 Test Road',city:'Tillsonburg',hazard_notes:'Wet slope'},
    equipment:[]
  },
  {
    dispatch:{id:'beta',route_order:2},
    job:{job_name:'Oak hedge work',job_code:'OAK-2'},
    work_order:{work_order_number:'WO-2'},
    site:{site_name:'Oak Property',service_address:'44 Cedar Street',city:'Woodstock'},
    equipment:[]
  },
  {
    dispatch:{id:'gamma',route_order:3},
    job:{job_name:'Elm snow clearing'},
    site:{site_name:'Elm Property',city:'Ingersoll'},
    equipment:[{is_locked_out:true,defect_status:'lockout'}]
  }
];
const find = browser.YWIMobileToday.crewVisibleRows;
const indices = (rows) => Array.from(rows, ({ index }) => index).join(',');
assert.equal(indices(find(route, '', false)), '0,1,2', 'Preserve server-assigned route order');
assert.equal(indices(find(route, 'cedar', false)), '1', 'Find by property address');
assert.equal(indices(find(route, 'oak-2', false)), '1', 'Find by job code');
assert.equal(indices(find(route, 'slope', false)), '0', 'Find assigned site notes');
assert.equal(indices(find(route, '', true)), '0,2', 'Cautions include hazard notes and equipment lockout');
assert.equal(indices(find(route, 'elm', true)), '2', 'Combined search retains canonical source index');
assert.equal(indices(find(route, 'no match', false)), '', 'An empty match cannot introduce other jobs');
assert.equal(indices(find(null, '', false)), '', 'Unavailable assigned work remains empty');
assert.equal(serviceCalls, 0, 'Presentation-only filters must not contact a server');
assert.ok(source.includes("state.crewSearch=''; state.crewSiteCautionsOnly=false;"), 'Clear filters on identity change');
assert.ok(source.includes('state.crewAuthEpoch += 1'), 'Invalidate stale requests before changing identity');
assert.match(source, /crewEscape\(state\.crewSearch\)/, 'Escape search value in markup');
assert.match(source, /visible\.map\(\(\{ row, index \}\) => crewCard\(row, index\)\)/, 'Preserve canonical index in actions');
assert.match(source, /No assigned work matches these filters/, 'Differentiate no matches from no assignments');
console.log('Build 542 Crew Field Finder source and permission boundary GREEN');
