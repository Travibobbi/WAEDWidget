const {test}=require('node:test'),assert=require('node:assert/strict');
const h=require('../main/assets/analysis/hospital-pages.js'),r=require('../main/assets/analysis/roster.js'),a=require('../main/assets/analysis/archive.json').observations;
test('recovered daily response is continuous with three priorities and valid percentages',()=>{
 const rows=a.filter(o=>o.source_id==='sjwa-response'&&o.period_type==='day'&&o.metric_id==='response_within_target_fraction');const dates=[...new Set(rows.map(o=>o.reporting_date))].sort();assert.equal(dates.length,33);assert.equal(dates[0],'2026-09-15');assert.equal(dates.at(-1),'2026-10-17');for(let i=0;i<dates.length;i++){assert.equal(rows.filter(o=>o.reporting_date===dates[i]).length,3);if(i)assert.equal(Date.parse(dates[i])-Date.parse(dates[i-1]),86400000);}assert(rows.every(o=>o.value>=0&&o.value<=1));
});
test('recent-month trend uses days-weighted baseline and requires all three months',()=>{
 const bars=[{total:310,days:31},{total:620,days:31},{total:900,days:30},{rate:20}];let t=h.recentTrend(bars);assert.equal(t.direction,'up');assert(Math.abs(t.delta-(20-1830/92))<1e-9);bars[1].total=null;assert.equal(h.recentTrend(bars).direction,'unknown');
 const html=h.render('ramping',0,a,[]);assert.equal((html.match(/Month in progress/g)||[]).length,1);assert.match(html,/Ramping hours per day/);assert.match(html,/vs previous 3 months combined/);
});
test('T4 renders a tall scrollable chart and daily ticks including absent days',()=>{
 const html=h.overlay([{date:'2026-10-15',published:90,captured:null},{date:'2026-10-17',published:150,captured:null}]);assert.match(html,/t4-scroll/);assert.match(html,/16 Oct/);assert.match(html,/height:380px/);assert.match(html,/3 h/);
});
test('weekday groups use shift-start dates and omit missing values',()=>{
 const m=r.weekModel([{date:'2026-10-16',value:10},{date:'2026-10-17',value:30},{date:'2026-10-18',value:50}]);assert.equal(m.weekday.value,10);assert.equal(m.weekend.value,40);assert.equal(m.weekend.count,2);assert.equal(m.groups.find(g=>g.label==='Mon').value,null);
 const n=r.responseWeek(a,1);assert.equal(n.records.length,33);assert.equal(n.weekday.count+n.weekend.count,33);assert(n.weekday.value>=0&&n.weekday.value<=100);
});
