(function(root){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const quantile=(a,p)=>{a=a.filter(Number.isFinite).slice().sort((a,b)=>a-b);if(!a.length)return null;let i=(a.length-1)*p,l=Math.floor(i);return a[l]+(a[Math.ceil(i)]-a[l])*(i-l)};
const fmt=(n,u='')=>n===null||n===undefined?'—':Number(n).toLocaleString('en-AU',{maximumFractionDigits:2})+(u?' '+u:'');
const key=o=>JSON.stringify([o.source_id,o.establishment_id,o.metric_id,o.period_type||'day',o.period_start||o.reporting_date,o.period_end||o.reporting_date,o.ambulance_priority??null,o.comparison??null]);
function latest(rows){const m=new Map();for(const o of rows){const k=key(o),p=m.get(k);if(!p||Date.parse(o.captured_at_utc)>Date.parse(p.captured_at_utc))m.set(k,o)}return [...m.values()]}
function stats(rows){const valid=rows.filter(r=>Number.isFinite(r.source_time)&&r.source_time>0&&Number.isFinite(r.wait));let times=[...new Set(valid.map(r=>r.source_time))].sort((a,b)=>a-b);let gaps=0;for(let i=1;i<times.length;i++)if(times[i]-times[i-1]>90*60000)gaps++;return {valid,unparsed:rows.length-valid.length,days:new Set(times.map(t=>new Date(t+8*3600000).toISOString().slice(0,10))).size,gaps,median:quantile(valid.map(r=>r.wait),.5),p90:quantile(valid.map(r=>r.wait),.9)}}
const api={quantile,latest,stats,key};if(typeof module!=='undefined')module.exports=api;if(!root.document)return;
let data,observations,hospital='',series='',source='sjwa-ramping',entity='royal-perth',mode='highlights',slideIndex=0;
const hospitalIndexes={ramping:0,t4:0};
function bindTabs(){for(const id of ['highlights','explorer','ramping','t4']){const b=document.getElementById(id);b.classList.toggle('active',mode===id);b.setAttribute('aria-pressed',String(mode===id));b.onclick=()=>{mode=id;render()}}}
const card=(title,body)=>'<section class="card"><h2>'+title+'</h2>'+body+'</section>';
const stat=(value,label)=>'<div class="stat"><strong>'+esc(value)+'</strong>'+esc(label)+'</div>';
function renderLegacy(){const w=data.widget||{rows:[],snapshots:0},rows=w.rows||[],hospitals=[...new Set(rows.map(r=>r.hospital))].sort();if(!hospitals.includes(hospital))hospital=hospitals[0]||'';const selected=rows.filter(r=>r.hospital===hospital),s=stats(selected);
let html=card('A clear view of coverage','<div class="grid">'+stat(fmt(w.snapshots),'retained widget snapshots')+stat(fmt(observations.length),'latest archive observations')+stat(fmt(data.archives.imported_files||0),'imported archive files')+'</div><p class="muted">Widget patterns use up to the last 90 days of collected history. All older history remains stored. Archive figures below are saved snapshots, refreshed through imports; this screen does not sync with Drive.</p>');
html+=card('T4 · your observed patterns',hospitals.length?'<label for="hospital">Hospital</label><select id="hospital">'+hospitals.map(h=>'<option '+(h===hospital?'selected':'')+'>'+esc(h)+'</option>').join('')+'</select><div class="grid">'+stat(fmt(s.median,'min'),'median published T4 reading')+stat(fmt(s.p90,'min'),'90th percentile of readings')+stat(s.days,'observed Perth dates')+stat(s.gaps,'gaps longer than 90 minutes')+'</div><p>These describe sampled published readings, not individual patients’ waiting times. '+s.unparsed+' readings excluded because their source time or value could not be interpreted.</p>'+hourTable(s.valid)+'<p class="muted">Times use the source timestamp in Australia/Perth. Uneven sampling and overnight collection gaps can affect comparisons. '+(s.days<7?'Less than seven observed dates: treat this as an initial description, not an established weekly pattern.':'Compare similar days and hours before interpreting differences.')+'</p>':'<p class="notice">T4 patterns will appear when this version runs on your phone with its existing history. No sample readings have been substituted.</p>');
const groups=new Map();for(const o of observations){let k=JSON.stringify([o.source_id,o.establishment_id,o.metric_id,o.period_type||'day',o.ambulance_priority??null,o.comparison??null]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o)}
const label=a=>[a.source_id,a.establishment_name||a.establishment_id,a.metric_id.replaceAll('_',' '),a.period_type||'day',a.ambulance_priority?'Priority '+a.ambulance_priority:'',a.comparison||''].filter(Boolean).join(' · ');
const sources=[...new Set(observations.map(o=>o.source_id))].sort();if(!sources.includes(source))source=sources[0];
const entities=[...new Set(observations.filter(o=>o.source_id===source).map(o=>o.establishment_id))].sort();if(!entities.includes(entity))entity=entities[0];
const keys=[...groups.keys()].filter(k=>{let o=groups.get(k)[0];return o.source_id===source&&o.establishment_id===entity}).sort((a,b)=>label(groups.get(a)[0]).localeCompare(label(groups.get(b)[0])));if(!keys.includes(series))series=keys[0];
let list=(groups.get(series)||[]).slice().sort((a,b)=>(a.period_start||a.reporting_date).localeCompare(b.period_start||b.reporting_date));let last=list[list.length-1];
const picker=(id,title,values,current,name)=>'<label for="'+id+'">'+title+'</label><select id="'+id+'">'+values.map(k=>'<option value="'+esc(k)+'" '+(k===current?'selected':'')+'>'+esc(name(k))+'</option>').join('')+'</select>';
html+=card('Archive explorer',picker('source','Source',sources,source,k=>({'sjwa-ramping':'SJWA · ambulance ramping','sjwa-response':'SJWA · response performance','wa-health-ed-daily':'WA Health · daily ED activity'}[k]||k))+picker('entity','Hospital or service',entities,entity,k=>observations.find(o=>o.source_id===source&&o.establishment_id===k).establishment_name||k)+picker('series','Measure and reporting period',keys,series,k=>label(groups.get(k)[0]).split(' · ').slice(2).join(' · '))+(last?'<h3>'+esc(label(last))+'</h3><div class="grid">'+stat(fmt(last.value,last.unit),'latest period value')+stat(last.as_of_date||last.reporting_date,'source as-of date')+stat(String(last.captured_at_utc).slice(0,10),'archive capture date (UTC)')+'</div>'+comparison(list)+chart(list)+'<p class="muted">'+list.length+' reporting periods. Missing values are not zero. Monthly buckets may include an incomplete current month; ramping figures are preliminary. Rolling seven-day values are overlapping windows and must not be added together.</p><div class="scroll"><table><thead><tr><th>Period / as of</th><th>Value</th><th>Status</th></tr></thead><tbody>'+list.slice().reverse().map(o=>'<tr><td>'+esc(o.period_start||o.reporting_date)+(o.period_end&&o.period_end!==o.period_start?' – '+esc(o.period_end):'')+'</td><td>'+esc(fmt(o.value,o.unit))+'</td><td>'+esc(o.status)+(o.period_complete===false?' · incomplete / source-defined':'')+'</td></tr>').join('')+'</tbody></table></div>':'<p>No supported observations.</p>'));
html+=card('What to investigate next','<p>Start with recurring T4 peaks by hospital, then compare daily ED activity with equivalent reporting periods. Monthly ambulance response and ramping histories can support longer-term comparisons.</p><p class="notice">This first version keeps measures separate: widget T4 readings and daily ED median waits are different statistics; ambulance priorities are different from ED triage categories. Shared movement is an association, not evidence that one measure caused another.</p>');
html+='<p class="footer">Report generated '+esc(new Date().toISOString())+' · Latest known revisions shown; imported files remain retained separately. Public source archives: WA Health and St John WA.</p>';document.getElementById('content').innerHTML=html;
const h=document.getElementById('hospital');if(h)h.onchange=()=>{hospital=h.value;render()};document.getElementById('series').onchange=e=>{series=e.target.value;render()};document.getElementById('source').onchange=e=>{source=e.target.value;render()};document.getElementById('entity').onchange=e=>{entity=e.target.value;render()};}
function comparison(list){const complete=list.filter(o=>o.period_type==='month'&&o.period_complete===true&&Number.isFinite(o.value));const current=complete[complete.length-1];if(!current)return '';const priorDate=String(Number(current.period_start.slice(0,4))-1)+current.period_start.slice(4);const prior=complete.find(o=>o.period_start===priorDate);if(!prior)return '';const delta=current.value-prior.value;const change=current.unit==='fraction'?fmt(delta*100,'percentage points'):fmt(delta,current.unit);return '<p class="notice"><strong>Same month, one year apart:</strong> '+esc(current.period_start.slice(0,7))+' was '+esc(fmt(current.value,current.unit))+' versus '+esc(fmt(prior.value,prior.unit))+' in '+esc(prior.period_start.slice(0,7))+'. Change: '+esc(change)+'. Only complete monthly buckets are compared; figures can still be revised.</p>'}
function hourTable(rows){let bins=Array.from({length:6},()=>[]);for(const r of rows)bins[Math.floor(new Date(r.source_time+8*3600000).getUTCHours()/4)].push(r.wait);let max=Math.max(1,...bins.map(b=>quantile(b,.5)||0));return '<h3>Median published T4 by time of day</h3><table><tr><th>Perth time</th><th>Median reading</th><th>Samples</th></tr>'+bins.map((b,i)=>{let m=quantile(b,.5);return '<tr><td>'+String(i*4).padStart(2,'0')+':00–'+String(i*4+3).padStart(2,'0')+':59</td><td>'+fmt(m,'min')+(m!==null?'<div class="bar" style="width:'+Math.max(1,m/max*100)+'%"></div>':'')+'</td><td>'+b.length+'</td></tr>'}).join('')+'</table>'}
function chart(list){const pts=list.map(o=>({t:Date.parse(o.period_start||o.reporting_date),v:o.value}));const good=pts.filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.v));if(good.length<2)return '<p>At least two numeric reporting periods are needed for a trend chart.</p>';let min=Math.min(...good.map(p=>p.t)),max=Math.max(...good.map(p=>p.t)),top=Math.max(1,...good.map(p=>p.v));let d='',pen=false;for(const p of pts){if(!Number.isFinite(p.v)||!Number.isFinite(p.t)){pen=false;continue}d+=(pen?' L':' M')+(40+((p.t-min)/(max-min||1))*640).toFixed(1)+' '+(190-p.v/top*160).toFixed(1);pen=true}return '<svg viewBox="0 0 720 230" role="img" aria-label="Time series; exact values in the table below"><path d="M40 25V190H690" fill="none" stroke="#b4c7bc"/><path d="'+d+'" fill="none" stroke="#23765d" stroke-width="3"/><text x="40" y="18" font-size="12">'+esc(fmt(top))+'</text><text x="40" y="212" font-size="12">'+esc(new Date(min).toISOString().slice(0,10))+'</text><text x="600" y="212" font-size="12">'+esc(new Date(max).toISOString().slice(0,10))+'</text></svg>'}

