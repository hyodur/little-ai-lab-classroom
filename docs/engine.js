/* Frozen MobileNet v1 .25 features + student-trained two-class head. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./vendor/tf.min.js'));else root.AIEngine=factory(root.tf);})(typeof self!=='undefined'?self:this,function(tf){
'use strict';
return class AIEngine {
 constructor(){this.features=null;}
 static checkScores(p){
  if(p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1)||Math.abs(p[0]+p[1]-1)>.001)throw Error('AI 계산 결과를 읽지 못했어요. 사진은 그대로 두고 AI를 다시 가르쳐 주세요.');
  return p[0]>=p[1]?0:1;
 }
 static checkRecord(record){
  try{const raw=typeof atob==='function'?atob(record.data):Buffer.from(record.data,'base64').toString('binary');const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));if(bytes.length!==2056)return false;const values=new Float32Array(bytes.buffer);return values.every(Number.isFinite)&&values.some(n=>n!==0);}catch{return false;}
 }
 static async checkModel(model){
  const weights=model.getWeights();let nonzero=false;
  for(const w of weights){const values=await w.data();if(values.some(n=>!Number.isFinite(n)))throw Error('AI의 배움 값을 읽지 못했어요. 다시 가르쳐 주세요.');if(values.some(n=>n!==0))nonzero=true;}
  if(!nonzero)throw Error('AI의 배움 값이 비어 있어요. 사진은 보관했으니 다시 가르쳐 주세요.');
 }
 async load(source){const full=await tf.loadLayersModel(source);this.features=tf.model({inputs:full.inputs,outputs:full.getLayer('global_average_pooling2d_1').output});return this;}
 embed(pixels){const result=tf.tidy(()=>{const p=pixels instanceof tf.Tensor?pixels:tf.browser.fromPixels(pixels);const resized=tf.image.resizeBilinear(p.toFloat(),[224,224],true);const input=resized.div(127.5).sub(1).expandDims(0);const x=this.features.predict(input);return x.div(x.norm('euclidean',1,true).add(1e-8));});const values=result.dataSync();if(values.some(n=>!Number.isFinite(n))||!values.some(n=>n!==0)){result.dispose();throw Error('사진의 특징을 읽지 못했어요. 다시 시도해 주세요.');}return result;}
 async train(xs,ys,onEpoch){const model=tf.sequential();model.add(tf.layers.dense({inputShape:[xs.shape[1]],units:2,activation:'softmax',kernelInitializer:tf.initializers.glorotUniform({seed:42})}));model.compile({optimizer:tf.train.adam(.03),loss:'categoricalCrossentropy'});try{await model.fit(xs,ys,{epochs:40,batchSize:Math.min(xs.shape[0],16),shuffle:true,callbacks:{onEpochEnd:async(epoch)=>{if(onEpoch)await onEpoch(epoch);await tf.nextFrame();}}});await AIEngine.checkModel(model);const output=model.predict(xs);try{const rows=await output.array(),labels=await ys.array();let correct=0;rows.forEach((row,i)=>{if(AIEngine.checkScores(row)===(labels[i][0]>=labels[i][1]?0:1))correct++;});model.trainingCheck={correct,total:rows.length};}finally{output.dispose();}return model;}catch(e){model.dispose();throw e;}}
};
});
