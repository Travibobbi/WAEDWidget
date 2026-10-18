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
function render(index,type,rows,hospitals,now=Date.now()){
 const [,name,hospital]=hospitals[index],m=model(rows,hospital,type),current=shiftAt(now),top=Math.max(1,...m.groups.map(g=>g.value||0));
 let chart='<svg viewBox="0 0 600 260" role="img" aria-label="Median of captured T4 shift medians by roster colour, in minutes">';
 for(const f of [0,.5,1])chart+='<path d="M45 '+(205-f*150)+'H585" stroke="#dce6df"/><text x="36" y="'+(209-f*150)+'" text-anchor="end" font-size="12">'+fmt(top*f)+'</text>';
 m.groups.forEach((g,i)=>{const x=65+i*130,h=g.value===null?0:g.value/top*150;chart+='<rect x="'+x+'" y="'+(205-h)+'" width="75" height="'+h+'" rx="5" fill="'+g.ink+'"/><text x="'+(x+37)+'" y="'+(193-h)+'" text-anchor="middle" font-size="15">'+fmt(g.value)+'</text><text x="'+(x+37)+'" y="230" text-anchor="middle" font-size="14">'+g.colour+'</text><text x="'+(x+37)+'" y="250" text-anchor="middle" font-size="11">'+g.shifts+' shifts</text>';});chart+='</svg>';
 return '<nav class="navigation" aria-label="Hospital navigation"><button id="roster-prev" '+(index===0?'disabled':'')+'>← Previous</button><span>'+(index+1)+' / '+hospitals.length+'</span><button id="roster-next" '+(index===hospitals.length-1?'disabled':'')+'>Next →</button></nav><section class="card"><h2>'+esc(name)+'</h2><p class="hospital-title">Roster colours · captured T4 waits</p><div class="legend"><button id="roster-day" aria-pressed="'+(type==='Day')+'" class="'+(type==='Day'?'active':'')+'">Day · 07–18</button><button id="roster-night" aria-pressed="'+(type==='Night')+'" class="'+(type==='Night'?'active':'')+'">Night · 18–07</button></div><p class="meta">Roster now: '+current.colour+' '+current.type.toLowerCase()+' · shift starts '+current.date+' · Perth time</p>'+(m.records.length?chart+'<p class="meta">Minutes · median of each shift’s captured-reading median<br>'+m.records[0].date+' to '+m.records[m.records.length-1].date+'</p>':'<p class="notice">No captured T4 readings for these shifts yet. Your retained history is read automatically.</p>')+(m.records.length&&m.groups.some(g=>g.shifts<7)?'<p class="notice">Limited coverage: at least one colour has fewer than seven observed shifts. Treat differences as preliminary.</p>':'')+'<p class="meta">Colours describe roster timing, not crew performance. Different weekdays, demand and missing readings can affect results.</p><details><summary>Coverage and recent shifts</summary><div class="scroll"><table><tr><th>Colour</th><th>Shifts</th><th>Samples</th><th>Hours sampled / possible</th></tr>'+m.groups.map(g=>'<tr><td>'+g.colour+'</td><td>'+g.shifts+'</td><td>'+g.samples+'</td><td>'+g.hours+' / '+g.possibleHours+'</td></tr>').join('')+'</table><table><tr><th>Shift starts</th><th>Colour</th><th>Median min</th><th>Samples</th></tr>'+m.records.slice(-28).reverse().map(s=>'<tr><td>'+s.date+'</td><td>'+s.colour+'</td><td>'+fmt(s.value)+'</td><td>'+s.samples+'</td></tr>').join('')+'</table></div><p>Each observed shift has equal weight: first take the median of its unique source-timestamp readings, then the median across shifts of the same colour. These are sampled published T4 average waits, not patient-level medians. Unobserved shifts are absent, not zero. Hours sampled counts hour slots with at least one reading, not continuous coverage. '+m.excluded+' invalid readings excluded.</p></details><details><summary>Roster and attribution</summary><p>User-confirmed continuous eight-day cycle anchored to 18 September 2026: Black days / Blue nights for two days, Green / Black for two, Red / Green for two, then Blue / Red for two. Each colour works two days, two nights, four off. Before 07:00 belongs to the preceding date’s night shift. Source timestamps determine shifts; collection time is not substituted. Daily ED totals and monthly ambulance response/ramping cannot be assigned to individual shifts from the available data.</p></details></section>';
}
const api={shiftAt,model,render};if(typeof module!=='undefined')module.exports=api;root.Roster=api;
})(typeof window==='undefined'?globalThis:window);