function slideChoices(){
 const choices=[];
 for(const h of [...new Set((data.widget.rows||[]).map(r=>r.hospital))].sort())choices.push({hospital:h});
 const wanted=[['sjwa-ramping','royal-perth','ramped_hours'],['sjwa-ramping','fiona-stanley','ramped_hours'],['sjwa-response',null,'response_within_target_fraction'],['sjwa-response',null,'response_cases'],['wa-health-ed-daily','royal-perth','triage_4_median_wait_minutes'],['wa-health-ed-daily','fiona-stanley','ed_attendances']];
 const seen=new Set();
 for(const [src,id,metric] of wanted)for(const o of observations){
  if(o.source_id!==src||(id&&o.establishment_id!==id)||o.metric_id!==metric||(src!=='wa-health-ed-daily'&&o.period_type!=='month'))continue;
  const k=JSON.stringify([o.source_id,o.establishment_id,o.metric_id,o.period_type||'day',o.ambulance_priority??null,o.comparison??null]);
  if(!seen.has(k)){seen.add(k);choices.push({source:src,entity:o.establishment_id,series:k})}
 }
 return choices;
}
function render(){
 if(mode==='ramping'||mode==='t4'){
  document.getElementById('content').innerHTML=root.HospitalPages.render(mode,hospitalIndexes[mode],observations,data.widget.rows||[],data.widget.is_preview!==false);
  document.getElementById('hospital-prev').onclick=()=>{hospitalIndexes[mode]=Math.max(0,hospitalIndexes[mode]-1);render()};
  document.getElementById('hospital-next').onclick=()=>{hospitalIndexes[mode]=Math.min(root.HospitalPages.hospitals.length-1,hospitalIndexes[mode]+1);render()};
  bindTabs();return;
 }
 const slides=slideChoices();slideIndex=Math.max(0,Math.min(slideIndex,slides.length-1));
 const current=slides[slideIndex];
 if(mode==='highlights'&&current){if(current.hospital)hospital=current.hospital;else{source=current.source;entity=current.entity;series=current.series}}
 renderLegacy();
 const content=document.getElementById('content'),cards=[...content.querySelectorAll(':scope > .card')];
 const coverage=cards[0],t4=cards[1],archive=cards[2];
 const info=document.createElement('details');info.className='coverage';info.innerHTML='<summary>Coverage & information</summary>'+coverage.innerHTML;coverage.remove();cards[3]?.remove();content.querySelector('.footer')?.remove();
 const widget=mode==='highlights'&&current?.hospital;
 if(widget)archive.remove();else t4.remove();
 const active=widget?t4:archive;
 const details=document.createElement('details');details.innerHTML='<summary>Data and notes</summary>';
 if(!widget){
  const heading=active.querySelector('h3'),parts=heading.textContent.split(' · ');
  active.querySelector('h2').textContent=parts.slice(2).join(' · ').replaceAll('_',' ');
  heading.textContent=parts[1];heading.className='hospital-title';
  const grid=active.querySelector('.grid'),stats=[...grid.children];
  const meta=document.createElement('p');meta.className='meta';meta.textContent='As of '+stats[1].querySelector('strong').textContent+' · captured '+stats[2].querySelector('strong').textContent;
  stats[1].remove();stats[2].remove();grid.className='hero';
  const selectedRows=observations.filter(o=>JSON.stringify([o.source_id,o.establishment_id,o.metric_id,o.period_type||'day',o.ambulance_priority??null,o.comparison??null])===series).sort((a,b)=>(a.period_start||a.reporting_date).localeCompare(b.period_start||b.reporting_date));
  const complete=selectedRows.filter(o=>o.period_type==='month'&&o.period_complete===true&&Number.isFinite(o.value));
  const last=mode==='highlights'&&complete.length?complete[complete.length-1]:selectedRows[selectedRows.length-1];
  if(last){
   const displayUnit=last.unit==='fraction'?'%':last.unit,displayValue=last.unit==='fraction'&&last.value!==null?last.value*100:last.value;
   stats[0].innerHTML='<strong>'+esc(fmt(displayValue,displayUnit))+'</strong>'+esc((last.period_start||last.reporting_date).slice(0,last.period_type==='month'?7:10)+(last.period_type==='month'?' · monthly':'')+(last.period_complete===false?' · incomplete / source-defined':''));meta.textContent+=' · '+displayUnit;
   const nice={ramped_hours:'Ambulance ramping',response_cases:'Ambulance cases',response_within_target_fraction:'Responses within target',triage_4_median_wait_minutes:'Triage 4 median wait',ed_attendances:'ED attendances'};
   active.querySelector('h2').textContent=(nice[last.metric_id]||last.metric_id.replaceAll('_',' '))+(last.ambulance_priority?' · Priority '+last.ambulance_priority:'');
   const shownRows=selectedRows.filter(o=>(o.period_start||o.reporting_date)<=(last.period_start||last.reporting_date)).map(o=>({...o,value:o.unit==='fraction'&&o.value!==null?o.value*100:o.value}));
   const oldChart=active.querySelector('svg');if(oldChart)oldChart.outerHTML=chart(shownRows);
  }
  const svg=active.querySelector('svg');if(svg)svg.insertAdjacentElement('afterend',meta);else active.append(meta);
  active.querySelectorAll('p.muted,.scroll').forEach(e=>details.append(e));
  const comparison=active.querySelector('.notice');if(comparison){comparison.className='comparison';comparison.textContent=comparison.textContent.replace('Same month, one year apart: ','').replace(' Only complete monthly buckets are compared; figures can still be revised.','');}
  if(mode==='highlights')active.querySelectorAll('label,select').forEach(e=>e.remove());
 }else{
  active.querySelector('h2').textContent='T4 wait patterns';
  active.querySelectorAll('label,select').forEach(e=>e.remove());
  const title=document.createElement('p');title.className='hospital-title';title.textContent=hospital;active.querySelector('h2').after(title);
  const rows=stats((data.widget.rows||[]).filter(r=>r.hospital===hospital)).valid;
  const days=new Map();for(const r of rows){const day=new Date(r.source_time+8*3600000).toISOString().slice(0,10);if(!days.has(day))days.set(day,[]);days.get(day).push(r.wait)}
  const seriesRows=[...days].sort((a,b)=>a[0].localeCompare(b[0])).map(([day,values])=>({reporting_date:day,value:quantile(values,.5)}));
  const grid=active.querySelector('.grid');[...grid.children].slice(1).forEach(e=>details.append(e));grid.className='hero';
  active.querySelectorAll('p:not(.hospital-title),h3,table').forEach(e=>details.append(e));
  grid.insertAdjacentHTML('afterend',chart(seriesRows)+'<p class="meta">Daily medians of published readings · Perth time · minutes</p>');
 }
 active.append(details);
 if(mode==='highlights'&&slides.length){
  const nav=document.createElement('nav');nav.className='navigation';nav.setAttribute('aria-label','Trend navigation');nav.innerHTML='<button id="previous" '+(slideIndex===0?'disabled':'')+'>← Previous</button><span aria-live="polite">'+(slideIndex+1)+' / '+slides.length+'</span><button id="next" '+(slideIndex===slides.length-1?'disabled':'')+'>Next →</button>';content.prepend(nav);
  document.getElementById('previous').onclick=()=>{slideIndex--;render()};document.getElementById('next').onclick=()=>{slideIndex++;render()};
  if(!widget){const open=document.createElement('button');open.className='explore-link';open.textContent='Explore this data ↗';open.onclick=()=>{mode='explorer';render()};active.after(open)}
 }
 content.append(info);
 bindTabs();
}

root.receive=d=>{data=d;observations=latest(d.archives.batches.flatMap(b=>b.observations||[]));render()};
root.reportHtml=()=>{const content=document.getElementById('content').cloneNode(true);content.querySelectorAll('select,label,button,.navigation').forEach(e=>e.remove());content.querySelectorAll('details').forEach(e=>e.setAttribute('open',''));return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WA ED analysis report</title><style>'+document.querySelector('style').textContent+'</style><h1>WA ED · Analysis report</h1>'+content.innerHTML+'</html>'};
})(typeof window==='undefined'?globalThis:window);
