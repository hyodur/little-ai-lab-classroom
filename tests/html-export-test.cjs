const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const Export=require('../docs/export-html.js'),tf=require('../docs/vendor/tf.min.js'),Engine=require('../docs/engine.js');
const read=p=>fs.readFileSync(__dirname+'/../docs/'+p,'utf8');
(async()=>{
 await tf.setBackend('cpu'); await tf.ready();
 const baseModel=JSON.parse(read('model/model.json'));
 const weights=Buffer.concat(baseModel.weightsManifest.flatMap(g=>g.paths.map(p=>fs.readFileSync(__dirname+'/../docs/model/'+p))));
 const base={topology:baseModel.modelTopology,specs:baseModel.weightsManifest.flatMap(g=>g.weights),data:weights.toString('base64')};
 const assets={base,tf:read('vendor/tf.min.js'),engine:read('engine.js'),camera:read('camera.js'),player:read('player.js'),license:read('vendor/LICENSE-Apache-2.0.txt')};
 const engine=new Engine(),xs=tf.tensor2d(Array.from({length:6},(_,i)=>Array.from({length:256},(_,j)=>j===i%2?1:0))),ys=tf.tensor2d(Array.from({length:6},(_,i)=>i%2?[0,1]:[1,0]));
 const head=await engine.train(xs,ys); let m; await head.save(tf.io.withSaveHandler(async a=>{m=a;return{modelArtifactsInfo:{dateSaved:new Date(),modelTopologyType:'JSON'}};}));
 const project={title:'시험 </script><script>throw 1</script>',revision:1,trainedRevision:1,classes:[{name:'A <b>',photos:['private-photo']},{name:'B',photos:['private-photo2']}],blocks:[{type:'photo'},{type:'predict'},{type:'if',classIndex:1,icon:'♻️',message:'B 안내'},{type:'if',classIndex:0,icon:'🌱',message:'A </script> 안내'}],model:{topology:m.modelTopology,specs:m.weightSpecs,data:Buffer.from(m.weightData).toString('base64')},history:['private-history']};
 const html=Export.build(project,assets),scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,5);assert(!/<script[^>]+src=/.test(html));assert(!html.includes('private-photo'));assert(!html.includes('private-history'));assert(html.includes("connect-src 'none'"));assert(html.includes('id="camera-open"'));assert(html.includes('갤러리에서 고르기'));assert(html.includes('capture="environment"'));assert(html.includes('class InlineCamera'));
 const packet=JSON.parse(scripts[0][1]);assert.deepEqual(packet.model,project.model);assert.deepEqual(packet.blocks,project.blocks);assert.equal(packet.title,project.title);assert.equal(packet.classes[0].count,1);scripts.slice(1).forEach(s=>new vm.Script(s[1]));
 const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:true,disabled:false,open:false,showModal(){this.open=true;},close(){this.open=false;this.onclose?.();}});return elements.get(id);};el('#app-data').textContent=JSON.stringify(packet);
 let capture='A',cameraError=null,cameraStops=0;const listeners={};
 const context={JSON,Uint8Array,Float32Array,console,tf,Image:class{async decode(){}},document:{querySelector:el,addEventListener(type,fn){listeners[type]=fn;}},window:{addEventListener(){}},navigator:{mediaDevices:{getUserMedia(){}}},atob:s=>Buffer.from(s,'base64').toString('binary'),AIEngine:class extends Engine{async load(){return this;}embed(im){if(im.src==='bad')throw Error('decode failed');return tf.tensor2d([Array.from({length:256},(_,j)=>j===(im.src==='A'?0:1)?1:0)]);}},InlineCamera:class{async open(){if(cameraError)throw cameraError;return true;}stop(){cameraStops++;}capture(){return capture;}}};
 context.HTMLImageElement=class{};context.createImageBitmap=async file=>({width:32,height:32,src:file.kind,close(){}});context.document.createElement=()=>({width:0,height:0,getContext:()=>({fillRect(){},drawImage(im){capture=im.src;}}),toDataURL:()=>capture});
 vm.runInNewContext(assets.player,context);
 for(const kind of ['A','B','A']){await el('#photo').onchange({target:{files:[{type:'image/jpeg',size:100,kind}],value:''}});await el('#start').onclick();assert.equal(el('#answer').hidden,false);assert.equal(el('#class-name').textContent,kind==='A'?'A <b>':'B');assert.equal(el('#message').textContent,kind==='A'?'A </script> 안내':'B 안내');}
 await el('#photo').onchange({target:{files:[{type:'image/jpeg',size:100,kind:'bad'}],value:''}});await el('#start').onclick();assert.equal(el('#answer').hidden,true);assert.equal(el('#status').textContent,'decode failed');

 // Camera UI feeds the same inference pipeline and releases the stream.
 capture='B';await el('#camera-open').onclick();assert.equal(el('#camera-dialog').open,true);assert.equal(el('#camera-capture').disabled,false);assert.equal(el('#choose').disabled,true);
 el('#camera-capture').onclick();assert.equal(el('#camera-dialog').open,false);assert(cameraStops>0);assert.equal(el('#choose').disabled,false);
 await el('#start').onclick();assert.equal(el('#class-name').textContent,'B');assert.equal(el('#message').textContent,'B 안내');
 await el('#camera-open').onclick();context.document.hidden=true;listeners.visibilitychange();assert.equal(el('#camera-dialog').open,false);context.document.hidden=false;
 cameraError=Object.assign(Error('denied'),{name:'NotAllowedError'});await el('#camera-open').onclick();assert.equal(el('#camera-fallback').hidden,false);assert(el('#status').textContent.includes('권한'));assert.equal(el('#choose').disabled,false);cameraError=null;
 delete context.navigator.mediaDevices;await el('#camera-open').onclick();assert.equal(el('#camera-dialog').open,false);assert(el('#status').textContent.includes('카메라 앱'));
 await el('#native-photo').onchange({target:{files:[{type:'image/jpeg',size:100,kind:'A'}],value:''}});await el('#start').onclick();assert.equal(el('#class-name').textContent,'A <b>');

 // A corrupt embedded head must show recovery guidance, never a class-A answer.
 const brokenPacket=structuredClone(packet);brokenPacket.model.data=Buffer.alloc(2056).toString('base64');el('#app-data').textContent=JSON.stringify(brokenPacket);
 vm.runInNewContext(assets.player,context);
 await el('#photo').onchange({target:{files:[{type:'image/jpeg',size:100,kind:'A'}],value:''}});await el('#start').onclick();assert.equal(el('#answer').hidden,true);assert(el('#status').textContent.includes('다시 가르치고'));
 const source=m=>{const b=Buffer.from(m.data,'base64');return tf.io.fromMemory({modelTopology:m.topology,weightSpecs:m.specs,weightData:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)});};
 const restored=await tf.loadLayersModel(source(packet.model));const p=head.predict(xs),q=restored.predict(xs);assert.deepEqual(await q.array(),await p.array());
 const before=await new Engine().load(source(base)),after=await new Engine().load(source(packet.base));const pixels=tf.randomUniform([48,48,3],0,255,'int32',22),f=before.embed(pixels),g=after.embed(pixels);assert.deepEqual(await f.array(),await g.array());const a=head.predict(f),b=restored.predict(g);assert.deepEqual(await a.array(),await b.array());
 assert.throws(()=>Export.build({...project,trainedRevision:0},assets));assert.throws(()=>Export.build({...project,blocks:project.blocks.slice(0,3)},assets));assert.throws(()=>Export.build({...project,blocks:[project.blocks[1],project.blocks[0],...project.blocks.slice(2)]},assets));
 for(const t of [xs,ys,p,q,pixels,f,g,a,b])t.dispose();head.dispose();restored.dispose();before.features.dispose();after.features.dispose();
 console.log('PASS: self-contained HTML; original photos/history excluded; hostile text safely escaped; scripts parse; learned weights and block mapping preserved; actual MobileNet features and softmax outputs identical after export; incomplete/stale projects rejected. Size '+(Buffer.byteLength(html)/1048576).toFixed(1)+' MiB.');
})().catch(e=>{console.error(e);process.exitCode=1;});
