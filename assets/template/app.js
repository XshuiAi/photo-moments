
'use strict';
let N=78;const scene=document.querySelector('#scene'), statusEl=document.querySelector('#status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const TAU=Math.PI*2, golden=Math.PI*(3-Math.sqrt(5));
let slots=Array.from({length:N},(_,i)=>{const y=1-2*(i+.5)/N,r=Math.sqrt(1-y*y);return [r*Math.cos(golden*i),y,r*Math.sin(golden*i)]});
let library=[],activeOrbitId='',switchingOrbit=false;
let records=[],album={title:"我的旅行",owner:"SHERRY小水",days:{},music:null},pendingVideos=[],usingDemo=true,activeRecord=null;
let cards=[],R=1,paused=reduced.matches,shuffleStart=null,shuffleCount=0,lastTime=0,raf=0,loaded=false;
let destination=Array.from({length:N},(_,i)=>i),from=slots.map(v=>v.slice()),current=slots.map(v=>v.slice());
const pauseBtn=document.querySelector('#pause'), shuffleBtn=document.querySelector('#shuffle');
const viewer=document.querySelector('#viewer'),enlarged=document.querySelector('#enlarged');
const scatterBtn=document.querySelector('#scatter');
let spread=0,spreadTarget=0,spreadTween=null,spreadLayout=[],wheelSum=0,wheelLast=-Infinity,wheelDirection=0;
let galleryHeight=0,galleryY=0,labels=[];
function layoutSpread(){
 const margin=innerWidth<600?20:56,top=112,W=innerWidth-margin*2,gap=innerWidth<600?16:28,cols=Math.max(2,Math.floor((W+gap)/(innerWidth<600?128:160))),cw=W/cols,ch=innerWidth<600?180:218;
 let y=top;spreadLayout=new Array(N);labels=[];
 const groups=new Map();cards.map((c,i)=>({c,i})).sort((a,b)=>a.c.record.date.localeCompare(b.c.record.date)||(a.c.record.time||'').localeCompare(b.c.record.time||'')||a.c.record.order-b.c.record.order).forEach(item=>{const date=album.theme==='drama'?(item.c.record.series||'未分剧集'):item.c.record.date;if(!groups.has(date))groups.set(date,[]);groups.get(date).push(item)});
 const host=document.querySelector('#day-labels');host.replaceChildren();
 for(const [date,items] of groups){const label=document.createElement('div');label.className='day-label';const title=document.createElement(album.theme==='drama'?'span':'button');title.type='button';title.className='day-title';title.textContent=album.theme==='drama'?date:usingDemo?'示例照片':date;if(album.theme!=='drama')title.addEventListener('click',()=>editDay(date));label.append(title);const mood=document.createElement('span');mood.textContent=album.theme==='drama'?'':album.days[date]||'';label.append(mood);const edit=document.createElement('button');edit.className='day-edit';edit.hidden=album.theme==='drama';edit.textContent='✎';edit.setAttribute('aria-label',`记录 ${date} 的心情`);edit.addEventListener('click',()=>editDay(date));label.append(edit);host.append(label);labels.push({el:label,y});y+=52;
 items.forEach(({c,i},j)=>{const row=Math.floor(j/cols),col=j%cols,scale=Math.min((cw-gap)/c.w,(ch-38)/c.h);spreadLayout[i]={x:margin+(col+.5)*cw-innerWidth/2,y:y+row*ch+(ch-22)/2-innerHeight/2,scale,angle:((i*7%5)-2)*Math.PI/180}});
 y+=Math.ceil(items.length/cols)*ch+28;
 }
 galleryHeight=y+60;galleryY=Math.min(galleryY,Math.max(0,galleryHeight-innerHeight));
}
function syncSpread(){scatterBtn.textContent=spreadTarget?'合拢 ↙':'展开 ↗';scatterBtn.setAttribute('aria-label',spreadTarget?'合拢为照片球':'散开所有照片');scatterBtn.setAttribute('aria-pressed',String(!!spreadTarget));const blocked=spreadTarget===1||spread>0;shuffleBtn.disabled=blocked;pauseBtn.disabled=blocked;scene.classList.toggle('spread',blocked);document.querySelector('#day-labels').hidden=spread!==1;document.querySelector('#hint').textContent=spread===1?'上滚合拢 · 拖动浏览 · 点击放大':'拖拽旋转 · 下滚展开 / 上滚合拢'}
function setSpread(target){if(!loaded||viewer.open||pointer||dialogOpen())return;target=target?1:0;if(target===spreadTarget)return;
 // Existing spherical motion can finish beneath the expanding layout.
 spreadTarget=target;velocity=[0,0,0];spreadTween={from:spread,to:target,start:performance.now(),duration:Math.max(240,950*Math.abs(target-spread))};syncSpread();requestFrame();
}
scatterBtn.addEventListener('click',()=>setSpread(!spreadTarget));
function wheelIntent(sum,previousDirection,last,dy,now){
 const direction=Math.sign(dy);
 if(!direction)return {sum,last,direction:previousDirection,target:null};
 if(now-last>180||direction!==previousDirection)sum=0;
 sum+=dy;const target=Math.abs(sum)>=45?(direction>0?1:0):null;
 return {sum:target===null?sum:0,last:now,direction,target};
}
scene.addEventListener('wheel',e=>{
 if(e.ctrlKey||dialogOpen()||pointer||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
 e.preventDefault();const dy=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1);
 const intent=wheelIntent(wheelSum,wheelDirection,wheelLast,dy,performance.now());
 wheelSum=intent.sum;wheelDirection=intent.direction;wheelLast=intent.last;
 if(intent.target!==null&&intent.target!==spreadTarget){if(intent.target===1)galleryY=0;setSpread(intent.target)}
 else if(dy>0&&spread===1&&!spreadTween){galleryY=Math.max(0,Math.min(Math.max(0,galleryHeight-innerHeight),galleryY+dy));requestFrame()}
},{passive:false});
let orientation=[0,0,0,1],velocity=[0,0,0],pointer=null,modalOpened=0,returnFocus=null;
function qmul(a,b){return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]]}
function rotateBy(q){const v=qmul(q,orientation),len=Math.hypot(...v);orientation=v.map(n=>n/len)}
function axisRotation(axis,angle){const k=Math.sin(angle/2);return [...axis.map(n=>n*k),Math.cos(angle/2)]}
function rotatePoint(p){const [x,y,z,w]=orientation,tx=2*(y*p[2]-z*p[1]),ty=2*(z*p[0]-x*p[2]),tz=2*(x*p[1]-y*p[0]);return [p[0]+w*tx+y*tz-z*ty,p[1]+w*ty+z*tx-x*tz,p[2]+w*tz+x*ty-y*tx]}
function trackball(x,y){const dx=(x-innerWidth/2)/(R*1.15),dy=(y-innerHeight/2)/(R*1.15),d=dx*dx+dy*dy,z=d<=.5?Math.sqrt(1-d):.5/Math.sqrt(d),len=Math.hypot(dx,dy,z);return [dx/len,dy/len,z/len]}
rotateBy(axisRotation([0,1,0],.25));rotateBy(axisRotation([1,0,0],-.12));
function sizePhoto(ratio){const h=Math.max(140,innerHeight-170),w=innerWidth-(innerWidth<=600?80:120);enlarged.style.width=Math.min(w,h*ratio,1600)+'px'}
function showPhotoCard(c){
 stopLive();activeRecord=c.record;returnFocus=c.el;viewer.classList.toggle('wide',c.wide);
 const original=document.querySelector('#photo-original'),asset=c.record.demo?demoAsset(c.record):null;
 original.hidden=!!asset?.style;
 if(asset?.style){original.removeAttribute('src');for(const key of ['backgroundImage','backgroundSize','backgroundPosition'])enlarged.style[key]=asset.style[key]}
 else{enlarged.style.backgroundImage='none';original.alt=c.record.name;original.src=photoSource(c.record)}
 enlarged.style.aspectRatio=String(c.record.ratio);sizePhoto(c.record.ratio);enlarged.setAttribute('aria-label',c.record.name);
 document.querySelector('#photo-editor').hidden=true;renderPhotoDetails();
 document.querySelector('#photo-position').textContent=(records.indexOf(c.record)+1)+' / '+records.length;
 for(const id of ['#photo-prev','#photo-next'])document.querySelector(id).disabled=records.length<2;
 syncMusic();
}
function openPhoto(el,play=false){if(!loaded||viewer.open||spreadTween)return;const c=cards.find(c=>c.el===el);if(!c)return;modalOpened=performance.now();velocity=[0,0,0];showPhotoCard(c);viewer.showModal();requestFrame();if(play&&activeRecord.video)toggleLive()}
let turningPhoto=false,swipeStart=null;
async function preservePhotoDraft(){
 if(!activeRecord||document.querySelector('#photo-editor').hidden)return true;
 if(!validDate(document.querySelector('#photo-date').value)){announce('请先填写有效日期');return false}
 activeRecord.series=document.querySelector('#photo-series').value.trim();activeRecord.character=document.querySelector('#photo-character').value.trim();activeRecord.date=document.querySelector('#photo-date').value;activeRecord.location=document.querySelector('#photo-location').value.trim();activeRecord.note=document.querySelector('#photo-mood').value.trim();
 const card=cards.find(c=>c.record===activeRecord);if(card)badge(card);layoutSpread();return await save();
}
function adjacentIndex(index,step,count){return count?((index+step)%count+count)%count:-1}
async function turnPhoto(step){
 if(turningPhoto||!viewer.open||records.length<2)return;turningPhoto=true;
 try{if(!await preservePhotoDraft()||!viewer.open)return;const index=adjacentIndex(records.indexOf(activeRecord),step,records.length);showPhotoCard(cards[index]);}finally{turningPhoto=false}
}
document.querySelector('#photo-prev').addEventListener('click',()=>turnPhoto(-1));document.querySelector('#photo-next').addEventListener('click',()=>turnPhoto(1));
viewer.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select,[contenteditable]'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();turnPhoto(e.key==='ArrowRight'?1:-1)}});
const mediaStage=document.querySelector('#media-stage');
mediaStage.addEventListener('pointerdown',e=>{if(e.target.closest('button')||e.button!==0)return;swipeStart={x:e.clientX,y:e.clientY,id:e.pointerId};mediaStage.setPointerCapture(e.pointerId)});
mediaStage.addEventListener('pointerup',e=>{if(!swipeStart||swipeStart.id!==e.pointerId)return;const dx=e.clientX-swipeStart.x,dy=e.clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3)turnPhoto(dx<0?1:-1)});
mediaStage.addEventListener('pointercancel',()=>swipeStart=null);
function closePhoto(){viewer.close()}
viewer.addEventListener('close',()=>{stopLive();activeRecord=null;if(shuffleStart!==null)shuffleStart+=performance.now()-modalOpened;lastTime=0;if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});requestFrame()});
document.querySelector('#close-viewer').addEventListener('click',closePhoto);
viewer.addEventListener('click',e=>{if(e.target===viewer)closePhoto()});
let statusTimer;
function announce(s){clearTimeout(statusTimer);statusEl.textContent=s;const panel=[...document.querySelectorAll('.panel')].filter(d=>d.open).at(-1);if(panel){let notice=panel.querySelector('.dialog-feedback');if(!notice){notice=document.createElement('p');notice.className='dialog-feedback feedback';notice.setAttribute('role','status');panel.append(notice)}notice.textContent=s}statusTimer=setTimeout(()=>statusEl.textContent='',5000)}
function syncPause(){pauseBtn.textContent=paused?'继续':'暂停';pauseBtn.setAttribute('aria-label',paused?'继续旋转':'暂停旋转');pauseBtn.setAttribute('aria-pressed',String(paused))}
function resize(){if(activeRecord)sizePhoto(activeRecord.ratio);R=Math.min(innerWidth*.325,innerHeight*.325);for(const c of cards){let h=R*.49,w=h*c.record.ratio;if(c.wide){w=R*.61;h=w/c.record.ratio}c.w=w;c.h=h;c.el.style.width=w+'px';c.el.style.height=h+'px'}layoutSpread();requestFrame()}
function smooth(t){return t*t*(3-2*t)}
function slerp(a,b,t){let dot=Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2]));if(dot>.9995){const v=a.map((n,i)=>n+(b[i]-n)*t),l=Math.hypot(...v);return v.map(n=>n/l)}if(dot<-.9995){let axis=Math.abs(a[0])<.8?[1,0,0]:[0,1,0];let d=a.reduce((s,n,i)=>s+n*axis[i],0);let p=axis.map((n,i)=>n-a[i]*d),l=Math.hypot(...p);return a.map((n,i)=>n*Math.cos(Math.PI*t)+p[i]/l*Math.sin(Math.PI*t))}const theta=Math.acos(dot),den=Math.sin(theta);return a.map((n,i)=>(n*Math.sin((1-t)*theta)+b[i]*Math.sin(t*theta))/den)}
function shuffle(){if(shuffleStart!==null||!loaded||viewer.open||pointer||spread>0||spreadTarget)return;let order=Array.from({length:N},(_,i)=>i);for(let i=N-1;i>0;i--){const j=Math.floor(Math.random()*i);[order[i],order[j]]=[order[j],order[i]]}from=current.map(v=>v.slice());destination=order.map(i=>destination[i]);shuffleStart=performance.now();shuffleCount++;shuffleBtn.setAttribute('aria-disabled','true');requestFrame()}
function requestFrame(){if(!raf&&!document.hidden)raf=requestAnimationFrame(render)}
function render(now){raf=0;if(!loaded||cards.length!==current.length)return;const dt=Math.min((now-(lastTime||now))/1000,.05);lastTime=now;
 if(dialogOpen())return;
 if(spreadTween){const t=reduced.matches?1:Math.min(1,(now-spreadTween.start)/spreadTween.duration);spread=spreadTween.from+(spreadTween.to-spreadTween.from)*(1-Math.pow(1-t,3));if(t===1){spread=spreadTween.to;spreadTween=null;syncSpread();announce(spread?'按日期展开 · 上滚合拢，拖动浏览':'已合拢 · 可以继续拖拽旋转')}}
 if(!pointer&&!paused&&!reduced.matches&&spread===0&&!spreadTarget){const speed=Math.hypot(...velocity);if(speed>.006){rotateBy(axisRotation(velocity.map(v=>v/speed),speed*dt));velocity=velocity.map(v=>v*Math.exp(-3.1*dt))}else{velocity=[0,0,0];rotateBy(axisRotation([0,1,0],.045*dt))}}
 if(shuffleStart!==null){const t=Math.min(1,(now-shuffleStart)/(reduced.matches?1:1400)),u=smooth(t);current=from.map((v,i)=>slerp(v,slots[destination[i]],u));if(t===1){current=destination.map(i=>slots[i].slice());shuffleStart=null;shuffleBtn.removeAttribute('aria-disabled');announce('已换位')}}
 const projected=current.map((p,i)=>{const [x,y,z]=rotatePoint(p);return {i,x,y,z}});
 // Unique full-precision depth ranks prevent equal rounded z-index buckets from
 // repeatedly falling back to DOM order as neighboring cards rotate.
 const sorted=projected.slice().sort((a,b)=>(a.z-b.z)||(a.i-b.i));
 sorted.forEach((p,rank)=>{cards[p.i].el.style.zIndex=String(rank+1)});
 for(const {i,x,y,z} of projected){const c=cards[i],sphereScale=3.8/(3.8-z),sphereAlpha=.30+.70*smooth(Math.max(0,Math.min(1,(z+.95)/1.1))),target=spreadLayout[i],delay=(i*17%N)/N*.14,u=smooth(Math.max(0,Math.min(1,(spread-delay)/(1-delay)))),scale=sphereScale+(target.scale-sphereScale)*u,px=x*R*sphereScale+(target.x-x*R*sphereScale)*u,py=y*R*sphereScale+(target.y-galleryY-y*R*sphereScale)*u,alpha=sphereAlpha+(1-sphereAlpha)*u;
 c.el.style.transform=`translate3d(${px-c.w/2}px,${py-c.h/2}px,0) rotate(${target.angle*u}rad) scale(${scale})`;c.el.style.opacity=alpha.toFixed(4);const shadow=(.12+.13*(z+1)/2)*(1-u)+.12*u;c.el.style.boxShadow=`0 ${(4+6*(z+1))*(1-u)+3*u}px ${(9+9*(z+1))*(1-u)+8*u}px rgba(0,0,0,${shadow})`}
 for(const label of labels){label.el.style.transform=`translateY(${label.y-galleryY}px)`}
 if((N>0&&!paused&&!reduced.matches&&spread===0&&!spreadTarget)||shuffleStart!==null||spreadTween)requestFrame();
}
scene.addEventListener('pointerdown',e=>{if(e.button!==0||pointer||dialogOpen()||spreadTween)return;e.preventDefault();pointer={id:e.pointerId,x:e.clientX,y:e.clientY,distance:0,vec:trackball(e.clientX,e.clientY),time:e.timeStamp,photo:e.target.closest('.photo'),play:!!e.target.closest('.live-badge')};velocity=[0,0,0];scene.setPointerCapture(e.pointerId)});
scene.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer.distance+=Math.hypot(dx,dy);const v=trackball(e.clientX,e.clientY),a=pointer.vec,cross=[a[1]*v[2]-a[2]*v[1],a[2]*v[0]-a[0]*v[2],a[0]*v[1]-a[1]*v[0]],dot=Math.max(-1,Math.min(1,a.reduce((n,k,i)=>n+k*v[i],0))),len=Math.hypot(...cross),angle=Math.atan2(len,dot),elapsed=Math.max(.008,(e.timeStamp-pointer.time)/1000);
 if(spread===1&&pointer.distance>4){galleryY=Math.max(0,Math.min(Math.max(0,galleryHeight-innerHeight),galleryY-dy));requestFrame()}
 if(pointer.distance>4&&spread===0){scene.classList.add('dragging');if(len>1e-8){const axis=cross.map(n=>n/len);rotateBy(axisRotation(axis,angle));velocity=axis.map((n,i)=>velocity[i]*.25+n*Math.min(angle/elapsed,8)*.75)}requestFrame()}
 pointer.x=e.clientX;pointer.y=e.clientY;pointer.vec=v;pointer.time=e.timeStamp;
});
function endPointer(e,cancelled=false){if(!pointer||pointer.id!==e.pointerId)return;const p=pointer;pointer=null;scene.classList.remove('dragging');if(scene.hasPointerCapture(e.pointerId))scene.releasePointerCapture(e.pointerId);if(cancelled||e.timeStamp-p.time>100||paused||reduced.matches)velocity=[0,0,0];if(!cancelled&&p.distance<=4&&p.photo)openPhoto(p.photo,p.play);requestFrame()}
scene.addEventListener('pointerup',e=>endPointer(e));scene.addEventListener('pointercancel',e=>endPointer(e,true));scene.addEventListener('lostpointercapture',e=>endPointer(e,true));
// Pointer clicks are handled on release; keyboard activation still uses click.
scene.addEventListener('click',e=>{if(e.detail===0){const el=e.target.closest('.photo');if(el)openPhoto(el)}});
window.addEventListener('blur',()=>{if(pointer)endPointer({pointerId:pointer.id,timeStamp:performance.now()},true);velocity=[0,0,0]});
function togglePause(){paused=!paused;velocity=[0,0,0];syncPause();requestFrame()}
pauseBtn.addEventListener('click',togglePause);shuffleBtn.addEventListener('click',()=>{$('#settings-dialog').close();shuffle()});
scene.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();togglePause()}else if(e.code==='Enter'&&e.target===scene){e.preventDefault();shuffle()}else if(spread===1&&(e.code==='PageDown'||e.code==='PageUp'||e.code==='ArrowDown'||e.code==='ArrowUp')){e.preventDefault();galleryY=Math.max(0,Math.min(Math.max(0,galleryHeight-innerHeight),galleryY+(e.code.endsWith('Down')?1:-1)*(e.code.startsWith('Page')?innerHeight*.75:80)));requestFrame()}else if(e.code==='KeyE'){e.preventDefault();setSpread(!spreadTarget)}else if(e.key.startsWith('Arrow')&&spread===0&&!spreadTween){e.preventDefault();velocity=[0,0,0];if(e.key==='ArrowLeft')rotateBy(axisRotation([0,1,0],-.12));if(e.key==='ArrowRight')rotateBy(axisRotation([0,1,0],.12));if(e.key==='ArrowUp')rotateBy(axisRotation([1,0,0],.12));if(e.key==='ArrowDown')rotateBy(axisRotation([1,0,0],-.12));requestFrame()}});
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0}else{lastTime=0;requestFrame()}});reduced.addEventListener('change',()=>{paused=reduced.matches;syncPause();requestFrame()});
const gallery=window.ORBIT_GALLERY,travelGallery=window.ORBIT_TRAVEL,dramaGallery=window.ORBIT_DRAMA;
const selectedGallery=window.ORBIT_SELECTED||[];
const allAssets=[...gallery,...travelGallery,...dramaGallery,...selectedGallery];
function recordsFromAssets(assets){return assets.map((asset,i)=>({
 id:asset.id,assetId:asset.id,name:asset.name,date:today(),time:'',location:'',note:'',
 series:asset.series||'',character:asset.character||'',ratio:asset.ratio||asset.width/asset.height,order:i,demo:true,
 style:asset.style||{backgroundImage:`url("${asset.thumb}")`,backgroundSize:'100% 100%',backgroundPosition:'center'}
}))}
function demoRecords(){return recordsFromAssets(travelGallery)}
function demoAsset(r){return allAssets.find(a=>a.id===r.assetId)||gallery[Number(r.id.replace('demo-',''))]}
function photoSource(r){return r.demo?demoAsset(r)?.src:urlFor(r.image)}
function upgradeSamples(items){return items.map(r=>{
 if(!r.demo)return r;const asset=demoAsset(r);if(!asset)return r;
 const sample=recordsFromAssets([asset])[0];return {...r,...sample,id:r.id,date:r.date,time:r.time||'',note:r.note||'',location:r.location||'',series:r.series||asset.series||'',character:r.character||asset.character||'',order:r.order,video:r.video||null};
})}
function restoreTravelSamples(items){return items.map((r,i)=>{
 if(!r.demo)return r;
 let index=Number(r.id.replace('demo-',''));
 if(!Number.isInteger(index)||index<0||index>=travelGallery.length)index=gallery.findIndex(a=>a.id===r.assetId);
 const asset=travelGallery[index>=0?index:i%travelGallery.length],sample=recordsFromAssets([asset])[0];
 return {...r,...sample,id:r.id,date:r.date,note:r.note||'',location:r.location||'',order:r.order,video:r.video||null};
})}
function applySelectedGallery(orbits){
 const oldIds=new Set(dramaGallery.map(a=>a.id));
 return orbits.map(o=>{
  if(o.id!=='drama'||o.album.selectionRevision==='user-20260927-more'||!selectedGallery.length)return o;
  const next=cloneOrbit(o),retained=next.records.filter(r=>!(r.demo&&oldIds.has(r.assetId)));
  const hashes=new Set(retained.filter(r=>r.hash).map(r=>r.hash));
  const ids=new Set(retained.filter(r=>r.assetId).map(r=>r.assetId));
  next.records=[...retained,...recordsFromAssets(selectedGallery.filter(a=>!hashes.has(a.hash)&&!ids.has(a.id)&&!(next.album.deletedSampleIds||[]).includes(a.id)))].map((r,i)=>({...r,order:i}));
  next.album.selectionRevision='user-20260927-more';return next;
 });
}
function cloneOrbit(orbit){return {...orbit,records:orbit.records.map(r=>({...r})),album:{...orbit.album,days:{...orbit.album.days},trash:(orbit.album.trash||[]).map(t=>({...t,record:{...t.record}})),deletedSampleIds:[...(orbit.album.deletedSampleIds||[])],...(orbit.album.playlist?{playlist:orbit.album.playlist.map(t=>({...t}))}:{})},pendingVideos:[...orbit.pendingVideos]}}
function captureLibrary(orbits,id,current){const replacement=cloneOrbit({...current,id});return orbits.map(o=>cloneOrbit(o.id===id?replacement:o))}
function blankOrbit(id,title,theme,owner){return {id,album:{title,theme,owner,onboarded:true,days:{},music:null},records:[],pendingVideos:[]}}
function activateOrbit(orbit){activeOrbitId=orbit.id;records=upgradeSamples(orbit.records);album=orbit.album;pendingVideos=orbit.pendingVideos;activeRecord=null;returnFocus=null;velocity=[0,0,0];wheelSum=0;wheelDirection=0;wheelLast=-Infinity;}
function rememberOrbit(){library=captureLibrary(library,activeOrbitId,{album,records,pendingVideos})}
function renderLibrary(){
 rememberOrbit();const list=$('#orbit-list');list.replaceChildren();
 for(const o of library){
  const button=document.createElement('button');button.type='button';button.className='orbit-choice';button.setAttribute('aria-label','打开照片球：'+o.album.title);button.setAttribute('aria-current',String(o.id===activeOrbitId));
  const cover=document.createElement('span');cover.className='orbit-mini';cover.dataset.theme=o.album.theme||'travel';
  for(const r of o.records.slice(0,5)){const image=document.createElement('span');image.className='mini-photo';setRecordStyle(image,r);cover.append(image)}
  if(!o.records.length){const plus=document.createElement('span');plus.textContent='＋';cover.append(plus)}
  const title=document.createElement('strong');title.textContent=o.album.title;
  const detail=document.createElement('span');detail.className='orbit-detail';detail.textContent=(o.album.theme==='drama'?'漫剧收藏':o.album.theme==='travel'?'旅行回忆':'自选主题')+' · '+o.records.length+' 张'+(o.id===activeOrbitId?' · 当前':'');
  button.append(cover,title,detail);button.addEventListener('click',()=>switchOrbit(o.id));list.append(button);
 }
}
function openLibrary(){if(importing||switchingOrbit){announce('照片正在保存，完成后再切换');return}renderLibrary();safeOpen($('#library-dialog'))}
async function switchOrbit(id){
 if(importing||switchingOrbit)return;
 if(id===activeOrbitId){$('#library-dialog').close();return}
 const next=library.find(o=>o.id===id);if(!next)return;
 switchingOrbit=true;
 try{if(!await save())return;activateOrbit(next);rebuild();loadMusic();if(await save()){$('#library-dialog').close();announce('已打开「'+album.title+'」')}}finally{switchingOrbit=false}
}
async function createOrbit(event){
 event.preventDefault();if(importing||switchingOrbit)return;
 const title=$('#new-orbit-name').value.trim(),theme=$('#new-orbit-theme').value;
 if(!title){$('#new-orbit-name').setCustomValidity('给新的照片球起个名字');$('#new-orbit-name').reportValidity();return}
 if(!['travel','drama','custom'].includes(theme))return;
 if(library.length>=30){announce('最多保存 30 个照片球');return}
 switchingOrbit=true;$('#create-orbit').disabled=true;
 try{if(!await save())return;const orbit=blankOrbit(crypto.randomUUID(),title,theme,album.owner);library.push(orbit);activateOrbit(orbit);rebuild();loadMusic();if(await save()){$('#library-dialog').close();$('#new-orbit-name').value='';announce('「'+title+'」已创建，添加第一张照片吧')}}finally{switchingOrbit=false;$('#create-orbit').disabled=false}
}
function uniquePhotos(items){
 const seen=new Map(),unique=[],duplicates=[];
 for(const r of items){
  const key=r.demo?'sample:'+r.assetId:r.hash?'image:'+r.hash:null;
  if(!key||!seen.has(key)){const copy={...r};unique.push(copy);if(key)seen.set(key,copy);continue}
  const keep=seen.get(key);duplicates.push(r);
  keep.note=[...new Set([keep.note,r.note].filter(Boolean))].join('\n');
  if(!keep.location)keep.location=r.location||'';
  if(!keep.video)keep.video=r.video||null;
 }
 return {unique,duplicates};
}
// Read-only diagnostics for local verification; no user data or network requests.
window.orbitState=()=>({count:N,usingDemo,galleryY,galleryHeight,dates:records.map(r=>r.date),landscape:cards.filter(c=>c.wide).length,loaded,paused,shuffling:shuffleStart!==null,shuffleCount,destination:[...destination],radii:current.map(v=>Math.hypot(...v)),orientation:[...orientation],velocity:[...velocity],dragging:!!pointer,viewerOpen:viewer.open,spread,spreadTarget,transitioning:!!spreadTween,spreadLayout:spreadLayout.map(p=>({...p})),depthRanks:cards.map(c=>Number(c.el.style.zIndex))});

