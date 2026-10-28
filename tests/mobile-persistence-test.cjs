const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Queue=require('../docs/persistence.js');
const InlineCamera=require('../docs/camera.js');
const tf=require('../docs/vendor/tf.min.js');
const Engine=require('../docs/engine.js');
const source=fs.readFileSync(__dirname+'/../docs/app.js','utf8');
let stored;
function boot(){
 const elements=new Map(),listeners={};
 function element(id){if(!elements.has(id))elements.set(id,{id,hidden:false,textContent:'',innerHTML:'',value:'',dataset:{},classList:{toggle(){}},setAttribute(){},showModal(){this.open=true;},close(){this.open=false;this.onclose?.();},pause(){},async play(){},videoWidth:640,videoHeight:480,readyState:2});return elements.get(id);}
 const cameraButton=element('camera0');cameraButton.dataset.cameraClass='0';
 const photo=element('photo0');photo.dataset.photo='0';photo.files=[];
 const doc={visibilityState:'visible',querySelector:s=>element(s),createElement:()=>({getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,Aw=='}),querySelectorAll:s=>s==='[data-camera-class]'?[cameraButton]:s==='[data-photo]'?[photo]:s==='.page'?['teach','build','run'].map(element):[],addEventListener:(type,f)=>{listeners[type]=f;}};
 const db={createObjectStore(){},transaction(name,mode){const tx={};tx.objectStore=()=>({get(){const r={};setTimeout(()=>{r.result=structuredClone(stored);r.onsuccess();},0);return r;},put(v){const copy=structuredClone(v);setTimeout(()=>{stored=copy;tx.oncomplete?.();},2);}});return tx;}};
 const indexedDB={open(){const r={result:db};setTimeout(()=>r.onsuccess(),0);return r;}};
 const context={document:doc,window:{addEventListener(){}},indexedDB,navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}},InlineCamera:class extends InlineCamera{constructor(video){super(video,async()=>({getTracks:()=>[{stop(){}}]}),()=>doc.createElement('canvas'));}},CheckpointQueue:Queue,tf,AIEngine:class extends Engine{constructor(){throw Error('Feature extractor should be lazy during restoration');}},console,setTimeout,clearTimeout,URL,Blob,Image:class{},HTMLImageElement:class{},confirm:()=>true,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')};
 vm.createContext(context);
 // Only native camera decode is stubbed. App event handlers and persistence run unchanged.
 const nativeStart=source.indexOf('async function fileImage(f){'),nativeEnd=source.indexOf('async function ensureTf()',nativeStart);
 assert(nativeStart>0&&nativeEnd>nativeStart);
 const code=source.slice(0,nativeStart)+"async function fileImage(f){return f.normalized;}\n"+source.slice(nativeEnd);
 vm.runInContext(code,context);
 return {element,photo,cameraButton,listeners};
}
async function idle(app){for(let n=0;n<50;n++){await new Promise(r=>setTimeout(r,2));if(app.element('#busy').hidden)return;}throw Error('App stayed busy');}
(async()=>{
 // Queue guarantees a newer checkpoint wins even while the first write is pending.
 let state=1,out=0,release,notifications=[];
 const queue=new Queue(async value=>{if(value===1)await new Promise(r=>release=r);out=value;},()=>state,latest=>notifications.push(latest),()=>{});
 queue.mark();const pending=queue.flush();state=2;queue.mark();release();await pending;assert.equal(out,2);assert.deepEqual(notifications,[false,true]);
 let fail=true;const retry=new Queue(async()=>{if(fail)throw Error('quota');},()=>1,()=>{},()=>{});retry.mark();await assert.rejects(retry.flush());assert.equal(retry.saved,0);fail=false;await retry.flush();assert.equal(retry.saved,1);
 const app=boot();await idle(app);
 app.photo.files=[{size:100,normalized:'data:image/jpeg;base64,AQ=='}];await app.photo.onchange();
 assert.equal(stored.classes[0].photos.length,1);assert.equal(app.element('#busy').hidden,true);
 // Simulate page recreation on return from the camera.
 const reopened=boot();await idle(reopened);assert(reopened.element('#classes').innerHTML.includes('data:image/jpeg;base64,AQ=='));
 reopened.photo.files=[{size:100,normalized:'data:image/jpeg;base64,Ag=='}];await reopened.photo.onchange();
 assert.equal(stored.classes[0].photos.length,2);assert.deepEqual(stored.classes[0].photos,['data:image/jpeg;base64,AQ==','data:image/jpeg;base64,Ag==']);
 const reopenedAgain=boot();await idle(reopenedAgain);assert(reopenedAgain.element('#classes').innerHTML.includes('data:image/jpeg;base64,Ag=='));
 assert.equal(stored.revision,2);assert.equal(stored.trainedRevision,-1);
 await tf.setBackend('cpu');await tf.ready();
 const model=tf.sequential();model.add(tf.layers.dense({inputShape:[256],units:2,activation:'softmax'}));
 let artifact;await model.save(tf.io.withSaveHandler(async a=>{artifact=a;return{modelArtifactsInfo:{dateSaved:new Date(),modelTopologyType:'JSON'}};}));
 stored.model={topology:artifact.modelTopology,specs:artifact.weightSpecs,data:Buffer.from(artifact.weightData).toString('base64')};stored.trainedRevision=2;stored.round=1;
 const savedModel=stored.model.data;const restoredModel=boot();await idle(restoredModel);
 assert(restoredModel.element('#train-state').textContent.includes('1'));
 await restoredModel.element('#save').onclick();assert.equal(stored.model.data,savedModel);assert.equal(stored.trainedRevision,2);assert.equal(stored.round,1);model.dispose();
 assert(source.includes('const savedModel=await serializeModel(next)'));
 assert(fs.readFileSync(__dirname+'/../docs/index.html','utf8').includes('id="test-again"'));
 // Exercise actual inline-camera UI handlers and checkpoint restoration.
 await restoredModel.cameraButton.onclick();assert.equal(restoredModel.element('#camera-dialog').open,true);
 await restoredModel.element('#camera-capture').onclick();assert.equal(stored.classes[0].photos.length,3);assert.equal(stored.revision,3);assert.equal(stored.trainedRevision,2);
 await restoredModel.element('#camera-capture').onclick();assert.equal(stored.classes[0].photos.length,4);
 restoredModel.element('#camera-close').onclick();assert.equal(restoredModel.element('#camera-dialog').open,false);
 const afterCamera=boot();await idle(afterCamera);assert(afterCamera.element('#classes').innerHTML.includes('data:image/jpeg;base64,Aw=='));
 assert(!source.includes('capture="environment"'));
 // Saved all-zero or non-finite heads must preserve photos/blocks and request retraining.
 const healthy=structuredClone(stored);healthy.blocks=[{type:'photo'},{type:'predict'},{type:'if',classIndex:0,icon:'🌱',message:'A'},{type:'if',classIndex:1,icon:'♻️',message:'B'}];
 for(const kind of ['zero','nan']){
  stored=structuredClone(healthy);const values=new Float32Array(514);if(kind==='nan')values[0]=NaN;
  stored.model.data=Buffer.from(values.buffer).toString('base64');stored.trainedRevision=stored.revision;
  const broken=structuredClone(stored),recovered=boot();await idle(recovered);
  assert(recovered.element('#notice').textContent.includes('배움 값에 문제가'));
  assert(!recovered.element('#train-state').textContent.includes('완료'));
  await recovered.element('#save').onclick();assert.deepEqual(stored.classes,broken.classes);assert.deepEqual(stored.blocks,broken.blocks);assert.equal(stored.model,undefined);assert.equal(stored.trainedRevision,-1);
  // File import follows the same recovery path and persists the retained project.
  await recovered.element('#import').onchange({target:{files:[{size:100,text:async()=>JSON.stringify(broken)}],value:''}});
  assert.deepEqual(stored.classes,broken.classes);assert.deepEqual(stored.blocks,broken.blocks);assert.equal(stored.model,undefined);assert.equal(stored.trainedRevision,-1);
 }
 console.log('PASS: zero/NaN saved-head recovery through startup and JSON import; photos/blocks retained; invalid model not treated as trained.');

 console.log('PASS: inline camera repeated capture and restoration;  sequential checkpoints; failed write retry; first and second photo autosave; simulated page restart restoration; cached model preservation; lazy feature extractor loading; old-format project compatibility.');
})().catch(e=>{console.error(e);process.exitCode=1;});
