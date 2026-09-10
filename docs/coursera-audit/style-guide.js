'use strict';
const byId = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const components = JSON.parse(byId('component-data').textContent);
const evidence = JSON.parse(byId('evidence-data').textContent);

const palette = [
 ['Action blue','#0056D2'],['Primary text','#0D0F12'],['Secondary text','#48546E'],
 ['White surface','#FFFFFF'],['Pale blue','#F0F6FF'],['Card border','#C1CBDB']
];
byId('core-swatches').innerHTML = palette.map(([label,color]) => `<div class="swatch"><div class="paint" style="background:${color}"></div><div class="swatch-label"><strong>${label}</strong><code>${color}</code></div></div>`).join('');
byId('spacing-scale').innerHTML = [4,8,12,16,24,32,48,64].map(n=>`<div class="space-item"><i style="width:${n}px"></i><span>${n}</span></div>`).join('');

let toastTimer;
function toast(message){clearTimeout(toastTimer);byId('demo-toast').textContent=message;toastTimer=setTimeout(()=>byId('demo-toast').textContent='',5000);}
document.querySelectorAll('[data-demo]').forEach(button=>button.addEventListener('click',()=>toast(`${button.dataset.demo} specimen selected. This is a local style demonstration.`)));
byId('loading-demo').addEventListener('click', async event=>{
 const button=event.currentTarget;button.style.minWidth=`${button.getBoundingClientRect().width}px`;button.disabled=true;button.textContent='Saving…';button.setAttribute('aria-busy','true');
 await new Promise(resolve=>setTimeout(resolve,900));
 button.disabled=false;button.removeAttribute('aria-busy');button.textContent='Test loading state';button.style.minWidth='';toast('Example save complete.');
});

byId('field-demo').addEventListener('submit',event=>{
 event.preventDefault();const input=byId('addendum-title'),error=byId('title-error');
 if(!input.value.trim()){
  error.hidden=false;input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby','title-helper title-error');byId('field-status').textContent='';input.focus();
 }else{
  error.hidden=true;input.removeAttribute('aria-invalid');input.setAttribute('aria-describedby','title-helper');byId('field-status').textContent=`Example draft “${input.value.trim()}” saved in this page only.`;
 }
});

const dialogTriggers=new Map();
function containDialogFocus(dialog){
 dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const focusable=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]')].filter(element=>element.getClientRects().length);
  const first=focusable[0],last=focusable.at(-1);if(!first)return;
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 });
}
function openDialog(id,trigger){const dialog=byId(id);dialogTriggers.set(id,trigger||document.activeElement);dialog.showModal();}
function closeDialog(id){byId(id).close();}
document.querySelectorAll('dialog').forEach(dialog=>{containDialogFocus(dialog);dialog.addEventListener('close',()=>{
 const trigger=dialogTriggers.get(dialog.id);if(trigger&&trigger.isConnected)trigger.focus();
});});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>closeDialog(button.dataset.close)));
byId('record-open').addEventListener('click',event=>openDialog('record-dialog',event.currentTarget));

const courses=[
 {id:'hazcom',name:'Hazard communication essentials',topic:'Hazard communication',minutes:20,version:'2.1',summary:'Recognize hazard information and locate the site-specific instructions that apply to your work.',kind:'hazcom',path:'M7 4h10l4 4v14H7V4Zm10 0v5h4M11 13h6M11 17h6',note:'Knowledge + site instruction'},
 {id:'ppe',name:'PPE selection and use',topic:'PPE',minutes:25,version:'1.4',summary:'Review task-specific protective equipment and the demonstration steps identified in your assignment.',kind:'ppe',path:'M12 3 3 7v7c0 6 5 9 9 11 4-2 9-5 9-11V7l-9-4Zm-4 11 3 3 6-7',note:'Knowledge + demonstration'},
 {id:'energy',name:'Energy control awareness',topic:'Energy control',minutes:15,version:'3.0',summary:'Understand your assigned role and where local energy-control procedures are available.',kind:'energy',path:'M6 12h12v11H6V12Zm3 0V7a3 3 0 0 1 6 0v5M12 16v3',note:'Role-specific learning'}
];
let appliedTopics=new Set(),appliedQuery='';
const previewDialog=document.createElement('dialog');
previewDialog.id='course-preview';previewDialog.className='hse-dialog';previewDialog.setAttribute('aria-labelledby','preview-title');
previewDialog.innerHTML='<div class="dialog-head"><h2 id="preview-title">Course preview</h2><button class="close-button" id="preview-close" type="button" aria-label="Close course preview">×</button></div><div class="dialog-content" id="preview-content"></div><div class="dialog-actions"><button class="hse-button" id="preview-done" type="button">Close preview</button></div>';
document.body.append(previewDialog);
containDialogFocus(previewDialog);
previewDialog.addEventListener('close',()=>{const opener=dialogTriggers.get('course-preview');if(opener?.isConnected)opener.focus();});
byId('preview-close').addEventListener('click',()=>previewDialog.close());byId('preview-done').addEventListener('click',()=>previewDialog.close());

