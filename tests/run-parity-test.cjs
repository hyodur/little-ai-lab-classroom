const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Queue=require('../docs/persistence.js');
const InlineCamera=require('../docs/camera.js');
const tf=require('../docs/vendor/tf.min.js');
const source=fs.readFileSync(__dirname+'/../docs/app.js','utf8');
let stored,invalidScores=false;
function boot(){
 const elements=new Map(),listeners={};
 function element(id){if(!elements.has(id))elements.set(id,{id,hidden:false,textContent:'',innerHTML:'',value:'',dataset:{},classList:{toggle(){}},setAttribute(){},showModal(){this.open=true;},close(){this.open=false;this.onclose?.();},pause(){},async play(){},videoWidth:640,videoHeight:480,readyState:2});return elements.get(id);}
 const cameraButton=element('camera0');cameraButton.dataset.cameraClass='0';
 const photo=element('photo0');photo.dataset.photo='0';photo.files=[];
 const doc={visibilityState:'visible',querySelector:s=>element(s),createElement:()=>({getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,Aw=='}),querySelectorAll:s=>s==='[data-camera-class]'?[cameraButton]:s==='[data-photo]'?[photo]:s==='.page'?['teach','build','run'].map(element):[],addEventListener:(type,f)=>{listeners[type]=f;}};
 const db={createObjectStore(){},transaction(name,mode){const tx={};tx.objectStore=()=>({get(){const r={};setTimeout(()=>{r.result=structuredClone(stored);r.onsuccess();},0);return r;},put(v){const copy=structuredClone(v);setTimeout(()=>{stored=copy;tx.oncomplete?.();},2);}});return tx;}};
 const indexedDB={open(){const r={result:db};setTimeout(()=>r.onsuccess(),0);return r;}};
 const context={document:doc,window:{addEventListener(){}},indexedDB,navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}},InlineCamera:class extends InlineCamera{constructor(video){super(video,async()=>({getTracks:()=>[{stop(){}}]}),()=>doc.createElement('canvas'));}},CheckpointQueue:Queue,tf,AIEngine:class extends Engine{async load(){return this;}embed(image){if(invalidScores)return tf.tensor2d([Array(256).fill(NaN)]);return feature(image.src);}},console,setTimeout,clearTimeout,URL,Blob,location:{href:'https://test.example/'},Image:class{async decode(){}},HTMLImageElement:class{},confirm:()=>true,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')};
 vm.createContext(context);
 // Only native camera decode is stubbed. App event handlers and persistence run unchanged.
 const nativeStart=source.indexOf('async function fileImage(f){'),nativeEnd=source.indexOf('async function ensureTf()',nativeStart);
 assert(nativeStart>0&&nativeEnd>nativeStart);
 const code=source.slice(0,nativeStart)+"async function fileImage(f){return f.normalized;}\n"+source.slice(nativeEnd);
 vm.runInContext(code,context);
 return {element,photo,cameraButton,listeners};
}
async function idle(app){for(let n=0;n<50;n++){await new Promise(r=>setTimeout(r,2));if(app.element('#busy').hidden)return;}throw Error('App stayed busy');}

const Engine=require('../docs/engine.js');
const photos=['data:image/jpeg;base64,AQ==','data:image/jpeg;base64,Ag=='];
function feature(src){const v=Array(256).fill(0);v[photos.indexOf(src)]=1;return tf.tensor2d([v]);}
(async()=>{
 await tf.setBackend('cpu');await tf.ready();
 const engine=new Engine();const xs=tf.concat([feature(photos[0]),feature(photos[1])]),ys=tf.tensor2d([[1,0],[0,1]]);
 const head=await engine.train(xs,ys);let a;await head.save(tf.io.withSaveHandler(async v=>{a=v;return{modelArtifactsInfo:{dateSaved:new Date(),modelTopologyType:'JSON'}};}));
 const blocks=[{type:'photo'},{type:'predict'},{type:'if',classIndex:0,icon:'🌱',message:'A 안내'},{type:'if',classIndex:1,icon:'♻️',message:'B 안내'}];
 stored={format:'little-ai-lab',version:1,title:'검사',classes:[{name:'A',photos:[]},{name:'B',photos:[]}],blocks,revision:0,trainedRevision:0,round:1,reflection:'',history:[],model:{topology:a.modelTopology,specs:a.weightSpecs,data:Buffer.from(a.weightData).toString('base64')}};
 const app=boot();await idle(app);
 async function pick(selector,src){await app.element(selector).onchange({target:{files:[{normalized:src}],value:''}});}
 for(const i of [0,1,0,1]){
  await pick('#test-file',photos[i]);const test=stored.history.at(-1);assert.equal(test.prediction,i);
  await app.element('#reuse-test').onclick();assert.equal(stored.runPhoto,photos[i]);
  await app.element('#run-start').onclick();const run=stored.history.at(-1);
  assert.equal(run.where,'app');assert.equal(run.prediction,i);assert.deepEqual(run.probabilities,test.probabilities);
  assert(app.element('#app-result').innerHTML.includes(i?'B 안내':'A 안내'));
  assert(app.element('#app-result').innerHTML.includes('같아요'));
 }

 // Invalid numeric inference clears both output routes and never records class A.
 const count=stored.history.length;invalidScores=true;
 await pick('#test-file',photos[0]);assert(app.element('#notice').textContent.includes('계산'));assert.equal(stored.history.length,count);assert.equal(stored.testResult,null);
 await app.element('#run-start').onclick();assert.equal(stored.history.length,count);assert(!app.element('#app-result').innerHTML.includes('<h2>A</h2>'));invalidScores=false;
 // A separately selected app photo really gets predicted; don't copy the test result.
 await pick('#run-file',photos[0]);await app.element('#run-start').onclick();assert.equal(stored.history.at(-1).prediction,0);
 assert(app.element('#app-result').innerHTML.includes('가져오기'));
 // Reopened project retains the selected run photo and real trained head.
 const reopened=boot();await idle(reopened);await reopened.element('#run-start').onclick();assert.equal(stored.history.at(-1).prediction,0);
 // Same messages must not hide different AI classes; show the explanatory note.
 stored.blocks[2].message=stored.blocks[3].message='같은 안내';const duplicate=boot();await idle(duplicate);
 await duplicate.element('#run-start').onclick();assert(duplicate.element('#app-result').innerHTML.includes('두 종류의 안내 문구가 같아요'));
 assert(duplicate.element('#app-result').innerHTML.includes('<h2>A</h2>'));
 // Old successful result must not remain visible after invalid blocks or stale training.
 stored.blocks=[];const invalid=boot();await idle(invalid);await invalid.element('#run-start').onclick();assert(invalid.element('#app-result').textContent.includes('블록'));
 stored.blocks=blocks;stored.revision=1;const stale=boot();await idle(stale);await stale.element('#run-start').onclick();assert(stale.element('#app-result').textContent.includes('다시 가르치기'));
 head.dispose();xs.dispose();ys.dispose();
 console.log('PASS: actual trained softmax + actual UI handlers; A/B/A/B identical test/run predictions and scores; separate-photo inference; reload preservation; equal-message diagnosis; stale result cleared on failure. Image feature extraction is stubbed; this is not phone or real-photo accuracy testing.');
})().catch(e=>{console.error(e);process.exitCode=1;});
