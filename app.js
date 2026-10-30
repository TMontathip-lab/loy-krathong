'use strict';
// ต้นแบบสำหรับใช้งานแบบออฟไลน์ ยังไม่เชื่อมฐานข้อมูลกลาง
const $=id=>document.getElementById(id);
const CATS={
 base:{label:'ฐานกระทง',names:['ฐานกลม','ขอบหยัก','กลีบบัว','ใบตองสาน','สองชั้น','ลายดอกไม้']},
 petal:{label:'กลีบใบตอง',names:['กลีบแหลม','กลีบบัว','กลีบกุหลาบ','กลีบพัด','ฟันปลา','สองชั้น','สูงต่ำ']},
 flower:{label:'ดอกไม้',names:['บัวชมพู','บัวขาว','ดาวเรือง','มะลิ','กุหลาบ','กล้วยไม้','ดอกไม้รวม']},
 incense:{label:'ธูปเทียน',names:['ธูป 3 ดอก + เทียน 1 เล่ม']}
};
const src=(kind,index)=>kind==='incense'?'assets/incense-candle.png':`assets/${kind}-${String(index).padStart(2,'0')}.png`;
const clone=value=>JSON.parse(JSON.stringify(value));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
let counter=10,kind='base',selectedId=null,items=[],history=[],historyCursor=-1,interaction=null,customFloats=[],floatNodes=[],floatLoopStarted=false,pendingFloat=null,blessingTimer=null,blessingHideTimer=null;
const demoFloats=[
 {name:'น้องบัว',wish:'ขอให้ทุกคนมีความสุข',x:69,y:71,size:139,design:[{kind:'base',index:2,x:70,y:140,w:850,h:830},{kind:'petal',index:1,x:180,y:215,w:660,h:660},{kind:'flower',index:1,x:275,y:290,w:440,h:435},{kind:'incense',index:1,x:390,y:150,w:215,h:490}]},
 {name:'เด็กดี ป.5',wish:'ขอให้สอบได้คะแนนดี ๆ',x:82,y:83,size:119,design:[{kind:'base',index:5,x:70,y:145,w:850,h:810},{kind:'petal',index:4,x:180,y:220,w:650,h:660},{kind:'flower',index:3,x:300,y:300,w:420,h:420},{kind:'incense',index:1,x:400,y:160,w:205,h:460}]},
 {name:'มะลิ',wish:'ขอให้ครอบครัวสุขภาพแข็งแรง',x:43,y:84,size:110,design:[{kind:'base',index:4,x:70,y:145,w:850,h:810},{kind:'petal',index:3,x:185,y:220,w:660,h:660},{kind:'flower',index:6,x:290,y:305,w:440,h:430},{kind:'incense',index:1,x:400,y:160,w:205,h:460}]},
 {name:'คนรักประเพณีไทย',wish:'ขอให้มีแต่สิ่งดี ๆ เข้ามาในชีวิต',x:92,y:65,size:98,design:[{kind:'base',index:3,x:70,y:145,w:850,h:810},{kind:'petal',index:2,x:180,y:220,w:650,h:650},{kind:'flower',index:7,x:290,y:310,w:420,h:430}]}];
