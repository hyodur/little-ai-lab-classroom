const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../docs/app.js','utf8');
const start=source.indexOf('function validate(){'),end=source.indexOf("$('#check-blocks')",start);
function validate(blocks){const context={state:{classes:[{name:'A'},{name:'B'}],blocks}};vm.createContext(context);vm.runInContext(source.slice(start,end)+'; result=validate();',context);return Array.from(context.result);}
const cond=i=>({type:'if',classIndex:i,message:'약속'}),valid=[{type:'photo'},{type:'predict'},cond(0),cond(1)];
assert.equal(validate(valid).length,0);assert(validate([]).length===4);assert(validate([{type:'predict'},{type:'photo'},cond(0),cond(1)]).some(e=>e.includes('전에')));assert(validate([{type:'photo'},cond(0),{type:'predict'},cond(1)]).some(e=>e.includes('앞에')));assert(validate([{type:'photo'},{type:'predict'},cond(0),cond(0)]).some(e=>e.includes('겹쳐요')));assert(validate([{type:'photo'},{type:'predict'},{...cond(0),message:''},cond(1)]).some(e=>e.includes('적어')));
console.log('PASS: valid sequence, missing blocks, wrong sequence, early condition, duplicate condition, empty message');
