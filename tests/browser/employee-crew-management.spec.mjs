import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const workforceSource=fs.readFileSync(path.join(process.cwd(),'js/admin-workforce-ui.js'),'utf8');

async function boot(page){
  await page.setContent('<!doctype html><html><body><section id="admin"><div class="admin-hub-shell"></div></section></body></html>');
  await page.evaluate(()=>{
    window.__workforce336Calls=[];
    const payload={
      ok:true,
      workforce_summary:[{active_profile_count:2,training_attention_count:1,authorization_attention_count:1,availability_attention_count:1}],
      workforce_profiles:[
        {id:'p1',full_name:'Avery Lead',email:'avery@example.invalid',employee_number:'E-001',role:'supervisor',current_position:'Crew Lead',employment_status:'active',is_active:true,workforce_availability_status:'available',seasonal_status:'year_round',workforce_state:'active',effective_supervisor_profile_id:'p2',primary_crew_name:'Maintenance A',skill_count:1,skills_json:[{skill_id:'s1',skill_name:'Crew Leadership',proficiency_level:'lead',verified_at:'2026-09-20T12:00:00Z'}],training_requirement_count:3,training_current_count:2,training_blocker_count:1,internal_authorization_pending_count:1},
        {id:'p2',full_name:'Morgan Admin',email:'morgan@example.invalid',employee_number:'E-002',role:'admin',current_position:'Operations Admin',employment_status:'active',is_active:true,workforce_availability_status:'limited',seasonal_status:'year_round',workforce_state:'active',skill_count:0,skills_json:[],training_requirement_count:1,training_current_count:1,training_blocker_count:0,internal_authorization_pending_count:0}
      ],
      workforce_private_contacts:[
        {id:'p1',phone:'519-555-0101',address_line1:'10 Private Rd',city:'Tillsonburg',province:'ON',postal_code:'N4G 1A1',emergency_contact_name:'Private Contact',emergency_contact_phone:'519-555-0199'},
        {id:'p2',phone:'519-555-0102'}
      ],
      workforce_skills:[{id:'s1',skill_name:'Crew Leadership',skill_category:'leadership',is_active:true},{id:'s2',skill_name:'Quality Control',skill_category:'leadership',is_active:true}],
      workforce_profile_skills:[],
      workforce_availability_windows:[{id:'a1',profile_id:'p1',availability_status:'preferred',day_of_week:1,start_time:'07:00:00',end_time:'16:00:00',is_active:true}],
      workforce_training_readiness:[
        {profile_id:'p1',requirement_code:'ORIENTATION_CORE',requirement_name:'Company / Field Orientation',readiness_status:'current',internal_authorization_required:false},
        {profile_id:'p1',requirement_code:'TRAILER_TOWING_AUTH',requirement_name:'Trailer / Towing Authorization',readiness_status:'internal_authorization_pending',internal_authorization_required:true,internal_authorization_status:'pending'}
      ],
      workforce_crews:[{id:'c1',crew_code:'MA',crew_name:'Maintenance A',crew_kind:'maintenance',crew_status:'active',seasonal_status:'year_round',supervisor_profile_id:'p1',lead_profile_id:'p1',supervisor_name:'Avery Lead',lead_name:'Avery Lead',active_member_count:2,members_json:[{profile_id:'p1',membership_status:'active',is_primary:true},{profile_id:'p2',membership_status:'active',is_primary:false}]}]
    };
    window.YWIAPI={
      loadAdminDirectory:async(req)=>{window.__workforce336Calls.push({kind:'load',req:structuredClone(req)});return structuredClone(payload);},
      manageAdminEntity:async(req)=>{window.__workforce336Calls.push({kind:'manage',req:structuredClone(req)});return {ok:true,record:{id:req.crew_id||req.item_id||'new-id',...req}};}
    };
  });
  await page.addScriptTag({content:workforceSource});
  await page.evaluate(()=>window.YWIWorkforceUI.mount({api:window.YWIAPI}));
}

test('Build 336 renders privacy-aware employee and crew readiness',async({page})=>{
  await boot(page);
  const panel=page.locator('#employeeCrewManagement336');
  await expect(panel).toHaveAttribute('data-admin-hub-groups','people');
  await expect(panel.locator('[data-build="336"]')).toBeVisible();
  await expect(panel).toContainText('Employee & Crew Management');
  await expect(panel).toContainText('Privacy boundary');
  await expect(panel).toContainText('Build 330 remains the training and internal-authorization authority');
  await expect(page.locator('#workforce336Summary')).toContainText('Training attention');
  await expect(page.locator('#workforce336Readiness')).toContainText('internal authorization pending 1');
  await expect(page.locator('#workforce336EvidenceBody')).toContainText('Trailer / Towing Authorization');
  await expect(page.locator('#workforce336EvidenceBody')).toContainText('internal authorization pending');
  await expect(page.locator('#workforce336CrewBody')).toContainText('Maintenance A');
});

test('Build 336 writes through bounded canonical workforce actions',async({page})=>{
  await boot(page);
  await page.selectOption('#workforce336Seasonal','spring_summer');
  await page.selectOption('#workforce336AvailabilityStatus','limited');
  await page.locator('#workforce336PrivateContacts > summary').click();
  await expect(page.locator('#workforce336PrivateContacts')).toHaveAttribute('open','');
  await page.fill('#workforce336Phone','519-555-0111');
  await page.click('#workforce336SaveProfile');

  await page.selectOption('#workforce336Skill','s2');
  await page.selectOption('#workforce336Proficiency','advanced');
  await page.check('#workforce336SkillVerified');
  await page.fill('#workforce336SkillEvidence','Supervisor observation');
  await page.click('#workforce336AssignSkill');

  await page.selectOption('#workforce336Day','2');
  await page.selectOption('#workforce336WindowStatus','preferred');
  await page.fill('#workforce336StartTime','07:30');
  await page.fill('#workforce336EndTime','16:30');
  await page.click('#workforce336AddAvailability');

  await page.selectOption('#workforce336Crew','');
  await page.fill('#workforce336CrewCode','LAND-B');
  await page.fill('#workforce336CrewName','Landscape B');
  await page.selectOption('#workforce336CrewSupervisor','p1');
  await page.selectOption('#workforce336CrewLead','p1');
  await page.selectOption('#workforce336CrewMembers',['p1','p2']);
  await page.click('#workforce336SaveCrew');

  const calls=await page.evaluate(()=>window.__workforce336Calls.filter((x)=>x.kind==='manage').map((x)=>x.req));
  expect(calls.some((x)=>x.entity==='workforce_profile'&&x.action==='save'&&x.seasonal_status==='spring_summer'&&x.phone==='519-555-0111')).toBeTruthy();
  expect(calls.some((x)=>x.entity==='workforce_profile_skill'&&x.action==='save'&&x.skill_id==='s2'&&x.proficiency_level==='advanced'&&x.verified===true)).toBeTruthy();
  expect(calls.some((x)=>x.entity==='workforce_availability'&&x.action==='save'&&String(x.day_of_week)==='2')).toBeTruthy();
  expect(calls.some((x)=>x.entity==='workforce_crew'&&x.action==='save'&&x.crew_name==='Landscape B'&&x.members.length===2)).toBeTruthy();
});
