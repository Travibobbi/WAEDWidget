(function(root){
'use strict';
const hospitals=[
 ['armadale','Armadale','Armadale Hospital'],['fiona-stanley','Fiona Stanley','Fiona Stanley Hospital'],
 ['joondalup','Joondalup','Joondalup Health Campus'],['king-edward','King Edward','King Edward Memorial Hospital For Women'],
 ['midland','Midland','St John of God Midland Public Hospital'],['peel','Peel','Peel Health Campus'],
 ['perth-childrens',"Perth Children’s","Perth Children's Hospital"],['rockingham','Rockingham','Rockingham General Hospital'],
 ['royal-perth','Royal Perth','Royal Perth Hospital'],['sir-charles-gairdner','Sir Charles Gairdner','Sir Charles Gairdner Hospital']
];
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=x=>Number.isFinite(x)?x.toLocaleString('en-AU',{maximumFractionDigits:1}):'—';
const dayMs=86400000;
const median=a=>{const b=a.slice().sort((x,y)=>x-y),i=Math.floor(b.length/2);return b.length?(b.length%2?b[i]:(b[i-1]+b[i])/2):null};
function rampModel(rows,id){
 const monthly=rows.filter(o=>o.source_id==='sjwa-ramping'&&o.establishment_id===id&&o.metric_id==='ramped_hours'&&o.period_type==='month');
 const asOf=monthly.map(o=>o.as_of_date).filter(Boolean).sort().pop();if(!asOf)return {bars:[],direction:'unknown'};
 const year=Number(asOf.slice(0,4)),month=asOf.slice(5,7);
 const bars=[year-3,year-2,year-1,year].map(y=>{
  const start=y+'-'+month+'-01',o=monthly.find(o=>o.period_start===start);
  const monthDays=new Date(Date.UTC(y,Number(month),0)).getUTCDate();
  const days=y===year?Math.min(monthDays,Number(asOf.slice(8,10))):monthDays;
  // Historical bars require complete months; no substitute zero or incomplete historical total.
  const usable=o&&Number.isFinite(o.value)&&o.value>=0&&(y===year||o.period_complete===true);
  return {year:y,days,total:usable?o.value:null,rate:usable?o.value/days:null,partial:y===year&&days<monthDays};
 });
 const current=bars[3],prior=bars[2],valid=Number.isFinite(current.rate)&&Number.isFinite(prior.rate);
 const delta=valid?current.rate-prior.rate:null;
 return {asOf,month,year,bars,delta,percent:valid&&prior.rate>0?delta/prior.rate*100:null,direction:!valid?'unknown':Math.abs(delta)<1e-9?'flat':delta>0?'up':'down'};
}
function t4Model(rows,widget,id){
 const hospital=hospitals.find(h=>h[0]===id),daily=new Map(),seen=new Set();
 for(const r of widget){
  if(!hospital||r.hospital!==hospital[2]||!Number.isFinite(r.source_time)||r.source_time<=0||!Number.isFinite(r.wait)||r.wait<0)continue;
  const unique=r.hospital+'|'+r.source_time;if(seen.has(unique))continue;seen.add(unique);
  const day=new Date(r.source_time+8*3600000).toISOString().slice(0,10);if(!daily.has(day))daily.set(day,[]);daily.get(day).push(r.wait);
 }
 const published=new Map(rows.filter(o=>o.source_id==='wa-health-ed-daily'&&o.establishment_id===id&&o.metric_id==='triage_4_median_wait_minutes').map(o=>[o.reporting_date,o.value]));
 const dates=[...new Set([...daily.keys(),...published.keys()])].sort();
 const last=dates[dates.length-1],cutoff=last?Date.parse(last)-89*dayMs:0;
 const points=dates.filter(d=>Date.parse(d)>=cutoff).map(date=>({date,published:Number.isFinite(published.get(date))?published.get(date):null,captured:daily.has(date)?median(daily.get(date)):null,samples:daily.get(date)?.length||0}));
 return {points,matched:points.filter(p=>p.published!==null&&p.captured!==null).length,capturedDays:points.filter(p=>p.captured!==null).length};
}
function navigation(index){return '<nav class="navigation" aria-label="Hospital navigation"><button id="hospital-prev" '+(index===0?'disabled':'')+'>← Previous</button><span aria-live="polite">'+(index+1)+' / '+hospitals.length+'</span><button id="hospital-next" '+(index===hospitals.length-1?'disabled':'')+'>Next →</button></nav>'}
function barGraph(bars){
 const top=Math.max(1,...bars.map(b=>b.rate||0));let svg='<svg viewBox="0 0 620 290" role="img" aria-label="Ramping hours per day for the same calendar month across four years">';
 for(const f of [0,.5,1]){const y=225-f*165;svg+='<path d="M60 '+y+'H600" stroke="#dce6df"/><text x="50" y="'+(y+4)+'" text-anchor="end" font-size="12">'+number(top*f)+'</text>'}
 bars.forEach((b,i)=>{const x=85+i*130,height=b.rate===null?0:b.rate/top*165;svg+='<rect x="'+x+'" y="'+(225-height)+'" width="75" height="'+height+'" rx="5" fill="'+(i===3?'#236e53':'#9dbbad')+'"/><text x="'+(x+37)+'" y="'+(213-height)+'" text-anchor="middle" font-size="15" font-weight="bold">'+number(b.rate)+'</text><text x="'+(x+37)+'" y="250" text-anchor="middle" font-size="14">'+b.year+'</text><text x="'+(x+37)+'" y="272" text-anchor="middle" font-size="11">'+(b.partial?'Month to date':'Full month')+'</text>'});
 return svg+'</svg>';
}
function overlay(points){
 if(!points.length)return '<p class="muted">No T4 data for this hospital yet.</p>';
 const first=Date.parse(points[0].date),last=Date.parse(points[points.length-1].date),top=Math.max(1,...points.flatMap(p=>[p.published||0,p.captured||0]));
 const x=t=>60+(t-first)/(last-first||dayMs)*550,y=v=>220-v/top*165;let svg='<svg viewBox="0 0 640 270" role="img" aria-label="Published daily T4 median and daily median of captured widget readings, in minutes">';
 for(const f of [0,.5,1]){const yy=y(top*f);svg+='<path d="M60 '+yy+'H610" stroke="#dce6df"/><text x="50" y="'+(yy+4)+'" text-anchor="end" font-size="12">'+number(top*f)+'</text>'}
 for(const [key,color,dash] of [['published','#236e53',''],['captured','#bb6314',' stroke-dasharray="7 4"']]){
  let path='',dots='',previous=null;for(const p of points){const t=Date.parse(p.date),v=p[key];if(v===null){previous=null;continue}const xx=x(t),yy=y(v);path+=(previous!==null&&t-previous<=dayMs?' L':' M')+xx+' '+yy;dots+='<circle cx="'+xx+'" cy="'+yy+'" r="3" fill="'+color+'"/>';previous=t}
  svg+='<path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="3"'+dash+'/>'+dots;
 }
 return svg+'<text x="60" y="253" font-size="12">'+points[0].date+'</text><text x="610" y="253" text-anchor="end" font-size="12">'+points[points.length-1].date+'</text></svg>';
}
function render(mode,index,rows,widget,preview=true){
 const [id,name]=hospitals[index];let body='';
 if(mode==='ramping'){
  const m=rampModel(rows,id);if(!m.bars.length)return navigation(index)+'<section class="card"><h2>'+escape(name)+'</h2><p>No ramping history available.</p></section>';
  const arrow={up:'↑',down:'↓',flat:'↔',unknown:'—'}[m.direction],word={up:'Worsened',down:'Improved',flat:'Unchanged',unknown:'Comparison unavailable'}[m.direction];
  const month=new Date(m.year+'-'+m.month+'-01T00:00:00Z').toLocaleDateString('en-AU',{month:'long',timeZone:'UTC'});
  body='<h2>'+escape(name)+'</h2><p class="hospital-title">'+month+' · '+(m.year-3)+'–'+m.year+'</p><div class="direction '+m.direction+'"><span class="arrow" aria-hidden="true">'+arrow+'</span><div><strong>'+word+'</strong><div>'+(m.delta===null?'Missing comparable data':(m.percent===null?number(Math.abs(m.delta))+' h/day':number(Math.abs(m.percent))+'%')+' '+(m.direction==='up'?'higher':m.direction==='down'?'lower':'change'))+'</div><small>vs '+month+' '+(m.year-1)+'</small></div></div>'+barGraph(m.bars)+'<p class="meta">Ramping hours per day · current month through '+m.asOf+'</p><p class="meta">Provisional: month-to-date rate vs previous full-month rates.</p><details><summary>Totals and comparison method</summary><table><tr><th>Year</th><th>Hours</th><th>Days</th><th>Hours/day</th></tr>'+m.bars.map(b=>'<tr><td>'+b.year+'</td><td>'+number(b.total)+'</td><td>'+b.days+'</td><td>'+number(b.rate)+'</td></tr>').join('')+'</table><p>Current month means the month of the latest source as-of date, not the phone clock. The current total is divided by elapsed calendar days through that date; historical totals use all calendar days in the same month. This adjusts for different exposure lengths, but is not a matched day-of-month comparison. Red means a higher daily rate; green means lower. The comparison can change as the month progresses. Missing data produces no directional arrow. All ramping figures are preliminary.</p></details>';
 }else{
  const m=t4Model(rows,widget,id),pairs=m.points.filter(p=>p.published!==null&&p.captured!==null),pair=pairs[pairs.length-1];
  body='<h2>'+escape(name)+'</h2><p class="hospital-title">T4 wait · daily comparison</p><div class="legend"><span class="published">━ Published daily median</span><span class="captured">┄ Captured-reading median</span></div>'+overlay(m.points)+'<p class="meta">Minutes · Perth dates · '+m.matched+' matched days</p>'+(pair?'<div class="pair"><div><strong>'+number(pair.published)+' min</strong><span>Published · '+pair.date+'</span></div><div><strong>'+number(pair.captured)+' min</strong><span>Captured · '+pair.samples+' samples</span></div></div>':'<p class="meta">'+(m.capturedDays?'No overlapping dates yet.':'No captured T4 readings yet. Import your version 1.5 history CSV, or collect readings with the Preview widget.')+'</p>')+'<details><summary>Data and comparison method</summary><p>The green series is WA Health’s published daily median T4 wait. The orange series is the daily median of the widget’s sampled published T4 average waits. These are different measures, not two estimates of the same patient-level median. No interpolation fills collection gaps. Up to 90 days ending at the newest available date are displayed. Preview cannot read version 1.5’s private history directly; use History → Export CSV there, then Import here.</p><div class="scroll"><table><tr><th>Perth date</th><th>Published min</th><th>Captured min</th><th>Samples</th></tr>'+m.points.slice().reverse().map(p=>'<tr><td>'+p.date+'</td><td>'+number(p.published)+'</td><td>'+number(p.captured)+'</td><td>'+p.samples+'</td></tr>').join('')+'</table></div></details>';
 }
 if(!preview)body=body.replace('No captured T4 readings yet. Import your version 1.5 history CSV, or collect readings with the Preview widget.','No captured T4 readings in this period yet. Your existing widget history is read automatically.').replace('Preview cannot read version 1.5’s private history directly; use History → Export CSV there, then Import here.','Your retained widget history is read directly. CSV imports are optional and are kept separate from the database.');
 return navigation(index)+'<section class="card">'+body+'</section>';
}
const api={hospitals,rampModel,t4Model,render};if(typeof module!=='undefined')module.exports=api;root.HospitalPages=api;
})(typeof window==='undefined'?globalThis:window);
