const {test}=require('node:test'),assert=require('node:assert/strict');
const h=require('../main/assets/analysis/hospital-pages.js');
const archive=require('../main/assets/analysis/archive.json').observations;
test('metro pages cover ten hospitals; current month uses source as-of date',()=>{
 assert.equal(h.hospitals.length,10);const m=h.rampModel(archive,'royal-perth');
 assert.deepEqual(m.bars.map(b=>b.year),[2023,2024,2025,2026]);assert.equal(m.asOf,'2026-09-15');
 assert.equal(m.bars[3].days,15);assert.equal(m.bars[2].days,30);assert(Math.abs(m.bars[3].rate-751.29/15)<1e-8);
 assert.equal(m.direction,'up'); // Current partial total is lower, but daily rate is higher.
});
test('missing previous-year values never produce an improvement arrow',()=>{
 const rows=archive.filter(o=>!(o.establishment_id==='royal-perth'&&o.period_start==='2025-09-01'));
 assert.equal(h.rampModel(rows,'royal-perth').direction,'unknown');
});
test('zero previous rate avoids infinite percentage and still has direction',()=>{
 const rows=archive.map(o=>o.establishment_id==='royal-perth'&&o.period_start==='2025-09-01'?{...o,value:0}:o);
 const m=h.rampModel(rows,'royal-perth');assert.equal(m.percent,null);assert.equal(m.direction,'up');
});
test('T4 uses Perth source dates, deduplicates repeated exports and preserves missing series',()=>{
 const row={hospital:'Royal Perth Hospital',source_time:Date.parse('2026-09-14T16:30:00Z'),wait:20};
 const rows=[row,row,{...row,source_time:row.source_time+60000,wait:40}];
 const m=h.t4Model(archive,rows,'royal-perth'),p=m.points.find(p=>p.date==='2026-09-15');
 assert.equal(p.captured,30);assert.equal(p.samples,2);assert.equal(m.matched,1);
 assert.equal(m.points.find(p=>p.date==='2026-09-14').captured,null);
 assert.equal(h.t4Model(archive,rows,'fiona-stanley').capturedDays,0);
});
test('every hospital renders both pages with no widget history',()=>{
 for(let i=0;i<h.hospitals.length;i++){assert.match(h.render('ramping',i,archive,[]),/<svg/);assert.match(h.render('t4',i,archive,[]),/No captured T4 readings/);}
});
