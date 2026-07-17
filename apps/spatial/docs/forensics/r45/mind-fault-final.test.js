import { it } from 'vitest'; import { writeFileSync } from 'node:fs';
import { segment, renderFrame, parsePlanSteps, rolloutPlan, buildMoveTrace } from '../index.ts';
const okGrid=(n,v=0)=>Array.from({length:n},()=>Array.from({length:n},()=>v));
const fullObs=(g,s='NOT_FINISHED')=>({state:s,levelsCompleted:0,winLevels:1,availableActions:[1,2,3,4],grid:g,segments:null});
const norm=(c)=> (c&&typeof c==='object'&&typeof c.name==='string')?{name:c.name}:null;
it('r45-final',()=>{const out=[];
  // V1 malformed: segment() on ragged rows in isolation (the true malformed-grid contract test)
  try{ segment([[0,1,2],[0],[0,1]]); out.push('V1 segment(ragged): no throw'); }catch(e){ out.push('V1 segment(ragged) THREW: '+String(e).slice(0,70)); }
  // V6 valid large grid with a CORRECT Obs
  const big=okGrid(1000); const t0=performance.now();
  try{ segment(big); renderFrame(fullObs(big),null); out.push('V6 1000x1000 ok ms='+Math.round(performance.now()-t0)); }catch(e){ out.push('V6 THREW: '+String(e).slice(0,70)); }
  // V2 REAL: rollout ignores per-step expect
  const sim=(()=>{let a=0;return{reset(){a=0;return fullObs(okGrid(4));},act(){a++;const g=okGrid(4);g[1][1]=a%9;return fullObs(g);}};})();
  const plan=parsePlanSteps([{action:{name:'NOOP'},expect:'moved:3:up'}],norm);
  out.push('V2 rollout(NOOP expects moved): '+JSON.stringify(rolloutPlan(sim,[],plan)));
  // V8 REAL: unbounded trace
  const huge='x'.repeat(2_000_000);
  const bytes=JSON.stringify(buildMoveTrace({sessionKey:'r45',turn:1,action:{name:'NOOP'},note:huge,reply:huge})).length;
  out.push('V8 trace bytes with 2MB note: '+bytes);
  writeFileSync('/tmp/r45-final.txt',out.join('\n'));
});
