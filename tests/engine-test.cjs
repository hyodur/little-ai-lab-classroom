const fs=require('node:fs'),assert=require('node:assert/strict');
const tf=require('../docs/vendor/tf.min.js'),Engine=require('../docs/engine.js');
(async()=>{await tf.setBackend('cpu');await tf.ready();
const source=JSON.parse(fs.readFileSync(__dirname+'/../docs/model/model.json','utf8'));
const chunks=source.weightsManifest.flatMap(g=>g.paths.map(p=>fs.readFileSync(__dirname+'/../docs/model/'+p)));
const weights=Buffer.concat(chunks);const artifacts={modelTopology:source.modelTopology,weightSpecs:source.weightsManifest.flatMap(g=>g.weights),weightData:weights.buffer.slice(weights.byteOffset,weights.byteOffset+weights.byteLength)};
const engine=await new Engine().load(tf.io.fromMemory(artifacts));
const features=[];for(let kind=0;kind<2;kind++){for(let n=0;n<3;n++){const buf=new Uint8Array(224*224*3);buf.fill(230);for(let y=35+n*5;y<180;y++)for(let x=kind?35:85;x<(kind?185:135);x++){const pos=(y*224+x)*3;buf[pos]=kind?170:60;buf[pos+1]=kind?110:150;buf[pos+2]=kind?55:190;}const pixels=tf.tensor3d(buf,[224,224,3],'int32');features.push(engine.embed(pixels));pixels.dispose();}}
const xs=tf.concat(features),ys=tf.tensor2d([[1,0],[1,0],[1,0],[0,1],[0,1],[0,1]]);features.forEach(f=>f.dispose());assert.equal(xs.shape[1],256);
const head=await engine.train(xs,ys);const p=head.predict(xs);const rows=await p.array();assert(rows.slice(0,3).every(r=>r[0]>r[1]));assert(rows.slice(3).every(r=>r[1]>r[0]));
let saved;await head.save(tf.io.withSaveHandler(async a=>{saved=a;return {modelArtifactsInfo:{dateSaved:new Date(),modelTopologyType:'JSON'}};}));
assert.equal(saved.modelTopology.config.layers[0].config.batch_input_shape[1],256);assert.equal(saved.weightData.byteLength,2056);assert.deepEqual(saved.weightSpecs.map(s=>s.shape),[[256,2],[2]]);
const restored=await tf.loadLayersModel(tf.io.fromMemory(saved));const q=restored.predict(xs),reloaded=await q.array();assert.deepEqual(reloaded,rows);
const swapped=await engine.train(xs,tf.tensor2d([[0,1],[0,1],[0,1],[1,0],[1,0],[1,0]]));const flip=swapped.predict(xs);const flips=await flip.array();assert(flips.slice(0,3).every(r=>r[1]>r[0]));assert(flips.slice(3).every(r=>r[0]>r[1]));
console.log(JSON.stringify({checks:['MobileNet feature extraction','real two-class training','saved model round trip identical predictions','changed labels reverse learned classification'],featureShape:xs.shape,firstPredictions:rows.map(r=>r.map(x=>+x.toFixed(4))),passed:true},null,2));
for(const t of [xs,ys,p,q,flip])t.dispose();head.dispose();restored.dispose();swapped.dispose();
})().catch(e=>{console.error(e);process.exitCode=1;});
