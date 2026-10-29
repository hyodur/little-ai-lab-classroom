/* Read only our JSON packet. Never execute HTML or scripts from a chosen file. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PlayerImport=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
function parse(html){
 if(typeof html!=='string'||html.length>16000000)throw Error('완성 앱 HTML 파일은 16MB 이내로 골라 주세요.');
 const packets=[];
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  if(/\bid\s*=\s*(["'])app-data\1/i.test(match[1])&&/\btype\s*=\s*(["'])application\/json\1/i.test(match[1]))packets.push(match[2]);
 }
 if(packets.length!==1)throw Error('연구소에서 받은 ‘완성 앱(HTML)’을 골라 주세요. 수정용 JSON은 연구소에서 열어요.');
 let p;try{p=JSON.parse(packets[0]);}catch{throw Error('완성 앱의 내용을 읽지 못했어요. 파일을 다시 받아 주세요.');}
 const text=(v,max)=>typeof v==='string'&&v.length<=max;
 const record=m=>m&&typeof m.topology==='object'&&m.topology!==null&&Array.isArray(m.specs)&&m.specs.length>0&&typeof m.data==='string'&&m.data.length>0&&/^[A-Za-z0-9+/]*={0,2}$/.test(m.data);
 if(!p||p.format!=='little-ai-lab-player'||p.version!==1||!text(p.title,500)||!Array.isArray(p.classes)||p.classes.length!==2||p.classes.some(c=>!c||!text(c.name,500)||!Number.isSafeInteger(c.count)||c.count<0)||!record(p.model)||!record(p.base))throw Error('이 파일의 AI 정보를 읽지 못했어요. 연구소에서 완성 앱을 다시 받아 주세요.');
 const b=p.blocks;
 if(!Array.isArray(b)||b.length!==4||b[0]?.type!=='photo'||b[1]?.type!=='predict'||b.slice(2).some(v=>!v||v.type!=='if'||![0,1].includes(v.classIndex)||!text(v.message,5000)||!v.message.trim()||!text(v.icon,100))||new Set(b.slice(2).map(v=>v.classIndex)).size!==2)throw Error('완성 앱의 안내 블록을 읽지 못했어요.');
 return {format:p.format,version:p.version,title:p.title,classes:p.classes.map(c=>({name:c.name,count:c.count})),blocks:b.map(v=>v.type==='if'?{type:v.type,classIndex:v.classIndex,icon:v.icon,message:v.message}:{type:v.type}),model:p.model,base:p.base};
}
return {parse};
});
