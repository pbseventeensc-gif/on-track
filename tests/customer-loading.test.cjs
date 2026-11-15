const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/customer_master.js','utf8');
function setup({cached,storageFails=false}={}) {
 const table={innerHTML:''},storage=new Map(),watchers=[],events=new Map();let subscriptions=0,reads=0,stops=0,authListener;
 const auth={currentUser:{uid:'account-A'},onAuthStateChanged(callback){authListener=callback;}};
 if(cached)storage.set('wtrack_customer_display_v1:account-A',JSON.stringify({savedAt:Date.now(),rows:cached}));
 let read=async()=>snap([{id:'a',name:'Customer Segar',adminSJ:'NOVA'}]);
 const window={getAuth:()=>auth,getDb:()=>({collection:()=>({
  get(options){assert.equal(options.source,'server');reads++;return read();},
  onSnapshot(options,next,error){assert.equal(options.includeMetadataChanges,true);subscriptions++;watchers.push({next,error});return ()=>{stops++;};}
 })}),document:{getElementById:id=>id==='customer-master-table'?table:null,addEventListener:(name,callback)=>events.set(name,callback)},localStorage:{getItem:key=>storage.get(key)||null,setItem(key,value){if(storageFails)throw Error('QuotaExceeded');storage.set(key,value);}},setCustomerMasterCache:()=>{}};
 vm.runInNewContext(source,{window,Date,Intl});
 return {api:window.CustomerMaster,table,storage,watchers,auth,events,get subscriptions(){return subscriptions;},get reads(){return reads;},get stops(){return stops;},setRead(fn){read=fn;},emitAuth(user){auth.currentUser=user;authListener(user);}};
}
function snap(rows,cached=false){return {docs:rows.map(row=>({id:row.id,data:()=>({...row})})),metadata:{fromCache:cached,hasPendingWrites:false}};}
test('opening Customer joins one live listener and reopening never downloads the whole collection again',async()=>{
 const s=setup(),first=s.api.load(),second=s.api.load();
 assert.equal(s.subscriptions,1);assert.equal(s.reads,0);
 s.watchers[0].next(snap([{id:'a',name:'Customer Uji',adminSJ:'ELIN'}]));await Promise.all([first,second]);
 await s.api.load();await s.api.load();
 assert.equal(s.subscriptions,1);assert.equal(s.reads,0);assert.match(s.table.innerHTML,/Customer Uji/);
 await s.api.load(true);assert.equal(s.reads,1);assert.equal(s.api.resolveName('Customer Segar'),'NOVA');
});
test('an account display cache paints immediately while the delayed listener updates admin from Firebase',async()=>{
 const s=setup({cached:[{id:'a',name:'Customer Cache',adminSJ:'OLD'}]});
 await s.api.load(); // Returns without waiting for the first network snapshot.
 assert.match(s.table.innerHTML,/Customer Cache/);assert.equal(s.api.resolveName('Customer Cache'),'OLD');
 assert.match(s.table.innerHTML,/Menyinkronkan perubahan/);assert.equal(s.reads,0);
 s.watchers[0].next(snap([{id:'a',name:'Customer Cache',adminSJ:'NEW'}]));
 assert.equal(s.api.resolveName('Customer Cache'),'NEW');
 assert.equal(JSON.parse(s.storage.get('wtrack_customer_display_v1:account-A')).rows[0].adminSJ,'NEW');
});
test('an empty Firestore SDK cache never erases the saved customer display before the server responds',async()=>{
 const s=setup({cached:[{id:'a',name:'Tetap Tampil',adminSJ:'ELIN'}]});await s.api.load();
 s.watchers[0].next(snap([],true));assert.match(s.table.innerHTML,/Tetap Tampil/);
 s.watchers[0].next(snap([]));assert.doesNotMatch(s.table.innerHTML,/Tetap Tampil/);
});
test('fresh import lookups share a pending server read and never substitute display cache when the server fails',async()=>{
 const s=setup({cached:[{id:'a',name:'Customer Cache',adminSJ:'OLD'}]});await s.api.load();
 let release;s.setRead(()=>new Promise(resolve=>{release=resolve;}));
 const first=s.api.getLookup(),second=s.api.getLookup();assert.equal(s.reads,1);
 release(snap([{id:'a',name:'Customer Cache',adminSJ:'FRESH'}]));
 assert.equal((await first).get('customercache'),'FRESH');assert.equal((await second).get('customercache'),'FRESH');
 s.setRead(async()=>{throw Error('network-unavailable');});await assert.rejects(()=>s.api.getLookup(),/network-unavailable/);
});
test('account changes stop the old listener and ignore late snapshots and caches belonging to another account',async()=>{
 const s=setup({cached:[{id:'a',name:'Private A',adminSJ:'ELIN'}]});s.events.get('DOMContentLoaded')();s.emitAuth(s.auth.currentUser);
 assert.match(s.table.innerHTML,/Private A/);s.emitAuth({uid:'account-B'});
 assert.equal(s.stops,1);assert.doesNotMatch(s.table.innerHTML,/Private A/);
 s.watchers[0].next(snap([{id:'a',name:'Private A',adminSJ:'ELIN'}]));assert.doesNotMatch(s.table.innerHTML,/Private A/);
 s.watchers[1].next(snap([{id:'b',name:'Customer B',adminSJ:'NOVA'}]));assert.match(s.table.innerHTML,/Customer B/);
 assert.equal(s.storage.has('wtrack_customer_display_v1:account-B'),true);
});
test('cache quota failure and a reconnect failure keep the existing table usable',async()=>{
 const s=setup({storageFails:true}),loaded=s.api.load();
 s.watchers[0].next(snap([{id:'a',name:'Customer Uji',adminSJ:'ELIN'}]));await loaded;
 s.watchers[0].error(Error('offline'));assert.match(s.table.innerHTML,/Customer Uji/);assert.match(s.table.innerHTML,/Data sebelumnya tetap ditampilkan/);
 await s.api.load();assert.equal(s.subscriptions,2);assert.match(s.table.innerHTML,/Customer Uji/);
});
