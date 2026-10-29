const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const Transfer=require('../docs/player-transfer.js'),Import=require('../docs/player-import.js'),Engine=require('../docs/engine.js');
const model=JSON.parse(fs.readFileSync(__dirname+'/../docs/model/model.json','utf8')),weights=fs.readFileSync(__dirname+'/../docs/model/weights.bin');
const base={topology:model.modelTopology,specs:model.weightsManifest.flatMap(g=>g.weights),data:weights.toString('base64')};
const head=new Float32Array(514);head[0]=1;
const packet={format:'little-ai-lab-player',version:1,title:'내 앱 🌱',classes:[{name:'종이',count:10},{name:'비닐',count:10}],blocks:[{type:'photo'},{type:'predict'},{type:'if',classIndex:0,icon:'🌱',message:'종이 안내'},{type:'if',classIndex:1,icon:'♻',message:'비닐 안내'}],model:{topology:{class_name:'Sequential'},specs:[{name:'test',shape:[514],dtype:'float32'}],data:Buffer.from(head.buffer).toString('base64')},base,photos:['must-not-transfer'],history:['must-not-transfer']};
const hash=Transfer.encode(packet),url=new URL('https://hyodur.github.io/little-ai-lab-classroom/play.html'+hash),compact=Transfer.decode(hash);
assert.equal(url.search,'');assert(hash.length<10000);assert(!hash.includes('must-not-transfer'));assert.equal(compact.base,undefined);assert.deepEqual(compact.model,packet.model);assert.deepEqual(compact.blocks,packet.blocks);assert.equal(compact.baseKey,Transfer.signature(base));
assert.throws(()=>Transfer.decode('#camera=%'));assert.throws(()=>Transfer.decode('#camera='+encodeURIComponent(JSON.stringify({...compact,base}))));
assert.throws(()=>Transfer.encode({...packet,title:'x'.repeat(65000)}));
async function boot(fragment,networkError=false){
 const elements=new Map(),requests=[];let cameraClicks=0,cleared=false;
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:true,disabled:false,textContent:'',click(){if(id==='#camera-open')cameraClicks++;}});return elements.get(id);};
 const context={PlayerImport:Import,PlayerTransfer:Transfer,AIEngine:Engine,Uint8Array,console,btoa:s=>Buffer.from(s,'binary').toString('base64'),location:{hash:fragment,pathname:'/little-ai-lab-classroom/play.html',search:''},history:{replaceState(state,title,url){assert.equal(url,'/little-ai-lab-classroom/play.html');cleared=true;}},fetch:async path=>{assert(cleared);requests.push(path);if(networkError)return{ok:false};if(path==='model/model.json')return{ok:true,json:async()=>model};assert.equal(path,'model/weights.bin');return{ok:true,arrayBuffer:async()=>weights.buffer.slice(weights.byteOffset,weights.byteOffset+weights.byteLength)};},document:{querySelector:el,createElement(){return{remove(){}};},body:{append(script){assert.equal(script.src,'player.js?v=63');script.onload();}}}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../docs/player-open.js','utf8'),context);
 for(let i=0;i<5;i++)await new Promise(setImmediate);
 return{el,requests,cameraClicks,cleared};
}
(async()=>{
 const good=await boot(hash);assert(good.cleared);assert.equal(good.cameraClicks,1);assert.equal(good.el('#player-main').hidden,false);assert.deepEqual(JSON.parse(good.el('#app-data').textContent),Import.validate(packet));assert.deepEqual(good.requests,['model/model.json','model/weights.bin']);
 const bad=await boot('#camera='+encodeURIComponent(JSON.stringify({...compact,blocks:[]})));assert.equal(bad.cameraClicks,0);assert.equal(bad.requests.length,0);assert.equal(bad.el('#open-app').disabled,false);
 const mismatch=await boot('#camera='+encodeURIComponent(JSON.stringify({...compact,baseKey:'0'})));assert.equal(mismatch.cameraClicks,0);assert(mismatch.el('#open-status').textContent.includes('버전'));
 const offline=await boot(hash,true);assert.equal(offline.cameraClicks,0);assert.equal(offline.el('#open-app').disabled,false);assert(offline.el('#open-status').textContent.includes('인터넷'));
 console.log('PASS: first-click fragment handoff preserves learned model/rules, excludes photos and large base, clears fragment, loads only two fixed public assets, opens camera automatically, handles invalid data/version mismatch/offline.');
})().catch(e=>{console.error(e);process.exitCode=1;});
