const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const links=require('../js/sj_links.js');

test('adding several SJ retains one stop, original customer identity, status and proof',()=>{
 const destination={deliveryId:'stop-a',locationName:'INFORMA',clientId:'customer-master',storeId:'store-master',status:'done',proofPhotoSj:'proof.jpg',noSJ:'SJ-1',sjTripId:'pool-1'};
 links.append(destination,{noSJ:'SJ-2',sjTripId:'pool-2',clientId:'import-client',storeId:'import-store'});
 assert.deepEqual(links.numbers(destination),['SJ-1','SJ-2']);
 assert.equal(links.label(destination),'SJ-1, SJ-2');
 assert.equal(destination.noSJ,'SJ-1');
 assert.equal(destination.sjTripId,'pool-1');
 assert.equal(destination.deliveryId,'stop-a');
 assert.equal(destination.clientId,'customer-master');
 assert.equal(destination.storeId,'store-master');
 assert.equal(destination.status,'done');
 assert.equal(destination.proofPhotoSj,'proof.jpg');
 assert.equal(destination.sjLinks[0].sjTripId,'pool-1');
 assert.equal(destination.sjLinks[1].sjTripId,'pool-2');
 assert.throws(()=>links.append(destination,{noSJ:'sj-2'}),/sudah tertaut/);
});

test('legacy single SJ and a new destination both retain compatible primary numbers',()=>{
 assert.equal(links.label({noSJ:'#SJ-OLD',sjNumber:'SJ-OLD'}),'SJ-OLD');
 assert.equal(links.label({}, {noSJ:'SJ-ROOT'}),'SJ-ROOT');
 const destination={status:'pending'};
 links.append(destination,{noSJ:'SJ-1',sjTripId:'pool-1'});
 links.append(destination,{noSJ:'SJ-2',sjTripId:'pool-2'});
 assert.equal(destination.noSJ,'SJ-1');
 assert.equal(destination.sjNumber,'SJ-1');
 assert.equal(destination.sjLinks.length,2);
});

function manualFixture(online=false) {
 const manual={id:'manual',date:'2026-11-17T02:00:00Z',courierName:'Firdaus',destinations:[{deliveryId:'d1',locationName:'INFORMA',status:'done',proofPhotoSj:'proof.jpg',noSJ:'SJ-OLD',sjTripId:'old-pool'}]};
 const p1={id:'p1',noSJ:'SJ-1',status:'pool'},p2={id:'p2',noSJ:'SJ-2',status:'pool'};
 let stored=JSON.stringify([manual,p1,p2]);
 const rows={manual:structuredClone(manual),p1,p2};
 const audits=[],keys={};
 let auditId=0;
 const db={collection:name=>({doc:id=>({name,id:id||'audit-'+(++auditId)})}),runTransaction:async callback=>{
  const operations=[];
  await callback({get:async ref=>({exists:!!rows[ref.id],data:()=>rows[ref.id]}),update:(ref,data)=>operations.push(()=>Object.assign(rows[ref.id],data)),delete:ref=>operations.push(()=>delete rows[ref.id]),set:(ref,data)=>operations.push(()=>ref.name==='sj_import_keys'?keys[ref.id]=data:audits.push(data))});
  operations.forEach(operation=>operation());
 }};
 const elements=new Map();
 const window={SJReconcileCore:require('../js/sj_reconcile_core.js'),SJLinks:links,allCurrentTrips:[manual],allPoolTrips:[p1,p2],WTRACK_LOCAL_SANDBOX:!online,getDb:()=>db,showToast(){}};
 const context=vm.createContext({window,document:{getElementById:id=>elements.get(id)||null},localStorage:{getItem:()=>stored,setItem:(k,v)=>{stored=v;}},console,confirm:()=>true,alert:message=>{throw Error(message);},bootstrap:{Modal:{getInstance:()=>null,getOrCreateInstance:()=>({show(){}})}}});
 for(const id of ['sj-manual-link-body','sj-manual-link-apply','modal-sj-manual-link'])elements.set(id,{innerHTML:'',disabled:false});
 vm.runInContext(fs.readFileSync('js/sj_manual_link.js','utf8'),context);
 return {window,rows,audits,keys,getStored:()=>JSON.parse(stored)};
}

