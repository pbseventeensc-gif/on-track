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
