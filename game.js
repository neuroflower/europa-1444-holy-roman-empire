const $=id=>document.getElementById(id);
const [MAP_W,MAP_H]=MAP_SIZE;
const countries=COUNTRIES.map(c=>({...c,polys:c.polys.map(p=>p.split(' ').map(v=>v.split(',').map(Number)))}));
function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const [a,b]=p[i],[c,d]=p[j];if((b>y)!=(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit}return hit}
function contains(c,x,y){return c.polys.reduce((hit,p)=>hit!==inside(x,y,p),false)}
let queue=[],index=0,score=0,active=false,deadline=0,seconds=20,missed=[],timer;
let gameStartedAt=0,gameEndedAt=null;
let completed=new Map(),currentMark=null,soundEnabled=true,audioContext=null;
let scale=1,base=1,tx=0,ty=0,gesture=null;
function transform(){$('map').style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;$('zoom').textContent=Math.round(scale/base*100)+'%'}
function fit(){base=Math.min($('viewport').clientWidth/MAP_W,$('viewport').clientHeight/MAP_H);scale=base;tx=($('viewport').clientWidth-MAP_W*scale)/2;ty=($('viewport').clientHeight-MAP_H*scale)/2;transform()}
function zoom(f,x=$('viewport').clientWidth/2,y=$('viewport').clientHeight/2){const s=Math.min(base*16,Math.max(base,scale*f));tx=x-(x-tx)*s/scale;ty=y-(y-ty)*s/scale;scale=s;transform()}
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
function ask(){active=true;if(currentMark)currentMark.classList.remove('current');$('pin').setAttribute('display','none');$('target').textContent=queue[index].name;$('eyebrow').textContent='请在地图上找到';$('round').textContent=`${index+1} / ${queue.length}`;$('message').textContent='点击浅色领土作答；已上色区域不会再次结算。';$('next').disabled=true;$('next').textContent=index===queue.length-1?'查看成绩 →':'下一题 →';deadline=performance.now()+seconds*1000;tick();}
function start(){
  clearInterval(timer);unlockAudio();gameStartedAt=performance.now();gameEndedAt=null;seconds=Number($('duration').value);queue=[...countries];
  for(let i=queue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[queue[i],queue[j]]=[queue[j],queue[i]]}
  if($('mode').value==='challenge')queue=queue.slice(0,10);
  index=0;score=0;missed=[];completed=new Map();currentMark=null;$('reveal').replaceChildren();stats();$('startPanel').hidden=true;$('resultPanel').hidden=true;fit();ask();timer=setInterval(tick,75);
}
function finish(correct,prefix){
  if(!active)return;active=false;if(index===queue.length-1)gameEndedAt=performance.now();updateElapsed();const target=queue[index];completed.set(target.tag,correct);if(correct){score++;successSound()}else missed.push(target.name);
  stats();$('eyebrow').textContent=correct?'✓ 定位成功':'本题已结算';$('message').textContent=correct?`答对了！${target.name} 已标为青绿色。`:`${prefix}；${target.name} 已标为亮粉色，请记住它的位置。`;
  const el=document.createElementNS('http://www.w3.org/2000/svg','path');el.setAttribute('d',target.d);el.setAttribute('fill-rule','evenodd');el.setAttribute('class',`${correct?'correct':'incorrect'} current`);el.setAttribute('data-country',target.tag);$('reveal').append(el);currentMark=el;$('next').disabled=false;
}
function answer(x,y){
  if(!active)return;if(seconds&&performance.now()>=deadline){tick();return}const clicked=countries.find(c=>contains(c,x,y));
  if(!clicked){$('message').textContent='深灰色和海面不出题，请点击尚未上色的浅色领土。';return}
  if(completed.has(clicked.tag)){$('message').textContent='这片领土已经完成，不重复计分。请寻找当前目标。';return}
  unlockAudio();$('pin').setAttribute('cx',x);$('pin').setAttribute('cy',y);$('pin').setAttribute('display','block');finish(clicked.tag===queue[index].tag,'没有点中');
}
function showResults(){clearInterval(timer);active=false;$('resultPanel').hidden=false;$('finalScore').textContent=accuracy();$('totalElapsed').textContent=formatElapsed((gameEndedAt??performance.now())-gameStartedAt);$('resultTitle').textContent=$('mode').value==='clear'?'地图清空完成':'本轮挑战完成';$('summary').textContent=`答对 ${score} / ${queue.length}，答错或超时 ${queue.length-score}。`;$('review').textContent=missed.length?'可以再记一记：'+missed.join('、'):'全部答对！';$('next').disabled=true;$('target').textContent='本局完成';$('eyebrow').textContent='正确率 '+accuracy();$('message').textContent='本局填色已保留，可继续放大查看。';}
$('next').onclick=()=>{if(active||!queue.length||index>=queue.length)return;if(++index<queue.length)ask();else showResults()};
window.addEventListener('keydown',e=>{
  if(e.code!=='Space'||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.target?.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(!$('startPanel').hidden||!$('resultPanel').hidden||!queue.length||index>=queue.length)return;
  e.preventDefault();
  if(!e.repeat&&!$('next').disabled)$('next').click();
});
$('start').onclick=start;$('again').onclick=start;$('viewMap').onclick=()=>{$('resultPanel').hidden=true};
$('restart').onclick=()=>{active=false;clearInterval(timer);queue=[];index=0;score=0;completed=new Map();currentMark=null;updateElapsed();stats();$('startPanel').hidden=false;$('resultPanel').hidden=true;$('reveal').replaceChildren();$('pin').setAttribute('display','none');$('next').disabled=true;$('target').textContent='神罗小国，你认识多少？';$('eyebrow').textContent='准备探索';$('message').textContent='只考浅色区域；深灰色地区不进入题库。';$('round').textContent='—';$('time').textContent=Number($('duration').value)?$('duration').value+' 秒':'不限时';$('progress').style.width='100%';fit()};
$('mode').onchange=()=>{$('duration').value=$('mode').value==='clear'?'0':'20';$('modeHelp').textContent=$('mode').value==='clear'?`全部 ${countries.length} 个国家各答一次，答错也会填色，直至整张题库地图完成。`:'随机抽取 10 个不同国家，适合短时练习。'};
$('sound').onclick=()=>{soundEnabled=!soundEnabled;$('sound').textContent=soundEnabled?'音效：开':'音效：关';$('sound').setAttribute('aria-pressed',String(soundEnabled));if(soundEnabled)unlockAudio()};
$('zoomIn').onclick=()=>zoom(1.35);$('zoomOut').onclick=()=>zoom(1/1.35);$('fit').onclick=fit;
$('viewport').addEventListener('wheel',e=>{e.preventDefault();const r=$('viewport').getBoundingClientRect();zoom(e.deltaY<0?1.15:1/1.15,e.clientX-r.left,e.clientY-r.top)},{passive:false});
$('viewport').onpointerdown=e=>{if(gesture)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,tx,ty,moved:false};$('viewport').setPointerCapture(e.pointerId)};
$('viewport').onpointermove=e=>{if(!gesture||gesture.id!==e.pointerId)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.hypot(dx,dy)>6)gesture.moved=true;if(gesture.moved){tx=gesture.tx+dx;ty=gesture.ty+dy;transform()}};
$('viewport').onpointerup=e=>{if(!gesture||gesture.id!==e.pointerId)return;const moved=gesture.moved;gesture=null;if(!moved){const r=$('viewport').getBoundingClientRect();answer((e.clientX-r.left-tx)/scale,(e.clientY-r.top-ty)/scale)}};
$('viewport').onpointercancel=()=>{gesture=null};window.addEventListener('resize',fit);$('map').style.width=MAP_W+'px';$('map').style.height=MAP_H+'px';$('overlay').setAttribute('viewBox',`0 0 ${MAP_W} ${MAP_H}`);$('coverage').textContent=`${countries.length} 个国家 · 1444 年 11 月 11 日`;stats();fit();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'start_map_challenge',description:'按当前选择的模式开始神罗国家挑战，重置成绩和已完成填色。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||Object.keys(input).length)throw new Error('不接受参数');start();return {country:queue[0].name,seconds,rounds:queue.length,mode:$('mode').value}}})).catch(()=>{})}catch{}}
