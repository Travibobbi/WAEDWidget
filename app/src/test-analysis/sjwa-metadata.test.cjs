const {test}=require('node:test'),assert=require('node:assert/strict');
const Sj=require('../../../scripts/feed/SjwaCore.js');
const defs=require('../../../scripts/feed/SjwaConfig.js');
// Reduced public modelsAndExploration response captured 4 November 2026.
const fixture=require('./fixtures/sjwa-pbir-response.json');
const responseDefs=defs.filter(d=>d.report===0);
function changed(edit){const m=structuredClone(fixture),d=JSON.parse(m.exploration.explorationContent.explorationDocument);edit(d.pages.pages[0].visualContainers);m.exploration.explorationContent.explorationDocument=JSON.stringify(d);return m;}
test('reads migrated PBIR response report without legacy config fields',()=>{
 assert.ok(fixture.exploration.sections[0].visualContainers.every(v=>!v.config));
 Sj.validateMetadata(fixture,responseDefs);
});
test('reads migrated PBIR ramping report including native date label and hierarchies',()=>{
 const m=require('./fixtures/sjwa-pbir-ramping.json');Sj.validateMetadata(m,defs.filter(d=>d.report===1));
 const parsed=structuredClone(m);parsed.exploration.explorationContent.explorationDocument=JSON.parse(parsed.exploration.explorationContent.explorationDocument);
 Sj.validateMetadata(parsed,defs.filter(d=>d.report===1));
});
test('PBIR validation rejects missing and duplicate required visuals',()=>{
 for(const edit of [v=>v.shift(),v=>v.push(structuredClone(v[0]))])
  assert.throws(()=>Sj.validateMetadata(changed(edit),responseDefs),/Visual missing\/duplicate/);
});
test('PBIR validation rejects changed measures, aggregation, labels and sort',()=>{
 const mutations=[
  v=>v[0].content.visual.query.queryState.Y.projections[0].field.Aggregation.Expression.Column.Property='Different_Metric',
  v=>v[0].content.visual.query.queryState.Y.projections[0].field.Aggregation.Function=1,
  v=>v[1].content.visual.query.queryState.Y.projections[0].displayName='Different units',
  v=>v[1].content.visual.query.sortDefinition.sort[0].direction='Descending',
  v=>v[0].content.visual.query.queryState.Y.projections.push(structuredClone(v[0].content.visual.query.queryState.Y.projections[0]))
 ];
 for(const mutate of mutations)assert.throws(()=>Sj.validateMetadata(changed(mutate),responseDefs),/Source (query|labels|sort) changed/);
});
test('PBIR semantic comparison ignores object property and role ordering',()=>{
 const m=changed(v=>{const q=v[1].content.visual.query;q.queryState=Object.fromEntries(Object.entries(q.queryState).reverse());});
 Sj.validateMetadata(m,responseDefs);
});
test('legacy report metadata remains supported and validated',()=>{
 const m={exploration:{sections:[{visualContainers:[{objectName:'decoration'},...defs.map(d=>({config:JSON.stringify({name:d.visualId,singleVisual:{prototypeQuery:d.prototype}}),dataTransforms:JSON.stringify({selects:d.labels.map(l=>({queryName:l.name,displayName:l.label}))})}))]}]}};
 Sj.validateMetadata(m,defs);
 m.exploration.sections[0].visualContainers[1].dataTransforms=JSON.stringify({selects:[]});
 assert.throws(()=>Sj.validateMetadata(m,defs),/Source labels changed/);
});
