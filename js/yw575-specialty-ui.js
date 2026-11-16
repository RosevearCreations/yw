/* YW575 custom Ponds / Skateparks: two separate planning modules.
 * Read-only, ephemeral estimator/checklist. No quote, DB writes, approval, dispatch. */
(()=>{'use strict';
const registry=new Map();
const byId=id=>document.getElementById(id);
const txt=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
const permitted=()=>{
 const a=window.YWI_AUTH?.getState?.()||{},w=window.YWIDualWorkspace?.snapshot?.()||{};
 return a.isAuthenticated===true&&(w.ownedCompanies>0||window.YWIDualWorkspace?.isSysopVerified?.()===true);
};
function render(key){
 const spec=registry.get(key),host=byId(key==='ponds'?'yw575PondWorkspace':'yw575SkateWorkspace');
 if(!spec||!host)return;
 host.replaceChildren();
 if(!permitted()){host.append(txt('p','This workspace requires verified company ownership or separately enrolled platform authority. Sign in and refresh verification.'));return;}
 const summary=txt('p','Planning workspace · no data saved, no approved drawings, no service order and no inspection certification.');
 summary.className='notice';host.append(summary);
 const card=txt('section','');card.className='admin-panel-block';card.append(txt('h3',spec.title));
 card.append(txt('p',spec.intro));
 const form=document.createElement('form');form.className='yw575-estimator';
 const fields=document.createElement('div');fields.className='yw575-input-grid';
 const vals={};
 for(const field of spec.fields){
   const label=txt('label',field.label);const input=document.createElement('input');input.type='number';
   input.min=String(field.min);input.max=String(field.max);input.step=String(field.step);input.value=String(field.default);
   input.required=true;input.dataset.field=field.id;vals[field.id]=input;label.append(input);fields.append(label);
 }
 form.append(fields);
 const calc=txt('button','Calculate planning quantities');calc.type='submit';calc.className='secondary';
 const result=txt('output','Enter preliminary dimensions; a licensed designer/engineer must confirm all construction quantities.');
 result.className='notice';result.setAttribute('aria-live','polite');
 form.append(calc,result);form.addEventListener('submit',e=>{
  e.preventDefault();if(!permitted()){result.textContent='WITHHELD: verified company access is required.';return;}
  const values={};for(const field of spec.fields){const n=Number(vals[field.id].value);
   if(!Number.isFinite(n)||n<field.min||n>field.max){result.textContent='Dimensions must stay within the supported preliminary range.';return;}
   values[field.id]=n;
  }result.textContent=spec.calculate(values);
 });
 card.append(form);host.append(card);
 const grid=txt('div','');grid.className='yw575-stage-grid';
 for(const stage of spec.stages){
   const group=txt('fieldset','');group.className='admin-panel-block';
   group.append(txt('legend',stage.name));
   for(const item of stage.tasks){const label=txt('label','');label.className='yw575-task';
    const input=document.createElement('input');input.type='checkbox';
    const t=txt('span',item);label.append(input,t);group.append(label);
   }grid.append(group);
 }
 host.append(grid);
 const note=txt('p','Checklist ticks are a temporary personal planning aid, not official sign-off or proof of compliance. Engineering, municipal approvals, contractor credentials and independent safety review remain mandatory.');
 note.className='notice';host.append(note);
}
function register(spec){
 if(!spec||!['ponds','skateparks'].includes(spec.id)||registry.has(spec.id)||typeof spec.calculate!=='function')return;
 registry.set(spec.id,spec);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>render(spec.id),{once:true});
 else render(spec.id);
}
function refresh(){for(const key of registry.keys())render(key);}
document.addEventListener('ywi:workspace-authority-changed',refresh);
document.addEventListener('ywi:auth-changed',refresh);
document.addEventListener('ywi:module-permissions-changed',refresh);
const style=document.createElement('style');style.textContent=
 '.yw575-input-grid,.yw575-stage-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:14px 0}'+
 '.yw575-task{display:flex;align-items:flex-start;gap:10px;line-height:1.4;margin:9px 0}'+
 '.yw575-task input{width:auto;min-width:18px;min-height:18px;margin-top:3px}'+
 '.yw575-estimator button{min-height:44px}.yw575-estimator output{display:block;margin-top:12px;overflow-wrap:anywhere}'+
 '@media(max-width:560px){.yw575-input-grid,.yw575-stage-grid{grid-template-columns:1fr}}';
document.head.append(style);
window.YWI575Specialty=Object.freeze({register,refresh,permitted});
})();