// Local album: uploaded media stays in IndexedDB; only user-initiated backups leave it.
const $=s=>document.querySelector(s),music=$('#music'),liveVideo=$('#live-video');
let db=null,saveQueue=Promise.resolve(),importing=false,selectedDay='',objectURLs=new Map(),musicURL='',liveURL='';
const IMAGE_EXT=/\.(jpe?g|png|webp|heic|heif)$/i,VIDEO_EXT=/\.(mov|mp4|m4v)$/i,AUDIO_EXT=/\.(mp3|m4a|wav|ogg|aac)$/i;
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s}
function stem(name){return name.normalize('NFC').replace(/\.[^.]+$/,'').toLowerCase()}
function dialogOpen(){return [...document.querySelectorAll('dialog')].some(d=>d.open)}
function urlFor(blob){if(!blob)return '';if(!objectURLs.has(blob))objectURLs.set(blob,URL.createObjectURL(blob));return objectURLs.get(blob)}
function resume(){lastTime=0;requestFrame()}
for(const d of document.querySelectorAll('.panel'))d.addEventListener('close',resume);
function safeOpen(d){const n=d.querySelector('.dialog-feedback');if(n)n.textContent='';if(!d.open)d.showModal()}
function refreshMeta(){usingDemo=records.length>0&&records.every(r=>r.demo);document.body.dataset.theme=album.theme||'travel';$('#empty-orbit').hidden=records.length>0;$('#empty-title').textContent='把第一张'+(album.theme==='drama'?'收藏':'照片')+'放进来';$('#empty-description').textContent=album.theme==='drama'?'男女主、喜欢的场景，都可以收藏在这里。':'照片、音乐和心情，只属于这个照片球。';$('#scatter').disabled=!records.length;const name=album.title||'我的旅行';$('#owner-name').firstChild.textContent=(album.owner||'SHERRY小水')+' ';$('#owner-input').value=album.owner||'SHERRY小水';$('#album-title').textContent=name;$('#album-count').textContent=usingDemo?(album.theme==='drama'?'人物收藏 · '+records.length+' 张':records.length+' 张旅行示例'):`${records.length} 张照片 · ${records.filter(r=>r.video).length} 张实况`;$('#title-input').value=album.title||'';$('#pending-area').hidden=pendingVideos.length===0;$('#pending-list').replaceChildren();renderPendingVideos()}
function setRecordStyle(el,r){if(r.demo){for(const k of ['backgroundImage','backgroundSize','backgroundPosition'])el.style[k]=r.style[k]}else{el.style.backgroundImage=`url("${urlFor(r.image)}")`;el.style.backgroundSize='100% 100%';el.style.backgroundPosition='center'}}
function badge(c){c.el.classList.toggle('has-note',!!c.record.note);c.el.querySelector('.live-badge')?.remove();if(c.record.video){const span=document.createElement('span');span.className='live-badge';span.textContent='◎ LIVE';c.el.append(span)}c.el.setAttribute('aria-label',`${c.record.name}${c.record.video?'，实况照片':''}，点击放大查看`)}
function rebuild(){scene.replaceChildren();N=records.length;slots=Array.from({length:N},(_,i)=>{const y=1-2*(i+.5)/N,r=Math.sqrt(1-y*y);return [r*Math.cos(golden*i),y,r*Math.sin(golden*i)]});destination=Array.from({length:N},(_,i)=>i);from=slots.map(v=>v.slice());current=slots.map(v=>v.slice());shuffleStart=null;shuffleBtn.removeAttribute('aria-disabled');spreadTween=null;spread=spreadTarget=0;galleryY=0;cards=records.map(r=>{const el=document.createElement('button');el.type='button';el.className='photo';setRecordStyle(el,r);const c={el,record:r,wide:r.ratio>1,w:0,h:0};badge(c);scene.append(el);return c});loaded=true;refreshMeta();resize();syncSpread();syncPause()}
function openDB(){return new Promise((resolve,reject)=>{const mode=new URLSearchParams(location.search).get('test');const name=mode==='1'?'photo-orbit-qa-v2':mode==='welcome'?'photo-orbit-welcome-qa-v3':'photo-moments-album-v1';const req=indexedDB.open(name,1);req.onupgradeneeded=()=>req.result.createObjectStore('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function dbGet(){return new Promise((resolve,reject)=>{const req=db.transaction('state').objectStore('state').get('album');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function save(){rememberOrbit();const snapshot={version:5,activeId:activeOrbitId,orbits:library.map(cloneOrbit)};saveQueue=saveQueue.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{if(!db){reject(new Error('本地储存不可用'));return}const tx=db.transaction('state','readwrite');tx.objectStore('state').put(snapshot,'album');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('保存中断'))})).then(()=>{$('#save-state').textContent='已保存在此浏览器';return true}).catch(()=>{$('#save-state').textContent='尚未保存，请导出备份';announce('本地保存失败；请在相册设置中导出备份');return false});return saveQueue}
function decodeImage(blob){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),im=new Image();im.onload=()=>{URL.revokeObjectURL(url);if(!im.naturalWidth||!im.naturalHeight||im.naturalWidth*im.naturalHeight>100000000){reject(new Error('图片尺寸过大'));return}resolve({width:im.naturalWidth,height:im.naturalHeight,ratio:im.naturalWidth/im.naturalHeight})};im.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('浏览器无法打开，HEIC 可先转为 JPG'))};im.src=url})}
// Bounded JPEG/TIFF reader: reads date tags only. No paths, scripts or GPS are used.
function jpegDate(buffer){try{const d=new DataView(buffer),len=d.byteLength;if(len<4||d.getUint16(0)!==0xffd8)return null;let p=2;while(p+4<len){if(d.getUint8(p)!==255)break;const tag=d.getUint8(p+1),size=d.getUint16(p+2);if(size<2||p+2+size>len)break;if(tag===225&&size>14&&d.getUint32(p+4)===0x45786966){const base=p+10,end=p+2+size,le=d.getUint16(base)===0x4949;if(!le&&d.getUint16(base)!==0x4d4d)return null;const u16=o=>{if(o<base||o+2>end)throw 0;return d.getUint16(o,le)},u32=o=>{if(o<base||o+4>end)throw 0;return d.getUint32(o,le)};if(u16(base+2)!==42)return null;let dates=[],seen=new Set();function scan(offset,depth){if(depth>1||seen.has(offset))return;seen.add(offset);const pos=base+offset,n=Math.min(u16(pos),128);for(let i=0;i<n;i++){const e=pos+2+i*12,t=u16(e),type=u16(e+2),count=u32(e+4);if(t===0x8769&&type===4)scan(u32(e+8),depth+1);if([0x9003,0x9004,0x132].includes(t)&&type===2&&count>=19&&count<128){const at=base+u32(e+8);if(at<base||at+19>end)continue;let value='';for(let j=0;j<19;j++)value+=String.fromCharCode(d.getUint8(at+j));const m=value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/);if(m&&validDate(`${m[1]}-${m[2]}-${m[3]}`))dates.push({date:`${m[1]}-${m[2]}-${m[3]}`,time:m[4],priority:t===0x9003?0:1})}}}scan(u32(base+4),0);return dates.sort((a,b)=>a.priority-b.priority)[0]||null}if(tag===218||tag===217)break;p+=2+size}}catch{}return null}
async function fingerprint(file){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('')}
function mediaBytes(){return records.reduce((n,r)=>n+(r.image?.size||0)+(r.video?.size||0),0)+pendingVideos.reduce((n,v)=>n+v.file.size,0)+OrbitMusic.bytes(album)+(album.trash||[]).reduce((n,t)=>n+(t.record.image?.size||0)+(t.record.video?.size||0),0)}
function feedback(message){$('#import-feedback').textContent=message}
let importTarget=null;
$('#import-dialog').addEventListener('cancel',event=>{if(importing)event.preventDefault()});
function beginImport(targetId=null){
 if(importing)return;
 importTarget=typeof targetId==='string'?targetId:null;
 const target=records.find(r=>r.id===importTarget);
 if(viewer.open)viewer.close();
 $('#import-title').textContent=target?'替换这一张照片':'添加新的照片';
 $('#import-description').textContent=target?'只更换这张照片，其余照片和这张的心情记录都会保留。':'添加到现有相册，原来的照片都会保留。';
 $('#choose-files strong').textContent=target?'＋ 选择替换照片':'＋ 选择照片';
 $('#replacement-preview').hidden=!target;if(target)setRecordStyle($('#replacement-preview'),target);
 $('#import-date').value=today();feedback('');$('#import-previews').replaceChildren();$('#finish-import').hidden=true;
 safeOpen($('#import-dialog'));
}
$('#add-photos').addEventListener('click',()=>beginImport());$('#choose-files').addEventListener('click',()=>$('#photo-files').click());$('#finish-import').addEventListener('click',()=>$('#import-dialog').close());
async function convertLocal(file,kind){
 if(!['127.0.0.1','localhost'].includes(location.hostname))throw new Error('此格式请在本机预览页面导入；或选择 JPG + H.264 MP4');
 const response=await fetch('/convert/'+kind,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Orbit-Convert':'1'},body:file,signal:AbortSignal.timeout(210000)});
 if(!response.ok)throw new Error(response.status===429?'正在处理其他文件，请稍后重试':'无法转换，请从「照片」重新导出未修改的原片');
 return new File([await response.blob()],stem(file.name)+(kind==='heic'?'.jpg':'.mp4'),{type:kind==='heic'?'image/jpeg':'video/mp4',lastModified:file.lastModified});
}
async function prepareImage(file){
 try{return {file,dims:await decodeImage(file)}}catch(error){if(!/\.(heic|heif)$/i.test(file.name))throw error;}
 feedback('正在本机处理 HEIC 照片…');const converted=await convertLocal(file,'heic');return {file:converted,dims:await decodeImage(converted)};
}
async function prepareVideo(file){
 if(!VIDEO_EXT.test(file.name)||file.size>150*1024*1024)throw new Error('请选择 150 MB 以内的 MOV 或 MP4');
 if(['127.0.0.1','localhost'].includes(location.hostname)){feedback('正在本机处理实况画面和声音…');return convertLocal(file,'video')}
 return file;
}
function mergeImported(existing,fresh,targetId){
 if(!targetId)return [...existing,...fresh];
 if(fresh.length!==1)throw new Error('替换一次只能选择一张照片，可同时带上它的一个实况视频');
 if(!existing.some(r=>r.id===targetId))throw new Error('要替换的照片已不存在，请重新选择');
 return existing.map(r=>r.id===targetId?{...fresh[0],id:r.id,order:r.order,note:r.note||'',location:r.location||''}:r);
}
async function checkpoint(key){if(!db)return;const previous=await dbGet();if(!previous)return;await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(previous,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function dedupePending(items){const seen=new Set(),unique=[];for(const item of items){const hash=item.contentHash||await fingerprint(item.file);if(seen.has(hash))continue;seen.add(hash);unique.push({...item,contentHash:hash})}return unique}
function renderPendingVideos(){
 const list=$('#pending-list');list.replaceChildren();
 for(const item of pendingVideos){
  const row=document.createElement('li');row.className='pending-card';
  const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.src=urlFor(item.file);video.setAttribute('aria-label','预览视频 '+item.name);
  video.addEventListener('play',()=>{for(const other of list.querySelectorAll('video'))if(other!==video)other.pause();duckMusic(true)});video.addEventListener('pause',()=>duckMusic(false));
  const name=document.createElement('p');name.textContent=item.name;
  const select=document.createElement('select');select.setAttribute('aria-label','为视频选择照片 '+item.name);const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='选择对应照片…';select.append(placeholder);
  for(const r of records.filter(r=>!r.demo&&!r.video)){const opt=document.createElement('option');opt.value=r.id;opt.textContent=r.name;select.append(opt)}
  const link=document.createElement('button');link.className='outline';link.textContent='关联所选照片';link.disabled=true;select.addEventListener('change',()=>link.disabled=!select.value);
  link.addEventListener('click',async()=>{const r=records.find(r=>r.id===select.value);if(!r||r.video)return;video.pause();r.video=item.file;r.videoHash=item.contentHash;pendingVideos=pendingVideos.filter(v=>v.id!==item.id);rebuild();await save();announce('已关联 '+r.name+'，点开照片后播放实况')});
  const remove=document.createElement('button');remove.className='text-button';remove.textContent='删除视频';remove.setAttribute('aria-label','删除待关联视频 '+item.name);remove.addEventListener('click',async()=>{video.pause();pendingVideos=pendingVideos.filter(v=>v.id!==item.id);refreshMeta();await save();announce('已删除待关联视频')});
  row.append(video,name,select,link,remove);list.append(row);
 }
}
async function importFiles(files){
 if(importing)return;const selected=[...files],targetId=importTarget;
 if(!selected.length){feedback('没有收到文件。请从 Finder 选择照片；实况请导出未修改的原片后再选。');return}
 if(targetId&&(selected.filter(f=>IMAGE_EXT.test(f.name)).length!==1||selected.filter(f=>VIDEO_EXT.test(f.name)).length>1)){feedback('替换时请选择一张照片，可以同时选择它的一个 MOV / MP4 视频。其他照片不会改变。');return}
 importing=true;safeOpen($('#import-dialog'));$('#import-dialog .panel-close').disabled=true;$('#choose-files').disabled=true;$('#add-photos').disabled=true;$('#finish-import').hidden=true;$('#import-previews').replaceChildren();
 const errors=[],fresh=[],videos=[];let paired=0;const target=records.find(r=>r.id===targetId);let bytes=mediaBytes()-(target?.image?.size||0)-(target?.video?.size||0);
 try{
  if(selected.length>400)throw new Error('一次最多选择 400 个文件');
  const fallback=validDate($('#import-date').value)?$('#import-date').value:today();
  for(const [i,file] of selected.entries()){
   feedback(`正在整理 ${i+1} / ${selected.length}：${file.name}`);
   try{
    if(bytes+file.size>300*1024*1024)throw new Error('相册总容量限 300 MB');
    if(IMAGE_EXT.test(file.name)){
     if(file.size>40*1024*1024)throw new Error('照片超过 40 MB');
     if(records.length+fresh.length-(targetId?1:0)>=240)throw new Error('相册最多 240 张');
     const hash=await fingerprint(file);
     if([...records,...fresh].some(r=>r.id!==targetId&&r.hash===hash)){errors.push(`${file.name}：已在相册中，没有重复添加`);continue}
     const prepared=await prepareImage(file),meta=$('#use-exif').checked?jpegDate(await prepared.file.slice(0,1024*1024).arrayBuffer()):null;
     if(bytes+prepared.file.size>300*1024*1024)throw new Error('转换后超过相册容量');bytes+=prepared.file.size;
     const record={id:crypto.randomUUID(),name:file.name,stem:stem(file.name),image:prepared.file,video:null,date:meta?.date||fallback,time:meta?.time||'',location:'',note:'',ratio:prepared.dims.ratio,order:records.length+fresh.length,demo:false,hash};fresh.push(record);
     const thumb=document.createElement('img');thumb.src=urlFor(record.image);thumb.alt=file.name;$('#import-previews').append(thumb);
    }else if(VIDEO_EXT.test(file.name)){
     const converted=await prepareVideo(file),contentHash=await fingerprint(converted);if([...pendingVideos,...videos].some(v=>v.contentHash===contentHash)||records.some(r=>r.videoHash===contentHash)){errors.push(file.name+'：已导入，跳过重复视频');continue}if(bytes+converted.size>300*1024*1024)throw new Error('转换后超过相册容量');bytes+=converted.size;
     videos.push({id:crypto.randomUUID(),name:file.name,stem:stem(file.name),file:converted,contentHash});
    }else throw new Error('不支持这种格式');
   }catch(error){errors.push(`${file.name}：${error.message}`)}
  }
  // Replacement is atomic: a failed image or video leaves the original untouched.
  if(targetId&&(fresh.length!==1||errors.length))throw new Error('没有替换，原照片已保留。\n'+errors.join('\n'));
  if(targetId)await checkpoint('before-last-replacement');
  if(fresh.length===1&&videos.length===1){fresh[0].video=videos[0].file;fresh[0].videoHash=videos[0].contentHash;videos.length=0;paired++}
  records=mergeImported(records,fresh,targetId);pendingVideos.push(...videos);
  const remaining=[];
  for(const v of pendingVideos){const matches=records.filter(r=>r.stem===v.stem&&!r.video),same=pendingVideos.filter(x=>x.stem===v.stem);if(matches.length===1&&same.length===1){matches[0].video=v.file;matches[0].videoHash=v.contentHash;paired++}else remaining.push(v)}pendingVideos=remaining;
  rebuild();const saved=await save();
  const message=`${targetId?'已替换这一张，其余 '+(records.length-1)+' 张保持不变':'已添加 '+fresh.length+' 张照片'}${paired?' · '+paired+' 张实况':''}${saved?' · 已保存':' · 尚未保存，请导出备份'}`;
  if(!errors.length&&!pendingVideos.length&&saved&&(fresh.length||paired)){
   $('#import-dialog').close();importTarget=null;
   const last=targetId||fresh.at(-1)?.id,c=cards.find(c=>c.record.id===last);
   if(c){openPhoto(c.el);$('#live-feedback').textContent=message}announce(message);
  }else{feedback(message+(pendingVideos.length?'\n'+pendingVideos.length+' 个视频待关联：点击左下角名字，在视频预览下选择对应照片；多余视频可直接删除。':'')+(errors.length?'\n'+errors.join('\n'):''));$('#finish-import').hidden=false;}
 }catch(error){feedback(error.message)}finally{importing=false;$('#import-dialog .panel-close').disabled=false;$('#choose-files').disabled=false;$('#add-photos').disabled=false;$('#photo-files').value=''}
}
$('#photo-files').addEventListener('change',e=>importFiles(e.target.files));
let dragDepth=0;document.addEventListener('dragenter',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();dragDepth++;$('#drop-overlay').firstChild.textContent=(importTarget||activeRecord||e.target.closest('.photo'))?'松开，只替换这一张照片':'松开，添加到相册';$('#drop-overlay').hidden=false;$('#choose-files').classList.add('drag-over')}});
document.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy'}});
document.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('#drop-overlay').hidden=true;$('#choose-files').classList.remove('drag-over')}});
document.addEventListener('drop',e=>{
 e.preventDefault();dragDepth=0;$('#drop-overlay').hidden=true;$('#choose-files').classList.remove('drag-over');if(importing)return;
 const files=[...e.dataTransfer.files];
 const card=cards.find(c=>c.el===e.target.closest('.photo'));
 if(!$('#import-dialog').open)beginImport(activeRecord?.id||card?.record.id||null);
 importFiles(files);
});

