const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function firestore(initial={}) {
 const records=new Map(Object.entries(initial)),listeners=new Map();let writes=0,fail=false;
 const snapshot=key=>({id:key.split('/').at(-1),exists:records.has(key),data:()=>structuredClone(records.get(key))});
 const snapCollection=name=>({docs:[...records.keys()].filter(key=>key.startsWith(name+'/')&&!key.slice(name.length+1).includes('/')).map(snapshot)});
 const document=key=>({id:key.split('/').at(-1),key,async get(){if(fail)throw Error('permission-denied');return snapshot(key);},async set(data,options){if(fail)throw Error('permission-denied');records.set(key,options?.merge?{...records.get(key),...data}:data);writes++;},onSnapshot(callback){listeners.set(key,callback);callback(snapshot(key));return ()=>listeners.delete(key);}});
 const db={collection:name=>({doc:id=>document(name+'/'+id),async get(){if(fail)throw Error('permission-denied');return snapCollection(name);},onSnapshot(callback){callback(snapCollection(name));return ()=>{};}}),async runTransaction(callback){
  if(fail)throw Error('permission-denied');const pending=[];
  const result=await callback({get:async ref=>snapshot(ref.key),set:(ref,data,options)=>pending.push([ref,data,options]),update:(ref,data)=>pending.push([ref,data,{merge:true}])});
  for(const [ref,data,options]of pending){await ref.set(data,options);listeners.get(ref.key)?.(snapshot(ref.key));}return result;
 }};
 return {db,records,get writes(){return writes;},set fail(value){fail=value;}};
}
function customer(env,local=false) {
 const storage=new Map(),window={WTRACK_LOCAL_SANDBOX:local,getDb:()=>env.db,document:{getElementById:()=>null},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 vm.runInNewContext(fs.readFileSync('js/customer_master.js','utf8'),{window});return window.CustomerMaster;
}
test('customer Firebase import adds once, skips unchanged rows, updates Admin SJ and survives another session',async()=>{
 const env=firestore(),api=customer(env);
 const parsed=api.parseRows([{'Nama customer':'PT Uji','ADMIN SJ':'ELIN'},{'Nama customer':'PT Uji','ADMIN SJ':'FIFIH'}]);
 assert.equal(parsed.records.length,1);assert.equal(parsed.records[0].adminSJ,'FIFIH');
 assert.equal((await api.upsert(parsed.records)).added,1);assert.equal(env.writes,1);
 assert.equal((await api.upsert(parsed.records)).skipped,1);assert.equal(env.writes,1);
 assert.equal((await api.upsert([{name:'PT Uji',adminSJ:'NOVA',address:'',region:''}])).updated,1);
 assert.equal(env.writes,2);
 assert.equal((await customer(env).getLookup()).get('ptuji'),'NOVA');
});
test('customer updates preserve address and coordinates and prefer the newest legacy duplicate',async()=>{
 const env=firestore({'clients/legacy':{name:'PT Uji',adminSJ:'ELIN',address:'Alamat lama',latitude:-6.2},'clients/other':{name:'PT Uji',adminSJ:'OLD'}});
 const api=customer(env);await api.upsert([{name:'PT Uji',adminSJ:'FIFIH',address:'',region:''}]);
 assert.equal(env.records.get('clients/legacy').address,'Alamat lama');
 assert.equal(env.records.get('clients/legacy').latitude,-6.2);
 assert.equal((await customer(env).getLookup()).get('ptuji'),'FIFIH');
});
test('a Firebase failure never becomes a successful customer import',async()=>{
 const env=firestore(),api=customer(env);env.fail=true;
 await assert.rejects(()=>api.upsert([{name:'PT Uji',adminSJ:'ELIN'}]),/permission-denied/);assert.equal(env.writes,0);
});
function materials(env) {
 const window={getDb:()=>env.db,document:{addEventListener(){},getElementById:()=>null}};
 const context=vm.createContext({window,Date,Intl});
 for(const file of ['material_seed','material_master','material_cloud'])vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),context);
 return window;
}
test('Firebase material master seeds once and edits survive refresh without being replaced by seed rates',async()=>{
 const env=firestore(),first=materials(env);await first.MaterialCloud.ready();
 assert.equal(first.MaterialMaster.read().length,61);assert.equal(env.writes,1);
 const rows=first.MaterialMaster.read();rows[0].kgPerM2=2.123;await first.MaterialCloud.write(rows);
 const second=materials(env);await second.MaterialCloud.ready();
 assert.equal(second.MaterialMaster.read()[0].kgPerM2,2.123);assert.equal(env.writes,2);
});
test('stale material edits are rejected instead of replacing another PC changes',async()=>{
 const env=firestore(),first=materials(env);await first.MaterialCloud.ready();
 const stored=env.records.get('configuration/material_master_v1');env.records.set('configuration/material_master_v1',{...stored,revision:99});
 await assert.rejects(()=>first.MaterialCloud.write(first.MaterialMaster.read()),/berubah/);
 assert.equal(env.records.get('configuration/material_master_v1').revision,99);
});
function engine(env,{fail=false}={}) {
 const messages=[],store=new Map();let currentRows=[];
 const window={getDb:()=>env.db,getCustomerAdminSJLookup:async()=>new Map(),showToast:m=>messages.push(m)};
 window.MaterialCloud={sourceId:sj=>encodeURIComponent(sj),usageRecord:t=>({noSJ:t.noSJ,items:t.items}),acceptUsage(){}};
 const document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[{getAttribute:()=> '0'}]};
 vm.runInNewContext(fs.readFileSync('js/sj_import_engine.js','utf8'),{window,document,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},console:{log(){},warn(){},error(){}},alert:m=>messages.push(m),XLSX:{read:()=>({SheetNames:['SJ'],Sheets:{SJ:{}}}),utils:{sheet_to_json:()=>currentRows}},FileReader:class{readAsArrayBuffer(){this.onload({target:{result:new ArrayBuffer(0)}});}}});
 return {api:window.SJImportEngine,messages,store,parse:async rows=>{currentRows=rows;return window.SJImportEngine.parseExcelFile({name:'uji.xlsx'});}};
}
const testRows=[['No SJ','Customer','Admin Surat Jalan','Alamat','Nama Barang','Ukuran','Qty'],['SJ-REGRESSION-1','PT Uji','ELIN','Jakarta','Art Paper','1 x 2',2]];
test('Admin Surat Jalan header keeps the actual SJ identity and Admin SJ',async()=>{
 const state=engine(firestore());const [row]=await state.parse(testRows);
 assert.equal(row.sjNumber,'SJ-REGRESSION-1');assert.equal(row.adminSJ,'ELIN');
});
test('online SJ import stores trip, duplicate registry and usage atomically, then skips a repeated file',async()=>{
 const env=firestore(),state=engine(env);await state.parse(testRows);await state.api.commitImportBatch();
 assert.equal(env.records.size,3);const trip=[...env.records].find(([key])=>key.startsWith('trips/'))[1];assert.equal(trip.adminSJ,'ELIN');
 assert.equal(trip.destinations[0].adminSJ,'ELIN');
 await state.parse(testRows);await state.api.commitImportBatch();assert.equal(env.writes,3);
 assert(state.messages.some(message=>message.includes('Tidak ada SJ baru')));
});
test('cloud SJ failure preserves preview and never reports success or writes browser-only trips',async()=>{
 const env=firestore(),state=engine(env);await state.parse(testRows);env.fail=true;await state.api.commitImportBatch();
 assert.equal(env.writes,0);assert.equal(state.store.size,0);
 assert(!state.messages.some(message=>message.includes('Berhasil')||message.includes('berhasil disimpan')));
 assert(state.messages.some(message=>message.includes('Import belum selesai')));
 env.fail=false;await state.api.commitImportBatch();assert.equal(env.writes,3);
});
test('manual preview Admin SJ edit is retained in the persisted trip',async()=>{
 const env=firestore(),state=engine(env);await state.parse(testRows);
 state.api.updatePreviewRow(0,'adminSJ','FIFIH');await state.api.commitImportBatch();
 assert.equal([...env.records].find(([key])=>key.startsWith('trips/'))[1].adminSJ,'FIFIH');
});

