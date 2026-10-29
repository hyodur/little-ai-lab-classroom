/* Generate the HTTPS player shell from the same UI used by exported apps.
   Only placeholder data is used here. No student files belong in docs/. */
const fs=require('node:fs'),path=require('node:path');
const Export=require('../docs/export-html.js');
function build(){
 const project={title:'완성 앱 실행하기',revision:0,trainedRevision:0,model:{},classes:[{name:'',photos:[]},{name:'',photos:[]}],blocks:[{type:'photo'},{type:'predict'},{type:'if',classIndex:0,icon:'',message:'안내'},{type:'if',classIndex:1,icon:'',message:'안내'}]};
 let html=Export.build(project,{base:{},tf:'',engine:'',camera:'',player:'',license:fs.readFileSync(path.join(__dirname,'../docs/vendor/LICENSE-Apache-2.0.txt'),'utf8')});
 html=html.replace('<html lang="ko">','<html lang="ko" data-web-player="true" translate="no">')
  .replace('<head>','<head><meta name="google" content="notranslate">')
  .replace("script-src 'unsafe-inline' 'unsafe-eval'","script-src 'self' 'unsafe-eval'")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'')
  .replace('<main>','<main id="player-main" hidden>')
  .replace('<body>','<body><main id="open-app-panel"><header><div class="eyebrow">꼬마 AI 개발 연구소 · v0.6.2</div><h1>완성 앱을 열어요</h1><p>친구가 만든 앱으로 바로 찍고 시험해요.</p></header><section class="card"><div class="symbol" aria-hidden="true">📂</div><h2>받아 둔 HTML 파일을 골라요</h2><p>카카오톡에서 받은 파일은 먼저 다운로드해 주세요.</p><button id="open-app">완성 앱 HTML 고르기</button><input id="app-file" type="file" accept=".html,.htm,text/html" hidden><p id="open-status" role="status" aria-live="polite">파일을 고르면 촬영과 시험 화면이 열려요.</p><p class="small">작품과 시험 사진은 이 기기에서만 읽어요. 서버에 업로드하지 않아요. 다시 학습할 필요도 없어요.</p></section><p class="small">카메라 사용 안내가 나오면 허용해 주세요.</p><p><a href="./">← 개발 연구소로</a></p></main>')
  .replace('<div id="camera-fallback" hidden>','<div id="camera-fallback" hidden><p class="small">주소창의 사이트 설정과 휴대폰 설정에서 이 브라우저의 카메라 권한을 확인해 주세요. 당장 촬영이 어렵다면 휴대폰 기본 카메라에서 따로 찍어 저장한 다음 ‘갤러리에서 고르기’를 이용해요.</p><div hidden>')
  .replace('<p id="status"','</div><p id="status"')
  .replace('</main><dialog','<p><a href="play.html">다른 완성 앱 열기</a> · <a href="./">개발 연구소로</a></p></main><dialog')
  .replace('</body>','<script type="application/json" id="app-data"></script><script defer src="vendor/tf.min.js"></script><script defer src="engine.js?v=60"></script><script defer src="camera.js?v=3"></script><script defer src="player-import.js?v=62"></script><script defer src="player-open.js?v=62"></script></body>');
 return html;
}
if(require.main===module)fs.writeFileSync(path.join(__dirname,'../docs/play.html'),build());
module.exports=build;
