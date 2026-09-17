const $=id=>document.getElementById(id);
let MAP_W,MAP_H,countries=[],viewBounds;
let colorful=true;
function setTarget(text,tag=null){
 $('target').textContent=text;$('target').hidden=!text;$('targetFlag').hidden=!tag;
 if(tag)$('targetFlag').src=`flags/${tag}.png`;
}
let pendingAnswer=null,touchInput=false;
function needsConfirmation(){return touchInput||!!window.matchMedia?.('(pointer: coarse)').matches}
function clearPending(){pendingAnswer=null;$('confirmAnswer').disabled=true;$('selection').setAttribute('d','')}

let browsing=false,browseAfter=false,atlasCache=null,returnView=null,labelNodes=[],labelScale=null;
function atlasCountries(){
 if(!atlasCache)atlasCache=WORLD_COUNTRIES.map(c=>{
  const keys=Object.keys(c.parts).sort(),shape=keys.length>1?c.variants[keys.join('|')]:c.parts[keys[0]];
  return parseCountry({tag:c.tag,name:c.name,...shape});
 });
 return atlasCache;
}
function setMapSurface(hre){
 $('mapImage').src=hre?'europe.svg?v=classic-atlas-2':'world.svg?v=classic-atlas-2';
 $('map').style.width=MAP_W+'px';$('map').style.height=MAP_H+'px';
 $('overlay').setAttribute('viewBox',`0 0 ${MAP_W} ${MAP_H}`);
 $('relief').setAttribute('href',hre?'relief-hre.webp':'relief.webp');
 $('relief').setAttribute('width',MAP_W);$('relief').setAttribute('height',MAP_H);
}
function updateLabels(){
 if(!browsing||labelScale===scale)return;
 labelScale=scale;
 for(const {el,label} of labelNodes){
  const size=label.font*scale;
  el.style.display=size>=10?'':'none';
  el.setAttribute('font-size',Math.min(30,size)/scale);
  el.setAttribute('stroke-width',Math.min(1.4,size*.06)/scale);
 }
}
function enterBrowse(after=false){
 if(browsing||queue.length&&index<queue.length)return;
 browseAfter=after;returnView={MAP_W,MAP_H,viewBounds,scale,tx,ty,target:$('target').textContent,eyebrow:$('eyebrow').textContent,message:$('message').textContent};
 const hre=$('scope').value==='hre';
 browsing=true;[MAP_W,MAP_H]=WORLD_SIZE;
 if(hre)viewBounds=viewBounds.map((v,i)=>v+HRE_ORIGIN[i%2]);
 setMapSurface(false);paintCountries();
 $('reveal').setAttribute('transform',hre?`translate(${HRE_ORIGIN.join(' ')})`:'');
 $('pin').setAttribute('display','none');$('countryLabels').replaceChildren();labelNodes=[];labelScale=null;
 for(const c of atlasCountries()){
  const label=ATLAS_LABELS[c.tag],el=document.createElementNS('http://www.w3.org/2000/svg','text');
  el.textContent=c.name;el.setAttribute('x',label.x);el.setAttribute('y',label.y);$('countryLabels').append(el);labelNodes.push({el,label});
 }
 $('startPanel').hidden=true;$('resultPanel').hidden=true;$('browseBar').hidden=false;$('browseStart').hidden=after;
 $('browseBack').textContent=after?'返回成绩':'返回设置';
 setTarget('自由浏览地图');$('eyebrow').textContent='1444 年 · 世界地图';$('message').textContent='拖动和缩放探索；悬停任何国家查看名称，飞地同样有效。';
 $('edition').textContent='世界地图 · 665 国';$('mapHint').textContent='滚轮缩放 · 拖动地图 · 悬停查看国名';fit();
}
function leaveBrowse(showPanel=true){
 if(!browsing)return;
 browsing=false;$('mapHint').textContent='滚轮缩放 · 拖动地图 · 点击作答';$('browseBar').hidden=true;$('countryTooltip').hidden=true;$('countryLabels').replaceChildren();labelNodes=[];
 $('reveal').setAttribute('transform','');
 configureMap();scale=returnView.scale;tx=returnView.tx;ty=returnView.ty;viewBounds=returnView.viewBounds;transform();
 setTarget(returnView.target);$('eyebrow').textContent=returnView.eyebrow;$('message').textContent=returnView.message;
 $('startPanel').hidden=!(showPanel&&!browseAfter);$('resultPanel').hidden=!(showPanel&&browseAfter);
}
function hoverCountry(e){
 if(!browsing||gesture?.moved){$('countryTooltip').hidden=true;return}
 const r=$('viewport').getBoundingClientRect(),x=(e.clientX-r.left-tx)/scale,y=(e.clientY-r.top-ty)/scale;
 const c=atlasCountries().find(c=>x>=c.bounds[0]&&x<=c.bounds[2]&&y>=c.bounds[1]&&y<=c.bounds[3]&&contains(c,x,y));
 $('countryTooltip').hidden=!c;
 if(c){$('tooltipName').textContent=c.name;const flagPath=`flags/${c.tag}.png`;if($('tooltipFlag').getAttribute('src')!==flagPath)$('tooltipFlag').setAttribute('src',flagPath);$('countryTooltip').style.left=Math.max(4,Math.min(e.clientX-r.left+16,$('viewport').clientWidth-$('countryTooltip').offsetWidth-4))+'px';$('countryTooltip').style.top=Math.max(4,Math.min(e.clientY-r.top+16,$('viewport').clientHeight-$('countryTooltip').offsetHeight-4))+'px'}
}

