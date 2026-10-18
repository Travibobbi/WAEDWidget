const {test}=require('node:test'),assert=require('node:assert/strict');
const h=require('../main/assets/analysis/hospital-pages.js'),insights=require('../main/assets/analysis/insights.js');
const archive=require('../main/assets/analysis/archive.json').observations;
test('recent ramping months are consecutive and normalize unequal month lengths',()=>{
 const bars=h.recentMonths(archive,'royal-perth');assert.deepEqual(bars.map(b=>b.start),['2026-07-01','2026-08-01','2026-09-01','2026-10-01']);assert.deepEqual(bars.map(b=>b.days),[31,31,30,17]);assert(Math.abs(bars[3].rate-824.71/17)<1e-8);
 const missing=archive.filter(o=>o.period_start!=='2026-08-01');assert.equal(h.recentMonths(missing,'royal-perth')[1].rate,null);
 const jan=archive.filter(o=>o.source_id==='sjwa-ramping').map(o=>({...o,as_of_date:'2026-01-10'}));assert.deepEqual(h.recentMonths(jan,'royal-perth').map(b=>b.start),['2025-10-01','2025-11-01','2025-12-01','2026-01-01']);
});
test('T4 guides remain hourly including above the largest wait',()=>{assert.deepEqual(h.hourTicks([20,150,null]),[0,60,120,180]);assert.deepEqual(h.hourTicks([0]),[0,60]);});
test('daily highlights update their dates and use percentage points without bridging missing days',()=>{
 const row=(date,value)=>({source_id:'sjwa-response',period_type:'day',metric_id:'response_within_target_fraction',ambulance_priority:1,reporting_date:date,value});
 let cards=insights.build([row('2026-10-16',.7),row('2026-10-17',.75)],h);assert.equal(cards[0].date,'2026-10-17');assert.match(cards[0].summary,/5 percentage points higher/);
 cards=insights.build([row('2026-10-15',.7),row('2026-10-17',.75)],h);assert.match(cards[0].summary,/Previous day unavailable/);
 cards=insights.build([row('2026-10-17',.75),row('2026-10-18',null)],h);assert.equal(cards.length,0);
});
