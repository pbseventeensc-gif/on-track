const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=require('../js/dispatch_workflow.js');
const identity=require('../js/delivery_identity.js');
const now='2026-11-13T07:20:00.000Z';
const trip=()=>({id:'trip-a',tripId:'trip-a',noSJ:'SJ-1126-12345',sourceFile:'actual.xls',status:'in_progress',courierId:'courier-a',courierName:'Kurir A',
    readyStatus:'ready',address:'Alamat lama',items:[{nama:'ART PAPER',ukuran:'1 x 1',qty:3}],
    destinations:[{deliveryId:'delivery-a',noSJ:'SJ-1126-12345',stopIndex:1,locationName:'Klien A',address:'Alamat lama',latitude:-6.2,longitude:106.8,status:'in_progress'}]});

test('address edits only target the selected delivery, preserving coordinates unless a new location is requested',()=>{
    const source=trip();source.destinations.push({...source.destinations[0],deliveryId:'delivery-b',locationName:'Klien B'});
    const ref=api.reference(source,1);
    const updated=api.apply([source],ref,'address',{address:'Alamat baru',resetCoordinates:true},now);
    assert.equal(source.destinations[1].address,'Alamat lama');
    assert.deepEqual(updated[0].destinations[0],source.destinations[0]);
    assert.equal(updated[0].destinations[1].address,'Alamat baru');
    assert.equal(updated[0].destinations[1].latitude,null);
    assert.equal(updated[0].destinations[1].locationNeedsReview,true);
    const single=trip();
    const textOnly=api.apply([single],api.reference(single),'address',{address:'Koreksi alamat'},now)[0];
    assert.equal(textOnly.address,'Koreksi alamat');assert.equal(textOnly.destinations[0].latitude,-6.2);
});

test('Urgent preserves the courier pending reason, note and timestamp',()=>{
    const source=trip();source.status='pending_approval';source.destinations[0].status='pending_approval';
    Object.assign(source.destinations[0],{pendingReason:'Toko tutup',pendingNote:'Telepon sebelum datang',pendingAt:now});
    const result=api.apply([source],api.reference(source),'urgent',{urgent:true},now)[0];
    assert.equal(result.priority,'urgent');assert.equal(result.destinations[0].status,'pending_approval');
    assert.equal(result.destinations[0].pendingNote,'Telepon sebelum datang');
    assert.equal(result.destinations[0].pendingAt,now);
    assert.equal(api.pendingInfo(result,result.destinations[0]).note,'Telepon sebelum datang');
});

test('unassigning a single SJ returns it to pool with all items and notes preserved',()=>{
    const source=trip();source.destinations[0].pendingNote='Catatan asli';
    const updated=api.apply([source],api.reference(source),'unassign',{},now)[0];
    assert.equal(updated.status,'pool');assert.equal(updated.courierId,'');
    assert.deepEqual(updated.items,source.items);assert.equal(updated.noSJ,source.noSJ);
    assert.equal(updated.destinations[0].pendingNote,'Catatan asli');
    assert.equal(source.courierId,'courier-a');
});

test('removing one assignment preserves completed siblings and same-stop-number clients',()=>{
    const source=trip();
    source.destinations=[{...source.destinations[0],status:'done',completedTime:now,proofPhotoUrl:'https://example.test/proof'},
        {...source.destinations[0],deliveryId:'delivery-b',noSJ:'SJ-B',locationName:'Klien B'},
        {...source.destinations[0],deliveryId:'delivery-c',noSJ:'SJ-C',locationName:'Klien C'}];
    const updated=api.apply([source],api.reference(source,1),'unassign',{},now);
    assert.equal(updated.length,2);assert.deepEqual(updated[0].destinations,[source.destinations[0],source.destinations[2]]);
    assert.equal(updated[1].noSJ,'SJ-B');assert.equal(updated[1].courierId,'');
    assert.equal(updated[1].destinations[0].deliveryId,'delivery-b');
    assert.throws(()=>api.apply([source],api.reference(source,0),'unassign',{},now),/sudah selesai/);
});

test('Pickup requires waiting first, actual recipient and goods ready before completing',()=>{
    const source=trip();source.status='pool';source.courierId='';source.destinations[0].status='pending';
    const ref=api.reference(source);
    const waiting=api.apply([source],ref,'pickup-waiting',{},now);
    assert.equal(waiting[0].pickupStatus,'waiting');assert.equal(waiting[0].status,'pool');
    assert.equal(waiting[0].completedAt,undefined);
    assert.throws(()=>api.apply(waiting,ref,'pickup-collected',{recipient:''},now),/nama pengambil/);
    const notReady=JSON.parse(JSON.stringify(waiting));notReady[0].readyStatus='not_ready';
    assert.throws(()=>api.apply(notReady,ref,'pickup-collected',{recipient:'Budi'},now),/belum siap/);
    const collected=api.apply(waiting,ref,'pickup-collected',{recipient:'Budi',note:'Ambil di gudang'},now)[0];
    assert.equal(collected.status,'completed');assert.equal(collected.pickupStatus,'collected');assert.equal(collected.pickupRecipient,'Budi');
    assert.equal(collected.destinations[0].completedTime,now);assert.equal(collected.completedAt,now);
    const cancelled=api.apply(waiting,ref,'pickup-cancel',{},now)[0];
    assert.equal(cancelled.pickupStatus,null);assert.equal(cancelled.status,'pool');
});