test('older courier tasks resolve a missing Admin SJ from the newest customer record without rewriting SJ history',()=>{
 const window={document:{addEventListener(){}},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync('js/courier_admin.js','utf8'),{window,Date});
 window.CourierAdminSJ.replace([{name:'PT UJI',adminSJ:'OLD',updatedAt:'2026-01-01'},{name:'PT Uji.',adminSJ:'NOVA',updatedAt:'2026-11-14'}]);
 assert.equal(window.CourierAdminSJ.resolve({customer:'PT UJI'}),'NOVA');
 assert.equal(window.CourierAdminSJ.resolve({customer:'Customer tidak dikenal'}),'');
});

test('online pool line edits persist both SJ copies and Usage archive, and reject an assigned trip',async()=>{
 const trip={id:'trip-line',tripId:'trip-line',noSJ:'SJ-LINE-1',sourceFile:'line.xlsx',customer:'PT Uji',status:'pool',courierId:'',items:[{nama:'ART PAPER',ukuran:'1 x 2',qty:3}],destinations:[{items:[]}]};
 const env=firestore({'trips/trip-line':trip});
 const window={getDb:()=>env.db,allPoolTrips:[trip],document:{querySelectorAll:()=>[],addEventListener(){}},UnifiedPoolUI:{renderUnifiedPoolView(){},updateSelectionCount(){}},alert:message=>{window.lastError=message;}};
 const context=vm.createContext({window,Date,Intl});
 for(const file of ['material_cloud','pool_line_items'])vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),context);
 await window.PoolLineItems.updateLine('SJ-LINE-1',0,'materialId','MAT_TABLE_005');
 const saved=env.records.get('trips/trip-line');
 assert.equal(saved.items[0].poolLine.materialId,'MAT_TABLE_005');
 assert.equal(saved.destinations[0].items[0].poolLine.materialId,'MAT_TABLE_005');
 assert.equal(env.records.get('material_usage_sources/SJ-LINE-1').items[0].poolLine.materialId,'MAT_TABLE_005');
 env.records.set('trips/trip-line',{...saved,courierId:'other'});const writes=env.writes;
 await window.PoolLineItems.updateLine('SJ-LINE-1',0,'selected',false);
 assert.equal(env.writes,writes);assert.match(window.lastError,/sudah ditugaskan/);
});