function renderCourses(){
 let matching=courses.filter(c=>(!appliedTopics.size||appliedTopics.has(c.topic))&&(!appliedQuery||`${c.name} ${c.topic} ${c.summary}`.toLowerCase().includes(appliedQuery.toLowerCase())));
 matching.sort((a,b)=>byId('sort-courses').value==='duration'?a.minutes-b.minutes:a.name.localeCompare(b.name));
 byId('course-grid').innerHTML=matching.map(c=>`<article class="course-card"><div class="course-art ${c.kind}"><svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="${c.path}"/></svg></div><div class="course-card-content"><p class="provider">HSE Informer · Example content</p><h4><button type="button" class="course-preview-button" data-course="${c.id}" aria-haspopup="dialog">${esc(c.name)}</button></h4><p>${esc(c.summary)}</p><div class="course-meta"><span>${c.minutes} min</span><span aria-hidden="true">·</span><span>Version ${c.version}</span></div><span class="hse-badge info">${esc(c.note)}</span></div></article>`).join('');
 byId('course-grid').hidden=!matching.length;byId('catalog-empty').hidden=!!matching.length;
 byId('result-count').textContent=`${matching.length} example course${matching.length===1?'':'s'}${appliedQuery?` matching “${appliedQuery}”`:''}`;
 byId('filter-count').textContent=`(${appliedTopics.size})`;
 byId('applied-filters').innerHTML=[...appliedTopics].map(t=>`<button type="button" data-remove="${esc(t)}" aria-label="Remove ${esc(t)} filter">${esc(t)} <span aria-hidden="true">×</span></button>`).join('');
 byId('applied-filters').querySelectorAll('[data-remove]').forEach(button=>button.addEventListener('click',()=>{appliedTopics.delete(button.dataset.remove);renderCourses();byId('filter-open').focus();}));
 byId('course-grid').querySelectorAll('[data-course]').forEach(button=>button.addEventListener('click',()=>{
  const course=courses.find(c=>c.id===button.dataset.course);byId('preview-title').textContent=course.name;
  byId('preview-content').innerHTML=`<p class="eyebrow">Illustrative course preview</p><p>${esc(course.summary)}</p><dl class="record-facts"><div><dt>Duration</dt><dd>${course.minutes} minutes</dd></div><div><dt>Content version</dt><dd>${course.version}</dd></div><div><dt>Topic</dt><dd>${esc(course.topic)}</dd></div><div><dt>Outcome</dt><dd>${esc(course.note)}</dd></div></dl><div class="notice info"><span aria-hidden="true">i</span><div><h3>Applicability comes from the qualification plan</h3><p>Completing this example does not grant work authorization. Site instruction and practical steps are tracked separately when required.</p></div></div>`;
  openDialog('course-preview',button);
 }));
}
byId('catalog-search').addEventListener('submit',event=>{event.preventDefault();appliedQuery=byId('course-query').value.trim();renderCourses();});
byId('course-query').addEventListener('search',()=>{if(!byId('course-query').value){appliedQuery='';renderCourses();}});
byId('sort-courses').addEventListener('change',renderCourses);
byId('filter-open').addEventListener('click',event=>{document.querySelectorAll('#filter-form input[name=topic]').forEach(input=>input.checked=appliedTopics.has(input.value));openDialog('filter-dialog',event.currentTarget);});
byId('filter-form').addEventListener('submit',event=>{event.preventDefault();appliedTopics=new Set([...document.querySelectorAll('#filter-form input[name=topic]:checked')].map(input=>input.value));renderCourses();closeDialog('filter-dialog');});
byId('clear-draft').addEventListener('click',()=>document.querySelectorAll('#filter-form input[name=topic]').forEach(input=>input.checked=false));
byId('clear-catalog').addEventListener('click',()=>{appliedQuery='';byId('course-query').value='';appliedTopics.clear();renderCourses();byId('course-query').focus();});
byId('browse-demo').addEventListener('click',event=>{event.preventDefault();byId('course-query').scrollIntoView({block:'center'});byId('course-query').focus({preventScroll:true});});
renderCourses();

