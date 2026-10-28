const assert=require('node:assert/strict');
const Camera=require('../docs/camera.js');
(async()=>{
 let stopped=0,requests=0,constraints,draw;
 const stream=()=>({getTracks:()=>[{stop(){stopped++;}}]});
 const video={videoWidth:640,videoHeight:480,readyState:2,pause(){},async play(){}};
 const c=new Camera(video,async x=>{requests++;constraints=x;return stream();},()=>({getContext:()=>({drawImage(...a){draw=a;}}),toDataURL:()=> 'data:image/jpeg;base64,AQ=='}));
 assert.equal(await c.open(),true);assert.equal(constraints.audio,false);assert.equal(constraints.video.facingMode.ideal,'environment');
 assert.equal(c.capture(),'data:image/jpeg;base64,AQ==');c.capture();assert.equal(requests,1);assert.deepEqual(draw.slice(1),[0,0,320,240]);
 c.stop();assert.equal(stopped,1);assert.equal(video.srcObject,null);assert.throws(()=>c.capture());
 let release;const pending=new Camera(video,()=>new Promise(r=>release=r));const open=pending.open();pending.stop();release(stream());assert.equal(await open,false);assert.equal(stopped,2);assert.equal(video.srcObject,null);
 const denied=new Camera(video,async()=>{throw Object.assign(Error('denied'),{name:'NotAllowedError'});});await assert.rejects(denied.open(),{name:'NotAllowedError'});assert.equal(denied.stream,null);
 await c.open();video.readyState=0;assert.throws(()=>c.capture(),/카메라 화면/);c.stop();
 let playback;const slowVideo={...video,play:()=>new Promise(r=>playback=r)};const slow=new Camera(slowVideo,async()=>stream());const opening=slow.open();await Promise.resolve();slow.stop();playback();assert.equal(await opening,false);assert.equal(slowVideo.srcObject,null);
 console.log('PASS: rear camera/no audio, repeated low-resolution capture without reopening, no empty frame, stream cleanup, cancel during permission and playback, permission denial.');
})().catch(e=>{console.error(e);process.exitCode=1;});