let alphaMaps=new Map();
let lastPaletteSource=null,lastPaletteAction=-1000,openFloat=null;
function getDims(){return $('artboard').getBoundingClientRect()}
function toUnits(clientX,clientY){const r=getDims();return {x:(clientX-r.left)*1000/r.width,y:(clientY-r.top)*1000/r.height}}
function itemLabel(it){return CATS[it.kind].names[it.index-1]||CATS[it.kind].label}
function createItem(category,index,x,y){
 const countSame=items.filter(i=>i.kind===category).length;
 const presets={base:{w:840,h:820,x:80,y:145},petal:{w:650,h:650,x:175,y:225},flower:{w:425,h:425,x:290,y:315},incense:{w:220,h:495,x:387,y:165}};
 const p=presets[category],off=(countSame%5)*16;
 return {id:++counter,kind:category,index,x:x==null?p.x+off:x-p.w/2,y:y==null?p.y+off:y-p.h/2,w:p.w,h:p.h};
}
function initialDesign(){return [
 {id:1,kind:'base',index:3,x:80,y:155,w:840,h:820},
 {id:2,kind:'petal',index:2,x:174,y:237,w:652,h:635},
 {id:3,kind:'flower',index:7,x:295,y:311,w:415,h:420},
 {id:4,kind:'incense',index:1,x:390,y:149,w:220,h:490}
]}
function track(){
 const snapshot=JSON.stringify(items);if(history[historyCursor]===snapshot)return;
 history=history.slice(0,historyCursor+1);history.push(snapshot);if(history.length>70)history.shift();historyCursor=history.length-1;updateButtons();
}
function restore(step){
 if(step<0||step>=history.length)return;
 historyCursor=step;items=JSON.parse(history[step]);selectedId=null;renderItems();renderStack();updateButtons();
}
function focusItem(id){selectedId=id;renderSelection();renderStack();updateButtons()}
function showPage(page){
 closeWish();
 for(const k of ['home','editor','wish','river'])$(k+'Page').classList.toggle('active',k===page);
  for(const f of [...demoFloats,...customFloats]){f.hovering=false;f.focused=false;syncFloatPause(f)}
  if(page==='wish')renderWishArt();
 if(page==='river'){renderRivers(); syncReleasePanel();}
 window.scrollTo({top:0,behavior:'instant'});
}
function itemStyle(el,it){el.style.cssText=`left:${it.x/10}%;top:${it.y/10}%;width:${it.w/10}%;height:${it.h/10}%;`}
function renderItems(){
 const root=$('itemLayer');root.replaceChildren();
 for(const it of items){
  const node=document.createElement('div');node.className='placed-item';node.dataset.id=it.id;itemStyle(node,it);
  const img=document.createElement('img');img.src=src(it.kind,it.index);img.alt='';img.draggable=false;node.append(img);root.append(node);
 }
 $('workCount').textContent=items.length+' ชิ้น';renderSelection();updateButtons();
}
function updateItemOnScreen(it){const el=$('itemLayer').querySelector(`[data-id="${it.id}"]`);if(el)itemStyle(el,it);renderSelection()}
function renderSelection(){
 const box=$('selectionBox'),it=items.find(i=>i.id===selectedId);
 if(!it){box.classList.add('hidden');return}
 box.classList.remove('hidden');itemStyle(box,it);$('selectionHead').textContent=itemLabel(it);
}
function renderStack(){
 $('stackCount').textContent=items.length;
 const target=$('stackList');target.replaceChildren();
 if(!items.length){const empty=document.createElement('div');empty.className='stack-empty';empty.textContent='ยังไม่มีของตกแต่ง · เลือกภาพเพื่อเพิ่มได้เลย';target.append(empty);return}
 for(const it of [...items].reverse()){
  const btn=document.createElement('button');btn.className='stack-item'+(it.id===selectedId?' selected':'');btn.type='button';
  const img=document.createElement('img');img.src=src(it.kind,it.index);img.alt='';
  const span=document.createElement('span');span.textContent=CATS[it.kind].label+' · '+itemLabel(it);
  const tag=document.createElement('small');tag.textContent='#'+it.id;
  btn.append(img,span,tag);btn.addEventListener('click',()=>focusItem(it.id));target.append(btn);
 }
}
function updateButtons(){
 const has=!!items.find(i=>i.id===selectedId);
 for(const id of ['duplicateBtn','toFrontBtn','toBackBtn','deleteBtn'])$(id).disabled=!has;
 $('undoBtn').disabled=historyCursor<=0;$('redoBtn').disabled=historyCursor>=history.length-1;
 $('clearBtn').disabled=items.length===0;
}
function renderPalette(){
 const target=$('paletteGrid');target.replaceChildren();
 $('tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.kind===kind));
 CATS[kind].names.forEach((name,i)=>{
  const tile=document.createElement('button');tile.className='asset-tile';tile.type='button';tile.title='ลากไปวาง หรือแตะเพื่อเพิ่ม '+name;
  const img=document.createElement('img');img.src=src(kind,i+1);img.alt='';img.draggable=false;
  const txt=document.createElement('small');txt.textContent=name;
  const grip=document.createElement('span');grip.className='tile-drag-grip';grip.textContent='⠿';grip.setAttribute('aria-hidden','true');
  tile.append(img,txt,grip);
  tile.addEventListener('pointerdown',ev=>{
   if(ev.pointerType==='touch'&& !ev.target.closest('.tile-drag-grip'))return; // swipe to scroll normally
   paletteStart(ev,kind,i+1,tile);
  });
  tile.addEventListener('click',ev=>{
   // Touch on the card (not the drag grip), or keyboard activation, adds one decoration.
   if(ev.detail===0 || (lastPaletteSource!==tile || performance.now()-lastPaletteAction>400))addItem(kind,i+1);
  });
  target.append(tile);
 });
}
function addItem(category,index,px,py){
 const item=createItem(category,index,px,py);
 // Add new assets in a useful default layer order. Multiple bases remain below decoration.
 const priority={base:0,petal:1,flower:2,incense:3};
 const firstHigher=items.findIndex(other=>priority[other.kind]>priority[category]);
 if(firstHigher>=0)items.splice(firstHigher,0,item);else items.push(item);
 renderItems();focusItem(item.id);track();
 $('padHint').textContent='เลือกแล้ว: '+itemLabel(item);
}
// เริ่มลากจากแถบขวาด้วย Pointer Events: ใช้ได้ทั้งเมาส์และสัมผัส
function paletteStart(e,category,index,source){
 if(e.button!==0&&e.pointerType==='mouse')return;
 e.preventDefault();source.setPointerCapture?.(e.pointerId);
 interaction={type:'palette',pointer:e.pointerId,kind:category,index,source,startClient:{x:e.clientX,y:e.clientY},dragged:false};
 const ghost=$('dragGhost');ghost.querySelector('img').src=src(category,index);ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';ghost.classList.remove('hidden');
}
function alphaHit(it,x,y){
 // hit test ภาพโปร่งใสเมื่ออ่าน pixel ได้ (บน GitHub Pages); เปิดจาก file:// ใช้ fallback ขอบเขต
 const u=(x-it.x)/it.w,v=(y-it.y)/it.h;
 if(u<0||v<0||u>1||v>1)return false;
 const imgInfo=alphaMaps.get(src(it.kind,it.index));
 if(!imgInfo)return true;
 if(imgInfo.failed)return true;
 const px=clamp(Math.floor(u*imgInfo.size),0,imgInfo.size-1),py=clamp(Math.floor(v*imgInfo.size),0,imgInfo.size-1);
 return imgInfo.channels===1?imgInfo.data[py*imgInfo.size+px]>40:imgInfo.data[(py*imgInfo.size+px)*4+3]>28;
}
function makeAlphaMap(path){
 if(alphaMaps.has(path))return;
 if(typeof ASSET_MASKS!=='undefined'&&ASSET_MASKS[path]){
  const encoded=atob(ASSET_MASKS[path]);
  alphaMaps.set(path,{data:Uint8Array.from(encoded,c=>c.charCodeAt(0)),size:64,channels:1});
  return;
 }
 const img=new Image();img.src=path;img.onload=()=>{
  try{const can=document.createElement('canvas');can.width=can.height=100;const ctx=can.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,100,100);alphaMaps.set(path,{data:ctx.getImageData(0,0,100,100).data,size:100})}
  catch(_){alphaMaps.set(path,{failed:true})}
 };
}
function pickItem(x,y){
 for(let i=items.length-1;i>=0;i--){const it=items[i];if(alphaHit(it,x,y))return it}
 return null;
}
function artboardDown(e){
 if(e.button!==0&&e.pointerType==='mouse')return;
 const hitHandle=e.target.closest('[data-handle]');
 const pos=toUnits(e.clientX,e.clientY);
 if(hitHandle&&selectedId!=null){
  const it=items.find(item=>item.id===selectedId);if(!it)return;
  e.preventDefault();interaction={type:hitHandle.dataset.handle==='move'?'move':'resize',pointer:e.pointerId,id:it.id,dir:hitHandle.dataset.handle,origin:clone(it),start:pos,moved:false};
  $('artboard').setPointerCapture?.(e.pointerId);return;
 }
 const picked=pickItem(pos.x,pos.y);
 if(picked){
  e.preventDefault();focusItem(picked.id);
  interaction={type:'move',pointer:e.pointerId,id:picked.id,origin:clone(picked),start:pos,moved:false};
  $('artboard').setPointerCapture?.(e.pointerId);
 }else focusItem(null);
}
function pointerMove(e){
 if(!interaction||e.pointerId!==interaction.pointer)return;
 const a=interaction;
 if(e.cancelable)e.preventDefault();
 if(a.type==='palette'){
  const dist=Math.hypot(e.clientX-a.startClient.x,e.clientY-a.startClient.y);
  if(dist>5)a.dragged=true;
  const ghost=$('dragGhost');ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';
  const rect=getDims(),inside=e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom;
  $('artboard').closest('.pad-shell').classList.toggle('drop-ready',inside);return;
 }
 const it=items.find(it=>it.id===a.id);if(!it)return;
 const pos=toUnits(e.clientX,e.clientY),dx=pos.x-a.start.x,dy=pos.y-a.start.y;
 if(Math.abs(dx)+Math.abs(dy)>.2)a.moved=true;
 if(a.type==='move'){
  it.x=clamp(a.origin.x+dx,-700,1400);it.y=clamp(a.origin.y+dy,-700,1400);
 }else if(a.type==='resize'){
  let left=a.origin.x,top=a.origin.y,right=left+a.origin.w,bottom=top+a.origin.h;
  if(a.dir.includes('w'))left=clamp(a.origin.x+dx,-800,right-45);
  if(a.dir.includes('e'))right=clamp(a.origin.x+a.origin.w+dx,left+45,2200);
  if(a.dir.includes('n'))top=clamp(a.origin.y+dy,-800,bottom-45);
  if(a.dir.includes('s'))bottom=clamp(a.origin.y+a.origin.h+dy,top+45,2200);
  const corner=/^(nw|ne|se|sw)$/.test(a.dir);
  if(corner&&!e.shiftKey){
   // Project drag onto the original corner diagonal to preserve intrinsic aspect ratio.
   const sx=a.dir.includes('e')?1:-1,sy=a.dir.includes('s')?1:-1;
   const w=a.origin.w,h=a.origin.h;
   const rawScale=1+(sx*dx*w+sy*dy*h)/(w*w+h*h);
   const scale=clamp(rawScale,Math.max(45/w,45/h),Math.min(2500/w,2500/h));
   it.w=w*scale;it.h=h*scale;
   it.x=a.dir.includes('w')?a.origin.x+w-it.w:a.origin.x;
   it.y=a.dir.includes('n')?a.origin.y+h-it.h:a.origin.y;
  }else{it.x=left;it.y=top;it.w=right-left;it.h=bottom-top;}
 }
 updateItemOnScreen(it);
}
function pointerEnd(e){
 if(!interaction||e.pointerId!==interaction.pointer)return;
 const a=interaction;interaction=null;
 if(a.type==='palette'){
  $('dragGhost').classList.add('hidden');$('artboard').closest('.pad-shell').classList.remove('drop-ready');
  lastPaletteSource=a.source;lastPaletteAction=performance.now();
  if(e.type==='pointercancel')return;
  const rect=getDims();
  if(a.dragged){
   if(e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom){const p=toUnits(e.clientX,e.clientY);addItem(a.kind,a.index,p.x,p.y)}
  }else addItem(a.kind,a.index);
 }else if(a.moved){track();renderStack()}
}
function duplicateSelected(){
 const it=items.find(i=>i.id===selectedId);if(!it)return;
 const dup={...clone(it),id:++counter,x:it.x+22,y:it.y+22};items.push(dup);renderItems();focusItem(dup.id);track();
}
function moveLayer(way){
 const idx=items.findIndex(it=>it.id===selectedId);if(idx<0)return;
 if(way==='front'&&idx<items.length-1){const [it]=items.splice(idx,1);items.push(it)}
 if(way==='back'&&idx>0){const [it]=items.splice(idx,1);items.unshift(it)}
 renderItems();renderStack();track();
}
function deleteSelected(){
 if(selectedId===null)return;items=items.filter(it=>it.id!==selectedId);selectedId=null;renderItems();renderStack();track();
}
function clearDesign(){if(!items.length)return;if(!confirm('ล้างของตกแต่งทั้งหมดแล้วเริ่มออกแบบใหม่ใช่ไหม?'))return;items=[];selectedId=null;renderItems();renderStack();track()}
function createArtFragment(design){
 const root=document.createElement('div');root.className='mini-art';
 for(const it of design){const img=document.createElement('img');img.src=src(it.kind,it.index);img.alt='';img.draggable=false;
 img.style.cssText=`left:${it.x/10}%;top:${it.y/10}%;width:${it.w/10}%;height:${it.h/10}%`;root.append(img)}return root;
}
function renderWishArt(){
 const target=$('wishArt');target.replaceChildren();
 for(const it of items){const img=document.createElement('img');img.src=src(it.kind,it.index);img.alt='';img.style.cssText=`left:${it.x/10}%;top:${it.y/10}%;width:${it.w/10}%;height:${it.h/10}%`;target.append(img)}
}
// The far-water line is mapped in the SOURCE image, not viewport percentages.
// This keeps krathongs on the water even when CSS background-size:cover crops the image.
const SCENE_W=1672,SCENE_H=941;
const FAR_WATER_LINE=[[0,.535],[.15,.515],[.30,.51],[.50,.485],[.66,.475],[.80,.50],[1,.545]];
function sourceBoundaryY(sourceX){
 const u=clamp(sourceX,0,1);
 for(let i=1;i<FAR_WATER_LINE.length;i++){
  const [x1,y1]=FAR_WATER_LINE[i-1],[x2,y2]=FAR_WATER_LINE[i];
  if(u<=x2)return y1+(y2-y1)*(u-x1)/(x2-x1);
 }
 return FAR_WATER_LINE.at(-1)[1];
}
function farWaterY(xPct,riverField){
 const r=riverField.getBoundingClientRect();
 const viewportWidth=window.innerWidth,viewportHeight=window.innerHeight;
 const coverScale=Math.max(viewportWidth/SCENE_W,viewportHeight/SCENE_H);
 const imageWidth=SCENE_W*coverScale,imageHeight=SCENE_H*coverScale;
 const imageLeft=(viewportWidth-imageWidth)/2,imageTop=(viewportHeight-imageHeight)/2;
 const screenX=r.left+(xPct/100)*r.width;
 const sourceX=(screenX-imageLeft)/imageWidth;
 const screenY=imageTop+sourceBoundaryY(sourceX)*imageHeight;
 // Stay just below the river horizon and in the reachable part of the river page.
 return clamp((screenY-r.top)/r.height*100,8,72);
}
function smoothStep(a,b,v){const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)}
function syncReleasePanel(){
 const ready=!!pendingFloat;
 $('releasePanel').classList.toggle('hidden',!ready);
 $('againBtn').classList.toggle('hidden',ready);
}
function hideBlessing(){
 clearTimeout(blessingTimer);clearTimeout(blessingHideTimer);
 $('blessingMessage').classList.remove('shown');
 $('blessingMessage').classList.add('hidden');
}
function showBlessing(){
 const box=$('blessingMessage');box.classList.remove('hidden');
 requestAnimationFrame(()=>box.classList.add('shown'));
 blessingHideTimer=setTimeout(()=>{
  box.classList.remove('shown');
  setTimeout(()=>box.classList.add('hidden'),500);
 },7600);
}
function setFloatPaused(f,shouldPause){
 const now=performance.now();
 if(shouldPause && f.pausedAt==null)f.pausedAt=now;
 if(!shouldPause && f.pausedAt!=null){f.pausedTotal=(f.pausedTotal||0)+(now-f.pausedAt);f.pausedAt=null;}
}
function syncFloatPause(f){setFloatPaused(f,!!(f.hovering||f.focused||f.popoverOpen));}
function closeWish(){
 $('wishPopover').classList.add('hidden');
 if(openFloat){openFloat.popoverOpen=false;syncFloatPause(openFloat);openFloat=null;}
}
function renderRivers(){
 closeWish();
 floatNodes=[];
 // Expired local test krathongs are not recreated when navigating between pages.
 const now=performance.now();
 customFloats=customFloats.filter(f=>now-f.bornAt-(f.pausedTotal||0)-(f.pausedAt!=null?now-f.pausedAt:0)<21500);
 const floats=demoFloats.concat(customFloats).concat(pendingFloat?[pendingFloat]:[]);
 for(const target of [$('riverHome'),$('riverFull')]){
  target.replaceChildren();
  floats.forEach((f,i)=>{
   if(f.prepared&&target!==$('riverFull'))return;
   const button=document.createElement('button');button.type='button';
   button.className='river-float'+(f.mine?' mine':'')+(f.prepared?' preparing':'');
   button.style.setProperty('--size',f.size+'px');
   button.setAttribute('aria-label',`คำอธิษฐานของ ${f.name} แตะเพื่ออ่าน`);
   const visual=document.createElement('span');visual.className='float-visual';
   visual.style.setProperty('--bob-duration',(3.6+(i%4)*.55)+'s');
   const art=createArtFragment(f.design);
   const lab=document.createElement('span');lab.className='name-pill';lab.textContent=f.name;
   visual.append(art,lab);button.append(visual);
   button.addEventListener('click',ev=>{ev.stopPropagation();openWish(f)});
   if(window.matchMedia('(hover:hover) and (pointer:fine)').matches){
    button.addEventListener('pointerenter',()=>{f.hovering=true;syncFloatPause(f)});
    button.addEventListener('pointerleave',()=>{f.hovering=false;syncFloatPause(f)});
   }
   button.addEventListener('focus',()=>{f.focused=true;syncFloatPause(f)});
   button.addEventListener('blur',()=>{f.focused=false;syncFloatPause(f)});
   target.append(button);
   floatNodes.push({button,field:target,f,i});
  });
 }
 updateRiverPositions(performance.now());
}
function getFloatAgeMs(f,now){
 return Math.max(0,now-f.bornAt-(f.pausedTotal||0)-(f.pausedAt!=null?now-f.pausedAt:0));
}
function floatPosition(f,i,now,field){
 if(f.prepared)return {x:60,y:82,scale:1.48,opacity:1};
 const age=getFloatAgeMs(f,now)/1000;
 if(!f.mine){
  const DURATION=68;
  const cycle=(age+(i%3)*7)%DURATION;
  const p=clamp(cycle/DURATION,0,1),s=smoothStep(0,1,p);
  const startX=f.x+Math.sin(i*2)*2;
  const x=startX+(51-startX)*p*.26+Math.sin(cycle*.13+i)*.7;
  const endY=farWaterY(x,field)+1.2;
  const startY=Math.max(f.y,68);
  return {x,y:startY+(endY-startY)*s,scale:1-.51*s,opacity:(1-smoothStep(.79,1,p))*smoothStep(0,.05,p)};
 }
 const DURATION=21;
 const p=clamp(age/DURATION,0,1),travel=smoothStep(0,1,p);
 const x=60+(f.x-60)*travel+Math.sin(age*.52+i)*.65;
 const finalY=farWaterY(x,field)+1.3;
 const y=82+(finalY-82)*travel+Math.sin(age*1.4+i)*.25;
 return {x,y,scale:1.48-1.03*travel,opacity:1-smoothStep(.77,1,p)};
}
function updateRiverPositions(now){
 const expiredFloats=new Set();
 for(const entry of floatNodes){
  const {button,field,f}=entry;
  if(!field.closest('.page.active'))continue; // do not animate hidden pages
  if(!f.prepared&&f.mine&&getFloatAgeMs(f,now)>21500){expiredFloats.add(f);continue;}
  const pos=floatPosition(f,entry.i,now,field),rect=field.getBoundingClientRect();
  // GPU-friendly placement: no animated left/top layout changes.
  button.style.transform=`translate3d(${(pos.x/100*rect.width).toFixed(2)}px, ${(pos.y/100*rect.height).toFixed(2)}px, 0) translate(-50%, -50%) scale(${pos.scale.toFixed(4)})`;
  button.style.opacity=pos.opacity.toFixed(3);
  button.style.zIndex=f.prepared?'85':String(Math.round(pos.y));
  button.style.pointerEvents=pos.opacity<.1?'none':'auto';
 }
 if(expiredFloats.size){
  // Remove both DOM copies (home and river) and the local record, not just the visible one.
  for(const entry of floatNodes)if(expiredFloats.has(entry.f))entry.button.remove();
  floatNodes=floatNodes.filter(e=>!expiredFloats.has(e.f));
  customFloats=customFloats.filter(f=>!expiredFloats.has(f));
 }
}
function riverAnimationFrame(now){
 if(document.visibilityState!=='hidden' && ($('homePage').classList.contains('active')||$('riverPage').classList.contains('active')))updateRiverPositions(now);
 requestAnimationFrame(riverAnimationFrame);
}
function openWish(f){
 closeWish();openFloat=f;f.popoverOpen=true;syncFloatPause(f);
 $('popupName').textContent=f.name;$('popupWish').textContent=f.wish;
 $('wishPopover').classList.remove('hidden');
}
function prepareWish(e){
 e.preventDefault();
 if(items.length===0){alert('กรุณาเพิ่มของตกแต่งกระทงก่อน');showPage('editor');return}
 const name=$('nickname').value.trim(),wish=$('wishText').value.trim();if(!name||!wish)return;
 hideBlessing();
 pendingFloat={name,wish,x:60+(customFloats.length%4)*3,y:76,size:174,design:clone(items),mine:true,prepared:true};
 showPage('river');
}
function launchPrepared(){
 if(!pendingFloat)return;
 const f=pendingFloat;
 f.prepared=false;f.bornAt=performance.now();
 customFloats.push(f);pendingFloat=null;
 $('releasePanel').classList.add('hidden');$('againBtn').classList.remove('hidden');
 // Keep the same DOM krathong at its foreground position. It starts moving now.
 for(const entry of floatNodes){if(entry.f===f)entry.button.classList.remove('preparing')}
 renderRivers();
 blessingTimer=setTimeout(showBlessing,1000);
}
function cancelPrepared(){pendingFloat=null;hideBlessing();showPage('wish')}
function beginAgain(){
 pendingFloat=null;hideBlessing();
 items=initialDesign();selectedId=null;track();renderItems();renderStack();
 $('wishForm').reset();showPage('editor');
}
function init(){
 setupBackgroundMusic();
 items=initialDesign();counter=10;
 for(const group of Object.entries(CATS))for(let i=0;i<group[1].names.length;i++)makeAlphaMap(src(group[0],i+1));
 $('tabs').addEventListener('click',e=>{const b=e.target.closest('[data-kind]');if(!b)return;kind=b.dataset.kind;renderPalette()});
 $('artboard').addEventListener('pointerdown',artboardDown);
 window.addEventListener('pointermove',pointerMove,{passive:false});window.addEventListener('pointerup',pointerEnd);window.addEventListener('pointercancel',pointerEnd);
 $('duplicateBtn').addEventListener('click',duplicateSelected);
 $('toFrontBtn').addEventListener('click',()=>moveLayer('front'));$('toBackBtn').addEventListener('click',()=>moveLayer('back'));
 $('deleteBtn').addEventListener('click',deleteSelected);$('clearBtn').addEventListener('click',clearDesign);
 $('undoBtn').addEventListener('click',()=>restore(historyCursor-1));$('redoBtn').addEventListener('click',()=>restore(historyCursor+1));
 $('artboard').addEventListener('keydown',e=>{
  if(!selectedId)return;
  const it=items.find(i=>i.id===selectedId);if(!it)return;
  const speed=e.shiftKey?20:5;
  const offsets={ArrowLeft:[-speed,0],ArrowRight:[speed,0],ArrowUp:[0,-speed],ArrowDown:[0,speed]};
  if(offsets[e.key]){e.preventDefault();it.x+=offsets[e.key][0];it.y+=offsets[e.key][1];updateItemOnScreen(it);track()}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected()}
 });
 window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeWish();return}
  if(!$('editorPage').classList.contains('active'))return;
  if(e.target.closest('input,textarea,select,[contenteditable], [role="textbox"]'))return;
  if(!((e.ctrlKey||e.metaKey)))return;
  if(e.key.toLowerCase()==='z'){e.preventDefault();restore(historyCursor+(e.shiftKey?1:-1))}
  if(e.key.toLowerCase()==='d'&&document.activeElement=== $('artboard')){e.preventDefault();duplicateSelected()}
 });
 $('startBtn').addEventListener('click',()=>showPage('editor'));$('gotoEditor').addEventListener('click',()=>showPage('editor'));
 $('gotoRiver').addEventListener('click',()=>showPage('river'));$('logoBtn').addEventListener('click',()=>showPage('home'));
 $('goWish').addEventListener('click',()=>items.length?showPage('wish'):alert('กรุณาเพิ่มของตกแต่งกระทงก่อน'));
 $('mobileToWish').addEventListener('click',()=>items.length?showPage('wish'):alert('กรุณาเพิ่มของตกแต่งกระทงก่อน'));
 $('backEditor').addEventListener('click',()=>showPage('editor'));
 $('wishForm').addEventListener('submit',prepareWish);
 $('releaseBtn').addEventListener('click',launchPrepared);
 $('cancelReleaseBtn').addEventListener('click',cancelPrepared);
 $('againBtn').addEventListener('click',beginAgain);
  $('closePopover').addEventListener('click',closeWish);
  document.addEventListener('pointerdown',e=>{if(!$('wishPopover').classList.contains('hidden')&&!e.target.closest('#wishPopover,.river-float'))closeWish();});
 demoFloats.forEach((f,i)=>{f.bornAt=performance.now()-i*4500});
 renderPalette();renderItems();renderStack();track();renderRivers();
 if(!floatLoopStarted){floatLoopStarted=true;requestAnimationFrame(riverAnimationFrame)}
}

