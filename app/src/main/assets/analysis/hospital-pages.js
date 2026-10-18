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
  return {year:y,days,monthDays,total:usable?o.value:null,rate:usable?o.value/days:null,partial:y===year&&days<monthDays};
 });
 const current=bars[3],prior=bars[2],valid=Number.isFinite(current.rate)&&Number.isFinite(prior.rate);
 const delta=valid?current.rate-prior.rate:null;
 const projection=current.partial&&current.days>=7&&Number.isFinite(current.rate)?current.rate*current.monthDays:null;
 return {asOf,month,year,bars,projection,delta,percent:valid&&prior.rate>0?delta/prior.rate*100:null,direction:!valid?'unknown':Math.abs(delta)<1e-9?'flat':delta>0?'up':'down'};
}
function recentMonths(rows,id){
 const m=rampModel(rows,id);if(!m.asOf)return [];
 return [-3,-2,-1,0].map(offset=>{const d=new Date(Date.UTC(m.year,Number(m.month)-1+offset,1)),year=d.getUTCFullYear(),month=d.getUTCMonth()+1,start=d.toISOString().slice(0,10),monthDays=new Date(Date.UTC(year,month,0)).getUTCDate(),days=offset===0?Number(m.asOf.slice(8,10)):monthDays;
 const o=rows.find(o=>o.source_id==='sjwa-ramping'&&o.establishment_id===id&&o.metric_id==='ramped_hours'&&o.period_type==='month'&&o.period_start===start);
 const usable=o&&Number.isFinite(o.value)&&(offset===0||o.period_complete===true);
 return {year,label:d.toLocaleDateString('en-AU',{month:'short',year:'2-digit',timeZone:'UTC'}),start,days,total:usable?o.value:null,rate:usable?o.value/days:null,partial:offset===0&&days<monthDays};
 });
}
function hourTicks(values){const top=Math.max(60,Math.ceil(Math.max(0,...values.filter(Number.isFinite))/60)*60);return Array.from({length:top/60+1},(_,i)=>i*60);}
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
function recentTrend(bars){
 const current=bars[3],prior=bars.slice(0,3);if(!current||!Number.isFinite(current.rate)||prior.length!==3||prior.some(b=>!Number.isFinite(b.total)))return {direction:'unknown',percent:null,delta:null};
 const baseline=prior.reduce((n,b)=>n+b.total,0)/prior.reduce((n,b)=>n+b.days,0),delta=current.rate-baseline;
 return {direction:Math.abs(delta)<1e-9?'flat':delta>0?'up':'down',delta,percent:baseline>0?delta/baseline*100:null};
}
function direction(m,label){const arrow={up:'↑',down:'↓',flat:'↔',unknown:'—'}[m.direction],word={up:'Trending higher',down:'Trending lower',flat:'Holding steady',unknown:'Comparison unavailable'}[m.direction];return '<div class="direction '+m.direction+'"><span class="arrow" aria-hidden="true">'+arrow+'</span><div><strong>'+word+'</strong><div>'+(m.delta===null?'':m.percent===null?number(Math.abs(m.delta))+' h/day':number(Math.abs(m.percent))+'%')+'</div><small>'+escape(label)+'</small></div></div>';}
function barGraph(bars){
 const top=Math.max(1,...bars.map(b=>b.rate||0));let svg='<svg viewBox="0 0 440 300" role="img" aria-label="Ramping hours per day comparison"><text transform="translate(18 145) rotate(-90)" text-anchor="middle" font-size="15">Ramping hours per day</text>';
 for(const f of [0,.5,1]){const y=240-f*185;svg+='<path d="M76 '+y+'H428" stroke="#dce6df"/><text x="67" y="'+(y+5)+'" text-anchor="end" font-size="14">'+number(top*f)+'</text>'}
 bars.forEach((b,i)=>{const x=88+i*85,height=b.rate===null?0:b.rate/top*185;svg+='<rect x="'+x+'" y="'+(240-height)+'" width="54" height="'+height+'" rx="5" fill="'+(i===3?'#236e53':'#9dbbad')+'"/><text x="'+(x+27)+'" y="'+(228-height)+'" text-anchor="middle" font-size="17" font-weight="bold">'+number(b.rate)+'</text><text x="'+(x+27)+'" y="269" text-anchor="middle" font-size="14">'+(b.label||b.year)+'</text>'});
 return svg+'</svg>';
}
function overlay(points){
 if(!points.length)return '<p class="muted">No T4 data for this hospital yet.</p>';
 const first=Date.parse(points[0].date),last=Date.parse(points[points.length-1].date),ticks=hourTicks(points.flatMap(p=>[p.published,p.captured])),top=ticks[ticks.length-1],days=Math.round((last-first)/dayMs)+1;
 const width=Math.max(350,days*62+40),height=Math.max(380,ticks.length*32+70),baseline=height-65,x=t=>25+(t-first)/dayMs*62,y=v=>baseline-v/top*(baseline-25);
 let axis='<svg width="54" height="'+height+'" viewBox="0 0 54 '+height+'" style="width:54px;min-width:54px;height:'+height+'px;margin:0" aria-label="Wait in hours">',svg='<svg width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'" style="width:'+width+'px;max-width:none;height:'+height+'px;margin:0" role="img" aria-label="T4 waits with a marker every 24 hours; swipe horizontally for history">';
 for(const tick of ticks){const yy=y(tick);svg+='<path d="M0 '+yy+'H'+width+'" stroke="#ccdcd3"/>';axis+='<text x="47" y="'+(yy+5)+'" text-anchor="end" font-size="14">'+(tick/60)+' h</text>';}
 for(let t=first;t<=last;t+=dayMs){const xx=x(t),label=new Date(t).toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'});svg+='<path d="M'+xx+' 20V'+baseline+'" stroke="#e5ece8"/><text x="'+xx+'" y="'+(baseline+25)+'" text-anchor="middle" font-size="13">'+label+'</text>';}
 for(const [key,color,dash] of [['published','#236e53',''],['captured','#bb6314',' stroke-dasharray="7 4"']]){
  let path='',dots='',previous=null;for(const p of points){const t=Date.parse(p.date),v=p[key];if(v===null){previous=null;continue}const xx=x(t),yy=y(v);path+=(previous!==null&&t-previous<=dayMs?' L':' M')+xx+' '+yy;dots+='<circle cx="'+xx+'" cy="'+yy+'" r="4" fill="'+color+'"><title>'+p.date+': '+number(v)+' min</title></circle>';previous=t}
  svg+='<path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="3"'+dash+'/>'+dots;
 }
 return '<div class="t4-plot">'+axis+'</svg><div class="t4-scroll" tabindex="0" aria-label="Scroll through daily T4 history">'+svg+'</svg></div></div><p class="meta">Swipe sideways · each date marker is 24 hours · '+points[0].date+' to '+points[points.length-1].date+'</p>';
}
function render(mode,index,rows,widget,preview=true){
 const [id,name]=hospitals[index];let body='';
 if(mode==='ramping'){
  const m=rampModel(rows,id);if(!m.bars.length)return navigation(index)+'<section class="card"><h2>'+escape(name)+'</h2><p>No ramping history available.</p></section>';
  const recent=recentMonths(rows,id),trend=recentTrend(recent),month=new Date(m.year+'-'+m.month+'-01T00:00:00Z').toLocaleDateString('en-AU',{month:'long',timeZone:'UTC'});
  body='<div class="hospital-heading"><p class="eyebrow">HOSPITAL '+(index+1)+' OF '+hospitals.length+'</p><h2>'+escape(name)+'</h2><p class="hospital-title">'+month+' '+m.year+' · through '+m.asOf+'</p></div>'+(m.bars[3].partial?'<span class="progress-badge">Month in progress</span>':'')+'<h3>Same month across years</h3>'+direction(m,'vs '+month+' '+(m.year-1))+barGraph(m.bars)+'<div class="recent-months"><h3>Recent months</h3>'+direction(trend,'vs previous 3 months combined')+barGraph(recent)+'</div><details><summary>Totals, estimate and method</summary>'+(m.projection===null?'':'<p>Estimated month-end total: <strong>'+number(m.projection)+' hours</strong>, if the daily rate continues.</p>')+'<table><tr><th>Year</th><th>Hours</th><th>Days</th><th>Hours/day</th></tr>'+m.bars.map(b=>'<tr><td>'+b.year+'</td><td>'+number(b.total)+'</td><td>'+b.days+'</td><td>'+number(b.rate)+'</td></tr>').join('')+'</table><p>'+m.bars[3].days+' of '+m.bars[3].monthDays+' days reported. Current rates use elapsed days; historical rates use complete months. The recent-month arrow compares the current rate with total hours divided by total days across the preceding three months. All three are required. Missing values stay blank. Higher ramping rates are red, lower rates green. These preliminary comparisons can change; the straight-line month-end estimate does not model changing demand or weekdays.</p></details>';

 }else{
  const m=t4Model(rows,widget,id),pairs=m.points.filter(p=>p.published!==null&&p.captured!==null),pair=pairs[pairs.length-1];
  body='<h2>'+escape(name)+'</h2><p class="hospital-title">T4 wait · daily comparison</p><div class="legend"><span class="published">━ Published daily median</span><span class="captured">┄ Captured-reading median</span></div>'+overlay(m.points)+'<p class="meta">Minutes · horizontal lines every hour · Perth dates · '+m.matched+' matched days</p>'+(pair?'<div class="pair"><div><strong>'+number(pair.published)+' min</strong><span>Published · '+pair.date+'</span></div><div><strong>'+number(pair.captured)+' min</strong><span>Captured · '+pair.samples+' samples</span></div></div>':'<p class="meta">'+(m.capturedDays?'No overlapping dates yet.':'No captured T4 readings yet. Import your version 1.5 history CSV, or collect readings with the Preview widget.')+'</p>')+'<details><summary>Data and comparison method</summary><p>The green series is WA Health’s published daily median T4 wait. The orange series is the daily median of the widget’s sampled published T4 average waits. These are different measures, not two estimates of the same patient-level median. No interpolation fills collection gaps. Up to 90 days ending at the newest available date are displayed. Preview cannot read version 1.5’s private history directly; use History → Export CSV there, then Import here.</p><div class="scroll"><table><tr><th>Perth date</th><th>Published min</th><th>Captured min</th><th>Samples</th></tr>'+m.points.slice().reverse().map(p=>'<tr><td>'+p.date+'</td><td>'+number(p.published)+'</td><td>'+number(p.captured)+'</td><td>'+p.samples+'</td></tr>').join('')+'</table></div></details>';
 }
 if(!preview)body=body.replace('No captured T4 readings yet. Import your version 1.5 history CSV, or collect readings with the Preview widget.','No captured T4 readings in this period yet. Your existing widget history is read automatically.').replace('Preview cannot read version 1.5’s private history directly; use History → Export CSV there, then Import here.','Your retained widget history is read directly. CSV imports are optional and are kept separate from the database.');
 return navigation(index)+'<section class="card">'+body+'</section>';
}
const api={hospitals,rampModel,recentMonths,recentTrend,hourTicks,t4Model,overlay,render};if(typeof module!=='undefined')module.exports=api;root.HospitalPages=api;
})(typeof window==='undefined'?globalThis:window);