function paintCountries(){
 $('eligible').replaceChildren();
 for(const c of (browsing?atlasCountries():countries)){const el=document.createElementNS('http://www.w3.org/2000/svg','path');el.setAttribute('d',c.d);el.setAttribute('fill-rule','evenodd');el.style.fill=colorful?COUNTRY_COLORS[c.tag]:'#eef0ef';$('eligible').append(el)}
}

function smoothBorder(polys){
 const point=p=>p.map(v=>Math.round(v*100)/100).join(',');
 return polys.map(p=>{
  const corners=p.map((b,i)=>{
   const a=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length];
   const before=Math.min(.45,Math.hypot(b[0]-a[0],b[1]-a[1])/2),after=Math.min(.45,Math.hypot(c[0]-b[0],c[1]-b[1])/2);
   const offset=(q,d)=>{const len=Math.hypot(q[0]-b[0],q[1]-b[1]);return len?[b[0]+(q[0]-b[0])*d/len,b[1]+(q[1]-b[1])*d/len]:b};
   return [offset(a,before),b,offset(c,after)];
  });
  return 'M'+point(corners[0][0])+corners.map(([a,b,c],i)=>(i?'L'+point(a):'')+'Q'+point(b)+' '+point(c)).join('')+'Z';
 }).join('');
}
const parseCountry=c=>{const polys=c.polys.map(p=>p.split(' ').map(v=>v.split(',').map(Number)));return {...c,polys,d:smoothBorder(polys)}};


