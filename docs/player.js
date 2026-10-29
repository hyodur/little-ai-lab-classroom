/* Runs inside the exported HTML. All models and scripts are embedded. */
(() => {
'use strict';
const $=s=>document.querySelector(s), packet=JSON.parse($('#app-data').textContent);
let engine=null,head=null,loading=null,photo=null,working=false;
const status=s=>{$('#status').textContent=s;};
const clear=()=>{$('#answer').hidden=true;$('#class-name').textContent='';$('#message').textContent='';$('#icon').textContent='';};
const lock=on=>{working=on;$('#start').disabled=on||!photo;$('#choose').disabled=on;$('#camera-open').disabled=on;$('#native-open').disabled=on;};
function decode(s){const raw=atob(s),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes.buffer;}
function source(m){return tf.io.fromMemory({modelTopology:m.topology,weightSpecs:m.specs,weightData:decode(m.data)});}
async function models(){
 if(engine&&head)return;if(loading)return loading;
 loading=(async()=>{
  if(typeof tf==='undefined'||typeof AIEngine==='undefined')throw Error('AI를 준비하지 못했어요. 파일을 다시 받아 브라우저로 열어 주세요.');
  if(tf.getBackend()!=='cpu')await tf.setBackend('cpu');await tf.ready();
  if(!AIEngine.checkRecord(packet.model))throw Error('저장된 AI의 배움 값에 문제가 있어요. 연구소에서 다시 가르치고 완성 앱을 받아 주세요.');let nextEngine=null,nextHead=null;
  try{nextEngine=await new AIEngine().load(source(packet.base));nextHead=await tf.loadLayersModel(source(packet.model));engine=nextEngine;head=nextHead;}
  catch(e){nextEngine?.features?.dispose();nextHead?.dispose();throw e;}
 })();try{await loading;}finally{loading=null;}
}
async function image(src){const im=new Image();im.src=src;await im.decode();return im;}
async function smallPhoto(file){
 if(file.size>20000000)throw Error('사진은 20MB보다 작아야 해요.');if(!file.type.startsWith('image/'))throw Error('사진 파일을 골라 주세요.');
 let im=null,url=null,canvas=null;
 try{
  if(typeof createImageBitmap==='function'){try{im=await createImageBitmap(file,{resizeWidth:320,resizeQuality:'medium'});}catch{}}
  if(!im){url=URL.createObjectURL(file);im=await image(url);}
  canvas=document.createElement('canvas');const r=Math.min(320/im.width,320/im.height,1);canvas.width=Math.max(1,Math.round(im.width*r));canvas.height=Math.max(1,Math.round(im.height*r));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(im,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.86);
 }finally{im?.close?.();if(im instanceof HTMLImageElement)im.src='';if(url)URL.revokeObjectURL(url);if(canvas){canvas.width=1;canvas.height=1;}}
}
function accept(src){photo=src;$('#preview').src=src;$('#preview').hidden=false;$('#placeholder').hidden=true;clear();$('#start').disabled=false;status('사진을 골랐어요. 시작을 눌러 주세요.');}
$('#choose').onclick=()=>{if(!working)$('#photo').click();};
$('#photo').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file||working)return;lock(true);clear();status('사진을 준비하고 있어요…');try{accept(await smallPhoto(file));}catch(e){status(e.message||'사진을 열지 못했어요. JPG나 PNG 사진을 골라 주세요.');}finally{lock(false);}};
$('#native-photo').onchange=$('#photo').onchange;
$('#native-open').onclick=()=>{if(!working)$('#native-photo').click();};
const camera=new InlineCamera($('#camera-video')),dialog=$('#camera-dialog');
let cameraTurn=0;
function closeCamera(){cameraTurn++;camera.stop();$('#camera-capture').disabled=true;if(dialog.open)dialog.close();}
function cameraHelp(error){
 if(error?.name==='NotAllowedError'||error?.name==='SecurityError')return '카메라를 열 수 없어요. 브라우저의 카메라 권한을 확인하거나, 아래 ‘카메라 앱으로 찍기’를 눌러 주세요.';
 if(error?.name==='NotFoundError')return '사용할 카메라를 찾지 못했어요. 사진을 골라 시험할 수 있어요.';
 return '이 화면에서는 카메라를 열지 못했어요. 아래 ‘카메라 앱으로 찍기’를 눌러 보거나, Chrome·삼성 인터넷에서 파일을 다시 열어 주세요.';
}
$('#camera-open').onclick=async()=>{
 if(working)return;
 if(!navigator.mediaDevices?.getUserMedia||typeof dialog.showModal!=='function'){status(cameraHelp());$('#camera-fallback').hidden=false;return;}
 const turn=++cameraTurn;lock(true);$('#camera-capture').disabled=true;$('#camera-status').textContent='카메라 사용을 허용하고, 화면이 보일 때까지 기다려 주세요.';
 try{dialog.showModal();if(await camera.open()&&turn===cameraTurn&&dialog.open){$('#camera-capture').disabled=false;$('#camera-status').textContent='물건을 화면에 맞추고 ‘찍어서 사용’을 눌러요.';}}
 catch(e){if(turn===cameraTurn){closeCamera();status(cameraHelp(e));$('#camera-fallback').hidden=false;}}
 finally{if(!dialog.open)lock(false);}
};
$('#camera-capture').onclick=()=>{try{const src=camera.capture();closeCamera();accept(src);status('사진을 찍었어요. 시작을 눌러 주세요.');}catch(e){$('#camera-status').textContent=e.message||'화면이 보이면 다시 찍어 주세요.';}};
$('#camera-close').onclick=closeCamera;
dialog.oncancel=e=>{e.preventDefault();closeCamera();};
dialog.onclose=()=>{if(dialog.open)return;cameraTurn++;camera.stop();lock(false);};
document.addEventListener('visibilitychange',()=>{if(document.hidden)closeCamera();});
window.addEventListener('pagehide',closeCamera);
$('#start').onclick=async()=>{
 if(working||!photo)return;lock(true);clear();status('AI가 사진을 살펴봐요. 처음에는 잠시 기다려 주세요.');let x=null,out=null,im=null;
 try{
  await models();im=await image(photo);x=engine.embed(im);out=head.predict(x);const p=Array.from(await out.data());
  const index=AIEngine.checkScores(p),rule=packet.blocks.find(b=>b.type==='if'&&b.classIndex===index);if(!rule)throw Error('이 결과에 연결된 안내가 없어요. 만든 친구와 블록을 확인해 주세요.');
  $('#class-name').textContent=packet.classes[index].name;$('#icon').textContent=rule.icon;$('#message').textContent=rule.message;$('#answer').hidden=false;status('AI의 생각이 내 생각과 같나요? 다른 사진도 시험해 봐요.');
 }catch(e){clear();status(e.message||'AI를 실행하지 못했어요. 브라우저에서 다시 열어 주세요.');}
 finally{x?.dispose();out?.dispose();if(im)im.src='';lock(false);}
};
$('#app-title').textContent=packet.title;document.title=packet.title;$('#learned').textContent=packet.classes.map(c=>c.name+' '+c.count+'장').join(' · ');
status('사진을 넣고 친구가 만든 AI를 시험해 봐요.');
})();
