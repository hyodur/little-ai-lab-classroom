/* Camera stays in this page; never launches a native file capture picker. */
(function(root){
'use strict';
class InlineCamera {
 constructor(video, getMedia, makeCanvas){this.video=video;this.getMedia=getMedia||((c)=>navigator.mediaDevices.getUserMedia(c));this.makeCanvas=makeCanvas||(()=>document.createElement('canvas'));this.generation=0;this.stream=null;}
 async open(){
  this.stop();const generation=this.generation;
  const stream=await this.getMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:640},height:{ideal:480},frameRate:{ideal:15,max:24}}});
  if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return false;}
  this.stream=stream;this.video.srcObject=stream;this.video.muted=true;this.video.playsInline=true;
  try{await this.video.play();}catch(e){if(generation===this.generation)this.stop();throw e;}
  return generation===this.generation;
 }
 capture(){
  const v=this.video;if(!this.stream||!v.videoWidth||!v.videoHeight||v.readyState<2)throw Error('카메라 화면이 보이면 다시 눌러 주세요.');
  const c=this.makeCanvas(),r=Math.min(320/v.videoWidth,320/v.videoHeight,1);
  try{c.width=Math.max(1,Math.round(v.videoWidth*r));c.height=Math.max(1,Math.round(v.videoHeight*r));c.getContext('2d').drawImage(v,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.86);}
  finally{c.width=1;c.height=1;}
 }
 stop(){this.generation++;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.pause();this.video.srcObject=null;}
}
if(typeof module==='object'&&module.exports)module.exports=InlineCamera;else root.InlineCamera=InlineCamera;
})(typeof globalThis!=='undefined'?globalThis:this);
