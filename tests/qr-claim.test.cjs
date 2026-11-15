const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const QRClaim=require('../js/qr_claim.js');
const fixture=()=>({id:'trip-a',noSJ:'SJ-1126-02302',status:'pool',courierId:'',items:[{nama:'Poster',qty:2}],destinations:[{status:'pending',deliveryId:'d-a',address:'Jakarta'}]});
const courier={uid:'pb-uid',name:'pbseventeensc'};
const parsed={sjNumber:'SJ-1126-02302'};
test('only scanning assigns a pooled SJ to the logged-in courier, keeping items and exact identity',()=>{
 const source=fixture(),other={...fixture(),id:'other',noSJ:'SJ-1126-023020'};
 const result=QRClaim.claim([other,source],parsed,courier,null,'2026-11-13T09:00:00Z');
 assert.equal(result.trip.courierId,'pb-uid');assert.equal(result.trip.assignmentSource,'qr_scan');assert.equal(result.trip.status,'in_progress');assert.equal(result.trip.destinations[0].status,'in_progress');assert.deepEqual(result.trip.items,source.items);assert.equal(result.trips[0],other);assert.equal(source.courierId,'');
 assert.equal(QRClaim.matches({...source,noSJ:'SJ-1126-023020'},parsed),false);
});
test('scan cannot steal other courier tasks, pick up customer orders, unready goods or completed deliveries',()=>{
 for(const change of [{courierId:'other'},{status:'completed'},{readyStatus:'not_ready'},{pickupStatus:'waiting'},{destinations:[{status:'done',proofPhotoUrl:'proof'}]}]) {
  assert.throws(()=>QRClaim.claim([{...fixture(),...change}],parsed,courier));
 }
 assert.throws(()=>QRClaim.claim([fixture(),fixture()],parsed,courier),/ganda/);
});
test('repeat scan preserves the original assignment timestamp, pending status and proof',()=>{
 const source={...fixture(),courierId:'pb-uid',status:'pending_approval',assignedAt:'original',pendingNote:'Call first'};
 const result=QRClaim.claim([source],parsed,courier);assert.equal(result.alreadyAssigned,true);assert.equal(result.trip,source);assert.equal(result.trip.assignedAt,'original');assert.equal(result.trip.pendingNote,'Call first');
});
test('failed LAN claim never adds a task to the courier screen or reports success',async()=>{
 let refreshed=false,success=false,toast='';
 const c=vm.createContext({window:{WTRACK_LOCAL_SANDBOX:true,persistLocalSandboxTrips:async()=>{throw Error('Konflik versi');},refreshLocalCourier:()=>{refreshed=true;}},QRClaim,currentCourier:courier,
 localStorage:{getItem:()=>JSON.stringify([fixture()])},masterShipments:[],stopBarcodeScannerCamera(){},showToast:message=>{toast=message;},navigateToScreen(){},doesTripBelongToCurrentCourier:()=>false,
 parseWtrackBarcode:()=>({...parsed,searchKeys:[parsed.sjNumber]}),showTaskClaimedModal(){success=true;},console:{error(){}}});
 const html=fs.readFileSync(require.resolve('../kurir.html'),'utf8');
 vm.runInContext(html.slice(html.indexOf('    async function onBarcodeDetectedSuccess('),html.indexOf('    function showTaskClaimedModal(')),c);
 await c.onBarcodeDetectedSuccess('qr');assert.equal(refreshed,false);assert.equal(success,false);assert.match(toast,/Konflik versi/);assert.equal(c.masterShipments.length,0);
});
