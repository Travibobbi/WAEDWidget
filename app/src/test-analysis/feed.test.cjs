const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {merge,publish,capture,recoverArchived,key}=require('../../../scripts/feed/publish.cjs');
const now='2026-10-18T10:00:00Z';
function observation(source,value=10){return {source_id:source,establishment_id:'hospital',metric_id:'wait',reporting_date:'2026-10-17',captured_at_utc:now,value};}
test('feed preserves null revisions, distinct priorities and older monthly history',()=>{
 const a=observation('wa-health-ed-daily'),b={...a,captured_at_utc:'2026-10-18T11:00:00Z',value:null};
 const rows=merge([a],[b,{...b,ambulance_priority:1},{...a,period_type:'month',period_start:'2023-01-01',period_end:'2023-01-31',reporting_date:'2023-01-31'}],now);
 assert.equal(rows.length,3);assert.equal(rows[0].value,null);assert.equal(rows[0].period_start,'2026-10-17');
});
test('collector failure preserves raw evidence and the previous feed',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'waed-feed-failure-'));
 const captures=['wa-health-ed-daily','sjwa-response','sjwa-ramping'].map(source=>({manifest:{status:'complete',warnings:[]},files:{raw:'evidence'},observations:[observation(source)]}));
 try{
  publish(root,captures,now);const before=fs.readFileSync(path.join(root,'latest.json'),'utf8');
  const failed=capture({SOURCE:'sjwa',capture(env){
   env.writeNew('captures/test/metadata.response.txt','source response');
   env.writeNew('captures/test/manifest.json',JSON.stringify({status:'failed',source_id:'sjwa'}));
   throw Error('Source query changed: daily-response');
  }});
  assert.throws(()=>publish(root,[captures[0],failed],now),/sjwa.*Source query changed/);
  assert.equal(fs.readFileSync(path.join(root,'latest.json'),'utf8'),before);
  const evidence=fs.readdirSync(path.join(root,'captures/2026-10')).map(f=>JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(path.join(root,'captures/2026-10',f)))));
  const saved=evidence.flatMap(e=>e.captures).find(c=>c.manifest.status==='failed');
  assert.equal(saved.files['captures/test/metadata.response.txt'],'source response');assert.equal(saved.observations.length,0);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('stale source leaves latest pointer unchanged and retains capture evidence',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'waed-feed-'));
 const captures=['wa-health-ed-daily','sjwa-response','sjwa-ramping'].map(source=>({manifest:{status:'complete',warnings:[]},files:{raw:'evidence'},observations:[observation(source)]}));
 try{publish(root,captures,now);const before=fs.readFileSync(path.join(root,'latest.json'),'utf8');
 assert.throws(()=>publish(root,captures,'2026-10-25T10:00:00Z'),/stale/);assert.equal(fs.readFileSync(path.join(root,'latest.json'),'utf8'),before);
 assert.equal(fs.readdirSync(path.join(root,'captures/2026-10')).length,2);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
function verifiedCapture(source,date,value=10){
 const o={...observation(source,value),reporting_date:date,captured_at_utc:date+'T12:00:00Z'};
 const id=source+'-'+date,raw=JSON.stringify({source_id:source,capture_id:id,observations:[o]});
 return {manifest:{source_id:source,capture_id:id,status:'complete',warnings:[],observation_count:1,files:[{path:'observations.json',sha256:require('node:crypto').createHash('sha256').update(raw).digest('hex')}]},files:{['captures/'+id+'/observations.json']:raw},observations:[o]};
}
test('successful retry recovers complete sources from a failed combined run',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'waed-recovery-'));
 const sources=['wa-health-ed-daily','sjwa-response','sjwa-ramping'];
 const read=p=>JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(path.join(root,p.path)))).observations;
 try{
  const initial=publish(root,sources.map(s=>verifiedCapture(s,'2026-10-16')),'2026-10-17T10:00:00Z');
  const before=fs.readFileSync(path.join(root,'latest.json'),'utf8');
  const failed=sources.map(s=>verifiedCapture(s,'2026-10-17'));
  failed[0].manifest.status='failed';
  assert.throws(()=>publish(root,failed,now),/incomplete/);
  assert.equal(fs.readFileSync(path.join(root,'latest.json'),'utf8'),before);
  const current=sources.map(s=>verifiedCapture(s,'2026-10-18'));
  const recovered=publish(root,current,'2026-10-19T10:00:00Z'),rows=read(recovered);
  for(const s of sources.slice(1))assert.equal(rows.filter(o=>o.source_id===s&&o.establishment_id==='hospital'&&o.reporting_date==='2026-10-17').length,1);
  assert.equal(rows.filter(o=>o.source_id===sources[0]&&o.reporting_date==='2026-10-17').length,0);
  assert.equal(new Set(rows.map(key)).size,rows.length);
  const map=new Map(rows.map(o=>[key(o),o]));
  for(const o of read(initial))assert.deepEqual(map.get(key(o)),o);
  assert.equal(read(publish(root,current,'2026-10-19T11:00:00Z')).length,rows.length);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('recovery rejects corrupt evidence and ignores failed or warned captures',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'waed-recovery-integrity-'));
 const folder=path.join(root,'captures/2026-10');fs.mkdirSync(folder,{recursive:true});
 const file=path.join(folder,'saved.json.gz'),save=c=>fs.writeFileSync(file,require('node:zlib').gzipSync(JSON.stringify({captures:[c]})));
 try{
  const c=verifiedCapture('sjwa-response','2026-10-17');save(c);
  assert.equal(recoverArchived(root,now).length,1);
  c.manifest.warnings=['stale'];save(c);assert.deepEqual(recoverArchived(root,now),[]);
  c.manifest.warnings=[];c.manifest.status='failed';save(c);assert.deepEqual(recoverArchived(root,now),[]);
  c.manifest.status='complete';c.observations[0].value=999;save(c);
  assert.throws(()=>recoverArchived(root,now),/manifest mismatch/);
  c.files[Object.keys(c.files)[0]]+=' ';save(c);
  assert.throws(()=>recoverArchived(root,now),/checksum mismatch/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
