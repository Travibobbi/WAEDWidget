const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {merge,publish}=require('../../../scripts/feed/publish.cjs');
const now='2026-10-18T10:00:00Z';
function observation(source,value=10){return {source_id:source,establishment_id:'hospital',metric_id:'wait',reporting_date:'2026-10-17',captured_at_utc:now,value};}
test('feed preserves null revisions, distinct priorities and older monthly history',()=>{
 const a=observation('wa-health-ed-daily'),b={...a,captured_at_utc:'2026-10-18T11:00:00Z',value:null};
 const rows=merge([a],[b,{...b,ambulance_priority:1},{...a,period_type:'month',period_start:'2023-01-01',period_end:'2023-01-31',reporting_date:'2023-01-31'}],now);
 assert.equal(rows.length,3);assert.equal(rows[0].value,null);assert.equal(rows[0].period_start,'2026-10-17');
});
test('stale source leaves latest pointer unchanged and retains capture evidence',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'waed-feed-'));
 const captures=['wa-health-ed-daily','sjwa-response','sjwa-ramping'].map(source=>({manifest:{status:'complete',warnings:[]},files:{raw:'evidence'},observations:[observation(source)]}));
 try{publish(root,captures,now);const before=fs.readFileSync(path.join(root,'latest.json'),'utf8');
 assert.throws(()=>publish(root,captures,'2026-10-25T10:00:00Z'),/stale/);assert.equal(fs.readFileSync(path.join(root,'latest.json'),'utf8'),before);
 assert.equal(fs.readdirSync(path.join(root,'captures/2026-10')).length,2);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