for(const online of [false,true])test(`bulk linking appends two SJ to an already linked stop (${online?'transaction':'local'})`,async()=>{
 const fixture=manualFixture(online),api=fixture.window.SJManualLink;
 fixture.window.UnifiedPoolUI={getSelectedTrips:()=>fixture.window.allPoolTrips};
 await api.openBulkFromSelection();
 api.setDate('2026-11-17');
 const state=api.state;
 assert.equal(state.targets.length,1);
 assert.equal(state.targets[0].existingSJ,'SJ-OLD');
 api.assignActive('manual::d1');
 api.assignActive('manual::d1');
 assert.equal(api.state.pairs.size,2);
 api.unassignPool('p2');
 assert.equal(api.state.pairs.size,1);
 api.assignActive('manual::d1');
 api.setDate('2026-11-17');
 assert.equal(api.state.pairs.size,2);
 await api.apply();
 const manual=online?fixture.rows.manual:fixture.getStored().find(row=>row.id==='manual');
 assert.equal(manual.destinations.length,1);
 assert.deepEqual(links.numbers(manual.destinations[0]),['SJ-OLD','SJ-1','SJ-2']);
 assert.equal(manual.destinations[0].status,'done');
 assert.equal(manual.destinations[0].proofPhotoSj,'proof.jpg');
 if(online){assert.equal(fixture.rows.p1,undefined);assert.equal(fixture.rows.p2,undefined);assert.equal(fixture.audits.length,2);assert.equal(fixture.keys['SJ-2'].tripId,'manual');}
});

test('automatic linking follows store identity instead of list order',()=>{
 const pools=[{noSJ:'SJ-Q',customer:'PT A',storeDestination:'STORE AZKO QBig, Jl. BSD'},{noSJ:'SJ-N',customer:'PT A',storeDestination:'Neka Pinang'}];
 const targets=[{id:'n',store:'Neka Pinang',customer:''},{id:'q',store:'AZKO QBig',customer:''}];
 assert.deepEqual(links.autoPairs(pools,targets).map(({pool,target})=>[pool.noSJ,target.id]),[['SJ-Q','q'],['SJ-N','n']]);
 assert.deepEqual(links.autoPairs(pools,[{id:'wrong',store:'Neka Ciledug'}]),[]);
});

test('automatic linking leaves duplicate destinations and conflicting companies unresolved',()=>{
 const pool={noSJ:'SJ-1',storeDestination:'INFORMA',customer:'PT A'};
 assert.equal(links.autoPairs([pool],[{store:'INFORMA',id:'a'},{store:'INFORMA',id:'b'}]).length,0);
 assert.equal(links.autoPairs([pool],[{store:'INFORMA',customer:'PT B'}]).length,0);
 assert.equal(links.autoPairs([{noSJ:'SJ-2'}],[{store:''}]).length,0);
});

test('source snapshot preserves original company, store and address',()=>{
 assert.deepEqual(links.sourceOf({customer:'PT A',storeDestination:'Store A',address:'Street A',destinations:[{address:'Different'}]}),{customer:'PT A',store:'Store A',address:'Street A'});
});

for(const change of ['deliveryId','source'])test(`transaction refuses stale ${change} instead of consuming the Pool SJ`,async()=>{
 const fixture=manualFixture(true),api=fixture.window.SJManualLink;
 fixture.window.UnifiedPoolUI={getSelectedTrips:()=>[fixture.window.allPoolTrips[0]]};
 await api.openBulkFromSelection();api.setDate('2026-11-17');api.assignActive('manual::d1');
 if(change==='deliveryId')fixture.rows.manual={...fixture.rows.manual,destinations:[{...fixture.rows.manual.destinations[0],deliveryId:'replaced'}]};
 else fixture.rows.p1={...fixture.rows.p1,customer:'Changed company'};
 await assert.rejects(api.apply(),/Sebagian SJ gagal/);
 assert.ok(fixture.rows.p1);
 assert.deepEqual(links.numbers(fixture.rows.manual.destinations[0]),['SJ-OLD']);
 assert.equal(fixture.audits.length,0);
});

