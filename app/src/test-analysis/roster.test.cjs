const {test}=require('node:test'),assert=require('node:assert/strict');
const r=require('../main/assets/analysis/roster.js');
const time=s=>Date.parse(s+'+08:00');
test('confirmed eight-day roster repeats forward and backward',()=>{
 for(let d=18;d<=27;d++){const block=Math.floor((d-18)%8/2);assert.equal(r.shiftAt(time('2026-09-'+d+'T07:00:00')).colour,['Black','Green','Red','Blue'][block]);assert.equal(r.shiftAt(time('2026-09-'+d+'T18:00:00')).colour,['Blue','Black','Green','Red'][block]);}
 assert.equal(r.shiftAt(time('2026-09-17T12:00:00')).colour,'Blue');
 assert.equal(r.shiftAt(time('2026-09-17T23:00:00')).colour,'Red');
});
test('07 and 18 boundaries and overnight date use Perth source time',()=>{
 let s=r.shiftAt(time('2026-09-20T06:59:59'));assert.equal(s.colour,'Blue');assert.equal(s.date,'2026-09-19');assert.equal(s.type,'Night');assert.equal(s.duration,13);
 s=r.shiftAt(time('2026-09-20T07:00:00'));assert.equal(s.colour,'Green');assert.equal(s.type,'Day');assert.equal(s.duration,11);
 assert.equal(r.shiftAt(time('2026-09-20T17:59:59')).colour,'Green');assert.equal(r.shiftAt(time('2026-09-20T18:00:00')).colour,'Black');
 assert.equal(r.shiftAt(time('2026-01-01T01:00:00')).date,'2025-12-31');assert.equal(r.shiftAt(NaN),null);
});
test('each shift has equal weight and repeated timestamps do not inflate coverage',()=>{
 const row=(date,wait)=>({hospital:'Royal Perth Hospital',source_time:time(date),wait});
 const rows=[row('2026-09-18T07:00:00',10),row('2026-09-18T07:30:00',10),row('2026-09-18T08:00:00',10),row('2026-09-19T07:00:00',90)];rows.push(rows[0],row('2026-09-18T18:00:00',100),row('2026-09-18T09:00:00',-1));
 const m=r.model(rows,'Royal Perth Hospital','Day'),g=m.groups[0];assert.equal(g.value,50);assert.equal(g.shifts,2);assert.equal(g.samples,4);assert.equal(g.hours,3);assert.equal(g.possibleHours,22);assert.equal(m.excluded,1);assert.equal(m.groups[1].value,null);
 assert.equal(r.model(rows,'Other Hospital','Day').records.length,0);
});