test('courier web update waits for the proof modal to close before reloading a new build',async()=>{
 const events=new Map();let blocked=true,reloads=0;
 const window={location:{protocol:'https:',reload(){reloads++;}},navigator:{onLine:true},document:{hidden:false,currentScript:{dataset:{build:'old'}},activeElement:null,querySelector:()=>blocked?{}:null,addEventListener:(name,handler)=>events.set(name,handler)},addEventListener:(name,handler)=>events.set(name,handler),setInterval(){},fetch:async()=>({ok:true,json:async()=>({courier:'new'})})};
 vm.runInNewContext(fs.readFileSync('js/courier_updates.js','utf8'),{window});
 await events.get('online')();assert.equal(reloads,0);
 blocked=false;await events.get('online')();assert.equal(reloads,1);
});

test('bulk Admin SJ changes only selected customer IDs and preserves addresses and coordinates',async()=>{
 const original={name:'PT Satu',adminSJ:'ELIN',address:'Alamat lama',latitude:-6.2,longitude:106.8};
 const env=firestore({'clients/one':original,'clients/two':{name:'PT Dua',adminSJ:'SULIS'},'clients/other':{name:'Customer lain',adminSJ:'OLD'}});
 const api=customer(env),baseline=[{...original,id:'one'},{id:'two',name:'PT Dua',adminSJ:'SULIS'}];
 const result=await api.assignAdmin(['one','two','one'],' NOVA ',baseline);
 assert.equal(result.updated,2);assert.equal(result.done,2);
 assert.equal(env.records.get('clients/one').adminSJ,'NOVA');
 assert.equal(env.records.get('clients/one').address,original.address);
 assert.equal(env.records.get('clients/one').latitude,original.latitude);
 assert.equal(env.records.get('clients/two').adminSJ,'NOVA');
 assert.equal(env.records.get('clients/other').adminSJ,'OLD');
 const again=await api.assignAdmin(['one','two'],'NOVA',baseline);
 assert.equal(again.unchanged,2);assert.equal(env.writes,2);
});
test('bulk Admin SJ rejects stale selection, deleted customers, and blank admin without changing other rows',async()=>{
 const env=firestore({'clients/one':{name:'PT Satu',adminSJ:'NEW'},'clients/two':{name:'PT Dua',adminSJ:'ELIN'}}),api=customer(env);
 const baseline=[{id:'one',name:'PT Satu',adminSJ:'OLD'},{id:'two',name:'PT Dua',adminSJ:'ELIN'},{id:'deleted',name:'Dihapus'}];
 await assert.rejects(()=>api.assignAdmin(['two','one'],'NOVA',baseline),/berubah/);
 assert.equal(env.writes,0);
 await assert.rejects(()=>api.assignAdmin(['two','deleted'],'NOVA',baseline),/dihapus/);
 await assert.rejects(()=>api.assignAdmin(['two'],'  ',baseline),/Isi nama/);
 assert.equal(env.writes,0);
});
test('bulk Admin SJ reports committed chunks on a later failure and can safely resume',async()=>{
 const initial=Object.fromEntries(Array.from({length:151},(_,i)=>['clients/id-'+i,{name:'PT '+i,adminSJ:'ELIN'}]));
 const env=firestore(initial),api=customer(env),baseline=Object.entries(initial).map(([key,row])=>({...row,id:key.split('/')[1]}));
 const transaction=env.db.runTransaction;let calls=0;
 env.db.runTransaction=async callback=>{if(++calls===2)throw Error('network-unavailable');return transaction(callback);};
 await assert.rejects(()=>api.assignAdmin(baseline.map(row=>row.id),'NOVA',baseline),error=>error.bulkResult.done===150&&/network/.test(error.message));
 assert.equal(env.records.get('clients/id-149').adminSJ,'NOVA');
 assert.equal(env.records.get('clients/id-150').adminSJ,'ELIN');
 env.db.runTransaction=transaction;
 const result=await api.assignAdmin(baseline.map(row=>row.id),'NOVA',baseline);
 assert.equal(result.updated,1);assert.equal(result.unchanged,150);
});

