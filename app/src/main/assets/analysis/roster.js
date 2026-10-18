(function(root){
'use strict';
const DAY=86400000,OFFSET=8*3600000,anchor=Date.UTC(2026,8,18);
const colours=['Black','Green','Red','Blue'],inks=['#303840','#238155','#bd3737','#306cba'];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number.isFinite(x)?x.toLocaleString('en-AU',{maximumFractionDigits:1}):'—';
const median=a=>{a=a.slice().sort((x,y)=>x-y);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2:null};
function shiftAt(timestamp){
 if(!Number.isFinite(timestamp)||timestamp<=0)return null;
 const local=new Date(timestamp+OFFSET),hour=local.getUTCHours();
 let start=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate());
 if(hour<7)start-=DAY;
 const phase=((Math.round((start-anchor)/DAY)%8)+8)%8,day=hour>=7&&hour<18;
 const index=(Math.floor(phase/2)+(day?0:3))%4;
 return {date:new Date(start).toISOString().slice(0,10),type:day?'Day':'Night',colour:colours[index],duration:day?11:13,start:start-OFFSET+(day?7:18)*3600000};
}
function model(rows,hospital,type){
 const shifts=new Map(),seen=new Set();let excluded=0;
 for(const r of rows){if(r.hospital!==hospital)continue;const shift=shiftAt(r.source_time);
  if(!shift||!Number.isFinite(r.wait)||r.wait<0){excluded++;continue;}if(shift.type!==type)continue;
  const unique=r.source_time;if(seen.has(unique))continue;seen.add(unique);
  const key=shift.date+'|'+shift.type;if(!shifts.has(key))shifts.set(key,{...shift,values:[],hours:new Set()});
  const s=shifts.get(key);s.values.push(r.wait);s.hours.add(Math.floor((r.source_time-shift.start)/3600000));
 }
 const records=[...shifts.values()].map(s=>({...s,value:median(s.values),samples:s.values.length,coveredHours:s.hours.size})).sort((a,b)=>a.date.localeCompare(b.date));
 const groups=colours.map((colour,i)=>{const a=records.filter(s=>s.colour===colour);return {colour,ink:inks[i],value:median(a.map(s=>s.value)),shifts:a.length,samples:a.reduce((n,s)=>n+s.samples,0),hours:a.reduce((n,s)=>n+s.coveredHours,0),possibleHours:a.length*(type==='Day'?11:13)};});
 return {records,groups,excluded};
}
function colourRender(index,type,rows,hospitals,now=Date.now()){
 const [,name,hospital]=hospitals[index],m=model(rows,hospital,type),current=shiftAt(now),top=Math.max(1,...m.groups.map(g=>g.value||0));
 let chart='<svg viewBox="0 0 600 260" role="img" aria-label="Median of captured T4 shift medians by roster colour, in minutes">';
 for(const f of [0,.5,1])chart+='<path d="M45 '+(205-f*150)+'H585" stroke="#dce6df"/><text x="36" y="'+(209-f*150)+'" text-anchor="end" font-size="12">'+fmt(top*f)+'</text>';
 m.groups.forEach((g,i)=>{const x=65+i*130,h=g.value===null?0:g.value/top*150;chart+='<rect x="'+x+'" y="'+(205-h)+'" width="75" height="'+h+'" rx="5" fill="'+g.ink+'"/><text x="'+(x+37)+'" y="'+(193-h)+'" text-anchor="middle" font-size="15">'+fmt(g.value)+'</text><text x="'+(x+37)+'" y="230" text-anchor="middle" font-size="14">'+g.colour+'</text><text x="'+(x+37)+'" y="250" text-anchor="middle" font-size="11">'+g.shifts+' shifts</text>';});chart+='</svg>';
 return '<nav class="navigation" aria-label="Hospital navigation"><button id="roster-prev" '+(index===0?'disabled':'')+'>← Previous</button><span>'+(index+1)+' / '+hospitals.length+'</span><button id="roster-next" '+(index===hospitals.length-1?'disabled':'')+'>Next →</button></nav><section class="card"><h2>'+esc(name)+'</h2><p class="hospital-title">Roster colours · captured T4 waits</p><div class="legend"><button id="roster-day" aria-pressed="'+(type==='Day')+'" class="'+(type==='Day'?'active':'')+'">Day · 07–18</button><button id="roster-night" aria-pressed="'+(type==='Night')+'" class="'+(type==='Night'?'active':'')+'">Night · 18–07</button></div><p class="meta">Roster now: '+current.colour+' '+current.type.toLowerCase()+' · shift starts '+current.date+' · Perth time</p>'+(m.records.length?chart+'<p class="meta">Minutes · median of each shift’s captured-reading median<br>'+m.records[0].date+' to '+m.records[m.records.length-1].date+'</p>':'<p class="notice">No captured T4 readings for these shifts yet. Your retained history is read automatically.</p>')+(m.records.length&&m.groups.some(g=>g.shifts<7)?'<p class="notice">Limited coverage: at least one colour has fewer than seven observed shifts. Treat differences as preliminary.</p>':'')+'<p class="meta">Colours describe roster timing, not crew performance. Different weekdays, demand and missing readings can affect results.</p><details><summary>Coverage and recent shifts</summary><div class="scroll"><table><tr><th>Colour</th><th>Shifts</th><th>Samples</th><th>Hours sampled / possible</th></tr>'+m.groups.map(g=>'<tr><td>'+g.colour+'</td><td>'+g.shifts+'</td><td>'+g.samples+'</td><td>'+g.hours+' / '+g.possibleHours+'</td></tr>').join('')+'</table><table><tr><th>Shift starts</th><th>Colour</th><th>Median min</th><th>Samples</th></tr>'+m.records.slice(-28).reverse().map(s=>'<tr><td>'+s.date+'</td><td>'+s.colour+'</td><td>'+fmt(s.value)+'</td><td>'+s.samples+'</td></tr>').join('')+'</table></div><p>Each observed shift has equal weight: first take the median of its unique source-timestamp readings, then the median across shifts of the same colour. These are sampled published T4 average waits, not patient-level medians. Unobserved shifts are absent, not zero. Hours sampled counts hour slots with at least one reading, not continuous coverage. '+m.excluded+' invalid readings excluded.</p></details><details><summary>Roster and attribution</summary><p>User-confirmed continuous eight-day cycle anchored to 18 September 2026: Black days / Blue nights for two days, Green / Black for two, Red / Green for two, then Blue / Red for two. Each colour works two days, two nights, four off. Before 07:00 belongs to the preceding date’s night shift. Source timestamps determine shifts; collection time is not substituted. Daily ED totals and monthly ambulance response/ramping cannot be assigned to individual shifts from the available data.</p></details></section>';
}

const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function weekModel(records){
 const day=s=>new Date(s.date+'T00:00:00Z').getUTCDay();
 const groups=[1,2,3,4,5,6,0].map(d=>{const a=records.filter(s=>day(s)===d);return {label:weekdays[d],value:median(a.map(s=>s.value)),count:a.length};});
 const work=records.filter(s=>![0,6].includes(day(s))),weekend=records.filter(s=>[0,6].includes(day(s)));
 return {groups,weekday:{value:median(work.map(s=>s.value)),count:work.length},weekend:{value:median(weekend.map(s=>s.value)),count:weekend.length}};
}
function responseWeek(rows,priority){
 const byDate=new Map();for(const o of rows){if(o.source_id!=='sjwa-response'||o.metric_id!=='response_within_target_fraction'||o.period_type!=='day'||o.ambulance_priority!==priority||!Number.isFinite(o.value))continue;
 const previous=byDate.get(o.reporting_date);if(!previous||Date.parse(o.captured_at_utc)>Date.parse(previous.captured_at_utc))byDate.set(o.reporting_date,o);}
 const records=[...byDate.values()].map(o=>({date:o.reporting_date,value:o.value*100})).sort((a,b)=>a.date.localeCompare(b.date));return {...weekModel(records),records};
}
function weekChart(m,unit,noun){const top=unit==='%'?100:Math.max(1,...m.groups.map(g=>g.value||0));return '<div class="weekday-chart">'+m.groups.map(g=>'<div class="weekday-row"><strong>'+g.label+'</strong><div><div class="weekday-track"><span style="width:'+(g.value===null?0:g.value/top*100)+'%"></span></div><small>'+g.count+' '+noun+'</small></div><span>'+fmt(g.value)+' '+unit+'</span></div>').join('')+'</div>';}
function pair(m,unit,noun){return '<div class="pair"><div><strong>'+fmt(m.weekday.value)+' '+unit+'</strong><span>Weekdays · '+m.weekday.count+' '+noun+'</span></div><div><strong>'+fmt(m.weekend.value)+' '+unit+'</strong><span>Weekends · '+m.weekend.count+' '+noun+'</span></div></div>';}
function render(index,type,rows,hospitals,now=Date.now(),archives=[],view='colours',priority=1){
 const tabs='<div class="roster-views" aria-label="Roster analysis"><button id="roster-colours" class="'+(view==='colours'?'active':'')+'">Colours</button><button id="roster-week" class="'+(view==='week'?'active':'')+'">Week pattern</button><button id="roster-response" class="'+(view==='response'?'active':'')+'">Response</button></div>';
 if(view==='colours')return tabs+colourRender(index,type,rows,hospitals,now);
 if(view==='response'){
  const m=responseWeek(archives,priority);return tabs+'<section class="card"><h2>Metro response performance</h2><p class="hospital-title">Whole-day reports · within-target percentage</p><div class="legend">'+[1,2,3].map(p=>'<button id="response-priority-'+p+'" class="'+(p===priority?'active':'')+'">Priority '+p+'</button>').join('')+'</div>'+weekChart(m,'%','days')+pair(m,'%','days')+'<p class="meta">'+(m.records.length?m.records[0].date+' to '+m.records[m.records.length-1].date:'No daily response observations yet.')+'</p><p class="notice">The source has daily totals, not shift timestamps. This compares weekdays and weekends; it cannot tell us day versus night response performance.</p><details><summary>Method and coverage</summary><p>Each bar is the median of the available daily within-target percentages. It is not a pooled percentage of calls or a response time in minutes. Days have equal weight; daily call counts are unavailable. Weekends are Saturday and Sunday; public holidays are not separately identified. Missing days are omitted and sample counts are shown. Small groups and changes in demand can affect comparisons.</p></details></section>';
 }
 const [id,name,hospital]=hospitals[index],base=model(rows,hospital,type),m=weekModel(base.records),eligible=m.groups.filter(g=>g.count>=3&&g.value!==null).sort((a,b)=>b.value-a.value);
 const insight=eligible.length>=2?'Highest observed '+type.toLowerCase()+'-shift median: '+eligible[0].label+' ('+fmt(eligible[0].value)+' min), among weekdays with at least three observed shifts.':'More shifts are needed before highlighting a weekday pattern.';
 return tabs+'<nav class="navigation"><button id="roster-prev" '+(index===0?'disabled':'')+'>← Previous</button><span>'+(index+1)+' / '+hospitals.length+'</span><button id="roster-next" '+(index===hospitals.length-1?'disabled':'')+'>Next →</button></nav><section class="card"><h2>'+esc(name)+'</h2><p class="hospital-title">Captured T4 · shifts by weekday</p><div class="legend">'+['Day','Night'].map(t=>'<button id="roster-'+t.toLowerCase()+'" class="'+(type===t?'active':'')+'">'+t+' shift</button>').join('')+'</div>'+weekChart(m,'min','shifts')+pair(m,'min','shifts')+'<p>'+insight+'</p><details><summary>Colours, coverage and method</summary><table><tr><th>Colour</th><th>Weekday median</th><th>Weekend median</th></tr>'+colours.map(colour=>{const w=weekModel(base.records.filter(r=>r.colour===colour));return '<tr><td>'+colour+'</td><td>'+fmt(w.weekday.value)+' min · '+w.weekday.count+' shifts</td><td>'+fmt(w.weekend.value)+' min · '+w.weekend.count+' shifts</td></tr>';}).join('')+'</table><p>Each observed shift has equal weight, using its median captured T4 reading. Overnight shifts use their start date: a Friday night is a weekday shift. Weekends mean Saturday/Sunday, not public holidays. Missing and uneven sampling may affect the patterns. These are timing associations, not effects of roster colour or staff performance.</p></details></section>';
}
const api={shiftAt,model,weekModel,responseWeek,render};if(typeof module!=='undefined')module.exports=api;root.Roster=api;
})(typeof window==='undefined'?globalThis:window);
