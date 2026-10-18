/* Portable SJWA collector. All persisted dates use ISO strings; no Google IDs. */
var SjwaArchive=(function(){
 'use strict';
 const VERSION='1.0.0',SOURCE='sjwa',PAGE='https://www.stjohnwa.com.au/ambulance-and-health-services/metro-ambulance-service/ambulance-activity-and-response-times';
 const keys=['4b4aac0c-b762-4348-96cc-2585ccff6f18','3e399aba-a990-4e78-9be5-ea256ba206de'];
 const reports=['https://app.powerbi.com/view?r=eyJrIjoiNGI0YWFjMGMtYjc2Mi00MzQ4LTk2Y2MtMjU4NWNjZmY2ZjE4IiwidCI6IjFhZTg5MTgwLTY3ZmMtNDFkZi1hMWEwLWNlNDFhZDU5OGY2YiJ9','https://app.powerbi.com/view?r=eyJrIjoiM2UzOTlhYmEtYTk5MC00ZTc4LTliZTUtZWEyNTZiYTIwNmRlIiwidCI6IjFhZTg5MTgwLTY3ZmMtNDFkZi1hMWEwLWNlNDFhZDU5OGY2YiJ9'];
 const aliases={'Albany Regional Hospital':'albany','Armadale/Kelmscott Hospital':'armadale','Broome Hospital':'broome','Bunbury Regional Hospital':'bunbury','Fiona Stanley Hospital':'fiona-stanley','Geraldton Regional Hospital':'geraldton','Hedland Health Campus':'hedland','Joondalup Health Campus':'joondalup','Kalgoorlie Regional Hospital':'kalgoorlie','King Edward Memorial Hospital':'king-edward','Northam Regional Hospital':'northam','Peel Health Campus':'peel','Perth Childrens Hospital':'perth-childrens','Princess Margaret Hospital':'princess-margaret','Rockingham Hospital':'rockingham','Royal Perth Hospital':'royal-perth','Sir Charles Gairdner Hospital':'sir-charles-gairdner','St John of God Midland':'midland','St John of God Midland Hospital':'midland'};
 const metricDefs={response_within_target_fraction:{unit:'fraction',description:'Fraction meeting priority-specific response threshold; SJWA ambulance priorities are not ED triage categories.'},response_target_fraction:{unit:'fraction',description:'Published performance target.'},response_cases:{unit:'count',description:'Published monthly metropolitan cases by ambulance priority.'},ramped_hours:{unit:'hours',description:'Ramped hours for specified reporting period; rolling windows must not be summed.'},ramped_hours_fytd_weekly_average:{unit:'hours_per_week',description:'Published FYTD weekly average; fiscal comparison boundary is source-defined.'},ramped_hours_fytd_total:{unit:'hours',description:'Published FYTD total; fiscal boundary is source-defined.'}};
 const catalog={schema_version:1,source_id:SOURCE,collector_version:VERSION,timezone:'Australia/Perth',source_url:PAGE,attribution:'St John WA',metrics:metricDefs,establishments:Object.keys(aliases).map(n=>({source_name:n,establishment_id:aliases[n]})),entity_namespace:'wa-health-facilities-v1',response_entity:'sjwa-metro-service',notes:['Facility IDs match WA ED collector. Princess Margaret remains distinct from Perth Childrens.','SJWA metro service coverage is not interchangeable with WA ED metro hospital aggregates.','Periods and units must match before comparison; rolling windows overlap.','All ramping values are preliminary and may be revised. Fiscal boundaries are not inferred from capture date.']};
 function assert(x,m){if(!x)throw Error(m);}
 function json(x){return JSON.stringify(x,null,2)+'\n';}
 function cleanPath(p){assert(typeof p==='string'&&p.length&&!p.includes('\\')&&!p.includes(':')&&!p.startsWith('/')&&p.split('/').every(x=>x&&x!=='.'&&x!=='..'),'Unsafe path');return p;}
 function day(v){assert(typeof v==='number'&&Number.isFinite(v)&&v%86400000===0,'Invalid source date');return new Date(v).toISOString().slice(0,10);}
 function shift(d,n){return new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);}
 function refresh(s){const m=/^\/Date\((\d+)\)\/$/.exec(s||'');assert(m,'Missing refresh timestamp');return new Date(Number(m[1])).toISOString();}
 function decode(raw,q){
  assert(raw.results?.length===1,'Unexpected result count');const result=raw.results[0].result;
  assert(result&&!result.error&&result.data,'Query failed');const d=result.data;assert(d.dsr?.DS?.length===1,'Unexpected datasets');const ds=d.dsr.DS[0];
  assert(!ds.RT&&ds.IC===true&&ds.PH?.length===1,'Incomplete/paginated result');const rows=ds.PH[0].DM0;assert(rows?.length&&rows.length<10000,'Empty/truncated result');
  assert(d.descriptor.Select.length===q.Select.length&&d.descriptor.Select.every((x,i)=>x.Name===q.Select[i].Name),'Descriptor changed');
  let schema,previous;
  return rows.map(r=>{schema=r.S||schema;assert(schema?.length&&schema.length<31,'Invalid row schema');let cursor=0;
   const repeat=r.R||0,missing=r['Ø']||0;assert(Number.isInteger(repeat)&&Number.isInteger(missing)&&!(repeat&missing)&&((repeat|missing)>>>schema.length)===0,'Invalid masks');
   assert(Object.keys(r).every(k=>['S','C','R','Ø'].includes(k)||schema.some(s=>s.N===k)),'Unknown row property');
   const vals=schema.map((s,i)=>{if(repeat&(1<<i)){assert(previous,'Missing previous row');return previous[i];}if(missing&(1<<i))return null;
    if(r.C){assert(cursor<r.C.length,'Missing cell');return r.C[cursor++];}assert(Object.prototype.hasOwnProperty.call(r,s.N),'Missing scalar');return r[s.N];});
   assert(!r.C||cursor===r.C.length,'Extra cells');previous=vals;
   const named={};schema.forEach((s,i)=>{let v=vals[i];if(s.DN&&v!==null){let dict=ds.ValueDicts?.[s.DN];assert(dict&&Number.isInteger(v)&&v>=0&&v<dict.length,'Invalid dictionary');v=dict[v];}named[s.N]=v;});
   return Object.fromEntries(d.descriptor.Select.map(s=>{assert(named[s.Value]!==undefined,'Missing selected value');return [s.Name,named[s.Value]];}));
  });
 }
 function number(v,unit){if(v===null)return null;assert((typeof v==='number'||typeof v==='string'&&/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v))&&Number.isFinite(Number(v)),'Invalid number');v=Number(v);assert(v>=0,'Negative measure');if(unit==='fraction')assert(v<=1,'Fraction exceeds one');if(unit==='count')assert(Number.isInteger(v),'Noninteger count');return v;}
 function normalize(tables,context,defs){
  const out=[],seen=new Set();const current=day(tables['ramping-date'][0][defs.find(x=>x.name==='ramping-date').query.Select[0].Name]);
  const value=(row,def,i)=>row[def.query.Select[i].Name];
  function add(def,row,metric,raw,period,entity,priority,extra){const unit=metricDefs[metric].unit;const o=Object.assign({schema_version:1,source_id:'sjwa-'+(def.report?'ramping':'response'),capture_id:context.capture_id,captured_at_utc:context.captured_at_utc,source_refresh_utc:context.refresh[def.report],reporting_date:period.end||period.asof,period_start:period.start,period_end:period.end,period_type:period.type,as_of_date:period.asof,period_complete:period.complete,timezone:'Australia/Perth',establishment_id:entity.id,establishment_name:entity.name,establishment_kind:entity.kind,entity_namespace:'wa-health-facilities-v1',geography:entity.region||(entity.kind==='service_area'?'Metropolitan':(['albany','broome','bunbury','geraldton','hedland','kalgoorlie','northam'].includes(entity.id)?'Country':'Metropolitan')),ambulance_priority:priority,metric_id:metric,unit,value:number(raw,unit),status:raw===null?'null':'reported',source_value:raw,source_query:def.name,revision_policy:'append-only',is_preliminary:def.report===1},extra||{});
   const k=[o.source_id,o.period_type,o.period_start,o.period_end,o.as_of_date,o.establishment_id,o.ambulance_priority,o.metric_id,o.comparison||''].join('|');assert(!seen.has(k),'Duplicate observation');seen.add(k);out.push(o);}
  let latestResponse;
  for(const def of defs){const rows=tables[def.name];assert(rows?.length,'Missing table');if(def.name==='ramping-date'){assert(rows.length===1,'Multiple ramping dates');continue;}
   if(def.name==='daily-response'||def.name==='monthly-response'){
    const daily=def.name==='daily-response';if(daily)assert(rows.length===3,'Expected three daily priorities');const groups=new Map();
    for(const r of rows){const p=Number(value(r,def,daily?2:4));assert([1,2,3].includes(p),'Unknown priority');const date=day(value(r,def,daily?3:3));const start=daily?date:date.slice(0,7)+'-01';const end=daily?date:new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7)),0)).toISOString().slice(0,10);
     const group=groups.get(start)||new Set();assert(!group.has(p),'Duplicate priority');group.add(p);groups.set(start,group);if(daily){assert(!latestResponse||latestResponse===date,'Inconsistent response dates');latestResponse=date;}
     const per={start,end,type:daily?'day':'month',asof:daily?date:context.responseDate,complete:daily||end<context.responseDate};const entity={id:'sjwa-metro-service',name:'SJWA metropolitan ambulance service',kind:'service_area'};
     add(def,r,'response_target_fraction',value(r,def,0),per,entity,p,{threshold_minutes:{1:15,2:25,3:60}[p]});add(def,r,'response_within_target_fraction',value(r,def,1),per,entity,p,{threshold_minutes:{1:15,2:25,3:60}[p]});if(!daily)add(def,r,'response_cases',value(r,def,2),per,entity,p);
    }assert([...groups.values()].every(g=>g.size===3),'Missing monthly priority');
   }else for(const r of rows){const monthly=def.name==='ramping-monthly',weekly=def.name==='ramping-weekly';const name=value(r,def,monthly?1:weekly?4:1);assert(aliases[name],'Unmapped hospital: '+name);const e={id:aliases[name],name,kind:'hospital',region:monthly?null:value(r,def,weekly?3:0)};
    if(monthly){const date=day(value(r,def,2)),start=date.slice(0,7)+'-01';assert(start<=current,'Future month');add(def,r,'ramped_hours',value(r,def,0),{start,end:date,type:'month',asof:current,complete:date<current},e,null);}
    else if(weekly){add(def,r,'ramped_hours',value(r,def,0),{start:shift(current,-6),end:current,type:'rolling_7_days',asof:current,complete:true},e,null,{period_boundary_basis:'Last 7 Days ending latest source data date'});for(let i=1;i<=2;i++)add(def,r,'ramped_hours_fytd_weekly_average',value(r,def,i),{start:null,end:null,type:'fiscal_ytd_weekly_average',asof:current,complete:false},e,null,{comparison:i===1?'current_fytd':'previous_fytd',period_boundary_basis:'Source-defined; exact fiscal comparison dates not supplied'});}
    else for(let i=2;i<=3;i++)add(def,r,'ramped_hours_fytd_total',value(r,def,i),{start:null,end:null,type:'fiscal_ytd',asof:current,complete:false},e,null,{comparison:i===2?'current_fytd':'previous_fytd',period_boundary_basis:'Source-defined; exact fiscal comparison dates not supplied'});
   }
  }
  const wk=tables['ramping-weekly'],fy=tables['ramping-fytd'];assert(wk.length===17&&fy.length===17,'Hospital coverage changed');
  const ids=(rows,def,index)=>rows.map(r=>aliases[value(r,def,index)]).sort().join('|');assert(ids(wk,defs.find(x=>x.name==='ramping-weekly'),4)===ids(fy,defs.find(x=>x.name==='ramping-fytd'),1),'Hospital coverage differs');
  return {schema_version:1,source_id:SOURCE,capture_id:context.capture_id,captured_at_utc:context.captured_at_utc,reporting_dates:[...new Set([current,latestResponse])].sort(),observations:out};
 }
 function queryBody(m,def){return {version:'1.0.0',modelId:m.models[0].id,cancelQueries:[],queries:[{QueryId:'',ApplicationContext:{DatasetId:m.models[0].dbName,Sources:[{ReportId:m.exploration.report.objectId,VisualId:def.visualId}]},Query:{Commands:[{SemanticQueryDataShapeCommand:{Query:def.query,Binding:{Primary:{Groupings:[{Projections:def.query.Select.map((_,i)=>i)}]},DataReduction:{DataVolume:3,Primary:{Window:{Count:10000}}},Version:1},ExecutionMetricsKind:1}}]}}]};}
 function validateMetadata(m,defs){const visuals=m.exploration.sections.flatMap(s=>s.visualContainers);for(const def of defs){const v=visuals.find(v=>JSON.parse(v.config).name===def.visualId);assert(v,'Visual missing');const c=JSON.parse(v.config);assert(JSON.stringify(c.singleVisual.prototypeQuery)===JSON.stringify(def.prototype),'Source query changed: '+def.name);const labels=JSON.parse(v.dataTransforms).selects.map(x=>({name:x.queryName,label:x.displayName}));assert(JSON.stringify(labels)===JSON.stringify(def.labels),'Source labels changed: '+def.name);}}
 function capture(env,defs){const started=env.now(),id=started.replace(/[-:.]/g,'')+'-'+env.uuid(),prefix='captures/'+started.slice(0,4)+'/'+started.slice(5,7)+'/'+id;const files=[];let complete=false;const m={schema_version:1,collector_version:VERSION,source_id:SOURCE,source_url:PAGE,capture_id:id,captured_at_utc:started,files};
  function save(p,text){env.writeNew(prefix+'/'+p,text);files.push({path:p,sha256:env.sha256(text)});}
  function req(name,url,body,key){if(body)save(name+'.request.json',json(body));const r=env.http(url,body,{'X-PowerBI-ResourceKey':key,Accept:'application/json'});save(name+'.response.txt',r.text);save(name+'.http.json',json({url,status:r.status,fetched_at_utc:env.now()}));assert(r.status>=200&&r.status<300,'HTTP '+r.status);return r.text;}
  try{save('catalog.json',json(catalog));const tables={},refreshes=[];
   for(let i=0;i<2;i++){const html=req('report-'+i,reports[i],null,keys[i]);const match=html.match(/var resolvedClusterUri\s*=\s*'(https:\/\/([a-z0-9-]+)\.analysis\.windows\.net\/?)'/);assert(match,'Cluster missing');const api='https://'+match[2].replace('-redirect','').replace('global-','')+'-api.analysis.windows.net';const url=api+'/public/reports/'+keys[i]+'/modelsAndExploration?preferReadOnlySession=true';const before=JSON.parse(req('metadata-'+i+'-before',url,null,keys[i]));const group=defs.filter(d=>d.report===i);validateMetadata(before,group);refreshes[i]=refresh(before.models[0].lastRefreshTime);
    for(const def of group){const raw=JSON.parse(req(def.name,api+'/public/reports/querydata',queryBody(before,def),keys[i]));tables[def.name]=decode(raw,def.query);}
    const after=JSON.parse(req('metadata-'+i+'-after',url,null,keys[i]));assert(before.models[0].id===after.models[0].id&&before.models[0].lastRefreshTime===after.models[0].lastRefreshTime&&before.models[0].packageVersion===after.models[0].packageVersion,'Refresh changed mid-capture');
   }
   const daily=defs.find(d=>d.name==='daily-response'),responseDate=day(tables['daily-response'][0][daily.query.Select[3].Name]);
   const normalized=normalize(tables,{capture_id:id,captured_at_utc:started,refresh:refreshes,responseDate},defs);save('observations.json',json(normalized));save('observations.ndjson',normalized.observations.map(o=>JSON.stringify(o)).join('\n')+'\n');
   Object.assign(m,{status:'complete',source_refresh_utc:refreshes,reporting_dates:normalized.reporting_dates,observation_count:normalized.observations.length,completed_at_utc:env.now(),warnings:normalized.reporting_dates.filter(d=>(Date.parse(started)-Date.parse(d+'T00:00:00+08:00'))/86400000>3).map(d=>'Stale reporting date: '+d)});
   env.writeNew(prefix+'/manifest.json',json(m));complete=true;env.publishLatest({schema_version:1,source_id:SOURCE,capture_id:id,captured_at_utc:started,manifest_path:prefix+'/manifest.json',observations_path:prefix+'/observations.json',warnings:m.warnings});return m;
  }catch(e){if(!complete){m.status='failed';m.error=String(e.message||e);m.completed_at_utc=env.now();env.writeNew(prefix+'/manifest.json',json(m));}throw e;}
 }
 return {VERSION,SOURCE,PAGE,catalog,json,cleanPath,decode,normalize,queryBody,validateMetadata,capture};
})();
if(typeof module!=='undefined')module.exports=SjwaArchive;