function renderPhotoDetails(){const r=activeRecord;if(!r)return;$('#photo-meta').textContent=(album.theme==='drama'?[r.series,r.character||r.name]:[r.date,r.location]).filter(Boolean).join(' · ');const asset=r.demo?demoAsset(r):null;$('#photo-source').hidden=!asset?.sourceURL;if(asset?.sourceURL){$('#photo-source').href=asset.sourceURL;$('#photo-source').textContent='查看作品来源 ↗';}$('#photo-note').textContent=r.note||'';$('#photo-note').hidden=!r.note;$('#write-note').textContent=r.note?'✎ 编辑':'✎ 写一句';$('#live-toggle').hidden=!r.video;$('#live-toggle').textContent='◎ LIVE · 播放实况';$('#attach-live').textContent=r.video?'更换实况视频':'＋ 关联实况视频';$('#live-feedback').textContent='';$('#replace-photo').hidden=false;stopLive();if(r.video){liveURL=urlFor(r.video);liveVideo.src=liveURL;liveVideo.load()}}
function editPhoto(){if(!activeRecord)return;$('#drama-fields').hidden=album.theme!=='drama';$('#photo-series').value=activeRecord.series||'';$('#photo-character').value=activeRecord.character||'';$('#photo-date').value=activeRecord.date;$('#photo-location').value=activeRecord.location||'';$('#photo-mood').value=activeRecord.note||'';$('#photo-editor').hidden=false;$('#photo-mood').focus()}
$('#write-note').addEventListener('click',editPhoto);enlarged.addEventListener('dblclick',editPhoto);$('#cancel-note').addEventListener('click',()=>$('#photo-editor').hidden=true);
$('#save-note').addEventListener('click',async()=>{if(!activeRecord)return;if(!validDate($('#photo-date').value)){$('#photo-date').reportValidity();return}activeRecord.series=$('#photo-series').value.trim();activeRecord.character=$('#photo-character').value.trim();activeRecord.date=$('#photo-date').value;activeRecord.location=$('#photo-location').value.trim();activeRecord.note=$('#photo-mood').value.trim();$('#photo-editor').hidden=true;const c=cards.find(c=>c.record===activeRecord);if(c)badge(c);renderPhotoDetails();layoutSpread();refreshMeta();await save()});
function editDay(date){selectedDay=date;$('#day-date').textContent=date;$('#day-mood').value=album.days[date]||'';safeOpen($('#day-dialog'))}
$('#save-day').addEventListener('click',async()=>{album.days[selectedDay]=$('#day-mood').value.trim();layoutSpread();$('#day-dialog').close();await save()});
function duckMusic(playing){music.volume=Number($('#volume').value)*(playing?.18:1)}
function stopLive(){liveVideo.pause();liveVideo.hidden=true;try{liveVideo.currentTime=0}catch{}$('#live-toggle').textContent='◎ LIVE · 播放实况';duckMusic(false)}
async function toggleLive(){if(!activeRecord?.video)return;if(!liveVideo.paused){stopLive();return}$('#live-feedback').textContent='';liveVideo.hidden=false;liveVideo.muted=false;liveVideo.volume=1;duckMusic(true);try{await liveVideo.play();$('#live-toggle').textContent='◎ LIVE · 停止'}catch{stopLive();$('#live-feedback').textContent='无法播放此编码，请关联 H.264 MP4 视频。'}}
$('#live-toggle').addEventListener('click',toggleLive);liveVideo.addEventListener('ended',stopLive);liveVideo.addEventListener('error',()=>{if(activeRecord?.video){stopLive();$('#live-feedback').textContent='浏览器不支持此视频，请关联 H.264 MP4。'}});
$('#attach-live').addEventListener('click',()=>{if(!activeRecord)return;$('#pending-select').replaceChildren();for(const v of pendingVideos){const opt=document.createElement('option');opt.value=v.id;opt.textContent=v.name;$('#pending-select').append(opt)}$('#pending-label').hidden=!pendingVideos.length;$('#use-pending').hidden=!pendingVideos.length;safeOpen($('#pair-dialog'))});
async function attachVideo(file){if(!activeRecord)return false;const record=activeRecord;if(!VIDEO_EXT.test(file.name)||file.size>150*1024*1024||mediaBytes()+file.size-(activeRecord.video?.size||0)>300*1024*1024){announce('请选择 150 MB 以内的 MOV 或 MP4');return}try{file=await prepareVideo(file)}catch(error){announce(error.message);return}if(activeRecord!==record)return false;if(mediaBytes()+file.size-(record.video?.size||0)>300*1024*1024){announce('转换后超过相册容量');return false}activeRecord.video=file;activeRecord.videoHash=await fingerprint(file);badge(cards.find(c=>c.record===activeRecord));renderPhotoDetails();refreshMeta();if($('#pair-dialog').open)$('#pair-dialog').close();await save();return true}
$('#choose-live-file').addEventListener('click',()=>$('#live-file').click());$('#live-file').addEventListener('change',async e=>{if(e.target.files[0])await attachVideo(e.target.files[0]);e.target.value=''});$('#use-pending').addEventListener('click',async()=>{const v=pendingVideos.find(p=>p.id===$('#pending-select').value);if(v){const attached=await attachVideo(v.file);if(attached){pendingVideos=pendingVideos.filter(p=>p!==v);refreshMeta();await save()}}});
$('#replace-photo').addEventListener('click',()=>{if(activeRecord)beginImport(activeRecord.id)});
let musicBag=[],musicGeneration=0;
function playlist(){return OrbitMusic.normalize(album)}
function syncMusic(){
 const tracks=playlist(),playing=!!album.music&&!music.paused;
 for(const id of ['#music-toggle','#viewer-music-toggle','#music-next']){const button=$(id);button.innerHTML=playing?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>';button.setAttribute('aria-label',playing?'暂停音乐':'播放音乐');button.title=playing?'暂停音乐':'播放音乐'}
 $('#music-random').disabled=!tracks.length;$('#viewer-music-random').disabled=!tracks.length;$('#music-toggle').hidden=!playing;$('.music-tools').classList.toggle('is-playing',playing);
 if($('#music-dialog').open)renderMusicList();
}
function loadMusic(){
 musicGeneration++;musicBag=[];music.pause();music.removeAttribute('src');
 playlist();if(album.music){musicURL=urlFor(album.music.file);music.src=musicURL}
 music.volume=Number($('#volume').value);syncMusic();updateMusicTime();
}
async function playTrack(track,resetBag=true){
 if(!track)return;
 const generation=++musicGeneration,orbit=activeOrbitId;
 album.music=track;if(resetBag)musicBag=[];
 const src=urlFor(track.file);if(music.getAttribute('src')!==src)music.src=src;
 if(music.ended)music.currentTime=0;
 duckMusic(!liveVideo.paused);
 try{await music.play()}catch(error){if(generation===musicGeneration&&orbit===activeOrbitId&&error.name!=='AbortError')announce('这首暂时无法播放，可以点下一首或重新添加音频')}
 if(generation===musicGeneration&&orbit===activeOrbitId){syncMusic();await save()}
}
async function nextMusic(random=!!album.randomMusic){
 const result=OrbitMusic.next(playlist(),album.music?.id,random,musicBag);
 musicBag=result.bag;await playTrack(result.track,false);
}
async function randomMusic(){album.randomMusic=true;await nextMusic(true)}
function formatMusicTime(seconds){seconds=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0;return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')}
function updateMusicTime(){$('#music-time').textContent=formatMusicTime(music.currentTime)+' / '+formatMusicTime(music.duration)}
function renderMusicList(){
 const tracks=playlist(),playing=!!album.music&&!music.paused,list=$('#music-list');
 $('#music-track-count').textContent=tracks.length+' 首';
 $('#music-summary').textContent=album.music?(playing?'正在播放 · ':'待播放 · ')+album.music.name:'添加一首喜欢的音乐';
 $('#playlist-random').disabled=!tracks.length;$('#music-next').disabled=!tracks.length;
 const key=JSON.stringify(tracks.map(t=>[t.id,t.name]));
 if(list.dataset.tracks!==key){list.replaceChildren();list.dataset.tracks=key;
  tracks.forEach((t,i)=>{const row=document.createElement('button');row.className='track-row';row.dataset.trackId=t.id;row.setAttribute('aria-label','播放 '+t.name);
   const num=document.createElement('span');num.className='track-number';num.textContent=String(i+1).padStart(2,'0');
   const name=document.createElement('span');name.className='track-copy';name.textContent=t.name;
   const state=document.createElement('span');state.className='track-play';
   row.append(num,name,state);row.addEventListener('click',()=>{const track=playlist().find(v=>v.id===t.id);if(!track)return;if(album.music?.id===t.id&&!music.paused)music.pause();else playTrack(track)});list.append(row);
  });
 }
 for(const row of list.children){const current=row.dataset.trackId===album.music?.id;row.setAttribute('aria-current',String(current));row.querySelector('.track-play').textContent=current?(playing?'播放中':'已暂停'):'▷';row.setAttribute('aria-label',(current&&playing?'暂停 ':'播放 ')+row.querySelector('.track-copy').textContent)}
}
function openMusic(){const panel=$('#music-dialog');if(panel.open){panel.close();return}syncMusic();renderMusicList();panel.show();$('#music-change').setAttribute('aria-expanded','true')}
$('#music-dialog').addEventListener('close',()=>$('#music-change').setAttribute('aria-expanded','false'));
document.addEventListener('pointerdown',e=>{const panel=$('#music-dialog');if(panel.open&&!panel.contains(e.target)&&!$('#music-change').contains(e.target))panel.close()});
$('#music-dialog').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();$('#music-dialog').close();$('#music-change').focus()}});
async function toggleMusic(){if(!playlist().length){$('#music-file').click();return}if(!music.paused)music.pause();else if(!album.randomMusic)await randomMusic();else await playTrack(album.music)}
for(const id of ['#music-toggle','#viewer-music-toggle','#music-next'])$(id).addEventListener('click',toggleMusic);
$('#music-change').addEventListener('click',openMusic);
for(const id of ['#music-random','#playlist-random','#viewer-music-random'])$(id).addEventListener('click',randomMusic);
for(const id of ['#music-add','#viewer-music-add'])$(id).addEventListener('click',()=>$('#music-file').click());
for(const id of ['#volume','#viewer-volume'])$(id).addEventListener('input',e=>{$('#volume').value=e.target.value;$('#viewer-volume').value=e.target.value;duckMusic(!liveVideo.paused)});
music.addEventListener('pause',syncMusic);music.addEventListener('play',syncMusic);music.addEventListener('ended',()=>nextMusic(true));
music.addEventListener('timeupdate',updateMusicTime);music.addEventListener('loadedmetadata',updateMusicTime);
music.addEventListener('error',()=>{if(music.getAttribute('src'))announce('这段音乐无法播放，可以随机换一首');syncMusic()});
$('#music-file').addEventListener('change',async e=>{
 const files=[...e.target.files];e.target.value='';if(!files.length)return;
 const targetAlbum=album;const tracks=playlist();let bytes=mediaBytes(),added=0;const errors=[];
 $('#music-add').disabled=true;
 try{for(const file of files){
  if(!AUDIO_EXT.test(file.name)||file.size>40*1024*1024){errors.push(file.name+'：请选择 40 MB 以内音频');continue}
  if(tracks.length>=60||bytes+file.size>300*1024*1024){errors.push('歌单已满或超过相册容量');break}
  const hash=await fingerprint(file);if(tracks.some(t=>t.hash===hash)){errors.push(file.name+'：已在歌单');continue}
  tracks.push({id:crypto.randomUUID(),name:file.name,file,hash});bytes+=file.size;added++;
 }targetAlbum.playlist=tracks;if(!targetAlbum.music)targetAlbum.music=tracks[0]||null;
 if(targetAlbum===album){if(!music.getAttribute('src'))loadMusic();syncMusic();if(await save())announce(`已添加 ${added} 首音乐`+(errors.length?'；'+errors.join('；'):''))}
 }finally{$('#music-add').disabled=false}
});
async function seedMusicCatalog(){
 const retired=new Set(['villain-march','amazon','try']);
 const catalog=window.ORBIT_MUSIC||[],targets=library.filter(o=>['travel','drama'].includes(o.id));
 if(!catalog.length)return;
 const needsUpdate=targets.some(o=>retired.has(o.album.music?.id)||(o.album.playlist||[]).some(t=>retired.has(t.id))||catalog.some(t=>t.theme===o.album.theme&&!(o.album.playlist||[]).some(p=>p.id===t.id&&p.revision===t.revision)));
 if(!needsUpdate)return;
 if(db)await checkpoint('before-music-refinement-20260927');
 let failed=0;
 for(const orbit of targets){
  orbit.album.playlist=OrbitMusic.normalize(orbit.album).filter(t=>!retired.has(t.id));
  if(retired.has(orbit.album.music?.id))orbit.album.music=null;
  const tracks=orbit.album.playlist;
  for(const entry of catalog.filter(t=>t.theme===orbit.album.theme)){
   const oldIndex=tracks.findIndex(t=>t.id===entry.id);if(oldIndex>=0&&tracks[oldIndex].revision===entry.revision)continue;
   try{const response=await fetch(entry.src);if(!response.ok)throw Error('missing');const blob=await response.blob();if(!blob.size||blob.size>40*1024*1024)throw Error('size');
    const mediaSize=r=>(r.image?.size||0)+(r.video?.size||0);
    const used=orbit.records.reduce((n,r)=>n+mediaSize(r),0)+(orbit.album.trash||[]).reduce((n,t)=>n+mediaSize(t.record),0)+orbit.pendingVideos.reduce((n,v)=>n+v.file.size,0)+OrbitMusic.bytes(orbit.album)-(oldIndex>=0?tracks[oldIndex].file.size:0);
    if(used+blob.size>300*1024*1024||(oldIndex<0&&tracks.length>=60))throw Error('capacity');
    const track={id:entry.id,name:entry.name,revision:entry.revision,artist:entry.artist,kind:entry.kind,duration:entry.duration,file:new File([blob],entry.id+'.m4a',{type:'audio/mp4'})};
    if(oldIndex>=0)tracks[oldIndex]=track;else tracks.push(track);
    if(orbit.album.music?.id===entry.id)orbit.album.music=track;
   }catch{failed++}
  }
  if(!orbit.album.music)orbit.album.music=tracks[0]||null;
 }
 if(failed)announce('部分音乐暂未载入，刷新后重试');
}
let manageSelection=new Set(),managing=false;
function removePhotos(items,ids){
 const selected=new Set(ids),remaining=items.filter(r=>!selected.has(r.id));
 return {records:remaining,count:items.length-remaining.length};
}
function renderManage(){
 const items=records;
 document.querySelector('#manage-heading').textContent='管理照片';
 document.querySelector('#manage-hint').textContent='点选照片，支持多选。删除后不再保留。';
 const grid=document.querySelector('#manage-grid');grid.replaceChildren();
 for(const r of items){const button=document.createElement('button');button.type='button';button.className='manage-photo';button.setAttribute('aria-label','选择照片：'+r.name);button.setAttribute('aria-pressed',String(manageSelection.has(r.id)));const image=document.createElement('span');image.className='manage-thumb';setRecordStyle(image,r);image.style.aspectRatio=String(r.ratio);const check=document.createElement('span');check.className='manage-check';check.textContent=manageSelection.has(r.id)?'✓':'';const title=document.createElement('span');title.className='manage-name';title.textContent=r.name;button.append(image,check,title);button.addEventListener('click',()=>{manageSelection.has(r.id)?manageSelection.delete(r.id):manageSelection.add(r.id);button.setAttribute('aria-pressed',String(manageSelection.has(r.id)));check.textContent=manageSelection.has(r.id)?'✓':'';syncManageActions()});grid.append(button)}
 document.querySelector('#manage-empty').hidden=items.length>0;document.querySelector('#manage-empty').textContent='还没有照片';syncManageActions();
}
function syncManageActions(){const n=manageSelection.size;document.querySelector('#manage-count').textContent='已选 '+n+' 张';const action=document.querySelector('#manage-action');action.disabled=!n||managing;action.textContent='删除'+(n?' '+n+' 张':'所选照片');document.querySelector('#manage-all').disabled=managing;}
function openManage(){manageSelection.clear();if(document.querySelector('#settings-dialog').open)document.querySelector('#settings-dialog').close();renderManage();safeOpen(document.querySelector('#manage-dialog'))}
async function deletePhotos(ids){
 if(managing||importing)return false;managing=true;
 const previous=records,oldDeleted=album.deletedSampleIds||[];
 try{
  const result=removePhotos(records,ids);if(!result.count)return false;
  records=result.records;album.deletedSampleIds=[...new Set([...oldDeleted,...previous.filter(r=>ids.includes(r.id)&&r.demo).map(r=>r.assetId)])];
  if(!await save()){records=previous;album.deletedSampleIds=oldDeleted;rememberOrbit();return false}
  rebuild();manageSelection.clear();if(document.querySelector('#manage-dialog').open)renderManage();announce('已删除 '+result.count+' 张照片');return true;
 }catch{records=previous;album.deletedSampleIds=oldDeleted;rememberOrbit();announce('保存失败，照片未删除');return false}finally{managing=false;if(document.querySelector('#manage-dialog').open)syncManageActions()}
}
document.querySelector('#delete-photo').addEventListener('click',async()=>{
 if(!activeRecord||!await preservePhotoDraft())return;const id=activeRecord.id,index=records.indexOf(activeRecord);
 if(await deletePhotos([id])){if(records.length)showPhotoCard(cards[Math.min(index,records.length-1)]);else{activeRecord=null;closePhoto()}}
});
document.querySelector('#manage-open').addEventListener('click',()=>openManage());
document.querySelector('#manage-all').addEventListener('click',()=>{if(managing)return;manageSelection=manageSelection.size===records.length?new Set():new Set(records.map(r=>r.id));renderManage()});
document.querySelector('#manage-action').addEventListener('click',()=>deletePhotos([...manageSelection]));
$('#settings-dialog').addEventListener('close',()=>{for(const video of $('#pending-list').querySelectorAll('video'))video.pause();duckMusic(false)});
function openSettings(){refreshMeta();safeOpen($('#settings-dialog'))}$('#my-orbits').addEventListener('click',openLibrary);
$('#album-title').addEventListener('click',()=>{$('#rename-input').value=album.title||'我的旅行';safeOpen($('#rename-dialog'));$('#rename-input').focus();$('#rename-input').select()});
$('#cancel-rename').addEventListener('click',()=>$('#rename-dialog').close());
$('#rename-form').addEventListener('submit',async e=>{e.preventDefault();const title=$('#rename-input').value.trim();if(!title){$('#rename-input').focus();return}album.title=title;refreshMeta();if(await save()){$('#rename-dialog').close();$('#album-title').focus()}});$('#new-orbit-form').addEventListener('submit',createOrbit);$('#new-orbit-name').addEventListener('input',()=>$('#new-orbit-name').setCustomValidity(''));$('#empty-add').addEventListener('click',()=>beginImport());$('#save-title').addEventListener('click',async()=>{album.owner=$('#owner-input').value.trim()||'SHERRY小水';album.title=$('#title-input').value.trim()||'我的旅行';refreshMeta();await save();$('#settings-dialog').close()});
$('#owner-name').addEventListener('click',()=>{openSettings();$('#owner-input').focus()});
$('#save-owner').addEventListener('click',async()=>{album.owner=$('#welcome-name').value.trim()||'SHERRY小水';album.onboarded=true;refreshMeta();await save();$('#welcome-dialog').close()});
const dataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)});
async function packMusicTracks(tracks){const out=[];for(const t of tracks)out.push({id:t.id,name:t.name,artist:t.artist||'',kind:t.kind||'',duration:t.duration||0,revision:t.revision||null,data:await dataURL(t.file)});return out}
async function unpackMusicTracks(data){
 const rows=data.version===6?data.playlist:(data.music?[data.music]:[]);
 if(!Array.isArray(rows)||rows.length>60)throw new Error('歌单格式不正确');
 const tracks=[];let bytes=0;
 for(const [i,t] of rows.entries()){
  if(!t||typeof t!=='object')throw new Error('歌单格式不正确');
  const name=String(t.name||'音乐').slice(0,200),file=await restoreBlob(t.data,'audio',name);bytes+=file.size;
  if(bytes>300*1024*1024)throw new Error('歌单超过相册容量');
  tracks.push({id:typeof t.id==='string'?t.id.slice(0,100):'restored-'+i,name,artist:String(t.artist||'').slice(0,100),kind:String(t.kind||'').slice(0,80),duration:Number.isFinite(t.duration)?Math.max(0,t.duration):0,revision:typeof t.revision==='string'?t.revision.slice(0,80):undefined,file});
 }
 if(new Set(tracks.map(t=>t.id)).size!==tracks.length)throw new Error('歌单包含重复标识');
 return tracks;
}
async function exportBackup(){$('#export-album').disabled=true;try{const out={format:'photo-orbit',version:6,theme:album.theme||'travel',title:album.title,owner:album.owner,days:album.days,photos:[],music:null,playlist:[],randomMusic:!!album.randomMusic,pending:[]};for(const r of records){out.photos.push({id:r.id,name:r.name,series:r.series||'',character:r.character||'',date:r.date,time:r.time,note:r.note,location:r.location,order:r.order,ratio:r.ratio,assetId:r.demo?r.assetId:null,demoIndex:r.demo?Number(r.id.replace('demo-','')):null,image:r.image?await dataURL(r.image):null,video:r.video?await dataURL(r.video):null,videoName:r.video?.name||'live.mov'})}out.playlist=await packMusicTracks(playlist());out.currentMusic=album.music?.id||null;for(const v of pendingVideos)out.pending.push({name:v.name,data:await dataURL(v.file)});const blob=new Blob([JSON.stringify(out)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(album.title||'照片球').replace(/[\\/:*?"<>|]/g,'_')+'-照片球备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('相册备份已导出')}catch{announce('备份未成功，请重试')}finally{$('#export-album').disabled=false}}
$('#export-album').addEventListener('click',exportBackup);$('#restore-album').addEventListener('click',()=>$('#backup-file').click());
async function restoreBlob(data,kind,name){const limits={image:40,video:150,audio:40};if(typeof data!=='string'||data.length>limits[kind]*1024*1024*1.4)throw new Error('备份中的媒体过大');const m=data.match(/^data:([^;,]*);base64,([A-Za-z0-9+/=\r\n]+)$/);if(!m)throw new Error('备份中的媒体格式不正确');const allowed={image:['image/jpeg','image/png','image/webp','image/heic','image/heif'],video:['video/mp4','video/quicktime','video/x-m4v',''],audio:['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg','audio/aac','']};if(!allowed[kind].includes(m[1]))throw new Error('备份中包含不支持的媒体类型');const bytes=Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0));if(bytes.length>limits[kind]*1024*1024)throw new Error('备份中的媒体过大');return new File([bytes],name,{type:m[1]})}
$('#backup-file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>420*1024*1024)throw new Error('备份超过 420 MB');const data=JSON.parse(await file.text());if(data.format!=='photo-orbit'||![2,3,4,5,6].includes(data.version)||!Array.isArray(data.photos)||data.photos.length>240)throw new Error('不是有效的旅行记忆球备份');if(!usingDemo&&!confirm('恢复备份会替换当前相册，请先导出当前相册。继续恢复？'))return;const next=[];for(const [i,r] of data.photos.entries()){const name=String(r.name||'照片').slice(0,200);if(!validDate(r.date))throw new Error('照片日期无效');const demo=data.version>=4&&typeof r.assetId==='string'?recordsFromAssets(allAssets).find(d=>d.assetId===r.assetId):data.version===3&&Number.isInteger(r.demoIndex)&&r.demoIndex>=0&&r.demoIndex<78?demoRecords()[r.demoIndex]:null;if(r.assetId&&!demo)throw new Error('备份中的示例图片不存在');const image=demo?null:await restoreBlob(r.image,'image',name),dims=demo?{ratio:demo.ratio}:await decodeImage(image),video=r.video?await restoreBlob(r.video,'video',String(r.videoName||'live.mov')):null;next.push({id:crypto.randomUUID(),name,stem:stem(name),image,video,ratio:dims.ratio,date:r.date,time:String(r.time||'').slice(0,8),note:String(r.note||'').slice(0,500),location:String(r.location||'').slice(0,80),order:i,series:String(r.series||'').slice(0,80),character:String(r.character||'').slice(0,80),demo:!!demo,...(demo?{id:demo.id,assetId:demo.assetId,style:demo.style}:{})})}const days={};for(const [k,v] of Object.entries(data.days||{}))if(validDate(k))days[k]=String(v).slice(0,500);const newPlaylist=await unpackMusicTracks(data);const newMusic=newPlaylist.find(t=>t.id===data.currentMusic)||newPlaylist[0]||null;const pending=[];for(const v of (Array.isArray(data.pending)?data.pending:[]).slice(0,240))pending.push({id:crypto.randomUUID(),name:String(v.name).slice(0,200),stem:stem(String(v.name)),file:await restoreBlob(v.data,'video',String(v.name))});if(next.reduce((n,r)=>n+(r.image?.size||0)+(r.video?.size||0),0)+pending.reduce((n,v)=>n+v.file.size,0)+newPlaylist.reduce((n,t)=>n+t.file.size,0)>300*1024*1024)throw new Error('相册超过 300 MB');for(const r of next)if(r.image)r.hash=await fingerprint(r.image);const restored=uniquePhotos(next);await checkpoint('before-last-restore');records=restored.unique;album={theme:['travel','drama','custom'].includes(data.theme)?data.theme:'travel',title:String(data.title||'我的旅行').slice(0,60),owner:String(data.owner||album.owner||'SHERRY小水').slice(0,40),onboarded:true,days,music:newMusic,playlist:newPlaylist,randomMusic:!!data.randomMusic};pendingVideos=pending;usingDemo=false;rebuild();loadMusic();await save();$('#settings-dialog').close();announce('相册已恢复')}catch(err){announce('未恢复：'+err.message)}});
async function seedPublicSamples(orbits){
 const additions=await Promise.all((window.ORBIT_PUBLIC_SAMPLES||[]).map(async entry=>{
  const read=async(path,type)=>{if(!/^assets\/public-samples\/[a-z0-9-]+\.(jpg|png|mp4)$/.test(path))throw Error('Invalid sample');const res=await fetch(path);if(!res.ok)throw Error('Missing sample');const blob=await res.blob();if(!blob.size)throw Error('Empty sample');return new File([blob],path.split('/').pop(),{type})};
  const image=await read(entry.image,entry.image.endsWith('.png')?'image/png':'image/jpeg');
  const video=entry.video?await read(entry.video,'video/mp4'):null;
  return {...entry,image,video,demo:false,stem:stem(entry.name),time:'',hash:await fingerprint(image),videoHash:video?await fingerprint(video):null};
 }));
 for(const orbit of orbits){orbit.records.push(...additions.filter(r=>r.theme===orbit.album.theme));orbit.records.forEach((r,i)=>r.order=i);orbit.album.onboarded=true;if(orbit.id==='drama')orbit.album.title='心动男嘉宾'}
}
async function initialize(){
 let state=null,migrated=false;
 try{db=await openDB();state=await dbGet()}catch{db=null;$('#save-state').textContent='浏览器储存不可用；请导出备份'}
 if(state?.version===5&&Array.isArray(state.orbits)&&state.orbits.length){
  library=state.orbits.map(cloneOrbit);activateOrbit(library.find(o=>o.id===state.activeId)||library[0]);
 }else{
  if(state&&[2,3,4].includes(state.version)){
   try{await checkpoint('before-v5-multiple-orbits')}catch{db=null;announce('旧相册备份失败，暂不覆盖本地储存')}
   album={title:'我的旅行',owner:'SHERRY小水',days:{},music:null,...state.album,theme:'travel'};
   records=state.records?.length?restoreTravelSamples(state.records):demoRecords();pendingVideos=state.pendingVideos||[];
   for(const r of records)if(r.image&&!r.hash)r.hash=await fingerprint(r.image);
   if(state.version===2&&!records.some(r=>r.demo)&&records.length+78<=240)records.push(...demoRecords());
   const unique=uniquePhotos(records);records=unique.unique;
   for(const r of unique.duplicates)if(r.video&&!records.some(k=>k.video===r.video))pendingVideos.push({id:crypto.randomUUID(),name:r.video.name||r.name,stem:r.stem,file:r.video});
   migrated=true;
  }else{album={title:'我的旅行',owner:'SHERRY小水',theme:'travel',days:{},music:null};records=demoRecords();pendingVideos=[]}
  const travel={id:'travel',album,records,pendingVideos};
  const drama=blankOrbit('drama','心动漫剧','drama',album.owner);drama.records=recordsFromAssets(dramaGallery);drama.album.example=true;
  library=[travel,drama];activateOrbit(travel);
 }
 if(selectedGallery.length&&library.some(o=>o.id==='drama'&&o.album.selectionRevision!=='user-20260927-more')){
  try{if(state)await checkpoint('before-user-selection-20260927-more');library=applySelectedGallery(library);activateOrbit(library.find(o=>o.id===activeOrbitId)||library[0]);}
  catch{db=null;announce('精选图片更新前备份失败，原相册已保留')}
 }
 if(!state){
  try{await seedPublicSamples(library);activateOrbit(library.find(o=>o.id==='drama')||library[0]);}
  catch{db=null;announce('样例未完整载入，请刷新重试；本次不会保存不完整样例')}
 }
 for(const orbit of library)orbit.pendingVideos=await dedupePending(orbit.pendingVideos||[]);
 try{await seedMusicCatalog();activateOrbit(library.find(o=>o.id===activeOrbitId)||library[0]);}catch{announce('音乐导入前备份失败，原歌单已保留')}
 $('#import-date').value=today();rebuild();loadMusic();
 if(db)await save();
 announce(migrated?'旅行选图已恢复 · 在「Photo Moments ⌄」切换不同主题':'在「Photo Moments ⌄」切换主题，也可以新建');
 if(!album.onboarded)safeOpen($('#welcome-dialog'));
}
initialize();
