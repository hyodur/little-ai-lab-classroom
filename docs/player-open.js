/* File bytes stay in this tab. Imported HTML is never executed.
   Automatic launch reads a small URL fragment, clears it, and downloads only
   our fixed public feature model. Student data is never sent to the server. */
(() => {
'use strict';
const $=s=>document.querySelector(s),input=$('#app-file'),button=$('#open-app'),message=$('#open-status');
button.onclick=()=>input.click();
function failure(e){message.textContent=e.message||'파일을 읽지 못했어요. 완성 앱 HTML을 다시 골라 주세요.';button.disabled=false;}
async function start(packet,autoCamera=false){
 if(!AIEngine.checkRecord(packet.model))throw Error('학습한 AI의 값이 손상됐어요. 연구소에서 완성 앱을 다시 받아 주세요.');
 $('#app-data').textContent=JSON.stringify(packet);
 await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='player.js?v=63';script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('실행 파일을 받지 못했어요. 인터넷 연결을 확인하고 다시 골라 주세요.'));};document.body.append(script);});
 $('#open-app-panel').hidden=true;$('#player-main').hidden=false;
 if(autoCamera)$('#camera-open').click();
}
input.onchange=async()=>{
 const file=input.files[0];if(!file||button.disabled)return;
 button.disabled=true;message.textContent='완성 앱을 읽고 있어요…';
 try{
  if(file.size>16000000)throw Error('완성 앱 HTML 파일은 16MB 이내로 골라 주세요.');
  await start(PlayerImport.parse(await file.text()));
 }catch(e){failure(e);}
 finally{input.value='';}
};
async function publicBase(){
 const [modelResponse,weightsResponse]=await Promise.all([fetch('model/model.json'),fetch('model/weights.bin')]);
 if(!modelResponse.ok||!weightsResponse.ok)throw Error('촬영 화면 준비에 인터넷 연결이 필요해요. 연결 후 원래 파일에서 다시 눌러 주세요.');
 const model=await modelResponse.json(),bytes=new Uint8Array(await weightsResponse.arrayBuffer());
 if(model.weightsManifest.length!==1||model.weightsManifest[0].paths.length!==1||model.weightsManifest[0].paths[0]!=='weights.bin')throw Error('AI 버전이 달라요. 아래에서 완성 앱 HTML을 골라 주세요.');
 let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return {topology:model.modelTopology,specs:model.weightsManifest.flatMap(g=>g.weights),data:btoa(raw)};
}
if(typeof location!=='undefined'&&location.hash.startsWith('#camera=')){
 const hash=location.hash;
 history.replaceState(null,'',location.pathname+location.search);
 button.disabled=true;message.textContent='작품을 이어서 열고 카메라를 준비하고 있어요…';
 (async()=>{
  const compact=PlayerTransfer.decode(hash),packet=PlayerImport.validate(compact,false);
  if(!AIEngine.checkRecord(packet.model))throw Error('학습한 AI의 값을 읽지 못했어요. 완성 앱 HTML을 골라 주세요.');
  const base=await publicBase();
  if(PlayerTransfer.signature(base)!==compact.baseKey)throw Error('AI 버전이 달라 자동으로 열지 못했어요. 완성 앱 HTML을 골라 주세요.');
  await start({...packet,base},true);
 })().catch(failure);
}
})();
