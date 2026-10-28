(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CheckpointQueue=factory();})(typeof self!=='undefined'?self:this,function(){
// A single writer prevents older snapshots from overwriting newer work.
return class CheckpointQueue {
 constructor(write,capture,onSaved,onError){this.write=write;this.capture=capture;this.onSaved=onSaved;this.onError=onError;this.version=0;this.saved=0;this.running=null;}
 mark(){this.version++;}
 flush(){if(this.running)return this.running;this.running=this.drain().finally(()=>{this.running=null;});return this.running;}
 async drain(){while(this.saved<this.version){const version=this.version;const value=this.capture();try{await this.write(value);}catch(e){this.onError(e);throw e;}this.saved=version;this.onSaved(this.saved===this.version);}}
};
});