test('a failed local/LAN save never claims success or modifies memory',async()=>{
    const source=trip(),raw=JSON.stringify([source]);let refreshes=0;
    const window={WTRACK_LOCAL_SANDBOX:true,localStorage:{getItem:()=>raw},persistLocalSandboxTrips:async()=>{throw Error('versi berubah');},allPoolTrips:[source],syncAllCurrentTrips(){refreshes++;}};
    vm.runInContext(fs.readFileSync(require.resolve('../js/dispatch_workflow.js'),'utf8'),vm.createContext({window,Date}));
    await assert.rejects(window.DispatchWorkflow.mutate(api.reference(source),'unassign',{}),/versi berubah/);
    assert.equal(refreshes,0);assert.equal(window.allPoolTrips[0].courierId,'courier-a');
});

test('local pool reads courier pending notes even with no loaded trip cache, and excludes completed siblings',()=>{
    const source=trip();source.destinations=[{...source.destinations[0],status:'done',completedTime:now},
        {...source.destinations[0],deliveryId:'delivery-b',noSJ:'SJ-B',locationName:'Klien B',status:'pending_approval',pendingReason:'Toko tutup',pendingNote:'Hubungi besok',priority:'urgent'},
        {...source.destinations[0],deliveryId:'delivery-c',noSJ:'SJ-C',locationName:'Klien C'}];
    source.pendingReason='Toko tutup';
    const storage={getItem:key=>key==='wtrack_local_trips'?JSON.stringify([source]):null};
    const window={WTRACK_LOCAL_SANDBOX:true,DispatchWorkflow:api,allPoolTrips:[],allCurrentTrips:[]};
    const c=vm.createContext({window,localStorage:storage,console,Date});
    vm.runInContext(fs.readFileSync(require.resolve('../js/unified_pool_ui.js'),'utf8'),c);
    const pool=window.UnifiedPoolUI.getTripsSource();
    assert.equal(pool.length,1);assert.equal(pool[0].noSJ,'SJ-B');assert.equal(pool[0].pendingNote,'Hubungi besok');
    assert.equal(pool[0].priority,'urgent');assert.equal(pool[0].workflowRef.deliveryId,'delivery-b');
});

test('courier pending report persists the separate note on the exact delivery',async()=>{
    const source=trip(),data=new Map([['wtrack_local_trips',JSON.stringify([source])]]);
    const target={id:source.id,rootTripId:source.id,deliveryId:'delivery-a',noSJ:'#'+source.noSJ,stopIndex:1};
    const fields={'pending-reason-input':{value:'Klien tutup'},'pending-note-input':{value:'Hubungi Pak Budi besok'}};
    const c=vm.createContext({currentPendingTripId:source.id,currentPendingPhoto:'',masterShipments:[target],DeliveryIdentity:identity,firestoreDb:null,
        document:{getElementById:id=>fields[id]||{}},localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)},
        renderHomeScreen(){},renderShipmentsScreen(){},showToast(){},bootstrap:{Modal:{getInstance:()=>null}},console});
    const html=fs.readFileSync(require.resolve('../kurir.html'),'utf8');
    vm.runInContext(html.slice(html.indexOf('    async function submitPendingReport('),html.indexOf("    let currentSJPhoto = ''")),c);
    await c.submitPendingReport();
    const saved=JSON.parse(data.get('wtrack_local_trips'))[0];
    assert.equal(saved.pendingNote,'Hubungi Pak Budi besok');assert.equal(saved.destinations[0].pendingNote,'Hubungi Pak Budi besok');
    assert.equal(saved.destinations[0].pendingReason,'Klien tutup');
});


test('courier local pending report waits for persistence and keeps the screen unchanged on LAN failure',async()=>{
 const source=trip(),target={id:source.id,rootTripId:source.id,deliveryId:'delivery-a',noSJ:source.noSJ,status:'in_progress'};
 let written=false,rendered=false,toast='';const fields={'pending-reason-input':{value:'Klien tutup'},'pending-note-input':{value:'Catatan'}};
 const c=vm.createContext({window:{WTRACK_LOCAL_SANDBOX:true,persistLocalSandboxTrips:async()=>{throw Error('Versi berubah');}},currentPendingTripId:source.id,currentPendingPhoto:'',masterShipments:[target],DeliveryIdentity:identity,firestoreDb:null,
 document:{getElementById:id=>fields[id]||{}},localStorage:{getItem:()=>JSON.stringify([source]),setItem:()=>{written=true;}},renderHomeScreen(){rendered=true;},showToast(message){toast=message;},console:{warn(){}}});
 const html=fs.readFileSync(require.resolve('../kurir.html'),'utf8');
 vm.runInContext(html.slice(html.indexOf('    async function submitPendingReport('),html.indexOf("    let currentSJPhoto = ''")),c);
 await c.submitPendingReport();assert.equal(target.status,'in_progress');assert.equal(written,false);assert.equal(rendered,false);assert.equal(toast,'Versi berubah');
});
