'use strict';
(() => {
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=()=>({format:'little-ai-lab',version:1,title:'우리의 초록 약속',classes:[{name:'첫 번째 종류',photos:[]},{name:'두 번째 종류',photos:[]}],blocks:[],revision:0,trainedRevision:-1,round:0,reflection:'',history:[]});
let state=fresh(), classifier=null, base=null, loadingBase=null, working=false, unsaved=false, testImage=null, runImage=null, demoIndex=0;
let modelRecord=null, autosaveTimer=null, persistenceReady=false, storageFailed=false;
const icons=['🌱','♻️','💚','📦','💧','🌏','🧺','⭐'];
const messages=['다시 써요!','여러 번 써요!','따로 모아요!','깨끗이 비워요!','사용을 줄여요!'];
function tell(msg){$('#notice').textContent=msg;$('#notice').hidden=false;}
function changed(data=false){$('#download-ready').hidden=true;unsaved=true;if(data){state.revision++;state.trainingCheck=null;}$('#save-state').textContent='자동 저장 중…';renderStatus();if(persistenceReady){checkpoint.mark();clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>flushSave().catch(()=>{}),150);}}
async function flushSave(){clearTimeout(autosaveTimer);await checkpoint.flush();}
function saveError(err){console.error(err);storageFailed=true;$('#save-state').textContent='저장 실패 · 파일로 받아 주세요';tell('이 브라우저에 작품을 저장하지 못했어요. 사진을 더 고르기 전에 파일로 받아 보관해 주세요.');}
function busy(on,msg='준비하고 있어요…'){working=on;$('#busy-text').textContent=msg;$('#busy').hidden=!on;}
function safe(fn){return async e=>{if(working)return;try{await fn(e);}catch(err){console.error(err);tell(err.message||'잠깐 문제가 생겼어요. 다시 시도해 주세요.');}finally{if(persistenceReady&&unsaved){try{await flushSave();}catch{}}busy(false);}};}
function goto(tab){if(persistenceReady&&state.view!==tab){state.view=tab;changed();}$$('.page').forEach(el=>el.hidden=el.id!==tab);$$('.steps button').forEach(el=>{el.classList.toggle('active',el.dataset.tab===tab);el.setAttribute('aria-current',el.dataset.tab===tab?'step':'false');});if(tab==='build')renderBlocks();}
$$('[data-tab]').forEach(el=>el.onclick=()=>goto(el.dataset.tab));
function renderClasses(){
$('#classes').innerHTML=state.classes.map((c,i)=>`<article class="class-card"><div class="class-header"><span class="class-letter">${i?'B':'A'}</span><input data-name="${i}" aria-label="${i?'두':'첫'} 번째 종류 이름" maxlength="20" value="${escape(c.name)}"><span class="count">${c.photos.length}장</span></div><div class="photos">${c.photos.length?c.photos.map((p,j)=>`<div class="thumb"><img src="${p}" alt="${escape(c.name)} 학습 사진 ${j+1}"><button data-remove="${i},${j}" aria-label="${escape(c.name)} 사진 ${j+1} 지우기">×</button></div>`).join(''):`<div class="photo-empty"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 14h10l4-6h9l4 6h7v26H7z"/><circle cx="24" cy="26" r="8"/></svg><span>이름을 정하고 사진을 넣어요.</span></div>`}</div><div class="photo-actions"><button type="button" class="secondary" data-camera-class="${i}">📷 화면에서 찍기</button><label class="button">＋ 사진 넣기<input type="file" data-photo="${i}" accept="image/*" multiple hidden></label></div></article>`).join('');
$$('[data-name]').forEach(el=>el.onchange=()=>{const i=+el.dataset.name;const name=el.value.trim();if(!name||name===state.classes[1-i].name){tell('두 종류를 서로 다른 이름으로 정해 주세요.');el.value=state.classes[i].name;return;}state.classes[i].name=name;changed();renderClasses();renderBlocks();clearResults();});
$$('[data-camera-class]').forEach(el=>el.onclick=safe(()=>openCamera(+el.dataset.cameraClass)));
$$('[data-photo]').forEach(el=>el.onchange=safe(async()=>{const files=[...el.files];if(!files.length)return;const c=state.classes[+el.dataset.photo];if(c.photos.length+files.length>30)throw Error('한 종류에 30장까지 넣을 수 있어요. 비슷한 사진을 덜어 내고 넣어 주세요.');busy(true,'사진을 작게 정리하고 있어요…');const pics=[];for(const f of files){if(f.size>20000000)throw Error('사진 한 장은 20MB보다 작아야 해요.');pics.push(await fileImage(f));}c.photos.push(...pics);changed(true);renderClasses();clearResults();tell('사진을 넣었어요. 자료가 달라졌으니 AI를 가르쳐 주세요.');}));
$$('[data-remove]').forEach(el=>el.onclick=()=>{const[i,j]=el.dataset.remove.split(',').map(Number);state.classes[i].photos.splice(j,1);changed(true);renderClasses();clearResults();});
}
function renderStatus(){const ready=!!classifier&&state.trainedRevision===state.revision;
$('#train-state').textContent=ready?`✓ ${state.round}번째 배움 완료! 새 사진으로 시험해요.`:classifier?'사진이 바뀌었어요. 다시 가르쳐 주세요.':state.modelRecoveryNeeded?'사진은 보관했어요. AI를 다시 가르쳐 주세요.':'사진을 모으면 준비 끝!';
$('#train-detail').textContent=ready?'틀릴 수도 있어요. 다른 모습의 사진으로 확인해 보세요.':'3장은 시작하는 최소량이에요. 사진을 더 모으고 다시 시험해 봐요.';
$('#train').textContent=classifier?'✦ AI 다시 가르치기':'✦ AI 가르치기';
$('#technical').textContent=`모델: MobileNet v1 α0.25 + 학습형 2종 분류기 · 배움 ${state.round}회 · 시험 기록 ${state.history.length}개${base?' · 처리: '+tf.getBackend():''}${state.trainingCheck?' · 학습 자료 확인 '+state.trainingCheck.correct+'/'+state.trainingCheck.total+' (새 사진 정확도 아님)':''}`;
}
function clearResults(){state.testResult=null;$('#test-result').className='test-result empty';$('#test-result').textContent='새 사진으로 다시 시험해 주세요.';$('#app-result').innerHTML='<span class="leaf">❋</span><p>시작 버튼을 눌러 다시 확인해요.</p>';}
let camera=null,cameraTarget=null,cameraSession=0,capturePending=false;
function closeCamera(){cameraSession++;camera?.stop();$('#camera-dialog').close();}
function cameraError(e){
 if(e.name==='NotAllowedError')return '카메라 사용을 허용해 주세요. 허용이 어렵다면 닫고 사진첩의 사진을 넣어도 돼요.';
 if(e.name==='NotFoundError')return '사용할 카메라를 찾지 못했어요. 사진첩의 사진을 넣어 주세요.';
 if(e.name==='NotReadableError')return '카메라를 열지 못했어요. 다른 앱의 카메라를 닫고 다시 열어 주세요.';
 return e.message||'카메라를 열지 못했어요. 닫고 사진첩의 사진을 넣어 주세요.';
}
async function startCamera(){
 const session=++cameraSession;$('#camera-capture').disabled=true;$('#camera-retry').hidden=true;
 $('#camera-status').textContent='카메라를 준비해요. 사용 허용을 눌러 주세요.';
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('이 화면에서 카메라를 열 수 없어요. Chrome이나 Safari에서 주소를 직접 열거나 사진첩의 사진을 넣어 주세요.');
  camera ||= new InlineCamera($('#camera-video'));
  const opened=await camera.open();if(session!==cameraSession||!opened)return;
  $('#camera-capture').disabled=false;$('#camera-status').textContent='물건을 비추고 찍어요. 사진은 이 기기에 저장해요.';
 }catch(e){if(session!==cameraSession)return;camera?.stop();$('#camera-status').textContent=cameraError(e);$('#camera-retry').hidden=false;}
}
async function openCamera(target){
 if(typeof target==='number'&&state.classes[target].photos.length>=30)throw Error('한 종류에 30장까지 넣을 수 있어요.');
 if(target==='test')requireModel();
 await flushSave();cameraTarget=target;
 $('#camera-title').textContent=typeof target==='number'?state.classes[target].name+' 사진 찍기':target==='test'?'새 사진으로 AI 시험하기':'내 앱에서 쓸 사진 찍기';
 $('#camera-last').hidden=true;$('#camera-dialog').showModal();await startCamera();
}
$('#camera-close').onclick=closeCamera;
$('#camera-dialog').oncancel=e=>{e.preventDefault();closeCamera();};
$('#camera-dialog').onclose=()=>{cameraSession++;camera?.stop();};
$('#camera-retry').onclick=()=>startCamera();
$('#test-camera').onclick=safe(()=>openCamera('test'));
$('#run-camera').onclick=safe(()=>openCamera('run'));
$('#camera-capture').onclick=async()=>{
 if(capturePending)return;capturePending=true;$('#camera-capture').disabled=true;
 try{
  const target=cameraTarget;
  if(typeof target==='number'&&state.classes[target].photos.length>=30)throw Error('30장을 모았어요. 닫고 AI를 가르쳐 주세요.');
  const src=camera.capture();
  if(typeof target==='number'){
   state.classes[target].photos.push(src);changed(true);renderClasses();clearResults();
   $('#camera-last').src=src;$('#camera-last').hidden=false;
   $('#camera-status').textContent='사진을 저장하고 있어요…';await flushSave();
   $('#camera-status').textContent=state.classes[target].photos.length+'장 저장했어요! 다른 모습도 찍어 봐요.';
  }else{closeCamera();if(target==='test')await acceptTestPhoto(src);else acceptRunPhoto(src);await flushSave();}
 }catch(e){$('#camera-status').textContent=cameraError(e);tell(e.message);}
 finally{capturePending=false;$('#camera-capture').disabled=!camera?.stream;busy(false);}
};
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='hidden'&&camera?.stream){cameraSession++;camera.stop();$('#camera-capture').disabled=true;$('#camera-retry').hidden=false;$('#camera-status').textContent='잠시 카메라를 껐어요. 다시 열기를 눌러 주세요.';}
});
window.addEventListener('pagehide',()=>{cameraSession++;camera?.stop();});
async function acceptTestPhoto(src){requireModel();busy(true,'새 사진을 보고 있어요…');testImage=src;state.testPhoto=src;state.testResult=null;changed();await flushSave();const r=await predict(src);testView(src,r);record(r,'test');}
function acceptRunPhoto(src){runImage=src;state.runPhoto=src;changed();$('#run-image').className='';$('#run-image').innerHTML=`<img src="${src}" alt="내 앱에서 시험할 사진">`;$('#app-result').innerHTML='<p>시작 버튼을 눌러 주세요.</p>';}
async function loadImg(url){const im=new Image();im.src=url;await im.decode();return im;}
async function fileImage(f){
 if(f.size>20000000)throw Error('사진은 20MB보다 작아야 해요.');
 if(!f.type.startsWith('image/'))throw Error('사진 파일을 골라 주세요.');
 let im=null,url=null,c=null;
 try{
  if(typeof createImageBitmap==='function'){try{im=await createImageBitmap(f,{resizeWidth:320,resizeQuality:'medium'});}catch{}}
  if(!im){url=URL.createObjectURL(f);im=await loadImg(url);}
  c=document.createElement('canvas');const r=Math.min(320/im.width,320/im.height,1);
  c.width=Math.max(1,Math.round(im.width*r));c.height=Math.max(1,Math.round(im.height*r));
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(im,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',.86);
 }catch{throw Error('이 사진을 열지 못했어요. JPG나 PNG 사진으로 다시 골라 주세요.');}
 finally{im?.close?.();if(im instanceof HTMLImageElement)im.src='';if(url)URL.revokeObjectURL(url);if(c){c.width=1;c.height=1;}}
}
async function ensureTf(){if(typeof tf==='undefined'||typeof AIEngine==='undefined')throw Error('AI 준비 파일을 불러오지 못했어요. 연결을 확인해 주세요.');if(tf.getBackend()!=='cpu')await tf.setBackend('cpu');await tf.ready();}
async function ensureBase(){if(base)return base;if(loadingBase)return loadingBase;loadingBase=(async()=>{await ensureTf();base=await new AIEngine().load(new URL('model/model.json',location.href).href);return base;})();try{return await loadingBase;}finally{loadingBase=null;}}
async function embedding(src){const im=await loadImg(src);return base.embed(im);}
function requireModel(){if(!classifier)throw Error('아직 AI가 배우지 않았어요. 사진을 모아 먼저 가르쳐 주세요.');if(state.trainedRevision!==state.revision)throw Error('사진이 바뀌었어요. ‘AI 다시 가르치기’를 눌러 주세요.');}
$('#train').onclick=safe(async()=>{if(state.classes.some(c=>c.photos.length<3))throw Error('두 종류에 사진을 각각 3장 이상 넣어 주세요.');busy(true,'AI가 배울 준비를 하고 있어요…');$('#progress').hidden=false;let xs,ys,next,features=[];try{await ensureBase();const labels=[];let n=0,total=state.classes.reduce((s,c)=>s+c.photos.length,0);for(let i=0;i<2;i++){for(const pic of state.classes[i].photos){$('#busy-text').textContent=`사진의 모습을 살펴봐요… ${++n} / ${total}`;features.push(await embedding(pic));labels.push(i);$('#progress').value=n/total*40;await tf.nextFrame();}}
xs=tf.concat(features,0);features.forEach(t=>t.dispose());features=[];ys=tf.tidy(()=>tf.oneHot(tf.tensor1d(labels,'int32'),2));next=await base.train(xs,ys,async(epoch)=>{$('#busy-text').textContent=`두 종류의 차이를 배우고 있어요… ${Math.round((epoch+1)/40*100)}%`;$('#progress').value=40+(epoch+1)/40*60;});const savedModel=await serializeModel(next);if(!AIEngine.checkRecord(savedModel))throw Error('AI의 배움 값을 저장하지 못했어요. 다시 가르쳐 주세요.');state.trainingCheck=next.trainingCheck;state.modelRecoveryNeeded=false;classifier?.dispose();classifier=next;modelRecord=savedModel;next=null;state.trainedRevision=state.revision;state.round++;changed();clearResults();tell(state.trainingCheck.correct===state.trainingCheck.total?'배웠어요! 가르칠 때 쓰지 않은 새 사진으로 시험해 보세요.':'학습은 끝났지만, 배운 사진도 헷갈리고 있어요. 사진이 알맞은 종류에 들어갔는지 살펴보고 다시 가르쳐 보세요.');}finally{xs?.dispose();ys?.dispose();next?.dispose();features.forEach(t=>t.dispose());$('#progress').hidden=true;renderStatus();}});
async function predict(src){let x=null,out=null;try{requireModel();await ensureBase();x=await embedding(src);out=classifier.predict(x);const p=Array.from(await out.data());return {index:AIEngine.checkScores(p),probabilities:p};}catch(e){clearResults();throw e;}finally{x?.dispose();out?.dispose();}}
function record(r,where){state.history.push({round:state.round,prediction:r.index,probabilities:r.probabilities,where,at:new Date().toISOString()});if(state.history.length>100)state.history.shift();changed();}
function testView(src,r){state.testPhoto=src;state.testResult={index:r.index,round:state.round};$('#test-again').hidden=false;$('#test-result').className='test-result';$('#test-result').innerHTML=`<img src="${src}" alt="새 시험 사진"><div>AI의 생각은<strong>${escape(state.classes[r.index].name)}</strong><small>두 종류 중 하나를 고른 결과예요.<br>내 생각과 같나요? · ${state.round}번째 배움</small></div>`;}
$('#test-file').onchange=safe(async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;requireModel();await acceptTestPhoto(await fileImage(f));});
$('#test-again').onclick=safe(async()=>{if(!testImage)throw Error('시험할 사진을 먼저 골라 주세요.');requireModel();busy(true,'같은 사진으로 다시 시험해요…');const r=await predict(testImage);testView(testImage,r);record(r,'test');});
function renderBlocks(){
$('#blocks').innerHTML=state.blocks.map((b,i)=>`<div class="code-block ${b.type==='photo'?'blue':b.type==='predict'?'purple':'orange'}"><div class="block-top">${b.type==='if'?`<b>만약 <select data-class="${i}" aria-label="조건 ${i+1}의 종류">${state.classes.map((c,k)=>`<option value="${k}" ${b.classIndex===k?'selected':''}>${escape(c.name)}</option>`).join('')}</select> (이)라면</b>`:`<b>${b.type==='photo'?'📷 사진 받기':'✦ AI에게 물어보기'}</b>`}<div class="controls"><button data-up="${i}" aria-label="${i+1}번 블록 위로" ${i===0?'disabled':''}>↑</button><button data-down="${i}" aria-label="${i+1}번 블록 아래로" ${i===state.blocks.length-1?'disabled':''}>↓</button><button data-delete="${i}" aria-label="${i+1}번 블록 지우기">×</button></div></div>${b.type==='if'?`<div class="block-output"><label>보여 줘</label><select data-icon="${i}" aria-label="조건 ${i+1}의 그림">${icons.map(ic=>`<option ${b.icon===ic?'selected':''}>${ic}</option>`).join('')}</select><select data-message-choice="${i}" aria-label="조건 ${i+1}의 안내 고르기"><option value="">안내 고르기</option>${messages.map(m=>`<option ${b.message===m?'selected':''}>${m}</option>`).join('')}</select><input data-message="${i}" aria-label="조건 ${i+1}의 안내" maxlength="80" placeholder="어떤 안내를 할까요?" value="${escape(b.message)}"></div>`:''}</div>`).join('');
$('#block-empty').hidden=state.blocks.length>0;$('#block-count').textContent=`${state.blocks.length}개`;
$$('[data-up]').forEach(e=>e.onclick=()=>moveBlock(+e.dataset.up,-1));$$('[data-down]').forEach(e=>e.onclick=()=>moveBlock(+e.dataset.down,1));$$('[data-delete]').forEach(e=>e.onclick=()=>{state.blocks.splice(+e.dataset.delete,1);changed();renderBlocks();});
$$('[data-message-choice]').forEach(e=>e.onchange=()=>{if(!e.value)return;state.blocks[+e.dataset.messageChoice].message=e.value;changed();renderBlocks();});
for(const [attr,prop,convert] of [['class','classIndex',Number],['icon','icon',String],['message','message',String]])$$(`[data-${attr}]`).forEach(e=>e.onchange=()=>{state.blocks[+e.dataset[attr]][prop]=convert(e.value);changed();$('#validation').textContent='바꾼 블록의 연결을 확인해 보세요.';$('#sim-output').textContent='바꾼 연결을 다시 시험해 보세요.';});
$('#sim-buttons').innerHTML=state.classes.map((c,i)=>`<button data-sim="${i}">${escape(c.name)} (이)라면</button>`).join('');$$('[data-sim]').forEach(e=>e.onclick=()=>{const i=+e.dataset.sim;const matches=state.blocks.filter(b=>b.type==='if'&&b.classIndex===i);$('#sim-output').textContent=matches.length?matches.map(b=>`${b.icon} ${b.message||'(안내를 적어 주세요)'}`).join(' / '):'이 종류에 연결된 안내가 없어요.';});$('#validation').textContent='';
}
function moveBlock(i,d){[state.blocks[i],state.blocks[i+d]]=[state.blocks[i+d],state.blocks[i]];changed();renderBlocks();}
$$('[data-add]').forEach(e=>e.onclick=()=>{if(state.blocks.length>=8)return tell('첫 작품은 블록 8개까지 사용할 수 있어요. 필요 없는 블록을 덜어 내 볼까요?');const type=e.dataset.add;state.blocks.push(type==='if'?{type,classIndex:state.blocks.some(b=>b.type==='if'&&b.classIndex===0)?1:0,icon:'🌱',message:''}:{type});changed();renderBlocks();});
function validate(){const errors=[];let photo=false,ai=false;let photoCount=0,aiCount=0;const counts=[0,0];for(const b of state.blocks){if(b.type==='photo'){photo=true;photoCount++;}if(b.type==='predict'){if(!photo)errors.push('AI에게 물어보기 전에 ‘사진 받기’가 있어야 해요.');ai=true;aiCount++;}if(b.type==='if'){if(!ai)errors.push('‘만약’ 앞에 ‘AI에게 물어보기’가 있어야 해요.');counts[b.classIndex]++;if(!b.message.trim())errors.push('‘보여 줘’에 안내를 적어 주세요.');}}if(!photo)errors.push('‘사진 받기’ 블록을 넣어 주세요.');if(!ai)errors.push('‘AI에게 물어보기’ 블록을 넣어 주세요.');if(photoCount>1||aiCount>1)errors.push('이번 작품은 사진 받기와 AI에게 물어보기를 하나씩 사용해요.');counts.forEach((n,i)=>{if(n===0)errors.push(`‘${state.classes[i].name}’일 때의 안내가 없어요.`);if(n>1)errors.push(`‘${state.classes[i].name}’ 조건이 겹쳐요. 하나를 다른 종류로 바꿔 볼까요?`);});return [...new Set(errors)];}
$('#check-blocks').onclick=()=>{$('#validation').textContent=validate().join('\n')||'✓ 연결됐어요! 두 종류에 각각 어떤 안내가 나오는지 시험해 보세요.';};
$('#app-name').onchange=e=>{state.title=e.target.value.trim()||'우리의 초록 약속';e.target.value=state.title;changed();};$('#reflection').onchange=e=>{state.reflection=e.target.value;changed();};
$('#run-file').onchange=safe(async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;acceptRunPhoto(await fileImage(f));});
$('#reuse-test').onclick=safe(async()=>{if(!testImage)throw Error('AI 가르치기 화면에서 먼저 새 사진을 시험해 주세요.');acceptRunPhoto(testImage);tell('AI 가르치기에서 시험한 사진을 그대로 가져왔어요. 시작을 눌러 비교해요.');});
function runResult(r,b){
 const samePhoto=runImage===testImage&&state.testResult?.round===state.round;
 const comparison=samePhoto?(state.testResult.index===r.index?'✓ 같은 사진으로 시험한 AI 결과와 같아요.':'같은 사진인데 AI 결과가 달라졌어요. 선생님과 확인해 주세요.'):'첫 화면과 비교하려면 ‘시험한 사진 가져오기’를 눌러 주세요.';
 const duplicate=state.blocks.filter(x=>x.type==='if').every(x=>x.message.trim()===b.message.trim());
 $('#app-result').innerHTML=`<div class="prediction-label"><small>AI가 고른 종류</small><h2>${escape(state.classes[r.index].name)}</h2></div><div class="rule-response"><small>내 블록의 안내</small><span class="leaf">${b.icon}</span><h2>${escape(b.message)}</h2></div><p class="result-comparison">${comparison}</p>${duplicate?'<p class="result-note">두 종류의 안내 문구가 같아요. 서로 다른 안내를 원하면 블록에서 바꿔 주세요.</p>':''}`;
}
$('#run-start').onclick=safe(async()=>{
 $('#app-result').innerHTML='<p>지금 사진과 블록을 확인해요…</p>';
 const errors=validate();if(errors.length){$('#app-result').textContent=errors[0]+' 블록 화면에서 연결을 살펴보세요.';tell(errors[0]);return;}
 try{
  requireModel();if(!runImage)throw Error('먼저 시험할 사진을 골라 주세요.');busy(true,'내가 만든 명령대로 실행해요…');
  let r;for(const b of state.blocks){if(b.type==='predict')r=await predict(runImage);if(b.type==='if'&&r.index===b.classIndex)runResult(r,b);}record(r,'app');
 }catch(e){$('#app-result').textContent=e.message;throw e;}
});
const dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('little-ai-lab',1);req.onupgradeneeded=()=>req.result.createObjectStore('projects');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
async function dbGet(){const db=await dbPromise;return new Promise((res,rej)=>{const q=db.transaction('projects').objectStore('projects').get('current');q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});}
async function dbPut(value){const db=await dbPromise;return new Promise((res,rej)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(value,'current');tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}
function toBase64(buf){const bytes=new Uint8Array(buf);let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
function fromBase64(s){const bin=atob(s);return Uint8Array.from(bin,c=>c.charCodeAt(0)).buffer;}
async function serializeModel(model){let artifacts;await model.save(tf.io.withSaveHandler(async a=>{artifacts=a;return {modelArtifactsInfo:{dateSaved:new Date(),modelTopologyType:'JSON'}};}));return {topology:artifacts.modelTopology,specs:artifacts.weightSpecs,data:toBase64(artifacts.weightData)};}
function snapshot(){const snap=JSON.parse(JSON.stringify(state));if(modelRecord)snap.model=modelRecord;return snap;}
const checkpoint=new CheckpointQueue(dbPut,snapshot,latest=>{storageFailed=false;if(latest){unsaved=false;$('#save-state').textContent='✓ 자동 저장했어요';}},saveError);
// Never rely on beforeunload to save work on mobile. Require a completed checkpoint before the camera/gallery.
document.addEventListener('click',e=>{const label=e.target.closest?.('label');const input=e.target.matches?.('input[type=file]')?e.target:label?.querySelector('input[type=file]');if(!input||!persistenceReady||(!unsaved&&!storageFailed))return;e.preventDefault();if(storageFailed){tell('저장이 완료되지 않았어요. 먼저 파일로 받아 작품을 보관해 주세요.');return;}busy(true,'사진을 고르기 전에 작품을 저장해요…');flushSave().then(()=>tell('작품을 저장했어요. 사진 버튼을 한 번 더 눌러 주세요.')).catch(()=>{}).finally(()=>busy(false));},true);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&persistenceReady&&unsaved)flushSave().catch(()=>{});});
window.addEventListener('pagehide',()=>{if(persistenceReady&&unsaved)flushSave().catch(()=>{});});
function validateFile(v){if(!v||v.format!=='little-ai-lab'||v.version!==1||!Array.isArray(v.classes)||v.classes.length!==2||typeof v.title!=='string'||v.title.length>30||!Array.isArray(v.blocks)||v.blocks.length>8)throw Error('꼬마 AI 개발 연구소에서 받은 작품 파일을 골라 주세요.');for(const c of v.classes){if(typeof c.name!=='string'||!c.name.trim()||c.name.length>20||!Array.isArray(c.photos)||c.photos.length>30||c.photos.some(p=>typeof p!=='string'||p.length>500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p)))throw Error('작품의 사진이나 종류 이름을 읽을 수 없어요.');}if(v.classes[0].name===v.classes[1].name)throw Error('서로 다른 두 종류 이름이 필요해요.');for(const b of v.blocks){if(!['photo','predict','if'].includes(b.type))throw Error('모르는 블록이 들어 있어요.');if(b.type==='if'&&(![0,1].includes(b.classIndex)||!icons.includes(b.icon)||typeof b.message!=='string'||b.message.length>80))throw Error('조건 블록을 읽을 수 없어요.');}if(!Number.isSafeInteger(v.revision)||v.revision<0||!Number.isSafeInteger(v.trainedRevision)||v.trainedRevision>v.revision||v.trainedRevision< -1||!Number.isSafeInteger(v.round)||v.round<0||typeof v.reflection!=='string'||v.reflection.length>500)throw Error('작품의 배움 기록을 읽을 수 없어요.');if(!Array.isArray(v.history)||v.history.length>100)v.history=[];
for(const field of ['testPhoto','runPhoto']){if(v[field]&&!(typeof v[field]==='string'&&v[field].length<500000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v[field])))delete v[field];}if(!['teach','build','run'].includes(v.view))v.view='teach';if(v.testResult&&(![0,1].includes(v.testResult.index)||!Number.isSafeInteger(v.testResult.round)))v.testResult=null;
if(v.model){const m=v.model,l=m.topology?.config?.layers;if(m.data?.length>1000000||!Array.isArray(l)||l.length!==1||l[0].class_name!=='Dense'||l[0].config.units!==2||l[0].config.activation!=='softmax'||l[0].config.batch_input_shape?.[1]!==256||!Array.isArray(m.specs)||m.specs.length!==2||m.specs.some(s=>s.dtype!=='float32')||JSON.stringify(m.specs.map(s=>s.shape))!==JSON.stringify([[256,2],[2]]))throw Error('지원하지 않는 AI 모델이에요.');if(fromBase64(m.data).byteLength!==2056)throw Error('AI 모델 자료가 손상되었어요.');}
}
async function restore(v){validateFile(v);let next=null;const damaged=!!v.model&&!AIEngine.checkRecord(v.model);if(v.model&&!damaged){await ensureTf();next=await tf.loadLayersModel(tf.io.fromMemory({modelTopology:v.model.topology,weightSpecs:v.model.specs,weightData:fromBase64(v.model.data)}));}classifier?.dispose();classifier=next;modelRecord=damaged?null:(v.model||null);state=JSON.parse(JSON.stringify(v));delete state.model;if(damaged){state.trainedRevision=-1;state.testResult=null;state.trainingCheck=null;state.modelRecoveryNeeded=true;}runImage=state.runPhoto||null;testImage=state.testPhoto||null;$('#app-name').value=state.title;$('#reflection').value=state.reflection;$('#run-image').className='photo-placeholder';$('#run-image').innerHTML='<span>📸</span><h2>어떤 물건일까?</h2><p>사진을 고르고 시작해요.</p>';renderClasses();renderBlocks();renderStatus();$('#test-again').hidden=!testImage;
if(testImage&&state.testResult?.round===state.round&&state.trainedRevision===state.revision){testView(testImage,state.testResult);}else{$('#test-result').className='test-result empty';$('#test-result').textContent=testImage?'시험 사진을 보관했어요. 같은 사진으로 다시 시험해 보세요.':'새 사진을 보여 주면 AI의 생각이 여기에 나와요.';}
if(runImage){$('#run-image').className='';$('#run-image').innerHTML=`<img src="${runImage}" alt="보관한 시험 사진">`;}
$('#app-result').innerHTML='<p>시작 버튼을 눌러 다시 확인해요.</p>';goto(state.view||'teach');}
$('#save').onclick=safe(async()=>{busy(true,'작품을 저장하고 있어요…');checkpoint.mark();await flushSave();unsaved=false;$('#save-state').textContent='✓ 이 기기에 저장했어요';tell('사진·AI·블록을 이 브라우저에 저장했어요. 다음에 열면 이어서 할 수 있어요.');});
$('#export').onclick=safe(async()=>{busy(true,'작품 파일을 만들고 있어요…');const blob=new Blob([JSON.stringify(await snapshot())],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='꼬마AI-내작품.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);tell('수정용 JSON을 받았어요. 연구소의 ‘수정용 열기(JSON)’로 다시 열어 주세요. 친구에게 실행 앱을 주려면 ‘내 앱 실행하기’에서 HTML을 받아 주세요.');});
let exportedURL=null;
$('#export-html').onclick=safe(async()=>{requireModel();const errors=validate();if(errors.length)throw Error(errors.join(' '));busy(true,'AI와 안내를 완성 앱에 담고 있어요…');const result=await HTMLAppExport.prepare(snapshot());if(exportedURL)URL.revokeObjectURL(exportedURL);exportedURL=result.url;const link=$('#download-html');link.href=result.url;link.download=result.filename;$('#download-ready').hidden=false;tell(`완성 앱이 준비됐어요! 약 ${(result.size/1048576).toFixed(1)}MB예요. ‘HTML 파일 저장’을 눌러 받아 주세요.`);});
$('#import').onchange=safe(async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>35000000)throw Error('작품 파일이 너무 커요. 35MB 이하의 파일을 골라 주세요.');if(unsaved&&!confirm('아직 저장하지 않은 내용이 있어요. 파일을 열어 현재 작품을 바꿀까요?'))return;const v=JSON.parse(await file.text());busy(true,'작품을 열고 있어요…');await flushSave();await restore(v);changed();await flushSave();tell(state.modelRecoveryNeeded?'사진과 블록을 열었어요. 저장된 AI의 배움 값에 문제가 있어 다시 가르쳐야 해요.':'사진·AI·블록을 열었어요. 새 사진으로 시험해 보세요.');goto('teach');});
function demoImage(kind,n){const c=document.createElement('canvas');c.width=c.height=224;const g=c.getContext('2d');g.fillStyle=['#f0eee5','#e6efed','#f5e8df','#e9e5f1','#ecefdc'][n%5];g.fillRect(0,0,224,224);g.translate(112+(n%3-1)*10,116+(n%2?6:-6));g.rotate((n%5-2)*.07);g.strokeStyle='#42665d';g.lineWidth=3;if(kind===0){g.fillStyle='#8bc3cb';g.beginPath();g.roundRect(-29,-53,58,123,12);g.fill();g.stroke();g.fillStyle='#4a8c86';g.fillRect(-15,-77,30,23);g.strokeRect(-15,-77,30,23);g.fillStyle='#d7f0d5';g.fillRect(-29,-10,58,40);g.strokeRect(-29,-10,58,40);g.fillStyle='#53987e';g.beginPath();g.ellipse(0,10,7,12,.6,0,7);g.fill();}else{g.fillStyle='#bd9265';g.fillRect(-61,-37,122,100);g.strokeRect(-61,-37,122,100);g.fillStyle='#ddbd90';g.beginPath();g.moveTo(-61,-37);g.lineTo(-26,-65);g.lineTo(60,-65);g.lineTo(61,-37);g.closePath();g.fill();g.stroke();g.fillStyle='#eee0bb';g.fillRect(-8,-37,17,100);g.strokeRect(-8,-37,17,100);g.beginPath();g.moveTo(-8,-37);g.lineTo(12,-65);g.lineTo(28,-65);g.lineTo(9,-37);g.fill();}return c.toDataURL('image/jpeg',.86);}
$('#demo').onclick=()=>{if(state.classes.some(c=>c.photos.length)||classifier)return tell('현재 사진이 있어요. 연습하려면 파일로 보관한 뒤 새 작품을 시작해 주세요.');state.classes=[{name:'물병 그림',photos:Array.from({length:6},(_,i)=>demoImage(0,i))},{name:'상자 그림',photos:Array.from({length:6},(_,i)=>demoImage(1,i))}];changed(true);renderClasses();renderBlocks();tell('선생님용 연습 그림을 넣었어요. ‘AI 가르치기’를 눌러 실제로 학습시켜 보세요.');goto('teach');};
$('#demo-test').onclick=safe(async()=>{requireModel();busy(true,'새 연습 그림으로 시험해요…');const kind=demoIndex++%2;testImage=demoImage(kind,11+demoIndex);const r=await predict(testImage);testView(testImage,r);acceptRunPhoto(testImage);record(r,'demo');tell(`새 ${kind?'상자':'물병'} 연습 그림을 시험했어요. 이 그림은 ‘내 앱 실행하기’에서도 사용할 수 있어요.`);goto('teach');});
$('#reset').onclick=safe(async()=>{if(!confirm('현재 작품과 이 기기의 저장 작품을 지우고 새로 시작할까요? 필요한 작품은 먼저 파일로 받아 주세요.'))return;busy(true,'새 작품을 준비해요…');await flushSave();await restore(fresh());changed();await flushSave();unsaved=false;$('#save-state').textContent='새 작품을 시작했어요';tell('새 작품을 준비했어요. 두 종류 이름부터 정해 보세요.');goto('teach');});
window.addEventListener('beforeunload',e=>{if(unsaved){e.preventDefault();e.returnValue='';}});
async function init(){renderClasses();renderBlocks();renderStatus();busy(true,'저장한 작품이 있는지 살펴봐요…');try{const saved=await dbGet();if(saved){await restore(saved);unsaved=false;$('#save-state').textContent='✓ 저장한 작품을 열었어요';tell(state.modelRecoveryNeeded?'저장된 AI의 배움 값에 문제가 있어요. 사진과 블록은 그대로 보관했어요. ‘AI 가르치기’를 눌러 다시 배워요.':'지난 작품을 열었어요. 새 사진으로 이어서 시험해 보세요.');}}catch(e){console.error(e);tell('저장 작품을 자동으로 열지 못했어요. 파일로 보관한 작품이 있으면 열어 주세요.');}finally{persistenceReady=true;busy(false);}}
init();
})();
