/* The URL fragment carries only the small trained head and rules, never photos.
   Fragments are handled by the browser, not sent in HTTP requests.
   The base signature is a compatibility check, not a security hash. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PlayerTransfer=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
function signature(base){let n=2166136261;const s=JSON.stringify(base);for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619);return (n>>>0).toString(16);}
function encode(p){
 const data={format:p.format,version:p.version,title:p.title,classes:p.classes,blocks:p.blocks,model:p.model,baseKey:signature(p.base)};
 const fragment='#camera='+encodeURIComponent(JSON.stringify(data));
 if(fragment.length>64000)throw Error('안내가 길어 자동으로 열지 못했어요. 웹 실행 화면에서 HTML 파일을 골라 주세요.');
 return fragment;
}
function decode(hash){
 if(!hash.startsWith('#camera=')||hash.length>64000)throw Error('자동 실행 정보를 읽지 못했어요. 완성 앱 HTML을 골라 주세요.');
 let p;try{p=JSON.parse(decodeURIComponent(hash.slice(8)));}catch{throw Error('자동 실행 정보가 끊겼어요. 완성 앱 HTML을 골라 주세요.');}
 if(!p||typeof p.baseKey!=='string'||!/^[a-f0-9]{1,8}$/.test(p.baseKey)||p.base)throw Error('자동 실행 정보를 확인할 수 없어요. 완성 앱 HTML을 골라 주세요.');
 return p;
}
return {signature,encode,decode};
});
