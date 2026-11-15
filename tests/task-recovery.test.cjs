const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/app.js','utf8');
function setup(extra = {}) {
    const context = vm.createContext({...extra});
    vm.runInContext(source.slice(source.indexOf('function isRecoveryCompleted('),source.indexOf('async function reactivateCourierAllTrips(')),context);
    return context;
}
test('mixed route recovery preserves completed stops and every photo field',()=>{
    const c = setup();
    const done = {status:'done',completedTime:123,proofPhotoItems:['https://photo/a'],proofPhotoSj:'https://photo/sj'};
    const proofOnly = {status:'pending',proofPhotoUrl:'https://photo/b'};
    const pending = {status:'pending_approval',pendingReason:'Tutup',pendingProofPhotoUrl:'https://photo/pending'};
    const result = c.buildRecoveryUpdate({status:'in_progress',proofPhotoUrl:'https://photo/parent',destinations:[done,proofOnly,pending]});
    assert.equal(result.destinations[0],done);
    assert.equal(result.destinations[1],proofOnly);
    assert.equal(result.destinations[2].status,'in_progress');
    assert.equal(result.destinations[2].pendingProofPhotoUrl,pending.pendingProofPhotoUrl);
    assert.equal(result.destinations[2].pendingReason,'Tutup');
    assert.equal('completedAt' in result,false);
});
test('completed routes, all completed stops and completion timestamps are never reactivated',()=>{
    const c=setup();
    for(const trip of [
        {status:'completed',destinations:[{status:'pending'}]},
        {status:'delivered'}, {completedAt:123},
        {status:'in_progress',destinations:[{status:'done'},{proofPhotoSj:'https://photo/sj'}]}
    ]) assert.equal(c.buildRecoveryUpdate(trip),null);
});
test('transaction uses fresh server state and refuses yesterday or transferred tasks',async()=>{
    let updates=[];
    let latest={status:'completed',date:12,courierId:'agung'};
    const c=setup({isMonitorTripToday:t=>t.date===12});
    const db={collection:()=>({doc:id=>({id})}),runTransaction:async callback=>callback({
        get:async()=>({exists:true,data:()=>latest}),update:(ref,data)=>updates.push(data)
    })};
    assert.equal(await c.recoverTodayTrip(db,'trip'),false);
    latest={status:'pending',date:11};
    assert.equal(await c.recoverTodayTrip(db,'trip'),false);
    latest={status:'pending',date:12,courierId:'other'};
    assert.equal(await c.recoverTodayTrip(db,'trip',t=>t.courierId==='agung'),false);
    assert.equal(updates.length,0);
    latest={status:'pending',date:12,courierId:'agung',destinations:[{status:'pending'}]};
    assert.equal(await c.recoverTodayTrip(db,'trip',t=>t.courierId==='agung'),true);
    assert.equal(updates.length,1);
});
test('courier recovery fetches server without writing and opens unfinished view',async()=>{
    const html=fs.readFileSync('kurir.html','utf8');
    let consumed, navigated, renders=0;
    const snapshot={server:true};
    const c=vm.createContext({isRecoveringCourierTasks:false,currentCourier:{canonicalId:'agung'},currentFilter:'all',
        firestoreDb:{collection:name=>{assert.equal(name,'trips');return {get:async opts=>{assert.equal(opts.source,'server');return snapshot;}};}},
        document:{querySelectorAll:()=>[],getElementById:()=>null},showToast(){},console:{warn(){}},
        syncFirestoreTrips:s=>{consumed=s;},navigateToScreen:s=>{navigated=s;},renderHomeScreen(){},renderShipmentsScreen(){renders++;},
        getValidCourierShipments:()=>[{status:'delivered'},{status:'in-transit'}],isRecoveryShipmentToday:()=>true
    });
    vm.runInContext(html.slice(html.indexOf('    async function recoverCourierTasks()'),html.indexOf('    function syncLocalImportedTrips()')),c);
    await c.recoverCourierTasks();
    assert.equal(consumed,snapshot);assert.equal(navigated,'shipments');assert.equal(c.currentFilter,'unfinished');assert.equal(renders,1);
    assert.equal(c.isRecoveringCourierTasks,false);
    c.firestoreDb.collection=()=>({get:async()=>{throw Error('offline');}});
    consumed=null;
    await c.recoverCourierTasks();
    assert.equal(consumed,null);assert.equal(c.isRecoveringCourierTasks,false);
});