test('same store label never matches a different street or house number automatically',()=>{
 const pool={storeDestination:'STORE AZKO QBig',customer:'PT A',address:'STORE AZKO QBig, Jl. Mawar No.10, Tangerang'};
 assert.equal(links.matches(pool,{store:'AZKO QBig',address:'Jalan Melati No.10, Tangerang'}),false);
 assert.equal(links.matches(pool,{store:'AZKO QBig',address:'Jalan Mawar No.20, Tangerang'}),false);
 assert.equal(links.matches(pool,{store:'AZKO QBig',address:'Jalan Mawar No.10, RT.01, Tangerang'}),true);
});

test('known LW/LP abbreviations match without treating different branches as aliases',()=>{
 assert.equal(links.matches({storeDestination:'STORE INFORMA LW KOTA WISATA'},{store:'INFORMA Living World Kota Wisata'}),true);
 assert.equal(links.matches({storeDestination:'STORE INFORMA LP JABABEKA'},{store:'INFORMA Living Plaza Cinere'}),false);
});

test('a billing company without a delivery address is not an automatic destination match',()=>{
 assert.equal(links.matches({customer:'PT A',destinations:[{locationName:'PT A'}]},{store:'PT A'}),false);
 assert.equal(links.matches({customer:'PT A',destinations:[{locationName:'PT A',address:'Jl. Mawar No.10'}]},{store:'PT A',address:'Jl. Mawar No.10'}),true);
});

test('unlinking today preserves older SJ, physical delivery and POD',()=>{
 const d={deliveryId:'stop',locationName:'Store A',address:'Jl. Mawar',customer:'PT A',latitude:-6,longitude:106,status:'done',proofPhotoSj:'proof.jpg',noSJ:'SJ-TODAY',sjNumber:'SJ-TODAY',sjTripId:'today-pool',sjMatchedAt:'2026-11-18',sjMatchRule:'manual-link',sjIdentityStatus:'needs-review',sjLinks:[{noSJ:'SJ-OLDER',sjTripId:'older-pool',sjMatchedAt:'2026-11-17'},{noSJ:'SJ-TODAY',sjTripId:'today-pool',sjMatchedAt:'2026-11-18'}]};
 const before=structuredClone(d);
 assert.deepEqual(links.remove(d,['sj-today']),['SJ-TODAY']);
 assert.deepEqual(links.numbers(d),['SJ-OLDER']);assert.equal(d.sjTripId,'older-pool');
 for(const k of ['deliveryId','locationName','address','customer','latitude','longitude','status','proofPhotoSj'])assert.deepEqual(d[k],before[k]);
 assert.deepEqual(links.remove(d,['SJ-OLDER']),['SJ-OLDER']);assert.deepEqual(links.numbers(d),[]);
 for(const k of ['noSJ','sjNumber','sjLinks','sjTripId','sjMatchedAt','sjMatchRule','sjIdentityStatus'])assert.equal(d[k],undefined);
});

test('unlink ignores numbers outside the selection and supports legacy single-number stops',()=>{
 const d={noSJ:'SJ-OLD',sjTripId:'pool',status:'pending'};const before=structuredClone(d);
 assert.deepEqual(links.remove(d,['SJ-TODAY']),[]);assert.deepEqual(d,before);
 assert.deepEqual(links.remove(d,['SJ-OLD']),['SJ-OLD']);assert.deepEqual(d,{status:'pending'});
});

test('automatic matches are audited separately from manual selections',async()=>{
 const fixture=manualFixture(true),api=fixture.window.SJManualLink;
 fixture.rows.p1.storeDestination='INFORMA';
 fixture.window.UnifiedPoolUI={getSelectedTrips:()=>[fixture.window.allPoolTrips[0]]};
 await api.openBulkFromSelection();api.setDate('2026-11-17');api.setCourier('Firdaus');api.autoPair();
 assert.equal(api.state.pairs.size,1);await api.apply();
 assert.equal(fixture.audits[0].source,'admin-auto-link');
 assert.equal(fixture.rows.manual.destinations[0].sjLinks.find(l=>l.noSJ==='SJ-1').sjMatchRule,'automatic-store-match');
});
