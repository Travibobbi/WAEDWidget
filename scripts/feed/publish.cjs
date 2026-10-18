/* Public-source feed. No Google Drive credentials, files, or personal widget readings. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),{spawnSync}=require('node:child_process');
const Ed=require('./EdCore.js'),Sj=require('./SjwaCore.js'),Config=require('./SjwaConfig.js');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function key(o){return JSON.stringify([o.source_id,o.establishment_id,o.metric_id,o.period_type||'day',o.period_start||o.reporting_date,o.period_end||o.reporting_date,o.period_start?null:o.as_of_date,o.ambulance_priority??null,o.comparison??null]);}
function normalize(o){return o.period_type?o:{...o,period_start:o.reporting_date,period_end:o.reporting_date,period_type:'day',period_complete:true,as_of_date:o.reporting_date};}
function merge(previous,incoming,now){
 const map=new Map();for(const raw of [...previous,...incoming]){const o=normalize(raw),k=key(o),old=map.get(k);if(!old||Date.parse(o.captured_at_utc)>Date.parse(old.captured_at_utc))map.set(k,o);}
 const cutoff=new Date(Date.parse(now)-90*86400000).toISOString().slice(0,10);
 const fields=['schema_version','source_id','capture_id','captured_at_utc','source_refresh_utc','reporting_date','period_start','period_end','period_type','as_of_date','period_complete','establishment_id','establishment_name','establishment_kind','geography','ambulance_priority','metric_id','unit','value','status','comparison'];
 return [...map.values()].filter(o=>o.period_type==='month'||(o.as_of_date||o.reporting_date)>=cutoff).map(o=>Object.fromEntries(fields.filter(k=>o[k]!==undefined).map(k=>[k,o[k]])));
}
function writeNew(root,p,bytes){const f=path.join(root,Ed.cleanPath(p));fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,bytes,{flag:'wx'});}
function capture(core,config){const files={};let pointer;const m=core.capture({now:()=>new Date().toISOString(),uuid:()=>crypto.randomUUID(),sha256:hash,writeNew:(p,t)=>{if(files[p])throw Error('Duplicate capture file');files[p]=t;},publishLatest:p=>pointer=p,http:(url,body,headers)=>{
 const child=spawnSync(process.execPath,[__filename,'--http'],{input:JSON.stringify({url,body,headers}),encoding:'utf8',timeout:180000,maxBuffer:20*1024*1024});if(child.error||child.status)throw Error(child.error?.message||child.stderr);return JSON.parse(child.stdout);
}},config);return {manifest:m,files,observations:JSON.parse(files[pointer.observations_path]).observations};}
function fromDisk(root){const pointer=JSON.parse(fs.readFileSync(path.join(root,'latest.json'))),manifest=JSON.parse(fs.readFileSync(path.join(root,pointer.manifest_path))),prefix=path.dirname(pointer.manifest_path),files={};for(const f of fs.readdirSync(path.join(root,prefix)))files[prefix+'/'+f]=fs.readFileSync(path.join(root,prefix,f),'utf8');return {manifest,files,observations:JSON.parse(files[pointer.observations_path]).observations};}
function publish(root,captures,now=new Date().toISOString()){
 fs.mkdirSync(root,{recursive:true});
 // Immutable evidence is written even when freshness validation prevents publication.
 const id=now.replace(/[-:.]/g,'')+'-'+crypto.randomUUID();const evidence=zlib.gzipSync(JSON.stringify({schema_version:1,captures}),{level:9});
 const evidencePath='captures/'+now.slice(0,7)+'/'+id+'.json.gz';writeNew(root,evidencePath,evidence);
 const sources={};for(const c of captures){if(c.manifest.status!=='complete'||c.manifest.warnings?.length)throw Error('Source incomplete/stale: '+c.manifest.source_id);for(const o of c.observations){const date=o.as_of_date||o.reporting_date;sources[o.source_id]=date>=(sources[o.source_id]||'')?date:sources[o.source_id];}}
 for(const source of ['wa-health-ed-daily','sjwa-response','sjwa-ramping'])if(!sources[source]||Date.parse(now)-Date.parse(sources[source]+'T00:00:00+08:00')>3*86400000)throw Error('Missing/stale source '+source);
 const latestPath=path.join(root,'latest.json');const prior=fs.existsSync(latestPath)?JSON.parse(fs.readFileSync(latestPath)):null;
 if(prior)for(const k of Object.keys(sources))if(sources[k]<prior.source_dates[k])throw Error('Source reporting date regressed');
 const previous=prior?JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,prior.path)))).observations:[];
 const observations=merge(previous,captures.flatMap(c=>c.observations),now);
 const data=Buffer.from(JSON.stringify({schema_version:1,generated_at_utc:now,source_dates:sources,observations}));if(data.length>24*1024*1024)throw Error('Feed exceeds mobile size budget');
 const compressed=zlib.gzipSync(data,{level:9}),snapshot='snapshots/'+id+'.json.gz';writeNew(root,snapshot,compressed);
 const pointer={schema_version:1,generated_at_utc:now,source_dates:sources,path:snapshot,sha256:hash(data),bytes:data.length,observations:observations.length,evidence_path:evidencePath,evidence_sha256:hash(evidence)};
 fs.writeFileSync(latestPath,JSON.stringify(pointer,null,2)+'\n');console.log(JSON.stringify(pointer));return pointer;
}
if(require.main===module){
 if(process.argv[2]==='--http') (async()=>{const {url,body,headers}=JSON.parse(fs.readFileSync(0,'utf8'));let last;for(let n=0;n<3;n++){try{const r=await fetch(url,{method:body?'POST':'GET',headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});if(r.status===429||r.status>=500)throw Error('HTTP '+r.status);process.stdout.write(JSON.stringify({status:r.status,text:await r.text()}));return;}catch(e){last=e;await new Promise(r=>setTimeout(r,2000*(n+1)));}}throw last;})().catch(e=>{console.error(e.message);process.exitCode=1;});
 else{const root=path.resolve(process.argv[2]),disk=process.argv[3];publish(root,disk?[fromDisk(path.join(disk,'ed')),fromDisk(path.join(disk,'sjwa'))]:[capture(Ed),capture(Sj,Config)]);}
}
module.exports={merge,key,publish};
