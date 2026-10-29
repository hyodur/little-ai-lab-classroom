/* File bytes stay in this tab. No upload, iframe, or imported executable code. */
(() => {
'use strict';
const $=s=>document.querySelector(s),input=$('#app-file'),button=$('#open-app'),message=$('#open-status');
button.onclick=()=>input.click();
input.onchange=async()=>{
 const file=input.files[0];if(!file||button.disabled)return;
 button.disabled=true;message.textContent='완성 앱을 읽고 있어요…';
 try{
  if(file.size>16000000)throw Error('완성 앱 HTML 파일은 16MB 이내로 골라 주세요.');
  const packet=PlayerImport.parse(await file.text());
  if(!AIEngine.checkRecord(packet.model))throw Error('학습한 AI의 값이 손상됐어요. 연구소에서 완성 앱을 다시 받아 주세요.');
  $('#app-data').textContent=JSON.stringify(packet);
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='player.js?v=62';script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('실행 파일을 받지 못했어요. 인터넷 연결을 확인하고 다시 골라 주세요.'));};document.body.append(script);});
  $('#open-app-panel').hidden=true;$('#player-main').hidden=false;
 }catch(e){message.textContent=e.message||'파일을 읽지 못했어요. 완성 앱 HTML을 다시 골라 주세요.';button.disabled=false;}
 finally{input.value='';}
};
})();