test('Admin SJ directory can add a name before it is assigned, survives a new session, and avoids duplicate names',async()=>{
 const env=firestore(),first=customer(env);
 const added=await first.saveAdminName('  RINA  ');assert.equal(added.name,'RINA');assert.equal(added.added,true);
 assert.equal(env.records.size,1);assert.equal(env.records.get('sj_admins/RINA').name,'RINA');
 assert.equal(env.records.has('clients/CLIENT_rina'),false);
 const second=customer(env);assert((await second.loadAdminNames()).includes('RINA'));
 const duplicate=await second.saveAdminName('rina');assert.equal(duplicate.added,false);assert.equal(env.writes,1);
 await assert.rejects(()=>second.saveAdminName('  '),/Isi nama/);assert.equal(env.writes,1);
});
test('Admin SJ directory failure does not create an admin or customer record',async()=>{
 const env=firestore(),api=customer(env);env.fail=true;
 await assert.rejects(()=>api.saveAdminName('RINA'),/permission-denied/);assert.equal(env.writes,0);assert.equal(env.records.size,0);
});
test('a slow admin directory read cannot hide a new admin just saved in the same session',async()=>{
 const env=firestore(),api=customer(env),collection=env.db.collection;let release;
 env.db.collection=name=>{
  const col=collection(name);
  if(name==='sj_admins')col.get=()=>new Promise(resolve=>{release=resolve;});
  return col;
 };
 const loading=api.loadAdminNames();await api.saveAdminName('RINA');
 release({docs:[]});await loading;assert(api.knownAdminNames().includes('RINA'));
});
