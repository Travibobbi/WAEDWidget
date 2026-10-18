(function(root){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number.isFinite(x)?x.toLocaleString('en-AU',{maximumFractionDigits:1}):'—';
function build(rows,hospitalPages){
 const cards=[],response=rows.filter(o=>o.source_id==='sjwa-response'&&o.period_type==='day'&&o.metric_id==='response_within_target_fraction');
 const reportDate=response.map(o=>o.reporting_date).sort().pop();
 for(const priority of [1,2,3]){
  const series=response.filter(o=>o.ambulance_priority===priority).sort((a,b)=>a.reporting_date.localeCompare(b.reporting_date));
  const last=series.find(o=>o.reporting_date===reportDate);if(!last||!Number.isFinite(last.value))continue;
  const yesterday=new Date(Date.parse(reportDate)-86400000).toISOString().slice(0,10),prior=series.find(o=>o.reporting_date===yesterday);
  const delta=prior&&Number.isFinite(prior.value)?(last.value-prior.value)*100:null;
  const target=rows.find(o=>o.source_id===last.source_id&&o.metric_id==='response_target_fraction'&&o.period_type==='day'&&o.reporting_date===reportDate&&o.ambulance_priority===priority);
  cards.push({id:'response-'+priority,title:'Priority '+priority+' response',date:reportDate,value:fmt(last.value*100)+'%',label:'responses within target',summary:delta===null?'Previous day unavailable; no daily change inferred.':Math.abs(delta)<.05?'Little change from the previous day.':fmt(Math.abs(delta))+' percentage points '+(delta>0?'higher':'lower')+' than the previous day.',note:target&&Number.isFinite(target.value)?'Source target: '+fmt(target.value*100)+'%.':'',points:series.slice(-30).map(o=>({date:o.reporting_date,value:Number.isFinite(o.value)?o.value*100:null})),unit:'%',score:delta===null?0:Math.abs(delta),kind:'daily'});
 }
 const ramps=[];
 for(const [id,name] of hospitalPages.hospitals){const m=hospitalPages.rampModel(rows,id);if(!m.bars.length||m.delta===null)continue;
  const points=hospitalPages.recentMonths(rows,id).map(b=>({date:b.start,value:b.rate}));
  ramps.push({id:'ramp-'+id,title:name+' ramping',date:m.asOf,value:fmt(m.bars[3].rate)+' h/day',label:m.bars[3].partial?'month-to-date daily rate':'monthly daily rate',summary:m.percent===null?'Previous-year percentage comparison unavailable.':Math.abs(m.percent)<.05?'Daily rate is similar to the same month last year.':fmt(Math.abs(m.percent))+'% '+(m.delta>0?'higher':'lower')+' daily rate than the same month last year.',note:m.bars[3].partial?'MONTH IN PROGRESS · '+m.bars[3].days+' of '+m.bars[3].monthDays+' days reported. '+(m.projection===null?'':fmt(m.projection)+' hours estimated at month end if the rate continues.'):'Complete month; source figures remain preliminary.',points,unit:'h/day',score:Math.abs(m.percent||0),kind:'monthly'});
 }
 // Daily response changes first; then the largest same-month ramping rate differences.
 cards.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));ramps.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 return cards.concat(ramps.slice(0,3));
}
function graph(card){
 const good=card.points.filter(p=>Number.isFinite(p.value));if(!good.length)return '<p>No numeric history available.</p>';
 const min=Date.parse(card.points[0].date),max=Date.parse(card.points[card.points.length-1].date),top=Math.max(card.unit==='%'?100:1,...good.map(p=>p.value));let d='',last=null;
 for(const p of card.points){if(!Number.isFinite(p.value)){last=null;continue;}const t=Date.parse(p.date),x=55+(t-min)/(max-min||86400000)*515,y=190-p.value/top*145;d+=(last!==null&&(card.kind!=='daily'||t-last===86400000)?' L':' M')+x+' '+y;last=t;}
 return '<svg viewBox="0 0 620 235" role="img" aria-label="Historical '+esc(card.title)+' in '+esc(card.unit)+'"><path d="M55 35V190H580" fill="none" stroke="#cbd9d1"/><text x="55" y="22" font-size="12">'+fmt(top)+' '+card.unit+'</text><path d="'+d+'" fill="none" stroke="#236e53" stroke-width="3"/>'+good.map(p=>'<circle cx="'+(55+(Date.parse(p.date)-min)/(max-min||86400000)*515)+'" cy="'+(190-p.value/top*145)+'" r="4" fill="#236e53"/>').join('')+'<text x="55" y="218" font-size="12">'+card.points[0].date+'</text><text x="575" y="218" text-anchor="end" font-size="12">'+card.points[card.points.length-1].date+'</text></svg>';
}
function render(cards,index){
 if(!cards.length)return '<section class="card"><h2>Waiting for report data</h2><p>Refresh to check for the latest St John report. Saved history is unchanged.</p></section>';
 const c=cards[index];return '<nav class="navigation"><button id="insight-prev" '+(index===0?'disabled':'')+'>← Previous</button><span>'+(index+1)+' / '+cards.length+'</span><button id="insight-next" '+(index===cards.length-1?'disabled':'')+'>Next →</button></nav><section class="card"><p class="insight-kicker">ST JOHN WA · REPORT THROUGH '+c.date+'</p><h2>'+esc(c.title)+'</h2><p class="insight-value">'+esc(c.value)+'</p><p class="hospital-title">'+esc(c.label)+'</p><p>'+esc(c.summary)+'</p>'+(c.note?'<p class="'+(c.kind==='monthly'?'notice':'meta')+'">'+esc(c.note)+'</p>':'')+graph(c)+'<details><summary>How this highlight is selected</summary><p>Recomputed from each available report. Daily response cards are ordered by the absolute percentage-point change from the previous calendar day. Ramping cards show the three largest absolute daily-rate differences against the same month last year. These are descriptive comparisons, not statistical significance tests or evidence of cause. Missing days are not connected. Monthly charts show the current month and previous three months in hours per day.</p></details></section><p class="meta">New report data refreshes these highlights automatically. A new capture may contain unchanged source figures.</p>';
}
const api={build,render};if(typeof module!=='undefined')module.exports=api;root.Insights=api;
})(typeof window==='undefined'?globalThis:window);
