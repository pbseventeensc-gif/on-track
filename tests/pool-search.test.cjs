const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const container={innerHTML:''},timers=new Map();let timerId=0;
 const window={allPoolTrips:[{id:'a',noSJ:'SJ-1126-03219',status:'pool',customer:'Alpha',date:'2026-11-17'},{id:'b',noSJ:'SJ-1126-03218',status:'pool',customer:'Beta',date:'2026-11-17'}],allCurrentTrips:[]};
 const document={getElementById:id=>id==='view-pool'?container:null,querySelectorAll:()=>[]};
 const context=vm.createContext({window,document,localStorage:{getItem:()=>null},console,setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(fs.readFileSync('js/unified_pool_ui.js','utf8'),context);
 context.UnifiedPoolUI=window.UnifiedPoolUI;
 return {api:window.UnifiedPoolUI,container,timers};
}
test('SJ search accepts partial numbers and pasted spaces, hashes and unicode dashes',()=>{
 const {api,container}=setup();
 for(const query of ['03219','#SJ 1126 03219','SJ–1126–03219']){
  api.setSearchQuery(query);
  assert.match(container.innerHTML,/value="SJ-1126-03219"/);
  assert.doesNotMatch(container.innerHTML,/value="SJ-1126-03218"/);
 }
});
test('incoming data renders use the latest keystrokes before the debounce expires',()=>{
 const {api,container,timers}=setup();
 api.scheduleSearch('0321');api.scheduleSearch('03218');
 assert.equal(timers.size,1);assert.equal([...timers.values()][0].delay,100);
 api.renderUnifiedPoolView();
 assert.match(container.innerHTML,/value="SJ-1126-03218"/);
 assert.doesNotMatch(container.innerHTML,/value="SJ-1126-03219"/);
 api.setSearchQuery('Alpha');
 assert.equal(timers.size,0);
 assert.match(container.innerHTML,/value="SJ-1126-03219"/);
});