function selectedGroups(){return REGION_GROUPS.filter(g=>$('region-'+g.id).checked).map(g=>g.id)}
function pool(){
 if($('scope').value==='hre')return HRE_COUNTRIES;
 if($('scope').value==='roman')return ROMAN_COUNTRIES;
 const groups=selectedGroups();
 return WORLD_COUNTRIES.filter(c=>groups.some(g=>c.parts[g])).map(c=>{
  const keys=groups.filter(g=>c.parts[g]);const parts=keys.map(g=>c.parts[g]);
  if(keys.length>1)return {tag:c.tag,name:c.name,...c.variants[keys.sort().join('|')]};
  return {tag:c.tag,name:c.name,polys:parts.flatMap(p=>p.polys),d:parts.map(p=>p.d).join(''),sample:parts[0].sample,bounds:[Math.min(...parts.map(p=>p.bounds[0])),Math.min(...parts.map(p=>p.bounds[1])),Math.max(...parts.map(p=>p.bounds[2])),Math.max(...parts.map(p=>p.bounds[3]))]};
 });
}
function configureMap(){
 const hre=$('scope').value==='hre';[MAP_W,MAP_H]=hre?HRE_SIZE:WORLD_SIZE;countries=pool().map(parseCountry);
 viewBounds=hre||!countries.length?[0,0,MAP_W,MAP_H]:[Math.min(...countries.map(c=>c.bounds[0]))-20,Math.min(...countries.map(c=>c.bounds[1]))-20,Math.max(...countries.map(c=>c.bounds[2]))+20,Math.max(...countries.map(c=>c.bounds[3]))+20];
 setMapSurface(hre);$('mapImage').alt='1444 年地图；浏览模式显示国名，答题模式隐藏国名';
 paintCountries();
 $('edition').textContent=hre?'神罗与周边 · 84 国专项':$('scope').value==='roman'?`罗马帝国 · ${countries.length} 国`:`自选大区 · ${countries.length} 国`;fit();
}
function updateSetup(){
 $('scopeHelp').hidden=$('scope').value!=='roman';
 setTarget($('scope').value==='hre'?'神罗小国，你认识多少？':$('scope').value==='roman'?'重返罗马的疆域':'选择大区，探索世界');
 const n=pool().length;$('regionPicker').hidden=$('scope').value!=='regions';$('start').disabled=!n;
 $('selectionCount').textContent=n?`已选 ${selectedGroups().length} 个大区 · 去重后 ${n} 个国家`:'请至少勾选一个大区';
 $('modeHelp').textContent=$('mode').value==='clear'?`全部 ${n} 个国家各答一次，答错或超时也会填色。`:`随机抽取 ${Math.min(30,n)} 个不同国家；不足 30 国时全部出题。`;
 $('coverage').textContent=$('scope').value==='roman'?`决议范围 ${ROMAN_PROVINCE_COUNT} 个省份 · ${n} 国 · 1444 年开局领土`:`当前题库 ${n} 国 · 1444 年 11 月 11 日`;configureMap();stats();
}
function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const [a,b]=p[i],[c,d]=p[j];if((b>y)!=(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit}return hit}
function contains(c,x,y){return c.polys.reduce((hit,p)=>hit!==inside(x,y,p),false)}
let queue=[],index=0,score=0,active=false,deadline=0,seconds=20,missed=[],timer;
let gameStartedAt=0,gameEndedAt=null;
let completed=new Map(),currentMark=null,soundEnabled=true,audioContext=null;
let scale=1,base=1,tx=0,ty=0,gesture=null,panFrame=null;
function moveMap(){$('map').style.transform=`translate(${tx}px,${ty}px) scale(${scale})`}
function cancelPanFrame(){if(panFrame!==null){cancelAnimationFrame(panFrame);panFrame=null}}
function transform(){cancelPanFrame();$('overlay').style.strokeWidth=Math.min(.65,1.25/scale);moveMap();$('zoom').textContent=Math.round(scale/base*100)+'%';updateLabels();$('countryTooltip').hidden=true}
function fit(){const [x0,y0,x1,y1]=viewBounds;const w=x1-x0,h=y1-y0;base=Math.min($('viewport').clientWidth/w,$('viewport').clientHeight/h);scale=base;tx=($('viewport').clientWidth-w*scale)/2-x0*scale;ty=($('viewport').clientHeight-h*scale)/2-y0*scale;transform()}
function zoom(f,x=$('viewport').clientWidth/2,y=$('viewport').clientHeight/2){const s=Math.min(base*128,Math.max(base,scale*f));tx=x-(x-tx)*s/scale;ty=y-(y-ty)*s/scale;scale=s;transform()}
function unlockAudio(){if(!soundEnabled)return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;if(!audioContext)audioContext=new Audio();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{})}catch{}}
function successSound(){
  if(!soundEnabled||!audioContext)return;
  try{[523.25,659.25,783.99].forEach((frequency,i)=>{const at=audioContext.currentTime+i*.085,osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.13,at+.015);gain.gain.exponentialRampToValueAtTime(.001,at+.24);osc.connect(gain);gain.connect(audioContext.destination);osc.start(at);osc.stop(at+.25);osc.onended=()=>{osc.disconnect();gain.disconnect()}})}catch{}
}
function accuracy(){return completed.size?`${(score/completed.size*100).toFixed(1)}%`:'—'}
function formatElapsed(ms){const total=Math.max(0,Math.floor(ms/1000)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),secs=String(total%60).padStart(2,'0');return `${hours?hours+'小时':''}${minutes}分${secs}秒`}
function stats(){$('score').textContent=score;$('accuracy').textContent=accuracy();$('cleared').textContent=`已完成 ${completed.size} / ${queue.length||countries.length}`}
function updateElapsed(){$('liveElapsed').textContent=formatElapsed(queue.length?(gameEndedAt??performance.now())-gameStartedAt:0)}
function tick(){updateElapsed();if(!active)return;if(!seconds){$('time').textContent='不限时';$('progress').style.width='100%';return}const left=Math.max(0,(deadline-performance.now())/1000);$('time').innerHTML=Math.ceil(left)+'<span>秒</span>';$('progress').style.width=left/seconds*100+'%';if(!left)finish(false,'时间到');}
function ask(){active=true;clearPending();$('confirmAnswer').hidden=!needsConfirmation();if(currentMark)currentMark.classList.remove('current');$('pin').setAttribute('display','none');const flag=$('questionType').value==='flag';setTarget(flag?'':queue[index].name,flag?queue[index].tag:null);$('eyebrow').textContent=flag?'请找到这面旗帜所属国家':'请在地图上找到';$('round').textContent=`${index+1} / ${queue.length}`;$('message').textContent=needsConfirmation()?'先点选领土，再点“确认作答”；确认前可以更换选择。':'点击国家领土作答；带斜线的已答区域不会再次结算。';$('next').disabled=true;$('next').textContent=index===queue.length-1?'查看成绩 →':'下一题 →';deadline=performance.now()+seconds*1000;tick();}
function start(){
  if(!pool().length)return;leaveBrowse(false);configureMap();clearInterval(timer);unlockAudio();gameStartedAt=performance.now();gameEndedAt=null;seconds=Number($('duration').value);queue=[...countries];
  for(let i=queue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[queue[i],queue[j]]=[queue[j],queue[i]]}
  if($('mode').value==='challenge')queue=queue.slice(0,30);
  index=0;score=0;missed=[];completed=new Map();currentMark=null;$('reveal').replaceChildren();stats();$('startPanel').hidden=true;$('resultPanel').hidden=true;fit();ask();timer=setInterval(tick,75);
}
function finish(correct,prefix){
  if(!active)return;active=false;clearPending();$('confirmAnswer').hidden=true;if(index===queue.length-1)gameEndedAt=performance.now();updateElapsed();const target=queue[index];if($('questionType').value==='flag')setTarget(target.name,target.tag);completed.set(target.tag,correct);if(correct){score++;successSound()}else missed.push(target.name);
  stats();$('eyebrow').textContent=correct?'✓ 定位成功':'本题已结算';$('message').textContent=correct?`答对了！${target.name} 已标为青绿色斜纹。`:`${prefix}；${target.name} 已标为亮粉色斜纹，请记住它的位置。`;
  const el=document.createElementNS('http://www.w3.org/2000/svg','path');el.setAttribute('d',target.d);el.setAttribute('fill-rule','evenodd');el.setAttribute('class',`${correct?'correct':'incorrect'} current`);el.setAttribute('data-country',target.tag);$('reveal').append(el);currentMark=el;$('next').disabled=false;
}
function answer(x,y,confirmed=false){
  if(browsing||!active)return;if(seconds&&performance.now()>=deadline){tick();return}const clicked=countries.find(c=>(!c.bounds||(x>=c.bounds[0]&&x<=c.bounds[2]&&y>=c.bounds[1]&&y<=c.bounds[3]))&&contains(c,x,y));
  if(!clicked){clearPending();$('pin').setAttribute('display','none');$('message').textContent='深灰色和海面不出题，请点击没有斜线标记的国家领土。';return}
  if(completed.has(clicked.tag)){clearPending();$('pin').setAttribute('display','none');$('message').textContent='这片带斜线的领土已经完成，不重复计分。请寻找当前目标。';return}
  if(needsConfirmation()&&!confirmed){pendingAnswer={x,y};$('selection').setAttribute('d',clicked.d);$('pin').setAttribute('cx',x);$('pin').setAttribute('cy',y);$('pin').setAttribute('display','block');$('confirmAnswer').hidden=false;$('confirmAnswer').disabled=false;$('message').textContent='已选中描边领土，可重新点选；点“确认作答”提交。';return}
  unlockAudio();$('pin').setAttribute('cx',x);$('pin').setAttribute('cy',y);$('pin').setAttribute('display','block');finish(clicked.tag===queue[index].tag,'没有点中');
}
function showResults(){clearInterval(timer);active=false;$('resultPanel').hidden=false;$('finalScore').textContent=accuracy();$('totalElapsed').textContent=formatElapsed((gameEndedAt??performance.now())-gameStartedAt);$('resultTitle').textContent=$('mode').value==='clear'?'地图清空完成':'本轮挑战完成';$('summary').textContent=`答对 ${score} / ${queue.length}，答错或超时 ${queue.length-score}。`;$('review').textContent=missed.length?'可以再记一记：'+missed.join('、'):'全部答对！';$('next').disabled=true;setTarget('本局完成');$('eyebrow').textContent='正确率 '+accuracy();$('message').textContent='本局填色已保留，可继续放大查看。';}
$('confirmAnswer').onclick=()=>{if(pendingAnswer&&active&&!browsing){const {x,y}=pendingAnswer;answer(x,y,true)}};
$('next').onclick=()=>{if(active||!queue.length||index>=queue.length)return;if(++index<queue.length)ask();else showResults()};
window.addEventListener('keydown',e=>{
  if(browsing||e.code!=='Space'||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.target?.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(!$('startPanel').hidden||!$('resultPanel').hidden||!queue.length||index>=queue.length)return;
  e.preventDefault();
  if(!e.repeat&&!$('next').disabled)$('next').click();
});
$('start').onclick=start;$('again').onclick=start;$('viewMap').onclick=()=>enterBrowse(true);
$('browseBefore').onclick=()=>enterBrowse(false);$('browseBack').onclick=()=>leaveBrowse();$('browseStart').onclick=start;
$('restart').onclick=()=>{leaveBrowse(false);active=false;clearPending();$('confirmAnswer').hidden=true;clearInterval(timer);queue=[];index=0;score=0;completed=new Map();currentMark=null;updateElapsed();stats();$('startPanel').hidden=false;$('resultPanel').hidden=true;$('reveal').replaceChildren();$('pin').setAttribute('display','none');$('next').disabled=true;setTarget('选择题库，开始探索');$('eyebrow').textContent='准备探索';$('message').textContent='只考题库国家；深灰色地区不进入题库。';$('round').textContent='—';$('time').textContent=Number($('duration').value)?$('duration').value+' 秒':'不限时';$('progress').style.width='100%';fit()};
$('mode').onchange=updateSetup;$('scope').onchange=updateSetup;
$('palette').onclick=()=>{colorful=!colorful;$('palette').textContent=colorful?'配色：彩色':'配色：灰白';$('palette').setAttribute('aria-pressed',String(colorful));paintCountries()};
$('sound').onclick=()=>{soundEnabled=!soundEnabled;$('sound').textContent=soundEnabled?'音效：开':'音效：关';$('sound').setAttribute('aria-pressed',String(soundEnabled));if(soundEnabled)unlockAudio()};
$('zoomIn').onclick=()=>zoom(1.35);$('zoomOut').onclick=()=>zoom(1/1.35);$('fit').onclick=fit;
$('viewport').addEventListener('wheel',e=>{e.preventDefault();const r=$('viewport').getBoundingClientRect();zoom(e.deltaY<0?1.15:1/1.15,e.clientX-r.left,e.clientY-r.top)},{passive:false});
$('viewport').onpointerdown=e=>{if(gesture)return;$('countryTooltip').hidden=true;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,tx,ty,moved:false};$('viewport').setPointerCapture(e.pointerId)};
$('viewport').onpointermove=e=>{if(!gesture){hoverCountry(e);return}if(gesture.id!==e.pointerId)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.hypot(dx,dy)>6)gesture.moved=true;if(gesture.moved){tx=gesture.tx+dx;ty=gesture.ty+dy;if(panFrame===null)panFrame=requestAnimationFrame(()=>{panFrame=null;moveMap()})}};
$('viewport').onpointerup=e=>{if(!gesture||gesture.id!==e.pointerId)return;const moved=gesture.moved;gesture=null;if(moved){transform();return}if(browsing){hoverCountry(e);return}touchInput=e.pointerType==='touch'||e.pointerType==='pen';const r=$('viewport').getBoundingClientRect();answer((e.clientX-r.left-tx)/scale,(e.clientY-r.top-ty)/scale)};
$('viewport').onpointerleave=()=>{$('countryTooltip').hidden=true};$('viewport').onpointercancel=()=>{gesture=null;transform()};window.addEventListener('resize',fit);for(const g of REGION_GROUPS){const label=document.createElement('label');label.className='region-card';const input=document.createElement('input');input.type='checkbox';input.id='region-'+g.id;input.checked=g.id==='europe';input.onchange=updateSetup;const text=document.createElement('span');text.textContent=`${g.name}（${g.count} 国家）`;label.append(input,text);$('regionCards').append(label)}updateSetup();

if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'start_map_challenge',description:'按当前选择的模式开始地图国家挑战，重置成绩和已完成填色。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||Object.keys(input).length)throw new Error('不接受参数');if(!pool().length)throw new Error('请至少勾选一个大区');start();return {...($('questionType').value==='flag'?{flag:$('targetFlag').src}:{country:queue[0].name}),seconds,rounds:queue.length,mode:$('mode').value}}})).catch(()=>{})}catch{}}