// Background instrumental: explicit user control; never force autoplay on page load.
function setupBackgroundMusic(){
 const audio=$('bgMusic'),toggle=$('musicToggle'),label=$('musicLabel');
 if(!audio||!toggle||!label)return;
 audio.volume=0.38;
 const paint=()=>{
  const playing=!audio.paused && !audio.ended;
  toggle.classList.toggle('is-playing',playing);
  toggle.setAttribute('aria-pressed',String(playing));
  const text=playing?'ปิดเพลง':'เปิดเพลง';
  label.textContent=text;
  toggle.setAttribute('aria-label',text+'บรรเลง');
  toggle.title=text+'บรรเลง';
 };
 toggle.addEventListener('click',async()=>{
  if(!audio.paused){audio.pause();paint();return}
  try{
   await audio.play();
  }catch(error){
   console.warn('ไม่สามารถเปิดเพลงได้:',error);
   paint();
   alert('ไม่สามารถเปิดเพลงได้ กรุณาตรวจสอบไฟล์ assets/loy-krathong-music.mp3');
  }
 });
 audio.addEventListener('play',paint);
 audio.addEventListener('pause',paint);
 audio.addEventListener('ended',paint);
 audio.addEventListener('error',()=>{
  paint();
  console.error('Music failed to load:',audio.error);
 });
 paint();
}

document.addEventListener('DOMContentLoaded',init);