const tabs=[...document.querySelectorAll('.hse-tabs [role=tab]')];
function activateTab(tab){tabs.forEach(t=>{const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;byId(t.getAttribute('aria-controls')).hidden=!active;});}
tabs.forEach((tab,index)=>{
 tab.addEventListener('click',()=>activateTab(tab));
 tab.addEventListener('keydown',event=>{
  const key=event.key;let next;
  if(key==='ArrowRight')next=(index+1)%tabs.length;
  if(key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;
  if(key==='Home')next=0;if(key==='End')next=tabs.length-1;
  if(next!==undefined){event.preventDefault();tabs.forEach(t=>t.tabIndex=-1);tabs[next].tabIndex=0;tabs[next].focus();}
  if(key==='Enter'||key===' '){event.preventDefault();activateTab(tab);}
 });
});
byId('retry-demo').addEventListener('click',()=>{byId('retry-status').textContent='Retry example complete. In production, confirm the upload on the server before showing success.';});

byId('component-inventory').innerHTML=components.map(c=>`<details class="contract" data-component="${c.id}"><summary><span class="contract-id">${c.id}</span><strong>${esc(c.name)}</strong></summary><dl class="contract-detail"><dt>Coverage</dt><dd class="coverage">${esc(c.coverage)}</dd><dt>Evidence</dt><dd>${esc(c.evidence)}</dd><dt>Anatomy</dt><dd>${esc(c.anatomy)}</dd><dt>States</dt><dd>${esc(c.states)}</dd><dt>Behavior</dt><dd>${esc(c.behavior)}</dd><dt>Accessibility</dt><dd>${esc(c.accessibility)}</dd></dl></details>`).join('');
byId('component-query').addEventListener('input',()=>{
 const query=byId('component-query').value.toLowerCase().trim();let visible=0;
 components.forEach(c=>{const element=document.querySelector(`[data-component="${c.id}"]`);const match=Object.values(c).join(' ').toLowerCase().includes(query);element.hidden=!match;if(match)visible++;});
 byId('component-count').textContent=`${visible} component contract${visible===1?'':'s'}`;byId('component-empty').hidden=!!visible;
});
byId('evidence-gallery').innerHTML=evidence.map(e=>`<figure class="evidence-figure"><a href="evidence/${esc(e.file)}" aria-label="Open ${esc(e.id)}: ${esc(e.state)}"><img loading="lazy" src="evidence/${esc(e.file)}" alt="${esc(e.state)}"></a><figcaption><strong>${esc(e.id)} · ${esc(e.viewport)}</strong>${esc(e.state)}</figcaption></figure>`).join('');

if('IntersectionObserver' in window){
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;document.querySelectorAll('.guide-nav nav a').forEach(link=>{if(link.getAttribute('href')===`#${entry.target.id}`)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});}},{rootMargin:'-5% 0px -65% 0px',threshold:0});
 document.querySelectorAll('main>.section').forEach(section=>observer.observe(section));
}
let printDetails=[];
window.addEventListener('beforeprint',()=>{printDetails=[...document.querySelectorAll('details')].filter(d=>!d.open);printDetails.forEach(d=>d.open=true);});
window.addEventListener('afterprint',()=>printDetails.forEach(d=>d.open=false));
