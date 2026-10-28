const assert=require('node:assert/strict'),tf=require('../docs/vendor/tf.min.js'),Engine=require('../docs/engine.js');
(async()=>{
 await tf.setBackend('cpu');await tf.ready();
 for(const p of [[0,0],[NaN,1],[Infinity,0],[.2,.2],[-.1,1.1],[1]])assert.throws(()=>Engine.checkScores(p));
 assert.equal(Engine.checkScores([.6,.4]),0);assert.equal(Engine.checkScores([.1,.9]),1);assert.equal(Engine.checkScores([.5,.5]),0);
 const zeros=new Float32Array(514),bad=new Float32Array(514),valid=new Float32Array(514);bad[0]=NaN;valid[0]=1;
 const record=x=>({data:Buffer.from(x.buffer).toString('base64')});
 assert(!Engine.checkRecord(record(zeros)));assert(!Engine.checkRecord(record(bad)));assert(Engine.checkRecord(record(valid)));assert(!Engine.checkRecord({data:'AA=='}));
 const head=tf.sequential();head.add(tf.layers.dense({inputShape:[256],units:2,activation:'softmax',kernelInitializer:'zeros',biasInitializer:'zeros'}));await assert.rejects(Engine.checkModel(head));head.dispose();
 const e=new Engine(),xs=tf.tensor2d([[1,0],[0,1]]),ys=tf.tensor2d([[1,0],[0,1]]),model=await e.train(xs,ys);
 assert.deepEqual(model.trainingCheck,{correct:2,total:2});model.dispose();xs.dispose();ys.dispose();
 console.log('PASS: invalid/zero/non-finite scores rejected; equal valid scores allowed; invalid saved heads rejected; trained-head verification reports observed fit.');
})().catch(e=>{console.error(e);process.exitCode=1;});
